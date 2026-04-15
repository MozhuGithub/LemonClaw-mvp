# LemonClaw 架构设计与规划书

> 基于 OpenClaw 生态的下一代个人 AI 助手桌面应用
>
> 版本：v0.2.0
> 日期：2026-04-15
> 状态：草案

---

## 目录

1. [项目概述](#1-项目概述)
2. [核心设计理念](#2-核心设计理念)
3. [整体架构](#3-整体架构)
4. [核心模块设计](#4-核心模块设计)
5. [技术选型](#5-技术选型)
6. [项目结构](#6-项目结构)
7. [开发路线图](#7-开发路线图)
8. [MVP 版本](#8-mvp版本)
9. [风险评估](#9-风险评估)
10. [后续步骤](#10-后续步骤)

---

## 1. 项目概述

### 1.1 项目定位

**LemonClaw** 是一个基于 OpenClaw 生态的下一代个人 AI 助手桌面应用，旨在提供：

- **多 Agent 并行** — 同时运行多个 AI 助手，各司其职
- **智能规则引擎** — 自然语言定义 AI 行为规则
- **长期记忆系统** — 跨会话记忆，让 AI 越用越懂你
- **Tool 可视化** — 透明展示 AI 执行的操作
- **中文友好** — 完整的中文界面和文档
- **完全开源** — 可读、可改、可分发

### 1.2 目标用户

| 用户类型 | 需求 | LemonClaw 价值 |
|---------|------|---------------|
| **个人用户** | 简单易用、个性化 | 规则引擎 + 长期记忆 |
| **开发者** | 可扩展、可定制 | 完全开源 + 技能系统 |
| **知识工作者** | 多任务处理 | 多 Agent 并行 |
| **企业用户** | 安全、透明 | Tool 可视化 + 审批流程 |

### 1.3 竞品分析

| 项目 | 优势 | 劣势 | LemonClaw 差异化 |
|------|------|------|-----------------|
| **OpenClaw** | 稳定、社区大 | 配置复杂、无 UI | 图形界面 + 简化配置 |
| **RivonClaw** | 规则引擎 + 记忆 | 单 Agent、社区小 | 多 Agent + 更大社区 |
| **ClawX** | 多 Agent + UI | 无中文、无规则引擎 | 中文 + 规则引擎 |
| **HomiClaw** | 技能丰富、记忆方案成熟 | 闭源、企业定制 | 开源 + 个人友好 |

---

## 2. 核心设计理念

### 2.1 汲取的精华

```
┌─────────────────────────────────────────────────────────────┐
│                    LemonClaw 设计哲学                        │
│                                                              │
│  OpenClaw 的运行时架构（稳定、社区驱动）                      │
│      +                                                       │
│  RivonClaw 的规则编译管线（自然语言 → 结构化产物）            │
│      +                                                       │
│  ClawX 的多 Agent UI + 进程管理（用户友好、工程化）           │
│      +                                                       │
│  HomiClaw 的记忆文件方案 + 会话模型（实用、直观）             │
│      +                                                       │
│  完整的中文支持（本地化）                                     │
│                                                              │
│      =                                                       │
│                                                              │
│  LemonClaw 🍋                                                │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 摒弃的缺点

| 项目 | 摒弃什么 | 原因 |
|------|---------|------|
| OpenClaw | 复杂的 CLI 配置 | 学习成本高，桌面用户不需要 |
| RivonClaw | 单 Agent 限制 + MST 状态管理 | MST 过重，Zustand 更适合我们的规模 |
| ClawX | 无中文 + 无规则引擎 | 本地化差，缺少行为定制能力 |
| HomiClaw | 闭源 + 企业绑定 | 不可定制，个人用户用不到企业功能 |

### 2.3 设计原则

1. **分层解耦** — 通信严格分层（Renderer → host-api → IPC → Main → LLM），渲染进程永不直连后端
2. **渐进式集成** — MVP 直接调用 LLM API，后续可选接入 OpenClaw Gateway
3. **文件优先** — Agent 人格、记忆用 Markdown 文件管理（直观、可编辑），结构化数据用 SQLite
4. **中文优先** — 完整的中文界面和文档
5. **开源友好** — 可读、可改、可分发

---

## 3. 整体架构

### 3.1 架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                        LemonClaw Desktop                          │
│                         (Electron 封装)                            │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                     React 前端 UI                             │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │ │
│  │  │ 聊天界面  │  │ Agent 管理 │  │ 规则配置  │                 │ │
│  │  └──────────┘  └──────────┘  └──────────┘                 │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │ │
│  │  │ 记忆管理  │  │ Tool 可视化│  │ 设置     │                 │ │
│  │  └──────────┘  └──────────┘  └──────────┘                 │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                             │                                     │
│                     host-api 抽象层                                │
│                             │                                     │
│                       IPC (contextBridge)                         │
│                             ↓                                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Electron 主进程                            │ │
│  │  ┌───────────────┐  ┌───────────────┐                      │ │
│  │  │ Agent 管理器   │  │ 窗口/托盘管理  │                      │ │
│  │  └───────────────┘  └───────────────┘                      │ │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  │ │
│  │  │ 规则引擎 ⭐    │  │ 记忆系统 ⭐    │  │ LLM 调用层    │  │ │
│  │  └───────────────┘  └───────────────┘  └───────────────┘  │ │
│  │  ┌───────────────┐  ┌───────────────┐                      │ │
│  │  │ SQLite 存储    │  │ 密钥管理       │                      │ │
│  │  └───────────────┘  └───────────────┘                      │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                             ↓ HTTPS                               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                       模型提供商                              │ │
│  │            Theta / OpenAI / Claude / 本地模型                 │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  [可选] OpenClaw Gateway (子进程，用于完整 Agent 运行时)         │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 进程模型

```
LemonClaw 应用
├── Electron 主进程 (main.ts)
│   ├── 窗口管理（单实例锁 + 关闭到托盘）
│   ├── IPC 处理（集中路由）
│   ├── Agent 管理（会话命名空间）
│   ├── 规则引擎（条件匹配 + 产物注入）
│   ├── 记忆系统（文件 + SQLite）
│   ├── LLM 调用层（OpenAI 兼容 SDK）
│   └── 密钥管理（系统密钥链）
│
├── 渲染进程 (renderer)
│   ├── React UI
│   ├── Zustand Stores（按功能域拆分）
│   └── host-api 抽象层（封装 IPC 调用）
│
└── [可选] Gateway 子进程 (utilityProcess)
    └── OpenClaw Agent Runtime
```

### 3.3 数据流

```
用户输入
    ↓
前端 UI (React)
    ↓
host-api 抽象层（封装 IPC 细节）
    ↓
IPC (contextBridge)
    ↓
主进程
    ↓
规则引擎匹配
    ├─ 匹配到 guard → 拦截/修改/放行
    ├─ 匹配到 policy → 注入系统提示词
    └─ 无匹配 → 继续
         ↓
    Agent 路由（按 sessionKey 选择 Agent）
         ↓
    LLM API 调用（Theta/OpenAI/Claude）
         ↓
    返回响应
         ↓
    记忆系统（提取关键信息 → 存储）
         ↓
    Tool 调用？（如有）
         ├─ 低风险 → 自动执行
         └─ 高风险 → 推送审批请求到前端
         ↓
    IPC 通知前端
         ↓
    显示回复 + Tool 状态
```

### 3.4 多 Agent 会话命名空间

参考 ClawX 的 Session Key 模式，每个 Agent 的会话通过结构化 Key 隔离：

```
agent:{agentId}:{sessionType}

示例：
agent:daily:main          — 日常助手的主会话
agent:dev:main            — 代码专家的主会话
agent:daily:project-xxx   — 日常助手的特定项目会话
```

所有 Agent CRUD 操作返回统一的 Snapshot 快照，确保前后端状态一致。

---

## 4. 核心模块设计

### 4.1 多 Agent 系统

**位置**：`src/core/agent/`

**核心接口**：

```typescript
// Agent 配置
interface AgentConfig {
  id: string;              // "daily", "dev", "research"
  name: string;            // "日常助手", "开发专家"
  model: string;           // "glm-5.1"
  systemPrompt: string;    // 系统提示词（可引用 SOUL.md）
  temperature: number;
  enabled: boolean;
}

// Agent 运行时
interface Agent {
  config: AgentConfig;
  conversations: Map<string, Conversation>;  // sessionKey → Conversation
}

// 会话
interface Conversation {
  sessionKey: string;      // "agent:daily:main"
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

// 快照（CRUD 操作统一返回）
interface AgentsSnapshot {
  agents: AgentConfig[];
  activeAgentId: string;
  defaultModel: string;
}
```

**功能**：
- [ ] 多 Agent 实例管理（CRUD + Snapshot 模式）
- [ ] 独立会话命名空间
- [ ] Agent 配置持久化（SQLite）
- [ ] 智能任务路由（后续）

**MVP 范围**：3 个预置 Agent（日常助手、代码专家、写作助手），配置存 SQLite。

---

### 4.2 规则引擎

**位置**：`src/core/rules/`

参考 RivonClaw 的编译管线设计，但 MVP 阶段先做简化版。

**核心概念 — 三种产物类型**：

| 产物类型 | 作用 | 执行方式 | 示例 |
|---------|------|---------|------|
| **Policy** | 行为指导、偏好 | 注入到系统提示词 | "用正式中文回复"、"保持简洁" |
| **Guard** | 硬性限制 | 拦截 Tool 调用 | "禁止删除 /etc 目录" |
| **Action** | 新增能力 | 写入 SKILL.md 文件 | "添加部署到 staging 的技能" |

**核心接口**：

```typescript
interface Rule {
  id: string;
  text: string;              // 用户输入的自然语言规则
  artifacts: RuleArtifact[]; // 编译后的产物
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RuleArtifact {
  id: string;
  ruleId: string;
  type: 'policy' | 'guard' | 'action';
  content: string;           // 编译后的结构化内容
  status: 'ok' | 'failed' | 'pending';
}

class RuleEngine {
  // 编译规则（自然语言 → 产物）
  compile(ruleText: string): Promise<RuleArtifact[]>

  // 注入 Policy 到系统提示词
  injectPolicy(systemPrompt: string, agentId: string): string

  // 检查 Guard（Tool 调用前）
  checkGuard(toolName: string, params: any): Promise<GuardResult>

  // 规则 CRUD
  addRule(text: string): Promise<Rule>
  removeRule(ruleId: string): Promise<void>
  getRules(): Promise<Rule[]>
}
```

**编译策略**：

```
MVP 阶段（关键词启发式）：
  - 包含 "block/deny/forbid/禁止/不要" → guard
  - 包含 "skill/action/enable/技能"  → action
  - 其他 → policy

V2 阶段（LLM 编译）：
  - 第一次 LLM 调用：分类（判断产物类型）
  - 第二次 LLM 调用：生成（产出结构化内容）
  - LLM 不可用时回退到关键词启发式
```

**MVP 范围**：关键词启发式编译 + Policy 注入 + Guard 基础检查。

---

### 4.3 记忆系统

**位置**：`src/core/memory/`

融合 HomiClaw 的 Markdown 文件方案和 SQLite 结构化存储。

**存储方案**：

| 层级 | 存储 | 内容 | 管理方式 |
|------|------|------|---------|
| **短期记忆** | 内存 | 当前会话上下文（最近 N 条消息） | 自动管理 |
| **长期记忆** | Markdown 文件 + SQLite | 用户信息、偏好、重要事件 | 自动提取 + 可手动编辑 |
| **日常记忆** | Markdown 文件 | 每日交互日志 | 自动创建 |

**文件结构**：

```
~/.lemonclaw/
├── memory/
│   ├── MEMORY.md          ← 长期记忆（curated，核心信息）
│   ├── USER.md            ← 用户信息（姓名、位置、工作）
│   └── daily/
│       ├── 2026-04-15.md  ← 当日日志（自动创建）
│       └── 2026-04-14.md
├── data/
│   └── lemonclaw.db       ← SQLite（结构化数据：配置、规则、会话）
└── agents/
    └── {agentId}/
        └── SOUL.md        ← Agent 人格定义
```

**核心接口**：

```typescript
class MemoryManager {
  // 添加消息到会话
  addMessage(sessionKey: string, message: Message): Promise<void>

  // 获取会话上下文（短期记忆）
  getContext(sessionKey: string): Promise<string>

  // 提取关键信息到长期记忆
  extractAndStore(sessionKey: string): Promise<void>

  // 检索记忆（关键词匹配，V2 升级为向量搜索）
  search(query: string): Promise<Memory[]>

  // 读取/写入 Markdown 文件
  readMemoryFile(filename: string): Promise<string>
  writeMemoryFile(filename: string, content: string): Promise<void>
}
```

**记忆加载策略**（参考 HomiClaw）：

- 只在主会话（Main Session）加载完整记忆（MEMORY.md + USER.md）
- 子会话不加载记忆，防止信息泄露
- 心跳机制：定期整理日常日志 → 提炼到 MEMORY.md

**MVP 范围**：Markdown 文件存储 + 自动提取关键词 + 会话上下文管理。

---

### 4.4 LLM 调用层

**位置**：`src/core/llm/`

**核心接口**：

```typescript
interface LLMProvider {
  id: string;               // "theta", "openai", "claude"
  name: string;
  baseUrl: string;
  apiKey: string;            // 从系统密钥链读取
  models: string[];
}

class LLMService {
  // 发送消息（流式响应）
  chat(params: ChatParams): AsyncGenerator<ChatChunk>

  // 管理多个 Provider
  getProviders(): LLMProvider[]
  setActiveProvider(providerId: string): void
}
```

**MVP 范围**：通过 OpenAI SDK（兼容接口）调用 Theta GLM-5.1，支持流式响应。

---

### 4.5 Tool 系统

**位置**：`src/core/tools/`

**审批机制**：

| Tool | 危险等级 | 需要审批 |
|------|---------|---------|
| `exec` | 高 | 是 |
| `write` | 中 | 可配置 |
| `read` | 低 | 否 |
| `web_search` | 低 | 否 |

**Tool 状态机**：

```
pending → running → completed
                  → error
```

**MVP 范围**：基础 Tool 框架 + exec/read/write 三个工具 + 审批 UI。

---

### 4.6 配置与密钥管理

**配置层级**（从 RivonClaw 借鉴的分层模式）：

```
1. 硬编码默认值（代码中的 DEFAULTS）
2. SQLite settings 表（用户通过 UI 修改的配置）
3. Markdown 文件（Agent 人格、记忆等人类可编辑内容）
4. .env 文件（本地环境变量，不入 Git）
5. 系统密钥链（API Key 等敏感信息）
```

**密钥管理策略**：

| 系统 | 方式 |
|------|------|
| macOS | Keychain |
| Windows | DPAPI (electron safeStorage) |

API Key 永不明文存储在数据库或文件中。

---

## 5. 技术选型

### 5.1 技术栈总览

| 层级 | 技术 | 版本 | 理由 |
|------|------|------|------|
| **桌面框架** | Electron | 28+ | 成熟、跨平台 |
| **前端框架** | React | 18+ | 生态好、文档全 |
| **构建工具** | electron-vite | 2+ | Electron + Vite 集成，解决模块解析和 HMR |
| **状态管理** | Zustand | 4+ | 轻量、简单，ClawX 验证可靠 |
| **UI 组件** | shadcn/ui + Tailwind CSS | - | 美观、可定制，ClawX 验证可靠 |
| **后端语言** | TypeScript | 5+ | 类型安全 |
| **包管理** | pnpm | 8+ | 节省空间、快速 |
| **本地存储** | SQLite (better-sqlite3) | 3+ | 结构化数据存储 |
| **LLM 调用** | OpenAI SDK | 4+ | 兼容 Theta/OpenAI 接口 |
| **密钥管理** | electron safeStorage | - | 系统密钥链集成 |

### 5.2 依赖项

```json
{
  "dependencies": {
    "electron": "^28.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.5.0",
    "better-sqlite3": "^9.0.0",
    "openai": "^4.0.0",
    "electron-store": "^8.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "@types/react": "^18.2.0",
    "@types/better-sqlite3": "^7.0.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.0.0",
    "postcss": "^8.0.0"
  }
}
```

---

## 6. 项目结构

### 6.1 MVP 项目结构（electron-vite）

```
lemonclaw-mvp/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 入口：窗口、托盘、初始化
│   │   ├── ipc-handlers.ts      # IPC 路由（集中管理）
│   │   └── bootstrap.ts         # 初始化流程
│   │
│   ├── preload/
│   │   └── index.ts             # contextBridge 暴露 API
│   │
│   ├── renderer/                # React 前端（electron-vite 约定）
│   │   ├── index.html           # HTML 入口
│   │   └── src/
│   │       ├── main.tsx         # React 入口
│   │       ├── App.tsx          # 根组件
│   │       ├── assets/
│   │       │   └── main.css     # 全局样式（Tailwind）
│   │       ├── pages/           # 页面
│   │       │   ├── Chat.tsx     # 聊天页
│   │       │   ├── Agents.tsx   # Agent 管理
│   │       │   ├── Rules.tsx    # 规则配置
│   │       │   └── Settings.tsx # 设置页
│   │       ├── components/      # UI 组件
│   │       │   ├── layout/      # 布局组件
│   │       │   ├── chat/        # 聊天相关
│   │       │   ├── agents/      # Agent 相关
│   │       │   └── common/      # 通用组件
│   │       ├── stores/          # Zustand Stores
│   │       │   ├── chat.ts      # 聊天 Store（核心，按需拆分）
│   │       │   ├── agents.ts    # Agent Store
│   │       │   └── settings.ts  # 设置 Store
│   │       └── lib/
│   │           └── host-api.ts  # IPC 抽象层
│   │
│   └── core/                    # 核心业务逻辑
│       ├── agent/               # Agent 管理
│       │   └── AgentManager.ts
│       ├── rules/               # 规则引擎
│       │   ├── RuleEngine.ts
│       │   ├── compiler.ts      # 规则编译（启发式 + LLM）
│       │   └── types.ts
│       ├── memory/              # 记忆系统
│       │   ├── MemoryManager.ts
│       │   └── MemoryStore.ts   # Markdown 文件读写
│       ├── llm/                 # LLM 调用层
│       │   └── LLMService.ts
│       ├── tools/               # Tool 系统
│       │   └── ToolManager.ts
│       ├── config/              # 配置管理
│       │   └── ConfigManager.ts
│       └── storage/             # SQLite 存储
│           ├── database.ts      # 数据库连接 + 迁移
│           └── repositories/    # Repository 模式
│               ├── AgentRepo.ts
│               ├── RuleRepo.ts
│               ├── ChatRepo.ts
│               └── SettingsRepo.ts
│
├── resources/                   # 应用资源（图标等）
├── config/                      # 默认配置文件
│   └── defaults.ts              # 集中式默认值
├── docs/                        # 文档
│   ├── architecture/            # 架构设计
│   ├── planning/                # 规划文档
│   ├── daily/                   # 每日记录
│   └── guides/                  # 开发指南
│
├── CLAUDE.md                    # AI 持久上下文
├── .gitignore
├── .env.example                 # 环境变量模板
├── .nvmrc                       # Node 版本锁定
├── electron.vite.config.ts      # electron-vite 配置
├── package.json
├── tsconfig.json
├── tailwind.config.mjs
├── postcss.config.mjs
└── README.md
```

### 6.2 核心文件

| 文件 | 作用 | 阶段 |
|------|------|------|
| `src/main/index.ts` | 主进程入口（窗口、托盘、初始化） | Phase 1 |
| `src/main/ipc-handlers.ts` | IPC 路由集中管理 | Phase 1 |
| `src/preload/index.ts` | contextBridge API 暴露 | Phase 1 |
| `src/renderer/src/lib/host-api.ts` | IPC 抽象层 | Phase 1 |
| `src/core/agent/AgentManager.ts` | Agent 管理核心 | Phase 1 |
| `src/core/llm/LLMService.ts` | LLM 调用层 | Phase 1 |
| `src/core/rules/RuleEngine.ts` | 规则引擎核心 | Phase 2 |
| `src/core/memory/MemoryManager.ts` | 记忆管理 | Phase 2 |
| `src/core/storage/database.ts` | SQLite 数据库 | Phase 1 |

---

## 7. 开发路线图

### 7.1 总体时间线

```
Week 1-2: 基础框架（Electron + React + 单 Agent 聊天）
    │
Week 3-4: 核心功能（规则引擎 + 记忆系统）
    │
Week 5-6: 多 Agent + Tool 系统
    │
Week 7-8: 完善发布（UI 优化 + 打包分发）
    │
    ↓
V1.0 完成 (8 周)
```

### 7.2 Phase 1: 基础框架（2 周）

**目标**：能聊天的基础桌面应用

**任务**：
- [ ] Electron 桌面框架（窗口 + 托盘 + 单实例锁）
- [ ] React + Vite + shadcn/ui 前端搭建
- [ ] IPC 通信层（host-api + preload + ipc-handlers）
- [ ] LLM 调用层（OpenAI SDK → Theta GLM-5.1）
- [ ] 基础聊天界面（流式响应）
- [ ] 单 Agent 配置（systemPrompt + model）
- [ ] API Key 配置界面 + 系统密钥链存储

**交付物**：
- 可运行的桌面应用
- 能和 AI 正常对话（流式响应）
- API Key 安全存储

---

### 7.3 Phase 2: 核心功能（2 周）

**目标**：规则引擎 + 记忆系统

**任务**：
- [ ] 规则引擎（启发式编译 + Policy 注入 + Guard 检查）
- [ ] 记忆系统（Markdown 文件 + 自动提取 + 会话上下文）
- [ ] SQLite 存储（Repository 模式）
- [ ] 规则配置界面
- [ ] 记忆管理界面

**交付物**：
- 规则引擎可用（关键词匹配 + 提示词注入）
- 记忆系统可用（记住用户信息 + 跨会话）
- 图形化配置界面

---

### 7.4 Phase 3: 多 Agent + Tool（2 周）

**目标**：多 Agent 并行 + Tool 可视化

**任务**：
- [ ] 多 Agent 系统（CRUD + Snapshot + Session Key 命名空间）
- [ ] Agent 切换 UI（左侧列表 + 右侧对话）
- [ ] Tool 系统（exec/read/write + 状态机）
- [ ] Tool 审批 UI
- [ ] 多会话管理

**交付物**：
- 多 Agent 并行工作
- Tool 调用可视化
- 审批流程

---

### 7.5 Phase 4: 完善发布（2 周）

**目标**：产品化发布

**任务**：
- [ ] Setup Wizard（首次启动引导）
- [ ] 主题系统（亮色/暗色）
- [ ] 性能优化
- [ ] 测试
- [ ] 打包分发（Windows exe + macOS dmg）
- [ ] 用户文档

**交付物**：
- Windows/macOS 安装包
- 完整用户文档
- 发布说明

---

## 8. MVP 版本

4 周内交付可用的 LemonClaw（Phase 1 + Phase 2）。

### 8.1 MVP 功能清单

- [ ] 单 Agent + 基础聊天界面
- [ ] LLM 调用（Theta GLM-5.1，流式响应）
- [ ] 规则引擎（关键词启发式）
- [ ] 长期记忆（Markdown 文件方案）
- [ ] 配置界面（API Key + 模型选择）
- [ ] 安装包（.exe / .dmg）

### 8.2 MVP 舍弃功能

- 多 Agent 并行
- 技能系统
- Tool 可视化 + 审批
- 语义搜索（向量）
- 主题切换
- Setup Wizard

### 8.3 MVP 验收标准

| 功能 | 验收标准 |
|------|---------|
| 聊天对话 | 能发送消息并收到流式回复 |
| 规则引擎 | 能添加规则并影响 Agent 行为 |
| 长期记忆 | 能记住用户姓名，下次对话 AI 能使用 |
| 配置界面 | 图形界面配置 API Key，存入系统密钥链 |
| 打包分发 | 能生成 .exe 和 .dmg |

---

## 9. 风险评估

### 9.1 技术风险

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|---------|
| OpenClaw Gateway 集成复杂 | 中 | 高 | MVP 不依赖 Gateway，直接用 OpenAI SDK |
| 规则编译 LLM 调用不稳定 | 中 | 中 | MVP 用关键词启发式，LLM 编译作为 V2 |
| better-sqlite3 跨平台编译 | 低 | 中 | 两台机器各自 pnpm install 编译 |
| 记忆文件损坏 | 低 | 高 | 定期备份 + 手动可编辑 |
| Electron 安全问题 | 低 | 高 | contextIsolation + 密钥链 + 最小权限 |

### 9.2 项目风险

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|---------|
| 开发周期过长 | 高 | 中 | MVP 优先，迭代开发 |
| 双机同步问题 | 中 | 中 | 每晚 push，白天 pull + 提示词 |
| 需求变更 | 中 | 中 | MVP 功能冻结，变更进 V2 |

---

## 10. 后续步骤

### 10.1 立即行动

- [x] 创建 GitHub 仓库
- [x] 初始化项目结构
- [ ] 搭建 Electron + React + Vite 项目骨架
- [ ] 实现 IPC 通信层
- [ ] 接入 LLM API

### 10.2 关键决策点

```
Week 2 末：基础聊天能用？
├─ 是 → 继续 Phase 2（规则 + 记忆）
└─ 否 → 排查问题，必要时简化

Week 4 末：MVP 功能完成？
├─ 是 → 继续 Phase 3（多 Agent）
└─ 否 → 发布简化 MVP，其余进 V2

Week 6 末：多 Agent 完成？
├─ 是 → 继续 Phase 4
└─ 否 → 单 Agent 发布，多 Agent 进 V2
```

---

## 附录

### A. 参考项目

| 项目 | 仓库 | 借鉴点 |
|------|------|--------|
| OpenClaw | github.com/openclaw/openclaw | Agent 运行时架构、Tool 系统 |
| RivonClaw | github.com/gaoyangz77/rivonclaw | 规则编译管线、SQLite Repository 模式、密钥管理 |
| ClawX | github.com/ValueCell-ai/ClawX | 多 Agent UI、Session Key 命名、进程管理、host-api 抽象层 |
| HomiClaw | 内部项目 | Markdown 记忆文件方案、Agent 人格文件、会话类型 |

### B. 相关文档

- [OpenClaw 文档](https://docs.openclaw.ai/)
- [Electron 文档](https://www.electronjs.org/docs)
- [React 文档](https://react.dev/)
- [Zustand 文档](https://zustand-demo.pmnd.rs/)
- [shadcn/ui](https://ui.shadcn.com/)

### C. 术语表

| 术语 | 说明 |
|------|------|
| Agent | AI 助手实例，有独立人格和会话 |
| Session Key | 会话标识，格式 `agent:{agentId}:{sessionType}` |
| Rule | 行为规则，编译为 Policy/Guard/Action 三种产物 |
| Policy | 软性行为指导，注入到系统提示词 |
| Guard | 硬性行为限制，拦截 Tool 调用 |
| Action | 新增能力定义，以 SKILL.md 实现 |
| Memory | 记忆（短期/长期/日常） |
| Skill | 可扩展的功能插件 |
| Tool | AI 可调用的外部能力 |
| Snapshot | Agent 状态快照，确保前后端一致 |
| host-api | 前端 IPC 抽象层，Renderer 通过它与后端通信 |

---

## 文档历史

| 版本 | 日期 | 作者 | 变更 |
|------|------|------|------|
| v0.1.0 | 2026-04-15 | 配置大王 | 初始版本 |
| v0.2.0 | 2026-04-15 | 配置大王 + Claude | 基于四项目研究优化架构 |

---

**文档结束** — LemonClaw 架构设计与规划书 v0.2.0
