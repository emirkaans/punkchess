import type { MoveMark } from '../ai/analysis.ts';
import type { GameState } from '../engine/index.ts';
import { useI18n } from './i18n.tsx';

interface Props {
  /** Latest state of the timeline (holds every played move). */
  game: GameState;
  /** Number of moves currently shown on the board. */
  cursor: number;
  onSelect: (cursor: number) => void;
  /** Analysis marks per move (blunder "??", mistake "?"). */
  marks?: readonly MoveMark[];
  /** Moves whose card target is a secret here (a hidden mine): their squares show as "?". */
  secret?: ReadonlySet<number>;
}

export function MoveList({ game, cursor, onSelect, marks = [], secret }: Props) {
  const { t } = useI18n();
  // Number moves from the first state's move number and side.
  let first: GameState = game;
  while (first.previous) first = first.previous;
  const startNumber = first.position.fullmove;
  const blackFirst = first.position.turn === 'b';

  const rows: { n: number; cells: ({ san: string; index: number; outcome: '+' | '-' | null } | null)[] }[] = [];
  game.moves.forEach((m, i) => {
    const ply = i + (blackFirst ? 1 : 0);
    const n = startNumber + Math.floor(ply / 2);
    if (ply % 2 === 0 || rows.length === 0) rows.push({ n, cells: ply % 2 === 0 ? [] : [null] });
    const san = secret?.has(i) ? m.san.replace(/@.*$/, '@?') : m.san;
    rows[rows.length - 1].cells.push({ san, index: i, outcome: m.move.card?.outcome ?? null });
  });

  if (!rows.length) return <p className="muted">{t('moves.none')}</p>;

  return (
    <ol className="moves">
      {rows.map((row) => (
        <li key={row.n}>
          <span className="num">{row.n}.</span>
          {row.cells.map((c, j) =>
            c ? (
              <button
                key={j}
                className={[c.index === cursor - 1 ? 'mv current' : 'mv', marks[c.index] ?? ''].join(' ')}
                onClick={() => onSelect(c.index + 1)}
              >
                {c.san}
                {marks[c.index] === 'blunder' ? '??' : marks[c.index] === 'mistake' ? '?' : ''}
                {/* A chaos card: hit or backfire, kept for anyone reading the game later. */}
                {c.outcome && (
                  <span className={`mv-card ${c.outcome === '+' ? 'hit' : 'backfire'}`}>
                    {t(c.outcome === '+' ? 'card.hitShort' : 'card.backfireShort')}
                  </span>
                )}
              </button>
            ) : (
              <span key={j} className="mv">
                …
              </span>
            ),
          )}
        </li>
      ))}
    </ol>
  );
}
