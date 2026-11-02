// Punk coins: what earns them and how many a day. Coins only buy looks (the store), never an
// advantage in a game. All numbers live here so they can be tuned in one place. Pure.

/** Where coins come from; each has its own daily ceiling under the overall one. */
export type CoinReason = 'online' | 'bot' | 'puzzle' | 'daily' | 'rush';

export const COIN_RULES = {
  /** A finished online game (at least `minPlies` half-moves): `play`, plus `win` for the winner. */
  online: { play: 10, win: 5, minPlies: 10, dailyMax: 100 },
  /** A won game against the bot, by its level (1–5); the server replays the moves first. */
  bot: { win: [2, 3, 4, 6, 8] as readonly number[], minPlies: 20, dailyMax: 20 },
  /** A puzzle solved at the first try (rated puzzles; each puzzle once). */
  puzzle: { solved: 3, dailyMax: 30 },
  /** The daily puzzle, solved. */
  daily: { solved: 15, dailyMax: 15 },
  /** A Puzzle Rush run: one coin per `perPoints` points. */
  rush: { perPoints: 2, dailyMax: 15 },
} as const;

/** Most coins a player can earn in a day, all sources together. */
export const DAILY_COIN_CAP = 150;

/** A source's daily ceiling. */
export const dailyMax = (reason: CoinReason): number => COIN_RULES[reason].dailyMax;

/** Coins for a won bot game at `level` (out-of-range levels count as the nearest). */
export const botWinCoins = (level: number): number => {
  const table = COIN_RULES.bot.win;
  return table[Math.max(0, Math.min(table.length - 1, Math.round(level) - 1))];
};

/** Coins for a Puzzle Rush score. */
export const rushCoins = (score: number): number => Math.floor(Math.max(0, score) / COIN_RULES.rush.perPoints);

/** What the server answers about a player's coins (GET /api/me/coins). */
export interface CoinsResponse {
  readonly balance: number;
  /** Earned today, and the day's ceiling. */
  readonly today: number;
  readonly cap: number;
  /** The latest entries, newest first. */
  readonly history: readonly { readonly amount: number; readonly reason: CoinReason; readonly at: number }[];
}
