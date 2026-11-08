// Hands out a finished tournament's prizes (rules in src/achievements/prizes.ts): patches on the
// jacket and coins. Safe to run twice: a patch is kept once, a coin payment has its own ref.

import { tournamentPrizes } from '../src/achievements/prizes.ts';
import type { Placed } from '../src/achievements/prizes.ts';
import { grantCoins } from './coins.ts';

export async function awardTournament(
  db: D1Database,
  tournamentId: string,
  ranked: readonly Placed[],
  now: number,
): Promise<void> {
  // The site's first tournament: no other tournament gave its patch (a re-run of this one still
  // finishes handing it out).
  const taken = await db
    .prepare("SELECT 1 AS x FROM user_patches WHERE patch_id = 'first-tournament' AND game_id <> ?1 LIMIT 1")
    .bind(`tournament:${tournamentId}`)
    .first();
  for (const prize of tournamentPrizes(ranked, !taken)) {
    for (const patch of prize.patches)
      await db
        .prepare('INSERT OR IGNORE INTO user_patches (user_id, patch_id, earned_at, game_id) VALUES (?1, ?2, ?3, ?4)')
        .bind(prize.userId, patch, now, `tournament:${tournamentId}`)
        .run();
    await grantCoins(db, prize.userId, 'tournament', `${tournamentId}:${prize.kind}`, prize.coins, now);
  }
}
