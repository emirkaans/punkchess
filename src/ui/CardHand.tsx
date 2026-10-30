import { useMemo } from 'react';
import { CHAOS, legalMoves, opposite } from '../engine/index.ts';
import type { Color, GameState, VariantDefinition } from '../engine/index.ts';
import type { MessageKey } from '../i18n/index.ts';
import type { CardPick } from './cardPick.ts';
import { useI18n } from './i18n.tsx';

/** What a side's played chaos card turned out to be, read from the moves. */
function playedChaos(game: GameState, color: Color): { kind: string; outcome: '+' | '-' } | null {
  const n = game.moves.length;
  for (let i = 0; i < n; i++) {
    const card = game.moves[i].move.card;
    // The last move was made by the side not to move now; earlier ones alternate back from there.
    const mover = (n - 1 - i) % 2 === 0 ? opposite(game.position.turn) : game.position.turn;
    if (card?.id === CHAOS && card.kind && mover === color) return { kind: card.kind, outcome: card.outcome! };
  }
  return null;
}

interface Props {
  variant: VariantDefinition;
  game: GameState;
  /** Each side's chaos card, or null where it is not known here. */
  chaos: Readonly<Record<Color, string | null>>;
  /** Sides shown, top first. */
  colors: readonly Color[];
  /** The side that may play a card now, or null. */
  active: Color | null;
  pick: CardPick | null;
  onPick: (pick: CardPick | null) => void;
  /** Plays the picked card that needs no target: the chaos card, or a trick like Ateşkes. */
  onChaos: () => void;
}

/** The players' cards (Anarşi): each side's trick and chaos card, played from here. */
export function CardHand({ variant, game, chaos, colors, active, pick, onPick, onChaos }: Props) {
  const { t } = useI18n();
  const pos = game.position;
  const extra = pos.extra as {
    trick?: Record<Color, string | null>;
    used?: Record<Color, boolean>;
    chaos?: Record<Color, boolean>;
  };
  const cardMoves = useMemo(
    () => (active ? legalMoves(variant, pos).filter((m) => m.card) : []),
    [variant, pos, active],
  );
  const playable = new Set(cardMoves.map((m) => m.card!.id));
  // A trick with no target square (Ateşkes) is played from a confirm button, like the chaos card.
  const untargeted = (id: string) => cardMoves.some((m) => m.card!.id === id && m.card!.squares.length === 0);
  const name = (id: string) => t(`card.name.${id}` as MessageKey);
  const text = (id: string) => t(`card.text.${id}` as MessageKey);

  return (
    <div className="box card-hand">
      <div className="box-head">
        <h2>{t('card.title')}</h2>
      </div>
      {colors.map((color) => {
        const trick = extra.trick?.[color] ?? null;
        const trickUsed = !!extra.used?.[color];
        const chaosUsed = !!extra.chaos?.[color];
        const played = chaosUsed ? playedChaos(game, color) : null;
        const kind = played?.kind ?? chaos[color];
        const mine = active === color;
        const trickOn = mine && trick !== null && playable.has(trick);
        const chaosOn = mine && playable.has(CHAOS);
        return (
          <div key={color} className="hand-row">
            <div className="hand-color">{t(`color.${color}`)}</div>
            <div className="hand-cards">
              {trick && (
                <button
                  className={`play-card trick${pick?.id === trick && mine ? ' on' : ''}${trickUsed ? ' used' : ''}`}
                  disabled={!trickOn}
                  aria-pressed={pick?.id === trick && mine}
                  onClick={() => onPick(pick?.id === trick ? null : { id: trick, picked: [] })}
                >
                  <span className="card-kind">{t('card.trick')}</span>
                  <span className="card-name">{name(trick)}</span>
                  <span className="card-text">{trickUsed ? t('card.used') : text(trick)}</span>
                </button>
              )}
              <button
                className={`play-card chaos${pick?.id === CHAOS && mine ? ' on' : ''}${chaosUsed ? ' used' : ''}`}
                disabled={!chaosOn}
                aria-pressed={pick?.id === CHAOS && mine}
                onClick={() => onPick(pick?.id === CHAOS ? null : { id: CHAOS, picked: [] })}
              >
                <span className="card-kind">{t('card.chaos')}</span>
                <span className="card-name">{kind ? name(kind) : '?'}</span>
                <span className="card-text">
                  {played
                    ? t(played.outcome === '+' ? 'card.hit' : 'card.backfire')
                    : kind
                      ? text(kind)
                      : t('card.hidden')}
                </span>
              </button>
            </div>
            {mine && pick?.id === CHAOS && (
              <div className="hand-confirm">
                <span>{t('card.chaosConfirm')}</span>
                <button className="primary" onClick={onChaos}>
                  {t('card.fire')}
                </button>
                <button onClick={() => onPick(null)}>{t('card.cancel')}</button>
              </div>
            )}
            {mine && pick && pick.id !== CHAOS && untargeted(pick.id) && (
              <div className="hand-confirm">
                <span>{t('card.trickConfirm')}</span>
                <button className="primary" onClick={onChaos}>
                  {t('card.play')}
                </button>
                <button onClick={() => onPick(null)}>{t('card.cancel')}</button>
              </div>
            )}
            {mine && pick && pick.id !== CHAOS && !untargeted(pick.id) && (
              <div className="hand-confirm">
                <span>{t(pick.picked.length ? 'card.pickSecond' : 'card.pickTarget')}</span>
                <button onClick={() => onPick(null)}>{t('card.cancel')}</button>
              </div>
            )}
          </div>
        );
      })}
      <p className="muted hand-note">{t('card.note')}</p>
    </div>
  );
}
