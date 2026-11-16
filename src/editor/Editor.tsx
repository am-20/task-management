import { Bold, Copy, Italic, Strikethrough, Trash2, Underline } from 'lucide-react'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { MenuDivider, MenuItem, MenuLabel, Popover } from '../components/ui'
import { htmlToText } from '../lib/sanitize'
import type { Block, BlockType } from '../types'
import { BlockView, type EditorApi } from './BlockView'
import { COMMANDS, SHORTCUTS, filterCommands, isList, newBlock, parseLine, type Command } from './commands'
import {
  caretLine,
  placeCaret,
  placeCaretAtX,
  selectionRange,
  textAfterCaret,
  textBeforeCaret,
  type CaretPos,
} from './dom'

interface Props {
  blocks: Block[]
  onChange: (blocks: Block[]) => void
  /** Called when the caret moves up out of the first block */
  onExitTop?: () => void
}

interface FocusRequest {
  id: string
  pos: CaretPos
}

interface SlashState {
  blockId: string
  query: string
  rect: DOMRect
  index: number
}

function numberFor(blocks: Block[], i: number): number {
  const indent = blocks[i].indent ?? 0
  let n = 1
  for (let j = i - 1; j >= 0; j--) {
    const other = blocks[j]
    const otherIndent = other.indent ?? 0
    if (otherIndent > indent) continue
    if (otherIndent < indent || other.type !== 'number') break
    n++
  }
  return n
}

export function Editor({ blocks, onChange, onExitTop }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const focusReq = useRef<FocusRequest | null>(null)
  const dragId = useRef<string | null>(null)
  const [slash, setSlash] = useState<SlashState | null>(null)
  const [menu, setMenu] = useState<{ id: string; rect: DOMRect } | null>(null)
  const [drop, setDrop] = useState<{ id: string; pos: 'before' | 'after' } | null>(null)

  const contentEl = (id: string) =>
    rootRef.current?.querySelector<HTMLElement>(`[data-block-id="${id}"] .block-content`) ?? null

  const commit = (next: Block[], focus?: FocusRequest) => {
    if (next.length === 0) {
      const fresh = newBlock()
      next = [fresh]
      focus = { id: fresh.id, pos: 'start' }
    }
    if (focus) focusReq.current = focus
    onChange(next)
  }

  const update = (id: string, patch: Partial<Block>, focus?: FocusRequest) =>
    commit(
      blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      focus,
    )

  // Apply any pending caret move once React has rendered the new blocks.
  useLayoutEffect(() => {
    const req = focusReq.current
    if (!req) return
    focusReq.current = null
    const el = contentEl(req.id)
    if (el) placeCaret(el, req.pos)
  })

  const tidy = (el: HTMLElement) => {
    if ((el.textContent ?? '') === '' && el.innerHTML !== '') el.innerHTML = ''
  }

  const updateSlash = (id: string, el: HTMLElement) => {
    const sel = window.getSelection()
    const node = sel?.anchorNode
    if (!sel || !sel.isCollapsed || !node || node.nodeType !== Node.TEXT_NODE || !el.contains(node)) {
      setSlash(null)
      return
    }
    const before = (node.textContent ?? '').slice(0, sel.anchorOffset)
    const match = /(?:^|\s)\/([^\s/]{0,20})$/.exec(before)
    if (!match || filterCommands(match[1]).length === 0) {
      setSlash(null)
      return
    }
    const query = match[1]
    const caret = sel.getRangeAt(0).getBoundingClientRect()
    const rect = caret.height ? caret : el.getBoundingClientRect()
    setSlash((prev) => ({
      blockId: id,
      query,
      rect,
      index: prev && prev.query === query ? prev.index : 0,
    }))
  }

  const turnInto = (id: string, type: BlockType, html?: string) => {
    const idx = blocks.findIndex((b) => b.id === id)
    const block = blocks[idx]
    if (!block) return
    const current = html ?? block.html
    if (type === 'divider') {
      const before = blocks.slice(0, idx)
      const after = blocks.slice(idx + 1)
      const divider = newBlock('divider')
      const keep = htmlToText(current).trim() === '' ? [] : [{ ...block, html: current }]
      const next = after[0] && after[0].type !== 'divider' ? null : newBlock()
      const target = next ?? after[0]
      commit([...before, ...keep, divider, ...(next ? [next] : []), ...after], { id: target.id, pos: 'start' })
      return
    }
    update(
      id,
      { type, html: current, checked: false, indent: isList(type) ? block.indent : 0 },
      block.type === 'divider' ? undefined : { id, pos: 'end' },
    )
  }

  const applySlash = (command: Command) => {
    if (!slash) return
    const el = contentEl(slash.blockId)
    const sel = window.getSelection()
    const node = sel?.anchorNode
    if (el && sel && node && node.nodeType === Node.TEXT_NODE && el.contains(node)) {
      const start = (node.textContent ?? '').lastIndexOf('/', sel.anchorOffset - 1)
      if (start >= 0) {
        const range = document.createRange()
        range.setStart(node, start)
        range.setEnd(node, sel.anchorOffset)
        range.deleteContents()
      }
      tidy(el)
    }
    setSlash(null)
    turnInto(slash.blockId, command.type, el?.innerHTML)
  }

  const moveFocus = (fromIdx: number, dir: -1 | 1, place: (el: HTMLElement) => void): boolean => {
    let j = fromIdx + dir
    while (blocks[j] && blocks[j].type === 'divider') j += dir
    const target = blocks[j] ? contentEl(blocks[j].id) : null
    if (!target) return false
    place(target)
    return true
  }

  const handlers: EditorApi = {
    input(id, el) {
      const block = blocks.find((b) => b.id === id)
      if (!block) return
      tidy(el)
      if (block.type === 'text' && el.textContent === '---') {
        setSlash(null)
        turnInto(id, 'divider', '')
        return
      }
      update(id, { html: el.innerHTML })
      updateSlash(id, el)
    },

    keyDown(id, e: KeyboardEvent<HTMLDivElement>) {
      if (e.nativeEvent.isComposing) return
      const el = e.currentTarget
      const idx = blocks.findIndex((b) => b.id === id)
      const block = blocks[idx]
      if (!block) return
      const mod = e.metaKey || e.ctrlKey

      if (slash) {
        const items = filterCommands(slash.query)
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault()
          const step = e.key === 'ArrowDown' ? 1 : -1
          setSlash({ ...slash, index: (slash.index + step + items.length) % items.length })
          return
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault()
          applySlash(items[slash.index] ?? items[0])
          return
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        const empty = (el.textContent ?? '') === ''
        if (empty && block.type !== 'text') {
          if (isList(block.type) && (block.indent ?? 0) > 0) update(id, { indent: (block.indent ?? 0) - 1 })
          else update(id, { type: 'text', checked: false, indent: 0 })
          return
        }
        const range = selectionRange(el)
        if (!range) return
        const continues = isList(block.type)
        const fresh = (html = '') =>
          newBlock(continues ? block.type : 'text', html, continues ? { indent: block.indent ?? 0 } : {})
        if (range.collapsed && !empty && textBeforeCaret(el) === '') {
          // Caret at the very start: push this block down instead of splitting it.
          commit([...blocks.slice(0, idx), fresh(), ...blocks.slice(idx)])
          return
        }
        range.deleteContents()
        const tail = document.createRange()
        tail.selectNodeContents(el)
        tail.setStart(range.startContainer, range.startOffset)
        const holder = document.createElement('div')
        holder.appendChild(tail.extractContents())
        const tailHtml = (holder.textContent ?? '') === '' ? '' : holder.innerHTML
        tidy(el)
        const next = fresh(tailHtml)
        commit(
          [...blocks.slice(0, idx), { ...block, html: el.innerHTML }, next, ...blocks.slice(idx + 1)],
          { id: next.id, pos: 'start' },
        )
        return
      }

      if (e.key === 'Backspace') {
        const range = selectionRange(el)
        if (!range || !range.collapsed || textBeforeCaret(el) !== '') return
        e.preventDefault()
        if (block.type !== 'text') {
          update(id, { type: 'text', checked: false, indent: 0 })
          return
        }
        const prev = blocks[idx - 1]
        if (!prev) return
        if (prev.type === 'divider') {
          commit(blocks.filter((b) => b.id !== prev.id))
          return
        }
        const prevEl = contentEl(prev.id)
        const offset = prevEl?.textContent?.length ?? 0
        const merged = (prevEl?.innerHTML ?? prev.html) + el.innerHTML
        commit(
          blocks.filter((b) => b.id !== id).map((b) => (b.id === prev.id ? { ...b, html: merged } : b)),
          { id: prev.id, pos: offset },
        )
        return
      }

      if (e.key === 'Tab') {
        e.preventDefault()
        if (!isList(block.type)) return
        const prev = blocks[idx - 1]
        const max = prev && isList(prev.type) ? Math.min(3, (prev.indent ?? 0) + 1) : 0
        const indent = Math.max(0, Math.min(max, (block.indent ?? 0) + (e.shiftKey ? -1 : 1)))
        if (indent !== (block.indent ?? 0)) update(id, { indent })
        return
      }

      if (e.key === ' ' && !mod && block.type === 'text') {
        const range = selectionRange(el)
        const type = range?.collapsed ? SHORTCUTS[textBeforeCaret(el)] : undefined
        if (range && type) {
          e.preventDefault()
          const prefix = document.createRange()
          prefix.selectNodeContents(el)
          prefix.setEnd(range.startContainer, range.startOffset)
          prefix.deleteContents()
          tidy(el)
          setSlash(null)
          update(id, { type, html: el.innerHTML })
          return
        }
      }

      if (e.shiftKey || e.altKey || mod) return

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const up = e.key === 'ArrowUp'
        const line = caretLine(el)
        if (up ? !line.first : !line.last) return
        const moved = moveFocus(idx, up ? -1 : 1, (target) => placeCaretAtX(target, line.x, up ? 'bottom' : 'top'))
        if (moved) e.preventDefault()
        else if (up && onExitTop) {
          e.preventDefault()
          onExitTop()
        }
        return
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const range = selectionRange(el)
        if (!range || !range.collapsed) return
        const left = e.key === 'ArrowLeft'
        if ((left ? textBeforeCaret(el) : textAfterCaret(el)) !== '') return
        if (moveFocus(idx, left ? -1 : 1, (target) => placeCaret(target, left ? 'end' : 'start'))) e.preventDefault()
      }
    },

    paste(id, e: ClipboardEvent<HTMLDivElement>) {
      e.preventDefault()
      const text = e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n')
      if (!text) return
      const lines = text.split('\n').filter((line, i) => i === 0 || line.trim() !== '')
      if (lines.length === 1) {
        document.execCommand('insertText', false, text)
        return
      }
      const el = e.currentTarget
      const idx = blocks.findIndex((b) => b.id === id)
      const block = blocks[idx]
      const range = selectionRange(el)
      if (!block || !range) return
      const before = blocks.slice(0, idx)
      const after = blocks.slice(idx + 1)

      if (block.type === 'text' && (el.textContent ?? '') === '') {
        const parsed = lines.map(parseLine)
        const last = parsed[parsed.length - 1]
        commit([...before, ...parsed, ...after], last.type === 'divider' ? undefined : { id: last.id, pos: 'end' })
        return
      }

      range.deleteContents()
      const tail = document.createRange()
      tail.selectNodeContents(el)
      tail.setStart(range.startContainer, range.startOffset)
      const holder = document.createElement('div')
      holder.appendChild(tail.extractContents())
      const tailHtml = (holder.textContent ?? '') === '' ? '' : holder.innerHTML
      el.appendChild(document.createTextNode(lines[0]))
      el.normalize()
      const parsed = lines.slice(1).map(parseLine)
      let last = parsed[parsed.length - 1]
      if (last.type === 'divider') {
        last = newBlock()
        parsed.push(last)
      }
      const offset = htmlToText(last.html).length
      last.html += tailHtml
      commit([...before, { ...block, html: el.innerHTML }, ...parsed, ...after], { id: last.id, pos: offset })
    },

    toggleCheck(id) {
      const block = blocks.find((b) => b.id === id)
      if (block) update(id, { checked: !block.checked })
    },

    addBelow(id) {
      const idx = blocks.findIndex((b) => b.id === id)
      const fresh = newBlock()
      commit([...blocks.slice(0, idx + 1), fresh, ...blocks.slice(idx + 1)], { id: fresh.id, pos: 'start' })
    },

    openMenu(id, rect) {
      setMenu({ id, rect })
    },

    dragStart(id, e: DragEvent<HTMLElement>) {
      dragId.current = id
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', '')
      const blockEl = rootRef.current?.querySelector(`[data-block-id="${id}"]`)
      if (blockEl) e.dataTransfer.setDragImage(blockEl, 0, 0)
    },

    dragOver(id, e: DragEvent<HTMLElement>) {
      if (!dragId.current) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      const rect = e.currentTarget.getBoundingClientRect()
      const pos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
      setDrop((prev) => (prev && prev.id === id && prev.pos === pos ? prev : { id, pos }))
    },

    drop(id, e: DragEvent<HTMLElement>) {
      e.preventDefault()
      const from = dragId.current
      const pos = drop?.id === id ? drop.pos : 'after'
      dragId.current = null
      setDrop(null)
      if (!from || from === id) return
      const moving = blocks.find((b) => b.id === from)
      if (!moving) return
      const rest = blocks.filter((b) => b.id !== from)
      const at = rest.findIndex((b) => b.id === id)
      rest.splice(pos === 'after' ? at + 1 : at, 0, moving)
      commit(rest)
    },

    dragEnd() {
      dragId.current = null
      setDrop(null)
    },
  }

  // Blocks call through this ref so they stay memoised while handlers see fresh state.
  const api = useRef(handlers)
  useLayoutEffect(() => {
    api.current = handlers
  })

  const focusTail = () => {
    const last = blocks[blocks.length - 1]
    if (last && last.type === 'text' && htmlToText(last.html) === '') {
      const el = contentEl(last.id)
      if (el) placeCaret(el, 'end')
      return
    }
    const fresh = newBlock()
    commit([...blocks, fresh], { id: fresh.id, pos: 'start' })
  }

  const menuBlock = menu ? blocks.find((b) => b.id === menu.id) : undefined
  const slashItems = slash ? filterCommands(slash.query) : []

  return (
    <div className="editor" ref={rootRef}>
      {blocks.map((block, i) => (
        <BlockView
          key={block.id}
          block={block}
          number={block.type === 'number' ? numberFor(blocks, i) : 0}
          dropPos={drop && drop.id === block.id ? drop.pos : null}
          api={api}
        />
      ))}
      <div className="editor-tail" onClick={focusTail} aria-hidden="true" />

      {slash && slashItems.length > 0 && (
        <Popover anchor={slash.rect} onClose={() => setSlash(null)} className="slash-menu" width={250}>
          <MenuLabel>Blocks</MenuLabel>
          {slashItems.map((command, i) => (
            <MenuItem
              key={command.type}
              icon={<command.icon size={16} />}
              label={command.label}
              hint={command.hint}
              active={i === slash.index}
              onSelect={() => applySlash(command)}
            />
          ))}
        </Popover>
      )}

      {menu && menuBlock && (
        <Popover anchor={menu.rect} onClose={() => setMenu(null)} width={220}>
          {menuBlock.type !== 'divider' && (
            <>
              <MenuLabel>Turn into</MenuLabel>
              {COMMANDS.filter((c) => c.type !== 'divider').map((command) => (
                <MenuItem
                  key={command.type}
                  icon={<command.icon size={16} />}
                  label={command.label}
                  active={command.type === menuBlock.type}
                  onSelect={() => {
                    setMenu(null)
                    turnInto(menuBlock.id, command.type, contentEl(menuBlock.id)?.innerHTML)
                  }}
                />
              ))}
              <MenuDivider />
            </>
          )}
          <MenuItem
            icon={<Copy size={16} />}
            label="Duplicate"
            onSelect={() => {
              const idx = blocks.findIndex((b) => b.id === menuBlock.id)
              const copy = newBlock(menuBlock.type, menuBlock.html, { checked: menuBlock.checked, indent: menuBlock.indent })
              setMenu(null)
              commit([...blocks.slice(0, idx + 1), copy, ...blocks.slice(idx + 1)])
            }}
          />
          <MenuItem
            icon={<Trash2 size={16} />}
            label="Delete"
            danger
            onSelect={() => {
              setMenu(null)
              commit(blocks.filter((b) => b.id !== menuBlock.id))
            }}
          />
        </Popover>
      )}

      <FormatBar root={rootRef} />
    </div>
  )
}

/** Floating bold / italic / underline / strike bar for a text selection inside one block. */
function FormatBar({ root }: { root: RefObject<HTMLDivElement | null> }) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const mouseDown = useRef(false)

  useEffect(() => {
    const evaluate = () => {
      if (mouseDown.current) return
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setRect(null)
        return
      }
      const range = sel.getRangeAt(0)
      const node = range.commonAncestorContainer
      const host = (node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement)?.closest('.block-content')
      if (!host || !root.current?.contains(host)) {
        setRect(null)
        return
      }
      const box = range.getBoundingClientRect()
      setRect(box.width > 0 ? box : null)
    }
    const down = () => {
      mouseDown.current = true
    }
    const up = () => {
      mouseDown.current = false
      window.setTimeout(evaluate, 0)
    }
    document.addEventListener('selectionchange', evaluate)
    document.addEventListener('mousedown', down)
    document.addEventListener('mouseup', up)
    return () => {
      document.removeEventListener('selectionchange', evaluate)
      document.removeEventListener('mousedown', down)
      document.removeEventListener('mouseup', up)
    }
  }, [root])

  if (!rect) return null
  const above = rect.top > 56
  const left = Math.max(84, Math.min(window.innerWidth - 84, rect.left + rect.width / 2))
  const run = (command: string) => document.execCommand(command, false)

  return createPortal(
    <div
      className="format-bar"
      style={{ left, top: above ? rect.top - 42 : rect.bottom + 8 }}
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onMouseUp={(e) => e.stopPropagation()}
    >
      <button type="button" title="Bold" aria-label="Bold" onClick={() => run('bold')}>
        <Bold size={15} />
      </button>
      <button type="button" title="Italic" aria-label="Italic" onClick={() => run('italic')}>
        <Italic size={15} />
      </button>
      <button type="button" title="Underline" aria-label="Underline" onClick={() => run('underline')}>
        <Underline size={15} />
      </button>
      <button type="button" title="Strikethrough" aria-label="Strikethrough" onClick={() => run('strikeThrough')}>
        <Strikethrough size={15} />
      </button>
    </div>,
    document.body,
  )
}
