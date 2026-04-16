import { MessageSquare } from 'lucide-react'

export default function ChatPage() {
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <MessageSquare className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">日常助手</span>
      </header>

      <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">选择一个 Agent 开始对话</p>
      </div>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2 bg-muted rounded-lg px-4 py-3">
          <p className="text-muted-foreground text-sm">输入消息开始对话（待实现）</p>
        </div>
      </div>
    </div>
  )
}
