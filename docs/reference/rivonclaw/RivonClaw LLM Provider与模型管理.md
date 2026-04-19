# RivonClaw LLM Provider 与模型管理

> 详细记录 RivonClaw 的多 Provider 支持、模型切换、代理路由、auth-profiles 机制
> **来源**：RivonClaw 源码深度分析
> **面向项目**：LemonClaw（参考）
> **日期**：2026-04-19

---

## 一、Provider 注册与元数据

### 1.1 支持的 Provider（30+）

**Root Providers**：`openai`、`anthropic`、`google`、`deepseek`、`zhipu`、`zai`、`moonshot`、`kimi`、`qwen`、`groq`、`mistral`、`xai`、`openrouter`、`minimax`、`minimax-cn`、`venice`、`xiaomi`、`volcengine`、`nvidia`、`amazon-bedrock`、`ollama`

**订阅计划**（嵌套在父 provider 下）：`openai-codex`、`claude`、`gemini`、`zhipu-coding`、`moonshot-coding`、`qwen-coding`、`modelscope`、`minimax-coding`、`volcengine-coding`、`nvidia-nim`

### 1.2 ProviderMeta 结构

```typescript
interface ProviderMeta {
  label: string                    // 显示名称
  baseUrl: string                  // OpenAI 兼容 API base URL
  url?: string                     // 信息链接
  apiKeyUrl?: string               // API key 获取链接
  envVar?: string                  // 环境变量名
  extraModels?: string[]           // 不在 vendor catalog 中的模型
  fallbackModels?: string[]        // 回退模型列表
  preferredModel?: string          // 默认模型
  api?: "openai-completions" | "anthropic-messages" | "openai-codex-responses"
  validationModel?: string         // 用于 key 验证的轻量模型
  subscriptionPlans?: Record<string, { baseUrl: string; models: string[] }>
}
```

### 1.3 区域感知默认值

```typescript
const REGION_DEFAULTS = {
  us:   { provider: "openai", modelId: "gpt-4o" },
  eu:   { provider: "openai", modelId: "gpt-4o" },
  cn:   { provider: "deepseek", modelId: "deepseek-chat" },  // 中国区默认 DeepSeek
}
```

---

## 二、模型切换机制

### 2.1 模型解析优先级（三层链）

```
Layer 1: Session 级别覆盖（sessionOverrides map，volatile）
    ↓ 如果未设置
Layer 2: Scope 级别覆盖（per-shop CS model from entity cache）
    ↓ 如果未设置
Layer 3: 全局默认（activeKeyId → ProviderKeyEntry）
    ↓ 如果解析的模型在 catalog 中不可用
    ↓ 降级到下一层
```

### 2.2 Per-Session 模型切换

```typescript
switchModelForSession(sessionKey, provider, modelId) {
  // 1. 存储到 volatile sessionOverrides map
  sessionOverrides.set(sessionKey, { provider, modelId })

  // 2. 调用 sessions.patch RPC
  await rpc.request("sessions.patch", {
    key: sessionKey,
    model: `${provider}/${modelId}`
  })
}
```

**关键**：不改变全局默认，不影响其他 session，不重启 gateway。

### 2.3 全局默认模型切换

```typescript
switchModel(keyId, modelId) {
  // 1. 更新 SQLite
  storage.providerKeys.update(keyId, { model: modelId })

  // 2. 更新 MST state
  root.upsertProviderKey(snapshot)

  // 3. 如果该 key 是全局默认：
  //    - 写入 OpenClaw config（chokidar 热重载，无重启）
  //    - 重置使用默认的 active sessions
}
```

### 2.4 sessions.patch 机制

所有模型切换都通过 `sessions.patch` RPC，不需要重启 gateway。

```typescript
await rpc.request("sessions.patch", {
  key: sessionKey,
  model: "provider/modelId"  // null = 跟随全局默认
})
```

---

## 三、LLMProviderManager（Desktop）

**文件**：`apps/desktop/src/providers/llm-provider-manager.ts`

Desktop 端的 MST action model，管理所有 LLM provider key 和模型操作。

### 3.1 关键 actions

| Action | 职责 |
|--------|------|
| `createKey(data)` | 创建 key：SQLite 插入 + Keychain 存储 + auth-profiles 同步 + MST 更新 |
| `activateProvider(keyId)` | 设为全局默认：SQLite 更新 + Keychain 同步 + auth-profiles + config 写入 |
| `deleteKey(id)` | 删除：SQLite 删除 + Keychain 清理 + 自动晋升下一个可用 key |
| `updateKey(id, data)` | 更新字段：解析 proxy URL + 更新 SQLite + 同步 auth-profiles |
| `switchModelForSession(session, provider, model)` | Session 级别切换（volatile） |
| `switchModel(keyId, model)` | 全局默认切换（持久化） |
| `syncCloud(user)` | 同步云端 provider key（RivonClaw Pro） |

---

## 四、auth-profiles 机制

### 4.1 文件位置

`{stateDir}/agents/main/agent/auth-profiles.json`

### 4.2 格式

```typescript
interface AuthProfileStore {
  version: number
  profiles: Record<string, ApiKeyProfile | OAuthProfile>
  order?: Record<string, string[]>  // provider → 排序 profile IDs
}
```

### 4.3 生命周期

```
启动时
  → syncAllAuthProfiles()
  → 遍历 storage 中所有 provider keys
  → 从 Keychain 获取密钥
  → 按 gateway provider 分组
  → 写入 auth-profiles.json

运行时（Gateway）
  → 每次 LLM 调用读取 auth-profiles.json
  → 查找 provider 对应的 key
  → 发起 API 请求
  → 无需重启

关闭时
  → syncBackOAuthCredentials()（OAuth token 可能已刷新）
  → clearAllAuthProfiles()（清空敏感数据）
```

### 4.4 Provider Key → auth-profiles 映射

```typescript
// auth-profiles 中的 provider 名
"anthropic:active"        → type: "api_key", provider: "anthropic"
"google-gemini-cli:user@gmail.com" → type: "oauth"
"minimax:active"          → type: "api_key", provider: "minimax"
```

---

## 五、代理路由（Proxy Router）

### 5.1 为什么需要

中国用户 GFW 场景：
- 国内 provider（deepseek、zhipu、qwen 等）→ 直连，无需代理
- 国际 provider（openai、anthropic、google）→ 需要走代理

### 5.2 代理路由架构

```
LLM 请求（通过 proxy router）
  → 解析 CONNECT host:port
  → 查找 domainToProvider 映射（api.openai.com → openai）
  → 查找该 provider 的 active key
  → 查找该 key 的 per-key proxy URL
  → 路由：通过 per-key proxy 或直连
```

### 5.3 ProxyRouterConfig

```typescript
interface ProxyRouterConfig {
  ts: number
  domainToProvider: Record<string, string>     // domain → provider
  activeKeys: Record<string, string>           // provider → active key ID
  keyProxies: Record<string, string | null>   // key ID → proxy URL 或 null（直连）
  systemProxy?: string | null                  // 系统级代理
}
```

### 5.4 配置热重载

Proxy router config 文件通过 `fs.watch()` 监听变更，自动重新加载。

---

## 六、Key 生命周期

### 6.1 创建流程

```
1. Panel → POST /api/provider-keys
2. Desktop handler → llmManager.createKey(data)
3. SQLite: ProviderKeysRepository.create()
4. Keychain: secretStore.set("provider-key-{id}", apiKey)
5. Proxy credentials (if any): secretStore.set("proxy-auth-{id}", credentials)
6. Canonical secret: syncActiveKey() → {provider}-api-key
7. Auth profiles: syncAllAuthProfiles()
8. Proxy config: writeProxyRouterConfig()
9. MST: root.upsertProviderKey(snapshot)
10. SSE: MST patch → Panel → 自动重渲染
```

### 6.2 Key 验证

- **内置 provider**：调用轻量 API（minimal chat completion 或 `/models`）
- **Anthropic API**：用 Messages API + `anthropic-version` header，支持 `x-api-key` 和 OAuth Bearer token
- **OAuth-only**（gemini）：跳过 API key 验证
- **Amazon Bedrock**：跳过验证（AWS Sig v4）
- **Custom provider**：按用户指定的协议验证

所有验证通过 proxy router 或 per-key proxy 路由。

---

## 七、对 LemonClaw 的参考价值

| 方面 | RivonClaw 做法 | LemonClaw 启示 |
|------|--------------|--------------|
| 多 Provider | ProviderMeta 集中定义 | LemonClaw 当前仅 minimax，可扩展 |
| 模型切换 | sessions.patch RPC（无重启） | LemonClaw 已实现 |
| 密钥存储 | Keychain/DPAPI | LemonClaw 可参考 DPAPI |
| Auth profiles | auth-profiles.json | LemonClaw 已实现（来源不同） |
| 代理路由 | 本地 proxy router | 可选，国内暂不需要 |
| Provider resolution | 三层链（session → scope → global） | 可参考此模式 |

---

## 八、关键文件索引

| 组件 | 文件路径 |
|------|---------|
| Provider 元数据 | `packages/core/src/models.ts` |
| Provider key 类型 | `packages/core/src/types/provider-key.ts` |
| LLMProviderManager | `apps/desktop/src/providers/llm-provider-manager.ts` |
| Key 验证 | `apps/desktop/src/providers/provider-validator.ts` |
| Cloud provider 同步 | `apps/desktop/src/providers/cloud-provider-sync.ts` |
| Proxy manager | `apps/desktop/src/infra/proxy/proxy-manager.ts` |
| Proxy router | `packages/proxy-router/src/index.ts` |
| LLMProviderModel (Panel) | `apps/panel/src/store/models/LLMProviderModel.ts` |
| Panel entity-store | `apps/panel/src/store/entity-store.ts` |
| Auth profile writer | `packages/gateway/src/auth-profile-writer.ts` |
| Model catalog | `packages/gateway/src/model-catalog.ts` |
| SQLite repo | `packages/storage/src/repo-provider-keys.ts` |
| Secrets factory | `packages/secrets/src/factory.ts` |
