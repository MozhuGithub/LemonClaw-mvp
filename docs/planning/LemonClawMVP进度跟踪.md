# LemonClaw MVP 进度跟踪

> 项目管理文档：每个 Step 的目标、状态、价值和交付物
>
> 技术实现细节见 `docs/planning/LemonClawMVP实现方案.md`
>
> 创建日期：2026-04-16
> 最后更新：2026-04-19
> 架构版本：v3.0.0（Vendor 子进程模式）
>
> 仓库：https://github.com/MozhuGithub/LemonClaw-mvp

---

## 总览

| Phase | 目标 | 预计周期 | 状态 | 进度 |
|-------|------|---------|------|------|
| Phase 1 | Gateway 集成 + Electron 壳 + 基础对话 | 3-4 周 | 🔶 进行中 | ~45% |
| Phase 2 | 记忆系统 — 参考 Hermes 四层分层 | 3 周 | ⬜ 未开始 | 0% |
| Phase 3 | 学习引擎 — LemonClaw 原创 | 3 周 | ⬜ 未开始 | 0% |
| Phase 4 | 优化发布 — 产品化 | 2 周 | ⬜ 未开始 | 0% |

---

## Phase 1: Gateway 集成 + Electron 壳 + 基础对话

**目标**：通过 Vendor 子进程模式集成 OpenClaw Gateway，实现能和 AI 正常对话的桌面应用

### Step 1: Electron 安全骨架 ✅

**做了什么**：搭建 Electron 桌面应用骨架，包含安全隔离、IPC 通信、React 前端

**有什么用**：后续所有功能的基础运行环境，确保主进程和渲染进程安全隔离

**状态**：✅ 完成（2026-04-16）

---

### Step 2: 前端框架搭建 ✅

**做了什么**：集成 shadcn/ui 组件库，建立暗色主题（zinc 色系 + lemon 品牌色），实现 Sidebar + PageRouter 布局，Zustand 状态驱动路由（无 react-router），安装 button/separator/scroll-area/tooltip/input/card 六个 shadcn 组件

**有什么用**：提供统一的 UI 组件和布局框架，后续所有界面在此基础上开发

**状态**：✅ 完成（2026-04-17）

---

### Step 2.5: 架构方案决策 + 文档重构 ✅

**做了什么**：深入分析 OpenClaw 构建系统（tsdown + 20 动态 import + jiti + 90+ 扩展 + native 模块），对比三种集成方案后选择 Vendor 子进程模式；将产品架构文档和技术方案文档重构为 v3.0.0；调整项目目录结构

**有什么用**：确定架构方向，避免后期推倒重来。原 Phase 1 的 IPC/LLM/Agent/SQLite 等 6 个步骤不再需要自行实现

**状态**：✅ 完成（2026-04-18）

---

### Step 3: Gateway 集成层 ✅

**做了什么**：实现 GatewayLauncher（spawn/stop/restart + 指数退避）、Config Bridge（配置翻译 + 变更策略）、Secret Injector（密钥注入）、RPC Client（WebSocket 双向通信 + 握手协议）、Vendor 路径解析、IPC 路由、前端 host-api + preload API

**有什么用**：核心集成层——Electron 主进程能管理 OpenClaw Gateway 子进程的完整生命周期和双向通信

**状态**：✅ 完成（2026-04-18）

---

### Step 4: 基础聊天壳子（Mock 模式） ✅

**做了什么**：实现 Chat UI（MessageBubble/ChatInput/MessageList）+ Chat Store（mock 流式回复）+ Gateway Store（启停状态管理）+ ChatPage 三态 UI（stopped/starting/running）+ chat:abort 通道。SettingsPage 和 AgentsPage 有框架但未接通。

**有什么用**：验证了完整的 UI 流程——启动 Gateway → 发消息 → 看到流式回复，UI 层不再阻塞后续开发

**状态**：✅ 完成（2026-04-19）

**关键踩坑：**
- Gateway plugins 不能引用不存在的插件名（`minimax`），否则校验失败反复重启
- RPC 需要 `controlUi: { dangerouslyDisableDeviceAuth: true }` + `origin` header
- Config Bridge 须按 OpenClaw 格式生成配置（`auth.profiles` + `models.providers` 嵌 apiKey + `plugins.entries`）

---

### Step 5: LLM 接通 ⬜

**做什么**：Chat Store 从 mock 切换到真实 RPC（chat.send → delta/final 事件流），Config Bridge 按用户可用配置格式生成 openclaw.json，API Key 临时硬编码验证通路

**有什么用**：最关键的一步——发消息能收到 AI 真实回复

**状态**：⬜ 未开始

---

### Step 6: Settings 页对接 ⬜

**做什么**：Settings 页 UI 输入 API Key + 选择模型 → Secret Injector → auth-profiles.json + Config Bridge → openclaw.json。去掉硬编码 API Key。

**有什么用**：用户自助配置，不用手动改文件

**状态**：⬜ 未开始

---

### Step 7: 会话持久化 ⬜

**做什么**：Chat Store loadHistory 加载历史消息，应用重启后自动恢复对话，多轮上下文由 Gateway Session 管理

**有什么用**：关掉再开不丢对话，连续对话 AI 记住前文

**状态**：⬜ 未开始

---

### Step 8: Agent 管理 ⬜

**做什么**：Agent Store 调 agentsList RPC，AgentsPage 显示列表 + 选中切换，sessions.patch 切换当前 Agent

**有什么用**：多 Agent 支持，不同场景用不同 Agent

**状态**：⬜ 未开始

---

### Step 9: Extension 基础框架 ⬜

**做什么**：lemonclaw-memory Extension 注册（openclaw.plugin.json + defineLemonClawPlugin），before_agent_start hook 注入基础系统提示，Config Bridge 配置 Extension 路径

**有什么用**：为 Phase 2 记忆系统注入 Gateway 做准备

**状态**：⬜ 未开始

**Phase 1 交付物**：
- [x] OpenClaw Gateway 子进程可以正常启动/停止/重启
- [x] 基础聊天 UI 正常显示（Mock 模式）
- [ ] 用户可以与 Agent 进行多轮对话（通过 Gateway RPC）→ Step 5
- [ ] 对话历史被保存到本地（Gateway Session 管理）→ Step 7
- [ ] 用户可以配置 API Key（通过 Settings 页）→ Step 6
- [ ] 用户可以在 2 个 Agent 之间切换 → Step 8
- [ ] Plugin Extension 被 Gateway 正确加载 → Step 9

---

## Phase 2: 记忆系统（参考 Hermes）

**目标**：实现四层分层记忆，通过 Plugin Extension 注入 Gateway

> MVP 阶段先用 OpenClaw 内置 MEMORY.md 文件记忆，Phase 2 再实现完整记忆系统

### Step 10: 记忆引擎 ⬜

**做什么**：MemoryStore（MEMORY.md/USER.md）+ SQLite（FTS5 + 结构化记忆）+ TrustScorer + 检索管线 + MemoryScanner + lemonclaw-memory Extension 完善

**有什么用**：让 AI 跨会话记住用户，记忆质量有保障（信任评分 + 安全扫描）

**状态**：⬜ 未开始

**交付物**：
- [ ] MEMORY.md / USER.md 读写正常
- [ ] 信任评分生效
- [ ] FTS5 关键词检索可用
- [ ] 安全扫描拦截注入内容
- [ ] Plugin Extension 成功注入记忆

---

### Step 11: 记忆 UI + 上下文压缩 ⬜

**做什么**：记忆管理界面（查看/搜索/编辑/信任评分）+ ContextCompressor + NudgeEngine

**有什么用**：用户可以管理记忆，长对话自动压缩

**状态**：⬜ 未开始

**交付物**：
- [ ] 记忆管理界面可用
- [ ] 上下文压缩生效
- [ ] Nudge 审查建议正确展示

---

## Phase 3: 学习引擎（LemonClaw 原创）

**目标**：经验收集 + 主动反思 + 可视化报告

### Step 12: 经验收集 ⬜

**做什么**：ExperienceCollector + lemonclaw-learning Extension + SkillPatcher + 技能版本管理

**状态**：⬜ 未开始

**交付物**：
- [ ] 经验自动收集
- [ ] 技能即时修补生效

---

### Step 13: 反思引擎 + UI ⬜

**做什么**：ReflectionEngine（定期 LLM 分析）+ 学习报告可视化界面

**状态**：⬜ 未开始

**交付物**：
- [ ] 反思引擎定期生成报告
- [ ] 学习报告可视化界面可用

---

## Phase 4: 优化 + 发布

**目标**：产品化发布

### Step 14: 优化 + 打包 ⬜

**交付物**：
- [ ] Windows/macOS 安装包
- [ ] 完整用户文档
- [ ] 发布说明

---

## 里程碑记录

| 日期 | 里程碑 |
|------|--------|
| 2026-04-15 | 项目启动，完成参考项目研究（HomiClaw/Hermes/OpenClaw/RivonClaw） |
| 2026-04-16 | 架构文档 v2.1 重写（去掉规则引擎，拆分产品/技术文档） |
| 2026-04-16 | Step 1 完成：Electron 安全骨架 |
| 2026-04-17 | Step 2 完成：前端框架搭建（shadcn/ui + 路由 + 布局） |
| 2026-04-17 | 应用图标选定（黄色柠檬线稿），已转换为 PNG 格式 |
| 2026-04-18 | 架构方案决策：选择 Vendor 子进程模式（放弃 Bundle 模式） |
| 2026-04-18 | 架构文档 v3.0.0 全面重构（产品/技术/CLAUDE.md） |
| 2026-04-18 | 项目目录结构调整（删除 src/core/，新增 gateway/memory/learning/extensions） |
| 2026-04-18 | Step 3 完成：Gateway 集成层（5 模块 + IPC + host-api，端到端验证通过） |
| 2026-04-19 | Step 4 完成：基础聊天壳子（Mock 模式，UI 流程跑通） |
| 2026-04-19 | MVP 规划重构：Step 4 拆分为 Step 4-9，每步独立可验证 |

---

## 技术决策记录

| 决策 | 选择 | 原因 |
|------|------|------|
| 构建工具 | electron-vite | 比 electron-forge 更成熟的 Vite 集成 |
| 包管理 | pnpm (node-linker=hoisted) | Electron 模块解析需要 |
| OpenClaw 集成方式 | Vendor 子进程（参考 RivonClaw） | Bundle 模式成本极高（OpenClaw 构建系统复杂），子进程隔离好、升级简单 |
| Agent/LLM/Session | 由 OpenClaw Gateway 提供 | 不重复造轮子 |
| 记忆方案 | Markdown + SQLite 混合（参考 Hermes） | 四层分层 + 信任评分 + 冻结快照 |
| MVP 记忆 | 先用 OpenClaw 内置 MEMORY.md | 降低 MVP 复杂度，Phase 2 再实现完整记忆 |
| 密钥存储 | electron safeStorage → auth-profiles.json | 利用系统密钥链（Keychain/DPAPI），双路径注入 |
| Plugin 扩展 | OpenClaw Plugin SDK hooks | before_agent_start 注入记忆，after_tool_call 收集经验 |
| UI 组件库 | shadcn/ui + Tailwind | 暗色主题友好、可定制、中文生态好 |
| 页面路由 | Zustand 状态驱动 | 桌面应用无需 URL 路由，简单够用 |
| LLM 供应商 | Minimax（minimax-portal provider） | Anthropic 兼容 API，国内可用 |

---

## 架构变更记录

### v3.0.0（2026-04-18）— Vendor 子进程模式重构

**变更原因**：深入分析 OpenClaw 构建系统后发现 Bundle 模式（HomiClaw 的方案）单人维护成本过高

**主要变更**：

| 模块 | 旧方案（v2.x） | 新方案（v3.0） |
|------|---------------|---------------|
| Agent 管理 | 自己实现 AgentManager | 由 OpenClaw Gateway 提供 |
| LLM 调用 | 自己实现 LLMService + Fallback | 由 OpenClaw Gateway 提供 |
| Session 管理 | 自己实现 JSONL 存储 | 由 OpenClaw Gateway 提供 |
| 工具系统 | 自己实现内置工具 + MCP | 由 OpenClaw Gateway 提供 |
| IPC 通信层 | host-api + ipc-handlers | host-api + ipc-handlers + RPC Client |
| API Key 配置 | 直接存 safeStorage | Secret Injector → auth-profiles.json |
| 技能系统 | 自建 SkillRegistry + SkillScanner | OpenClaw Plugin SDK + Extension |
| 记忆系统 | 自研（参考 Hermes） | 不变（自研） |
| 学习引擎 | 自研（原创） | 不变（自研） |

### v3.1.0（2026-04-19）— MVP 步骤拆分

**变更原因**：原 Step 4 太大（UI + LLM + Settings + Agent 全塞一起），导致来回兜圈子

**主要变更**：

| 旧编号 | 旧内容 | 新编号 | 新内容 |
|--------|--------|--------|--------|
| Step 4 | Electron UI 对接（全部） | Step 4 | 基础聊天壳子（Mock）✅ |
| — | — | Step 5 | LLM 接通 |
| — | — | Step 6 | Settings 页对接 |
| — | — | Step 7 | 会话持久化 |
| — | — | Step 8 | Agent 管理 |
| Step 5 | Plugin Extension | Step 9 | Extension 基础框架 |
| Step 6 | 记忆引擎 | Step 10 | 记忆引擎（不变） |
| Step 7 | 记忆 UI | Step 11 | 记忆 UI（不变） |
| Step 8 | 经验收集 | Step 12 | 经验收集（不变） |
| Step 9 | 反思引擎 | Step 13 | 反思引擎（不变） |
| Step 10 | 优化打包 | Step 14 | 优化打包（不变） |
