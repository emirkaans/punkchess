import { useEffect, useState } from 'react';
import { timeControl } from '../clock/clock.ts';
import { getVariant } from '../engine/index.ts';
import { CHALLENGE_POLL_MS } from '../online/challenge.ts';
import type { Challenge, ChallengeList, WarAlert } from '../online/challenge.ts';
import { useAccount } from './account.ts';
import { useAttention } from './attention.ts';
import { useI18n } from './i18n.tsx';
import { joinOnlineGame } from './online/connection.ts';
import { playSound } from './sound.ts';

/** War notices closed in this tab (kept across reloads of the tab). */
const CLOSED_KEY = 'pc_war_closed';

const answer = (id: string, what: 'accept' | 'decline') =>
  fetch(`/api/challenges/${id}/${what}`, { method: 'POST', credentials: 'same-origin' }).catch(() => null);

/**
 * Challenges to the signed-in player, wherever they are on the site: asked for
 * every CHALLENGE_POLL_MS while the tab is visible, shown in a corner with
 * accept and decline. Accepting joins the game and opens it.
 */
export function ChallengeInbox({
  sound,
  onOpenGame,
  onOpen,
}: {
  sound: boolean;
  onOpenGame: (id: string) => void;
  /** Goes to a page of the site (a gang war's boards, a gang). */
  onOpen: (path: string) => void;
}) {
  const { t, vt } = useI18n();
  const account = useAccount();
  const [list, setList] = useState<readonly Challenge[]>([]);
  const [wars, setWars] = useState<readonly WarAlert[]>([]);
  // War notices closed in this tab (each says its piece once).
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => {
    try {
      return new Set(JSON.parse(sessionStorage.getItem(CLOSED_KEY) ?? '[]') as string[]);
    } catch {
      return new Set();
    }
  });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const signedIn = !account.loading && !!account.user;

  useEffect(() => {
    if (!signedIn) {
      setWars([]);
      return setList([]);
    }
    let live = true;
    let seen = new Set<string>();
    const ask = async () => {
      if (document.hidden) return;
      const res = await fetch('/api/challenges', { credentials: 'same-origin' }).catch(() => null);
      if (!live || !res?.ok) return;
      const { challenges, wars = [] } = (await res.json()) as ChallengeList;
      // Something new (a challenge, a war starting or declared) makes a sound once.
      const ids = [...challenges.map((c) => c.id), ...wars.map((w) => `${w.kind}:${w.warId}`)];
      if (ids.some((id) => !seen.has(id)) && sound) playSound('start');
      seen = new Set(ids);
      setList(challenges);
      setWars(wars);
    };
    void ask();
    const id = setInterval(() => void ask(), CHALLENGE_POLL_MS);
    const onShow = () => void ask();
    document.addEventListener('visibilitychange', onShow);
    return () => {
      live = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [signedIn, sound]);

  const c = list[0] ?? null;
  // A war under way comes first: its boards wait only a few minutes.
  const war = wars.find((w) => !closed.has(`${w.kind}:${w.warId}`)) ?? null;
  useAttention(
    war
      ? t(war.kind === 'live' ? 'war.alert.flashLive' : 'war.alert.flashPending', { them: war.them })
      : c
        ? t('challenge.flash', { name: c.from })
        : null,
  );
  if (war && account.user) {
    const close = () =>
      setClosed((s) => {
        const next = new Set([...s, `${war.kind}:${war.warId}`]);
        try {
          sessionStorage.setItem(CLOSED_KEY, JSON.stringify([...next]));
        } catch {
          // storage off: closed for this page only
        }
        return next;
      });
    return (
      <div className="challenge-toast war-toast" role="alertdialog" aria-label={t('gang.war.title')}>
        <p>
          <strong>
            [{war.us}] vs [{war.them}]
          </strong>{' '}
          {t(war.kind === 'live' ? 'war.alert.live' : 'war.alert.pending')}
        </p>
        <div className="challenge-actions">
          <button
            className="primary"
            onClick={() => {
              close();
              onOpen(war.kind === 'live' && war.tournamentId ? `/tournament/${war.tournamentId}` : `/gang/${war.us}`);
            }}
          >
            {t(war.kind === 'live' ? 'war.alert.go' : 'war.alert.answer')}
          </button>
          <button onClick={close}>{t('war.alert.close')}</button>
        </div>
      </div>
    );
  }
  if (!c || !account.user) return null;

  const tc = timeControl(c.timeControlId);
  const drop = () => setList((l) => l.filter((x) => x.id !== c.id));
  return (
    <div className="challenge-toast" role="alertdialog" aria-label={t('challenge.title')}>
      <p>
        <strong>{c.from}</strong> {t('challenge.text')}
      </p>
      <p className="muted">
        {vt(getVariant(c.variantId)).name} · {tc.initialMs === null ? t('time.none') : tc.label} ·{' '}
        {t(c.rated ? 'lobby.rated' : 'lobby.casual')}
      </p>
      {failed && <p className="error">{t('challenge.gone')}</p>}
      <div className="challenge-actions">
        <button
          className="primary"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setFailed(false);
            void answer(c.id, 'accept');
            joinOnlineGame(c.gameId, account.user!.username)
              .then(() => {
                drop();
                onOpenGame(c.gameId);
              })
              .catch(() => setFailed(true))
              .finally(() => setBusy(false));
          }}
        >
          {t('challenge.accept')}
        </button>
        <button
          disabled={busy}
          onClick={() => {
            void answer(c.id, 'decline');
            drop();
            setFailed(false);
          }}
        >
          {t('challenge.decline')}
        </button>
      </div>
    </div>
  );
}
