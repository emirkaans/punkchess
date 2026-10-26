// The online game this browser is playing right now, so a player who leaves its
// page can get back: the "back to the game" pill in the top bar, a question
// before leaving the board, and the game reopened when the site is opened again.

import { useEffect, useState } from 'react';
import type { Color } from '../../engine/index.ts';
import type { GameInfo, LiveInfo } from '../../online/record.ts';
import { loadJSON, saveJSON } from '../../storage/local.ts';

const KEY = 'online:current';
const CHANGED = 'punkchess:current-game';

export interface CurrentGame {
  readonly gameId: string;
  /** The side this browser plays. */
  readonly you: Color;
}

export const loadCurrent = (): CurrentGame | null => loadJSON<CurrentGame | null>(KEY, null);

/** Marks (or, with null, forgets) the game being played; other parts of the page hear about it. */
export function saveCurrent(game: CurrentGame | null): void {
  const was = loadCurrent();
  if (was?.gameId === game?.gameId && was?.you === game?.you) return;
  saveJSON(KEY, game);
  window.dispatchEvent(new Event(CHANGED));
}

/** Forgets the game, but only if it is still the one remembered. */
export function clearCurrent(gameId: string): void {
  if (loadCurrent()?.gameId === gameId) saveCurrent(null);
}

/** The remembered game, kept up to date (this tab and the others). */
function useStoredCurrent(): CurrentGame | null {
  const [game, setGame] = useState(loadCurrent);
  useEffect(() => {
    const update = () => setGame(loadCurrent());
    window.addEventListener(CHANGED, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(CHANGED, update);
      window.removeEventListener('storage', update);
    };
  }, []);
  return game;
}

export interface LiveGame extends CurrentGame {
  readonly live: LiveInfo;
  /** When `live` was received (the running clock counts down from there). */
  readonly at: number;
}

const POLL_MS = 5000;

/**
 * The game under way, with whose move it is and the clocks, asked from the server every few
 * seconds while the player is somewhere else (`openGameId`: the game page open now; the game's
 * own page knows all this already). A game that is over is forgotten.
 */
export function useLiveGame(openGameId: string | null): LiveGame | null {
  const game = useStoredCurrent();
  const onItsPage = !!game && game.gameId === openGameId;
  const [live, setLive] = useState<LiveGame | null>(null);
  useEffect(() => {
    if (!game || onItsPage) return setLive(null);
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ask = async () => {
      // A network failure keeps what is known; a game that is gone or over is forgotten.
      const info = (await fetch(`/api/games/${game.gameId}`)
        .then((r) => (r.ok || r.status === 404 ? r.json() : null))
        .catch(() => null)) as GameInfo | { error: string } | null;
      if (stop) return;
      if (info) {
        if (!('kind' in info) || info.kind !== 'online' || info.phase !== 'playing') return clearCurrent(game.gameId);
        if (info.live) setLive({ ...game, live: info.live, at: Date.now() });
      }
      timer = setTimeout(() => void ask(), POLL_MS);
    };
    void ask();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [game, onItsPage]);
  return live;
}

/** Time left on this player's clock now (null: no clock). */
export function yourTime(game: LiveGame, now: number): number | null {
  const c = game.live.clock;
  if (!c) return null;
  const left = c[game.you];
  return c.running === game.you ? Math.max(0, left - (now - game.at)) : left;
}
