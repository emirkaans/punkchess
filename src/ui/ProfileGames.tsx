import { useEffect, useMemo, useRef } from 'react';
import type { MouseEvent } from 'react';
import { timeControl } from '../clock/clock.ts';
import { createGame, getVariant, listVariants, playSan } from '../engine/index.ts';
import type { GameState, VariantDefinition } from '../engine/index.ts';
import type { MessageKey } from '../i18n/index.ts';
import { outcomeFor } from '../online/profile.ts';
import type { ProfileGame } from '../online/profile.ts';
import { numbered, openingOf } from '../online/profileStats.ts';
import { speedOf } from '../rating/categories.ts';
import { useI18n } from './i18n.tsx';
import { PieceView } from './PieceView.tsx';

interface Props {
  /** The profile's player. */
  username: string;
  games: readonly ProfileGame[];
  /** Older games are left to load, and they are being loaded now. */
  more: boolean;
  loading: boolean;
  onMore: () => void;
  onOpen: (path: string) => void;
}

const ENDS = ['checkmate', 'resign', 'timeout', 'agreement', 'stalemate', 'abandon'];

/** The game's last position (null if its moves cannot be replayed). */
function finalState(variant: VariantDefinition, game: ProfileGame): GameState | null {
  try {
    return playSan(variant, createGame(variant, game.startFen || undefined), ...game.moves);
  } catch {
    return null;
  }
}

/** The finished game's last position, small, from the profile player's side, its last move marked. */
function MiniBoard({ variant, state, flipped }: { variant: VariantDefinition; state: GameState; flipped: boolean }) {
  const last = state.moves.at(-1)?.move;
  const squares: number[] = [];
  for (let r = 7; r >= 0; r--) for (let f = 0; f < 8; f++) squares.push(r * 8 + f);
  if (flipped) squares.reverse();
  return (
    <span className="mini-board" aria-hidden="true">
      {squares.map((sq) => {
        const piece = state.position.board[sq];
        const light = (Math.floor(sq / 8) + (sq % 8)) % 2 === 1;
        const lit = last && (last.from === sq || last.to === sq);
        return (
          <span key={sq} className={`mini-sq ${light ? 'light' : 'dark'}${lit ? ' last' : ''}`}>
            {piece && <PieceView variant={variant} piece={piece} />}
          </span>
        );
      })}
    </span>
  );
}

/** The profile's "Games" tab: finished games as cards (board, players, result, opening). */
export function ProfileGames({ username, games, more, loading, onMore, onOpen }: Props) {
  const { t, vt, locale } = useI18n();
  const ago = useMemo(() => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }), [locale]);
  const when = (ms: number) => {
    const minutes = Math.round((ms - Date.now()) / 60_000);
    if (Math.abs(minutes) < 60) return ago.format(minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 48) return ago.format(hours, 'hour');
    const days = Math.round(hours / 24);
    if (Math.abs(days) < 60) return ago.format(days, 'day');
    return new Date(ms).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  };
  const link = (path: string) => (e: MouseEvent) => {
    e.preventDefault();
    onOpen(path);
  };

  // Lichess-style: nearing the end of the list loads the next older games.
  const end = useRef<HTMLDivElement>(null);
  const loadNext = useRef(onMore);
  useEffect(() => {
    loadNext.current = onMore;
  });
  useEffect(() => {
    const el = end.current;
    if (!el || !more || typeof IntersectionObserver === 'undefined') return;
    const seen = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadNext.current(), {
      rootMargin: '600px 0px',
    });
    seen.observe(el);
    return () => seen.disconnect();
  }, [more, games.length]);
  const standardId = listVariants()[0].id;
  if (games.length === 0) return <p className="muted">{t('profile.noGames')}</p>;
  return (
    <>
      <ul className="pgames">
        {games.map((g) => {
          const variant = getVariant(g.variantId);
          const state = finalState(variant, g);
          const outcome = outcomeFor(g);
          const tc = timeControl(g.timeControlId);
          const speed = speedOf(g.timeControlId);
          const me = { name: username, account: username, rating: g.rating, diff: g.diff };
          const them = {
            name: g.opponent,
            account: g.opponentUsername,
            rating: g.opponentRating,
            diff: g.diff === null ? null : -g.diff,
          };
          const [white, black] = g.color === 'w' ? [me, them] : [them, me];
          const end = ENDS.includes(g.termination) ? g.termination : 'other';
          const winner = g.result === '1-0' ? 'pgame.whiteWon' : g.result === '0-1' ? 'pgame.blackWon' : 'pgame.drawn';
          const opening = g.variantId === standardId ? openingOf(g.moves) : null;
          const fullMoves = Math.ceil(g.moves.length / 2);
          return (
            <li key={g.id} className={`pgame ${outcome}`}>
              <a
                href={`/${g.id}/analysis`}
                className="pgame-board"
                onClick={link(`/${g.id}/analysis`)}
                aria-label={t('pgame.open')}
              >
                {state ? (
                  <MiniBoard variant={variant} state={state} flipped={g.color === 'b'} />
                ) : (
                  <span className="mini-board empty" />
                )}
              </a>
              <div className="pgame-body">
                <div className="pgame-head">
                  <span>
                    {tc.initialMs === null ? t('time.none') : tc.label}
                    {speed ? ` · ${t(`rating.${speed}` as MessageKey)}` : ''}
                    {variant.id !== standardId ? ` · ${vt(variant).name}` : ''}
                    {g.rated ? ` · ${t('lobby.rated')}` : ''}
                  </span>
                  <small>{when(g.endedAt)}</small>
                </div>
                <div className="pgame-players">
                  {[white, black].map((p, i) => (
                    <span key={i} className={`pgame-player ${i === 0 ? 'w' : 'b'}`}>
                      <span className={`seek-color ${i === 0 ? 'w' : 'b'}`} aria-hidden="true" />
                      {p.account ? (
                        <a href={`/@/${p.account}`} onClick={link(`/@/${p.account}`)}>
                          {p.name}
                        </a>
                      ) : (
                        <span>{p.name}</span>
                      )}
                      {p.rating !== null && <small>{p.rating}</small>}
                      {p.diff !== null && (
                        <small className={p.diff >= 0 ? 'up' : 'down'}>
                          {p.diff >= 0 ? '+' : ''}
                          {p.diff}
                        </small>
                      )}
                    </span>
                  ))}
                </div>
                <p className={`pgame-result ${outcome}`}>
                  <span className="pgame-tape">{t(`profile.${outcome}`)}</span>
                  {t(`pgame.end.${end}` as MessageKey)} · {t(winner)}
                </p>
                {g.moves.length > 0 && (
                  <p className="pgame-opening">
                    {opening && <b>{t(`opening.${opening.id}` as MessageKey)}</b>}
                    <span>
                      {numbered(g.moves.slice(0, 6))}
                      {g.moves.length > 6 ? ' …' : ''} · {t('pstats.moves', { n: String(fullMoves) })}
                    </span>
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {more && (
        <div ref={end} className="pgames-end">
          {loading ? (
            <span className="muted">{t('profile.loadingMore')}</span>
          ) : (
            <button className="profile-more" onClick={onMore}>
              {t('profile.more')}
            </button>
          )}
        </div>
      )}
    </>
  );
}
