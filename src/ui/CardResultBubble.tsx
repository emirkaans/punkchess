import { opposite, squareName } from '../engine/index.ts';
import type { Color, Piece, Position, VariantDefinition } from '../engine/index.ts';
import type { MessageKey } from '../i18n/index.ts';
import type { CardResult } from './cardResult.ts';
import { useI18n } from './i18n.tsx';
import { PieceView } from './PieceView.tsx';
import { CardIconView } from './CardIconView.tsx';
import { cardVisual } from './cardVisual.ts';
import type { Tile } from './cardVisual.ts';

/** hit / backfire for a chaos card, trick for a trick (the colour of everything about it). */
export const cardTone = (r: CardResult) =>
  r.outcome === '+' ? 'hit' : r.outcome === '-' || (r.blast && !r.cleared) ? 'backfire' : 'trick';

/** One sentence: what the card did, on which squares. */
export function useCardSentence(variant: VariantDefinition, r: CardResult): string {
  const { t: tt, vt, locale } = useI18n();
  // A sentence may start with a piece name (lower case in it): its first letter in capitals.
  const t = (key: MessageKey, params?: Parameters<typeof tt>[1]) => {
    const text = tt(key, params);
    return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
  };
  if (r.empty) return t('card.result.empty');
  if (r.hidden) return t(`card.result.${r.id}Hidden` as MessageKey);
  const [c0, c1] = r.changes;
  const last = r.changes.at(-1);
  // Piece names in lower case inside the sentence (German nouns keep their capital); a sentence
  // that starts with one gets its capital back below.
  const piece = (p: Piece | null | undefined) => {
    const name = p ? vt(variant).pieceName(p.type) : '';
    return locale === 'de' ? name : name.toLocaleLowerCase(locale);
  };
  const side = (c: Color | undefined) => (c ? tt(`card.result.side.${c}`) : '');
  const owner = c0?.before?.color ?? c0?.after?.color;
  const params: Record<string, string> = {
    square: c0 ? squareName(c0.square) : '',
    square2: c1 ? squareName(c1.square) : '',
    last: last ? squareName(last.square) : '',
    squares: r.changes.map((c) => squareName(c.square)).join(', '),
    piece: piece(c0?.before ?? c0?.after),
    side: side(owner),
  };
  if (r.id === 'revive') params.piece = piece(c0?.after);
  if (r.id === 'demote') params.piece2 = piece(c0?.after);
  if (r.id === 'quake') params.piece2 = piece(c1?.before);
  // Zaman Hırsızı: whose time was halved (the opponent's on a hit, the player's own on a backfire).
  if (r.id === 'time') params.side = side(r.outcome === '-' ? r.color : opposite(r.color));
  if (r.blast) {
    params.piece = piece(c0?.before);
    params.side = side(c0?.before?.color);
    return t(c0?.after ? 'card.result.blastKing' : 'card.result.blastLine', params);
  }
  return t(`card.result.${r.id}` as MessageKey, params);
}

interface Props {
  variant: VariantDefinition;
  result: CardResult;
  /** The position after the card (for piece badges). */
  position: Position;
  /** Small, without the piece badges (the players' strip and the card log). */
  compact?: boolean;
  /** An earlier result in the card log: faded. */
  old?: boolean;
}

/**
 * Under the board, after a card: a speech bubble from the player who played it, saying
 * whether it hit or backfired, what it did and the piece before and after.
 */
export function CardResultBubble({ variant, result, position, compact = false, old = false }: Props) {
  const { t } = useI18n();
  const sentence = useCardSentence(variant, result);
  const tone = cardTone(result);
  const name = t(`card.name.${result.id}` as MessageKey);
  const { tiles } = cardVisual(variant, result, position);
  const corner = (sq: number | undefined) =>
    sq === undefined ? null : <span className="cr-square">{squareName(sq)}</span>;
  // A piece after the card wears its badge (a nitro piece: the queen it moves like).
  const tile = (x: Tile, i: number) => {
    switch (x.kind) {
      case 'sep':
        return (
          <span key={i} className="cr-arrow">
            {x.text}
          </span>
        );
      case 'chip':
        return (
          <span key={i} className="cr-chip">
            {x.text}
          </span>
        );
      case 'icon':
        return (
          <span key={i} className={`cr-piece cr-icon cr-icon-${x.icon}`}>
            <CardIconView icon={x} />
            {x.label && <span className="cr-icon-label">{x.label}</span>}
            {corner(x.square)}
          </span>
        );
      default:
        return x.piece ? (
          <span key={i} className={`cr-piece${x.struck ? ' cr-struck' : ''}`}>
            <PieceView variant={variant} piece={x.piece} position={x.after ? position : undefined} />
            {corner(x.square)}
          </span>
        ) : (
          <span key={i} className="cr-piece cr-none">
            ×
          </span>
        );
    }
  };
  return (
    <div
      className={`card-result ${tone}${compact ? ' compact' : ''}${old ? ' old' : ''}`}
      role={old ? undefined : 'status'}
    >
      <span className="cr-avatar" aria-hidden="true">
        <span className={`cr-dot ${result.color}`} />
      </span>
      <div className="cr-bubble">
        <div className="cr-text">
          <strong className="cr-title">
            {result.blast
              ? t(result.cleared ? 'card.result.cleared' : 'card.result.blast')
              : result.chaos
                ? t(result.outcome === '+' ? 'card.result.hit' : 'card.result.backfire')
                : name}
          </strong>
          <span className="cr-line">
            {result.blast ? name : `${t(`color.${result.color}`)} · ${result.chaos ? name : t('card.trick')}`} —{' '}
            {sentence}
          </span>
        </div>
        {!compact && tiles.length > 0 && (
          <div className="cr-pieces" aria-hidden="true">
            {tiles.map(tile)}
          </div>
        )}
      </div>
    </div>
  );
}
