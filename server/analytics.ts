// Site analytics (migrations/0022_analytics.sql, types in src/online/traffic.ts):
//
//   POST /api/hit { page, ref?, ping? }   a page shown (or, with ping, the page still open)
//   GET  /api/admin/traffic?days=1|7|30   staff only: the numbers for the admin page
//
// and every 5 minutes (the Worker's cron) a sample of who is on the site and how many games
// are being played. No cookies; the visitor is a hash of the day, the address and the browser,
// so it is not known from one day to the next.

import { isStaffRole } from '../src/online/admin.ts';
import { dailyDay } from '../src/online/daily.ts';
import type { LiveStats } from '../src/online/lobby.ts';
import { TRAFFIC_RANGES, deviceOf, isBot, isPageKind } from '../src/online/traffic.ts';
import type { Count, TrafficRange, TrafficStats } from '../src/online/traffic.ts';
import { currentUser } from './auth.ts';
import { sha256hex } from './auth-util.ts';
import type { Env } from './game-room.ts';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const MINUTE = 60_000;
const DAY = 86_400_000;
/** On the site: a sign of life in the last 5 minutes. */
const ONLINE_MS = 5 * MINUTE;
const KEEP_MS = 180 * DAY;
// Turkey's hour of day (UTC+3, no summer time) in SQL, from a column holding milliseconds.
const hourOf = (col: string) => `CAST(((${col} / 1000 + 10800) % 86400) / 3600 AS INTEGER)`;

const liveStats = (env: Env): Promise<LiveStats> =>
  env.LOBBY.get(env.LOBBY.idFromName('main'))
    .fetch('https://lobby/stats')
    .then((r) => r.json() as Promise<LiveStats>)
    .catch(() => ({ games: 0, players: 0 }));

const onlineNow = (db: D1Database, now: number) =>
  db
    .prepare('SELECT count(*) AS n FROM presence WHERE at >= ?1')
    .bind(now - ONLINE_MS)
    .first<{ n: number }>()
    .then((r) => r?.n ?? 0);

/** The other site a visit came from: its host, or null for none or this site. */
function referrerHost(ref: unknown, origin: string): string | null {
  if (typeof ref !== 'string' || !ref) return null;
  try {
    const host = new URL(ref).hostname.replace(/^www\./, '');
    return host && host !== new URL(origin).hostname.replace(/^www\./, '') ? host.slice(0, 80) : null;
  } catch {
    return null;
  }
}

/** Every 5 minutes: who is on the site and the games being played; old records are dropped. */
export async function sampleLive(env: Env, now = Date.now()): Promise<void> {
  if (!env.DB) return;
  const [online, live] = await Promise.all([onlineNow(env.DB, now), liveStats(env)]);
  await env.DB.batch([
    env.DB.prepare('INSERT OR REPLACE INTO live_samples (at, online, games) VALUES (?1, ?2, ?3)').bind(
      now - (now % (5 * MINUTE)),
      online,
      live.games,
    ),
    env.DB.prepare('DELETE FROM presence WHERE at < ?1').bind(now - DAY),
    env.DB.prepare('DELETE FROM page_views WHERE at < ?1').bind(now - KEEP_MS),
    env.DB.prepare('DELETE FROM live_samples WHERE at < ?1').bind(now - KEEP_MS),
  ]);
}

async function traffic(env: Env, db: D1Database, days: TrafficRange, now: number): Promise<TrafficStats> {
  const since = now - days * DAY;
  const all = <T>(sql: string) =>
    db
      .prepare(sql)
      .bind(since)
      .all<T>()
      .then((r) => r.results);
  const top = (expr: string, limit: number) =>
    all<Count>(
      `SELECT ${expr} AS name, count(*) AS n FROM page_views WHERE at >= ?1 AND ${expr} IS NOT NULL GROUP BY name ORDER BY n DESC LIMIT ${limit}`,
    );
  const byHour = (rows: { h: number; n: number }[]) => {
    const out = Array.from({ length: 24 }, () => 0);
    for (const r of rows) out[r.h] = r.n;
    return out;
  };
  // A day: every sample; longer: the highest of each hour.
  const liveSql =
    days === 1
      ? 'SELECT at, online, games FROM live_samples WHERE at >= ?1 ORDER BY at'
      : 'SELECT (at / 3600000) * 3600000 AS at, max(online) AS online, max(games) AS games FROM live_samples WHERE at >= ?1 GROUP BY at / 3600000 ORDER BY at';
  const [totals, viewsH, gamesH, daily, live, pages, countries, cities, devices, referrers, online, games] =
    await Promise.all([
      db
        .prepare(
          `SELECT count(*) AS views, (SELECT coalesce(max(online), 0) FROM live_samples WHERE at >= ?1) AS peakOnline,
             (SELECT coalesce(max(games), 0) FROM live_samples WHERE at >= ?1) AS peakGames
           FROM page_views WHERE at >= ?1`,
        )
        .bind(since)
        .first<{ views: number; peakOnline: number; peakGames: number }>(),
      all<{ h: number; n: number }>(
        `SELECT ${hourOf('at')} AS h, count(*) AS n FROM page_views WHERE at >= ?1 GROUP BY h`,
      ),
      all<{ h: number; n: number }>(
        `SELECT ${hourOf('ended_at')} AS h, count(*) AS n FROM games WHERE ended_at >= ?1 GROUP BY h`,
      ),
      all<{ day: string; views: number; visitors: number }>(
        `SELECT date(at / 1000 + 10800, 'unixepoch') AS day, count(*) AS views, count(DISTINCT visitor) AS visitors
         FROM page_views WHERE at >= ?1 GROUP BY day ORDER BY day`,
      ),
      all<{ at: number; online: number; games: number }>(liveSql),
      top('page', 12),
      top('country', 10),
      top(`city || ', ' || coalesce(country, '')`, 10),
      top('device', 3),
      top('referrer', 8),
      onlineNow(db, now),
      liveStats(env).then((s) => s.games),
    ]);
  return {
    days,
    now: { online, games },
    views: totals?.views ?? 0,
    visitors: daily.reduce((sum, d) => sum + d.visitors, 0),
    peakOnline: Math.max(totals?.peakOnline ?? 0, online),
    peakGames: Math.max(totals?.peakGames ?? 0, games),
    viewsByHour: byHour(viewsH),
    gamesByHour: byHour(gamesH),
    daily,
    live,
    pages,
    countries,
    cities,
    devices,
    referrers,
  };
}

/** Answers an analytics request, or returns null when `url` is not one. */
export async function handleAnalytics(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (url.pathname !== '/api/hit' && url.pathname !== '/api/admin/traffic') return null;
  if (!env.DB) return json({ error: 'accounts-off' }, 503);
  const now = Date.now();

  if (url.pathname === '/api/hit' && request.method === 'POST') {
    const ua = request.headers.get('user-agent') ?? '';
    const body = (await request.json().catch(() => ({}))) as { page?: unknown; ref?: unknown; ping?: unknown };
    if (isBot(ua) || !isPageKind(body.page)) return new Response(null, { status: 204 });
    const ip = request.headers.get('cf-connecting-ip') ?? '';
    const visitor = (await sha256hex(`${dailyDay(now)}|${ip}|${ua}`)).slice(0, 16);
    const presence = env.DB.prepare(
      'INSERT INTO presence (visitor, at) VALUES (?1, ?2) ON CONFLICT(visitor) DO UPDATE SET at = excluded.at',
    ).bind(visitor, now);
    if (body.ping === true) {
      await presence.run();
    } else {
      const cf = (request as Request & { cf?: { country?: string; city?: string } }).cf;
      await env.DB.batch([
        presence,
        env.DB.prepare(
          'INSERT INTO page_views (at, page, visitor, country, city, device, referrer) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
        ).bind(
          now,
          body.page,
          visitor,
          cf?.country ?? null,
          cf?.city ?? null,
          deviceOf(ua),
          referrerHost(body.ref, env.PUBLIC_ORIGIN || url.origin),
        ),
      ]);
    }
    return new Response(null, { status: 204 });
  }

  if (url.pathname === '/api/admin/traffic' && request.method === 'GET') {
    const user = await currentUser(request, env).catch(() => null);
    if (!user || !isStaffRole(user.role)) return json({ error: 'forbidden' }, 403);
    const asked = Number(url.searchParams.get('days'));
    const days = TRAFFIC_RANGES.find((d) => d === asked) ?? 7;
    return json(await traffic(env, env.DB, days, now));
  }

  return json({ error: 'not-found' }, 404);
}
