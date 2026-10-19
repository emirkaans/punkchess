// Gangs: teams of players with a weekly score. Shapes of the gang API
// (server/gangs.ts) and its rules. Pure.

import { offensiveName } from './badwords.ts';

/** A gang is exactly this many players: open to join until full; only a full gang is active (ranked, scored). */
export const GANG_SIZE = 4;
/** The weekly score counts the last this many days. */
export const GANG_WEEK_DAYS = 7;
/** Points per online game won or drawn, and per daily puzzle solved, in the week. */
export const GANG_POINTS = { win: 2, draw: 1, daily: 1 } as const;

export interface GangSummary {
  readonly tag: string;
  readonly name: string;
  readonly members: number;
  /** Full (GANG_SIZE members): ranked and scored. A gang still forming is open to join. */
  readonly active: boolean;
  /** Points of the members in the last GANG_WEEK_DAYS days. */
  readonly score: number;
}

export interface GangMember {
  readonly username: string;
  readonly score: number;
  readonly owner: boolean;
}

export interface GangDetail extends GangSummary {
  readonly createdAt: number;
  readonly list: readonly GangMember[];
  /** Its latest wars, newest first. */
  readonly wars: readonly GangWar[];
  /** Its finished wars. */
  readonly record: { readonly won: number; readonly lost: number; readonly drawn: number };
}

export interface GangList {
  readonly gangs: readonly GangSummary[];
  /** The signed-in player's gang tag, or null. */
  readonly mine: string | null;
  /** Whether that player founded it (founders declare and answer wars), and whether it is active. */
  readonly mineOwner: boolean;
  readonly mineActive: boolean;
}

/** A challenge waits this long for an answer. */
export const WAR_ANSWER_MS = 30 * 60_000;

export type GangWarStatus = 'pending' | 'live' | 'finished' | 'declined' | 'cancelled' | 'expired';

/** A gang war: the challenging gang ('c') against the defending one ('d'). */
export interface GangWar {
  readonly id: string;
  readonly challenger: { readonly tag: string; readonly name: string };
  readonly defender: { readonly tag: string; readonly name: string };
  readonly timeControlId: string;
  readonly status: GangWarStatus;
  readonly createdAt: number;
  /** Once over: each side's points (a win 1, a draw ½ per board). */
  readonly score: { readonly c: number; readonly d: number } | null;
  readonly winner: 'c' | 'd' | null;
  /** The boards (a tournament page), once accepted. */
  readonly tournamentId: string | null;
}

export type GangProblem = 'name' | 'tag' | 'taken' | 'in-gang' | 'full' | 'signed-out';

/** A gang tag as stored and shown: capital letters and digits. */
export const cleanTag = (tag: string): string => tag.trim().toUpperCase();

/** What is wrong with a new gang's name and tag, or null. */
export function gangProblem(name: string, tag: string): 'name' | 'tag' | null {
  const n = name.trim();
  if (n.length < 3 || n.length > 24 || !/^[\p{L}\p{N} _-]+$/u.test(n) || offensiveName(n.replace(/\s+/g, '')))
    return 'name';
  const t = cleanTag(tag);
  if (!/^[A-Z0-9]{2,4}$/.test(t) || offensiveName(t)) return 'tag';
  return null;
}

/** A member's weekly points from their week's results. */
export const gangScore = (wins: number, draws: number, dailies: number): number =>
  wins * GANG_POINTS.win + draws * GANG_POINTS.draw + dailies * GANG_POINTS.daily;
