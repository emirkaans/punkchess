import { useState } from 'react';
import type { Color, GameState, VariantDefinition } from '../engine/index.ts';
import type { MessageKey } from '../i18n/index.ts';
import { cardArt } from './cardArt.ts';
import { cardsInPlay } from './cardsInPlay.ts';
import { useI18n } from './i18n.tsx';
import { Modal } from './Modal.tsx';

type Tab = 'game' | 'tricks' | 'chaos';

interface Props {
  variant: VariantDefinition;
  game: GameState;
  /** Each side's chaos card, or null where it is not known here. */
  chaos: Readonly<Record<Color, string | null>>;
  onClose: () => void;
}

/** One card in the guide: its id, whether it is a chaos card; id null is a hidden chaos card. */
interface Entry {
  readonly id: string | null;
  readonly chaos: boolean;
}

/**
 * Every card of the variant (Anarşi), from the "Kartlar" button: tabs for this game's cards,
 * the tricks and the chaos cards; picking one shows what it does underneath.
 */
export function CardGuide({ variant, game, chaos, onClose }: Props) {
  const { t } = useI18n();
  const tricks = variant.setup?.questions[0]?.options.map((o) => o.id) ?? [];
  const chaosKinds = variant.cards?.chaosKinds ?? [];
  const played = cardsInPlay(game, chaos);
  const lists: Record<Tab, Entry[]> = {
    game: [...played.tricks.map((id) => ({ id, chaos: false })), ...played.chaos.map((id) => ({ id, chaos: true }))],
    tricks: tricks.map((id) => ({ id, chaos: false })),
    chaos: chaosKinds.map((id) => ({ id, chaos: true })),
  };
  const [tab, setTab] = useState<Tab>('game');
  const [picked, setPicked] = useState(0);
  const list = lists[tab];
  const shown = list[picked] ?? list[0] ?? null;
  const name = (e: Entry) => (e.id ? t(`card.name.${e.id}` as MessageKey) : t('card.hiddenShort'));
  const art = (e: Entry) =>
    e.id ? (
      <span className="guide-art" dangerouslySetInnerHTML={{ __html: cardArt(e.id) ?? '' }} />
    ) : (
      <span className="guide-art guide-q" aria-hidden="true">
        ?
      </span>
    );

  return (
    <Modal label={t('card.title')} className="card-guide" onClose={onClose}>
      <div className="guide-head">
        <h2>{t('card.title')}</h2>
        <button className="icon-button" aria-label={t('close')} onClick={onClose}>
          ×
        </button>
      </div>
      <div className="tabs" role="tablist">
        {(['game', 'tricks', 'chaos'] as const).map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'tab on' : 'tab'}
            onClick={() => {
              setTab(id);
              setPicked(0);
            }}
          >
            {t(`cardGuide.${id}`)}
          </button>
        ))}
      </div>
      <div className="guide-chips" role="tabpanel">
        {list.map((e, i) => (
          <button
            key={`${e.id ?? 'hidden'}-${i}`}
            className={`guide-chip${e.chaos ? ' chaos' : ''}`}
            aria-pressed={shown === e}
            onClick={() => setPicked(i)}
          >
            {art(e)}
            <span className="guide-name">{name(e)}</span>
          </button>
        ))}
      </div>
      {shown && (
        <div className={`guide-info${shown.chaos ? ' chaos' : ''}`} aria-live="polite">
          {art(shown)}
          <div>
            <span className="guide-kind">{t(shown.chaos ? 'card.chaos' : 'card.trick')}</span>
            <b>{name(shown)}</b>
            <span>{shown.id ? t(`card.text.${shown.id}` as MessageKey) : t('card.hidden')}</span>
          </div>
        </div>
      )}
    </Modal>
  );
}
