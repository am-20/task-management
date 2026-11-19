import { Plus, Repeat as RepeatIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { TaskComposer, TaskList, TaskRow } from '../components/tasks'
import { Checkbox, Popover } from '../components/ui'
import { addDays, fromKey, longDate, weekday } from '../lib/date'
import { describeRepeat, upcomingDates } from '../lib/repeat'
import { byDue } from '../lib/sort'
import { formatHour, formatRange, formatTime, fromMinutes, toMinutes } from '../lib/time'
import { useIsPhone } from '../lib/useMedia'
import { useStore } from '../store'
import type { Task } from '../types'

/** Height of one hour in the time grid, in pixels */
const HOUR = 52
const SNAP = 15
const DAY = 24 * 60
const DEFAULT_LENGTH = 60

interface Item {
  task: Task
  date: string
  /** A future repeat, shown for planning but not a real task yet */
  ghost?: boolean
}

interface WeekData {
  days: string[]
  untimed: Map<string, Item[]>
  timed: Map<string, Item[]>
}

function useWeekData(week: string): WeekData {
  const tasks = useStore((s) => s.tasks)
  return useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(week, i))
    const start = days[0]
    const end = days[6]
    const untimed = new Map<string, Item[]>(days.map((d) => [d, []]))
    const timed = new Map<string, Item[]>(days.map((d) => [d, []]))
    const put = (item: Item) => (item.task.time ? timed : untimed).get(item.date)?.push(item)
    for (const t of tasks) {
      if (!t.due) continue
      if (t.due >= start && t.due <= end) put({ task: t, date: t.due })
      if (!t.done && t.repeat) {
        for (const date of upcomingDates(t.repeat, t.due, start, end)) put({ task: t, date, ghost: true })
      }
    }
    const order = (a: Item, b: Item) =>
      Number(!!a.ghost) - Number(!!b.ghost) || Number(a.task.done) - Number(b.task.done) || byDue(a.task, b.task)
    for (const list of [...untimed.values(), ...timed.values()]) list.sort(order)
    return { days, untimed, timed }
  }, [tasks, week])
}

export function WeekView({ week, today }: { week: string; today: string }) {
  const phone = useIsPhone()
  const data = useWeekData(week)
  return phone ? <WeekAgenda data={data} today={today} /> : <WeekGrid data={data} today={today} />
}

/* ---------- Phone: one list per day ---------- */

function WeekAgenda({ data, today }: { data: WeekData; today: string }) {
  const [adding, setAdding] = useState<string | null>(null)
  return (
    <div className="week-agenda">
      {data.days.map((day) => {
        const items = [...(data.timed.get(day) ?? []), ...(data.untimed.get(day) ?? [])]
        const real = items.filter((i) => !i.ghost).map((i) => i.task).sort(byDue)
        const ghosts = items.filter((i) => i.ghost)
        return (
          <section key={day} className={`agenda-day${day === today ? ' today' : ''}${day < today ? ' past' : ''}`}>
            <div className="agenda-head">
              <span className="agenda-date">
                <b>{fromKey(day).getDate()}</b>
                <span>{day === today ? 'Today' : weekday(day)}</span>
              </span>
              {real.length > 0 && <span className="count">{real.length}</span>}
              <button
                type="button"
                className="icon-btn subtle agenda-add"
                aria-label={`Add a task on ${weekday(day)}`}
                onClick={() => setAdding(adding === day ? null : day)}
              >
                <Plus size={16} />
              </button>
            </div>
            {adding === day && (
              <TaskComposer key={day} defaultDue={day} autoFocus placeholder={`Add to ${weekday(day)}`} />
            )}
            <TaskList tasks={real} />
            {ghosts.map((g) => (
              <div key={g.task.id + g.date} className="ghost-row">
                <RepeatIcon size={14} />
                <span className="ghost-title">
                  {g.task.time && <span className="ghost-time">{formatTime(g.task.time)}</span>}
                  {g.task.title}
                </span>
                <span className="ghost-rule">{describeRepeat(g.task.repeat!, true)}</span>
              </div>
            ))}
            {real.length === 0 && ghosts.length === 0 && adding !== day && <p className="agenda-empty">Nothing planned</p>}
          </section>
        )
      })}
    </div>
  )
}

/* ---------- Desktop: time grid ---------- */

/** Side-by-side placement for overlapping blocks in one day. */
function layoutDay(items: Item[]): Map<Item, { col: number; cols: number }> {
  const spans = items
    .map((item) => {
      const start = toMinutes(item.task.time!)
      return { item, start, end: Math.min(DAY, start + Math.max(SNAP, item.task.duration ?? DEFAULT_LENGTH)) }
    })
    .sort((a, b) => a.start - b.start || b.end - a.end)
  const out = new Map<Item, { col: number; cols: number }>()
  let group: typeof spans = []
  let groupEnd = -1
  let colEnds: number[] = []
  const flush = () => {
    const cols = colEnds.length
    for (const s of group) out.get(s.item)!.cols = cols
    group = []
    colEnds = []
  }
  for (const s of spans) {
    if (s.start >= groupEnd && group.length) flush()
    let col = colEnds.findIndex((end) => end <= s.start)
    if (col === -1) {
      col = colEnds.length
      colEnds.push(s.end)
    } else colEnds[col] = s.end
    out.set(s.item, { col, cols: 1 })
    group.push(s)
    groupEnd = Math.max(groupEnd, s.end)
  }
  if (group.length) flush()
  return out
}

interface Drag {
  id: string
  kind: 'move' | 'resize'
  startX: number
  startY: number
  active: boolean
  /** Minutes between the block's start and where it was grabbed */
  grab: number
  origin: { due: string; time?: string; duration: number }
  preview: { due: string; time?: string; duration: number }
  anchor: DOMRect
}

function WeekGrid({ data, today }: { data: WeekData; today: string }) {
  const areas = useStore((s) => s.areas)
  const allTasks = useStore((s) => s.tasks)
  const updateTask = useStore((s) => s.updateTask)
  const toggleTask = useStore((s) => s.toggleTask)
  const color = (id?: string) => areas.find((a) => a.id === id)?.color ?? 'var(--text-3)'

  const scrollRef = useRef<HTMLDivElement>(null)
  const laneRef = useRef<HTMLDivElement>(null)
  const colRefs = useRef<(HTMLDivElement | null)[]>([])
  const dragRef = useRef<Drag | null>(null)
  /** Set briefly after a drag, so the release isn't taken as a click on empty space */
  const justDragged = useRef(false)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [editing, setEditing] = useState<{ id: string; anchor: DOMRect } | null>(null)
  const [creating, setCreating] = useState<{ day: string; time?: string; anchor: DOMRect } | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  // Start the day view around the first timed task, or 7:00.
  useEffect(() => {
    const starts = [...data.timed.values()].flat().map((i) => toMinutes(i.task.time!))
    const first = Math.min(7 * 60, ...starts)
    if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, (first / 60) * HOUR - 12)
    // Only when the week changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.days[0]])

  const minutesAt = (clientY: number) => {
    const el = scrollRef.current!
    return ((clientY - el.getBoundingClientRect().top + el.scrollTop) / HOUR) * 60
  }
  const dayAt = (clientX: number) => {
    const rects = colRefs.current.map((c) => c!.getBoundingClientRect())
    let i = rects.findIndex((r) => clientX >= r.left && clientX < r.right)
    if (i === -1) i = clientX < rects[0].left ? 0 : 6
    return data.days[i]
  }
  const snap = (m: number) => Math.round(m / SNAP) * SNAP

  const begin = (e: ReactPointerEvent<HTMLElement>, item: Item, kind: Drag['kind']) => {
    if (item.ghost || e.button !== 0) return
    if ((e.target as HTMLElement).closest('.check')) return
    if (kind === 'resize') e.stopPropagation()
    e.preventDefault()
    const t = item.task
    const duration = t.duration ?? DEFAULT_LENGTH
    const grab = t.time ? Math.max(0, minutesAt(e.clientY) - toMinutes(t.time)) : 15
    const d: Drag = {
      id: t.id,
      kind,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      grab,
      origin: { due: item.date, time: t.time, duration },
      preview: { due: item.date, time: t.time, duration },
      anchor: e.currentTarget.getBoundingClientRect(),
    }
    dragRef.current = d
    let lastY = e.clientY

    const move = (ev: PointerEvent) => {
      const cur = dragRef.current
      if (!cur) return
      const goingUp = ev.clientY < lastY
      lastY = ev.clientY
      if (!cur.active && Math.hypot(ev.clientX - cur.startX, ev.clientY - cur.startY) < 4) return
      cur.active = true
      const scroller = scrollRef.current!
      const box = scroller.getBoundingClientRect()
      if (cur.kind === 'resize' && cur.origin.time) {
        const start = toMinutes(cur.origin.time)
        const length = Math.min(DAY - start, Math.max(SNAP, snap(minutesAt(ev.clientY) - start)))
        cur.preview = { ...cur.preview, duration: length }
      } else {
        const lane = laneRef.current!.getBoundingClientRect()
        const due = dayAt(ev.clientX)
        if (ev.clientY < lane.bottom) {
          cur.preview = { due, time: undefined, duration: cur.origin.duration }
        } else {
          const start = Math.min(DAY - cur.origin.duration, Math.max(0, snap(minutesAt(ev.clientY) - cur.grab)))
          cur.preview = { due, time: fromMinutes(start), duration: cur.origin.duration }
        }
      }
      // Scroll the grid when dragging near its top or bottom edge.
      // (Only scroll up when actually moving up, not when coming down from the lane.)
      if (ev.clientY > box.bottom - 28 && !goingUp) scroller.scrollTop += 14
      else if (goingUp && ev.clientY < box.top + 28 && ev.clientY > box.top && cur.preview.time) scroller.scrollTop -= 14
      setDrag({ ...cur })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      const cur = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (!cur) return
      if (cur.active) {
        justDragged.current = true
        window.setTimeout(() => (justDragged.current = false), 0)
        const p = cur.preview
        updateTask(cur.id, { due: p.due, time: p.time, duration: p.time ? p.duration : t.duration })
      } else {
        setEditing({ id: cur.id, anchor: cur.anchor })
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const startCreate = (day: string, clientX: number, clientY: number, timed: boolean) => {
    if (justDragged.current) return
    const time = timed ? fromMinutes(Math.min(DAY - 30, Math.floor(minutesAt(clientY) / 30) * 30)) : undefined
    setCreating({ day, time, anchor: new DOMRect(clientX, clientY, 0, 0) })
  }

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const dragging = drag?.active ? drag : null
  const editingTask = editing ? allTasks.find((t) => t.id === editing.id) : undefined

  const blockStyle = (task: Task, time: string, duration: number, pos?: { col: number; cols: number }) =>
    ({
      top: (toMinutes(time) / 60) * HOUR,
      height: Math.max((SNAP / 60) * HOUR, (duration / 60) * HOUR) - 2,
      left: pos ? `calc(${(pos.col / pos.cols) * 100}% + 2px)` : 2,
      width: pos ? `calc(${100 / pos.cols}% - 4px)` : 'calc(100% - 4px)',
      '--area': color(task.areaId),
    }) as CSSProperties

  return (
    <div className={`week${dragging ? ' is-dragging' : ''}`}>
      <div className="week-row week-head">
        <div className="week-gutter" />
        {data.days.map((day) => (
          <div key={day} className={`week-day-head${day === today ? ' today' : ''}${day < today ? ' past' : ''}`}>
            <span>{weekday(day, 'short')}</span>
            <b>{fromKey(day).getDate()}</b>
          </div>
        ))}
      </div>

      <div className="week-row week-lane" ref={laneRef}>
        <div className="week-gutter lane-label">Any time</div>
        {data.days.map((day) => {
          // While dragging, the task stays (faded) where it was and the target day is
          // highlighted, so nothing shifts under the pointer.
          const items = data.untimed.get(day) ?? []
          const showPreview = dragging && !dragging.preview.time && dragging.preview.due === day
          return (
            <div
              key={day}
              className={`lane-cell${showPreview ? ' drop' : ''}`}
              onClick={(e) => {
                if (e.target === e.currentTarget) startCreate(day, e.clientX, e.clientY, false)
              }}
            >
              {items.map((item) => (
                <div
                  key={item.task.id + item.date}
                  className={`lane-item${item.task.done ? ' done' : ''}${item.ghost ? ' ghost' : ''}${dragging && !item.ghost && item.task.id === dragging.id ? ' source' : ''}`}
                  style={{ '--area': color(item.task.areaId) } as CSSProperties}
                  onPointerDown={(e) => begin(e, item, 'move')}
                  title={item.ghost ? `Repeats: ${describeRepeat(item.task.repeat!)}` : 'Drag into the grid to give it a time'}
                >
                  {!item.ghost && (
                    <Checkbox checked={item.task.done} onChange={() => toggleTask(item.task.id)} color={color(item.task.areaId)} label="Done" />
                  )}
                  {item.ghost && <RepeatIcon size={11} />}
                  <span className="lane-title">{item.task.title || 'Untitled'}</span>
                </div>
              ))}
              <button type="button" className="lane-add" aria-label={`Add a task on ${weekday(day)}`} onClick={(e) => startCreate(day, e.clientX, e.clientY, false)}>
                <Plus size={13} />
              </button>
            </div>
          )
        })}
      </div>

      <div className="week-scroll" ref={scrollRef}>
        <div className="week-row week-body" style={{ height: 24 * HOUR }}>
          <div className="week-gutter hours">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} style={{ top: h * HOUR }}>
                {h === 0 ? '' : formatHour(h)}
              </span>
            ))}
          </div>
          {data.days.map((day, i) => {
            const items = data.timed.get(day) ?? []
            const layout = layoutDay(items)
            const showPreview = dragging && dragging.preview.time && dragging.preview.due === day
            const dragged = showPreview ? allTasks.find((t) => t.id === dragging.id) : undefined
            return (
              <div
                key={day}
                ref={(el) => {
                  colRefs.current[i] = el
                }}
                className={`week-col${day === today ? ' today' : ''}`}
                onClick={(e) => {
                  if (e.target === e.currentTarget) startCreate(day, e.clientX, e.clientY, true)
                }}
              >
                {items.map((item) => {
                  const t = item.task
                  const duration = t.duration ?? DEFAULT_LENGTH
                  const tall = (duration / 60) * HOUR >= 34
                  return (
                    <div
                      key={t.id + item.date}
                      className={`block${t.done ? ' done' : ''}${item.ghost ? ' ghost' : ''}${tall ? '' : ' short'}${dragging && !item.ghost && t.id === dragging.id ? ' source' : ''}`}
                      style={blockStyle(t, t.time!, duration, layout.get(item))}
                      onPointerDown={(e) => begin(e, item, 'move')}
                      title={`${t.title} · ${formatRange(t.time!, duration)}`}
                    >
                      <div className="block-top">
                        {!item.ghost && (
                          <Checkbox checked={t.done} onChange={() => toggleTask(t.id)} color={color(t.areaId)} label="Done" />
                        )}
                        <span className="block-title">{t.title || 'Untitled'}</span>
                      </div>
                      {tall && <span className="block-time">{formatRange(t.time!, duration)}</span>}
                      {!item.ghost && !t.done && (
                        <span className="block-resize" onPointerDown={(e) => begin(e, item, 'resize')} aria-hidden="true" />
                      )}
                    </div>
                  )
                })}
                {dragged && dragging?.preview.time && (
                  <div className="block preview" style={blockStyle(dragged, dragging.preview.time, dragging.preview.duration)}>
                    <div className="block-top">
                      <span className="block-title">{dragged.title}</span>
                    </div>
                    <span className="block-time">{formatRange(dragging.preview.time, dragging.preview.duration)}</span>
                  </div>
                )}
                {day === today && <div className="now-line" style={{ top: (nowMin / 60) * HOUR }} aria-hidden="true" />}
              </div>
            )
          })}
        </div>
      </div>

      {editing && editingTask && (
        <Popover anchor={editing.anchor} onClose={() => setEditing(null)} width={440} className="task-popover">
          <TaskRow task={editingTask} />
          {editingTask.time && (
            <p className="task-popover-note">
              {weekday(editingTask.due!, 'long')}, {longDate(editingTask.due!)} · {formatRange(editingTask.time, editingTask.duration ?? DEFAULT_LENGTH)}
            </p>
          )}
        </Popover>
      )}
      {creating && (
        <Popover anchor={creating.anchor} onClose={() => setCreating(null)} width={460} className="task-popover">
          <p className="task-popover-note">
            New task · {weekday(creating.day, 'long')}, {longDate(creating.day)}
            {creating.time && ` · ${formatRange(creating.time, DEFAULT_LENGTH)}`}
          </p>
          <TaskComposer
            defaultDue={creating.day}
            defaultTime={creating.time}
            defaultDuration={DEFAULT_LENGTH}
            autoFocus
            placeholder="What’s the plan?"
            onAdded={() => setCreating(null)}
          />
        </Popover>
      )}
    </div>
  )
}
