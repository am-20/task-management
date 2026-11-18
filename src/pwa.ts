/** Register the service worker so the app installs to the home screen and opens offline. */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  // Files fetched before the worker was active (the very first visit) are not in its
  // cache yet; hand it the list so the app also opens offline straight after install.
  const shareLoadedFiles = (worker: ServiceWorker | null | undefined) => {
    const urls = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => url.startsWith(window.location.origin))
    worker?.postMessage({ type: 'cache-urls', urls })
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then(() => Promise.all([navigator.serviceWorker.ready, document.fonts.ready]))
      .then(([registration]) => {
        shareLoadedFiles(registration.active)
        // Fonts and icons for screens shown a moment later.
        window.setTimeout(() => shareLoadedFiles(registration.active), 5000)
      })
      .catch((err) => console.warn('Service worker not registered', err))
  })
}
