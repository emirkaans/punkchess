// Sends errors that reach the top of the page (uncaught errors, rejected
// promises nobody handled) to the server, so they show up in the Worker's
// logs. A few per page at most; failures to send are ignored.

import { BotCancelled } from '../ai/client.ts';
import { MAX_REPORTS_PER_PAGE } from '../online/errors.ts';
import type { ErrorReport } from '../online/errors.ts';

let sent = 0;
const seen = new Set<string>();

/** Sends one error to the server (a few per page at most, each message once). */
export function reportError(message: string, stack: string): void {
  if (typeof window === 'undefined') return;
  // Extensions and cross-origin scripts only give "Script error.": nothing to learn from it.
  if (!message || message === 'Script error.' || sent >= MAX_REPORTS_PER_PAGE || seen.has(message)) return;
  seen.add(message);
  sent++;
  const build =
    document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')?.src.split('/').pop() ?? '';
  const body: ErrorReport = {
    message,
    stack,
    path: location.pathname,
    userAgent: navigator.userAgent,
    build,
  };
  void fetch('/api/errors', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {});
}

export function installErrorReporting(): void {
  if (typeof window === 'undefined') return;
  const report = reportError;
  window.addEventListener('error', (e) => {
    const err = e.error as Error | undefined;
    report(String(err?.message ?? e.message ?? ''), String(err?.stack ?? `${e.filename}:${e.lineno}:${e.colno}`));
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as Error | undefined;
    // Cancelled engine searches and the like are not errors worth a report.
    if (r instanceof BotCancelled) return;
    report(String(r?.message ?? r ?? ''), String(r?.stack ?? ''));
  });
}
