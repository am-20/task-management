import { PanelLeft } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { useStore } from '../store'

export interface Crumb {
  label: string
  icon?: string
  href?: string
}

export function TopBar({ crumbs, children }: { crumbs: Crumb[]; children?: ReactNode }) {
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const setSidebarOpen = useStore((s) => s.setSidebarOpen)
  return (
    <header className="topbar">
      <button
        type="button"
        className={`icon-btn sidebar-toggle${sidebarOpen ? ' when-closed' : ''}`}
        onClick={() => setSidebarOpen(true)}
        aria-label="Open sidebar"
        title="Open sidebar"
      >
        <PanelLeft size={18} />
      </button>
      <nav className="crumbs" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <Fragment key={i}>
            {i > 0 && <span className="crumb-sep">/</span>}
            {c.href ? (
              <a className="crumb" href={c.href}>
                {c.icon && <span className="crumb-icon">{c.icon}</span>}
                <span>{c.label}</span>
              </a>
            ) : (
              <span className="crumb current">
                {c.icon && <span className="crumb-icon">{c.icon}</span>}
                <span>{c.label}</span>
              </span>
            )}
          </Fragment>
        ))}
      </nav>
      <div className="topbar-actions">{children}</div>
    </header>
  )
}
