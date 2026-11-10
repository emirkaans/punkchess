// Draws the daily-puzzle story's fixed parts ahead of time (the Worker has no font rendering):
//   npm run story-assets  ->  server/story-assets.ts  (frame, pieces, digits, banners, packed)
//                             story-sample.png        (a sample story, not committed)
// Fonts in scripts/og-assets/ (Permanent Marker: Apache 2.0; the others: OFL).

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { Resvg } from '@resvg/resvg-js';
import { createGame, listVariants } from '../src/engine/index.ts';
import type { Color } from '../src/engine/index.ts';
import { BANNER_Y, STORY_BX, STORY_BY, STORY_H, STORY_SQ, STORY_W, encodeStory } from '../server/story-image.ts';
import type { Sprite, StoryAssets } from '../server/story-image.ts';

const FONTS = [
  'scripts/og-assets/PermanentMarker-Regular.ttf',
  'scripts/og-assets/BebasNeue.ttf',
  'scripts/og-assets/SedgwickAve.ttf',
  'scripts/og-assets/SpaceMono-Bold.ttf',
  'scripts/og-assets/chess-glyphs.ttf',
];

function render(svg: string): Sprite {
  const r = new Resvg(svg, { font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Bebas Neue' } });
  const img = r.render();
  return { w: img.width, h: img.height, px: new Uint8Array(img.pixels) };
}

/** The picture cut to the columns and rows that have ink. */
function trim(s: Sprite): Sprite {
  let x0 = s.w;
  let x1 = -1;
  let y0 = s.h;
  let y1 = -1;
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++)
      if (s.px[(y * s.w + x) * 4 + 3] > 8) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    px.set(s.px.subarray(((y0 + y) * s.w + x0) * 4, ((y0 + y) * s.w + x1 + 1) * 4), y * w * 4);
  return { w, h, px };
}

const PINK = '#ff2e93';
const LIME = '#c6ff3d';
const BONE = '#f1eee8';
const INK = '#0a0a0b';
const BOARD = 8 * STORY_SQ;

// --- the frame ---

const CROWN =
  '<path d="M4 42h56M6 38L2 10l16 12 14-20 14 20 16-12-4 28z" fill="#c6ff3d" stroke="#141016" stroke-width="3" stroke-linejoin="round"/><circle cx="32" cy="6" r="4" fill="#ff2e93"/>';
const frameSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${STORY_W}" height="${STORY_H}" viewBox="0 0 ${STORY_W} ${STORY_H}">
  <rect width="${STORY_W}" height="${STORY_H}" fill="#0e0e10"/>
  <g transform="translate(262 196) scale(1.45)">${CROWN}</g>
  <text x="364" y="276" font-family="Permanent Marker" font-size="104"><tspan fill="${PINK}">punk</tspan><tspan fill="${BONE}">chess</tspan></text>
  <text x="${STORY_W / 2}" y="430" text-anchor="middle" font-family="Bebas Neue" font-size="136" letter-spacing="6"><tspan fill="${BONE}">GÜNÜN </tspan><tspan fill="${PINK}">SABOTAJI</tspan></text>
  <rect x="${STORY_BX - 12 + 24}" y="${STORY_BY - 12 + 24}" width="${BOARD + 24}" height="${BOARD + 24}" fill="#000"/>
  <rect x="${STORY_BX - 12}" y="${STORY_BY - 12}" width="${BOARD + 24}" height="${BOARD + 24}" fill="${PINK}"/>
  <text x="${STORY_W / 2}" y="1700" text-anchor="middle" font-family="Space Mono" font-weight="700" font-size="48" fill="${BONE}">punkchess.com/daily</text>
</svg>`;
const frameRgba = render(frameSvg).px;
const frame = new Uint8Array(STORY_W * STORY_H * 3);
for (let i = 0, j = 0; i < frameRgba.length; i += 4, j += 3) {
  frame[j] = frameRgba[i];
  frame[j + 1] = frameRgba[i + 1];
  frame[j + 2] = frameRgba[i + 2];
}

// --- the pieces: the classic look (the site's glyphs, "Klasik" colours) ---

const STYLE: Record<Color, { fill: string; stroke: string }> = {
  w: { fill: '#fafafa', stroke: '#222222' },
  b: { fill: '#222222', stroke: '#8a8a8a' },
};
const pieces: Record<string, Uint8Array> = {};
for (const def of Object.values(listVariants()[0].pieces)) {
  if (def.icon.kind !== 'glyph') continue;
  const glyph = def.icon.glyph.replace('︎', '');
  for (const c of ['w', 'b'] as const) {
    pieces[c + def.type] = render(`<svg xmlns="http://www.w3.org/2000/svg" width="${STORY_SQ}" height="${STORY_SQ}">
      <text x="${STORY_SQ / 2}" y="${STORY_SQ * 0.82}" text-anchor="middle" font-family="Noto Sans Symbols 2" font-size="${STORY_SQ * 0.8}"
        fill="${STYLE[c].fill}" stroke="${STYLE[c].stroke}" stroke-width="2.6" stroke-linejoin="round" paint-order="stroke">${glyph}</text>
    </svg>`).px;
  }
}

// --- "#" and the digits ---

const glyphs: Record<string, Sprite> = {};
for (const ch of '#0123456789')
  glyphs[ch] = trim(
    render(`<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140">
      <text x="70" y="104" text-anchor="middle" font-family="Sedgwick Ave" font-size="92" fill="${LIME}">${ch}</text>
    </svg>`),
  );

// --- the banners ---

const banner = (text: string, fill: string, color: string, outline: string) =>
  trim(
    render(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="220">
      <g transform="rotate(-2 450 110)">
        <rect x="${450 - 330 + 14}" y="${110 - 62 + 14}" width="660" height="124" fill="#000"/>
        <rect x="${450 - 330}" y="${110 - 62}" width="660" height="124" fill="${fill}" ${outline ? `stroke="${outline}" stroke-width="6"` : ''}/>
        <text x="450" y="${110 + 38}" text-anchor="middle" font-family="Bebas Neue" font-size="104" letter-spacing="9" fill="${color}">${text}</text>
      </g>
    </svg>`),
  );
const banners = { w: banner('WHITE TO MOVE', LIME, INK, ''), b: banner('BLACK TO MOVE', INK, BONE, BONE) };

// --- write ---

const pack = (data: Uint8Array) => deflateSync(data, { level: 9 }).toString('base64');
const packSprite = (s: Sprite) => `{ w: ${s.w}, h: ${s.h}, px: '${pack(s.px)}' }`;
const lines = [
  '// Generated by scripts/make-story-assets.ts (npm run story-assets): do not edit.',
  '// The daily-puzzle story: frame (RGB), pieces, digits and banners (RGBA), deflated, base64.',
  '',
  "import type { PackedSprite } from './story-image.ts';",
  '',
  `export const STORY_FRAME = '${pack(frame)}';`,
  '',
  'export const STORY_PIECES: Readonly<Record<string, string>> = {',
  ...Object.entries(pieces).map(([k, v]) => `  ${k}: '${pack(v)}',`),
  '};',
  '',
  'export const STORY_GLYPHS: Readonly<Record<string, PackedSprite>> = {',
  ...Object.entries(glyphs).map(([k, v]) => `  '${k}': ${packSprite(v)},`),
  '};',
  '',
  `export const STORY_BANNERS: Readonly<Record<'w' | 'b', PackedSprite>> = {`,
  `  w: ${packSprite(banners.w)},`,
  `  b: ${packSprite(banners.b)},`,
  '};',
  '',
];
writeFileSync('server/story-assets.ts', lines.join('\n'));

const assets: StoryAssets = { frame, pieces, glyphs, banners };
const v = listVariants()[0];
const sample = createGame(v, 'r1bq1rk1/pp3ppp/2n2n2/3pp3/1bPP4/2N1PN2/PP3PPP/R1BQKB1R w KQ - 0 7').position.board;
writeFileSync(
  'story-sample.png',
  await encodeStory(assets, { board: sample, lastMove: { from: 51, to: 35 }, toMove: 'w', number: 42 }),
);
writeFileSync(
  'story-sample-b.png',
  await encodeStory(assets, { board: sample, lastMove: { from: 12, to: 28 }, toMove: 'b', number: 108 }),
);
console.log(`server/story-assets.ts written (banner at y ${BANNER_Y})`);
