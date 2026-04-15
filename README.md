# LemonClaw MVP

> 基于多 Agent 的 AI 助手桌面应用

## 简介

LemonClaw 是一个基于 Electron + React 的桌面 AI 助手应用，支持多个 Agent 并行工作，每个 Agent 拥有独立的角色、配置和对话历史。

核心功能：
- 多 Agent 系统 — 同时运行多个 AI 助手，各司其职
- 智能规则引擎 — 基于时间/关键词定义 AI 行为规则
- 长期记忆系统 — 跨会话记忆，让 AI 越用越懂你
- 中文友好 — 完整的中文界面和文档

## 技术栈

Electron 28 | React 18 | Vite 5 | Zustand | TypeScript | SQLite

## 快速开始

```bash
# 安装依赖
pnpm install

# 复制环境变量配置
cp .env.example .env
# 编辑 .env 填入你的 API Key

# 开发模式
pnpm dev

# 构建
pnpm build

# 打包
pnpm package
```

## 文档

- [项目架构](docs/architecture/)
- [MVP 规划](docs/planning/)
- [每日开发记录](docs/daily/)
- [开发指南](docs/guides/)

## 开发环境要求

- Node.js >= 20
- pnpm >= 8

## License

MIT
