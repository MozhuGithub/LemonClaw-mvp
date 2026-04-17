# LemonClaw MVP

基于 OpenClaw Runtime（Vendor 子进程模式）的个人 AI 助手桌面应用。用 RivonClaw 的干净集成方式，做 HomiClaw 的事情（OpenClaw + 桌面应用 + 增强功能），再加上 Hermes 的记忆和学习。

## 技术栈

- **桌面框架**: Electron 32
- **AI 运行时**: OpenClaw Gateway（子进程 vendor 模式）
- **前端**: React 18 + electron-vite + Zustand + shadcn/ui + Tailwind
- **后端**: TypeScript (主进程)
- **存储**: SQLite (better-sqlite3) + Markdown 文件
- **包管理**: pnpm
- **AI 模型**: Theta (GLM-5.1) / OpenAI 兼容接口（通过 OpenClaw Gateway 调用）

## 项目结构

```
src/
├── main/                    # Electron 主进程
│   ├── index.ts             # 入口（窗口、托盘、IPC）
│   ├── ipc-handlers.ts      # IPC 路由
│   ├── gateway/             # ⭐ Gateway 集成层（参考 RivonClaw）
│   │   ├── launcher.ts      # GatewayLauncher（spawn/stop/restart）
│   │   ├── config-bridge.ts # 配置翻译（LemonClaw → openclaw.json）
│   │   ├── secret-injector.ts # 密钥注入（→ auth-profiles.json + env）
│   │   ├── rpc-client.ts    # WebSocket RPC 客户端
│   │   └── vendor.ts        # vendor 路径解析
│   ├── memory/              # ⭐ 记忆系统（参考 Hermes）
│   │   ├── MemoryManager.ts
│   │   ├── MemoryStore.ts
│   │   ├── TrustScorer.ts
│   │   ├── ContextCompressor.ts
│   │   ├── MemoryScanner.ts
│   │   └── NudgeEngine.ts
│   ├── learning/            # ⭐ 学习引擎（LemonClaw 原创）
│   │   ├── ExperienceCollector.ts
│   │   ├── ReflectionEngine.ts
│   │   └── SkillPatcher.ts
│   └── storage/             # LemonClaw 自有存储
│       ├── database.ts
│       └── repositories/
├── preload/
│   └── index.ts             # contextBridge API
├── renderer/                # React 前端（electron-vite 约定）
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── assets/
│       ├── pages/           # Chat, Agents, Settings
│       ├── components/      # layout, chat, agents, common
│       ├── stores/          # Zustand Stores
│       └── lib/             # host-api IPC 抽象层
└── extensions/              # ⭐ OpenClaw Plugin Extensions
    ├── lemonclaw-memory/    # before_agent_start 注入记忆
    └── lemonclaw-learning/  # after_tool_call 收集经验
```

## 架构文档

- **产品架构**: `docs/architecture/LemonClaw产品架构文档.md` — 产品定位、核心模块、竞品分析、路线图、MVP 定义
- **技术方案**: `docs/architecture/LemonClaw技术方案文档.md` — Gateway 集成层、记忆系统、学习引擎、数据存储

## 参考项目源码

位于 `../references/` 目录（不在 Git 仓库内）：
- **homiclaw/** — HomiClaw 源码分析文档（架构、Gateway、LLM、Session）
- **hermes/** — Hermes Agent 源码（记忆系统、上下文压缩、技能系统）
- **openclaw/** — OpenClaw 源码（Gateway、Plugin SDK、Agent Runtime）
- **rivonclaw/** — RivonClaw 源码（Vendor 子进程集成模式）

## 开发命令

```bash
pnpm install        # 安装依赖
pnpm dev            # 开发模式（electron-vite HMR）
pnpm build          # 构建所有进程
pnpm start          # 预览构建产物
```

**注意**: 开发时需确保 `ELECTRON_RUN_AS_NODE` 环境变量未设置（dev 脚本已用 `env -u` 自动移除）。

## 核心模块（按 MVP 优先级）

1. **Gateway 集成** — GatewayLauncher + Config Bridge + RPC Client（参考 RivonClaw launcher.ts、config-writer.ts、rpc-client.ts）
2. **记忆系统** — 四层记忆 + 信任评分 + 冻结快照 + 上下文压缩（参考 Hermes memory_manager.py、context_compressor.py）
3. **学习引擎** — 经验收集 + 主动反思 + 技能修补（LemonClaw 原创）
4. **Plugin Extensions** — 记忆注入 + 经验收集 hook（参考 RivonClaw extensions/）

## 工作模式

- 晚间在 Windows 开发，push 到 GitHub
- 白天在公司 Mac pull 验证，通过内部工具传递提示词
- 提示词存档在 `docs/daily/` 下，按 `日期-标题.md` 命名

## 编码规范

- TypeScript: 使用接口定义类型，避免 `any`
- React: 函数组件 + Hooks，状态用 useState，副作用用 useEffect
- 样式: Tailwind CSS 类名，不要行内样式（除动态颜色）
- 路径: 统一用 `path.join()` / `path.resolve()`，不硬编码斜杠

## 敏感信息

- API Key 通过 Secret Injector 写入 auth-profiles.json，持久存储用 electron safeStorage + 系统密钥链
- `.env` 文件不入 Git
- 不要提交包含密钥的文件
