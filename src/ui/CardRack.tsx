import { useMemo } from 'react';
import { CHAOS, legalMoves } from '../engine/index.ts';
import type { Color, GameState, Move, VariantDefinition } from '../engine/index.ts';
import type { MessageKey } from '../i18n/index.ts';
import { cardArt } from './cardArt.ts';
import { lastCardResult } from './cardResult.ts';
import type { Viewer } from './cardResult.ts';
import { CardResultBubble } from './CardResultBubble.tsx';
import { playedChaos } from './cardsInPlay.ts';
import type { CardPick } from './cardPick.ts';
import { useI18n } from './i18n.tsx';

// Anarşi's cards live with their owner (design "Kart rafı"): a rack in each player's card, a
// bar to confirm or cancel a pick, and the last card results beside the players.

/** The card moves of the side that may play one now (none for everyone else). */
export function useCardMoves(variant: VariantDefinition, game: GameState | null, active: Color | null): Move[] {
  const pos = game?.position;
  return useMemo(() => (active && pos ? legalMoves(variant, pos).filter((m) => m.card) : []), [variant, pos, active]);
}

interface RackProps {
  game: GameState;
  color: Color;
  /** This side's chaos card, or null where it is not known here. */
  chaos: string | null;
  /** The side that may play a card now, or null. */
  active: Color | null;
  cardMoves: readonly Move[];
  pick: CardPick | null;
  onPick: (pick: CardPick | null) => void;
}

/**
 * One side's cards: its trick and its chaos card, small. Narrow screens show only the pictures
 * (the name is the tooltip and the screen-reader label); the wide players column shows upright
 * cards with their names, fanned.
 */
export function CardRack({ game, color, chaos, active, cardMoves, pick, onPick }: RackProps) {
  const { t } = useI18n();
  const extra = game.position.extra as {
    trick?: Record<Color, string | null>;
    used?: Record<Color, boolean>;
    chaos?: Record<Color, boolean>;
  };
  const playable = new Set(cardMoves.map((m) => m.card!.id));
  const trick = extra.trick?.[color] ?? null;
  const trickUsed = !!extra.used?.[color];
  const played = extra.chaos?.[color] ? playedChaos(game, color) : null;
  const kind = played?.kind ?? chaos;
  const mine = active === color;
  const name = (id: string) => t(`card.name.${id}` as MessageKey);
  const text = (id: string) => t(`card.text.${id}` as MessageKey);
  const art = (id: string) => <span className="rack-art" dangerouslySetInnerHTML={{ __html: cardArt(id) ?? '' }} />;
  const toggle = (id: string) => onPick(pick?.id === id ? null : { id, picked: [] });
  const on = (id: string) => mine && pick?.id === id;

  return (
    <div className="card-rack" role="group" aria-label={t('card.title')}>
      {trick && (
        <button
          className={`rack-card trick${on(trick) ? ' on' : ''}${trickUsed ? ' used' : ''}`}
          disabled={!(mine && playable.has(trick))}
          aria-pressed={on(trick)}
          aria-label={`${t('card.trick')}: ${name(trick)}${trickUsed ? ` (${t('card.used')})` : ''}`}
          title={`${name(trick)} — ${text(trick)}`}
          onClick={() => toggle(trick)}
        >
          <span className="rack-kind">{t('card.trick')}</span>
          {art(trick)}
          <span className="rack-name">{name(trick)}</span>
          {trickUsed && <span className="rack-stamp">{t('card.used')}</span>}
        </button>
      )}
      <button
        className={`rack-card chaos${kind ? '' : ' back'}${on(CHAOS) ? ' on' : ''}${played ? (played.outcome === '+' ? ' hit used' : ' backfire used') : ''}`}
        disabled={!(mine && playable.has(CHAOS))}
        aria-pressed={on(CHAOS)}
        aria-label={`${t('card.chaos')}: ${kind ? name(kind) : t('card.hidden')}`}
        title={kind ? `${name(kind)} — ${text(kind)}` : t('card.hidden')}
        onClick={() => toggle(CHAOS)}
      >
        <span className="rack-kind">{t('card.chaos')}</span>
        {kind ? (
          art(kind)
        ) : (
          <span className="rack-art rack-q" aria-hidden="true">
            ?
          </span>
        )}
        <span className="rack-name">{kind ? name(kind) : t('card.hiddenShort')}</span>
      </button>
    </div>
  );
}

interface PickBarProps {
  cardMoves: readonly Move[];
  pick: CardPick;
  onPick: (pick: CardPick | null) => void;
  /** Plays the picked card that needs no target: the chaos card, or a trick like Ateşkes. */
  onChaos: () => void;
  className?: string;
}

/** While a card is picked: what to do next (a square on the board, or a confirm) and Cancel. */
export function CardPickBar({ cardMoves, pick, onPick, onChaos, className = '' }: PickBarProps) {
  const { t } = useI18n();
  const chaos = pick.id === CHAOS;
  const untargeted = !chaos && cardMoves.some((m) => m.card!.id === pick.id && m.card!.squares.length === 0);
  const title = chaos ? t('card.chaos') : t(`card.name.${pick.id}` as MessageKey);
  const line = chaos
    ? t('card.chaosConfirm')
    : untargeted
      ? t('card.trickConfirm')
      : t(pick.picked.length ? 'card.pickSecond' : 'card.pickTarget');
  return (
    <div className={`card-pickbar ${chaos ? 'chaos' : 'trick'} ${className}`} role="status">
      {!chaos && <span className="rack-art" dangerouslySetInnerHTML={{ __html: cardArt(pick.id) ?? '' }} />}
      <span className="pickbar-text">
        <strong>{title}</strong>
        <span>{line}</span>
      </span>
      {(chaos || untargeted) && (
        <button className="primary" onClick={onChaos}>
          {t(chaos ? 'card.fire' : 'card.play')}
        </button>
      )}
      <button onClick={() => onPick(null)}>{t('card.cancel')}</button>
    </div>
  );
}

/** The card results of the last moves up to the shown one, newest last (at most `max`). */
export function recentCardResults(variant: VariantDefinition, game: GameState | null, viewer: Viewer, max = 3) {
  const out: { key: number; result: NonNullable<ReturnType<typeof lastCardResult>>; game: GameState }[] = [];
  for (let g = game; g && out.length < max; g = g.previous) {
    const r = lastCardResult(variant, g, viewer);
    if (r) out.unshift({ key: g.moves.length, result: r, game: g });
  }
  return out;
}

interface LogProps {
  variant: VariantDefinition;
  game: GameState | null;
  viewer: Viewer;
}

/** The wide players column's middle: the last few card results, the newest framed. */
export function CardLog({ variant, game, viewer }: LogProps) {
  const { t } = useI18n();
  const entries = recentCardResults(variant, game, viewer);
  if (!entries.length) return null;
  const newest = game?.moves.length;
  return (
    <div className="card-log" aria-label={t('card.title')}>
      {entries.map((e) => (
        <CardResultBubble
          key={e.key}
          variant={variant}
          result={e.result}
          position={e.game.position}
          compact
          old={e.key !== newest}
        />
      ))}
    </div>
  );
}
