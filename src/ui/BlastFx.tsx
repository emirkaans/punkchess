import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { fileOf, rankOf } from '../engine/index.ts';
import type { Square } from '../engine/index.ts';

interface Props {
  square: Square;
  flipped: boolean;
  /** The board, shaken by the blast. */
  boardRef: RefObject<HTMLDivElement | null>;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * A mine going off on `square` (a shock wave): three rings spread out, a white flash, dark smoke
 * rises and the board shakes. Mounted once per blast (keyed by the move), it removes nothing:
 * every element fades out by itself.
 */
export function BlastFx({ square, flipped, boardRef }: Props) {
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fx = layer.current;
    const board = boardRef.current;
    if (!fx || !board) return;
    const sq = board.getBoundingClientRect().width / 8;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const add = (css: string) => {
      const e = document.createElement('div');
      e.style.cssText = `position:absolute;left:0;top:0;${css}`;
      fx.appendChild(e);
      return e;
    };
    const go = (e: HTMLElement, frames: Keyframe[], duration: number, delay = 0, easing = 'ease-out') =>
      e.animate(frames, { duration, delay, easing, fill: 'forwards' });
    for (let i = 0; i < 3; i++) {
      const ring = add(
        `width:${sq}px;height:${sq}px;margin:-${sq / 2}px;border-radius:50%;border:${4 - i}px solid ${i === 1 ? 'var(--lime)' : 'var(--pink)'}`,
      );
      go(
        ring,
        [
          { transform: 'scale(.2)', opacity: 1 },
          { transform: 'scale(3.2)', opacity: 0 },
        ],
        800,
        i * 110,
      );
    }
    go(
      add(
        `width:${sq * 0.9}px;height:${sq * 0.9}px;margin:-${sq * 0.45}px;border-radius:50%;background:#fff;filter:blur(3px)`,
      ),
      [
        { transform: 'scale(.4)', opacity: 1 },
        { transform: 'scale(1.4)', opacity: 0 },
      ],
      260,
    );
    for (let i = 0; i < 5; i++) {
      const smoke = add(
        `width:${sq * 0.8}px;height:${sq * 0.8}px;margin:-${sq * 0.4}px;border-radius:50%;background:rgba(20,16,22,.85);filter:blur(5px)`,
      );
      go(
        smoke,
        [
          { transform: 'scale(.3)', opacity: 0 },
          { opacity: 0.9, offset: 0.25 },
          {
            transform: `translate(${rnd(-sq * 0.6, sq * 0.6)}px,${rnd(-sq * 0.9, -sq * 0.3)}px) scale(1.5)`,
            opacity: 0,
          },
        ],
        1300,
        120 + i * 50,
      );
    }
    if (!still) {
      const steps = Array.from({ length: 7 }, (_, i) => ({
        transform: i < 6 ? `translate(${rnd(-8, 8)}px,${rnd(-8, 8)}px)` : 'translate(0,0)',
      }));
      board.animate(steps, { duration: 380, easing: 'linear' });
    }
  }, [boardRef]);
  const col = flipped ? 7 - fileOf(square) : fileOf(square);
  const row = flipped ? rankOf(square) : 7 - rankOf(square);
  return (
    <div
      ref={layer}
      className="blast-fx"
      aria-hidden="true"
      style={{ left: `${(col + 0.5) * 12.5}%`, top: `${(row + 0.5) * 12.5}%` }}
    />
  );
}
