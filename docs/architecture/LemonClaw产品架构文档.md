# LemonClaw 产品架构文档

> 基于 HomiClaw 架构增强的个人版 AI 助手
>
> 版本：v3.1.0
> 日期：2026-04-19
> 状态：开发中（Phase 1 Step 4 完成，Step 5 待开始）

---

## 目录

1. [产品定位](#1-产品定位)
2. [架构来源与关系](#2-架构来源与关系)
3. [核心架构](#3-核心架构)
4. [核心模块](#4-核心模块)
5. [产品功能与界面](#5-产品功能与界面)
6. [竞品分析](#6-竞品分析)
7. [开发路线](#7-开发路线)
8. [MVP 定义](#8-mvp-定义)

---

## 1. 产品定位

### 1.1 一句话定位

**LemonClaw 是 HomiClaw 的个人版，在保留核心能力的基础上，增加长期记忆和学习能力，让 AI 越用越懂你。**

### 1.2 核心价值

```
┌─────────────────────────────────────────────────────────────────┐
│                    LemonClaw 核心价值                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  继承自 HomiClaw ✅                                              │
│  ├── 多 Agent 架构 - 每个 Agent 独立配置、独立会话              │
│  ├── 技能系统 - 内置技能 + MCP 协议扩展                         │
│  ├── 会话管理 - 多轮对话、历史保存                              │
│  └── 安全可控 - 权限管理、操作审计                              │
│                                                                 │
│  参考自 Hermes ⭐                                                │
│  ├── 分层记忆架构 - 对话/事实/偏好/技能四层                     │
│  ├── 信任评分 - 不对称惩罚，宁可遗忘也不误导                    │
│  ├── 冻结快照 - 保护 LLM 前缀缓存性能                          │
│  ├── 上下文压缩 - 结构化总结，防止对话膨胀                      │
│  ├── 安全扫描 - 防注入/外泄/不可见字符                          │
│  └── 技能即时修补 - 遇到问题立即修补，不等待                    │
│                                                                 │
│  LemonClaw 原创 ⭐                                               │
│  ├── 主动反思引擎 - 定期分析经验，生成学习报告                  │
│  ├── Agent 隔离记忆 - 每个 Agent 独立记忆和学习                 │
│  ├── 统一学习报告 - 用户可视化了解 Agent 学到了什么             │
│  └── 技能版本管理 - 更新支持回滚                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 目标用户

| 用户类型 | 核心需求 | LemonClaw 解决方案 |
|---------|---------|-------------------|
| **开发者** | 代码助手、项目记忆、技术问答 | 代码 Agent + 记忆系统 + MCP 技能 |
| **创作者** | 写作助手、灵感记录、内容管理 | 写作 Agent + 记忆系统 |
| **学生** | 学习助手、知识整理、问答 | 学习 Agent + 记忆系统 |
| **个人用户** | 日常助手、跨会话记忆 | 日常 Agent + 记忆系统 |

### 1.4 与 HomiClaw 的定位对比

| 维度 | **HomiClaw** | **LemonClaw** |
|------|-------------|--------------|
| **定位** | 企业内部 | 个人使用 |
| **用户** | 蚂蚁员工 | 开发者、创作者、学生 |
| **部署** | 内网服务 | 本地桌面应用 |
| **技能** | 内部服务丰富 | MCP 技能为主 |
| **权限** | 企业级权限审批 | 个人简单权限 |
| **记忆** | 基础会话记忆 | **增强长期记忆** ⭐ |
| **学习** | 无 | **主动反思引擎** ⭐ |

---

## 2. 架构来源与关系

### 2.1 HomiClaw 与 OpenClaw 的关系（已确认）

基于源码分析确认：HomiClaw 用 esbuild 将 OpenClaw 源码打包成 29MB 的 `gateway-entry.mjs`，直接在 Electron 进程内 import 运行。70-80% 代码来自 OpenClaw。

```
OpenClaw（开源 AI 助手运行时，357k+ Stars）
    │
    │  提供（通过 Vendor 子进程模式直接使用）：
    │  ├── Agent Runtime（配置、生命周期、会话隔离）
    │  ├── LLM 调用层（Fallback、冷却期、超时控制）
    │  ├── Session 管理（JSONL 存储、压缩、原子写入）
    │  ├── 工具系统（read/write/exec/web_search 等）
    │  ├── MCP Client
    │  └── Plugin SDK（hooks: before_agent_start/before_tool_call 等）
    │
    └──→ LemonClaw（Vendor 模式集成，参考 RivonClaw）
          │
          │  集成层（参考 RivonClaw）：
          │  ├── GatewayLauncher（子进程生命周期管理、指数退避重启）
          │  ├── Config Bridge（LemonClaw 配置 → openclaw.json）
          │  ├── Secret Injector（密钥链 → auth-profiles.json + 环境变量）
          │  ├── RPC Client（WebSocket 双向通信）
          │  └── Plugin Extensions（通过 OpenClaw hooks 注入自定义逻辑）
          │
          │  自研层（参考 Hermes + 原创）：
          │  ├── 记忆系统（MEMORY.md/USER.md + SQLite FTS5 + 信任评分 + 冻结快照 + 上下文压缩）
          │  ├── 学习引擎（经验收集 + 主动反思 + 技能修补）
          │  └── Electron 桌面应用（React + shadcn/ui）
```

### 2.1.1 集成方式：Vendor 子进程模式（参考 RivonClaw）

LemonClaw 采用 RivonClaw 验证过的 Vendor 子进程模式集成 OpenClaw：

```
LemonClaw 集成架构：
├── vendor/openclaw/          — OpenClaw（git submodule 或 npm，零源码修改）
├── GatewayLauncher           — 启动/停止/重启 OpenClaw Gateway 子进程
│   ├── spawn（系统 Node.js v24.x，非 Electron 内置 v20.x）
│   ├── 指数退避重启策略（1000ms → 30000ms，健康阈值 60s 重置）
│   ├── 就绪检测（stdout "listening on" + WebSocket probe）
│   └── SIGUSR1 优雅重载（仅 Unix，Windows 回退 stop+start）
├── Config Bridge              — 配置翻译
│   ├── LemonClaw 设置 → openclaw.json（auth.profiles + models.providers + plugins.entries）
│   ├── apiKey 嵌入 models.providers（非单独 auth-profiles.json 用于模型配置）
│   └── controlUi: { dangerouslyDisableDeviceAuth: true }（绕过设备认证）
├── Secret Injector            — 密钥注入
│   ├── LLM API Key → auth-profiles.json（Gateway 每次请求时读取，无需重启）
│   ├── minimax → minimax-portal 名称映射
│   └── 非 LLM Key → 环境变量（spawn 时注入）
├── RPC Client                 — WebSocket 双向通信
│   ├── ws://127.0.0.1:{port}（token 认证，client.id: 'openclaw-control-ui'）
│   ├── 等待 connect.challenge → 回复 connect（含 scopes + auth token）
│   └── origin header（http://127.0.0.1:{port}）用于 Control UI 连接
├── Plugin Extensions          — 通过 OpenClaw Plugin SDK 钩子注入
│   ├── lemonclaw-memory       — before_agent_start 注入记忆上下文
│   └── lemonclaw-learning     — after_tool_call 收集经验数据
├── 独立数据层                  — LemonClaw 自有 SQLite（记忆/经验/设置/密钥元数据）
└── UI 层                      — Electron Renderer（React + shadcn/ui + Zustand）
```

**为什么选 Vendor 子进程模式而非 HomiClaw 的 Bundle 模式：**
- OpenClaw 构建系统复杂（tsdown + 20 个动态 import 入口 + jiti 运行时编译 + 90+ 扩展 + 多个 native 模块），单人维护打包管线成本过高
- 子进程隔离：Gateway 崩溃不影响 Electron UI，GatewayLauncher 可自动重启
- 升级简单：pin 版本 + adapter 适配，依赖 OpenClaw 公开接口（Plugin SDK / REST API / config schema）而非内部函数
- 开发调试快：Gateway 子进程独立重启，Electron 不用动；改 Extension 不用动 Gateway

### 2.2 代码复用策略

| 模块 | 策略 | 来源 | 说明 |
|------|------|------|------|
| **Agent Runtime** | 直接使用 | OpenClaw Gateway | 子进程运行，不自己实现 |
| **LLM 调用** | 直接使用 | OpenClaw Gateway | Fallback + 冷却期 + 超时 |
| **Session 管理** | 直接使用 | OpenClaw Gateway | JSONL + 压缩 + 原子写入 |
| **工具系统** | 直接使用 | OpenClaw Gateway | read/write/exec 等 |
| **MCP Client** | 直接使用 | OpenClaw Gateway | MCP 协议 |
| **配置管理** | 桥接层 | 参考 RivonClaw | LemonClaw 配置 → openclaw.json |
| **Gateway 管理** | 自建 | 参考 RivonClaw | GatewayLauncher + RPC |
| **记忆系统** | 全新实现 | 参考 Hermes | OpenClaw/HomiClaw 没有长期记忆 |
| **学习引擎** | 全新实现 | 原创 | 任何项目都没有 |
| **桌面应用** | 全新实现 | Electron + React | 自建 UI |
| **Plugin Extension** | 自建 | 参考 RivonClaw | hooks 注入记忆/学习逻辑 |

---

## 3. 核心架构

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                      用户界面层 (React)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Agent 选择器 │  │ 聊天界面    │  │ 设置面板    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                               ↓ IPC
┌─────────────────────────────────────────────────────────────────┐
│                 Electron 主进程                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Gateway 集成层（参考 RivonClaw）             │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │ Gateway      │  │ Config       │  │ RPC Client   │   │   │
│  │  │ Launcher     │  │ Bridge       │  │ (WebSocket)  │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              自研引擎层                                   │   │
│  │  ┌───────────┐  ┌───────────┐                            │   │
│  │  │ Memory    │  │ Learning  │                            │   │
│  │  │ Engine    │  │  Engine   │                            │   │
│  │  │ (参考Hermes)│  (LemonClaw⭐)│                          │   │
│  │  └───────────┘  └───────────┘                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              LemonClaw 数据层                             │   │
│  │  ┌───────────┐  ┌───────────┐                            │   │
│  │  │ SQLite    │  │ Secret    │                            │   │
│  │  │ + FTS5    │  │ Store     │                            │   │
│  │  └───────────┘  └───────────┘                            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                               ↓ 子进程 (spawn)
┌─────────────────────────────────────────────────────────────────┐
│           OpenClaw Gateway 子进程（直接使用）                     │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐   │
│  │ Agent     │  │ LLM 调用  │  │ Session   │  │ Tool/MCP  │   │
│  │ Runtime   │  │ +Fallback │  │ 管理      │  │ 系统      │   │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Plugin SDK（加载 LemonClaw Extensions）                  │   │
│  │  ├── lemonclaw-memory（before_agent_start 注入记忆）      │   │
│  │  └── lemonclaw-learning（after_tool_call 收集经验）       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 数据流

```
用户输入
    │
    ↓
┌─────────────────────┐
│   渲染进程 (React)   │
│   - Agent 选择       │
│   - 消息输入         │
└─────────────────────┘
    │
    ↓ (IPC)
┌─────────────────────┐
│   主进程 (Electron)  │
│   - 检索记忆 ⭐       │ （FTS5→信任加权→Top-K）
│   - RPC 转发请求     │
│   - 收集经验 ⭐       │
└─────────────────────┘
    │
    ↓ (WebSocket RPC)
┌─────────────────────┐
│   Gateway 子进程     │
│   - 加载记忆上下文 ⭐ │ （Plugin Extension: before_agent_start）
│   - 调用 LLM        │ （自带 Fallback + 冷却期）
│   - 执行工具         │ （自带权限审批）
│   - 经验收集 ⭐      │ （Plugin Extension: after_tool_call）
│   - 更新 Session     │ （自带压缩）
└─────────────────────┘
    │
    ↓ (RPC → IPC)
┌─────────────────────┐
│   渲染进程 (React)   │
│   - 渲染响应         │
│   - Tool 状态展示    │
│   - 收集用户反馈 ⭐  │
└─────────────────────┘
```

---

## 4. 核心模块

### 4.1 Agent 系统（通过 OpenClaw Gateway 直接使用）

Agent Runtime、LLM 调用、Session 管理、工具执行由 OpenClaw Gateway 子进程提供，LemonClaw 通过 RPC Client 调用。

**LemonClaw 的职责：**
- Gateway 管理：启动/停止/重启 Gateway 子进程
- 配置桥接：将用户设置翻译为 openclaw.json
- 记忆注入：通过 Plugin Extension `before_agent_start` hook 注入记忆上下文
- UI 展示：通过 RPC 获取 Agent 状态、会话历史，在 Renderer 中展示

**OpenClaw Gateway 提供的能力（无需自己实现）：**
- Agent 配置、生命周期、会话隔离
- LLM 调用（Fallback + 冷却期 + 超时控制）
- Session 管理（JSONL + 压缩 + 原子写入）
- 工具系统（read/write/exec/web_search 等）
- MCP Client

### 4.2 记忆系统（参考 Hermes + LemonClaw 增强 ⭐）

**四层记忆架构：**

| 层级 | 名称 | 存储 | 内容 | 管理方式 |
|------|------|------|------|---------|
| 第 1 层 | 会话上下文（短期） | 内存 | 当前会话消息历史 | 自动管理，超长压缩 |
| 第 2 层 | 会话搜索（跨会话） | SQLite + FTS5 | 过去会话记录 | FTS5 全文搜索 |
| 第 3 层 | 长期记忆（声明性） | MEMORY.md + USER.md + SQLite | 用户偏好、事实、事件 | 自动提取 + 可编辑 |
| 第 4 层 | 技能记忆（程序性） | SKILL.md 文件 | 可复用工作流 | 复杂任务后自动创建 |

**LemonClaw 增强点：**
- 信任评分（参考 Hermes Holographic，改为内置）— 不对称惩罚，宁可遗忘也不误导
- Agent 隔离记忆 — 每个 Agent 独立 MEMORY.md，互不干扰
- 冻结快照（参考 Hermes）— 会话开始时冻结记忆，保护 LLM 前缀缓存
- 上下文压缩（参考 Hermes）— 长对话自动结构化总结，防压缩风暴
- 安全扫描（参考 Hermes）— 写入前检测注入/外泄/不可见字符
- 记忆检索管线 — FTS5→信任加权→衰减调整→Top-K

> 具体接口（StructuredMemory、MemoryToolParams 等）、信任评分算法、检索管线、压缩算法详见技术方案文档。

### 4.3 学习引擎（LemonClaw 原创 ⭐）

Hermes 的学习是分散的（记忆/技能/反馈各自独立），LemonClaw 增加了集中式反思和统一学习报告。

**包含内容：**

| 组件 | 说明 | Hermes 有无 |
|------|------|------------|
| 经验收集器 | 自动收集用户修改、评分、纠正 | 无（被动收集） |
| 主动反思引擎 | 定期分析经验，生成学习报告 | 无 |
| 统一学习报告 | 可视化展示 Agent 学到了什么 | 无 |
| 技能即时修补 | 遇到问题立即修补 SKILL.md | 有（沿用） |
| 技能版本管理 | 技能更新支持回滚 | 无 |

**反思报告包含：**
- 统计概览（平均评分、修改率、满意度）
- 成功模式（用户满意的共同点 + 置信度）
- 发现的偏好（隐性偏好 + 证据）
- 需要改进（高频问题 + 建议修复）
- 建议操作（记忆更新、技能修补/创建）
- 所有建议需用户确认后才执行

> 反思报告完整接口定义详见技术方案文档。

### 4.4 技能系统（通过 OpenClaw Gateway + Extension 扩展）

**基础能力由 OpenClaw 提供（无需自己实现）：**
- 内置工具：read / write / edit / exec / web_search
- MCP Client：连接外部 MCP 服务
- 工具审批：before_tool_call hook（权限检查）

**LemonClaw 通过 Plugin Extension 扩展：**
- `lemonclaw-memory` Extension：before_agent_start hook 注入记忆上下文
- `lemonclaw-learning` Extension：after_tool_call hook 收集经验数据
- 学习生成技能（Learned Skills）：反思引擎自动创建/修补 SKILL.md，放入 Gateway 的 skills 目录

### 4.5 LLM 调用层（由 OpenClaw Gateway 提供）

- 多 Provider 支持、Fallback 机制、冷却期保护、超时控制——全部由 OpenClaw 的 `runWithModelFallback()` 提供
- LemonClaw 只需通过 Config Bridge 配置模型（provider/modelId 格式）和 API Key
- API Key 通过 Secret Injector 写入 auth-profiles.json，Gateway 每次请求时读取

### 4.6 会话管理（由 OpenClaw Gateway 提供）

- 会话隔离、历史持久化、Session 压缩——全部由 OpenClaw 提供
- LemonClaw 通过 RPC Client 获取会话状态和历史用于 UI 展示

### 4.7 配置管理（Config Bridge 桥接层）

参考 RivonClaw 的 config-writer.ts，将 LemonClaw 用户配置翻译为 OpenClaw 的 openclaw.json：

```
用户通过 UI 修改配置
    ↓
LemonClaw SQLite settings 表
    ↓
Config Bridge（buildFullGatewayConfig → writeGatewayConfig）
    ↓
openclaw.json（写入 OpenClaw state dir）
    ↓
SIGUSR1 触发热重载（无需重启 Gateway）
```

**密钥管理（双路径注入）：**
- LLM API Key → auth-profiles.json（Gateway 每次请求时读取，无需重启）
- 非 LLM Key → 环境变量（spawn 时注入）
- 存储：macOS Keychain / Windows DPAPI（通过 electron safeStorage）

---

## 5. 产品功能与界面

### 5.1 核心功能

| 功能模块 | 功能点 | 优先级 | 来源 |
|---------|--------|--------|------|
| **Agent 管理** | Agent 创建、配置、切换、删除 | P0 | 继承 HomiClaw |
| **对话功能** | 多轮对话、历史保存、Markdown 渲染、流式响应 | P0 | 继承 HomiClaw |
| **记忆功能** | 记忆存储、检索、管理、信任评分 | P0 | 参考 Hermes |
| **配置管理** | API Key 安全存储、模型配置、权限配置 | P0 | LemonClaw |
| **技能功能** | 技能注册、执行、权限管理、MCP 集成 | P1 | 继承 HomiClaw + Hermes |
| **学习功能** | 经验收集、主动反思、学习报告 | P1 | LemonClaw 原创 |
| **上下文压缩** | 长对话自动压缩、结构化总结 | P1 | 参考 Hermes |
| **Tool 可视化** | Tool 调用展示、审批流程 | P2 | LemonClaw |

### 5.2 用户界面

```
┌─────────────────────────────────────────────────────────────────┐
│  LemonClaw                                              [—][□][×]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐  ┌────────────────────────────────────────────┐  │
│  │ Agent    │  │ 聊天界面                                    │  │
│  │ 选择器   │  │                                            │  │
│  │          │  │  [用户] 帮我写一个 Python 脚本              │  │
│  │ 📅 日常  │  │                                            │  │
│  │ 💻 代码  │  │  [AI] 好的，我来帮你写一个...              │  │
│  │ ✍️ 写作  │  │                                            │  │
│  │ 📚 学习  │  │  [用户] 记住我喜欢用 Type Hint              │  │
│  │          │  │                                            │  │
│  │ ──────   │  │  [AI] 好的，我记住了！                      │  │
│  │ 会话     │  │                                            │  │
│  │ 📝 今天  │  │  ┌────────────────────────────────────┐   │  │
│  │ 📝 昨天  │  │  │ 💾 已保存到记忆：                   │   │  │
│  │          │  │  │ 偏好：代码风格 - 使用 Type Hint     │   │  │
│  │ ──────   │  │  └────────────────────────────────────┘   │  │
│  │ 记忆     │  │                                            │  │
│  │ 💡 查看  │  │  [输入框...]                      [发送]    │  │
│  │          │  └────────────────────────────────────────────┘  │
│  │ ──────   │                                                   │
│  │ 设置     │                                                   │
│  │ ⚙️       │                                                   │
│  └──────────┘                                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 记忆管理界面

```
┌─────────────────────────────────────────────────────────────────┐
│  记忆管理                                                  [×]  │
├─────────────────────────────────────────────────────────────────┤
│  [MEMORY.md] [USER.md] [结构化记忆] [技能] [会话搜索]          │
│                                                                 │
│  MEMORY.md  ████████████████░░░░░░░░░░ 67% (2,680/4,000)       │
│  USER.md    ██████████████████████░░░░ 85% (1,700/2,000)       │
│  结构化记忆  事实:45  偏好:12  实体:15  信任:0.72               │
│                                                                 │
│  § 用户偏好函数式编程风格    信任: 0.85  [编辑] [有用] [删除]  │
│  § 项目使用 React 18 + TS   信任: 0.92  [编辑] [有用] [删除]  │
│                                                                 │
│  [+ 添加条目]                    [清理低信任记忆] [导出]        │
└─────────────────────────────────────────────────────────────────┘
```

### 5.4 学习报告界面

```
┌─────────────────────────────────────────────────────────────────┐
│  学习报告 — 代码 Agent                                    [×]  │
├─────────────────────────────────────────────────────────────────┤
│  分析周期: 2026-04-01 ~ 2026-04-16 (25 条经验)                 │
│                                                                 │
│  统计: 平均评分 4.2/5  修改率 20%  满意度 ████████░░ 80%       │
│                                                                 │
│  成功模式:                                                      │
│  • TypeScript 类型定义时满意度最高 (置信度: 0.9)                │
│                                                                 │
│  发现的偏好:                                                    │
│  • [新] 用户偏好函数式编程风格                                  │
│                                                                 │
│  需要改进:                                                      │
│  • 3 次代码输出缺少错误处理 (频率: 12%)                        │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  建议:                                                          │
│  1. 更新 USER.md: 添加偏好      [✓ 应用] [修改] [✗ 跳过]      │
│  2. 修补技能: code_generation   [✓ 应用] [修改] [✗ 跳过]      │
│                                                                 │
│  [全部应用] [全部跳过]                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. 竞品分析

### 6.1 与 HomiClaw 对比

| 特性 | **HomiClaw** | **LemonClaw** | 说明 |
|------|-------------|--------------|------|
| **定位** | 企业内部 | 个人使用 | 不同用户群体 |
| **与 OpenClaw 关系** | Bundle 打包 | Vendor 子进程 | LemonClaw 用更干净的集成方式 |
| **部署** | 内网服务 | 本地桌面应用 | 不同部署方式 |
| **开源** | 闭源 | 完全开源 | 可访问性 |
| **长期记忆** | 基础会话记忆 | **增强版** ⭐ | LemonClaw 创新 |
| **学习引擎** | 无 | **主动反思** ⭐ | LemonClaw 创新 |
| **上下文压缩** | 无 | **有** ⭐ | 参考 Hermes |
| **内部集成** | 语雀/钉钉等 | 不需要 | 使用场景 |
| **配置复杂度** | 高 | 低 | 用户体验 |

### 6.2 与 Hermes Agent 对比

| 特性 | **Hermes** | **LemonClaw** | 说明 |
|------|-----------|--------------|------|
| **记忆架构** | 分层 + 插件化 | 分层 + 内置 | 不需要配置外部插件 |
| **信任评分** | 仅 Holographic 插件 | 内置 | 不对称惩罚 |
| **冻结快照** | 有 | 沿用 | 保护前缀缓存 |
| **上下文压缩** | 有 | 沿用 | 防对话膨胀 |
| **安全扫描** | 有 | 沿用 | 防注入/外泄 |
| **主动反思** | 无 | **有** ⭐ | 定期分析经验 |
| **学习报告** | 无统一报告 | **有** ⭐ | 可视化学习成果 |
| **Agent 隔离** | 无（全局记忆） | **有** ⭐ | 每个 Agent 独立记忆 |
| **多 Agent** | 单 Agent | **多 Agent** ⭐ | 继承 HomiClaw |

### 6.3 全面对比

| 特性 | **LemonClaw** | **Hermes** | **OpenClaw** | **RivonClaw** | **Claude Desktop** |
|------|--------------|-----------|-------------|---------------|-------------------|
| **多 Agent** | 领域隔离 | 单 Agent | 单 Agent | 单 Agent | 单 Agent |
| **长期记忆** | 分层 + 内置 | 分层 + 插件 | 基础 | 无 | 有 |
| **信任评分** | 内置 | 需插件 | 无 | 无 | 无 |
| **主动反思** | 定期反思 | 无 | 无 | 无 | 无 |
| **学习报告** | 可视化 | 无 | 无 | 无 | 无 |
| **上下文压缩** | 结构化总结 | 结构化总结 | 无 | 无 | 无 |
| **技能扩展** | MCP | MCP + 插件 | Tools | Plugin Hooks | MCP |
| **安全扫描** | 有 | 有 | 无 | 无 | 无 |
| **本地部署** | 完全本地 | 完全本地 | 部分 | 完全本地 | 云端 |
| **开源** | 完全开源 | 开源 | 开源 | 开源 | 闭源 |
| **中文友好** | 原生 | 英文为主 | 原生 | 英文为主 | 支持 |
| **与 OpenClaw 关系** | Vendor 子进程 | 独立 | — | Vendor 子进程 | 无关 |

### 6.4 核心竞争力

```
1. 基于 HomiClaw 的成熟架构 ⭐
   - 继承企业级 Agent 系统 + 技能系统 + MCP 协议

2. 长期记忆系统 ⭐
   - 四层分层架构 + 信任评分 + Agent 隔离 + 上下文压缩

3. 主动学习引擎 ⭐
   - 经验自动收集 + 定期反思 + 可视化报告

4. 个人友好 ⭐
   - 图形化界面 + 完全本地 + 中文原生

5. 完全开源 ⭐
```

---

## 7. 开发路线

### Phase 1：OpenClaw Gateway 集成 + Electron 壳（2-3 周）

**目标**：通过 Vendor 子进程模式集成 OpenClaw Gateway，搭建桌面应用骨架

```
Week 1: Gateway 集成层（参考 RivonClaw）
├── GatewayLauncher（spawn/stop/restart + 指数退避重启）
├── Config Bridge（LemonClaw 设置 → openclaw.json）
├── Secret Injector（API Key → auth-profiles.json + 环境变量）
├── RPC Client（WebSocket 双向通信）
└── Plugin Extension 基础框架（openclaw.plugin.json + hook 注册）

Week 2-3: Electron UI 对接
├── Chat 页面（通过 RPC 调 Gateway 的 chat API + 流式响应）
├── Settings 页面（API Key 配置 + 模型选择 → Config Bridge）
├── Agent 切换（通过 RPC 管理 Agent）
└── Plugin Extension: before_agent_start（注入基础系统提示）
```

### Phase 2：记忆系统（参考 Hermes）（3 周）

**目标**：实现长期记忆系统，通过 Plugin Extension 注入 Gateway

```
Week 4-5: 记忆引擎
├── MemoryStore（MEMORY.md / USER.md 读写 + 冻结快照）
├── SQLite（WAL 模式 + FTS5 + 结构化记忆 + 信任评分）
├── 记忆检索管线（FTS5 → 信任加权 → 时间衰减 → Top-K）
├── 安全扫描（注入/外泄/不可见字符检测）
└── Plugin Extension: lemonclaw-memory（before_agent_start 注入记忆上下文）

Week 6: 记忆 UI + 上下文压缩
├── 记忆管理页面（查看/搜索/编辑/信任评分显示）
├── 记忆使用状态面板
└── ContextCompressor（参考 Hermes 5 阶段压缩 + 防压缩风暴）
```

### Phase 3：学习引擎（LemonClaw 原创）（3 周）

**目标**：经验收集 + 主动反思

```
Week 7: 经验收集
├── ExperienceCollector（自动收集 + 用户反馈）
├── Plugin Extension: lemonclaw-learning（after_tool_call hook）
└── 技能即时修补（SKILL.md 自动生成/更新）

Week 8-9: 反思引擎 + UI
├── ReflectionEngine（定期 LLM 分析 + 报告生成）
├── 学习报告 UI（可视化展示 Agent 学到了什么）
└── 技能版本管理（更新支持回滚）
```

### Phase 4：优化 + 发布（2 周）

```
Week 10-11: 错误恢复 + 数据库优化 + UI 优化
Week 11: 文档 + 打包（Windows exe + macOS dmg）+ 发布
```

---

## 8. MVP 定义

### 8.1 MVP 功能清单（Phase 1 + Phase 2 部分）

| 优先级 | 功能 | Phase | 说明 |
|--------|------|-------|------|
| **P0** | OpenClaw Gateway 集成 | 1 | GatewayLauncher + Config Bridge + RPC |
| **P0** | 单 Agent 对话 | 1 | 通过 Gateway RPC 实现 |
| **P0** | API Key 配置 | 1 | 密钥链 → auth-profiles.json |
| **P0** | 基础记忆存储 | 2 | MEMORY.md + USER.md + 冻结快照 |
| **P1** | 记忆检索 | 2 | FTS5 搜索 |
| **P1** | 多 Agent 切换 | 1 | Gateway 原生支持 |
| **P1** | 流式响应 | 1 | Gateway SSE → Renderer |

### 8.2 MVP 验收标准

- [x] OpenClaw Gateway 子进程可以正常启动/停止/重启 → Step 3
- [ ] 用户可以与 Agent 进行多轮对话（通过 Gateway RPC）→ Step 5
- [ ] 对话历史被保存到本地（Gateway Session 管理）→ Step 7
- [ ] 用户可以配置 API Key（通过 Config Bridge 注入 Gateway）→ Step 6
- [ ] 用户可以在 2 个 Agent 之间切换 → Step 8
- [ ] 对话中的重要信息被存储为记忆（MEMORY.md + USER.md）→ Phase 2
- [ ] 用户可以查看和搜索记忆 → Phase 2

### 8.3 MVP 舍弃功能

| 功能 | 放入阶段 | 原因 |
|------|---------|------|
| 向量语义检索 | V2 | FTS5 够用 |
| 上下文压缩 | Phase 2 后期 | 先确保基础记忆跑通 |
| 学习引擎 | Phase 3 | 先让记忆跑通 |
| MCP 自定义集成 | 后续 | OpenClaw 自带 MCP，先不扩展 |
| 多 Agent 并行 | 后续 | 先做单 Agent + 切换 |

---

## 附录

### A. 参考项目

| 项目 | 参考内容 |
|------|---------|
| **HomiClaw** | 打包模式参考：将 OpenClaw bundle 为 29MB gateway-entry.mjs 在 Electron 进程内运行（我们选了 RivonClaw 的子进程模式替代） |
| **Hermes Agent** | 记忆系统参考：MEMORY.md/USER.md、冻结快照、上下文压缩（5 阶段）、信任评分、安全扫描、SKILL.md 格式 |
| **OpenClaw** | 核心运行时：Agent Runtime、LLM Fallback、Session 管理、工具系统、MCP Client、Plugin SDK |
| **RivonClaw** | 集成模式参考：Vendor 子进程 + GatewayLauncher + Config Bridge + Secret Injector + Plugin Extensions |

### B. 术语表

| 术语 | 说明 |
|------|------|
| Agent | AI 助手实例，有独立人格、会话和记忆 |
| Session Key | 会话标识，格式 `agent:{agentId}:{sessionType}` |
| Skill | 可扩展的功能插件，以 SKILL.md 文件定义 |
| MCP | Model Context Protocol，模型上下文协议 |
| Trust Score | 信任评分 (0-1)，衡量记忆的可靠性 |
| Nudge | 主动记忆审查机制，每 N 轮自动触发 |
| 冻结快照 | 会话开始时冻结记忆，保护 LLM 前缀缓存 |
| 上下文压缩 | 长对话自动总结，防止上下文膨胀 |

### C. 相关文档

| 文档 | 位置 | 说明 |
|------|------|------|
| 技术方案 | `docs/architecture/LemonClaw技术方案文档.md` | 接口定义、算法细节、错误分类等 |
| HomiClaw 源码分析 | `references/homiclaw/` | HomiClaw 架构、Gateway、LLM、Session 详解（6 篇） |
| Hermes 源码 | `references/hermes/` | Hermes Agent 记忆系统、上下文压缩、技能系统 |
| OpenClaw 源码 | `references/openclaw/` | OpenClaw 运行时、Gateway、Plugin SDK |
| RivonClaw 源码 | `references/rivonclaw/` | Vendor 子进程集成模式 |

---

**文档版本**: v3.1.0
**创建时间**: 2026-04-16
**最后更新**: 2026-04-19
**状态**: 开发中（Phase 1 Step 4 完成）
