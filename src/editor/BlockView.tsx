import { GripVertical, Plus } from 'lucide-react'
import { memo, useLayoutEffect, useRef, type ClipboardEvent, type DragEvent, type KeyboardEvent, type RefObject } from 'react'
import { Checkbox } from '../components/ui'
import { sanitize } from '../lib/sanitize'
import type { Block } from '../types'
import { PLACEHOLDERS } from './commands'

export interface EditorApi {
  input: (id: string, el: HTMLElement) => void
  keyDown: (id: string, e: KeyboardEvent<HTMLDivElement>) => void
  paste: (id: string, e: ClipboardEvent<HTMLDivElement>) => void
  toggleCheck: (id: string) => void
  addBelow: (id: string) => void
  openMenu: (id: string, rect: DOMRect) => void
  dragStart: (id: string, e: DragEvent<HTMLElement>) => void
  dragOver: (id: string, e: DragEvent<HTMLElement>) => void
  drop: (id: string, e: DragEvent<HTMLElement>) => void
  dragEnd: () => void
}

interface Props {
  block: Block
  number: number
  dropPos: 'before' | 'after' | null
  api: RefObject<EditorApi>
}

export const BlockView = memo(function BlockView({ block, number, dropPos, api }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // The DOM is the source of truth while typing; only write when it differs.
  useLayoutEffect(() => {
    const el = ref.current
    if (el && el.innerHTML !== block.html) el.innerHTML = sanitize(block.html)
  }, [block.html, block.type])

  const id = block.id
  const cls = [
    'block',
    `block-${block.type}`,
    block.checked ? 'is-checked' : '',
    dropPos ? `drop-${dropPos}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={cls}
      data-block-id={id}
      style={block.indent ? { marginLeft: block.indent * 26 } : undefined}
      onDragOver={(e) => api.current.dragOver(id, e)}
      onDrop={(e) => api.current.drop(id, e)}
    >
      <div className="block-gutter" contentEditable={false}>
        <button type="button" className="gutter-btn" title="Add a block below" aria-label="Add a block below" onClick={() => api.current.addBelow(id)}>
          <Plus size={16} />
        </button>
        <button
          type="button"
          className="gutter-btn grab"
          draggable
          title="Drag to move, click for options"
          aria-label="Block options"
          onClick={(e) => api.current.openMenu(id, e.currentTarget.getBoundingClientRect())}
          onDragStart={(e) => api.current.dragStart(id, e)}
          onDragEnd={() => api.current.dragEnd()}
        >
          <GripVertical size={16} />
        </button>
      </div>

      {block.type === 'divider' ? (
        <div className="divider-line" role="separator" />
      ) : (
        <>
          <div className="block-prefix" contentEditable={false}>
            {block.type === 'bullet' && <span className="bullet-dot" />}
            {block.type === 'number' && <span className="number-mark">{number}.</span>}
            {block.type === 'todo' && (
              <Checkbox round={false} checked={!!block.checked} onChange={() => api.current.toggleCheck(id)} label="Toggle to-do" />
            )}
            {block.type === 'callout' && <span className="callout-icon">🍂</span>}
          </div>
          <div
            ref={ref}
            className="block-content"
            contentEditable
            suppressContentEditableWarning
            spellCheck
            role="textbox"
            aria-multiline="true"
            data-placeholder={PLACEHOLDERS[block.type]}
            onInput={(e) => api.current.input(id, e.currentTarget)}
            onKeyDown={(e) => api.current.keyDown(id, e)}
            onPaste={(e) => api.current.paste(id, e)}
          />
        </>
      )}
    </div>
  )
})
