import { create } from 'zustand'
import { hostApi } from '../lib/host-api'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  isStreaming?: boolean
  isError?: boolean
}

interface ChatStoreState {
  sessionKey: string
  messages: ChatMessage[]
  currentRunId: string | null
  isSending: boolean
  loadHistory: () => Promise<void>
  send: (text: string) => Promise<void>
  abort: () => Promise<void>
  init: () => () => void
}

let nextId = 1
function genId(): string {
  return `msg-${nextId++}-${Date.now()}`
}

// Mock 流式回复
const MOCK_REPLIES: Record<string, string> = {
  default: '你好！我是 LemonClaw 助手，当前处于演示模式。大模型尚未接入，请先配置 API Key。',
}

async function mockStreamReply(text: string, onUpdate: (content: string) => void): Promise<string> {
  const reply = MOCK_REPLIES.default
  for (let i = 0; i < reply.length; i++) {
    await new Promise((r) => setTimeout(r, 20))
    onUpdate(reply.slice(0, i + 1))
  }
  return reply
}

export const useChatStore = create<ChatStoreState>((set, get) => ({
  sessionKey: 'main',
  messages: [],
  currentRunId: null,
  isSending: false,

  loadHistory: async () => {
    // 暂不加载历史，避免残留消息
  },

  send: async (text: string) => {
    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    const assistantMsg: ChatMessage = {
      id: genId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    }

    set((state) => ({
      messages: [...state.messages, userMsg, assistantMsg],
      isSending: true,
    }))

    // Mock 模式：模拟流式回复
    await mockStreamReply(text, (content) => {
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === assistantMsg.id ? { ...m, content } : m
        ),
      }))
    })

    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === assistantMsg.id ? { ...m, isStreaming: false } : m
      ),
      isSending: false,
    }))
  },

  abort: async () => {
    set({ currentRunId: null, isSending: false })
    const { messages } = get()
    const last = [...messages].reverse().find((m) => m.role === 'assistant' && m.isStreaming)
    if (last) {
      set({
        messages: messages.map((m) =>
          m.id === last.id ? { ...m, isStreaming: false } : m
        ),
      })
    }
  },

  init: () => {
    // 预留：后续接真实 API 时启用事件监听
    return () => {}
  },
}))
