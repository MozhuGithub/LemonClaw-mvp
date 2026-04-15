import React, { useEffect, useState } from 'react'

declare global {
  interface Window {
    lemonclaw: {
      ping: () => Promise<string>
      getInfo: () => Promise<{
        name: string
        version: string
        platform: string
        electronVersion: string
        nodeVersion: string
      }>
    }
  }
}

function App() {
  const [info, setInfo] = useState<{
    name: string
    version: string
    platform: string
    electronVersion: string
    nodeVersion: string
  } | null>(null)

  const [pingResult, setPingResult] = useState<string>('')

  useEffect(() => {
    window.lemonclaw.getInfo().then(setInfo)
  }, [])

  const handlePing = async () => {
    const result = await window.lemonclaw.ping()
    setPingResult(result)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold">
        LemonClaw <span className="text-yellow-400">MVP</span>
      </h1>
      <p className="text-gray-400">多 Agent AI 助手桌面应用</p>

      {info && (
        <div className="bg-gray-900 rounded-lg p-4 text-sm text-gray-300 space-y-1">
          <p>Electron: {info.electronVersion}</p>
          <p>Node: {info.nodeVersion}</p>
          <p>Platform: {info.platform}</p>
        </div>
      )}

      <button
        onClick={handlePing}
        className="bg-yellow-500 hover:bg-yellow-400 text-black font-medium px-6 py-2 rounded-lg transition-colors"
      >
        Ping Main Process
      </button>

      {pingResult && (
        <p className="text-green-400 text-sm">{pingResult}</p>
      )}
    </div>
  )
}

export default App
