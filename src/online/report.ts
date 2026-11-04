// When the daily report (server/report.ts) is kept. Pure.

/** Turkey's hour (UTC+3, no summer time) from which the day's report is kept. */
export const REPORT_HOUR = 23;

/** Most days GET /api/report/history answers. */
export const MAX_HISTORY_DAYS = 60;

/** Whether the day's report is due to be kept at `now`: from REPORT_HOUR to midnight, Turkey time. */
export const reportDue = (now: number): boolean => new Date(now + 3 * 3_600_000).getUTCHours() >= REPORT_HOUR;

/** The number of days asked for (1 to MAX_HISTORY_DAYS; 7 when missing or not a number). */
export function historyDays(asked: string | null): number {
  const n = Math.floor(Number(asked ?? 7));
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), MAX_HISTORY_DAYS) : 7;
}

/** A suggestion of the weekly review, as stored and answered (GET /api/report/suggestions). */
export interface Suggestion {
  readonly n: number;
  readonly title: string;
  readonly body: string;
  readonly size: string | null;
  readonly risk: string | null;
}

/** Most suggestions kept for a week, and their longest title and text. */
export const MAX_SUGGESTIONS = 10;
const MAX_TITLE = 160;
const MAX_BODY = 2000;

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * A weekly review's POST /api/report/suggestions body ({ week: 'YYYY-MM-DD', items: [{ title,
 * body, size?, risk? }] }) made safe: numbered 1, 2, … in order, cut to size; null when it is not
 * one.
 */
export function cleanSuggestions(input: unknown): { week: string; items: Suggestion[] } | null {
  const b = (input && typeof input === 'object' ? input : {}) as { week?: unknown; items?: unknown };
  if (typeof b.week !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.week) || !Array.isArray(b.items)) return null;
  const items: Suggestion[] = [];
  for (const raw of b.items.slice(0, MAX_SUGGESTIONS)) {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const title = text(r.title, MAX_TITLE);
    const body = text(r.body, MAX_BODY);
    if (!title || !body) continue;
    items.push({ n: items.length + 1, title, body, size: text(r.size, 20) || null, risk: text(r.risk, 20) || null });
  }
  return items.length ? { week: b.week, items } : null;
}

/** An error spike: at least this many error reports in the last ERROR_WINDOW_MS. */
export const ERROR_SPIKE = 5;
export const ERROR_WINDOW_MS = 15 * 60_000;
/** One message for an alert at most this often. */
export const ALERT_COOLDOWN_MS = 60 * 60_000;

/** Whether an alert last sent at `lastAt` may be sent again at `now`. */
export const alertAllowed = (lastAt: number | null, now: number): boolean =>
  lastAt === null || now - lastAt >= ALERT_COOLDOWN_MS;
