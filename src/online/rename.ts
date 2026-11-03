// Changing one's username (server/rename.ts, src/ui/RenameDialog.tsx): once every 30 days, the
// first change free and later ones for punk coins; a change of capitals only is always free.
// An old name stays held for its owner for a while, and its profile link leads to the new one.
// Pure.

const DAY = 86_400_000;

export const RENAME_RULES = {
  /** Time between two changes. */
  everyMs: 30 * DAY,
  /** Punk coins for a change after the first. */
  price: 200,
  /** Nobody else can take an old name for this long. */
  holdMs: 30 * DAY,
  /** The old name's profile link leads to the new name for this long. */
  redirectMs: 90 * DAY,
} as const;

/** Whether two names differ only in their capitals (Aybo → aybo): free and not counted. */
export const sameName = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** What a player's next change costs, given how many real changes they made before. */
export const renameCost = (changesBefore: number): number => (changesBefore > 0 ? RENAME_RULES.price : 0);

/** When the next change is allowed after one made at `lastAt` (null: never changed, now). */
export const nextRenameAt = (lastAt: number | null): number | null =>
  lastAt === null ? null : lastAt + RENAME_RULES.everyMs;

/** What GET /api/me/username answers. */
export interface RenameInfo {
  readonly username: string;
  /** Punk coins the next change costs (0: free). */
  readonly cost: number;
  /** When a change is allowed again (ms), or null: now. */
  readonly nextAt: number | null;
  readonly balance: number;
  /** Staff: their own changes are free and have no wait. */
  readonly staff: boolean;
}
