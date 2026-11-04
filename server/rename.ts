// Changing one's username (migrations/0023_username_history.sql, rules in src/online/rename.ts):
//
//   GET  /api/me/username               what the next change costs and when it is allowed
//   POST /api/me/username { username }  changes it (paying punk coins after the first change)
//
// A change of capitals only is free and not limited. A paid change is one entry of −price in the
// coin ledger (reason 'rename'), written in one batch with the new name, and only when the
// balance covers it. Two requests at once make one change: each is only written while the
// player's changes are still what they were when it was priced.

import { usernameProblem } from '../src/online/account.ts';
import { isStaffRole } from '../src/online/admin.ts';
import { dailyDay } from '../src/online/daily.ts';
import { RENAME_RULES, nextRenameAt, renameCost, sameName } from '../src/online/rename.ts';
import type { RenameInfo } from '../src/online/rename.ts';
import type { AuthEnv } from './auth.ts';
import { currentUser, sameOrigin, usernameTaken } from './auth.ts';
import { coinBalance } from './coins.ts';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

/** SQL true while user ?1 still has ?2 real changes: a change made meanwhile (a second request) fails it. */
const UNCHANGED = `(SELECT count(*) FROM username_history
  WHERE user_id = ?1 AND lower(old_name) <> lower(new_name) AND by_staff IS NULL) = ?2`;

/** A player's real changes (not capitals only): how many, and the latest's time. */
async function changes(db: D1Database, userId: string): Promise<{ count: number; lastAt: number | null }> {
  const row = await db
    .prepare(
      `SELECT count(*) AS n, max(changed_at) AS last FROM username_history
       WHERE user_id = ?1 AND lower(old_name) <> lower(new_name) AND by_staff IS NULL`,
    )
    .bind(userId)
    .first<{ n: number; last: number | null }>();
  return { count: row?.n ?? 0, lastAt: row?.last ?? null };
}

/** The account now called what `old` was called (in the last 90 days), for old profile links. */
export async function renamedTo(db: D1Database, old: string, now = Date.now()): Promise<string | null> {
  const row = await db
    .prepare(
      `SELECT u.username FROM username_history h JOIN users u ON u.id = h.user_id
       WHERE h.old_name = ?1 AND h.changed_at >= ?2 AND u.banned_at IS NULL
       ORDER BY h.changed_at DESC LIMIT 1`,
    )
    .bind(old, now - RENAME_RULES.redirectMs)
    .first<{ username: string }>();
  return row?.username ?? null;
}

/** Answers a username change request, or returns null when `url` is not one. */
export async function handleRename(request: Request, env: AuthEnv, url: URL): Promise<Response | null> {
  if (url.pathname !== '/api/me/username') return null;
  if (!env.DB) return json({ error: 'accounts-off' }, 503);
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'signed-out' }, 401);
  const now = Date.now();
  // Staff change their own name freely (no coins, no 30 days); it is logged as theirs.
  const staff = isStaffRole(user.role) ? user.username : null;
  const before = staff ? { count: 0, lastAt: null } : await changes(env.DB, user.id);
  const nextAt = nextRenameAt(before.lastAt);
  const waiting = nextAt !== null && nextAt > now;

  if (request.method === 'GET') {
    const { balance } = await coinBalance(env.DB, user.id, now);
    return json({
      username: user.username,
      cost: renameCost(before.count),
      nextAt: waiting ? nextAt : null,
      balance,
      staff: staff !== null,
    } satisfies RenameInfo);
  }

  if (request.method !== 'POST') return json({ error: 'not-found' }, 404);
  if (!sameOrigin(request, env.PUBLIC_ORIGIN || url.origin, url)) return json({ error: 'forbidden' }, 403);
  const body = (await request.json().catch(() => ({}))) as { username?: unknown };
  const name = typeof body.username === 'string' ? body.username.trim() : '';
  if (name === user.username) return json({ error: 'same' }, 400);
  const problem = usernameProblem(name);
  if (problem) return json({ error: problem }, 400);
  const history = env.DB.prepare(
    'INSERT INTO username_history (user_id, old_name, new_name, changed_at, paid, by_staff) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
  );

  // Capitals only: free, any time.
  if (sameName(name, user.username)) {
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET username = ?1 WHERE id = ?2').bind(name, user.id),
      history.bind(user.id, user.username, name, now, 0, staff),
    ]);
    return json({ username: name });
  }

  if (waiting) return json({ error: 'too-soon', nextAt }, 429);
  if (await usernameTaken(env, name, user.id)) return json({ error: 'taken' }, 409);
  const cost = renameCost(before.count);
  if (cost === 0) {
    // Only while no other change was made since `before` (staff: always); the history with it.
    try {
      await env.DB.batch([
        env.DB.prepare(`UPDATE users SET username = ?3 WHERE id = ?1 AND (?4 IS NOT NULL OR ${UNCHANGED})`).bind(
          user.id,
          before.count,
          name,
          staff,
        ),
        env.DB.prepare(
          `INSERT INTO username_history (user_id, old_name, new_name, changed_at, paid, by_staff)
           SELECT ?1, ?2, ?3, ?4, 0, ?5 WHERE (SELECT username FROM users WHERE id = ?1) = ?3
             AND NOT EXISTS (SELECT 1 FROM username_history WHERE user_id = ?1 AND new_name = ?3 AND changed_at >= ?4 - 60000)`,
        ).bind(user.id, user.username, name, now, staff),
      ]);
    } catch {
      return json({ error: 'taken' }, 409);
    }
    const row = await env.DB.prepare('SELECT username FROM users WHERE id = ?1')
      .bind(user.id)
      .first<{ username: string }>();
    if (row?.username !== name) {
      return json({ error: 'too-soon', nextAt: nextRenameAt((await changes(env.DB, user.id)).lastAt) }, 429);
    }
    return json({ username: name });
  }
  // Paid: the charge only when the balance covers it; the name and the history only with it.
  const ref = `${name.toLowerCase()}-${now}`;
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO coin_ledger (user_id, amount, reason, ref, day, created_at)
         SELECT ?1, -?3, 'rename', ?4, ?5, ?6
         WHERE (SELECT coalesce(sum(amount), 0) FROM coin_ledger WHERE user_id = ?1) >= ?3 AND ${UNCHANGED}`,
      ).bind(user.id, before.count, cost, ref, dailyDay(now), now),
      env.DB.prepare(
        `UPDATE users SET username = ?1 WHERE id = ?2
         AND EXISTS (SELECT 1 FROM coin_ledger WHERE user_id = ?2 AND reason = 'rename' AND ref = ?3)`,
      ).bind(name, user.id, ref),
      env.DB.prepare(
        `INSERT INTO username_history (user_id, old_name, new_name, changed_at, paid)
         SELECT ?1, ?2, ?3, ?4, ?5
         WHERE EXISTS (SELECT 1 FROM coin_ledger WHERE user_id = ?1 AND reason = 'rename' AND ref = ?6)`,
      ).bind(user.id, user.username, name, now, cost, ref),
    ]);
  } catch {
    // The name was taken a moment ago (users.username is unique): nothing was written.
    return json({ error: 'taken' }, 409);
  }
  const paid = await env.DB.prepare("SELECT 1 FROM coin_ledger WHERE user_id = ?1 AND reason = 'rename' AND ref = ?2")
    .bind(user.id, ref)
    .first();
  if (!paid) {
    // Not charged: another change was made meanwhile, or the balance does not cover it.
    const after = await changes(env.DB, user.id);
    if (after.count !== before.count) return json({ error: 'too-soon', nextAt: nextRenameAt(after.lastAt) }, 429);
    return json({ error: 'not-enough' }, 409);
  }
  return json({ username: name });
}
