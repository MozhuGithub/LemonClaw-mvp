import { ipcMain, BrowserWindow } from 'electron'
import { GatewayLauncher, type GatewayState } from './gateway/launcher'
import { GatewayRpcClient } from './gateway/rpc-client'
import { buildGatewayConfig, writeGatewayConfig, getChangePolicy } from './gateway/config-bridge'
import { injectToAuthProfiles, type ProviderKey } from './gateway/secret-injector'

let launcher: GatewayLauncher | null = null
let rpcClient: GatewayRpcClient | null = null
let providerKeys: ProviderKey[] = []

export function initIpcHandlers(): void {
  // === Gateway ===

  ipcMain.handle('gateway:start', async () => {
    // 确保 Gateway 启动前配置文件已写入
    const config = buildGatewayConfig(3212)
    writeGatewayConfig(config)

    if (!launcher) {
      launcher = new GatewayLauncher(3212, providerKeys)
      launcher.on('stateChange', (state: GatewayState) => {
        console.log('[gateway:state]', state)
        BrowserWindow.getAllWindows().forEach(w => w.webContents.send('gateway:stateChange', state))
      })
      launcher.on('stdout', (line: string) => {
        console.log('[gateway:stdout]', line)
        if (line.includes('listening on') && launcher) {
          const port = launcher.getPort()
          console.log('[gateway] detected listening, connecting RPC on port', port)
          rpcClient = new GatewayRpcClient(port)
          rpcClient.on('connected', () => {
            console.log('[gateway:rpc] connected')
            BrowserWindow.getAllWindows().forEach(w => w.webContents.send('gateway:stateChange', 'running'))
          })
          rpcClient.on('disconnected', () => {
            console.log('[gateway:rpc] disconnected')
          })
          rpcClient.on('event', (event: string, payload: any) => {
            BrowserWindow.getAllWindows().forEach(w => w.webContents.send('chat:event', event, payload))
          })
          rpcClient.connect().then(() => {
            console.log('[gateway:rpc] handshake completed')
          }).catch((err) => {
            console.error('[gateway:rpc] handshake failed:', err.message)
          })
        }
      })
      launcher.on('stderr', (line: string) => {
        console.error('[gateway:stderr]', line)
      })
    }
    await launcher.start()
    return { state: launcher.getState(), port: launcher.getPort() }
  })

  ipcMain.handle('gateway:stop', async () => {
    await rpcClient?.disconnect()
    rpcClient = null
    await launcher?.stop()
  })

  ipcMain.handle('gateway:restart', async () => {
    await rpcClient?.disconnect()
    rpcClient = null
    await launcher?.restart()
  })

  ipcMain.handle('gateway:state', () => {
    return launcher?.getState() ?? 'stopped'
  })

  // === Chat ===

  ipcMain.handle('chat:send', async (_event, sessionKey: string, message: string) => {
    if (!rpcClient?.isConnected()) throw new Error('Gateway not connected')
    await rpcClient.chatSend(sessionKey, message)
  })

  ipcMain.handle('chat:history', async (_event, sessionKey: string) => {
    if (!rpcClient?.isConnected()) throw new Error('Gateway not connected')
    return rpcClient.chatHistory(sessionKey)
  })

  // === Agents ===

  ipcMain.handle('agents:list', async () => {
    if (!rpcClient?.isConnected()) throw new Error('Gateway not connected')
    return rpcClient.agentsList()
  })

  // === Config ===

  ipcMain.handle('config:setModel', async (_event, model: string) => {
    if (!launcher) throw new Error('Gateway not initialized')
    const oldConfig = buildGatewayConfig(launcher.getPort())
    const newConfig = buildGatewayConfig(launcher.getPort(), { model })
    const policy = getChangePolicy(oldConfig, newConfig)
    writeGatewayConfig(newConfig)

    if (policy === 'reload_config') {
      await launcher.reload()
    } else if (policy === 'restart_process') {
      await launcher.restart()
    }
  })

  ipcMain.handle('config:setApiKey', async (_event, provider: string, apiKey: string) => {
    const existing = providerKeys.find(k => k.provider === provider)
    if (existing) {
      existing.apiKey = apiKey
    } else {
      providerKeys.push({ id: provider, provider, apiKey })
    }
    launcher?.setProviderKeys(providerKeys)
    injectToAuthProfiles(providerKeys)
  })
}
