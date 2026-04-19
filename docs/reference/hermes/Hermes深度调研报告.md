# Hermes 深度调研报告

> 基于源码深度分析的项目调研
> **来源**：Hermes 源码分析
> **面向项目**：LemonClaw（参考）
> **日期**：2026-04-19

---

## 一、项目概述

### 1.1 项目定位

Hermes 是由 **Nous Research** 构建的一个**自改进 AI Agent**（A self-improving AI agent），核心定位是一个生产级的多平台 AI Agent 框架，支持工具调用、长期记忆、技能管理、消息网关和多模型路由。

> **核心定位**：Hermes 是一个从 OpenClaw 演化而来的后继者，增加了自改进能力、多后端执行、多渠道网关等生产级功能。

### 1.2 核心功能

| 功能 | 说明 |
|------|------|
| **内置学习循环** | 从经验中创建技能（skills），使用过程中自我改进，跨会话记忆用户偏好，支持 FTS5 会话搜索 |
| **多后端终端** | 支持本地、Docker、SSH、Daytona、Singularity、Modal 六种后端运行环境 |
| **多消息平台网关** | Telegram、Discord、Slack、WhatsApp、Signal、Email 等单一进程同时接入 |
| **多模型支持** | Nous Portal、OpenRouter（200+ 模型）、Xiaomi MiMo、z.ai/GLM、Kimi/Moonshot、MiniMax、Hugging Face、OpenAI 等 |
| **内置 cron 调度** | 自然语言描述的定时任务，跨平台投递 |
| **子 Agent 委托** | 可生成隔离子 Agent 执行并行工作流 |
| **RL 训练集成** | 支持 Atropos RL 环境、轨迹压缩用于训练下一代工具调用模型 |
| **MCP 协议支持** | 可连接任何 MCP 服务器扩展能力 |

### 1.3 与 OpenClaw 的关系

根据 README.md 和 AGENTS.md：

1. **Hermes 从 OpenClaw 演化而来**：两者有相同的项目起源，Hermes 是后继者
2. **数据迁移**：`hermes claw migrate` 命令支持从 OpenClaw 迁移：
   - `SOUL.md` persona 文件
   - `MEMORY.md` 和 `USER.md` 记忆条目
   - 用户创建的 skills → `~/.hermes/skills/openclaw-imports/`
   - Command allowlist
   - Messaging 设置和 API keys
   - TTS assets 和 workspace 指令
3. **工具兼容性**：Hermes 的工具系统设计兼容 OpenClaw 的工具接口

### 1.4 技术栈

- **语言**：Python 3.11+
- **AI SDK**：OpenAI SDK、Anthropic SDK、boto3（Bedrock）
- **数据库**：SQLite（WAL 模式）+ FTS5
- **UI**：prompt_toolkit（CLI TUI）、Rich（格式化输出）
- **协议**：MCP（Model Context Protocol）

---

## 二、核心架构

### 2.1 项目结构

```
hermes/
├── run_agent.py          # AIAgent 核心类 + 对话循环（约 9500 行）
├── model_tools.py        # 工具编排层，discover_builtin_tools + handle_function_call
├── toolsets.py           # 工具集定义（TOOLSETS 字典 + 解析函数）
├── cli.py                # 交互式 CLI 约 14000 行
├── hermes_state.py       # SQLite 持久化状态存储（FTS5 搜索）
├── mcp_serve.py          # MCP server（暴露 messaging 为 MCP 工具）
├── hermes_cli/           # CLI 子命令（main.py, setup.py, config.py, commands.py 等）
├── agent/                # Agent 内部组件（prompt_builder, context_compressor 等）
├── tools/                # 工具实现（~60 个工具，registry.py 为核心）
├── gateway/              # 消息平台网关（run.py 主循环 + platforms/ 适配器）
├── acp_adapter/          # ACP server（VS Code / Zed / JetBrains 集成）
├── cron/                 # 定时调度器
└── environments/          # RL 训练环境（Atropos）
```

### 2.2 入口点体系

Hermes 有三条主要入口路径：

| 命令 | 入口 | 职责 |
|------|------|------|
| `hermes`（无参数） | `hermes_cli/main.py` → `cli.py` | 启动交互式 CLI（TUI） |
| `hermes gateway` | `hermes_cli/main.py` → `gateway/run.py` | 启动消息网关 |
| `hermes setup` | `hermes_cli/main.py` → `hermes_cli/setup.py` | 安装向导 |
| `hermes model` | `hermes_cli/main.py` → `hermes_cli/config.py` | 模型配置 |

### 2.3 核心模块依赖链

```
tools/registry.py  （无依赖 — 所有工具文件的导入起点）
       ↑
tools/*.py  （每个工具文件调用 registry.register() 自注册）
       ↑
model_tools.py  （触发工具发现 + 提供 get_tool_definitions / handle_function_call）
       ↑
run_agent.py, cli.py, batch_runner.py, environments/
```

### 2.4 Profile 机制（多实例隔离）

核心机制是 `_apply_profile_override()` 在 `hermes_cli/main.py` 中**先于所有模块导入**解析 `--profile/-p` 标志，将 `HERMES_HOME` 环境变量设置好。所有代码通过 `get_hermes_home()` 读取此变量，实现每个 profile 完全隔离的：
- `~/.hermes/profiles/<name>/` 目录
- 独立的 config.yaml、.env、sessions、skills、gateway 状态

---

## 三、Agent 执行机制

### 3.1 AIAgent 核心循环

`AIAgent.run_conversation()` 是 Agent 的主循环：

```python
while api_call_count < max_iterations and iteration_budget.remaining > 0:
    # 1. 前置处理
    _restore_primary_runtime()          # 恢复主模型（如之前启用了 fallback）
    _sanitize_surrogates(user_message)  # 清理 UTF-16 代理字符

    # 2. 记忆预取（插件 memory provider）
    _ext_prefetch_cache = memory_manager.prefetch_all(original_user_message)

    # 3. API 调用（含流式支持）
    response = _interruptible_api_call(
        messages, tools, system_prompt,
        stream_callback=stream_callback
    )

    # 4. 处理 reasoning content
    if response.reasoning:
        messages.append({"role": "assistant", "reasoning": ...})

    # 5. 处理 tool_calls
    if response.tool_calls:
        for tool_call in response.tool_calls:
            result = _invoke_tool(tool_call.name, tool_call.args, task_id)
            messages.append(tool_result_message(result))
        api_call_count += 1
    else:
        # 6. 处理 content（文本响应）
        final_response = response.content
        break
```

### 3.2 迭代预算（IterationBudget）

- 父 Agent 默认 `max_iterations=90`
- 子 Agent（delegate_task）默认 `max_iterations=50`
- `execute_code` 产生的迭代可通过 `refund()` 退回预算
- 预算耗尽时触发一次 "grace call"，允许模型做一个总结

### 3.3 工具并行化

`_should_parallelize_tool_batch()` 决定是否并行执行工具调用：
- `clarify` 永远串行（用户交互）
- 文件工具（`read_file`, `write_file`, `patch`）按路径冲突检测
- 其他工具按 `_PARALLEL_SAFE_TOOLS` 白名单判断
- 最多 8 个 worker 线程

### 3.4 子 Agent 委托（Delegate）

`delegate_task` 工具创建隔离的子 AIAgent：
- 独立 `task_id`（独立 terminal session）
- 独立 `IterationBudget`（默认 50）
- 被禁止的工具：`delegate_task`, `clarify`, `memory`, `send_message`, `execute_code`
- 通过 `ThreadPoolExecutor` 并行运行（最多 3 个子 Agent）
- 父 Agent 仅看到最终总结，不看到子过程

### 3.5 中断机制

- `_interrupt_requested` 标志 + `_interrupt_message` 可选消息
- `_execution_thread_id` 绑定到运行线程
- `Ctrl+C`（CLI）或 `/stop`（gateway）触发

---

## 四、状态管理

### 4.1 SessionDB（`hermes_state.py`）

**存储后端**：SQLite + WAL 模式，路径 `~/.hermes/state.db`

**核心表结构：**

```sql
sessions (
    id TEXT PRIMARY KEY,
    source TEXT,         -- 'cli', 'telegram', 'discord' 等
    model, model_config,
    system_prompt,       -- 完整 system prompt 快照
    parent_session_id,   -- 用于压缩后新 session 链回原 session
    started_at, ended_at, end_reason,
    message_count, tool_call_count,
    input_tokens, output_tokens,
    cache_read_tokens, cache_write_tokens,
    reasoning_tokens,
    billing_provider, billing_base_url, billing_mode,
    estimated_cost_usd, actual_cost_usd, cost_status,
    title                -- 会话标题（唯一索引）
)

messages (
    id INTEGER PRIMARY KEY,
    session_id, role, content,
    tool_call_id, tool_calls, tool_name,
    timestamp, token_count, finish_reason,
    reasoning, reasoning_details, codex_reasoning_items
)

messages_fts -- FTS5 虚拟表，全文搜索 messages.content
```

### 4.2 写并发处理

- `BEGIN IMMEDIATE` 获取 WAL 写锁
- 应用层随机 jitter 重试（20-150ms，最多重试 15 次）
- 每 50 次写操作执行一次 PASSIVE WAL checkpoint

### 4.3 FTS5 全文搜索

- 自动在 INSERT/UPDATE/DELETE 时同步 `messages_fts` 虚拟表
- `search_messages()` 支持全文搜索历史消息

---

## 五、Tool/Toolset 机制

### 5.1 工具注册体系（`tools/registry.py`）

**自注册模式**：每个工具文件在模块级别调用 `registry.register()`，通过 AST 静态分析发现（`_module_registers_tools()` 用 `ast.parse()` 检测顶层调用）。

**发现流程**：
```python
discover_builtin_tools()  # 扫描 tools/*.py，通过 AST 找 registry.register() 调用
discover_mcp_tools()       # 从 config.yaml mcp_servers 配置连接外部 MCP
discover_plugins()         # 用户/项目/pip 安装的插件
```

### 5.2 Toolset 定义（`toolsets.py`）

**静态定义**：`TOOLSETS` 字典定义了所有工具集：

| 类别 | 工具集 |
|------|-------|
| 基础 | `base`, `minimal`, `safe` |
| 文件 | `file` |
| Web | `web` |
| 终端 | `terminal` |
| 浏览器 | `browser` |
| 代码执行 | `code_execution` |
| 子Agent | `delegation` |
| 记忆 | `memory` |
| 技能 | `skills` |
| 视觉 | `vision` |
| 语音 | `tts` |
| 平台 | `hermes-cli`, `hermes-telegram`, `hermes-discord`, `hermes-gateway` 等 |

### 5.3 主要工具分类（`tools/` 目录，约 60 个文件）

| 类别 | 工具 | 代表文件 |
|------|------|---------|
| Web | `web_search`, `web_extract` | `web_tools.py` |
| 文件 | `read_file`, `write_file`, `patch`, `search_files` | `file_tools.py` |
| 终端 | `terminal`, `process` | `terminal_tool.py` |
| 浏览器 | `browser_navigate`, `browser_click` | `browser_tool.py` |
| 代码执行 | `execute_code` | `code_execution_tool.py` |
| 子Agent | `delegate_task` | `delegate_tool.py` |
| 记忆 | `memory`, `todo` | `memory_tool.py` |
| 技能 | `skills_list`, `skill_view`, `skill_manage` | `skills_tool.py` |
| 会话搜索 | `session_search` | `session_search_tool.py` |
| 消息 | `send_message` | `send_message_tool.py` |
| MCP | `mcp_*` | `mcp_tool.py` |

---

## 六、LLM 集成

### 6.1 多 API Mode 支持

```python
api_mode = "chat_completions"      # OpenAI-compatible /v1/chat/completions
api_mode = "anthropic_messages"    # Anthropic /v1/messages
api_mode = "bedrock_converse"       # AWS Bedrock converse API
api_mode = "codex_responses"       # OpenAI Responses API (GPT-5 等)
```

### 6.2 Provider 自动检测

`AIAgent.__init__` 中根据 `provider` 参数和 `base_url` 内容自动推断 api_mode：
- `provider="anthropic"` 或 URL 含 `api.anthropic.com` → `anthropic_messages`
- URL 以 `/anthropic` 结尾（如 MiniMax、DashScope）→ `anthropic_messages`
- `provider="bedrock"` 或 URL 含 `bedrock-runtime` → `bedrock_converse`
- OpenAI direct URL 或 GPT-5 模型 → `codex_responses`
- 其余 → `chat_completions`

### 6.3 Prompt Caching

当通过 OpenRouter 使用 Claude 模型或原生 Anthropic 时，自动启用 Anthropic 的 `cache_control` 提示缓存：
- 策略：`system_and_3`（4 个断点）
- TTL：`5m`

### 6.4 上下文压缩（ContextCompressor）

当请求 token 数达到模型上下文窗口的 50%（默认）时，自动压缩：
- 保护前 3 条消息（系统 prompt）和后 20 条消息
- 中间部分用 LLM 生成的摘要替换
- 压缩后创建新 session，通过 `parent_session_id` 链回原 session

---

## 七、Gateway 机制

### 7.1 架构概述

Gateway 是消息平台集成的核心，通过单一进程同时管理多个平台的连接（Telegram、Discord、Slack 等）。

**入口**：`gateway/run.py` → `start_gateway()` → `GatewayRunner` 类

### 7.2 核心组件

| 文件 | 职责 |
|------|------|
| `gateway/run.py` | 主循环、slash 命令分发、消息路由 |
| `gateway/session.py` | `SessionStore` — 会话持久化 |
| `gateway/platforms/base.py` | `BasePlatformAdapter` — 平台适配器基类 |
| `gateway/platforms/telegram.py` | Telegram 适配器 |
| `gateway/platforms/discord.py` | Discord 适配器 |
| `gateway/platforms/slack.py` | Slack 适配器 |
| `gateway/delivery.py` | `DeliveryRouter` — 响应投递路由 |
| `gateway/pairing.py` | DM pairing（谁可以与 Agent 对话） |

### 7.3 消息路由

```
平台消息到达
    ↓
BasePlatformAdapter.receive() → MessageEvent
    ↓
GatewayRunner._handle_message() → 构建 AIAgent
    ↓
AIAgent.run_conversation()
    ↓
DeliveryRouter.route() → 发送回原平台
```

---

## 八、MCP 支持

### 8.1 MCP 客户端（`tools/mcp_tool.py`）

连接外部 MCP 服务器，将外部工具注册到 Hermes 工具 registry。

**配置（`config.yaml`）：**
```yaml
mcp_servers:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
  github:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-github"]
```

**传输支持**：
- **Stdio**：通过子进程 `command + args` 启动
- **HTTP/StreamableHTTP**：通过 URL 端点连接

### 8.2 MCP Server（`mcp_serve.py`）

Hermes 自身也可以作为 MCP Server 运行，暴露 messaging 能力给其他 MCP Client：

```bash
hermes mcp serve
```

**暴露的工具**：
- `conversations_list` — 列出对话
- `conversation_get` — 获取单个对话
- `messages_read` — 读取消息历史
- `messages_send` — 发送消息
- `channels_list` — 通道列表

---

## 九、对 LemonClaw 的参考价值

| 方面 | Hermes 做法 | LemonClaw 启示 |
|------|-----------|--------------|
| 多 API Mode | 支持 OpenAI/Anthropic/Bedrock 多协议 | LemonClaw 当前仅 minimax，可扩展 |
| 工具注册 | AST 自注册 + MCP 插件 | LemonClaw 可借鉴 |
| Session 存储 | SQLite + FTS5 全文搜索 | LemonClaw 可直接用 |
| 子 Agent | delegate_task 并行子 Agent | LemonClaw Phase 3 才需要 |
| Profile 隔离 | HERMES_HOME 环境变量 | LemonClaw 多实例场景可能需要 |
| Context 压缩 | 自动 ContextCompressor | LemonClaw 长对话场景需要 |

---

## 十、关键文件索引

| 组件 | 路径 |
|------|------|
| AIAgent | `run_agent.py` |
| CLI | `cli.py` |
| 工具注册 | `tools/registry.py` |
| 工具编排 | `model_tools.py` |
| SessionDB | `hermes_state.py` |
| Gateway | `gateway/run.py` |
| MCP 客户端 | `tools/mcp_tool.py` |
| MCP Server | `mcp_serve.py` |
| Profile 解析 | `hermes_cli/main.py` |
| 工具集定义 | `toolsets.py` |
