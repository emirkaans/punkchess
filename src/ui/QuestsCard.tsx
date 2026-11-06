import { useEffect, useState } from 'react';
import type { MessageKey } from '../i18n/index.ts';
import { ALL_DONE_COINS, STREAK_COINS, STREAK_DAYS } from '../quests/rules.ts';
import { signInWithGoogle, useAccount } from './account.ts';
import { CoinIcon } from './CoinToast.tsx';
import { useI18n } from './i18n.tsx';
import { refreshQuests, swapQuest, useQuests } from './quests.ts';

/** "7 sa 12 dk" until `at`. */
export function useCountdown(at: number | null): { h: number; m: number; d: number } | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (at === null) return null;
  const left = Math.max(0, at - now);
  const mins = Math.floor(left / 60_000);
  return { d: Math.floor(mins / 1440), h: Math.floor((mins % 1440) / 60), m: mins % 60 };
}

const ICONS: Readonly<Record<string, string>> = {
  play1: '♟',
  puzzle3: '🧩',
  daily: '📅',
  rush10: '⚡',
  win2: '⚔',
  winBlack: '♞',
  variant: '🎲',
  card: '🃏',
  puzzle8: '🧩',
  rush20: '⚡',
  mate: '♚',
  win3: '⚔',
  tournament: '🏆',
  giant: '🗡',
  rush30: '⚡',
};

/**
 * Today's three quests (design "Görevler"): progress, coins, the streak towards its seventh-day
 * gift, one change a day. On the home page and in the account menu's window.
 */
export function QuestsCard({ className = '' }: { className?: string }) {
  const { t } = useI18n();
  const account = useAccount();
  const { data } = useQuests();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (account.user) void refreshQuests();
  }, [account.user]);
  const left = useCountdown(data?.nextAt ?? null);

  if (!account.user) {
    if (account.loading || !account.canSignIn) return null;
    return (
      <section className={`quests-card guest ${className}`} aria-label={t('quests.title')}>
        <h2 className="quests-title">{t('quests.title')}</h2>
        <p className="quests-guest">{t('quests.signIn')}</p>
        <button className="quests-signin" onClick={() => signInWithGoogle()}>
          {t('account.signIn')}
        </button>
      </section>
    );
  }
  if (!data) return null;
  // The streak as a week: the days done so far of the current seven, the seventh a gift.
  const inWeek =
    data.streak % STREAK_DAYS === 0 && data.allDone && data.streak > 0 ? STREAK_DAYS : data.streak % STREAK_DAYS;
  return (
    <section className={`quests-card ${className}`} aria-label={t('quests.title')}>
      <div className="quests-head">
        <h2 className="quests-title">{t('quests.title')}</h2>
        {data.streak > 0 && <span className="quests-streak">🔥 {t('quests.streak', { n: String(data.streak) })}</span>}
      </div>
      <div className="quests-week" aria-label={t('quests.streakLabel', { n: String(data.streak) })}>
        {Array.from({ length: STREAK_DAYS }, (_, i) => (
          <span key={i} className={`${i < inWeek ? 'on' : ''}${i === STREAK_DAYS - 1 ? ' gift' : ''}`}>
            {i === STREAK_DAYS - 1 ? '🎁' : i + 1}
          </span>
        ))}
      </div>
      <ul className="quests-list">
        {data.quests.map((q, slot) => {
          const finished = q.progress >= q.target;
          return (
            <li key={q.id} className={finished ? 'done' : ''}>
              <span className="quest-ic" aria-hidden="true">
                {finished ? '✓' : (ICONS[q.id] ?? '★')}
              </span>
              <span className="quest-text">
                {t(`quests.q.${q.id}` as MessageKey)}
                <small>{t(`quests.tier.${q.tier}` as MessageKey)}</small>
              </span>
              <span className="quest-side">
                <span className="quest-coins">
                  <CoinIcon />+{q.coins}
                </span>
                <span className="quest-count">
                  {q.progress}/{q.target}
                </span>
                {!finished && !data.swapped && (
                  <button
                    className="quest-swap"
                    disabled={busy}
                    title={t('quests.swapHint')}
                    onClick={async () => {
                      setBusy(true);
                      await swapQuest(slot);
                      setBusy(false);
                    }}
                  >
                    {t('quests.swap')}
                  </button>
                )}
              </span>
              <span className="quest-bar" aria-hidden="true">
                <span style={{ width: `${(100 * q.progress) / q.target}%` }} />
              </span>
            </li>
          );
        })}
      </ul>
      <div className={`quests-bonus${data.allDone ? ' done' : ''}`}>
        {t('quests.bonus')}
        <span className="quest-coins">
          <CoinIcon />+{ALL_DONE_COINS}
        </span>
      </div>
      <div className="quests-foot">
        {left && <span>{t('quests.next', { h: String(left.h), m: String(left.m) })}</span>}
        <span>{t('quests.gift', { n: String(STREAK_COINS) })}</span>
      </div>
    </section>
  );
}

/** "Quest done!" for a few seconds when one gets done (src/ui/quests.ts). */
export function QuestToast() {
  const { t } = useI18n();
  const { news } = useQuests();
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!news) return;
    setShown(news.key);
    const id = setTimeout(() => setShown(null), 4000);
    return () => clearTimeout(id);
  }, [news]);
  if (!news || shown !== news.key) return null;
  return (
    <div className="quest-toast" role="status" key={news.key}>
      <span className="quest-toast-ic" aria-hidden="true">
        ✓
      </span>
      <span>
        <b>{t('quests.doneToast')}</b>
        <small>{t(`quests.q.${news.id}` as MessageKey)}</small>
      </span>
      <span className="quest-coins">
        <CoinIcon />+{news.coins}
      </span>
    </div>
  );
}
