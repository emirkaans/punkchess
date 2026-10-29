// What a card move did (Anarşi), read from the positions before and after it: the squares
// that changed and their pieces, for the bubble under the board, the board badge and the
// move list. Pure: no React.

import { CHAOS } from '../engine/index.ts';
import type { Color, GameState, Move, Piece, Position, Square } from '../engine/index.ts';

export interface CardChange {
  readonly square: Square;
  readonly before: Piece | null;
  readonly after: Piece | null;
}

export interface CardResult {
  /** Who played the card. */
  readonly color: Color;
  /** The trick, or the chaos card it turned out to be. */
  readonly id: string;
  readonly chaos: boolean;
  /** A chaos card's outcome; null for a trick. */
  readonly outcome: '+' | '-' | null;
  /** Changed squares, in the card's own order first (Sürgün: from, then home). */
  readonly changes: readonly CardChange[];
  /** A chaos card that found nothing to hit (no target). */
  readonly empty: boolean;
}

const same = (a: Piece | null, b: Piece | null) => a?.type === b?.type && a?.color === b?.color;

/** What `move` (played in `before`, giving `after`) did, or null when it is not a card. */
export function cardResult(before: Position, move: Move, after: Position): CardResult | null {
  const card = move.card;
  if (!card) return null;
  const chaos = card.id === CHAOS;
  const order = [...card.squares];
  for (let sq = 0; sq < 64; sq++) if (!order.includes(sq)) order.push(sq);
  const changes: CardChange[] = [];
  for (const sq of order) {
    const b = before.board[sq] ?? null;
    const a = after.board[sq] ?? null;
    // Buz and Kalkan change no piece: their target square still counts.
    if (!same(b, a) || card.squares.includes(sq)) changes.push({ square: sq, before: b, after: a });
  }
  return {
    color: before.turn,
    id: chaos ? (card.kind ?? CHAOS) : card.id,
    chaos,
    outcome: chaos ? (card.outcome ?? null) : null,
    changes,
    empty: chaos && card.kind !== 'time' && card.squares.length === 0,
  };
}

/** The card the shown position was reached by, if its last move was one. */
export function lastCardResult(game: GameState | null): CardResult | null {
  const last = game?.moves.at(-1);
  const before = game?.previous?.position;
  if (!game || !last || !before) return null;
  return cardResult(before, last.move, game.position);
}
