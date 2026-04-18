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

### Step 3: Gateway 集成层 ⬜

> 参考 RivonClaw（批判性参考）+ OpenClaw 官方文档

**任务拆分：**

| 任务 | 关键文件 | 说明 |
|------|---------|------|
| vendor 路径解析 | `src/main/gateway/vendor.ts` | 解析 OpenClaw 二进制/入口路径 |
| GatewayLauncher | `src/main/gateway/launcher.ts` | spawn/stop/restart Gateway 子进程 + 指数退避重启（1000ms→30000ms）+ 就绪检测 |
| Config Bridge | `src/main/gateway/config-bridge.ts` | LemonClaw 设置 → openclaw.json + 变更策略（none/reload/restart） |
| Secret Injector | `src/main/gateway/secret-injector.ts` | LLM API Key → auth-profiles.json，非 LLM Key → 环境变量 |
| RPC Client | `src/main/gateway/rpc-client.ts` | WebSocket 双向通信（ws://127.0.0.1:{port}）+ Ed25519 认证 |
| IPC 对接 | `src/main/ipc-handlers.ts` | Gateway 状态/控制相关 IPC handler |
| host-api 抽象层 | `src/renderer/src/lib/host-api.ts` | 前端统一接口，封装 IPC → RPC → Gateway 调用链 |
| preload API 扩展 | `src/preload/index.ts` | 添加 Gateway 相关 IPC channel |

**接口定义（详见技术方案文档 §2）：**

```typescript
// GatewayLauncher
interface GatewayLauncher {
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  reload(): Promise<void>;           // SIGUSR1 优雅重载
  getState(): GatewayState;          // stopped|starting|ready|running|error
  on(event: string, handler: Function): void;
}

// RPC Client
interface GatewayRpcClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  request(method: string, params: any): Promise<any>;
  subscribe(event: string, handler: Function): void;
  chat.send(sessionKey: string, message: string): Promise<void>;
  chat.history(sessionKey: string): Promise<Message[]>;
  agents.list(): Promise<AgentInfo[]>;
}
```

**验证标准：**
- [ ] Gateway 子进程可以正常启动/停止/重启
- [ ] RPC Client 可以通过 WebSocket 与 Gateway 通信
- [ ] Config Bridge 能正确生成 openclaw.json
- [ ] Secret Injector 能将 API Key 注入 auth-profiles.json

---

### Step 4: Electron UI 对接 ⬜

**任务拆分：**

| 任务 | 关键文件 | 说明 |
|------|---------|------|
| 聊天页面对接 | `src/renderer/src/pages/ChatPage.tsx` | 通过 host-api → RPC 调 Gateway chat API + 流式响应渲染 |
| 消息气泡组件 | `src/renderer/src/components/chat/MessageBubble.tsx` | 用户/AI 消息样式 + Markdown 渲染 |
| 流式渲染 | `src/renderer/src/stores/chat-store.ts` | AI 回复逐字显示，RPC SSE → IPC 流式转发 |
| 设置页面对接 | `src/renderer/src/pages/SettingsPage.tsx` | API Key 输入 + 保存 → Secret Injector → auth-profiles.json |
| Agent 切换 | `src/renderer/src/pages/AgentsPage.tsx` | 通过 RPC 管理 Agent（list/switch） |
| Zustand stores | `src/renderer/src/stores/` | chat-store、agent-store、gateway-store |
| IPC 路由完善 | `src/main/ipc-handlers.ts` | chat/agent/gateway/config namespace 分组 |

**验证标准：**
- [ ] 用户可以与 Agent 进行多轮对话（通过 Gateway RPC）
- [ ] 流式响应正常显示
- [ ] API Key 配置后可以正常调用 LLM
- [ ] 可以在 2 个 Agent 之间切换

---

### Step 5: Plugin Extension 基础框架 ⬜

**任务拆分：**

| 任务 | 关键文件 | 说明 |
|------|---------|------|
| Extension 注册框架 | `src/extensions/` | openclaw.plugin.json 清单格式 + defineLemonClawPlugin |
| lemonclaw-memory Extension | `src/extensions/lemonclaw-memory/` | before_agent_start hook，注入基础系统提示 |
| Extension 加载 | `src/main/gateway/launcher.ts` | Config Bridge 配置 Extension 路径 |
| hook 调试 | — | 验证 Plugin Extension 被 Gateway 正确加载和触发 |

**验证标准：**
- [ ] Extension 被 Gateway 正确加载
- [ ] before_agent_start hook 被触发
- [ ] 系统提示成功注入

---

## Phase 2: 记忆系统（参考 Hermes）

> 详见技术方案文档 §3

### Step 6: 记忆引擎 ⬜

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

### Step 7: 记忆 UI + 上下文压缩 ⬜

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

### Step 8: 经验收集 ⬜

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

### Step 9: 反思引擎 + UI ⬜

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

### Step 10: 优化 + 打包 ⬜

| 任务 | 说明 |
|------|------|
| 错误恢复 | Gateway 异常恢复 + 数据库优化 |
| UI 优化 | 主题系统（亮色/暗色切换）+ 错误边界 |
| 打包 | electron-builder → Windows exe + macOS dmg |
| 用户文档 | 使用指南 |
