// Punk coins (migrations/0019_coins.sql, rules in src/coins/rules.ts): a ledger of what each
// player earned, the balance being its sum. Every entry is unique per (player, reason, ref),
// so a game or a puzzle never pays twice; daily ceilings cut an entry down (or out).
//
//   GET  /api/me/coins                               the balance, today's earnings, the latest entries
//   POST /api/me/coins/bot { variantId, startFen, moves, color, level }
//                                                    a won game against the bot: replayed, then paid

import { DAILY_COIN_CAP, botWinCoins, COIN_RULES, dailyMax } from '../src/coins/rules.ts';
import { wonBotGame } from '../src/coins/botGame.ts';
import type { CoinReason, CoinsResponse } from '../src/coins/rules.ts';
import { dailyDay } from '../src/online/daily.ts';
import type { Color } from '../src/engine/index.ts';
import type { AuthEnv } from './auth.ts';
import { currentUser, sameOrigin } from './auth.ts';
import { sha256hex } from './auth-util.ts';

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
      `SELECT coalesce(sum(amount), 0) AS total, coalesce(sum(CASE WHEN reason = ?3 THEN amount END), 0) AS mine
       FROM coin_ledger WHERE user_id = ?1 AND day = ?2 AND amount > 0`,
    )
    .bind(userId, day, reason)
    .first<{ total: number; mine: number }>();
  const pay = Math.min(amount, dailyMax(reason) - (row?.mine ?? 0), DAILY_COIN_CAP - (row?.total ?? 0));
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
      `SELECT coalesce(sum(amount), 0) AS balance, coalesce(sum(CASE WHEN day = ?2 AND amount > 0 THEN amount END), 0) AS today
       FROM coin_ledger WHERE user_id = ?1`,
    )
    .bind(userId, dailyDay(now))
    .first<{ balance: number; today: number }>();
  return { balance: row?.balance ?? 0, today: row?.today ?? 0 };
}

/** Coins for a finished online game, for each signed-in player (0 when too short or capped). */
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
  for (const c of ['w', 'b'] as const) {
    const id = players[c];
    if (!id) continue;
    const amount = COIN_RULES.online.play + (winner === c ? COIN_RULES.online.win : 0);
    const paid = await grantCoins(db, id, 'online', gameId, amount, now);
    if (paid) out[c] = paid;
  }
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
      .all<{ amount: number; reason: CoinReason; created_at: number }>();
    return json({
      balance,
      today,
      cap: DAILY_COIN_CAP,
      history: rows.results.map((r) => ({ amount: r.amount, reason: r.reason, at: r.created_at })),
    } satisfies CoinsResponse);
  }

  if (url.pathname === '/api/me/coins/bot' && request.method === 'POST') {
    if (!sameOrigin(request, env.PUBLIC_ORIGIN || url.origin, url)) return json({ error: 'forbidden' }, 403);
    const user = await currentUser(request, env);
    if (!user) return json({ error: 'signed-out' }, 401);
    const body = (await request.json().catch(() => ({}))) as {
      variantId?: unknown;
      startFen?: unknown;
      moves?: unknown;
      color?: unknown;
      level?: unknown;
    };
    if (!wonBotGame(body)) return json({ error: 'bad-request' }, 400);
    const level = typeof body.level === 'number' ? body.level : 1;
    // The same game (start and moves) pays once.
    const ref = (await sha256hex(`${body.variantId}|${body.startFen}|${(body.moves as string[]).join(' ')}`)).slice(
      0,
      32,
    );
    const coins = await grantCoins(env.DB, user.id, 'bot', ref, botWinCoins(level), now);
    return json({ coins, ...(await coinBalance(env.DB, user.id, now)) });
  }

  return json({ error: 'not-found' }, 404);
}
