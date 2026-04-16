import { Bot } from 'lucide-react'

export default function AgentsPage() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Bot className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Agent 管理</h2>
      </div>
      <p className="text-muted-foreground text-sm">Agent 管理界面（待实现）</p>
    </div>
  )
}
