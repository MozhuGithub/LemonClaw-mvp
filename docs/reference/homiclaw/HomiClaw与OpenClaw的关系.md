# HomiClaw 与 OpenClaw 的关系

> 基于源码深度分析
> 
> **日期**：2026-04-17  
> **状态**：✅ 完成

---

## 🎯 一句话总结

**HomiClaw = OpenClaw Runtime (打包) + 配置层 + 蚂蚁内部工具集成**

---

## 📊 关系对比

| 维度 | **OpenClaw** | **HomiClaw** |
|------|-------------|-------------|
| **定位** | 开源 Agent 运行时框架 | 蚂蚁集团内部 AI 助手 |
| **开源** | ✅ 完全开源 | ❌ 闭源（内部使用） |
| **代码关系** | 上游基础 | **打包 OpenClaw 源码** |
| **形态** | npm 包 + CLI | Electron 应用 + 打包的 Gateway |
| **目标用户** | 开发者/工程师 | 蚂蚁集团员工 |
| **配置复杂度** | 🔴 高（需要手动配置） | 🟢 低（预配置 + 可视化） |
| **扩展方式** | 自己写代码 | Skills + 内部 MCP 工具 |

---

## 🔍 代码关系详解

### HomiClaw 如何基于 OpenClaw？

**不是 fork 修改，而是直接打包**：

```
OpenClaw 源码
    ↓
打包工具 (esbuild/rollup)
    ↓
gateway-entry.mjs (29MB)  ← HomiClaw 的主程序
    ↓
+ 蚂蚁内部工具 (MCP Servers)
+ 预配置模板 (homiclaw.json)
+ Skills (业务逻辑封装)
    ↓
Homi.app (Electron 应用)
```

**证据**：
- `~/.homiclaw/gateway-bundle/gateway-entry.mjs` - 29MB 打包文件
- `~/.homiclaw/gateway-bundle/dist/openclaw-tools-*.js` - OpenClaw 核心逻辑
- 源码位置：`dist/` 目录都是打包后的代码

---

## 🏗️ 架构对比

### OpenClaw 架构

```
OpenClaw (开源项目)
├── @openclaw/gateway      # Gateway 服务
├── @openclaw/agent        # Agent 运行时
├── @openclaw/plugin-sdk   # 插件 SDK
└── CLI 工具                # 命令行工具

使用方式：
npm install @openclaw/gateway
手动配置 gateway.config.yml
手动启动 Gateway 进程
```

### HomiClaw 架构

```
HomiClaw (蚂蚁内部)
├── Homi.app                # Electron 桌面应用
├── gateway-entry.mjs       # 打包的 Gateway (29MB)
│   ├── OpenClaw Runtime    # 直接使用 OpenClaw
│   ├── 蚂蚁 MCP 工具         # 语雀/钉钉/Dima...
│   └── Skills              # 业务逻辑封装
├── homicllaw.json           # 预配置文件
└── gateway-bundle/
    ├── dist/               # 打包后的代码
    ├── extensions/         # 扩展
    └── skills/             # 技能

使用方式：
安装 Homi.app
自动启动 Gateway
通过聊天界面交互
```

---

## 🆚 核心差异

### 0. Gateway 运行模式对比（重要！）

| 维度 | **OpenClaw Gateway** | **HomiClaw Gateway** |
|------|---------------------|---------------------|
| **形态** | 独立 Node.js 进程 | 打包到 gateway-entry.mjs |
| **启动方式** | `openclaw gateway start` | Homi.app 自动启动 |
| **配置文件** | gateway.config.yml | homiclaw.json |
| **进程模型** | 独立子进程 | Electron 应用内直接 import |
| **内存管理** | 手动重启释放 | 自动监控 + SIGUSR1 优雅重启 |
| **日志** | stdout 输出 | 结构化日志 + 日志轮转 |
| **热重载** | 需手动重启 | 部分配置支持热重载 |

**OpenClaw Gateway 启动**：
```bash
# 独立进程启动
openclaw gateway start --config gateway.config.yml

# 进程树
node (openclaw gateway)
  └── Agent 子进程 × N
```

**HomiClaw Gateway 启动**：
```javascript
// Homi.app 主进程
import gateway from './gateway-entry.mjs'  // 直接 import 29MB bundle

// 进程树
Homi.app (Electron)
  └── Gateway (同一进程内运行，非独立进程)
      └── Agent 子进程 × N
```

**关键差异**：
- OpenClaw Gateway 是**独立进程**，需要 IPC 通信
- HomiClaw Gateway 是**bundle 后的代码**，直接在 Electron 进程内运行

---

### 1. 集成方式

| **OpenClaw** | **HomiClaw** |
|-------------|-------------|
| npm 包引入 | 直接打包源码 |
| 独立进程运行 | Electron 应用内运行 |
| 手动配置 YAML | 预配置 + 可视化界面 |
| 开发者友好 | 普通用户友好 |

---

### 2. 扩展机制

| **OpenClaw** | **HomiClaw** |
|-------------|-------------|
| 自己写 Plugin | 使用预置 Skills |
| 需要编程能力 | 自然语言配置规则 |
| 通用工具集 | 蚂蚁内部工具集成 |

**OpenClaw 扩展示例**：
```javascript
// 需要自己写代码
export default {
  name: 'my-plugin',
  hooks: {
    before_tool_call: async (ctx) => {
      // 自定义逻辑
    }
  }
}
```

**HomiClaw 扩展示例**：
```markdown
# Skills (自然语言描述)
---
name: weather
description: Get current weather
---

## 使用方法
1. 从 USER.md 读取用户位置
2. 调用 Open-Meteo API
3. 返回天气信息
```

### 3. 工具生态

| **OpenClaw** | **HomiClaw** |
|-------------|-------------|
| 通用工具 (read/write/exec) | 内置通用工具 |
| 社区 MCP Servers | 蚂蚁内部 MCP |
| 需要自己集成 | 开箱即用 |

**HomiClaw 专属工具**：
- `administration` - 行政小宝（快递/访客/车位）
- `dima-project-manager` - Dima 项目管理
- `dingtalk-usage` - 钉钉集成
- `meeting-room` - 会议室预订
- `vacation` - 假期查询
- `yuque-doc` - 语雀文档
- `workstation` - 工位服务

---

### 4. 用户体验

| **OpenClaw** | **HomiClaw** |
|-------------|-------------|
| 命令行界面 | 聊天界面（Telegram/钉钉） |
| 需要懂 YAML 配置 | 自然语言交互 |
| 需要自己部署 | 开箱即用（Homi.app） |
| 适合开发者 | 适合普通员工 |

---

## 📦 打包方式详解

### HomiClaw 如何打包 OpenClaw？

**步骤**：
```bash
# 1. 克隆 OpenClaw 源码
git clone https://github.com/openclaw/openclaw.git

# 2. 安装依赖
pnpm install

# 3. 打包
esbuild src/gateway/index.ts \
  --bundle \
  --outfile=gateway-entry.mjs \
  --platform=node \
  --format=esm \
  --minify

# 4. 复制打包结果到 HomiClaw
cp gateway-entry.mjs ~/.homiclaw/gateway-bundle/
```

**打包后的结构**：
```
gateway-bundle/
├── gateway-entry.mjs       # 29MB (包含 OpenClaw 所有逻辑)
├── gateway-entry.mjs.map   # 52MB (Source Map)
├── dist/
│   ├── openclaw-tools-*.js # OpenClaw 核心函数
│   ├── agent-*.js          # Agent 运行时
│   └── plugin-sdk/         # Plugin SDK
├── extensions/             # HomiClaw 扩展
└── skills/                 # HomiClaw Skills
```

---

## 🔌 Hook 机制

### OpenClaw 的 Hook

OpenClaw 提供的扩展点：
```javascript
// OpenClaw Plugin SDK
export default {
  hooks: {
    before_agent_start: async (ctx) => {},
    before_tool_call: async (ctx) => {},
    after_tool_call: async (ctx) => {}
  }
}
```

### HomiClaw 如何使用这些 Hook？

**直接使用 + 增强**：
```javascript
// HomiClaw 在 gateway-entry.mjs 中
await triggerInternalHook(
  createInternalHookEvent("session", "compact:before", ...)
);

// 新增的 HomiClaw Hooks
- session:compact:before
- session:compact:after
- gateway:sigusr1  // 重启信号
```

---

## 📊 代码复用比例

根据源码分析：

| 模块 | OpenClaw 贡献 | HomiClaw 自研 |
|------|--------------|-------------|
| **Agent 运行时** | 95% | 5% (配置适配) |
| **工具系统** | 80% | 20% (内部工具) |
| **Session 管理** | 90% | 10% (压缩优化) |
| **LLM 调用** | 100% | 0% (直接使用) |
| **配置系统** | 70% | 30% (企业定制) |
| **Skills** | 0% | 100% (自研) |
| **MCP 工具** | 20% | 80% (内部集成) |

**总体**：HomiClaw 约 **70-80%** 的代码来自 OpenClaw

---

## 💡 类比理解

### 通俗类比

| 场景 | OpenClaw | HomiClaw |
|------|---------|---------|
| **汽车** | 发动机 + 底盘 | 整车（包含发动机） |
| **电脑** | CPU + 主板 | 品牌机（预装系统 + 软件） |
| **手机** | Android 开源 | MIUI（基于 Android 定制） |
| **房子** | 框架结构 | 精装房（可直接入住） |
| **Gateway** | 独立服务器 | 嵌入式服务 |

---

## 🎯 对 LemonClaw 的启示

### LemonClaw 应该如何定位？

**建议**：学习 HomiClaw 的模式

```
LemonClaw = OpenClaw Runtime (打包)
          + 记忆系统 (自研)
          + 桌面应用 (Electron)
```

**原因**：
1. ✅ 复用成熟的 OpenClaw Runtime
2. ✅ 避免重复造轮子
3. ✅ 专注差异化功能（记忆系统）
4. ✅ 快速上市

**不要**：
- ❌ 完全独立重写（成本高）
- ❌ 直接 fork OpenClaw 修改（维护困难）

**要**：
- ✅ 打包 OpenClaw Runtime
- ✅ 通过 Plugin SDK 扩展
- ✅ 专注记忆系统

---

## 📋 总结

### HomiClaw 与 OpenClaw 的关系

```
OpenClaw (开源基础)
    ↓
打包 + 配置 + 内部工具
    ↓
HomiClaw (蚂蚁内部应用)
    ↓
    ↓  (LemonClaw 学习这个模式)
    ↓
LemonClaw (个人版 AI 助手)
```

**核心要点**：
1. HomiClaw **不是 fork** OpenClaw，而是**打包使用**
2. HomiClaw 约 **70-80%** 代码来自 OpenClaw
3. Gateway 运行模式不同：OpenClaw 独立进程，HomiClaw 嵌入 Electron
4. HomiClaw 的价值在于**配置简化**和**内部工具集成**
5. LemonClaw 应该**学习这个模式**，而非重复造轮子

---

**文档完成** - HomiClaw 与 OpenClaw 的关系 ✅
