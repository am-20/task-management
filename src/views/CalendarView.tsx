import { ChevronLeft, ChevronRight, Repeat as RepeatIcon } from 'lucide-react'
import { useMemo, useState, type CSSProperties } from 'react'
import { TaskComposer, TaskList } from '../components/tasks'
import { TopBar } from '../components/TopBar'
import { useIsPhone } from '../lib/useMedia'
import { WeekView } from './WeekView'
import { addDays, fromKey, longDate, startOfWeek, toKey, todayKey, weekday } from '../lib/date'
import { describeRepeat, upcomingDates } from '../lib/repeat'
import { byDue } from '../lib/sort'
import { useStore } from '../store'
import type { Task } from '../types'

/** Drag data type for moving a task to another day */
const DRAG_TYPE = 'application/x-hearth-task'

const WEEKDAY_HEAD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function monthStart(key: string): string {
  const d = fromKey(key)
  return toKey(new Date(d.getFullYear(), d.getMonth(), 1))
}

function shiftMonth(key: string, n: number): string {
  const d = fromKey(key)
  return toKey(new Date(d.getFullYear(), d.getMonth() + n, 1))
}

/** Six Monday-first weeks covering the month. */
function gridDays(month: string): string[] {
  const first = startOfWeek(month)
  return Array.from({ length: 42 }, (_, i) => addDays(first, i))
}

interface Ghost {
  task: Task
  date: string
}

export function CalendarView({ mode }: { mode: 'month' | 'week' }) {
  const today = todayKey()
  const phone = useIsPhone()
  const [month, setMonth] = useState(() => monthStart(today))
  const [week, setWeek] = useState(() => startOfWeek(today))
  const [selected, setSelected] = useState(today)
  const days = useMemo(() => gridDays(month), [month])
  const monthIndex = fromKey(month).getMonth()

  const weekEnd = addDays(week, 6)
  const title =
    mode === 'month'
      ? fromKey(month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : weekTitle(week, weekEnd)

  const go = (n: number) => {
    if (mode === 'month') {
      const next = shiftMonth(month, n)
      setMonth(next)
      setSelected(next.slice(0, 7) === today.slice(0, 7) ? today : next)
    } else {
      const next = addDays(week, n * 7)
      setWeek(next)
      setSelected(next === startOfWeek(today) ? today : next)
    }
  }
  const goToday = () => {
    setMonth(monthStart(today))
    setWeek(startOfWeek(today))
    setSelected(today)
  }
  const unit = mode === 'month' ? 'month' : 'week'

  return (
    <>
      <TopBar crumbs={[{ label: 'Calendar' }]} />
      <div className={`view calendar-view${mode === 'week' && !phone ? ' wide' : ''}`}>
        <header className="cal-header">
          <div className="cal-title">
            <h1>{title}</h1>
            <div className="cal-nav">
              <button type="button" className="icon-btn" aria-label={`Previous ${unit}`} onClick={() => go(-1)}>
                <ChevronLeft size={18} />
              </button>
              <button type="button" className="btn ghost small cal-today" onClick={goToday}>
                Today
              </button>
              <button type="button" className="icon-btn" aria-label={`Next ${unit}`} onClick={() => go(1)}>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div className="segmented cal-tabs" role="tablist" aria-label="Layout">
            <a
              role="tab"
              aria-selected={mode === 'month'}
              className={mode === 'month' ? 'on' : ''}
              href="#/calendar"
              onClick={() => setMonth(monthStart(selected))}
            >
              Month
            </a>
            <a
              role="tab"
              aria-selected={mode === 'week'}
              className={mode === 'week' ? 'on' : ''}
              href="#/calendar/week"
              onClick={() => setWeek(startOfWeek(selected))}
            >
              Week
            </a>
          </div>
        </header>

        {mode === 'month' ? (
          <TasksMonth days={days} monthIndex={monthIndex} today={today} selected={selected} onSelect={setSelected} />
        ) : (
          <WeekView week={week} today={today} />
        )}
      </div>
    </>
  )
}

function weekTitle(start: string, end: string): string {
  const a = fromKey(start)
  const b = fromKey(end)
  const sameMonth = a.getMonth() === b.getMonth()
  const left = a.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const right = b.toLocaleDateString(undefined, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' })
  return `${left} – ${right}, ${b.getFullYear()}`
}

interface MonthProps {
  days: string[]
  monthIndex: number
  today: string
  selected: string
  onSelect: (day: string) => void
}

function WeekdayHeader() {
  return (
    <div className="cal-weekdays" aria-hidden="true">
      {WEEKDAY_HEAD.map((d) => (
        <span key={d}>{d}</span>
      ))}
    </div>
  )
}

function dayClass(day: string, monthIndex: number, today: string, selected: string) {
  return [
    'cal-day',
    fromKey(day).getMonth() !== monthIndex ? 'outside' : '',
    day === today ? 'today' : '',
    day === selected ? 'selected' : '',
    day < today ? 'past' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

/* ---------- Tasks ---------- */

function TasksMonth({ days, monthIndex, today, selected, onSelect }: MonthProps) {
  const tasks = useStore((s) => s.tasks)
  const areas = useStore((s) => s.areas)
  const updateTask = useStore((s) => s.updateTask)
  const color = (areaId?: string) => areas.find((a) => a.id === areaId)?.color
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const { byDay, ghostsByDay } = useMemo(() => {
    const start = days[0]
    const end = days[days.length - 1]
    const byDay = new Map<string, Task[]>()
    const ghostsByDay = new Map<string, Ghost[]>()
    for (const t of tasks) {
      if (!t.due) continue
      if (t.due >= start && t.due <= end) byDay.set(t.due, [...(byDay.get(t.due) ?? []), t])
      // Future repeats of open tasks, shown faintly.
      if (!t.done && t.repeat) {
        for (const date of upcomingDates(t.repeat, t.due, start, end)) {
          ghostsByDay.set(date, [...(ghostsByDay.get(date) ?? []), { task: t, date }])
        }
      }
    }
    for (const [k, list] of byDay) byDay.set(k, [...list].sort((a, b) => Number(a.done) - Number(b.done) || byDue(a, b)))
    return { byDay, ghostsByDay }
  }, [tasks, days])

  const dayTasks = byDay.get(selected) ?? []
  const dayGhosts = ghostsByDay.get(selected) ?? []

  return (
    <>
      <div className="cal-grid-wrap">
        <WeekdayHeader />
        <div className={`cal-grid${dragging ? ' dragging' : ''}`}>
          {days.map((day) => {
            const items = byDay.get(day) ?? []
            const ghosts = ghostsByDay.get(day) ?? []
            const total = items.length + ghosts.length
            const shown = items.slice(0, 3)
            const ghostShown = ghosts.slice(0, Math.max(0, 3 - shown.length))
            const more = total - shown.length - ghostShown.length
            const open = items.filter((t) => !t.done).length
            return (
              <div
                key={day}
                role="button"
                tabIndex={0}
                className={dayClass(day, monthIndex, today, selected) + (dragOver === day ? ' drop' : '')}
                onClick={() => onSelect(day)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(day)
                  }
                }}
                onDragOver={(e) => {
                  if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  if (dragOver !== day) setDragOver(day)
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver((d) => (d === day ? null : d))
                }}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData(DRAG_TYPE)
                  setDragOver(null)
                  if (!id) return
                  e.preventDefault()
                  updateTask(id, { due: day })
                  onSelect(day)
                }}
                aria-label={`${weekday(day)} ${longDate(day)}: ${total ? `${total} ${total === 1 ? 'task' : 'tasks'}` : 'nothing planned'}`}
                aria-pressed={day === selected}
              >
                <span className="cal-num">{fromKey(day).getDate()}</span>
                <span className="cal-items">
                  {shown.map((t) => (
                    <span
                      key={t.id}
                      className={`cal-item${t.done ? ' done' : ''}${!t.done && day < today ? ' late' : ''}`}
                      style={{ '--dot': color(t.areaId) ?? 'var(--text-3)' } as CSSProperties}
                      draggable={!t.done}
                      title={t.done ? undefined : 'Drag to another day to move it'}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DRAG_TYPE, t.id)
                        e.dataTransfer.effectAllowed = 'move'
                        setDragging(true)
                      }}
                      onDragEnd={() => {
                        setDragging(false)
                        setDragOver(null)
                      }}
                    >
                      {t.title || 'Untitled'}
                    </span>
                  ))}
                  {ghostShown.map((g) => (
                    <span key={g.task.id + g.date} className="cal-item ghost" style={{ '--dot': color(g.task.areaId) ?? 'var(--text-3)' } as CSSProperties}>
                      {g.task.title || 'Untitled'}
                    </span>
                  ))}
                  {more > 0 && <span className="cal-more">+{more} more</span>}
                </span>
                {/* Phones: dots instead of titles */}
                <span className="cal-dots" aria-hidden="true">
                  {items.slice(0, 4).map((t) => (
                    <i key={t.id} className={t.done ? 'done' : ''} style={{ background: color(t.areaId) ?? 'var(--text-3)' }} />
                  ))}
                  {ghosts.slice(0, Math.max(0, 4 - items.length)).map((g) => (
                    <i key={g.task.id + g.date} className="ghost" style={{ borderColor: color(g.task.areaId) ?? 'var(--text-3)' }} />
                  ))}
                </span>
                {open > 0 && day < today && <span className="sr-only">{open} not done</span>}
              </div>
            )
          })}
        </div>
      </div>

      <section className="section cal-agenda">
        <div className="section-head">
          <h2>{selected === today ? 'Today' : weekday(selected)}</h2>
          <span className="count">{longDate(selected)}</span>
        </div>
        <TaskComposer key={selected} defaultDue={selected} placeholder={`Add a task for ${selected === today ? 'today' : longDate(selected)}`} />
        <TaskList tasks={dayTasks} />
        {dayGhosts.length > 0 && (
          <div className="ghost-list">
            <div className="ghost-head">Repeats on this day</div>
            {dayGhosts.map((g) => (
              <div key={g.task.id} className="ghost-row">
                <RepeatIcon size={14} />
                <span className="ghost-title">{g.task.title}</span>
                <span className="ghost-rule">{describeRepeat(g.task.repeat!, true)}</span>
              </div>
            ))}
          </div>
        )}
        {dayTasks.length === 0 && dayGhosts.length === 0 && <p className="cal-empty">Nothing planned for this day.</p>}
      </section>
    </>
  )
}
