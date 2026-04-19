import { join } from 'path'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { app } from 'electron'
import { randomBytes } from 'crypto'

/**
 * Config Bridge：将 LemonClaw 配置翻译为 OpenClaw 的 openclaw.json。
 *
 * 参考 RivonClaw config-writer.ts，匹配 OpenClaw 配置格式：
 * - gateway: port + token 认证 + 关闭 controlUi
 * - agents: 默认模型 + workspace
 * - tools: 基础工具集
 * - plugins: 允许 LemonClaw extensions
 * - session: 空闲重置策略
 * - discovery: 关闭 mDNS（桌面应用自行管理）
 */

export interface GatewayConfig {
  gateway: {
    port: number
    mode: string
    auth: { mode: string; token: string }
    controlUi?: { enabled: boolean; dangerouslyDisableDeviceAuth: boolean }
  }
  auth?: {
    profiles: Record<string, { provider: string; mode: string }>
  }
  agents: {
    defaults: {
      model: { primary: string; fallbacks?: string[] }
      workspace: string
    }
  }
  models?: {
    mode: string
    providers: Record<string, {
      baseUrl: string
      api?: string
      apiKey?: string
      models: Array<{
        id: string
        name: string
        reasoning: boolean
        input: string[]
        cost: { input: number; output: number; cacheRead: number; cacheWrite: number }
        contextWindow: number
        maxTokens: number
      }>
    }>
  }
  tools: {
    profile: string
    exec: { host: string; security: string; ask: string }
  }
  plugins: {
    entries: Record<string, { enabled: boolean }>
    load: { paths: string[] }
  }
  skills: {
    load: { extraDirs: string[] }
  }
  session: {
    reset: { mode: string; idleMinutes: number }
  }
  discovery: {
    mdns: { mode: string }
  }
}

let configDir = ''
let authToken = ''

export function getConfigDir(): string {
  if (!configDir) {
    configDir = join(app.getPath('userData'), 'gateway')
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true })
    }
  }
  return configDir
}

export function getAuthToken(): string {
  if (!authToken) {
    const tokenFile = join(getConfigDir(), '.auth-token')
    if (existsSync(tokenFile)) {
      authToken = readFileSync(tokenFile, 'utf-8').trim()
    } else {
      authToken = randomBytes(32).toString('hex')
      writeFileSync(tokenFile, authToken, { mode: 0o600 })
    }
  }
  return authToken
}

export function buildGatewayConfig(port: number, options?: {
  model?: string
  workspace?: string
  extensionsDir?: string
  skillsDir?: string
  apiKey?: string
}): GatewayConfig {
  const stateDir = join(app.getPath('userData'), 'openclaw-state')
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true })
  }

  const extensionsDir = options?.extensionsDir || join(__dirname, '../../extensions')
  const skillsDir = options?.skillsDir || join(app.getPath('userData'), 'skills')

  const pluginPaths = existsSync(extensionsDir) ? [extensionsDir] : []
  const skillDirs = existsSync(skillsDir) ? [skillsDir] : []

  const apiKey = options?.apiKey || ''
  const pluginEntries: Record<string, { enabled: boolean }> = {}
  // 禁用不需要的 bundled 插件，保留 acpx（RPC 握手依赖）
  for (const id of ['browser', 'device-pair', 'phone-control', 'talk-voice']) {
    pluginEntries[id] = { enabled: false }
  }

  return {
    gateway: {
      port,
      mode: 'local',
      auth: { mode: 'token', token: getAuthToken() },
      controlUi: { enabled: false, dangerouslyDisableDeviceAuth: true },
    },
    auth: {
      profiles: {
        'minimax-portal:default': { provider: 'minimax-portal', mode: 'api_key' },
      },
    },
    agents: {
      defaults: {
        model: { primary: options?.model || 'minimax-portal/MiniMax-M2.7-HighSpeed' },
        workspace: options?.workspace || stateDir,
      },
    },
    models: {
      mode: 'merge',
      providers: {
        'minimax-portal': {
          baseUrl: 'https://api.minimaxi.com/anthropic',
          apiKey,
          api: 'anthropic-messages',
          models: [
            {
              id: 'MiniMax-M2.7-HighSpeed',
              name: 'MiniMax M2.7 HighSpeed',
              reasoning: true,
              input: ['text'],
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              contextWindow: 200000,
              maxTokens: 8192,
            },
          ],
        },
      },
    },
    tools: {
      profile: 'full',
      exec: { host: 'gateway', security: 'full', ask: 'off' },
    },
    plugins: {
      entries: pluginEntries,
      load: { paths: pluginPaths },
    },
    skills: {
      load: { extraDirs: skillDirs },
    },
    session: {
      reset: { mode: 'idle', idleMinutes: 10080 },
    },
    discovery: {
      mdns: { mode: 'off' },
    },
  }
}

export function writeGatewayConfig(config: GatewayConfig): string {
  const configPath = join(getConfigDir(), 'openclaw.json')
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
  return configPath
}

export type ChangePolicy = 'none' | 'reload_config' | 'restart_process'

export function getChangePolicy(oldConfig: GatewayConfig, newConfig: GatewayConfig): ChangePolicy {
  if (oldConfig.gateway.port !== newConfig.gateway.port) return 'restart_process'
  if (oldConfig.agents.defaults.model.primary !== newConfig.agents.defaults.model.primary) return 'reload_config'
  if (JSON.stringify(oldConfig.plugins?.entries) !== JSON.stringify(newConfig.plugins?.entries)) return 'restart_process'
  if (JSON.stringify(oldConfig.tools) !== JSON.stringify(newConfig.tools)) return 'reload_config'
  return 'none'
}
