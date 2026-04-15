# LemonClaw MVP

基于 Electron + React 的多 Agent AI 助手桌面应用。

## 技术栈

- **桌面框架**: Electron 28
- **前端**: React 18 + Vite 5 + Zustand
- **后端**: TypeScript (主进程)
- **存储**: SQLite (better-sqlite3)
- **包管理**: pnpm
- **AI 模型**: Theta (GLM-5.1) / OpenAI 兼容接口

## 项目结构

```
src/
├── main/           # Electron 主进程（窗口管理、IPC）
├── preload/        # 预加载脚本（IPC 桥接）
├── renderer/       # React 前端
│   ├── components/ # UI 组件
│   ├── pages/      # 页面
│   └── styles/     # 样式
├── core/           # 核心业务逻辑
│   ├── agent/      # Agent 管理（多 Agent 系统）
│   ├── rules/      # 规则引擎（时间/关键词条件）
│   ├── memory/     # 记忆系统（短期/长期记忆）
│   └── config/     # 配置管理
resources/          # 应用资源（图标等）
config/             # 配置文件
docs/               # 文档
├── architecture/   # 架构设计
├── planning/       # 规划文档
├── daily/          # 每日开发记录
└── guides/         # 开发指南
```

## 开发命令

```bash
pnpm install        # 安装依赖
pnpm dev            # 开发模式（热加载）
pnpm build          # 构建
pnpm start          # 启动应用
pnpm package        # 打包安装包
```

## 核心模块（按 MVP 优先级）

1. **Agent 系统** — 多 Agent 管理、独立会话、角色化回复
2. **规则引擎** — 时间/关键词条件匹配、动作执行
3. **记忆系统** — 短期记忆（会话上下文）、长期记忆（SQLite 存储）
4. **配置管理** — API Key、模型选择、Agent 配置

## 工作模式

- 晚间在 Windows 开发，push 到 GitHub
- 白天在公司 Mac pull 验证，通过内部工具传递提示词
- 提示词存档在 `docs/daily/` 下，按 `日期-标题.md` 命名

## 编码规范

- TypeScript: 使用接口定义类型，避免 `any`
- React: 函数组件 + Hooks，状态用 useState，副作用用 useEffect
- 样式: 使用 CSS 类名，不要行内样式（除动态颜色）
- 路径: 统一用 `path.join()` / `path.resolve()`，不硬编码斜杠

## 敏感信息

- API Key 存在 `.env` 文件中，不入 Git
- 不要提交 config.js 或包含密钥的文件
