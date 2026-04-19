# RivonClaw 整体架构与项目结构

> RivonClaw 的 Monorepo 结构、三层分离、核心模块职责
> **来源**：RivonClaw 调研报告 + 源码分析
> **面向项目**：LemonClaw（参考）
> **日期**：2026-04-19

---

## 一、三层分离架构

```
┌──────────────────────────────────────────────────────┐
│  RivonClaw Desktop（Electron 托盘应用）               │
│  ├── GatewayLauncher — 管理 OpenClaw 子进程生命周期    │
│  ├── HTTP Server — Panel 面板服务（动态端口）           │
│  ├── SQLite — 规则/频道/权限/制品存储                  │
│  └── System Keychain/DPAPI — 密钥安全存储              │
├──────────────────────────────────────────────────────┤
│  RivonClaw Panel（React SPA，浏览器）                  │
│  ├── GatewayChatClient — WebSocket 直连 Gateway       │
│  ├── ChatGatewayController — chat 事件处理            │
│  ├── EntityStore — MST 实体状态                       │
│  └── REST Client — 调用 Desktop API                  │
├──────────────────────────────────────────────────────┤
│  Plugin Extensions（OpenClaw Hooks 注入）              │
│  ├── rivonclaw-policy — 策略注入                       │
│  ├── rivonclaw-file-permissions — 文件权限拦截         │
│  ├── rivonclaw-tools — 自定义工具（owner-only）        │
│  └── rivonclaw-mobile-chat-channel — 移动端消息中继    │
├──────────────────────────────────────────────────────┤
│  vendor/openclaw/（OpenClaw 二进制，gitignored）       │
└──────────────────────────────────────────────────────┘
```

**关键**：Panel 和 Desktop 是分开的进程，但 chat 数据流走 **Panel → Gateway 直连**（不经过 Desktop）。

---

## 二、Monorepo 结构

```
rivonclaw/
├── apps/
│   ├── desktop/          # Electron 主进程（TypeScript）
│   │   └── src/
│   │       ├── app/           # 主应用入口、store、server
│   │       ├── gateway/       # Gateway 配置、生命周期、event-dispatcher
│   │       ├── openclaw/      # OpenClawConnector、RPC client
│   │       ├── infra/         # 基础设施（proxy、api、routes）
│   │       ├── providers/     # LLM provider 管理
│   │       └── store/         # MST store（desktop-store、runtime-status-store）
│   └── panel/            # React SPA（Vite + React 19）
│       └── src/
│           ├── pages/         # 页面（chat、settings、providers...）
│           ├── controllers/    # ChatGatewayController 等
│           ├── lib/           # GatewayChatClient
│           ├── store/         # MST entity-store、runtime-status-store
│           ├── store/models/  # Panel 扩展的 MST models
│           ├── api/          # REST client
│           └── components/    # 共享 UI 组件
├── packages/             # 12 个共享包
│   ├── core/             # Zod 类型定义、API 契约、路径、端口、defaults
│   ├── gateway/          # GatewayLauncher、ConfigWriter、RPC Client
│   ├── storage/          # SQLite + migrations + repositories
│   ├── secrets/          # Keychain / DPAPI 密钥存储
│   ├── rules/            # 规则编译、SKILL.md 生成
│   ├── policy/           # 策略注入、Guard 评估
│   ├── proxy-router/     # HTTP CONNECT 代理路由
│   ├── stt/              # 语音转文字（Groq + 火山引擎）
│   ├── device-id/        # 设备指纹
│   ├── updater/          # 自动更新
│   ├── logger/           # 结构化日志（tslog）
│   └── telemetry/        # 匿名遥测
├── extensions/           # 4 个 OpenClaw 插件
└── vendor/
    └── openclaw/         # OpenClaw 二进制（gitignored）
```

---

## 三、Desktop 核心模块

### 3.1 入口与初始化

**文件**：`apps/desktop/src/app/main.ts`

主要职责：
1. 初始化 SQLite storage
2. 初始化 Keychain secret store
3. 创建 GatewayLauncher
4. 写入初始 openclaw.json
5. 启动 Gateway 子进程
6. 初始化 OpenClawConnector（RPC）
7. 启动 HTTP Server（Panel 面板）
8. 设置系统托盘
9. 注册 IPC handlers（设置、Provider keys、Channel 管理等）

### 3.2 Gateway 生命周期管理

**文件**：`apps/desktop/src/gateway/`

```
gateway/
├── config-builder.ts     # 构建完整 Gateway 配置对象
├── config-handlers.ts    # 配置变更分发（STT/provider/permissions）
├── config-writer.ts      # 将配置写入磁盘（package 层）
├── event-dispatcher.ts   # 事件分发（chat-mirror、channel-inbound 等）
├── connection.ts        # Desktop ↔ Gateway 连接管理
├── startup-utils.ts     # 启动清理（device pairing、gateway lock）
└── provider-keys-ref.ts # 全局 ProviderKeysStore 引用
```

### 3.3 OpenClawConnector

**文件**：`apps/desktop/src/openclaw/`

```typescript
// openclaw-connector.ts
export const openClawConnector = new OpenClawConnector()

class OpenClawConnector {
  connectRpc()           // 连接 Gateway WebSocket
  disconnectRpc()        // 断开
  reconnectRpc()         // 重连
  request(method, params)  // 发送 RPC
  applyConfigMutation(mutator, policy)  // 配置变更触发动作
}
```

---

## 四、Panel 核心模块

### 4.1 路由与布局

**文件**：`apps/panel/src/routes.tsx`（Route Registry）

所有页面在 `ROUTES` 中声明，包含：path、page component、nav label、icon、auth gate、keepMounted behavior。

### 4.2 Chat 模块

**文件**：`apps/panel/src/pages/chat/`

```
chat/
├── ChatPage.tsx               # 页面壳（hook 组合 + 布局）
├── controllers/
│   └── ChatGatewayController.ts  # chat 事件处理核心逻辑
└── components/
    ├── ChatInput.tsx
    ├── MessageList.tsx
    └── ...
```

**关键**：Page 是薄壳（150-250 行），调用 feature hooks 获取状态，渲染 feature components。

### 4.3 数据流

```
GatewayChatClient（WebSocket 直连 Gateway）
  ↓ 事件
ChatGatewayController.handleEvent()
  ↓ 直接更新 React 状态
ChatPage observer() 重渲染
```

**没有 MST**：chat 模块直接用 React 状态管理，不走 MST + SSE。

---

## 五、对 LemonClaw 的参考价值

| 方面 | RivonClaw | LemonClaw 当前 |
|------|-----------|--------------|
| Monorepo | pnpm + Turbo | 无（单 repo） |
| Panel/Desktop 分离 | 独立进程 + HTTP | 同一 Electron 进程 |
| WebSocket 连接 | Panel 直连 Gateway | IPC 中转 |
| 数据流 | SSE + WebSocket | IPC + Zustand |
| Route Registry | 集中声明 | 无（直接 import） |
| 页面架构 | 薄壳 + hooks + components | 基本相同 |

---

## 六、关键文件索引

| 组件 | 文件路径 |
|------|---------|
| Desktop main | `apps/desktop/src/app/main.ts` |
| GatewayLauncher | `packages/gateway/src/launcher.ts` |
| OpenClawConnector | `apps/desktop/src/openclaw/openclaw-connector.ts` |
| Route Registry | `apps/desktop/src/infra/api/route-registry.ts` |
| Desktop store | `apps/desktop/src/app/store/desktop-store.ts` |
| GatewayChatClient | `apps/panel/src/lib/gateway-client.ts` |
| ChatGatewayController | `apps/panel/src/pages/chat/controllers/ChatGatewayController.ts` |
| Panel store | `apps/panel/src/store/entity-store.ts` |
| Route Registry (Panel) | `apps/panel/src/routes.tsx` |
| API contract | `packages/core/src/api-contract.ts` |
