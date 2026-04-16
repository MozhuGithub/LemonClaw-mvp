import { Settings } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">设置</h2>
      </div>
      <p className="text-muted-foreground text-sm">设置界面（待实现）</p>
    </div>
  )
}
