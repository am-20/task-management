import {
  CalendarRange,
  ChevronRight,
  Download,
  LogOut,
  PanelLeftClose,
  Plus,
  Repeat2,
  RotateCcw,
  Search,
  Settings2,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { todayKey } from '../lib/date'
import { navigate, type Route } from '../lib/router'
import { exportSnapshot, useStore } from '../store'
import { confirmDialog } from '../lib/confirm'
import { supabase } from '../lib/supabase'
import { hasUnsyncedChanges, push, stopSync } from '../sync/engine'
import { Logo } from './Logo'
import { SyncStatus } from './SyncStatus'
import { usePopover } from '../lib/usePopover'
import { MenuDivider, MenuItem, Popover } from './ui'

const isNarrow = () => window.matchMedia('(max-width: 860px)').matches

export function Sidebar({ route, onSearch }: { route: Route; onSearch: () => void }) {
  const areas = useStore((s) => s.areas)
  const pages = useStore((s) => s.pages)
  const tasks = useStore((s) => s.tasks)
  const expanded = useStore((s) => s.expanded)
  const toggleExpanded = useStore((s) => s.toggleExpanded)
  const setSidebarOpen = useStore((s) => s.setSidebarOpen)
  const addArea = useStore((s) => s.addArea)
  const addPage = useStore((s) => s.addPage)
  const importData = useStore((s) => s.importData)
  const resetToSample = useStore((s) => s.resetToSample)
  const clearAll = useStore((s) => s.clearAll)
  const settings = usePopover()
  const fileRef = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    void supabase?.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null))
  }, [])

  const signOut = async () => {
    if (!supabase) return
    if (hasUnsyncedChanges()) await push()
    if (hasUnsyncedChanges()) {
      const ok = await confirmDialog({
        title: 'Some changes have not synced yet',
        body: 'You seem to be offline. Signing out now will lose the latest changes made on this device.',
        action: 'Sign out anyway',
      })
      if (!ok) return
    }
    stopSync(true)
    await supabase.auth.signOut({ scope: 'local' })
  }

  const today = todayKey()
  const dueCount = tasks.filter((t) => !t.done && t.due && t.due <= today).length
  const mac = /Mac|iPhone|iPad/.test(navigator.platform)

  const go = (path: string) => {
    navigate(path)
    if (isNarrow()) setSidebarOpen(false)
  }

  const exportData = () => {
    const blob = new Blob([JSON.stringify(exportSnapshot(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hearth-${today}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importFile = async (file: File) => {
    try {
      const data = JSON.parse(await file.text())
      if (!data || !Array.isArray(data.areas)) throw new Error('Not a Hearth export')
      const ok = await confirmDialog({
        title: 'Replace everything with this file?',
        body: 'Your current areas, pages, tasks and habits will be replaced by the imported data.',
        action: 'Import',
        danger: false,
      })
      if (ok) {
        importData(data)
        go('/today')
      }
    } catch {
      await confirmDialog({ title: 'That file could not be read', body: 'Choose a JSON file exported from Hearth.', action: 'OK', danger: false })
    }
  }

  const navLink = (name: Route['name'], path: string, label: string, icon: ReactNode, badge?: number) => (
    <a
      key={name}
      className={`nav-item${route.name === name ? ' active' : ''}`}
      href={`#${path}`}
      aria-current={route.name === name ? 'page' : undefined}
      onClick={(e) => {
        e.preventDefault()
        go(path)
      }}
    >
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
      {!!badge && <span className="nav-badge">{badge}</span>}
    </a>
  )

  return (
    <aside className="sidebar" aria-label="Sidebar">
      <div className="sidebar-head">
        <a className="brand" href="#/today" onClick={() => isNarrow() && setSidebarOpen(false)}>
          <span className="brand-mark" aria-hidden="true">
            <Logo size={22} />
          </span>
          Hearth
        </a>
        <button type="button" className="icon-btn subtle" aria-label="Close sidebar" title="Close sidebar" onClick={() => setSidebarOpen(false)}>
          <PanelLeftClose size={17} />
        </button>
      </div>

      <button type="button" className="search-btn" onClick={onSearch}>
        <Search size={15} />
        <span>Search</span>
        <kbd>{mac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>

      <nav className="nav">
        {navLink('today', '/today', 'Today', <Sun size={16} />, dueCount)}
        {navLink('upcoming', '/upcoming', 'Upcoming', <CalendarRange size={16} />)}
        {navLink('habits', '/habits', 'Habits', <Repeat2 size={16} />)}
      </nav>

      <div className="nav-heading">
        <span>Life areas</span>
        <button type="button" className="icon-btn subtle" aria-label="New area" title="New area" onClick={() => go(`/area/${addArea()}`)}>
          <Plus size={15} />
        </button>
      </div>

      <div className="tree">
        {areas.map((a) => {
          const areaPages = pages.filter((p) => p.areaId === a.id)
          const open = !!expanded[a.id]
          const active = route.name === 'area' && route.id === a.id
          return (
            <div key={a.id} className="tree-group" style={{ '--area': a.color } as CSSProperties}>
              <div className={`nav-item tree-area${active ? ' active' : ''}`}>
                <button
                  type="button"
                  className={`twist${open ? ' open' : ''}`}
                  aria-label={open ? 'Collapse' : 'Expand'}
                  aria-expanded={open}
                  onClick={() => toggleExpanded(a.id)}
                >
                  <ChevronRight size={14} />
                </button>
                <a
                  className="tree-link"
                  href={`#/area/${a.id}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={(e) => {
                    e.preventDefault()
                    go(`/area/${a.id}`)
                  }}
                >
                  <span className="nav-icon emoji">{a.icon}</span>
                  <span className="nav-label">{a.name || 'Untitled'}</span>
                </a>
                <button
                  type="button"
                  className="icon-btn subtle row-action"
                  aria-label={`New page in ${a.name || 'this area'}`}
                  title="New page"
                  onClick={() => go(`/page/${addPage(a.id)}`)}
                >
                  <Plus size={14} />
                </button>
              </div>
              {open && (
                <div className="tree-pages">
                  {areaPages.length === 0 && <div className="tree-empty">No pages yet</div>}
                  {areaPages.map((p) => {
                    const pageActive = route.name === 'page' && route.id === p.id
                    return (
                      <a
                        key={p.id}
                        className={`nav-item tree-page${pageActive ? ' active' : ''}`}
                        href={`#/page/${p.id}`}
                        aria-current={pageActive ? 'page' : undefined}
                        onClick={(e) => {
                          e.preventDefault()
                          go(`/page/${p.id}`)
                        }}
                      >
                        <span className="nav-icon emoji">{p.icon}</span>
                        <span className="nav-label">{p.title || 'Untitled'}</span>
                      </a>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        <button type="button" className="nav-item add-area" onClick={() => go(`/area/${addArea()}`)}>
          <span className="nav-icon">
            <Plus size={15} />
          </span>
          <span className="nav-label">New area</span>
        </button>
      </div>

      <div className="sidebar-foot">
        <button type="button" className="nav-item" onClick={settings.open}>
          <span className="nav-icon">
            <Settings2 size={16} />
          </span>
          <span className="nav-label">Your data</span>
          <SyncStatus />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void importFile(file)
          }}
        />
      </div>

      {settings.anchor && (
        <Popover anchor={settings.anchor} onClose={settings.close} width={248}>
          <p className="menu-note">
            {supabase
              ? `Signed in${email ? ` as ${email}` : ''}. Changes sync to your account and work offline.`
              : 'Everything is saved in this browser. Export a backup now and then.'}
          </p>
          <MenuItem
            icon={<Download size={15} />}
            label="Export backup"
            onSelect={() => {
              settings.close()
              exportData()
            }}
          />
          <MenuItem
            icon={<Upload size={15} />}
            label="Import backup"
            onSelect={() => {
              settings.close()
              fileRef.current?.click()
            }}
          />
          <MenuDivider />
          <MenuItem
            icon={<RotateCcw size={15} />}
            label="Restore sample content"
            onSelect={async () => {
              settings.close()
              const ok = await confirmDialog({
                title: 'Restore the sample content?',
                body: 'Your current areas, pages, tasks and habits will be replaced.',
                action: 'Restore',
              })
              if (ok) {
                resetToSample()
                go('/today')
              }
            }}
          />
          <MenuItem
            icon={<Trash2 size={15} />}
            label="Start from scratch"
            danger
            onSelect={async () => {
              settings.close()
              const ok = await confirmDialog({
                title: 'Delete everything?',
                body: 'All areas, pages, tasks and habits will be removed from this browser.',
                action: 'Delete everything',
              })
              if (ok) {
                clearAll()
                go('/today')
              }
            }}
          />
          {supabase && (
            <>
              <MenuDivider />
              <MenuItem
                icon={<LogOut size={15} />}
                label="Sign out"
                onSelect={() => {
                  settings.close()
                  void signOut()
                }}
              />
            </>
          )}
        </Popover>
      )}
    </aside>
  )
}
