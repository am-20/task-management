import { CornerUpRight, MoreHorizontal, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { TopBar } from '../components/TopBar'
import { EmojiButton, MenuDivider, MenuItem, MenuLabel, Popover } from '../components/ui'
import { confirmDialog } from '../lib/confirm'
import { usePopover } from '../lib/usePopover'
import { Editor } from '../editor/Editor'
import { placeCaret } from '../editor/dom'
import { timeAgo } from '../lib/date'
import { navigate } from '../lib/router'
import { useStore } from '../store'
import type { Block } from '../types'

export function PageView({ id }: { id: string }) {
  const page = useStore((s) => s.pages.find((p) => p.id === id))
  const areas = useStore((s) => s.areas)
  const updatePage = useStore((s) => s.updatePage)
  const setBlocks = useStore((s) => s.setBlocks)
  const deletePage = useStore((s) => s.deletePage)
  const toggleExpanded = useStore((s) => s.toggleExpanded)
  const pop = usePopover()
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const title = page?.title ?? ''
  useLayoutEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [title])

  useEffect(() => {
    if (page && !page.title) titleRef.current?.focus()
    if (page) toggleExpanded(page.areaId, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const onChange = useCallback((blocks: Block[]) => setBlocks(id, blocks), [id, setBlocks])
  const focusTitle = useCallback(() => {
    const el = titleRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  if (!page) {
    return (
      <>
        <TopBar crumbs={[{ label: 'Not found' }]} />
        <div className="view">
          <div className="empty">
            <p>This page no longer exists.</p>
            <a className="btn primary" href="#/today">
              Back to Today
            </a>
          </div>
        </div>
      </>
    )
  }

  const area = areas.find((a) => a.id === page.areaId)
  const focusBody = () => {
    const first = bodyRef.current?.querySelector<HTMLElement>('.block-content')
    if (first) placeCaret(first, 'start')
  }

  return (
    <>
      <TopBar
        crumbs={[
          ...(area ? [{ label: area.name || 'Untitled', icon: area.icon, href: `#/area/${area.id}` }] : []),
          { label: page.title || 'Untitled', icon: page.icon },
        ]}
      >
        <span className="edited">Edited {timeAgo(page.updatedAt)}</span>
        <button type="button" className="icon-btn" aria-label="Page options" onClick={pop.open}>
          <MoreHorizontal size={18} />
        </button>
      </TopBar>
      {pop.anchor && (
        <Popover anchor={pop.anchor} onClose={pop.close} align="end" width={232}>
          {areas.length > 1 && (
            <>
              <MenuLabel>Move to</MenuLabel>
              {areas
                .filter((a) => a.id !== page.areaId)
                .map((a) => (
                  <MenuItem
                    key={a.id}
                    icon={a.icon}
                    label={a.name || 'Untitled'}
                    hint={<CornerUpRight size={13} />}
                    onSelect={() => {
                      updatePage(id, { areaId: a.id })
                      toggleExpanded(a.id, true)
                      pop.close()
                    }}
                  />
                ))}
              <MenuDivider />
            </>
          )}
          <MenuItem
            icon={<Trash2 size={15} />}
            label="Delete page"
            danger
            onSelect={async () => {
              pop.close()
              if (await confirmDialog({ title: `Delete “${page.title || 'Untitled'}”?`, body: 'This cannot be undone.' })) {
                deletePage(id)
                navigate(area ? `/area/${area.id}` : '/today')
              }
            }}
          />
        </Popover>
      )}

      <div className="view page-view">
        <header className="page-header">
          <EmojiButton className="hero-emoji" value={page.icon} onChange={(icon) => updatePage(id, { icon })} />
          <textarea
            ref={titleRef}
            className="title-input"
            rows={1}
            value={page.title}
            placeholder="Untitled"
            aria-label="Page title"
            onChange={(e) => updatePage(id, { title: e.target.value.replace(/\n/g, ' ') })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'ArrowDown') {
                e.preventDefault()
                focusBody()
              }
            }}
          />
        </header>
        <div ref={bodyRef}>
          <Editor key={id} blocks={page.blocks} onChange={onChange} onExitTop={focusTitle} />
        </div>
      </div>
    </>
  )
}
