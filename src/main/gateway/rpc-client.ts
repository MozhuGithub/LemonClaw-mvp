import WebSocket from 'ws'
import { EventEmitter } from 'events'
import { getAuthToken } from './config-bridge'
import { randomUUID } from 'crypto'

/**
 * Gateway RPC Client：WebSocket 双向通信。
 *
 * 参考 RivonClaw rpc-client.ts + OpenClaw 协议规范：
 * - 握手流程：等待服务端 connect.challenge → 回复 connect 请求
 * - Token 认证（MVP 跳过 Ed25519 设备认证）
 * - JSON-RPC 风格帧协议（req/res/event）
 * - 自动重连 + 指数退避
 */

interface PendingRequest {
  resolve: (value: any) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class GatewayRpcClient extends EventEmitter {
  private ws: WebSocket | null = null
  private pending = new Map<string, PendingRequest>()
  private connected = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectMs = 1000
  private readonly maxReconnectMs = 30000

  constructor(
    private port: number,
    private timeout: number = 30000,
  ) {
    super()
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `ws://127.0.0.1:${this.port}`

      this.ws = new WebSocket(url, {
        headers: { origin: `http://127.0.0.1:${this.port}` },
      })

      const connectTimeout = setTimeout(() => {
        this.ws?.close()
        reject(new Error('RPC connect timeout'))
      }, this.timeout)

      let settled = false

      // 等待服务端发 connect.challenge 事件，然后回复 connect 请求
      const handshakeListener = (raw: string) => {
        try {
          const msg = JSON.parse(raw)
          if (msg.type === 'event' && msg.event === 'connect.challenge') {
            clearTimeout(connectTimeout)
            // 移除此临时监听器
            this.ws?.off('message', handshakeListener)
            // 用 nonce 回复 connect
            this.doHandshake(msg.payload?.nonce)
              .then(() => { settled = true; resolve() })
              .catch((err) => { settled = true; reject(err) })
          }
        } catch { /* 忽略非 JSON 消息 */ }
      }

      this.ws.on('message', (data: WebSocket.Data) => {
        handshakeListener(data.toString())
      })

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data.toString())
      })

      this.ws.on('close', () => {
        clearTimeout(connectTimeout)
        this.ws?.off('message', handshakeListener)
        this.onDisconnected()
        if (!settled) {
          settled = true
          reject(new Error('Connection closed before handshake'))
        }
      })

      this.ws.on('error', (err) => {
        clearTimeout(connectTimeout)
        this.ws?.off('message', handshakeListener)
        if (!settled) {
          settled = true
          reject(err)
        }
        this.emit('error', err)
      })
    })
  }

  /**
   * 回复 connect 请求（在收到 connect.challenge 后调用）。
   * 参考 OpenClaw 协议的 ConnectParams 格式。
   */
  private async doHandshake(nonce?: string): Promise<void> {
    const resp = await this.request('connect', {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: 'openclaw-control-ui',
        version: '0.1.0',
        platform: process.platform,
        mode: 'ui',
      },
      role: 'operator',
      scopes: ['operator.admin', 'operator.read', 'operator.write', 'operator.approvals', 'operator.pairing'],
      caps: ['tool-events'],
      auth: { token: getAuthToken() },
    })

    if (!resp || resp.error) {
      throw new Error(`Handshake failed: ${JSON.stringify(resp)}`)
    }

    this.connected = true
    this.reconnectMs = 1000
    this.emit('connected')
  }

  private onDisconnected(): void {
    this.connected = false
    // reject all pending requests
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(new Error('Connection lost'))
    }
    this.pending.clear()
    this.emit('disconnected')
    this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    this.emit('reconnecting', this.reconnectMs)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect().catch(() => {})
    }, this.reconnectMs)
    this.reconnectMs = Math.min(this.reconnectMs * 2, this.maxReconnectMs)
  }

  request(method: string, params?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('RPC not connected'))
        return
      }

      const id = randomUUID()
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`RPC timeout: ${method}`))
      }, this.timeout)

      this.pending.set(id, { resolve, reject, timer })

      const frame = { type: 'req', id, method, params: params ?? {} }
      this.ws.send(JSON.stringify(frame))
    })
  }

  private handleMessage(raw: string): void {
    try {
      const msg = JSON.parse(raw)

      if (msg.type === 'res') {
        const pending = this.pending.get(msg.id)
        if (pending) {
          clearTimeout(pending.timer)
          this.pending.delete(msg.id)
          if (msg.ok) {
            pending.resolve(msg.payload)
          } else {
            pending.reject(new Error(msg.error?.message || 'RPC error'))
          }
        }
      } else if (msg.type === 'event') {
        this.emit('event', msg.event, msg.payload, msg.seq)
      }
    } catch {
      // ignore malformed messages
    }
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected
  }

  // === 常用 RPC 方法 ===

  async chatSend(sessionKey: string, message: string): Promise<{ runId: string }> {
    return this.request('chat.send', { sessionKey, message, idempotencyKey: randomUUID() })
  }

  async chatHistory(sessionKey: string): Promise<any[]> {
    return this.request('chat.history', { sessionKey })
  }

  async agentsList(): Promise<any[]> {
    return this.request('agents.list', {})
  }

  async chatAbort(sessionKey: string, runId?: string): Promise<{ ok: boolean; aborted: boolean }> {
    return this.request('chat.abort', { sessionKey, runId })
  }

  async sessionsPatch(sessionKey: string, patch: Record<string, any>): Promise<void> {
    await this.request('sessions.patch', { sessionKey, ...patch })
  }
}
