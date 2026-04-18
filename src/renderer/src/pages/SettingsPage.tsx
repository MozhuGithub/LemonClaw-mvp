import { useState } from 'react'
import { Settings } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { hostApi } from '../lib/host-api'

export default function SettingsPage() {
  const [provider, setProvider] = useState('openai')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('theta/glm-5.1')
  const [saved, setSaved] = useState<'api' | 'model' | null>(null)

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return
    await hostApi.configSetApiKey(provider, apiKey.trim())
    setApiKey('')
    setSaved('api')
    setTimeout(() => setSaved(null), 2000)
  }

  const handleSaveModel = async () => {
    if (!model.trim()) return
    await hostApi.configSetModel(model.trim())
    setSaved('model')
    setTimeout(() => setSaved(null), 2000)
  }

  return (
    <div className="p-6 max-w-lg">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">设置</h2>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-300">API Key</h3>
          <Input
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder="Provider（如 openai）"
            className="bg-zinc-900"
          />
          <Input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            type="password"
            placeholder="输入 API Key"
            className="bg-zinc-900"
          />
          <Button size="sm" onClick={handleSaveApiKey} disabled={!apiKey.trim()}>
            {saved === 'api' ? '已保存' : '保存 API Key'}
          </Button>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-300">模型</h3>
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="模型名称（如 theta/glm-5.1）"
            className="bg-zinc-900"
          />
          <Button size="sm" onClick={handleSaveModel} disabled={!model.trim()}>
            {saved === 'model' ? '已保存' : '保存模型'}
          </Button>
        </div>
      </div>
    </div>
  )
}
