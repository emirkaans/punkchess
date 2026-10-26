// A player's statistics on their profile, worked out from their online games
// (GET /api/users/:name/stats): form and streaks, results per variant, how
// games end, openings, speeds, records and activity by day. Pure.

import { speedOf } from '../rating/categories.ts';
import type { Speed } from '../rating/categories.ts';

export type Outcome = 'w' | 'd' | 'l';

/** One finished game from the player's side (newest first when handed to profileStats). */
export interface StatsGame {
  readonly id: string;
  readonly variantId: string;
  readonly timeControlId: string;
  readonly color: 'w' | 'b';
  readonly outcome: Outcome;
  /** End reason ('checkmate', 'resign', 'timeout', …). */
  readonly termination: string;
  /** Moves in SAN. */
  readonly moves: readonly string[];
  readonly opponent: string;
  readonly opponentUsername: string | null;
  readonly opponentRating: number | null;
  readonly endedAt: number;
  /** The game began from the variant's usual start (openings are named only then). */
  readonly standardStart: boolean;
}

export interface OpeningLine {
  /** Key of its name (`opening.<id>`). */
  readonly id: string;
  /** Its defining moves, e.g. "1.e4 e5 2.Nf3 Nc6 3.Bc4". */
  readonly moves: string;
  readonly games: number;
  readonly w: number;
  readonly d: number;
  readonly l: number;
}

export interface ProfileStats {
  readonly games: number;
  readonly form: {
    /** The last (up to) 10 games, newest first. */
    readonly last: readonly { readonly id: string; readonly outcome: Outcome }[];
    /** Games in a row without a loss, up to now. */
    readonly unbeaten: number;
    /** Wins in a row up to now, and the longest such run. */
    readonly winStreak: number;
    readonly bestWinStreak: number;
    /** Points scored in the last 10 games, as a percentage (win 1, draw ½). */
    readonly score10: number;
  };
  readonly variants: readonly {
    readonly variantId: string;
    readonly games: number;
    readonly w: number;
    readonly d: number;
    readonly l: number;
  }[];
  readonly style: {
    readonly wins: number;
    /** How the player's wins ended. */
    readonly winsBy: {
      readonly checkmate: number;
      readonly resign: number;
      readonly timeout: number;
      readonly other: number;
    };
    readonly white: { readonly games: number; readonly wins: number };
    readonly black: { readonly games: number; readonly wins: number };
    readonly draws: number;
    /** Losses on time. */
    readonly lostOnTime: number;
    /** Average game length in full moves. */
    readonly avgMoves: number;
  };
  /** Standard chess openings, most played first (up to 4 per colour). */
  readonly openings: { readonly w: readonly OpeningLine[]; readonly b: readonly OpeningLine[] };
  readonly speeds: readonly { readonly speed: Speed; readonly games: number }[];
  readonly records: {
    readonly fastestMate: {
      readonly id: string;
      readonly moves: number;
      readonly opponent: string;
      readonly timeControlId: string;
    } | null;
    readonly bestWin: {
      readonly id: string;
      readonly rating: number;
      readonly opponent: string;
      readonly timeControlId: string;
    } | null;
    readonly longest: {
      readonly id: string;
      readonly moves: number;
      readonly opponent: string;
      readonly outcome: Outcome;
    } | null;
    /** The signed-in opponent this player loses to most (3 games or more, more losses than wins). */
    readonly nemesis: { readonly username: string; readonly w: number; readonly d: number; readonly l: number } | null;
  };
  readonly activity: {
    /** Games per day for the last ACTIVITY_DAYS days (UTC), oldest first; the last one is today. */
    readonly days: readonly number[];
    /** The longest run of days in a row with at least one game, ever. */
    readonly bestDayStreak: number;
  };
}

export const ACTIVITY_DAYS = 84;
const DAY = 86_400_000;

/**
 * The openings the profile names, by their moves (SAN, from the usual start). The longest
 * matching line names a game; the shortest ones catch the rest of each first move.
 */
export const OPENINGS: readonly { readonly id: string; readonly moves: readonly string[] }[] = [
  { id: 'italian', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'] },
  { id: 'spanish', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'] },
  { id: 'scotch', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'] },
  { id: 'petrov', moves: ['e4', 'e5', 'Nf3', 'Nf6'] },
  { id: 'kingsGambit', moves: ['e4', 'e5', 'f4'] },
  { id: 'openGame', moves: ['e4', 'e5'] },
  { id: 'sicilian', moves: ['e4', 'c5'] },
  { id: 'french', moves: ['e4', 'e6'] },
  { id: 'caroKann', moves: ['e4', 'c6'] },
  { id: 'scandinavian', moves: ['e4', 'd5'] },
  { id: 'pirc', moves: ['e4', 'd6'] },
  { id: 'alekhine', moves: ['e4', 'Nf6'] },
  { id: 'kingsPawn', moves: ['e4'] },
  { id: 'queensGambit', moves: ['d4', 'd5', 'c4'] },
  { id: 'london', moves: ['d4', 'd5', 'Bf4'] },
  { id: 'londonIndian', moves: ['d4', 'Nf6', 'Bf4'] },
  { id: 'kingsIndian', moves: ['d4', 'Nf6', 'c4', 'g6'] },
  { id: 'nimzoQueensIndian', moves: ['d4', 'Nf6', 'c4', 'e6'] },
  { id: 'dutch', moves: ['d4', 'f5'] },
  { id: 'queensPawn', moves: ['d4'] },
  { id: 'english', moves: ['c4'] },
  { id: 'reti', moves: ['Nf3'] },
];

/** The named opening of a game's moves, or null (an unusual first move). */
export function openingOf(moves: readonly string[]): (typeof OPENINGS)[number] | null {
  let best: (typeof OPENINGS)[number] | null = null;
  for (const o of OPENINGS)
    if (o.moves.every((m, i) => moves[i] === m) && (!best || o.moves.length > best.moves.length)) best = o;
  return best;
}

/** "1.e4 e5 2.Nf3" from SAN moves. */
export function numbered(moves: readonly string[]): string {
  return moves.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}.${m}` : m)).join(' ');
}

const fullMoves = (g: StatsGame) => Math.ceil(g.moves.length / 2);

/** Everything the profile shows about a player's games (`games` newest first; `standardId`: standard chess). */
export function profileStats(games: readonly StatsGame[], standardId: string, now: number): ProfileStats {
  // Form and streaks.
  const last = games.slice(0, 10).map((g) => ({ id: g.id, outcome: g.outcome }));
  let unbeaten = 0;
  while (unbeaten < games.length && games[unbeaten].outcome !== 'l') unbeaten++;
  let winStreak = 0;
  while (winStreak < games.length && games[winStreak].outcome === 'w') winStreak++;
  let bestWinStreak = 0;
  let run = 0;
  for (const g of games) {
    run = g.outcome === 'w' ? run + 1 : 0;
    bestWinStreak = Math.max(bestWinStreak, run);
  }
  const points = last.reduce((s, g) => s + (g.outcome === 'w' ? 1 : g.outcome === 'd' ? 0.5 : 0), 0);
  const score10 = last.length ? Math.round((points / last.length) * 100) : 0;

  // Results per variant.
  const variantMap = new Map<string, { games: number; w: number; d: number; l: number }>();
  for (const g of games) {
    const v = variantMap.get(g.variantId) ?? { games: 0, w: 0, d: 0, l: 0 };
    v.games++;
    v[g.outcome]++;
    variantMap.set(g.variantId, v);
  }
  const variants = [...variantMap].map(([variantId, v]) => ({ variantId, ...v })).sort((a, b) => b.games - a.games);

  // How games end.
  const winsBy = { checkmate: 0, resign: 0, timeout: 0, other: 0 };
  const white = { games: 0, wins: 0 };
  const black = { games: 0, wins: 0 };
  let draws = 0;
  let lostOnTime = 0;
  let moveSum = 0;
  for (const g of games) {
    const side = g.color === 'w' ? white : black;
    side.games++;
    moveSum += fullMoves(g);
    if (g.outcome === 'w') {
      side.wins++;
      const end = g.termination as keyof typeof winsBy;
      winsBy[end in winsBy && end !== 'other' ? end : 'other']++;
    } else if (g.outcome === 'd') draws++;
    else if (g.termination === 'timeout') lostOnTime++;
  }
  const wins = white.wins + black.wins;

  // Openings (standard chess from the usual start).
  const lines = { w: new Map<string, OpeningLine>(), b: new Map<string, OpeningLine>() };
  for (const g of games) {
    if (g.variantId !== standardId || !g.standardStart) continue;
    const o = openingOf(g.moves);
    if (!o) continue;
    const map = lines[g.color];
    const line = map.get(o.id) ?? { id: o.id, moves: numbered(o.moves), games: 0, w: 0, d: 0, l: 0 };
    map.set(o.id, { ...line, games: line.games + 1, [g.outcome]: line[g.outcome] + 1 });
  }
  const top = (m: Map<string, OpeningLine>) => [...m.values()].sort((a, b) => b.games - a.games).slice(0, 4);

  // Speeds.
  const speedMap = new Map<Speed, number>();
  for (const g of games) {
    const s = speedOf(g.timeControlId);
    if (s) speedMap.set(s, (speedMap.get(s) ?? 0) + 1);
  }
  const speeds = (['bullet', 'blitz', 'rapid', 'classical'] as const).map((speed) => ({
    speed,
    games: speedMap.get(speed) ?? 0,
  }));

  // Records.
  let fastestMate: ProfileStats['records']['fastestMate'] = null;
  let bestWin: ProfileStats['records']['bestWin'] = null;
  let longest: ProfileStats['records']['longest'] = null;
  const rivals = new Map<string, { w: number; d: number; l: number }>();
  for (const g of games) {
    const moves = fullMoves(g);
    if (g.outcome === 'w' && g.termination === 'checkmate' && (!fastestMate || moves < fastestMate.moves))
      fastestMate = { id: g.id, moves, opponent: g.opponent, timeControlId: g.timeControlId };
    if (g.outcome === 'w' && g.opponentRating !== null && (!bestWin || g.opponentRating > bestWin.rating))
      bestWin = { id: g.id, rating: g.opponentRating, opponent: g.opponent, timeControlId: g.timeControlId };
    if (!longest || moves > longest.moves) longest = { id: g.id, moves, opponent: g.opponent, outcome: g.outcome };
    if (g.opponentUsername) {
      const r = rivals.get(g.opponentUsername) ?? { w: 0, d: 0, l: 0 };
      r[g.outcome]++;
      rivals.set(g.opponentUsername, r);
    }
  }
  let nemesis: ProfileStats['records']['nemesis'] = null;
  for (const [username, r] of rivals)
    if (r.w + r.d + r.l >= 3 && r.l > r.w && (!nemesis || r.l > nemesis.l)) nemesis = { username, ...r };

  // Activity by day.
  const today = Math.floor(now / DAY);
  const days = new Array<number>(ACTIVITY_DAYS).fill(0);
  const played = new Set<number>();
  for (const g of games) {
    const day = Math.floor(g.endedAt / DAY);
    played.add(day);
    const i = ACTIVITY_DAYS - 1 - (today - day);
    if (i >= 0 && i < ACTIVITY_DAYS) days[i]++;
  }
  let bestDayStreak = 0;
  for (const day of played) {
    if (played.has(day - 1)) continue;
    let n = 1;
    while (played.has(day + n)) n++;
    bestDayStreak = Math.max(bestDayStreak, n);
  }

  return {
    games: games.length,
    form: { last, unbeaten, winStreak, bestWinStreak, score10 },
    variants,
    style: {
      wins,
      winsBy,
      white,
      black,
      draws,
      lostOnTime,
      avgMoves: games.length ? Math.round(moveSum / games.length) : 0,
    },
    openings: { w: top(lines.w), b: top(lines.b) },
    speeds,
    records: { fastestMate, bestWin, longest, nemesis },
    activity: { days, bestDayStreak },
  };
}
