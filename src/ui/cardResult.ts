// What a card move did (Anarşi), read from the positions before and after it: the squares
// that changed and their pieces, for the bubble under the board, the board badge and the
// move list. Also a hidden mark set off by a move (a mine). Pure: no React.

import { CHAOS } from '../engine/index.ts';
import type { Color, GameState, Move, Piece, Position, Square, VariantDefinition } from '../engine/index.ts';

export interface CardChange {
  readonly square: Square;
  readonly before: Piece | null;
  readonly after: Piece | null;
}

export interface CardResult {
  /** Who played the card (for a blast: who stepped on it). */
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
  /** A secret card seen by the other side: what it did is not shown (a buried mine). */
  readonly hidden?: boolean;
  /** Not a card: a move set off the opponent's hidden mark (a mine went off). */
  readonly blast?: boolean;
}

/** Who sees a side's secrets (hidden marks): one side, everyone (game over, analysis) or nobody. */
export type Viewer = Color | 'all' | null;

export const sees = (viewer: Viewer, owner: Color | undefined) => !owner || viewer === 'all' || viewer === owner;

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
    // Buz, Kalkan and Mayın change no piece: their target square still counts.
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

/**
 * What the shown position's last move did, for the bubble and the badge: a card, or a move that
 * set off the opponent's hidden mark. A secret card is masked for a viewer who may not see it.
 */
export function lastCardResult(v: VariantDefinition, game: GameState | null, viewer: Viewer): CardResult | null {
  const last = game?.moves.at(-1);
  const before = game?.previous?.position;
  if (!game || !last || !before) return null;
  const r = cardResult(before, last.move, game.position);
  if (r) {
    const secret = (v.squareMarks?.(game.position) ?? []).some(
      (m) => m.owner && !sees(viewer, m.owner) && last.move.card!.squares.includes(m.square),
    );
    return secret ? { ...r, changes: [], hidden: true } : r;
  }
  // A hidden mark of the opponent on the square moved to, gone after the move: it went off.
  const to = last.move.to;
  const hit = (v.squareMarks?.(before) ?? []).find((m) => m.square === to && m.owner && m.owner !== before.turn);
  if (!hit || (v.squareMarks?.(game.position) ?? []).some((m) => m.square === to && m.owner === hit.owner)) return null;
  return {
    color: before.turn,
    id: hit.kind,
    chaos: false,
    outcome: null,
    changes: [{ square: to, before: before.board[last.move.from] ?? null, after: game.position.board[to] ?? null }],
    empty: false,
    blast: true,
  };
}

/** Moves whose card squares are a secret the viewer may not see yet (their SAN hides the squares). */
export function secretMoves(v: VariantDefinition, game: GameState | null, viewer: Viewer): ReadonlySet<number> {
  const out = new Set<number>();
  if (!game) return out;
  const hidden = (v.squareMarks?.(game.position) ?? []).filter((m) => m.owner && !sees(viewer, m.owner));
  if (!hidden.length) return out;
  game.moves.forEach((m, i) => {
    if (m.move.card?.squares.some((s) => hidden.some((h) => h.square === s))) out.add(i);
  });
  return out;
}
