import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { initIpcHandlers } from './ipc-handlers'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'LemonClaw',
    icon: join(__dirname, '../../resources/icon/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // electron-vite 自动处理 dev/prod 路径
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  initIpcHandlers()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

// === App IPC ===

ipcMain.handle('app:ping', () => {
  return 'pong from LemonClaw main process'
})

ipcMain.handle('app:getInfo', () => {
  return {
    name: 'LemonClaw',
    version: app.getVersion(),
    platform: process.platform,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
  }
})
