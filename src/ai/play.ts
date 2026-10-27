// The engine bots play with: Stockfish for standard chess, weakened per level
// (src/ai/levels.ts, like lichess's levels), and our own engine for the
// variants (Stockfish does not know their rules) or wherever Stockfish cannot run.

import { getVariant, legalMoves, listVariants } from '../engine/index.ts';
import { BotCancelled, BotClient } from './client.ts';
import type { ThinkOptions } from './client.ts';
import { MIN_THINK_MS, stockfishLevel, stockfishTimeMs } from './levels.ts';
import { createRng } from './rng.ts';
import type { BotMove } from './search.ts';
import { StockfishClient } from './stockfish.ts';

export class PlayClient {
  private own = new BotClient();
  private sf = new StockfishClient();
  // Each request's number: a stopped or newer request makes an older answer void.
  private ticket = 0;

  /** Whether bots play this variant with Stockfish. */
  usesStockfish(variantId: string): boolean {
    return variantId === listVariants()[0].id && !this.sf.failed && typeof Worker !== 'undefined';
  }

  think(opts: ThinkOptions): Promise<BotMove> {
    const ticket = ++this.ticket;
    if (!this.usesStockfish(opts.variantId)) {
      this.sf.stop();
      return this.own.think(opts);
    }
    this.own.stop();
    const level = stockfishLevel(opts.level);
    const started = Date.now();
    const minThink = opts.minThinkMs ?? MIN_THINK_MS;
    // The answer waits out the least thinking time, unless a newer request or stop() came first.
    const hold = (m: BotMove) =>
      new Promise<BotMove>((resolve, reject) => {
        const settle = () => (ticket === this.ticket ? resolve(m) : reject(new BotCancelled()));
        const wait = minThink - (Date.now() - started);
        if (wait > 0) setTimeout(settle, wait);
        else settle();
      });
    const rng = createRng(opts.seed ?? started);
    if (level.randomMove > 0 && rng.next() < level.randomMove) {
      const moves = legalMoves(getVariant(opts.variantId), opts.state.position);
      if (moves.length > 0) {
        const move = rng.pick(moves);
        return hold({
          move,
          score: 0,
          depth: 0,
          nodes: 0,
          pv: [{ from: move.from, to: move.to, promotion: move.promotion }],
        });
      }
    }
    return this.sf
      .think(
        { ...opts, timeLimitMs: stockfishTimeMs(opts.level, opts.clock) },
        { skill: level.skill, depth: level.depth },
      )
      .then(hold)
      .catch((e: Error) => {
        if (e instanceof BotCancelled || ticket !== this.ticket) throw new BotCancelled();
        // Stockfish could not start, or crashed: our engine plays this move instead.
        return this.own.think(opts);
      });
  }

  stop(): void {
    this.ticket++;
    this.own.stop();
    this.sf.stop();
  }

  dispose(): void {
    this.stop();
    this.own.dispose();
    this.sf.dispose();
  }
}
