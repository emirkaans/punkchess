// The barber's goods (src/ui/BarberPage.tsx), drawn in the head's 200×200 box
// (src/avatar/avatar.ts): premium cuts (some reach above the box, up to y = -50), hair colours
// and beards. Pure: no DOM.

const INK = '#141016';
const BEARD = '#3a2a20';

/** How a premium colour paints hair: its fill, the defs it needs and a filter for the glow. */
export interface HairPaint {
  readonly fill: string;
  readonly defs: string;
  readonly filter: string | null;
}

/**
 * The hair's paint: `base` (the character's own colour) unless a premium colour is worn. Gradient
 * ids are fixed per colour: several avatars on a page share the same definition.
 */
export function hairPaint(color: string | null, base: string): HairPaint {
  if (color === 'grad')
    return {
      fill: 'url(#pc-hair-grad)',
      defs: '<linearGradient id="pc-hair-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff2e93"/><stop offset="1" stop-color="#c6ff3d"/></linearGradient>',
      filter: null,
    };
  if (color === 'split')
    return {
      fill: 'url(#pc-hair-split)',
      defs: '<linearGradient id="pc-hair-split" x1="0" y1="0" x2="1" y2="0"><stop offset=".5" stop-color="#ff2e93"/><stop offset=".5" stop-color="#4aa8ff"/></linearGradient>',
      filter: null,
    };
  if (color === 'neon')
    return {
      fill: '#ff2e93',
      defs: '<filter id="pc-hair-neon"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
      filter: 'url(#pc-hair-neon)',
    };
  return { fill: base, defs: '', filter: null };
}

/** A premium colour's swatch (a CSS background). */
export function colorSwatch(id: string): string {
  if (id === 'grad') return 'linear-gradient(135deg, #ff2e93, #c6ff3d)';
  if (id === 'split') return 'linear-gradient(90deg, #ff2e93 50%, #4aa8ff 50%)';
  return 'radial-gradient(#ff8fd0, #ff2e93)';
}

/** Hair drawn with a paint: wrapped in the glow when the colour has one. */
export const painted = (svg: string, p: HairPaint): string =>
  svg && p.filter ? `<g filter="${p.filter}">${svg}</g>` : svg;

const spikes = (n: number, x0: number, x1: number, base: number, top: number) => {
  const w = (x1 - x0) / n;
  let d = `M${x0} ${base}`;
  for (let i = 0; i < n; i++) d += ` L${x0 + w * i + w / 2} ${top + (i % 2) * 8} L${x0 + w * (i + 1)} ${base}`;
  return d + 'Z';
};

/** The part of a cut behind the head. */
export function cutBack(id: string, fill: string): string {
  const st = `fill="${fill}" stroke="${INK}" stroke-width="3"`;
  switch (id) {
    case 'dreads': {
      // Strands need a solid colour for their stroke.
      const c = fill.startsWith('url') ? '#ff2e93' : fill;
      return Array.from({ length: 9 }, (_, i) => {
        const d = `M${46 + i * 13} 70 q${i % 2 ? 6 : -6} 50 ${(i - 4) * 2} 100`;
        return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round"/>`;
      }).join('');
    }
    case 'afro':
      return `<circle cx="100" cy="86" r="66" ${st}/>`;
    case 'long':
      return `<path d="M42 100c-4-44 18-64 58-64s62 20 58 64l6 74H36z" ${st}/>`;
    case 'half':
      return `<path d="M100 40c34 0 58 22 58 62l4 70h-20l-4-60c0-20-16-34-38-34z" ${st}/>`;
    default:
      return '';
  }
}

function libertyPath(): string {
  const pt = (a: number, r: number) => `${(100 + Math.cos(a) * r).toFixed(1)} ${(100 + Math.sin(a) * r).toFixed(1)}`;
  return Array.from({ length: 9 }, (_, i) => {
    const a = Math.PI + (i / 8) * Math.PI;
    return `M${pt(a - 0.14, 50)} L${pt(a, 112)} L${pt(a + 0.14, 50)} Z`;
  }).join(' ');
}

/** The part of a cut over the head. */
export function cutFront(id: string, fill: string): string {
  const st = `fill="${fill}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"`;
  switch (id) {
    case 'giant':
      return `<path d="M86 56 L70 -30 L92 10 L100 -48 L108 10 L130 -30 L114 56 Z" ${st}/>`;
    case 'double':
      return `<path d="M68 62 L58 4 L72 22 L76 -6 L84 24 L88 58 Z" ${st}/><path d="M112 58 L116 24 L124 -6 L128 22 L142 4 L132 62 Z" ${st}/>`;
    case 'liberty':
      return `<path d="${libertyPath()}" ${st}/>`;
    case 'dreads':
      return `<path d="M52 82c4-30 26-42 48-42s44 12 48 42c-30-12-66-12-96 0z" ${st}/>`;
    case 'half':
      return `<path d="M100 42c30 0 50 18 54 48-16-8-30-30-54-34z" ${st}/><path d="M54 84c6-22 22-36 46-40" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="2 4"/>`;
    case 'afro':
      return `<path d="M44 92c2-36 26-54 56-54s54 18 56 54c-20-14-38-18-56-18s-36 4-56 18z" ${st}/>`;
    case 'quiff':
      return `<path d="M54 86c0-36 20-56 56-60 30-2 44 14 40 30-8-6-24-8-34-2 10 6 14 18 12 30-14-12-46-14-74 2z" ${st}/>`;
    case 'braid':
      return (
        Array.from({ length: 6 }, (_, i) => `<ellipse cx="100" cy="${64 - i * 12}" rx="11" ry="8" ${st}/>`).join('') +
        `<path d="M100 8v-8" stroke="${INK}" stroke-width="3"/>`
      );
    case 'fringe':
      return `<path d="${spikes(7, 50, 150, 96, 62)}" ${st}/><path d="M50 82c6-30 26-42 50-42s44 12 50 42" ${st}/>`;
    case 'bun':
      return `<path d="M52 84c2-28 22-44 48-44s46 16 48 44c-30-12-66-12-96 0z" ${st}/><circle cx="100" cy="30" r="16" ${st}/><path d="M88 26h24" stroke="${INK}" stroke-width="2"/>`;
    case 'long':
      return `<path d="M52 92c0-34 22-52 48-52s48 18 48 52c-14-12-30-18-48-18s-34 6-48 18z" ${st}/>`;
    case 'flame':
      return `<path d="M52 84c-6-30 6-50 20-62 0 14 4 22 10 26 0-20 8-38 22-48 0 18 6 30 14 36 4-12 12-20 22-24-4 12-2 24 4 34 6-8 8-16 8-24 10 18 6 46-4 62-30-12-66-12-96 0z" ${st}/>`;
    default:
      return '';
  }
}

/** A beard or moustache, over the face. */
export function beardSvg(id: string | null): string {
  switch (id) {
    case 'full':
      return `<path d="M52 118c0 34 20 58 48 58s48-24 48-58c-8 10-18 14-26 12-6 6-14 8-22 8s-16-2-22-8c-8 2-18-2-26-12z" fill="${BEARD}" stroke="${INK}" stroke-width="3"/><path d="M84 142c10 6 22 6 32 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
    case 'goatee':
      return `<path d="M90 150c0 18 6 28 10 28s10-10 10-28c-6 4-14 4-20 0z" fill="${BEARD}" stroke="${INK}" stroke-width="3"/>`;
    case 'handlebar':
      return `<path d="M100 134c-10-6-24-4-32 6-4 6 0 10 4 6 6-8 18-8 28-4 10-4 22-4 28 4 4 4 8 0 4-6-8-10-22-12-32-6z" fill="${BEARD}" stroke="${INK}" stroke-width="2.5"/>`;
    case 'chops':
      return `<path d="M50 100c-2 18 2 34 12 40 2-12 4-26 0-38zM150 100c2 18-2 34-12 40-2-12-4-26 0-38z" fill="${BEARD}" stroke="${INK}" stroke-width="2.5"/>`;
    default:
      return '';
  }
}
