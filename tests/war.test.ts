import { describe, expect, it } from 'vitest';
import {
  ARMAGEDDON_BLACK_SHARE,
  armageddonClock,
  nextPlayoffGame,
  playoffPlayers,
  playoffWinner,
  warPairs,
  warRounds,
  warWinner,
} from '../src/online/tournament.ts';
import type { PlayoffGame, SheetEntry, WarSetup } from '../src/online/tournament.ts';

const setup = (n: number): Pick<WarSetup, 'players'> => ({
  players: [
    ...Array.from({ length: n }, (_, i) => ({ id: `c${i}`, username: `C${i}`, side: 'c' as const })),
    ...Array.from({ length: n }, (_, i) => ({ id: `d${i}`, username: `D${i}`, side: 'd' as const })),
  ],
});

const sheet = (...rs: SheetEntry['r'][]): SheetEntry[] =>
  rs.map((r, i) => ({ gameId: `g${i}`, r, pts: r === 'w' ? 1 : r === 'd' ? 0.5 : 0, fire: false }));

const game = (white: 'c' | 'd', r: PlayoffGame['r'], armageddon = false): PlayoffGame => ({
  gameId: Math.random().toString(36).slice(2),
  white,
  armageddon,
  r,
});

describe('çete savaşı', () => {
  it('tur sayısı çete boyu kadar; herkes karşı çetenin herkesiyle bir kez oynar', () => {
    for (const n of [2, 4]) {
      const war = setup(n);
      expect(warRounds(war)).toBe(n);
      const met = new Set<string>();
      for (let r = 0; r < n; r++) {
        const pairs = warPairs(war, r);
        expect(pairs).toHaveLength(n);
        // Each player plays once a round.
        expect(new Set(pairs.flat()).size).toBe(2 * n);
        for (const [w, b] of pairs) met.add([w, b].sort().join('-'));
      }
      expect(met.size).toBe(n * n);
    }
  });

  it('herkes oyunlarının yarısında Beyaz; 4 kişide renkler masadan masaya değişir', () => {
    const war = setup(2);
    expect(warPairs(war, 0)).toEqual([
      ['c0', 'd0'],
      ['c1', 'd1'],
    ]);
    expect(warPairs(war, 1)).toEqual([
      ['d1', 'c0'],
      ['d0', 'c1'],
    ]);
    for (const n of [2, 4]) {
      const w = setup(n);
      for (const p of w.players) {
        const whites = Array.from({ length: n }, (_, r) => r).filter((r) =>
          warPairs(w, r).some(([white]) => white === p.id),
        ).length;
        expect(whites).toBe(n / 2);
      }
    }
    // Four a side: the first round as before, the challengers White on boards 1 and 3.
    expect(warPairs(setup(4), 0).map(([white]) => white)).toEqual(['c0', 'd1', 'c2', 'd3']);
  });

  it('uzatmayı iki çetenin en çok kazananı oynar (eşitse puan, sonra üst masa)', () => {
    const war = setup(2);
    const players = {
      c0: { score: 1, sheet: sheet('l', 'w') },
      c1: { score: 1, sheet: sheet('d', 'd') },
      d0: { score: 0.5, sheet: sheet('d', 'l') },
      d1: { score: 1.5, sheet: sheet('w', 'd') },
    };
    expect(playoffPlayers(war, players)).toEqual({ c: 'c0', d: 'd1' });
    const level = { ...players, d0: { score: 1, sheet: sheet('w', 'l') }, d1: { score: 1, sheet: sheet('w', 'l') } };
    expect(playoffPlayers(war, level).d).toBe('d0');
  });

  it('uzatma: rastgele renk, beraberlikte renk değişir, iki beraberlikten sonra Armageddon', () => {
    const first = nextPlayoffGame({ games: [] }, () => 0.9);
    expect(first).toEqual({ white: 'd', armageddon: false });
    expect(nextPlayoffGame({ games: [game('d', null)] }, () => 0)).toBeNull();
    expect(nextPlayoffGame({ games: [game('d', 'd')] }, () => 0)).toEqual({ white: 'c', armageddon: false });
    expect(nextPlayoffGame({ games: [game('d', 'd'), game('c', 'd')] }, () => 0)).toEqual({
      white: 'c',
      armageddon: true,
    });
    // Decided: no more games.
    expect(nextPlayoffGame({ games: [game('d', 'w')] }, () => 0)).toBeNull();
  });

  it('kazanan: skor; eşitse uzatma; Armageddon beraberliği Siyahın', () => {
    expect(warWinner({ c: 3, d: 1 }, null)).toBe('c');
    expect(warWinner({ c: 1, d: 1 }, null)).toBeNull();
    expect(warWinner({ c: 1, d: 1 }, { games: [game('c', 'l')] })).toBe('d');
    expect(warWinner({ c: 1, d: 1 }, { games: [game('c', 'd'), game('d', 'w')] })).toBe('c');
    const arm = [game('c', 'd'), game('d', 'd')];
    expect(playoffWinner({ games: [...arm, game('c', 'd', true)] })).toBe('d');
    expect(playoffWinner({ games: [...arm, game('d', 'd', true)] })).toBe('c');
    expect(playoffWinner({ games: [...arm, game('d', null, true)] })).toBeNull();
  });

  it('Armageddon saati: Siyahın süresi kısalır, Beyazınki aynı kalır; süresiz saat süresiz kalır', () => {
    const clock = armageddonClock({ remaining: { w: 300_000, b: 300_000 }, running: null });
    expect(clock.remaining).toEqual({ w: 300_000, b: 300_000 * ARMAGEDDON_BLACK_SHARE });
    expect(clock.running).toBeNull();
    expect(armageddonClock({ remaining: { w: Infinity, b: Infinity } }).remaining.b).toBe(Infinity);
  });
});
