# LemonClaw MVP

> 基于 HomiClaw 架构增强的个人版 AI 助手桌面应用

## 简介

LemonClaw 是一个基于 Electron + React 的桌面 AI 助手应用，继承 HomiClaw 的多 Agent 架构，参考 Hermes 的记忆系统，让 AI 越用越懂你。

核心特性：
- **多 Agent 系统** — 多个 AI 助手各司其职，独立会话、独立记忆
- **长期记忆系统** — 四层分层架构 + 信任评分 + 上下文压缩（参考 Hermes）
- **主动学习引擎** — 经验收集 + 定期反思 + 可视化学习报告（LemonClaw 原创）
- **技能系统** — 内置技能 + MCP 协议扩展 + 安全扫描

## 技术栈

Electron 32 | React 18 | electron-vite | Zustand | TypeScript | SQLite | Tailwind

## 快速开始

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build

# 预览构建产物
pnpm start
```

## 文档

- [产品架构文档](docs/architecture/LemonClaw产品架构文档.md)
- [技术方案文档](docs/architecture/LemonClaw技术方案文档.md)
- [MVP 进度跟踪](docs/planning/LemonClawMVP进度跟踪.md)
- [每日开发记录](docs/daily/)

## 开发环境要求

- Node.js >= 20
- pnpm >= 8

## License

MIT
