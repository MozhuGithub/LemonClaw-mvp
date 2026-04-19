# RivonClaw Gateway 生命周期管理

> 详细记录 RivonClaw 如何管理 OpenClaw Gateway 子进程的启动、运行、重启、停止
> **来源**：RivonClaw 源码深度分析
> **面向项目**：LemonClaw（直接参考）
> **日期**：2026-04-19

---

## 一、整体架构

```
Electron Desktop（主进程）
  └── GatewayLauncher（子类进程生命周期管理）
        ├── 写入 openclaw.json 配置
        ├── 写入 auth-profiles.json（密钥）
        ├── spawn OpenClaw Gateway 子进程
        └── WebSocket RPC 连接
  └── OpenClawConnector（RPC 传输门面）
        ├── 管理 RPC client 连接/重连
        ├── 事件分发（EventDispatcher）
        └── 配置变更触发器
  └── HTTP Server（Panel 面板服务）
        ├── REST API（路由注册）
        ├── SSE Patch 流（→ Panel）
        └── chat.events SSE（通知）
```

---

## 二、GatewayLauncher — 子进程管理器

**文件**：`packages/gateway/src/launcher.ts`

### 2.1 核心职责

- 负责 OpenClaw Gateway 子进程的 spawn / stop / restart
- 管理进程健康状态和指数退避重启
- 预热 V8 编译缓存
- 注入环境变量（配置路径、密钥、跳过项）

### 2.2 生命周期状态

```typescript
type GatewayState = "stopped" | "starting" | "running" | "stopping"
```

事件：`started` → `ready` → `stopped` / `restarting` / `error`

### 2.3 启动流程（`spawnProcess()`）

```
1. 设置状态为 "starting"
2. 构建环境变量：
   - process.env + 自定义覆盖
   - OPENCLAW_CONFIG_PATH（配置文件路径）
   - OPENCLAW_STATE_DIR（状态目录）
3. 设置 OPENCLAW_NO_RESPAWN=1（防止 Gateway 自管理子进程）
4. 设置 OPENCLAW_SKIP_BROWSER_CONTROL_SERVER=1（跳过 15-30s 浏览器控制初始化）
5. 预热 V8 编译缓存：
   - 从 dist/compile-cache/ 复制到 {stateDir}/compile-cache/
   - 仅版本变更时执行
6. 写入 startup-timer.cjs 预加载脚本（启动计时 + 插件路径解析补丁）
7. spawn OpenClaw Gateway：
   - detached: true（进程组管理）
   - stdio: 继承（gateway 日志输出到桌面进程）
8. 监听 stdout "listening on" → 发出 "ready" 事件
9. 设置 15s 无输出告警（检测启动静默失败）
```

**关键环境变量**：
- `OPENCLAW_CONFIG_PATH`：指向 `~/.rivonclaw/openclaw/openclaw.json`
- `OPENCLAW_STATE_DIR`：指向 `~/.rivonclaw/`（默认）或自定义
- `OPENCLAW_NO_RESPAWN=1`：防止 gateway 自管理子进程（避免孤儿进程）
- `OPENCLAW_SKIP_BROWSER_CONTROL_SERVER=1`：跳过浏览器控制初始化，加速启动

### 2.4 停止流程（`stop()`）

```
1. 设置 stopRequested=true
2. 清除重启定时器
3. 发送 SIGTERM 给进程树
4. 5s 后未退出 → SIGKILL 兜底
```

**进程树终止**（`killProcessTree()`）：
- Windows：`taskkill /T /F /PID {pid}`（/T = 含子进程）
- Unix：`process.kill(-pid, signal)`（负 PID = 进程组）

### 2.5 重启流程（`reload()`）

```
1. 发送 SIGUSR1（优雅重载配置）
2. 15s 启动保护期内跳过重载
3. Windows 不支持 SIGUSR1 → 回退为 stop + start
```

### 2.6 指数退避（`scheduleRestart()`）

```
退避时间 = min(initialBackoff * 2^(attempt-1), maxBackoff)
        = min(1000 * 2^n, 30000)

如果进程运行 >= healthyThresholdMs（60s），重置退避到 attempt 1
```

| 尝试 | 延迟 |
|------|------|
| 1 | 1s |
| 2 | 2s |
| 3 | 4s |
| 4 | 8s |
| 5 | 16s |
| 6+ | 30s（上限） |

---

## 三、配置桥接（Config Bridge）

配置桥接有三层：app 层的 Config Builder、package 层的 Config Writer、mutation 分发的 Config Handlers。

### 3.1 Config Builder（app 层）

**文件**：`apps/desktop/src/gateway/config-builder.ts`

`buildFullGatewayConfig(gatewayPort)` 构建完整配置对象，包含：
- 端口、认证 token、模型选择
- STT 配置（Groq / 火山引擎）
- Web 搜索配置（Brave / Perplexity / Grok / Gemini / Kimi）
- Embedding 配置（OpenAI / Gemini / Voyage / Mistral / Ollama）
- 插件 allow/entries（rivonclaw-tools、rivonclaw-policy、channel 插件）
- 浏览器模式（standalone / cdp）
- 工具 allowlist（`["group:openclaw", "group:fs", "group:runtime", "group:plugins"]`）
- Extra providers、local provider overrides
- Agent workspace 路径、skill 目录

### 3.2 Config Writer（package 层）

**文件**：`packages/gateway/src/config-writer.ts`

`writeGatewayConfig(options)` 核心写入函数：
```
1. 读取磁盘现有配置（保留用户设置）
2. 合并 gateway 节（port、auth token、mode）
3. 合并 controlUi 设置
4. 写入 mDNS 发现配置
5. 启用 /v1/chat/completions 端点
6. 启用 commands.restart（SIGUSR1 优雅重载）
7. 设置 ownerAllowFrom（owner-only 工具）
8. 写入默认模型 → agents.defaults.model.primary
9. 设置 skipBootstrap 和 workspace 目录
10. 强制 block streaming 默认值
11. 设置 LLM idle timeout 300s
12. 设置 compaction 默认（notifyUser: false）
13. 设置 tools profile = "full" + exec host/security
14. 写入工具 allowlist（ADR-031）
15. 管理 plugins 节（load paths、entries、allowlist、deny seed）
16. 清理未使用插件（~25 个，缩短 Windows 启动时间）
17. 写入 skills extra dirs、STT audio、web search、embedding、extra providers
18. 写入 browser mode、session policy、channel accounts
19. 用 OpenClawSchema.safeParse() 剥离未知 key
20. 修复语义验证错误
21. JSON 写入磁盘
```

### 3.3 Config Handlers（mutation 分发）

**文件**：`apps/desktop/src/gateway/config-handlers.ts`

| 操作 | 效果 | 是否重启 |
|------|------|--------|
| `handleSttChange()` | 重写配置 + rebuild env + restart_process | 是 |
| `handleExtrasChange()` | 重写配置 + rebuild env + restart_process | 是 |
| `handlePermissionsChange()` | rebuild env + restart_process | 是 |
| `handleProviderChange(keyOnly)` | 同步 auth-profiles.json + proxy 配置 | 否 |
| `handleProviderChange(configOnly)` | 发送 SIGUSR1 优雅重载 | 否 |
| `handleProviderChange()` | 全量重写 + restart_process | 是 |

**关键洞察**：Provider key 变更（API key 写入 auth-profiles.json）**不需要重启**，因为 Gateway 每次 LLM 调用都会读取 auth-profiles.json。

---

## 四、API Key 注入机制

### 4.1 两路注入

**LLM Provider Keys → auth-profiles.json（不通过环境变量）**

```
Keychain（macOS）/ DPAPI（Windows）
  ↓ secretStore.get("provider-key-{id}")
  ↓ syncAllAuthProfiles()
auth-profiles.json（{stateDir}/agents/main/agent/）
  ↓ Gateway 每次 LLM 调用读取
OpenClaw Gateway（运行时）
```

**非 LLM 密钥 → 环境变量**

```
SecretStore
  ↓ resolveSecretEnv(store)
  ↓ buildGatewayEnv()
环境变量（HTTP_PROXY、各类 API_KEY）
  ↓ launcher.setEnv()
OpenClaw Gateway（启动时）
```

### 4.2 auth-profiles.json 格式

**文件**：`packages/gateway/src/auth-profile-writer.ts`

```typescript
interface AuthProfileStore {
  version: number                    // 恒为 1
  profiles: Record<string, AuthProfileCredential>
  order?: Record<string, string[]>   // provider → 排序后的 profile ID 列表
}

type ApiKeyProfile = { type: "api_key"; provider: string; key: string }
type OAuthProfile = {
  type: "oauth"
  provider: string
  access: string
  refresh: string
  expires: number
  email?: string
  projectId?: string
}
```

Profile ID 约定：`{gatewayProvider}:active`（例如 `anthropic:active`）

---

## 五、OpenClawConnector — RPC 传输门面

**文件**：`apps/desktop/src/openclaw/openclaw-connector.ts`

### 5.1 职责

- Gateway 进程生命周期管理（通过 GatewayLauncher 事件）
- RPC client 连接/断开/重连
- Sidecar 就绪探测
- 统一 request() 门面
- 配置变更触发（applyConfigMutation）

### 5.2 WebSocket 就绪探测

Gateway 打印 `"listening on"` 后，WebSocket handlers 需要 60-200ms 就绪。`waitForWsReady()` 用丢弃连接探测（最多 10 次，间隔 100ms）避免 RPC 握手时 503。

### 5.3 Sidecar 就绪探测

RPC 连接后，用 `chat.history` RPC 调用探测 sidecar（最多 20 次，间隔 500ms，总预算约 110s）。

### 5.4 重连策略

```
503 错误（sidecar 仍在启动）→ 固定 500ms 延迟
其他错误 → 指数退避 min(1000 * 2^n, 30000)
```

使用单调递增 generation 计数器防止过期探测/重连链在较新的启动周期后执行。

---

## 六、状态目录结构

**基础路径**（`packages/core/src/paths.ts`）：

| 路径 | 用途 |
|------|------|
| `~/.rivonclaw/` | 所有 RivonClaw 数据根目录 |
| `~/.rivonclaw/openclaw/openclaw.json` | Gateway 配置文件 |
| `~/.rivonclaw/openclaw/` | OpenClaw 状态目录（可被 OPENCLAW_STATE_DIR 覆盖） |
| `~/.rivonclaw/db.sqlite` | SQLite 数据库 |
| `~/.rivonclaw/logs/` | 日志目录 |
| `~/.rivonclaw/secrets/` | secrets 目录（DPAPI 加密） |
| `~/.rivonclaw/update-installing` | 更新中标记 |
| `{stateDir}/agents/main/agent/auth-profiles.json` | API 密钥存储 |
| `{stateDir}/agents/main/sessions/` | Session 存储 |
| `{stateDir}/workspace/` | Agent workspace（SOUL.md、memory 等） |
| `{stateDir}/skills/` | 用户安装的技能 |
| `{stateDir}/credentials/` | Channel pairing、mobile allowlists |
| `{stateDir}/compile-cache/` | V8 编译缓存 |
| `{stateDir}/startup-timer.cjs` | 启动计时预加载脚本 |

---

## 七、端口管理

### 7.1 端口默认值

```typescript
ports: { gateway: 0, panel: 0, proxyRouter: 0, panelDev: 5180, cdpOffset: 12 }
// 0 = OS 分配临时端口
```

### 7.2 Gateway 端口确定

```typescript
const envGatewayPort = resolveGatewayPort()  // 读 RIVONCLAW_GATEWAY_PORT
const actualGatewayPort = envGatewayPort !== 0 ? envGatewayPort : await findFreePort()
```

### 7.3 Panel 发现 Gateway 端口

Panel 通过读取磁盘上 openclaw.json 中 `gateway.port` 发现端口（fallback 到实际端口）。

### 7.4 CDP 端口

Chrome DevTools Protocol 端口 = `gatewayPort + 12`。Gateway 在 3212 → CDP 在 3224。

---

## 八、LemonClaw 参考要点

| 方面 | RivonClaw 做法 | LemonClaw 可直接借鉴 |
|------|--------------|-------------------|
| 子进程管理 | GatewayLauncher 专用类 | LemonClaw 可参考此模式 |
| 配置写入 | Config Writer 按层分离 | 同 |
| 密钥注入 | auth-profiles.json | **直接用**（LemonClaw 已在用） |
| 启动参数 | NO_RESPAWN、SKIP_BROWSER_CONTROL | **直接用** |
| 重连策略 | generation counter 防竞态 | 值得借鉴 |
| V8 缓存预热 | 从 dist/ 复制到 stateDir | 可选 |
| 优雅重载 | SIGUSR1 → config re-read | 支持 |

---

## 九、关键文件索引

| 组件 | 文件路径 |
|------|---------|
| GatewayLauncher | `packages/gateway/src/launcher.ts` |
| 类型定义 | `packages/gateway/src/types.ts` |
| Config Writer | `packages/gateway/src/config-writer.ts` |
| Config Builder | `apps/desktop/src/gateway/config-builder.ts` |
| Config Handlers | `apps/desktop/src/gateway/config-handlers.ts` |
| Auth Profile Writer | `packages/gateway/src/auth-profile-writer.ts` |
| Secret Injector | `packages/gateway/src/secret-injector.ts` |
| RPC Client | `packages/gateway/src/rpc-client.ts` |
| OpenClawConnector | `apps/desktop/src/openclaw/openclaw-connector.ts` |
| EventDispatcher | `apps/desktop/src/gateway/event-dispatcher.ts` |
| Main 入口 | `apps/desktop/src/app/main.ts` |
| 路径定义 | `packages/core/src/paths.ts` |
| 端口定义 | `packages/core/src/ports.ts` |
| 启动工具 | `apps/desktop/src/gateway/startup-utils.ts` |
