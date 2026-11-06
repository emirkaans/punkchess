// Daily quests on the server (server/quests.ts, server/coins.ts), on Node's own SQLite behind a
// small D1 stand-in, with the real tables (migrations).

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { QuestEvent } from '../../src/quests/rules.ts';
import { coinBalance, grantCoins } from '../../server/coins.ts';
import { recordQuest } from '../../server/quests.ts';

/** A D1 database on SQLite: just what these modules use. */
function d1(): D1Database {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE users (id TEXT PRIMARY KEY)');
  for (const f of ['0019_coins.sql', '0027_quests.sql'])
    db.exec(readFileSync(new URL(`../../migrations/${f}`, import.meta.url), 'utf8'));
  db.exec("INSERT INTO users (id) VALUES ('u1')");
  const prepare = (raw: string) => {
    // D1 numbers its parameters ?1, ?2…; node:sqlite binds plain ?s in order, so each ?N becomes
    // a ? and gets the Nth value.
    const order = [...raw.matchAll(/\?(\d+)/g)].map((m) => Number(m[1]) - 1);
    const sql = raw.replace(/\?\d+/g, '?');
    let args: (string | number | null)[] = [];
    const stmt = {
      bind: (...given: (string | number | null)[]) => {
        args = order.map((i) => given[i] ?? null);
        return stmt;
      },
      first: async () => db.prepare(sql).get(...args) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...args) }),
      run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...args).changes) } }),
    };
    return stmt;
  };
  return { prepare } as unknown as D1Database;
}

/** Everything any quest could want: played often enough, it finishes all three. */
const EVERYTHING: QuestEvent[] = [
  {
    k: 'game',
    finished: true,
    won: true,
    color: 'b',
    variantId: 'anarsi',
    checkmate: true,
    tournament: true,
    card: true,
    beatHigher: true,
  },
  { k: 'puzzle' },
  { k: 'daily' },
  { k: 'rush', score: 40 },
];

async function doAll(db: D1Database, at: number): Promise<number> {
  let paid = 0;
  for (let round = 0; round < 8; round++) for (const e of EVERYTHING) paid += await recordQuest(db, 'u1', e, at);
  return paid;
}

describe('günlük görevler: sunucu', () => {
  const now = Date.UTC(2026, 10, 7, 12);

  it("biten görev bir kez öder; üçü bitince bonus; görev coin'leri günlük 100 sınırının dışında", async () => {
    const db = d1();
    // The day's ceiling already reached by other coins.
    await grantCoins(db, 'u1', 'online', 'g1', 80, now);
    await grantCoins(db, 'u1', 'puzzle', 'p1', 20, now);
    expect(await grantCoins(db, 'u1', 'rush', 'r1', 5, now)).toBe(0);
    const paid = await doAll(db, now);
    expect(paid).toBe(10 + 20 + 30 + 20);
    // Nothing pays twice.
    for (const e of EVERYTHING) expect(await recordQuest(db, 'u1', e, now)).toBe(0);
    const { balance, today } = await coinBalance(db, 'u1', now);
    expect(balance).toBe(100 + paid);
    // Today's capped earnings leave the quests out.
    expect(today).toBe(100);
  });

  it('serinin 7. günü hediye', async () => {
    const db = d1();
    const paidOn: number[] = [];
    for (let d = 0; d < 7; d++) paidOn.push(await doAll(db, now + d * 86_400_000));
    expect(paidOn.slice(0, 6)).toEqual([80, 80, 80, 80, 80, 80]);
    expect(paidOn[6]).toBe(180);
  });
});
