# OpenClaw 深度调研报告

> 基于源码深度分析的项目调研
> **来源**：OpenClaw 源码分析
> **面向项目**：LemonClaw（参考）
> **日期**：2026-04-19

---

## 一、项目概述

### 1.1 项目定位

OpenClaw 是一个**本地优先（local-first）的个人 AI 助手平台**，运行在用户自己的设备上。它通过用户已使用的消息渠道（WhatsApp、Telegram、Discord、Slack 等）进行响应，支持 macOS/iOS/Android 的语音交互，并提供实时 Canvas 控制能力。

> **核心定位**：`The Gateway is just the control plane - the product is the assistant`

### 1.2 核心功能

| 功能 | 说明 |
|------|------|
| **多渠道 inbox** | 支持 24+ 消息渠道（WhatsApp、Telegram、Slack、Discord、Google Chat、Signal、iMessage、IRC、Microsoft Teams、Matrix、Feishu、LINE、Mattermost、Nextcloud Talk、Nostr、Synology Chat、Tlon、Twitch、Zalo、WeChat、QQ、WebChat 等）|
| **多代理路由** | 将入站渠道/账户/对等端路由到隔离的代理（workspace + per-agent sessions）|
| **语音唤醒 + 语音模式** | macOS/iOS 上的唤醒词和 Android 上的连续语音（ElevenLabs + 系统 TTS 回退）|
| **实时 Canvas** | 代理驱动的可视化工作区 |
| **一流工具** | 浏览器、canvas、节点、crontab、sessions 和 Discord/Slack 操作 |
| **配套应用** | macOS 菜单栏应用 + iOS/Android 节点 |

### 1.3 技术栈

- **运行时**：Node.js 22+（推荐 Node.js 24）
- **语言**：TypeScript（ESM），严格类型检查
- **包管理**：pnpm 10.32.1
- **测试**：Vitest + V8 coverage thresholds（70%）
- **CLI**：commander + @clack/prompts
- **构建**：tsdown
- **AI SDK**：@mariozechner/pi-agent-core, @mariozechner/pi-ai, @mariozechner/pi-coding-agent

---

## 二、整体架构

### 2.1 Monorepo 结构

```
openclaw/
├── src/                    # 核心源码
│   ├── acp/               # ACP (Agent Communication Protocol) 控制面和运行时
│   ├── agents/            # Agent 运行时、会话管理、工具
│   ├── auto-reply/        # 自动回复引擎
│   ├── channels/          # 渠道抽象层
│   ├── cli/               # CLI 命令和依赖注入
│   ├── commands/          # 命令实现
│   ├── config/            # 配置管理
│   ├── gateway/           # Gateway 服务器核心
│   ├── plugins/          # 插件系统核心
│   └── ...
├── packages/              # 包目录
│   ├── memory-host-sdk/   # 记忆主机 SDK
│   ├── plugin-package-contract/  # 插件包契约
│   └── plugin-sdk/       # Plugin SDK 公共接口
├── extensions/            # 扩展/插件实现（50+ 个）
│   ├── acpx/             # ACP 路由扩展
│   ├── active-memory/     # 主动记忆
│   ├── alibaba/          # 阿里云
│   ├── anthropic/        # Anthropic provider
│   ├── browser/          # 浏览器扩展
│   ├── discord/          # Discord 渠道
│   ├── telegram/         # Telegram 渠道
│   └── ...
├── apps/                 # 平台应用
│   ├── android/          # Android 应用
│   ├── ios/              # iOS 应用
│   ├── macos/            # macOS 应用
│   └── shared/           # 共享代码
├── docs/                 # 文档
├── test/                 # 测试
└── ui/                   # 控制 UI
```

### 2.2 核心架构原则

1. **Manifest-first 控制面**：发现、验证、启用、设置提示和激活规划默认保持为元数据驱动
2. **运行时执行分离**：实际 provider/channel/tool 执行通过针对性加载器解析，而非广泛注册表实例化
3. **Host 加载插件，插件不加载 host 内部**：通过小的版本化 host/kernel 接缝和文档化 SDK 入口点实现
4. **插件边界**：扩展必须仅通过 `openclaw/plugin-sdk/*`、manifest 元数据和文档化运行时助手跨越到 core

---

## 三、Gateway 机制

### 3.1 Gateway 启动流程

Gateway 是 OpenClaw 的核心控制面，负责管理会话、渠道、工具和事件。

**启动入口**：`src/gateway/server.impl.ts` 中的 `startGatewayServer()` 函数

核心启动步骤：

```typescript
// 1. 配置加载和验证
const configSnapshot = await loadGatewayStartupConfigSnapshot({ minimalTestGateway, log });

// 2. 认证引导
const authBootstrap = await prepareGatewayStartupConfig({
  configSnapshot,
  authOverride: opts.auth,
  tailscaleOverride: opts.tailscale,
  activateRuntimeSecrets,
});

// 3. 插件引导准备
const pluginBootstrap = await prepareGatewayPluginBootstrap({
  cfgAtStart,
  startupRuntimeConfig,
});

// 4. 创建通道管理器
const channelManager = await createChannelManager();

// 5. 启动运行时服务
await startGatewayRuntimeServices();

// 6. WebSocket 处理器挂载
await attachGatewayWsHandlers();

// 7. HTTP 端点启动
```

### 3.2 会话管理架构

**关键文件**：`src/auto-reply/reply/session.ts`

会话存储路径：`~/.openclaw/agents/<agentId>/sessions/`

**会话生命周期管理**：
- 活跃会话跟踪
- 过期/空闲会话处理
- 每日重置策略
- 状态持久化

### 3.3 Gateway Server 核心组件

```typescript
// 通道管理器
const channelManager = createChannelManager();

// WebSocket 处理
attachGatewayWsHandlers();

// HTTP 服务
createChannelManager();

// 认证
resolveGatewayAuth();

// 定时任务
buildGatewayCronService();

// 配置重载
startManagedGatewayConfigReloader();

// 健康检查
refreshGatewayHealthSnapshot();
```

---

## 四、Plugin SDK

### 4.1 SDK 结构概览

Plugin SDK 是扩展与核心之间的公共契约，定义在 `packages/plugin-sdk/src/` 和 `src/plugin-sdk/` 中。

### 4.2 插件定义

**插件必须导出**：
- `id`: 插件唯一标识符
- `name`: 插件名称
- `version`: 版本
- `kind`: 类型（provider | channel | tool | hook）
- 配置模式和默认值

### 4.3 工具注册

```typescript
export type OpenClawPluginToolFactory = (
  context: OpenClawPluginToolContext,
  options?: OpenClawPluginToolOptions,
) => MaybePromise<AnyAgentTool | OpenClawPluginToolFactory[]>;
```

### 4.4 Hook 系统

| Hook | 时机 | 用途 |
|------|------|------|
| `before_agent_start` | Agent 启动前 | 注入系统提示、上下文 |
| `before_tool_call` | 工具调用前 | 权限检查、参数验证 |
| `after_tool_call` | 工具调用后 | 结果处理、经验收集 |
| `before_prompt_build` | Prompt 构建前 | 修改用户消息、添加上下文 |
| `session_compact_before` | Session 压缩前 | 准备压缩上下文 |
| `session_compact_after` | Session 压缩后 | 更新压缩结果 |

---

## 五、Extension 加载机制

### 5.1 发现机制

**`src/plugins/discovery.ts`** 实现插件发现：

```typescript
export type PluginCandidate = {
  idHint: string;
  source: string;
  setupSource?: string;
  rootDir: string;
  origin: PluginOrigin;
  format?: PluginFormat;
  bundleFormat?: PluginBundleFormat;
  workspaceDir?: string;
  packageName?: string;
  packageVersion?: string;
};
```

**发现流程**：
1. 扫描配置的扩展目录
2. 加载 `openclaw.plugin.json` manifest
3. 验证插件格式和元数据
4. 缓存发现结果（默认 1000ms）

### 5.2 加载机制

**`src/plugins/loader.ts`** 中的关键步骤：
1. **Manifest 验证**：检查 `openclaw.plugin.json`
2. **依赖解析**：Jiti 懒加载
3. **SDK 别名解析**：`openclaw/plugin-sdk/*` 路径映射
4. **运行时创建**：创建插件执行上下文

### 5.3 必须文件

每个 Extension **必须**有：
- **`openclaw.plugin.json`** — 插件 manifest，至少包含 `id` 和 `configSchema`
- **入口点** — `index.ts`（jiti 加载）或构建后的 `.mjs`

### 5.4 两种 Extension 模式

| 模式 | 描述 | 适用场景 |
|------|------|---------|
| **单文件 Hook 插件** | `index.ts` 直接加载，无 build | 简单拦截/增强工具调用 |
| **Channel 插件** | 需 tsdown build，有依赖 | 渠道集成等复杂插件 |

---

## 六、Session 管理

### 6.1 会话存储架构

**存储位置**：`~/.openclaw/agents/<agentId>/sessions/`

**关键文件**：
- `src/config/sessions/store.ts` - 会话存储
- `src/config/sessions/types.ts` - 会话类型定义
- `src/agents/pi-embedded-runner/session-manager-cache.ts` - 会话管理器缓存

### 6.2 会话生命周期

**初始化** (`src/auto-reply/reply/session.ts`)：
1. 解析会话键（session key）
2. 加载会话存储
3. 验证授权
4. 检查重置触发器
5. 解析对话绑定

### 6.3 Pi 会话日志

Pi 会话日志位置：`~/.openclaw/agents/<agentId>/sessions/*.jsonl`

---

## 七、LLM Provider 模型管理

### 7.1 模型目录

**`src/agents/model-catalog.types.ts`**：

```typescript
export type ModelCatalogEntry = {
  id: string;
  name: string;
  provider: string;
  alias?: string;
  contextWindow?: number;
  reasoning?: boolean;
  input?: ModelInputType[];  // "text" | "image" | "document"
};
```

### 7.2 内置 Provider

支持的主流 Provider：
- **Anthropic** (`extensions/anthropic`)
- **OpenAI/Codex** (`extensions/codex`)
- **Google Gemini**
- **AWS Bedrock** (`extensions/amazon-bedrock`)
- **阿里云** (`extensions/alibaba`)
- **Azure OpenAI**
- **DeepSeek** (`extensions/deepseek`)
- **Local LLM** (LM Studio 等)

---

## 八、Chat/RPC 协议

### 8.1 协议架构

**`src/gateway/protocol/`** 定义有线协议：

```
src/gateway/protocol/
├── index.ts              # 主入口，重导出所有 schema
├── schema/
│   ├── agent.js         # Agent 相关
│   ├── agents-models-skills.js
│   ├── channels.js      # 渠道相关
│   ├── commands.js      # 命令相关
│   ├── config.js        # 配置相关
│   ├── cron.js          # 定时任务
│   ├── error-codes.js   # 错误码
│   ├── frames.js        # 帧结构
│   ├── sessions.js       # 会话相关
│   └── ...
```

### 8.2 RPC 方法列表

**`src/gateway/server-methods-list.ts`** 定义的 Gateway 方法：

- `agent.*` - Agent 操作
- `channels.*` - 渠道操作
- `config.*` - 配置操作
- `sessions.*` - 会话操作
- `cron.*` - 定时任务
- `exec.*` - 执行审批
- `device.*` - 设备配对
- `logs.*` - 日志

### 8.3 WebSocket 通信

**`src/gateway/server-ws-runtime.ts`** 处理 WebSocket 生命周期：
- 连接建立（握手、认证、会话关联）
- 消息处理（协议解析、方法分发）
- 心跳维持

---

## 九、对 LemonClaw 的参考价值

| 方面 | OpenClaw 做法 | LemonClaw 启示 |
|------|---------------|---------------|
| Extension 注册 | openclaw.plugin.json + 自动发现 | LemonClaw 可直接借鉴 |
| before_agent_start hook | 注入 policy/guard | LemonClaw Step 9 需要 |
| 工具注册 | defineRivonClawPlugin | LemonClaw 可直接用 |
| Session 存储 | `~/.openclaw/agents/*/sessions/` | LemonClaw 可直接用 |
| Gateway 架构 | TypeScript + WebSocket RPC | LemonClaw 已参考 |

---

## 十、关键文件索引

### Gateway 核心

| 文件路径 | 功能描述 |
|---------|---------|
| `src/gateway/server.impl.ts` | Gateway 服务器主实现 |
| `src/gateway/boot.ts` | 启动引导逻辑 |
| `src/gateway/server-methods.ts` | RPC 方法处理器 |
| `src/gateway/server-ws-runtime.ts` | WebSocket 运行时 |
| `src/gateway/auth.ts` | 认证逻辑 |

### Plugin 系统

| 文件路径 | 功能描述 |
|---------|---------|
| `src/plugins/loader.ts` | 插件加载器 |
| `src/plugins/registry.ts` | 插件注册表 |
| `src/plugins/discovery.ts` | 插件发现 |
| `src/plugins/manifest.ts` | Manifest 定义 |
| `src/plugins/types.ts` | 核心类型定义 |
| `packages/plugin-sdk/src/plugin-entry.ts` | Plugin SDK 入口 |
| `packages/plugin-sdk/src/provider-entry.ts` | Provider SDK 入口 |

### Session 管理

| 文件路径 | 功能描述 |
|---------|---------|
| `src/auto-reply/reply/session.ts` | 会话生命周期 |
| `src/config/sessions/store.ts` | 会话存储 |
| `src/config/sessions/types.ts` | 会话类型 |

### 协议定义

| 文件路径 | 功能描述 |
|---------|---------|
| `src/gateway/protocol/index.ts` | 协议主入口 |
| `src/gateway/protocol/schema.ts` | Schema 定义 |
| `src/gateway/protocol/schema/frames.js` | 帧定义 |

### Extension 示例

| 目录 | 功能描述 |
|------|---------|
| `extensions/anthropic/` | Anthropic Provider |
| `extensions/codex/` | OpenAI/Codex Provider |
| `extensions/browser/` | 浏览器扩展 |
| `extensions/discord/` | Discord 渠道 |
| `extensions/telegram/` | Telegram 渠道 |
