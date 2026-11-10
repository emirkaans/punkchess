import type { MouseEvent, ReactNode } from 'react';
import { listVariants } from '../engine/index.ts';
import type { Locale, MessageKey } from '../i18n/index.ts';
import { useI18n } from './i18n.tsx';
import { LangPicker } from './LangFlag.tsx';
import { Crown } from './Punk.tsx';

const MAIL = 'info@punkchess.com';

interface Props {
  locale: Locale;
  onLocale: (locale: Locale) => void;
  /** Opens a page of the site (in the app, without reloading). */
  onNavigate: (path: string) => void;
  /** Opens a variant's card on the home page. */
  onVariant: (variantId: string) => void;
}

const COLUMNS: { title: MessageKey; links: [MessageKey, string][] }[] = [
  {
    title: 'menu.play',
    links: [
      ['footer.playNow', '/online'],
      ['menu.tournaments', '/tournaments'],
      ['menu.puzzles', '/puzzles'],
      ['daily.title', '/daily'],
      ['rush.title', '/rush'],
    ],
  },
  {
    title: 'footer.community',
    links: [
      ['menu.leaderboard', '/leaderboard'],
      ['menu.gangs', '/gangs'],
      ['menu.tv', '/tv'],
      ['menu.analysis', '/analysis'],
    ],
  },
];

const SITE_LINKS: [MessageKey, string][] = [
  ['contact.link', '/contact'],
  ['legal.privacy', '/privacy'],
  ['legal.terms', '/terms'],
  ['legal.licenses', '/licenses'],
];

/** At the bottom of every page: the site's pages, the variants, contact and the legal pages. */
export function SiteFooter({ locale, onLocale, onNavigate, onVariant }: Props) {
  const { t, vt } = useI18n();
  // A plain click stays in the app; ctrl / cmd / middle click opens a new tab as usual.
  const inApp = (go: () => void) => (e: MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go();
  };
  const link = (key: MessageKey, path: string) => (
    <a key={path} href={path} onClick={inApp(() => onNavigate(path))}>
      {t(key)}
    </a>
  );
  const column = (title: ReactNode, label: string, links: ReactNode) => (
    <nav key={label} className="site-footer-col" aria-label={label}>
      <h2>{title}</h2>
      {links}
    </nav>
  );

  return (
    <footer className="site-footer">
      <div className="site-footer-tape" aria-hidden="true" />
      <div className="site-footer-grid">
        <div className="site-footer-brand">
          <a href="/" className="site-footer-logo" onClick={inApp(() => onNavigate('/'))} aria-label={t('menu.logo')}>
            {/* The same wordmark as the top bar's. */}
            <Crown className="logo-crown" />
            <span className="logo-punk">punk</span>
            <span className="logo-chess">chess</span>
          </a>
          <p>{t('footer.blurb')}</p>
        </div>
        {COLUMNS.map((c) =>
          column(
            t(c.title),
            t(c.title),
            c.links.map(([key, path]) => link(key, path)),
          ),
        )}
        {column(
          t('home.variants'),
          t('home.variants'),
          listVariants().map((v) => (
            <a key={v.id} href="/" onClick={inApp(() => onVariant(v.id))}>
              {vt(v).name}
            </a>
          )),
        )}
        {column(
          'punkchess',
          'punkchess',
          SITE_LINKS.map(([key, path]) => link(key, path)),
        )}
      </div>
      <div className="site-footer-bottom">
        <span>{t('footer.copyright', { year: String(new Date().getFullYear()) })}</span>
        <a href={`mailto:${MAIL}`}>{MAIL}</a>
        <LangPicker locale={locale} onLocale={onLocale} />
      </div>
    </footer>
  );
}
