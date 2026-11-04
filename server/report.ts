// The daily report for the reporting routines (scheduled Claude agents), which read it and
// send the owner a summary:
//
//   GET /api/report/daily              the last 24 hours, now
//   GET /api/report/history?days=7     the reports kept at 23:00 on the days before, newest first
//   POST /api/report/suggestions       the weekly review's numbered suggestions for its week
//   GET /api/report/suggestions?weeks=4  the latest weeks' suggestions, newest first
//
// both with Authorization: Bearer <REPORT_KEY>; and from 23:00 Turkey time the Worker's cron
// keeps the day's report (migrations/0025_daily_reports.sql). Only totals and public names
// (usernames, page kinds, countries), never emails or messages. Without REPORT_KEY
// (wrangler secret put REPORT_KEY) the endpoints do not exist.

import { dailyDay } from '../src/online/daily.ts';
import { cleanSuggestions, historyDays, reportDue } from '../src/online/report.ts';
import type { Suggestion } from '../src/online/report.ts';
import { traffic } from './analytics.ts';
import { keyMatches } from './auth-util.ts';
import type { Env } from './game-room.ts';

const DAY = 86_400_000;
/** Largest suggestions body read (bytes). */
const MAX_SUGGESTIONS_BYTES = 32_768;
const PATHS = new Set(['/api/report/daily', '/api/report/history', '/api/report/suggestions']);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

/** The last 24 hours before `now`. */
async function dailyReport(env: Env, db: D1Database, now: number) {
  const since = now - DAY;
  const all = <T>(sql: string) =>
    db
      .prepare(sql)
      .bind(since)
      .all<T>()
      .then((r) => r.results);
  const one = <T>(sql: string) => db.prepare(sql).bind(since).first<T>();

  const [site, users, totalUsers, games, coins, store, puzzles, errorCount, errors, contact] = await Promise.all([
    traffic(env, db, 1, now),
    all<{ username: string }>('SELECT username FROM users WHERE created_at >= ?1 ORDER BY created_at'),
    db.prepare('SELECT count(*) AS n FROM users').first<{ n: number }>(),
    all<{ variant: string; rated: number; n: number }>(
      'SELECT variant_id AS variant, rated, count(*) AS n FROM games WHERE ended_at >= ?1 GROUP BY variant, rated ORDER BY n DESC',
    ),
    all<{ reason: string; amount: number; n: number }>(
      'SELECT reason, sum(amount) AS amount, count(*) AS n FROM coin_ledger WHERE created_at >= ?1 GROUP BY reason',
    ),
    all<{ item: string; n: number }>(
      'SELECT item_id AS item, count(*) AS n FROM user_items WHERE bought_at >= ?1 GROUP BY item ORDER BY n DESC LIMIT 10',
    ),
    one<{ attempts: number; solved: number }>(
      'SELECT count(*) AS attempts, coalesce(sum(solved), 0) AS solved FROM puzzle_attempts WHERE at >= ?1',
    ),
    one<{ n: number }>('SELECT count(*) AS n FROM error_reports WHERE at >= ?1'),
    all<{ message: string; n: number }>(
      `SELECT substr(json_extract(report, '$.message'), 1, 160) AS message, count(*) AS n
       FROM error_reports WHERE at >= ?1 GROUP BY message ORDER BY n DESC LIMIT 10`,
    ),
    one<{ n: number }>('SELECT count(*) AS n FROM contact_messages WHERE at >= ?1'),
  ]);

  return {
    from: since,
    to: now,
    site: {
      views: site.views,
      visitors: site.visitors,
      onlineNow: site.now.online,
      peakOnline: site.peakOnline,
      peakGames: site.peakGames,
      pages: site.pages,
      countries: site.countries,
      devices: site.devices,
      referrers: site.referrers,
    },
    users: { new: users.map((u) => u.username), total: totalUsers?.n ?? 0 },
    games,
    coins,
    store,
    puzzles: { attempts: puzzles?.attempts ?? 0, solved: puzzles?.solved ?? 0 },
    errors: { total: errorCount?.n ?? 0, top: errors },
    contactMessages: contact?.n ?? 0,
  };
}

/** From the cron, every 5 minutes: from 23:00 Turkey time, keeps the day's report once. */
export async function keepDailyReport(env: Env, now = Date.now()): Promise<void> {
  if (!env.DB || !reportDue(now)) return;
  const day = dailyDay(now);
  const kept = await env.DB.prepare('SELECT 1 FROM daily_reports WHERE day = ?1').bind(day).first();
  if (kept) return;
  const report = await dailyReport(env, env.DB, now);
  await env.DB.prepare('INSERT OR IGNORE INTO daily_reports (day, at, report) VALUES (?1, ?2, ?3)')
    .bind(day, now, JSON.stringify(report))
    .run();
}

/** Answers a report request, or returns null when `url` is not one. */
export async function handleReport(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (!PATHS.has(url.pathname) || !env.REPORT_KEY) return null;
  const post = url.pathname === '/api/report/suggestions' && request.method === 'POST';
  if (request.method !== 'GET' && !post) return new Response(null, { status: 405 });
  if (!(await keyMatches(request.headers.get('authorization'), env.REPORT_KEY))) {
    return json({ error: 'forbidden' }, 403);
  }
  if (!env.DB) return json({ error: 'accounts-off' }, 503);
  const now = Date.now();

  if (url.pathname === '/api/report/daily') return json(await dailyReport(env, env.DB, now));

  if (post) {
    const db = env.DB;
    if (Number(request.headers.get('content-length') ?? MAX_SUGGESTIONS_BYTES + 1) > MAX_SUGGESTIONS_BYTES) {
      return json({ error: 'too-large' }, 413);
    }
    const clean = cleanSuggestions(await request.json().catch(() => null));
    if (!clean) return json({ error: 'bad-request' }, 400);
    // The week's list replaces the one sent before for it (a review run again).
    await db.batch([
      db.prepare('DELETE FROM suggestions WHERE week = ?1').bind(clean.week),
      ...clean.items.map((i) =>
        db
          .prepare(
            'INSERT INTO suggestions (week, n, title, body, size, risk, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
          )
          .bind(clean.week, i.n, i.title, i.body, i.size, i.risk, now),
      ),
    ]);
    return json({ week: clean.week, saved: clean.items.length });
  }

  if (url.pathname === '/api/report/suggestions') {
    const weeks = Math.min(Math.max(Math.floor(Number(url.searchParams.get('weeks') ?? 4)) || 4, 1), 26);
    const rows = await env.DB.prepare(
      `SELECT week, n, title, body, size, risk FROM suggestions
       WHERE week IN (SELECT DISTINCT week FROM suggestions ORDER BY week DESC LIMIT ?1) ORDER BY week DESC, n`,
    )
      .bind(weeks)
      .all<Suggestion & { week: string }>();
    return json({ suggestions: rows.results });
  }

  const rows = await env.DB.prepare('SELECT day, report FROM daily_reports ORDER BY day DESC LIMIT ?1')
    .bind(historyDays(url.searchParams.get('days')))
    .all<{ day: string; report: string }>();
  return json({ days: rows.results.map((r) => ({ day: r.day, report: JSON.parse(r.report) as unknown })) });
}
