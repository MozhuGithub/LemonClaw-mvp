# RivonClaw Plugin 与 Extension 机制

> 详细记录 RivonClaw 的 OpenClaw Plugin 扩展机制和 Extension 实现
> **来源**：RivonClaw 源码分析
> **面向项目**：LemonClaw（参考）
> **日期**：2026-04-19

---

## 一、两种扩展模式

RivonClaw 有两种扩展 OpenClaw 的方式：

| 模式 | 描述 | 示例 |
|------|------|------|
| **Extension** | 打包进 RivonClaw 的完整插件，带 build step | rivonclaw-policy, rivonclaw-tools |
| **Inline Hook** | 单文件插件，直接 jiti 加载，无 build | search-browser-fallback |

---

## 二、OpenClaw Plugin SDK

### 2.1 核心接口

**文件**：`packages/plugin-sdk/src/define-plugin.ts`

```typescript
export type ToolVisibility = "managed" | "always";

// 工具可见性策略：
// - "managed": { optional: true }，通过 effectiveTools allowlist 控制
// - "always": 非可选，始终对 LLM 可见

export type PluginApi = {
  id: string;
  logger: { info: (msg: string) => void; warn: (msg: string) => void };
  pluginConfig?: Record<string, unknown>;
  on(event: string, handler: (...args: any[]) => any, opts?: { priority?: number }): void;
  registerTool?(factory: (ctx: { config?: Record<string, unknown> }) => unknown, opts?: { optional?: boolean }): void;
  registerGatewayMethod?(name: string, handler: (args: {
    params: Record<string, unknown>;
    respond: (ok: boolean, payload?: unknown, error?: { code: string; message: string }) => void;
    context?: { broadcast: (event: string, payload: unknown) => void };
  }) => void): void;
};

export interface ToolDefinition {
  name: string;
  label?: string;
  description: string;
  parameters: Record<string, unknown>;
  run?: (...args: any[]) => any;
  [key: string]: unknown;
}
```

### 2.2 插件定义

```typescript
// defineRivonClawPlugin
export interface RivonClawPluginOptions {
  id: string;
  name: string;
  tools?: ToolDefinition[];           // 要注册的工具
  toolVisibility?: ToolVisibility;    // 工具可见性策略
  hooks?: Record<string, Function>;   // Hook handlers
}
```

### 2.3 工具可见性

| 策略 | 含义 | 使用场景 |
|------|------|---------|
| `managed`（默认） | `{ optional: true }`，通过 effectiveTools allowlist 控制 | 工具访问依赖 entitlement/surface/run profile |
| `always` | 非可选，始终对 LLM 可见 | 系统级工具，始终可用 |

---

## 三、OpenClaw Hooks

### 3.1 可用 Hooks

| Hook | 时机 | 用途 |
|------|------|------|
| `before_agent_start` | Agent 启动前 | 注入系统提示、上下文 |
| `before_tool_call` | 工具调用前 | 权限检查、参数验证 |
| `after_tool_call` | 工具调用后 | 结果处理、经验收集 |
| `before_prompt_build` | Prompt 构建前 | 修改用户消息、添加上下文 |
| `session_compact_before` | Session 压缩前 | 准备压缩上下文 |
| `session_compact_after` | Session 压缩后 | 更新压缩结果 |

### 3.2 before_prompt_build 的限制

```typescript
// event.prompt 是用户消息，不是已构建的系统 prompt
// 无法直接修改现有系统 prompt
// 只能通过 prependSystemContext 或完全替换 systemPrompt

// prependSystemContext 是正确方案：AI 先看到前缀指令
// 完全替换 systemPrompt 需要自己调用 buildAgentSystemPrompt()，成本高
```

---

## 四、RivonClaw Extensions

### 4.1 Extension 清单

| Extension | 类型 | 描述 |
|-----------|------|------|
| `rivonclaw-tools` | Hook + Tool | 运行时上下文注入 + rivonclaw/providers 工具（ownerOnly）|
| `rivonclaw-policy` | Hook | 注入编译后的 policies 和 guard directives 到系统提示 |
| `rivonclaw-file-permissions` | Hook | 验证文件操作是否符合权限策略 |
| `rivonclaw-search-browser-fallback` | Hook（单文件） | 当 `web_search` 失败时回退到浏览器搜索 |

### 4.2 rivonclaw-tools

**工具**：

| 工具 | 状态 | 描述 |
|------|------|------|
| `rivonclaw` | 已实现 | `status`（运行时信息）、`help`（可用工具 + 提示）|
| `providers` | 已实现 | list, add, activate, remove — 调用 panel-server HTTP API |
| `channels` | 占位 | list, status, configure — 将调用 panel-server API |
| `settings` | 占位 | get, update — 将调用 panel-server API |
| `rules` | 占位 | list, create, update, delete — 将调用 panel-server API |
| `skills` | 占位 | search, install, delete, list — 将调用 panel-server API |

**Hook**：`before_prompt_build` 已实现，通过 `prependSystemContext` 注入 RivonClaw 运行时上下文。

### 4.3 rivonclaw-policy

- Thin OpenClaw plugin shell
- 将 policy 编译结果注入 `before_agent_start` hook
- Policy 包含系统级指令和 guard directives

### 4.4 rivonclaw-file-permissions

- 使用 `before_tool_call` hook 拦截工具调用
- 验证工具参数中的路径是否符合配置的权限
- 覆盖 ~85-90% 的文件访问场景
- `exec`/`process` 的工作目录会被验证，但命令字符串内的路径无法检查

---

## 五、Extension 加载机制

### 5.1 加载路径

RivonClaw 将 `plugins.load.paths` 指向整个 `extensions/` 目录。OpenClaw 的 `discoverInDirectory()` 通过以下方式发现插件：

1. `package.json` 中的 `openclaw.extensions` 字段（channel plugins）
2. `index.ts` / `index.mjs` 回退（hook plugins）
3. `openclaw.plugin.json` manifest 验证（无 manifest 的子目录跳过）

### 5.2 开发 vs 打包环境

| 环境 | Extensions 路径 |
|------|---------------|
| Dev（monorepo）| `<monorepo-root>/extensions/` — 通过 `pnpm-workspace.yaml` 自动解析 |
| 打包的 Electron | `process.resourcesPath + "/extensions"` — 由 electron-builder 打包 |

`writeGatewayConfig()` 中的 `extensionsDir` 选项处理两种情况。

### 5.3 必须文件

每个 Extension **必须**有：

- **`openclaw.plugin.json`** — 插件 manifest，至少包含：
  ```json
  {
    "id": "<plugin-id>",
    "configSchema": {
      "type": "object",
      "additionalProperties": false,
      "properties": {}
    }
  }
  ```
  `id` 和 `configSchema` 是必须的，否则 gateway 会崩溃。

- **入口点** — 任选其一：
  - `index.ts`（jiti 运行时加载，无需 build）
  - 构建后的 `.mjs`，在 `package.json` 的 `openclaw.extensions` 中引用

---

## 六、两种 Extension 模式

### 模式 A：单文件 Hook 插件（无 build step）

适合简单拦截/增强工具调用的插件。

```
my-plugin/
  openclaw.plugin.json    # required manifest
  index.ts               # 入口点，jiti 加载
```

无需 `package.json`，无需 build，无需 `node_modules`。`.ts` 文件由 OpenClaw 的 jiti loader 即时转译。

### 模式 B：Channel 插件（需 tsdown build）

适合有依赖和构建输出的渠道集成。

```
my-channel/
  openclaw.plugin.json    # required manifest
  package.json           # 含 openclaw.extensions: ["./openclaw-plugin.mjs"]
  openclaw-plugin.mjs     # 构建的入口点
  openclaw-plugin.ts      # 入口点源文件
  src/                    # 额外源文件
  dist/                   # 构建输出
  tsdown.config.ts        # 构建配置
  vitest.config.ts        # 测试配置
```

---

## 七、新增 Extension 清单

1. 创建 `extensions/<name>/openclaw.plugin.json`，含 `id` 和 `configSchema`
2. 创建入口点（Pattern A 的 `index.ts` 或 Pattern B 的 `openclaw-plugin.ts` + build）
3. 如果是 Pattern B，将 package 加入 `pnpm-workspace.yaml`
4. **无需修改**：
   - `packages/gateway/src/config-writer.ts`
   - `apps/desktop/src/main.ts`
   - `apps/desktop/electron-builder.yml`
5. Dev 测试：启动 app，检查 gateway 日志确认插件发现
6. 打包测试：验证插件出现在 `Contents/Resources/extensions/`

---

## 八、对 LemonClaw 的参考价值

| 方面 | RivonClaw 做法 | LemonClaw 启示 |
|------|---------------|--------------|
| Extension 注册 | openclaw.plugin.json + 自动发现 | LemonClaw 可直接借鉴 |
| before_agent_start hook | 注入 policy/guard | ✅ Step 9 需要 |
| before_tool_call hook | 文件权限验证 | LemonClaw 暂无此需求 |
| 工具注册 | defineRivonClawPlugin | LemonClaw 可直接用 |
| 运行时上下文注入 | prependSystemContext | ✅ Step 9 需要 |

---

## 九、关键文件索引

| 组件 | 路径 |
|------|------|
| Plugin SDK | `packages/plugin-sdk/src/define-plugin.ts` |
| Extension README | `extensions/README.md` |
| rivonclaw-tools | `extensions/rivonclaw-tools/` |
| rivonclaw-policy | `extensions/rivonclaw-policy/` |
| rivonclaw-file-permissions | `extensions/rivonclaw-file-permissions/` |
| rivonclaw-search-browser-fallback | `extensions/rivonclaw-search-browser-fallback/` |
| Config Writer | `packages/gateway/src/config-writer.ts` |
| Plugin 加载 | OpenClaw 内部 `discoverInDirectory()` |
