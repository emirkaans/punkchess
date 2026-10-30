// How a card's result is pictured (Anarşi): the badge on the board (on which squares, with
// what) and the tiles at the right of the bubble under the board. Most cards change a piece
// and show it before → after; the rest show what really happened (a piece frozen, a mine
// cleared, a piece sent home...). Pure: no React.

import { squareName } from '../engine/index.ts';
import type { Piece, Position, Square, VariantDefinition } from '../engine/index.ts';
import type { CardResult } from './cardResult.ts';

/** A picture drawn by the UI; `svg` carries a mark's own picture (a mine). */
export type CardIcon =
  | { readonly icon: 'mine'; readonly svg: string; readonly struck?: boolean }
  | { readonly icon: 'snow' }
  | { readonly icon: 'shield' };

export type BadgePart =
  | { readonly kind: 'text'; readonly text: string }
  /** A piece as a glyph; `after` pieces wear their own badge (a nitro piece's queen). */
  | { readonly kind: 'piece'; readonly piece: Piece | null; readonly after?: boolean }
  | ({ readonly kind: 'icon' } & CardIcon);

export type Tile =
  /** A piece (null: none, ×), optionally struck through and with its square in the corner. */
  | {
      readonly kind: 'piece';
      readonly piece: Piece | null;
      readonly after?: boolean;
      readonly struck?: boolean;
      readonly square?: Square;
    }
  | ({ readonly kind: 'icon'; readonly label?: string; readonly square?: Square } & CardIcon)
  | { readonly kind: 'sep'; readonly text: string }
  | { readonly kind: 'chip'; readonly text: string };

export interface CardVisual {
  readonly badges: readonly { readonly square: Square; readonly parts: readonly BadgePart[] }[];
  readonly tiles: readonly Tile[];
}

const NONE: CardVisual = { badges: [], tiles: [] };

export function cardVisual(v: VariantDefinition, r: CardResult, position: Position): CardVisual {
  const [c0, c1] = r.changes;
  if (r.empty || !c0) return NONE;
  const markAt = (sq: Square, kind: string) =>
    v.squareMarks?.(position).find((m) => m.square === sq && m.kind === kind);

  // A mine cleared, not set off: the mine, struck out (the piece is on the board anyway).
  if (r.blast && r.cleared && r.icon) {
    const mine = { icon: 'mine', svg: r.icon, struck: true } as const;
    return { badges: [{ square: c0.square, parts: [{ kind: 'icon', ...mine }] }], tiles: [{ kind: 'icon', ...mine }] };
  }
  if (!r.blast) {
    switch (r.id) {
      // A mine buried (its owner sees it): the mine and its square; the square shows the mine already.
      case 'mine': {
        const svg = markAt(c0.square, 'mine')?.icon;
        return svg ? { badges: [], tiles: [{ kind: 'icon', icon: 'mine', svg, square: c0.square }] } : NONE;
      }
      // Frozen: a snowflake and the moves left.
      case 'ice': {
        const left = markAt(c0.square, 'ice')?.label ?? '';
        const parts: BadgePart[] = [{ kind: 'icon', icon: 'snow' }];
        if (left) parts.push({ kind: 'text', text: left });
        return { badges: [{ square: c0.square, parts }], tiles: [{ kind: 'icon', icon: 'snow', label: left }] };
      }
      case 'shield':
        return {
          badges: [{ square: c0.square, parts: [{ kind: 'icon', icon: 'shield' }] }],
          tiles: [{ kind: 'icon', icon: 'shield' }],
        };
      // Sent home: the piece and where it went; the badge on its new square.
      case 'exile':
        return c1
          ? {
              badges: [{ square: c1.square, parts: [{ kind: 'text', text: '↩' }] }],
              tiles: [
                { kind: 'piece', piece: c0.before },
                { kind: 'chip', text: `↩ ${squareName(c1.square)}` },
              ],
            }
          : NONE;
      // Blockers stand on their squares in their own picture: no badge, the blockers in the bubble.
      case 'void':
      case 'wall':
        return { badges: [], tiles: r.changes.map((c) => ({ kind: 'piece', piece: c.after })) };
      // Every pawn taken, struck out, on its square.
      case 'pawn':
        return {
          badges: r.changes.map((c) => ({ square: c.square, parts: [{ kind: 'text', text: '×' }] })),
          tiles: r.changes.map((c) => ({ kind: 'piece', piece: c.before, struck: true, square: c.square })),
        };
      case 'swap':
      case 'quake': {
        const b = c1?.before ?? null;
        return {
          badges: [
            {
              square: c0.square,
              parts: [
                { kind: 'piece', piece: c0.before },
                { kind: 'text', text: '⇄' },
                { kind: 'piece', piece: b },
              ],
            },
          ],
          tiles: [
            { kind: 'piece', piece: c0.before },
            { kind: 'sep', text: '⇄' },
            { kind: 'piece', piece: b },
          ],
        };
      }
    }
  }
  // A piece changed (or left the board): before → after.
  if (!c0.before && !c0.after) return NONE;
  return {
    badges: [
      {
        square: c0.square,
        parts: [
          { kind: 'piece', piece: c0.before },
          { kind: 'text', text: '→' },
          { kind: 'piece', piece: c0.after, after: true },
        ],
      },
    ],
    tiles: [
      { kind: 'piece', piece: c0.before },
      { kind: 'sep', text: '→' },
      { kind: 'piece', piece: c0.after, after: true },
    ],
  };
}
