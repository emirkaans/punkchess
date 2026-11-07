// Whether the server answers (design "Yanıp sönen ışık"): when it does not, the site keeps
// working from the copy the service worker kept, and a strip at the top says so (ServerStrip).
// The account request tells first (src/ui/account.ts); while the server is down it is asked
// again every 20 seconds, and the strip goes away by itself once it answers.

import { useSyncExternalStore } from 'react';

let down = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const RETRY_MS = 20_000;

function set(next: boolean) {
  if (next === down) return;
  down = next;
  for (const l of listeners) l();
}

/** Asks the server again; true when it answered (any answer below 500 counts). */
async function ping(): Promise<boolean> {
  try {
    const res = await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' });
    return res.status < 500;
  } catch {
    return false;
  }
}

function retryLater(onBack: () => void) {
  if (timer || import.meta.env.MODE === 'test') return;
  timer = setTimeout(async () => {
    timer = null;
    if (await ping()) {
      set(false);
      onBack();
    } else retryLater(onBack);
  }, RETRY_MS);
}

/**
 * What a request to the server showed: `ok` false when it failed to arrive or the server broke
 * (5xx). `onBack` runs once the server answers again (the account is asked for anew).
 */
export function noteServer(ok: boolean, onBack: () => void = () => {}): void {
  set(!ok);
  if (!ok) retryLater(onBack);
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => set(true));
  window.addEventListener('online', () => {
    void ping().then((ok) => set(!ok));
  });
}

/** True while the server does not answer. */
export function useServerDown(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => down,
    () => false,
  );
}
