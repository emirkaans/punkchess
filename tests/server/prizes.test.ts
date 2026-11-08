// A tournament's prizes (src/achievements/prizes.ts, server/prizes.ts), on Node's own SQLite
// behind a small D1 stand-in, with the real tables.

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { FIRST_TOURNAMENT_MIN_PLAYERS, tournamentPrizes } from '../../src/achievements/prizes.ts';
import { coinBalance } from '../../server/coins.ts';
import { awardTournament } from '../../server/prizes.ts';

function d1(users: string[]): { db: D1Database; raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  raw.exec('CREATE TABLE users (id TEXT PRIMARY KEY)');
  for (const f of ['0003_patches.sql', '0019_coins.sql'])
    raw.exec(readFileSync(new URL(`../../migrations/${f}`, import.meta.url), 'utf8'));
  for (const u of users) raw.prepare('INSERT INTO users (id) VALUES (?)').run(u);
  const prepare = (sql0: string) => {
    const order = [...sql0.matchAll(/\?(\d+)/g)].map((m) => Number(m[1]) - 1);
    const sql = sql0.replace(/\?\d+/g, '?');
    let args: (string | number | null)[] = [];
    const stmt = {
      bind: (...given: (string | number | null)[]) => {
        args = order.map((i) => given[i] ?? null);
        return stmt;
      },
      first: async () => raw.prepare(sql).get(...args) ?? null,
      all: async () => ({ results: raw.prepare(sql).all(...args) }),
      run: async () => ({ meta: { changes: Number(raw.prepare(sql).run(...args).changes) } }),
    };
    return stmt;
  };
  return { db: { prepare } as unknown as D1Database, raw };
}

const patchesOf = (raw: DatabaseSync, u: string) =>
  (
    raw.prepare('SELECT patch_id FROM user_patches WHERE user_id = ? ORDER BY patch_id').all(u) as {
      patch_id: string;
    }[]
  ).map((r) => r.patch_id);

describe('turnuva ödülleri', () => {
  const ranked = [
    { userId: 'a', score: 9, games: 6 },
    { userId: 'b', score: 6, games: 6 },
    { userId: 'c', score: 4, games: 5 },
    { userId: 'd', score: 2, games: 4 },
    { userId: 'e', score: 0, games: 0 },
  ];

  it('ilk üçe kürsü ve 300/200/100, birinciye taç; puansız kürsüye çıkmaz', () => {
    const prizes = tournamentPrizes(ranked, false);
    expect(prizes.map((p) => [p.userId, p.patches, p.coins])).toEqual([
      ['a', ['champion', 'podium'], 300],
      ['b', ['podium'], 200],
      ['c', ['podium'], 100],
    ]);
    expect(tournamentPrizes([{ userId: 'a', score: 0, games: 2 }], false)).toEqual([]);
  });

  it('ilk turnuva yaması: yeterince kişi oynadıysa oynayan herkese, bir kez', async () => {
    const few = ranked.slice(0, FIRST_TOURNAMENT_MIN_PLAYERS - 1);
    expect(tournamentPrizes(few, true).some((p) => p.kind === 'first')).toBe(false);

    const { db, raw } = d1(['a', 'b', 'c', 'd', 'e']);
    const now = Date.UTC(2026, 10, 14, 19);
    await awardTournament(db, 'T1', ranked, now);
    await awardTournament(db, 'T1', ranked, now); // a second run pays nothing more
    expect(patchesOf(raw, 'a')).toEqual(['champion', 'first-tournament', 'podium']);
    expect(patchesOf(raw, 'd')).toEqual(['first-tournament']);
    expect(patchesOf(raw, 'e')).toEqual([]);
    expect((await coinBalance(db, 'a', now)).balance).toBe(320);
    expect((await coinBalance(db, 'd', now)).balance).toBe(20);

    // The next tournament: the podium again, the one-off patch no more.
    await awardTournament(db, 'T2', [ranked[3], ranked[0], ranked[1], ranked[2]], now + 86_400_000);
    expect(patchesOf(raw, 'd')).toEqual(['champion', 'first-tournament', 'podium']);
    expect((await coinBalance(db, 'd', now + 86_400_000)).balance).toBe(320);
    expect((await coinBalance(db, 'c', now + 86_400_000)).balance).toBe(120);
  });
});
