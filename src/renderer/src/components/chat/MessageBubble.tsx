import type { ChatMessage } from '../../stores/chat-store'

interface Props {
  message: ChatMessage
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? 'bg-lemon-500 text-zinc-900'
            : message.isError
              ? 'bg-destructive/10 text-destructive'
              : 'bg-zinc-800 text-zinc-100'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">
          {message.content}
          {message.isStreaming && <span className="animate-pulse">▊</span>}
        </p>
        <span className="mt-1 block text-right text-[10px] text-zinc-500">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  )
}
