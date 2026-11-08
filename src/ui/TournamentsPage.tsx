import { useEffect, useRef, useState } from 'react';
import { timeControl } from '../clock/clock.ts';
import { getVariant, listVariants } from '../engine/index.ts';
import type { MessageKey } from '../i18n/index.ts';
import {
  SWISS_ROUNDS,
  TOURNAMENT_FORMATS,
  TOURNAMENT_MINUTES,
  TOURNAMENT_PICK_MAX_MS,
  TOURNAMENT_START_IN,
  TOURNAMENT_TIME_CONTROLS,
  tournamentNameProblem,
} from '../online/tournament.ts';
import type { TournamentFormat, TournamentList, TournamentSummary, TournamentView } from '../online/tournament.ts';
import { playoffWinner, warPairs, warScore, warWinner } from '../online/tournament.ts';
import { useAccount } from './account.ts';
import { Coronation } from './Coronation.tsx';
import { useI18n } from './i18n.tsx';
import { useTournament } from './online/tournamentConnection.ts';
import { ProfileLink } from './ProfileLink.tsx';
import { Crown } from './Punk.tsx';

/** /tournaments: the list and making one. /tournament/<id>: one tournament. */
export function TournamentsPage({
  id,
  onOpen,
  onOpenGame,
}: {
  id: string | null;
  onOpen: (path: string) => void;
  onOpenGame: (gameId: string) => void;
}) {
  return id ? (
    <TournamentRoom key={id} id={id} onOpen={onOpen} onOpenGame={onOpenGame} />
  ) : (
    <TournamentIndex onOpen={onOpen} />
  );
}

/** Ticks every second (for the countdowns). */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

const DAY_MS = 86_400_000;

/** A start more than a day away, as its day and time ("Prş 13 Kas 21:00"). */
const dayText = (at: number, locale: string) =>
  new Date(at).toLocaleString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/** The value of a date-and-time field for `at`, in the browser's time zone. */
const localInput = (at: number) => {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** The picked start's first suggestion: tomorrow at 21:00. */
const tomorrowEvening = () => {
  const d = new Date(Date.now() + DAY_MS);
  d.setHours(21, 0, 0, 0);
  return localInput(d.getTime());
};

const clockText = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
};

/**
 * Marks the English format names (Arena, Swiss) as English, so CSS uppercase gives SWISS
 * rather than the Turkish SWİSS.
 */
function englishTerms(text: string) {
  return text.split(/(Arena|Swiss)/).map((part, i) =>
    i % 2 ? (
      <span key={i} lang="en">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function Rules({ format }: { format: TournamentFormat }) {
  const { t } = useI18n();
  return (
    <p className="tz-rule">
      <strong className={`tz-format ${format}`}>{englishTerms(t(`tournament.format.${format}`))}</strong>
      <span>
        {t(
          format === 'swiss' ? 'tournament.swissRules' : format === 'war' ? 'tournament.warRules' : 'tournament.rules',
        )}
      </span>
    </p>
  );
}

/** A score as shown: Swiss half points as ½ (1.5 → 1½). */
export const scoreText = (n: number): string => {
  const whole = Math.floor(n);
  const half = n - whole >= 0.5;
  return half ? (whole === 0 ? '½' : `${whole}½`) : String(whole);
};

function Chips<T extends string | number | boolean>({
  legend,
  name,
  options,
  value,
  onChange,
  label,
}: {
  legend: string;
  name: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label: (v: T) => string;
}) {
  return (
    <fieldset className="choice-row choice-grid">
      <legend>{legend}</legend>
      {options.map((o) => (
        <label key={String(o)} className={`chip${value === o ? ' on' : ''}`}>
          <input type="radio" name={name} checked={value === o} onChange={() => onChange(o)} />
          {label(o)}
        </label>
      ))}
    </fieldset>
  );
}

function TournamentIndex({ onOpen }: { onOpen: (path: string) => void }) {
  const { t, vt, locale } = useI18n();
  const account = useAccount();
  const [list, setList] = useState<TournamentList | null>(null);
  const [making, setMaking] = useState(false);
  const [name, setName] = useState('');
  const [variantId, setVariantId] = useState(listVariants()[0].id);
  const [timeControlId, setTimeControlId] = useState('3+2');
  const [format, setFormat] = useState<TournamentFormat>('arena');
  const [minutes, setMinutes] = useState<number>(30);
  const [rounds, setRounds] = useState<number>(5);
  // 0: a day and time picked (pickAt) instead of minutes from now.
  const [startIn, setStartIn] = useState<number>(5);
  const [pickAt, setPickAt] = useState(tomorrowEvening);
  const [rated, setRated] = useState(true);
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const now = useNow();

  useEffect(() => {
    let live = true;
    const ask = () =>
      fetch('/api/tournaments')
        .then((r) => r.json() as Promise<TournamentList>)
        .then((d) => live && setList(d))
        .catch(() => {});
    void ask();
    const timer = setInterval(() => document.visibilityState === 'visible' && void ask(), 30_000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);

  const create = async () => {
    if (tournamentNameProblem(name)) return setError('tournament.problem.name');
    const start = startIn === 0 ? { startsAt: new Date(pickAt).getTime() } : { startIn };
    if (startIn === 0 && !Number.isFinite(start.startsAt)) return setError('tournament.problem.time');
    setBusy(true);
    setError(null);
    const res = await fetch('/api/tournaments', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, variantId, timeControlId, minutes, ...start, rated, format, rounds }),
    }).catch(() => null);
    setBusy(false);
    const data = (await res?.json().catch(() => null)) as { id?: string; error?: string } | null;
    if (res?.ok && data?.id) return onOpen(`/tournament/${data.id}`);
    setError(
      data?.error === 'one-open'
        ? 'tournament.problem.oneOpen'
        : data?.error === 'forbidden'
          ? 'tournament.problem.staff'
          : data?.error === 'name'
            ? 'tournament.problem.name'
            : data?.error === 'time'
              ? 'tournament.problem.time'
              : 'signup.problem.network',
    );
  };

  const row = (s: TournamentSummary) => (
    <li key={s.id}>
      <a
        className={`tz-row tz-item ${s.status}`}
        href={`/tournament/${s.id}`}
        onClick={(e) => {
          e.preventDefault();
          onOpen(`/tournament/${s.id}`);
        }}
      >
        <span className="tz-tc" aria-hidden="true">
          {timeControl(s.timeControlId).label}
        </span>
        <span className="tz-item-text">
          <strong>{s.name}</strong>
          <span>
            {englishTerms(t(`tournament.format.${s.format}`))}
            {s.format === 'swiss' && s.rounds ? ` (${t('tournament.roundsN', { n: String(s.rounds) })})` : ''} ·{' '}
            {vt(getVariant(s.variantId)).name} · {timeControl(s.timeControlId).label} ·{' '}
            {t(s.rated ? 'lobby.rated' : 'lobby.casual')}
          </span>
        </span>
        <span className="tz-item-when">
          {s.status === 'created' && s.startsAt - now > DAY_MS ? (
            t('tournament.startsOn', { time: dayText(s.startsAt, locale) })
          ) : s.status === 'created' ? (
            t('tournament.startsIn', { time: clockText(s.startsAt - now) })
          ) : s.status === 'started' && s.format === 'swiss' ? (
            t('tournament.swissLive')
          ) : s.status === 'started' ? (
            t('tournament.endsIn', { time: clockText(s.endsAt - now) })
          ) : s.winner ? (
            <>
              <Crown /> {s.winner}
            </>
          ) : (
            t('tournament.over')
          )}
        </span>
        <span className="tz-item-count">{t('tournament.playersN', { n: String(s.players) })}</span>
      </a>
    </li>
  );

  return (
    <main className="tournament-page">
      <header className="tz-head">
        <div className="tz-badge" aria-hidden="true">
          <Crown />
        </div>
        <div className="tz-title">
          <p className="tz-meta">{englishTerms(t('tournament.arena'))}</p>
          <RansomTitle text={t('tournament.title')} />
          <Rules format="arena" />
          <Rules format="swiss" />
        </div>
      </header>

      <div className="tz-bar">
        {account.user?.role && !making && (
          <button className="tz-pill primary" onClick={() => setMaking(true)}>
            {t('tournament.make')}
          </button>
        )}
      </div>

      {making && (
        <form
          className="tz-form"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <h2 className="tz-section-title">{t('tournament.make')}</h2>
          <label className="analysis-field">
            <span>{t('tournament.name')}</span>
            <input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
          </label>
          <Chips
            legend={t('tournament.formatLabel')}
            name="t-format"
            options={TOURNAMENT_FORMATS}
            value={format}
            onChange={setFormat}
            label={(f) => t(`tournament.format.${f}`)}
          />
          <Chips
            legend={t('newGame.variant')}
            name="t-variant"
            options={listVariants().map((v) => v.id)}
            value={variantId}
            onChange={setVariantId}
            label={(id) => vt(getVariant(id)).name}
          />
          <Chips
            legend={t('newGame.time')}
            name="t-time"
            options={TOURNAMENT_TIME_CONTROLS}
            value={timeControlId}
            onChange={setTimeControlId}
            label={(id) => timeControl(id).label}
          />
          {format === 'arena' ? (
            <Chips
              legend={t('tournament.length')}
              name="t-minutes"
              options={TOURNAMENT_MINUTES}
              value={minutes as (typeof TOURNAMENT_MINUTES)[number]}
              onChange={setMinutes}
              label={(m) => t('tournament.minutes', { n: String(m) })}
            />
          ) : (
            <Chips
              legend={t('tournament.roundsLabel')}
              name="t-rounds"
              options={SWISS_ROUNDS}
              value={rounds as (typeof SWISS_ROUNDS)[number]}
              onChange={setRounds}
              label={(n) => String(n)}
            />
          )}
          <Chips
            legend={t('tournament.startIn')}
            name="t-start"
            options={[...TOURNAMENT_START_IN, 0]}
            value={startIn}
            onChange={setStartIn}
            label={(m) => (m === 0 ? t('tournament.pickTime') : t('tournament.minutes', { n: String(m) }))}
          />
          {startIn === 0 && (
            <label className="t-pick">
              <span>{t('tournament.pickLabel')}</span>
              <input
                type="datetime-local"
                value={pickAt}
                min={localInput(now + 5 * 60_000)}
                max={localInput(now + TOURNAMENT_PICK_MAX_MS)}
                step={300}
                onChange={(e) => setPickAt(e.target.value)}
              />
              {Number.isFinite(new Date(pickAt).getTime()) && <b>{dayText(new Date(pickAt).getTime(), locale)}</b>}
            </label>
          )}
          <Chips
            legend={t('lobby.kind')}
            name="t-rated"
            options={[true, false] as const}
            value={rated}
            onChange={setRated}
            label={(r) => t(r ? 'lobby.rated' : 'lobby.casual')}
          />
          {error && <p className="error">{t(error)}</p>}
          <div className="tz-form-actions">
            <button type="button" className="tz-pill ghost" onClick={() => setMaking(false)}>
              {t('settings.back')}
            </button>
            <button className="tz-pill primary" type="submit" disabled={busy}>
              {t('tournament.makeButton')}
            </button>
          </div>
        </form>
      )}

      {!list && <p className="muted">{t('leaders.loading')}</p>}
      {list && list.live.length + list.upcoming.length + list.finished.length === 0 && (
        <p className="tz-empty muted">{t('tournament.none')}</p>
      )}
      {list &&
        (
          [
            ['tournament.live', list.live],
            ['tournament.upcoming', list.upcoming],
            ['tournament.finished', list.finished],
          ] as const
        ).map(
          ([title, items]) =>
            items.length > 0 && (
              <section key={title} className="tz-section">
                <h2 className="tz-section-title">{t(title)}</h2>
                <ul className="tz-standings">{items.map(row)}</ul>
              </section>
            ),
        )}
    </main>
  );
}

function TournamentRoom({
  id,
  onOpen,
  onOpenGame,
}: {
  id: string;
  onOpen: (path: string) => void;
  onOpenGame: (gameId: string) => void;
}) {
  const { t, vt, locale } = useI18n();
  const account = useAccount();
  const link = useTournament(id, (ticket) => onOpenGame(ticket.gameId));
  const now = useNow() + link.skew;
  const [copied, setCopied] = useState(false);
  const v: TournamentView | null = link.view;
  // The crowning, once: when the tournament ends while the page is open, or when a player comes
  // back to it soon after (from their last game, which may have been the one that ended it).
  const [crowned, setCrowned] = useState(false);
  const lastStatus = useRef<string | null>(null);
  const status = v?.status ?? null;
  const justEnded = !!v && v.status === 'finished' && !!v.you && v.now - v.endsAt < CROWN_RECENT_MS;
  useEffect(() => {
    const live = !!lastStatus.current && lastStatus.current !== 'finished' && status === 'finished';
    lastStatus.current = status;
    if ((live || justEnded) && !crownSeen(id)) {
      markCrownSeen(id);
      setCrowned(true);
    }
  }, [status, justEnded, id]);

  if (link.status === 'missing') {
    return (
      <main className="profile-page">
        <p className="muted">{t('tournament.missing')}</p>
      </main>
    );
  }
  if (!v) {
    return (
      <main className="profile-page">
        <p className="muted">{t('leaders.loading')}</p>
      </main>
    );
  }
  const me = v.standings.find((p) => p.userId === v.you) ?? null;
  const swiss = v.format === 'swiss';
  // A gang war: the two gangs' points so far, and which gang each player plays for.
  const war = v.war ? warScore(v.war, Object.fromEntries(v.standings.map((p) => [p.userId, p]))) : null;
  const sideTag = (id: string) => {
    const side = v.war?.players.find((p) => p.id === id)?.side;
    return side ? v.war!.tags[side] : null;
  };
  // The top three once they have points: patches on the jacket, the winner's in the middle.
  const podium = v.standings.filter((p) => p.score > 0).slice(0, 3);

  return (
    <main className="tournament-page">
      <header className="tz-head">
        <div className="tz-badge" aria-hidden="true">
          <Crown />
        </div>
        <div className="tz-title">
          <p className="tz-meta">
            {englishTerms(t(`tournament.format.${v.format}`))}
            {swiss && v.rounds ? ` · ${t('tournament.roundsN', { n: String(v.rounds) })}` : ''} ·{' '}
            {vt(getVariant(v.variantId)).name} · {timeControl(v.timeControlId).label} ·{' '}
            {t(v.rated ? 'lobby.rated' : 'lobby.casual')}
          </p>
          <RansomTitle text={v.name} />
          <p className="tz-sub">
            {t('tournament.by', { name: v.createdBy })} · {t('tournament.playersN', { n: String(v.standings.length) })}{' '}
            · {t('tournament.games', { n: String(v.games) })} ·{' '}
            <a
              href="/tournaments"
              onClick={(e) => {
                e.preventDefault();
                onOpen('/tournaments');
              }}
            >
              {t('tournament.all')}
            </a>
          </p>
        </div>
        <div className={`tz-clock ${v.status}`}>
          <small>
            {v.status === 'created' && v.startsAt - now > DAY_MS
              ? t('tournament.startsOnLabel')
              : v.status === 'created'
                ? t('tournament.startsInLabel')
                : v.status === 'started' && (swiss || v.war)
                  ? t('tournament.roundLabel')
                  : v.status === 'started'
                    ? t('tournament.endsInLabel')
                    : t('tournament.over')}
          </small>
          <span>
            {v.status === 'created' && v.startsAt - now > DAY_MS
              ? dayText(v.startsAt, locale)
              : v.status === 'created'
                ? clockText(v.startsAt - now)
                : v.status === 'started' && (swiss || v.war)
                  ? `${v.round}/${v.rounds ?? '?'}`
                  : v.status === 'started'
                    ? clockText(v.endsAt - now)
                    : '—'}
          </span>
        </div>
      </header>

      <div className="tz-bar">
        {v.war && me?.game && (
          <button className="tz-pill primary" onClick={() => onOpenGame(me.game!)}>
            {t('tournament.backToGame')}
          </button>
        )}
        {!v.war && v.status !== 'finished' && account.user && (
          <>
            {!me || me.paused ? (
              <button className="tz-pill primary" onClick={link.join} disabled={link.status !== 'open'}>
                {me ? t('tournament.resume') : t('tournament.join')}
              </button>
            ) : (
              <button className="tz-pill" onClick={link.withdraw} disabled={link.status !== 'open'}>
                {v.status === 'created' ? t('tournament.withdraw') : t('tournament.pause')}
              </button>
            )}
            {me?.game ? (
              <button className="tz-pill primary" onClick={() => onOpenGame(me.game!)}>
                {t('tournament.backToGame')}
              </button>
            ) : me && !me.paused && v.status === 'started' && swiss ? (
              <span className="tournament-waiting">
                {v.nextRoundAt
                  ? t('tournament.nextRound', { time: clockText(v.nextRoundAt - now) })
                  : me.sheet.length === v.round && me.sheet[me.sheet.length - 1]?.r === 'b'
                    ? t('tournament.byeNow')
                    : t('tournament.roundGoing')}
              </span>
            ) : me && !me.paused && v.status === 'started' ? (
              <span className="tournament-waiting">{t('tournament.waiting')}</span>
            ) : me && !me.paused && v.status === 'created' ? (
              <span className="muted">{t('tournament.joined')}</span>
            ) : null}
          </>
        )}
        {!v.war && v.status !== 'finished' && !account.user && !account.loading && (
          <span className="muted">{t('tournament.signIn')}</span>
        )}
        <button
          className="tz-pill ghost"
          onClick={() => {
            void navigator.clipboard?.writeText(`${location.origin}/tournament/${v.id}`).then(() => setCopied(true));
          }}
        >
          {copied ? t('gang.copied') : t('tournament.copyLink')}
        </button>
      </div>
      {link.error && <p className="error">{t(`tournament.error.${link.error}`)}</p>}

      {v.war && war && (
        <div className={`tz-war${v.status === 'finished' ? ' over' : ''}`} aria-label={t('gang.war.title')}>
          <span className={war.c > war.d ? 'lead' : ''}>[{v.war.tags.c}]</span>
          <strong>
            {scoreText(war.c)} – {scoreText(war.d)}
          </strong>
          <span className={war.d > war.c ? 'lead' : ''}>[{v.war.tags.d}]</span>
        </div>
      )}
      {v.war && war && <WarBoards v={v} />}
      {!v.war && podium.length > 0 && (
        <ol className="tz-podium" aria-label={t('tournament.podium')}>
          {podium.map((p, i) => (
            <li key={p.userId} className={`tz-patch place-${i + 1}`}>
              {i === 0 ? <Crown /> : <span className="tz-roman">{i === 1 ? 'II' : 'III'}</span>}
              <ProfileLink username={p.username}>{p.username}</ProfileLink>
              <strong>{t('tournament.points', { n: scoreText(p.score) })}</strong>
              {i === 0 && p.fire && (
                <span className="tz-fire-tag">
                  <Flame />
                  {t('tournament.fireTag')}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      {!v.war && (
        <ol className="tz-standings">
          {v.standings.length === 0 && <li className="tz-empty muted">{t('tournament.nobody')}</li>}
          {v.standings.map((p, i) => (
            <li
              key={p.userId}
              className={`tz-row${i === 0 && p.score > 0 ? ' lead' : ''}${p.userId === v.you ? ' mine' : ''}${p.paused ? ' paused' : ''}`}
            >
              <span className="tz-place">{i + 1}</span>
              <span className="tz-player">
                {sideTag(p.userId) && <span className="tz-side">[{sideTag(p.userId)}]</span>}
                <ProfileLink username={p.username}>{p.username}</ProfileLink>
                {p.fire && (
                  <span className="tz-fire" title={t('tournament.onFire')}>
                    <Flame />
                  </span>
                )}
                {p.game && <span className="tournament-playing" title={t('tournament.playing')} />}
                {p.paused && <span className="tz-paused">{t('tournament.paused')}</span>}
              </span>
              <span className="tz-sheet" aria-label={t('tournament.sheet')}>
                {p.sheet.slice(-12).map((s, i) =>
                  s.r === 'b' ? (
                    <span key={`bye-${i}`} className="tz-dot b" title={t('tournament.result.b')}>
                      B
                    </span>
                  ) : (
                    <a
                      key={s.gameId}
                      href={`/${s.gameId}`}
                      className={`tz-dot ${s.r}${s.fire ? ' fire' : ''}`}
                      title={t(`tournament.result.${s.r}`)}
                    >
                      {scoreText(s.pts)}
                    </a>
                  ),
                )}
              </span>
              <span className="tz-score">
                {scoreText(p.score)}
                {swiss && (
                  <small className="tz-bh" title={t('tournament.buchholz')}>
                    BH {scoreText(p.buchholz)}
                  </small>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
      <Rules format={v.format} />
      {crowned && <Coronation v={v} onClose={() => setCrowned(false)} onOpen={onOpen} />}
    </main>
  );
}

/** How soon after a tournament ends a player coming back to its page still gets the crowning. */
const CROWN_RECENT_MS = 10 * 60_000;
const CROWN_SEEN = 'pc-crowned';

/** Whether the crowning of tournament `id` was shown in this browser. */
function crownSeen(id: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(CROWN_SEEN) ?? '[]') as string[]).includes(id);
  } catch {
    return false;
  }
}

function markCrownSeen(id: string) {
  try {
    const seen = (JSON.parse(localStorage.getItem(CROWN_SEEN) ?? '[]') as string[]).filter((x) => x !== id);
    localStorage.setItem(CROWN_SEEN, JSON.stringify([...seen, id].slice(-30)));
  } catch {
    // no storage: it may show again
  }
}

/**
 * A gang war's story: who won (or that a playoff decides it), each round's boards with their
 * results, and the playoff's games between the two gangs' best players.
 */
export function WarBoards({ v }: { v: TournamentView }) {
  const { t } = useI18n();
  const war = v.war!;
  const byId = new Map(v.standings.map((p) => [p.userId, p]));
  const name = (id: string) => byId.get(id)?.username ?? '?';
  const tag = (id: string) => war.tags[war.players.find((p) => p.id === id)?.side ?? 'c'];
  const score = warScore(war, Object.fromEntries(v.standings.map((p) => [p.userId, p])));
  const winner = warWinner(score, v.playoff);
  const rounds = Array.from({ length: Math.min(v.rounds ?? 1, Math.max(v.round, 1)) }, (_, r) => r);
  // A board's result: the game in White's sheet for that round.
  const board = (w: string, r: number) => byId.get(w)?.sheet[r] ?? null;
  const resultText = (res: 'w' | 'd' | 'l' | 'b' | null | undefined) =>
    res === 'w' ? '1 – 0' : res === 'l' ? '0 – 1' : res === 'd' ? '½ – ½' : '…';
  const player = (id: string) => (
    <span className="tz-war-player">
      <span className="tz-side">[{tag(id)}]</span>
      <ProfileLink username={name(id)}>{name(id)}</ProfileLink>
    </span>
  );
  return (
    <section className="tz-war-boards">
      {v.status === 'finished' && (
        <p className={`tz-war-result${winner ? ' won' : ''}`}>
          {winner
            ? t(v.playoff && playoffWinner(v.playoff) ? 'war.wonPlayoff' : 'war.won', { tag: war.tags[winner] })
            : t('war.tied')}
        </p>
      )}
      {rounds.map((r) => (
        <div key={r} className="tz-war-round">
          <h3>{t('war.round', { n: String(r + 1) })}</h3>
          <ol>
            {warPairs(war, r).map(([w, b], i) => {
              const s = board(w, r);
              return (
                <li key={`${r}-${i}`}>
                  <span className="tz-war-board">{t('war.board', { n: String(i + 1) })}</span>
                  {player(w)}
                  {s?.gameId ? (
                    <a className="tz-war-score" href={`/${s.gameId}`}>
                      {resultText(s.r)}
                    </a>
                  ) : (
                    <span className="tz-war-score">{resultText(s?.r ?? null)}</span>
                  )}
                  {player(b)}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
      {v.playoff && (
        <div className="tz-war-round playoff">
          <h3>{t('war.playoff')}</h3>
          <p className="muted">{t('war.playoffNote')}</p>
          <ol>
            {v.playoff.games.map((g, i) => {
              const [w, b] = g.white === 'c' ? [v.playoff!.c, v.playoff!.d] : [v.playoff!.d, v.playoff!.c];
              // The result as White's: the challengers' result turned round when they had Black.
              const r = g.r === null ? null : g.white === 'c' ? g.r : g.r === 'w' ? 'l' : g.r === 'l' ? 'w' : 'd';
              return (
                <li key={g.gameId}>
                  <span className="tz-war-board">
                    {g.armageddon ? t('war.armageddon') : t('war.playoffGame', { n: String(i + 1) })}
                  </span>
                  {player(w)}
                  <a className="tz-war-score" href={`/${g.gameId}`}>
                    {resultText(r)}
                    {g.armageddon && r === 'd' && <small className="tz-war-note">{t('war.armageddonDraw')}</small>}
                  </a>
                  {player(b)}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}

const Flame = () => (
  <svg className="tz-flame" viewBox="0 0 24 28" aria-hidden="true">
    <path d="M12 2c1 5 6 7 6 14a6 6 0 0 1-12 0c0-3 1.5-5 3-6.5 0 2.5 1 4 2.5 4.5C11 10 10 6 12 2z" />
  </svg>
);

/**
 * The tournament's name as a ransom note: each letter cut from something
 * else (seven looks in turn), spaces kept as gaps. Read out as the plain name.
 */
function RansomTitle({ text }: { text: string }) {
  // Words stay whole when the line breaks.
  const words = text.toLocaleUpperCase('tr').split(/\s+/).filter(Boolean);
  let n = 0;
  return (
    <h1 className="tz-ransom" aria-label={text}>
      {words.map((word, w) => (
        <span key={w} className="tz-word" aria-hidden="true">
          {[...word].map((ch, i) => (
            <span key={i} className={`tz-cut c${n++ % 7}`}>
              {ch}
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}
