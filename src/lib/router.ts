import { useSyncExternalStore } from 'react'

export type Route =
  | { name: 'today' }
  | { name: 'upcoming' }
  | { name: 'habits' }
  | { name: 'calendar'; mode: 'month' | 'week' }
  | { name: 'area'; id: string }
  | { name: 'page'; id: string }

function parse(hash: string): Route {
  const [, name, id] = hash.replace(/^#/, '').split('/')
  if (name === 'upcoming') return { name }
  if (name === 'habits') return { name }
  if (name === 'calendar') return { name, mode: id === 'week' ? 'week' : 'month' }
  if ((name === 'area' || name === 'page') && id) return { name, id }
  return { name: 'today' }
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

const getHash = () => window.location.hash

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash)
  return parse(hash)
}

export function navigate(path: string) {
  window.location.hash = path
}
