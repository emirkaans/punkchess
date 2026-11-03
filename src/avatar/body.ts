// The character's body (the full figure's 200×360 box, src/avatar/figure.ts): shoulders, waist
// and hips, each 0–100, from a ready type (slim, mid, broad, curvy) or set by hand. Everything
// worn on the body is drawn from these shapes, so every item fits every body. Pure: no DOM.

export interface BodyShape {
  /** Shoulders, waist, hips: 0 (narrow) to 100 (wide). */
  readonly s: number;
  readonly w: number;
  readonly h: number;
}

/** The ready types (Avatar.body ids); 'mid' is how every character looked before. */
export const BODY_TYPES: Readonly<Record<string, BodyShape>> = {
  slim: { s: 10, w: 15, h: 10 },
  mid: { s: 45, w: 50, h: 40 },
  broad: { s: 95, w: 80, h: 55 },
  curvy: { s: 40, w: 22, h: 85 },
};

const CUSTOM = /^c-(\d{1,3})-(\d{1,3})-(\d{1,3})$/;

/** A body as stored: a ready type's id, or "c-<shoulders>-<waist>-<hips>". */
export const isBody = (v: unknown): v is string => {
  if (typeof v !== 'string') return false;
  if (v in BODY_TYPES) return true;
  const m = CUSTOM.exec(v);
  return !!m && [m[1], m[2], m[3]].every((n) => Number(n) <= 100);
};

export const bodyShape = (v: string): BodyShape => {
  const m = CUSTOM.exec(v);
  return m ? { s: +m[1], w: +m[2], h: +m[3] } : (BODY_TYPES[v] ?? BODY_TYPES.mid);
};

export const customBody = (b: BodyShape): string => `c-${Math.round(b.s)}-${Math.round(b.w)}-${Math.round(b.h)}`;

/** The shapes everything on the body is drawn from. */
export interface BodyGeom {
  readonly S: number;
  readonly W: number;
  readonly H: number;
  readonly torso: string;
  readonly armL: string;
  readonly armR: string;
  readonly legL: string;
  readonly legR: string;
  /** Where the hands and the ankles are. */
  readonly hands: readonly (readonly [number, number])[];
  readonly ankles: readonly [number, number];
  /** The waist's height (skirts hang from it) and the hips' half width there. */
  readonly waistY: number;
}

const lerp = (a: number, b: number, t: number) => a + ((b - a) * t) / 100;
const f = (x: number) => x.toFixed(1);

const cache = new Map<string, BodyGeom>();

/** The body's shapes: a rounded torso, two legs tapering to the ankles, arms outside the hips. */
export function bodyGeom(body: string = 'mid'): BodyGeom {
  const hit = cache.get(body);
  if (hit) return hit;
  const b = bodyShape(body);
  const S = lerp(30, 48, b.s);
  const W = lerp(23, 41, b.w);
  const H = lerp(27, 46, b.h);
  const L = (x: number) => f(100 - x);
  const R = (x: number) => f(100 + x);
  const torso =
    `M${L(13)} 117 C${L(20)} 120 ${L(S - 6)} 120 ${L(S - 1)} 128 C${L(S + 2)} 134 ${L(S)} 150 ${L((S + W) / 2)} 168 ` +
    `C${L(W - 2)} 180 ${L(W)} 192 ${L(W + 1)} 200 C${L(W + 3)} 214 ${L(H)} 222 ${L(H)} 236 ` +
    `Q100 242 ${R(H)} 236 ` +
    `C${R(H)} 222 ${R(W + 3)} 214 ${R(W + 1)} 200 C${R(W)} 192 ${R(W - 2)} 180 ${R((S + W) / 2)} 168 ` +
    `C${R(S)} 150 ${R(S + 2)} 134 ${R(S - 1)} 128 C${R(S - 6)} 120 ${R(20)} 120 ${R(13)} 117 Z`;
  const ankle = (side: number) => 100 + side * (H * 0.45 + 6);
  const leg = (side: number) => {
    const out = 100 + side * H;
    const a = ankle(side);
    const inner = 100 + side * 2;
    return (
      `M${f(out)} 232 C${f(out + side)} 262 ${f(a + side * 14)} 292 ${f(a + side * 12)} 330 ` +
      `L${f(a - side * 12)} 330 C${f(a - side * 12)} 300 ${f(inner)} 270 ${f(inner)} 236 Z`
    );
  };
  // The hand hangs outside the hips (wide hips push it out).
  const reach = Math.max(S + 16, H + 14);
  const arm = (side: number) => {
    const sx = 100 + side * (S - 2);
    const hx = 100 + side * reach;
    return (
      `M${f(sx)} 126 C${f(sx + side * 12)} 128 ${f(sx + side * 16)} 140 ${f(sx + side * 16)} 156 ` +
      `L${f(hx + side * 2)} 220 L${f(hx - side * 12)} 220 L${f(sx + side * 2)} 166 Z`
    );
  };
  const geom: BodyGeom = {
    S,
    W,
    H,
    torso,
    armL: arm(-1),
    armR: arm(1),
    legL: leg(-1),
    legR: leg(1),
    hands: [
      [100 - reach + 5, 224],
      [100 + reach - 5, 224],
    ],
    ankles: [ankle(-1), ankle(1)],
    waistY: 200,
  };
  cache.set(body, geom);
  return geom;
}

/** The boots under the ankles. */
export function bootsSvg(g: BodyGeom, ink: string): string {
  const boot = (x: number, side: number) =>
    `<path d="M${f(x - 14)} 328h28c4 4 ${side > 0 ? 8 : 4} 10 ${side > 0 ? 8 : 4} 16H${f(x - 18)}c0-8 1-12 4-16z" fill="#141016" stroke="${ink}" stroke-width="2"/>`;
  return boot(g.ankles[0], -1) + boot(g.ankles[1], 1);
}

let clipN = 0;
/** `inner` clipped to the union of `shapes` (paths): details stay on the garment. */
export function clipTo(shapes: readonly string[], inner: string): string {
  if (!inner) return '';
  const id = `pc-body-${(clipN = (clipN + 1) % 1_000_000)}`;
  return `<clipPath id="${id}">${shapes.map((d) => `<path d="${d}"/>`).join('')}</clipPath><g clip-path="url(#${id})">${inner}</g>`;
}

/** A band above the torso (collars, hoods) that details may also reach. */
export const NECK_BAND = 'M30 96H170V132H30z';
