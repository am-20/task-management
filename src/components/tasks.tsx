import { CalendarDays, CircleSlash, Plus, X } from 'lucide-react'
import { useState, type CSSProperties, type FormEvent } from 'react'
import { addDays, nextMonday, nextSaturday, relativeLabel, todayKey, weekday } from '../lib/date'
import { useStore } from '../store'
import type { Area, Repeat, Task } from '../types'
import { usePopover } from '../lib/usePopover'
import { RepeatChip } from './repeat'
import { Checkbox, MenuDivider, MenuItem, Popover } from './ui'

/* ---------- Pickers ---------- */

export function DueMenu({ value, onChange }: { value?: string; onChange: (due?: string) => void }) {
  const today = todayKey()
  const options = [
    { label: 'Today', key: today },
    { label: 'Tomorrow', key: addDays(today, 1) },
    { label: 'This weekend', key: nextSaturday(today) },
    { label: 'Next week', key: nextMonday(today) },
  ]
  return (
    <div className="due-menu">
      {options.map((o) => (
        <MenuItem
          key={o.label}
          label={o.label}
          hint={weekday(o.key, 'short')}
          active={value === o.key}
          onSelect={() => onChange(o.key)}
        />
      ))}
      <MenuDivider />
      <label className="date-field">
        <span>Pick a date</span>
        <input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} />
      </label>
      {value && (
        <>
          <MenuDivider />
          <MenuItem icon={<CircleSlash size={15} />} label="No date" onSelect={() => onChange(undefined)} />
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

function DueChip({ value, onChange, done }: { value?: string; onChange: (due?: string) => void; done?: boolean }) {
  const pop = usePopover()
  const today = todayKey()
  const overdue = !!value && value < today && !done
  return (
    <>
      <button
        type="button"
        className={`chip${value ? '' : ' unset'}${overdue ? ' overdue' : ''}${value === today && !done ? ' today' : ''}`}
        onClick={pop.open}
        aria-label={value ? `Due ${relativeLabel(value)}` : 'Set a date'}
      >
        <CalendarDays size={13} />
        {value && <span>{relativeLabel(value)}</span>}
      </button>
      {pop.anchor && (
        <Popover anchor={pop.anchor} onClose={pop.close} align="end" width={244}>
          <DueMenu
            value={value}
            onChange={(due) => {
              onChange(due)
              pop.close()
            }}
          />
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

export function TaskRow({ task, showArea = true }: { task: Task; showArea?: boolean }) {
  const area = useStore((s) => s.areas.find((a) => a.id === task.areaId))
  const updateTask = useStore((s) => s.updateTask)
  const toggleTask = useStore((s) => s.toggleTask)
  const deleteTask = useStore((s) => s.deleteTask)
  const setRepeat = useStore((s) => s.setRepeat)
  const skipOccurrence = useStore((s) => s.skipOccurrence)

  return (
    <div className={`task${task.done ? ' done' : ''}`}>
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
        <DueChip value={task.due} done={task.done} onChange={(due) => updateTask(task.id, { due })} />
        <button type="button" className="icon-btn subtle task-delete" aria-label="Delete task" title="Delete" onClick={() => deleteTask(task.id)}>
          <X size={15} />
        </button>
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
  defaultAreaId?: string
  placeholder?: string
  showArea?: boolean
}

export function TaskComposer({ defaultDue, defaultAreaId, placeholder = 'Add a task', showArea = true }: ComposerProps) {
  const addTask = useStore((s) => s.addTask)
  const areas = useStore((s) => s.areas)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState(defaultDue)
  const [areaId, setAreaId] = useState(defaultAreaId)
  const [repeat, setRepeat] = useState<Repeat | undefined>()
  const area = areas.find((a) => a.id === areaId)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    addTask({ title, due, areaId: area?.id, repeat })
    setTitle('')
    setRepeat(undefined)
  }

  return (
    <form className="composer" onSubmit={submit}>
      <Plus size={17} className="composer-plus" />
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      <div className="task-meta">
        {showArea && <AreaChip area={area} onChange={setAreaId} />}
        <RepeatChip value={repeat} base={due} onChange={setRepeat} />
        <DueChip value={due} onChange={setDue} />
      </div>
    </form>
  )
}
