import { ChildProcess, spawn } from 'child_process'
import { EventEmitter } from 'events'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { app } from 'electron'
import { getVendorEntryPath, getNodeBin } from './vendor'
import { buildGatewayConfig, writeGatewayConfig, getConfigDir, type GatewayConfig } from './config-bridge'
import { injectToAuthProfiles, clearAuthProfiles, resolveSecretEnv, type ProviderKey } from './secret-injector'

export type GatewayState = 'stopped' | 'starting' | 'running' | 'error'

/**
 * GatewayLauncher：管理 OpenClaw Gateway 子进程生命周期。
 *
 * 参考 RivonClaw launcher.ts，简化：
 * - 指数退避重启（1000ms → 30000ms）
 * - 就绪检测（stdout "listening on"）
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
  private configPath = ''
  private currentConfig: GatewayConfig | null = null

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

      // 2. 生成并写入配置
      this.currentConfig = buildGatewayConfig(this.port)
      this.configPath = writeGatewayConfig(this.currentConfig)

      // 3. 构建环境变量
      const env: Record<string, string> = {
        ...process.env as Record<string, string>,
        ...resolveSecretEnv(),
        ELECTRON_RUN_AS_NODE: '1',
        OPENCLAW_CONFIG_PATH: this.configPath,
        OPENCLAW_STATE_DIR: stateDir,
        OPENCLAW_NO_RESPAWN: '1',
        OPENCLAW_SKIP_BROWSER_CONTROL_SERVER: '1',
        OPENCLAW_DISABLE_BONJOUR: '1',
      }

      // 4. 启动子进程（detached 创建新进程组，便于整棵进程树 kill）
      this.process = spawn(nodeBin, [entryPath, 'gateway'], {
        env,
        cwd: stateDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
      })

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
      if (line.includes('listening on') && this.state === 'starting') {
        this.setState('running')
        this.backoffMs = 1000
      }
      this.emit('stdout', line)
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
        spawn('taskkill', ['/T', '/F', '/PID', String(pid)])
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
