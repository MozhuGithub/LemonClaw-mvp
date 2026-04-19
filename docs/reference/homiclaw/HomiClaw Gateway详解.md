# HomiClaw Gateway 详解

> 基于源码深度分析
> 
> **日期**：2026-04-17  
> **状态**：✅ 完成

---

## 🎯 一句话总结

**Gateway = HomiClaw 的大脑** - 负责接收请求、调用 LLM、执行工具、管理会话

---

## 🏗️ Gateway 是什么？

### 核心职责

```
┌─────────────────────────────────────────┐
│              Gateway                     │
│                                         │
│  1. 接收用户请求 (Telegram/钉钉/Web)      │
│  2. 找到对应 Session                     │
│  3. 加载对话历史                         │
│  4. 调用 LLM (理解意图)                   │
│  5. 执行工具 (如果需要)                   │
│  6. 返回结果给用户                       │
│  7. 更新 Session (保存历史)               │
│                                         │
└─────────────────────────────────────────┘
```

### 在架构中的位置

```
用户 (Telegram/钉钉/Web)
    ↓
┌─────────────────────────────────┐
│  Homi.app (Electron 界面)        │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│  Gateway (gateway-entry.mjs)    │  ← 这里！
│  ┌─────────────────────────┐   │
│  │ Agent 运行时             │   │
│  │   - LLM 调用              │   │
│  │   - 工具执行             │   │
│  │   - Session 管理          │   │
│  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │
│  │ MCP Servers             │   │
│  │   - 语雀/钉钉/Dima...     │   │
│  └─────────────────────────┘   │
└─────────────────────────────────┘
    ↓
LLM 提供商 (antchat/OpenAI/Anthropic)
外部 API (语雀/钉钉/天气...)
```

---

## 🔧 Gateway 的核心功能

### 1. 请求路由

**接收不同渠道的消息**：
```javascript
// 支持的渠道
- Telegram
- Discord
- WhatsApp
- 钉钉
- 飞书
- Web (本地界面)
- iMessage
- Signal
```

**路由逻辑**：
```javascript
// 根据 channel + userId 找到对应 Session
const sessionKey = buildAgentPeerSessionKey({
    agentId: "main",
    channel: "telegram",
    peerId: "user-123"
});
```

---

### 2. LLM 调用

**带 Fallback 的调用**：
```javascript
// 核心函数：runWithModelFallback()
async function runWithModelFallback(params) {
    candidates = [
        { provider: 'antchat', model: 'Qwen3.5-397B' },
        { provider: 'antchat', model: 'Kimi-K2.5' },
        { provider: 'antchat', model: 'MiniMax-M2.5' }
    ]
    
    for (模型 in candidates) {
        尝试调用
        成功 → 返回 ✅
        失败 → 试下一个
    }
    
    全部失败 → 报错 ❌
}
```

---

### 3. 工具执行

**执行前检查权限**：
```javascript
// before_tool_call Hook
async function before_tool_call(ctx) {
    // 1. 检查工具是否在黑名单
    if (SUBAGENT_TOOL_DENY_ALWAYS.includes(toolName)) {
        throw new Error('工具被禁用');
    }
    
    // 2. 检查是否需要审批
    if (requiresApproval(toolName, ctx)) {
        await waitForUserApproval(ctx);
    }
    
    // 3. 记录审计日志
    await logAudit(ctx);
}
```

---

### 4. Session 管理

**加载/保存会话**：
```javascript
// 加载 Session
const store = loadSessionStore('~/.homiclaw/sessions.json');
const entry = store[sessionKey];

// 保存 Session
await updateSessionStore(storePath, (store) => {
    store[sessionKey] = {
        ...entry,
        updatedAt: Date.now(),
        lastActive: Date.now()
    };
});
```

---

### 5. 子 Agent 管理

**创建/管理子 Agent**：
```javascript
// 创建子 Agent
const subagentSessionKey = await sessions_spawn({
    task: "帮我分析这个文件",
    runtime: "subagent"
});

// 管理子 Agent
const runs = await subagents('list');
await subagents('kill', { target: runs[0].id });
```

---

## 🛠️ Gateway 管理命令

### 命令行操作

```bash
# 查看状态
homiclaw gateway status

# 重启 Gateway
homiclaw gateway restart

# 获取配置
homiclaw gateway config.get --path agents

# 更新配置
homiclaw gateway config.patch --patch '{"agents":{"enabled":["agent-1"]}}'

# 全量替换配置
homiclaw gateway config.apply --raw '{"agents":{...}}'

# 更新 HomiClaw
homiclaw gateway update.run
```

### API 操作

```javascript
// 通过工具调用
await gateway.restart({ reason: "配置更新" });
await gateway.config.get({ path: "models" });
```

---

## ⚙️ Gateway 配置

### 核心配置项

```json
{
  "gateway": {
    "port": 8080,           // HTTP 端口
    "host": "127.0.0.1",    // 绑定地址
    "auth": {
      "type": "token",      // 认证方式
      "token": "xxx"        // 认证 Token
    }
  },

  "models": {
    "providers": {
      "antchat": {
        "baseUrl": "https://antchat.alipay.com/v1",
        "apiKey": "enc:..."
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

  "session": {
    "store": "~/.homiclaw/sessions.json",
    "maintenance": {
      "pruneAfterMs": 2592000000,  // 30 天过期
      "maxEntries": 1000
    }
  },

  "tools": {
    "approval": {
      "exec": "always",
      "write": "sensitive-path"
    }
  }
}
```

---

## 🔄 Gateway 生命周期

### 启动流程

```
1. 读取配置文件 (homiclaw.json)
   ↓
2. 加载 Agent 配置
   ↓
3. 初始化 MCP Servers
   ↓
4. 启动 HTTP 服务
   ↓
5. 连接到消息渠道 (Telegram/钉钉...)
   ↓
6. 开始接收请求
```

### 优雅重启

**SIGUSR1 信号**：
```bash
# 发送重启信号
kill -SIGUSR1 <gateway_pid>

# 或通过命令
homiclaw gateway restart
```

**重启流程**：
```
收到 SIGUSR1
    ↓
保存当前状态
    ↓
停止接收新请求
    ↓
等待当前请求完成
    ↓
重新加载配置
    ↓
重启服务
```

### 核心配置建议

```json
{
  "gateway": {
    "port": 3000,
    "host": "127.0.0.1"
  },

  "agents": {
    "defaults": {
      "model": {
        "primary": "antchat/Qwen3.5-397B-A17B",
        "fallbacks": ["antchat/Kimi-K2.5"]
      },
      "timeout": 120,
      "workspace": "~/.lemonclaw/workspace"
    }
  },

  "session": {
    "store": "~/.lemonclaw/sessions.json",
    "maintenance": {
      "pruneAfterMs": 2592000000,
      "maxEntries": 500
    }
  },

  "tools": {
    "approval": {
      "exec": "always"
    }
  },

  "memory": {
    "enabled": true,
    "path": "~/.lemonclaw/memory/"
  },

  "rules": {
    "enabled": true,
    "path": "~/.lemonclaw/rules/"
  }
}
```

---

## 📋 总结

### Gateway 的核心职责

| 职责 | 说明 | 重要度 |
|------|------|--------|
| **请求路由** | 接收不同渠道的消息 | ⭐⭐⭐⭐⭐ |
| **LLM 调用** | 理解用户意图 | ⭐⭐⭐⭐⭐ |
| **工具执行** | 操作现实世界 | ⭐⭐⭐⭐⭐ |
| **Session 管理** | 保存对话历史 | ⭐⭐⭐⭐ |
| **子 Agent 管理** | 任务分解委派 | ⭐⭐⭐ |
| **配置管理** | 热重载配置 | ⭐⭐⭐ |

### Gateway 与 HomiClaw 的关系

```
Homi.app (Electron 界面)
    ↓
Gateway (gateway-entry.mjs)  ← 核心！
    ↓
Agent 运行时 / 工具系统 / Session 管理
```

### 对 LemonClaw 的建议

- ✅ 直接复用 OpenClaw Gateway
- ✅ 通过配置简化使用
- ✅ 专注记忆系统
- ❌ 不要自己重写 Gateway

---

**文档完成** - HomiClaw Gateway 详解 ✅
```
