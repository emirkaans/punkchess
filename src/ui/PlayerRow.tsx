import type { ReactNode } from 'react';
import type { ClockState } from '../clock/clock.ts';
import type { Color, Position, VariantDefinition } from '../engine/index.ts';
import { ClockView } from './ClockView.tsx';
import { botName } from './game/session.ts';
import type { Player } from './game/session.ts';
import { useI18n } from './i18n.tsx';
import { materialDiff } from './material.ts';
import { PieceView } from './PieceView.tsx';
import { Avatar } from './Punk.tsx';

interface Props {
  variant: VariantDefinition;
  color: Color;
  player: Player;
  position: Position;
  /** It is this side's move and the game is on. */
  active: boolean;
  /** Shown only in timed games. */
  clock: ClockState | null;
  /** Card above or below in the players column (the clock sits toward the middle). */
  place: 'top' | 'bottom';
  /** Shown under the colour instead of the player kind (e.g. an online player's name). */
  label?: ReactNode;
  /**
   * A taunt this player just flashed: a speech bubble from the card (never over the board or
   * the clock). `key` restarts its animation; `tone` is its sticker's colour class.
   */
  taunt?: { key: number | string; tone: string; who: string; text: string } | null;
}

/** One player card left of the board: skull avatar, who plays, the material lead, clock. */
export function PlayerRow({ variant, color, player, position, active, clock, place, label, taunt }: Props) {
  const { t } = useI18n();
  // Only the difference, as on lichess: one short line that never pushes the board around.
  const diff = materialDiff(variant, position);
  const taken = diff.extra[color];
  const lead = diff.lead[color];
  return (
    <div className={`player-row ${place}${active ? ' turn' : ''}`}>
      <span className="avatar">
        <Avatar bot={player.kind === 'bot'} />
      </span>
      <div className="player-info">
        <div className="player-head">
          <span className="player-name">{t(`color.${color}`)}</span>
          <span className="player-sub">{label ?? botName(player, t)}</span>
        </div>
        <div className="taken">
          {taken.map((type, i) => (
            <span key={i} className="taken-piece">
              <PieceView variant={variant} piece={{ type, color: color === 'w' ? 'b' : 'w' }} />
            </span>
          ))}
          {lead > 0 && <span className="lead">+{lead}</span>}
        </div>
        {taunt && (
          <div key={taunt.key} className={`taunt-bubble ${taunt.tone}`} role="status">
            <span className="taunt-who">{taunt.who}</span>
            <span className="taunt-text">{taunt.text}</span>
          </div>
        )}
      </div>
      {clock && <ClockView clock={clock} color={color} />}
    </div>
  );
}
