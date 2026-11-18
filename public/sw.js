/*
 * Hearth service worker.
 * - Pages: network first, so a new deploy shows up on the next launch; cached copy when offline.
 * - Built assets (hashed file names) and fonts: cache first, they never change.
 * - Anything on another origin (the Supabase API) is left alone.
 */
const CACHE = 'hearth-v3'
const SHELL = ['./', './index.html', './manifest.webmanifest', './favicon.svg', './icons/icon-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  const { type, urls } = event.data || {}
  if (type !== 'cache-urls' || !Array.isArray(urls)) return
  const sameOrigin = urls.filter((u) => {
    try {
      return new URL(u).origin === self.location.origin
    } catch {
      return false
    }
  })
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        sameOrigin.map((u) =>
          cache.match(u, { ignoreVary: true }).then((hit) => hit || cache.add(u).catch(() => undefined)),
        ),
      ),
    ),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy))
          return response
        })
        .catch(() => caches.match('./index.html', { ignoreVary: true }).then((r) => r || caches.match('./', { ignoreVary: true }))),
    )
    return
  }

  event.respondWith(
    caches.match(request, { ignoreVary: true }).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})
