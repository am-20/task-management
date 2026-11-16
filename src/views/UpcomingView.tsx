import { ChevronRight } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { TaskComposer, TaskList } from '../components/tasks'
import { byDue } from '../lib/sort'
import { TopBar } from '../components/TopBar'
import { addDays, todayKey } from '../lib/date'
import { useStore } from '../store'
import type { Task } from '../types'

export function UpcomingView() {
  const tasks = useStore((s) => s.tasks)
  const areas = useStore((s) => s.areas)
  const [filter, setFilter] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)

  const today = todayKey()
  const weekEnd = addDays(today, 7)
  const activeFilter = filter && areas.some((a) => a.id === filter) ? filter : null
  const scoped = activeFilter ? tasks.filter((t) => t.areaId === activeFilter) : tasks
  const open = scoped.filter((t) => !t.done).sort(byDue)
  const done = scoped.filter((t) => t.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))

  const groups: { label: string; tone?: string; items: Task[] }[] = [
    { label: 'Overdue', tone: 'overdue', items: open.filter((t) => t.due && t.due < today) },
    { label: 'Today', items: open.filter((t) => t.due === today) },
    { label: 'Tomorrow', items: open.filter((t) => t.due === addDays(today, 1)) },
    { label: 'Next seven days', items: open.filter((t) => t.due && t.due > addDays(today, 1) && t.due <= weekEnd) },
    { label: 'Later', items: open.filter((t) => t.due && t.due > weekEnd) },
    { label: 'Someday', items: open.filter((t) => !t.due) },
  ].filter((g) => g.items.length > 0)

  return (
    <>
      <TopBar crumbs={[{ label: 'Upcoming' }]} />
      <div className="view">
        <header className="view-header">
          <h1>Upcoming</h1>
          <p className="lede">Everything you have promised yourself, in the order it is due.</p>
        </header>

        {areas.length > 0 && (
          <div className="filters" role="tablist" aria-label="Filter by area">
            <button type="button" role="tab" aria-selected={!activeFilter} className={`filter${activeFilter ? '' : ' active'}`} onClick={() => setFilter(null)}>
              All areas
            </button>
            {areas.map((a) => (
              <button
                key={a.id}
                type="button"
                role="tab"
                aria-selected={activeFilter === a.id}
                className={`filter${activeFilter === a.id ? ' active' : ''}`}
                style={{ '--area': a.color } as CSSProperties}
                onClick={() => setFilter(a.id)}
              >
                <span>{a.icon}</span>
                {a.name || 'Untitled'}
              </button>
            ))}
          </div>
        )}

        <TaskComposer key={activeFilter ?? 'all'} defaultAreaId={activeFilter ?? undefined} placeholder="Add a task" />

        {groups.length === 0 && (
          <div className="empty">
            <p>No open tasks here. Add one above, or enjoy the clear space.</p>
          </div>
        )}

        {groups.map((g) => (
          <section className="section compact" key={g.label}>
            <div className="section-head">
              <h3 className={g.tone ?? ''}>{g.label}</h3>
              <span className="count">{g.items.length}</span>
            </div>
            <TaskList tasks={g.items} showArea={!activeFilter} />
          </section>
        ))}

        {done.length > 0 && (
          <section className="section compact">
            <button type="button" className={`disclosure${showDone ? ' open' : ''}`} onClick={() => setShowDone(!showDone)} aria-expanded={showDone}>
              <ChevronRight size={15} />
              Completed
              <span className="count">{done.length}</span>
            </button>
            {showDone && <TaskList tasks={done} showArea={!activeFilter} />}
          </section>
        )}
      </div>
    </>
  )
}
