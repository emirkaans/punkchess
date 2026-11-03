import { useState } from 'react';
import { DEFAULT_AVATAR } from '../avatar/avatar.ts';
import { figureSvg, itemView } from '../avatar/figure.ts';
import { EMPTY_OUTFIT, STORE_ITEMS, STORE_SLOTS } from '../avatar/outfit.ts';
import type { OutfitSlot } from '../avatar/outfit.ts';
import type { MessageKey } from '../i18n/index.ts';
import { signInWithGoogle, useAccount } from './account.ts';
import { CoinIcon } from './CoinToast.tsx';
import { useI18n } from './i18n.tsx';
import { FittingCart, SHOP_ICONS, useShop } from './shop.tsx';

const Figure = ({ svg, className }: { svg: string; className: string }) => (
  <span className={className} dangerouslySetInnerHTML={{ __html: svg }} />
);

/**
 * The store ("Butik"): a fitting room on the left (the character full length, wearing what is
 * tried on), the goods by kind on the right; an item is bought with punk coins, then worn or
 * taken off. Coins only buy looks.
 */
export function StorePage({ onOpen }: { onOpen: (path: string) => void }) {
  const { t } = useI18n();
  const account = useAccount();
  const avatar = account.user?.avatar ?? DEFAULT_AVATAR;
  const [slot, setSlot] = useState<OutfitSlot>('jacket');
  const shop = useShop();
  const { store, isTrying, shown, msg, name, button, tryOn, cart, total } = shop;

  if (!account.loading && !account.user) {
    return (
      <main className="store-page">
        <h1 className="store-title">{t('store.title')}</h1>
        <p className="muted">{t('store.signIn')}</p>
        {account.canSignIn && (
          <button className="primary" onClick={() => signInWithGoogle('/store')}>
            {t('account.signIn')}
          </button>
        )}
      </main>
    );
  }

  return (
    <main className="store-page">
      <div className="store">
        <aside className="store-booth">
          <span className="store-label">{t('store.booth')}</span>
          <Figure svg={figureSvg(avatar, shown)} className="store-figure" />
          <div className="store-booth-foot">
            {/* Everything tried on, bought and worn together. */}
            {cart.length ? <FittingCart shop={shop} /> : <span className="store-label">{t('store.pick')}</span>}
            <p className={msg?.bad ? 'store-msg bad' : 'store-msg'} role="status">
              {msg?.text ?? ''}
            </p>
          </div>
        </aside>
        <section className="store-shop">
          <div className="store-top">
            <h1 className="store-title">{t('store.title')}</h1>
            {store && (
              <span className="store-balance" title={t('coins.balance', { n: String(store.balance) })}>
                <CoinIcon />
                {store.balance}
              </span>
            )}
          </div>
          <div className="store-tabs" role="tablist">
            {STORE_SLOTS.map((s) => (
              <button
                key={s}
                role="tab"
                aria-selected={slot === s}
                className={slot === s ? 'on' : ''}
                onClick={() => setSlot(s)}
              >
                {/* Phones: an icon and a short name in a narrow rail; wider screens: the full name. */}
                <svg className="cp-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d={SHOP_ICONS[s]} />
                </svg>
                <span className="cp-full">{t(`store.slot.${s}` as MessageKey)}</span>
                <span className="cp-short" aria-hidden="true">
                  {t(`store.short.${s}` as MessageKey)}
                </span>
              </button>
            ))}
            <button className="shop-switch" onClick={() => onOpen('/barber')}>
              <svg className="cp-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d={SHOP_ICONS.cut} />
              </svg>
              <span className="cp-full">{t('barber.title')} →</span>
              <span className="cp-short" aria-hidden="true">
                {t('barber.short')}
              </span>
            </button>
            {store && (
              <span className="store-rail-balance" title={t('coins.balance', { n: String(store.balance) })}>
                <CoinIcon />
                {store.balance}
              </span>
            )}
          </div>
          <div className="store-grid" role="tabpanel">
            {STORE_ITEMS.filter((i) => i.slot === slot).map((item) => (
              <div
                key={item.id}
                className={isTrying(item.id) ? 'store-card on' : 'store-card'}
                role="button"
                tabIndex={0}
                aria-pressed={isTrying(item.id)}
                aria-label={name(item.id)}
                onClick={() => tryOn(item.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    tryOn(item.id);
                  }
                }}
              >
                <Figure
                  svg={figureSvg(avatar, { ...EMPTY_OUTFIT, [item.slot]: item.id }, itemView(item.slot, item.id))}
                  className="store-pic"
                />
                <b>{name(item.id)}</b>
                <div className="store-row">
                  {store?.owned.has(item.id) ? (
                    <span className="store-owned">{t('store.owned')}</span>
                  ) : (
                    <span className="store-price">
                      <CoinIcon />
                      {item.price}
                    </span>
                  )}
                  {button(item)}
                </div>
              </div>
            ))}
          </div>
        </section>
        {/* Phones: the picked item and its button stay at the bottom. */}
        <div className="store-bar">
          <div className="store-bar-text">
            <b>{cart.length ? cart.map((c) => name(c.id)).join(' + ') : t('store.pick')}</b>
            <span className={msg?.bad ? 'store-msg bad' : 'store-msg'}>
              {msg?.text ?? (cart.length ? t('coins.balance', { n: String(total) }) : '')}
            </span>
          </div>
          {cart.length > 0 && shop.cartButton()}
        </div>
      </div>
    </main>
  );
}
