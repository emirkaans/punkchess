// Registers the service worker (production builds only) and reports when a
// new version is installed and waiting, so the app can switch to it (App.tsx).
// An open tab looks for a new version every half hour and whenever it comes
// back into view, so nobody stays on an old version for long.

type Listener = () => void;
const listeners = new Set<Listener>();
let waiting: ServiceWorker | null = null;

/** Calls `cb` when an update is ready (immediately if one already is). Returns an unsubscribe function. */
export function onUpdateReady(cb: Listener): () => void {
  listeners.add(cb);
  if (waiting) cb();
  return () => listeners.delete(cb);
}

/** Activates the waiting version and reloads the page once it has taken over. */
export function applyUpdate(): void {
  if (!waiting) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
  waiting.postMessage('skip-waiting');
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const announce = (w: ServiceWorker) => {
    waiting = w;
    listeners.forEach((l) => l());
  };
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(new URL('sw.js', document.baseURI))
      .then((reg) => {
        // A version may already be waiting (installed during an earlier visit).
        if (reg.waiting && navigator.serviceWorker.controller) announce(reg.waiting);
        const check = () => void reg.update().catch(() => undefined);
        setInterval(check, 30 * 60_000);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check();
        });
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          w?.addEventListener('statechange', () => {
            // "installed" with an existing controller = an update, not the first install.
            if (w.state === 'installed' && navigator.serviceWorker.controller) announce(w);
          });
        });
      })
      .catch(() => {
        // Offline support is optional: the app works without it.
      });
  });
}
