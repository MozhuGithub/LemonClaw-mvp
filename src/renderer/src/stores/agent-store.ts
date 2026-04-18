import { create } from 'zustand'
import { hostApi } from '../lib/host-api'

export interface Agent {
  id: string
  name: string
  description?: string
}

interface AgentStoreState {
  agents: Agent[]
  selectedAgentId: string | null
  isLoading: boolean
  loadAgents: () => Promise<void>
  selectAgent: (id: string) => void
  init: () => () => void
}

export const useAgentStore = create<AgentStoreState>((set, get) => ({
  agents: [],
  selectedAgentId: null,
  isLoading: false,

  loadAgents: async () => {
    set({ isLoading: true })
    try {
      const list = await hostApi.agentsList()
      const agents: Agent[] = (list ?? []).map((a: any) => ({
        id: a.id ?? a.agentId ?? a.name,
        name: a.name ?? a.id ?? 'Unknown',
        description: a.description ?? '',
      }))
      set({ agents, selectedAgentId: agents[0]?.id ?? null })
    } catch {
      // Gateway 未连接
    } finally {
      set({ isLoading: false })
    }
  },

  selectAgent: (id: string) => {
    set({ selectedAgentId: id })
    hostApi.agentsList().catch(() => {}) // 触发 sessionsPatch 需要额外 IPC，MVP 简化处理
  },

  init: () => {
    get().loadAgents()
    return () => {}
  },
}))
