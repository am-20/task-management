/** Small helpers for working with the caret inside contentEditable blocks. */

export type CaretPos = 'start' | 'end' | number

export function selectionRange(el: HTMLElement): Range | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  return el.contains(range.startContainer) ? range : null
}

export function textBeforeCaret(el: HTMLElement): string {
  const range = selectionRange(el)
  if (!range) return ''
  const pre = document.createRange()
  pre.selectNodeContents(el)
  pre.setEnd(range.startContainer, range.startOffset)
  return pre.toString()
}

export function textAfterCaret(el: HTMLElement): string {
  const range = selectionRange(el)
  if (!range) return ''
  const post = document.createRange()
  post.selectNodeContents(el)
  post.setStart(range.endContainer, range.endOffset)
  return post.toString()
}

export function placeCaret(el: HTMLElement, pos: CaretPos) {
  el.focus()
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  range.selectNodeContents(el)
  if (pos === 'start' || pos === 'end') {
    // Prefer a text node: browsers report caret geometry more reliably there.
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let target = walker.nextNode()
    if (pos === 'end') {
      for (let n = target; n; n = walker.nextNode()) target = n
    }
    const endsWithBreak = el.lastChild?.nodeName === 'BR'
    if (target && !(pos === 'end' && endsWithBreak)) {
      range.setStart(target, pos === 'start' ? 0 : (target.textContent?.length ?? 0))
      range.collapse(true)
    } else {
      range.collapse(pos === 'start')
    }
  } else {
    let remaining = pos
    let placed = false
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node) {
      const len = node.textContent?.length ?? 0
      if (remaining <= len) {
        range.setStart(node, remaining)
        range.collapse(true)
        placed = true
        break
      }
      remaining -= len
      node = walker.nextNode()
    }
    if (!placed) range.collapse(false)
  }
  sel.removeAllRanges()
  sel.addRange(range)
}

function metrics(el: HTMLElement) {
  const cs = getComputedStyle(el)
  return {
    box: el.getBoundingClientRect(),
    lineHeight: parseFloat(cs.lineHeight) || 24,
    padTop: parseFloat(cs.paddingTop) || 0,
    padBottom: parseFloat(cs.paddingBottom) || 0,
  }
}

/** Whether the caret sits on the first / last visual line of the block. */
export function caretLine(el: HTMLElement): { first: boolean; last: boolean; x: number } {
  const { box, lineHeight, padTop, padBottom } = metrics(el)
  const range = selectionRange(el)
  let rect: DOMRect | null = null
  if (range) {
    const rects = range.getClientRects()
    rect = rects.length ? rects[0] : range.getBoundingClientRect()
    if (!rect.height) rect = null
  }
  if (!rect) {
    const single = box.height - padTop - padBottom < lineHeight * 1.6
    const atStart = textBeforeCaret(el) === ''
    const atEnd = textAfterCaret(el) === ''
    return { first: single || atStart, last: single || atEnd, x: box.left }
  }
  return {
    first: rect.top - (box.top + padTop) < lineHeight * 0.6,
    last: box.bottom - padBottom - rect.bottom < lineHeight * 0.6,
    x: rect.left,
  }
}

interface CaretDocument {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  caretRangeFromPoint?: (x: number, y: number) => Range | null
}

/** Put the caret on the top or bottom line of a block, as close to `x` as possible. */
export function placeCaretAtX(el: HTMLElement, x: number, edge: 'top' | 'bottom') {
  el.focus()
  const { box, lineHeight, padTop, padBottom } = metrics(el)
  const y = edge === 'top' ? box.top + padTop + lineHeight / 2 : box.bottom - padBottom - lineHeight / 2
  const cx = Math.min(Math.max(x, box.left + 1), box.right - 1)
  const doc = document as unknown as CaretDocument
  let range: Range | null = null
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(cx, y)
    if (p) {
      range = document.createRange()
      range.setStart(p.offsetNode, p.offset)
    }
  } else if (doc.caretRangeFromPoint) {
    range = doc.caretRangeFromPoint(cx, y)
  }
  const sel = window.getSelection()
  if (range && sel && el.contains(range.startContainer)) {
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
  } else {
    placeCaret(el, edge === 'top' ? 'start' : 'end')
  }
}
