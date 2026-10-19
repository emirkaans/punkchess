// Gangs (migrations/0010_gangs.sql) and their wars (0016_gang_wars.sql):
//
//   GET  /api/gangs                         gangs by weekly score, and the signed-in player's gang
//   GET  /api/gangs/:tag                    one gang, its members' weekly points, its wars
//   POST /api/gangs { name, tag }           the signed-in player founds a gang (and is in it)
//   POST /api/gangs/:tag/join               … joins one (one gang at a time)
//   POST /api/gangs/:tag/leave              … leaves it (the founder's role passes on; an empty gang goes)
//   POST /api/gangs/:tag/war { timeControlId }   the founder of an active gang challenges this one
//   POST /api/gangs/:tag/war/:id/(accept|decline|cancel)   … this gang's founder answers (or withdraws)
//
// The weekly score is worked out when asked: the members' online wins and
// draws and daily puzzles solved in the last week. An accepted war is a
// one-round tournament of four boards (server/tournament.ts), which writes
// the result back here when its games are over.

import { timeControl } from '../src/clock/clock.ts';
import { dailyDay } from '../src/online/daily.ts';
import { GANG_SIZE, GANG_WEEK_DAYS, WAR_ANSWER_MS, cleanTag, gangProblem, gangScore } from '../src/online/gang.ts';
import type { GangDetail, GangList, GangMember, GangSummary, GangWar, GangWarStatus } from '../src/online/gang.ts';
import { randomGameId } from '../src/online/record.ts';
import { TOURNAMENT_TIME_CONTROLS, swissEndEstimate } from '../src/online/tournament.ts';
import type { TournamentMeta, WarSetup } from '../src/online/tournament.ts';
import { currentUser, sameOrigin } from './auth.ts';
import type { Env } from './game-room.ts';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

interface MemberRow {
  gang_id: string;
  user_id: string;
  username: string;
  wins: number;
  draws: number;
  dailies: number;
}

/** Every member of the given gangs (all gangs when `gangId` is null) with their week's results. */
async function memberRows(db: D1Database, gangId: string | null): Promise<MemberRow[]> {
  const now = Date.now();
  const since = now - GANG_WEEK_DAYS * 86_400_000;
  const rows = await db
    .prepare(
      `SELECT m.gang_id, m.user_id, u.username,
         (SELECT count(*) FROM games g WHERE g.ended_at >= ?2 AND
            ((g.white_user = m.user_id AND g.result = '1-0') OR (g.black_user = m.user_id AND g.result = '0-1'))) AS wins,
         (SELECT count(*) FROM games g WHERE g.ended_at >= ?2 AND g.result = '1/2-1/2' AND
            (g.white_user = m.user_id OR g.black_user = m.user_id)) AS draws,
         (SELECT count(*) FROM daily_results d WHERE d.user_id = m.user_id AND d.solved = 1 AND d.day >= ?3) AS dailies
       FROM gang_members m JOIN users u ON u.id = m.user_id
       WHERE ?1 IS NULL OR m.gang_id = ?1`,
    )
    .bind(gangId, since, dailyDay(since))
    .all<MemberRow>();
  return rows.results;
}

async function myGang(db: D1Database, userId: string) {
  return db
    .prepare('SELECT g.id, g.tag, g.owner FROM gang_members m JOIN gangs g ON g.id = m.gang_id WHERE m.user_id = ?1')
    .bind(userId)
    .first<{ id: string; tag: string; owner: string }>();
}

const memberCount = async (db: D1Database, gangId: string) =>
  (await db.prepare('SELECT count(*) AS n FROM gang_members WHERE gang_id = ?1').bind(gangId).first<{ n: number }>())
    ?.n ?? 0;

interface WarRow {
  id: string;
  challenger: string;
  defender: string;
  time_control: string;
  status: string;
  created_at: number;
  challenger_score: number | null;
  defender_score: number | null;
  winner: string | null;
  tournament_id: string | null;
  c_tag: string;
  c_name: string;
  d_tag: string;
  d_name: string;
}

const WAR_SELECT = `SELECT w.*, c.tag AS c_tag, c.name AS c_name, d.tag AS d_tag, d.name AS d_name
  FROM gang_wars w JOIN gangs c ON c.id = w.challenger JOIN gangs d ON d.id = w.defender`;

/** A war as shown: a challenge nobody answered in time has expired. */
function warOf(r: WarRow, now: number): GangWar {
  const status: GangWarStatus =
    r.status === 'pending' && now - r.created_at > WAR_ANSWER_MS ? 'expired' : (r.status as GangWarStatus);
  return {
    id: r.id,
    challenger: { tag: r.c_tag, name: r.c_name },
    defender: { tag: r.d_tag, name: r.d_name },
    timeControlId: r.time_control,
    status,
    createdAt: r.created_at,
    score:
      r.challenger_score !== null && r.defender_score !== null ? { c: r.challenger_score, d: r.defender_score } : null,
    winner: r.winner === null ? null : r.winner === r.challenger ? 'c' : 'd',
    tournamentId: r.tournament_id,
  };
}

/** A gang's open war (a challenge waiting for an answer, or one being played), if any. */
async function openWar(db: D1Database, gangId: string, now: number) {
  return db
    .prepare(
      `SELECT id FROM gang_wars WHERE (challenger = ?1 OR defender = ?1)
         AND (status = 'live' OR (status = 'pending' AND created_at > ?2)) LIMIT 1`,
    )
    .bind(gangId, now - WAR_ANSWER_MS)
    .first<{ id: string }>();
}

/** Answers a gang request, or returns null when `url` is not one. */
export async function handleGangs(request: Request, env: Env, url: URL): Promise<Response | null> {
  const m =
    /^\/api\/gangs(?:\/([A-Za-z0-9]{2,4})(?:\/(join|leave|war)(?:\/([A-Za-z0-9-]{8,40})\/(accept|decline|cancel))?)?)?$/.exec(
      url.pathname,
    );
  if (!m) return null;
  if (!env.DB) return json({ error: 'accounts-off' }, 503);
  const db = env.DB;
  const user = await currentUser(request, env).catch(() => null);
  const now = Date.now();

  if (request.method === 'GET' && !m[1]) {
    const [gangs, members] = await Promise.all([
      db.prepare('SELECT id, tag, name FROM gangs').all<{ id: string; tag: string; name: string }>(),
      memberRows(db, null),
    ]);
    const list: GangSummary[] = gangs.results
      .map((g) => {
        const own = members.filter((r) => r.gang_id === g.id);
        return {
          tag: g.tag,
          name: g.name,
          members: own.length,
          active: own.length >= GANG_SIZE,
          score: own.length >= GANG_SIZE ? own.reduce((s, r) => s + gangScore(r.wins, r.draws, r.dailies), 0) : 0,
        };
      })
      // Active gangs by score first; then the ones forming, the nearest to full first.
      .sort(
        (a, b) =>
          Number(b.active) - Number(a.active) ||
          b.score - a.score ||
          b.members - a.members ||
          a.tag.localeCompare(b.tag),
      )
      .slice(0, 100);
    const own = user ? await myGang(db, user.id) : null;
    return json({
      gangs: list,
      mine: own?.tag ?? null,
      mineOwner: !!own && own.owner === user?.id,
      mineActive: !!own && members.filter((r) => r.gang_id === own.id).length >= GANG_SIZE,
    } satisfies GangList);
  }

  if (request.method === 'GET' && m[1] && !m[2]) {
    const g = await db
      .prepare('SELECT id, tag, name, owner, created_at FROM gangs WHERE tag = ?1')
      .bind(cleanTag(m[1]))
      .first<{ id: string; tag: string; name: string; owner: string; created_at: number }>();
    if (!g) return json({ error: 'not-found' }, 404);
    const rows = await memberRows(db, g.id);
    const list: GangMember[] = rows
      .map((r) => ({
        username: r.username,
        score: gangScore(r.wins, r.draws, r.dailies),
        owner: r.user_id === g.owner,
      }))
      .sort((a, b) => b.score - a.score || a.username.localeCompare(b.username));
    const [wars, record] = await Promise.all([
      db
        .prepare(`${WAR_SELECT} WHERE w.challenger = ?1 OR w.defender = ?1 ORDER BY w.created_at DESC LIMIT 8`)
        .bind(g.id)
        .all<WarRow>(),
      db
        .prepare(
          `SELECT sum(winner = ?1) AS won, sum(winner IS NOT NULL AND winner != ?1) AS lost, sum(winner IS NULL) AS drawn
           FROM gang_wars WHERE status = 'finished' AND (challenger = ?1 OR defender = ?1)`,
        )
        .bind(g.id)
        .first<{ won: number | null; lost: number | null; drawn: number | null }>(),
    ]);
    return json({
      tag: g.tag,
      name: g.name,
      members: list.length,
      active: list.length >= GANG_SIZE,
      score: list.reduce((s, x) => s + x.score, 0),
      createdAt: g.created_at,
      list,
      wars: wars.results.map((w) => warOf(w, now)),
      record: { won: record?.won ?? 0, lost: record?.lost ?? 0, drawn: record?.drawn ?? 0 },
    } satisfies GangDetail);
  }

  if (request.method !== 'POST') return json({ error: 'not-found' }, 404);
  if (!sameOrigin(request, env.PUBLIC_ORIGIN || url.origin, url)) return json({ error: 'forbidden' }, 403);
  if (!user) return json({ error: 'signed-out' }, 401);
  const current = await myGang(db, user.id);

  if (!m[1]) {
    const body = (await request.json().catch(() => ({}))) as { name?: unknown; tag?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const tag = typeof body.tag === 'string' ? cleanTag(body.tag) : '';
    const problem = gangProblem(name, tag);
    if (problem) return json({ error: problem }, 400);
    if (current) return json({ error: 'in-gang' }, 409);
    const taken = await db.prepare('SELECT 1 FROM gangs WHERE name = ?1 OR tag = ?2').bind(name, tag).first();
    if (taken) return json({ error: 'taken' }, 409);
    const id = crypto.randomUUID();
    await db.batch([
      db
        .prepare('INSERT INTO gangs (id, name, tag, owner, created_at) VALUES (?1, ?2, ?3, ?4, ?5)')
        .bind(id, name, tag, user.id, now),
      db.prepare('INSERT INTO gang_members (user_id, gang_id, joined_at) VALUES (?1, ?2, ?3)').bind(user.id, id, now),
    ]);
    return json({ tag });
  }

  const g = await db
    .prepare('SELECT id, tag, name, owner FROM gangs WHERE tag = ?1')
    .bind(cleanTag(m[1]))
    .first<{ id: string; tag: string; name: string; owner: string }>();
  if (!g) return json({ error: 'not-found' }, 404);

  if (m[2] === 'war' && !m[3]) {
    // My gang (its founder, both gangs full) challenges this one.
    if (!current || current.owner !== user.id) return json({ error: 'not-founder' }, 403);
    if (current.id === g.id) return json({ error: 'bad-request' }, 400);
    const body = (await request.json().catch(() => ({}))) as { timeControlId?: unknown };
    const tc = String(body.timeControlId ?? '');
    if (!TOURNAMENT_TIME_CONTROLS.includes(tc)) return json({ error: 'bad-request' }, 400);
    if ((await memberCount(db, current.id)) < GANG_SIZE || (await memberCount(db, g.id)) < GANG_SIZE) {
      return json({ error: 'not-active' }, 409);
    }
    if ((await openWar(db, current.id, now)) || (await openWar(db, g.id, now))) return json({ error: 'busy' }, 409);
    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO gang_wars (id, challenger, defender, time_control, status, created_at)
         VALUES (?1, ?2, ?3, ?4, 'pending', ?5)`,
      )
      .bind(id, current.id, g.id, tc, now)
      .run();
    return json({ id });
  }

  if (m[2] === 'war' && m[3]) {
    const war = await db
      .prepare(`${WAR_SELECT} WHERE w.id = ?1 AND (w.challenger = ?2 OR w.defender = ?2)`)
      .bind(m[3], g.id)
      .first<WarRow>();
    if (!war) return json({ error: 'not-found' }, 404);
    if (warOf(war, now).status !== 'pending') return json({ error: 'over' }, 409);
    const action = m[4];
    // The defending founder accepts or declines; the challenging founder may withdraw.
    const side = action === 'cancel' ? war.challenger : war.defender;
    const sideGang = await db.prepare('SELECT owner FROM gangs WHERE id = ?1').bind(side).first<{ owner: string }>();
    if (sideGang?.owner !== user.id) return json({ error: 'not-founder' }, 403);
    if (action !== 'accept') {
      await db
        .prepare('UPDATE gang_wars SET status = ?1 WHERE id = ?2')
        .bind(action === 'cancel' ? 'cancelled' : 'declined', war.id)
        .run();
      return json({ ok: true });
    }
    return startWar(env, war, user.username, now);
  }

  if (m[2] === 'join') {
    if (current) return json({ error: current.id === g.id ? 'ok' : 'in-gang' }, current.id === g.id ? 200 : 409);
    if ((await memberCount(db, g.id)) >= GANG_SIZE) return json({ error: 'full' }, 409);
    await db
      .prepare('INSERT INTO gang_members (user_id, gang_id, joined_at) VALUES (?1, ?2, ?3)')
      .bind(user.id, g.id, now)
      .run();
    return json({ tag: g.tag });
  }

  // Leave: the founder's role goes to the longest-standing member; the last one out closes the gang.
  if (!current || current.id !== g.id) return json({ ok: true });
  await db.prepare('DELETE FROM gang_members WHERE user_id = ?1').bind(user.id).run();
  const next = await db
    .prepare('SELECT user_id FROM gang_members WHERE gang_id = ?1 ORDER BY joined_at LIMIT 1')
    .bind(g.id)
    .first<{ user_id: string }>();
  if (!next) await db.prepare('DELETE FROM gangs WHERE id = ?1').bind(g.id).run();
  else if (g.owner === user.id)
    await db.prepare('UPDATE gangs SET owner = ?1 WHERE id = ?2').bind(next.user_id, g.id).run();
  return json({ ok: true });
}

/**
 * An accepted war: the members of each gang, best of the week first, meet
 * board by board (the challengers White on boards 1 and 3), all at once.
 */
async function startWar(env: Env, war: WarRow, acceptedBy: string, now: number): Promise<Response> {
  const db = env.DB;
  const [cRows, dRows] = await Promise.all([memberRows(db, war.challenger), memberRows(db, war.defender)]);
  if (cRows.length < GANG_SIZE || dRows.length < GANG_SIZE) return json({ error: 'not-active' }, 409);
  const live = await db
    .prepare(
      `SELECT 1 FROM gang_wars WHERE status = 'live' AND id != ?1 AND
         (challenger IN (?2, ?3) OR defender IN (?2, ?3))`,
    )
    .bind(war.id, war.challenger, war.defender)
    .first();
  if (live) return json({ error: 'busy' }, 409);
  const ranked = (rows: MemberRow[]) =>
    [...rows]
      .sort(
        (a, b) =>
          gangScore(b.wins, b.draws, b.dailies) - gangScore(a.wins, a.draws, a.dailies) ||
          a.username.localeCompare(b.username),
      )
      .slice(0, GANG_SIZE);
  const c = ranked(cRows);
  const d = ranked(dRows);
  const pairs = c.map((p, i): [string, string] =>
    i % 2 === 0 ? [p.user_id, d[i].user_id] : [d[i].user_id, p.user_id],
  );
  const setup: WarSetup = {
    warId: war.id,
    pairs,
    players: [
      ...c.map((p) => ({ id: p.user_id, username: p.username, side: 'c' as const })),
      ...d.map((p) => ({ id: p.user_id, username: p.username, side: 'd' as const })),
    ],
    tags: { c: war.c_tag, d: war.d_tag },
  };
  const tc = timeControl(war.time_control);
  const id = randomGameId();
  const meta: TournamentMeta = {
    id,
    name: `[${war.c_tag}] vs [${war.d_tag}]`,
    variantId: 'standard',
    timeControlId: war.time_control,
    rated: true,
    startsAt: now,
    endsAt: swissEndEstimate(now, 1, tc.initialMs ?? 0, tc.incrementMs),
    createdBy: acceptedBy,
    format: 'war',
    rounds: 1,
    war: setup,
  };
  const res = await env.TOURNAMENT.get(env.TOURNAMENT.idFromName(id)).fetch('https://tournament/init', {
    method: 'POST',
    body: JSON.stringify(meta),
  });
  if (!res.ok) return json({ error: 'bad-request' }, 500);
  await db
    .prepare("UPDATE gang_wars SET status = 'live', started_at = ?1, tournament_id = ?2 WHERE id = ?3")
    .bind(now, id, war.id)
    .run();
  return json({ tournamentId: id });
}
