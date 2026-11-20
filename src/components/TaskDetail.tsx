import { Check, GripVertical, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { stepInfo } from '../lib/steps'
import { showToast } from '../lib/toast'
import { useStore } from '../store'
import type { Step, Task } from '../types'
import { RepeatChip } from './repeat'
import { AreaChip, DueChip } from './tasks'
import { Checkbox, Popover } from './ui'

/** A task's own card: its steps and a note, opened from the steps button on a task. */
export function TaskDetail({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId))
  // Opened from a button; the card is centred, so the anchor is unused.
  const [anchor] = useState(() => new DOMRect(window.innerWidth / 2, window.innerHeight / 2, 0, 0))
  useEffect(() => {
    if (!task) onClose()
  }, [task, onClose])
  if (!task) return null
  return (
    <Popover anchor={anchor} onClose={onClose} centered className="task-detail">
      <TaskDetailBody task={task} onClose={onClose} />
    </Popover>
  )
}

function TaskDetailBody({ task, onClose }: { task: Task; onClose: () => void }) {
  const area = useStore((s) => s.areas.find((a) => a.id === task.areaId))
  const updateTask = useStore((s) => s.updateTask)
  const toggleTask = useStore((s) => s.toggleTask)
  const setRepeat = useStore((s) => s.setRepeat)
  const skipOccurrence = useStore((s) => s.skipOccurrence)
  const deleteTask = useStore((s) => s.deleteTask)
  const restoreTask = useStore((s) => s.restoreTask)
  const addStep = useStore((s) => s.addStep)
  const reorderStep = useStore((s) => s.reorderStep)
  const [focusStep, setFocusStep] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const stepsRef = useRef<HTMLDivElement>(null)

  /** Drag a step by its handle; the others make room as it passes their middle. */
  const startDrag = (e: ReactPointerEvent<HTMLElement>, stepId: string) => {
    e.preventDefault()
    setDragId(stepId)
    const move = (ev: PointerEvent) => {
      const rows = [...(stepsRef.current?.querySelectorAll<HTMLElement>('[data-step-id]') ?? [])]
      const others = rows.filter((r) => r.dataset.stepId !== stepId)
      const to = others.filter((r) => {
        const b = r.getBoundingClientRect()
        return b.top + b.height / 2 < ev.clientY
      }).length
      const current = useStore.getState().tasks.find((t) => t.id === task.id)?.steps ?? []
      if (current.findIndex((st) => st.id === stepId) !== to) reorderStep(task.id, stepId, to)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      setDragId(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
  const [draft, setDraft] = useState('')
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const info = stepInfo(task)
  const steps = task.steps ?? []

  // The note grows with its text.
  useLayoutEffect(() => {
    const el = noteRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(76, el.scrollHeight)}px`
  }, [task.note])

  const addFromDraft = () => {
    const title = draft.trim()
    if (!title) return
    addStep(task.id, title)
    setDraft('')
  }

  const remove = () => {
    const index = useStore.getState().tasks.findIndex((t) => t.id === task.id)
    const copy = task
    onClose()
    deleteTask(task.id)
    showToast(`Deleted “${copy.title || 'Untitled'}”`, { label: 'Undo', run: () => restoreTask(copy, index) })
  }

  return (
    <div className="detail">
      <div className="detail-head">
        <Checkbox
          checked={task.done}
          onChange={() => toggleTask(task.id)}
          color={area?.color}
          label={task.done ? 'Mark as not done' : 'Mark as done'}
        />
        <textarea
          className="detail-title"
          rows={1}
          value={task.title}
          placeholder="Untitled task"
          aria-label="Task name"
          onChange={(e) => updateTask(task.id, { title: e.target.value.replace(/\n/g, ' ') })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            }
          }}
        />
        <button type="button" className="icon-btn detail-close" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="detail-chips">
        <AreaChip area={area} onChange={(areaId) => updateTask(task.id, { areaId })} />
        {!task.done && (
          <RepeatChip value={task.repeat} base={task.due} onChange={(rule) => setRepeat(task.id, rule)} onSkip={() => skipOccurrence(task.id)} />
        )}
        <DueChip
          value={{ due: task.due, time: task.time, duration: task.duration }}
          done={task.done}
          onChange={(when) => updateTask(task.id, { due: when.due, time: when.time, duration: when.duration })}
        />
      </div>

      {info.total > 0 && (
        <div className="detail-progress">
          <span className="progress-bar" aria-hidden="true">
            <span style={{ width: `${(info.done / info.total) * 100}%`, background: area?.color }} />
          </span>
          <span>
            {info.done} of {info.total} steps
          </span>
        </div>
      )}

      <div className="detail-label">Steps</div>
      <div className={`steps${dragId ? ' sorting' : ''}`} ref={stepsRef}>
        {steps.map((step) => (
          <StepRow
            key={step.id}
            task={task}
            step={step}
            isNext={info.next?.id === step.id}
            dragging={dragId === step.id}
            onGripDown={(e) => startDrag(e, step.id)}
            autoFocus={focusStep === step.id}
            color={area?.color}
            onFocusStep={setFocusStep}
          />
        ))}
        <label className="step-add">
          <Plus size={17} />
          <input
            value={draft}
            placeholder={steps.length ? 'Add a step' : 'Break it into steps'}
            aria-label="Add a step"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addFromDraft()
              }
            }}
            onBlur={addFromDraft}
          />
        </label>
      </div>

      {info.allDone && !task.done && (
        <div className="steps-done">
          <span>All steps done.</span>
          <button type="button" className="btn primary small" onClick={() => toggleTask(task.id)}>
            <Check size={15} /> Finish the task
          </button>
        </div>
      )}

      <div className="detail-label">Note</div>
      <textarea
        ref={noteRef}
        className="detail-note"
        value={task.note ?? ''}
        placeholder="Addresses, what to bring, links…"
        aria-label="Note"
        onChange={(e) => updateTask(task.id, { note: e.target.value || undefined })}
      />

      <button type="button" className="card-delete" onClick={remove}>
        <Trash2 size={15} /> Delete task
      </button>
    </div>
  )
}

function StepRow({
  task,
  step,
  isNext,
  dragging,
  onGripDown,
  autoFocus,
  color,
  onFocusStep,
}: {
  task: Task
  step: Step
  isNext: boolean
  dragging: boolean
  onGripDown: (e: ReactPointerEvent<HTMLElement>) => void
  autoFocus: boolean
  color?: string
  onFocusStep: (id: string | null) => void
}) {
  const updateStep = useStore((s) => s.updateStep)
  const toggleStep = useStore((s) => s.toggleStep)
  const deleteStep = useStore((s) => s.deleteStep)
  const moveStep = useStore((s) => s.moveStep)
  const addStep = useStore((s) => s.addStep)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) {
      ref.current?.focus()
      onFocusStep(null)
    }
  }, [autoFocus, onFocusStep])

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onFocusStep(addStep(task.id, '', step.id))
    } else if (e.key === 'Backspace' && !step.title) {
      e.preventDefault()
      deleteStep(task.id, step.id)
    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      moveStep(task.id, step.id, e.key === 'ArrowUp' ? -1 : 1)
    }
  }

  return (
    <div className={`step${step.done ? ' done' : ''}${isNext ? ' next' : ''}${dragging ? ' dragging' : ''}`} data-step-id={step.id}>
      <span className="step-grip" onPointerDown={onGripDown} title="Drag to reorder" aria-hidden="true">
        <GripVertical size={16} />
      </span>
      <Checkbox round={false} checked={step.done} onChange={() => toggleStep(task.id, step.id)} color={color} label="Step done" />
      <input
        ref={ref}
        className="step-title"
        value={step.title}
        placeholder="Step"
        aria-label="Step"
        onChange={(e) => updateStep(task.id, step.id, { title: e.target.value })}
        onKeyDown={onKeyDown}
        onBlur={(e) => {
          if (!e.target.value.trim()) deleteStep(task.id, step.id)
        }}
      />
      {isNext && <span className="step-next">Next</span>}
      <div className="step-actions">
        <button type="button" className="icon-btn subtle" aria-label="Remove step" onClick={() => deleteStep(task.id, step.id)}>
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
