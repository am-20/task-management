import { ChevronLeft, ChevronRight, Flame, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { AreaMenu } from '../components/tasks'
import { TopBar } from '../components/TopBar'
import { EmojiButton, MenuDivider, MenuItem, MenuLabel, Popover } from '../components/ui'
import { confirmDialog } from '../lib/confirm'
import { usePopover } from '../lib/usePopover'
import { addDays, fromKey, startOfWeek, todayKey, weekday } from '../lib/date'
import { habitStreak, isScheduled, scheduleLabel } from '../lib/habits'
import { useStore } from '../store'
import type { Habit } from '../types'

function HabitRow({ habit, days, today }: { habit: Habit; days: string[]; today: string }) {
  const area = useStore((s) => s.areas.find((a) => a.id === habit.areaId))
  const updateHabit = useStore((s) => s.updateHabit)
  const toggleHabit = useStore((s) => s.toggleHabit)
  const deleteHabit = useStore((s) => s.deleteHabit)
  const pop = usePopover()
  const streak = habitStreak(habit, today)

  return (
    <div className="habit-row">
      <div className="habit-info">
        <EmojiButton value={habit.icon} onChange={(icon) => updateHabit(habit.id, { icon })} />
        <div className="habit-text">
          <input
            className="habit-name"
            value={habit.name}
            aria-label="Habit name"
            onChange={(e) => updateHabit(habit.id, { name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
          />
          <div className="habit-sub">
            {area && (
              <span className="habit-area">
                <span className="chip-dot" style={{ background: area.color }} />
                {area.name}
              </span>
            )}
            {scheduleLabel(habit) !== 'Every day' && <span className="habit-schedule">{scheduleLabel(habit)}</span>}
            {streak > 0 && (
              <span className={`streak${streak > 1 ? '' : ' faint'}`}>
                <Flame size={12} />
                {streak} {streak === 1 ? 'day' : 'days'}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="habit-days">
        {days.map((d) => {
          const done = !!habit.log[d]
          const future = d > today
          const rest = !isScheduled(habit, d)
          return (
            <button
              key={d}
              type="button"
              className={`day-cell${done ? ' done' : ''}${d === today ? ' today' : ''}${rest ? ' rest' : ''}`}
              disabled={future}
              aria-pressed={done}
              aria-label={`${habit.name}, ${weekday(d)}${rest ? ', rest day' : ''}${done ? ', done' : ''}`}
              title={rest ? 'Rest day (you can still tick it)' : undefined}
              onClick={() => toggleHabit(habit.id, d)}
            />
          )
        })}
        <button type="button" className="icon-btn subtle" aria-label="Habit options" onClick={pop.open}>
          <MoreHorizontal size={16} />
        </button>
      </div>
      {pop.anchor && (
        <Popover anchor={pop.anchor} onClose={pop.close} align="end" width={260}>
          <MenuLabel>Days</MenuLabel>
          <ScheduleEditor habit={habit} onChange={(days) => updateHabit(habit.id, { days })} />
          <MenuDivider />
          <MenuLabel>Belongs to</MenuLabel>
          <AreaMenu
            value={habit.areaId}
            onChange={(areaId) => {
              updateHabit(habit.id, { areaId })
              pop.close()
            }}
          />
          <MenuDivider />
          <MenuItem
            icon={<Trash2 size={15} />}
            label="Delete habit"
            danger
            onSelect={async () => {
              pop.close()
              if (await confirmDialog({ title: `Delete “${habit.name}”?`, body: 'Its history will be removed too.' })) {
                deleteHabit(habit.id)
              }
            }}
          />
        </Popover>
      )}
    </div>
  )
}

const WEEK = [1, 2, 3, 4, 5, 6, 0]
const LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Pick which days of the week a habit is for. */
function ScheduleEditor({ habit, onChange }: { habit: Habit; onChange: (days: number[] | undefined) => void }) {
  const everyDay = !habit.days || habit.days.length === 0 || habit.days.length === 7
  const active = everyDay ? WEEK : habit.days!
  const toggle = (d: number) => {
    const next = active.includes(d) ? active.filter((x) => x !== d) : [...active, d]
    if (next.length === 0) return // at least one day
    onChange(next.length === 7 ? undefined : next)
  }
  return (
    <div className="schedule-editor">
      <div className="weekday-picker" role="group" aria-label="Days this habit is for">
        {WEEK.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={active.includes(d)}
            aria-label={DAY_NAME[d]}
            className={active.includes(d) ? 'on' : ''}
            onClick={() => toggle(d)}
          >
            {LETTER[d]}
          </button>
        ))}
      </div>
      <div className="schedule-presets">
        <button type="button" className={everyDay ? 'on' : ''} onClick={() => onChange(undefined)}>
          Every day
        </button>
        <button type="button" onClick={() => onChange([1, 2, 3, 4, 5])}>
          Weekdays
        </button>
        <button type="button" onClick={() => onChange([1, 3, 5])}>
          Mon/Wed/Fri
        </button>
      </div>
      <p className="schedule-note">Days off don’t break a streak.</p>
    </div>
  )
}

export function HabitsView() {
  const habits = useStore((s) => s.habits)
  const addHabit = useStore((s) => s.addHabit)
  const [offset, setOffset] = useState(0)
  const [name, setName] = useState('')

  const today = todayKey()
  const monday = addDays(startOfWeek(today), offset * 7)
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const fmt = (k: string) => fromKey(k).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const label = offset === 0 ? 'This week' : offset === -1 ? 'Last week' : `${fmt(days[0])} – ${fmt(days[6])}`

  const pastDays = days.filter((d) => d <= today)
  const possible = habits.reduce((n, h) => n + pastDays.filter((d) => isScheduled(h, d)).length, 0)
  const done = habits.reduce((n, h) => n + pastDays.filter((d) => h.log[d] && isScheduled(h, d)).length, 0)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    addHabit({ name })
    setName('')
  }

  return (
    <>
      <TopBar crumbs={[{ label: 'Habits' }]} />
      <div className="view">
        <header className="view-header">
          <h1>Habits</h1>
          <p className="lede">Small things, done often. Tick the days you showed up.</p>
        </header>

        <div className="week-nav">
          <button type="button" className="icon-btn" aria-label="Previous week" onClick={() => setOffset(offset - 1)}>
            <ChevronLeft size={17} />
          </button>
          <span className="week-label">{label}</span>
          <button type="button" className="icon-btn" aria-label="Next week" disabled={offset >= 0} onClick={() => setOffset(offset + 1)}>
            <ChevronRight size={17} />
          </button>
          {possible > 0 && (
            <span className="count week-score">
              {done} of {possible} check-ins
            </span>
          )}
        </div>

        <div className="habit-table">
          <div className="habit-row habit-head" aria-hidden="true">
            <div className="habit-info" />
            <div className="habit-days">
              {days.map((d) => (
                <div key={d} className={`day-head${d === today ? ' today' : ''}`}>
                  <span>{weekday(d, 'narrow')}</span>
                  <b>{fromKey(d).getDate()}</b>
                </div>
              ))}
              <span className="icon-btn spacer" />
            </div>
          </div>
          {habits.map((h) => (
            <HabitRow key={h.id} habit={h} days={days} today={today} />
          ))}
          <form className="composer habit-composer" onSubmit={submit}>
            <Plus size={17} className="composer-plus" />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a habit" aria-label="Add a habit" />
          </form>
        </div>
      </div>
    </>
  )
}
