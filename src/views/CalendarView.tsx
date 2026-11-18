import { ChevronLeft, ChevronRight, Repeat as RepeatIcon } from 'lucide-react'
import { useMemo, useState, type CSSProperties } from 'react'
import { TaskComposer, TaskList } from '../components/tasks'
import { TopBar } from '../components/TopBar'
import { addDays, fromKey, longDate, startOfWeek, toKey, todayKey, weekday } from '../lib/date'
import { describeRepeat, upcomingDates } from '../lib/repeat'
import { byDue } from '../lib/sort'
import { useStore } from '../store'
import type { Habit, Task } from '../types'

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

/** The first day a habit existed: when it was made, or its earliest tick if older. */
function habitStart(h: Habit): string {
  const created = toKey(new Date(h.createdAt))
  const earliest = Object.keys(h.log).sort()[0]
  return earliest && earliest < created ? earliest : created
}

interface Ghost {
  task: Task
  date: string
}

export function CalendarView({ tab }: { tab: 'tasks' | 'habits' }) {
  const today = todayKey()
  const [month, setMonth] = useState(() => monthStart(today))
  const [selected, setSelected] = useState(today)
  const days = useMemo(() => gridDays(month), [month])
  const monthIndex = fromKey(month).getMonth()
  const title = fromKey(month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  const go = (n: number) => {
    const next = shiftMonth(month, n)
    setMonth(next)
    setSelected(next.slice(0, 7) === today.slice(0, 7) ? today : next)
  }
  const goToday = () => {
    setMonth(monthStart(today))
    setSelected(today)
  }

  return (
    <>
      <TopBar crumbs={[{ label: 'Calendar' }]} />
      <div className="view calendar-view">
        <header className="cal-header">
          <div className="cal-title">
            <h1>{title}</h1>
            <div className="cal-nav">
              <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => go(-1)}>
                <ChevronLeft size={18} />
              </button>
              <button type="button" className="btn ghost small cal-today" onClick={goToday}>
                Today
              </button>
              <button type="button" className="icon-btn" aria-label="Next month" onClick={() => go(1)}>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div className="segmented cal-tabs" role="tablist" aria-label="Show">
            <a role="tab" aria-selected={tab === 'tasks'} className={tab === 'tasks' ? 'on' : ''} href="#/calendar">
              Tasks
            </a>
            <a role="tab" aria-selected={tab === 'habits'} className={tab === 'habits' ? 'on' : ''} href="#/calendar/habits">
              Habits
            </a>
          </div>
        </header>

        {tab === 'tasks' ? (
          <TasksMonth days={days} monthIndex={monthIndex} today={today} selected={selected} onSelect={setSelected} />
        ) : (
          <HabitsMonth days={days} monthIndex={monthIndex} today={today} selected={selected} onSelect={setSelected} />
        )}
      </div>
    </>
  )
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
  const color = (areaId?: string) => areas.find((a) => a.id === areaId)?.color

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
        <div className="cal-grid">
          {days.map((day) => {
            const items = byDay.get(day) ?? []
            const ghosts = ghostsByDay.get(day) ?? []
            const total = items.length + ghosts.length
            const shown = items.slice(0, 3)
            const ghostShown = ghosts.slice(0, Math.max(0, 3 - shown.length))
            const more = total - shown.length - ghostShown.length
            const open = items.filter((t) => !t.done).length
            return (
              <button
                key={day}
                type="button"
                className={dayClass(day, monthIndex, today, selected)}
                onClick={() => onSelect(day)}
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
              </button>
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

/* ---------- Habits ---------- */

function HabitsMonth({ days, monthIndex, today, selected, onSelect }: MonthProps) {
  const habits = useStore((s) => s.habits)
  const toggleHabit = useStore((s) => s.toggleHabit)
  const [focus, setFocus] = useState<string | null>(null)
  const focused = habits.find((h) => h.id === focus) ?? null

  const starts = useMemo(() => new Map(habits.map((h) => [h.id, habitStart(h)])), [habits])
  const activeOn = (day: string) => (focused ? [focused] : habits).filter((h) => (starts.get(h.id) ?? today) <= day)

  // Month summary: days in this month up to today.
  const monthDays = days.filter((d) => fromKey(d).getMonth() === monthIndex && d <= today)
  let possible = 0
  let done = 0
  for (const d of monthDays) {
    const list = activeOn(d)
    possible += list.length
    done += list.filter((h) => h.log[d]).length
  }
  const pct = possible ? Math.round((done / possible) * 100) : 0

  let best = 0
  if (focused) {
    let run = 0
    for (const d of monthDays) {
      run = focused.log[d] ? run + 1 : 0
      best = Math.max(best, run)
    }
  }

  if (habits.length === 0) {
    return (
      <div className="empty">
        <p>No habits yet. Add one on the Habits page and its days will show up here.</p>
        <a className="btn primary" href="#/habits">
          Go to Habits
        </a>
      </div>
    )
  }

  return (
    <>
      <div className="filters cal-habit-filter" role="tablist" aria-label="Habit">
        <button type="button" role="tab" aria-selected={!focused} className={`filter${focused ? '' : ' active'}`} onClick={() => setFocus(null)}>
          All habits
        </button>
        {habits.map((h) => (
          <button
            key={h.id}
            type="button"
            role="tab"
            aria-selected={focus === h.id}
            className={`filter${focus === h.id ? ' active' : ''}`}
            onClick={() => setFocus(h.id)}
          >
            <span>{h.icon}</span>
            {h.name}
          </button>
        ))}
      </div>

      <div className="cal-stats">
        <span>
          <b>{done}</b> check-ins
        </span>
        <span>
          <b>{pct}%</b> of possible days
        </span>
        {focused && (
          <span>
            <b>{best}</b> {best === 1 ? 'day' : 'days'} best run this month
          </span>
        )}
      </div>

      <div className="cal-grid-wrap">
        <WeekdayHeader />
        <div className={`cal-grid habits${focused ? ' single' : ''}`}>
          {days.map((day) => {
            const list = activeOn(day)
            const count = list.filter((h) => h.log[day]).length
            const ratio = list.length ? count / list.length : 0
            const future = day > today
            const label = focused
              ? `${focused.name}, ${weekday(day)} ${longDate(day)}${focused.log[day] ? ', done' : ''}`
              : `${weekday(day)} ${longDate(day)}: ${count} of ${list.length} habits`
            return (
              <button
                key={day}
                type="button"
                className={dayClass(day, monthIndex, today, selected) + (future ? ' future' : '')}
                onClick={() => {
                  onSelect(day)
                  if (focused && !future) toggleHabit(focused.id, day)
                }}
                aria-label={label}
                aria-pressed={focused ? !!focused.log[day] : day === selected}
              >
                <span className="cal-num">{fromKey(day).getDate()}</span>
                {focused ? (
                  <span className={`habit-mark${focused.log[day] ? ' on' : ''}`} aria-hidden="true" />
                ) : (
                  !future &&
                  list.length > 0 && (
                    <>
                      <span className="heat" style={{ '--heat': ratio } as CSSProperties} aria-hidden="true" />
                      <span className="heat-count">
                        {count}/{list.length}
                      </span>
                    </>
                  )
                )}
              </button>
            )
          })}
        </div>
      </div>
      {focused && <p className="cal-hint">Tap a day to tick or untick it.</p>}

      {!focused && (
        <section className="section cal-agenda">
          <div className="section-head">
            <h2>{selected === today ? 'Today' : weekday(selected)}</h2>
            <span className="count">{longDate(selected)}</span>
          </div>
          {selected > today ? (
            <p className="cal-empty">This day hasn’t happened yet.</p>
          ) : (
            <div className="habit-chips">
              {activeOn(selected).map((h) => {
                const isDone = !!h.log[selected]
                return (
                  <button
                    key={h.id}
                    type="button"
                    className={`habit-chip${isDone ? ' done' : ''}`}
                    aria-pressed={isDone}
                    onClick={() => toggleHabit(h.id, selected)}
                  >
                    <span className="habit-chip-icon">{h.icon}</span>
                    <span className="habit-chip-name">{h.name}</span>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      )}
    </>
  )
}
