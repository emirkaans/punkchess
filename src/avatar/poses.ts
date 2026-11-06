// The character's poses during a game (src/ui/PlayerRow.tsx, src/ui/GameFinale.tsx): thinking
// poses that change every few moves, and how the winner and the loser take the result. A pose is
// the line of each arm (shoulder, elbow, hand) drawn as a tube; every jacket fills it, so every
// item fits every pose. Pure: no DOM.

import type { BodyGeom } from './body.ts';

type Point = readonly [number, number];
/** One arm's line for side -1 (left on screen) or 1; null keeps the arm hanging as it is. */
type ArmLine = (side: -1 | 1, g: BodyGeom) => readonly Point[] | null;

export interface Pose {
  /** Arms drawn over the body (and the head), not behind it. */
  readonly front?: boolean;
  /** No hands shown (in the pockets). */
  readonly hidden?: boolean;
  /** The arms; two frames take turns (a fist pumping). */
  readonly arms: readonly ArmLine[];
}

const shoulder = (s: number, g: BodyGeom, y = 132): Point => [100 + s * (g.S - 6), y];

export const POSES: Readonly<Record<string, Pose>> = {
  idle: { arms: [] },
  cross: { front: true, arms: [(s, g) => [shoulder(s, g), [100 + s * (g.S + 6), 172], [100 - s * (g.S * 0.5), 156]]] },
  pockets: {
    hidden: true,
    arms: [(s, g) => [shoulder(s, g), [100 + s * (g.S + 12), 178], [100 + s * (g.W * 0.75), 206]]],
  },
  chin: {
    front: true,
    arms: [
      (s, g) =>
        s > 0 ? [shoulder(s, g), [104, 184], [112, 104]] : [shoulder(s, g), [100 - (g.S + 4), 176], [118, 186]],
    ],
  },
  hips: { arms: [(s, g) => [shoulder(s, g), [100 + s * (g.S + 24), 168], [100 + s * (g.W + 3), 200]]] },
  scratch: { arms: [(s, g) => (s < 0 ? [shoulder(s, g), [100 - (g.S + 20), 96], [76, 62]] : null)] },
  shrug: { arms: [(s, g) => [shoulder(s, g), [100 + s * (g.S + 10), 184], [100 + s * (g.S + 32), 158]]] },
  win: { arms: [(s, g) => [shoulder(s, g), [100 + s * (g.S + 14), 96], [100 + s * (g.S + 20), 50]]] },
  pump: {
    arms: [
      (s, g) => (s > 0 ? [shoulder(s, g), [100 + (g.S + 16), 104], [100 + (g.S + 12), 58]] : null),
      (s, g) => (s > 0 ? [shoulder(s, g), [100 + (g.S + 20), 122], [100 + (g.S + 10), 94]] : null),
    ],
  },
  guitar: {
    front: true,
    arms: [
      (s, g) =>
        s < 0
          ? [shoulder(s, g), [100 - (g.S + 20), 150], [100 - (g.S + 38), 140]]
          : [shoulder(s, g), [100 + (g.S + 6), 174], [112, 176]],
      (s, g) =>
        s < 0
          ? [shoulder(s, g), [100 - (g.S + 20), 150], [100 - (g.S + 38), 140]]
          : [shoulder(s, g), [100 + (g.S + 6), 170], [116, 194]],
    ],
  },
  dance: {
    arms: [
      (s, g) =>
        s < 0
          ? [shoulder(s, g), [100 - (g.S + 14), 96], [100 - (g.S + 20), 50]]
          : [shoulder(s, g), [100 + (g.S + 14), 170], [100 + (g.S + 28), 194]],
      (s, g) =>
        s > 0
          ? [shoulder(s, g), [100 + (g.S + 14), 96], [100 + (g.S + 20), 50]]
          : [shoulder(s, g), [100 - (g.S + 14), 170], [100 - (g.S + 28), 194]],
    ],
  },
  lose: {
    arms: [(s, g) => [shoulder(s, g, 134), [100 + s * (g.S + 1), 178], [100 + s * (g.S - 3), 226]]],
  },
  facepalm: {
    front: true,
    arms: [
      (s, g) =>
        s > 0
          ? [shoulder(s, g), [100 + (g.S + 4), 168], [114, 72]]
          : [shoulder(s, g, 134), [100 - (g.S + 1), 178], [100 - (g.S - 3), 226]],
    ],
  },
  headhands: { front: true, arms: [(s, g) => [shoulder(s, g), [100 + s * (g.S + 2), 154], [100 + s * 30, 84]]] },
  rage: { arms: [(s, g) => [shoulder(s, g), [100 + s * (g.S + 8), 178], [100 + s * (g.S + 6), 214]]] },
};

/** Poses while thinking, and how a winner and a loser take the result. */
export const THINKING = ['cross', 'pockets', 'chin', 'hips', 'scratch', 'shrug'] as const;
export const WINS = ['win', 'pump', 'guitar', 'dance'] as const;
export const LOSSES = ['lose', 'facepalm', 'headhands', 'rage'] as const;

/** Frames of `pose` (1, or 2 that take turns). */
export const framesOf = (pose: string): number => Math.max(1, POSES[pose]?.arms.length ?? 1);

const f = (n: number) => n.toFixed(1);

/** An arm along `pts`: a tube `w0` wide at the shoulder, `w1` at the hand, bending smoothly. */
function limb(pts: readonly Point[], w0: number, w1: number): string {
  const n = pts.length;
  const L: Point[] = [];
  const R: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const dx = (b[0] - a[0]) / len;
    const dy = (b[1] - a[1]) / len;
    const w = (w0 + ((w1 - w0) * i) / (n - 1)) / 2;
    L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
    R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
  }
  const mix = (p: Point, q: Point, t: number): Point => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const side = (S: Point[]) => {
    let d = `${f(S[0][0])} ${f(S[0][1])}`;
    for (let i = 1; i < n - 1; i++) {
      const a = mix(S[i - 1], S[i], 0.65);
      const b = mix(S[i], S[i + 1], 0.35);
      d += ` L${f(a[0])} ${f(a[1])} Q${f(S[i][0])} ${f(S[i][1])} ${f(b[0])} ${f(b[1])}`;
    }
    return `${d} L${f(S[n - 1][0])} ${f(S[n - 1][1])}`;
  };
  return `M${side(L)} L${side([...R].reverse())} Z`;
}

/** The body's shapes in `pose` (its frame `frame`): the arms and the hands move, the rest stays. */
export function posedGeom(g: BodyGeom, pose: string, frame = 0): BodyGeom {
  const p = POSES[pose];
  const line = p?.arms[frame % Math.max(1, p.arms.length)];
  if (!p || !line) return g;
  const arms = ([-1, 1] as const).map((s) => line(s, g));
  const hands: Point[] = [];
  arms.forEach((pts, i) => {
    if (!pts) hands.push(g.hands[i]);
    else if (!p.hidden) hands.push(pts[pts.length - 1]);
  });
  return {
    ...g,
    armL: arms[0] ? limb(arms[0], 17, 13) : g.armL,
    armR: arms[1] ? limb(arms[1], 17, 13) : g.armR,
    hands,
  };
}

/** A small number from a string (a game's id): the same in every browser. */
export function seedOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const next = (seed: number) => (Math.imul(seed, 1103515245) + 12345) >>> 0;

/**
 * The thinking pose of `color` after `ply` half-moves of the game seeded `seed`: standing at
 * first, then a new pose every 5–6 moves (10–12 plies), never the same twice in a row. Both
 * players' browsers work it out alike, so both see the same.
 */
export function poseAt(seed: number, color: 'w' | 'b', ply: number): string {
  let r = next(seed ^ (color === 'w' ? 0x9e3779b1 : 0x7f4a7c15));
  let at = 0;
  let pose = 'idle';
  for (;;) {
    r = next(r);
    const len = 10 + (r % 3);
    if (at + len > ply) return pose;
    at += len;
    let pick: string;
    do {
      r = next(r);
      pick = THINKING[r % THINKING.length];
    } while (pick === pose);
    pose = pick;
  }
}

/** How `color` takes the result of the game seeded `seed` (`winner` null: a draw). */
export function endPose(seed: number, color: 'w' | 'b', winner: 'w' | 'b' | null): string {
  const r = next(seed ^ (color === 'w' ? 0x51ed270b : 0x2b9f3c47));
  if (!winner) return 'shrug';
  return winner === color ? WINS[r % WINS.length] : LOSSES[r % LOSSES.length];
}
