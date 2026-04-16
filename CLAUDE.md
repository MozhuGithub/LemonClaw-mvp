# LemonClaw MVP

基于 HomiClaw 架构增强的个人版 AI 助手桌面应用。吸纳 Hermes 的记忆系统（分层记忆/信任评分/冻结快照/上下文压缩）、OpenClaw 的运行时架构等优点。

## 技术栈

- **桌面框架**: Electron 32
- **前端**: React 18 + electron-vite + Zustand + shadcn/ui + Tailwind
- **后端**: TypeScript (主进程)
- **存储**: SQLite (better-sqlite3) + Markdown 文件
- **包管理**: pnpm
- **AI 模型**: Theta (GLM-5.1) / OpenAI 兼容接口

## 项目结构

```
src/
├── main/                # Electron 主进程
│   └── index.ts         # 入口（窗口、托盘、IPC）
├── preload/
│   └── index.ts         # contextBridge API
├── renderer/            # React 前端（electron-vite 约定）
│   ├── index.html       # HTML 入口
│   └── src/
│       ├── main.tsx     # React 入口
│       ├── App.tsx      # 根组件
│       ├── assets/      # 样式等静态资源
│       ├── pages/       # 页面（Chat, Agents, Settings）
│       ├── components/  # UI 组件（layout, chat, agents, common）
│       ├── stores/      # Zustand Stores
│       └── lib/         # host-api IPC 抽象层
└── core/                # 核心业务逻辑
    ├── agent/           # Agent 管理（继承 HomiClaw）
    ├── memory/          # 记忆系统 ⭐（参考 Hermes：分层记忆/信任评分/冻结快照/上下文压缩）
    ├── learning/        # 学习引擎 ⭐（LemonClaw 原创：经验收集/主动反思/技能修补）
    ├── skills/          # 技能系统（继承 HomiClaw + Hermes SKILL.md + 安全扫描）
    ├── llm/             # LLM 调用层
    ├── tools/           # Tool 系统
    ├── config/          # 配置管理
    └── storage/         # SQLite 存储 + Repository
```

## 架构文档

- **产品架构**: `docs/architecture/LemonClaw产品架构文档.md` — 产品定位、核心模块、竞品分析、路线图、MVP 定义
- **技术方案**: `docs/architecture/LemonClaw技术方案文档.md` — 接口定义、算法细节、错误分类、项目结构

## 开发命令

```bash
pnpm install        # 安装依赖
pnpm dev            # 开发模式（electron-vite HMR）
pnpm build          # 构建所有进程
pnpm start          # 预览构建产物
```

**注意**: 开发时需确保 `ELECTRON_RUN_AS_NODE` 环境变量未设置（dev 脚本已用 `env -u` 自动移除）。如果遇到 `Cannot read properties of undefined (reading 'whenReady')` 错误，说明该变量泄漏到了 Electron 进程。

## 核心模块（按 MVP 优先级）

1. **Agent 系统** — 多 Agent 管理、独立会话、角色化回复（继承 HomiClaw）
2. **记忆系统** — 四层分层：对话/搜索/长期/技能，信任评分，Agent 隔离，上下文压缩（参考 Hermes）
3. **学习引擎** — 经验收集 + 主动反思 + 可视化报告 + 技能即时修补（LemonClaw 原创）
4. **技能系统** — Skill Registry + MCP + 安全扫描 + 条件激活（继承 HomiClaw + Hermes）
5. **配置管理** — API Key 存系统密钥链、设置存 SQLite、分层配置

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

- API Key 通过 electron safeStorage 存入系统密钥链
- `.env` 文件不入 Git
- 不要提交包含密钥的文件
