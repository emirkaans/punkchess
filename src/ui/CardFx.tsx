import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { fileOf, rankOf } from '../engine/index.ts';
import type { Piece, Position, Square, VariantDefinition } from '../engine/index.ts';
import type { CardResult } from './cardResult.ts';
import { PieceView } from './PieceView.tsx';

interface Props {
  variant: VariantDefinition;
  result: CardResult;
  /** The position after the card (what the board shows). */
  position: Position;
  flipped: boolean;
  /** The board: its squares (data-square) and their pieces are animated too. */
  boardRef: RefObject<HTMLDivElement | null>;
}

/** Pieces drawn over the board for the animation: ones the card took off or changed. */
function ghostsOf(r: CardResult): { square: Square; piece: Piece }[] {
  const [c0, c1] = r.changes;
  const at = (c: typeof c0 | undefined) => (c?.before ? [{ square: c.square, piece: c.before }] : []);
  switch (r.id) {
    case 'pawn':
      return r.changes.flatMap(at);
    case 'swap':
    case 'quake':
      return [...at(c0), ...at(c1)];
    case 'ambush':
    case 'traitor':
    case 'demote':
      return at(c0);
    default:
      return [];
  }
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * A card just played (Anarşi): its animation on the board, once (keyed by the move). The board
 * already shows the result; pieces the card took off or changed are drawn over it as ghosts and
 * animated away, the pieces now on the board animated in. Nothing stays: every effect fades out.
 */
export function CardFx({ variant, result, position, flipped, boardRef }: Props) {
  const layer = useRef<HTMLDivElement>(null);
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const ghosts = ghostsOf(result);

  useLayoutEffect(() => {
    const fx = layer.current;
    const board = boardRef.current;
    if (still || !fx || !board) return;
    const S = board.clientWidth / 8;
    const timers: number[] = [];
    const touched: Animation[] = [];
    const added: HTMLElement[] = [];
    const xy = (sq: Square) => ({
      x: (flipped ? 7 - fileOf(sq) : fileOf(sq)) * S,
      y: (flipped ? rankOf(sq) : 7 - rankOf(sq)) * S,
    });
    const center = (sq: Square) => {
      const p = xy(sq);
      return { x: p.x + S / 2, y: p.y + S / 2 };
    };
    const box = (sq: Square, f = 1) => {
      const c = center(sq);
      return `left:${c.x - (S * f) / 2}px;top:${c.y - (S * f) / 2}px;width:${S * f}px;height:${S * f}px;`;
    };
    const squareEl = (sq: Square) => board.querySelector<HTMLElement>(`[data-square="${sq}"]`);
    const real = (sq: Square) => squareEl(sq)?.querySelector<HTMLElement>('.piece') ?? null;
    const ghost = (sq: Square) => fx.querySelector<HTMLElement>(`[data-ghost="${sq}"]`);
    const make = (css: string, html: string) => {
      const e = document.createElement('div');
      e.style.cssText = `position:absolute;pointer-events:none;${css}`;
      e.innerHTML = html;
      return e;
    };
    // Over the pieces (the effect layer), or inside a square under its piece.
    const add = (css: string, html = '') => fx.appendChild(make(css, html));
    const under = (sq: Square, css: string, html = '') => {
      const e = make(`z-index:1;${css}`, html);
      squareEl(sq)?.appendChild(e);
      added.push(e);
      return e;
    };
    const go = (
      e: Element | null | undefined,
      frames: Keyframe[],
      duration: number,
      delay = 0,
      easing = 'ease-out',
      fill: FillMode = 'forwards',
    ) => {
      if (!e) return;
      const a = e.animate(frames, { duration, delay, easing, fill });
      if (!fx.contains(e)) touched.push(a);
    };
    const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const shake = (amp: number, dur: number) =>
      touched.push(
        board.animate(
          Array.from({ length: 8 }, (_, i) => ({
            transform: i < 7 ? `translate(${rnd(-amp, amp)}px,${rnd(-amp, amp)}px)` : 'none',
          })),
          { duration: dur },
        ),
      );
    const puffs = (sq: Square, n: number) => {
      const c = center(sq);
      for (let d = 0; d < n; d++) {
        const puff = add(
          `left:${c.x - S * 0.13}px;top:${c.y + S * 0.25}px;width:${S * 0.26}px;height:${S * 0.26}px;border-radius:50%;background:rgba(200,195,205,.85);filter:blur(2px)`,
        );
        go(
          puff,
          [
            { transform: 'scale(.4)', opacity: 1 },
            { transform: `translate(${(d - (n - 1) / 2) * S * 0.2}px,${-rnd(4, 10)}px) scale(1.3)`, opacity: 0 },
          ],
          450,
        );
      }
    };

    const r = result;
    const [c0, c1] = r.changes;
    switch (r.id) {
      // Girdap: a pink whirl opens on the square, rings are pulled in, the hole drops in.
      case 'void': {
        const sq = c0.square;
        const whirl = add(
          box(sq) + 'opacity:0',
          `<svg viewBox="0 0 100 100" width="100%" height="100%"><g fill="none" stroke="#ff2e93" stroke-width="3" stroke-linecap="round">${[0, 90, 180, 270].map((d) => `<path d="M50 50 C 60 30, 85 35, 92 55" transform="rotate(${d} 50 50)"/>`).join('')}</g><circle cx="50" cy="50" r="18" fill="#000"/></svg>`,
        );
        go(
          whirl,
          [
            { opacity: 0, transform: 'scale(.2) rotate(0)' },
            { opacity: 1, transform: 'scale(1.1) rotate(540deg)', offset: 0.6 },
            { opacity: 0, transform: 'scale(.6) rotate(900deg)' },
          ],
          1300,
          0,
          'ease-in-out',
        );
        for (let i = 0; i < 3; i++) {
          const ring = add(box(sq, 2.2 - i * 0.3) + 'border-radius:50%;border:2px solid #ff2e93;opacity:0');
          go(
            ring,
            [
              { opacity: 0, transform: 'scale(1.2)' },
              { opacity: 0.9, offset: 0.3 },
              { opacity: 0, transform: 'scale(.1)' },
            ],
            700,
            150 + i * 160,
            'ease-in',
          );
        }
        go(
          real(sq),
          [
            { opacity: 0, transform: 'scale(.3)' },
            { opacity: 1, transform: 'scale(1)' },
          ],
          400,
          950,
          'cubic-bezier(.3,1.6,.5,1)',
          'backwards',
        );
        break;
      }
      // Nişangah: a sight locks on each pawn in turn, a flash, the pawn topples and goes.
      case 'pawn':
        r.changes.forEach((c, i) => {
          const t = 520 * i;
          const sight = add(
            box(c.square, 1.3) + 'opacity:0',
            '<svg viewBox="0 0 100 100" width="100%" height="100%"><g fill="none" stroke="#ff2e93" stroke-width="5"><circle cx="50" cy="50" r="30"/><path d="M50 4v22M50 74v22M4 50h22M74 50h22"/></g><circle cx="50" cy="50" r="5" fill="#ff2e93"/></svg>',
          );
          go(
            sight,
            [
              { opacity: 0, transform: 'scale(1.8) rotate(-90deg)' },
              { opacity: 1, transform: 'scale(1) rotate(0)', offset: 0.55 },
              { opacity: 1, transform: 'scale(.85)', offset: 0.75 },
              { opacity: 0, transform: 'scale(.85)' },
            ],
            600,
            t,
          );
          const flash = add(box(c.square, 0.5) + 'border-radius:50%;background:#fff;opacity:0');
          go(
            flash,
            [
              { opacity: 0 },
              { opacity: 1, transform: 'scale(1.6)', offset: 0.3 },
              { opacity: 0, transform: 'scale(2)' },
            ],
            250,
            t + 380,
          );
          go(
            ghost(c.square),
            [
              { transform: 'rotate(0)', opacity: 1 },
              { transform: `translate(${S * 0.1}px,${S * 0.14}px) rotate(80deg)`, opacity: 1, offset: 0.5 },
              { transform: `translate(${S * 0.14}px,${S * 0.2}px) rotate(90deg)`, opacity: 0 },
            ],
            450,
            t + 420,
            'ease-in',
          );
        });
        break;
      // Kırağı: frost spreads over the square from the middle, sparkles, the piece glows ice blue.
      case 'ice': {
        const sq = c0.square;
        const frost = add(
          box(sq) +
            'background:radial-gradient(circle,rgba(255,255,255,.75),rgba(143,216,255,.6) 55%,rgba(143,216,255,.35));border:2px solid #8fd8ff',
        );
        go(frost, [{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)' }], 700);
        go(frost, [{ opacity: 1 }, { opacity: 0 }], 600, 1000);
        go(
          real(sq),
          [
            { filter: 'none' },
            { filter: 'drop-shadow(0 0 6px #8fd8ff) drop-shadow(0 0 2px #8fd8ff)', offset: 0.4 },
            { filter: 'none' },
          ],
          1500,
          200,
          'ease-in-out',
          'none',
        );
        const c = center(sq);
        for (let i = 0; i < 6; i++) {
          const s = add(
            `left:${c.x + rnd(-S * 0.45, S * 0.35)}px;top:${c.y + rnd(-S * 0.45, S * 0.35)}px;font-size:${S * rnd(0.18, 0.28)}px;color:#fff;opacity:0`,
            '✦',
          );
          go(
            s,
            [
              { opacity: 0, transform: 'scale(.3)' },
              { opacity: 1, transform: 'scale(1.2)', offset: 0.5 },
              { opacity: 0, transform: 'scale(.5)' },
            ],
            500,
            300 + i * 90,
          );
        }
        break;
      }
      // Işın: light comes down on both squares, the pieces thin out and come back swapped.
      case 'swap':
        for (const c of [c0, c1]) {
          if (!c) continue;
          const p = xy(c.square);
          const beam = add(
            `left:${p.x + S * 0.2}px;top:${p.y - S * 1.2}px;width:${S * 0.6}px;height:${S * 2.2}px;background:linear-gradient(transparent,rgba(198,255,61,.85) 60%,rgba(198,255,61,.95));filter:blur(2px);transform-origin:50% 100%`,
          );
          go(
            beam,
            [
              { opacity: 0, transform: 'scaleY(0)' },
              { opacity: 1, transform: 'scaleY(1)', offset: 0.3 },
              { opacity: 1, offset: 0.7 },
              { opacity: 0, transform: 'scaleY(1) scaleX(.2)' },
            ],
            1200,
          );
          go(
            ghost(c.square),
            [
              { transform: 'none', opacity: 1 },
              { transform: 'scaleX(.1) scaleY(1.3)', opacity: 0 },
            ],
            300,
            300,
            'ease-in',
          );
          go(
            real(c.square),
            [
              { transform: 'scaleX(.1) scaleY(1.3)', opacity: 0 },
              { transform: 'none', opacity: 1 },
            ],
            300,
            620,
            'ease-out',
            'backwards',
          );
        }
        break;
      // Baloncuk: an energy bubble opens round the piece, a hexagon pattern flashes on it.
      case 'shield': {
        const sq = c0.square;
        const bubble = add(
          box(sq, 1.15) +
            'border-radius:50%;border:2px solid #8fd8ff;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.55),rgba(143,216,255,.2) 45%,rgba(143,216,255,.08) 70%);box-shadow:0 0 12px rgba(143,216,255,.6)',
        );
        go(
          bubble,
          [
            { transform: 'scale(0)', opacity: 0 },
            { transform: 'scale(1.1)', opacity: 1, offset: 0.3 },
            { transform: 'scale(1)', opacity: 1, offset: 0.45 },
            { transform: 'scale(1.05)', opacity: 1, offset: 0.7 },
            { transform: 'scale(1)', opacity: 0 },
          ],
          1700,
        );
        const hex = add(
          box(sq, 1.15) + 'border-radius:50%;overflow:hidden;opacity:0',
          `<svg viewBox="0 0 60 60" width="100%" height="100%"><g fill="none" stroke="#dff4ff" stroke-width="1.2">${Array.from(
            { length: 25 },
            (_, i) => {
              const x = (i % 5) * 13 + (Math.floor(i / 5) % 2) * 6.5 - 2;
              const y = Math.floor(i / 5) * 11.5 + 2;
              return `<path d="M${x} ${y + 4}l6-3.5 6 3.5v7l-6 3.5-6-3.5z"/>`;
            },
          ).join('')}</g></svg>`,
        );
        go(hex, [{ opacity: 0 }, { opacity: 0.9 }, { opacity: 0 }], 600, 450);
        break;
      }
      // Çakılma: the barricades drop in one after another, dust under each, the board jolts.
      case 'wall':
        r.changes.forEach((c, i) => {
          go(
            real(c.square),
            [
              { transform: `translateY(${-S * 2}px)`, opacity: 0 },
              { opacity: 1, offset: 0.2 },
              { transform: 'none', opacity: 1 },
            ],
            280,
            i * 170,
            'ease-in',
            'backwards',
          );
          later(280 + i * 170, () => {
            shake(2, 150);
            puffs(c.square, 4);
          });
        });
        break;
      // Topraktan: a column of light, the piece comes up out of the ground.
      case 'revive': {
        const sq = c0.square;
        const p = xy(sq);
        const column = under(
          sq,
          `left:0;bottom:0;width:100%;height:150%;background:linear-gradient(transparent,rgba(198,255,61,.6));transform-origin:50% 100%`,
        );
        go(
          column,
          [
            { transform: 'scaleY(0)', opacity: 1 },
            { transform: 'scaleY(1)', opacity: 1, offset: 0.5 },
            { transform: 'scaleY(1)', opacity: 0 },
          ],
          1200,
        );
        go(
          real(sq),
          [
            { clipPath: 'inset(100% 0 0 0)', transform: `translateY(${S * 0.5}px)` },
            { clipPath: 'inset(0 0 0 0)', transform: 'none' },
          ],
          650,
          250,
          'ease-out',
          'backwards',
        );
        for (let i = 0; i < 5; i++) {
          const dirt = add(
            `left:${p.x + rnd(S * 0.1, S * 0.85)}px;top:${p.y + S - S * 0.14}px;width:${S * 0.09}px;height:${S * 0.09}px;background:#6b5a4a;border-radius:1px`,
          );
          go(
            dirt,
            [
              { transform: 'none', opacity: 1 },
              {
                transform: `translate(${rnd(-S * 0.25, S * 0.25)}px,${-rnd(S * 0.18, S * 0.45)}px) rotate(120deg)`,
                opacity: 0,
              },
            ],
            600,
            300 + i * 40,
          );
        }
        break;
      }
      // İzli Kayma: the piece slides home leaving faint copies behind, then a ↩ flashes.
      case 'exile': {
        if (!c1) break;
        const home = c1.square;
        const piece = real(home);
        const from = xy(c0.square);
        const to = xy(home);
        const dx = from.x - to.x;
        const dy = from.y - to.y;
        if (piece) {
          for (let i = 1; i <= 4; i++) {
            const copy = add(`${box(home)}opacity:0`);
            copy.appendChild(piece.cloneNode(true));
            const k = 1 - i / 5;
            go(
              copy,
              [
                { transform: `translate(${dx}px,${dy}px)`, opacity: 0 },
                { transform: `translate(${dx * k}px,${dy * k}px)`, opacity: 0.35, offset: 0.5 },
                { transform: `translate(${dx * k}px,${dy * k}px)`, opacity: 0 },
              ],
              700,
              i * 40,
            );
          }
        }
        go(
          piece,
          [{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }],
          550,
          50,
          'cubic-bezier(.5,0,.3,1)',
          'backwards',
        );
        const mark = add(
          box(home, 0.6) +
            `display:flex;align-items:center;justify-content:center;font:700 ${S * 0.45}px/1 'Space Mono',monospace;color:#8fd8ff;opacity:0`,
          '↩',
        );
        go(
          mark,
          [
            { opacity: 0, transform: 'scale(.5)' },
            { opacity: 1, transform: 'scale(1.2)', offset: 0.4 },
            { opacity: 0, transform: 'scale(1)' },
          ],
          700,
          620,
        );
        break;
      }
      // Beyaz Bayrak: a white flag goes up by each king and waves; every piece glows white.
      case 'truce': {
        const kings: Square[] = [];
        position.board.forEach((p, s) => p && variant.pieces[p.type]?.royal && kings.push(s));
        kings.forEach((sq, i) => {
          const p = xy(sq);
          const flag = add(
            `left:${p.x + S * 0.6}px;top:${p.y + S * 0.04}px;width:${S * 0.36}px;height:${S * 0.66}px;transform-origin:0 100%`,
            '<svg viewBox="0 0 30 54" width="100%" height="100%"><path d="M2 2v52" stroke="#3a2a1a" stroke-width="2.5"/><path class="cloth" d="M3 3c8-3 14 3 24 0v16c-10 3-16-3-24 0z" fill="#fff" stroke="#141016" stroke-width="1.5"/></svg>',
          );
          go(
            flag,
            [
              { transform: 'scaleY(0)', opacity: 0 },
              { transform: 'scaleY(1)', opacity: 1, offset: 0.2 },
              { transform: 'scaleY(1)', opacity: 1, offset: 0.85 },
              { transform: 'scaleY(1)', opacity: 0 },
            ],
            2000,
            i * 150,
          );
          flag
            .querySelector('.cloth')
            ?.animate(
              [
                { transform: 'skewY(0)' },
                { transform: 'skewY(-8deg)' },
                { transform: 'skewY(4deg)' },
                { transform: 'skewY(0)' },
              ],
              { duration: 700, delay: 400 + i * 150, iterations: 2 },
            );
        });
        board
          .querySelectorAll('.square .piece')
          .forEach((e) =>
            go(
              e,
              [
                { filter: 'none' },
                { filter: 'drop-shadow(0 0 6px #fff) drop-shadow(0 0 2px #fff)' },
                { filter: 'none' },
              ],
              700,
              500,
              'ease-in-out',
              'none',
            ),
          );
        break;
      }
      // Kum Saati: an hourglass flips in the middle of the board, the sand runs, "+60".
      case 'time': {
        const colour = r.outcome === '-' ? '#ff2e93' : '#c6ff3d';
        const glass = add(
          `left:50%;top:50%;width:${S * 0.9}px;height:${S * 1.3}px;margin:-${S * 0.65}px 0 0 -${S * 0.45}px;filter:drop-shadow(0 2px 6px rgba(0,0,0,.6))`,
          `<svg viewBox="0 0 26 38" width="100%" height="100%"><path d="M3 2h20M3 36h20M5 2c0 10 8 12 8 17S5 26 5 36M21 2c0 10-8 12-8 17s8 7 8 17" fill="rgba(10,10,11,.55)" stroke="#f1eee8" stroke-width="2"/><path class="top" d="M7 6h12c-1 5-6 8-6 11 0-3-5-6-6-11z" fill="${colour}"/><path class="bottom" d="M7 34h12c-1-4-6-6-6-8 0 2-5 4-6 8z" fill="${colour}" opacity="0"/></svg>`,
        );
        go(
          glass,
          [
            { transform: 'scale(.5) rotate(0)', opacity: 0 },
            { transform: 'scale(1) rotate(0)', opacity: 1, offset: 0.15 },
            { transform: 'scale(1) rotate(180deg)', opacity: 1, offset: 0.35 },
            { transform: 'scale(1) rotate(180deg)', opacity: 1, offset: 0.85 },
            { transform: 'scale(1) rotate(180deg)', opacity: 0 },
          ],
          2000,
          0,
          'ease-in-out',
        );
        glass
          .querySelector('.top')
          ?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, delay: 750, fill: 'forwards' });
        glass
          .querySelector('.bottom')
          ?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 750, fill: 'forwards' });
        const plus = add(
          `left:50%;top:50%;margin-left:${S * 0.55}px;font:400 ${S * 0.45}px/1 'Permanent Marker',cursive;color:${colour};-webkit-text-stroke:1px #0a0a0b;opacity:0`,
          '+60',
        );
        go(
          plus,
          [
            { opacity: 0, transform: 'translateY(10px)' },
            { opacity: 1, transform: 'translateY(-4px)', offset: 0.3 },
            { opacity: 0, transform: `translateY(${-S * 0.6}px)` },
          ],
          1000,
          1000,
        );
        break;
      }
      // Tuzak Kapağı: the square opens as a trapdoor, the piece drops in, the lid snaps shut.
      case 'ambush': {
        const sq = c0.square;
        const el = squareEl(sq);
        const paint = el ? getComputedStyle(el).backgroundColor : '#555';
        const pit = under(sq, 'inset:0;background:#0a0a0b;opacity:0');
        go(pit, [{ opacity: 1 }, { opacity: 1 }], 900, 200, 'linear', 'none');
        const lid = (side: -1 | 1) => {
          const half = under(
            sq,
            `top:0;${side < 0 ? 'left:0' : 'right:0'};width:50%;height:100%;background:${paint};transform-origin:${side < 0 ? '0' : '100%'} 50%;opacity:0`,
          );
          go(
            half,
            [
              { opacity: 1, transform: 'perspective(200px) rotateY(0)' },
              { opacity: 1, transform: `perspective(200px) rotateY(${side * 80}deg)`, offset: 0.3 },
              { opacity: 1, transform: `perspective(200px) rotateY(${side * 80}deg)`, offset: 0.7 },
              { opacity: 1, transform: 'perspective(200px) rotateY(0)' },
            ],
            1000,
            200,
            'ease-in-out',
            'none',
          );
        };
        lid(-1);
        lid(1);
        go(
          ghost(sq),
          [
            { transform: 'scale(1)', opacity: 1 },
            { transform: `scale(.2) translateY(${S * 0.2}px)`, opacity: 0 },
          ],
          350,
          380,
          'ease-in',
        );
        later(900, () => shake(2, 120));
        break;
      }
      // Döner: the piece spins and comes round in the other colour; "hain!" flashes.
      case 'traitor': {
        const sq = c0.square;
        go(
          ghost(sq),
          [
            { transform: 'rotateY(0)', opacity: 1 },
            { opacity: 1, offset: 0.5 },
            { opacity: 0, offset: 0.501 },
            { transform: 'rotateY(900deg)', opacity: 0 },
          ],
          900,
          0,
          'cubic-bezier(.3,.1,.3,1)',
        );
        go(
          real(sq),
          [
            { transform: 'rotateY(0)', opacity: 0 },
            { opacity: 0, offset: 0.5 },
            { opacity: 1, offset: 0.501 },
            { transform: 'rotateY(900deg)', opacity: 1 },
          ],
          900,
          0,
          'cubic-bezier(.3,.1,.3,1)',
          'none',
        );
        const p = xy(sq);
        const word = add(
          `left:${p.x + S * 0.75}px;top:${p.y + S * 0.05}px;font:400 ${S * 0.3}px/1 'Permanent Marker',cursive;color:#ff2e93;-webkit-text-stroke:1px #0a0a0b;white-space:nowrap;opacity:0`,
          'hain!',
        );
        go(
          word,
          [
            { opacity: 0, transform: 'scale(.5) rotate(-10deg)' },
            { opacity: 1, transform: 'scale(1.1) rotate(-10deg)', offset: 0.3 },
            { opacity: 0, transform: `translateY(${-S * 0.25}px) rotate(-10deg)` },
          ],
          900,
          700,
        );
        break;
      }
      // Alev: flames flicker up behind the piece, its queen badge drops into place.
      case 'nitro': {
        const sq = c0.square;
        for (let i = 0; i < 3; i++) {
          const flame = under(
            sq,
            `left:${18 + i * 22}%;top:12%;width:26%;height:70%;border-radius:50% 50% 40% 40% / 70% 70% 30% 30%;background:linear-gradient(to top,#ff2e93,#c6ff3d 70%,transparent);filter:blur(1px);transform-origin:50% 100%`,
          );
          go(
            flame,
            [
              { transform: 'scaleY(0)', opacity: 0 },
              { transform: 'scaleY(1.1)', opacity: 1, offset: 0.2 },
              { transform: 'scaleY(.8)', offset: 0.4 },
              { transform: 'scaleY(1.2)', offset: 0.6 },
              { transform: 'scaleY(.9)', opacity: 1, offset: 0.8 },
              { transform: 'scaleY(.3)', opacity: 0 },
            ],
            1300,
            i * 80,
            'ease-in-out',
          );
        }
        go(
          real(sq)?.querySelector('.badge'),
          [
            { opacity: 0, transform: 'scale(2.2)' },
            { opacity: 1, transform: 'scale(1)' },
          ],
          300,
          600,
          'ease-in',
          'backwards',
        );
        break;
      }
      // Apolet Sökülür: rank stripes, one is slashed off; the piece shrinks and grows back lower.
      case 'demote': {
        const sq = c0.square;
        const c = center(sq);
        const stripes = [0, 1, 2].map((i) =>
          add(
            `left:${c.x + S * 0.24}px;top:${c.y - S * 0.42 + i * S * 0.12}px;width:${S * 0.28}px;height:${S * 0.09}px;background:#c6ff3d;border:1px solid #0a0a0b;transform:skewY(-20deg);opacity:0`,
          ),
        );
        stripes.forEach((s, i) => go(s, [{ opacity: 0 }, { opacity: 1 }], 150, i * 80));
        go(
          stripes[0],
          [
            { transform: 'skewY(-20deg)', opacity: 1 },
            { transform: `skewY(-20deg) translate(${S * 0.15}px,${S}px) rotate(120deg)`, opacity: 0 },
          ],
          600,
          550,
          'ease-in',
        );
        const slash = add(
          `left:${c.x + S * 0.16}px;top:${c.y - S * 0.45}px;width:${S * 0.5}px;height:${S * 0.05}px;background:#ff2e93;transform-origin:0 50%;opacity:0`,
        );
        go(
          slash,
          [
            { transform: 'rotate(-30deg) scaleX(0)', opacity: 1 },
            { transform: 'rotate(-30deg) scaleX(1)', opacity: 1, offset: 0.5 },
            { transform: 'rotate(-30deg) scaleX(1)', opacity: 0 },
          ],
          400,
          400,
        );
        go(
          ghost(sq),
          [
            { transform: 'scale(1)', opacity: 1 },
            { transform: 'scale(.3)', opacity: 1, offset: 0.95 },
            { transform: 'scale(.3)', opacity: 0 },
          ],
          260,
          800,
          'ease-in',
        );
        go(
          real(sq),
          [
            { transform: 'scale(.3)', opacity: 1 },
            { transform: 'scale(1.1)', offset: 0.7 },
            { transform: 'scale(1)', opacity: 1 },
          ],
          300,
          1060,
          'ease-out',
          'backwards',
        );
        // Hidden until it grows back (the ghost stands in for it till then).
        go(real(sq), [{ opacity: 0 }, { opacity: 0 }], 1060, 0, 'linear', 'none');
        stripes.slice(1).forEach((s) => go(s, [{ opacity: 1 }, { opacity: 0 }], 300, 1300));
        break;
      }
      // Yer Yarılır: the ground splits under both pieces, they sink and come up swapped.
      case 'quake': {
        for (const c of [c0, c1]) {
          if (!c) continue;
          const rift = under(
            c.square,
            'left:5%;top:5%;width:90%;height:90%',
            '<svg viewBox="0 0 100 100" width="100%" height="100%"><path d="M10 50L30 40L45 58L60 38L75 55L90 48L90 56L75 63L60 46L45 66L30 48L10 58z" fill="#0a0a0b"/></svg>',
          );
          go(
            rift,
            [
              { transform: 'scaleY(0)', opacity: 1 },
              { transform: 'scaleY(1.6)', opacity: 1, offset: 0.3 },
              { transform: 'scaleY(1.6)', opacity: 1, offset: 0.7 },
              { transform: 'scaleY(0)', opacity: 0 },
            ],
            1300,
          );
          go(
            ghost(c.square),
            [
              { clipPath: 'inset(0 0 0 0)', transform: 'none' },
              { clipPath: 'inset(0 0 100% 0)', transform: `translateY(${S * 0.5}px)` },
            ],
            350,
            300,
            'ease-in',
          );
          go(
            real(c.square),
            [
              { clipPath: 'inset(0 0 100% 0)', transform: `translateY(${S * 0.5}px)` },
              { clipPath: 'inset(0 0 0 0)', transform: `translateY(${-S * 0.25}px)`, offset: 0.7 },
              { clipPath: 'inset(0 0 0 0)', transform: 'none' },
            ],
            450,
            850,
            'ease-out',
            'backwards',
          );
        }
        shake(4, 400);
        break;
      }
    }
    return () => {
      timers.forEach(clearTimeout);
      touched.forEach((a) => a.cancel());
      added.forEach((e) => e.remove());
    };
    // Plays once: the component is keyed by the move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (still) return null;
  return (
    <div ref={layer} className="card-fx" aria-hidden="true">
      {ghosts.map((g) => {
        const col = flipped ? 7 - fileOf(g.square) : fileOf(g.square);
        const row = flipped ? rankOf(g.square) : 7 - rankOf(g.square);
        return (
          <div
            key={g.square}
            className="card-fx-ghost"
            data-ghost={g.square}
            style={{ left: `${col * 12.5}%`, top: `${row * 12.5}%` }}
          >
            <PieceView variant={variant} piece={g.piece} />
          </div>
        );
      })}
    </div>
  );
}
