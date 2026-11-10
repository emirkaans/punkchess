// The daily puzzle as an Instagram story (design A "Afiş"): a 1080×1920 PNG with the logo, the
// title, the puzzle's number, the board (Kot Ceket squares, classic pieces, the last move
// marked, the side to move at the bottom), "WHITE / BLACK TO MOVE" and the address. Like the
// link-preview pictures (server/og-image.ts), the parts that need fonts are drawn ahead of time
// (scripts/make-story-assets.ts -> server/story-assets.ts) and only put together here.

import type { OgPiece } from './og-image.ts';
import { encodePng, fromBase64, inflate } from './og-image.ts';

export const STORY_W = 1080;
export const STORY_H = 1920;
/** The board: square size and top-left corner. */
export const STORY_SQ = 108;
export const STORY_BX = (STORY_W - 8 * STORY_SQ) / 2;
export const STORY_BY = 562;
/** Where the puzzle's number ("#42") is centred, and the top of the "… TO MOVE" banner. */
export const NUMBER_Y = 494;
export const BANNER_Y = 1478;

/** Kot Ceket: light and dark squares, and the last move's tint (rgba(232, 214, 140, 0.6)). */
const LIGHT = [0xcc, 0xd2, 0xd8];
const DARK = [0x5e, 0x70, 0x88];
const LAST = [232, 214, 140];
const LAST_ALPHA = 0.6;

/** An RGBA picture. */
export interface Sprite {
  readonly w: number;
  readonly h: number;
  readonly px: Uint8Array;
}

export interface StoryAssets {
  /** The frame, RGB, STORY_W × STORY_H. */
  readonly frame: Uint8Array;
  /** Pieces by colour + type ('wk', 'bp', …), RGBA, STORY_SQ square. */
  readonly pieces: Readonly<Record<string, Uint8Array>>;
  /** '#' and the digits, trimmed to their ink. */
  readonly glyphs: Readonly<Record<string, Sprite>>;
  /** The banners: whose move it is. */
  readonly banners: Readonly<Record<'w' | 'b', Sprite>>;
}

/** Packed as server/story-assets.ts holds them: base64 of deflated pixels. */
export interface PackedSprite {
  readonly w: number;
  readonly h: number;
  readonly px: string;
}

export async function unpackStory(packed: {
  frame: string;
  pieces: Readonly<Record<string, string>>;
  glyphs: Readonly<Record<string, PackedSprite>>;
  banners: Readonly<Record<'w' | 'b', PackedSprite>>;
}): Promise<StoryAssets> {
  const raw = (s: string) => inflate(fromBase64(s));
  const sprite = async (s: PackedSprite): Promise<Sprite> => ({ w: s.w, h: s.h, px: await raw(s.px) });
  const pieces = Object.fromEntries(
    await Promise.all(Object.entries(packed.pieces).map(async ([k, v]) => [k, await raw(v)] as const)),
  );
  const glyphs = Object.fromEntries(
    await Promise.all(Object.entries(packed.glyphs).map(async ([k, v]) => [k, await sprite(v)] as const)),
  );
  return {
    frame: await raw(packed.frame),
    pieces,
    glyphs,
    banners: { w: await sprite(packed.banners.w), b: await sprite(packed.banners.b) },
  };
}

/** Lays an RGBA picture on the RGB image at (x0, y0). */
function blit(px: Uint8Array, s: Sprite, x0: number, y0: number) {
  for (let y = 0; y < s.h; y++) {
    const ty = y0 + y;
    if (ty < 0 || ty >= STORY_H) continue;
    for (let x = 0; x < s.w; x++) {
      const tx = x0 + x;
      if (tx < 0 || tx >= STORY_W) continue;
      const si = (y * s.w + x) * 4;
      const a = s.px[si + 3] / 255;
      if (a === 0) continue;
      const o = (ty * STORY_W + tx) * 3;
      px[o] = Math.round(s.px[si] * a + px[o] * (1 - a));
      px[o + 1] = Math.round(s.px[si + 1] * a + px[o + 1] * (1 - a));
      px[o + 2] = Math.round(s.px[si + 2] * a + px[o + 2] * (1 - a));
    }
  }
}

export interface StoryPuzzle {
  /** The puzzle's position (after the opponent's move), engine numbering (a1 = 0). */
  readonly board: readonly (OgPiece | null)[];
  /** The opponent's move that set the puzzle up. */
  readonly lastMove: { readonly from: number; readonly to: number } | null;
  /** The side to find the move: at the bottom of the board. */
  readonly toMove: 'w' | 'b';
  /** The daily puzzle's number. */
  readonly number: number;
}

/** The story's pixels (RGB). */
export function composeStory(assets: StoryAssets, p: StoryPuzzle): Uint8Array {
  const px = assets.frame.slice();
  const flip = p.toMove === 'b';
  for (let sq = 0; sq < 64; sq++) {
    const file = sq % 8;
    const rank = Math.floor(sq / 8);
    const col = flip ? 7 - file : file;
    const row = flip ? rank : 7 - rank;
    const x0 = STORY_BX + col * STORY_SQ;
    const y0 = STORY_BY + row * STORY_SQ;
    const base = (file + rank) % 2 === 1 ? LIGHT : DARK;
    const lit = p.lastMove && (p.lastMove.from === sq || p.lastMove.to === sq);
    const color = lit ? base.map((c, i) => Math.round(c * (1 - LAST_ALPHA) + LAST[i] * LAST_ALPHA)) : base;
    for (let y = 0; y < STORY_SQ; y++) {
      let o = ((y0 + y) * STORY_W + x0) * 3;
      for (let x = 0; x < STORY_SQ; x++, o += 3) {
        px[o] = color[0];
        px[o + 1] = color[1];
        px[o + 2] = color[2];
      }
    }
    const piece = p.board[sq];
    const sprite = piece && assets.pieces[piece.color + piece.type];
    if (sprite) blit(px, { w: STORY_SQ, h: STORY_SQ, px: sprite }, x0, y0);
  }
  // "#42", centred.
  const chars = `#${p.number}`
    .split('')
    .map((c) => assets.glyphs[c])
    .filter((g): g is Sprite => !!g);
  const gap = 6;
  const width = chars.reduce((n, g) => n + g.w, 0) + gap * (chars.length - 1);
  let x = Math.round((STORY_W - width) / 2);
  for (const g of chars) {
    blit(px, g, x, NUMBER_Y - Math.round(g.h / 2));
    x += g.w + gap;
  }
  const banner = assets.banners[p.toMove];
  blit(px, banner, Math.round((STORY_W - banner.w) / 2), BANNER_Y);
  return px;
}

export const encodeStory = (assets: StoryAssets, p: StoryPuzzle) =>
  encodePng(composeStory(assets, p), STORY_W, STORY_H);
