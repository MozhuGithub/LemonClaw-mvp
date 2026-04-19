# HomiClaw 的 LLM 源码逻辑

---

## 1. 请求调用流程

```
用户请求
    ↓
runWithModelFallback(params)        [第 3334 行]
    ↓
resolveFallbackCandidates(params)   [第 3199 行]
    ↓
遍历候选模型列表
    ↓
runFallbackAttempt(candidate)       [尝试调用]
    ↓
成功 → 返回结果
失败 → 记录错误，尝试下一个候选
    ↓
全部失败 → 抛出 FailoverError
```

### 1.2 关键源码位置

| 函数名 | 位置 | 说明 |
|--------|------|------|
| `runWithModelFallback` | `openclaw-tools-Bj7HYlvK.js:3334` | 主调用函数 |
| `resolveFallbackCandidates` | `openclaw-tools-Bj7HYlvK.js:3199` | 解析候选列表 |
| `resolveAgentTimeoutMs` | `openclaw-tools-Bj7HYlvK.js:34911` | 超时控制 |
| `resolveAgentModelPrimaryValue` | `model-input-Daq4_3a5.js` | 解析主模型 |
| `resolveAgentModelFallbackValues` | `model-input-Daq4_3a5.js` | 解析 fallback 列表 |

---

## 2. 超时控制机制

### 2.1 超时解析函数

**位置**：`openclaw-tools-Bj7HYlvK.js:34911`

```javascript
function resolveAgentTimeoutMs(opts) {
    const minMs = Math.max(normalizeNumber$1(opts.minMs) ?? 1, 1);
    const clampTimeoutMs = (valueMs) => Math.min(Math.max(valueMs, minMs), MAX_SAFE_TIMEOUT_MS);
    
    // 从配置读取默认超时（秒转毫秒）
    const defaultMs = clampTimeoutMs(resolveAgentTimeoutSeconds(opts.cfg) * 1e3);
    
    const NO_TIMEOUT_MS = MAX_SAFE_TIMEOUT_MS;
    const overrideMs = normalizeNumber$1(opts.overrideMs);
    
    // 优先级：overrideMs > overrideSeconds > defaultMs
    if (overrideMs !== void 0) {
        if (overrideMs === 0) return NO_TIMEOUT_MS;  // 0 = 无超时
        if (overrideMs < 0) return defaultMs;        // 负数 = 用默认
        return clampTimeoutMs(overrideMs);
    }
    
    const overrideSeconds = normalizeNumber$1(opts.overrideSeconds);
    if (overrideSeconds !== void 0) {
        if (overrideSeconds === 0) return NO_TIMEOUT_MS;
        if (overrideSeconds < 0) return defaultMs;
        return clampTimeoutMs(overrideSeconds * 1e3);
    }
    
    return defaultMs;
}
```

### 2.2 超时优先级

```
1. overrideMs (直接传入的毫秒数)          ← 最高优先级
   ↓
2. overrideSeconds (直接传入的秒数)
   ↓
3. defaultMs (从配置读取)                ← 最低优先级
```

### 2.3 特殊值处理

| 值 | 含义 |
|----|------|
| `0` | 无超时 (`MAX_SAFE_TIMEOUT_MS`) |
| `< 0` | 使用配置默认值 |
| `> 0` | 使用指定值（会被 clamp 到安全范围） |

### 2.4 安全限制

- **最小值**：`minMs` (默认 1ms)
- **最大值**：`MAX_SAFE_TIMEOUT_MS` (安全超时上限)
- **单位**：毫秒

---

## 3. 模型 Fallback 机制

### 3.1 候选列表解析

**位置**：`openclaw-tools-Bj7HYlvK.js:3199`

```javascript
function resolveFallbackCandidates(params) {
    // 1. 从配置读取主模型
    const primary = params.cfg ? resolveConfiguredModelRef({
        cfg: params.cfg,
        defaultProvider: DEFAULT_PROVIDER,
        defaultModel: DEFAULT_MODEL
    }) : null;
    
    // 2. 构建候选列表收集器
    const { candidates, addExplicitCandidate } = createModelCandidateCollector(
        buildConfiguredAllowlistKeys({...})
    );
    
    // 3. 添加主模型
    addExplicitCandidate(normalizedPrimary);
    
    // 4. 从配置读取 fallbacks
    const modelFallbacks = (() => {
        if (params.fallbacksOverride !== void 0) 
            return params.fallbacksOverride;
        
        const configuredFallbacks = resolveAgentModelFallbackValues(
            params.cfg?.agents?.defaults?.model
        );
        return configuredFallbacks;
    })();
    
    // 5. 添加 fallbacks 到候选列表
    for (const raw of modelFallbacks) {
        const resolved = resolveModelRefFromString({
            raw: String(raw ?? ""),
            defaultProvider,
            aliasIndex
        });
        if (!resolved) continue;
        addExplicitCandidate(resolved.ref);
    }
    
    return candidates;  // 返回完整候选列表
}
```

### 3.2 候选列表构建

```javascript
// 候选列表 = [主模型，fallback1, fallback2, ...]
candidates = [
    { provider: 'antchat', model: 'Qwen3.5-397B-A17B' },
    { provider: 'antchat', model: 'Kimi-K2.5' },
    { provider: 'antchat', model: 'MiniMax-M2.5' },
    ...
]

### 3.3 Fallback 执行流程

```javascript
async function runWithModelFallback(params) {
    const candidates = resolveFallbackCandidates({...});
    const attempts = [];
    let lastError;
    const cooldownProbeUsedProviders = new Set();  // 冷却期保护
    
    for (let i = 0; i < candidates.length; i += 1) {
        const candidate = candidates[i];
        const isPrimary = (i === 0);
        
        // 检查是否在冷却期
        if (authStore && isProfileInCooldown(...)) {
            // 跳过或尝试探测
            continue;
        }
        
        // 尝试调用
        const attemptRun = await runFallbackAttempt({
            run: params.run,
            ...candidate,
            attempts
        });
        
        if ("success" in attemptRun) {
            // 成功！返回结果
            return attemptRun.success;
        }
        
        // 失败，记录错误
        lastError = attemptRun.error;
        attempts.push({...});
        
        // 继续尝试下一个候选
    }
    
    // 所有候选都失败
    throwFallbackFailureSummary({...});
}
```

### 3.4 Fallback 触发条件

以下错误会触发 fallback：

| 错误类型 | 是否触发 fallback |
|---------|------------------|
| **模型不存在** (404) | ✅ 是 |
| **API Key 无效** (401) | ❌ 否（同一 provider 的所有 profile 都在冷却期） |
| **速率限制** (429) | ⚠️ 部分触发（冷却期保护） |
| **超时** | ⚠️ 部分触发 |
| **上下文溢出** | ❌ 否（直接抛出，不 fallback） |
| **服务器错误** (5xx) | ✅ 是 |

---

## 4. 冷却期保护

### 4.1 冷却期机制

**位置**：`openclaw-tools-Bj7HYlvK.js:3334-3500`

```javascript
const cooldownProbeUsedProviders = new Set();  // 本次运行中已探测过的 provider

// 探测节流（防止频繁探测）
const lastProbeAttempt = new Map();
const MIN_PROBE_INTERVAL_MS = 30000;  // 30 秒
const PROBE_MARGIN_MS = 120000;       // 120 秒缓冲
```

### 4.2 冷却期决策逻辑

```javascript
const decision = resolveCooldownDecision({
    candidate,
    isPrimary,
    requestedModel,
    hasFallbackCandidates,
    now,
    probeThrottleKey,
    authStore,
    profileIds
});

if (decision.type === "skip") {
    // 冷却期内，跳过此候选
    continue;
}

if (shouldAllowCooldownProbeForReason(decision.reason)) {
    // 允许探测冷却期中的 provider
    runOptions = { allowTransientCooldownProbe: true };
}
```

### 4.3 冷却期保护策略

| 场景 | 策略 |
|------|------|
| **首次失败** | 允许立即重试（探测） |
| **同一 provider 再次失败** | 加入冷却期（30 秒内不重试） |
| **速率限制 (429)** | 冷却期 = `Retry-After` 头部的值 |
| **认证失败 (401)** | 整个 profile 进入冷却期 |
| **模型不存在 (404)** | 跳过此模型，尝试下一个 |

### 4.4 探测节流

```javascript
function isProbeThrottleOpen(now, throttleKey) {
    return now - (lastProbeAttempt.get(throttleKey) ?? 0) >= MIN_PROBE_INTERVAL_MS;
}

// throttleKey = "agentDir::provider"
// 例如："/Users/kangning/.homiclaw/agents/agent-1::antchat"
```

**作用**：防止在短时间内频繁探测同一个 provider

---

## 5. 配置文件结构

### 5.1 HomiClaw 配置示例

**位置**：`/Users/kangning/.homiclaw/homiclaw.json`

```json
{
  "models": {
    "mode": "merge",
    "providers": {
      "antchat": {
        "baseUrl": "https://antchat.alipay.com/v1",
        "apiKey": "enc:...",
        "api": "openai-completions",
        "headers": {
          "X-Mask-Content": "true"
        },
        "models": [
          {
            "id": "Qwen3.5-397B-A17B",
            "name": "Qwen3.5-397B-A17B",
            "reasoning": false,
            "input": ["text", "image"],
            "cost": {
              "input": 0,
              "output": 0,
              "cacheRead": 0,
              "cacheWrite": 0
            },
            "contextWindow": 192000,
            "maxTokens": 50000,
            "compat": {
              "supportsDeveloperRole": false
            }
          },
          {
            "id": "Kimi-K2.5",
            "name": "Kimi-K2.5",
            ...
          }
        ]
      }
    }
  },
  
  "agents": {
    "defaults": {
      "model": {
        "primary": "antchat/Qwen3.5-397B-A17B",
        "fallbacks": [
          "antchat/Kimi-K2.5",
          "antchat/MiniMax-M2.5"
        ]
      },
      "imageModel": {
        "primary": "antchat-vision/Qwen3.5-397B-A17B"
      }
    }
  }
}
```

### 5.2 配置字段详解

#### `models.providers`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `baseUrl` | string | ✅ | API 端点 |
| `apiKey` | string | ✅ | 加密的 API Key |
| `api` | string | ✅ | API 类型（如 `openai-completions`） |
| `headers` | object | ❌ | 自定义请求头 |
| `models` | array | ❌ | 支持的模型列表 |

#### `models.providers[].models[]`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 模型 ID |
| `name` | string | ✅ | 显示名称 |
| `reasoning` | boolean | ❌ | 是否推理模型 |
| `input` | array | ❌ | 支持的输入类型 |
| `cost` | object | ❌ | 计费信息 |
| `contextWindow` | number | ❌ | 上下文窗口 |
| `maxTokens` | number | ❌ | 最大输出 token 数 |

#### `agents.defaults.model`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `primary` | string | ✅ | 主模型（格式：`provider/model-id`） |
| `fallbacks` | array | ❌ | fallback 模型列表 |

### 5.3 模型引用格式

```
格式：{provider}/{model-id}

示例:
- antchat/Qwen3.5-397B-A17B
- anthropic/claude-sonnet-4-5
- openai/gpt-4o

---

## 6. 对 LemonClaw 的启示

### 6.1 推荐配置结构

```json
// lemonclaw.json
{
  "models": {
    "providers": {
      "antchat": {
        "baseUrl": "https://antchat.alipay.com/v1",
        "apiKey": "${ANTCHAT_API_KEY}",
        "api": "openai-completions"
      }
    }
  },
  
  "agents": {
    "defaults": {
      "model": {
        "primary": "antchat/Qwen3.5-397B-A17B",
        "fallbacks": [
          "antchat/Kimi-K2.5",
          "antchat/MiniMax-M2.5"
        ]
      },
      "timeout": 120  // 秒
    }
  },
  
  "timeout": {
    "default": 120,  // 默认 120 秒
    "max": 600,      // 最大 600 秒
    "min": 1         // 最小 1 秒
  },
  
  "fallback": {
    "enabled": true,
    "cooldownMs": 30000,      // 冷却期 30 秒
    "probeIntervalMs": 30000  // 探测间隔 30 秒
  }
}
```

### 6.2 核心代码复用建议

**可以直接复用的函数**：

| 函数 | 用途 | 建议 |
|------|------|------|
| `resolveAgentTimeoutMs` | 超时解析 | ✅ 直接复用 |
| `resolveAgentModelPrimaryValue` | 主模型解析 | ✅ 直接复用 |
| `resolveAgentModelFallbackValues` | fallback 解析 | ✅ 直接复用 |
| `runWithModelFallback` | fallback 执行 | ⚠️ 简化后复用 |
| `resolveFallbackCandidates` | 候选解析 | ⚠️ 简化后复用 |

### 6.3 可以简化的部分

| HomiClaw 功能 | LemonClaw 建议 |
|--------------|----------------|
| **冷却期保护** | ✅ 保留（30 秒） |
| **探测节流** | ✅ 保留（防止频繁重试） |
| **Profile 管理** | ❌ 简化（个人用户不需要多 profile） |
| **AuthStore** | ❌ 简化（用环境变量或配置文件） |
| **模型别名** | ⚠️ 可选（简单映射即可） |

### 6.4 超时配置建议

```yaml
# LemonClaw 超时配置
timeout:
  default: 120  # 默认 120 秒
  max: 600      # 最大 600 秒
  min: 1        # 最小 1 秒
  
# 优先级：函数参数 > 配置文件 > 默认值
# 特殊值：0 = 无超时，<0 = 用默认值
```

### 6.5 Fallback 配置建议

```yaml
# LemonClaw fallback 配置
fallback:
  enabled: true
  
  # 候选列表（按优先级排序）
  candidates:
    - antchat/Qwen3.5-397B-A17B  # 主模型
    - antchat/Kimi-K2.5          # fallback 1
    - antchat/MiniMax-M2.5       # fallback 2
  
  # 冷却期配置
  cooldown:
    enabled: true
    durationMs: 30000  # 30 秒
    probeIntervalMs: 30000  # 探测间隔
  
  # 触发 fallback 的错误类型
  retryableErrors:
    - model_not_found
    - rate_limited
    - server_error
    - timeout
  
  # 不触发 fallback 的错误类型
  nonRetryableErrors:
    - authentication_error  # 认证错误，需要换 Key
    - context_overflow      # 上下文溢出，需要截断
```

---

## 📊 总结表

| 配置项 | HomiClaw 实现 | LemonClaw 建议 |
|--------|--------------|----------------|
| **超时控制** | ✅ `resolveAgentTimeoutMs()` | ✅ 直接复用 |
| **主模型配置** | ✅ `agents.defaults.model.primary` | ✅ 直接复用 |
| **Fallback 列表** | ✅ `agents.defaults.model.fallbacks` | ✅ 直接复用 |
| **冷却期保护** | ✅ `cooldownProbeUsedProviders` | ✅ 简化后复用 |
| **探测节流** | ✅ `lastProbeAttempt` Map | ✅ 直接复用 |
| **Profile 管理** | ✅ 多 profile + Keychain | ❌ 简化为单 profile |
| **模型别名** | ✅ 复杂别名系统 | ⚠️ 简化为简单映射 |
| **日志记录** | ✅ 详细 fallback 日志 | ✅ 保留关键日志 |

---

**报告完成** - 基于源码深度分析 ✅
```
```
