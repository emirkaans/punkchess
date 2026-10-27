// A quick, full-strength evaluation of the shown position for the bar beside a
// bot-against-bot game (and a finished game against the bot): Stockfish for
// standard chess, our engine for the variants, a fraction of a second per
// move so the bots playing keep their time, even in 1+0.

import { useEffect, useState } from 'react';
import { terminalScore, toWhite } from '../../ai/analysis.ts';
import type { WhiteScore } from '../../ai/analysis.ts';
import { BotCancelled } from '../../ai/client.ts';
import { HINT } from '../../ai/levels.ts';
import { AnalysisClient } from '../../ai/stockfish.ts';
import type { GameState, VariantDefinition } from '../../engine/index.ts';

/** Time per position: short, shorter on phones (few cores) and when a bot's clock runs low. */
export function watchEvalMs(opts: { stockfish: boolean; cores: number; lowClock: boolean }): number {
  let ms = opts.stockfish ? 300 : 400;
  if (opts.cores <= 4) ms /= 2;
  if (opts.lowClock) ms /= 3;
  return Math.round(ms);
}

/**
 * The evaluation (White's side) of `state`, null until the first one. A new position cancels the
 * running one and keeps showing the last score meanwhile, so the bar does not jump to the middle.
 */
export function useWatchEval(
  variant: VariantDefinition,
  state: GameState,
  on: boolean,
  lowClock: boolean,
): WhiteScore | null {
  const [client] = useState(() => new AnalysisClient());
  const [score, setScore] = useState<WhiteScore | null>(null);
  useEffect(() => () => client.dispose(), [client]);
  useEffect(() => {
    if (!on) {
      client.stop();
      setScore(null);
      return;
    }
    const terminal = terminalScore(state);
    if (terminal !== null) {
      client.stop();
      setScore(terminal);
      return;
    }
    let current = true;
    const turn = state.position.turn;
    const stockfish = client.usesStockfish(variant.id);
    client
      .think({
        variantId: variant.id,
        state,
        level: HINT.level,
        timeLimitMs: watchEvalMs({ stockfish, cores: navigator.hardwareConcurrency || 2, lowClock }),
        minThinkMs: 0,
        analyse: true,
      })
      .then((r) => current && setScore(toWhite(r.score, turn)))
      .catch((e) => {
        if (!(e instanceof BotCancelled)) console.warn(e);
      });
    return () => {
      current = false;
    };
  }, [client, variant.id, state, on, lowClock]);
  return score;
}
