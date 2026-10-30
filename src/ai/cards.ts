// The bot's cards (variants with cards, e.g. Anarşi). The search itself knows only piece
// moves; here each card the bot may play is tried and scored with a short search of the
// position after it, against the move the full search chose. A chaos card counts as the
// average of its hit and its backfire.

import { CHAOS, applyMove, isInCheck, legalMoves } from '../engine/index.ts';
import type { GameState, Move, Position, VariantDefinition } from '../engine/index.ts';
import { createRng, randomSeed } from './rng.ts';
import { chooseMove, search } from './search.ts';
import type { BotMove, ChooseOptions } from './search.ts';

const MATE = 100_000;
/** Most cards tried per move (Kara Delik alone can have 40 targets). */
const MAX_TRIED = 24;
/** How much better than the chosen move a card must look, per level (weaker bots play cards on a hunch). */
const MARGIN = [0, 0, 40, 60, 70, 80];

const stateOf = (v: VariantDefinition, position: Position): GameState => ({
  variantId: v.id,
  position,
  history: [],
  moves: [],
  previous: null,
  result: null,
});

/** Score of `after` (the opponent to move) for the side that just moved, from a short search. */
function scoreAfter(v: VariantDefinition, after: Position): number {
  if (!legalMoves(v, after).some((m) => !m.card)) return isInCheck(v, after) ? MATE : 0;
  const r = search(v, stateOf(v, after), {
    maxDepth: 2,
    quiescence: true,
    transpositionTable: false,
    mobility: false,
    timeLimitMs: 60,
    rootExact: { topK: 1, margin: 0 },
  });
  return -r.scores[0].score;
}

/** Picks the bot's move or card; `chaos` is the bot's own chaos card (null if none or unknown). */
export function chooseWithCards(
  v: VariantDefinition,
  state: GameState,
  level: number,
  chaos: string | null,
  opts: ChooseOptions = {},
): BotMove {
  // The bot plays from what it knows: the opponent's hidden mine is left out. Moves legal there
  // are legal in the real position too (a mine never makes a move illegal).
  const pos = v.withoutSecrets?.(state.position, state.position.turn) ?? state.position;
  if (pos !== state.position) state = { ...state, position: pos };
  const legal = legalMoves(v, pos);
  const cards = legal.filter((m) => m.card && (m.card.id !== CHAOS || (chaos && v.cards)));
  const pieceMoves = legal.some((m) => !m.card);
  if (!cards.length) return chooseMove(v, state, level, opts);
  const rng = createRng(opts.seed ?? randomSeed());

  const value = (m: Move): number => {
    if (m.card!.id !== CHAOS) return scoreAfter(v, applyMove(v, pos, m));
    const ways = v.cards!.resolveChaos(pos, chaos!);
    const avg = (ms: Move[]) => ms.reduce((s, x) => s + scoreAfter(v, applyMove(v, pos, x)), 0) / ms.length;
    return (avg(ways['+'].slice(0, 3)) + avg(ways['-'].slice(0, 3))) / 2;
  };

  // Every piece frozen: a card is the only way to go on.
  const base = pieceMoves ? chooseMove(v, state, level, opts) : null;
  const tried = [...cards].sort(() => rng.next() - 0.5).slice(0, MAX_TRIED);
  let best: { move: Move; score: number } | null = null;
  for (const m of tried) {
    const score = value(m);
    if (!best || score > best.score) best = { move: m, score };
  }
  if (!base) return { move: best!.move, score: best!.score, depth: 2, nodes: 0, pv: [] };
  const baseScore = scoreAfter(v, applyMove(v, pos, base.move));
  const margin = MARGIN[Math.max(0, Math.min(MARGIN.length - 1, level))];
  return best && best.score > baseScore + margin
    ? { move: best.move, score: best.score, depth: 2, nodes: base.nodes, pv: [] }
    : base;
}
