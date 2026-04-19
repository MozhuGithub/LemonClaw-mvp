# RivonClaw 数据层与状态管理

> 详细记录 RivonClaw 的 SQLite 存储、MST 状态管理、数据流架构
> **来源**：RivonClaw 源码分析
> **面向项目**：LemonClaw（参考）
> **日期**：2026-04-19

---

## 一、数据存储架构

### 1.1 SQLite 存储

**文件**：`packages/storage/src/`

RivonClaw 使用 **better-sqlite3** 作为本地数据库，数据库文件位于 `~/.rivonclaw/rivonclaw.db`。

**核心接口**：

```typescript
// packages/storage/src/index.ts
export interface Storage {
  db: Database.Database;
  rules: RulesRepository;
  artifacts: ArtifactsRepository;
  channels: ChannelsRepository;
  permissions: PermissionsRepository;
  settings: SettingsRepository;
  providerKeys: ProviderKeysRepository;
  usageSnapshots: UsageSnapshotsRepository;
  keyUsageHistory: KeyUsageHistoryRepository;
  chatSessions: ChatSessionsRepository;
  channelRecipients: ChannelRecipientsRepository;
  mobilePairings: RepoMobilePairings;
  toolSelections: ToolSelectionsRepository;
  channelAccounts: ChannelAccountsRepository;
  csEscalations: CsEscalationsRepository;
  close(): void;
}
```

### 1.2 Repository 模式

每个数据领域对应一个 Repository，封装所有 SQL 操作：

| Repository | 职责 |
|-----------|------|
| `RulesRepository` | 规则 CRUD |
| `ArtifactsRepository` | 工件存储 |
| `ChannelsRepository` | 消息渠道配置 |
| `PermissionsRepository` | 文件访问权限 |
| `SettingsRepository` | Key-Value 设置 |
| `ProviderKeysRepository` | LLM Provider Keys |
| `UsageSnapshotsRepository` | Token 用量快照 |
| `KeyUsageHistoryRepository` | Key 用量历史 |
| `ChatSessionsRepository` | Chat Session 元数据 |
| `ChannelRecipientsRepository` | 渠道接收人 |
| `MobilePairingsRepository` | 移动端配对 |
| `ToolSelectionsRepository` | 工具选择记录 |
| `ChannelAccountsRepository` | 渠道账号 |
| `CsEscalationsRepository` | 客服升级记录 |

### 1.3 迁移系统

```typescript
// packages/storage/src/migrations.ts
interface Migration {
  id: number;
  name: string;
  sql: string;
}
```

启动时自动执行未应用的迁移，记录在 `_migrations` 表。

---

## 二、MST 状态管理

### 2.1 MST 架构

RivonClaw 使用 **MobX-State-Tree（MST）** 作为 Desktop 和 Panel 之间的共享状态。

**两个 MST Store**：

| Store | Desktop 文件 | Panel 文件 | SSE 端点 | 用途 |
|-------|-------------|------------|---------|------|
| **Entity Store** | `desktop-store.ts` | `entity-store.ts` | `/api/store/stream` | 业务实体（shops, users, provider keys 等） |
| **Runtime Status Store** | `runtime-status-store.ts` | `runtime-status-store.ts` | `/api/status/stream` | 瞬时运行时状态（CS bridge 状态, app settings） |

### 2.2 三层 MST 模型

```
┌─────────────────────────────────────────────────────────────┐
│  Core Layer (packages/core/src/models/)                    │
│  - 纯数据 props，无 actions，无副作用                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Desktop Layer (apps/desktop/src/app/store/)              │
│  - 扩展 core model + 服务端 actions（存储读写, gateway 调用）│
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Panel Layer (apps/panel/src/store/models/)              │
│  - 扩展 core model + 客户端 actions（REST 调用 Desktop）   │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 数据流

```
Panel → Desktop:      REST API（HTTP 请求/响应）
Desktop → Panel:      SSE patch stream（推送 MST patches）
Backend → Desktop:    GraphQL subscriptions（经 WebSocket）
```

Panel 永远不直接请求云端后端，所有云端请求都经 Desktop 代理。

---

## 三、SSE 推送机制

### 3.1 三个 SSE 通道

| 端点 | 用途 | 内容 |
|------|------|------|
| `/api/store/stream` | Entity store 同步 | MST snapshots + JSON patches |
| `/api/status/stream` | Runtime status 同步 | MST patches（appSettings, CS bridge state） |
| `/api/chat/events` | Notification 事件 | 命名事件：shop-updated, oauth-complete |

### 3.2 SST vs Snapshot 竞态

Panel 的 SSE 连接可能在页面 `useEffect` 触发后才送达 snapshot。对于维护**本地草稿状态**的页面：

1. 用 `runtimeStatus.snapshotReceived` 作为闸门 — snapshot 到达后才填充草稿状态
2. 用 `dirty` 标志 — 用户开始编辑后停止从 store 同步
3. 保存成功后重置 `dirty`，后续 SSE patches 可继续更新表单

---

## 四、API 契约

### 4.1 Route Registry

所有 Desktop HTTP 端点通过 `RouteRegistry` 注册（`apps/desktop/src/api-routes/route-registry.ts`）。

- Handler 文件位于 `apps/desktop/src/api-routes/handlers/`
- 每个文件导出 `register*Handlers(registry)` 函数
- 参数路径段（`:id`, `:channelId`）自动提取到 `params`

### 4.2 API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/rules` | GET, POST, PUT, DELETE | 规则 CRUD |
| `/api/channels` | GET, POST, PUT, DELETE | 渠道管理 |
| `/api/permissions` | GET, POST, PUT, DELETE | 权限管理 |
| `/api/settings` | GET, PUT | Key-Value 设置 |
| `/api/agent-settings` | GET, PUT | Agent 设置（DM scope, browser mode） |
| `/api/providers` | GET | 可用 LLM Providers |
| `/api/provider-keys` | GET, POST, PUT, DELETE | API Key 和 OAuth 凭证管理 |
| `/api/oauth` | POST | Gemini CLI OAuth 流程 |
| `/api/skills` | GET, POST, DELETE | 技能市场和已安装技能 |
| `/api/usage` | GET | Token 用量统计 |
| `/api/stt` | GET, PUT | 语音转文字配置 |
| `/api/telemetry` | POST | 匿名遥测事件 |
| `/api/status` | GET | 系统状态（规则数, gateway 状态） |

---

## 五、Provider Key 生命周期

### 5.1 密钥存储

- **macOS**: Keychain
- **Windows**: DPAPI + 文件备用
- **测试**: 内存存储

### 5.2 LLM Key 与 Model 生命周期

所有 LLM Provider Key 和模型管理集中在 `LLMProviderManager`：

| 操作 | Desktop 文件 | Panel 文件 |
|------|-------------|------------|
| 创建 Key | `llm-provider-manager.ts` | `LLMProviderModel.ts` |
| 激活 Provider | `activateProvider()` | `activateProvider()` |
| 切换模型 | `switchModel()` | `switchModel()` |
| Per-Session 切换 | `switchModelForSession()` | `switchSessionModel()` |

### 5.3 认证流程

```
启动/Key 变更
  ↓
syncAllAuthProfiles()
  ↓
从 Keychain 获取所有 Provider Keys
  ↓
写入 auth-profiles.json（OpenClaw 状态目录）
  ↓
Gateway 每次 LLM 调用读取 auth-profiles.json
  ↓ 无需重启
```

### 5.4 模型切换策略

| 范围 | 机制 | 重启？ |
|------|------|-------|
| Per-session | `sessions.patch` RPC | ❌ |
| 全局默认 | SQLite + `writeDefaultModel` + reset sessions | ❌（热重载）|
| Per-shop CS | scope resolution + `sessions.patch` RPC | ❌ |

---

## 六、对 LemonClaw 的参考价值

| 方面 | RivonClaw 做法 | LemonClaw 启示 |
|------|---------------|--------------|
| SQLite 存储 | better-sqlite3 + Repository 模式 | LemonClaw 可直接借鉴 |
| 状态同步 | MST + SSE | LemonClaw 当前用 Zustand + IPC，Panel 拆离时需改 |
| API 契约 | 集中定义在 api-contract.ts | ✅ 可借鉴 |
| 数据目录 | `~/.rivonclaw/` | LemonClaw 用 `~/.lemonclaw/` |

---

## 七、关键文件索引

| 组件 | 路径 |
|------|------|
| Database | `packages/storage/src/database.ts` |
| Storage | `packages/storage/src/index.ts` |
| Repositories | `packages/storage/src/repo-*.ts` |
| Desktop Store | `apps/desktop/src/app/store/desktop-store.ts` |
| Runtime Status Store | `apps/desktop/src/app/store/runtime-status-store.ts` |
| Panel Entity Store | `apps/panel/src/store/entity-store.ts` |
| API Contract | `packages/core/src/api-contract.ts` |
| Route Registry | `apps/desktop/src/api-routes/route-registry.ts` |
| LLM Provider Manager | `apps/desktop/src/store/llm-provider-manager.ts` |
