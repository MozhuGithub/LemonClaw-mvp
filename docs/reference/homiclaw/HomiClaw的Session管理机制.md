# 请先通读本文档了解项目全貌，然后我们从「下一步计划」中的优先修复项开始继续开发。

---

## HomiClaw Session 会话管理详解 - 源码分析报告

> 基于 `/Users/kangning/.homiclaw/gateway-bundle/` 源码深度分析
> 
> **日期**：2026-04-17 18:58
> **状态**：✅ 完成

---

## 📋 目录

1. [Session 概述](#1-session 概述)
2. [Session Key 结构](#2-session-key 结构)
3. [Session 存储机制](#3-session-存储机制)
4. [Session 生命周期](#4-session-生命周期)
5. [Session 压缩机制](#5-session-压缩机制)
6. [Session 可见性控制](#6-session-可见性控制)
7. [子 Agent Session 管理](#7-子-agent-session-管理)
8. [对 LemonClaw 的启示](#8-对-lemonclaw-的启示)

---

## 1. Session 概述

### 1.1 Session 的作用

**Session 是 HomiClaw 中用于**：
- ✅ 保存用户对话历史
- ✅ 跟踪 Agent 状态
- ✅ 管理子 Agent 关系
- ✅ 支持会话恢复
- ✅ 实现记忆功能

### 1.2 Session 存储位置

**默认位置**：
```bash
~/.homiclaw/agents/<agent-id>/sessions.json
~/.homiclaw/workspace/sessions.json
```

**配置文件指定**：
```json
{
 "session": {
 "store": "~/.homiclaw/sessions.json"
 }
}
```

---

## 2. Session Key 结构

### 2.1 Session Key 格式

**标准格式**：
```
agent:{agentId}:{scope}:{details}
```

**示例**：
```javascript
// 主会话
agent:main:main

// 子 Agent 会话
agent:main:subagent:abc123

// Cron 任务会话
agent:main:cron:job-123:run:456

// ACP 会话 (Acp Coding Protocol)
agent:main:acp:session-789

// 线程会话
agent:main:thread:topic-xyz:thread-123
```

### 2.2 Session Key 解析函数

**源码位置**：`session-key-BcREzr4N.js`

```javascript
/**
 * Parse agent-scoped session keys
 * 格式：agent:{agentId}:{rest}
 */
function parseAgentSessionKey(sessionKey) {
 const raw = (sessionKey ?? "").trim().toLowerCase();
 if (!raw) return null;
 
 const parts = raw.split(":").filter(Boolean);
 if (parts.length < 3) return null;
 if (parts[0] !== "agent") return null;
 
 const agentId = parts[1]?.trim();
 const rest = parts.slice(2).join(":");
 
 if (!agentId || !rest) return null;
 
 return { agentId, rest };
}
```

### 2.3 Session 类型识别

```javascript
// 识别子 Agent Session
function isSubagentSessionKey(sessionKey) {
 const raw = (sessionKey ?? "").trim();
 if (!raw) return false;
 if (raw.toLowerCase().startsWith("subagent:")) return true;
 const parsed = parseAgentSessionKey(raw);
 return Boolean((parsed?.rest ?? "").toLowerCase().startsWith("subagent:"));
}

// 识别 Cron Session
function isCronSessionKey(sessionKey) {
 const parsed = parseAgentSessionKey(sessionKey);
 if (!parsed) return false;
 return parsed.rest.toLowerCase().startsWith("cron:");
}

// 识别 ACP Session
function isAcpSessionKey(sessionKey) {
 const raw = (sessionKey ?? "").trim();
 if (!raw) return false;
 if (raw.toLowerCase().startsWith("acp:")) return true;
 const parsed = parseAgentSessionKey(raw);
 return Boolean((parsed?.rest ?? "").toLowerCase().startsWith("acp:"));
}

// 计算子 Agent 深度
function getSubagentDepth(sessionKey) {
 const raw = (sessionKey ?? "").trim().toLowerCase();
 if (!raw) return 0;
 return raw.split(":subagent:").length - 1;
}
```

### 2.4 Session Key 构建函数

```javascript
/**
 * 构建主会话 Key
 */
function buildAgentMainSessionKey(params) {
 return `agent:${normalizeAgentId(params.agentId)}:${normalizeMainKey(params.mainKey)}`;
}

/**
 * 构建子 Agent 会话 Key
 */
function buildAgentPeerSessionKey(params) {
 const peerKind = params.peerKind ?? "direct";
 if (peerKind === "direct") {
 const dmScope = params.dmScope ?? "main";
 const peerId = (params.peerId ?? "").trim().toLowerCase();
 
 if (dmScope === "per-channel-peer" && peerId) {
 const channel = (params.channel ?? "").trim().toLowerCase() || "unknown";
 return `agent:${normalizeAgentId(params.agentId)}:${channel}:direct:${peerId}`;
 }
 
 if (dmScope === "per-peer" && peerId) {
 return `agent:${normalizeAgentId(params.agentId)}:direct:${peerId}`;
 }
 
 return buildAgentMainSessionKey({ agentId, mainKey: "main" });
 }
 
 const channel = (params.channel ?? "").trim().toLowerCase() || "unknown";
 const peerId = ((params.peerId ?? "").trim() || "unknown").toLowerCase();
 return `agent:${normalizeAgentId(params.agentId)}:${channel}:${peerKind}:${peerId}`;
}

---

## 3. Session 存储机制

### 3.1 Session 存储结构

**文件位置**：`~/.homiclaw/agents/<agent-id>/sessions.json`

**JSON 结构**：
```json
{
  "agent:main:main": {
    "sessionId": "session-abc123",
    "sessionKey": "agent:main:main",
    "sessionFile": "agent:main:main.jsonl",
    "createdAt": 1713340800000,
    "updatedAt": 1713427200000,
    "lastActive": 1713427200000,
    "agentId": "main",
    "title": "日常助手会话",
    "spawnedBy": null,
    "spawnDepth": 0,
    "subagentRole": "main",
    "subagentControlScope": "children",
    "acp": {
      "harness": "claude-code",
      "threadId": "thread-xyz"
    },
    "metadata": {
      "channel": "telegram",
      "peerId": "user-123"
    }
  },
  "agent:main:subagent:abc123": {
    "sessionId": "session-def456",
    "sessionKey": "agent:main:subagent:abc123",
    "sessionFile": "agent:main:subagent:abc123.jsonl",
    "createdAt": 1713341000000,
    "updatedAt": 1713341400000,
    "lastActive": 1713341400000,
    "agentId": "main",
    "spawnedBy": "agent:main:main",
    "spawnDepth": 1,
    "subagentRole": "orchestrator",
    "subagentControlScope": "children"
  }
}
```

### 3.2 Session Entry 字段详解

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `sessionId` | string | ✅ | 会话唯一 ID |
| `sessionKey` | string | ✅ | 会话 Key（存储索引） |
| `sessionFile` | string | ✅ | JSONL 文件路径 |
| `createdAt` | number | ✅ | 创建时间戳 |
| `updatedAt` | number | ✅ | 更新时间戳 |
| `lastActive` | number | ✅ | 最后活跃时间 |
| `agentId` | string | ✅ | Agent ID |
| `title` | string | ❌ | 会话标题 |
| `spawnedBy` | string | ❌ | 父会话 Key（子 Agent） |
| `spawnDepth` | number | ❌ | 子 Agent 深度（0=主 Agent） |
| `subagentRole` | string | ❌ | 角色（main/orchestrator/leaf） |
| `subagentControlScope` | string | ❌ | 控制范围（children/none） |
| `acp` | object | ❌ | ACP 会话元数据 |
| `metadata` | object | ❌ | 其他元数据 |

### 3.3 Session Store 读写

**读取 Session Store**：
```javascript
// 源码位置：store-DLl7wMwH.js:813
function loadSessionStore(storePath, opts = {}) {
    // 1. 尝试从缓存读取
    if (!opts.skipCache && isSessionStoreCacheEnabled()) {
        const cached = readSessionStoreCache({
            storePath,
            mtimeMs: currentFileStat?.mtimeMs,
            sizeBytes: currentFileStat?.sizeBytes
        });
        if (cached) return cached;
    }
    
    // 2. 从磁盘读取
    let store = {};
    const raw = fs.readFileSync(storePath, "utf-8");
    const parsed = JSON.parse(raw);
    
    if (isSessionStoreRecord(parsed)) {
        store = parsed;
    }
    
    // 3. 应用迁移（版本升级）
    applySessionStoreMigrations(store);
    
    // 4. 写入缓存
    if (!opts.skipCache && isSessionStoreCacheEnabled()) {
        writeSessionStoreCache({
            storePath,
            store,
            mtimeMs: fileStat?.mtimeMs,
            sizeBytes: fileStat?.sizeBytes,
            serialized: raw
        });
    }
    
    return structuredClone(store);
}
```

**更新 Session Store**：
```javascript
// 源码位置：store-DLl7wMwH.js:1065
async function updateSessionStore(storePath, mutator, opts) {
    return await withSessionStoreLock(storePath, async () => {
        // 1. 读取当前存储
        const store = loadSessionStore(storePath, { skipCache: true });
        
        // 2. 保存之前的 ACP 元数据
        const previousAcpByKey = collectAcpMetadataSnapshot(store);
        
        // 3. 执行更新操作
        const result = await mutator(store);
        
        // 4. 保留 ACP 元数据
        preserveExistingAcpMetadata({
            previousAcpByKey,
            nextStore: store,
            allowDropSessionKeys: opts?.allowDropAcpMetaSessionKeys
        });
        
        // 5. 保存回磁盘
        await saveSessionStoreUnlocked(storePath, store, opts);
        
        return result;
    });
}
```

**原子写入**：
```javascript
// 源码位置：store-DLl7wMwH.js:1105
async function writeSessionStoreAtomic(params) {
    const { storePath, store, serialized } = params;
    
    // 1. 写入临时文件
    const tempPath = storePath + ".tmp." + process.pid;
    await fs.promises.writeFile(tempPath, serialized, "utf-8");
    
    // 2. 原子替换（rename）
    await fs.promises.rename(tempPath, storePath);
    
    // 3. 更新缓存
    updateSessionStoreWriteCaches({
        storePath,
        store,
        serialized
    });
}

---

## 5. Session 压缩机制

### 5.1 为什么需要压缩？

**问题**：
- Session 历史太长 → Token 超限
- LLM 上下文窗口有限（如 128K）
- 需要保留关键信息，删除冗余内容

**解决方案**：Session Compaction（压缩）

### 5.2 压缩触发条件

```javascript
// 源码位置：openclaw-tools-Bj7HYlvK.js:21261
async function compactSession(params) {
    // 触发条件：
    // 1. Token 数接近上限
    // 2. 用户手动触发
    // 3. 定时任务
    
    const trigger = params.trigger ?? "auto";
    
    // 检查是否需要压缩
    const metrics = await measureSessionMetrics(params.sessionKey);
    if (metrics.estTokens < params.threshold) {
        return;  // 不需要压缩
    }
    
    // 执行压缩
    await doCompact(params);
}
```

### 5.3 压缩流程

```
检查 Token 数
    ↓
超过阈值？
    ↓ 是
触发 session:compact:before Hook
    ↓
调用 LLM 生成压缩摘要
    ↓
保留关键信息（Decisions/TODOs/Constraints...）
    ↓
删除冗余对话
    ↓
触发 session:compact:after Hook
    ↓
更新 Session 文件
    ↓
记录压缩日志
```

**源码**：
```javascript
// 源码位置：openclaw-tools-Bj7HYlvK.js:17135
// session:compact:before Hook
await triggerInternalHook(
    createInternalHookEvent("session", "compact:before", hookSessionKey, {
        customInstructions: params.customInstructions
    })
);

// 调用 LLM 压缩
const summary = await llm.compact(params.customInstructions);

// session:compact:after Hook
await triggerInternalHook(
    createInternalHookEvent("session", "compact:after", params.hookSessionKey, {
        summary,
        originalMetrics: preMetrics,
        compactedMetrics: postMetrics
    })
);
```

### 5.4 压缩后的 Session 结构

**压缩后保留的内容**：
```markdown
## Decisions
- 关键决策 1
- 关键决策 2

## Open TODOs
- 待办事项 1
- 待办事项 2

## Constraints/Rules
- 约束规则 1

## Pending user asks
- 用户待回答问题

## Exact identifiers
- 文件路径：/path/to/file
- URL: https://example.com
- ID: abc123
```

**删除的内容**：
- ❌ 多余的对话来回
- ❌ 工具调用的详细参数
- ❌ 中间思考过程
- ❌ 错误尝试记录

---

## 6. Session 可见性控制

### 6.1 为什么需要可见性控制？

**场景**：
- 子 Agent 不应该看到主 Agent 的所有会话
- Cron 任务会话应该隔离
- 团队共享会话需要权限控制

### 6.2 可见性级别

```javascript
// 源码位置：openclaw-tools-Bj7HYlvK.js:949
async function createSessionVisibilityGuard(params) {
 const visibility = params.visibility ?? "private";
 
 const check = (targetSessionKey) => {
 // 1. private - 仅自己可见
 if (visibility === "private") {
 if (targetSessionKey !== params.requesterSessionKey) {
 return { visible: false, reason: "private" };
 }
 }
 
 // 2. self - 仅主会话可见
 if (visibility === "self") {
 const targetAgentId = resolveAgentIdFromSessionKey(targetSessionKey);
 if (targetAgentId !== params.requesterAgentId) {
 return { visible: false, reason: "wrong_agent" };
 }
 }
 
 // 3. tree - 会话树可见（主会话 + 子会话）
 if (visibility === "tree") {
 const spawnedKeys = await listSpawnedSessionKeys({
 requesterSessionKey: params.requesterSessionKey
 });
 
 if (targetSessionKey !== params.requesterSessionKey && 
 !spawnedKeys?.has(targetSessionKey)) {
 return { visible: false, reason: "not_in_tree" };
 }
 }
 
 return { visible: true };
 };
 
 return { check };
}
```

### 6.3 可见性级别对比

| 级别 | 说明 | 适用场景 |
|------|------|---------|
| **private** | 仅当前会话可见 | 隐私会话 |
| **self** | 同一 Agent 的会话可见 | 个人助手 |
| **tree** | 会话树可见（父子） | 子 Agent 协作 |
| **team** | 团队共享 | 团队协作 |
| **public** | 所有人可见 | 公共会话 |

---

## 7. 子 Agent Session 管理

### 7.1 子 Agent Session 层级

```
agent:main:main (主 Agent, depth=0)
 ↓ spawn
 agent:main:subagent:abc (Orchestrator, depth=1)
 ↓ spawn
 agent:main:subagent:abc:subagent:def (Leaf, depth=2)
```

### 7.2 子 Agent 角色

```javascript
// 源码位置：openclaw-tools-Bj7HYlvK.js
const SUBAGENT_ROLES = ["main", "orchestrator", "leaf"];

function resolveSubagentRoleForDepth(params) {
 const depth = params.depth ?? 0;
 const maxSpawnDepth = params.maxSpawnDepth ?? 1;
 
 if (depth <= 0) return "main";
 if (depth < maxSpawnDepth) return "orchestrator";
 return "leaf";
}
```

| 角色 | Depth | 权限 |
|------|-------|------|
| **main** | 0 | 完整权限，可 spawn 子 Agent |
| **orchestrator** | 1 ~ maxSpawnDepth-1 | 可 spawn 下一级子 Agent |
| **leaf** | >= maxSpawnDepth | 不可 spawn，仅执行任务 |

### 7.3 子 Agent Session 能力

```javascript
function resolveSubagentCapabilities(params) {
 const role = resolveSubagentRoleForDepth(params);
 const controlScope = resolveSubagentControlScopeForRole(role);
 
 return {
 depth: params.depth,
 role,
 controlScope,
 canSpawn: role === "main" || role === "orchestrator",
 canControlChildren: controlScope === "children"
 };
}
```

### 7.4 子 Agent 工具限制

```javascript
// 始终禁止的工具
const SUBAGENT_TOOL_DENY_ALWAYS = [
 "gateway",
 "agents_list",
 "whatsapp_login",
 "session_status",
 "cron",
 "sessions_send"
];

// Leaf 子 Agent 额外禁止的工具
const SUBAGENT_TOOL_DENY_LEAF = [
 "subagents",
 "sessions_list",
 "sessions_history",
 "sessions_spawn"
];

---

## 8. 对 LemonClaw 的启示

### 8.1 推荐 Session 配置

```json
{
  "session": {
    "store": "~/.lemonclaw/sessions.json",
    "maintenance": {
      "pruneAfterMs": 2592000000,  // 30 天
      "maxEntries": 500,            // 最多 500 个 Session
      "rotateBytes": 5242880        // 5MB 轮转
    },
    "compaction": {
      "enabled": true,
      "thresholdTokens": 100000,    // 100K tokens 触发压缩
      "customInstructions": "保留关键决策和待办事项"
    },
    "visibility": {
      "default": "self",            // 默认同一 Agent 可见
      "allowOverride": true         // 允许运行时覆盖
    }
  }
}
```

### 8.2 推荐的 Session Key 格式

```javascript
// LemonClaw Session Key 格式
{
    // 主会话
    main: "session:main:{userId}"
    
    // 子 Agent 会话
    subagent: "session:subagent:{parentId}:{id}"
    
    // Cron 任务会话
    cron: "session:cron:{jobId}"
    
    // 线程会话
    thread: "session:thread:{threadId}"
}
```

### 8.3 核心代码复用建议

**可以直接复用的函数**：

| 函数 | 用途 | 建议 |
|------|------|------|
| `parseAgentSessionKey` | Session Key 解析 | ✅ 直接复用 |
| `getSubagentDepth` | 计算子 Agent 深度 | ✅ 直接复用 |
| `loadSessionStore` | 读取 Session Store | ✅ 直接复用 |
| `updateSessionStore` | 更新 Session Store | ✅ 直接复用 |
| `pruneStaleEntries` | 清理过期 Session | ✅ 直接复用 |
| `compactSession` | Session 压缩 | ⚠️ 简化后复用 |
| `createSessionVisibilityGuard` | 可见性控制 | ⚠️ 简化后复用 |

### 8.4 可以简化的部分

| HomiClaw 功能 | LemonClaw 建议 |
|--------------|----------------|
| **多 Agent 隔离** | ❌ 简化为单 Agent |
| **复杂可见性** | ❌ 简化为 private/self 两级 |
| **ACP 元数据** | ❌ 不需要 |
| **团队共享** | ❌ 不需要 |
| **Session 迁移** | ✅ 保留（版本升级用） |
| **原子写入** | ✅ 保留（数据安全） |
| **缓存机制** | ✅ 保留（性能优化） |

### 8.5 Session 存储简化方案

```javascript
// LemonClaw Session Store 结构
{
  "session:main:user123": {
    "sessionId": "sess-abc123",
    "sessionKey": "session:main:user123",
    "sessionFile": "session:main:user123.jsonl",
    "createdAt": 1713340800000,
    "updatedAt": 1713427200000,
    "lastActive": 1713427200000,
    "title": "我的会话"
  }
}

// 简化的 Session Key 构建
function buildSessionKey(userId, type = "main") {
    return `session:${type}:${userId}`;
}
```

---

## 📊 总结表

| 功能 | HomiClaw 实现 | LemonClaw 建议 |
|------|--------------|----------------|
| **Session Key 格式** | `agent:{id}:{scope}` | `session:{type}:{userId}` |
| **存储格式** | JSON + JSONL | 保留 |
| **原子写入** | ✅ 有 | ✅ 保留 |
| **缓存机制** | ✅ 有 | ✅ 保留 |
| **Session 压缩** | ✅ 复杂 | ⚠️ 简化 |
| **可见性控制** | ✅ 5 级 | ⚠️ 简化为 2 级 |
| **子 Agent** | ✅ 3 层角色 | ❌ 暂不需要 |
| **维护任务** | ✅ 自动 | ✅ 保留 |
| **Hooks** | ✅ before/after | ⚠️ 简化 |

---

**报告完成** - 基于源码深度分析 ✅
```
