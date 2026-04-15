LemonClaw 架构设计与规划书

> 基于 OpenClaw 的下一代个人 AI 助手平台
> 
> 版本：v0.1.0
> 日期：2026-04-15
> 状态：草案

---

## 📋 目录

1. [项目概述](#1-项目概述)
2. [核心设计理念](#2-核心设计理念)
3. [整体架构](#3-整体架构)
4. [核心模块设计](#4-核心模块设计)
5. [技术选型](#5-技术选型)
6. [项目结构](#6-项目结构)
7. [开发路线图](#7-开发路线图)
8. [MVP 版本](#8-mvp 版本)
9. [风险评估](#9-风险评估)
10. [后续步骤](#10-后续步骤)

---

## 1. 项目概述

### 1.1 项目定位

**LemonClaw** 是一个基于 OpenClaw 的下一代个人 AI 助手桌面应用，旨在提供：

- ✅ **多 Agent 并行** - 同时运行多个 AI 助手，各司其职
- ✅ **智能规则引擎** - 自然语言定义 AI 行为规则
- ✅ **长期记忆系统** - 跨会话记忆，让 AI 越用越懂你
- ✅ **Tool 可视化** - 透明展示 AI 执行的操作
- ✅ **中文友好** - 完整的中文界面和文档
- ✅ **完全开源** - 可读、可改、可分发

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
| **HomiClaw** | 技能丰富 | 闭源、企业定制 | 开源 + 个人友好 |

---

## 2. 核心设计理念

### 2.1 汲取的精华

```
┌─────────────────────────────────────────────────────────────┐
│                    LemonClaw 设计哲学                        │
│                                                              │
│  OpenClaw 的架构（稳定）                                     │
│      +                                                       │
│  RivonClaw 的规则 + 记忆（差异化）                            │
│      +                                                       │
│  ClawX 的 UI 体验（用户友好）                                 │
│      +                                                       │
│  HomiClaw 的技能思路（可扩展）                                │
│      +                                                       │
│  完整的中文支持（本地化）                                     │
│                                                              │
│      =                                                       │
│                                                              │
│  LemonClaw 2.0 🍋                                            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 摒弃的缺点

| 项目 | 摒弃什么 | 原因 |
|------|---------|------|
| OpenClaw | 复杂配置 | 学习成本高 |
| RivonClaw | 单 Agent | 无法多任务 |
| ClawX | 无中文 | 本地化差 |
| HomiClaw | 闭源 | 不可定制 |

### 2.3 设计原则

1. **底层复用** - Agent 运行时用 OpenClaw（稳定、有人维护）
2. **上层创新** - 规则引擎、记忆系统自研（核心竞争力）
3. **渐进式开发** - MVP 优先，迭代完善
4. **中文优先** - 完整的中文界面和文档
5. **开源友好** - 可读、可改、可分发

---

## 3. 整体架构

### 3.1 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        LemonClaw Desktop                         │
│                         (Electron 封装)                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                      React 前端 UI                          │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                │ │
│  │  │ 聊天界面  │  │ Agent 管理 │  │ 规则配置  │                │ │
│  │  └──────────┘  └──────────┘  └──────────┘                │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                │ │
│  │  │ 记忆管理  │  │ Tool 可视化│  │ 技能市场  │                │ │
│  │  └──────────┘  └──────────┘  └──────────┘                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓ IPC                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                     Electron 主进程                         │ │
│  │  ┌──────────────┐  ┌──────────────┐                       │ │
│  │  │ Agent 管理器  │  │ 窗口/托盘管理 │                       │ │
│  │  └──────────────┘  └──────────────┘                       │ │
│  │  ┌──────────────┐  ┌──────────────┐                       │ │
│  │  │ 规则引擎 ⭐  │  │ 记忆系统 ⭐  │                       │ │
│  │  │ (RivonClaw) │  │ (RivonClaw) │                       │ │
│  │  └──────────────┘  └──────────────┘                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓ spawn                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  OpenClaw Gateway (多实例)                   │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐                    │ │
│  │  │Agent-1  │  │Agent-2  │  │Agent-N  │                    │ │
│  │  │(日常)   │  │(代码)   │  │(研究)   │                    │ │
│  │  └─────────┘  └─────────┘  └─────────┘                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓ HTTPS                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                      模型提供商                              │ │
│  │           Theta / OpenAI / Claude / 本地模型                │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 进程模型

```
LemonClaw 应用
├── Electron 主进程 (main.js)
│   ├── 窗口管理
│   ├── IPC 处理
│   ├── Agent 进程管理
│   └── 规则/记忆引擎
│
├── 渲染进程 (renderer)
│   ├── React UI
│   └── 前端逻辑
│
└── Gateway 子进程 (node) × N
    ├── Agent-1
    ├── Agent-2
    └── Agent-N
```

### 3.3 数据流

```
用户输入
    ↓
前端 UI (React)
    ↓
IPC 通信
    ↓
主进程 (规则引擎)
    ↓
规则匹配？
    ├─ 是 → 执行规则动作（拦截/修改/放行）
    └─ 否 → 继续
         ↓
    Agent 路由（选择合适 Agent）
         ↓
    Gateway 子进程
         ↓
    OpenClaw Agent Runtime
         ↓
    LLM API (Theta/OpenAI)
         ↓
    返回响应
         ↓
    记忆系统（存储/更新）
         ↓
IPC 通知前端
    ↓
显示回复
```

---

## 4. 核心模块设计

### 4.1 多 Agent 系统

**位置**：`src/core/agent/`

**核心接口**：
```typescript
interface AgentConfig {
  id: string;           // "main", "dev", "research"
  name: string;         // "日常助手", "开发专家"
  model: string;        // "theta/GLM-5.1"
  workspace: string;    // 独立工作空间
  enabled: boolean;
  priority?: number;    // 任务优先级
}

class AgentManager {
  // 创建 Agent
  createAgent(config: AgentConfig): Promise<Agent>
  
  // 获取 Agent
  getAgent(agentId: string): Agent
  
  // 任务路由
  routeTask(task: Task): Promise<string>
  
  // 销毁 Agent
  destroyAgent(agentId: string): Promise<void>
}
```

**功能**：
- [x] 多 Agent 实例管理
- [x] 独立配置和工作空间
- [x] 智能任务路由
- [ ] Agent 间通信

---

### 4.2 规则引擎

**位置**：`src/core/rules/`

**核心接口**：
```typescript
interface Rule {
  id: string;
  name: string;         // "工作时间回复"
  condition: Condition; // 条件
  action: Action;       // 动作
  priority: number;     // 优先级
  agentId?: string;     // 绑定到特定 Agent
}

class RuleEngine {
  // 规则匹配
  matchRules(context: Context): Promise<Rule[]>
  
  // 规则执行
  execute(rule: Rule, context: Context): Promise<Result>
  
  // 规则管理
  addRule(rule: Rule): Promise<void>
  removeRule(ruleId: string): Promise<void>
}
```

**条件类型**：
| 类型 | 说明 | 示例 |
|------|------|------|
| `time_range` | 时间范围 | 9:00-18:00 工作日 |
| `keyword` | 关键词匹配 | 包含"紧急" |
| `session` | 会话匹配 | 工作会话 |
| `custom` | 自定义表达式 | 复合条件 |

**动作类型**：
| 类型 | 说明 | 效果 |
|------|------|------|
| `reply_immediately` | 立即回复 | 高优先级处理 |
| `silent_notification` | 免打扰 | 不发送通知 |
| `require_approval` | 需要审批 | 等待用户确认 |
| `use_model` | 切换模型 | 使用指定模型 |
| `reject` | 直接拒绝 | 返回预设回复 |

---

### 4.3 记忆系统

**位置**：`src/core/memory/`

**三层记忆架构**：
```
┌─────────────────────────────────────────┐
│           记忆系统架构                   │
├─────────────────────────────────────────┤
│ 短期记忆 (Short-term)                   │
│ - 当前会话上下文                         │
│ - 最近 20 条消息                          │
│ - 自动管理                               │
├─────────────────────────────────────────┤
│ 长期记忆 (Long-term)                    │
│ - 用户信息（姓名/位置/工作）             │
│ - 用户偏好                              │
│ - 重要事件                              │
│ - SQLite 存储                           │
├─────────────────────────────────────────┤
│ 语义记忆 (Semantic) [未来]              │
│ - 向量化存储                            │
│ - 相似度搜索                            │
│ - pgvector                              │
└─────────────────────────────────────────┘
```

**核心接口**：
```typescript
class MemoryManager {
  // 添加消息并可能提取记忆
  addMessage(sessionId: string, message: Message): Promise<void>
  
  // 获取上下文
  getContext(sessionId: string): Promise<string>
  
  // 检索记忆
  search(query: string): Promise<Memory[]>
}
```

---

### 4.4 Tool 可视化

**位置**：`src/renderer/components/`

**组件**：
- `ToolCallViewer` - 显示工具调用
- `ToolApprovalDialog` - 审批对话框
- `ToolHistoryPanel` - 执行历史

**支持的 Tool**：
| Tool | 危险等级 | 需要审批 |
|------|---------|---------|
| `exec` | 🔴 高 | ✅ 是 |
| `write` | 🟡 中 | ⚠️ 可选 |
| `read` | 🟢 低 | ❌ 否 |
| `web_search` | 🟢 低 | ❌ 否 |

---

### 4.5 技能系统

**位置**：`src/skills/`

**技能注册**：
```typescript
interface Skill {
  id: string;
  name: string;
  description: string;
  tools: string[];
  agentId?: string;
  enabled: boolean;
}

class SkillRegistry {
  register(skill: Skill): void
  unregister(skillId: string): void
  getSkills(): Skill[]
  enable(skillId: string): void
  disable(skillId: string): void
}
```

**预置技能**（Phase 1）：
- [ ] 文件管理（read/write/list）
- [ ] 命令执行（exec）
- [ ] 网页搜索（web_search）
- [ ] 代码审查（code_review）
- [ ] 文档总结（doc_summary）

---

## 5. 技术选型

### 5.1 技术栈总览

| 层级 | 技术 | 版本 | 理由 |
|------|------|------|------|
| **桌面框架** | Electron | 28.x | 成熟、跨平台 |
| **前端框架** | React | 18.x | 生态好、文档全 |
| **构建工具** | Vite | 5.x | 快速、现代 |
| **状态管理** | Zustand | 4.x | 轻量、简单 |
| **UI 组件** | shadcn/ui | - | 美观、可定制 |
| **后端语言** | TypeScript | 5.x | 类型安全 |
| **包管理** | pnpm | 8.x | 节省空间、快速 |
| **数据库** | SQLite | 3.x | 本地存储 |
| **向量搜索** | pgvector | - | [未来] 语义搜索 |

### 5.2 依赖项

```json
{
  "dependencies": {
    "electron": "^28.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.5.0",
    "better-sqlite3": "^9.0.0",
    "@openclaw/core": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "@types/react": "^18.2.0",
    "@types/node": "^20.0.0"
  }
}
```

---

## 6. 项目结构

### 6.1 Monorepo 结构

```
lemonclaw/
├── apps/
│   ├── desktop/              # Electron 桌面应用
│   │   ├── src/
│   │   │   ├── main/         # 主进程
│   │   │   ├── renderer/     # 渲染进程
│   │   │   └── core/         # 核心逻辑
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── gateway/              # OpenClaw Gateway (vendor)
│       └── ...
│
├── packages/
│   ├── rules-engine/         # 规则引擎
│   ├── memory-system/        # 记忆系统
│   ├── agent-manager/        # Agent 管理
│   └── skills/               # 技能系统
│
├── config/
│   ├── default.yaml          # 默认配置
│   └── skills/               # 技能配置
│
├── docs/
│   ├── README.md
│   ├── ARCHITECTURE.md
│   ├── RULES.md
│   └── SKILLS.md
│
├── pnpm-workspace.yaml       # Monorepo 配置
├── package.json              # 根配置
└── README.md
```

### 6.2 核心文件

| 文件 | 作用 | 阶段 |
|------|------|------|
| `apps/desktop/src/main/main.ts` | 主进程入口 | Phase 1 |
| `apps/desktop/src/renderer/App.tsx` | 前端根组件 | Phase 1 |
| `packages/rules-engine/src/RuleEngine.ts` | 规则引擎核心 | Phase 2 |
| `packages/memory-system/src/MemoryManager.ts` | 记忆管理 | Phase 2 |
| `packages/agent-manager/src/AgentManager.ts` | Agent 管理 | Phase 1 |

---


## 7. 开发路线图

### 7.1 总体时间线

```
Week 1-2: 基础框架
    │
Week 3-5: 核心功能
    │
Week 6-7: 技能系统
    │
Week 8: 优化发布
    │
    ↓
MVP 完成 (8 周)
```

### 7.2 Phase 1: 基础框架（2 周）

**目标**：能运行的基础桌面应用

**任务**：
- [ ] 搭建 Monorepo 结构
- [ ] Electron 桌面框架
- [ ] OpenClaw Gateway 集成
- [ ] 基础聊天界面
- [ ] 多 Agent 管理框架
- [ ] 配置系统

**交付物**：
- ✅ 可运行的桌面应用
- ✅ 基础聊天功能
- ✅ 多 Agent 配置

---

### 7.3 Phase 2: 核心功能（3 周）

**目标**：规则引擎 + 记忆系统

**任务**：
- [ ] 规则引擎（移植 RivonClaw）
- [ ] 记忆系统（移植 + 增强）
- [ ] Tool 可视化
- [ ] 规则配置界面
- [ ] 记忆管理界面

**交付物**：
- ✅ 规则引擎工作
- ✅ 记忆系统工作
- ✅ 图形化配置界面

---

### 7.4 Phase 3: 技能系统（2 周）

**目标**：可扩展的技能框架

**任务**：
- [ ] 技能注册机制
- [ ] 预置 5-10 个技能
- [ ] 技能市场框架
- [ ] 文档完善

**交付物**：
- ✅ 技能系统可用
- ✅ 5+ 预置技能
- ✅ 完整文档

---

### 7.5 Phase 4: 优化发布（1 周）

**目标**：产品化发布

**任务**：
- [ ] 性能优化
- [ ] Bound tests
- [ ] 打包分发
- [ ] 用户文档

**交付物**：
- ✅ Windows/macOS 安装包
- ✅ 用户文档
- ✅ 发布说明

---

## 8. MVP 版本

如果时间有限，先做这些（4 周）：

### 8.1 MVP 功能清单

- [x] 单 Agent（多 Agent 后续加）
- [x] 基础聊天界面
- [x] 规则引擎（核心功能）
- [x] 长期记忆（核心功能）
- [x] 配置系统
- [x] 打包分发

### 8.2 MVP 舍弃功能

- ❌ 技能市场
- ❌ Tool 可视化
- ❌ 向量搜索
- ❌ 多 Agent 并行

### 8.3 MVP 验收标准

| 功能 | 验收标准 |
|------|---------|
| 聊天对话 | 能发送消息并收到回复 |
| 规则引擎 | 能配置并执行简单规则 |
| 长期记忆 | 能记住用户信息并在后续对话使用 |
| 配置界面 | 能用图形界面配置 API Key |
| 打包分发 | 能生成 .exe/.dmg 安装包 |

---

## 9. 风险评估

### 9.1 技术风险

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|---------|
| OpenClaw 架构变更 | 中 | 高 | 封装隔离层，不直接依赖内部 API |
| RivonClaw 代码不可用 | 低 | 高 | 自行实现核心逻辑 |
| Electron 性能问题 | 中 | 中 | 优化 + 原生模块 |
| 记忆系统数据丢失 | 低 | 高 | 定期备份 + 事务保证 |

### 9.2 项目风险

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|---------|
| 开发周期过长 | 高 | 中 | MVP 优先，迭代开发 |
| 需求变更频繁 | 中 | 中 | 需求冻结期 + 变更控制 |
| 人力资源不足 | 中 | 高 | 优先核心功能，砍边缘功能 |

### 9.3  mitigations

```
高风险项目：
├─ 定期 review 进度
├─ 每周五演示可运行版本
├─ 及时发现和解决问题
└─ 保持 MVP 聚焦
```

---

## 10. 后续步骤

### 10.1 立即行动（本周）

- [ ] 确定开发团队
- [ ] 搭建开发环境
- [ ] Clone OpenClaw 和 RivonClaw 源码
- [ ] 创建项目仓库
- [ ] 搭建 Monorepo 框架

### 10.2 Week 1-2 任务

- [ ] Electron 框架搭建
- [ ] 基础聊天界面
- [ ] OpenClaw Gateway 集成
- [ ] 配置系统

### 10.3 关键决策点

```
Week 2 末：基础框架完成？
├─ 是 → 继续 Phase 2
└─ 否 → 评估是否调整计划

Week 5 末：核心功能完成？
├─ 是 → 继续 Phase 3
└─ 否 → 考虑砍功能保上线

Week 7 末：技能系统完成？
├─ 是 → 继续 Phase 4
└─ 否 → MVP 发布
```

---

## 📚 附录

### A. 参考项目

- OpenClaw: GitHub - openclaw/openclaw: Your own personal AI assistant. Any OS. Any Platform. The lobster way. 🦞
- RivonClaw: GitHub - gaoyangz77/rivonclaw: RivonClaw is an easy-mode runtime and UI layer built on top of OpenCl
- ClawX: GitHub - ValueCell-ai/ClawX: ClawX is a desktop app that provides a graphical interface for OpenClaw
- HomiClaw: 内部项目

### B. 相关文档

- [OpenClaw 文档](https://docs.openclaw.ai/)
- [Electron 文档](https://www.electronjs.org/docs)
- [React 文档](https://react.dev/)

### C. 术语表

| 术语 | 说明 |
|------|------|
| Agent | AI 助手实例 |
| Gateway | OpenClaw 核心运行时 |
| Rule | 行为规则（条件 + 动作） |
| Memory | 记忆（短期/长期/语义） |
| Skill | 可扩展的功能插件 |
| Tool | AI 可调用的外部能力 |

---

## 📝 文档历史

| 版本 | 日期 | 作者 | 变更 |
|------|------|------|------|
| v0.1.0 | 2026-04-15 | 配置大王 | 初始版本 |

---

**文档结束** - LemonClaw 架构设计与规划书 v0.1.0 🍋