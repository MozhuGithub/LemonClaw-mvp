# LemonClaw MVP 实现方案

> 完整的技术实现文档：已完成的步骤记录详细实现方式，未完成的记录详细任务拆分
>
> 渐进明细：每完成一个 Step 后补充详细实现记录
>
> 创建日期：2026-04-17
> 最后更新：2026-04-19
> 架构版本：v3.0.0（Vendor 子进程模式）

---

## Phase 1: Gateway 集成 + Electron 壳

> 架构变更说明：原 Phase 1 的 IPC/LLM/Agent/SQLite 等步骤（旧 Step 3-8）不再需要自行实现，由 OpenClaw Gateway 子进程提供。新 Phase 1 聚焦于 Gateway 集成层和 Electron UI 对接。

### Step 1: Electron 安全骨架 ✅（2026-04-16）

**任务拆分：**

| 任务 | 实现 |
|------|------|
| electron-vite 项目初始化 | electron-vite 2.3 + Electron 32，`pnpm create` |
| 主进程安全配置 | `contextIsolation: true` + `nodeIntegration: false` + `sandbox: true` |
| Preload API | contextBridge 暴露 `window.lemonclaw`（ping/getInfo） |
| 单实例锁 + 窗口管理 | `app.requestSingleInstanceLock()` + 窗口激活 |
| React 18 + Tailwind 基础页 | React StrictMode + Tailwind 指令 + 暗色 demo 页 |
| 项目文件对齐架构 | 删除 rules/、创建 skills/learning/、清理 README/package.json |

**关键文件：**
- `src/main/index.ts` — 主进程入口（BrowserWindow + IPC handler）
- `src/preload/index.ts` — contextBridge API
- `src/renderer/index.html` + `src/renderer/src/main.tsx` + `App.tsx` — React 入口

**踩坑记录：**
- `ELECTRON_RUN_AS_NODE=1` 被 Claude Code 设置，导致 `electron.app` undefined
- `cross-env ELECTRON_RUN_AS_NODE=` 在 Windows 上只设空值不 unset
- 解决：dev 脚本改为 `env -u ELECTRON_RUN_AS_NODE electron-vite dev`

---

### Step 2: 前端框架搭建 ✅（2026-04-17）

**任务拆分：**

| 任务 | 实现 |
|------|------|
| shadcn/ui 集成 | 手动初始化（CLI 向导不兼容 electron-vite 目录结构） |
| 路径别名 `@/` | tsconfig.json `baseUrl` + `paths` + electron-vite `resolve.alias` |
| Tailwind 暗色主题 | .mjs → .js（CJS），shadcn CSS 变量 + lemon 品牌色 + tailwindcss-animate |
| 页面路由 | Zustand 状态驱动（`currentPage`），不用 react-router |
| 布局组件 | Sidebar（260px）+ PageRouter + AppLayout |
| 页面占位符 | ChatPage（骨架：header + 消息区 + 输入区）、AgentsPage、SettingsPage |
| shadcn 组件 | button/separator/scroll-area/tooltip/input/card |

**关键文件：**

| 文件 | 作用 |
|------|------|
| `components.json` | shadcn CLI 配置（`rsc: false`, `baseColor: zinc`, `cssVariables: true`） |
| `src/renderer/src/lib/utils.ts` | `cn()` 工具（clsx + tailwind-merge） |
| `src/renderer/src/stores/navigation-store.ts` | Zustand 页面导航（`Page = 'chat' \| 'agents' \| 'settings'`） |
| `src/renderer/src/components/layout/AppLayout.tsx` | 根布局：`<Sidebar /> + <PageRouter />` |
| `src/renderer/src/components/layout/Sidebar.tsx` | 侧边栏：LemonClaw 标题 + 对话/Agent/设置导航 |
| `src/renderer/src/components/layout/PageRouter.tsx` | 根据 `currentPage` switch 渲染页面 |
| `src/renderer/src/pages/ChatPage.tsx` | 聊天页骨架（消息区 + 输入区占位） |
| `src/renderer/src/pages/AgentsPage.tsx` | Agent 管理占位 |
| `src/renderer/src/pages/SettingsPage.tsx` | 设置占位 |

**踩坑记录：**
- `shadcn-ui` CLI 已废弃，必须用 `npx shadcn@latest`
- `tailwind.config.mjs`（ESM）不兼容 `tailwindcss-animate` 的 `require()`，必须改为 `.js`（CJS）
- 应用图标已改为 PNG 格式

---

### Step 2.5: 架构方案决策 + 文档重构 ✅（2026-04-18）

**任务拆分：**

| 任务 | 实现 |
|------|------|
| 参考项目源码 clone | hermes/openclaw/rivonclaw → `references/`（shallow clone） |
| HomiClaw 源码分析 | 6 篇文档精读（架构/Gateway/LLM/Session/工具/总结） |
| 架构方案对比 | Bundle vs Vendor 子进程 vs 渐进式，深入分析 OpenClaw 构建系统 |
| 架构决策 | 选择 Vendor 子进程模式（低初始成本、进程隔离、升级简单） |
| 产品架构文档 v3.0.0 | Vendor 模式重构、新增 Gateway 子进程层、代码复用策略表 |
| 技术方案文档 v3.0.0 | Gateway 集成层接口定义、Plugin Extension 接口、数据存储方案 |
| CLAUDE.md 重写 | 项目结构按新架构更新、核心模块优先级调整 |
| 项目目录调整 | 删除 `src/core/`，新增 `src/main/gateway/`、`src/main/memory/`、`src/main/learning/`、`src/extensions/` |

**关键决策：**

| 决策 | 选择 | 原因 |
|------|------|------|
| 集成方式 | Vendor 子进程（参考 RivonClaw） | Bundle 模式成本极高（tsdown + 20 动态 import + jiti + 90+ 扩展 + native 模块） |
| Agent/LLM/Session | 由 OpenClaw Gateway 提供 | 不重复造轮子，直接使用 OpenClaw 的成熟实现 |
| 自研范围 | Gateway 集成层 + 记忆系统 + 学习引擎 | OpenClaw 没有的能力（长期记忆、学习）才自研 |

---

### Step 3: Gateway 集成层 ✅（2026-04-18）

**任务拆分：**

| 任务 | 关键文件 | 实现方式 |
|------|---------|---------|
| vendor 路径解析 | `src/main/gateway/vendor.ts` | 优先 vendor 子模块 `openclaw.mjs`（需 `dist/entry.js` 存在），回退全局 npm；Node 二进制用系统 `node`（非 Electron 内置 v20.x） |
| GatewayLauncher | `src/main/gateway/launcher.ts` | spawn 子进程 + 指数退避重启（1000ms→30000ms）+ 就绪检测（stdout "listening on"）+ Windows taskkill 进程树 |
| Config Bridge | `src/main/gateway/config-bridge.ts` | LemonClaw 设置 → `openclaw.json` + 变更策略（none/reload_config/restart_process）；目录不存在时跳过（extensions/skills） |
| Secret Injector | `src/main/gateway/secret-injector.ts` | LLM API Key → `auth-profiles.json`（`{version, profiles, order}` 格式）+ 环境变量双路径注入 |
| RPC Client | `src/main/gateway/rpc-client.ts` | WebSocket 双向通信 + token 认证（不含 nonce）+ 指数退避重连 + JSON-RPC 帧协议 |
| IPC 对接 | `src/main/ipc-handlers.ts` | gateway:start/stop/restart/state + chat:send/history + agents:list + config:setModel/setApiKey |
| host-api 抽象层 | `src/renderer/src/lib/host-api.ts` | 前端统一接口，封装 IPC 调用链 |
| preload API 扩展 | `src/preload/index.ts` | 暴露 Gateway/Chat/Agents/Config 相关 IPC channel |

**实际接口（已验证可用）：**

```typescript
// GatewayLauncher
class GatewayLauncher extends EventEmitter {
  start(): Promise<void>           // spawn 子进程，设置环境变量
  stop(): Promise<void>            // taskkill(SIGTERM) + 清理 auth profiles
  restart(): Promise<void>         // stop → start
  reload(): Promise<void>          // Unix: SIGUSR1 / Windows: restart
  getState(): GatewayState         // 'stopped'|'starting'|'running'|'error'
  getPort(): number
  setProviderKeys(keys): void
}

// RPC Client（WebSocket ws://127.0.0.1:{port}）
class GatewayRpcClient extends EventEmitter {
  connect(): Promise<void>         // 等待 connect.challenge → 回复 connect（token 认证）
  disconnect(): Promise<void>
  request(method, params): Promise<any>  // JSON-RPC 帧：{type:'req', id, method, params}
  chatSend(sessionKey, message): Promise<void>
  chatHistory(sessionKey): Promise<any[]>
  agentsList(): Promise<any[]>
}
```

**关键踩坑（实际调试修正）：**

| 问题 | 原因 | 修复 |
|------|------|------|
| Gateway 立即退出 | Electron 内置 Node v20.x，OpenClaw 要求 v22.12+ | `getNodeBin()` 返回 `'node'`（系统 Node v24.x） |
| 握手 "unexpected property 'nonce'" | nonce 仅用于 Ed25519 设备认证，token 认证不需要 | `auth` 只含 `{ token }` |
| 握手 "client/id must be constant" | `client.id: 'lemonclaw'` 不被 OpenClaw schema 接受 | 改为 `'node-host'` |
| "Missing config" 启动失败 | Vendor 模式无全局配置文件 | 添加 `OPENCLAW_CONFIG_PATH` 环境变量 |
| "plugin path not found" | extensions 目录不存在 | `existsSync` 检查后才写入 config |

**验证结果：**
- [x] Gateway 子进程可以正常启动/停止/重启（`gateway:start` → `starting` → `running`）
- [x] RPC Client 可以通过 WebSocket 与 Gateway 通信（握手成功）
- [x] Config Bridge 能正确生成 openclaw.json
- [x] Secret Injector 能将 API Key 注入 auth-profiles.json

---

### Step 4: 基础聊天壳子（Mock 模式） ✅（2026-04-19）

**任务拆分：**

| 任务 | 关键文件 | 说明 |
|------|---------|------|
| Gateway Store | `src/renderer/src/stores/gateway-store.ts` | Zustand 管理 Gateway 启停状态（stopped/starting/running/error） |
| Chat Store（Mock） | `src/renderer/src/stores/chat-store.ts` | Mock 流式回复，不调真实 API，验证 UI 流程 |
| 消息气泡组件 | `src/renderer/src/components/chat/MessageBubble.tsx` | 用户右对齐/AI 左对齐，流式中显示光标 |
| 输入框组件 | `src/renderer/src/components/chat/ChatInput.tsx` | Input + 发送/停止按钮，Enter 发送 |
| 消息列表 | `src/renderer/src/components/chat/MessageList.tsx` | ScrollArea + 自动滚到底部 |
| ChatPage 改写 | `src/renderer/src/pages/ChatPage.tsx` | 三态 UI（stopped→启动按钮、starting→加载、running→聊天） |
| SettingsPage 框架 | `src/renderer/src/pages/SettingsPage.tsx` | API Key 表单框架，未接通 |
| AgentsPage 框架 | `src/renderer/src/pages/AgentsPage.tsx` | Agent 列表框架，未接通 |
| chat:abort 通道 | rpc-client + ipc-handlers + preload + host-api | 4 个文件各加 1 行 |

**验证标准：**
- [x] 启动 Gateway → 状态从 stopped 到 running
- [x] 发消息 → 看到 Mock 流式回复
- [x] 停止按钮可中断回复

**关键踩坑：**
- Gateway plugins 配置不能引用不存在的插件（如 `minimax`），否则校验失败反复重启
- RPC 握手需要 `controlUi: { dangerouslyDisableDeviceAuth: true }` 绕过设备认证
- `openclaw-control-ui` client.id 需要 `origin` header 才能 WebSocket 连接

---

### Step 5: LLM 接通 ✅（2026-04-19）

**目标**：Gateway 通过 minimax-portal provider 调用 Minimax API，前端收到真实流式回复

**任务拆分：**

| 任务 | 关键文件 | 说明 |
|------|---------|------|
| API Key 自动播种 | `src/main/ipc-handlers.ts` | 启动时从 `auth-profiles.json` 读取已保存的 API Key，预填到 `providerKeys` |
| Chat Store 切真实模式 | `src/renderer/src/stores/chat-store.ts` | 删除 MOCK_REPLIES 和 mockStreamReply，用 hostApi.chatSend + hostApi.onChatEvent（delta/final/error/aborted） |
| RPC 事件转发 | `src/main/ipc-handlers.ts` | rpcClient.on('event') → BrowserWindow.send('chat:event') |
| 历史消息加载 | `src/renderer/src/stores/chat-store.ts` | loadHistory 调 hostApi.chatHistory，解析 content block 数组 |

**验证标准：**
- [x] 发消息 → 收到 Minimax 模型真实回复
- [x] 流式显示（delta → final）
- [x] 第二条消息多轮对话正常
- [x] 停止按钮可中断回复

**关键踩坑：**
- Gateway 内部 spawn curl 导致 DEP0190 警告，Windows 上产生可见控制台窗口（OpenClaw 内部行为，不可完全消除）
- prompt 过长时 Gateway 会发送 BOOTSTRAP.md 引导内容，属正常行为
- RPC 连接时机：需等 stdout 输出 "embedded acpx runtime backend ready" 后才创建 RPC 连接

**遗留问题：**
- SettingsPage 默认值（openai/glm-5.1）与后端硬编码（minimax-portal/MiniMax-M2.7-HighSpeed）不一致，需 Step 6 修正
- chat-store.ts 含大量调试日志，建议后续清理

---

### Step 6: Settings 页对接 ⬜

**目标**：用户通过 UI 配置 API Key 和模型，无需手动改文件

**任务拆分：**

| 任务 | 关键文件 | 说明 |
|------|---------|------|
| Settings 页表单 | `src/renderer/src/pages/SettingsPage.tsx` | Provider 选择 + API Key 输入 + 模型选择 |
| Secret Injector 联动 | `src/main/gateway/secret-injector.ts` | minimax → minimax-portal 映射，写入 auth-profiles.json |
| Config Bridge 联动 | `src/main/gateway/config-bridge.ts` | apiKey 传入 buildGatewayConfig → models.providers.apiKey |
| 配置变更策略 | `src/main/ipc-handlers.ts` | keyOnly（重写 auth-profiles）、configOnly（SIGUSR1）、restart（重写+重启） |
| 去掉 API Key 硬编码 | `src/main/ipc-handlers.ts` | 清除 Step 5 的临时硬编码 |

**验证标准：**
- [ ] Settings 页输入 API Key → 保存 → Gateway 能用新 Key 调模型
- [ ] 切换模型 → Chat 使用新模型回复
- [ ] Key 不填时提示配置

---

### Step 7: 会话持久化 ⬜

**目标**：对话历史保存、多轮上下文、重启后恢复

**任务拆分：**

| 任务 | 关键文件 | 说明 |
|------|---------|------|
| 加载历史 | `src/renderer/src/stores/chat-store.ts` | loadHistory → hostApi.chatHistory → 渲染消息列表 |
| 多轮上下文 | — | Gateway 自带 Session 管理（JSONL），chat.send 自动携带上下文 |
| 重启恢复 | `src/renderer/src/pages/ChatPage.tsx` | 应用启动时 Gateway 连接后自动 loadHistory |
| 残留清理 | `src/main/ipc-handlers.ts` | 清理旧会话的错误消息（Unknown model 等） |

**验证标准：**
- [ ] 关闭应用 → 重启 → 看到之前的对话
- [ ] 连续对话 3 轮以上，AI 记住前文
- [ ] 旧错误消息不再出现

---

### Step 8: Agent 管理 ⬜

**目标**：用户可以看到 Agent 列表并切换

**任务拆分：**

| 任务 | 关键文件 | 说明 |
|------|---------|------|
| Agent Store | `src/renderer/src/stores/agent-store.ts` | agentsList RPC → Agent[] |
| AgentsPage 对接 | `src/renderer/src/pages/AgentsPage.tsx` | 卡片列表 + 选中高亮 + 点击切换 |
| 切换逻辑 | `src/main/gateway/rpc-client.ts` | sessions.patch 切换 Agent |
| 默认 Agent | `src/main/gateway/config-bridge.ts` | agents.list 配置默认 Agent |

**验证标准：**
- [ ] AgentsPage 显示 Agent 列表
- [ ] 点击切换 → 回到 Chat 发消息用新 Agent
- [ ] 当前 Agent 高亮显示

---

### Step 9: Extension 基础框架 ⬜

**目标**：lemonclaw-memory Extension 被 Gateway 加载，注入系统提示

**任务拆分：**

| 任务 | 关键文件 | 说明 |
|------|---------|------|
| Extension 注册 | `src/extensions/lemonclaw-memory/` | openclaw.plugin.json + defineLemonClawPlugin |
| before_agent_start hook | 同上 | 注入基础系统提示（你是 LemonClaw 助手...） |
| Config Bridge 配路径 | `src/main/gateway/config-bridge.ts` | plugins.load.paths 指向 extensions 目录 |
| Gateway 加载验证 | — | 检查 Gateway 日志确认 Extension 被识别 |

**验证标准：**
- [ ] Extension 被 Gateway 正确加载
- [ ] before_agent_start hook 被触发
- [ ] 系统提示成功注入

---

## Phase 2: 记忆系统（参考 Hermes）

> 详见技术方案文档 §3
>
> MVP 阶段先用 OpenClaw 内置 MEMORY.md 文件记忆，Phase 2 再实现完整记忆系统

### Step 10: 记忆引擎 ⬜

**任务拆分：**

| 任务 | 关键文件 | 说明 |
|------|---------|------|
| SQLite 初始化 | `src/main/storage/database.ts` | better-sqlite3 + WAL 模式 + 迁移系统 |
| MemoryStore | `src/main/memory/MemoryStore.ts` | MEMORY.md / USER.md 读写 + 冻结快照 |
| TrustScorer | `src/main/memory/TrustScorer.ts` | 不对称惩罚 +0.05/-0.10 + 时间衰减（半衰期 90 天） |
| 结构化记忆 | SQLite + FTS5 | fact/preference/event/entity 四种类型 |
| 记忆检索管线 | `src/main/memory/MemoryManager.ts` | FTS5 → 信任加权 → 衰减 → Top-K |
| MemoryScanner | `src/main/memory/MemoryScanner.ts` | 防注入/外泄/不可见字符 |
| lemonclaw-memory 完善 | `src/extensions/lemonclaw-memory/` | before_agent_start 注入记忆上下文（替代 Step 5 的基础版本） |
| Agent 隔离记忆 | `~/.lemonclaw/agents/{agentId}/` | 每个 Agent 独立 MEMORY.md |

**验证标准：**
- [ ] MEMORY.md / USER.md 正常读写
- [ ] 信任评分生效
- [ ] FTS5 关键词检索可用
- [ ] 安全扫描拦截注入内容
- [ ] Plugin Extension 成功注入记忆到 Agent 系统提示

---

### Step 11: 记忆 UI + 上下文压缩 ⬜

**任务拆分：**

| 任务 | 关键文件 | 说明 |
|------|---------|------|
| 记忆管理界面 | `src/renderer/src/pages/MemoryPage.tsx` | 列表/搜索/编辑/删除，显示信任评分 |
| 容量状态面板 | 同上 | MEMORY.md / USER.md 使用率进度条 |
| ContextCompressor | `src/main/memory/ContextCompressor.ts` | 4 阶段压缩（修剪→保护头部→保护尾部→LLM 总结） |
| 防压缩风暴 | 同上 | 连续两次节省 <10% 时跳过 |
| NudgeEngine | `src/main/memory/NudgeEngine.ts` | 每 N 轮主动审查记忆质量 |

**验证标准：**
- [ ] 记忆管理界面可用
- [ ] 上下文压缩生效
- [ ] Nudge 审查建议正确展示

---

## Phase 3: 学习引擎（LemonClaw 原创）

> 详见技术方案文档 §4

### Step 12: 经验收集 ⬜

**任务拆分：**

| 任务 | 关键文件 | 说明 |
|------|---------|------|
| ExperienceCollector | `src/main/learning/ExperienceCollector.ts` | 自动收集用户修改/评分/纠正 |
| lemonclaw-learning Extension | `src/extensions/lemonclaw-learning/` | after_tool_call hook 收集经验数据 |
| SkillPatcher | `src/main/learning/SkillPatcher.ts` | 技能即时修补（参考 Hermes） |
| 技能版本管理 | `src/main/learning/SkillVersionManager.ts` | 技能更新支持回滚 |

**验证标准：**
- [ ] 经验自动收集
- [ ] 技能即时修补生效

---

### Step 13: 反思引擎 + UI ⬜

**任务拆分：**

| 任务 | 关键文件 | 说明 |
|------|---------|------|
| ReflectionEngine | `src/main/learning/ReflectionEngine.ts` | 定期 LLM 分析经验，生成 ReflectionReport |
| 学习报告 UI | `src/renderer/src/pages/LearningPage.tsx` | 统计/成功模式/偏好/建议的可视化 |

**验证标准：**
- [ ] 反思引擎定期生成报告
- [ ] 学习报告可视化界面可用
- [ ] 建议需用户确认后才执行

---

## Phase 4: 优化 + 发布

### Step 14: 优化 + 打包 ⬜

| 任务 | 说明 |
|------|------|
| 错误恢复 | Gateway 异常恢复 + 数据库优化 |
| UI 优化 | 主题系统（亮色/暗色切换）+ 错误边界 |
| 打包 | electron-builder → Windows exe + macOS dmg |
| 用户文档 | 使用指南 |
