// Punk coins: what earns them and how many a day. Coins only buy looks (the store), never an
// advantage in a game. All numbers live here so they can be tuned in one place. Pure.

/** Where coins come from; each has its own daily ceiling under the overall one. */
export type CoinReason = 'online' | 'puzzle' | 'daily' | 'rush';

// Coins are earned by winning and solving, not by playing: a game lost or drawn, or a game
// against the bot, pays nothing.
export const COIN_RULES = {
  /** A won online game (at least `minPlies` half-moves). */
  online: { win: 5, minPlies: 10, dailyMax: 50 },
  /** A puzzle solved at the first try (rated puzzles; each puzzle once). */
  puzzle: { solved: 1, dailyMax: 10 },
  /** The daily puzzle, solved. */
  daily: { solved: 3, dailyMax: 3 },
  /** A Puzzle Rush run: one coin per `perPoints` points. */
  rush: { perPoints: 5, dailyMax: 5 },
} as const;

/** Most coins a player can earn in a day, all sources together. */
export const DAILY_COIN_CAP = 60;

/** A source's daily ceiling. */
export const dailyMax = (reason: CoinReason): number => COIN_RULES[reason].dailyMax;

/** Coins for a Puzzle Rush score. */
export const rushCoins = (score: number): number => Math.floor(Math.max(0, score) / COIN_RULES.rush.perPoints);

/** What the server answers about a player's coins (GET /api/me/coins). */
export interface CoinsResponse {
  readonly balance: number;
  /** Earned today, and the day's ceiling. */
  readonly today: number;
  readonly cap: number;
  /** The latest entries, newest first. */
  readonly history: readonly {
    readonly amount: number;
    /** 'bot': won bot games paid before 2026-11-02; 'store': a purchase. */
    readonly reason: CoinReason | 'bot' | 'store';
    readonly at: number;
  }[];
}
