// The second wave of goods: 20 jackets, 20 trousers, 15 hats and 15 accessories for the store
// (drawn here from a few shapes and patterns), plus their prices. The barber's second wave is in
// src/avatar/barber.ts. Body items are in the full figure's 200×360 box (src/avatar/figure.ts),
// head items in the head's 200×200 box (src/avatar/avatar.ts). Pure: no DOM.

import type { OutfitSlot } from './outfit.ts';
import { NECK_BAND, bootsSvg, clipTo } from './body.ts';
import type { BodyGeom } from './body.ts';

const INK = '#141016';

// ---------------------------------------------------------------------------
// Patterns, drawn over a box and clipped to a shape.

type Box = readonly [x: number, y: number, w: number, h: number];

const range = (from: number, to: number, step: number) => {
  const out: number[] = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
};

const PATTERNS: Readonly<Record<string, (b: Box, c: readonly string[]) => string>> = {
  stripesV: ([x, y, w, h], [c]) =>
    range(x + 4, x + w, 12)
      .map((v) => `<path d="M${v} ${y}v${h}" stroke="${c}" stroke-width="5"/>`)
      .join(''),
  stripesH: ([x, y, w, h], [c]) =>
    range(y + 6, y + h, 14)
      .map((v) => `<path d="M${x} ${v}h${w}" stroke="${c}" stroke-width="4"/>`)
      .join(''),
  plaid: ([x, y, w, h], [c1, c2]) =>
    range(x + 6, x + w, 14)
      .map((v) => `<path d="M${v} ${y}v${h}" stroke="${c1}" stroke-width="3" opacity=".75"/>`)
      .join('') +
    range(y + 8, y + h, 16)
      .map((v) => `<path d="M${x} ${v}h${w}" stroke="${c1}" stroke-width="3" opacity=".75"/>`)
      .join('') +
    range(x + 13, x + w, 28)
      .map((v) => `<path d="M${v} ${y}v${h}" stroke="${c2}" stroke-width="1.2"/>`)
      .join(''),
  check: ([x, y, w, h], [c]) =>
    range(y, y + h, 12)
      .flatMap((v, j) =>
        range(x + (j % 2) * 12, x + w, 24).map((u) => `<rect x="${u}" y="${v}" width="12" height="12" fill="${c}"/>`),
      )
      .join(''),
  dots: ([x, y, w, h], [c]) =>
    range(y + 6, y + h, 14)
      .flatMap((v, j) =>
        range(x + 6 + (j % 2) * 7, x + w, 14).map((u) => `<circle cx="${u}" cy="${v}" r="2.6" fill="${c}"/>`),
      )
      .join(''),
  leopard: ([x, y, w, h], [c]) =>
    range(y + 8, y + h, 18)
      .flatMap((v, j) =>
        range(x + 8 + (j % 2) * 10, x + w, 20).map(
          (u) =>
            `<path d="M${u - 5} ${v}c0-5 10-5 10 0s-10 5-10 0" fill="none" stroke="${c}" stroke-width="2.6"/><circle cx="${u}" cy="${v}" r="1.6" fill="${c}"/>`,
        ),
      )
      .join(''),
  zebra: ([x, y, w, h], [c]) =>
    range(y + 4, y + h, 13)
      .map(
        (v, j) =>
          `<path d="M${x} ${v}q${w / 4} ${j % 2 ? 8 : -8} ${w / 2} 0t${w / 2} 0" fill="none" stroke="${c}" stroke-width="5"/>`,
      )
      .join(''),
  camo: ([x, y, w, h], [c1, c2]) =>
    range(y + 8, y + h, 20)
      .flatMap((v, j) =>
        range(x + 6 + (j % 2) * 14, x + w, 28).map(
          (u, i) =>
            `<ellipse cx="${u}" cy="${v}" rx="10" ry="6" fill="${(i + j) % 2 ? c1 : c2}" transform="rotate(${(u * 7) % 60} ${u} ${v})"/>`,
        ),
      )
      .join(''),
  mesh: ([x, y, w, h], [c]) =>
    range(x - h, x + w, 8)
      .map((v) => `<path d="M${v} ${y}l${h} ${h}M${v + h} ${y}l${-h} ${h}" stroke="${c}" stroke-width="1.2"/>`)
      .join(''),
  quilt: ([x, y, w, h], [c]) =>
    range(y + 10, y + h, 16)
      .map((v) => `<path d="M${x} ${v}h${w}" stroke="${c}" stroke-width="2.5"/>`)
      .join(''),
  splatter: ([x, y, w, h], [c1, c2]) =>
    range(y + 10, y + h, 22)
      .flatMap((v, j) =>
        range(x + 8 + (j % 3) * 9, x + w, 30).map(
          (u, i) => `<circle cx="${u}" cy="${v}" r="${3 + ((u + v) % 4)}" fill="${(i + j) % 2 ? c1 : c2}"/>`,
        ),
      )
      .join(''),
};

let clipN = 0;
/** A pattern over `shape` (a path), clipped to it. */
function patterned(shape: string, box: Box, pattern: string | undefined, colors: readonly string[]): string {
  if (!pattern) return '';
  const id = `pc-clip-${(clipN = (clipN + 1) % 100000)}`;
  return `<clipPath id="${id}"><path d="${shape}"/></clipPath><g clip-path="url(#${id})">${PATTERNS[pattern](box, colors)}</g>`;
}

const studsAt = (pts: readonly (readonly [number, number])[]) =>
  pts
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#d8d4dc" stroke="${INK}" stroke-width=".8"/>`)
    .join('');

// ---------------------------------------------------------------------------
// Jackets (the upper body, as src/avatar/outfit.ts jacketSvg draws them).

interface JacketSpec {
  readonly c: string;
  /** The sleeves' colour; 'skin' for none. */
  readonly arms?: string;
  readonly pattern?: string;
  readonly pc?: readonly string[];
  /** Details over the jacket (in the figure's box). */
  readonly extra?: string;
}

const ZIP = '<path d="M100 116v116" stroke="#8a8590" stroke-width="2" stroke-dasharray="3 3"/>';
const LAPELS = (c: string) =>
  `<path d="M88 116l12 34 12-34" fill="none" stroke="${c}" stroke-width="5" stroke-linejoin="round"/>`;
const BUTTONS = (c: string) =>
  [150, 172, 194, 216]
    .map((y) => `<circle cx="104" cy="${y}" r="3" fill="${c}" stroke="${INK}" stroke-width="1"/>`)
    .join('');

const JACKETS: Readonly<Record<string, JacketSpec>> = {
  moto: {
    c: '#151318',
    extra: `<path d="M84 118l30 40v74" fill="none" stroke="#8a8590" stroke-width="2.5" stroke-dasharray="3 3"/>${studsAt(
      [
        [66, 132],
        [74, 127],
        [134, 132],
        [126, 127],
        [50, 150],
        [150, 150],
      ],
    )}`,
  },
  varsity: {
    c: '#ff2e93',
    arms: '#f1eee8',
    extra: `<text x="80" y="170" font-family="Georgia, serif" font-weight="700" font-size="30" fill="#f1eee8" stroke="${INK}" stroke-width="1.5">P</text><rect x="56" y="224" width="88" height="8" fill="#f1eee8"/>`,
  },
  trench: {
    c: '#c9a97a',
    extra: `${LAPELS('#a88a5c')}<rect x="56" y="186" width="88" height="8" fill="#8f7248" stroke="${INK}" stroke-width="1.5"/><rect x="94" y="184" width="12" height="12" fill="none" stroke="#d8d4dc" stroke-width="2"/>${BUTTONS('#5c4630')}`,
  },
  parka: {
    c: '#5d6b3c',
    extra: `<path d="M66 126c-6-20 74-20 68 0" fill="#e9e1cc" stroke="${INK}" stroke-width="3"/>${ZIP}<rect x="68" y="186" width="20" height="16" fill="#4c5830" stroke="${INK}" stroke-width="1.5"/><rect x="112" y="186" width="20" height="16" fill="#4c5830" stroke="${INK}" stroke-width="1.5"/>`,
  },
  vestpatch: {
    c: '#1d1b21',
    arms: 'skin',
    extra: `<circle cx="80" cy="150" r="9" fill="#ff2e93" stroke="${INK}" stroke-width="2"/><rect x="108" y="168" width="20" height="14" fill="#c6ff3d" stroke="${INK}" stroke-width="2" transform="rotate(-8 118 175)"/><path d="M72 196l8-10 8 10z" fill="#f1eee8" stroke="${INK}" stroke-width="1.5"/>${studsAt(
      [
        [66, 132],
        [134, 132],
      ],
    )}`,
  },
  kimono: {
    c: '#c8283a',
    extra: `<path d="M84 116l32 60M116 116l-32 60" stroke="#f1eee8" stroke-width="7"/><rect x="58" y="180" width="84" height="12" fill="#141016"/><g fill="#f1eee8" opacity=".55"><circle cx="72" cy="210" r="5"/><circle cx="126" cy="150" r="5"/><circle cx="118" cy="214" r="4"/></g>`,
  },
  blazer: {
    c: '#5b2a86',
    extra: `${LAPELS('#3e1c5e')}<path d="M100 150v82" stroke="#3e1c5e" stroke-width="2"/>${BUTTONS('#c6ff3d')}`,
  },
  windbreak: {
    c: '#1f8a8a',
    extra: `<path d="M56 170l88-28v34l-88 28z" fill="#f1eee8" opacity=".9"/><path d="M100 116v116" stroke="#126060" stroke-width="2"/>`,
  },
  track: {
    c: '#18161b',
    extra: `${ZIP}<path d="M48 140l-4 82M152 140l4 82" stroke="#f1eee8" stroke-width="4"/><path d="M53 141l-3 80M147 141l3 80" stroke="#f1eee8" stroke-width="2"/>`,
  },
  leopard: {
    c: '#d9a441',
    pattern: 'leopard',
    pc: ['#3a2410'],
    extra: `<path d="M84 118l16 22 16-22" fill="none" stroke="#141016" stroke-width="4"/>`,
  },
  camojkt: { c: '#6b7a45', pattern: 'camo', pc: ['#4a5530', '#2f3620'], extra: ZIP },
  studvest: {
    c: '#3a5f95',
    arms: 'skin',
    extra: studsAt([
      [68, 134],
      [76, 130],
      [84, 128],
      [132, 134],
      [124, 130],
      [116, 128],
      [70, 160],
      [130, 160],
      [70, 190],
      [130, 190],
      [70, 220],
      [130, 220],
    ]),
  },
  raincoat: {
    c: '#f2c21b',
    extra: `${BUTTONS('#141016')}<path d="M70 116c10 10 50 10 60 0" fill="none" stroke="#b8900f" stroke-width="3"/>`,
  },
  puffer: {
    c: '#c6ff3d',
    pattern: 'quilt',
    pc: ['#7f9e21'],
    extra: `${ZIP}<path d="M70 124c6 8 54 8 60 0" fill="none" stroke="${INK}" stroke-width="3"/>`,
  },
  cardigan: {
    c: '#7d6a5c',
    extra: `<path d="M100 116v116" stroke="#5b4c40" stroke-width="3"/>${BUTTONS('#f1eee8')}<path d="M56 226h88" stroke="#5b4c40" stroke-width="5"/>`,
  },
  flannel: {
    c: '#b3202a',
    pattern: 'plaid',
    pc: ['#141016', '#e9e4d8'],
    extra: `<path d="M88 116l12 16 12-16" fill="none" stroke="#141016" stroke-width="3"/>${BUTTONS('#e9e4d8')}`,
  },
  bandtee: {
    c: '#18161b',
    arms: 'skin',
    extra: `<circle cx="100" cy="164" r="16" fill="#f1eee8"/><circle cx="94" cy="162" r="4" fill="#18161b"/><circle cx="106" cy="162" r="4" fill="#18161b"/><path d="M94 176h12M97 176v6M103 176v6" stroke="#18161b" stroke-width="2"/><text x="100" y="204" text-anchor="middle" font-family="Impact, sans-serif" font-size="13" fill="#ff2e93">PUNK</text>`,
  },
  mesh: { c: '#2a2830', arms: 'skin', pattern: 'mesh', pc: ['#6a6672'] },
  tux: {
    c: '#121014',
    extra: `<path d="M86 116l14 60 14-60z" fill="#f1eee8"/>${LAPELS('#2c2930')}<path d="M92 124l8 5 8-5v10l-8-5-8 5z" fill="#ff2e93" stroke="${INK}" stroke-width="1"/><circle cx="100" cy="150" r="2" fill="${INK}"/><circle cx="100" cy="162" r="2" fill="${INK}"/>`,
  },
  chainjkt: {
    c: '#5a3a24',
    extra: `${ZIP}<path d="M64 140c12 30 60 30 72 0" fill="none" stroke="#d8d4dc" stroke-width="3" stroke-dasharray="5 3"/><path d="M60 196c14 18 66 18 80 0" fill="none" stroke="#d8d4dc" stroke-width="3" stroke-dasharray="5 3"/>`,
  },
};

function moreJacket(id: string, skin: string, g: BodyGeom): string | null {
  const j = JACKETS[id];
  if (!j) return null;
  const arms = j.arms === 'skin' ? skin : (j.arms ?? j.c);
  const hands = g.hands
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8" fill="${skin}" stroke="${INK}" stroke-width="3"/>`)
    .join('');
  return (
    `<path d="${g.armL}" fill="${arms}" stroke="${INK}" stroke-width="3"/><path d="${g.armR}" fill="${arms}" stroke="${INK}" stroke-width="3"/>` +
    `<path d="${g.torso}" fill="${j.c}"/>${patterned(g.torso, [40, 112, 120, 132], j.pattern, j.pc ?? [])}<path d="${g.torso}" fill="none" stroke="${INK}" stroke-width="3"/>` +
    clipTo([g.torso, g.armL, g.armR, NECK_BAND], j.extra ?? '') +
    hands
  );
}

// ---------------------------------------------------------------------------
// Trousers (the legs, as pantsSvg draws them).

interface PantsSpec {
  readonly c: string;
  readonly pattern?: string;
  readonly pc?: readonly string[];
  readonly shorts?: boolean;
  readonly wide?: boolean;
  readonly extra?: string;
}

const PANTS: Readonly<Record<string, PantsSpec>> = {
  blackskinny: { c: '#151318', extra: `<path d="M74 240v84M126 240v84" stroke="#2c2a30" stroke-width="2"/>` },
  bleached: { c: '#8fb4d9', pattern: 'splatter', pc: ['#d6e6f5', '#c3d8ec'] },
  cargo: {
    c: '#9a8a62',
    extra: `<rect x="62" y="270" width="18" height="16" fill="#85764f" stroke="${INK}" stroke-width="1.5"/><rect x="120" y="270" width="18" height="16" fill="#85764f" stroke="${INK}" stroke-width="1.5"/>`,
  },
  bondage: {
    c: '#141216',
    extra: `<path d="M66 262h28M106 262h28M66 296h26M108 296h26" stroke="#b3202a" stroke-width="4"/><path d="M80 262v34M120 262v34" stroke="#d8d4dc" stroke-width="2" stroke-dasharray="4 3"/>`,
  },
  leopardp: { c: '#d9a441', pattern: 'leopard', pc: ['#3a2410'] },
  checkp: { c: '#f1eee8', pattern: 'check', pc: ['#141016'] },
  pinkp: { c: '#ff2e93', extra: `<path d="M100 234v18" stroke="#b01866" stroke-width="2"/>` },
  stripep: { c: '#f1eee8', pattern: 'stripesV', pc: ['#141016'] },
  chainp: {
    c: '#1d1b21',
    extra: `<path d="M60 246c10 26 36 26 40 8" fill="none" stroke="#d8d4dc" stroke-width="3" stroke-dasharray="5 3"/>`,
  },
  shortsdenim: {
    c: '#3a5f95',
    shorts: true,
    extra: `<path d="M64 272h30M106 272h32" stroke="#e9e4d8" stroke-width="2" stroke-dasharray="2 2"/>`,
  },
  shortsplaid: { c: '#b3202a', shorts: true, pattern: 'plaid', pc: ['#141016', '#e8c84a'] },
  trackp: {
    c: '#18161b',
    extra: `<path d="M62 234l-3 94M138 234l3 94" stroke="#f1eee8" stroke-width="3"/><path d="M67 234l-3 94M133 234l3 94" stroke="#f1eee8" stroke-width="1.5"/>`,
  },
  patchp: {
    c: '#3a5f95',
    extra: `<rect x="66" y="262" width="16" height="14" fill="#ff2e93" stroke="${INK}" stroke-width="1.5" transform="rotate(-10 74 269)"/><rect x="114" y="292" width="16" height="16" fill="#c6ff3d" stroke="${INK}" stroke-width="1.5"/><circle cx="122" cy="250" r="6" fill="#f1eee8" stroke="${INK}" stroke-width="1.5"/>`,
  },
  redleather: {
    c: '#8e1420',
    extra: `<path d="M72 240v80M126 240v80" stroke="#c2343e" stroke-width="3" opacity=".7"/>`,
  },
  camoblue: { c: '#5d7ea8', pattern: 'camo', pc: ['#3f5f86', '#26405f'] },
  wide: { c: '#5f5c66', wide: true, extra: `<path d="M100 234v18" stroke="#46434c" stroke-width="2"/>` },
  splatter: { c: '#1a181d', pattern: 'splatter', pc: ['#ff2e93', '#c6ff3d'] },
  zebra: { c: '#f1eee8', pattern: 'zebra', pc: ['#141016'] },
  tartanyellow: { c: '#e5b81e', pattern: 'plaid', pc: ['#141016', '#b3202a'] },
  neonp: { c: '#c6ff3d', extra: `<path d="M100 234v18" stroke="#8fb81e" stroke-width="2"/>` },
};

function morePants(id: string, skin: string, g: BodyGeom): string | null {
  const p = PANTS[id];
  if (!p) return null;
  const legs = g.legL + g.legR;
  // Wide legs: the same legs, flaring out from the knee.
  const flare = p.wide ? ` transform="translate(100 0) scale(1.14 1) translate(-100 0)"` : '';
  const trousers =
    `<g${flare}><path d="${legs}" fill="${p.c}"/>${patterned(legs, [40, 228, 120, 104], p.pattern, p.pc ?? [])}` +
    `<path d="${legs}" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>${clipTo([legs], p.extra ?? '')}</g>`;
  if (!p.shorts) return trousers + bootsSvg(g, INK);
  // Shorts: bare legs, the trousers cut above the knee.
  return (
    `<path d="${legs}" fill="${skin}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
    clipTo(['M20 200H180V276H20z'], trousers) +
    `<path d="M40 276H160" stroke="none"/>` +
    bootsSvg(g, INK)
  );
}

// ---------------------------------------------------------------------------
// Hats (in the head's box: the head's top at about y 44, ears at y 114).

const s3 = `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`;
const HATS: Readonly<Record<string, string>> = {
  tophat: `<path d="M68 26h64v52H68z" fill="#141016" ${s3}/><rect x="68" y="62" width="64" height="9" fill="#ff2e93"/><path d="M46 78h108l-8 10H54z" fill="#141016" ${s3}/>`,
  fedora: `<path d="M64 74c0-26 14-38 36-38s36 12 36 38z" fill="#4a3a30" ${s3}/><path d="M86 40c6 6 22 6 28 0" fill="none" stroke="#2e231c" stroke-width="3"/><rect x="64" y="64" width="72" height="9" fill="#141016"/><path d="M38 78c20-8 104-8 124 0-20 10-104 10-124 0z" fill="#4a3a30" ${s3}/>`,
  beret: `<path d="M48 76c-6-26 30-42 62-38 30 4 46 22 40 38-30-8-72-8-102 0z" fill="#b3202a" ${s3}/><path d="M98 36l4-10" stroke="${INK}" stroke-width="3"/>`,
  bucket: `<path d="M62 78l8-36h60l8 36z" fill="#e9e1cc" ${s3}/><path d="M44 78h112l-10 16H54z" fill="#d8ccae" ${s3}/><path d="M66 60h68" stroke="#b8a982" stroke-width="2"/>`,
  cowboy: `<path d="M66 72c0-24 10-40 20-40 6 0 10 6 14 6s8-6 14-6c10 0 20 16 20 40z" fill="#8a5a2b" ${s3}/><path d="M30 70c10 14 30 18 70 18s60-4 70-18c-12 4-34 6-70 6s-58-2-70-6z" fill="#8a5a2b" ${s3}/><rect x="66" y="62" width="68" height="7" fill="#3a2410"/>`,
  headband: `<path d="M50 72c20-8 80-8 100 0v12c-20-8-80-8-100 0z" fill="#ff2e93" ${s3}/><path d="M60 76h80" stroke="#f1eee8" stroke-width="2"/>`,
  viking: `<path d="M54 82c0-32 20-46 46-46s46 14 46 46z" fill="#9aa0a8" ${s3}/><path d="M54 78h92" stroke="#6b7078" stroke-width="6"/><path d="M58 60c-16-6-24-22-20-38 8 10 16 16 28 18z" fill="#f1eee8" ${s3}/><path d="M142 60c16-6 24-22 20-38-8 10-16 16-28 18z" fill="#f1eee8" ${s3}/>`,
  crownhat: `<path d="M60 74l-4-40 22 18 22-30 22 30 22-18-4 40z" fill="#e8c84a" ${s3}/><circle cx="100" cy="56" r="5" fill="#ff2e93"/><circle cx="76" cy="62" r="4" fill="#c6ff3d"/><circle cx="124" cy="62" r="4" fill="#c6ff3d"/>`,
  partyhat: `<path d="M76 64L100 4l24 60z" fill="#c6ff3d" ${s3}/><path d="M84 46l24-8M80 58l36-10M92 22l12-4" stroke="#ff2e93" stroke-width="4"/><circle cx="100" cy="4" r="6" fill="#ff2e93" ${s3}/>`,
  horns: `<path d="M64 66c-14-8-18-26-10-40 2 14 10 22 22 26z" fill="#b3202a" ${s3}/><path d="M136 66c14-8 18-26 10-40-2 14-10 22-22 26z" fill="#b3202a" ${s3}/>`,
  halo: `<ellipse cx="100" cy="24" rx="40" ry="10" fill="none" stroke="#e8c84a" stroke-width="7"/><ellipse cx="100" cy="24" rx="40" ry="10" fill="none" stroke="#fff6b0" stroke-width="2"/>`,
  snapback: `<path d="M52 82c2-30 22-44 48-44s46 14 48 44z" fill="#c6ff3d" ${s3}/><path d="M52 80c-14 0-26 4-30 10 10 4 22 4 32 0z" fill="#141016" ${s3}/><circle cx="100" cy="40" r="4" fill="#141016"/><text x="100" y="70" text-anchor="middle" font-family="Impact, sans-serif" font-size="14" fill="#141016">PC</text>`,
  beanieblack: `<path d="M50 84c0-36 22-52 50-52s50 16 50 52z" fill="#1d1b21" ${s3}/><rect x="46" y="76" width="108" height="16" rx="6" fill="#2c2a30" ${s3}/><path d="M58 84h84" stroke="#ff2e93" stroke-width="2"/>`,
  pilot: `<path d="M50 96c0-40 22-58 50-58s50 18 50 58l-10 16c0-30-12-50-40-50s-40 20-40 50z" fill="#6b4a2e" ${s3}/><circle cx="80" cy="56" r="11" fill="#7ad0ff" ${s3}/><circle cx="120" cy="56" r="11" fill="#7ad0ff" ${s3}/><path d="M91 56h18" stroke="${INK}" stroke-width="3"/>`,
  sailor: `<path d="M56 80c0-18 20-28 44-28s44 10 44 28z" fill="#f1eee8" ${s3}/><path d="M50 80h100v10H50z" fill="#1d3a6e" ${s3}/><circle cx="100" cy="66" r="5" fill="#1d3a6e"/>`,
};

// ---------------------------------------------------------------------------
// Accessories: some on the head (glasses, a mask, earrings), some at the neck.

const ACC_HEAD: Readonly<Record<string, string>> = {
  roundglass: `<circle cx="80" cy="108" r="12" fill="#1d1b21" fill-opacity=".55" stroke="#d8d4dc" stroke-width="3"/><circle cx="120" cy="108" r="12" fill="#1d1b21" fill-opacity=".55" stroke="#d8d4dc" stroke-width="3"/><path d="M92 108h16" stroke="#d8d4dc" stroke-width="3"/>`,
  heartglass:
    ['80', '120']
      .map(
        (x) =>
          `<path d="M${x} 120c-14-8-16-18-10-22 4-3 8-1 10 3 2-4 6-6 10-3 6 4 4 14-10 22z" fill="#ff2e93" stroke="${INK}" stroke-width="2.5"/>`,
      )
      .join('') + `<path d="M90 106h20" stroke="${INK}" stroke-width="3"/>`,
  starglass:
    ['80', '120']
      .map(
        (x) =>
          `<path d="M${x} 94l4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1z" fill="#c6ff3d" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`,
      )
      .join('') + `<path d="M92 108h16" stroke="${INK}" stroke-width="3"/>`,
  visor: `<path d="M58 98h84l-4 20H62z" fill="#00e5ff" fill-opacity=".75" stroke="${INK}" stroke-width="3"/><path d="M64 104h72" stroke="#f1eee8" stroke-width="2" opacity=".7"/>`,
  eyepatch: `<path d="M56 86l70 30" stroke="${INK}" stroke-width="3"/><ellipse cx="80" cy="108" rx="12" ry="10" fill="${INK}"/>`,
  monocle: `<circle cx="120" cy="108" r="12" fill="#fff" fill-opacity=".25" stroke="#e8c84a" stroke-width="3"/><path d="M132 112c6 14 4 30-4 42" fill="none" stroke="#e8c84a" stroke-width="1.5"/>`,
  hoops: `<circle cx="46" cy="132" r="7" fill="none" stroke="#e8c84a" stroke-width="2.5"/><circle cx="154" cy="132" r="7" fill="none" stroke="#e8c84a" stroke-width="2.5"/>`,
  mask: `<path d="M56 124c20 6 68 6 88 0l-6 34c-22 14-54 14-76 0z" fill="#141016" ${s3}/><g fill="#f1eee8">${[76, 92, 108, 124].map((x) => `<circle cx="${x}" cy="140" r="2"/>`).join('')}</g>`,
  goggles: `<path d="M48 100h104" stroke="#3a3640" stroke-width="7"/><rect x="62" y="94" width="34" height="22" rx="10" fill="#ffb02e" stroke="${INK}" stroke-width="3"/><rect x="104" y="94" width="34" height="22" rx="10" fill="#ffb02e" stroke="${INK}" stroke-width="3"/>`,
};

const ACC_NECK: Readonly<Record<string, string>> = {
  padlock: `<path d="M80 120c4 30 36 30 40 0" fill="none" stroke="#8a8590" stroke-width="4"/><rect x="92" y="144" width="16" height="14" rx="2" fill="#e8c84a" stroke="${INK}" stroke-width="2"/><path d="M95 144v-5a5 5 0 0 1 10 0v5" fill="none" stroke="#e8c84a" stroke-width="2.5"/>`,
  dogtags: `<path d="M82 120c4 26 32 26 36 0" fill="none" stroke="#d8d4dc" stroke-width="2" stroke-dasharray="2 2"/><rect x="92" y="140" width="10" height="16" rx="3" fill="#d8d4dc" stroke="${INK}" stroke-width="1.5" transform="rotate(-10 97 148)"/><rect x="100" y="142" width="10" height="16" rx="3" fill="#b8b4bc" stroke="${INK}" stroke-width="1.5" transform="rotate(10 105 150)"/>`,
  pearls: `<g fill="#f6f2ea" stroke="${INK}" stroke-width=".8">${range(0, 10, 1)
    .map((i) => {
      const a = Math.PI * (0.1 + 0.08 * i);
      return `<circle cx="${(100 - Math.cos(a) * 22).toFixed(1)}" cy="${(118 + Math.sin(a) * 22).toFixed(1)}" r="3.2"/>`;
    })
    .join('')}</g>`,
  scarf: `<path d="M74 116c8 10 44 10 52 0l4 10c-12 12-48 12-60 0z" fill="#ff2e93" stroke="${INK}" stroke-width="2.5"/><path d="M110 124l6 40-12 2-2-38z" fill="#ff2e93" stroke="${INK}" stroke-width="2.5"/><path d="M106 150h10M107 158h10" stroke="#b01866" stroke-width="2"/>`,
  studcollar: `<rect x="82" y="108" width="36" height="10" rx="2" fill="#b3202a" stroke="${INK}" stroke-width="2"/>${[87, 95, 103, 111].map((x) => `<path d="M${x - 3} 108l3-7 3 7z" fill="#d8d4dc" stroke="${INK}" stroke-width=".8"/>`).join('')}`,
  neckbandana: `<path d="M76 116c10 6 38 6 48 0l-24 30z" fill="#1d3a6e" stroke="${INK}" stroke-width="2.5"/><g fill="#f1eee8">${[
    [90, 124],
    [100, 128],
    [110, 124],
    [100, 136],
  ]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6"/>`)
    .join('')}</g>`,
};

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Skirts: hung from the waist, over trousers or bare legs.

interface SkirtSpec {
  readonly c: string;
  readonly len: 'mini' | 'midi' | 'long';
  readonly shape: 'a' | 'pencil' | 'tutu' | 'pleat' | 'layer';
  readonly pattern?: string;
  readonly pc?: readonly string[];
  readonly extra?: string;
}

const SKIRTS: Readonly<Record<string, SkirtSpec>> = {
  kilt: {
    c: '#b3202a',
    len: 'midi',
    shape: 'pleat',
    pattern: 'plaid',
    pc: ['#141016', '#e8c84a'],
    extra: `<rect x="112" y="226" width="5" height="22" rx="2" fill="#d8d4dc" stroke="${INK}" stroke-width="1.5"/>`,
  },
  blackmini: { c: '#151318', len: 'mini', shape: 'a' },
  leathermini: {
    c: '#1d1b21',
    len: 'mini',
    shape: 'pencil',
    extra: `<path d="M100 204v44" stroke="#8a8590" stroke-width="2" stroke-dasharray="3 3"/>`,
  },
  denimmini: {
    c: '#3a5f95',
    len: 'mini',
    shape: 'a',
    extra: `<path d="M70 212h60" stroke="#e9e4d8" stroke-width="1.5" stroke-dasharray="2 2"/>`,
  },
  tutupink: { c: '#ff2e93', len: 'mini', shape: 'tutu' },
  tutublack: { c: '#1d1b21', len: 'mini', shape: 'tutu' },
  pleatcheck: { c: '#f1eee8', len: 'mini', shape: 'pleat', pattern: 'check', pc: ['#141016'] },
  plaidmidi: { c: '#2e5a3a', len: 'midi', shape: 'a', pattern: 'plaid', pc: ['#141016', '#e8c84a'] },
  leopardskirt: { c: '#d9a441', len: 'midi', shape: 'pencil', pattern: 'leopard', pc: ['#3a2410'] },
  zebraskirt: { c: '#f1eee8', len: 'mini', shape: 'a', pattern: 'zebra', pc: ['#141016'] },
  camoskirt: { c: '#6b7a45', len: 'midi', shape: 'a', pattern: 'camo', pc: ['#4a5530', '#2f3620'] },
  longblack: { c: '#151318', len: 'long', shape: 'a' },
  layered: { c: '#7a2bb8', len: 'midi', shape: 'layer' },
  chainskirt: {
    c: '#1d1b21',
    len: 'mini',
    shape: 'a',
    extra: `<path d="M66 214c12 18 56 18 68 0" fill="none" stroke="#d8d4dc" stroke-width="3" stroke-dasharray="5 3"/>`,
  },
  studskirt: {
    c: '#141216',
    len: 'mini',
    shape: 'pencil',
    extra: [70, 80, 90, 100, 110, 120, 130]
      .map((x) => `<circle cx="${x}" cy="208" r="2.6" fill="#d8d4dc" stroke="${INK}" stroke-width=".8"/>`)
      .join(''),
  },
  neonmini: { c: '#c6ff3d', len: 'mini', shape: 'a' },
  purplemidi: { c: '#5b2a86', len: 'midi', shape: 'pleat' },
  splatterskirt: { c: '#1a181d', len: 'midi', shape: 'a', pattern: 'splatter', pc: ['#ff2e93', '#c6ff3d'] },
  stripeskirt: { c: '#f1eee8', len: 'midi', shape: 'pencil', pattern: 'stripesH', pc: ['#141016'] },
  redpencil: {
    c: '#c8182a',
    len: 'midi',
    shape: 'pencil',
    extra: `<path d="M100 270v26" stroke="#8e1420" stroke-width="2"/>`,
  },
};

function skirt(id: string, g: BodyGeom): string | null {
  const k = SKIRTS[id];
  if (!k) return null;
  const top = g.waistY;
  const bottom = k.len === 'mini' ? 262 : k.len === 'midi' ? 296 : 330;
  const w = g.W + 2;
  // How wide the hem is: a pencil skirt hugs the hips, an A-line and a tutu flare.
  const hem = k.shape === 'pencil' ? g.H + 2 : k.shape === 'tutu' ? g.H + 30 : g.H + 14 + (bottom - 262) * 0.2;
  const hip = Math.max(g.H + 2, w);
  const f = (x: number) => x.toFixed(1);
  let shape =
    `M${f(100 - w)} ${top} C${f(100 - hip)} ${top + 18} ${f(100 - hip)} ${top + 30} ${f(100 - hem)} ${bottom} ` +
    `L${f(100 + hem)} ${bottom} C${f(100 + hip)} ${top + 30} ${f(100 + hip)} ${top + 18} ${f(100 + w)} ${top} Z`;
  if (k.shape === 'tutu') {
    // A tutu: a jagged hem.
    const n = 10;
    let d = `M${f(100 - w)} ${top} L${f(100 - hem)} ${bottom - 6}`;
    for (let i = 1; i <= n; i++)
      d += ` L${f(100 - hem + ((2 * hem) / n) * (i - 0.5))} ${bottom + 4} L${f(100 - hem + ((2 * hem) / n) * i)} ${bottom - 6}`;
    shape = d + ` L${f(100 + w)} ${top} Z`;
  }
  let detail = '';
  if (k.shape === 'pleat') {
    for (let x = -hem + 10; x < hem; x += 10)
      detail += `<path d="M${f(100 + x * 0.6)} ${top + 6} L${f(100 + x)} ${bottom}" stroke="${INK}" stroke-width="1.2" opacity=".5"/>`;
  }
  if (k.shape === 'layer') {
    for (const y of [top + 22, top + 46, top + 70])
      if (y < bottom)
        detail += `<path d="M${f(100 - hem)} ${y}q${f(hem / 2)} 8 ${f(hem)} 0t${f(hem)} 0" fill="none" stroke="#3e1c5e" stroke-width="3"/>`;
  }
  return (
    `<path d="${shape}" fill="${k.c}"/>${patterned(shape, [40, top, 120, bottom - top + 6], k.pattern, k.pc ?? [])}` +
    clipTo([shape], detail + (k.extra ?? '')) +
    `<path d="${shape}" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
    `<path d="M${f(100 - w)} ${top + 3}H${f(100 + w)}" stroke="${INK}" stroke-width="2"/>`
  );
}

/** The skirts and their prices (punk coins). */
export const SKIRT_ITEMS: readonly { readonly id: string; readonly slot: OutfitSlot; readonly price: number }[] =
  Object.keys(SKIRTS).map((id, i) => ({
    id,
    slot: 'skirt' as const,
    price: [220, 90, 180, 110, 160, 160, 150, 170, 200, 170, 140, 150, 210, 190, 200, 120, 160, 170, 150, 140][i],
  }));

/** The new goods and their prices (punk coins). */
export const MORE_ITEMS: readonly { readonly id: string; readonly slot: OutfitSlot; readonly price: number }[] = [
  ...Object.keys(JACKETS).map((id, i) => ({
    id,
    slot: 'jacket' as const,
    price: [280, 240, 260, 230, 170, 210, 200, 150, 140, 270, 180, 220, 130, 250, 110, 120, 90, 100, 300, 290][i],
  })),
  ...Object.keys(PANTS).map((id, i) => ({
    id,
    slot: 'pants' as const,
    price: [90, 130, 120, 210, 180, 170, 100, 150, 190, 80, 100, 110, 160, 230, 140, 120, 170, 200, 160, 130][i],
  })),
  ...Object.keys(HATS).map((id, i) => ({
    id,
    slot: 'hat' as const,
    price: [150, 120, 90, 80, 140, 40, 220, 300, 60, 110, 130, 70, 50, 160, 90][i],
  })),
  ...[...Object.keys(ACC_HEAD), ...Object.keys(ACC_NECK)].map((id, i) => ({
    id,
    slot: 'acc' as const,
    price: [70, 80, 90, 160, 60, 100, 70, 90, 140, 120, 80, 110, 90, 130, 60][i],
  })),
];

/** A new jacket, trousers, hat or accessory drawn, or null when `id` is not one. */
export const drawMoreJacket = moreJacket;
export const drawSkirt = (id: string, g: BodyGeom): string | null => skirt(id, g);
export const drawMorePants = morePants;
export const drawMoreHat = (id: string | null): string | null => (id && HATS[id]) || null;
export const drawMoreHeadAcc = (id: string | null): string | null => (id && ACC_HEAD[id]) || null;
export const drawMoreNeckAcc = (id: string | null): string | null => (id && ACC_NECK[id]) || null;
/** Whether an accessory is worn on the head (its picture shows the head). */
export const isHeadAcc = (id: string): boolean => id in ACC_HEAD;
