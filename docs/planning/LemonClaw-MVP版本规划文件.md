# LemonClaw MVP 开发计划

> 最小可行产品 - 4 周上线
> 
> 版本：v0.1.0
> 日期：2026-04-15

---

## 📋 MVP 目标

**4 周内交付一个可以实际使用的 LemonClaw 桌面应用**

核心功能：
- ✅ 能和 AI 对话
- ✅ 能配置规则
- ✅ 能记住用户信息
- ✅ 有图形界面
- ✅ 一键安装

---

## 🎯 MVP 功能清单

### ✅ 必须包含（P0 优先级）

| 模块 | 功能 | 说明 |
|------|------|------|
| **基础框架** | Electron 桌面应用 | Windows/macOS 可运行 |
| **聊天界面** | 发送/接收消息 | 基础对话功能 |
| **单 Agent** | 一个 AI 助手 | 多 Agent 后续加 |
| **模型调用** | Theta/OpenAI | 至少支持一个 |
| **配置界面** | API Key 配置 | 图形化配置 |
| **规则引擎** | 基础规则 | 时间/关键词条件 |
| **长期记忆** | 用户信息存储 | SQLite 存储 |
| **安装包** | .exe/.dmg | 一键安装 |

---

### ⚠️ 可以简化（P1 优先级）

| 模块 | 简化方案 | 完整版后续加 |
|------|---------|-------------|
| **规则配置** | YAML 配置文件 | 图形界面 V2 |
| **记忆管理** | 自动管理 | 手动编辑界面 V2 |
| **Tool 可视化** | 基础日志 | 可视化界面 V2 |
| **多会话** | 简单列表 | 会话管理 V2 |

---

### ❌ 不做（V2 版本）

| 功能 | 原因 |
|------|------|
| 多 Agent 并行 | 复杂度高，单 Agent 够用 |
| 技能市场 | MVP 不需要生态 |
| 向量搜索 | SQLite 关键词搜索足够 |
| 审批流程 | 基础功能优先 |
| Token 统计 | 非核心功能 |
| 同步功能 | 单机版足够 |

---

## 📦 MVP 技术栈

### 简化选择

| 选择 | 理由 |
|------|------|
| **Electron** | 跨平台，一套代码 |
| **React + Vite** | 快速开发，热重载 |
| **Zustand** | 轻量状态管理 |
| **SQLite** | 本地存储，无需服务器 |
| **pnpm** | 快速安装 |
| **TypeScript** | 类型安全，减少 bug |

### 依赖清单

```json
{
  "dependencies": {
    "electron": "^28.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.5.0",
    "better-sqlite3": "^9.0.0",
    "openai": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "@electron-forge/cli": "^7.0.0"
  }
}
```

---

## 🗓️ 4 周开发计划

### Week 1: 基础框架

**目标**：能运行的 Electron 应用

**Daily Plan**：

#### Day 1-2: 项目初始化
```bash
# 创建项目
mkdir lemonclaw-mvp
cd lemonclaw-mvp
pnpm init

# 安装 Electron
pnpm add electron
pnpm add -D electron-forge typescript

# 初始化配置
npx electron-forge import
```

**验收**：
- ✅ 项目结构创建
- ✅ Electron 能启动
- ✅ 显示空白窗口

---

#### Day 3-4: 基础 UI
```
创建文件：
├── src/
│   ├── main/
│   │   └── main.ts          # 主进程
│   └── renderer/
│       ├── App.tsx          # React 根组件
│       ├── index.tsx        # 入口
│       └── Chat.tsx         # 聊天界面
```

**验收**：
- ✅ React 集成
- ✅ 聊天界面显示
- ✅ 输入框 + 发送按钮

---

#### Day 5: IPC 通信
```typescript
// 主进程
ipcMain.handle('chat:send', async (event, message) => {
  // 转发给 Agent
  return await agent.process(message);
});

// 渲染进程
const response = await window.electron.invoke('chat:send', message);
```

**验收**：
- ✅ 前后端通信
- ✅ 发送消息有响应

---

#### Day 6-7: 集成 OpenClaw
```bash
# 方式 1：vendor
git clone GitHub - openclaw/openclaw: Your own personal AI assistant. Any OS. Any Platform. The lobster way. 🦞 vendor/openclaw

# 方式 2：NPM
pnpm add @openclaw/core
```

**验收**：
- ✅ OpenClaw 集成
- ✅ 能调用 LLM API

---

### Week 2: 核心功能

**目标**：规则引擎 + 记忆系统

#### Day 8-9: 规则引擎
```
创建：
├── src/core/rules/
│   ├── RuleEngine.ts        # 规则引擎核心
│   ├── RuleStore.ts         # SQLite 存储
│   └── types.ts             # 类型定义
```

**功能**：
- ✅ 规则存储（SQLite）
- ✅ 规则匹配（时间/关键词）
- ✅ 规则执行（立即回复/免打扰）

**验收**：
- ✅ 能添加规则
- ✅ 规则能匹配执行

---

#### Day 10-12: 记忆系统
```
创建：
├── src/core/memory/
│   ├── MemoryManager.ts     # 记忆管理
│   └── MemoryStore.ts       # SQLite 存储
```

**功能**：
- ✅ 短期记忆（最近 20 条）
- ✅ 长期记忆（用户信息）
- ✅ LLM 提取关键信息

**验收**：
- ✅ 能记住用户信息
- ✅ 下次对话能检索

---

#### Day 13-14: 配置系统
```
创建：
├── src/renderer/pages/
│   └── Settings.tsx         # 设置界面
```

**功能**：
- ✅ API Key 配置
- ✅ 模型选择
- ✅ 规则配置界面

**验收**：
- ✅ 图形化配置
- ✅ 配置保存生效

---

### Week 3: 完善体验

**目标**：可用、好用

#### Day 15-17: 聊天优化
```
功能：
- 消息气泡样式
- 已读标记
- 输入框优化
- 加载状态
- 错误处理
```

**验收**：
- ✅ 界面美观
- ✅ 交互流畅

---

#### Day 18-19: 会话管理
```
功能：
- 新建会话
- 切换会话
- 删除会话
- 会话列表
```

**验收**：
- ✅ 多会话支持
- ✅ 会话隔离

---
#### Day 20-21: 日志 + 调试
```
功能：
- 应用日志
- 开发者工具
- 错误报告
```

**验收**：
- ✅ 问题可排查
- ✅ 日志完整

---

### Week 4: 打包发布

**目标**：可分发的安装包

#### Day 22-24: 打包配置
```javascript
// forge.config.js
module.exports = {
  packagerConfig: {
    asar: true,
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: { name: 'LemonClaw' },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
  ],
};
```

**验收**：
- ✅ Windows .exe 生成
- ✅ macOS .dmg 生成

---

#### Day 25-26: 测试
```
测试清单：
□ 安装测试（Win + Mac）
□ 对话功能测试
□ 规则引擎测试
□ 记忆系统测试
□ 配置保存测试
□ 性能测试
```

**验收**：
- ✅ 所有功能正常
- ✅ 无严重 bug

---

#### Day 27-28: 文档 + 发布
```
文档：
├── README.md           # 项目说明
├── INSTALL.md          # 安装指南
├── CONFIG.md           # 配置说明
└── CHANGELOG.md        # 更新日志
```

**发布**：
- GitHub Releases
- 内部测试群
- 用户反馈收集

---

## 🚀 如何开始尝试

### 第一步：创建项目（今天）

```bash
# 1. 创建目录
cd /Users/kangning/Projects
mkdir LemonClaw-homi-mvp
cd LemonClaw-homi-mvp

# 2. 初始化
pnpm init

# 3. 创建目录结构
mkdir -p src/{main,renderer,core/{rules,memory}}
mkdir -p config
mkdir -p docs

# 4. 创建基础文件
touch README.md
touch package.json
touch tsconfig.json
touch src/main/main.ts
touch src/renderer/App.tsx
```

---

### 第二步：安装依赖（今天）

```bash
# 核心依赖
pnpm add electron react react-dom zustand better-sqlite3 openai

# 开发依赖
pnpm add -D typescript vite @electron-forge/cli @vitejs/plugin-react

# 初始化 Electron Forge
npx electron-forge import
```

---

### 第三步：基础代码（明天）

**package.json**：
```json
{
  "name": "lemonclaw-mvp",
  "version": "0.1.0",
  "main": "src/main/main.ts",
  "scripts": {
    "start": "electron-forge start",
    "package": "electron-forge package",
    "make": "electron-forge make"
  }
}
```

**src/main/main.ts**：
```typescript
import { app, BrowserWindow } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  mainWindow.loadFile('src/renderer/index.html');
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);
```

**src/renderer/App.tsx**：
```tsx
import React from 'react';

function App() {
  return (
    <div>
      <h1>LemonClaw MVP</h1>
      <p>Hello World!</p>
    </div>
  );
}

export default App;
```

---

### 第四步：运行测试（明天）

```bash
# 启动开发环境
pnpm start
```

**预期**：
- ✅ Electron 窗口打开
- ✅ 显示"Hello World!"
- ✅ 开发者工具打开

---

## ✅ MVP 验收清单

### 功能验收

| 功能 | 验收标准 | 状态 |
|------|---------|------|
| 启动应用 | 双击图标打开 | □ |
| 聊天对话 | 能发送并收到回复 | □ |
| API 配置 | 图形界面配置 API Key | □ |
| 规则配置 | 能添加时间/关键词规则 | □ |
| 记忆功能 | 能记住用户姓名并在下次使用 | □ |
| 多会话 | 能新建和切换会话 | □ |
| 安装包 | 生成 .exe 和 .dmg | □ |

---

### 性能验收

| 指标 | 目标 | 状态 |
|------|------|------|
| 启动时间 | < 5 秒 | □ |
| 消息响应 | < 2 秒（不含 LLM） | □ |
| 内存占用 | < 500MB | □ |
| 安装包大小 | < 200MB | □ |

---

### 兼容性验收

| 系统 | 版本 | 状态 |
|------|------|------|
| Windows | 10 64 位 | □ |
| macOS | 10.15+ | □ |

---

## 🎯 成功标准

**MVP 成功 = 用户能做这些**：

1. ✅ 下载安装包，双击安装
2. ✅ 打开应用，配置 API Key
3. ✅ 和 AI 正常对话
4. ✅ 配置规则："工作时间立即回复"
5. ✅ 告诉 AI 自己的名字，下次对话 AI 记得
6. ✅ 新建多个会话，互不干扰

**如果用户能做到这 6 点，MVP 就成功了！** 🎉

---

## 📚 参考资源

### 快速开始模板
```bash
# Electron + React + TypeScript 模板
git clone https://github.com/electron/forge-with-vite-react-template
cd forge-with-vite-react-template
pnpm install
pnpm start
```

### 相关文档
- [Electron 快速开始](https://www.electronjs.org/docs/latest/tutorial/quick-start)
- [Vite 配置指南](https://vitejs.dev/guide/)
- [Zustand 教程](GitHub - pmndrs/zustand: 🐻 Bear necessities for state management in React)

---

**准备好开始了吗？今天先创建项目，明天看到 Hello World 窗口！** 🚀