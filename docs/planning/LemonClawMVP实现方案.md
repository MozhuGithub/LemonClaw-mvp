# LemonClaw MVP 实现方案

> 完整的技术实现文档：已完成的步骤记录详细实现方式，未完成的记录详细任务拆分
>
> 渐进明细：每完成一个 Step 后补充详细实现记录
>
> 创建日期：2026-04-17

---

## Phase 1: 基础框架（继承 HomiClaw）

### Step 1: Electron 安全骨架 ✅（2026-04-16）

**任务拆分：**

| 任务 | 实现 |
|------|------|
| electron-vite 项目初始化 | electron-vite 2.3 + Electron 32，`pnpm create` |
| 主进程安全配置 | `contextIsolation: true` + `nodeIntegration: false` + `sandbox: true` |
| Preload API | contextBridge 暴露 `window.lemonclaw`（ping/getInfo） |
| 单实例锁 + 窗口管理 | `app.requestSingleInstanceLock()` + 窗口激活 |
| React 18 + Tailwind 基础页 | React StrictMode + Tailwind 指令 + 暗色 demo 页 |
| core/ 子目录结构 | agent/skills/learning/memory/llm/tools/config/storage + .gitkeep |
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

**配置改动：**
- `tsconfig.json` — 加 `"baseUrl": "."`, `"paths": { "@/*": [...] }`
- `electron.vite.config.ts` — renderer 配置加 `resolve.alias`
- `tailwind.config.mjs` → `tailwind.config.js` — 重写为 CJS + shadcn 色彩系统 + `darkMode: 'class'`
- `src/renderer/src/assets/main.css` — 替换为暗色主题 CSS 变量（zinc 暗色 + 黄色 primary）
- `src/renderer/src/App.tsx` — demo 替换为 `<AppLayout />`

**踩坑记录：**
- `shadcn-ui` CLI 已废弃，必须用 `npx shadcn@latest`
- `tailwind.config.mjs`（ESM）不兼容 `tailwindcss-animate` 的 `require()`，必须改为 `.js`（CJS）
- 应用图标：用户提供的原图是 JPG 格式，Electron 图标需要 PNG 格式（支持透明通道，macOS 打包必须 PNG 源文件）
- `src/main/index.ts` 已添加 `icon` 配置，但当前仍指向 `.jpg` 文件，待用户提供 PNG 后更新

---

### Step 3: IPC 通信层 ⬜

**任务拆分：**

| 任务 | 关键文件 | 说明 |
|------|---------|------|
| host-api IPC 抽象层 | `src/renderer/src/lib/host-api.ts` | 封装 IPC 调用，前端不直接用 `window.lemonclaw`，通过 host-api 统一接口 |
| ipc-handlers 集中路由 | `src/main/ipc-handlers.ts` | 主进程侧 IPC handler 集中管理，从 index.ts 拆出 |
| preload API 扩展 | `src/preload/index.ts` | 添加更多 IPC channel（chat/agent/config 相关） |
| 类型定义 | `src/preload/types.ts` 或 `src/renderer/src/lib/host-api.ts` | 前后端共享的 IPC 参数和返回值类型 |

**设计要点：**
- host-api 层是前端和 Electron IPC 之间的桥梁，前端组件只调用 host-api 函数，不直接接触 IPC
- ipc-handlers 按 namespace 分组（app:*, chat:*, agent:*, config:*）
- preload 只做透传，不包含业务逻辑

---

### Step 4: LLM 调用层 ⬜

**任务拆分：**

| 任务 | 关键文件 | 说明 |
|------|---------|------|
| LLMService | `src/core/llm/LLMService.ts` | OpenAI SDK 封装，支持多 Provider |
| Provider 配置 | `src/core/llm/types.ts` | LLMProvider 接口、ChatParams、Message 类型 |
| 流式响应 | `src/core/llm/LLMService.ts` | SSE 流式 → IPC 流式转发到 Renderer（ipcMain.on → webContents.send） |
| 错误分类 | `src/core/llm/ErrorClassifier.ts` | FailoverReason 枚举 + ClassifiedError 接口 |
| 自动重试 | `src/core/llm/LLMService.ts` | 指数退避重试 + Provider 切换 + 上下文压缩重试 |

**接口参考（技术方案文档 §6）：**
```typescript
enum FailoverReason {
  auth, auth_permanent, billing, rate_limit,
  overloaded, timeout, context_overflow, model_not_found, unknown
}
interface ClassifiedError { reason, retryable, shouldCompress, shouldRotateCredential, shouldFallback }
```

---

### Step 5: 单 Agent + 基础聊天 ⬜

**任务拆分：**

| 任务 | 关键文件 | 说明 |
|------|---------|------|
| AgentConfig 定义 | `src/core/agent/types.ts` | AgentConfig 接口（id/name/model/systemPrompt/skills/permissions/memory/learning） |
| AgentManager（单 Agent） | `src/core/agent/AgentManager.ts` | 创建/获取默认 Agent，管理会话上下文 |
| 聊天界面 UI | `src/renderer/src/pages/ChatPage.tsx` | 消息列表 + 输入框 + 发送按钮 |
| 消息气泡组件 | `src/renderer/src/components/chat/MessageBubble.tsx` | 用户/AI 消息样式 + Markdown 渲染 |
| 流式渲染 | `src/renderer/src/pages/ChatPage.tsx` | AI 回复逐字显示 |
| Zustand chat store | `src/renderer/src/stores/chat-store.ts` | 消息列表、发送状态、流式内容 |

**接口参考（技术方案文档 §2）：** AgentConfig、Agent、AgentEvents

---

### Step 6: API Key 配置 ⬜

**任务拆分：**

| 任务 | 关键文件 | 说明 |
|------|---------|------|
| safeStorage 封装 | `src/core/config/KeychainStore.ts` | 加密存储/读取 API Key（macOS Keychain / Windows DPAPI） |
| 设置页面 UI | `src/renderer/src/pages/SettingsPage.tsx` | API Key 输入 + 保存 + 连接测试 |
| 多 Provider 配置 | `src/core/config/ProviderManager.ts` | Theta / OpenAI / 其他 Provider 的 baseUrl + apiKey 管理 |
| .env 文件支持 | `src/main/index.ts` 或 `bootstrap.ts` | 开发环境从 .env 读取备用 |

---

### Step 7: SQLite 存储 ⬜

**任务拆分：**

| 任务 | 关键文件 | 说明 |
|------|---------|------|
| database.ts 初始化 | `src/core/storage/database.ts` | better-sqlite3 + WAL 模式 + 迁移系统 |
| ChatRepo | `src/core/storage/repositories/ChatRepo.ts` | Session + Message CRUD |
| AgentRepo | `src/core/storage/repositories/AgentRepo.ts` | AgentConfig 存取 |
| SettingsRepo | `src/core/storage/repositories/SettingsRepo.ts` | 键值对设置存取 |
| IPC 通道对接 | ipc-handlers | 存储操作通过 IPC 暴露给 renderer |

---

### Step 8: 打磨 ⬜

| 任务 | 说明 |
|------|------|
| 热加载优化 | electron-vite HMR 稳定性检查 |
| 错误边界 | React ErrorBoundary 组件 |
| 整体联调 | Step 3-7 集成测试 |

---

## Phase 2: 记忆系统（参考 Hermes）

### 记忆引擎

| 任务 | 关键文件 | 说明 |
|------|---------|------|
| MemoryManager | `src/core/memory/MemoryManager.ts` | 记忆系统入口，协调各组件 |
| MemoryStore | `src/core/memory/MemoryStore.ts` | MEMORY.md / USER.md 读写（§ 追踪，容量扩展） |
| TrustScorer | `src/core/memory/TrustScorer.ts` | 不对称惩罚 +0.05/-0.10 + 时间衰减（半衰期 90 天） |
| StructuredMemory | SQLite 存储 | fact/preference/event/entity 四种类型 |
| 检索管线 | `src/core/memory/MemoryManager.ts` | FTS5 → 信任加权 → 衰减 → Top-K |
| 冻结快照 | `src/core/memory/MemoryManager.ts` | 会话开始时冻结，保护 LLM 前缀缓存 |
| 安全扫描 | `src/core/memory/MemoryScanner.ts` | 防注入/外泄/不可见字符 |
| Nudge 机制 | `src/core/memory/NudgeEngine.ts` | 每 N 轮主动审查记忆质量 |
| Agent 隔离 | 目录结构 | 每个 Agent 独立 `~/.lemonclaw/agents/{agentId}/MEMORY.md` |

### 上下文压缩

| 任务 | 关键文件 | 说明 |
|------|---------|------|
| ContextCompressor | `src/core/memory/ContextCompressor.ts` | 4 阶段压缩（修剪→保护头部→保护尾部→LLM 总结） |
| 防压缩风暴 | 同上 | 连续两次节省 <10% 时跳过 |

### 记忆 UI

| 任务 | 说明 |
|------|------|
| 记忆管理界面 | 列表/搜索/编辑/删除，显示信任评分 |
| 容量状态面板 | MEMORY.md / USER.md 使用率进度条 |

---

## Phase 3: 技能系统（继承 HomiClaw + Hermes）

### Skill Registry

| 任务 | 关键文件 | 说明 |
|------|---------|------|
| SkillRegistry | `src/core/skills/SkillRegistry.ts` | 注册/注销/启用/禁用技能 |
| 内置技能 | `src/core/skills/builtin/` | read/write/edit/exec/web_search |
| SkillScanner | `src/core/skills/SkillScanner.ts` | SAFE/CAUTION/DANGEROUS 三级 |
| 渐进式加载 | SkillRegistry | 列表→详情→文件内容（节省 token） |
| 条件激活 | SKILL.md frontmatter | `requires_toolsets` / `fallback_for_toolsets` |
| SKILL.md 格式 | Markdown 文件 | YAML frontmatter + Markdown 正文 |

### MCP 集成

| 任务 | 关键文件 | 说明 |
|------|---------|------|
| MCP Client | `src/core/skills/MCPClient.ts` | MCP 协议客户端 |
| Server 管理 | 同上 | 连接/断开/重连 MCP Server |
| 工具调用 | 同上 | 通过 MCP 协议调用外部工具 |

---

## Phase 4: 学习引擎（LemonClaw 原创）

| 任务 | 关键文件 | 说明 |
|------|---------|------|
| ExperienceCollector | `src/core/learning/ExperienceCollector.ts` | 自动收集用户修改/评分/纠正 |
| ReflectionEngine | `src/core/learning/ReflectionEngine.ts` | 定期 LLM 分析经验，生成 ReflectionReport |
| SkillPatcher | `src/core/learning/SkillPatcher.ts` | 技能即时修补（参考 Hermes） |
| 技能版本管理 | `src/core/learning/SkillVersionManager.ts` | 技能更新支持回滚 |
| 学习报告 UI | `src/renderer/src/pages/` | 统计/成功模式/偏好/建议的可视化 |

---

## Phase 5: 优化 + 发布

| 任务 | 关键文件 | 说明 |
|------|---------|------|
| ErrorClassifier 完善 | `src/core/llm/ErrorClassifier.ts` | FailoverReason 全量实现 |
| 数据库优化 | `src/core/storage/` | 索引 + 查询优化 |
| 主题系统 | CSS 变量 + Zustand | 亮色/暗色切换 |
| 打包 | electron-builder | Windows exe + macOS dmg |
| 用户文档 | `docs/` | 使用指南 |
