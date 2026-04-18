/**
 * host-api：前端统一接口，封装 IPC 调用。
 * 前端组件只调用 host-api，不直接用 window.lemonclaw。
 */

const api = (window as any).lemonclaw

export const hostApi = {
  // App
  ping: (): Promise<string> => api.ping(),
  getInfo: (): Promise<{ name: string; version: string; platform: string }> => api.getInfo(),

  // Gateway
  gatewayStart: (): Promise<void> => api.gatewayStart(),
  gatewayStop: (): Promise<void> => api.gatewayStop(),
  gatewayRestart: (): Promise<void> => api.gatewayRestart(),
  gatewayState: (): Promise<string> => api.gatewayState(),
  onGatewayState: (cb: (state: string) => void): (() => void) => api.onGatewayState(cb),

  // Chat
  chatSend: (sessionKey: string, message: string): Promise<void> =>
    api.chatSend(sessionKey, message),
  chatHistory: (sessionKey: string): Promise<any[]> => api.chatHistory(sessionKey),
  onChatEvent: (cb: (event: string, payload: any) => void): (() => void) => api.onChatEvent(cb),

  // Agents
  agentsList: (): Promise<any[]> => api.agentsList(),

  // Config
  configSetModel: (model: string): Promise<void> => api.configSetModel(model),
  configSetApiKey: (provider: string, apiKey: string): Promise<void> =>
    api.configSetApiKey(provider, apiKey),
}
