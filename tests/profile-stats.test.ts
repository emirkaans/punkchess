// Profile statistics (src/online/profileStats.ts): streaks, endings, openings, records, activity.
import { describe, expect, it } from 'vitest';
import { ACTIVITY_DAYS, numbered, openingOf, profileStats } from '../src/online/profileStats.ts';
import type { Outcome, StatsGame } from '../src/online/profileStats.ts';

const DAY = 86_400_000;
const NOW = 1000 * DAY + 12 * 3_600_000;

let n = 0;
function game(outcome: Outcome, extra: Partial<StatsGame> = {}): StatsGame {
  n++;
  return {
    id: `g${n}`,
    variantId: 'standard',
    timeControlId: '5+0',
    color: 'w',
    outcome,
    termination: outcome === 'd' ? 'agreement' : 'resign',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'],
    opponent: 'Rakip',
    opponentUsername: null,
    opponentRating: 1500,
    endedAt: NOW - n * 60_000,
    standardStart: true,
    ...extra,
  };
}

describe('profil istatistikleri', () => {
  it('seriler ve son 10 oyun', () => {
    // Newest first: W W D W L W W W
    const games = ['w', 'w', 'd', 'w', 'l', 'w', 'w', 'w'].map((o) => game(o as Outcome));
    const s = profileStats(games, 'standard', NOW);
    expect(s.form.unbeaten).toBe(4);
    expect(s.form.winStreak).toBe(2);
    expect(s.form.bestWinStreak).toBe(3);
    expect(s.form.last.map((g) => g.outcome).join('')).toBe('wwdwlwww');
    expect(s.form.score10).toBe(Math.round((6.5 / 8) * 100));
  });

  it('galibiyetler nasıl bitti, renkler, süreden kayıp', () => {
    const s = profileStats(
      [
        game('w', { termination: 'checkmate' }),
        game('w', { termination: 'timeout', color: 'b' }),
        game('l', { termination: 'timeout' }),
        game('d'),
      ],
      'standard',
      NOW,
    );
    expect(s.style.winsBy).toEqual({ checkmate: 1, resign: 0, timeout: 1, other: 0 });
    expect(s.style.white).toEqual({ games: 3, wins: 1 });
    expect(s.style.black).toEqual({ games: 1, wins: 1 });
    expect(s.style.lostOnTime).toBe(1);
    expect(s.style.draws).toBe(1);
    expect(s.style.avgMoves).toBe(3);
  });

  it('açılış adları en uzun eşleşmeyle; varyantlar ve başka başlangıçlar sayılmaz', () => {
    expect(openingOf(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'])?.id).toBe('spanish');
    expect(openingOf(['e4', 'e5', 'Nc3'])?.id).toBe('openGame');
    expect(openingOf(['d4', 'Nf6', 'c4', 'g6'])?.id).toBe('kingsIndian');
    expect(openingOf(['g3'])).toBeNull();
    expect(numbered(['e4', 'e5', 'Nf3'])).toBe('1.e4 e5 2.Nf3');
    const s = profileStats(
      [game('w'), game('l'), game('w', { variantId: 'jester' }), game('w', { standardStart: false })],
      'standard',
      NOW,
    );
    expect(s.openings.w).toEqual([{ id: 'italian', moves: '1.e4 e5 2.Nf3 Nc6 3.Bc4', games: 2, w: 1, d: 0, l: 1 }]);
  });

  it('rekorlar ve baş belası', () => {
    const s = profileStats(
      [
        game('w', { termination: 'checkmate', moves: new Array(22).fill('x'), opponentRating: 1900 }),
        game('w', { termination: 'checkmate', moves: new Array(40).fill('x'), opponentRating: 1700 }),
        game('d', { moves: new Array(191).fill('x') }),
        game('l', { opponentUsername: 'vairo' }),
        game('l', { opponentUsername: 'vairo' }),
        game('w', { opponentUsername: 'vairo' }),
        game('l', { opponentUsername: 'tek' }),
      ],
      'standard',
      NOW,
    );
    expect(s.records.fastestMate?.moves).toBe(11);
    expect(s.records.bestWin?.rating).toBe(1900);
    expect(s.records.longest?.moves).toBe(96);
    expect(s.records.nemesis).toEqual({ username: 'vairo', w: 1, d: 0, l: 2 });
  });

  it('günlük aktivite ve en uzun gün serisi', () => {
    const at = (daysAgo: number) => NOW - daysAgo * DAY;
    const s = profileStats(
      [
        game('w', { endedAt: at(0) }),
        game('w', { endedAt: at(0) }),
        game('l', { endedAt: at(1) }),
        game('w', { endedAt: at(2) }),
        game('w', { endedAt: at(10) }),
        game('w', { endedAt: at(200) }),
      ],
      'standard',
      NOW,
    );
    expect(s.activity.days).toHaveLength(ACTIVITY_DAYS);
    expect(s.activity.days[ACTIVITY_DAYS - 1]).toBe(2);
    expect(s.activity.days[ACTIVITY_DAYS - 2]).toBe(1);
    expect(s.activity.days[ACTIVITY_DAYS - 11]).toBe(1);
    expect(s.activity.bestDayStreak).toBe(3);
  });

  it('oyunsuz oyuncu: boş ama geçerli', () => {
    const s = profileStats([], 'standard', NOW);
    expect(s.games).toBe(0);
    expect(s.form.score10).toBe(0);
    expect(s.records.longest).toBeNull();
  });
});
