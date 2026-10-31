// Which cards a game has (Anarşi), as far as the viewer may know: each side's trick and the
// chaos cards known here or already played. Pure: no React.

import { CHAOS, opposite } from '../engine/index.ts';
import type { Color, GameState } from '../engine/index.ts';

/** What a side's played chaos card turned out to be, read from the moves. */
export function playedChaos(game: GameState, color: Color): { kind: string; outcome: '+' | '-' } | null {
  const n = game.moves.length;
  for (let i = 0; i < n; i++) {
    const card = game.moves[i].move.card;
    // The last move was made by the side not to move now; earlier ones alternate back from there.
    const mover = (n - 1 - i) % 2 === 0 ? opposite(game.position.turn) : game.position.turn;
    if (card?.id === CHAOS && card.kind && mover === color) return { kind: card.kind, outcome: card.outcome! };
  }
  return null;
}

/**
 * The cards in this game, white's first: tricks, then each chaos card (null where it is
 * still hidden from the viewer). `chaos` holds each side's chaos card where it is known here.
 */
export function cardsInPlay(
  game: GameState,
  chaos: Readonly<Record<Color, string | null>>,
): { readonly tricks: readonly string[]; readonly chaos: readonly (string | null)[] } {
  const extra = game.position.extra as { trick?: Record<Color, string | null> };
  const sides = ['w', 'b'] as const;
  return {
    tricks: [...new Set(sides.map((c) => extra.trick?.[c] ?? null).filter((t): t is string => t !== null))],
    chaos: sides.map((c) => playedChaos(game, c)?.kind ?? chaos[c]),
  };
}
