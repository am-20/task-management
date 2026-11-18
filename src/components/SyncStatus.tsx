import { Cloud, CloudOff, RefreshCw, TriangleAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useSync } from '../sync/engine'

const LABEL = {
  idle: 'Not synced',
  loading: 'Loading…',
  saving: 'Saving…',
  synced: 'Synced',
  offline: 'Offline',
  error: 'Sync problem',
} as const

/** A quiet indicator of whether the latest changes have reached the cloud. */
export function SyncStatus() {
  const { status, message } = useSync()
  if (!supabase) return null
  const Icon =
    status === 'offline' ? CloudOff : status === 'error' ? TriangleAlert : status === 'synced' || status === 'idle' ? Cloud : RefreshCw
  return (
    <span className={`sync-status ${status}`} title={message ?? LABEL[status]} role="status" aria-live="polite">
      <Icon size={13} className={status === 'saving' || status === 'loading' ? 'spin' : undefined} />
      {LABEL[status]}
    </span>
  )
}
