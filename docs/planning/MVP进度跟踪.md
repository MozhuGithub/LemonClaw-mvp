# LemonClaw MVP 进度跟踪

> 基于 v2 架构文档的 Phase 规划
>
> 创建日期：2026-04-16
>
> 仓库：https://github.com/MozhuGithub/LemonClaw-mvp

---

## 总览

| Phase | 目标 | 预计周期 | 状态 | 进度 |
|-------|------|---------|------|------|
| Phase 1 | 基础框架 — 能聊天的桌面应用 | 2 周 | 🔶 进行中 | ~30% |
| Phase 2 | 核心功能 — 规则引擎 + 记忆系统 | 2 周 | ⬜ 未开始 | 0% |
| Phase 3 | 多 Agent + Tool 系统 | 2 周 | ⬜ 未开始 | 0% |
| Phase 4 | 完善发布 — 产品化 | 2 周 | ⬜ 未开始 | 0% |

---

## Phase 1: 基础框架

**目标**：能和 AI 正常对话的桌面应用（流式响应 + API Key 安全存储）

### Step 1: Electron 安全骨架

| 任务 | 状态 | 备注 |
|------|------|------|
| electron-vite 项目初始化 | ✅ 完成 | electron-vite 2.3 + Electron 32 |
| 主进程：contextIsolation + contextBridge | ✅ 完成 | window.lemonclaw API |
| 单实例锁 + 窗口管理 | ✅ 完成 | |
| React 18 + Tailwind 基础页 | ✅ 完成 | |
| core/ 子目录结构 | ✅ 完成 | agent/rules/memory/llm/tools/config/storage |

### Step 2: 前端框架搭建

| 任务 | 状态 | 备注 |
|------|------|------|
| shadcn/ui 集成 | ⬜ 未开始 | |
| 页面路由（Chat/Agents/Rules/Settings） | ⬜ 未开始 | |
| 布局组件（Sidebar + Main） | ⬜ 未开始 | |

### Step 3: IPC 通信层

| 任务 | 状态 | 备注 |
|------|------|------|
| host-api IPC 抽象层（renderer 侧） | ⬜ 未开始 | src/renderer/src/lib/host-api.ts |
| ipc-handlers 集中路由（main 侧） | ⬜ 未开始 | src/main/ipc-handlers.ts |
| preload API 扩展 | ⬜ 未开始 | |

### Step 4: LLM 调用层

| 任务 | 状态 | 备注 |
|------|------|------|
| LLMService.ts | ⬜ 未开始 | OpenAI SDK → Theta GLM-5.1 |
| 流式响应（SSE） | ⬜ 未开始 | IPC 流式转发到 Renderer |
| 错误处理 + 重试 | ⬜ 未开始 | |

### Step 5: 单 Agent + 基础聊天

| 任务 | 状态 | 备注 |
|------|------|------|
| AgentManager.ts（单 Agent） | ⬜ 未开始 | systemPrompt + model 配置 |
| 聊天界面 UI | ⬜ 未开始 | 消息气泡 + 输入框 |
| 流式消息渲染 | ⬜ 未开始 | |
| Zustand Store（聊天状态） | ⬜ 未开始 | |

### Step 6: API Key 配置

| 任务 | 状态 | 备注 |
|------|------|------|
| 密钥链存储（safeStorage） | ⬜ 未开始 | macOS Keychain / Windows DPAPI |
| API Key 配置界面 | ⬜ 未开始 | |
| .env 文件支持 | ⬜ 未开始 | |

### Step 7: SQLite 存储

| 任务 | 状态 | 备注 |
|------|------|------|
| database.ts 初始化 | ⬜ 未开始 | better-sqlite3 |
| 会话持久化（Repository 模式） | ⬜ 未开始 | |
| 消息 CRUD | ⬜ 未开始 | |

### Step 8: 打磨

| 任务 | 状态 | 备注 |
|------|------|------|
| 热加载优化 | ⬜ 未开始 | |
| 错误边界 | ⬜ 未开始 | |
| 整体联调 | ⬜ 未开始 | |

**Phase 1 交付物**：
- [ ] 可运行的桌面应用
- [ ] 能和 AI 正常对话（流式响应）
- [ ] API Key 安全存储

---

## Phase 2: 核心功能

**目标**：规则引擎 + 记忆系统，让 AI "懂规则" 且 "记住你"

### 规则引擎

| 任务 | 状态 | 备注 |
|------|------|------|
| RuleEngine.ts（启发式编译） | ⬜ 未开始 | |
| Policy 产物（提示词注入） | ⬜ 未开始 | |
| Guard 产物（Tool 拦截） | ⬜ 未开始 | |
| 规则配置界面 | ⬜ 未开始 | |

### 记忆系统

| 任务 | 状态 | 备注 |
|------|------|------|
| MemoryManager.ts | ⬜ 未开始 | |
| Markdown 文件记忆（MEMORY.md/USER.md） | ⬜ 未开始 | |
| 自动信息提取 | ⬜ 未开始 | |
| 会话上下文注入 | ⬜ 未开始 | |
| 记忆管理界面 | ⬜ 未开始 | |

### SQLite Repository

| 任务 | 状态 | 备注 |
|------|------|------|
| Repository 模式封装 | ⬜ 未开始 | |
| 规则 CRUD | ⬜ 未开始 | |
| 记忆元数据管理 | ⬜ 未开始 | |

**Phase 2 交付物**：
- [ ] 规则引擎可用（关键词匹配 + 提示词注入）
- [ ] 记忆系统可用（记住用户信息 + 跨会话）
- [ ] 图形化配置界面

---

## Phase 3: 多 Agent + Tool

**目标**：多 Agent 并行 + Tool 可视化

### 多 Agent

| 任务 | 状态 | 备注 |
|------|------|------|
| AgentManager.ts（CRUD + Snapshot） | ⬜ 未开始 | |
| Session Key 命名空间 | ⬜ 未开始 | agent:{id}:{sessionType} |
| Agent 切换 UI | ⬜ 未开始 | 左侧列表 + 右侧对话 |
| 多会话管理 | ⬜ 未开始 | |

### Tool 系统

| 任务 | 状态 | 备注 |
|------|------|------|
| Tool 状态机（exec/read/write） | ⬜ 未开始 | |
| Tool 审批 UI | ⬜ 未开始 | |
| Tool 调用可视化 | ⬜ 未开始 | |

**Phase 3 交付物**：
- [ ] 多 Agent 并行工作
- [ ] Tool 调用可视化
- [ ] 审批流程

---

## Phase 4: 完善发布

**目标**：产品化发布

| 任务 | 状态 | 备注 |
|------|------|------|
| Setup Wizard（首次启动引导） | ⬜ 未开始 | |
| 主题系统（亮色/暗色） | ⬜ 未开始 | |
| 性能优化 | ⬜ 未开始 | |
| 测试 | ⬜ 未开始 | |
| 打包（Windows exe + macOS dmg） | ⬜ 未开始 | electron-builder |
| 用户文档 | ⬜ 未开始 | |

**Phase 4 交付物**：
- [ ] Windows/macOS 安装包
- [ ] 完整用户文档
- [ ] 发布说明

---

## 里程碑记录

| 日期 | 里程碑 | 关联 Commit |
|------|--------|------------|
| 2026-04-15 | 项目启动，完成参考项目研究 | - |
| 2026-04-16 | Step 1 完成：Electron 安全骨架 | `18e91ef` |
| 2026-04-16 | 目录重组 + Mac 验证指南 | `9be4a01` |

---

## 技术决策记录

| 决策 | 选择 | 原因 | 日期 |
|------|------|------|------|
| 构建工具 | electron-vite | 比 electron-forge 更成熟的 Vite 集成 | 04-16 |
| 包管理 | pnpm (node-linker=hoisted) | Electron 模块解析需要 | 04-16 |
| LLM 调用 | OpenAI SDK → Theta GLM-5.1 | MVP 不依赖 OpenClaw Gateway | 04-16 |
| 记忆方案 | Markdown + SQLite 混合 | 参考 HomiClaw 方案 | 04-16 |
| 密钥存储 | electron safeStorage | 利用系统密钥链，不存明文 | 04-16 |
