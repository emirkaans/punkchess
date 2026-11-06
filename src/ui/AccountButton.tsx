import { CoinIcon } from './CoinToast.tsx';
import { useCoins } from './coins.ts';
import { useEffect, useRef, useState } from 'react';
import { LOCALES } from '../i18n/index.ts';
import type { Locale } from '../i18n/index.ts';
import { signInWithGoogle, signOut, useAccount } from './account.ts';
import { useI18n } from './i18n.tsx';
import { GearIcon } from './Punk.tsx';
import { AvatarView } from './CharacterCreator.tsx';
import { GenieDrop } from './genie.tsx';
import { Modal } from './Modal.tsx';
import { QuestsCard } from './QuestsCard.tsx';
import { useQuests } from './quests.ts';

/** The menu card's character: the whole head, its hair and the neck (the avatar box with room above). */
const FACE_VIEW = '24 -4 152 204';

const ROW_ICONS = {
  user: ['M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M4 21c0-4 4-6 8-6s8 2 8 6'],
  shield: ['M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z'],
  globe: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18'],
  gear: ['M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2'],
  target: [
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
    'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
  ],
  sliders: ['M4 7h10M18 7h2M4 17h4M12 17h8', 'M16 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM10 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4z'],
};

function RowIcon({ d }: { d: readonly string[] }) {
  return (
    <svg className="ic acc-ic" viewBox="0 0 24 24" aria-hidden="true">
      {d.map((p) => (
        <path key={p} d={p} />
      ))}
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}

function Chevron({ back = false }: { back?: boolean }) {
  return (
    <svg className="ic chevron" viewBox="0 0 24 24" aria-hidden="true">
      <path d={back ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}

interface Props {
  locale: Locale;
  onLocale: (locale: Locale) => void;
  /** Opens the settings dialog (board, pieces). */
  onSettings: () => void;
  /** Opens the preferences dialog (how the game behaves). */
  onPreferences: () => void;
}

/**
 * Top bar, as on lichess: the signed-in username (or "Sign in" and a gear for
 * guests) opens a menu with the profile, the language, the settings and
 * signing out. Deleting the account is in the profile's account settings.
 */
export function AccountButton({ locale, onLocale, onSettings, onPreferences }: Props) {
  const { t } = useI18n();
  const account = useAccount();
  const coins = useCoins();
  const [open, setOpen] = useState(false);
  // The menu itself, or its list of languages.
  const [view, setView] = useState<'main' | 'language'>('main');
  // The day's quests, in a window of their own.
  const [questsOpen, setQuestsOpen] = useState(false);
  const quests = useQuests().data;
  const box = useRef<HTMLDivElement>(null);

  // Closes the menu on a click elsewhere.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  // Language and settings do not wait for the account: until it is known, the gear is shown.
  const user = account.loading ? null : account.user;
  const toggle = () => {
    setOpen((o) => !o);
    setView('main');
  };

  return (
    <div className="account" ref={box}>
      {!user && !account.loading && account.canSignIn && (
        <button className="account-button" onClick={() => signInWithGoogle()} title={t('account.signInGoogle')}>
          <PersonIcon />
          <span className="account-label">{t('account.signIn')}</span>
        </button>
      )}
      {user ? (
        <button
          className="account-button on"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={toggle}
          title={user.username}
        >
          {user.avatar ? (
            <AvatarView avatar={user.avatar} outfit={user.outfit} className="account-avatar" />
          ) : (
            <PersonIcon />
          )}
          <span className="account-label">{user.username}</span>
          {coins.balance !== null && (
            <span className="account-coins" title={t('coins.balance', { n: String(coins.balance) })}>
              <CoinIcon />
              {coins.balance}
            </span>
          )}
        </button>
      ) : (
        <button
          className="icon-button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={toggle}
          aria-label={t('toolbar.settings')}
          title={t('toolbar.settings')}
        >
          <GearIcon />
        </button>
      )}
      <GenieDrop
        open={open}
        className="account-menu acc-card"
        opener={() => box.current?.querySelector('.account-button, .icon-button')}
        role="menu"
        aria-label={view === 'language' ? t('toolbar.language') : undefined}
      >
        {view === 'language' ? (
          <>
            <button role="menuitem" className="account-back" onClick={() => setView('main')}>
              <Chevron back />
              {t('toolbar.language')}
            </button>
            {(Object.entries(LOCALES) as [Locale, string][]).map(([code, name]) => (
              <button
                key={code}
                role="menuitemradio"
                aria-checked={code === locale}
                className={code === locale ? 'account-lang on' : 'account-lang'}
                lang={code}
                onClick={() => {
                  onLocale(code);
                  setView('main');
                }}
              >
                {name}
              </button>
            ))}
          </>
        ) : (
          <>
            {/* The card's head: the character (face and neck), the name and the coins. */}
            {user && (
              <a role="menuitem" className="acc-head" href={`/@/${user.username}`}>
                <span className="acc-face">
                  {user.avatar ? (
                    <AvatarView avatar={user.avatar} outfit={user.outfit} view={FACE_VIEW} />
                  ) : (
                    <PersonIcon />
                  )}
                </span>
                <span className="acc-who">
                  <b>{user.username}</b>
                  <small>{t('account.seeProfile')}</small>
                </span>
                {coins.balance !== null && (
                  <span className="acc-coins">
                    <CoinIcon />
                    {coins.balance}
                  </span>
                )}
              </a>
            )}
            <div className="acc-rows">
              {user && (
                <a role="menuitem" className="account-row" href={`/@/${user.username}`}>
                  <RowIcon d={ROW_ICONS.user} />
                  <span>{t('profile.mine')}</span>
                </a>
              )}
              {user && (
                <button
                  role="menuitem"
                  className="account-row"
                  onClick={() => {
                    setOpen(false);
                    setQuestsOpen(true);
                  }}
                >
                  <RowIcon d={ROW_ICONS.target} />
                  <span>{t('quests.menu')}</span>
                  {quests && (
                    <span className="acc-quests" aria-hidden="true">
                      {quests.quests.map((q) => (
                        <i key={q.id} className={q.progress >= q.target ? 'on' : ''} />
                      ))}
                    </span>
                  )}
                </button>
              )}
              {user?.role && (
                <a role="menuitem" className="account-row" href="/admin">
                  <RowIcon d={ROW_ICONS.shield} />
                  <span>{t('admin.title')}</span>
                </a>
              )}
              <button role="menuitem" className="account-row" onClick={() => setView('language')}>
                <RowIcon d={ROW_ICONS.globe} />
                <span>{t('toolbar.language')}</span>
                <span className="account-value">{LOCALES[locale]}</span>
                <Chevron />
              </button>
              <button
                role="menuitem"
                className="account-row"
                onClick={() => {
                  setOpen(false);
                  onSettings();
                }}
              >
                <RowIcon d={ROW_ICONS.gear} />
                <span>{t('toolbar.settings')}</span>
              </button>
              <button
                role="menuitem"
                className="account-row"
                onClick={() => {
                  setOpen(false);
                  onPreferences();
                }}
              >
                <RowIcon d={ROW_ICONS.sliders} />
                <span>{t('toolbar.preferences')}</span>
              </button>
            </div>
            {user && (
              <button
                role="menuitem"
                className="acc-out"
                onClick={() => {
                  setOpen(false);
                  void signOut().then(() => location.reload());
                }}
              >
                {t('account.signOut')}
              </button>
            )}
          </>
        )}
      </GenieDrop>
      {questsOpen && (
        <Modal label={t('quests.title')} className="quests-modal" onClose={() => setQuestsOpen(false)}>
          <QuestsCard />
        </Modal>
      )}
    </div>
  );
}
