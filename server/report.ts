// The daily report for the reporting routine (a scheduled Claude agent), which reads it and
// sends the owner a summary:
//
//   GET /api/report/daily   Authorization: Bearer <REPORT_KEY>
//
// Only totals and public names (usernames, page kinds, countries), never emails or messages.
// Without REPORT_KEY (wrangler secret put REPORT_KEY) the endpoint does not exist.

import { traffic } from './analytics.ts';
import { keyMatches } from './auth-util.ts';
import type { Env } from './game-room.ts';

const DAY = 86_400_000;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

/** Answers the report request, or returns null when `url` is not it. */
export async function handleReport(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (url.pathname !== '/api/report/daily' || !env.REPORT_KEY) return null;
  if (request.method !== 'GET') return new Response(null, { status: 405 });
  if (!(await keyMatches(request.headers.get('authorization'), env.REPORT_KEY))) {
    return json({ error: 'forbidden' }, 403);
  }
  if (!env.DB) return json({ error: 'accounts-off' }, 503);
  const db = env.DB;
  const now = Date.now();
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

  return json({
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
  });
}
