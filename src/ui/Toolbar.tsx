import { useEffect, useRef, useState } from 'react';
import { AccountButton } from './AccountButton.tsx';
import { PlayerSearch } from './PlayerSearch.tsx';
import { useI18n } from './i18n.tsx';
import { Crown } from './Punk.tsx';
import type { Prefs } from './prefs.ts';
import { formatClock } from '../clock/clock.ts';
import { yourTime } from './online/current.ts';
import type { LiveGame } from './online/current.ts';

export type Page =
  | 'home'
  | 'game'
  | 'analysis'
  | 'online'
  | 'review'
  | 'signup'
  | 'profile'
  | 'puzzles'
  | 'daily'
  | 'rush'
  | 'tv'
  | 'gangs'
  | 'tournaments'
  | 'admin'
  | 'leaderboard'
  | 'privacy'
  | 'terms'
  | 'licenses'
  | 'loading';

interface Props {
  page: Page;
  prefs: Prefs;
  onPrefs: (update: (p: Prefs) => Prefs) => void;
  onHome: () => void;
  /** Play: the online lobby (the computer and two-player games are offered there too). */
  onPlay: () => void;
  onAnalysis: () => void;
  onPuzzles: () => void;
  onLeaderboard: () => void;
  onTv: () => void;
  onGangs: () => void;
  onTournaments: () => void;
  onSettings: () => void;
  /** The online game this player left (it goes on): a strip under the bar leads back to it. */
  liveGame: LiveGame | null;
  onBackToGame: () => void;
}

/** Top bar: logo, main menu, and the account menu (profile, language, settings). */
export function Toolbar({
  page,
  prefs,
  onPrefs,
  onHome,
  onPlay,
  onAnalysis,
  onPuzzles,
  onLeaderboard,
  onTv,
  onGangs,
  onTournaments,
  onSettings,
  liveGame,
  onBackToGame,
}: Props) {
  const { t } = useI18n();
  // Publishes the bar's height as --toolbar-h (the home hero slides under the bar by that much).
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const publish = () => document.documentElement.style.setProperty('--toolbar-h', `${el.offsetHeight}px`);
    const observer = new ResizeObserver(publish);
    // Border box: the bar's padding changes with the screen width, its content box may not.
    observer.observe(el, { box: 'border-box' });
    publish();
    return () => observer.disconnect();
  }, []);

  // Phones: the menu folds into a button; any choice (or a page change) closes it.
  const [menuOpen, setMenuOpen] = useState(false);
  const close = (go: () => void) => () => {
    setMenuOpen(false);
    go();
  };

  // On the home page the bar is see-through at the top, over the hero image; once the page scrolls it turns solid.
  const [overHero, setOverHero] = useState(page === 'home');
  useEffect(() => {
    if (page !== 'home') {
      setOverHero(false);
      return;
    }
    const check = () => setOverHero(window.scrollY < 24);
    check();
    window.addEventListener('scroll', check, { passive: true });
    return () => window.removeEventListener('scroll', check);
  }, [page]);

  return (
    <header className={`topbar${overHero ? ' over-hero' : ''}`} ref={ref}>
      <div className="toolbar">
        <button className="logo" onClick={close(onHome)} aria-label={t('menu.logo')}>
          <Crown className="logo-crown" />
          <span className="logo-punk">punk</span>
          <span className="logo-chess">chess</span>
        </button>
        <nav className={`menu${menuOpen ? ' open' : ''}`} id="main-menu" aria-label={t('menu.label')}>
          <button
            className={page === 'online' || page === 'game' ? 'on' : ''}
            aria-current={page === 'online' || page === 'game' ? 'page' : undefined}
            onClick={close(onPlay)}
          >
            {t('menu.play')}
          </button>
          <button
            className={page === 'tournaments' ? 'on' : ''}
            aria-current={page === 'tournaments' ? 'page' : undefined}
            onClick={close(onTournaments)}
          >
            {t('menu.tournaments')}
          </button>
          <button
            className={page === 'puzzles' || page === 'daily' || page === 'rush' ? 'on' : ''}
            aria-current={page === 'puzzles' ? 'page' : undefined}
            onClick={close(onPuzzles)}
          >
            {t('menu.puzzles')}
          </button>
          <button
            className={page === 'leaderboard' ? 'on' : ''}
            aria-current={page === 'leaderboard' ? 'page' : undefined}
            onClick={close(onLeaderboard)}
          >
            {t('menu.leaderboard')}
          </button>
          <button
            className={page === 'gangs' ? 'on' : ''}
            aria-current={page === 'gangs' ? 'page' : undefined}
            onClick={close(onGangs)}
          >
            {t('menu.gangs')}
          </button>
          <button
            className={page === 'tv' ? 'on' : ''}
            aria-current={page === 'tv' ? 'page' : undefined}
            onClick={close(onTv)}
          >
            {t('menu.tv')}
          </button>
          <button
            className={page === 'analysis' ? 'on' : ''}
            aria-current={page === 'analysis' ? 'page' : undefined}
            onClick={close(onAnalysis)}
          >
            {t('menu.analysis')}
          </button>
        </nav>
        <div className="toolbar-end">
          <PlayerSearch />
          <AccountButton
            locale={prefs.locale}
            onLocale={(locale) => onPrefs((p) => ({ ...p, locale }))}
            onSettings={onSettings}
          />
          <button
            className="icon-button menu-toggle"
            aria-label={t('menu.label')}
            aria-expanded={menuOpen}
            aria-controls="main-menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
              <path d={menuOpen ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'} />
            </svg>
          </button>
        </div>
      </div>
      {liveGame && <BackToGame game={liveGame} onOpen={close(onBackToGame)} />}
    </header>
  );
}

/** The strip back to a game under way: the player's clock (ticking) and whose move it is. */
function BackToGame({ game, onOpen }: { game: LiveGame; onOpen: () => void }) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const time = yourTime(game, now);
  const yours = game.live.turn === game.you;
  return (
    <button className={`back-to-game${yours ? ' yours' : ''}`} onClick={onOpen}>
      <span className="back-to-game-dot" aria-hidden="true" />
      <strong>{t('tournament.backToGame')}</strong>
      {time !== null && <span className="back-to-game-clock">{formatClock(time)}</span>}
      <span>{t(yours ? 'online.yourTurn' : 'online.theirTurn')}</span>
      <span aria-hidden="true">→</span>
    </button>
  );
}
