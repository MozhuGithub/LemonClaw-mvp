import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('lemonclaw', {
  // App
  ping: () => ipcRenderer.invoke('app:ping'),
  getInfo: () => ipcRenderer.invoke('app:getInfo'),

  // Gateway
  gatewayStart: () => ipcRenderer.invoke('gateway:start'),
  gatewayStop: () => ipcRenderer.invoke('gateway:stop'),
  gatewayRestart: () => ipcRenderer.invoke('gateway:restart'),
  gatewayState: () => ipcRenderer.invoke('gateway:state'),
  onGatewayState: (callback: (state: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: string) => callback(state)
    ipcRenderer.on('gateway:stateChange', handler)
    return () => ipcRenderer.removeListener('gateway:stateChange', handler)
  },

  // Chat
  chatSend: (sessionKey: string, message: string) =>
    ipcRenderer.invoke('chat:send', sessionKey, message),
  chatHistory: (sessionKey: string) =>
    ipcRenderer.invoke('chat:history', sessionKey),
  chatAbort: (sessionKey: string, runId?: string) =>
    ipcRenderer.invoke('chat:abort', sessionKey, runId),
  onChatEvent: (callback: (event: string, payload: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ev: string, payload: any) => callback(ev, payload)
    ipcRenderer.on('chat:event', handler)
    return () => ipcRenderer.removeListener('chat:event', handler)
  },

  // Agents
  agentsList: () => ipcRenderer.invoke('agents:list'),

  // Config
  configSetModel: (model: string) => ipcRenderer.invoke('config:setModel', model),
  configSetApiKey: (provider: string, apiKey: string) =>
    ipcRenderer.invoke('config:setApiKey', provider, apiKey),
})
