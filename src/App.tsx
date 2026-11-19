import { useEffect, useState } from 'react'
import { QuickFind } from './components/QuickFind'
import { Sidebar } from './components/Sidebar'
import { ConfirmHost, ToastHost } from './components/ui'
import { useRoute } from './lib/router'
import { useStore } from './store'
import { AreaView } from './views/AreaView'
import { CalendarView } from './views/CalendarView'
import { HabitsView } from './views/HabitsView'
import { PageView } from './views/PageView'
import { TodayView } from './views/TodayView'
import { UpcomingView } from './views/UpcomingView'

export default function App() {
  const route = useRoute()
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const setSidebarOpen = useStore((s) => s.setSidebarOpen)
  const [finding, setFinding] = useState(false)

  // Phones start with the sidebar tucked away.
  useEffect(() => {
    if (window.matchMedia('(max-width: 860px)').matches) setSidebarOpen(false)
  }, [setSidebarOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setFinding((v) => !v)
      } else if (mod && e.key === '\\') {
        e.preventDefault()
        const s = useStore.getState()
        s.setSidebarOpen(!s.sidebarOpen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const routeKey = 'id' in route ? `${route.name}-${route.id}` : route.name === 'calendar' ? 'calendar' : route.name

  return (
    <div className={`app${sidebarOpen ? '' : ' sidebar-closed'}`}>
      <Sidebar route={route} onSearch={() => setFinding(true)} />
      <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      <main className="main" key={routeKey}>
        {route.name === 'today' && <TodayView />}
        {route.name === 'upcoming' && <UpcomingView />}
        {route.name === 'habits' && <HabitsView />}
        {route.name === 'calendar' && <CalendarView mode={route.mode} />}
        {route.name === 'area' && <AreaView id={route.id} />}
        {route.name === 'page' && <PageView id={route.id} />}
      </main>
      {finding && <QuickFind onClose={() => setFinding(false)} />}
      <ConfirmHost />
      <ToastHost />
    </div>
  )
}
