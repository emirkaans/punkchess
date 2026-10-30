import { useEffect, useRef } from 'react';
import { fileOf, rankOf } from '../engine/index.ts';
import type { Square } from '../engine/index.ts';

interface Props {
  square: Square;
  flipped: boolean;
  /** The mine's picture (an SVG string from the variant's square mark). */
  icon: string;
}

/**
 * A mine cleared on `square` without going off (kicked away): the disc pops out from under the
 * piece, spins off over the board's edge with speed lines behind it, its light out. Mounted
 * once per clearing (keyed by the move); every element fades out by itself.
 */
export function ClearFx({ square, flipped, icon }: Props) {
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fx = layer.current;
    const board = fx?.parentElement;
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
    const disc = add(`width:${sq * 0.72}px;height:${sq * 0.72}px;margin:-${sq * 0.36}px;z-index:1`);
    disc.className = 'clear-fx-disc';
    disc.innerHTML = icon;
    // Toward the nearer side edge, so it flies off the board rather than across it.
    const dir = (flipped ? 7 - fileOf(square) : fileOf(square)) < 4 ? -1 : 1;
    if (still) {
      go(disc, [{ opacity: 1 }, { opacity: 0 }], 600, 300);
      return;
    }
    go(
      disc,
      [
        { transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1 },
        {
          transform: `translate(${dir * sq * 0.7}px,${-sq * 0.9}px) rotate(${dir * 260}deg) scale(.9)`,
          opacity: 1,
          offset: 0.45,
        },
        { transform: `translate(${dir * sq * 1.9}px,${-sq * 0.4}px) rotate(${dir * 620}deg) scale(.6)`, opacity: 0 },
      ],
      900,
      0,
      'cubic-bezier(.3,.6,.4,1)',
    );
    for (let i = 0; i < 3; i++) {
      const line = add(
        `width:${sq * 0.5}px;height:3px;margin-top:${i * 8 - sq * 0.1}px;border-radius:2px;background:var(--lime);transform-origin:${dir < 0 ? '0' : '100%'} 50%;${dir < 0 ? '' : `margin-left:-${sq * 0.5}px;`}`,
      );
      const tilt = `rotate(${dir * -40}deg)`;
      go(
        line,
        [
          { opacity: 0, transform: `${tilt} scaleX(.2)` },
          { opacity: 1, transform: `${tilt} scaleX(1)`, offset: 0.4 },
          { opacity: 0, transform: `${tilt} translateX(${dir * 30}px) scaleX(.3)` },
        ],
        500,
        30 + i * 60,
      );
    }
    const shadow = add(
      `width:${sq * 0.5}px;height:${sq * 0.14}px;margin:${sq * 0.2}px 0 0 -${sq * 0.25}px;border-radius:50%;background:rgba(10,10,11,.4)`,
    );
    go(shadow, [{ opacity: 1 }, { opacity: 0 }], 600);
  }, [square, flipped, icon]);
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
