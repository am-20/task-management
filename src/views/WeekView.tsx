import { Columns3, List, Plus, Repeat as RepeatIcon, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { TaskComposer, TaskList, TaskRow } from '../components/tasks'
import { Checkbox, Popover } from '../components/ui'
import { addDays, fromKey, longDate, weekday } from '../lib/date'
import { describeRepeat, upcomingDates } from '../lib/repeat'
import { byDue } from '../lib/sort'
import { formatHour, formatRange, formatTime, fromMinutes, hourRange, toMinutes } from '../lib/time'
import { showToast } from '../lib/toast'
import { useIsPhone } from '../lib/useMedia'
import { useStore } from '../store'
import type { Task } from '../types'

const SNAP = 15
const DAY = 24 * 60
const DEFAULT_LENGTH = 60
/** How long to hold a finger on a task before it can be dragged */
const LONG_PRESS = 350

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
  const layout = useStore((s) => s.weekLayout)
  const setLayout = useStore((s) => s.setWeekLayout)
  if (!phone) return <WeekGrid data={data} today={today} />
  return (
    <>
      <div className="segmented week-layout" role="radiogroup" aria-label="Week layout">
        <button type="button" role="radio" aria-checked={layout === 'columns'} className={layout === 'columns' ? 'on' : ''} onClick={() => setLayout('columns')}>
          <Columns3 size={15} /> Columns
        </button>
        <button type="button" role="radio" aria-checked={layout === 'list'} className={layout === 'list' ? 'on' : ''} onClick={() => setLayout('list')}>
          <List size={15} /> List
        </button>
      </div>
      {layout === 'columns' ? <WeekGrid data={data} today={today} compact /> : <WeekAgenda data={data} today={today} />}
    </>
  )
}

/* ---------- Phone list: one section per day ---------- */

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
            </div>
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
            {adding === day ? (
              <TaskComposer key={day} defaultDue={day} autoFocus placeholder={`Add to ${weekday(day)}`} onAdded={() => setAdding(null)} />
            ) : (
              <button type="button" className="agenda-add" onClick={() => setAdding(day)}>
                <Plus size={16} />
                Add a task
              </button>
            )}
          </section>
        )
      })}
    </div>
  )
}

/* ---------- Time grid (desktop, and "Columns" on a phone) ---------- */

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
  lastY: number
  active: boolean
  /** Minutes between the block's start and where it was grabbed */
  grab: number
  origin: { due: string; time?: string; duration: number }
  preview: { due: string; time?: string; duration: number }
  anchor: DOMRect
}

function WeekGrid({ data, today, compact = false }: { data: WeekData; today: string; compact?: boolean }) {
  const HOUR = compact ? 44 : 52
  const areas = useStore((s) => s.areas)
  const allTasks = useStore((s) => s.tasks)
  const updateTask = useStore((s) => s.updateTask)
  const toggleTask = useStore((s) => s.toggleTask)
  const deleteTask = useStore((s) => s.deleteTask)
  const restoreTask = useStore((s) => s.restoreTask)
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

  const range = useMemo(() => hourRange([...data.timed.values()].flat().map((i) => i.task)), [data])
  const span = range.end - range.start

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  // Open on the morning (7:00) or the first task, whichever is earlier.
  useEffect(() => {
    const starts = [...data.timed.values()].flat().map((i) => toMinutes(i.task.time!))
    const first = Math.min(7 * 60, ...starts)
    if (scrollRef.current && !compact) scrollRef.current.scrollTop = Math.max(0, ((first - range.start) / 60) * HOUR - 12)
    // Only when the week changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.days[0]])

  const minutesAt = (clientY: number) => {
    const el = scrollRef.current!
    return range.start + ((clientY - el.getBoundingClientRect().top + el.scrollTop) / HOUR) * 60
  }
  const dayAt = (clientX: number) => {
    const rects = colRefs.current.map((c) => c!.getBoundingClientRect())
    let i = rects.findIndex((r) => clientX >= r.left && clientX < r.right)
    if (i === -1) i = clientX < rects[0].left ? 0 : 6
    return data.days[i]
  }
  const snap = (m: number) => Math.round(m / SNAP) * SNAP

  /** Work out where the dragged task would land for a pointer position. */
  const track = (cur: Drag, x: number, y: number) => {
    const goingUp = y < cur.lastY
    cur.lastY = y
    // On phones the grid is part of the page, so the page scrolls; on desktop the grid has its own scroll.
    const scroller = compact ? (scrollRef.current!.closest('.main') as HTMLElement) : scrollRef.current!
    const box = scroller.getBoundingClientRect()
    if (cur.kind === 'resize' && cur.origin.time) {
      const start = toMinutes(cur.origin.time)
      const length = Math.min(range.end - start, Math.max(SNAP, snap(minutesAt(y) - start)))
      cur.preview = { ...cur.preview, duration: length }
    } else {
      const lane = laneRef.current!.getBoundingClientRect()
      const due = dayAt(x)
      if (y < lane.bottom) {
        cur.preview = { due, time: undefined, duration: cur.origin.duration }
      } else {
        const latest = Math.max(range.start, range.end - cur.origin.duration)
        const start = Math.min(latest, Math.max(range.start, snap(minutesAt(y) - cur.grab)))
        cur.preview = { due, time: fromMinutes(start), duration: cur.origin.duration }
      }
    }
    // Scroll the grid near its top or bottom edge (only upwards when moving up,
    // so coming down from the "Any time" row doesn't scroll it).
    if (y > box.bottom - 28 && !goingUp) scroller.scrollTop += 14
    else if (goingUp && y < box.top + (compact ? 120 : 28) && y > box.top && cur.preview.time) scroller.scrollTop -= 14
    setDrag({ ...cur })
  }

  const finish = (cur: Drag | null, wasTap: boolean) => {
    dragRef.current = null
    setDrag(null)
    if (!cur) return
    if (cur.active) {
      justDragged.current = true
      window.setTimeout(() => (justDragged.current = false), 0)
      const p = cur.preview
      const task = allTasks.find((t) => t.id === cur.id)
      updateTask(cur.id, { due: p.due, time: p.time, duration: p.time ? p.duration : task?.duration })
    } else if (wasTap) {
      setEditing({ id: cur.id, anchor: cur.anchor })
    }
  }

  const begin = (e: ReactPointerEvent<HTMLElement>, item: Item, kind: Drag['kind']) => {
    if (item.ghost || e.button !== 0) return
    if ((e.target as HTMLElement).closest('.check')) return
    if (kind === 'resize') e.stopPropagation()
    const t = item.task
    const duration = t.duration ?? DEFAULT_LENGTH
    const cur: Drag = {
      id: t.id,
      kind,
      startX: e.clientX,
      startY: e.clientY,
      lastY: e.clientY,
      active: false,
      grab: t.time ? Math.max(0, minutesAt(e.clientY) - toMinutes(t.time)) : 15,
      origin: { due: item.date, time: t.time, duration },
      preview: { due: item.date, time: t.time, duration },
      anchor: e.currentTarget.getBoundingClientRect(),
    }
    dragRef.current = cur

    if (e.pointerType === 'touch') {
      beginTouch(cur)
      return
    }

    // Mouse / pen: drag once it moves a few pixels; otherwise it's a click.
    e.preventDefault()
    const move = (ev: PointerEvent) => {
      if (dragRef.current !== cur) return
      if (!cur.active && Math.hypot(ev.clientX - cur.startX, ev.clientY - cur.startY) < 4) return
      cur.active = true
      track(cur, ev.clientX, ev.clientY)
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      finish(dragRef.current === cur ? cur : null, ev.type === 'pointerup')
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  /**
   * Fingers: a quick tap opens the task, a swipe scrolls as usual, and pressing
   * and holding picks the task up so it can be dragged.
   */
  const beginTouch = (cur: Drag) => {
    let moved = false
    const timer = window.setTimeout(() => {
      if (moved || dragRef.current !== cur) return
      cur.active = true
      navigator.vibrate?.(8)
      setDrag({ ...cur })
    }, LONG_PRESS)
    const onMove = (ev: TouchEvent) => {
      const p = ev.touches[0]
      if (!p || dragRef.current !== cur) return
      if (cur.active) {
        ev.preventDefault() // hold the page still while dragging
        track(cur, p.clientX, p.clientY)
      } else if (Math.hypot(p.clientX - cur.startX, p.clientY - cur.startY) > 8) {
        moved = true // it's a scroll
        window.clearTimeout(timer)
      }
    }
    const onEnd = (ev: TouchEvent) => {
      window.clearTimeout(timer)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
      if (dragRef.current !== cur) return
      const tap = !moved && !cur.active && ev.type === 'touchend'
      // Stop the phone's delayed "click" from landing on whatever opens next.
      if (cur.active || tap) ev.preventDefault()
      finish(cur, tap)
    }
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
  }

  const startCreate = (day: string, clientX: number, clientY: number, timed: boolean) => {
    if (justDragged.current) return
    const time = timed
      ? fromMinutes(Math.min(range.end - 30, Math.max(range.start, Math.floor(minutesAt(clientY) / 30) * 30)))
      : undefined
    setCreating({ day, time, anchor: new DOMRect(clientX, clientY, 0, 0) })
  }

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const dragging = drag?.active ? drag : null
  const editingTask = editing ? allTasks.find((t) => t.id === editing.id) : undefined
  const hours = Array.from({ length: span / 60 }, (_, i) => range.start / 60 + i)

  const blockStyle = (task: Task, time: string, duration: number, pos?: { col: number; cols: number }) =>
    ({
      top: ((toMinutes(time) - range.start) / 60) * HOUR,
      height: Math.max((SNAP / 60) * HOUR, (Math.min(duration, range.end - toMinutes(time)) / 60) * HOUR) - 2,
      left: pos ? `calc(${(pos.col / pos.cols) * 100}% + 2px)` : 2,
      width: pos ? `calc(${100 / pos.cols}% - 4px)` : 'calc(100% - 4px)',
      '--area': color(task.areaId),
    }) as CSSProperties

  return (
    <div className={`week${compact ? ' compact' : ''}${dragging ? ' is-dragging' : ''}`} style={{ '--hour': `${HOUR}px` } as CSSProperties}>
      <div className="week-row week-head">
        <div className="week-gutter" />
        {data.days.map((day) => (
          <div key={day} className={`week-day-head${day === today ? ' today' : ''}${day < today ? ' past' : ''}`}>
            <span>{weekday(day, compact ? 'narrow' : 'short')}</span>
            <b>{fromKey(day).getDate()}</b>
          </div>
        ))}
      </div>

      <div className="week-row week-lane" ref={laneRef}>
        <div className="week-gutter lane-label">{compact ? 'Any' : 'Any time'}</div>
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
                  {!item.ghost && !compact && (
                    <Checkbox checked={item.task.done} onChange={() => toggleTask(item.task.id)} color={color(item.task.areaId)} label="Done" />
                  )}
                  {item.ghost && !compact && <RepeatIcon size={11} />}
                  <span className="lane-title">{item.task.title || 'Untitled'}</span>
                </div>
              ))}
              {!compact && (
                <button type="button" className="lane-add" aria-label={`Add a task on ${weekday(day)}`} onClick={(e) => startCreate(day, e.clientX, e.clientY, false)}>
                  <Plus size={13} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="week-scroll" ref={scrollRef}>
        <div className="week-row week-body" style={{ height: (span / 60) * HOUR }}>
          <div className="week-gutter hours">
            {hours.map((h) => (
              <span key={h} style={{ top: (h - range.start / 60) * HOUR }}>
                {h * 60 === range.start ? '' : compact ? String(h) : formatHour(h)}
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
                      className={`wblock${t.done ? ' done' : ''}${item.ghost ? ' ghost' : ''}${tall ? '' : ' short'}${dragging && !item.ghost && t.id === dragging.id ? ' source' : ''}`}
                      style={blockStyle(t, t.time!, duration, layout.get(item))}
                      onPointerDown={(e) => begin(e, item, 'move')}
                      title={`${t.title} · ${formatRange(t.time!, duration)}`}
                    >
                      <div className="wblock-top">
                        {!item.ghost && !compact && (
                          <Checkbox checked={t.done} onChange={() => toggleTask(t.id)} color={color(t.areaId)} label="Done" />
                        )}
                        <span className="wblock-title">{t.title || 'Untitled'}</span>
                      </div>
                      {tall && !compact && <span className="wblock-time">{formatRange(t.time!, duration)}</span>}
                      {!item.ghost && !t.done && (
                        <span className="wblock-resize" onPointerDown={(e) => begin(e, item, 'resize')} aria-hidden="true" />
                      )}
                    </div>
                  )
                })}
                {dragged && dragging?.preview.time && (
                  <div className="wblock preview" style={blockStyle(dragged, dragging.preview.time, dragging.preview.duration)}>
                    <div className="wblock-top">
                      <span className="wblock-title">{dragged.title}</span>
                    </div>
                    <span className="wblock-time">{formatRange(dragging.preview.time, dragging.preview.duration)}</span>
                  </div>
                )}
                {day === today && nowMin >= range.start && nowMin <= range.end && (
                  <div className="now-line" style={{ top: ((nowMin - range.start) / 60) * HOUR }} aria-hidden="true" />
                )}
              </div>
            )
          })}
        </div>
      </div>
      {compact && <p className="week-hint">Tap a task to open it · hold and drag to move it · tap an empty spot to add</p>}

      {editing && editingTask && (
        <Popover anchor={editing.anchor} onClose={() => setEditing(null)} width={440} className="task-popover">
          <TaskRow task={editingTask} />
          {editingTask.due && (
            <p className="task-popover-note">
              {weekday(editingTask.due, 'long')}, {longDate(editingTask.due)}
              {editingTask.time && ` · ${formatRange(editingTask.time, editingTask.duration ?? DEFAULT_LENGTH)}`}
            </p>
          )}
          <button
            type="button"
            className="card-delete"
            onClick={() => {
              const index = useStore.getState().tasks.findIndex((t) => t.id === editingTask.id)
              const copy = editingTask
              setEditing(null)
              deleteTask(copy.id)
              showToast(`Deleted “${copy.title || 'Untitled'}”`, { label: 'Undo', run: () => restoreTask(copy, index) })
            }}
          >
            <Trash2 size={15} /> Delete task
          </button>
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
