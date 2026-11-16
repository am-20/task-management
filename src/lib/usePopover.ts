import { useCallback, useState, type MouseEvent as ReactMouseEvent } from 'react'

/** Tracks the anchor rectangle for a click-to-open popover. */
export function usePopover() {
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const open = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    e.stopPropagation()
    setAnchor(e.currentTarget.getBoundingClientRect())
  }, [])
  const close = useCallback(() => setAnchor(null), [])
  return { anchor, open, close }
}
