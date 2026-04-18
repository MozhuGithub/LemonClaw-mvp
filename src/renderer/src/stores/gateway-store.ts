import { create } from 'zustand'
import { hostApi } from '../lib/host-api'

interface GatewayStoreState {
  state: 'stopped' | 'starting' | 'running' | 'error'
  start: () => Promise<void>
  stop: () => Promise<void>
  init: () => () => void
}

export const useGatewayStore = create<GatewayStoreState>((set) => ({
  state: 'stopped',

  start: async () => {
    await hostApi.gatewayStart()
  },

  stop: async () => {
    await hostApi.gatewayStop()
  },

  init: () => {
    hostApi.gatewayState().then((s) => {
      if (s) set({ state: s as GatewayStoreState['state'] })
    })
    const unsub = hostApi.onGatewayState((s) => {
      set({ state: s as GatewayStoreState['state'] })
    })
    return unsub
  },
}))
