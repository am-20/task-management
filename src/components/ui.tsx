import { Check } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useIsPhone } from '../lib/useMedia'
import { getConfirm, settleConfirm, subscribeConfirm } from '../lib/confirm'
import { dismissToast, getToast, subscribeToast } from '../lib/toast'
import { usePopover } from '../lib/usePopover'

/* ---------- Popover ---------- */

interface PopoverProps {
  anchor: DOMRect
  onClose: () => void
  children: ReactNode
  align?: 'start' | 'end'
  className?: string
  width?: number
}

export function Popover({ anchor, onClose, children, align = 'start', className = '', width }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const scrimRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  // On phones, pop-ups open in the middle of the screen with bigger targets.
  const sheet = useIsPhone()

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || sheet) return
    const { width: w, height: h } = el.getBoundingClientRect()
    const margin = 8
    let left = align === 'end' ? anchor.right - w : anchor.left
    let top = anchor.bottom + 6
    if (top + h > window.innerHeight - margin) {
      const above = anchor.top - h - 6
      top = above >= margin ? above : Math.max(margin, window.innerHeight - h - margin)
    }
    left = Math.max(margin, Math.min(left, window.innerWidth - w - margin))
    setPos({ left, top })
  }, [anchor, align, sheet])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element
      if (target === scrimRef.current) return onClose()
      if (!ref.current || ref.current.contains(target)) return
      // A click inside another pop-up opened from this one (a date picker inside
      // a task card, say) shouldn't close this one.
      if (target.closest?.('.popover, .popover-scrim')) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    // A floating pop-up would be left behind if the window changes size. Not for
    // centred ones: on phones the keyboard opening resizes the window.
    if (!sheet) window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose, sheet])

  if (sheet) {
    return createPortal(
      <>
        <div ref={scrimRef} className="popover-scrim" aria-hidden="true" />
        <div ref={ref} className={`popover sheet ${className}`} role="dialog" aria-modal="true">
          {children}
        </div>
      </>,
      document.body,
    )
  }

  const style: CSSProperties = pos
    ? { left: pos.left, top: pos.top, width }
    : { left: 0, top: 0, width, visibility: 'hidden' }

  return createPortal(
    <div ref={ref} className={`popover ${className}`} style={style} role="dialog">
      {children}
    </div>,
    document.body,
  )
}

/* ---------- Menu ---------- */

interface MenuItemProps {
  icon?: ReactNode
  label: string
  hint?: ReactNode
  danger?: boolean
  active?: boolean
  onSelect: () => void
}

export function MenuItem({ icon, label, hint, danger, active, onSelect }: MenuItemProps) {
  return (
    <button
      type="button"
      className={`menu-item${danger ? ' danger' : ''}${active ? ' active' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onSelect}
    >
      {icon !== undefined && <span className="menu-icon">{icon}</span>}
      <span className="menu-label">{label}</span>
      {hint !== undefined && <span className="menu-hint">{hint}</span>}
    </button>
  )
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="menu-heading">{children}</div>
}

export function MenuDivider() {
  return <div className="menu-divider" />
}

/* ---------- Checkbox ---------- */

interface CheckProps {
  checked: boolean
  onChange: () => void
  color?: string
  label: string
  round?: boolean
}

export function Checkbox({ checked, onChange, color, label, round = true }: CheckProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={`check${checked ? ' checked' : ''}${round ? ' round' : ''}`}
      style={color ? ({ '--check': color } as CSSProperties) : undefined}
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
    >
      <Check size={12} strokeWidth={3.2} />
    </button>
  )
}

/* ---------- Emoji picker ---------- */

const EMOJI = [
  '🍂', '🍁', '🌿', '🌱', '🌲', '🍄', '🌰', '🌻', '🌙', '☀️', '⭐', '🔥', '🕯️', '🌧️', '🌊', '🏔️',
  '🏡', '🛋️', '🧺', '🧹', '🪴', '🔧', '🛒', '🧾', '🪙', '💰', '📒', '📈', '🏦', '💳', '🎯', '✅',
  '❤️', '🍷', '👪', '👶', '🐶', '🐱', '🎁', '💌', '🥂', '☕', '🍳', '🥗', '🍎', '🥐', '🍲', '🫖',
  '🏃', '🧘', '🚴', '🏊', '🥾', '💪', '🩺', '💊', '😴', '💧', '🧠', '🪞', '📚', '📖', '✍️', '🎓',
  '🎨', '🎹', '🎸', '📷', '🎬', '🎮', '🧶', '🪡', '🧭', '🗺️', '✈️', '🚆', '🚗', '⛺', '🏖️', '🎒',
  '📄', '📝', '📌', '📅', '⏰', '💡', '🔑', '📦', '🧳', '🪜', '🧩', '🎉', '🙏', '🌈', '🦊', '🦉',
]

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <div className="emoji-grid">
      {EMOJI.map((e) => (
        <button key={e} type="button" className="emoji-cell" onClick={() => onPick(e)}>
          {e}
        </button>
      ))}
    </div>
  )
}

interface EmojiButtonProps {
  value: string
  onChange: (emoji: string) => void
  className?: string
  label?: string
}

export function EmojiButton({ value, onChange, className = '', label = 'Change icon' }: EmojiButtonProps) {
  const pop = usePopover()
  return (
    <>
      <button type="button" className={`emoji-button ${className}`} onClick={pop.open} aria-label={label} title={label}>
        {value}
      </button>
      {pop.anchor && (
        <Popover anchor={pop.anchor} onClose={pop.close}>
          <EmojiPicker
            onPick={(e) => {
              onChange(e)
              pop.close()
            }}
          />
        </Popover>
      )}
    </>
  )
}

/* ---------- Confirm dialog ---------- */

export function ConfirmHost() {
  const state = useSyncExternalStore(subscribeConfirm, getConfirm)


  useEffect(() => {
    if (!state) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settleConfirm(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [state])

  if (!state) return null
  return createPortal(
    <div className="scrim" onMouseDown={() => settleConfirm(false)}>
      <div className="dialog" role="alertdialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <h3>{state.title}</h3>
        {state.body && <p>{state.body}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={() => settleConfirm(false)}>
            Cancel
          </button>
          <button type="button" className={`btn ${state.danger === false ? 'primary' : 'danger'}`} autoFocus onClick={() => settleConfirm(true)}>
            {state.action ?? 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ---------- Toast ---------- */

export function ToastHost() {
  const toast = useSyncExternalStore(subscribeToast, getToast)
  if (!toast) return null
  return createPortal(
    <div className="toast" role="status" aria-live="polite" key={toast.id}>
      <span>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action!.run()
            dismissToast()
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>,
    document.body,
  )
}
