import { ArrowRight, Flame } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { TaskComposer, TaskList } from '../components/tasks'
import { Checkbox } from '../components/ui'
import { formatDuration, formatTime, toMinutes } from '../lib/time'
import { byDue } from '../lib/sort'
import { TopBar } from '../components/TopBar'
import { greeting, longDate, toKey, todayKey, weekday } from '../lib/date'
import { habitStreak, isScheduled } from '../lib/habits'
import { useStore } from '../store'

export function TodayView() {
  const tasks = useStore((s) => s.tasks)
  const habits = useStore((s) => s.habits)
  const areas = useStore((s) => s.areas)
  const pages = useStore((s) => s.pages)
  const toggleHabit = useStore((s) => s.toggleHabit)
  const addArea = useStore((s) => s.addArea)

  const today = todayKey()
  const open = tasks.filter((t) => !t.done && t.due && t.due <= today).sort(byDue)
  const doneToday = tasks
    .filter((t) => t.done && t.doneAt && toKey(new Date(t.doneAt)) === today)
    .sort((a, b) => (a.doneAt ?? 0) - (b.doneAt ?? 0))
  const todaysHabits = habits.filter((h) => isScheduled(h, today) || h.log[today])
  const habitsDone = todaysHabits.filter((h) => h.log[today]).length

  let summary: string
  if (open.length === 0 && doneToday.length > 0) summary = 'Everything for today is done. The evening is yours.'
  else if (open.length === 0) summary = 'Nothing is due today. A good day to go slowly.'
  else summary = `${open.length} ${open.length === 1 ? 'thing' : 'things'} to look after today.`

  return (
    <>
      <TopBar crumbs={[{ label: 'Today' }]} />
      <div className="view">
        <header className="view-header">
          <div className="eyebrow">{weekday(today)}</div>
          <h1>{longDate(today)}</h1>
          <p className="lede">
            {greeting()}. {summary}
          </p>
        </header>

        <TodayTimeline today={today} />

        <section className="section">
          <div className="section-head">
            <h2>Today</h2>
            {open.length + doneToday.length > 0 && (
              <span className="count">
                {doneToday.length}/{open.length + doneToday.length} done
              </span>
            )}
            <a className="section-link" href="#/upcoming">
              Upcoming <ArrowRight size={14} />
            </a>
          </div>
          <TaskComposer defaultDue={today} placeholder="Add a task for today" />
          <TaskList tasks={[...open, ...doneToday]} />
        </section>

        {todaysHabits.length > 0 && (
          <section className="section">
            <div className="section-head">
              <h2>Habits</h2>
              <span className="count">
                {habitsDone}/{todaysHabits.length} today
              </span>
              <a className="section-link" href="#/habits">
                This week <ArrowRight size={14} />
              </a>
            </div>
            <div className="habit-chips">
              {todaysHabits.map((h) => {
                const done = !!h.log[today]
                const streak = habitStreak(h, today)
                return (
                  <button
                    key={h.id}
                    type="button"
                    className={`habit-chip${done ? ' done' : ''}`}
                    aria-pressed={done}
                    onClick={() => toggleHabit(h.id, today)}
                  >
                    <span className="habit-chip-icon">{h.icon}</span>
                    <span className="habit-chip-name">{h.name}</span>
                    {streak > 1 && (
                      <span className="streak" title={`${streak} days in a row`}>
                        <Flame size={13} />
                        {streak}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        <section className="section">
          <div className="section-head">
            <h2>Life areas</h2>
          </div>
          {areas.length === 0 ? (
            <div className="empty">
              <p>Areas are the big parts of your life: health, home, money, people.</p>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  window.location.hash = `/area/${addArea()}`
                }}
              >
                Create your first area
              </button>
            </div>
          ) : (
            <div className="area-grid">
              {areas.map((a) => {
                const mine = tasks.filter((t) => t.areaId === a.id)
                const openTasks = mine.filter((t) => !t.done).sort(byDue)
                const pct = mine.length ? Math.round(((mine.length - openTasks.length) / mine.length) * 100) : 0
                const pageCount = pages.filter((p) => p.areaId === a.id).length
                return (
                  <a key={a.id} className="area-card" href={`#/area/${a.id}`} style={{ '--area': a.color } as CSSProperties}>
                    <div className="area-card-top">
                      <span className="area-card-icon">{a.icon}</span>
                      <span className="area-card-name">{a.name || 'Untitled'}</span>
                    </div>
                    <div className="area-card-next">{openTasks[0] ? openTasks[0].title : 'Nothing open'}</div>
                    <div className="area-card-foot">
                      <span>
                        {openTasks.length} open · {pageCount} {pageCount === 1 ? 'page' : 'pages'}
                      </span>
                      <span className="bar" aria-hidden="true">
                        <span style={{ width: `${pct}%` }} />
                      </span>
                    </div>
                  </a>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </>
  )
}

/** Today's timed tasks as a short timeline, with what's on now highlighted. */
function TodayTimeline({ today }: { today: string }) {
  const tasks = useStore((s) => s.tasks)
  const areas = useStore((s) => s.areas)
  const toggleTask = useStore((s) => s.toggleTask)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  const timed = tasks.filter((t) => t.due === today && t.time).sort(byDue)
  if (timed.length === 0) return null
  const nowMin = now.getHours() * 60 + now.getMinutes()

  return (
    <section className="section timeline-section">
      <div className="section-head">
        <h2>Schedule</h2>
        <a className="section-link" href="#/calendar/week">
          Week <ArrowRight size={14} />
        </a>
      </div>
      <ol className="timeline">
        {timed.map((t) => {
          const start = toMinutes(t.time!)
          const end = start + (t.duration ?? 60)
          const state = t.done ? 'done' : nowMin >= end ? 'past' : nowMin >= start ? 'now' : 'next'
          const color = areas.find((a) => a.id === t.areaId)?.color ?? 'var(--text-3)'
          return (
            <li key={t.id} className={`timeline-item ${state}`} style={{ '--area': color } as CSSProperties}>
              <span className="timeline-time">{formatTime(t.time!)}</span>
              <span className="timeline-bar" aria-hidden="true" />
              <Checkbox checked={t.done} onChange={() => toggleTask(t.id)} color={color} label={t.done ? 'Mark as not done' : 'Mark as done'} />
              <span className="timeline-title">{t.title || 'Untitled'}</span>
              {state === 'now' && <span className="timeline-now">Now</span>}
              <span className="timeline-length">{formatDuration(t.duration ?? 60)}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
