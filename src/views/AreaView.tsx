import { ChevronRight, FilePlus2, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { TaskComposer, TaskList } from '../components/tasks'
import { byDue } from '../lib/sort'
import { TopBar } from '../components/TopBar'
import { EmojiButton, MenuDivider, MenuItem, MenuLabel, Popover } from '../components/ui'
import { confirmDialog } from '../lib/confirm'
import { usePopover } from '../lib/usePopover'
import { timeAgo, todayKey } from '../lib/date'
import { navigate } from '../lib/router'
import { htmlToText } from '../lib/sanitize'
import { AREA_COLORS } from '../seed'
import { useStore } from '../store'

export function AreaView({ id }: { id: string }) {
  const area = useStore((s) => s.areas.find((a) => a.id === id))
  const allTasks = useStore((s) => s.tasks)
  const allPages = useStore((s) => s.pages)
  const allHabits = useStore((s) => s.habits)
  const updateArea = useStore((s) => s.updateArea)
  const deleteArea = useStore((s) => s.deleteArea)
  const addPage = useStore((s) => s.addPage)
  const addHabit = useStore((s) => s.addHabit)
  const toggleHabit = useStore((s) => s.toggleHabit)
  const pop = usePopover()
  const [showDone, setShowDone] = useState(false)
  const [habitName, setHabitName] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  // A freshly created area has no name yet: invite the user to type one.
  useEffect(() => {
    if (area && !area.name) nameRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!area) {
    return (
      <>
        <TopBar crumbs={[{ label: 'Not found' }]} />
        <div className="view">
          <div className="empty">
            <p>This area no longer exists.</p>
            <a className="btn primary" href="#/today">
              Back to Today
            </a>
          </div>
        </div>
      </>
    )
  }

  const tasks = allTasks.filter((t) => t.areaId === id)
  const open = tasks.filter((t) => !t.done).sort(byDue)
  const done = tasks.filter((t) => t.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))
  const pages = allPages.filter((p) => p.areaId === id).sort((a, b) => b.updatedAt - a.updatedAt)
  const habits = allHabits.filter((h) => h.areaId === id)
  const today = todayKey()

  const submitHabit = (e: FormEvent) => {
    e.preventDefault()
    addHabit({ name: habitName, areaId: id, icon: area.icon })
    setHabitName('')
  }

  return (
    <>
      <TopBar crumbs={[{ label: area.name || 'Untitled', icon: area.icon }]}>
        <button type="button" className="icon-btn" aria-label="Area options" onClick={pop.open}>
          <MoreHorizontal size={18} />
        </button>
      </TopBar>
      {pop.anchor && (
        <Popover anchor={pop.anchor} onClose={pop.close} align="end" width={232}>
          <MenuLabel>Colour</MenuLabel>
          <div className="swatches">
            {AREA_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                className={`swatch${area.color === c.value ? ' active' : ''}`}
                style={{ background: c.value }}
                title={c.name}
                aria-label={c.name}
                onClick={() => updateArea(id, { color: c.value })}
              />
            ))}
          </div>
          <MenuDivider />
          <MenuItem
            icon={<Trash2 size={15} />}
            label="Delete area"
            danger
            onSelect={async () => {
              pop.close()
              const ok = await confirmDialog({
                title: `Delete “${area.name || 'Untitled'}”?`,
                body: 'Its pages will be deleted. Tasks and habits are kept, without an area.',
              })
              if (ok) {
                deleteArea(id)
                navigate('/today')
              }
            }}
          />
        </Popover>
      )}

      <div className="view" style={{ '--area': area.color } as CSSProperties}>
        <header className="view-header area-header">
          <EmojiButton className="hero-emoji" value={area.icon} onChange={(icon) => updateArea(id, { icon })} />
          <input
            ref={nameRef}
            className="title-input"
            value={area.name}
            placeholder="Name this area"
            aria-label="Area name"
            onChange={(e) => updateArea(id, { name: e.target.value })}
          />
          <input
            className="lede-input"
            value={area.description}
            placeholder="What belongs here?"
            aria-label="Description"
            onChange={(e) => updateArea(id, { description: e.target.value })}
          />
          <div className="area-rule" />
        </header>

        <section className="section">
          <div className="section-head">
            <h2>Tasks</h2>
            {open.length > 0 && <span className="count">{open.length} open</span>}
          </div>
          <TaskComposer key={id} defaultAreaId={id} showArea={false} placeholder={`Add a task to ${area.name || 'this area'}`} />
          <TaskList tasks={open} showArea={false} />
          {done.length > 0 && (
            <>
              <button type="button" className={`disclosure${showDone ? ' open' : ''}`} onClick={() => setShowDone(!showDone)} aria-expanded={showDone}>
                <ChevronRight size={15} />
                Completed
                <span className="count">{done.length}</span>
              </button>
              {showDone && <TaskList tasks={done} showArea={false} />}
            </>
          )}
        </section>

        <section className="section">
          <div className="section-head">
            <h2>Pages</h2>
            <button type="button" className="btn ghost small" onClick={() => navigate(`/page/${addPage(id)}`)}>
              <FilePlus2 size={15} /> New page
            </button>
          </div>
          {pages.length === 0 ? (
            <button type="button" className="empty clickable" onClick={() => navigate(`/page/${addPage(id)}`)}>
              <p>Notes, lists and plans for this part of your life live in pages. Start one.</p>
            </button>
          ) : (
            <div className="page-grid">
              {pages.map((p) => {
                const snippet = p.blocks
                  .filter((bl) => bl.type !== 'divider')
                  .map((bl) => htmlToText(bl.html))
                  .filter(Boolean)
                  .slice(0, 3)
                  .join(' · ')
                return (
                  <a key={p.id} className="page-card" href={`#/page/${p.id}`}>
                    <span className="page-card-icon">{p.icon}</span>
                    <span className="page-card-title">{p.title || 'Untitled'}</span>
                    <span className="page-card-snippet">{snippet || 'Empty page'}</span>
                    <span className="page-card-date">Edited {timeAgo(p.updatedAt)}</span>
                  </a>
                )
              })}
            </div>
          )}
        </section>

        <section className="section">
          <div className="section-head">
            <h2>Habits</h2>
            <a className="section-link" href="#/habits">
              All habits
            </a>
          </div>
          <div className="habit-chips">
            {habits.map((h) => {
              const isDone = !!h.log[today]
              return (
                <button key={h.id} type="button" className={`habit-chip${isDone ? ' done' : ''}`} aria-pressed={isDone} onClick={() => toggleHabit(h.id, today)}>
                  <span className="habit-chip-icon">{h.icon}</span>
                  <span className="habit-chip-name">{h.name}</span>
                </button>
              )
            })}
          </div>
          <form className="composer" onSubmit={submitHabit}>
            <Plus size={17} className="composer-plus" />
            <input value={habitName} onChange={(e) => setHabitName(e.target.value)} placeholder="Add a daily habit" aria-label="Add a daily habit" />
          </form>
        </section>
      </div>
    </>
  )
}
