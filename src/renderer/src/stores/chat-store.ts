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

function extractText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    const block = content.find((b: any) => b.type === 'text')
    return block?.text ?? ''
  }
  return ''
}

function parseHistoryMessages(data: any): ChatMessage[] {
  const raw = Array.isArray(data) ? data : data?.messages
  if (!Array.isArray(raw)) return []
  const msgs: ChatMessage[] = []
  for (const m of raw) {
    if (m.role === 'user' || m.role === 'assistant') {
      msgs.push({
        id: m.id ?? genId(),
        role: m.role,
        content: extractText(m.content),
        timestamp: m.timestamp ?? Date.now(),
      })
    }
  }
  return msgs
}

export const useChatStore = create<ChatStoreState>((set, get) => ({
  sessionKey: 'main',
  messages: [],
  currentRunId: null,
  isSending: false,

  loadHistory: async () => {
    try {
      const data = await hostApi.chatHistory('main')
      const msgs = parseHistoryMessages(data)
      if (msgs.length > 0) set({ messages: msgs })
    } catch {
      // Gateway 未连接或历史为空
    }
  },

  send: async (text: string) => {
    const assistantId = genId()
    set((state) => ({
      messages: [...state.messages,
        { id: genId(), role: 'user', content: text, timestamp: Date.now() },
        { id: assistantId, role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true },
      ],
      isSending: true,
    }))

    try {
      const { runId } = await hostApi.chatSend('main', text)
      set({ currentRunId: runId })
    } catch (err: any) {
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === assistantId
            ? { ...m, content: `发送失败: ${err.message}`, isStreaming: false, isError: true }
            : m
        ),
        isSending: false,
      }))
    }
  },

  abort: async () => {
    const { currentRunId } = get()
    try {
      await hostApi.chatAbort('main', currentRunId ?? undefined)
    } catch { /* 忽略 */ }
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
    console.log('[chat-store] init')
    const unsub = hostApi.onChatEvent((event: string, payload: any) => {
      console.log('[chat-store] event:', event, 'state:', payload?.state)
      if (event !== 'chat') return

      const { messages } = get()
      console.log('[chat-store] messages count:', messages.length, 'streaming count:', messages.filter(m => m.isStreaming).length)
      const streamingMsg = [...messages].reverse().find((m) => m.role === 'assistant' && m.isStreaming)
      console.log('[chat-store] streamingMsg:', streamingMsg?.id)
      if (!streamingMsg) return

      switch (payload.state) {
        case 'delta': {
          const text = extractText(payload.message?.content)
          console.log('[chat-store] delta text length:', text.length)
          if (text) {
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === streamingMsg.id ? { ...m, content: text } : m
              ),
            }))
          }
          break
        }
        case 'final': {
          console.log('[chat-store] final handler, payload:', JSON.stringify(payload)?.slice(0, 200))
          const text = extractText(payload.message?.content)
          console.log('[chat-store] final text length:', text.length)
          if (text) {
            // Delta 已经给了内容，直接 final
            console.log('[chat-store] setting final state')
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === streamingMsg.id ? { ...m, content: text, isStreaming: false } : m
              ),
              isSending: false,
              currentRunId: null,
            }))
            console.log('[chat-store] final state set done')
          } else {
            // Gateway 没推 message，用 chat.history 拉取
            hostApi.chatHistory('main').then((data) => {
              const history = parseHistoryMessages(data)
              if (history.length > 0) {
                set({ messages: history, isSending: false, currentRunId: null })
              } else {
                set((state) => ({
                  messages: state.messages.map((m) =>
                    m.id === streamingMsg.id ? { ...m, isStreaming: false } : m
                  ),
                  isSending: false,
                  currentRunId: null,
                }))
              }
            }).catch(() => {
              set((state) => ({
                messages: state.messages.map((m) =>
                  m.id === streamingMsg.id ? { ...m, isStreaming: false } : m
                ),
                isSending: false,
                currentRunId: null,
              }))
            })
          }
          break
        }
        case 'error': {
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === streamingMsg.id
                ? { ...m, content: payload.errorMessage || '发生错误', isStreaming: false, isError: true }
                : m
            ),
            isSending: false,
            currentRunId: null,
          }))
          break
        }
        case 'aborted': {
          set((state) => ({
            messages: state.messages.map((m) =>
              m.id === streamingMsg.id ? { ...m, isStreaming: false } : m
            ),
            isSending: false,
            currentRunId: null,
          }))
          break
        }
      }
    })
    return unsub
  },
}))
