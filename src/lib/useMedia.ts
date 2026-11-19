import { useSyncExternalStore } from 'react'

/** Follows a CSS media query. */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
  )
}

/** The phone layout (matches the CSS breakpoint). */
export const useIsPhone = () => useMedia('(max-width: 860px)')
