import { useNavigationStore } from '@/stores/navigation-store'
import ChatPage from '@/pages/ChatPage'
import AgentsPage from '@/pages/AgentsPage'
import SettingsPage from '@/pages/SettingsPage'

export default function PageRouter() {
  const currentPage = useNavigationStore((s) => s.currentPage)

  switch (currentPage) {
    case 'chat':
      return <ChatPage />
    case 'agents':
      return <AgentsPage />
    case 'settings':
      return <SettingsPage />
    default:
      return <ChatPage />
  }
}
