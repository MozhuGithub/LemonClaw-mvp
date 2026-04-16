import Sidebar from './Sidebar'
import PageRouter from './PageRouter'

export default function AppLayout() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <PageRouter />
      </main>
    </div>
  )
}
