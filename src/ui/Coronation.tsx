import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { TournamentView } from '../online/tournament.ts';
import { warScore, warWinner } from '../online/tournament.ts';
import type { MessageKey } from '../i18n/index.ts';
import { useI18n } from './i18n.tsx';
import { loadPrefs } from './prefs.ts';
import { playSound } from './sound.ts';
import { scoreText } from './TournamentsPage.tsx';

// The end of a tournament or a gang war, shown once to whoever is on its page when it ends
// (design C, "Taç Töreni"): in the dark a spotlight comes on, the winner's name (a gang's tag)
// rises, a crown drops onto it and sparks burst; below, the winners and their points. A
// tournament's first three stand on a podium instead (design "Kürsü", neon): the second on the
// left, the champion in the middle, the third on the right, their names in the marker font.

type Outcome = 'win' | 'lose' | 'draw';

interface Crowning {
  readonly outcome: Outcome;
  /** The crowned: a gang's tag or a player's name; two tags when a war ended level. */
  readonly names: readonly string[];
  readonly sub: MessageKey;
  readonly roster: readonly string[];
  /** A tournament's first three (one or two when fewer scored), in order, for the podium. */
  readonly podium: readonly { readonly name: string; readonly points: string }[] | null;
  readonly score: string | null;
  /** Gangs: the viewer's own (back to it) and the winner (a rematch is declared there). */
  readonly myTag: string | null;
  readonly winnerTag: string | null;
}

/** Who is crowned, from the viewer's side. Null: nobody to crown (no points scored). */
export function crowning(v: TournamentView): Crowning | null {
  const pts = (id: string) => v.standings.find((p) => p.userId === id)?.score ?? 0;
  const name = (id: string) => v.standings.find((p) => p.userId === id)?.username ?? '?';
  if (v.war) {
    const war = v.war;
    const score = warScore(war, Object.fromEntries(v.standings.map((p) => [p.userId, p])));
    const winner = warWinner(score, v.playoff);
    const mine = war.players.find((p) => p.id === v.you)?.side ?? null;
    const scoreLine = `[${war.tags.c}] ${scoreText(score.c)} – ${scoreText(score.d)} [${war.tags.d}]`;
    const myTag = mine ? war.tags[mine] : null;
    if (!winner)
      return {
        outcome: 'draw',
        names: [war.tags.c, war.tags.d],
        sub: 'crown.draw',
        roster: [],
        podium: null,
        score: scoreLine,
        myTag,
        winnerTag: null,
      };
    return {
      outcome: mine && mine !== winner ? 'lose' : 'win',
      names: [war.tags[winner]],
      sub: mine && mine !== winner ? 'crown.lost' : 'crown.war',
      roster: war.players.filter((p) => p.side === winner).map((p) => `${name(p.id)} · ${scoreText(pts(p.id))}`),
      podium: null,
      score: scoreLine,
      myTag,
      winnerTag: war.tags[winner],
    };
  }
  const top = v.standings.filter((p) => p.score > 0).slice(0, 3);
  if (!top.length) return null;
  return {
    outcome: 'win',
    names: [top[0].username],
    sub: top[0].userId === v.you ? 'crown.champion' : 'crown.tournament',
    roster: [],
    podium: top.map((p) => ({ name: p.username, points: scoreText(p.score) })),
    score: null,
    myTag: null,
    winnerTag: null,
  };
}

const CROWN = (
  <svg className="crown-crown" viewBox="0 0 64 48" aria-hidden="true">
    <path
      d="M4 42h56M6 38L2 10l16 12 14-20 14 20 16-12-4 28z"
      fill="#c6ff3d"
      stroke="#141016"
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <circle cx="32" cy="6" r="4" fill="#ff2e93" />
  </svg>
);

const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Sparks over the crowning: three bursts, pink, lime and white. */
function useSparks(canvas: RefObject<HTMLCanvasElement | null>, on: boolean) {
  useEffect(() => {
    const cv = canvas.current;
    const ctx = cv?.getContext('2d');
    if (!on || !cv || !ctx || still()) return;
    const dpr = window.devicePixelRatio || 1;
    const W = (cv.width = cv.clientWidth * dpr);
    const H = (cv.height = cv.clientHeight * dpr);
    const cols = ['#ff2e93', '#c6ff3d', '#ffffff'];
    let ps: { x: number; y: number; vx: number; vy: number; life: number; c: string }[] = [];
    const burst = (x: number, y: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = (2 + Math.random() * 6) * dpr;
        ps.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 3, life: 60 + Math.random() * 40, c: cols[i % 3] });
      }
    };
    const t0 = performance.now();
    let fired = 0;
    let raf = 0;
    const step = (t: number) => {
      const e = t - t0;
      if (fired === 0 && e > 1700) {
        burst(W / 2, H * 0.4, 140);
        fired++;
      }
      if (fired === 1 && e > 2100) {
        burst(W * 0.25, H * 0.3, 80);
        burst(W * 0.75, H * 0.3, 80);
        fired++;
      }
      ctx.clearRect(0, 0, W, H);
      ps = ps.filter((p) => p.life > 0);
      for (const p of ps) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12 * dpr;
        p.vx *= 0.99;
        p.life--;
        ctx.globalAlpha = Math.min(1, p.life / 40);
        ctx.fillStyle = p.c;
        ctx.fillRect(p.x, p.y, 3 * dpr, 3 * dpr);
      }
      if (e < 6000) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [canvas, on]);
}

/** The crowning, over the page until closed. */
export function Coronation({
  v,
  onClose,
  onOpen,
}: {
  v: TournamentView;
  onClose: () => void;
  onOpen: (path: string) => void;
}) {
  const { t } = useI18n();
  const c = crowning(v);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  useSparks(canvas, !!c && c.outcome !== 'lose');
  // The fanfare as the crown lands (when sound is on).
  useEffect(() => {
    if (!c || c.outcome === 'lose' || !loadPrefs().sound) return;
    const id = setTimeout(() => playSound('crown'), still() ? 0 : 1100);
    return () => clearTimeout(id);
  }, [c?.outcome]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [onClose]);
  if (!c) return null;
  const go = (path: string) => {
    onClose();
    onOpen(path);
  };
  const tag = (name: string) => (
    <div key={name} className="crown-name">
      {name}
    </div>
  );
  return (
    <div
      className={`crown-show ${c.outcome}${still() ? ' still' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={t(c.sub, { name: c.names[0] })}
    >
      <canvas ref={canvas} aria-hidden="true" />
      <div className="crown-spot" aria-hidden="true" />
      <button className="crown-x" aria-label={t('crown.close')} onClick={onClose}>
        ×
      </button>
      <div className="crown-body">
        {c.podium ? (
          <div className="crown-podium">
            {/* Second, first, third: the podium's order from the left. */}
            {[1, 0, 2].map((i) => {
              const p = c.podium![i];
              if (!p) return <div key={i} className="pod-col" />;
              return (
                <div key={i} className={`pod-col pod-${i + 1}`}>
                  {i === 0 && CROWN}
                  <span className="pod-name">{p.name}</span>
                  <span className="pod-pts">{t('crown.points', { n: p.points })}</span>
                  <span className="pod-block">
                    <b>{i + 1}</b>
                  </span>
                </div>
              );
            })}
          </div>
        ) : c.outcome === 'draw' ? (
          <div className="crown-duo">
            {tag(c.names[0])}
            {CROWN}
            {tag(c.names[1])}
          </div>
        ) : (
          <>
            {CROWN}
            {tag(c.names[0])}
          </>
        )}
        {!c.podium && <div className="crown-sub">{t(c.sub, { name: c.names[0] })}</div>}
        {c.score && <div className="crown-score">{c.score}</div>}
        {c.roster.length > 0 && (
          <div className="crown-roster">
            {c.roster.map((r, i) => (
              <span key={r} style={{ animationDelay: `${2 + i * 0.15}s` }}>
                {r}
              </span>
            ))}
          </div>
        )}
        <div className="crown-btns">
          {c.outcome === 'lose' && c.winnerTag ? (
            <button className="primary" onClick={() => go(`/gang/${c.winnerTag}`)}>
              {t('crown.rematch')}
            </button>
          ) : (
            <button
              className="primary"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(`${location.origin}/tournament/${v.id}`)
                  .then(() => setCopied(true));
              }}
            >
              {copied ? t('gang.copied') : t('crown.share')}
            </button>
          )}
          {c.myTag ? (
            <button onClick={() => go(`/gang/${c.myTag}`)}>{t('crown.toGang')}</button>
          ) : (
            <button onClick={onClose}>{t('crown.close')}</button>
          )}
        </div>
      </div>
    </div>
  );
}
