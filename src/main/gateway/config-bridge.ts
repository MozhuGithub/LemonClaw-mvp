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
    controlUi: { enabled: boolean; dangerouslyDisableDeviceAuth: boolean }
  }
  agents: {
    defaults: {
      model: { primary: string }
      workspace: string
    }
  }
  tools: {
    profile: string
    exec: { host: string; security: string; ask: string }
  }
  plugins: {
    allow: string[]
    load: { paths: string[] }
    deny: string[]
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
}): GatewayConfig {
  const stateDir = join(app.getPath('userData'), 'openclaw-state')
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true })
  }

  const extensionsDir = options?.extensionsDir || join(__dirname, '../../extensions')
  const skillsDir = options?.skillsDir || join(app.getPath('userData'), 'skills')

  return {
    gateway: {
      port,
      mode: 'local',
      auth: { mode: 'token', token: getAuthToken() },
      controlUi: { enabled: false, dangerouslyDisableDeviceAuth: true },
    },
    agents: {
      defaults: {
        model: { primary: options?.model || 'theta/glm-5.1' },
        workspace: options?.workspace || stateDir,
      },
    },
    tools: {
      profile: 'full',
      exec: { host: 'gateway', security: 'full', ask: 'off' },
    },
    plugins: {
      allow: ['lemonclaw-memory', 'lemonclaw-learning'],
      load: { paths: [extensionsDir] },
      deny: [],
    },
    skills: {
      load: { extraDirs: [skillsDir] },
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
  if (JSON.stringify(oldConfig.plugins) !== JSON.stringify(newConfig.plugins)) return 'restart_process'
  if (JSON.stringify(oldConfig.tools) !== JSON.stringify(newConfig.tools)) return 'reload_config'
  return 'none'
}
