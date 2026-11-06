import { useMemo } from 'react';
import { DEFAULT_AVATAR } from '../avatar/avatar.ts';
import { figureSvg, itemView } from '../avatar/figure.ts';
import { EMPTY_OUTFIT, storeItem } from '../avatar/outfit.ts';
import type { MessageKey } from '../i18n/index.ts';
import { VITRIN_SHOPS, priceOf, vitrinOf } from '../store/vitrin.ts';
import { useAccount } from './account.ts';
import { CoinIcon } from './CoinToast.tsx';
import { useI18n } from './i18n.tsx';
import { useCountdown } from './QuestsCard.tsx';

/** The shop each item is sold in, as a path. */
const PATH: Readonly<Record<string, string>> = {
  store: '/store',
  barber: '/barber',
  shoes: '/shoes',
  tattoo: '/tattoo',
};

/**
 * The week's window at the top of Punk Street (design "Haftanın Vitrini"): the jacket sold only
 * this week and one item of each shop a quarter off; a click opens the item's shop.
 */
export function VitrinWindow({ onOpen }: { onOpen: (path: string) => void }) {
  const { t } = useI18n();
  const account = useAccount();
  const now = Date.now();
  const v = vitrinOf(now);
  const left = useCountdown(v.endsAt);
  const avatar = account.user?.avatar ?? DEFAULT_AVATAR;
  const items = useMemo(
    () => [
      { id: v.exclusive, shop: 'store', exclusive: true },
      ...v.deals.map((id, i) => ({ id, shop: VITRIN_SHOPS[i].shop, exclusive: false })),
    ],
    [v],
  );
  return (
    <section className="vitrin" aria-label={t('vitrin.title')}>
      <div className="vitrin-head">
        <h2>{t('vitrin.title')}</h2>
        {left && <span className="vitrin-time">⏱ {t('vitrin.left', { d: String(left.d), h: String(left.h) })}</span>}
      </div>
      <div className="vitrin-items">
        {items.map(({ id, shop, exclusive }) => {
          const item = storeItem(id)!;
          return (
            <button
              key={id}
              className={`vitrin-item${exclusive ? ' only' : ''}`}
              onClick={() => onOpen(PATH[shop])}
              aria-label={t(`store.item.${id}` as MessageKey)}
            >
              <span className="vitrin-badge">{t(exclusive ? 'vitrin.only' : 'vitrin.off')}</span>
              <span
                className="vitrin-pic"
                aria-hidden="true"
                dangerouslySetInnerHTML={{
                  __html: figureSvg(avatar, { ...EMPTY_OUTFIT, [item.slot]: item.id }, itemView(item.slot, item.id)),
                }}
              />
              <b>{t(`store.item.${id}` as MessageKey)}</b>
              <span className="vitrin-price">
                <CoinIcon />
                {!exclusive && <s>{item.price}</s>}
                {priceOf(item, now)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
