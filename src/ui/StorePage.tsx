import { useState } from 'react';
import { DEFAULT_AVATAR } from '../avatar/avatar.ts';
import { figureSvg, itemView } from '../avatar/figure.ts';
import { EMPTY_OUTFIT, STORE_ITEMS, STORE_SLOTS, TATTOO_SLOTS } from '../avatar/outfit.ts';
import type { StoreItem } from '../avatar/outfit.ts';
import { SHOE_KINDS, shoeKind } from '../avatar/shoes.ts';
import type { MessageKey } from '../i18n/index.ts';
import { signInWithGoogle, useAccount } from './account.ts';
import { CoinIcon } from './CoinToast.tsx';
import { useI18n } from './i18n.tsx';
import { FittingCart, SHOP_ICONS, STREET_ICON, useShop } from './shop.tsx';

/** The parlour's fitting room: the head and the neck, close. */
const TATTOO_BOOTH = '36 4 128 136';

const Figure = ({ svg, className }: { svg: string; className: string }) => (
  <span className={className} dangerouslySetInnerHTML={{ __html: svg }} />
);

interface Tab {
  readonly id: string;
  readonly label: string;
  readonly short: string;
  readonly icon: string;
  readonly items: readonly StoreItem[];
}

/**
 * A shop with a fitting room: the store ("Butik", clothes by kind), the shoe shop ("Bot & Bağcık":
 * boots, combat boots, sneakers) or the tattoo parlour ("Dövmeci": the face and the neck, the
 * fitting room showing the head). A fitting room on the left (the character full length, wearing what is
 * tried on), the goods by kind on the right; an item is bought with punk coins, then worn or
 * taken off. Coins only buy looks.
 */
export function StorePage({
  onOpen,
  shop: kind = 'store',
}: {
  onOpen: (path: string) => void;
  shop?: 'store' | 'shoes' | 'tattoo';
}) {
  const shoes = kind === 'shoes';
  const tattoo = kind === 'tattoo';
  const { t } = useI18n();
  const account = useAccount();
  const avatar = account.user?.avatar ?? DEFAULT_AVATAR;
  const tabs: readonly Tab[] = shoes
    ? SHOE_KINDS.map((k) => ({
        id: k,
        label: t(`shoes.kind.${k}` as MessageKey),
        short: t(`shoes.short.${k}` as MessageKey),
        icon: SHOP_ICONS.shoes,
        items: STORE_ITEMS.filter((i) => i.slot === 'shoes' && shoeKind(i.id) === k),
      }))
    : (tattoo ? TATTOO_SLOTS : STORE_SLOTS).map((s) => ({
        id: s,
        label: t(`store.slot.${s}` as MessageKey),
        short: t(`store.short.${s}` as MessageKey),
        icon: SHOP_ICONS[s],
        items: STORE_ITEMS.filter((i) => i.slot === s),
      }));
  const [tabId, setTab] = useState(tabs[0].id);
  const tab = tabs.find((x) => x.id === tabId) ?? tabs[0];
  const title = t(shoes ? 'shoes.title' : tattoo ? 'tattoo.title' : 'store.title');
  // Back to the street (the shops are entered from there).
  const switches = [
    { path: '/street', icon: STREET_ICON, full: `← ${t('street.back')}`, short: t('menu.streetShort') },
  ];
  const shop = useShop();
  const { store, ready, isTrying, shown, msg, name, button, tryOn, cart, total } = shop;

  if (!account.loading && !account.user) {
    return (
      <main className="store-page">
        <h1 className="store-title">{title}</h1>
        <p className="muted">{t('store.signIn')}</p>
        {account.canSignIn && (
          <button className="primary" onClick={() => signInWithGoogle(`/${kind}`)}>
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
          {/* Drawn once the account (and so its look) is known: never undressed first. */}
          {ready ? (
            <Figure svg={figureSvg(avatar, shown, tattoo ? TATTOO_BOOTH : undefined)} className="store-figure fig-in" />
          ) : (
            <span className="store-figure fig-ghost" aria-hidden="true" />
          )}
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
            <h1 className="store-title">{title}</h1>
            {store && (
              <span className="store-balance" title={t('coins.balance', { n: String(store.balance) })}>
                <CoinIcon />
                {store.balance}
              </span>
            )}
          </div>
          <div className="store-tabs" role="tablist">
            {tabs.map((x) => (
              <button
                key={x.id}
                role="tab"
                aria-selected={tab.id === x.id}
                className={tab.id === x.id ? 'on' : ''}
                onClick={() => setTab(x.id)}
              >
                {/* Phones: an icon and a short name in a narrow rail; wider screens: the full name. */}
                <svg className="cp-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d={x.icon} />
                </svg>
                <span className="cp-full">{x.label}</span>
                <span className="cp-short" aria-hidden="true">
                  {x.short}
                </span>
              </button>
            ))}
            {switches.map((w) => (
              <button key={w.path} className="shop-switch street-back" onClick={() => onOpen(w.path)}>
                <svg className="cp-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d={w.icon} />
                </svg>
                <span className="cp-full">{w.full}</span>
                <span className="cp-short" aria-hidden="true">
                  {w.short}
                </span>
              </button>
            ))}
            {store && (
              <span className="store-rail-balance" title={t('coins.balance', { n: String(store.balance) })}>
                <CoinIcon />
                {store.balance}
              </span>
            )}
          </div>
          <div className="store-grid" role="tabpanel">
            {tab.items.map((item) => (
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
