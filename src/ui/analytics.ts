// Site analytics from the browser (server/analytics.ts): each page shown, and a sign of life
// every 2 minutes while the tab is visible (who is on the site now). No cookies; the page's
// kind is sent, never its address.

const PING_MS = 2 * 60_000;
let referrer: string | null = typeof document !== 'undefined' ? document.referrer : null;
let current: string | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function send(body: object) {
  try {
    const data = new Blob([JSON.stringify(body)], { type: 'application/json' });
    if (navigator.sendBeacon?.('/api/hit', data)) return;
    void fetch('/api/hit', { method: 'POST', body: data, keepalive: true, credentials: 'same-origin' }).catch(() => {});
  } catch {
    // Analytics never gets in the way.
  }
}

/** A page shown (its kind, as in src/ui/routes.ts). */
export function trackPage(page: string) {
  if (page === current) return;
  current = page;
  send(referrer ? { page, ref: referrer } : { page });
  // The site a visit came from counts for its first page only.
  referrer = null;
  timer ??= setInterval(() => {
    if (current && document.visibilityState === 'visible') send({ page: current, ping: true });
  }, PING_MS);
}
