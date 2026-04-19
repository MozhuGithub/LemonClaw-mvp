# RivonClaw 调研报告

> 基于源码深度分析的项目调研
> **来源**：RivonClaw 源码分析 + README
> **面向项目**：LemonClaw（参考）
> **日期**：2026-04-19

---

## 一、项目概述

### 1.1 一句话总结

**RivonClaw = OpenClaw 桌面化应用** — 将 OpenClaw Agent 运行时包装成任何人都能使用的桌面托盘应用。

> OpenClaw is the engine; RivonClaw is the cockpit.

### 1.2 解决的问题

OpenClaw 定位是给工程师的 CLI 工具，门槛很高：
- 需要编辑配置文件
- 需要管理进程
- 需要从终端管理 API Key

RivonClaw 将这些全部可视化：
- 安装后从系统托盘启动
- 通过本地 Web Panel 管理一切
- 自然语言写规则代替代码
- 点击配置 LLM Provider 和消息渠道

---

## 二、核心功能

### 2.1 功能列表

| 功能 | 说明 |
|------|------|
| **自然语言规则** | 用自然语言写规则 → 编译为 policy/guards/skills，立即生效无需重启 |
| **多 Provider LLM 支持** | 20+ providers（OpenAI, Anthropic, Google Gemini, DeepSeek, Zhipu, Moonshot, Qwen, Groq, Mistral, xAI, OpenRouter, MiniMax, Volcengine 等）|
| **OAuth 支持** | Google 登录免费用 Gemini，Claude/Anthropic 订阅也可 OAuth |
| **Per-Provider 代理** | 每个 Provider/Key 可配置独立 HTTP/SOCKS5 代理，热重载 |
| **多账号消息渠道** | Telegram, WhatsApp, Discord, Slack, Google Chat, Signal, iMessage, Feishu, LINE, Matrix, Teams 等 |
| **Token 用量统计** | 按模型和 Provider 实时统计，从 OpenClaw Session 文件自动刷新 |
| **语音转文字** | Groq（国际）/火山引擎（中国） |
| **可视化权限** | 通过 UI 控制文件读写权限 |
| **热重载** | API Key、代理、渠道变更立即生效，无需重启 Gateway |
| **本地优先** | 所有数据留在本机，密钥绝不明文存储 |
| **实时 Chat** | WebSocket 直连 Gateway，Markdown 渲染，模型切换，历史持久化 |
| **技能市场** | 浏览、安装社区技能，一键管理 |
| **自动更新** | 静态 manifest 检测新版本 |

---

## 三、技术架构

### 3.1 整体架构

```
┌─────────────────────────────────────────┐
│  System Tray (Electron main process)     │
│  ├── GatewayLauncher → vendor/openclaw  │
│  ├── Panel HTTP Server (dynamic port)   │
│  │   ├── Static files (panel dist/)     │
│  │   └── REST API (/api/*)              │
│  ├── SQLite Storage                     │
│  ├── Auth Profile Sync                  │
│  └── Auto-Updater                       │
└─────────────────────────────────────────┘
         │                    ▲
         ▼                    │
┌─────────────┐    ┌─────────────────┐
│  OpenClaw   │    │  Panel (React)  │
│  Gateway    │    │  (浏览器)       │
│  Process    │    └─────────────────┘
└─────────────┘
```

### 3.2 Monorepo 结构

```
rivonclaw/
├── apps/
│   ├── desktop/          # Electron 托盘应用（主进程）
│   └── panel/            # React 19 + Vite 6 SPA（管理面板）
├── packages/             # 12 个共享包
│   ├── core/             # Zod 类型定义、API 契约
│   ├── gateway/          # GatewayLauncher、ConfigWriter、Secret 注入
│   ├── storage/          # SQLite 持久化
│   ├── secrets/          # Keychain / DPAPI 密钥存储
│   ├── rules/            # 规则编译、SKILL.md 生成
│   ├── policy/           # Policy 注入、Guard 评估
│   ├── proxy-router/     # HTTP CONNECT 代理路由
│   ├── stt/              # 语音转文字
│   └── telemetry/        # 匿名遥测
├── extensions/           # 4 个 OpenClaw 插件
│   ├── rivonclaw-policy/           # Policy 注入
│   ├── rivonclaw-tools/            # Owner-only 工具
│   ├── rivonclaw-file-permissions/ # 文件权限拦截
│   └── rivonclaw-mobile-chat-channel/ # 移动端消息中继
└── vendor/
    └── openclaw/         # OpenClaw 二进制（gitignored）
```

---

## 四、关键设计

### 4.1 热重载机制

| 变更类型 | 机制 | 需要重启 |
|---------|------|---------|
| API Key 增删改 | 写入 auth-profiles.json，Gateway 每次 LLM 调用读取 | ❌ |
| 代理配置 | 写入 proxy router config，fs.watch 热重载 | ❌ |
| 渠道配置 | REST API → SQLite → SSE 推送 Panel | ❌ |
| 规则变更 | 编译为 SKILL.md，skills/ 目录 watch | ❌ |
| 模型切换 | sessions.patch RPC | ❌ |
| Gateway 启动参数 | SIGUSR1 优雅重载 | ❌ |
| 插件变更 | — | ✅ |

### 4.2 密钥存储

- **macOS**：Keychain
- **Windows**：DPAPI + 文件备用
- **Linux**：文件备用
- 密钥写入 `auth-profiles.json` 供 Gateway 运行时读取，不通过环境变量注入

### 4.3 Panel ↔ Desktop 通信

| 方向 | 方式 |
|------|------|
| Panel → Desktop | REST API（HTTP 请求/响应） |
| Desktop → Panel | SSE patch stream（推送） |
| Backend → Desktop | GraphQL subscriptions（graphql-ws over WebSocket） |

Panel 永远不直接连云端后端，所有请求都经 Desktop 代理。

---

## 五、数据流

### 5.1 Chat 数据流

```
用户输入
  ↓
Panel: GatewayChatClient（WebSocket 直连 Gateway）
  ↓ chat.send RPC
Gateway
  ↓ 调用 LLM
  ↓ emitChatDelta / emitChatFinal / emitChatError / emitChatAborted
GatewayChatClient
  ↓ 事件
ChatGatewayController.handleEvent()
  ↓ 直接更新 React 状态
Chat UI 重渲染
```

**关键**：Desktop 主进程**不参与** Chat 事件，只参与管理操作。

### 5.2 状态同步（SSE）

三个 SSE 通道：

| 端点 | 用途 | 内容 |
|------|------|------|
| `/api/store/stream` | Entity store 同步 | MST snapshots + JSON patches |
| `/api/status/stream` | Runtime status 同步 | MST patches（appSettings, CS bridge state） |
| `/api/chat/events` | Notification events | 命名事件：shop-updated, oauth-complete |

---

## 六、对 LemonClaw 的参考价值

| 方面 | RivonClaw 做法 | LemonClaw 可借鉴程度 |
|------|---------------|-------------------|
| 托盘应用 | Electron tray-only | ✅ 直接参考 |
| Panel 分离 | React SPA 独立进程 | ⚠️ LemonClaw 当前单进程，可后续拆 |
| 热重载 | auth-profiles.json 无需重启 | ✅ 已在用 |
| V8 缓存 | 从 dist/ 复制到 stateDir | ✅ 已在用 |
| 多 Provider | ProviderMeta 集中定义 | ⚠️ LemonClaw 当前仅 minimax |
| 规则引擎 | 自然语言 → SKILL.md | ❌ LemonClaw Phase 3 才需要 |
| 渠道集成 | 多账号多渠道 | ❌ LemonClaw MVP 不需要 |

---

## 七、与 LemonClaw 的定位差异

| | RivonClaw | LemonClaw |
|--|-----------|-----------|
| **目标用户** | 普通用户（非程序员） | 开发者/个人用户 |
| **核心差异** | 开箱即用，零配置 | 可定制，记忆系统 |
| **规则引擎** | 内置自然语言规则 | 不需要（Phase 3 才考虑） |
| **渠道集成** | 多渠道（Telegram/WhatsApp 等） | 单桌面应用 |
| **技能市场** | 内置市场 | 不需要 |
| **记忆系统** | 无（依赖 OpenClaw 内置 MEMORY.md）| 核心差异化功能（Phase 2） |
| **学习引擎** | 无 | 核心差异化功能（Phase 3） |

---

## 八、关键文件索引

| 组件 | 路径 |
|------|------|
| Desktop main | `apps/desktop/src/app/main.ts` |
| GatewayLauncher | `packages/gateway/src/launcher.ts` |
| Config Writer | `packages/gateway/src/config-writer.ts` |
| Storage | `packages/storage/src/index.ts` |
| Plugin SDK | `packages/plugin-sdk/src/define-plugin.ts` |
| Extensions | `extensions/` |
| Panel Chat | `apps/panel/src/pages/chat/` |
| Route Registry | `apps/panel/src/routes.tsx` |
