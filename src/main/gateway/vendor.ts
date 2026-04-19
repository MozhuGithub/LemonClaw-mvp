import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
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
  return join(app.getAppPath(), 'vendor', 'openclaw')
}

export function getVendorEntryPath(): string {
  // 1. 优先用项目 vendor 目录（需已构建，dist/ 目录存在）
  const vendorDir = getVendorDir()
  const vendorEntry = join(vendorDir, 'openclaw.mjs')
  const vendorDist = join(vendorDir, 'dist', 'entry.js')
  if (existsSync(vendorEntry) && existsSync(vendorDist)) {
    return vendorEntry
  }

  // 2. 回退到全局 npm 安装（已包含构建产物）
  const globalPath = getGlobalOpenClawPath()
  if (existsSync(globalPath)) {
    return globalPath
  }

  throw new Error(
    `OpenClaw entry not found.\n` +
    `Vendor path: ${vendorEntry} (dist missing, run: cd vendor/openclaw && pnpm build)\n` +
    `Global path not found: ${globalPath}\n` +
    `Install globally: npm install -g openclaw@latest`
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
 * 返回 Node.js 二进制路径，用于启动 Gateway 子进程。
 *
 * OpenClaw 要求 Node.js v22.12+，Electron 32 内置 Node v20.x 不满足。
 * 因此使用系统 Node.js（通过 PATH 解析），而非 Electron 二进制。
 *
 * 开发模式：系统 Node.js（需 v22+）
 * 生产模式：同上（打包后仍需系统 Node.js，或后续打包 Node runtime）
 */
export function getNodeBin(): string {
  return 'node'
}

export function getVendorVersion(): string {
  const vendorDir = getVendorDir()
  try {
    const pkg = JSON.parse(readFileSync(join(vendorDir, 'package.json'), 'utf-8'))
    if (pkg.version) return pkg.version
  } catch { /* ignore */ }
  return '0.0.0'
}
