import { join } from 'path'
import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { app } from 'electron'

/**
 * Secret Injector：API Key 注入。
 *
 * 参考 RivonClaw auth-profile-writer.ts，匹配 OpenClaw auth-profiles.json 格式：
 * - LLM API Key → auth-profiles.json（Gateway 每次请求时读取，无需重启）
 * - 非 LLM Key → 环境变量（spawn 时注入，MVP 阶段预留）
 *
 * OpenClaw 期望的 auth-profiles.json 格式：
 * { version: 1, profiles: { "<id>": { type, provider, key } }, order: { "<provider>": ["<id>"] } }
 */

export interface ProviderKey {
  id: string
  provider: string
  apiKey: string
  model?: string
  baseUrl?: string
}

interface AuthProfile {
  type: 'api_key'
  provider: string
  key: string
}

interface AuthProfilesStore {
  version: number
  profiles: Record<string, AuthProfile>
  order: Record<string, string[]>
}

function getAuthProfilesPath(): string {
  const dir = join(app.getPath('userData'), 'openclaw-state', 'agents', 'main', 'agent')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return join(dir, 'auth-profiles.json')
}

function readExisting(): AuthProfilesStore {
  const filePath = getAuthProfilesPath()
  if (existsSync(filePath)) {
    try {
      const store = JSON.parse(readFileSync(filePath, 'utf-8'))
      // 确保 order 字段存在（旧版本 auth-profiles.json 可能缺少此字段）
      if (!store.order) store.order = {}
      return store
    } catch {
      // 文件损坏，重新创建
    }
  }
  return { version: 1, profiles: {}, order: {} }
}

export function injectToAuthProfiles(keys: ProviderKey[]): void {
  const store = readExisting()

  for (const key of keys) {
    const gatewayProvider = key.provider === 'minimax' ? 'minimax-portal' : key.provider
    const profileId = `${gatewayProvider}:${key.id}`
    store.profiles[profileId] = {
      type: 'api_key',
      provider: gatewayProvider,
      key: key.apiKey,
    }
    // 更新 order
    if (!store.order[gatewayProvider]) {
      store.order[gatewayProvider] = []
    }
    if (!store.order[gatewayProvider].includes(profileId)) {
      store.order[gatewayProvider].push(profileId)
    }
  }

  writeFileSync(getAuthProfilesPath(), JSON.stringify(store, null, 2), { mode: 0o600 })
}

export function clearAuthProfiles(): void {
  const filePath = getAuthProfilesPath()
  if (existsSync(filePath)) {
    unlinkSync(filePath)
  }
}

/** 非 LLM Key 注入为环境变量（MVP 阶段预留，暂不使用） */
export function resolveSecretEnv(): Record<string, string> {
  return {}
}
