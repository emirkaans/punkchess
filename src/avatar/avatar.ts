// A player's character: picked part by part when they sign up (src/ui/CharacterCreator.tsx),
// stored as a short JSON of part ids, drawn as an SVG from those ids. New parts can be added
// to the lists freely; a stored id that is no longer offered is still drawn when its drawing
// stays (only `offered: false`), and an unknown one falls back to the default. Pure: no DOM.

import { beardSvg, cutBack, cutFront, hairPaint, painted } from './barber.ts';
import { faceTattooSvg, neckTattooSvg } from './tattoos.ts';
import { isBody } from './body.ts';
import { hatSvg, headAccessorySvg, naturalBeard } from './outfit.ts';
import type { Outfit } from './outfit.ts';

export interface Avatar {
  readonly head: string;
  readonly skin: string;
  /** The body (src/avatar/body.ts): a ready type, or "c-<shoulders>-<waist>-<hips>". */
  readonly body: string;
  readonly eyes: string;
  readonly lashes: string;
  readonly mouth: string;
  readonly lips: string;
  readonly blush: string;
  readonly hair: string;
  readonly hairColor: string;
  readonly extra: string;
}

export type AvatarPart = keyof Avatar;

/** One option of a part: id (stored), its colour where it is one. */
export interface AvatarOption {
  readonly id: string;
  /** A colour part's colour (skin, hair colour). */
  readonly color?: string;
}

/** The parts in the order the creator shows them. */
export const AVATAR_PARTS: readonly AvatarPart[] = [
  'head',
  'skin',
  'body',
  'eyes',
  'lashes',
  'mouth',
  'lips',
  'blush',
  'hair',
  'hairColor',
  'extra',
];

export const AVATAR_OPTIONS: Readonly<Record<AvatarPart, readonly AvatarOption[]>> = {
  head: [{ id: 'oval' }, { id: 'round' }, { id: 'jaw' }, { id: 'long' }],
  // Real skin tones from the lightest to the darkest (pink, yellow and olive undertones), then
  // the fantasy ones. Stored ids never change; new tones can go anywhere in the list.
  skin: [
    { id: 'porcelain', color: '#fbe6d6' },
    { id: 'light', color: '#f4d3b8' },
    { id: 'rosy', color: '#efc0a6' },
    { id: 'wheat', color: '#e8b48f' },
    { id: 'golden', color: '#d9a066' },
    { id: 'olive', color: '#c4a074' },
    { id: 'tan', color: '#c98a5e' },
    { id: 'honey', color: '#b5733f' },
    { id: 'brown', color: '#9a5f3a' },
    { id: 'umber', color: '#7a4a2e' },
    { id: 'dark', color: '#5e3a24' },
    { id: 'ebony', color: '#3f2618' },
    { id: 'zombie', color: '#b9f0c8' },
    { id: 'smurf', color: '#8fc7ff' },
    { id: 'violet', color: '#b89be8' },
    { id: 'stone', color: '#b7b4bc' },
    { id: 'demon', color: '#e0574a' },
  ],
  // Body types (the ready ones; a custom body is stored as "c-…", see src/avatar/body.ts).
  body: [{ id: 'slim' }, { id: 'mid' }, { id: 'broad' }, { id: 'curvy' }],
  eyes: [{ id: 'dot' }, { id: 'angry' }, { id: 'sleepy' }, { id: 'liner' }, { id: 'star' }, { id: 'x' }],
  lashes: [{ id: 'none' }, { id: 'short' }, { id: 'long' }],
  mouth: [{ id: 'smirk' }, { id: 'grin' }, { id: 'flat' }, { id: 'tongue' }, { id: 'snarl' }],
  // Lipstick colours a mouth; blush the cheeks. Either is for anyone.
  lips: [{ id: 'none' }, { id: 'red' }, { id: 'black' }, { id: 'pink' }, { id: 'purple' }, { id: 'blue' }],
  blush: [{ id: 'none' }, { id: 'pink' }, { id: 'peach' }],
  hair: [{ id: 'mohawk' }, { id: 'spikes' }, { id: 'messy' }, { id: 'buzz' }, { id: 'bob' }, { id: 'bald' }],
  hairColor: [
    { id: 'pink', color: '#ff2e93' },
    { id: 'lime', color: '#c6ff3d' },
    { id: 'black', color: '#141016' },
    { id: 'platinum', color: '#efe6c8' },
    { id: 'blue', color: '#4aa8ff' },
    { id: 'red', color: '#e5352b' },
  ],
  extra: [{ id: 'none' }, { id: 'nosering' }, { id: 'brow' }, { id: 'pin' }, { id: 'tattoo' }, { id: 'bandaid' }],
};

export const DEFAULT_AVATAR: Avatar = {
  head: 'oval',
  skin: 'wheat',
  body: 'mid',
  eyes: 'angry',
  lashes: 'none',
  mouth: 'smirk',
  lips: 'none',
  blush: 'none',
  hair: 'mohawk',
  hairColor: 'pink',
  extra: 'nosering',
};

const known = (part: AvatarPart, id: unknown): id is string =>
  part === 'body' ? isBody(id) : typeof id === 'string' && AVATAR_OPTIONS[part].some((o) => o.id === id);

/** An avatar from anything (stored JSON, a request body): unknown parts become the default's. */
export function parseAvatar(input: unknown): Avatar {
  let data: unknown = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch {
      data = null;
    }
  }
  const obj = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_AVATAR } as Record<AvatarPart, string>;
  for (const part of AVATAR_PARTS) if (known(part, obj[part])) out[part] = obj[part] as string;
  return out;
}

/** Whether `input` names a known option for every part (a request must, to be saved). */
export function isAvatar(input: unknown): input is Avatar {
  if (!input || typeof input !== 'object') return false;
  const obj = input as Record<string, unknown>;
  return AVATAR_PARTS.every((part) => known(part, obj[part]));
}

/** The avatar as stored (only its parts, in a fixed order). */
export const serializeAvatar = (a: Avatar): string =>
  JSON.stringify(Object.fromEntries(AVATAR_PARTS.map((p) => [p, a[p]])));

/** A random avatar (the creator's dice). */
export function randomAvatar(random: () => number = Math.random): Avatar {
  const out = {} as Record<AvatarPart, string>;
  for (const part of AVATAR_PARTS) {
    const list = AVATAR_OPTIONS[part];
    out[part] = list[Math.floor(random() * list.length)].id;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Drawing (200×200)

/** A colour part's colour (the skin, for the full figure's hands). */
export const skinColor = (a: Avatar): string => colorOf('skin', a.skin);

const INK = '#141016';
const colorOf = (part: 'skin' | 'hairColor', id: string) =>
  AVATAR_OPTIONS[part].find((o) => o.id === id)?.color ?? AVATAR_OPTIONS[part][0].color!;

/** `hex` darkened (f < 1) or lightened (f > 1). */
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

function headPath(head: string): string {
  if (head === 'round') return 'M100 46c34 0 56 26 56 62s-22 64-56 64-56-28-56-64 22-62 56-62z';
  if (head === 'jaw') return 'M54 70c4-18 22-26 46-26s42 8 46 26l4 50c0 24-14 46-50 52-36-6-50-28-50-52z';
  if (head === 'long') return 'M100 40c30 0 50 22 50 56v34c0 28-20 48-50 48s-50-20-50-48V96c0-34 20-56 50-56z';
  return 'M100 44c32 0 54 24 54 60 0 40-24 70-54 70s-54-30-54-70c0-36 22-60 54-60z';
}

function hairBack(hair: string, c: string): string {
  if (hair === 'messy')
    return `<path d="M42 110c-8-40 14-76 58-76s66 36 58 76l-8 30c0-30-6-58-50-58s-50 28-50 58z" fill="${c}" stroke="${INK}" stroke-width="3"/>`;
  if (hair === 'bob')
    return `<path d="M40 128c-6-50 16-90 60-90s66 40 60 90c-6 6-14 8-20 4l-2-40c-10 8-58 8-76 0l-2 40c-6 4-14 2-20-4z" fill="${c}" stroke="${INK}" stroke-width="3"/>`;
  return '';
}

function hairFront(hair: string, c: string, skin: string): string {
  switch (hair) {
    case 'mohawk':
      return `<path d="M88 52 L80 8 L94 26 L100 0 L106 26 L120 8 L112 52 Z" fill="${c}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M60 72c10-14 70-14 80 0" fill="none" stroke="${shade(skin, 0.75)}" stroke-width="3" stroke-dasharray="2 4"/>`;
    case 'spikes':
      return `<path d="M50 78 L36 34 L64 56 L70 14 L88 48 L100 6 L112 48 L130 14 L136 56 L164 34 L150 78 C130 62 70 62 50 78Z" fill="${c}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
    case 'messy':
      return `<path d="M50 84c4-30 26-42 50-42s48 12 50 42c-10-12-18-14-26-10 2-8-2-14-8-16-4 10-14 14-24 12-6 8-22 6-42 14z" fill="${c}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
    case 'buzz':
      return `<path d="M50 84c2-28 24-42 50-42s48 14 50 42c-30-10-70-10-100 0z" fill="${c}" opacity=".9" stroke="${INK}" stroke-width="3"/><g fill="${INK}" opacity=".18">${Array.from({ length: 18 }, (_, i) => `<circle cx="${60 + (i % 9) * 10}" cy="${58 + Math.floor(i / 9) * 10}" r="1.4"/>`).join('')}</g>`;
    case 'bob':
      return `<path d="M48 92c0-32 22-52 52-52s52 20 52 52c-14-4-24-10-30-20-10 12-34 16-74 20z" fill="${c}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
    default:
      return `<path d="M70 60c10-6 50-6 60 0" fill="none" stroke="#fff" stroke-width="4" opacity=".35" stroke-linecap="round"/>`;
  }
}

function eyes(kind: string): string {
  const L = 80;
  const R = 120;
  const Y = 108;
  switch (kind) {
    case 'angry':
      return `<path d="M66 94l24 8M134 94l-24 8" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><circle cx="${L}" cy="${Y}" r="6" fill="${INK}"/><circle cx="${R}" cy="${Y}" r="6" fill="${INK}"/>`;
    case 'sleepy':
      return `<path d="M70 108h20M110 108h20" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M70 104c6-6 14-6 20 0M110 104c6-6 14-6 20 0" fill="none" stroke="${INK}" stroke-width="3"/>`;
    case 'liner':
      return `<ellipse cx="${L}" cy="${Y}" rx="10" ry="7" fill="#fff" stroke="${INK}" stroke-width="4"/><ellipse cx="${R}" cy="${Y}" rx="10" ry="7" fill="#fff" stroke="${INK}" stroke-width="4"/><circle cx="${L}" cy="${Y}" r="4" fill="${INK}"/><circle cx="${R}" cy="${Y}" r="4" fill="${INK}"/><path d="M90 104l8-6M130 104l8-6M70 104l-8-6M110 104l-8-6" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
    case 'star':
      return [L, R]
        .map(
          (x) =>
            `<path d="M${x} ${Y - 10}l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z" fill="#c6ff3d" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`,
        )
        .join('');
    case 'x':
      return `<path d="M${L - 7} ${Y - 7}l14 14M${L + 7} ${Y - 7}l-14 14" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><circle cx="${R}" cy="${Y}" r="6" fill="${INK}"/>`;
    default:
      return `<circle cx="${L}" cy="${Y}" r="6" fill="${INK}"/><circle cx="${R}" cy="${Y}" r="6" fill="${INK}"/>`;
  }
}

const LIPS: Readonly<Record<string, string>> = {
  red: '#c8182a',
  black: '#141016',
  pink: '#ff2e93',
  purple: '#7a2bb8',
  blue: '#2b6fd6',
};

/** Lashes at the eyes' outer corners. */
function lashes(kind: string): string {
  if (kind === 'none') return '';
  const n = kind === 'long' ? 9 : 6;
  return `<path d="M${68 - n * 0.3} 102l-${n} -${n}M${74} 99l-${n * 0.4} -${n}M${132 + n * 0.3} 102l${n} -${n}M${126} 99l${n * 0.4} -${n}" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`;
}

/** Blush on the cheeks. */
function blush(kind: string): string {
  const c = kind === 'pink' ? '#ff6f9a' : kind === 'peach' ? '#ffa36b' : null;
  return c
    ? `<ellipse cx="66" cy="128" rx="11" ry="6" fill="${c}" opacity=".45"/><ellipse cx="134" cy="128" rx="11" ry="6" fill="${c}" opacity=".45"/>`
    : '';
}

/** The mouth, in a lipstick's colour when one is worn (its lines thicker). */
function lipsMouth(kind: string, lips: string): string {
  const c = LIPS[lips];
  if (!c) return mouth(kind);
  return mouth(kind)
    .replace(/stroke="#141016" stroke-width="(\d+)"/g, (_m, w) => `stroke="${c}" stroke-width="${Number(w) + 2}"`)
    .replace(/fill="#fff"/g, `fill="${c}"`);
}

function mouth(kind: string): string {
  switch (kind) {
    case 'grin':
      return `<path d="M78 140c8 12 36 12 44 0z" fill="#fff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M89 141v7M100 142v8M111 141v7" stroke="${INK}" stroke-width="2"/>`;
    case 'flat':
      return `<path d="M84 144h32" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
    case 'tongue':
      return `<path d="M80 140c8 10 32 10 40 0" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M94 146c0 12 14 12 14 0" fill="#ff6fae" stroke="${INK}" stroke-width="3"/>`;
    case 'snarl':
      return `<path d="M80 146c8-8 32-8 40 0-8-2-14 0-20 4-6-4-12-6-20-4z" fill="#fff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`;
    default:
      return `<path d="M84 144c10 6 24 4 34-6" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  }
}

function extra(kind: string): string {
  switch (kind) {
    case 'nosering':
      return `<circle cx="104" cy="130" r="5" fill="none" stroke="#d8d4dc" stroke-width="2.5"/>`;
    case 'brow':
      return `<circle cx="128" cy="92" r="2.6" fill="#d8d4dc" stroke="${INK}" stroke-width="1"/><circle cx="134" cy="96" r="2.6" fill="#d8d4dc" stroke="${INK}" stroke-width="1"/>`;
    case 'pin':
      return `<path d="M156 118v26" stroke="#d8d4dc" stroke-width="3" stroke-linecap="round"/><circle cx="156" cy="146" r="4" fill="none" stroke="#d8d4dc" stroke-width="2.5"/>`;
    case 'tattoo':
      return `<path d="M64 126l2 5 5 .5-4 3.5 1.5 5-4.5-3-4.5 3 1.5-5-4-3.5 5-.5z" fill="${INK}" opacity=".8"/>`;
    case 'bandaid':
      return `<g transform="rotate(-25 128 128)"><rect x="114" y="122" width="28" height="11" rx="4" fill="#f2c9a0" stroke="${INK}" stroke-width="2"/><rect x="123" y="122" width="10" height="11" fill="#e4b088"/></g>`;
    default:
      return '';
  }
}

/** A view with room above the head for the tallest cuts (the barber's mirror). */
export const TALL_VIEW = '-25 -50 250 250';

/**
 * The avatar as an SVG string (200×200 view box, scales to its box). With an outfit, its head
 * items are drawn: a barber's cut (in place of the hair), colour and beard, then a hat, glasses
 * or headphones on top. Tall cuts reach above the box; `view` can make room for them.
 */
export function avatarSvg(a: Avatar, outfit: Outfit | null = null, view = '0 0 200 200'): string {
  const skin = colorOf('skin', a.skin);
  const paint = hairPaint(outfit?.color ?? null, colorOf('hairColor', a.hairColor));
  const hair = paint.fill;
  const cut = outfit?.cut ?? null;
  // The beard: a natural colour, a premium one (its own paint), or brown.
  const bc = outfit?.beardColor ?? null;
  const natural = naturalBeard(bc);
  const beardPaint = bc && !natural ? hairPaint(bc, '#3a2a20') : null;
  const defs = paint.defs + (beardPaint && beardPaint.defs !== paint.defs ? beardPaint.defs : '');
  return (
    `<svg viewBox="${view}" overflow="visible" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    (defs ? `<defs>${defs}</defs>` : '') +
    painted(cut ? cutBack(cut, hair) : hairBack(a.hair, hair), paint) +
    `<path d="M72 168c6 10 50 10 56 0l6 32H66z" fill="${shade(skin, 0.85)}" stroke="${INK}" stroke-width="3"/>` +
    neckTattooSvg(outfit?.tattooNeck ?? null) +
    `<ellipse cx="46" cy="114" rx="8" ry="12" fill="${skin}" stroke="${INK}" stroke-width="3"/>` +
    `<ellipse cx="154" cy="114" rx="8" ry="12" fill="${skin}" stroke="${INK}" stroke-width="3"/>` +
    `<path d="${headPath(a.head)}" fill="${skin}" stroke="${INK}" stroke-width="4"/>` +
    `<path d="M98 112c-2 8-4 14 2 18" fill="none" stroke="${shade(skin, 0.7)}" stroke-width="3" stroke-linecap="round"/>` +
    blush(a.blush) +
    eyes(a.eyes) +
    lashes(a.lashes) +
    lipsMouth(a.mouth, a.lips) +
    extra(a.extra) +
    faceTattooSvg(outfit?.tattooFace ?? null) +
    (beardPaint
      ? painted(beardSvg(outfit?.beard ?? null, beardPaint.fill), beardPaint)
      : beardSvg(outfit?.beard ?? null, natural ?? undefined)) +
    painted(cut ? cutFront(cut, hair) : hairFront(a.hair, hair, skin), paint) +
    (outfit ? headAccessorySvg(outfit.acc) + hatSvg(outfit.hat) + headAccessorySvg(outfit.eyewear) : '') +
    `</svg>`
  );
}

/** A part's colour where it is a colour part (for swatches), else null. */
export const optionColor = (part: AvatarPart, id: string): string | null =>
  AVATAR_OPTIONS[part].find((o) => o.id === id)?.color ?? null;
