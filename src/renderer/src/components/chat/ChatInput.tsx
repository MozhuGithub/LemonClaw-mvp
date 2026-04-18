import { useState, type KeyboardEvent } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

interface Props {
  onSend: (text: string) => void
  onAbort: () => void
  disabled: boolean
  isStreaming: boolean
}

export function ChatInput({ onSend, onAbort, disabled, isStreaming }: Props) {
  const [text, setText] = useState('')

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex items-center gap-2 border-t border-zinc-800 px-4 py-3">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? 'Gateway 未启动...' : '输入消息...'}
        disabled={disabled}
        className="flex-1 bg-zinc-900"
      />
      {isStreaming ? (
        <Button variant="destructive" size="sm" onClick={onAbort} disabled={disabled}>
          停止
        </Button>
      ) : (
        <Button size="sm" onClick={handleSend} disabled={disabled || !text.trim()}>
          发送
        </Button>
      )}
    </div>
  )
}
