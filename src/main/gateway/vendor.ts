import { join, resolve } from 'path'
import { existsSync } from 'fs'
import { app } from 'electron'

/**
 * OpenClaw vendor 路径解析。
 *
 * 开发模式：项目根目录下的 vendor/openclaw/
 * 生产模式：resources/vendor/openclaw/
 *
 * 使用 Electron 二进制 + ELECTRON_RUN_AS_NODE=1 运行 Gateway 子进程，
 * 与 RivonClaw 的方式一致。OpenClaw 要求 Node.js >= 22.12。
 */

function getVendorDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'vendor', 'openclaw')
  }
  return resolve(__dirname, '../../../vendor/openclaw')
}

export function getVendorEntryPath(): string {
  const dir = getVendorDir()
  const entry = join(dir, 'openclaw.mjs')
  if (!existsSync(entry)) {
    throw new Error(
      `OpenClaw entry not found: ${entry}\n` +
      'Run: git clone --depth 1 https://github.com/openclaw/openclaw.git vendor/openclaw'
    )
  }
  return entry
}

export function getVendorDirPath(): string {
  return getVendorDir()
}

/**
 * 使用 Electron 二进制作为 Node 运行时。
 * launcher.ts 会设置 ELECTRON_RUN_AS_NODE=1 使其以 Node 模式运行。
 */
export function getNodeBin(): string {
  return process.execPath
}
