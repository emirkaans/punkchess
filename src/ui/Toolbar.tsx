import { useEffect, useRef, useState } from 'react';
import type { AnchorHTMLAttributes } from 'react';
import { AccountButton } from './AccountButton.tsx';
import { PlayerSearch } from './PlayerSearch.tsx';
import { useI18n } from './i18n.tsx';
import { Crown } from './Punk.tsx';
import { storefront } from './storefront.ts';
import { GenieDrop } from './genie.tsx';
import type { Prefs } from './prefs.ts';
import { formatClock } from '../clock/clock.ts';
import { yourTime } from './online/current.ts';
import type { LiveGame } from './online/current.ts';
import type { MessageKey } from '../i18n/index.ts';

/** A page in the main menu; a shop also has its storefront's colour and sign. */
interface MenuEntry {
  readonly label: MessageKey;
  readonly desc: MessageKey;
  readonly icon: string;
  readonly on: boolean;
  /** Absent: a shop still to open. */
  readonly go?: () => void;
  /** The page's address, so the entry is a real link (open in a new tab). */
  readonly href?: string;
  readonly color?: string;
  readonly sign?: MessageKey;
}

/** A menu group: one entry is a plain link, more open a menu (the street: its storefronts). */
interface MenuGroup {
  readonly id: string;
  readonly label: MessageKey;
  readonly entries: readonly MenuEntry[];
  /** Where the group's own button goes (else its first entry), and a link under its entries. */
  readonly go?: () => void;
  readonly href?: string;
  readonly more?: { readonly label: MessageKey; readonly go: () => void; readonly href: string; readonly on: boolean };
}

/**
 * A menu link: a plain click stays in the page (the handler), while a middle click, a click
 * with Ctrl/Cmd/Shift or the right-click menu opens the address in a new tab or window.
 */
function NavLink({ href, go, ...rest }: { href: string; go: () => void } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={href}
      {...rest}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        go();
      }}
    />
  );
}

/** The menu's icons (24×24 strokes). */
const ICONS = {
  play: 'M7 4v16l13-8z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H4c0 4 2 5 4 5M16 6h4c0 4-2 5-4 5M12 13v4M8 21h8',
  puzzle: 'M4 8h4a2 2 0 1 1 4 0h4v4a2 2 0 1 1 0 4v4H4z',
  board: 'M4 4h16v16H4zM4 12h16M12 4v16',
  crown: 'M3 18h18M4 16l-1-9 5 4 4-7 4 7 5-4-1 9z',
  gang: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 11a3 3 0 1 0 0-6M3 20c0-4 3-6 6-6s6 2 6 6M15 14c3 0 6 2 6 6',
};

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
  | 'contact'
  | 'character'
  | 'store'
  | 'barber'
  | 'shoes'
  | 'tattoo'
  | 'street'
  | 'wardrobe'
  | 'loading';

interface Props {
  page: Page;
  prefs: Prefs;
  onPrefs: (update: (p: Prefs) => Prefs) => void;
  onHome: () => void;
  /** Play: the online lobby (the computer and two-player games are offered there too). */
  onPlay: () => void;
  onAnalysis: () => void;
  /** The shops (punk coins buy clothes, cuts). */
  onStore: () => void;
  onBarber: () => void;
  onShoes: () => void;
  onTattoo: () => void;
  onStreet: () => void;
  onPuzzles: () => void;
  onLeaderboard: () => void;
  onTv: () => void;
  onGangs: () => void;
  onTournaments: () => void;
  onSettings: () => void;
  onPreferences: () => void;
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
  onStore,
  onBarber,
  onShoes,
  onTattoo,
  onStreet,
  onPuzzles,
  onLeaderboard,
  onTv,
  onGangs,
  onTournaments,
  onSettings,
  onPreferences,
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

  // Wide screens: a group's menu opens while the pointer (or focus) is on it.
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  // Phones list the groups in the ☰ menu (no dropdowns, no motion).
  const phoneMenu = typeof matchMedia === 'function' && matchMedia('(max-width: 760px)').matches;
  const groups: readonly MenuGroup[] = [
    {
      id: 'play',
      label: 'menu.play',
      entries: [
        {
          label: 'menu.play',
          desc: 'menu.desc.play',
          icon: ICONS.play,
          on: page === 'online' || page === 'game',
          go: onPlay,
          href: '/online',
        },
        {
          label: 'menu.tournaments',
          desc: 'menu.desc.tournaments',
          icon: ICONS.trophy,
          on: page === 'tournaments',
          go: onTournaments,
          href: '/tournaments',
        },
        {
          label: 'menu.puzzles',
          desc: 'menu.desc.puzzles',
          icon: ICONS.puzzle,
          on: page === 'puzzles' || page === 'daily' || page === 'rush',
          go: onPuzzles,
          href: '/puzzles',
        },
        {
          label: 'menu.analysis',
          desc: 'menu.desc.analysis',
          icon: ICONS.board,
          on: page === 'analysis',
          go: onAnalysis,
          href: '/analysis',
        },
      ],
    },
    {
      id: 'tv',
      label: 'menu.tv',
      entries: [{ label: 'menu.tv', desc: 'menu.tv', icon: '', on: page === 'tv', go: onTv, href: '/tv' }],
    },
    {
      id: 'social',
      label: 'menu.social',
      entries: [
        {
          label: 'menu.leaderboard',
          desc: 'menu.desc.leaderboard',
          icon: ICONS.crown,
          on: page === 'leaderboard',
          go: onLeaderboard,
          href: '/leaderboard',
        },
        {
          label: 'menu.gangs',
          desc: 'menu.desc.gangs',
          icon: ICONS.gang,
          on: page === 'gangs',
          go: onGangs,
          href: '/gangs',
        },
      ],
    },
    {
      id: 'street',
      label: 'menu.streetShort',
      go: onStreet,
      href: '/street',
      more: { label: 'street.walk', go: onStreet, href: '/street', on: page === 'street' },
      entries: [
        {
          label: 'menu.store',
          desc: 'menu.desc.store',
          sign: 'menu.sign.store',
          color: '#ff2e93',
          icon: '',
          on: page === 'store',
          go: onStore,
          href: '/store',
        },
        {
          label: 'menu.barber',
          desc: 'menu.desc.barber',
          sign: 'menu.sign.barber',
          color: '#4aa8ff',
          icon: '',
          on: page === 'barber',
          go: onBarber,
          href: '/barber',
        },
        {
          label: 'menu.shoes',
          desc: 'menu.desc.shoes',
          sign: 'menu.sign.shoes',
          color: '#e8c84a',
          icon: '',
          on: page === 'shoes',
          go: onShoes,
          href: '/shoes',
        },
        {
          label: 'menu.tattoo',
          desc: 'menu.desc.tattoo',
          sign: 'menu.sign.tattoo',
          color: '#c6ff3d',
          icon: '',
          on: page === 'tattoo',
          go: onTattoo,
          href: '/tattoo',
        },
      ],
    },
  ];

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
        <NavLink href="/" className="logo" go={close(onHome)} aria-label={t('menu.logo')}>
          <Crown className="logo-crown" />
          <span className="logo-punk">punk</span>
          <span className="logo-chess">chess</span>
        </NavLink>
        <nav className={`menu${menuOpen ? ' open' : ''}`} id="main-menu" aria-label={t('menu.label')}>
          {groups.map((g) =>
            g.entries.length === 1 ? (
              <NavLink
                key={g.id}
                href={g.entries[0].href!}
                className={g.entries[0].on ? 'on' : ''}
                aria-current={g.entries[0].on ? 'page' : undefined}
                go={close(g.entries[0].go!)}
              >
                {t(g.label)}
              </NavLink>
            ) : (
              <div
                key={g.id}
                className={`menu-group${openGroup === g.id ? ' open' : ''}`}
                onMouseEnter={() => setOpenGroup(g.id)}
                onMouseLeave={() => setOpenGroup(null)}
                onFocus={() => setOpenGroup(g.id)}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpenGroup(null);
                }}
              >
                <NavLink
                  href={g.href ?? g.entries[0].href!}
                  className={`menu-top${g.entries.some((e) => e.on) || g.more?.on ? ' on' : ''}`}
                  data-menu-top={g.id}
                  aria-haspopup="true"
                  aria-expanded={openGroup === g.id}
                  go={close(g.go ?? g.entries[0].go!)}
                >
                  {t(g.label)}
                  <span className="menu-caret" aria-hidden="true" />
                </NavLink>
                <GenieDrop
                  open={openGroup === g.id}
                  className={`menu-drop${g.id === 'street' ? ' menu-street' : ''}`}
                  opener={() => document.querySelector(`[data-menu-top="${g.id}"]`)}
                  off={phoneMenu}
                >
                  <span className="menu-drop-title">{t(g.id === 'street' ? 'menu.street' : g.label)}</span>
                  <div className="menu-drop-items">
                    {g.entries.map((e) =>
                      e.color && !e.go ? (
                        <button key={e.label} className="menu-shop" aria-label={t(e.label)} disabled>
                          <span
                            className="menu-front"
                            aria-hidden="true"
                            dangerouslySetInnerHTML={{ __html: storefront(e.color, t(e.sign!), true) }}
                          />
                          <b>{t(e.label)}</b>
                        </button>
                      ) : e.color ? (
                        <NavLink
                          key={e.label}
                          href={e.href!}
                          className={`menu-shop${e.on ? ' on' : ''}`}
                          aria-label={t(e.label)}
                          aria-current={e.on ? 'page' : undefined}
                          go={close(e.go!)}
                        >
                          <span
                            className="menu-front"
                            aria-hidden="true"
                            dangerouslySetInnerHTML={{ __html: storefront(e.color, t(e.sign!), false) }}
                          />
                          <b>{t(e.label)}</b>
                        </NavLink>
                      ) : (
                        <NavLink
                          key={e.label}
                          href={e.href!}
                          className={`menu-row${e.on ? ' on' : ''}`}
                          aria-label={t(e.label)}
                          aria-describedby={`${e.label}-desc`}
                          aria-current={e.on ? 'page' : undefined}
                          go={close(e.go!)}
                        >
                          <svg className="menu-ic" viewBox="0 0 24 24" aria-hidden="true">
                            <path d={e.icon} />
                          </svg>
                          <b>{t(e.label)}</b>
                          <span id={`${e.label}-desc`}>{t(e.desc)}</span>
                        </NavLink>
                      ),
                    )}
                  </div>
                  {g.more && (
                    <NavLink
                      href={g.more.href}
                      className={`menu-more${g.more.on ? ' on' : ''}`}
                      aria-current={g.more.on ? 'page' : undefined}
                      go={close(g.more.go)}
                    >
                      {t(g.more.label)} →
                    </NavLink>
                  )}
                </GenieDrop>
              </div>
            ),
          )}
        </nav>
        <div className="toolbar-end">
          <PlayerSearch />
          <AccountButton
            locale={prefs.locale}
            onLocale={(locale) => onPrefs((p) => ({ ...p, locale }))}
            onSettings={onSettings}
            onPreferences={onPreferences}
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
