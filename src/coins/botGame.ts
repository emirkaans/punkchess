// Checking a won bot game before it is paid (server/coins.ts): bot games are played in the
// browser, so the server replays what it is sent. Pure.

import { COIN_RULES } from './rules.ts';
import { createGame, getVariant, playSan, toFen } from '../engine/index.ts';

/**
 * A bot game the browser says the player won, checked: it starts from the variant's own start
 * position (setup answers may differ, the pieces may not), every move is legal, it is long
 * enough, and it ends in checkmate by the player.
 */
export function wonBotGame(body: {
  variantId?: unknown;
  startFen?: unknown;
  moves?: unknown;
  color?: unknown;
}): boolean {
  const { variantId, startFen, moves, color } = body;
  if (typeof variantId !== 'string' || typeof startFen !== 'string') return false;
  if (color !== 'w' && color !== 'b') return false;
  if (!Array.isArray(moves) || moves.length < COIN_RULES.bot.minPlies || moves.length > 1000) return false;
  if (!moves.every((m) => typeof m === 'string' && m.length <= 20)) return false;
  try {
    const v = getVariant(variantId);
    const usual = toFen(v, createGame(v).position).split(' ').slice(0, 2).join(' ');
    if (startFen.split(' ').slice(0, 2).join(' ') !== usual) return false;
    let game = createGame(v, startFen);
    for (const san of moves as string[]) game = playSan(v, game, san);
    return game.result?.reason === 'checkmate' && game.result.winner === color;
  } catch {
    return false;
  }
}
