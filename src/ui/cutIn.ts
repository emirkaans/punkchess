// Cut-ins (design C): after a big moment the player's character slides over the board for a
// moment and says something. Pure: what the last move was worth shouting about, if anything.

import { isInCheck } from '../engine/index.ts';
import type { Color, GameState, VariantDefinition } from '../engine/index.ts';
import type { CardResult } from './cardResult.ts';

export type CutInLine =
  { readonly kind: 'card'; readonly id: string } | { readonly kind: 'queen' } | { readonly kind: 'check' };

export interface CutInEvent {
  /** Who shouts: the side that played the card, took the queen or gave check. */
  readonly color: Color;
  readonly line: CutInLine;
}

/** A piece worth this much (centipawns, the bot's values) is a queen or bigger: taking it is news. */
const QUEEN = 800;

/**
 * The last move's cut-in: a card played (not a secret one, not a mine going off), else the
 * opponent's queen taken, else a check. None once the game is over (the end screen has the stage).
 */
export function cutInFor(v: VariantDefinition, game: GameState | null, card: CardResult | null): CutInEvent | null {
  const last = game?.moves.at(-1);
  const before = game?.previous?.position;
  if (!game || !last || !before || game.result) return null;
  const mover = before.turn;
  if (last.move.card) {
    if (!card || card.hidden || card.blast || card.empty) return null;
    return { color: card.color, line: { kind: 'card', id: card.id } };
  }
  const taken = before.board[last.move.to];
  if (taken && taken.color !== mover && (v.pieceValues[taken.type] ?? 0) >= QUEEN)
    return { color: mover, line: { kind: 'queen' } };
  if (isInCheck(v, game.position)) return { color: mover, line: { kind: 'check' } };
  return null;
}
