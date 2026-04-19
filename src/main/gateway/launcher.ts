import { ChildProcess, spawn } from 'child_process'
import { EventEmitter } from 'events'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'fs'
import { app } from 'electron'
import WebSocket from 'ws'
import { getVendorEntryPath, getNodeBin, getVendorVersion, getVendorDirPath } from './vendor'
import { getAuthToken, getConfigDir } from './config-bridge'
import { injectToAuthProfiles, clearAuthProfiles, resolveSecretEnv, type ProviderKey } from './secret-injector'

export type GatewayState = 'stopped' | 'starting' | 'running' | 'error'

/**
 * GatewayLauncher：管理 OpenClaw Gateway 子进程生命周期。
 *
 * 参考 RivonClaw launcher.ts 优化：
 * - V8 编译缓存预热（NODE_COMPILE_CACHE）
 * - 多阶段就绪检测（stdout → WebSocket probe → sidecar probe）
 * - 指数退避重启（1000ms → 30000ms）
 * - Windows 兼容（taskkill 进程树）
 * - SIGUSR1 优雅重载（仅 Unix）
 */
export class GatewayLauncher extends EventEmitter {
  private process: ChildProcess | null = null
  private state: GatewayState = 'stopped'
  private backoffMs = 1000
  private readonly maxBackoffMs = 30000
  private readonly healthyThresholdMs = 60000
  private startTime = 0
  private restartTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private port: number = 3212,
    private providerKeys: ProviderKey[] = [],
  ) {
    super()
  }

  setProviderKeys(keys: ProviderKey[]): void {
    this.providerKeys = keys
  }

  async start(): Promise<void> {
    if (this.process) {
      throw new Error('Gateway already running')
    }

    this.setState('starting')

    try {
      const entryPath = getVendorEntryPath()
      const nodeBin = getNodeBin()
      const stateDir = join(app.getPath('userData'), 'openclaw-state')
      if (!existsSync(stateDir)) {
        mkdirSync(stateDir, { recursive: true })
      }

      // 1. 注入 API Key
      if (this.providerKeys.length > 0) {
        injectToAuthProfiles(this.providerKeys)
      }

      // 2. 设置 V8 编译缓存（参考 RivonClaw）
      const compileCacheDir = join(stateDir, 'compile-cache')
      if (!existsSync(compileCacheDir)) {
        mkdirSync(compileCacheDir, { recursive: true })
      }
      // 从 vendor 的预编译缓存复制到用户可写目录（首次或版本更新时）
      const vendorDir = getVendorDirPath()
      const vendorCompileCache = join(vendorDir, 'dist', 'compile-cache')
      const versionMarker = join(compileCacheDir, '.version')
      const currentVersion = getVendorVersion()
      if (existsSync(vendorCompileCache)) {
        try {
          const prevVersion = existsSync(versionMarker) ? readFileSync(versionMarker, 'utf-8') : ''
          if (prevVersion !== currentVersion) {
            copyFileSync(join(vendorCompileCache, 'data.mjs'), join(compileCacheDir, 'data.mjs'))
            writeFileSync(versionMarker, currentVersion, 'utf-8')
          }
        } catch { /* 忽略缓存复制失败 */ }
      }

      // 3. 构建环境变量
      const configDir = getConfigDir()
      const env: Record<string, string> = {
        ...process.env as Record<string, string>,
        ...resolveSecretEnv(),
        OPENCLAW_STATE_DIR: stateDir,
        OPENCLAW_CONFIG_PATH: join(configDir, 'openclaw.json'),
        OPENCLAW_BUNDLED_VERSION: getVendorVersion(),
        OPENCLAW_NO_RESPAWN: '1',
        OPENCLAW_SKIP_BROWSER_CONTROL_SERVER: '1',
        OPENCLAW_DISABLE_BONJOUR: '1',
        OPENCLAW_SKIP_CHANNELS: '1',
        NODE_COMPILE_CACHE: compileCacheDir,
      }

      // 4. 启动子进程（CLI 参数传 port 和 token，不依赖 config 文件）
      const authToken = getAuthToken()
      this.process = spawn(nodeBin, [entryPath, 'gateway', '--port', String(this.port), '--token', authToken], {
        env,
        cwd: stateDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
        windowsHide: true,
      })
      this.process.unref() // 参考 RivonClaw：断开引用，不阻塞父进程

      this.startTime = Date.now()
      this.setupProcessHandlers()
      this.emit('started', this.process.pid)
    } catch (err) {
      this.setState('error')
      throw err
    }
  }

  private setupProcessHandlers(): void {
    if (!this.process) return

    this.process.stdout?.on('data', (data: Buffer) => {
      const line = data.toString().trim()
      this.emit('stdout', line)
      // 当 acpx runtime backend ready 后，直接标记 running
      if (line.includes('embedded acpx runtime backend ready') && this.state === 'starting') {
        this.setState('running')
        this.backoffMs = 1000
      }
    })

    this.process.stderr?.on('data', (data: Buffer) => {
      this.emit('stderr', data.toString().trim())
    })

    this.process.on('exit', (code, signal) => {
      this.process = null
      this.emit('stopped', code, signal)

      if (this.state !== 'stopped') {
        this.handleCrash()
      }
    })

    this.process.on('error', (err) => {
      this.setState('error')
      this.emit('error', err)
    })
  }

  /**
   * 多阶段就绪探测（参考 RivonClaw）：
   * 1. WebSocket 握手成功
   * 2. chat.history RPC 返回确认 sidecar 可用
   */
  private async probeSidecar(): Promise<void> {
    const maxAttempts = 20
    const intervalMs = 500
    const timeoutMs = 5000

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const ws = new WebSocket(`ws://127.0.0.1:${this.port}`)
        const connected = await new Promise<boolean>((resolve) => {
          const timer = setTimeout(() => { ws.close(); resolve(false) }, 2000)
          ws.on('open', () => { clearTimeout(timer); resolve(true) })
          ws.on('error', () => { clearTimeout(timer); resolve(false) })
        })
        ws.close()

        if (!connected) {
          await this.sleep(intervalMs)
          continue
        }

        // WebSocket 可用，发起 chat.history RPC 探测 sidecar
        const result = await this.probeChatHistory(timeoutMs)
        if (result) {
          this.setState('running')
          this.backoffMs = 1000
          this.emit('ready')
          return
        }
      } catch { /* ignore */ }
      await this.sleep(intervalMs)
    }

    // probe 失败，但 Gateway 进程在运行，标记为 running（避免无限等待）
    console.warn('[gateway] sidecar probe failed after', maxAttempts, 'attempts, assuming ready')
    this.setState('running')
    this.backoffMs = 1000
  }

  private probeChatHistory(timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${this.port}`, {
        headers: { origin: `http://127.0.0.1:${this.port}` },
      })
      let settled = false

      const cleanup = () => { if (!settled) { settled = true; ws.close() } }
      const settle = (val: boolean) => { if (!settled) { settled = true; cleanup(); resolve(val) } }

      const handshakeListener = (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString())
          if (msg.type === 'event' && msg.event === 'connect.challenge') {
            ws.send(JSON.stringify({
              type: 'req', id: 'probe', method: 'connect',
              params: {
                minProtocol: 3, maxProtocol: 3,
                client: { id: 'probe', version: '0.1.0', platform: process.platform, mode: 'webchat' },
                role: 'operator', scopes: ['operator.admin'],
                auth: { token: getAuthToken() },
              },
            }))
          }
        } catch { /* ignore */ }
      }

      const messageListener = (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString())
          if (msg.type === 'res' && msg.id === 'probe') {
            if (msg.ok) {
              ws.send(JSON.stringify({
                type: 'req', id: 'history-probe', method: 'chat.history',
                params: { sessionKey: 'main' },
              }))
            } else {
              settle(false)
            }
          } else if (msg.type === 'res' && msg.id === 'history-probe') {
            settle(true)
          }
        } catch { /* ignore */ }
      }

      ws.on('message', handshakeListener)
      ws.on('message', messageListener)
      ws.on('close', () => settle(false))
      ws.on('error', () => settle(false))

      setTimeout(() => settle(false), timeoutMs)
    })
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private handleCrash(): void {
    const uptime = Date.now() - this.startTime
    if (uptime >= this.healthyThresholdMs) {
      this.backoffMs = 1000
    }

    this.emit('restarting', this.backoffMs)
    this.restartTimer = setTimeout(() => {
      this.start().catch(err => this.emit('error', err))
    }, this.backoffMs)

    this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs)
  }

  async stop(): Promise<void> {
    this.setState('stopped')
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
    if (!this.process) return

    const pid = this.process.pid
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/T', '/F', '/PID', String(pid)], { windowsHide: true })
      } else {
        // 向进程组发送 SIGTERM（detached 模式下 -pid 表示整个进程组）
        try { process.kill(-pid!, 'SIGTERM') } catch { /* 已退出 */ }
      }
    } catch {
      // 进程可能已退出
    }
    this.process = null
    clearAuthProfiles()
  }

  async restart(): Promise<void> {
    await this.stop()
    await this.start()
  }

  async reload(): Promise<void> {
    if (!this.process) throw new Error('Gateway not running')
    if (process.platform === 'win32') {
      await this.restart()
    } else {
      this.process.kill('SIGUSR1')
    }
  }

  getState(): GatewayState {
    return this.state
  }

  getPort(): number {
    return this.port
  }

  private setState(state: GatewayState): void {
    this.state = state
    this.emit('stateChange', state)
  }
}
