import { useEffect, useState } from 'react';
import { GANG_POINTS, GANG_SIZE, GANG_WEEK_DAYS, cleanTag, gangProblem } from '../online/gang.ts';
import type { GangDetail, GangList, GangSummary, GangWar } from '../online/gang.ts';
import { TOURNAMENT_TIME_CONTROLS } from '../online/tournament.ts';
import { timeControl } from '../clock/clock.ts';
import { scoreText } from './TournamentsPage.tsx';
import type { MessageKey } from '../i18n/index.ts';
import { useAccount } from './account.ts';
import { useI18n } from './i18n.tsx';
import { ProfileLink } from './ProfileLink.tsx';
import { Crown } from './Punk.tsx';

const post = (path: string, body?: unknown) =>
  fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);

/** /gangs: gangs by weekly score, and founding one. /gang/<TAG>: one gang. */
export function GangsPage({ tag, onOpen }: { tag: string | null; onOpen: (path: string) => void }) {
  return tag ? <GangView tag={tag} onOpen={onOpen} /> : <GangIndex onOpen={onOpen} />;
}

function Rules() {
  const { t } = useI18n();
  return (
    <p className="muted">
      {t('gang.rules', {
        days: String(GANG_WEEK_DAYS),
        win: String(GANG_POINTS.win),
        draw: String(GANG_POINTS.draw),
        daily: String(GANG_POINTS.daily),
      })}
    </p>
  );
}

function GangIndex({ onOpen }: { onOpen: (path: string) => void }) {
  const { t } = useI18n();
  const account = useAccount();
  const [data, setData] = useState<GangList | null>(null);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetch('/api/gangs', { credentials: 'same-origin' })
      .then((r) => r.json() as Promise<GangList>)
      .then((d) => live && setData(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const found = async () => {
    const problem = gangProblem(name, tag);
    if (problem) return setError(`gang.problem.${problem}`);
    setBusy(true);
    const res = await post('/api/gangs', { name, tag });
    setBusy(false);
    if (res?.ok) return onOpen(`/gang/${cleanTag(tag)}`);
    const code = ((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? 'network';
    setError(
      (['name', 'tag', 'taken', 'in-gang'].includes(code)
        ? `gang.problem.${code}`
        : 'signup.problem.network') as MessageKey,
    );
  };

  return (
    <main className="profile-page gangs-page">
      <div className="profile-head">
        <div className="profile-title">
          <h1 className="profile-name">{t('gang.title')}</h1>
          <Rules />
        </div>
      </div>

      {data && account.user && !data.mine && (
        <form
          className="gang-form"
          onSubmit={(e) => {
            e.preventDefault();
            void found();
          }}
        >
          <h2>{t('gang.found')}</h2>
          <label>
            <span>{t('gang.name')}</span>
            <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            <span>{t('gang.tag')}</span>
            <input value={tag} maxLength={4} onChange={(e) => setTag(e.target.value.toUpperCase())} />
          </label>
          {error && <p className="error">{t(error)}</p>}
          <button className="primary" type="submit" disabled={busy}>
            {t('gang.foundButton')}
          </button>
        </form>
      )}
      {!data && <p className="muted">{t('leaders.loading')}</p>}
      {data && data.gangs.length === 0 && <p className="muted">{t('gang.none')}</p>}
      {data && (
        <GangRows
          title={t('gang.active')}
          gangs={data.gangs.filter((g) => g.active)}
          mine={data.mine}
          onOpen={onOpen}
        />
      )}
      {data && (
        <GangRows
          title={t('gang.formingList')}
          gangs={data.gangs.filter((g) => !g.active)}
          mine={data.mine}
          onOpen={onOpen}
        />
      )}
      {data && !account.user && !account.loading && <p className="muted">{t('gang.signIn')}</p>}
    </main>
  );
}

function GangRows({
  title,
  gangs,
  mine,
  onOpen,
}: {
  title: string;
  gangs: readonly GangSummary[];
  mine: string | null;
  onOpen: (path: string) => void;
}) {
  const { t } = useI18n();
  if (gangs.length === 0) return null;
  return (
    <section className="gang-section">
      <h2>{title}</h2>
      <ol className="gang-list">
        {gangs.map((g, i) => (
          <li key={g.tag} className={g.tag === mine ? 'mine' : ''}>
            <span className="leader-place">{!g.active ? '·' : i === 0 && g.score > 0 ? <Crown /> : i + 1}</span>
            <a
              href={`/gang/${g.tag}`}
              onClick={(e) => {
                e.preventDefault();
                onOpen(`/gang/${g.tag}`);
              }}
            >
              <strong>[{g.tag}]</strong> {g.name}
            </a>
            <span className="muted">{t('gang.members', { n: String(g.members), size: String(GANG_SIZE) })}</span>
            <span className="gang-score">{g.active ? g.score : ''}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function GangView({ tag, onOpen }: { tag: string; onOpen: (path: string) => void }) {
  const { t, locale } = useI18n();
  const account = useAccount();
  const [gang, setGang] = useState<GangDetail | null | 'missing'>(null);
  const [mine, setMine] = useState<string | null>(null);
  const [me, setMe] = useState<GangList | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [reload, setReload] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    void Promise.all([
      fetch(`/api/gangs/${encodeURIComponent(tag)}`).then((r) => (r.ok ? (r.json() as Promise<GangDetail>) : null)),
      fetch('/api/gangs', { credentials: 'same-origin' }).then((r) => r.json() as Promise<GangList>),
    ])
      .then(([g, list]) => {
        if (!live) return;
        setGang(g ?? 'missing');
        setMine(list.mine);
        setMe(list);
      })
      .catch(() => live && setGang('missing'));
    return () => {
      live = false;
    };
  }, [tag, reload]);

  if (gang === null)
    return (
      <main className="profile-page">
        <p className="muted">{t('leaders.loading')}</p>
      </main>
    );
  if (gang === 'missing')
    return (
      <main className="profile-page">
        <p className="muted">{t('gang.missing')}</p>
      </main>
    );
  const member = mine === gang.tag;
  const act = async (what: 'join' | 'leave') => {
    setError(null);
    const res = await post(`/api/gangs/${gang.tag}/${what}`);
    if (res?.ok) return setReload((n) => n + 1);
    const code = ((await res?.json().catch(() => null)) as { error?: string } | null)?.error;
    setError(
      code === 'full' ? 'gang.problem.full' : code === 'in-gang' ? 'gang.problem.in-gang' : 'signup.problem.network',
    );
  };

  return (
    <main className="profile-page gangs-page">
      <div className="profile-head">
        <div className="profile-title">
          <h1 className="profile-name">
            [{gang.tag}] {gang.name}
          </h1>
          <p className="muted">
            {t('gang.members', { n: String(gang.members), size: String(GANG_SIZE) })} ·{' '}
            {t('gang.since', { date: new Date(gang.createdAt).toLocaleDateString(locale) })} ·{' '}
            <a
              href="/gangs"
              onClick={(e) => {
                e.preventDefault();
                onOpen('/gangs');
              }}
            >
              {t('gang.all')}
            </a>
          </p>
          {account.user && (
            <div className="profile-actions">
              {member ? (
                <button onClick={() => void act('leave')}>{t('gang.leave')}</button>
              ) : !mine ? (
                <button className="primary" onClick={() => void act('join')}>
                  {t('gang.join')}
                </button>
              ) : null}
            </div>
          )}
          {error && <p className="error">{t(error)}</p>}
        </div>
        {gang.active ? (
          <span className="gang-total">
            <small>{t('gang.week')}</small>
            {gang.score}
          </span>
        ) : (
          <span className="gang-total forming">
            <small>{t('gang.forming')}</small>
            {gang.members}/{GANG_SIZE}
          </span>
        )}
      </div>
      {!gang.active && (
        <div className="gang-forming">
          <p>{t('gang.formingNote', { missing: String(GANG_SIZE - gang.members) })}</p>
          <button
            onClick={() => {
              void navigator.clipboard?.writeText(`${location.origin}/gang/${gang.tag}`).then(() => setCopied(true));
            }}
          >
            {copied ? t('gang.copied') : t('gang.copyLink')}
          </button>
        </div>
      )}
      <Rules />
      <ol className="gang-list">
        {gang.list.map((m, i) => (
          <li key={m.username}>
            <span className="leader-place">{i + 1}</span>
            <ProfileLink username={m.username}>{m.username}</ProfileLink>
            <span className="muted">{m.owner ? t('gang.founder') : ''}</span>
            <span className="gang-score">{gang.active ? m.score : ''}</span>
          </li>
        ))}
        {Array.from({ length: Math.max(0, GANG_SIZE - gang.members) }, (_, i) => (
          <li key={`empty-${i}`} className="gang-slot">
            <span className="leader-place">{gang.members + i + 1}</span>
            <span className="muted">{t('gang.emptySlot')}</span>
          </li>
        ))}
      </ol>
      <GangWars gang={gang} me={account.user ? me : null} onChange={() => setReload((n) => n + 1)} onOpen={onOpen} />
    </main>
  );
}

/**
 * A gang's wars: its record, a challenge from the viewer's gang (its founder,
 * both gangs full), and the latest wars with what can be done about them.
 */
function GangWars({
  gang,
  me,
  onChange,
  onOpen,
}: {
  gang: GangDetail;
  me: GangList | null;
  onChange: () => void;
  onOpen: (path: string) => void;
}) {
  const { t } = useI18n();
  const [tc, setTc] = useState('5+0');
  const [problem, setProblem] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const canChallenge = !!me?.mine && me.mine !== gang.tag && me.mineOwner && me.mineActive && gang.active;
  const fail = async (res: Response | null) => {
    const code = ((await res?.json().catch(() => null)) as { error?: string } | null)?.error;
    setProblem(
      code === 'busy'
        ? 'gang.war.busy'
        : code === 'not-active'
          ? 'gang.war.notActive'
          : code === 'not-founder'
            ? 'gang.war.notFounder'
            : code === 'over'
              ? 'gang.war.over'
              : 'signup.problem.network',
    );
  };
  const challenge = async () => {
    setBusy(true);
    setProblem(null);
    const res = await post(`/api/gangs/${gang.tag}/war`, { timeControlId: tc });
    setBusy(false);
    if (res?.ok) onChange();
    else await fail(res);
  };
  const answer = async (war: GangWar, action: 'accept' | 'decline' | 'cancel') => {
    setBusy(true);
    setProblem(null);
    const res = await post(`/api/gangs/${gang.tag}/war/${war.id}/${action}`);
    setBusy(false);
    if (!res?.ok) return fail(res);
    const data = (await res.json().catch(() => ({}))) as { tournamentId?: string };
    if (data.tournamentId) onOpen(`/tournament/${data.tournamentId}`);
    else onChange();
  };
  const { won, lost, drawn } = gang.record;
  return (
    <section className="gang-wars">
      <div className="gang-wars-head">
        <h2>{t('gang.war.title')}</h2>
        <span className="muted">
          {t('gang.war.record', { won: String(won), lost: String(lost), drawn: String(drawn) })}
        </span>
      </div>
      <p className="muted gang-wars-rule">{t('gang.war.rule')}</p>
      {canChallenge && (
        <div className="gang-war-form">
          <div className="gang-war-tcs" role="group" aria-label={t('newGame.time')}>
            {TOURNAMENT_TIME_CONTROLS.map((id) => (
              <button key={id} className={`chip${tc === id ? ' on' : ''}`} onClick={() => setTc(id)}>
                {timeControl(id).label}
              </button>
            ))}
          </div>
          <button className="primary" disabled={busy} onClick={() => void challenge()}>
            {t('gang.war.declare', { tag: gang.tag })}
          </button>
        </div>
      )}
      {problem && <p className="error">{t(problem)}</p>}
      {gang.wars.length === 0 && <p className="muted">{t('gang.war.none')}</p>}
      <ul className="gang-war-list">
        {gang.wars.map((w) => {
          const canAnswer = w.status === 'pending' && !!me?.mineOwner && me.mine === w.defender.tag;
          const canCancel = w.status === 'pending' && !!me?.mineOwner && me.mine === w.challenger.tag;
          const winnerTag = w.winner === 'c' ? w.challenger.tag : w.winner === 'd' ? w.defender.tag : null;
          return (
            <li key={w.id} className={`gang-war ${w.status}`}>
              <span className="gang-war-sides">
                <strong>[{w.challenger.tag}]</strong>
                {w.score ? (
                  <span className="gang-war-score">
                    {scoreText(w.score.c)} – {scoreText(w.score.d)}
                  </span>
                ) : (
                  <span className="muted"> vs </span>
                )}
                <strong>[{w.defender.tag}]</strong>
                <small className="muted"> · {timeControl(w.timeControlId).label}</small>
              </span>
              <span className="gang-war-state">
                {w.status === 'finished'
                  ? winnerTag
                    ? t('gang.war.won', { tag: winnerTag })
                    : t('gang.war.drawn')
                  : t(`gang.war.status.${w.status}`)}
              </span>
              <span className="gang-war-actions">
                {canAnswer && (
                  <>
                    <button className="primary" disabled={busy} onClick={() => void answer(w, 'accept')}>
                      {t('gang.war.accept')}
                    </button>
                    <button disabled={busy} onClick={() => void answer(w, 'decline')}>
                      {t('gang.war.decline')}
                    </button>
                  </>
                )}
                {canCancel && (
                  <button disabled={busy} onClick={() => void answer(w, 'cancel')}>
                    {t('gang.war.cancel')}
                  </button>
                )}
                {w.tournamentId && (
                  <a
                    href={`/tournament/${w.tournamentId}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onOpen(`/tournament/${w.tournamentId}`);
                    }}
                  >
                    {w.status === 'live' ? t('gang.war.go') : t('gang.war.see')}
                  </a>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
