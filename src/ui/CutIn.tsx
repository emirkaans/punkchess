import { useEffect, useMemo, useRef, useState } from 'react';
import type { Avatar } from '../avatar/avatar.ts';
import { figureSvg } from '../avatar/figure.ts';
import { EMPTY_OUTFIT } from '../avatar/outfit.ts';
import type { Outfit } from '../avatar/outfit.ts';
import type { Color, GameState, VariantDefinition } from '../engine/index.ts';
import type { MessageKey } from '../i18n/index.ts';
import type { CardResult } from './cardResult.ts';
import { cutInFor } from './cutIn.ts';
import type { CutInEvent } from './cutIn.ts';
import { useI18n } from './i18n.tsx';

export interface CutInPlayer {
  readonly avatar: Avatar;
  readonly outfit: Outfit | null;
}

interface Props {
  variant: VariantDefinition;
  game: GameState | null;
  card: CardResult | null;
  /** The characters by colour; a side without one (a bot, a guest) has no cut-in. */
  characters: Partial<Record<Color, CutInPlayer | null>>;
  /** The colour shown at the bottom of the board (that side slides in from the left). */
  bottom: Color;
  /** The board shows the latest move (not one stepped back to in the history). */
  live: boolean;
  /** On in the preferences. */
  enabled: boolean;
}

const SHOW_MS = 1700;

/**
 * Over the board, after a card, a queen taken or a check: the player's character slides in on a
 * pink band and shouts one line, then slides out (design C). Never takes clicks; the board under
 * it keeps working. Only for a move just played, not for moves stepped through in the history.
 */
export function CutIn({ variant, game, card, characters, bottom, live, enabled }: Props) {
  const { t } = useI18n();
  const count = game?.moves.length ?? 0;
  const seen = useRef(count);
  const [shown, setShown] = useState<{ key: number; event: CutInEvent } | null>(null);

  useEffect(() => {
    // Stepping through the history neither counts nor shows; coming back to the end is no new move.
    if (!live) return;
    const fresh = count === seen.current + 1;
    seen.current = count;
    if (!fresh || !enabled) return;
    const event = cutInFor(variant, game, card);
    if (!event || !characters[event.color]) return;
    setShown({ key: count, event });
    // `game`, `card` and `characters` follow `count`; only a new move starts a cut-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, live, enabled]);

  useEffect(() => {
    if (!shown) return;
    const id = setTimeout(() => setShown(null), SHOW_MS);
    return () => clearTimeout(id);
  }, [shown]);

  const who = shown ? characters[shown.event.color] : null;
  const svg = useMemo(() => (who ? figureSvg(who.avatar, who.outfit ?? EMPTY_OUTFIT) : ''), [who]);
  if (!shown || !who) return null;
  const line = shown.event.line;
  const text =
    line.kind === 'card'
      ? t('cutin.card', { card: t(`card.name.${line.id}` as MessageKey) })
      : t(line.kind === 'queen' ? 'cutin.queen' : 'cutin.check');
  const side = shown.event.color === bottom ? 'from-left' : 'from-right';
  return (
    <div key={shown.key} className={`cut-in ${side}`} role="status" aria-live="polite">
      <div className="cut-in-band" />
      <span className="cut-in-fig" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="cut-in-say">{text}</div>
    </div>
  );
}
