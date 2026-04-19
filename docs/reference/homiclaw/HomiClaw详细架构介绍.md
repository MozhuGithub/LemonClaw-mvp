 🏠 HomiClaw 架构设计文档

> HomiClaw 是蚂蚁集团内部的 AI 助手框架，LemonClaw 的设计灵感来源之一
> 
> **版本**：v1.0  
> **日期**：2026-04-16  
> **用途**：帮助 LemonClaw 团队理解 HomiClaw 架构

---

## 📋 目录

1. [HomiClaw 概述](#1-homiclaw-概述)
2. [核心设计理念](#2-核心设计理念)
3. [整体架构](#3-整体架构)
4. [核心模块详解](#4-核心模块详解)
5. [技能系统](#5-技能系统)
6. [配置系统](#6-配置系统)
7. [通信机制](#7-通信机制)
8. [与 LemonClaw 的关系](#8-与-lemonclaw-的关系)
9. [关键差异](#9-关键差异)
10. [参考资料](#10-参考资料)

---

## 1. HomiClaw 概述

### 1.1 项目定位

**HomiClaw** 是蚂蚁集团内部使用的 AI 助手框架，基于 OpenClaw 深度定制。

**核心特点**：
- ✅ 企业内部使用（不对外开源）
- ✅ 丰富的技能系统（Skills）
- ✅ 深度集成蚂蚁内部服务
- ✅ 支持多 Agent 协作
- ✅ 完善的权限和审计

---

### 1.2 目标用户

| 用户类型 | 使用场景 | HomiClaw价值 |
|---------|---------|-------------|
| **内部员工** | 日常办公协助 | 提升工作效率 |
| **研发团队** | 代码生成/审查 | 加速开发流程 |
| **产品团队** | 文档撰写/分析 | 提高文档质量 |
| **运营团队** | 数据分析/报告 | 自动化处理 |

---

### 1.3 与开源项目的关系

```
┌─────────────────────────────────────────┐
│           AI 助手框架生态                │
├─────────────────────────────────────────┤
│                                         │
│  OpenClaw (开源基础)                    │
│      │                                  │
│      ├──→ HomiClaw (蚂蚁内部)           │
│      │     - 企业定制                   │
│      │     - 内部服务集成               │
│      │     - 丰富技能                   │
│      │                                  │
│      └──→ LemonClaw (个人版) ⭐         │
│            - 个人友好                   │
│            - 完全开源                   │
│            - 规则引擎 + 记忆            │
│                                         │
└─────────────────────────────────────────┘
```

---

## 2. 核心设计理念

### 2.1 设计哲学

```
┌───────────────────────────────────────────┐
│          HomiClaw 设计哲学                 │
│                                           │
│  安全 (Safety)                             │
│  - 权限控制                                │
│  - 操作审计                                │
│  - 数据隔离                                │
│                                           │
│  可扩展 (Extensibility)                    │
│  - 技能系统                                │
│  - 插件机制                                │
│  - 配置驱动                                │
│                                           │
│  易用性 (Usability)                        │
│  - 自然语言交互                            │
│  - 图形化配置                              │
│  - 中文支持                                │
│                                           │
│  企业级 (Enterprise)                       │
│  - 多租户                                  │
│  - SSO 集成                                │
│  - 合规审计                                │
└───────────────────────────────────────────┘
```

---

### 2.2 核心原则

| 原则 | 说明 | HomiClaw实现 |
|------|------|-------------|
| **安全优先** | 企业数据安全第一 | 权限审批 + 操作审计 |
| **技能驱动** | 能力通过技能扩展 | Skills 系统 |
| **配置即代码** | 配置可版本化 | YAML 配置文件 |
| **自然交互** | 用户用自然语言 | LLM 理解意图 |
| **透明可控** | AI 操作可见 | Tool 可视化 |

---

## 3. 整体架构

### 3.1 架构分层

```
┌─────────────────────────────────────────────────────────────┐
│                      用户交互层                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Web 界面    │  │  钉钉集成   │  │  CLI 工具    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                      Gateway 层                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              HomiClaw Gateway                        │   │
│  │  - HTTP API 服务                                      │   │
│  │  - 认证鉴权                                           │   │
│  │  - 请求路由                                           │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                      Agent 层                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Agent-1    │  │  Agent-2    │  │  Agent-N    │         │
│  │  (日常)     │  │  (代码)     │  │  (数据)     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          │                                  │
│              ┌───────────┴───────────┐                     │
│              │     Agent Manager      │                     │
│              └───────────────────────┘                     │
├─────────────────────────────────────────────────────────────┤
│                      技能层                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Skill Registry                          │   │
│  │  - 文件操作 (read/write/exec)                        │   │
│  │  - 网络操作 (web_search/web_fetch)                   │   │
│  │  - 内部服务 (语雀/钉钉/Dima)                         │   │
│  │  - 工具调用 (MCP 服务器)                              │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                      基础设施层                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  OpenAI SDK │  │  MCP Client │  │  内部 API    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

### 3.2 进程模型

```
HomiClaw 应用
│
├── Gateway 主进程 (Node.js)
│   ├── HTTP Server (端口配置)
│   ├── 认证模块
│   ├── 路由分发
│   └── 日志系统
│
├── Agent 子进程 × N (独立 Node 进程)
│   ├── Agent Runtime
│   ├── Agent 配置
│   ├── Skill 执行引擎
│   ├── 上下文管理
│   └── 会话历史
│       │
│       └── Tool Calls
│           ├── exec
│           ├── write
│           ├── read
│           ├── web_search
│           └── MCP tools
│
└── 技能服务 (可选独立进程)
    ├── MCP Servers
    ├── 内部服务代理
    └── 缓存服务
```

---

### 3.3 数据流

```
用户请求 (钉钉/Web/CLI)
    │
    ↓
┌─────────────────────┐
│   Gateway 入口       │
│   - 认证鉴权         │
│   - 权限检查         │
│   - 请求解析         │
└─────────────────────┘
    │
    ↓
┌─────────────────────┐
│   Agent 选择        │
│   - 根据会话选择    │
│   - 根据技能选择    │
│   - 负载均衡        │
└─────────────────────┘
    │
    ↓
┌─────────────────────┐
│   Agent 处理         │
│   - 理解意图 (LLM)  │
│   - 规划步骤         │
│   - 调用 Skill       │
└─────────────────────┘
    │
    ↓
┌─────────────────────┐
│   Skill 执行         │
│   - 本地工具         │
│   - MCP 服务器       │
│   - 内部 API         │
└─────────────────────┘
    │
    ↓
┌─────────────────────┐
│   响应生成           │
│   - 聚合结果         │
│   - 格式化输出       │
│   - 记录审计         │
└─────────────────────┘
    │
    ↓
返回用户
```

---
## 4. 核心模块详解

### 4.1 Agent 系统

#### Agent 配置结构

```typescript
interface AgentConfig {
  // 基础信息
  id: string;              // Agent 唯一标识
  name: string;            // 显示名称
  description: string;     // 描述信息
  
  // 模型配置
  model: string;           // 使用的模型
  temperature: number;     // 温度参数
  maxTokens: number;       // 最大 Token 数
  
  // 角色定义
  systemPrompt: string;    // 系统提示词
  role: string;            // 角色定位
  
  // 技能配置
  skills: string[];        // 启用的技能列表
  maxSkills: number;       // 最大技能数
  
  // 工作空间
  workspace: string;       // 工作目录
  isolated: boolean;       // 是否隔离
  
  // 权限控制
  permissions: {
    exec: boolean;         // 是否允许执行命令
    write: boolean;        // 是否允许写文件
    network: boolean;      // 是否允许网络访问
    internalApi: boolean;  // 是否允许内部 API
  };
  
  // 会话配置
  session: {
    maxHistory: number;    // 最大历史消息数
    timeout: number;       // 会话超时时间
  };
}
```

#### Agent 生命周期

```
创建 → 初始化 → 运行 → 等待请求 → 处理请求 → 返回响应
                                      ↓
                                    循环
                                      ↓
                              销毁/重启/更新配置
```

---

### 4.2 技能系统 (Skills)

#### 技能架构

```
┌─────────────────────────────────────────────────┐
│              Skill 系统架构                      │
├─────────────────────────────────────────────────┤
│                                                 │
│  Skill Registry (技能注册中心)                  │
│      │                                          │
│      ├── 内置技能 (Built-in)                    │
│      │   ├── read (读取文件)                    │
│      │   ├── write (写入文件)                   │
│      │   ├── exec (执行命令)                    │
│      │   └── edit (编辑文件)                    │
│      │                                          │
│      ├── MCP 技能 (MCP Servers)                 │
│      │   ├── web_search (网页搜索)              │
│      │   ├── web_fetch (网页抓取)               │
│      │   ├── image (图像分析)                   │
│      │   └── 其他 MCP 服务                        │
│      │                                          │
│      └── 内部技能 (Internal)                    │
│          ├── yuque (语雀文档)                   │
│          ├── dingtalk (钉钉消息)                │
│          ├── dima (项目管理)                    │
│          └── 其他内部服务                        │
│                                                 │
└─────────────────────────────────────────────────┘
```

#### 技能定义结构

```typescript
interface Skill {
  // 基本信息
  id: string;              // 技能唯一标识
  name: string;            // 技能名称
  description: string;     // 技能描述
  
  // 技能类型
  type: 'builtin' | 'mcp' | 'internal';
  
  // 工具定义
  tools: Tool[];
  
  // 权限要求
  permissions: string[];
  
  // 配置项
  config: {
    enabled: boolean;      // 是否启用
    priority: number;      // 优先级
    timeout: number;       // 超时时间
  };
  
  // 元数据
  metadata: {
    author: string;        // 作者
    version: string;       // 版本
    tags: string[];        // 标签
  };
}
```

#### 内置技能详解

**1. read (读取文件)**
```yaml
skill: read
description: 读取文件内容
parameters:
  - path: 文件路径（必需）
  - limit: 最大行数（可选）
  - offset: 起始行（可选）
permissions: read_files
audit: 记录读取的文件路径
```

**2. write (写入文件)**
```yaml
skill: write
description: 写入文件内容
parameters:
  - path: 文件路径（必需）
  - content: 文件内容（必需）
permissions: write_files
audit: 记录写入的文件路径和内容摘要
approval: 可能需要审批（根据配置）
```

**3. exec (执行命令)**
```yaml
skill: exec
description: 执行 shell 命令
parameters:
  - command: 命令内容（必需）
  - workdir: 工作目录（可选）
  - timeout: 超时时间（可选）
permissions: execute_commands
audit: 记录执行的命令和输出
approval: 通常需要审批
```

**4. edit (编辑文件)**
```yaml
skill: edit
description: 编辑文件（精确修改）
parameters:
  - path: 文件路径（必需）
  - edits: 编辑操作列表（必需）
    - oldText: 原文本
    - newText: 新文本
permissions: edit_files
audit: 记录编辑的文件和修改内容
```

---

### 4.3 MCP (Model Context Protocol) 系统

#### MCP 架构

```
┌─────────────────────────────────────────────────┐
│              MCP 系统架构                        │
├─────────────────────────────────────────────────┤
│                                                 │
│  HomiClaw Gateway                               │
│      │                                          │
│      ├── MCP Client                             │
│      │   └── 统一 MCP 调用接口                    │
│      │                                          │
│      └── MCP Servers                            │
│          ├── mcp.ant.homi.claw (HomiClaw 工具)  │
│          ├── mcp.ant.faas.skylark (语雀)        │
│          ├── mcp.ant.antdingopenapi (钉钉)      │
│          ├── web-search (网页搜索)              │
│          └── 其他 MCP 服务器                     │
│                                                 │
└─────────────────────────────────────────────────┘
```

#### MCP 调用流程

```
Agent 请求调用 MCP 工具
    │
    ↓
┌─────────────────────┐
│  MCP Client         │
│  - 查找目标 Server   │
│  - 验证权限          │
│  - 序列化参数        │
└─────────────────────┘
    │
    ↓
┌─────────────────────┐
│  MCP Server         │
│  - 接收请求          │
│  - 执行工具          │
│  - 返回结果          │
└─────────────────────┘
    │
    ↓
Agent 接收结果并继续处理
```

---
## 5. 技能系统详解

### 5.1 技能分类

```
HomiClaw Skills
│
├── 内置技能 (Built-in)
│   ├── read (读取文件)
│   ├── write (写入文件)
│   ├── edit (编辑文件)
│   ├── exec (执行命令)
│   ├── shell (Shell 交互)
│   └── process (进程管理)
│
├── MCP 技能 (MCP Servers)
│   ├── web_search (Google/Homi 搜索)
│   ├── web_fetch (网页抓取)
│   ├── image (图像分析)
│   ├── pdf (PDF 分析)
│   ├── tts (语音合成)
│   └── canvas (浏览器自动化)
│
├── 内部技能 (Internal APIs)
│   ├── yuque-doc (语雀文档)
│   ├── ant_search (内部搜索)
│   ├── ant_mcp (内部 MCP)
│   ├── dingtalk (钉钉集成)
│   ├── dima (项目管理)
│   ├── meeting-room (会议室)
│   ├── vacation (假期查询)
│   └── workstation (工位服务)
│
└── 自定义技能 (Custom)
    └── 用户自定义 Skill
```

---

### 5.2 技能注册机制

```typescript
// 技能注册表
class SkillRegistry {
  // 注册技能
  register(skill: Skill): void {
    this.skills.set(skill.id, skill);
  }
  
  // 注销技能
  unregister(skillId: string): void {
    this.skills.delete(skillId);
  }
  
  // 获取技能
  getSkill(skillId: string): Skill | undefined {
    return this.skills.get(skillId);
  }
  
  // 列出所有技能
  listSkills(): Skill[] {
    return Array.from(this.skills.values());
  }
  
  // 启用/禁用技能
  enable(skillId: string): void;
  disable(skillId: string): void;
}
```

---

### 5.3 技能执行流程

```
Agent 决定调用 Skill
    │
    ↓
┌─────────────────────┐
│ Skill 参数验证       │
│ - 检查必填参数       │
│ - 检查类型           │
│ - 检查权限           │
└─────────────────────┘
    │
    ↓
┌─────────────────────┐
│ 权限审批（如需）     │
│ - 等待用户确认       │
│ - 检查审批策略       │
└─────────────────────┘
    │
    ↓
┌─────────────────────┐
│ 执行技能             │
│ - 调用工具           │
│ - 处理结果           │
│ - 错误处理           │
└─────────────────────┘
    │
    ↓
┌─────────────────────┐
│ 记录审计             │
│ - 操作日志           │
│ - 结果存档           │
└─────────────────────┘
    │
    ↓
返回结果给 Agent
```

---
## 6. 配置系统

### 6.1 配置层次

```
┌─────────────────────────────────────────────────┐
│              配置层次结构                        │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. 系统默认配置 (System Defaults)              │
│     - HomiClaw 内置默认值                        │
│     - 只读，不可修改                             │
│                                                 │
│      ↓ 被覆盖                                    │
│                                                 │
│  2. 全局配置 (Global Config)                    │
│     - ~/.homiclaw/homiclaw.json                 │
│     - 管理员维护                                 │
│                                                 │
│      ↓ 被覆盖                                    │
│                                                 │
│  3. Agent 配置 (Agent Config)                   │
│     - ~/.homiclaw/agents/<agent-id>/            │
│     - 每个 Agent 独立配置                         │
│                                                 │
│      ↓ 被覆盖                                    │
│                                                 │
│  4. 会话配置 (Session Config)                   │
│     - 运行时动态配置                             │
│     - 会话结束后失效                             │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

### 6.2 主要配置项

```json
{
  // Gateway 配置
  "gateway": {
    "port": 8080,
    "host": "127.0.0.1",
    "auth": {
      "type": "token",
      "token": "xxx"
    }
  },
  
  // 模型配置
  "models": {
    "default": "antchat/Qwen3.5-397B-A17B",
    "providers": {
      "antchat": {
        "apiKey": "${ANTCHAT_API_KEY}",
        "baseUrl": "https://antchat.alipay.com/v1"
      }
    }
  },
  
  // Agent 配置
  "agents": {
    "enabled": ["agent-1", "agent-2"],
    "default": "agent-1"
  },
  
  // 工具配置
  "tools": {
    "visibility": {
      "exec": "admin",
      "write": "user",
      "read": "public"
    },
    "approval": {
      "exec": "always",
      "write": "sensitive-path"
    }
  },
  
  // 记忆配置
  "memory": {
    "backend": "file",
    "path": "~/.homiclaw/memory/",
    "maxHistory": 100
  },
  
  // 日志配置
  "logging": {
    "level": "info",
    "file": "~/.homiclaw/logs/homiclaw.log"
  }
}
```

---

### 6.3 配置管理命令

```bash
# 查看配置
homiclaw gateway config.get --path agents

# 修改配置
homiclaw gateway config.patch --patch '{"agents":{"enabled":["agent-1"]}}'

# 应用配置
homiclaw gateway config.apply --raw '{"agents":{...}}'

# 重启 Gateway
homiclaw gateway restart

# 查看状态
homiclaw gateway status
```

---
## 7. 通信机制

### 7.1 内部通信

```
┌─────────────────────────────────────────────────┐
│              HomiClaw 通信架构                   │
├─────────────────────────────────────────────────┤
│                                                 │
│  Gateway ←→ Agent (IPC)                        │
│  - spawn/fork 子进程                             │
│  - stdio 管道通信                                │
│  - JSON-RPC 消息格式                             │
│                                                 │
│  Agent ←→ Skill (Function Call)                │
│  - 直接函数调用                                 │
│  - 异步 Promise                                  │
│  - 错误传递                                      │
│                                                 │
│  Gateway ←→ MCP Server (HTTP/MQ)               │
│  - HTTP REST API                                │
│  - 消息队列                                     │
│  - WebSocket (实时)                             │
│                                                 │
│  Client ←→ Gateway (HTTP/WebSocket)            │
│  - REST API (请求 - 响应)                         │
│  - WebSocket (实时推送)                         │
│  - SSE (Server-Sent Events)                    │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

### 7.2 消息格式

#### JSON-RPC 请求

```json
{
  "jsonrpc": "2.0",
  "id": "req-123",
  "method": "agent.invoke",
  "params": {
    "agentId": "agent-1",
    "message": "帮我写个 Hello World",
    "sessionId": "session-456"
  }
}
```

#### JSON-RPC 响应

```json
{
  "jsonrpc": "2.0",
  "id": "req-123",
  "result": {
    "content": "好的，我来帮你写...",
    "toolCalls": [],
    "usage": {
      "promptTokens": 100,
      "completionTokens": 50
    }
  }
}
```

---

### 7.3 事件系统

```typescript
// Gateway 事件
interface GatewayEvents {
  'agent:spawned': (agentId: string) => void;
  'agent:terminated': (agentId: string) => void;
  'agent:error': (agentId: string, error: Error) => void;
  'session:created': (sessionId: string) => void;
  'session:closed': (sessionId: string) => void;
  'tool:called': (toolName: string, result: any) => void;
  'tool:approved': (toolCallId: string) => void;
  'tool:rejected': (toolCallId: string) => void;
}
```

---

## 8. 与 LemonClaw 的关系

### 8.1 设计传承

```
┌─────────────────────────────────────────────────┐
│          HomiClaw → LemonClaw 传承关系          │
├─────────────────────────────────────────────────┤
│                                                 │
│  HomiClaw (企业版)                              │
│  ├── 多 Agent 架构          → LemonClaw 继承 ✅  │
│  ├── 技能系统概念          → 简化版 ✅          │
│  ├── MCP 集成              → 保留 ✅            │
│  ├── 权限审批              → 暂不实现 ⏳        │
│  ├── 内部服务集成          → 不适用 ❌          │
│  └── 审计日志              → 简化版 ✅          │
│                                                 │
│  LemonClaw (个人版)                             │
│  ├── 规则引擎 (新增)       → HomiClaw 没有 ⭐   │
│  ├── 记忆系统 (增强)       → 独立实现 ⭐        │
│  ├── 个人友好配置          → 简化配置 ⭐        │
│  └── 完全开源              → 可自由修改 ⭐      │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

### 8.2 架构对比

| 维度 | **HomiClaw** | **LemonClaw** | 说明 |
|------|-------------|--------------|------|
| **定位** | 企业内部 | 个人使用 | 不同用户群体 |
| **开源** | 闭源 | 完全开源 | 可访问性 |
| **多 Agent** | ✅ 完整支持 | ✅ MVP 完成 | 核心功能 |
| **技能系统** | ✅ 丰富 | ⏳ 简化版 | 复杂度不同 |
| **规则引擎** | ❌ 无 | ⏳ 开发中 | LemonClaw 创新 |
| **记忆系统** | ⚠️ 基础 | ⏳ 增强版 | 核心竞争力 |
| **权限审批** | ✅ 完善 | ❌ 暂不需要 | 使用场景不同 |
| **审计日志** | ✅ 企业级 | ⏳ 简化版 | 合规要求 |
| **内部集成** | ✅ 丰富 | ❌ 不需要 | 服务范围 |
| **配置复杂度** | 🔴 高 | 🟢 低 | 用户体验 |

---

### 8.3 LemonClaw 的差异化

```
┌─────────────────────────────────────────────────┐
│          LemonClaw 差异化优势                    │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. 规则引擎 ⭐                                  │
│     - 自然语言定义规则                          │
│     - 时间/关键词/场景条件                      │
│     - 灵活的动作系统                            │
│                                                 │
│  2. 长期记忆 ⭐                                  │
│     - 三层记忆架构                              │
│     - SQLite 持久化                              │
│     - AI 越用越懂你                              │
│                                                 │
│  3. 个人友好 ⭐                                  │
│     - 简单配置                                  │
│     - 图形化界面                                │
│     - 一键安装                                  │
│                                                 │
│  4. 完全开源 ⭐                                  │
│     - 可读可改                                  │
│     - 社区驱动                                  │
│     - 自由分发                                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 9. 关键差异总结

### 9.1 HomiClaw 特点

**优势**：
- ✅ 企业级功能和安全性
- ✅ 丰富的内部服务集成
- ✅ 完善的权限和审计
- ✅ 成熟的技能系统

**限制**：
- ❌ 仅限内部使用
- ❌ 配置复杂
- ❌ 依赖内部基础设施
- ❌ 不可自由修改

---

### 9.2 LemonClaw 特点

**优势**：
- ✅ 完全开源
- ✅ 个人友好
- ✅ 规则引擎创新
- ✅ 记忆系统增强
- ✅ 简单配置

**待完善**：
- ⏳ 技能系统简化
- ⏳ 缺少企业级功能
- ⏳ 社区生态在建

---

### 9.3 学习建议

```
如果从 HomiClaw 学习 LemonClaw 开发：

1. ✅ 学习多 Agent 架构设计
2. ✅ 理解技能系统原理
3. ✅ 参考 MCP 集成方式
4. ✅ 借鉴配置管理思路
5. ⚠️ 不需要企业内部功能
6. ⚠️ 简化权限审批流程
7. ❌ 不需要内部服务集成
```

---

## 10. 参考资料

### 10.1 HomiClaw 相关

- **项目仓库**: 内部项目（不公开）
- **文档**: 内部 Wiki
- **技能文档**: `~/.homiclaw/gateway-bundle/skills/`
- **配置示例**: `~/.homiclaw/homiclaw.json`

---

### 10.2 OpenClaw 相关

- **GitHub**: GitHub - openclaw/openclaw: Your own personal AI assistant. Any OS. Any Platform. The lobster way. 🦞
- **文档**: https://docs.openclaw.ai/

---

### 10.3 LemonClaw 相关

- **架构设计**: 语雀 - 🍋 LemonClaw 架构设计文档
- **MVP 计划**: 语雀 - 📋 LemonClaw MVP 开发计划
- **项目代码**: `/Users/kangning/Projects/LemonClaw-homi/LemonClaw-homi-mvp`

---

### 10.4 MCP 相关

- **MCP 协议**: https://modelcontextprotocol.io/
- **MCP servers**: GitHub - modelcontextprotocol/servers: Model Context Protocol Servers

---

## 📝 文档历史

| 版本 | 日期 | 作者 | 变更 |
|------|------|------|------|
| v1.0 | 2026-04-16 | 配置大王 | 初始版本 |

---

**文档结束** - HomiClaw 架构设计 v1.0 🏠

这份文档帮助 LemonClaw 团队充分理解 HomiClaw 的架构设计，以便更好地开发 LemonClaw！