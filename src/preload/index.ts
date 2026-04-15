import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('lemonclaw', {
  ping: () => ipcRenderer.invoke('app:ping'),
  getInfo: () => ipcRenderer.invoke('app:getInfo'),
})
