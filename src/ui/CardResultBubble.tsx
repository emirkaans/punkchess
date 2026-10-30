import { opposite, squareName } from '../engine/index.ts';
import type { Color, Piece, Position, VariantDefinition } from '../engine/index.ts';
import type { MessageKey } from '../i18n/index.ts';
import type { CardResult } from './cardResult.ts';
import { useI18n } from './i18n.tsx';
import { PieceView } from './PieceView.tsx';

/** hit / backfire for a chaos card, trick for a trick (the colour of everything about it). */
export const cardTone = (r: CardResult) =>
  r.outcome === '+' ? 'hit' : r.outcome === '-' || (r.blast && !r.cleared) ? 'backfire' : 'trick';

/** One sentence: what the card did, on which squares. */
export function useCardSentence(variant: VariantDefinition, r: CardResult): string {
  const { t, vt, locale } = useI18n();
  if (r.empty) return t('card.result.empty');
  if (r.hidden) return t(`card.result.${r.id}Hidden` as MessageKey);
  const [c0, c1] = r.changes;
  const last = r.changes.at(-1);
  const piece = (p: Piece | null | undefined) => (p ? vt(variant).pieceName(p.type).toLocaleLowerCase(locale) : '');
  const side = (c: Color | undefined) => (c ? t(`card.result.side.${c}`) : '');
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
  if (r.id === 'time') params.side = side(r.outcome === '-' ? opposite(r.color) : r.color);
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
}

/**
 * Under the board, after a card: a speech bubble from the player who played it, saying
 * whether it hit or backfired, what it did and the piece before and after.
 */
export function CardResultBubble({ variant, result, position }: Props) {
  const { t } = useI18n();
  const sentence = useCardSentence(variant, result);
  const tone = cardTone(result);
  const name = t(`card.name.${result.id}` as MessageKey);
  const [c0, c1] = result.changes;
  // Swaps show both pieces trading places; everything else the piece before and after.
  const swap = result.id === 'swap' || result.id === 'quake';
  const pieces = result.empty || !c0 ? null : swap ? [c0.before, c1?.before ?? null] : [c0.before, c0.after];
  // The piece after the card wears its badge (a nitro piece: the queen it moves like).
  const icon = (p: Piece | null, after = false) =>
    p ? (
      <span className="cr-piece">
        <PieceView variant={variant} piece={p} position={after ? position : undefined} />
      </span>
    ) : (
      <span className="cr-piece cr-none" aria-hidden="true">
        ×
      </span>
    );
  return (
    <div className={`card-result ${tone}`} role="status">
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
        {pieces && (pieces[0] || pieces[1]) && (
          <div className="cr-pieces" aria-hidden="true">
            {icon(pieces[0])}
            <span className="cr-arrow">{swap ? '⇄' : '→'}</span>
            {icon(pieces[1], !swap)}
          </div>
        )}
      </div>
    </div>
  );
}
