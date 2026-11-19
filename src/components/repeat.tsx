import { ArrowLeft, CircleSlash, Repeat as RepeatIcon, SkipForward } from 'lucide-react'
import { useState } from 'react'
import { fromKey, todayKey } from '../lib/date'
import { describeRepeat, isLastDayOfMonth, isLastWeekOfMonth, presets, weekOfMonth, dayName } from '../lib/repeat'
import { usePopover } from '../lib/usePopover'
import type { Repeat, RepeatUnit } from '../types'
import { MenuDivider, MenuItem, MenuLabel, Popover } from './ui'

const WEEK = [1, 2, 3, 4, 5, 6, 0] // Monday first
const LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const NTH_WORD: Record<number, string> = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', [-1]: 'last' }

function sameRule(a?: Repeat, b?: Repeat): boolean {
  if (!a || !b) return false
  const strip = (r: Repeat) => JSON.stringify({ ...r, occurrence: undefined, weekdays: r.weekdays ? [...r.weekdays].sort() : undefined })
  return strip(a) === strip(b)
}

interface PickerProps {
  value?: Repeat
  /** The date the choices are based on (the task's due date, or today) */
  base: string
  onChange: (rule?: Repeat) => void
  onSkip?: () => void
  onDone: () => void
}

/** Quick choices plus a custom editor for any pattern. */
export function RepeatPicker({ value, base, onChange, onSkip, onDone }: PickerProps) {
  const [custom, setCustom] = useState(false)
  if (custom) {
    return (
      <CustomRepeat
        initial={value}
        base={base}
        onBack={() => setCustom(false)}
        onSave={(rule) => {
          onChange(rule)
          onDone()
        }}
      />
    )
  }
  const choices = presets(base)
  return (
    <div className="repeat-menu">
      {value && (
        <>
          <div className="repeat-current">
            <RepeatIcon size={14} />
            {describeRepeat(value)}
          </div>
          {onSkip && (
            <MenuItem
              icon={<SkipForward size={15} />}
              label="Skip to the next date"
              onSelect={() => {
                onSkip()
                onDone()
              }}
            />
          )}
          <MenuItem
            icon={<CircleSlash size={15} />}
            label="Stop repeating"
            onSelect={() => {
              onChange(undefined)
              onDone()
            }}
          />
          <MenuDivider />
        </>
      )}
      <MenuLabel>Repeat</MenuLabel>
      {choices.map((c) => (
        <MenuItem
          key={c.label}
          label={c.label}
          active={sameRule(c.rule, value)}
          onSelect={() => {
            onChange(c.rule)
            onDone()
          }}
        />
      ))}
      <MenuDivider />
      <MenuItem icon={<RepeatIcon size={15} />} label="Custom…" onSelect={() => setCustom(true)} />
    </div>
  )
}

type MonthChoice = 'day' | 'nth' | 'lastWeekday' | 'lastDay'
type EndChoice = 'never' | 'until' | 'count'

function CustomRepeat({
  initial,
  base,
  onBack,
  onSave,
}: {
  initial?: Repeat
  base: string
  onBack: () => void
  onSave: (rule: Repeat) => void
}) {
  const d = fromKey(base)
  const baseWeekday = d.getDay()
  const [every, setEvery] = useState(String(initial?.every ?? 1))
  const [unit, setUnit] = useState<RepeatUnit>(initial?.unit ?? 'week')
  const [weekdays, setWeekdays] = useState<number[]>(initial?.weekdays?.length ? initial.weekdays : [baseWeekday])
  const [month, setMonth] = useState<MonthChoice>(() => {
    if (initial?.unit !== 'month') return 'day'
    if (initial.monthBy === 'weekday') return initial.nth === -1 ? 'lastWeekday' : 'nth'
    return initial.monthDay === -1 ? 'lastDay' : 'day'
  })
  const [fromCompletion, setFromCompletion] = useState(!!initial?.fromCompletion)
  const [end, setEnd] = useState<EndChoice>(initial?.until ? 'until' : initial?.count ? 'count' : 'never')
  const [until, setUntil] = useState(initial?.until ?? '')
  const [count, setCount] = useState(String(initial?.count ?? 10))

  const n = Math.min(999, Math.max(1, Math.floor(Number(every)) || 1))
  const nth = Math.min(4, weekOfMonth(base))
  const monthOptions: { value: MonthChoice; label: string }[] = [
    { value: 'day', label: `On day ${initial?.unit === 'month' && initial.monthBy === 'day' && initial.monthDay && initial.monthDay > 0 ? initial.monthDay : d.getDate()}` },
    { value: 'nth', label: `On the ${NTH_WORD[nth]} ${dayName(baseWeekday)}` },
  ]
  if (isLastWeekOfMonth(base) || month === 'lastWeekday') monthOptions.push({ value: 'lastWeekday', label: `On the last ${dayName(baseWeekday)}` })
  if (isLastDayOfMonth(base) || month === 'lastDay') monthOptions.push({ value: 'lastDay', label: 'On the last day' })

  const build = (): Repeat => {
    const rule: Repeat = { every: n, unit }
    if (fromCompletion) rule.fromCompletion = true
    else if (unit === 'week') rule.weekdays = weekdays.length ? weekdays : [baseWeekday]
    else if (unit === 'month') {
      if (month === 'day') {
        rule.monthBy = 'day'
        rule.monthDay = initial?.unit === 'month' && initial.monthBy === 'day' && initial.monthDay && initial.monthDay > 0 ? initial.monthDay : d.getDate()
      } else if (month === 'lastDay') {
        rule.monthBy = 'day'
        rule.monthDay = -1
      } else {
        rule.monthBy = 'weekday'
        rule.weekday = initial?.unit === 'month' && initial.monthBy === 'weekday' && initial.weekday !== undefined ? initial.weekday : baseWeekday
        rule.nth = month === 'lastWeekday' ? -1 : nth
      }
    }
    if (end === 'until' && until) rule.until = until
    if (end === 'count') rule.count = Math.max(1, Math.floor(Number(count)) || 1)
    return rule
  }

  const unitLabel = (u: RepeatUnit) => ({ day: 'day', week: 'week', month: 'month', year: 'year' })[u] + (n === 1 ? '' : 's')

  return (
    <form
      className="repeat-custom"
      onSubmit={(e) => {
        e.preventDefault()
        // The popover is rendered inside the "add a task" form in React's tree;
        // don't let saving the repeat also submit that form.
        e.stopPropagation()
        onSave(build())
      }}
    >
      <div className="repeat-custom-head">
        <button type="button" className="icon-btn subtle" aria-label="Back" onClick={onBack}>
          <ArrowLeft size={15} />
        </button>
        <span>Custom repeat</span>
      </div>

      <div className="repeat-row">
        <span>Every</span>
        <input
          className="num-input"
          type="number"
          inputMode="numeric"
          min={1}
          max={999}
          value={every}
          onChange={(e) => setEvery(e.target.value)}
          aria-label="Every how many"
        />
        <select value={unit} onChange={(e) => setUnit(e.target.value as RepeatUnit)} aria-label="Unit">
          {(['day', 'week', 'month', 'year'] as RepeatUnit[]).map((u) => (
            <option key={u} value={u}>
              {unitLabel(u)}
            </option>
          ))}
        </select>
      </div>

      <div className="segmented" role="radiogroup" aria-label="Count from">
        <button type="button" role="radio" aria-checked={!fromCompletion} className={fromCompletion ? '' : 'on'} onClick={() => setFromCompletion(false)}>
          On a schedule
        </button>
        <button type="button" role="radio" aria-checked={fromCompletion} className={fromCompletion ? 'on' : ''} onClick={() => setFromCompletion(true)}>
          After it’s done
        </button>
      </div>
      {fromCompletion && (
        <p className="repeat-hint">
          The next date is counted from the day you tick it off. Good for things like “change the water filter every 2 months”.
        </p>
      )}

      {!fromCompletion && unit === 'week' && (
        <div className="weekday-picker" role="group" aria-label="On these days">
          {WEEK.map((wd) => {
            const on = weekdays.includes(wd)
            return (
              <button
                key={wd}
                type="button"
                aria-pressed={on}
                aria-label={dayName(wd)}
                className={on ? 'on' : ''}
                onClick={() => setWeekdays(on ? weekdays.filter((x) => x !== wd) : [...weekdays, wd])}
              >
                {LETTER[wd]}
              </button>
            )
          })}
        </div>
      )}

      {!fromCompletion && unit === 'month' && (
        <div className="radio-list" role="radiogroup" aria-label="Which day of the month">
          {monthOptions.map((o) => (
            <label key={o.value} className="radio">
              <input type="radio" name="month" checked={month === o.value} onChange={() => setMonth(o.value)} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      )}

      <div className="repeat-section-label">Ends</div>
      <div className="radio-list" role="radiogroup" aria-label="Ends">
        <label className="radio">
          <input type="radio" name="end" checked={end === 'never'} onChange={() => setEnd('never')} />
          <span>Never</span>
        </label>
        <label className="radio">
          <input type="radio" name="end" checked={end === 'until'} onChange={() => setEnd('until')} />
          <span>On</span>
          <input
            type="date"
            className="inline-date"
            value={until}
            min={todayKey()}
            onChange={(e) => {
              setUntil(e.target.value)
              setEnd('until')
            }}
            aria-label="End date"
          />
        </label>
        <label className="radio">
          <input type="radio" name="end" checked={end === 'count'} onChange={() => setEnd('count')} />
          <span>After</span>
          <input
            className="num-input"
            type="number"
            inputMode="numeric"
            min={1}
            value={count}
            onChange={(e) => {
              setCount(e.target.value)
              setEnd('count')
            }}
            aria-label="Number of times"
          />
          <span>times</span>
        </label>
      </div>

      <div className="repeat-preview">{describeRepeat(build())}</div>
      <button type="submit" className="btn primary repeat-save">
        Save
      </button>
    </form>
  )
}

/** The chip on a task row or composer that shows and edits the repeat. */
export function RepeatChip({
  value,
  base,
  onChange,
  onSkip,
}: {
  value?: Repeat
  base?: string
  onChange: (rule?: Repeat) => void
  onSkip?: () => void
}) {
  const pop = usePopover()
  return (
    <>
      <button
        type="button"
        className={`chip repeat-chip${value ? '' : ' unset'}`}
        onClick={pop.open}
        aria-label={value ? `Repeats: ${describeRepeat(value)}` : 'Repeat'}
        title={value ? describeRepeat(value) : 'Repeat'}
      >
        <RepeatIcon size={13} />
        {value && <span>{describeRepeat(value, true)}</span>}
      </button>
      {pop.anchor && (
        <Popover anchor={pop.anchor} onClose={pop.close} align="end" width={290}>
          <RepeatPicker value={value} base={base ?? todayKey()} onChange={onChange} onSkip={onSkip} onDone={pop.close} />
        </Popover>
      )}
    </>
  )
}
