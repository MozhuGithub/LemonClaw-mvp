# RivonClaw Chat 数据流详解

> 从用户发消息到界面显示 AI 回复的完整链路拆解
> **来源**：RivonClaw 源码分析 + 会话实测
> **面向项目**：LemonClaw（直接参考）
> **日期**：2026-04-19

---

## 一、架构核心差异

RivonClaw 的 Panel 连接 Gateway 的方式与 LemonClaw 完全不同：

| | RivonClaw | LemonClaw 当前 |
|--|-----------|---------------|
| 连接方式 | 浏览器 WebSocket **直连** Gateway | Electron IPC 中转（IPC → RPC → IPC） |
| WebSocket 客户端 | Panel 进程内的 `GatewayChatClient` | 主进程的 `GatewayRpcClient` |
| chat/agent 事件路径 | Gateway → WebSocket → ChatGatewayController | Gateway → RPC → IPC → preload → chat-store |
| 管理操作路径 | Gateway → RPC → Desktop | 相同 |

**关键洞察**：chat 数据流（消息收发）和管理操作走不同路径。chat 事件直接从 Gateway WebSocket 推送到 Panel 浏览器，不经过 Desktop 主进程。

---

## 二、完整数据流

```
用户输入消息
  ↓
ChatPage.tsx（React 组件）
  ↓ useChatGatewayController()（hook 获取 controller）
  ↓ controller.sendMessage(text)
  ↓
GatewayChatClient（浏览器 WebSocket 直连 ws://127.0.0.1:PORT）
  ↓ { type: "req", id: uuid, method: "chat.send",
      params: { sessionKey, message, idempotencyKey } }
  ↓
Gateway（OpenClaw 子进程）
  ↓ 创建/复用 session
  ↓ 调用 LLM（通过 auth-profiles.json 的 apiKey）
  ↓ emitChatDelta → chat 事件（state: delta, 含累积文本）
  ↓ emitChatFinal → chat 事件（state: final, 含最终消息）
  ↓ emitChatError → chat 事件（state: error）
  ↓ emitChatAborted → chat 事件（state: aborted）
  ↓
GatewayChatClient（浏览器 WebSocket，接收事件）
  ↓ this.emit('event', event, payload)
  ↓
ChatGatewayController（Panel 进程）
  ↓ controller.handleEvent(event, payload)
  ↓ switch (payload.state):
      delta → 累积文本到 UI
      final → 提交最终消息
      error → 显示错误
      aborted → 中断
  ↓
Chat UI 组件（React，响应式渲染）
  ↓ observer() → 自动重渲染
```

---

## 三、GatewayChatClient（浏览器 WebSocket）

**文件**：`apps/panel/src/lib/gateway-client.ts`

### 3.1 核心职责

- 管理到 Gateway 的 WebSocket 连接
- 处理握手（connect.challenge → connect）
- 发送 RPC 请求 / 接收响应
- 转发 chat 事件给 ChatGatewayController

### 3.2 握手流程

```
WebSocket open
  ↓
等待 server emit connect.challenge 事件
  ↓
发送 connect 请求：
{
  type: "req",
  id: uuid,
  method: "connect",
  params: {
    minProtocol: 3,
    maxProtocol: 3,
    client: { id: "openclaw-control-ui", version, platform, mode: "webchat" },
    role: "operator",
    scopes: ["operator.admin", "operator.read", "operator.write"],
    caps: ["tool-events"],
    auth: { token: gatewayToken }
  }
}
  ↓
等待 res { ok: true } → 连接建立
```

**关键字段**：
- `mode: "webchat"` — 决定 `INTERNAL_MESSAGE_CHANNEL = "webchat"`，影响 `shouldSurfaceToControlUi`
- `role: "operator"` + `scopes` — 操作员权限
- `caps: ["tool-events"]` — 订阅 tool 事件

### 3.3 事件转发

```typescript
ws.on('message', (data) => {
  const msg = JSON.parse(data)

  if (msg.type === 'res') {
    // 处理 RPC 响应
    pendingRequests.get(msg.id)?.resolve(msg.payload)
  } else if (msg.type === 'event') {
    // 转发事件
    this.emit('event', msg.event, msg.payload)
  }
})
```

---

## 四、ChatGatewayController

**文件**：`apps/panel/src/pages/chat/controllers/ChatGatewayController.ts`

### 4.1 sendMessage

```typescript
async sendMessage(text: string): Promise<void> {
  // 1. 乐观更新 UI（添加 user 消息 + 空 assistant 消息）
  this.messages.push({ role: 'user', content: text })
  this.messages.push({ role: 'assistant', content: '', isStreaming: true })

  // 2. 发送 RPC
  const { runId } = await this.gatewayClient.request('chat.send', {
    sessionKey: this.sessionKey,
    message: text,
    idempotencyKey: crypto.randomUUID()
  })

  // 3. 保存 runId（用于 abort）
  this.currentRunId = runId
}
```

### 4.2 handleEvent — 事件处理

```typescript
handleEvent(event: string, payload: ChatEventPayload) {
  if (event !== 'chat') return

  const streamingMsg = this.findStreamingMessage()
  if (!streamingMsg) return

  switch (payload.state) {
    case 'delta': {
      const text = extractText(payload.message?.content)
      streamingMsg.content = text
      streamingMsg.isStreaming = true
      break
    }
    case 'final': {
      const text = extractText(payload.message?.content)
      if (text) {
        streamingMsg.content = text
      }
      streamingMsg.isStreaming = false
      break
    }
    case 'error': {
      streamingMsg.content = payload.errorMessage || '发生错误'
      streamingMsg.isStreaming = false
      streamingMsg.isError = true
      break
    }
    case 'aborted': {
      streamingMsg.isStreaming = false
      break
    }
  }
}
```

### 4.3 delta 事件的文本提取

```typescript
function extractText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    // content = [{ type: 'text', text: '...' }]
    const block = content.find((b: any) => b.type === 'text')
    return block?.text ?? ''
  }
  return ''
}
```

---

## 五、事件协议详解

### 5.1 chat.send 请求

```typescript
// GatewayChatClient.request()
{
  type: "req",
  id: uuid,
  method: "chat.send",
  params: {
    sessionKey: "main",
    message: "你好",
    idempotencyKey: uuid
  }
}
```

### 5.2 chat.send 响应

```typescript
// Gateway 返回
{
  type: "res",
  id: reqId,
  ok: true,
  payload: {
    runId: "run-xxx"
  }
}
```

### 5.3 chat 事件（WebSocket 推送）

```typescript
// delta 事件
{
  type: "event",
  event: "chat",
  payload: {
    state: "delta",
    runId: "run-xxx",
    sessionKey: "main",
    message: {
      id: "msg-xxx",
      role: "assistant",
      content: [
        { type: "text", text: "累积的完整文本（不是增量）" }
      ]
    }
  }
}

// final 事件
{
  type: "event",
  event: "chat",
  payload: {
    state: "final",
    runId: "run-xxx",
    sessionKey: "main",
    message: {
      id: "msg-xxx",
      role: "assistant",
      content: [{ type: "text", text: "最终文本" }]
    }
  }
}

// error 事件
{
  type: "event",
  event: "chat",
  payload: {
    state: "error",
    runId: "run-xxx",
    sessionKey: "main",
    errorMessage: "API 错误描述"
  }
}

// aborted 事件
{
  type: "event",
  event: "chat",
  payload: {
    state: "aborted",
    runId: "run-xxx",
    sessionKey: "main"
  }
}
```

### 5.4 Throttle Buffer 恢复

当 `final` 事件没有 `message` 字段时（通常发生在工具调用中断了流式输出），RivonClaw 从 `run.streaming`（内存中的累积 buffer）获取文本。这通过 `chat.history` RPC 查询。

---

## 六、Desktop 端的事件分发

**文件**：`apps/desktop/src/gateway/event-dispatcher.ts`

RivonClaw Desktop 主进程不参与 chat 数据流。`EventDispatcher` 只转发：

- `mobile.session-reset`
- `rivonclaw.chat-mirror`
- `rivonclaw.channel-inbound`
- `mobile.inbound`

**没有** `chat` 或 `agent` 事件。chat 事件直接从 Gateway WebSocket 到 Panel。

### Desktop RPC Client 的作用

Desktop 主进程的 `GatewayRpcClient`（`apps/desktop/src/openclaw/openclaw-connector.ts`）仅用于：
- 管理操作（`agents.list`、`sessions.patch`、`chat.abort` 等）
- 非 chat 事件的订阅

---

## 七、session 管理

### 7.1 sessionKey

sessionKey 是客户端定义的标识符（如 `"main"`），用于归类消息会话。Gateway 按 sessionKey 管理独立的会话历史。

### 7.2 历史查询

```typescript
// Panel → Gateway WebSocket
{
  type: "req",
  id: uuid,
  method: "chat.history",
  params: { sessionKey: "main" }
}

// Gateway 响应
{
  type: "res",
  id: reqId,
  ok: true,
  payload: {
    sessionKey: "main",
    sessionId: "sess-xxx",
    messages: [
      { id: "msg-1", role: "user", content: [...], timestamp: ... },
      { id: "msg-2", role: "assistant", content: [...], timestamp: ... }
    ]
  }
}
```

### 7.3 中断

```typescript
// Panel → Gateway WebSocket
{
  type: "req",
  id: uuid,
  method: "chat.abort",
  params: { sessionKey: "main", runId: "run-xxx" }
}

// Gateway 响应
{
  type: "res",
  ok: true,
  payload: { ok: true, aborted: true }
}
```

---

## 八、LemonClaw 当前实现的差距

| 方面 | RivonClaw | LemonClaw 当前 |
|------|-----------|--------------|
| WebSocket 客户端 | 浏览器直接连 Gateway | Electron IPC 中转 |
| delta 事件 | WebSocket 直推，实时 | 当前依赖 chat.history fallback |
| session 管理 | Gateway 端管理，history RPC 查询 | 同 |
| abort | chat.abort RPC | 同 |
| 事件过滤 | `mode: "webchat"` 控制 | 已设置 |

### 根因分析

LemonClaw 当前的消息显示靠 `chat.history` fallback（在 final 无 message 时拉历史），而不是实时 delta 推送。问题可能在于：

1. **事件中转链路丢失 delta**：IPC → preload → renderer 的链路中 delta 事件丢失
2. **Gateway 端不发送 delta**：可能 `isControlUiVisible` 条件不满足，或 agent 未触发 delta 发射

---

## 九、对 LemonClaw 的改进方向

### 方案 A：保持 IPC 架构，修复 delta 事件

- 排查为什么 IPC 链路中 delta 丢失
- 排查 Gateway 为什么没有发送带 message 的 delta 事件
- 检查 `isControlUiVisible` 条件和 `mode: "webchat"` 设置

### 方案 B：改用直接 WebSocket（推荐）

参考 RivonClaw 架构，在 renderer 进程实现 `GatewayChatClient`：

```
Renderer（浏览器）
  ↓ WebSocket ws://127.0.0.1:GATEWAY_PORT
  ↓ chat.send / chat.history / chat.abort RPC
Gateway（子进程）
  ↓ chat 事件推送（delta/final/error/aborted）
Renderer
  ↓ → ChatGatewayController → UI
```

**优势**：
- 与 RivonClaw 相同架构，行为可预测
- 绕过 IPC 链路，事件实时到达
- 减少主进程负担

**挑战**：
- 需要在 renderer 实现 WebSocket 客户端
- 需要复用现有的 auth token 机制
- IPC bridge 仍有其他用途（Gateway 启动/停止等）

---

## 十、关键文件索引

| 组件 | 文件路径 |
|------|---------|
| GatewayChatClient | `apps/panel/src/lib/gateway-client.ts` |
| ChatGatewayController | `apps/panel/src/pages/chat/controllers/ChatGatewayController.ts` |
| ChatPage | `apps/panel/src/pages/chat/ChatPage.tsx` |
| openclaw-connector | `apps/desktop/src/openclaw/openclaw-connector.ts` |
| EventDispatcher | `apps/desktop/src/gateway/event-dispatcher.ts` |
| RPC Client（pkg） | `packages/gateway/src/rpc-client.ts` |
