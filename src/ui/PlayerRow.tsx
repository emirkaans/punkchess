import { EMPTY_OUTFIT } from '../avatar/outfit.ts';
import type { Outfit } from '../avatar/outfit.ts';
import { figureSvg } from '../avatar/figure.ts';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { ClockState } from '../clock/clock.ts';
import type { Color, Position, VariantDefinition } from '../engine/index.ts';
import { ClockView } from './ClockView.tsx';
import { botName } from './game/session.ts';
import type { Player } from './game/session.ts';
import { useI18n } from './i18n.tsx';
import { materialDiff } from './material.ts';
import { PieceView } from './PieceView.tsx';
import { PosedFigure } from './PosedFigure.tsx';
import { Avatar } from './Punk.tsx';
import type { Avatar as Character } from '../avatar/avatar.ts';

/** The character from the head down to the chest (the card's and the strip's portrait). */
const CHEST = '32 -4 136 194';

function Portrait({ avatar, outfit, pose }: { avatar: Character; outfit: Outfit | null; pose?: string | null }) {
  const svg = useMemo(() => (pose ? '' : figureSvg(avatar, outfit ?? EMPTY_OUTFIT, CHEST)), [avatar, outfit, pose]);
  // In a game the bust takes the character's pose too (the arms show from the head to the waist).
  if (pose) return <PosedFigure avatar={avatar} outfit={outfit} pose={pose} view={CHEST} className="char-avatar" />;
  return <span className="char-avatar" dangerouslySetInnerHTML={{ __html: svg }} />;
}

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
  /** The player's character (a signed-in player who made one); else the skull. */
  character?: Character | null;
  /** … and what they wear. */
  outfit?: Outfit | null;
  /**
   * The character's pose in this game (src/avatar/poses.ts): wide screens then show it in full
   * in a panel on the card, narrow ones from the head to the waist.
   */
  pose?: string | null;
  /** This side's cards (Anarşi). */
  rack?: ReactNode;
  /**
   * The card this side just played, said from the strip on narrow screens (the wide column shows
   * the card log instead). `key` restarts it.
   */
  note?: { key: number | string; node: ReactNode } | null;
}

/** One player card left of the board: their character (or a skull), who plays, the material lead, clock. */
export function PlayerRow({
  variant,
  color,
  player,
  position,
  active,
  clock,
  place,
  label,
  taunt,
  character,
  outfit = null,
  pose = null,
  rack,
  note,
}: Props) {
  const { t } = useI18n();
  // Only the difference, as on lichess: one short line that never pushes the board around.
  const diff = materialDiff(variant, position);
  const taken = diff.extra[color];
  const lead = diff.lead[color];
  return (
    <div
      className={`player-row ${place}${active ? ' turn' : ''}${rack ? ' has-rack' : ''}${character && pose ? ' has-stage' : ''}`}
    >
      {character && pose && (
        <div className="player-stage" aria-hidden="true">
          <PosedFigure avatar={character} outfit={outfit} pose={pose} className="stage-figure" />
          <span className="stage-floor" />
        </div>
      )}
      <span className={character ? 'avatar has-character' : 'avatar'}>
        {character ? (
          <Portrait avatar={character} outfit={outfit} pose={pose} />
        ) : (
          <Avatar bot={player.kind === 'bot'} />
        )}
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
      {rack && <div className="player-rack">{rack}</div>}
      {note && (
        <div key={note.key} className="player-note">
          {note.node}
        </div>
      )}
      {clock && <ClockView clock={clock} color={color} />}
    </div>
  );
}
