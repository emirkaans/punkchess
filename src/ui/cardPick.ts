// Picking a card's targets on the board, for variants with cards (Anarşi). Pure: no React.
//
// One target square: a click plays it. Two (Işınlanma, Piyon Avı): the first click picks one
// square, the second its partner; Sürgün first the piece, then the starting square it goes back
// to (a single one plays at once). Three in a row (Barikat): a click on the middle square; where
// the wall could stand either way, a second click on one of its ends picks the way.

import type { Move, Square } from '../engine/index.ts';

/** A card being played: its id and the squares picked so far. */
export interface CardPick {
  readonly id: string;
  readonly picked: readonly Square[];
}

/** Cards whose two squares come in order: the piece first, then where it goes. */
const ORDERED = new Set(['exile']);

const squaresOf = (m: Move) => m.card!.squares;

/** Squares that can be clicked next, given the card's legal moves. */
export function pickTargets(moves: readonly Move[], pick: CardPick): Square[] {
  const mine = moves.filter((m) => m.card?.id === pick.id);
  const ordered = ORDERED.has(pick.id);
  const out = new Set<Square>();
  for (const m of mine) {
    const sq = squaresOf(m);
    if (sq.length === 3) {
      if (pick.picked.length === 0) out.add(sq[1]);
      else if (sq[1] === pick.picked[0]) [sq[0], sq[2]].forEach((s) => out.add(s));
    } else if (sq.length !== 2) out.add(sq[0]);
    else if (pick.picked.length === 0) (ordered ? [sq[0]] : sq).forEach((s) => out.add(s));
    else if (sq.includes(pick.picked[0]) && (!ordered || sq[0] === pick.picked[0]))
      out.add(sq[0] === pick.picked[0] ? sq[1] : sq[0]);
  }
  return [...out];
}

/** The hint for a second click: which kind of square to pick. */
export const secondPickKind = (id: string): 'piece' | 'home' | 'end' =>
  id === 'exile' ? 'home' : id === 'wall' ? 'end' : 'piece';

/**
 * A click on `square`: the card move it completes, the pick with the square added (a first
 * click that leaves a choice), or null when the square is not a target.
 */
export function clickTarget(
  moves: readonly Move[],
  pick: CardPick,
  square: Square,
): { readonly move: Move } | { readonly pick: CardPick } | null {
  if (!pickTargets(moves, pick).includes(square)) return null;
  const mine = moves.filter((m) => m.card?.id === pick.id);
  const ordered = ORDERED.has(pick.id);
  if (mine.some((m) => squaresOf(m).length === 3)) {
    if (pick.picked.length === 0) {
      const ways = mine.filter((m) => squaresOf(m)[1] === square);
      return ways.length === 1 ? { move: ways[0] } : { pick: { ...pick, picked: [square] } };
    }
    const move = mine.find((m) => {
      const sq = squaresOf(m);
      return sq[1] === pick.picked[0] && (sq[0] === square || sq[2] === square);
    });
    return move ? { move } : null;
  }
  const pair = mine.some((m) => squaresOf(m).length === 2);
  if (pair && pick.picked.length === 0) {
    const ways = mine.filter((m) => (ordered ? squaresOf(m)[0] === square : squaresOf(m).includes(square)));
    return ordered && ways.length === 1 ? { move: ways[0] } : { pick: { ...pick, picked: [square] } };
  }
  const move = pair
    ? mine.find((m) => squaresOf(m).includes(pick.picked[0]) && squaresOf(m).includes(square))
    : mine.find((m) => squaresOf(m)[0] === square);
  return move ? { move } : null;
}
