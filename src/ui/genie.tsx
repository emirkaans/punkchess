import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

// Dropdowns open like a macOS window (design 3D, "Mac açılışı"): the panel pours out from under
// the word that opened it, its bottom edge widening first and then its top, while it grows down;
// closing runs the same path back. Many small keyframes on one linear clock keep it smooth.

const OPEN_MS = 380;
const CLOSE_MS = 260;

/** The keyframes for a panel whose opener sits at `ox` (% of its width). Pure. */
export function genieFrames(ox: number): Keyframe[] {
  const out: Keyframe[] = [];
  for (let k = 0; k <= 24; k++) {
    const t = k / 24;
    const e = 1 - Math.pow(1 - t, 3);
    const bottom = Math.max(0.06, Math.min(1, Math.sqrt(e) * 1.05));
    const top = Math.max(0.04, e * e);
    const xs = (p: number) => [ox * (1 - p), ox + (100 - ox) * p].map((x) => `${x.toFixed(2)}%`);
    const [tl, tr] = xs(top);
    const [bl, br] = xs(bottom);
    out.push({
      offset: t,
      opacity: Math.min(1, t * 5),
      transform: `scale(${(0.35 + 0.65 * Math.sqrt(e)).toFixed(3)}, ${(0.12 + 0.88 * e).toFixed(3)})`,
      clipPath: `polygon(${tl} 0, ${tr} 0, ${br} 100%, ${bl} 100%)`,
    });
  }
  return out;
}

const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Props {
  open: boolean;
  className: string;
  /** The element that opened the panel (the genie pours out from under its middle). */
  opener: () => Element | null | undefined;
  /** No animation (the panel is part of a static list, as in the phone menu). */
  off?: boolean;
  children: ReactNode;
  role?: string;
  'aria-label'?: string;
}

/**
 * A dropdown panel with the genie motion. It stays in the page while it closes, carrying the
 * class `shown` whenever it is to be seen.
 */
export function GenieDrop({ open, className, opener, off = false, children, ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const anim = useRef<Animation | null>(null);
  const [shown, setShown] = useState(open);
  const was = useRef(open);
  const held = useRef<Animation | null>(null);

  if (open && !shown) setShown(true);

  useLayoutEffect(() => {
    if (was.current === open) return;
    was.current = open;
    const el = ref.current;
    if (!el || off || still() || typeof el.animate !== 'function') {
      if (!open) setShown(false);
      return;
    }
    // Closing: the panel no longer takes the pointer, so a cursor passing over the shrinking
    // panel does not open it again (and close it again, over and over).
    el.style.pointerEvents = open ? '' : 'none';
    held.current?.cancel();
    held.current = null;
    const running = anim.current;
    if (running && running.playState === 'running') {
      // Turned back halfway: run the same motion back from where it is, with no jump.
      running.reverse();
      running.onfinish = () => finish(running, open);
      return;
    }
    const panel = el.getBoundingClientRect();
    const from = opener()?.getBoundingClientRect();
    const ox =
      from && panel.width > 0
        ? Math.min(95, Math.max(5, ((from.left + from.width / 2 - panel.left) / panel.width) * 100))
        : 50;
    el.style.transformOrigin = `${ox}% 0`;
    const frames = genieFrames(ox);
    const a = el.animate(
      open ? frames : [...frames].reverse().map((f) => ({ ...f, offset: 1 - (f.offset as number) })),
      {
        duration: open ? OPEN_MS : CLOSE_MS,
        easing: 'linear',
        // A closed panel holds its last, folded frame until it is hidden (no full-size flash).
        fill: 'forwards',
      },
    );
    anim.current = a;
    a.onfinish = () => finish(a, open);

    function finish(a: Animation, opened: boolean) {
      if (anim.current !== a || !el) return;
      anim.current = null;
      if (opened) {
        a.cancel();
        return;
      }
      // The held frame is see-through; it is dropped once React has hidden the panel.
      held.current = a;
      setShown(false);
    }
  }, [open, off, opener]);

  useLayoutEffect(() => {
    if (shown) return;
    held.current?.cancel();
    held.current = null;
  }, [shown]);

  return (
    <div ref={ref} className={`${className}${shown ? ' shown' : ''}`} {...rest}>
      {children}
    </div>
  );
}
