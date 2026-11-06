// Daily quests: every day each signed-in player gets three (an easy, a medium and a hard one) for
// punk coins, and a streak for the days all three were done. Only what the server sees counts
// (online games, puzzles, the daily puzzle, Puzzle Rush); games against the bot are played in the
// browser and do not. The server keeps the progress (server/quests.ts). Pure.

/** Something a player did that a quest may count. */
export type QuestEvent =
  | {
      readonly k: 'game';
      /** At least MIN_PLIES half-moves (a game aborted at once counts for nothing). */
      readonly finished: boolean;
      readonly won: boolean;
      readonly color: 'w' | 'b';
      readonly variantId: string;
      readonly checkmate: boolean;
      readonly tournament: boolean;
      /** The player played a card (Anarşi). */
      readonly card: boolean;
      /** The opponent's rating was higher than the player's before the game. */
      readonly beatHigher: boolean;
    }
  | { readonly k: 'puzzle' }
  | { readonly k: 'daily' }
  | { readonly k: 'rush'; readonly score: number };

export type Tier = 1 | 2 | 3;

export interface Quest {
  readonly id: string;
  readonly tier: Tier;
  /** How many times it has to happen. */
  readonly target: number;
  /** How far `e` takes the quest (0 when it does not count). */
  readonly step: (e: QuestEvent) => number;
}

/** Half-moves a game needs to count (as for the coins a win pays). */
export const MIN_PLIES = 10;

const game = (test: (e: Extract<QuestEvent, { k: 'game' }>) => boolean) => (e: QuestEvent) =>
  e.k === 'game' && e.finished && test(e) ? 1 : 0;
const rush = (score: number) => (e: QuestEvent) => (e.k === 'rush' && e.score >= score ? 1 : 0);

export const QUESTS: readonly Quest[] = [
  // Easy
  { id: 'play1', tier: 1, target: 1, step: game(() => true) },
  { id: 'puzzle3', tier: 1, target: 3, step: (e) => (e.k === 'puzzle' ? 1 : 0) },
  { id: 'daily', tier: 1, target: 1, step: (e) => (e.k === 'daily' ? 1 : 0) },
  { id: 'rush10', tier: 1, target: 1, step: rush(10) },
  // Medium
  { id: 'win2', tier: 2, target: 2, step: game((e) => e.won) },
  { id: 'winBlack', tier: 2, target: 1, step: game((e) => e.won && e.color === 'b') },
  { id: 'variant', tier: 2, target: 1, step: game((e) => e.variantId !== 'standard') },
  { id: 'card', tier: 2, target: 1, step: game((e) => e.variantId === 'anarsi' && e.card) },
  { id: 'puzzle8', tier: 2, target: 8, step: (e) => (e.k === 'puzzle' ? 1 : 0) },
  { id: 'rush20', tier: 2, target: 1, step: rush(20) },
  // Hard
  { id: 'mate', tier: 3, target: 1, step: game((e) => e.won && e.checkmate) },
  { id: 'win3', tier: 3, target: 3, step: game((e) => e.won) },
  { id: 'tournament', tier: 3, target: 1, step: game((e) => e.tournament) },
  { id: 'giant', tier: 3, target: 1, step: game((e) => e.won && e.beatHigher) },
  { id: 'rush30', tier: 3, target: 1, step: rush(30) },
];

export const questById = (id: string): Quest | undefined => QUESTS.find((q) => q.id === id);

/** Coins for a quest of each tier, for all three done, and for every seventh day of a streak. */
export const QUEST_COINS: Readonly<Record<Tier, number>> = { 1: 10, 2: 20, 3: 30 };
export const ALL_DONE_COINS = 20;
export const STREAK_DAYS = 7;
export const STREAK_COINS = 100;

/** A small number from a string: the same everywhere. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * The day's three quests of a player, easiest first. `swapped` is the slot (0–2) the player
 * changed that day, which takes the next quest of its tier; -1 for none.
 */
export function questsOf(userId: string, day: string, swapped = -1): Quest[] {
  return ([1, 2, 3] as const).map((tier, slot) => {
    const pool = QUESTS.filter((q) => q.tier === tier);
    const i = hash(`${userId}|${day}|${tier}`) % pool.length;
    return pool[(i + (slot === swapped ? 1 : 0)) % pool.length];
  });
}

/** The progress `progress` (one count per slot) after `e`, each capped at its quest's target. */
export function advance(quests: readonly Quest[], progress: readonly number[], e: QuestEvent): number[] {
  return quests.map((q, i) => Math.min(q.target, (progress[i] ?? 0) + q.step(e)));
}

/** Days in a row, ending today or yesterday, on which all three quests were done. */
export function streakOf(doneDays: Iterable<string>, today: string): number {
  const done = new Set(doneDays);
  const prev = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  let day = done.has(today) ? today : prev(today);
  let n = 0;
  while (done.has(day)) {
    n++;
    day = prev(day);
  }
  return n;
}

/** What the server answers about a player's quests (GET /api/me/quests). */
export interface QuestsResponse {
  readonly day: string;
  /** When the next day's quests come (ms). */
  readonly nextAt: number;
  readonly quests: readonly {
    readonly id: string;
    readonly tier: Tier;
    readonly target: number;
    readonly progress: number;
    readonly coins: number;
  }[];
  /** A quest was changed today (one a day). */
  readonly swapped: boolean;
  /** All three done today. */
  readonly allDone: boolean;
  /** Days in a row with all three done (today included once done). */
  readonly streak: number;
}
