// The shoe shop's goods (src/ui/StorePage.tsx, shop "shoes"): 30 pairs in three kinds, punk
// boots first. Drawn in the full figure's 200×360 box (src/avatar/figure.ts), one per ankle, the
// toe pointing outwards; a pair replaces the plain black boots. Pure: no DOM.

import { clipTo } from './body.ts';
import type { BodyGeom } from './body.ts';

const INK = '#141016';

export type ShoeKind = 'postal' | 'boot' | 'sneaker';

interface ShoeSpec {
  readonly kind: ShoeKind;
  readonly price: number;
  /** The upper's colour, and the sole's. */
  readonly c: string;
  readonly sole: string;
  /** Where the shaft ends (330: a low shoe, 262: up to the knee). */
  readonly top: number;
  /** How far the toe reaches, and how thick the sole is. */
  readonly toe?: number;
  readonly plat?: number;
  /** A pointed toe and a heel (cowboy). */
  readonly pointy?: boolean;
  readonly laces?: string;
  /** Stitching where the upper meets the sole (the yellow welt of a work boot). */
  readonly welt?: string;
  readonly cap?: string;
  readonly buckles?: number;
  readonly spikes?: boolean;
  readonly studs?: boolean;
  readonly chain?: boolean;
  readonly ring?: boolean;
  readonly panel?: string;
  readonly band?: string;
  readonly collar?: string;
  readonly tread?: boolean;
  readonly pattern?: 'camo' | 'checker' | 'splatter' | 'patches' | 'flames';
}

const SHOES: Readonly<Record<string, ShoeSpec>> = {
  // Postallar: lace-up combat boots.
  combat8: { kind: 'postal', price: 160, c: '#141216', sole: '#1d1b21', top: 304, laces: '#2a2830', welt: '#e8c84a' },
  combat14: { kind: 'postal', price: 210, c: '#141216', sole: '#1d1b21', top: 284, laces: '#2a2830', welt: '#e8c84a' },
  oxblood: { kind: 'postal', price: 240, c: '#5a1420', sole: '#1d1b21', top: 276, laces: '#2a0a0e', welt: '#e8c84a' },
  steeltoe: { kind: 'postal', price: 230, c: '#141216', sole: '#1d1b21', top: 300, laces: '#2a2830', cap: '#b8b4bc' },
  armyboot: {
    kind: 'postal',
    price: 180,
    c: '#3d4526',
    sole: '#141016',
    top: 292,
    laces: '#1d2010',
    tread: true,
    plat: 2,
  },
  jungle: {
    kind: 'postal',
    price: 190,
    c: '#6b7a45',
    sole: '#141016',
    top: 294,
    laces: '#2f3620',
    tread: true,
    pattern: 'camo',
  },
  desert: { kind: 'postal', price: 170, c: '#c8a46a', sole: '#7a5a30', top: 300, laces: '#7a5a30', tread: true },
  pinkcombat: {
    kind: 'postal',
    price: 200,
    c: '#ff2e93',
    sole: '#141016',
    top: 294,
    laces: '#141016',
    welt: '#f1eee8',
  },
  limecombat: {
    kind: 'postal',
    price: 200,
    c: '#c6ff3d',
    sole: '#141016',
    top: 294,
    laces: '#141016',
    welt: '#141016',
  },
  splatboot: {
    kind: 'postal',
    price: 220,
    c: '#141216',
    sole: '#1d1b21',
    top: 292,
    laces: '#2a2830',
    pattern: 'splatter',
  },
  whitecombat: {
    kind: 'postal',
    price: 210,
    c: '#f1eee8',
    sole: '#141016',
    top: 294,
    laces: '#141016',
    welt: '#e8c84a',
  },
  patched: {
    kind: 'postal',
    price: 190,
    c: '#1d1b21',
    sole: '#141016',
    top: 292,
    laces: '#3a3640',
    pattern: 'patches',
  },
  studded: { kind: 'postal', price: 250, c: '#141216', sole: '#1d1b21', top: 290, laces: '#2a2830', studs: true },
  // Çizmeler: boots without laces.
  buckles: { kind: 'boot', price: 260, c: '#141216', sole: '#1d1b21', top: 276, buckles: 3 },
  spiked: { kind: 'boot', price: 300, c: '#141216', sole: '#1d1b21', top: 282, spikes: true, buckles: 1 },
  platform: { kind: 'boot', price: 280, c: '#141216', sole: '#2a2830', top: 280, plat: 12, buckles: 2 },
  chained: { kind: 'boot', price: 240, c: '#1d1b21', sole: '#141016', top: 290, chain: true },
  engineer: { kind: 'boot', price: 230, c: '#2a1e18', sole: '#141016', top: 290, ring: true, buckles: 1 },
  kneehigh: { kind: 'boot', price: 320, c: '#151318', sole: '#141016', top: 262, buckles: 2 },
  cowboyboot: { kind: 'boot', price: 270, c: '#7a4a24', sole: '#3a2410', top: 290, pointy: true, studs: true },
  chelsea: { kind: 'boot', price: 180, c: '#151318', sole: '#2a2830', top: 306, panel: '#3a3640' },
  creeper: { kind: 'boot', price: 190, c: '#141216', sole: '#c8a46a', top: 322, plat: 9, laces: '#3a3640' },
  flameboot: { kind: 'boot', price: 290, c: '#141216', sole: '#1d1b21', top: 288, pattern: 'flames' },
  // Spor: sneakers.
  hightop: {
    kind: 'sneaker',
    price: 120,
    c: '#1d1b21',
    sole: '#f1eee8',
    top: 312,
    laces: '#f1eee8',
    cap: '#f1eee8',
    band: '#141016',
  },
  canvas: { kind: 'sneaker', price: 70, c: '#c8182a', sole: '#f1eee8', top: 324, laces: '#f1eee8', cap: '#f1eee8' },
  checker: { kind: 'sneaker', price: 90, c: '#f1eee8', sole: '#f1eee8', top: 326, pattern: 'checker' },
  runner: { kind: 'sneaker', price: 110, c: '#c6ff3d', sole: '#f1eee8', top: 324, laces: '#141016', band: '#ff2e93' },
  basket: {
    kind: 'sneaker',
    price: 150,
    c: '#f1eee8',
    sole: '#f1eee8',
    top: 310,
    laces: '#141016',
    band: '#e5352b',
    collar: '#e5352b',
  },
  skate: {
    kind: 'sneaker',
    price: 100,
    c: '#4a4752',
    sole: '#f1eee8',
    top: 322,
    laces: '#f1eee8',
    collar: '#2a2830',
    plat: 3,
  },
  chunky: {
    kind: 'sneaker',
    price: 140,
    c: '#f1eee8',
    sole: '#e9e4d8',
    top: 322,
    laces: '#d8d4dc',
    band: '#4aa8ff',
    plat: 7,
  },
};

const f = (x: number) => x.toFixed(1);

/** One shoe in its own box: the ankle at x 0, the toe towards +x. */
function shoe(k: ShoeSpec): string {
  const toe = k.toe ?? (k.kind === 'sneaker' ? 9 : 8);
  const plat = k.plat ?? 0;
  const top = k.top;
  // The shaft widens a little up the shin; the foot runs to the toe; the sole under both.
  const hw = (y: number) => 12.5 + (334 - y) * 0.08;
  const shaft = `M${f(-hw(top))} ${top} L${f(hw(top))} ${top} L13.5 334 L-13.5 334 Z`;
  const tip = k.pointy ? `L${13 + toe + 6} 338` : `C${f(13 + toe + 2)} 330 ${f(13 + toe + 2)} 340 ${f(13 + toe)} 340`;
  const foot = `M-13.5 328 L9 328 C14 328 ${f(13 + toe - 2)} 330 ${f(13 + toe - 1)} 332 ${tip} L-14 340 Z`;
  const soleY = 340;
  const sole = `M-15 ${soleY} H${f(14 + toe + (k.pointy ? 4 : 1))} V${soleY + 3 + plat} H-15 Z`;
  const heel = k.pointy
    ? `<path d="M-15 ${soleY} h9 l-1 8 h-7z" fill="${k.sole}" stroke="${INK}" stroke-width="2"/>`
    : '';
  const upper = [shaft, foot];

  let detail = '';
  if (k.pattern === 'camo')
    detail += [
      [-6, top + 8],
      [5, top + 22],
      [-4, 322],
      [10, 334],
      [6, top + 2],
    ]
      .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="6" ry="3.5" fill="#4a5530"/>`)
      .join('');
  if (k.pattern === 'splatter')
    detail += [
      [-5, top + 10, 3, '#ff2e93'],
      [6, top + 24, 2.2, '#c6ff3d'],
      [-2, 320, 2.6, '#ff2e93'],
      [12, 334, 2, '#c6ff3d'],
      [3, top + 4, 1.6, '#f1eee8'],
    ]
      .map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`)
      .join('');
  if (k.pattern === 'patches')
    detail +=
      `<rect x="-9" y="${top + 8}" width="8" height="7" fill="#ff2e93" stroke="${INK}" stroke-width="1" transform="rotate(-8 -5 ${top + 11})"/>` +
      `<rect x="3" y="${top + 22}" width="7" height="7" fill="#c6ff3d" stroke="${INK}" stroke-width="1" transform="rotate(10 6 ${top + 25})"/>`;
  if (k.pattern === 'flames')
    detail += `<path d="M-13 334 C-10 322 -6 326 -5 316 C-2 324 1 318 3 308 C5 318 9 314 10 304 C12 316 16 322 20 334 Z" fill="#ff5a1f" stroke="${INK}" stroke-width="1"/><path d="M-8 334 C-6 326 -3 328 -2 322 C0 328 3 324 5 318 C7 326 10 328 12 334 Z" fill="#ffb02e"/>`;
  if (k.pattern === 'checker') {
    for (let y = top; y < 340; y += 4)
      for (let x = -14; x < 14 + toe; x += 4)
        if (((x + 14) / 4 + (y - top) / 4) % 2 === 0)
          detail += `<rect x="${x}" y="${y}" width="4" height="4" fill="${INK}"/>`;
  }
  if (k.panel) detail += `<path d="M-6 ${top} L0 322 L6 ${top} Z" fill="${k.panel}"/>`;
  if (k.cap)
    detail += `<path d="M6 328 C14 328 ${f(13 + toe)} 332 ${f(13 + toe)} 340 L4 340 Z" fill="${k.cap}" stroke="${INK}" stroke-width="1.2"/>`;
  if (k.band)
    detail += `<path d="M-13 336 C-4 334 6 330 ${f(13 + toe)} 334" fill="none" stroke="${k.band}" stroke-width="3"/>`;

  // Laces: eyelets up the front, crossed.
  let laces = '';
  if (k.laces) {
    for (let y = top + 4; y < 328; y += 6)
      laces += `<path d="M-5 ${y} L5 ${y + 4} M5 ${y} L-5 ${y + 4}" stroke="${k.laces}" stroke-width="1.6" stroke-linecap="round"/><circle cx="-5.5" cy="${y}" r="1.1" fill="#b8b4bc"/><circle cx="5.5" cy="${y}" r="1.1" fill="#b8b4bc"/>`;
  }
  let straps = '';
  for (let i = 0; i < (k.buckles ?? 0); i++) {
    const y = top + 6 + i * 11;
    straps += `<rect x="${f(-hw(y) - 0.5)}" y="${y}" width="${f(2 * hw(y) + 1)}" height="4" fill="#2a2830" stroke="${INK}" stroke-width="1"/><rect x="${f(hw(y) - 6)}" y="${y - 1}" width="5" height="6" fill="none" stroke="#d8d4dc" stroke-width="1.4"/>`;
  }
  if (k.spikes)
    straps +=
      [-9, -3, 3, 9]
        .map((x) => `<path d="M${x - 2.5} ${top} l2.5 -7 l2.5 7z" fill="#d8d4dc" stroke="${INK}" stroke-width=".8"/>`)
        .join('') + `<path d="M8 332 l5 -5 l1 6z" fill="#d8d4dc" stroke="${INK}" stroke-width=".8"/>`;
  if (k.studs)
    straps += [
      [-8, top + 6],
      [0, top + 6],
      [8, top + 6],
      [-8, 316],
      [8, 316],
      [12, 334],
    ]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#d8d4dc" stroke="${INK}" stroke-width=".7"/>`)
      .join('');
  if (k.chain)
    straps += `<path d="M-13 324 C-4 334 6 334 15 326" fill="none" stroke="#d8d4dc" stroke-width="2.4" stroke-dasharray="3 2"/>`;
  if (k.ring)
    straps += `<path d="M-13 322 L4 330 L15 324" fill="none" stroke="#2a2830" stroke-width="3"/><circle cx="4" cy="330" r="3" fill="none" stroke="#d8d4dc" stroke-width="1.6"/>`;
  if (k.collar)
    straps += `<rect x="${f(-hw(top) - 0.5)}" y="${top}" width="${f(2 * hw(top) + 1)}" height="5" fill="${k.collar}" stroke="${INK}" stroke-width="1.2"/>`;

  const welt = k.welt
    ? `<path d="M-14 ${soleY + 1.2} H${f(13 + toe)}" stroke="${k.welt}" stroke-width="1.2" stroke-dasharray="2 1.5"/>`
    : '';
  const tread = k.tread
    ? `<path d="M-14 ${soleY + 3 + plat} ${Array.from({ length: 8 }, () => `l${f((28 + toe) / 16)} -2.5 l${f((28 + toe) / 16)} 2.5`).join(' ')}" fill="none" stroke="${INK}" stroke-width="1.2"/>`
    : '';
  const ridges =
    plat >= 7
      ? [soleY + 3 + plat / 2]
          .map((y) => `<path d="M-14 ${y} H${f(13 + toe)}" stroke="${INK}" stroke-width="1" opacity=".6"/>`)
          .join('')
      : '';

  return (
    upper
      .map((d) => `<path d="${d}" fill="${k.c}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`)
      .join('') +
    clipTo(upper, detail) +
    laces +
    straps +
    `<path d="${sole}" fill="${k.sole}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` +
    heel +
    welt +
    tread +
    ridges
  );
}

/** A pair of shoes on the figure's ankles, or null when `id` is none of them. */
export function shoesSvg(id: string | null, g: BodyGeom): string | null {
  const k = id ? SHOES[id] : undefined;
  if (!k) return null;
  const one = shoe(k);
  return [-1, 1].map((side, i) => `<g transform="translate(${f(g.ankles[i])} 0) scale(${side} 1)">${one}</g>`).join('');
}

/** The shoe shop's goods and their prices (punk coins). */
export const SHOE_ITEMS: readonly { readonly id: string; readonly slot: 'shoes'; readonly price: number }[] =
  Object.entries(SHOES).map(([id, k]) => ({ id, slot: 'shoes' as const, price: k.price }));

/** A pair's kind (the shop's tabs). */
export const shoeKind = (id: string): ShoeKind | null => SHOES[id]?.kind ?? null;
export const SHOE_KINDS: readonly ShoeKind[] = ['postal', 'boot', 'sneaker'];
