import { CalendarDays, CircleSlash, Clock, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { addDays, nextMonday, nextSaturday, relativeLabel, todayKey, weekday } from '../lib/date'
import { DURATIONS, formatDuration, formatTime } from '../lib/time'
import { showToast } from '../lib/toast'
import { useStore } from '../store'
import type { Area, Repeat, Task } from '../types'
import { usePopover } from '../lib/usePopover'
import { RepeatChip } from './repeat'
import { Checkbox, MenuDivider, MenuItem, Popover } from './ui'

/* ---------- Pickers ---------- */

export interface When {
  due?: string
  time?: string
  duration?: number
}

/** Pick a day, and optionally a start time and length for time blocking. */
export function DueMenu({ value, onChange, onDone }: { value: When; onChange: (when: When) => void; onDone: () => void }) {
  const today = todayKey()
  const options = [
    { label: 'Today', key: today },
    { label: 'Tomorrow', key: addDays(today, 1) },
    { label: 'This weekend', key: nextSaturday(today) },
    { label: 'Next week', key: nextMonday(today) },
  ]
  const setDue = (due?: string) => onChange(due ? { ...value, due } : {})
  return (
    <div className="due-menu">
      {options.map((o) => (
        <MenuItem
          key={o.label}
          label={o.label}
          hint={weekday(o.key, 'short')}
          active={value.due === o.key}
          onSelect={() => {
            setDue(o.key)
            if (!value.time) onDone()
          }}
        />
      ))}
      <MenuDivider />
      <label className="date-field">
        <span>Pick a date</span>
        <input type="date" value={value.due ?? ''} onChange={(e) => setDue(e.target.value || undefined)} />
      </label>
      <div className="time-field">
        <Clock size={14} />
        <input
          type="time"
          step={300}
          value={value.time ?? ''}
          aria-label="Start time"
          onChange={(e) =>
            onChange({
              due: value.due ?? today,
              time: e.target.value || undefined,
              duration: e.target.value ? (value.duration ?? 60) : undefined,
            })
          }
        />
        {value.time ? (
          <select
            value={value.duration ?? 60}
            aria-label="Length"
            onChange={(e) => onChange({ ...value, duration: Number(e.target.value) })}
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {formatDuration(d)}
              </option>
            ))}
          </select>
        ) : (
          <span className="time-hint">Add a time</span>
        )}
      </div>
      {(value.due || value.time) && (
        <>
          <MenuDivider />
          {value.time && (
            <MenuItem icon={<Clock size={15} />} label="Any time that day" onSelect={() => onChange({ due: value.due })} />
          )}
          <MenuItem
            icon={<CircleSlash size={15} />}
            label="No date"
            onSelect={() => {
              setDue(undefined)
              onDone()
            }}
          />
        </>
      )}
    </div>
  )
}

export function AreaMenu({ value, onChange }: { value?: string; onChange: (areaId?: string) => void }) {
  const areas = useStore((s) => s.areas)
  return (
    <div className="area-menu">
      {areas.map((a) => (
        <MenuItem key={a.id} icon={a.icon} label={a.name || 'Untitled'} active={value === a.id} onSelect={() => onChange(a.id)} />
      ))}
      {areas.length > 0 && <MenuDivider />}
      <MenuItem icon={<CircleSlash size={15} />} label="No area" active={!value} onSelect={() => onChange(undefined)} />
    </div>
  )
}

function DueChip({ value, onChange, done }: { value: When; onChange: (when: When) => void; done?: boolean }) {
  const pop = usePopover()
  const today = todayKey()
  const due = value.due
  const overdue = !!due && due < today && !done
  const label = due ? relativeLabel(due) + (value.time ? ` · ${formatTime(value.time)}` : '') : ''
  return (
    <>
      <button
        type="button"
        className={`chip${due ? '' : ' unset'}${overdue ? ' overdue' : ''}${due === today && !done ? ' today' : ''}`}
        onClick={pop.open}
        aria-label={due ? `Due ${label}` : 'Set a date'}
      >
        <CalendarDays size={13} />
        {due && <span>{label}</span>}
      </button>
      {pop.anchor && (
        <Popover anchor={pop.anchor} onClose={pop.close} align="end" width={252}>
          <DueMenu value={value} onChange={onChange} onDone={pop.close} />
        </Popover>
      )}
    </>
  )
}

function AreaChip({ area, onChange }: { area?: Area; onChange: (areaId?: string) => void }) {
  const pop = usePopover()
  return (
    <>
      <button
        type="button"
        className={`chip area-chip${area ? '' : ' unset'}`}
        style={area ? ({ '--chip': area.color } as CSSProperties) : undefined}
        onClick={pop.open}
        aria-label={area ? `Area: ${area.name}` : 'Choose an area'}
      >
        {area ? (
          <>
            <span className="chip-dot" />
            <span>{area.name || 'Untitled'}</span>
          </>
        ) : (
          <span>Area</span>
        )}
      </button>
      {pop.anchor && (
        <Popover anchor={pop.anchor} onClose={pop.close} align="end" width={220}>
          <AreaMenu
            value={area?.id}
            onChange={(id) => {
              onChange(id)
              pop.close()
            }}
          />
        </Popover>
      )}
    </>
  )
}

/* ---------- Task row ---------- */

const SWIPE_OPEN = 96
const SWIPE_DELETE = 170

export function TaskRow({ task, showArea = true }: { task: Task; showArea?: boolean }) {
  const area = useStore((s) => s.areas.find((a) => a.id === task.areaId))
  const updateTask = useStore((s) => s.updateTask)
  const toggleTask = useStore((s) => s.toggleTask)
  const deleteTask = useStore((s) => s.deleteTask)
  const restoreTask = useStore((s) => s.restoreTask)
  const setRepeat = useStore((s) => s.setRepeat)
  const skipOccurrence = useStore((s) => s.skipOccurrence)

  // Swipe left to delete (touch screens).
  const [offset, setOffset] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const swipe = useRef<{ x: number; y: number; start: number; horizontal?: boolean } | null>(null)

  const remove = () => {
    const index = useStore.getState().tasks.findIndex((t) => t.id === task.id)
    const copy = task
    deleteTask(task.id)
    showToast(`Deleted “${copy.title || 'Untitled'}”`, { label: 'Undo', run: () => restoreTask(copy, index) })
  }

  const endSwipe = () => {
    const s = swipe.current
    swipe.current = null
    setSwiping(false)
    if (!s?.horizontal) return
    if (offset <= -SWIPE_DELETE) remove()
    else setOffset(offset < -40 ? -SWIPE_OPEN : 0)
  }

  return (
    <div className={`task-swipe${offset ? ' open' : ''}`}>
      {offset !== 0 && (
        <button
          type="button"
          className="swipe-delete"
          style={{ width: Math.max(SWIPE_OPEN, -offset) }}
          onClick={remove}
          aria-label="Delete task"
        >
          <Trash2 size={18} />
          <span>Delete</span>
        </button>
      )}
      <div
        className={`task${task.done ? ' done' : ''}`}
        style={offset ? { transform: `translateX(${offset}px)`, transition: swiping ? 'none' : undefined } : undefined}
        onPointerDown={(e) => {
          if (e.pointerType !== 'touch') return
          swipe.current = { x: e.clientX, y: e.clientY, start: offset }
        }}
        onPointerMove={(e) => {
          const s = swipe.current
          if (!s) return
          const dx = e.clientX - s.x
          const dy = e.clientY - s.y
          if (s.horizontal === undefined) {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
            s.horizontal = Math.abs(dx) > Math.abs(dy)
            if (!s.horizontal) {
              swipe.current = null
              return
            }
            setSwiping(true)
          }
          setOffset(Math.min(0, Math.max(-window.innerWidth, s.start + dx)))
        }}
        onPointerUp={endSwipe}
        onPointerCancel={endSwipe}
        onClickCapture={(e) => {
          // While the delete button is showing, a tap on the row just closes it.
          if (offset && !swiping) {
            e.preventDefault()
            e.stopPropagation()
            setOffset(0)
          }
        }}
      >
        <Checkbox
          checked={task.done}
          onChange={() => toggleTask(task.id)}
          color={area?.color}
          label={task.done ? 'Mark as not done' : 'Mark as done'}
        />
        <input
          className="task-title"
          value={task.title}
          aria-label="Task"
          placeholder="Untitled task"
          onChange={(e) => updateTask(task.id, { title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
          }}
          onBlur={(e) => {
            if (!e.target.value.trim()) deleteTask(task.id)
          }}
        />
        <div className="task-meta">
          {showArea && <AreaChip area={area} onChange={(areaId) => updateTask(task.id, { areaId })} />}
          {!task.done && (
            <RepeatChip
              value={task.repeat}
              base={task.due}
              onChange={(rule) => setRepeat(task.id, rule)}
              onSkip={() => skipOccurrence(task.id)}
            />
          )}
          <DueChip
            value={{ due: task.due, time: task.time, duration: task.duration }}
            done={task.done}
            onChange={(when) => updateTask(task.id, { due: when.due, time: when.time, duration: when.duration })}
          />
          <button type="button" className="icon-btn subtle task-delete" aria-label="Delete task" title="Delete" onClick={remove}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

export function TaskList({ tasks, showArea = true }: { tasks: Task[]; showArea?: boolean }) {
  return (
    <div className="task-list">
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} showArea={showArea} />
      ))}
    </div>
  )
}

/* ---------- Composer ---------- */

interface ComposerProps {
  defaultDue?: string
  defaultTime?: string
  defaultDuration?: number
  defaultAreaId?: string
  placeholder?: string
  showArea?: boolean
  autoFocus?: boolean
  /** Called after a task is added (e.g. to close a popover) */
  onAdded?: () => void
}

export function TaskComposer({
  defaultDue,
  defaultTime,
  defaultDuration,
  defaultAreaId,
  placeholder = 'Add a task',
  showArea = true,
  autoFocus,
  onAdded,
}: ComposerProps) {
  const addTask = useStore((s) => s.addTask)
  const areas = useStore((s) => s.areas)
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState<When>({
    due: defaultDue,
    time: defaultTime,
    duration: defaultTime ? (defaultDuration ?? 60) : undefined,
  })
  const [areaId, setAreaId] = useState(defaultAreaId)
  const [repeat, setRepeat] = useState<Repeat | undefined>()
  const area = areas.find((a) => a.id === areaId)
  const inputRef = useRef<HTMLInputElement>(null)

  // In a pop-up the field becomes visible a frame later, so focus it then.
  useEffect(() => {
    if (!autoFocus) return
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [autoFocus])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!title.trim()) return
    addTask({ title, ...when, areaId: area?.id, repeat })
    setTitle('')
    setRepeat(undefined)
    onAdded?.()
  }

  return (
    <form className="composer" onSubmit={submit}>
      <Plus size={17} className="composer-plus" />
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <div className="task-meta">
        {showArea && <AreaChip area={area} onChange={setAreaId} />}
        <RepeatChip value={repeat} base={when.due} onChange={setRepeat} />
        <DueChip value={when} onChange={setWhen} />
      </div>
    </form>
  )
}
