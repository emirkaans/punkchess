import { useEffect, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import { timeControl } from '../clock/clock.ts';
import { getVariant, listVariants } from '../engine/index.ts';
import type { MessageKey } from '../i18n/index.ts';
import type { ProfileRating } from '../online/profile.ts';
import { ACTIVITY_DAYS } from '../online/profileStats.ts';
import type { OpeningLine, Outcome, ProfileStats as Stats } from '../online/profileStats.ts';
import { variantOfCategory } from '../rating/categories.ts';
import { useI18n } from './i18n.tsx';

interface Props {
  username: string;
  ratings: readonly ProfileRating[];
  /** Opens a site path (a game, a profile). */
  onOpen: (path: string) => void;
}

const LETTER: Record<Outcome, MessageKey> = { w: 'pstats.win1', d: 'pstats.draw1', l: 'pstats.loss1' };
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

/**
 * The profile's statistics (GET /api/users/:name/stats): form and streaks, results per
 * variant, how games end, openings, speeds, records and activity. Nothing before the first game.
 */
export function ProfileStats({ username, ratings, onOpen }: Props) {
  const { t, vt } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [side, setSide] = useState<'w' | 'b'>('w');
  useEffect(() => {
    let live = true;
    setStats(null);
    void fetch(`/api/users/${encodeURIComponent(username)}/stats`)
      .then((r) => (r.ok ? (r.json() as Promise<Stats>) : null))
      .then((s) => live && setStats(s))
      .catch(() => live && setStats(null));
    return () => {
      live = false;
    };
  }, [username]);
  if (!stats || stats.games === 0) return null;

  const { form, style, records, activity } = stats;
  // A variant's rating: its own category, or for standard chess the best of its speeds.
  const ratingOf = (variantId: string) => {
    const own = ratings.filter((r) => (variantOfCategory(r.category as never) ?? listVariants()[0].id) === variantId);
    const best = own.sort((a, b) => b.games - a.games)[0];
    return best ? `${best.rating}${best.provisional ? '?' : ''}` : '—';
  };
  const bar = (w: number, d: number, l: number) => (
    <span className="pstats-bar" aria-hidden="true">
      <span className="win" style={{ flexGrow: w }} />
      <span className="draw" style={{ flexGrow: d }} />
      <span className="loss" style={{ flexGrow: l }} />
    </span>
  );
  const openings: readonly OpeningLine[] = stats.openings[side];
  const topSpeed = [...stats.speeds].sort((a, b) => b.games - a.games)[0];
  const maxSpeed = Math.max(1, ...stats.speeds.map((s) => s.games));
  const maxDay = Math.max(1, ...activity.days);
  const activeGames = activity.days.reduce((a, b) => a + b, 0);
  const wins = Math.max(1, style.wins);
  const open = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    onOpen(`/${id}`);
  };
  // Days run from the oldest on the left; the grid fills columns of 7, Monday first.
  const lead = (new Date(Date.now() - (ACTIVITY_DAYS - 1) * 86_400_000).getUTCDay() + 6) % 7;

  return (
    <div className="pstats">
      <section className="pstats-card pstats-form" aria-label={t('pstats.form')}>
        <h2>{t('pstats.form')}</h2>
        {form.unbeaten >= 3 && (
          <p className="pstats-sticker">
            {t(form.winStreak === form.unbeaten ? 'pstats.winRun' : 'pstats.unbeatenRun', { n: String(form.unbeaten) })}
          </p>
        )}
        <ol className="pstats-last" aria-label={t('pstats.last10')}>
          {form.last.map((g) => (
            <li key={g.id}>
              <a href={`/${g.id}`} className={`pstats-res ${g.outcome}`} onClick={open(g.id)}>
                {t(LETTER[g.outcome])}
              </a>
            </li>
          ))}
        </ol>
        <div className="pstats-nums">
          <span>
            <b>{form.winStreak}</b>
            {t('pstats.winStreak')}
          </span>
          <span>
            <b>{form.bestWinStreak}</b>
            {t('pstats.bestWinStreak')}
          </span>
          <span>
            <b>{t('pstats.pct', { p: String(form.score10) })}</b>
            {t('pstats.score10')}
          </span>
        </div>
      </section>

      <section className="pstats-card" aria-label={t('pstats.variants')}>
        <h2>{t('pstats.variants')}</h2>
        <ul className="pstats-rows">
          {stats.variants.map((v) => (
            <li key={v.variantId} className="pstats-variant">
              <span className="pstats-vname">{vt(getVariant(v.variantId)).name}</span>
              <span className="pstats-meta">
                {bar(v.w, v.d, v.l)}
                <small>
                  {t('pstats.gamesWin', { n: String(v.games), p: String(pct(v.w, v.games)) })} · {v.w} / {v.d} / {v.l}
                </small>
              </span>
              <span className="pstats-rating">{ratingOf(v.variantId)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="pstats-card" aria-label={t('pstats.style')}>
        <h2>{t('pstats.style')}</h2>
        {style.wins > 0 && (
          <>
            <p className="pstats-label">{t('pstats.winsBy')}</p>
            <div className="pstats-ends">
              {(['checkmate', 'resign', 'timeout', 'other'] as const)
                .filter((k) => style.winsBy[k] > 0)
                .map((k) => (
                  <span key={k} className={`end-${k}`} style={{ flexGrow: style.winsBy[k] } as CSSProperties}>
                    {t(`pstats.end.${k}`)} {t('pstats.pct', { p: String(pct(style.winsBy[k], wins)) })}
                  </span>
                ))}
            </div>
          </>
        )}
        <div className="pstats-colors">
          {(['white', 'black'] as const).map((c) => (
            <div key={c}>
              <small>{t(c === 'white' ? 'pstats.asWhite' : 'pstats.asBlack')}</small>
              <b>{t('pstats.pct', { p: String(pct(style[c].wins, style[c].games)) })}</b>
              <span className={`pstats-meter ${c}`}>
                <span style={{ width: `${pct(style[c].wins, style[c].games)}%` }} />
              </span>
            </div>
          ))}
        </div>
        <div className="pstats-nums">
          <span>
            <b>{style.avgMoves}</b>
            {t('pstats.avgMoves')}
          </span>
          <span>
            <b>{t('pstats.pct', { p: String(pct(style.draws, stats.games)) })}</b>
            {t('pstats.draws')}
          </span>
          <span>
            <b>{t('pstats.pct', { p: String(pct(style.lostOnTime, stats.games)) })}</b>
            {t('pstats.lostOnTime')}
          </span>
        </div>
      </section>

      {(stats.openings.w.length > 0 || stats.openings.b.length > 0) && (
        <section className="pstats-card" aria-label={t('pstats.openings')}>
          <div className="pstats-head">
            <h2>{t('pstats.openings')}</h2>
            <div className="pstats-tabs" role="group">
              {(['w', 'b'] as const).map((s) => (
                <button key={s} className={side === s ? 'on' : ''} aria-pressed={side === s} onClick={() => setSide(s)}>
                  {t(s === 'w' ? 'pstats.withWhite' : 'pstats.withBlack')}
                </button>
              ))}
            </div>
          </div>
          {openings.length === 0 ? (
            <p className="muted">{t('pstats.noOpenings')}</p>
          ) : (
            <ul className="pstats-rows">
              {openings.map((o) => (
                <li key={o.id} className="pstats-opening">
                  <span>
                    <b>{t(`opening.${o.id}` as MessageKey)}</b>
                    <small>
                      {o.moves} · {t('pstats.games', { n: String(o.games) })}
                    </small>
                  </span>
                  <span className="pstats-meta">
                    {bar(o.w, o.d, o.l)}
                    <small>{t('pstats.winPct', { p: String(pct(o.w, o.games)) })}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="pstats-card" aria-label={t('pstats.speeds')}>
        <h2>{t('pstats.speeds')}</h2>
        {topSpeed.games > 0 && (
          <p className="pstats-sticker pink">
            {t('pstats.mostlyPlays', { speed: t(`rating.${topSpeed.speed}` as MessageKey) })}
          </p>
        )}
        <ul className="pstats-rows">
          {stats.speeds.map((s) => (
            <li key={s.speed} className="pstats-speed">
              <span className="pstats-vname">{t(`rating.${s.speed}` as MessageKey)}</span>
              <span className="pstats-track">
                <span className={`speed-${s.speed}`} style={{ width: `${pct(s.games, maxSpeed)}%` }} />
              </span>
              <small>{t('pstats.games', { n: String(s.games) })}</small>
            </li>
          ))}
        </ul>
      </section>

      <section className="pstats-card" aria-label={t('pstats.records')}>
        <h2>{t('pstats.records')}</h2>
        <div className="pstats-records">
          {records.fastestMate && (
            <a
              href={`/${records.fastestMate.id}`}
              className="pstats-record pink"
              onClick={open(records.fastestMate.id)}
            >
              <small>{t('pstats.fastestMate')}</small>
              <b>{t('pstats.moves', { n: String(records.fastestMate.moves) })}</b>
              <span>
                {records.fastestMate.opponent} · {timeControl(records.fastestMate.timeControlId).label}
              </span>
            </a>
          )}
          {records.bestWin && (
            <a href={`/${records.bestWin.id}`} className="pstats-record lime" onClick={open(records.bestWin.id)}>
              <small>{t('pstats.bestWin')}</small>
              <b>{records.bestWin.rating}</b>
              <span>
                {records.bestWin.opponent} · {timeControl(records.bestWin.timeControlId).label}
              </span>
            </a>
          )}
          {records.longest && (
            <a href={`/${records.longest.id}`} className="pstats-record cream" onClick={open(records.longest.id)}>
              <small>{t('pstats.longest')}</small>
              <b>{t('pstats.moves', { n: String(records.longest.moves) })}</b>
              <span>
                {records.longest.opponent} · {t(LETTER[records.longest.outcome])}
              </span>
            </a>
          )}
          {records.nemesis && (
            <a
              href={`/@/${records.nemesis.username}`}
              className="pstats-record nemesis"
              onClick={(e) => {
                e.preventDefault();
                onOpen(`/@/${records.nemesis!.username}`);
              }}
            >
              <small>{t('pstats.nemesis')}</small>
              <b>@{records.nemesis.username}</b>
              <span>{t('pstats.nemesisScore', { w: String(records.nemesis.w), l: String(records.nemesis.l) })}</span>
            </a>
          )}
        </div>
      </section>

      <section className="pstats-card" aria-label={t('pstats.activity')}>
        <div className="pstats-head">
          <h2>{t('pstats.activity')}</h2>
          <small className="muted">{t('pstats.activityTotal', { n: String(activeGames) })}</small>
        </div>
        <div className="pstats-days" role="img" aria-label={t('pstats.activityTotal', { n: String(activeGames) })}>
          {Array.from({ length: lead }, (_, i) => (
            <span key={`pad-${i}`} className="pad" />
          ))}
          {activity.days.map((n, i) => (
            <span key={i} className={`lv${n === 0 ? 0 : Math.min(4, Math.ceil((n / maxDay) * 4))}`} />
          ))}
        </div>
        <p className="pstats-label">{t('pstats.dayStreak', { n: String(activity.bestDayStreak) })}</p>
      </section>
    </div>
  );
}
