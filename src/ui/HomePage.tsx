import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { listVariants } from '../engine/index.ts';
import type { LiveStats } from '../online/lobby.ts';
import { dailyDay, dailyNumber, gridEmoji } from '../online/daily.ts';
import { dailyResults, localStreak } from './dailyStore.ts';
import { QuestsCard } from './QuestsCard.tsx';
import type { PieceType, VariantDefinition } from '../engine/index.ts';
import { useI18n, withEnglishWords } from './i18n.tsx';
import type { MessageKey } from '../i18n/index.ts';
import { PieceView } from './PieceView.tsx';
import { Crown } from './Punk.tsx';
import { LobbyCard } from './online/LobbyPage.tsx';
import { useLobby } from './online/lobbyConnection.ts';
import { VariantPlayDialog } from './VariantPlayDialog.tsx';
import type { GameSettings, Mode } from './settings.ts';

interface Props {
  /** Opens the new game dialog, optionally with some settings already picked. */
  onPlay: (patch?: Partial<GameSettings>) => void;
  /** Starts a game on this device at once (the variant dialog has chosen everything). */
  onStart: (patch: Partial<GameSettings>) => void;
  /** The saved settings (games on this device start from them). */
  settings: GameSettings;
  /** Opens online play (the lobby): the main way to play. */
  onOnline: () => void;
  /** Opens the daily puzzle. */
  onDaily: () => void;
  /** Opens an online game (made or paired from the home page's lobby). */
  onOpenGame: (id: string) => void;
  /** A variant picked elsewhere (the footer): its card opens here. */
  openVariant?: string | null;
  onVariantOpened?: () => void;
}

const STANDARD_TYPES = new Set(['k', 'q', 'r', 'b', 'n', 'p']);
/** The piece that shows a variant on its card: its own special piece, else the king. */
const signature = (v: VariantDefinition): PieceType => v.pieceTypes.find((type) => !STANDARD_TYPES.has(type)) ?? 'k';

/** Ways to play on this device, after online play: the computer, bots, two players. */
const OPPONENTS: { mode: Mode; sub: 'home.hotseatSub' | 'home.botSub' | 'home.botvbotSub' }[] = [
  { mode: 'bot', sub: 'home.botSub' },
  { mode: 'botvbot', sub: 'home.botvbotSub' },
  { mode: 'hotseat', sub: 'home.hotseatSub' },
];

/** What is going on right now, asked again every half minute while the page is open. */
function useLiveStats(): LiveStats | null {
  const [stats, setStats] = useState<LiveStats | null>(null);
  useEffect(() => {
    let live = true;
    const ask = () =>
      fetch('/api/stats')
        .then((r) => (r.ok ? (r.json() as Promise<LiveStats>) : null))
        .then((s) => live && s && setStats(s))
        .catch(() => {});
    void ask();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void ask();
    }, 30_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);
  return stats;
}

function Arrow() {
  return (
    <svg className="ic arrow" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h16M14 6l6 6-6 6" />
    </svg>
  );
}

/**
 * Keeps the hero one screen tall in every language: when its text does not fit (a long
 * headline that wraps to more lines), the headline shrinks (--hero-fit, down to 55%) until it
 * does; the slogan in the corner shrinks (--slogan-fit) when it would run off the right edge.
 */
function useHeroFit(locale: string) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const hero = ref.current;
    if (!hero) return;
    const fit = () => {
      hero.style.setProperty('--hero-fit', '1');
      hero.style.setProperty('--slogan-fit', '1');
      const screen = window.innerHeight;
      const copy = hero.querySelector<HTMLElement>('.hero-copy');
      // The text with the hero's padding (the top one runs under the top bar) within one screen.
      const fits = () => {
        const cs = getComputedStyle(hero);
        const need = (copy?.offsetHeight ?? 0) + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
        return need <= screen + 1 && hero.offsetHeight <= screen + 1;
      };
      if (!fits()) {
        let lo = 0.55;
        let hi = 1;
        for (let i = 0; i < 7; i++) {
          const mid = (lo + hi) / 2;
          hero.style.setProperty('--hero-fit', String(mid));
          if (fits()) lo = mid;
          else hi = mid;
        }
        hero.style.setProperty('--hero-fit', String(lo));
      }
      const slogan = hero.querySelector<HTMLElement>('.slogan');
      if (slogan && slogan.offsetWidth) {
        const room = hero.getBoundingClientRect().right - 8;
        const r = slogan.getBoundingClientRect();
        if (r.right > room) hero.style.setProperty('--slogan-fit', String(Math.max(0.5, (room - r.left) / r.width)));
      }
    };
    fit();
    let frame = 0;
    const later = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    window.addEventListener('resize', later);
    document.fonts?.ready.then(later, () => undefined);
    return () => {
      window.removeEventListener('resize', later);
      cancelAnimationFrame(frame);
    };
  }, [locale]);
  return ref;
}

/** Landing page: hero, the variants and the ways to play. */
export function HomePage({
  onPlay,
  onStart,
  settings,
  onOnline,
  onDaily,
  onOpenGame,
  openVariant,
  onVariantOpened,
}: Props) {
  const { t, vt, locale } = useI18n();
  const heroRef = useHeroFit(locale);
  const today = dailyDay(Date.now());
  const done = dailyResults()[today];
  const streak = localStreak(today);
  const stats = useLiveStats();
  const lobby = useLobby((ticket) => onOpenGame(ticket.gameId));
  // The variant whose card was clicked: its dialog is open.
  const [picked, setPicked] = useState<VariantDefinition | null>(null);
  useEffect(() => {
    if (!openVariant) return;
    const v = listVariants().find((x) => x.id === openVariant);
    if (v) setPicked(v);
    onVariantOpened?.();
  }, [openVariant, onVariantOpened]);
  return (
    <div className="home">
      <section className="hero" ref={heroRef}>
        <img className="hero-image" src={`${import.meta.env.BASE_URL}hero.webp`} alt={t('home.heroAlt')} />
        <div className="hero-copy">
          <h1 className="sr-only">punkchess</h1>
          <p className="lede">
            <span>{t('home.lede1')}</span> <span>{t('home.lede2')}</span>
          </p>
          <p className="pitch">{t('home.pitch')}</p>
          <div className="ctas">
            <button className="cta" onClick={onOnline}>
              <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
                <path className="fill" d="M13 2L4 14h7l-1 8 9-12h-7z" />
              </svg>
              {t('home.play')}
              <Arrow />
            </button>
            <a className="cta ghost" href="#variants">
              {t('home.explore')}
            </a>
          </div>
          <button className="daily-box" onClick={onDaily}>
            <span className="daily-box-title">
              {t('daily.title')} <b>#{dailyNumber(today)}</b>
            </span>
            <span className="daily-box-sub">
              {done ? gridEmoji(done) : t('daily.homeCta')}
              {streak > 0 && <span className="daily-box-streak">🔥 {streak}</span>}
            </span>
            <Arrow />
          </button>
          {stats && (
            <p className="live-stats">
              <span className="live-dot" aria-hidden="true" />
              {t('home.liveGames', { n: String(stats.games) })} · {t('home.livePlayers', { n: String(stats.players) })}
              {stats.games > 0 && (
                <a
                  className="live-watch"
                  href="/tv"
                  onClick={(e) => {
                    e.preventDefault();
                    history.pushState(null, '', '/tv');
                    dispatchEvent(new PopStateEvent('popstate'));
                  }}
                >
                  📺 {t('tv.watch')}
                </a>
              )}
            </p>
          )}
        </div>
        <p className="slogan" aria-hidden="true">
          {t('home.slogan1')}
          <br />
          {t('home.slogan2')}
          <br />
          {t('home.slogan3')}
          <Crown />
        </p>
      </section>

      <section className="home-lobby" aria-label={t('lobby.tab.seeks')}>
        <LobbyCard lobby={lobby} onOpenGame={onOpenGame} defaultVariantId={listVariants()[0].id} />
      </section>

      <section className="home-cards" id="variants" aria-label={t('home.variants')}>
        <div className="variant-grid">
          {listVariants().map((v, i) => {
            const texts = vt(v);
            return (
              <button
                key={v.id}
                className={`variant-card${i % 2 ? ' lime' : ''}`}
                title={texts.rules.summary}
                aria-label={`${texts.name}: ${texts.rules.summary}`}
                onClick={() => setPicked(v)}
              >
                {v.emblem ? (
                  <svg
                    className="variant-emblem"
                    viewBox="0 0 48 48"
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{ __html: v.emblem }}
                  />
                ) : (
                  <span className="variant-icon">
                    <PieceView variant={v} piece={{ type: signature(v), color: i % 2 ? 'w' : 'b' }} />
                  </span>
                )}
                <span className="variant-name">{texts.name}</span>
                <span className="variant-tag">{t(`home.variantTag.${v.id}` as MessageKey)}</span>
              </button>
            );
          })}
        </div>
        <QuestsCard className="home-quests" neon />
        <div className="opponents">
          <h2>
            <Crown />
            {t('home.opponents')}
          </h2>
          <button className="opponent" onClick={onOnline}>
            <b>1</b>
            <span>
              {withEnglishWords(t('online.title'))}
              <small>{t('home.onlineSub')}</small>
            </span>
          </button>
          {OPPONENTS.map((o, i) => (
            <button key={o.mode} className="opponent" onClick={() => onPlay({ mode: o.mode })}>
              <b>{i + 2}</b>
              <span>
                {t(`mode.${o.mode}`)}
                <small>{t(o.sub)}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
      {picked && (
        <VariantPlayDialog
          variant={picked}
          lobby={lobby}
          onOpenGame={onOpenGame}
          initial={settings}
          onStart={(patch) => {
            setPicked(null);
            onStart(patch);
          }}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  );
}
