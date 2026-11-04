// The daily report for the reporting routines (scheduled Claude agents), which read it and
// send the owner a summary:
//
//   GET /api/report/daily              the last 24 hours, now
//   GET /api/report/history?days=7     the reports kept at 23:00 on the days before, newest first
//
// both with Authorization: Bearer <REPORT_KEY>; and from 23:00 Turkey time the Worker's cron
// keeps the day's report (migrations/0025_daily_reports.sql). Only totals and public names
// (usernames, page kinds, countries), never emails or messages. Without REPORT_KEY
// (wrangler secret put REPORT_KEY) the endpoints do not exist.

import { dailyDay } from '../src/online/daily.ts';
import { historyDays, reportDue } from '../src/online/report.ts';
import { traffic } from './analytics.ts';
import { keyMatches } from './auth-util.ts';
import type { Env } from './game-room.ts';

const DAY = 86_400_000;

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
  if ((url.pathname !== '/api/report/daily' && url.pathname !== '/api/report/history') || !env.REPORT_KEY) {
    return null;
  }
  if (request.method !== 'GET') return new Response(null, { status: 405 });
  if (!(await keyMatches(request.headers.get('authorization'), env.REPORT_KEY))) {
    return json({ error: 'forbidden' }, 403);
  }
  if (!env.DB) return json({ error: 'accounts-off' }, 503);
  const now = Date.now();

  if (url.pathname === '/api/report/daily') return json(await dailyReport(env, env.DB, now));

  const rows = await env.DB.prepare('SELECT day, report FROM daily_reports ORDER BY day DESC LIMIT ?1')
    .bind(historyDays(url.searchParams.get('days')))
    .all<{ day: string; report: string }>();
  return json({ days: rows.results.map((r) => ({ day: r.day, report: JSON.parse(r.report) as unknown })) });
}
