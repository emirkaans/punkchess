// What a tournament gives when it ends (design "Turnuva ödülleri"): the first three a podium
// patch and coins, the winner the champion's crown; in the site's first tournament everyone who
// played the "İlk Turnuva" patch. Gang wars give none of this. The server hands them out
// (server/prizes.ts). Pure.

/** Coins for the first, second and third (outside the daily ceiling: src/coins/rules.ts). */
export const PRIZE_COINS = [300, 200, 100] as const;
/** Coins for everyone who played in the first tournament. */
export const FIRST_TOURNAMENT_COINS = 20;
/**
 * Players (with a game) a tournament needs to count as the site's first: a test run among a
 * couple of accounts does not use the one-off patch up.
 */
export const FIRST_TOURNAMENT_MIN_PLAYERS = 4;

export interface Placed {
  readonly userId: string;
  readonly score: number;
  /** Games played in the tournament. */
  readonly games: number;
}

export interface Prize {
  readonly userId: string;
  readonly patches: readonly string[];
  readonly coins: number;
  /** The coin ledger's ref suffix: one payment per player and kind. */
  readonly kind: 'place' | 'first';
}

/**
 * Prizes of a finished tournament, `ranked` best first. Only players with points stand on the
 * podium; `first` (no one has the one-off patch yet) adds the first tournament's patch for all
 * who played, when enough did.
 */
export function tournamentPrizes(ranked: readonly Placed[], first: boolean): Prize[] {
  const out: Prize[] = [];
  ranked
    .filter((p) => p.score > 0)
    .slice(0, PRIZE_COINS.length)
    .forEach((p, i) =>
      out.push({
        userId: p.userId,
        patches: i === 0 ? ['champion', 'podium'] : ['podium'],
        coins: PRIZE_COINS[i],
        kind: 'place',
      }),
    );
  const played = ranked.filter((p) => p.games > 0);
  if (first && played.length >= FIRST_TOURNAMENT_MIN_PLAYERS)
    for (const p of played)
      out.push({ userId: p.userId, patches: ['first-tournament'], coins: FIRST_TOURNAMENT_COINS, kind: 'first' });
  return out;
}
