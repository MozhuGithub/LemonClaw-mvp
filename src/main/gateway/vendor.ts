import { join, resolve } from 'path'
import { existsSync } from 'fs'
import { app } from 'electron'
import { homedir } from 'os'

/**
 * OpenClaw vendor 路径解析。
 *
 * 优先级：
 * 1. 项目 vendor/openclaw/（开发模式，需先 clone 并 pnpm install）
 * 2. 全局 npm 安装（C:/Users/<user>/AppData/Roaming/npm/node_modules/openclaw/）
 * 3. resources/vendor/openclaw/（生产打包模式）
 *
 * 使用 Electron 二进制 + ELECTRON_RUN_AS_NODE=1 运行 Gateway 子进程。
 */

function getGlobalOpenClawPath(): string {
  return join(homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', 'openclaw', 'openclaw.mjs')
}

function getVendorDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'vendor', 'openclaw')
  }
  return resolve(__dirname, '../../../vendor/openclaw')
}

export function getVendorEntryPath(): string {
  // 1. 优先用项目 vendor 目录
  const vendorDir = getVendorDir()
  const vendorEntry = join(vendorDir, 'openclaw.mjs')
  if (existsSync(vendorEntry)) {
    return vendorEntry
  }

  // 2. 回退到全局 npm 安装
  const globalPath = getGlobalOpenClawPath()
  if (existsSync(globalPath)) {
    return globalPath
  }

  throw new Error(
    `OpenClaw entry not found.\n` +
    `Vendor path not found: ${vendorEntry}\n` +
    `Global path not found: ${globalPath}\n` +
    `Clone vendor: git clone --depth 1 https://github.com/openclaw/openclaw.git vendor/openclaw\n` +
    `Then install deps: cd vendor/openclaw && pnpm install`
  )
}

export function getVendorDirPath(): string {
  const vendorDir = getVendorDir()
  if (existsSync(join(vendorDir, 'openclaw.mjs'))) {
    return vendorDir
  }
  return join(homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', 'openclaw')
}

/**
 * 使用 Electron 二进制作为 Node 运行时。
 * launcher.ts 会设置 ELECTRON_RUN_AS_NODE=1 使其以 Node 模式运行。
 */
export function getNodeBin(): string {
  return process.execPath
}
