import { CalendarRange, Check, CornerDownLeft, Repeat2, Search, Sun } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { navigate } from '../lib/router'
import { htmlToText } from '../lib/sanitize'
import { useStore } from '../store'

interface Result {
  key: string
  group: string
  icon: ReactNode
  title: string
  detail?: string
  path: string
}

export function QuickFind({ onClose }: { onClose: () => void }) {
  const areas = useStore((s) => s.areas)
  const pages = useStore((s) => s.pages)
  const tasks = useStore((s) => s.tasks)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase()
    const has = (s: string) => s.toLowerCase().includes(q)
    const areaName = (id?: string) => areas.find((a) => a.id === id)?.name
    const out: Result[] = []

    const views: Result[] = [
      { key: 'today', group: 'Go to', icon: <Sun size={16} />, title: 'Today', path: '/today' },
      { key: 'upcoming', group: 'Go to', icon: <CalendarRange size={16} />, title: 'Upcoming', path: '/upcoming' },
      { key: 'habits', group: 'Go to', icon: <Repeat2 size={16} />, title: 'Habits', path: '/habits' },
    ]
    out.push(...views.filter((v) => !q || has(v.title)))

    for (const a of areas) {
      if (!q || has(a.name) || has(a.description)) {
        out.push({ key: a.id, group: 'Areas', icon: a.icon, title: a.name || 'Untitled', detail: a.description, path: `/area/${a.id}` })
      }
    }

    const sortedPages = [...pages].sort((a, b) => b.updatedAt - a.updatedAt)
    for (const p of sortedPages) {
      if (!q) {
        out.push({ key: p.id, group: 'Pages', icon: p.icon, title: p.title || 'Untitled', detail: areaName(p.areaId), path: `/page/${p.id}` })
        continue
      }
      const body = p.blocks.map((bl) => htmlToText(bl.html))
      const hit = body.find((line) => has(line))
      if (has(p.title) || hit) {
        out.push({
          key: p.id,
          group: 'Pages',
          icon: p.icon,
          title: p.title || 'Untitled',
          detail: has(p.title) ? areaName(p.areaId) : hit,
          path: `/page/${p.id}`,
        })
      }
    }

    if (q) {
      for (const t of tasks) {
        if (has(t.title)) {
          out.push({
            key: t.id,
            group: 'Tasks',
            icon: <Check size={16} />,
            title: t.title,
            detail: areaName(t.areaId),
            path: t.areaId ? `/area/${t.areaId}` : '/upcoming',
          })
        }
      }
    }
    return out.slice(0, 40)
  }, [query, areas, pages, tasks])

  const active = Math.min(index, Math.max(0, results.length - 1))

  useEffect(() => {
    listRef.current?.querySelector('.find-item.active')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const open = (r?: Result) => {
    if (!r) return
    navigate(r.path)
    onClose()
  }

  let lastGroup = ''
  return createPortal(
    <div className="scrim top" onMouseDown={onClose}>
      <div className="find" role="dialog" aria-modal="true" aria-label="Search" onMouseDown={(e) => e.stopPropagation()}>
        <div className="find-input">
          <Search size={17} />
          <input
            autoFocus
            value={query}
            placeholder="Search pages, tasks and areas"
            aria-label="Search"
            onChange={(e) => {
              setQuery(e.target.value)
              setIndex(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIndex((active + 1) % Math.max(1, results.length))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIndex((active - 1 + results.length) % Math.max(1, results.length))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                open(results[active])
              } else if (e.key === 'Escape') {
                onClose()
              }
            }}
          />
        </div>
        <div className="find-list" ref={listRef}>
          {results.length === 0 && <div className="find-empty">Nothing matches “{query}”.</div>}
          {results.map((r, i) => {
            const heading = r.group !== lastGroup ? r.group : null
            lastGroup = r.group
            return (
              <div key={`${r.group}-${r.key}`}>
                {heading && <div className="menu-heading">{heading}</div>}
                <button
                  type="button"
                  className={`find-item${i === active ? ' active' : ''}`}
                  onMouseMove={() => i !== active && setIndex(i)}
                  onClick={() => open(r)}
                >
                  <span className="menu-icon">{r.icon}</span>
                  <span className="find-title">{r.title}</span>
                  {r.detail && <span className="find-detail">{r.detail}</span>}
                  {i === active && <CornerDownLeft size={14} className="find-enter" />}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
