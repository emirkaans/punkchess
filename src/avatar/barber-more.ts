// The barber's second wave (src/avatar/barber.ts draws the first): 20 cuts, 20 beards and
// moustaches, and 10 colours for hair and beard, with their prices. In the head's 200×200 box:
// the head's top at about y 44, the hairline at y 80, ears at y 114, the mouth at y 140, the
// chin at y 172. Pure: no DOM.

import type { OutfitSlot } from './outfit.ts';

const INK = '#141016';
const st = (fill: string, w = 3) => `fill="${fill}" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round"`;
/** A row of spikes from (x0, base) to (x1, base), `n` of them up to `top`. */
const spikes = (n: number, x0: number, x1: number, base: number, top: number, jag = 0) => {
  const w = (x1 - x0) / n;
  let d = `M${x0} ${base}`;
  for (let i = 0; i < n; i++)
    d += ` L${(x0 + w * i + w / 2).toFixed(1)} ${top + (i % 2) * jag} L${(x0 + w * (i + 1)).toFixed(1)} ${base}`;
  return d + 'Z';
};
const CAP = 'M50 84c2-28 24-42 50-42s48 14 50 42c-30-10-70-10-100 0z';

interface Cut {
  readonly back?: (f: string) => string;
  readonly front: (f: string) => string;
}

const CUTS: Readonly<Record<string, Cut>> = {
  tallspikes: { front: (f) => `<path d="${spikes(9, 44, 156, 84, -20, 14)}" ${st(f)}/>` },
  sidecut: {
    front: (f) =>
      `<path d="M58 84c4-30 26-44 52-42 26 2 42 18 44 42-26-14-58-18-96 0z" ${st(f)}/><path d="M50 92c2-12 6-20 10-26" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="2 4"/>`,
  },
  pompadour: {
    front: (f) =>
      `<path d="M50 86c-4-34 14-58 50-62 36-4 58 16 52 40-12-10-30-12-40-4 6 2 10 10 8 18-24-10-50-8-70 8z" ${st(f)}/>`,
  },
  bowl: {
    front: (f) =>
      `<path d="M44 100c0-40 24-60 56-60s56 20 56 60H44z" ${st(f)}/><path d="M60 100V84M80 100V82M100 100V80M120 100V82M140 100V84" stroke="${INK}" stroke-width="1.5" opacity=".4"/>`,
  },
  ponytail: {
    back: (f) => `<path d="M140 70c30 10 38 50 26 80-6-24-14-40-30-52z" ${st(f)}/>`,
    front: (f) =>
      `<path d="${CAP}" ${st(f)}/><circle cx="146" cy="76" r="6" fill="#ff2e93" stroke="${INK}" stroke-width="2"/>`,
  },
  pigtails: {
    back: (f) =>
      `<path d="M48 92c-22 4-30 30-20 54 8-16 18-26 28-32z" ${st(f)}/><path d="M152 92c22 4 30 30 20 54-8-16-18-26-28-32z" ${st(f)}/>`,
    front: (f) =>
      `<path d="${CAP}" ${st(f)}/><circle cx="50" cy="94" r="5" fill="#c6ff3d" stroke="${INK}" stroke-width="2"/><circle cx="150" cy="94" r="5" fill="#c6ff3d" stroke="${INK}" stroke-width="2"/>`,
  },
  curly: {
    front: (f) =>
      [
        [56, 76],
        [70, 60],
        [88, 50],
        [108, 48],
        [126, 54],
        [142, 68],
        [150, 84],
        [48, 92],
        [100, 62],
        [80, 70],
        [120, 70],
      ]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="13" ${st(f, 2.5)}/>`)
        .join(''),
  },
  shaggy: {
    back: (f) =>
      `<path d="M40 120c-6-56 16-84 60-84s66 28 60 84l-12 24-8-30-10 28-10-32-10 32-10-32-10 32-10-28-8 30z" ${st(f)}/>`,
    front: (f) =>
      `<path d="M48 92c0-34 22-52 52-52s52 18 52 52l-12-12-8 12-10-14-10 14-12-14-10 14-10-12-8 12z" ${st(f)}/>`,
  },
  undercut: {
    front: (f) =>
      `<path d="M60 76c10-30 40-40 70-30 16 6 24 18 24 30-30-14-62-14-94 0z" ${st(f)}/><path d="M50 92c2-10 6-16 12-20M150 92c-2-10-6-16-12-20" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="2 4"/>`,
  },
  twinbuns: {
    front: (f) =>
      `<path d="${CAP}" ${st(f)}/><circle cx="66" cy="44" r="15" ${st(f)}/><circle cx="134" cy="44" r="15" ${st(f)}/>`,
  },
  crest: {
    front: (f) =>
      `<path d="M90 60c0-18 4-30 10-36 6 6 10 18 10 36z" ${st(f)}/><path d="M60 72c10-14 70-14 80 0" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="2 4" opacity=".6"/>`,
  },
  deathhawk: {
    front: (f) =>
      `<path d="M70 70C60 30 70 6 100 -4c30 10 40 34 30 74-8-10-20-14-30-14s-22 4-30 14z" ${st(f)}/><path d="M86 60l-6-40M100 56V8M114 60l6-40" stroke="${INK}" stroke-width="2" opacity=".5"/>`,
  },
  emo: {
    front: (f) => `<path d="M50 84c2-30 24-44 50-44s48 14 50 44c-10-6-20-8-28-6l-60 34c-8-8-12-18-12-28z" ${st(f)}/>`,
  },
  mullet: {
    back: (f) => `<path d="M44 100c-4 40 2 66 12 80l10-20 8 18 8-20h36l8 20 8-18 10 20c10-14 16-40 12-80z" ${st(f)}/>`,
    front: (f) => `<path d="M52 84c4-26 24-40 48-40s44 14 48 40c-30-8-66-8-96 0z" ${st(f)}/>`,
  },
  afrohawk: {
    front: (f) =>
      [
        [100, 20],
        [100, 38],
        [100, 56],
        [86, 30],
        [114, 30],
        [88, 50],
        [112, 50],
      ]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="14" ${st(f, 2.5)}/>`)
        .join(''),
  },
  cornrows: {
    front: (f) =>
      `<path d="${CAP}" ${st(f)}/>${[66, 82, 100, 118, 134].map((x) => `<path d="M${x} 46c-2 12 0 24 ${x < 100 ? -4 : x > 100 ? 4 : 0} 36" fill="none" stroke="${INK}" stroke-width="1.8" stroke-dasharray="4 3"/>`).join('')}`,
  },
  buzzstripes: {
    front: (f) =>
      `<path d="${CAP}" ${st(f)} opacity=".9"/><path d="M62 66l14 8M64 58l14 8M136 66l-14 8M136 58l-14 8" stroke="#f1eee8" stroke-width="2.5"/>`,
  },
  spiral: {
    front: (f) =>
      `<path d="${CAP}" ${st(f)}/><path d="M100 40c-12 0-18 10-14 18s16 6 16-2-8-8-8-2" fill="none" stroke="${INK}" stroke-width="3"/><path d="M100 40c0-14 8-24 16-26" fill="none" stroke="${f}" stroke-width="7"/>`,
  },
  flattop: {
    front: (f) =>
      `<path d="M54 84V40h92v44c-30-10-62-10-92 0z" ${st(f)}/><path d="M54 40h92" stroke="${INK}" stroke-width="2" opacity=".5"/>`,
  },
  hornhair: {
    front: (f) =>
      `<path d="${CAP}" ${st(f)}/><path d="M68 52c-14-12-16-30-8-44 4 16 12 26 24 32z" ${st(f)}/><path d="M132 52c14-12 16-30 8-44-4 16-12 26-24 32z" ${st(f)}/>`,
  },
};

const BEARDS: Readonly<Record<string, (f: string) => string>> = {
  stubble: (f) =>
    `<g fill="${f}" opacity=".7">${Array.from({ length: 34 }, (_, i) => {
      const a = Math.PI * (0.08 + (0.84 * (i % 17)) / 16);
      const r = i < 17 ? 44 : 36;
      return `<circle cx="${(100 - Math.cos(a) * r).toFixed(1)}" cy="${(126 + Math.sin(a) * r * 0.9).toFixed(1)}" r="1.6"/>`;
    }).join('')}</g>`,
  anchor: (f) =>
    `<path d="M100 134c-10-4-22-2-28 4 10 0 20 2 28 2 8 0 18-2 28-2-6-6-18-8-28-4z" ${st(f, 2)}/><path d="M86 154c4 12 10 22 14 26 4-4 10-14 14-26-6 4-22 4-28 0z" ${st(f, 2)}/>`,
  chinstrap: (f) => `<path d="M48 108c0 40 22 66 52 66s52-26 52-66l-6 2c-2 34-20 54-46 54s-44-20-46-54z" ${st(f, 2)}/>`,
  soulpatch: (f) => `<path d="M94 152h12l-3 12h-6z" ${st(f, 2)}/>`,
  walrus: (f) =>
    `<path d="M70 140c4-12 16-16 30-12 14-4 26 0 30 12-8 6-16 6-30 2-14 4-22 4-30-2z" ${st(f, 2.5)}/><path d="M76 140v6M84 141v7M92 142v7M108 142v7M116 141v7M124 140v6" stroke="${INK}" stroke-width="1.5"/>`,
  pencil: (f) => `<path d="M80 136c8-3 32-3 40 0" fill="none" stroke="${f}" stroke-width="3" stroke-linecap="round"/>`,
  fumanchu: (f) =>
    `<path d="M82 134c6-4 30-4 36 0" fill="none" stroke="${f}" stroke-width="5" stroke-linecap="round"/><path d="M82 134c-4 14-4 30 0 40M118 134c4 14 4 30 0 40" fill="none" stroke="${f}" stroke-width="4" stroke-linecap="round"/>`,
  vikingbraid: (f) =>
    `<path d="M56 116c0 34 18 56 44 56s44-22 44-56c-8 10-20 14-44 14s-36-4-44-14z" ${st(f)}/>${[176, 186, 196].map((y) => `<ellipse cx="100" cy="${y}" rx="8" ry="6" ${st(f, 2)}/>`).join('')}<circle cx="100" cy="203" r="4" fill="#c6ff3d" stroke="${INK}" stroke-width="1.5"/>`,
  wizard: (f) =>
    `<path d="M54 118c0 44 20 80 46 82 26-2 46-38 46-82-10 12-22 16-46 16s-36-4-46-16z" ${st(f)}/><path d="M86 160c4 14 4 26 0 34M114 160c-4 14-4 26 0 34" fill="none" stroke="${INK}" stroke-width="1.5" opacity=".5"/>`,
  horseshoe: (f) => `<path d="M80 134c6-4 34-4 40 0l2 34h-8l-2-28c-6-2-18-2-24 0l-2 28h-8z" ${st(f, 2)}/>`,
  musketeer: (f) =>
    `<path d="M100 134c-10-6-22-6-30 2 6 0 14 0 18 2 4-2 8-2 12-2s8 0 12 2c4-2 12-2 18-2-8-8-20-8-30-2z" ${st(f, 2)}/><path d="M96 154l4 14 4-14z" ${st(f, 2)}/>`,
  boxed: (f) =>
    `<path d="M54 118v34c4 18 20 24 46 24s42-6 46-24v-34c-8 10-20 14-46 14s-38-4-46-14z" ${st(f)}/><path d="M84 142c10 6 22 6 32 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
  forked: (f) =>
    `<path d="M58 118c0 30 14 48 30 54l12 18 12-18c16-6 30-24 30-54-8 10-20 14-42 14s-34-4-42-14z" ${st(f)}/><path d="M100 176l-8 16M100 176l8 16" stroke="${INK}" stroke-width="2"/>`,
  chevron: (f) => `<path d="M74 134c10-6 42-6 52 0l-4 12c-8-4-36-4-44 0z" ${st(f, 2.5)}/>`,
  imperial: (f) =>
    `<path d="M100 134c-14-6-28-4-36-14 2 14 16 22 36 20 20 2 34-6 36-20-8 10-22 8-36 14z" ${st(f, 2)}/><path d="M96 152l4 22 4-22z" ${st(f, 2)}/>`,
  ducktail: (f) =>
    `<path d="M56 118c0 30 16 46 30 54l14 22 14-22c14-8 30-24 30-54-8 10-20 14-44 14s-36-4-44-14z" ${st(f)}/>`,
  neckbeard: (f) => `<path d="M62 160c10 22 24 30 38 30s28-8 38-30c-6 8-20 12-38 12s-32-4-38-12z" ${st(f, 2.5)}/>`,
  muttonstache: (f) =>
    `<path d="M50 100c-2 22 4 40 16 46l14-8c10-6 30-6 40 0l14 8c12-6 18-24 16-46-2 16-10 28-20 30-12-6-36-6-48 0-10-2-18-14-20-30z" ${st(f, 2)}/>`,
  dali: (f) =>
    `<path d="M100 136c-10-4-22-2-30-14M100 136c10-4 22-2 30-14" fill="none" stroke="${f}" stroke-width="3" stroke-linecap="round"/><path d="M70 122c-2-6 0-12 4-14M130 122c2-6 0-12-4-14" fill="none" stroke="${f}" stroke-width="2.5" stroke-linecap="round"/>`,
  goateelong: (f) => `<path d="M86 150c0 30 8 46 14 50 6-4 14-20 14-50-8 6-20 6-28 0z" ${st(f, 2.5)}/>`,
};

/** Premium colours for hair and beard: gradient stops (offset, colour), or a glow. */
const COLORS: Readonly<
  Record<
    string,
    { readonly stops?: readonly (readonly [number, string])[]; readonly glow?: string; readonly swatch: string }
  >
> = {
  fire: {
    stops: [
      [0, '#ffe14a'],
      [0.5, '#ff7a1a'],
      [1, '#d6182a'],
    ],
    swatch: 'linear-gradient(180deg, #ffe14a, #ff7a1a, #d6182a)',
  },
  ocean: {
    stops: [
      [0, '#7af0ff'],
      [1, '#1446b8'],
    ],
    swatch: 'linear-gradient(135deg, #7af0ff, #1446b8)',
  },
  toxic: {
    stops: [
      [0, '#eaff3d'],
      [1, '#18b84a'],
    ],
    swatch: 'linear-gradient(135deg, #eaff3d, #18b84a)',
  },
  sunset: {
    stops: [
      [0, '#ffb02e'],
      [0.5, '#ff2e93'],
      [1, '#6a2bb8'],
    ],
    swatch: 'linear-gradient(135deg, #ffb02e, #ff2e93, #6a2bb8)',
  },
  galaxy: {
    stops: [
      [0, '#1a1050'],
      [0.5, '#6a2bb8'],
      [1, '#ff6fd8'],
    ],
    swatch: 'linear-gradient(135deg, #1a1050, #6a2bb8, #ff6fd8)',
  },
  ice: {
    stops: [
      [0, '#ffffff'],
      [1, '#8fd8ff'],
    ],
    swatch: 'linear-gradient(135deg, #ffffff, #8fd8ff)',
  },
  rainbow: {
    stops: [
      [0, '#ff2e2e'],
      [0.2, '#ffb02e'],
      [0.4, '#f6ff3d'],
      [0.6, '#3dff7a'],
      [0.8, '#3d9bff'],
      [1, '#b03dff'],
    ],
    swatch: 'linear-gradient(90deg, #ff2e2e, #ffb02e, #f6ff3d, #3dff7a, #3d9bff, #b03dff)',
  },
  neonlime: { glow: '#c6ff3d', swatch: 'radial-gradient(#efffb0, #c6ff3d)' },
  neonblue: { glow: '#2ee0ff', swatch: 'radial-gradient(#b8f6ff, #2ee0ff)' },
  silver: {
    stops: [
      [0, '#f4f4f8'],
      [0.5, '#9aa0aa'],
      [1, '#e2e4ea'],
    ],
    swatch: 'linear-gradient(135deg, #f4f4f8, #9aa0aa, #e2e4ea)',
  },
};

/** The new cuts, beards and colours, with their prices (punk coins). */
export const MORE_BARBER_ITEMS: readonly { readonly id: string; readonly slot: OutfitSlot; readonly price: number }[] =
  [
    ...Object.keys(CUTS).map((id, i) => ({
      id,
      slot: 'cut' as const,
      price: [300, 170, 220, 120, 160, 180, 200, 190, 170, 160, 130, 320, 150, 210, 260, 230, 140, 180, 150, 280][i],
    })),
    ...Object.keys(BEARDS).map((id, i) => ({
      id,
      slot: 'beard' as const,
      price: [40, 90, 80, 50, 110, 60, 120, 160, 180, 100, 110, 120, 140, 70, 130, 120, 90, 110, 100, 80][i],
    })),
    ...Object.keys(COLORS).map((id, i) => ({
      id,
      slot: 'color' as const,
      price: [160, 140, 140, 170, 180, 130, 200, 150, 150, 170][i],
    })),
  ];

export const moreCutBack = (id: string, fill: string): string | null =>
  CUTS[id] ? (CUTS[id].back?.(fill) ?? '') : null;
export const moreCutFront = (id: string, fill: string): string | null => CUTS[id]?.front(fill) ?? null;
export const moreBeard = (id: string, fill: string): string | null => BEARDS[id]?.(fill) ?? null;

/** A new colour's paint (as src/avatar/barber.ts hairPaint), or null when `id` is not one. */
export function morePaint(id: string): { fill: string; defs: string; filter: string | null } | null {
  const c = COLORS[id];
  if (!c) return null;
  if (c.glow) {
    const fid = `pc-hair-${id}`;
    return {
      fill: c.glow,
      defs: `<filter id="${fid}"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`,
      filter: `url(#${fid})`,
    };
  }
  const gid = `pc-hair-${id}`;
  return {
    fill: `url(#${gid})`,
    defs: `<linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">${c.stops!.map(([o, col]) => `<stop offset="${o}" stop-color="${col}"/>`).join('')}</linearGradient>`,
    filter: null,
  };
}
export const moreSwatch = (id: string): string | null => COLORS[id]?.swatch ?? null;
/** A colour for strands that cannot take a gradient (dreadlocks): the first stop, or the glow. */
export const moreSolid = (id: string): string | null => COLORS[id]?.glow ?? COLORS[id]?.stops?.[0][1] ?? null;
