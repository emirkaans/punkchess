// Bot difficulty levels: the single place for level names, numbers and search settings.

/** How the final move is picked from the root move scores. */
export type PickRule =
  /** 50% a uniformly random legal move, otherwise the best move. */
  | 'random-half'
  /** Weighted random among the best 3 moves (weights from the scores). */
  | 'top3-weighted'
  /** Random among moves within `margin` centipawns of the best. */
  | 'near-best'
  /** The best move; random only among equally scored moves. */
  | 'best';

export interface LevelConfig {
  readonly level: number;
  /** Turkish UI name. */
  readonly name: string;
  /** Maximum search depth in plies. */
  readonly maxDepth: number;
  readonly quiescence: boolean;
  readonly transpositionTable: boolean;
  /** Add the mobility term to the evaluation. */
  readonly mobility: boolean;
  readonly pick: PickRule;
  /** For 'near-best'. */
  readonly margin: number;
  readonly timeLimitMs: number;
}

export const LEVELS: readonly LevelConfig[] = [
  {
    level: 1,
    name: 'Çaylak',
    maxDepth: 1,
    quiescence: false,
    transpositionTable: false,
    mobility: false,
    pick: 'random-half',
    margin: 0,
    timeLimitMs: 100,
  },
  {
    level: 2,
    name: 'Mahalle',
    maxDepth: 2,
    quiescence: false,
    transpositionTable: false,
    mobility: false,
    pick: 'top3-weighted',
    margin: 0,
    timeLimitMs: 300,
  },
  {
    level: 3,
    name: 'Kulüp',
    maxDepth: 3,
    quiescence: true,
    transpositionTable: false,
    mobility: false,
    pick: 'near-best',
    margin: 50,
    timeLimitMs: 700,
  },
  {
    level: 4,
    name: 'Usta',
    maxDepth: 64,
    quiescence: true,
    transpositionTable: true,
    mobility: false,
    pick: 'best',
    margin: 0,
    timeLimitMs: 500,
  },
  {
    level: 5,
    name: 'Dork',
    maxDepth: 64,
    quiescence: true,
    transpositionTable: true,
    mobility: true,
    pick: 'best',
    margin: 0,
    timeLimitMs: 950,
  },
];

export function levelConfig(level: number): LevelConfig {
  const cfg = LEVELS.find((l) => l.level === level);
  if (!cfg) throw new Error(`Unknown bot level ${level}`);
  return cfg;
}

/** The bot waits at least this long before answering, however fast it found the move. */
export const MIN_THINK_MS = 400;

/** Search used by the hint button: level 4 settings, 1 second. */
export const HINT = { level: 4, timeLimitMs: 1000 } as const;

/** Time budget for a bot move: the level's limit, or less when the clock is low. */
export function botTimeMs(level: number, clock?: { remainingMs: number; incrementMs: number }): number {
  const limit = levelConfig(level).timeLimitMs;
  if (!clock) return limit;
  return Math.max(1, Math.min(limit, clock.remainingMs / 30 + clock.incrementMs));
}

/**
 * Standard chess bots are Stockfish, weakened as lichess weakens its levels: its Skill Level
 * (0-20: low ones knowingly pick worse moves among the candidates), a depth limit (it cannot see
 * deep tactics) and little time. Our Stockfish has no negative skill levels, so the easiest two
 * also play a random legal move now and then. Levels 1-5 sit near lichess's levels 1, 3, 5, 7 and 8.
 */
export interface StockfishLevel {
  readonly skill: number;
  readonly depth: number;
  /** The most time it takes for a move (less as its clock runs down). */
  readonly maxMs: number;
  /** Chance of a random legal move instead of Stockfish's. */
  readonly randomMove: number;
}

export const STOCKFISH_LEVELS: Readonly<Record<number, StockfishLevel>> = {
  1: { skill: 0, depth: 1, maxMs: 100, randomMove: 0.3 },
  2: { skill: 2, depth: 3, maxMs: 300, randomMove: 0.1 },
  3: { skill: 7, depth: 5, maxMs: 800, randomMove: 0 },
  4: { skill: 16, depth: 13, maxMs: 1500, randomMove: 0 },
  5: { skill: 20, depth: 22, maxMs: 3000, randomMove: 0 },
};

/** A level's Stockfish settings (unknown levels play as the strongest). */
export const stockfishLevel = (level: number): StockfishLevel => STOCKFISH_LEVELS[level] ?? STOCKFISH_LEVELS[5];

/**
 * Stockfish's time for a bot move: its level's most, but a share of the clock left (and of the
 * increment) once that is smaller, so it moves fast in bullet and may think longer in 15+10.
 */
export function stockfishTimeMs(level: number, clock?: { remainingMs: number; incrementMs: number }): number {
  const max = stockfishLevel(level).maxMs;
  if (!clock) return max;
  return Math.round(Math.max(30, Math.min(max, clock.remainingMs / 60 + clock.incrementMs * 0.6)));
}

/** The least time a bot takes before answering (so it does not look instant): shorter as its clock runs down. */
export function botMinThinkMs(clock?: { remainingMs: number }): number {
  return clock ? Math.round(Math.min(MIN_THINK_MS, clock.remainingMs / 150)) : MIN_THINK_MS;
}

/** Draw offers: levels 3+ accept when their own evaluation is worse than -150; levels 1-2 always decline. */
export function acceptsDraw(level: number, botScore: number): boolean {
  return level >= 3 && botScore < -150;
}
