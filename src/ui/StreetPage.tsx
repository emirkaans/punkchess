import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { DEFAULT_AVATAR } from '../avatar/avatar.ts';
import { figureSvg } from '../avatar/figure.ts';
import { EMPTY_OUTFIT } from '../avatar/outfit.ts';
import { useAccount } from './account.ts';
import { useI18n } from './i18n.tsx';
import { VitrinWindow } from './VitrinWindow.tsx';
import { storefront } from './storefront.ts';
import { streets } from './street.ts';
import type { StreetShop } from './street.ts';

// Punk Street (design F, "Dar ara sokak"): a narrow alley in real 3D perspective on wide screens,
// two shops on each wall, string lights overhead and our logo sprayed on the end wall; the player's
// character stands in the street. Phones see the same street from above. Four shops to a street;
// the arrows (or ← →) go to the next one.

/** The desktop scene's size; it is scaled to fit the screen. */
const SCENE_W = 1200;
const SCENE_H = 628;

function useNarrow(): boolean {
  const query = '(max-width: 760px)';
  const [narrow, setNarrow] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const m = matchMedia(query);
    const on = () => setNarrow(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return narrow;
}

/** Phones: one string of bulbs across the street seen from above (a sagging line, bulbs on it). */
function topLightsSvg(): string {
  const colors = ['#ffe9a8', '#ff2e93', '#c6ff3d'];
  let s = '<path d="M2 6 Q195 40 388 6" fill="none" stroke="#3a3640" stroke-width="2"/>';
  for (let i = 1; i < 12; i++) {
    const t = i / 12;
    const x = 2 + t * 386;
    const y = 6 + 2 * (1 - t) * t * 34;
    s += `<circle cx="${x.toFixed(1)}" cy="${(y + 3).toFixed(1)}" r="4" fill="${colors[i % 3]}"/>`;
  }
  return `<svg viewBox="0 0 390 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${s}</svg>`;
}

/** Strings of coloured bulbs across the alley (flat, in front of the 3D street). */
function lightsSvg(w: number): string {
  let s = '';
  const colors = ['#ffe9a8', '#ff2e93', '#c6ff3d'];
  for (let r = 0; r < 4; r++) {
    const y = 18 + r * 40 + r * r * 4;
    const x1 = 60 + r * 120;
    const x2 = w - 60 - r * 120;
    const sag = 50 - r * 8;
    s += `<path d="M${x1} ${y} Q${w / 2} ${y + sag} ${x2} ${y}" fill="none" stroke="#2a2830" stroke-width="2"/>`;
    for (let i = 1; i < 10; i++) {
      const t = i / 10;
      const x = (1 - t) ** 2 * x1 + 2 * (1 - t) * t * (w / 2) + t * t * x2;
      const yy = (1 - t) ** 2 * y + 2 * (1 - t) * t * (y + sag) + t * t * y;
      s += `<circle cx="${x.toFixed(1)}" cy="${(yy + 4).toFixed(1)}" r="${4 - r * 0.6}" fill="${colors[i % 3]}"/>`;
    }
  }
  return `<svg viewBox="0 0 ${w} 230" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${s}</svg>`;
}

interface ShopProps {
  shop: StreetShop;
  onOpen: (path: string) => void;
}

/** A shop on the street: its front (the door glows on hover) and its name; a closed one says so. */
function Shop({ shop, onOpen, className, style }: ShopProps & { className: string; style?: CSSProperties }) {
  const { t } = useI18n();
  const name = t(shop.label);
  const open = shop.path !== null;
  const art = useMemo(
    () => storefront(shop.color, t(shop.sign), !open, t('street.soon')),
    [shop.color, shop.sign, open, t],
  );
  return (
    <button
      className={`${className}${open ? ' open' : ''}`}
      style={{ '--c': shop.color, ...style } as CSSProperties}
      disabled={!open}
      aria-label={open ? name : t('street.closed', { shop: name })}
      onClick={() => shop.path && onOpen(shop.path)}
    >
      <span className="st-name">{name}</span>
      <span className="st-front" dangerouslySetInnerHTML={{ __html: art }} />
      {/* Phones: the roof's sign. */}
      <span className="st-sign" aria-hidden="true">
        {t(shop.sign)}
      </span>
    </button>
  );
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  const { t } = useI18n();
  if (pages < 2) return null;
  return (
    <div className="street-pager">
      <button aria-label={t('street.prev')} disabled={page === 0} onClick={() => onPage(page - 1)}>
        ‹
      </button>
      <span>{t('street.page', { n: String(page + 1), total: String(pages) })}</span>
      <button aria-label={t('street.next')} disabled={page === pages - 1} onClick={() => onPage(page + 1)}>
        ›
      </button>
      <span className="street-dots" aria-hidden="true">
        {Array.from({ length: pages }, (_, i) => (
          <i key={i} className={i === page ? 'on' : ''} />
        ))}
      </span>
    </div>
  );
}

export function StreetPage({ onOpen }: { onOpen: (path: string) => void }) {
  const { t } = useI18n();
  const account = useAccount();
  const narrow = useNarrow();
  const all = streets();
  const [page, setPage] = useState(0);
  const shops = all[Math.min(page, all.length - 1)];
  // Left wall: the first two shops (nearest first); right wall: the other two.
  const left = shops.slice(0, 2);
  const right = shops.slice(2, 4);

  // ← → walk to the previous or next street.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') setPage((p) => Math.max(0, p - 1));
      if (e.key === 'ArrowRight') setPage((p) => Math.min(all.length - 1, p + 1));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [all.length]);

  // The desktop scene is drawn at 1200×628 and scaled to the room it has.
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el || narrow) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const room = window.innerHeight - r.top - 16;
      setScale(Math.max(0.4, Math.min(r.width / SCENE_W, room / SCENE_H, 1.25)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [narrow]);

  const me = useMemo(
    () => figureSvg(account.user?.avatar ?? DEFAULT_AVATAR, account.user?.outfit ?? EMPTY_OUTFIT),
    [account.user?.avatar, account.user?.outfit],
  );
  const lights = useMemo(() => lightsSvg(SCENE_W), []);
  const topLights = useMemo(() => topLightsSvg(), []);

  if (narrow) {
    return (
      <main className="street-page street-top">
        <h1 className="street-title">{t('menu.street')}</h1>
        <VitrinWindow onOpen={onOpen} />
        <div className="street-map">
          <div className="street-road" aria-hidden="true" />
          {/* Strings of bulbs over the street, as in the alley on wide screens. */}
          {[1, 50, 99].map((top) => (
            <span
              key={top}
              className="street-top-lights"
              style={{ top: `${top}%` }}
              dangerouslySetInnerHTML={{ __html: topLights }}
            />
          ))}
          {shops.map((s, i) => (
            <Shop
              key={s.id}
              shop={s}
              onOpen={onOpen}
              className={`st-roof ${i < 2 ? 'l' : 'r'}`}
              style={{ gridRow: (i % 2) + 1 }}
            />
          ))}
        </div>
        <Pager page={page} pages={all.length} onPage={setPage} />
      </main>
    );
  }

  return (
    <main className="street-page">
      <div className="street-box" ref={box} style={{ height: SCENE_H * scale }}>
        <div className="street-scene" style={{ width: SCENE_W, height: SCENE_H, transform: `scale(${scale})` }}>
          <div className="street-3d">
            <div className="street-origin">
              <div className="st-wall st-left">
                {left.map((s, k) => (
                  <Shop key={s.id} shop={s} onOpen={onOpen} className="st-shop l" style={{ left: 130 + k * 470 }} />
                ))}
              </div>
              <div className="st-wall st-right">
                {right.map((s, k) => (
                  <Shop key={s.id} shop={s} onOpen={onOpen} className="st-shop r" style={{ right: 130 + k * 470 }} />
                ))}
              </div>
              <div className="st-floor" />
              <div className="st-end">
                <img src="/street-logo.svg" alt="" />
              </div>
            </div>
          </div>
          <span className="street-lights" dangerouslySetInnerHTML={{ __html: lights }} />
          <h1 className="street-title">{t('menu.street')}</h1>
          <VitrinWindow onOpen={onOpen} />
          <span className="street-me" dangerouslySetInnerHTML={{ __html: me }} />
          <Pager page={page} pages={all.length} onPage={setPage} />
        </div>
      </div>
    </main>
  );
}
