import type { RealtimeChannel } from '@supabase/supabase-js'
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { exportSnapshot, normalizeSnapshot, useStore } from '../store'
import type { DataSnapshot } from '../types'
import { mergeSnapshots } from './merge'

/**
 * Keeps the local store and the user's row in the `workspaces` table in step.
 *
 * - The whole workspace is one JSON document with a version number.
 * - Local edits are saved to the browser instantly and pushed after a short pause.
 * - A push only succeeds if nobody else has written since our last sync; if someone
 *   has, we pull their copy, merge it record by record with ours, and push again.
 * - Offline edits stay on the device and are pushed when the connection returns.
 */

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'synced' | 'offline' | 'error'

interface SyncState {
  status: SyncStatus
  lastSynced: number | null
  message: string | null
}

export const useSync = create<SyncState>()(() => ({ status: 'idle', lastSynced: null, message: null }))

const META_KEY = 'hearth-sync'
const PUSH_DELAY = 700
const RETRY_DELAY = 15_000
const TABLE = 'workspaces'

interface Meta {
  userId: string
  version: number
  dirty: boolean
  base: DataSnapshot | null
}

let userId: string | null = null
/** Version of the remote row our `base` corresponds to; 0 = no row known yet */
let version = 0
/** The last data we know the server has */
let base: DataSnapshot | null = null
let dirty = false
let changeSeq = 0
let applying = false
let pushTimer: number | undefined
let retryTimer: number | undefined
let queue: Promise<unknown> = Promise.resolve()
let channel: RealtimeChannel | null = null
let unsubscribeStore: (() => void) | null = null
const cleanups: (() => void)[] = []

const setStatus = (status: SyncStatus, message: string | null = null) =>
  useSync.setState((s) => ({
    status,
    message,
    lastSynced: status === 'synced' ? Date.now() : s.lastSynced,
  }))

function saveMeta() {
  if (!userId) return
  try {
    const meta: Meta = { userId, version, dirty, base }
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    // Storage full or blocked: syncing still works for this session.
  }
}

function loadMeta(forUser: string): Meta | null {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return null
    const meta = JSON.parse(raw) as Meta
    return meta.userId === forUser ? meta : null
  } catch {
    return null
  }
}

/** Run sync steps one at a time so pushes and pulls never overlap. */
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn)
  queue = next.catch(() => undefined)
  return next
}

function applyLocal(data: DataSnapshot) {
  applying = true
  try {
    useStore.getState().applyRemote(data)
  } finally {
    applying = false
  }
}

function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const msg = String((error as { message?: string })?.message ?? error)
  return /fetch|network|load failed|timeout/i.test(msg)
}

function fail(error: unknown) {
  if (isNetworkError(error)) {
    setStatus('offline', 'Offline. Changes are kept on this device.')
  } else {
    console.error('[sync]', error)
    setStatus('error', 'Could not sync. Changes are kept on this device.')
  }
  window.clearTimeout(retryTimer)
  retryTimer = window.setTimeout(() => void pull(), RETRY_DELAY)
}

function schedulePush() {
  window.clearTimeout(pushTimer)
  pushTimer = window.setTimeout(() => void push(), PUSH_DELAY)
}

/** Fetch the server copy and reconcile it with what is on this device. */
export function pull(): Promise<void> {
  return serial(async () => {
    if (!supabase || !userId) return
    if (!navigator.onLine) return fail(new Error('offline'))
    const { data: row, error } = await supabase
      .from(TABLE)
      .select('data, version')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) return fail(error)

    if (!row) {
      // First sign-in anywhere: this device's data becomes the account's data.
      version = 0
      dirty = true
      saveMeta()
      schedulePush()
      return
    }

    const remoteVersion = Number(row.version)
    if (remoteVersion === version) {
      if (dirty) schedulePush()
      else setStatus('synced')
      return
    }

    const remote = normalizeSnapshot(row.data)
    if (dirty && base) {
      applyLocal(normalizeSnapshot(mergeSnapshots(base, exportSnapshot(), remote)))
      base = remote
      version = remoteVersion
      saveMeta()
      schedulePush()
    } else {
      applyLocal(remote)
      base = remote
      version = remoteVersion
      dirty = false
      saveMeta()
      setStatus('synced')
    }
  })
}

/** Send local changes to the server. */
export function push(): Promise<void> {
  window.clearTimeout(pushTimer)
  return serial(async () => {
    if (!supabase || !userId || !dirty) return
    if (!navigator.onLine) return fail(new Error('offline'))
    setStatus('saving')
    const snapshot = exportSnapshot()
    const seqAtStart = changeSeq

    if (version === 0) {
      const { error } = await supabase.from(TABLE).insert({ user_id: userId, data: snapshot, version: 1 })
      if (error) {
        // Another device created the row first: merge with it instead.
        if (error.code === '23505') {
          base = base ?? { areas: [], pages: [], tasks: [], habits: [] }
          queueMicrotask(() => void pull())
          return
        }
        return fail(error)
      }
      version = 1
    } else {
      const { data, error } = await supabase
        .from(TABLE)
        .update({ data: snapshot, version: version + 1 })
        .eq('user_id', userId)
        .eq('version', version)
        .select('version')
      if (error) return fail(error)
      if (!data || data.length === 0) {
        // Someone else saved in between: pull, merge and try again.
        queueMicrotask(() => void pull())
        return
      }
      version += 1
    }

    base = snapshot
    dirty = changeSeq !== seqAtStart
    saveMeta()
    if (dirty) schedulePush()
    else setStatus('synced')
  })
}

function onLocalChange() {
  if (applying || !userId) return
  changeSeq++
  if (!dirty) {
    dirty = true
    saveMeta()
  }
  setStatus('saving')
  schedulePush()
}

/** Start syncing for a signed-in user. Resolves once the first pull has finished. */
export async function startSync(id: string): Promise<void> {
  if (!supabase) return
  if (userId === id) return
  stopSync()
  userId = id
  setStatus('loading')

  const meta = loadMeta(id)
  if (meta) {
    version = meta.version
    base = meta.base ? normalizeSnapshot(meta.base) : null
    dirty = meta.dirty
  } else {
    // Nothing on this device belongs to this account yet; the server copy wins.
    version = 0
    base = null
    dirty = false
  }

  unsubscribeStore = useStore.subscribe((state, prev) => {
    if (
      state.areas !== prev.areas ||
      state.pages !== prev.pages ||
      state.tasks !== prev.tasks ||
      state.habits !== prev.habits
    ) {
      onLocalChange()
    }
  })

  const onOnline = () => void pull()
  const onVisible = () => {
    if (document.visibilityState === 'visible') void pull()
    else if (dirty) void push()
  }
  const onLeave = () => {
    if (dirty) void push()
  }
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('pagehide', onLeave)
  cleanups.push(
    () => window.removeEventListener('online', onOnline),
    () => document.removeEventListener('visibilitychange', onVisible),
    () => window.removeEventListener('pagehide', onLeave),
  )

  // Live updates from other devices.
  channel = supabase
    .channel(`workspace-${id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: `user_id=eq.${id}` }, (payload) => {
      const incoming = Number((payload.new as { version?: number } | null)?.version ?? 0)
      if (incoming > version) void pull()
    })
    .subscribe()

  await pull()
}

/** Stop syncing. With `forget`, remove this account's data from the device. */
export function stopSync(forget = false) {
  window.clearTimeout(pushTimer)
  window.clearTimeout(retryTimer)
  unsubscribeStore?.()
  unsubscribeStore = null
  cleanups.splice(0).forEach((fn) => fn())
  if (channel && supabase) void supabase.removeChannel(channel)
  channel = null
  if (forget) {
    try {
      localStorage.removeItem(META_KEY)
    } catch {
      // ignore
    }
    applying = true
    useStore.getState().clearAll()
    applying = false
  }
  userId = null
  version = 0
  base = null
  dirty = false
  setStatus('idle')
}

/** Whether there are local edits the server has not seen yet. */
export const hasUnsyncedChanges = () => dirty
