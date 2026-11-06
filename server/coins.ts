// Punk coins (migrations/0019_coins.sql, rules in src/coins/rules.ts): a ledger of what each
// player earned, the balance being its sum. Every entry is unique per (player, reason, ref),
// so a game or a puzzle never pays twice; daily ceilings cut an entry down (or out).
//
//   GET  /api/me/coins   the balance, today's earnings, the latest entries

import { DAILY_COIN_CAP, COIN_RULES, OUTSIDE_CAP, dailyMax } from '../src/coins/rules.ts';
import type { CoinReason, CoinsResponse } from '../src/coins/rules.ts';
import { dailyDay } from '../src/online/daily.ts';
import type { Color } from '../src/engine/index.ts';
import type { AuthEnv } from './auth.ts';
import { currentUser } from './auth.ts';

/** The sources outside the overall ceiling, as an SQL list ('quest'). */
const OUTSIDE_SQL = OUTSIDE_CAP.map((r) => `'${r}'`).join(', ');

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

/**
 * Pays `amount` coins to a player for `reason`/`ref`, cut to what today's ceilings leave.
 * Returns what was paid (0 when nothing is left today, or `ref` was paid before).
 */
export async function grantCoins(
  db: D1Database,
  userId: string,
  reason: CoinReason,
  ref: string,
  amount: number,
  now: number,
): Promise<number> {
  if (amount <= 0) return 0;
  const day = dailyDay(now);
  const row = await db
    .prepare(
      `SELECT coalesce(sum(CASE WHEN reason NOT IN (${OUTSIDE_SQL}) THEN amount END), 0) AS total,
              coalesce(sum(CASE WHEN reason = ?3 THEN amount END), 0) AS mine
       FROM coin_ledger WHERE user_id = ?1 AND day = ?2 AND amount > 0`,
    )
    .bind(userId, day, reason)
    .first<{ total: number; mine: number }>();
  // Quest coins are outside the overall ceiling (and do not count towards it).
  const overall = OUTSIDE_CAP.includes(reason) ? Infinity : DAILY_COIN_CAP - (row?.total ?? 0);
  const pay = Math.min(amount, dailyMax(reason) - (row?.mine ?? 0), overall);
  if (pay <= 0) return 0;
  const res = await db
    .prepare(
      `INSERT OR IGNORE INTO coin_ledger (user_id, amount, reason, ref, day, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
    .bind(userId, pay, reason, ref, day, now)
    .run();
  return res.meta.changes > 0 ? pay : 0;
}

/** A player's coins: the balance and today's earnings. */
export async function coinBalance(
  db: D1Database,
  userId: string,
  now: number,
): Promise<{ balance: number; today: number }> {
  const row = await db
    .prepare(
      `SELECT coalesce(sum(amount), 0) AS balance, coalesce(sum(CASE WHEN day = ?2 AND amount > 0 AND reason NOT IN (${OUTSIDE_SQL}) THEN amount END), 0) AS today
       FROM coin_ledger WHERE user_id = ?1`,
    )
    .bind(userId, dailyDay(now))
    .first<{ balance: number; today: number }>();
  return { balance: row?.balance ?? 0, today: row?.today ?? 0 };
}

/** Coins for a finished online game: its winner's, when signed in (none when too short or capped). */
export async function grantGameCoins(
  db: D1Database,
  gameId: string,
  players: Readonly<Partial<Record<Color, string>>>,
  winner: Color | null,
  plies: number,
  now: number,
): Promise<Partial<Record<Color, number>>> {
  const out: Partial<Record<Color, number>> = {};
  if (plies < COIN_RULES.online.minPlies) return out;
  const id = winner ? players[winner] : undefined;
  if (!winner || !id) return out;
  // Wins paid today against this same opponent (the game rows tell who played whom).
  const other = players[winner === 'w' ? 'b' : 'w'];
  if (other) {
    const pair = await db
      .prepare(
        `SELECT count(*) AS n FROM coin_ledger l JOIN games g ON g.id = l.ref
         WHERE l.user_id = ?1 AND l.reason = 'online' AND l.day = ?2 AND l.ref <> ?4
           AND ((g.white_user = ?1 AND g.black_user = ?3) OR (g.white_user = ?3 AND g.black_user = ?1))`,
      )
      .bind(id, dailyDay(now), other, gameId)
      .first<{ n: number }>();
    if ((pair?.n ?? 0) >= COIN_RULES.online.pairDailyMax) return out;
  }
  const paid = await grantCoins(db, id, 'online', gameId, COIN_RULES.online.win, now);
  if (paid) out[winner] = paid;
  return out;
}

/** Answers a coin request, or returns null when `url` is not one. */
export async function handleCoins(request: Request, env: AuthEnv, url: URL): Promise<Response | null> {
  if (!url.pathname.startsWith('/api/me/coins')) return null;
  if (!env.DB) return json({ error: 'accounts-off' }, 503);
  const now = Date.now();

  if (url.pathname === '/api/me/coins' && request.method === 'GET') {
    const user = await currentUser(request, env);
    if (!user) return json({ error: 'signed-out' }, 401);
    const { balance, today } = await coinBalance(env.DB, user.id, now);
    const rows = await env.DB.prepare(
      'SELECT amount, reason, created_at FROM coin_ledger WHERE user_id = ?1 ORDER BY id DESC LIMIT 20',
    )
      .bind(user.id)
      .all<{ amount: number; reason: CoinsResponse['history'][number]['reason']; created_at: number }>();
    return json({
      balance,
      today,
      cap: DAILY_COIN_CAP,
      history: rows.results.map((r) => ({ amount: r.amount, reason: r.reason, at: r.created_at })),
    } satisfies CoinsResponse);
  }

  return json({ error: 'not-found' }, 404);
}
