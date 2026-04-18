import { useEffect } from 'react'
import { MessageSquare } from 'lucide-react'
import { useGatewayStore } from '../stores/gateway-store'
import { useChatStore } from '../stores/chat-store'
import { MessageList } from '../components/chat/MessageList'
import { ChatInput } from '../components/chat/ChatInput'

export default function ChatPage() {
  const gatewayState = useGatewayStore((s) => s.state)
  const gatewayStart = useGatewayStore((s) => s.start)
  const gatewayInit = useGatewayStore((s) => s.init)

  const messages = useChatStore((s) => s.messages)
  const isSending = useChatStore((s) => s.isSending)
  const loadHistory = useChatStore((s) => s.loadHistory)
  const send = useChatStore((s) => s.send)
  const abort = useChatStore((s) => s.abort)
  const chatInit = useChatStore((s) => s.init)

  const isRunning = gatewayState === 'running'
  const isStarting = gatewayState === 'starting'
  const isError = gatewayState === 'error'
  const isStreaming = messages.some((m) => m.isStreaming)

  useEffect(() => {
    const unsub1 = gatewayInit()
    const unsub2 = chatInit()
    return () => {
      unsub1()
      unsub2()
    }
  }, [])

  useEffect(() => {
    if (isRunning) {
      loadHistory()
    }
  }, [isRunning])

  if (!isRunning) {
    return (
      <div className="flex flex-col h-full">
        <header className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">日常助手</span>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            {isStarting ? (
              <>
                <div className="h-5 w-5 mx-auto border-2 border-lemon-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-zinc-400 text-sm">正在启动 Gateway...</p>
              </>
            ) : isError ? (
              <>
                <p className="text-destructive text-sm">Gateway 启动失败</p>
                <button
                  onClick={gatewayStart}
                  className="px-4 py-2 bg-lemon-500 text-zinc-900 rounded-lg text-sm font-medium hover:bg-lemon-400"
                >
                  重新启动
                </button>
              </>
            ) : (
              <>
                <p className="text-zinc-500 text-sm">Gateway 未启动</p>
                <button
                  onClick={gatewayStart}
                  className="px-4 py-2 bg-lemon-500 text-zinc-900 rounded-lg text-sm font-medium hover:bg-lemon-400"
                >
                  启动 Gateway
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <MessageSquare className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">日常助手</span>
      </header>

      <MessageList messages={messages} />

      <ChatInput
        onSend={send}
        onAbort={abort}
        disabled={isSending}
        isStreaming={isStreaming}
      />
    </div>
  )
}
