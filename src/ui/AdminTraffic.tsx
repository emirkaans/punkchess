import { useEffect, useState } from 'react';
import { TRAFFIC_RANGES } from '../online/traffic.ts';
import type { Count, TrafficRange, TrafficStats } from '../online/traffic.ts';
import { useI18n } from './i18n.tsx';

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (n: number) => n.toLocaleString('tr-TR');

/** One bar per entry, in a row (hours of the day, days); the value shows on hover. */
function Columns({ values, labels, tip }: { values: readonly number[]; labels: readonly string[]; tip: string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="tr-cols" role="img" aria-label={tip}>
      {values.map((v, i) => (
        <div key={i} className="tr-col" data-tip={`${labels[i]} · ${fmt(v)}`}>
          <span className="tr-bar" style={{ height: `${(v / max) * 100}%` }} />
          <span className="tr-x">{labels.length <= 12 || i % 3 === 0 ? labels[i] : ''}</span>
        </div>
      ))}
    </div>
  );
}

/** A value over time as a line with its area (one series); each point shows on hover. */
function Line({ points, label }: { points: readonly { at: number; v: number }[]; label: string }) {
  const { t } = useI18n();
  if (points.length < 2) return <p className="muted tr-empty">{t('admin.traffic.noSamples')}</p>;
  const W = 600;
  const H = 140;
  const max = Math.max(1, ...points.map((p) => p.v));
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - (v / max) * (H - 8);
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const when = (at: number) =>
    new Date(at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' });
  const step = W / points.length;
  return (
    <div className="tr-line">
      <span className="tr-max">{fmt(max)}</span>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
        <line x1="0" y1={H} x2={W} y2={H} className="tr-axis" />
        <polygon points={`0,${H} ${line} ${W},${H}`} className="tr-area" />
        <polyline points={line} className="tr-stroke" />
        {points.map((p, i) => (
          <rect key={p.at} x={x(i) - step / 2} y="0" width={step} height={H} className="tr-hit">
            <title>{`${when(p.at)} · ${fmt(p.v)}`}</title>
          </rect>
        ))}
      </svg>
      <div className="tr-ends">
        <span>{when(points[0].at)}</span>
        <span>{when(points[points.length - 1].at)}</span>
      </div>
    </div>
  );
}

/** A ranked list with bars (pages, countries…). */
function Ranked({ rows, name = (s) => s }: { rows: readonly Count[]; name?: (s: string) => string }) {
  const { t } = useI18n();
  if (rows.length === 0) return <p className="muted tr-empty">{t('admin.traffic.none')}</p>;
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ol className="tr-ranked">
      {rows.map((r) => (
        <li key={r.name}>
          <span className="tr-name">{name(r.name)}</span>
          <span className="tr-track">
            <span className="tr-fill" style={{ width: `${(r.n / max) * 100}%` }} />
          </span>
          <span className="tr-n">{fmt(r.n)}</span>
        </li>
      ))}
    </ol>
  );
}

/** The admin page's analytics: visits, hours, who is on the site, where they come from. */
export function AdminTraffic() {
  const { t, locale } = useI18n();
  const [days, setDays] = useState<TrafficRange>(7);
  const [s, setS] = useState<TrafficStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    void fetch(`/api/admin/traffic?days=${days}`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? (r.json() as Promise<TrafficStats>) : null))
      .then((d) => (d ? setS(d) : setFailed(true)))
      .catch(() => setFailed(true));
  }, [days]);

  const regions = (() => {
    try {
      return new Intl.DisplayNames([locale], { type: 'region' });
    } catch {
      return null;
    }
  })();
  const country = (code: string) => (code === 'T1' ? 'Tor' : (regions?.of(code) ?? code));
  const city = (s: string) => {
    const [c, code] = s.split(', ');
    return code ? `${c}, ${country(code)}` : c;
  };
  const page = (kind: string) => (kind === 'home' ? '/' : `/${kind}`);
  const device = (d: string) => t(`admin.traffic.device.${d as 'phone' | 'tablet' | 'desktop'}`);

  return (
    <section className="tz-section traffic">
      <div className="tr-ranges" role="tablist">
        {TRAFFIC_RANGES.map((d) => (
          <button
            key={d}
            role="tab"
            aria-selected={days === d}
            className={days === d ? 'on' : ''}
            onClick={() => setDays(d)}
          >
            {t(d === 1 ? 'admin.traffic.today' : 'admin.traffic.days', { n: String(d) })}
          </button>
        ))}
      </div>
      {failed && <p className="notice">{t('admin.traffic.error')}</p>}
      {!s ? (
        !failed && <p className="muted">{t('leaders.loading')}</p>
      ) : (
        <>
          <div className="tr-tiles">
            <div className="tr-tile live">
              <span>{t('admin.traffic.onlineNow')}</span>
              <b>{fmt(s.now.online)}</b>
            </div>
            <div className="tr-tile live">
              <span>{t('admin.traffic.gamesNow')}</span>
              <b>{fmt(s.now.games)}</b>
            </div>
            <div className="tr-tile">
              <span>{t('admin.traffic.views')}</span>
              <b>{fmt(s.views)}</b>
            </div>
            <div className="tr-tile">
              <span>{t('admin.traffic.visitors')}</span>
              <b>{fmt(s.visitors)}</b>
            </div>
            <div className="tr-tile">
              <span>{t('admin.traffic.peakOnline')}</span>
              <b>{fmt(s.peakOnline)}</b>
            </div>
            <div className="tr-tile">
              <span>{t('admin.traffic.peakGames')}</span>
              <b>{fmt(s.peakGames)}</b>
            </div>
          </div>
          <div className="tr-grid">
            <figure className="tr-card">
              <figcaption>{t('admin.traffic.byHourViews')}</figcaption>
              <Columns values={s.viewsByHour} labels={HOURS.map(pad)} tip={t('admin.traffic.byHourViews')} />
            </figure>
            <figure className="tr-card">
              <figcaption>{t('admin.traffic.byHourGames')}</figcaption>
              <Columns values={s.gamesByHour} labels={HOURS.map(pad)} tip={t('admin.traffic.byHourGames')} />
            </figure>
            <figure className="tr-card">
              <figcaption>{t('admin.traffic.onlineOverTime')}</figcaption>
              <Line points={s.live.map((p) => ({ at: p.at, v: p.online }))} label={t('admin.traffic.onlineOverTime')} />
            </figure>
            <figure className="tr-card">
              <figcaption>{t('admin.traffic.gamesOverTime')}</figcaption>
              <Line points={s.live.map((p) => ({ at: p.at, v: p.games }))} label={t('admin.traffic.gamesOverTime')} />
            </figure>
            {s.days > 1 && (
              <figure className="tr-card wide">
                <figcaption>{t('admin.traffic.daily')}</figcaption>
                <Columns
                  values={s.daily.map((d) => d.visitors)}
                  labels={s.daily.map((d) => d.day.slice(5).split('-').reverse().join('.'))}
                  tip={t('admin.traffic.daily')}
                />
              </figure>
            )}
            <figure className="tr-card">
              <figcaption>{t('admin.traffic.pages')}</figcaption>
              <Ranked rows={s.pages} name={page} />
            </figure>
            <figure className="tr-card">
              <figcaption>{t('admin.traffic.countries')}</figcaption>
              <Ranked rows={s.countries} name={country} />
            </figure>
            <figure className="tr-card">
              <figcaption>{t('admin.traffic.cities')}</figcaption>
              <Ranked rows={s.cities} name={city} />
            </figure>
            <figure className="tr-card">
              <figcaption>{t('admin.traffic.devices')}</figcaption>
              <Ranked rows={s.devices} name={device} />
              <figcaption className="tr-sub">{t('admin.traffic.referrers')}</figcaption>
              <Ranked rows={s.referrers} />
            </figure>
          </div>
          <p className="muted tr-note">{t('admin.traffic.note')}</p>
        </>
      )}
    </section>
  );
}
