import { MessageSquare, Bot, Settings, Zap } from 'lucide-react'
import { useNavigationStore, type Page } from '@/stores/navigation-store'
import { cn } from '@/lib/utils'

interface NavItemProps {
  icon: React.ElementType
  label: string
  page: Page
}

function NavItem({ icon: Icon, label, page }: NavItemProps) {
  const { currentPage, navigate } = useNavigationStore()
  const isActive = currentPage === page

  return (
    <button
      onClick={() => navigate(page)}
      className={cn(
        'flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm transition-colors',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </button>
  )
}

export default function Sidebar() {
  return (
    <aside className="w-[260px] bg-card border-r border-border flex flex-col shrink-0">
      {/* App title */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Zap className="h-5 w-5 text-primary" />
        <h1 className="text-base font-bold">
          Lemon<span className="text-primary">Claw</span>
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        <NavItem icon={MessageSquare} label="对话" page="chat" />
        <NavItem icon={Bot} label="Agent 管理" page="agents" />
      </nav>

      {/* Bottom: Settings */}
      <div className="p-2 border-t border-border">
        <NavItem icon={Settings} label="设置" page="settings" />
      </div>
    </aside>
  )
}
