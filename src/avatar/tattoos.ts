// The tattoo parlour's goods (src/ui/StorePage.tsx, shop "tattoo"): 20 tattoos, ten for the
// face and ten for the neck, the skin every character shows whatever it wears. Drawn in the
// head's 200×200 box (src/avatar/avatar.ts): the face between the eyes and the chin (x 50–150,
// y 95–165), the neck below the jaw (x 72–128, y 172–198). Pure: no DOM.

import type { StoreItem } from './outfit.ts';

/** Tattoo ink: a dark blue-black, slightly see-through so the skin shows in it. */
const INK = '#16162a';
const RED = '#d21f3c';
const ink = `fill="${INK}" opacity=".85"`;
const line = (w = 2.5) =>
  `fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity=".85"`;

/** A five-pointed star of radius `r` at (x, y). */
const star = (x: number, y: number, r: number) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    return `${(x + rr * Math.cos(a)).toFixed(1)} ${(y + rr * Math.sin(a)).toFixed(1)}`;
  });
  return `M${pts.join(' L')}Z`;
};

/** A nautical star's dark halves: one side of each point, from the centre. */
const nauticalHalves = (x: number, y: number, r: number) =>
  Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const b = a + Math.PI / 5;
    const p = (ang: number, rr: number) =>
      `${(x + rr * Math.cos(ang)).toFixed(1)} ${(y + rr * Math.sin(ang)).toFixed(1)}`;
    return `M${x} ${y}L${p(a, r)}L${p(b, r * 0.45)}Z`;
  }).join('');

/** A heart of width `w` centred at (x, y). */
const heart = (x: number, y: number, w: number) => {
  const h = w / 2;
  return `M${x} ${y + h * 0.9}C${x - w} ${y}, ${x - h * 0.6} ${y - h * 1.1}, ${x} ${y - h * 0.3}C${x + h * 0.6} ${y - h * 1.1}, ${x + w} ${y}, ${x} ${y + h * 0.9}Z`;
};

/** The circled A of anarchy, radius `r`. */
const anarchy = (x: number, y: number, r: number, w = 2) =>
  `<circle cx="${x}" cy="${y}" r="${r}" ${line(w)}/><path d="M${x - r * 0.75} ${y + r * 0.95}L${x} ${y - r * 1.1}L${x + r * 0.75} ${y + r * 0.95}M${x - r * 0.95} ${y + r * 0.2}H${x + r * 0.95}" ${line(w)}/>`;

const FACE: Readonly<Record<string, readonly [price: number, svg: string]>> = {
  // A teardrop under the left eye.
  'tf-tear': [80, `<path d="M70 114c-3 5-4 8-1 10s6 0 5-3c0-2-2-4-4-7z" ${ink}/>`],
  // A star on the right cheekbone.
  'tf-star': [90, `<path d="${star(136, 122, 7)}" ${ink}/>`],
  // Three dots at the corner of the right eye.
  'tf-dots': [
    70,
    `<g ${ink}><circle cx="141" cy="102" r="2"/><circle cx="145" cy="108" r="2"/><circle cx="137" cy="108" r="2"/></g>`,
  ],
  // The circled A on the left cheek.
  'tf-anarchy': [140, anarchy(64, 128, 8, 1.8)],
  // A lightning bolt beside the right eye.
  'tf-bolt': [120, `<path d="M146 88l-6 14h6l-5 14 11-17h-6l4-11z" ${ink}/>`],
  // A small cross under the right eye.
  'tf-cross': [80, `<path d="M131 112v12M126 116h10" ${line(2.4)}/>`],
  // A red heart on the left cheek.
  'tf-heart': [110, `<path d="${heart(66, 126, 10)}" fill="${RED}" stroke="${INK}" stroke-width="1.5" opacity=".9"/>`],
  // A spider's web in the corner of the left cheek.
  'tf-web': [
    160,
    `<g ${line(1.3)}><path d="M52 112l16 22M52 112l22 8M52 112l6 26M52 112l24-4"/><path d="M58 117c3 0 5-1 6-3M60 122c5 1 9-1 11-4M62 129c6 1 11-2 14-7"/></g>`,
  ],
  // Three lines down the chin.
  'tf-chin': [100, `<path d="M92 154v10M100 156v11M108 154v10" ${line(3)}/>`],
  // A crown over the right eyebrow.
  'tf-crown': [150, `<path d="M120 86l2-9 4 5 4-7 4 7 4-5 2 9z" ${ink}/>`],
};

const NECK: Readonly<Record<string, readonly [price: number, svg: string]>> = {
  // A swallow flying across the neck.
  'tn-swallow': [
    180,
    `<path d="M84 186c6-8 14-10 20-6 4-6 12-8 18-4-6 0-10 3-12 7l8 6c-8 2-14 0-18-4-4 4-10 6-16 1z" fill="${INK}" opacity=".85"/><path d="M104 180c2 4 6 6 10 6" fill="none" stroke="${RED}" stroke-width="2.5" opacity=".9"/>`,
  ],
  // A nautical star, half filled.
  'tn-star': [150, `<path d="${star(100, 186, 11)}" ${line(1.8)}/><path d="${nauticalHalves(100, 186, 11)}" ${ink}/>`],
  // A spider's web over the throat.
  'tn-web': [
    170,
    `<g ${line(1.3)}><path d="M100 198V174M100 198L80 180M100 198L120 180M100 198L76 196M100 198L124 196"/><path d="M90 192c3-3 7-4 10-4s7 1 10 4M84 186c5-5 11-7 16-7s11 2 16 7"/></g>`,
  ],
  // A barcode.
  'tn-barcode': [
    120,
    `<g fill="${INK}" opacity=".85">${[
      [82, 2],
      [86, 1],
      [89, 3],
      [94, 1],
      [97, 2],
      [101, 1],
      [104, 3],
      [109, 1],
      [112, 2],
      [116, 1],
    ]
      .map(([x, w]) => `<rect x="${x}" y="178" width="${w}" height="16"/>`)
      .join('')}</g>`,
  ],
  // A red rose with two leaves.
  'tn-rose': [
    200,
    `<path d="M88 192c-4-2-8 0-8 0s4-6 10-3zM112 192c4-2 8 0 8 0s-4-6-10-3z" fill="#2e7d3a" opacity=".85"/><circle cx="100" cy="186" r="9" fill="${RED}" stroke="${INK}" stroke-width="1.5" opacity=".9"/><path d="M96 185c2-4 8-4 8 1s-6 5-7 1" fill="none" stroke="${INK}" stroke-width="1.4" opacity=".8"/>`,
  ],
  // A dagger pointing down.
  'tn-dagger': [
    160,
    `<path d="M100 174v4M92 180h16" ${line(2.6)}/><path d="M97 182h6l-3 16z" fill="${INK}" opacity=".85"/><circle cx="100" cy="174" r="2" fill="${RED}"/>`,
  ],
  // A crown.
  'tn-crown': [190, `<path d="M86 194l-2-14 8 6 8-10 8 10 8-6-2 14z" ${ink}/><path d="M86 194h28" ${line(2)}/>`],
  // A heartbeat line across the neck.
  'tn-pulse': [130, `<path d="M74 188h14l4-8 5 16 5-20 4 12h20" ${line(2.2)}/>`],
  // A chain all round the neck.
  'tn-chain': [
    140,
    `<g ${line(1.8)}>${[78, 89, 100, 111, 122].map((x) => `<ellipse cx="${x}" cy="190" rx="6" ry="3.5"/>`).join('')}</g>`,
  ],
  // A big circled A.
  'tn-anarchy': [220, anarchy(100, 186, 11, 2.2)],
};

/** The parlour's goods, face tattoos first. */
export const TATTOO_ITEMS: readonly StoreItem[] = [
  ...Object.entries(FACE).map(([id, [price]]) => ({ id, slot: 'tattooFace' as const, price })),
  ...Object.entries(NECK).map(([id, [price]]) => ({ id, slot: 'tattooNeck' as const, price })),
];

/** A face tattoo, in the head's box (null or unknown: none). */
export const faceTattooSvg = (id: string | null): string => (id ? (FACE[id]?.[1] ?? '') : '');

/** A neck tattoo, in the head's box (null or unknown: none). */
export const neckTattooSvg = (id: string | null): string => (id ? (NECK[id]?.[1] ?? '') : '');
