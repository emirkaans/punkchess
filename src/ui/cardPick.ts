// Picking a card's targets on the board, for variants with cards (Anarşi). Pure: no React.
//
// One target square: a click plays it. Two (Işınlanma): the first click picks one square,
// the second its partner. Three in a row (Barikat): a click on the middle square.

import type { Move, Square } from '../engine/index.ts';

/** A card being played: its id and the squares picked so far. */
export interface CardPick {
  readonly id: string;
  readonly picked: readonly Square[];
}

/** The square a click picks for a card move with one or three targets. */
const key = (m: Move) => {
  const sq = m.card!.squares;
  return sq.length === 3 ? sq[1] : sq[0];
};

/** Squares that can be clicked next, given the card's legal moves. */
export function pickTargets(moves: readonly Move[], pick: CardPick): Square[] {
  const mine = moves.filter((m) => m.card?.id === pick.id);
  const out = new Set<Square>();
  for (const m of mine) {
    const sq = m.card!.squares;
    if (sq.length !== 2) out.add(key(m));
    else if (pick.picked.length === 0) sq.forEach((s) => out.add(s));
    else if (sq.includes(pick.picked[0])) out.add(sq[0] === pick.picked[0] ? sq[1] : sq[0]);
  }
  return [...out];
}

/**
 * A click on `square`: the card move it completes, the pick with the square added (first of
 * two), or null when the square is not a target.
 */
export function clickTarget(
  moves: readonly Move[],
  pick: CardPick,
  square: Square,
): { readonly move: Move } | { readonly pick: CardPick } | null {
  if (!pickTargets(moves, pick).includes(square)) return null;
  const mine = moves.filter((m) => m.card?.id === pick.id);
  const pair = mine.some((m) => m.card!.squares.length === 2);
  if (pair && pick.picked.length === 0) return { pick: { ...pick, picked: [square] } };
  const move = pair
    ? mine.find((m) => m.card!.squares.includes(pick.picked[0]) && m.card!.squares.includes(square))
    : mine.find((m) => key(m) === square);
  return move ? { move } : null;
}
