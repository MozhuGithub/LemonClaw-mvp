# HomiClaw 核心逻辑详解 - 精简版

> 基于 `/Users/kangning/.homiclaw/gateway-bundle/` 源码分析
> 
> **日期**：2026-04-17  
> **状态**：✅ 完成

---

## 🏠 整体架构

```
┌─────────────────────────────────────┐
│  Homi.app (Electron 桌面应用)        │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  gateway-entry.mjs (29MB 打包)       │
│  ┌─────────────────────────────┐   │
│  │ Agent 运行时                  │   │
│  │   - 理解用户意图 (LLM)        │   │
│  │   - 决定调用什么工具          │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ 工具系统                      │   │
│  │   - 内置工具 (read/write...)  │   │
│  │   - MCP 工具 (语雀/钉钉...)     │   │
│  │   - Skills (封装的业务逻辑)   │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ Session 管理                  │   │
│  │   - 存储对话历史 (JSONL)      │   │
│  │   - 自动压缩 (Token 超限时)     │   │
│  │   - 多会话隔离               │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**关键文件**：
- `/Applications/Homi.app` - Electron 桌面应用
- `~/.homiclaw/gateway-bundle/gateway-entry.mjs` - 打包的主程序 (29MB)
- `~/.homiclaw/homiclaw.json` - 主配置文件

---

## 📋 一次请求的完整流程

```
1. 用户发送消息
   ↓
2. Gateway 接收 → 找到对应 Session
   ↓
3. 加载对话历史 + 用户配置
   ↓
4. 调用 LLM (带 Fallback 机制)
   ├── 主模型：antchat/Qwen3.5-397B-A17B
   ├── Fallback 1: Kimi-K2.5
   └── Fallback 2: MiniMax-M2.5
   ↓
5. LLM 返回 → 可能包含工具调用
   ↓
6. 执行工具前 → 检查权限/审批
   ├── 安全操作：直接执行
   └── 危险操作：等待用户确认
   ↓
7. 执行工具 → 获取结果
   ↓
8. 结果返回给 LLM → 生成最终回复
   ↓
9. 更新 Session → 追加对话记录
   ↓
10. 返回给用户
```

---

## 🔧 三大核心机制

### 1. LLM Fallback 机制

**目的**：主模型挂了，自动切换到备用模型

**核心代码**：
```javascript
async function runWithModelFallback(params) {
    // 1. 构建候选列表 [主模型，fallback1, fallback2, ...]
    candidates = resolveFallbackCandidates(params)
    
    // 2. 逐个尝试
    for (模型 in candidates) {
        尝试调用
        成功 → 返回结果 ✅
        失败 → 记录错误，试下一个
    }
    
    // 3. 全部失败 → 报错
    throwFallbackFailureSummary()
}
```

**冷却期保护**：
- 首次失败 → 允许立即重试（探测）
- 同一 provider 再次失败 → 30 秒内不重试
- 速率限制 (429) → 冷却期 = Retry-After 头部值

**配置示例**：
```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "antchat/Qwen3.5-397B-A17B",
        "fallbacks": [
          "antchat/Kimi-K2.5",
          "antchat/MiniMax-M2.5"
        ]
      }
    }
  }
}
```

---

### 2. Session 压缩机制

**目的**：对话太长 → Token 超限 → 自动压缩

**触发条件**：
- Token 数 > 阈值 (默认 100K)
- 用户手动触发
- 定时任务

**压缩流程**：
```
检查 Token 数
    ↓
超过阈值？
    ↓ 是
调用 LLM 生成摘要
    ↓
保留关键信息：
- Decisions (关键决策)
- Open TODOs (待办事项)
- Constraints/Rules (约束规则)
- Pending user asks (用户待回答问题)
- Exact identifiers (重要 ID/路径/URL)
    ↓
删除冗余对话
    ↓
更新 Session 文件
```

**配置示例**：
```json
{
  "session": {
    "compaction": {
      "enabled": true,
      "thresholdTokens": 100000
    }
  }
}
```

---

### 3. 工具审批机制

**目的**：危险操作需要用户确认

**审批配置**：
```json
{
  "tools": {
    "approval": {
      "exec": "always",           // 执行命令总是需要审批
      "write": "sensitive-path"   // 敏感路径需要审批
    }
  }
}
```

**审批流程**：
```
Agent 决定调用 exec
    ↓
检查审批策略
    ↓
需要审批？
    ↓ 是
等待用户确认 [✅允许] [❌拒绝]
    ↓ 用户点击允许
执行命令
```

**安全操作 vs 危险操作**：

| 操作 | 审批策略 | 示例 |
|------|---------|------|
| `read` | 无需审批 | 读取文件 |
| `web_search` | 无需审批 | 搜索信息 |
| `write` | 敏感路径 | 写入代码 vs 修改系统文件 |
| `exec` | 总是审批 | 任何命令执行 |

---

## 📝 配置结构（核心字段）

```json
{
  "models": {
    "mode": "merge",
    "providers": {
      "antchat": {
        "baseUrl": "https://antchat.alipay.com/v1",
        "apiKey": "enc:...",
        "api": "openai-completions",
        "models": [
          {
            "id": "Qwen3.5-397B-A17B",
            "contextWindow": 192000,
            "maxTokens": 50000
          }
        ]
      }
    }
  },
  
  "agents": {
    "defaults": {
      "model": {
        "primary": "antchat/Qwen3.5-397B-A17B",
        "fallbacks": ["antchat/Kimi-K2.5"]
      },
      "timeout": 120,
      "workspace": "~/.homiclaw/workspace"
    }
  },
  
  "tools": {
    "approval": {
      "exec": "always",
      "write": "sensitive-path"
    }
  },
  
  "session": {
    "store": "~/.homiclaw/sessions.json",
    "maintenance": {
      "pruneAfterMs": 2592000000,  // 30 天过期
      "maxEntries": 1000,          // 最多 1000 个会话
      "rotateBytes": 10485760      // 10MB 轮转
    }
  }
}
```

---

## 💡 对 LemonClaw 的建议

### 直接复用

| 功能 | 核心函数 | 建议 |
|------|---------|------|
| **LLM Fallback** | `runWithModelFallback()` | ✅ 直接复用 |
| **超时控制** | `resolveAgentTimeoutMs()` | ✅ 直接复用 |
| **Session 存储** | `loadSessionStore()` | ✅ 直接复用 |
| **工具审批** | `before_tool_call` Hook | ✅ 保留核心 |

### 简化后复用

| 功能 | 简化方案 |
|------|---------|
| **Session 压缩** | 去掉复杂 Hooks，只保留核心压缩逻辑 |
| **可见性控制** | 只保留 private/self 两级 |
| **插件系统** | 只保留 before_tool_call |

### 不需要

| 功能 | 原因 |
|------|------|
| 多 Agent 隔离 | 个人使用场景不需要 |
| 复杂子 Agent 层级 | 简化为单层 |
| 企业级功能 | 团队共享、审计日志等不需要 |

---

## 📊 核心函数一览表

| 函数 | 位置 | 作用 |
|------|------|------|
| `runWithModelFallback()` | `openclaw-tools-*.js:3334` | 模型 Fallback 调用 |
| `resolveFallbackCandidates()` | `openclaw-tools-*.js:3199` | 构建候选模型列表 |
| `resolveAgentTimeoutMs()` | `openclaw-tools-*.js:34911` | 解析超时配置 |
| `loadSessionStore()` | `store-*.js:813` | 读取 Session 存储 |
| `updateSessionStore()` | `store-*.js:1065` | 更新 Session 存储 |
| `compactSession()` | `openclaw-tools-*.js:21261` | Session 压缩 |
| `applyToolPolicyPipeline()` | `openclaw-tools-*.js` | 工具权限管道 |
| `parseAgentSessionKey()` | `session-key-*.js` | 解析 Session Key |

---

## 🎯 核心要点总结

1. **HomiClaw = 打包的 OpenClaw + 配置层**
   - 不是 vendor 二进制，是直接 bundle
   - 29MB gateway-entry.mjs 包含所有逻辑

2. **三个核心机制必须保留**
   - LLM Fallback（保证可用性）
   - Session 压缩（防止 Token 超限）
   - 工具审批（安全控制）

3. **LemonClaw 应该复用 OpenClaw Runtime**
   - 直接复用成熟函数
   - 简化企业级功能
   - 专注记忆系统

---

**文档完成** - HomiClaw 核心逻辑精简版 ✅