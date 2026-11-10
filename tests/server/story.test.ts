// The daily puzzle as an Instagram story (server/story.ts, server/story-image.ts).

import { describe, expect, it } from 'vitest';
import { STORY_BANNERS, STORY_FRAME, STORY_GLYPHS, STORY_PIECES } from '../../server/story-assets.ts';
import { STORY_BX, STORY_BY, STORY_H, STORY_SQ, STORY_W, composeStory, unpackStory } from '../../server/story-image.ts';
import { storyPuzzle } from '../../server/story.ts';

const puzzle = {
  id: 'p1',
  variantId: 'standard',
  // Before the opponent's move: Black plays ...d5, then it is White's turn.
  fen: 'r1bqkbnr/pppppppp/2n5/8/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 2 2',
  moves: ['d7d5', 'e4d5'],
  rating: 1500,
  themes: [],
};

describe('günün sabotajı hikayesi', () => {
  it('rakibin ilk hamlesi oynanmış konum, o hamle işaretli, sıra bulmacayı çözende', () => {
    const p = storyPuzzle(puzzle, 42)!;
    expect(p.toMove).toBe('w');
    expect(p.lastMove).toEqual({ from: 51, to: 35 });
    expect(p.board[35]).toMatchObject({ type: 'p', color: 'b' });
    expect(p.number).toBe(42);
    expect(storyPuzzle({ ...puzzle, moves: ['a1a8'] }, 1)).toBeNull();
  });

  it('1080×1920; son hamlenin kareleri boyalı; siyah oynarken tahta ters', async () => {
    const assets = await unpackStory({
      frame: STORY_FRAME,
      pieces: STORY_PIECES,
      glyphs: STORY_GLYPHS,
      banners: STORY_BANNERS,
    });
    const p = storyPuzzle(puzzle, 42)!;
    const px = composeStory(assets, p);
    expect(px.length).toBe(STORY_W * STORY_H * 3);
    // The corner of a square (no piece drawn there): d7 is on the second row from the top.
    const at = (col: number, row: number) => {
      const o = ((STORY_BY + row * STORY_SQ + 2) * STORY_W + STORY_BX + col * STORY_SQ + 2) * 3;
      return [px[o], px[o + 1], px[o + 2]];
    };
    const d7 = at(3, 1);
    const c7 = at(2, 1);
    expect(d7).not.toEqual(c7.map((c) => c)); // tinted
    expect(d7[0]).toBeGreaterThan(d7[2]); // warm
    const flipped = composeStory(assets, { ...p, toMove: 'b' });
    // Flipped: d7 is now on the seventh row from the top, fifth column.
    const o = ((STORY_BY + 6 * STORY_SQ + 2) * STORY_W + STORY_BX + 4 * STORY_SQ + 2) * 3;
    expect([flipped[o], flipped[o + 1], flipped[o + 2]]).toEqual(d7);
  });
});
