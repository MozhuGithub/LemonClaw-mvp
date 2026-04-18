import { useEffect } from 'react'
import { Bot } from 'lucide-react'
import { useAgentStore } from '../stores/agent-store'
import { useGatewayStore } from '../stores/gateway-store'

export default function AgentsPage() {
  const agents = useAgentStore((s) => s.agents)
  const selectedAgentId = useAgentStore((s) => s.selectedAgentId)
  const isLoading = useAgentStore((s) => s.isLoading)
  const selectAgent = useAgentStore((s) => s.selectAgent)
  const init = useAgentStore((s) => s.init)

  const gatewayState = useGatewayStore((s) => s.state)

  useEffect(() => {
    return init()
  }, [])

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Bot className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Agent 管理</h2>
      </div>

      {gatewayState !== 'running' ? (
        <p className="text-zinc-500 text-sm">请先启动 Gateway</p>
      ) : isLoading ? (
        <p className="text-zinc-500 text-sm">加载中...</p>
      ) : agents.length === 0 ? (
        <p className="text-zinc-500 text-sm">暂无可用 Agent</p>
      ) : (
        <div className="space-y-2">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => selectAgent(agent.id)}
              className={`w-full text-left rounded-lg border p-3 transition-colors ${
                agent.id === selectedAgentId
                  ? 'border-lemon-500 bg-lemon-500/10'
                  : 'border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="text-sm font-medium">{agent.name}</div>
              {agent.description && (
                <div className="mt-1 text-xs text-zinc-500">{agent.description}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
