import { useEffect, useState } from 'react';
import { timeControl } from '../../clock/clock.ts';
import { createGame, getVariant, listVariants, playSan } from '../../engine/index.ts';
import type { GameState } from '../../engine/index.ts';
import type { LiveGame, LiveList } from '../../online/lobby.ts';
import type { GameInfo } from '../../online/record.ts';
import { useI18n } from '../i18n.tsx';
import { MiniBoard } from '../ProfileGames.tsx';
import { loadCurrent } from './current.ts';

// The lobby's "Playing now" tab (like Lichess's): the games under way as small boards, the
// player's own game first, a click away from watching (or getting back to) any of them.

const LIST_MS = 15_000;
const BOARD_MS = 15_000;
/** Boards shown at once: each is asked for its moves every few seconds. */
const SHOWN = 6;

/** The games under way, asked every few seconds while `on` (the count is kept for the tab). */
export function useLiveList(on: boolean): LiveList | null {
  const [list, setList] = useState<LiveList | null>(null);
  useEffect(() => {
    let stop = false;
    const ask = () =>
      fetch('/api/live')
        .then((r) => (r.ok ? (r.json() as Promise<LiveList>) : null))
        .then((d) => !stop && d && setList(d))
        .catch(() => undefined);
    // Once for the tab's count; then, only while the tab is open, again every few seconds.
    void ask();
    const id = on ? setInterval(() => document.visibilityState === 'visible' && void ask(), LIST_MS) : undefined;
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [on]);
  return list;
}

/** A game's position now, from its moves, asked every few seconds (null until known or if unreadable). */
function useLivePosition(id: string): GameState | null {
  const [state, setState] = useState<GameState | null>(null);
  useEffect(() => {
    let stop = false;
    const ask = async () => {
      const info = (await fetch(`/api/games/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)) as Extract<GameInfo, { kind: 'online' }> | null;
      const record = info?.record;
      if (stop || !record) return;
      // Over: its last position stays, no more asking.
      if (info.phase !== 'playing') clearInterval(timer);
      try {
        const v = getVariant(record.variantId);
        setState(playSan(v, createGame(v, record.startFen || undefined), ...record.moves));
      } catch {
        // a move this replay cannot read: keep the last position shown
      }
    };
    void ask();
    const timer = setInterval(() => document.visibilityState === 'visible' && void ask(), BOARD_MS);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [id]);
  return state;
}

function LiveCard({ game, mine, onOpen }: { game: LiveGame; mine: boolean; onOpen: (id: string) => void }) {
  const { t, vt } = useI18n();
  const state = useLivePosition(game.id);
  const variant = listVariants().find((v) => v.id === game.variantId) ?? listVariants()[0];
  const tc = timeControl(game.timeControlId);
  return (
    <li className={`live-game${mine ? ' mine' : ''}`}>
      <a
        href={`/${game.id}`}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          onOpen(game.id);
        }}
      >
        <span className="live-board">
          {state ? (
            <MiniBoard variant={variant} state={state} flipped={false} />
          ) : (
            <span className="mini-board empty" />
          )}
        </span>
        <span className="live-names">
          <b>{game.white}</b>
          <span>–</span>
          <b>{game.black}</b>
        </span>
        <small>
          {mine ? `${t('lobby.live.yours')} · ` : ''}
          {vt(variant).name} · {tc.initialMs === null ? t('time.none') : tc.label}
        </small>
      </a>
    </li>
  );
}

/** The tab's content: the boards, the player's own game first. */
export function LiveGames({ list, onOpen }: { list: LiveList | null; onOpen: (id: string) => void }) {
  const { t } = useI18n();
  const mineId = loadCurrent()?.gameId ?? null;
  if (!list) return <p className="muted seek-empty">…</p>;
  if (list.games.length === 0) return <p className="muted seek-empty">{t('lobby.live.none')}</p>;
  const games = [...list.games].sort((a, b) => Number(b.id === mineId) - Number(a.id === mineId)).slice(0, SHOWN);
  return (
    <div className="lobby-panel">
      <div className="lobby-scroll">
        <ul className="live-games">
          {games.map((g) => (
            <LiveCard key={g.id} game={g} mine={g.id === mineId} onOpen={onOpen} />
          ))}
        </ul>
        {list.total > games.length && (
          <p className="muted live-more">{t('lobby.live.more', { n: String(list.total - games.length) })}</p>
        )}
      </div>
    </div>
  );
}
