import { useEffect, useState } from 'react';
import type { Avatar } from '../avatar/avatar.ts';
import type { Outfit } from '../avatar/outfit.ts';
import type { Color } from '../engine/index.ts';
import { useI18n } from './i18n.tsx';
import { PosedFigure } from './PosedFigure.tsx';

export interface FinaleSide {
  readonly color: Color;
  readonly name: string;
  /** The player's character; a side without one is left out. */
  readonly avatar: Avatar | null | undefined;
  readonly outfit: Outfit | null | undefined;
  /** How they take the result (src/avatar/poses.ts endPose). */
  readonly pose: string;
}

/**
 * After the game (and after the board's own "MATE!" and spray tag, `delayMs`): the players'
 * characters in full over the whole board, the winner celebrating, the loser taking it badly.
 * The ✕ puts it away, and the board is there for analysis.
 */
export function GameFinale({
  sides,
  winner,
  delayMs,
}: {
  sides: readonly FinaleSide[];
  winner: Color | null;
  delayMs: number;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setOpen(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);
  const shown = sides.filter((s) => s.avatar);
  if (!open || !shown.length) return null;
  const winnerName = sides.find((s) => s.color === winner)?.name;
  return (
    <div className="game-finale" role="dialog" aria-label={t('finale.label')}>
      <button type="button" className="finale-close" aria-label={t('finale.close')} onClick={() => setOpen(false)}>
        ✕
      </button>
      <div className="finale-title">{winnerName ? t('finale.won', { name: winnerName }) : t('finale.draw')}</div>
      <div className="finale-stage">
        {shown.map((s) => (
          <div key={s.color} className={`finale-side ${!winner ? 'draw' : s.color === winner ? 'won' : 'lost'}`}>
            <PosedFigure avatar={s.avatar!} outfit={s.outfit ?? null} pose={s.pose} className="finale-figure" />
            <span className="finale-name">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
