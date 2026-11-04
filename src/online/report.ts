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
