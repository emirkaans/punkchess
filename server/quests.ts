// Daily quests (migrations/0027_quests.sql, rules in src/quests/rules.ts): the day's three quests
// of a player, their progress, and the coins they pay. Online games, puzzles, the daily puzzle and
// Puzzle Rush report what happened (recordQuest); each quest pays once, through the coin ledger.
//
//   GET  /api/me/quests        today's quests, the streak
//   POST /api/me/quests/swap   { slot } changes one of today's unfinished quests (once a day)

import { nextDailyAt, dailyDay } from '../src/online/daily.ts';
import {
  ALL_DONE_COINS,
  QUEST_COINS,
  STREAK_COINS,
  STREAK_DAYS,
  advance,
  questsOf,
  streakOf,
} from '../src/quests/rules.ts';
import type { Quest, QuestEvent, QuestsResponse } from '../src/quests/rules.ts';
import type { AuthEnv } from './auth.ts';
import { currentUser, sameOrigin } from './auth.ts';
import { grantCoins } from './coins.ts';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

interface Row {
  readonly swapped: number;
  readonly progress: string;
  readonly complete: number;
}

const parseProgress = (text: string) => text.split(',').map((n) => Math.max(0, Number(n) || 0));

/** Today's row of a player, made when missing. */
async function today(db: D1Database, userId: string, day: string): Promise<Row> {
  await db.prepare('INSERT OR IGNORE INTO quest_days (user_id, day) VALUES (?1, ?2)').bind(userId, day).run();
  const row = await db
    .prepare('SELECT swapped, progress, complete FROM quest_days WHERE user_id = ?1 AND day = ?2')
    .bind(userId, day)
    .first<Row>();
  return row ?? { swapped: -1, progress: '0,0,0', complete: 0 };
}

/** Days in a row with all three done, up to today. */
async function streak(db: D1Database, userId: string, day: string): Promise<number> {
  const rows = await db
    .prepare('SELECT day FROM quest_days WHERE user_id = ?1 AND complete = 1 ORDER BY day DESC LIMIT 400')
    .bind(userId)
    .all<{ day: string }>();
  return streakOf(
    rows.results.map((r) => r.day),
    day,
  );
}

async function response(db: D1Database, userId: string, now: number): Promise<QuestsResponse> {
  const day = dailyDay(now);
  let row = await today(db, userId, day);
  const quests = questsOf(userId, day, row.swapped);
  const progress = parseProgress(row.progress);
  // Anything done but not paid (see settle) is paid now.
  if (
    quests.some((q, i) => (progress[i] ?? 0) >= q.target) &&
    (await settle(db, userId, day, quests, progress, now)) > 0
  )
    row = await today(db, userId, day);
  return {
    day,
    nextAt: nextDailyAt(now),
    quests: quests.map((q, i) => ({
      id: q.id,
      tier: q.tier,
      target: q.target,
      progress: Math.min(q.target, progress[i] ?? 0),
      coins: QUEST_COINS[q.tier],
    })),
    swapped: row.swapped >= 0,
    allDone: row.complete === 1,
    streak: await streak(db, userId, day),
  };
}

/**
 * Counts `e` towards a player's quests of today; a quest that gets done pays its coins, all three
 * the bonus, and every seventh day of a streak the streak's gift. Returns the coins paid.
 */
export async function recordQuest(db: D1Database, userId: string, e: QuestEvent, now: number): Promise<number> {
  const day = dailyDay(now);
  const row = await today(db, userId, day);
  const quests = questsOf(userId, day, row.swapped);
  const before = parseProgress(row.progress);
  const after = advance(quests, before, e);
  if (after.every((n, i) => n === (before[i] ?? 0))) return 0;
  await db
    .prepare('UPDATE quest_days SET progress = ?3 WHERE user_id = ?1 AND day = ?2')
    .bind(userId, day, after.join(','))
    .run();
  return settle(db, userId, day, quests, after, now);
}

/**
 * Pays what the day's progress has earned and is not paid yet: each quest done, the bonus for all
 * three, the streak's gift. Every payment has its own ledger ref, so paying again pays nothing;
 * a payment lost on the way (the Worker stopped after the progress was saved) is made the next
 * time the quests are read or move on.
 */
async function settle(
  db: D1Database,
  userId: string,
  day: string,
  quests: readonly Quest[],
  progress: readonly number[],
  now: number,
): Promise<number> {
  let paid = 0;
  for (let i = 0; i < quests.length; i++) {
    if ((progress[i] ?? 0) >= quests[i].target)
      paid += await grantCoins(db, userId, 'quest', `${day}:${i}`, QUEST_COINS[quests[i].tier], now);
  }
  if (!quests.every((q, i) => (progress[i] ?? 0) >= q.target)) return paid;
  await db
    .prepare('UPDATE quest_days SET complete = 1 WHERE user_id = ?1 AND day = ?2 AND complete = 0')
    .bind(userId, day)
    .run();
  paid += await grantCoins(db, userId, 'quest', `${day}:all`, ALL_DONE_COINS, now);
  if ((await streak(db, userId, day)) % STREAK_DAYS === 0)
    paid += await grantCoins(db, userId, 'quest', `${day}:streak`, STREAK_COINS, now);
  return paid;
}

/** recordQuest that never fails what it is called from (a game's record, a puzzle's answer). */
export const recordQuestSafe = (db: D1Database, userId: string, e: QuestEvent, now: number) =>
  recordQuest(db, userId, e, now).catch((err) => {
    console.error('quest progress failed', err);
    return 0;
  });

/** Answers a quests request, or returns null when `url` is not one. */
export async function handleQuests(request: Request, env: AuthEnv, url: URL): Promise<Response | null> {
  if (!url.pathname.startsWith('/api/me/quests')) return null;
  if (!env.DB) return json({ error: 'accounts-off' }, 503);
  const now = Date.now();
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'signed-out' }, 401);

  if (url.pathname === '/api/me/quests' && request.method === 'GET') {
    return json(await response(env.DB, user.id, now));
  }

  if (url.pathname === '/api/me/quests/swap' && request.method === 'POST') {
    if (!sameOrigin(request, env.PUBLIC_ORIGIN || url.origin, url)) return json({ error: 'forbidden' }, 403);
    const body = (await request.json().catch(() => ({}))) as { slot?: unknown };
    const slot = typeof body.slot === 'number' && Number.isInteger(body.slot) ? body.slot : -1;
    if (slot < 0 || slot > 2) return json({ error: 'bad-request' }, 400);
    const day = dailyDay(now);
    const row = await today(env.DB, user.id, day);
    const quests = questsOf(user.id, day, row.swapped);
    const progress = parseProgress(row.progress);
    // Once a day, and not a quest already done; the new one starts from nothing.
    if (row.swapped >= 0 || (progress[slot] ?? 0) >= quests[slot].target) return json({ error: 'used' }, 409);
    progress[slot] = 0;
    await env.DB.prepare(
      'UPDATE quest_days SET swapped = ?3, progress = ?4 WHERE user_id = ?1 AND day = ?2 AND swapped = -1',
    )
      .bind(user.id, day, slot, progress.join(','))
      .run();
    return json(await response(env.DB, user.id, now));
  }

  return json({ error: 'not-found' }, 404);
}
