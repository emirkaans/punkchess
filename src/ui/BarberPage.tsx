import { useState } from 'react';
import { AVATAR_OPTIONS, DEFAULT_AVATAR, TALL_VIEW } from '../avatar/avatar.ts';
import { colorSwatch } from '../avatar/barber.ts';
import { BARBER_SLOTS, EMPTY_OUTFIT, NATURAL_BEARD, STORE_ITEMS } from '../avatar/outfit.ts';
import type { OutfitSlot, StoreItem } from '../avatar/outfit.ts';
import type { MessageKey } from '../i18n/index.ts';
import { refreshAccount, signInWithGoogle, useAccount } from './account.ts';
import { AvatarView } from './CharacterCreator.tsx';
import { CoinIcon } from './CoinToast.tsx';
import { useI18n } from './i18n.tsx';
import { FittingCart, SHOP_ICONS, STREET_ICON, useShop } from './shop.tsx';

/**
 * The barber ("Makas & Jilet", design "Salon Koltuğu"): premium cuts in a priced list on the
 * left, the character in a barber's mirror in the middle, hair colours and beards on the right;
 * a cut, colour or beard is tried in the mirror, bought with punk coins, then worn or taken off.
 * Phones (design "Yan Ray"): the kinds in an icon rail, the mirror above a grid of the picked
 * kind, the tried item and its button in a bar at the bottom.
 */
export function BarberPage({ onOpen }: { onOpen: (path: string) => void }) {
  const { t } = useI18n();
  const account = useAccount();
  const avatar = account.user?.avatar ?? DEFAULT_AVATAR;
  const [kind, setKind] = useState<OutfitSlot>('cut');
  // The left list: cuts or beards (on phones the rail's kind decides it).
  const [list, setList] = useState<'cut' | 'beard'>('cut');
  const shop = useShop();
  const { store, isTrying, shown, msg, name, tryOn, wearFree, busy, triedIn, untry, cart, total } = shop;
  // A natural hair colour being tried (the character's own colour, free), and whether it is the
  // last thing picked (then the button below the mirror is for it).
  const [natHair, setNatHair] = useState<string | null>(null);
  const [natLast, setNatLast] = useState(false);

  if (!account.loading && !account.user) {
    return (
      <main className="store-page">
        <h1 className="store-title">{t('barber.title')}</h1>
        <p className="muted">{t('barber.signIn')}</p>
        {account.canSignIn && (
          <button className="primary" onClick={() => signInWithGoogle('/barber')}>
            {t('account.signIn')}
          </button>
        )}
      </main>
    );
  }

  const items = (slot: OutfitSlot) => STORE_ITEMS.filter((i) => i.slot === slot);
  const price = (item: StoreItem) =>
    store?.owned.has(item.id) ? (
      <span className="store-owned">{t('store.owned')}</span>
    ) : (
      <span className="store-price">
        <CoinIcon />
        {item.price}
      </span>
    );
  // An item's own picture: the character with just that item.
  const preview = (item: StoreItem) => (
    <AvatarView avatar={avatar} outfit={{ ...EMPTY_OUTFIT, [item.slot]: item.id }} view={TALL_VIEW} />
  );
  const panel = (slot: OutfitSlot) => (kind === slot ? 'barber-panel on' : 'barber-panel');
  const worn = store?.outfit ?? EMPTY_OUTFIT;
  // The mirror: everything tried on; a natural hair colour tried replaces a premium one.
  const mirrorAvatar = natHair ? { ...avatar, hairColor: natHair } : avatar;
  const mirrorOutfit = { ...shown, hat: null, ...(natHair ? { color: null } : {}) };
  // A natural hair colour replaces a premium one being tried.
  const tryHair = (id: string) => {
    setNatHair(natHair === id ? null : id);
    setNatLast(natHair !== id);
    untry('color');
  };
  const tryPremium = (id: string, slot: OutfitSlot) => {
    if (slot === 'color') setNatHair(null);
    setNatLast(false);
    tryOn(id, slot);
  };
  // A natural hair colour is saved on the character; a premium one worn comes off.
  const saveHairColor = async () => {
    if (!natHair) return;
    await fetch('/api/me/avatar', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ avatar: { ...avatar, hairColor: natHair } }),
    }).catch(() => null);
    if (worn.color) await wearFree('color', null);
    await refreshAccount();
    setNatHair(null);
    setNatLast(false);
  };
  // Below the mirror: a natural hair colour just picked (saved on the character), else the basket.
  const footer =
    natLast && natHair
      ? {
          label: t(`character.opt.hairColor.${natHair}` as MessageKey),
          note: t('barber.natural'),
          action: (
            <button className="store-buy wear" disabled={busy} onClick={() => void saveHairColor()}>
              {t('barber.use')}
            </button>
          ),
        }
      : cart.length
        ? {
            label: cart.map((c) => (c.natural ? t('barber.beardColor') : name(c.id))).join(' + '),
            note: total ? t('coins.balance', { n: String(total) }) : t('store.owned'),
            action: shop.cartButton(),
          }
        : null;
  // A swatch is on when it is tried in that place, or (nothing tried there) when it is worn.
  const swatchOn = (slot: 'color' | 'beardColor', id: string) => {
    if (slot === 'color' && natHair) return false;
    const tryingHere = triedIn(slot);
    return tryingHere !== null ? tryingHere === id : worn[slot] === id;
  };
  // A row of colour swatches: the natural ones first (free), then the premium ones.
  const swatches = (target: 'color' | 'beardColor') => (
    <div className="barber-swatches">
      {target === 'color'
        ? AVATAR_OPTIONS.hairColor.map((o) => (
            <button
              key={o.id}
              className="barber-swatch natural"
              style={{ background: o.color }}
              aria-label={t(`character.opt.hairColor.${o.id}` as MessageKey)}
              aria-pressed={natHair ? natHair === o.id : !triedIn('color') && !worn.color && avatar.hairColor === o.id}
              onClick={() => tryHair(o.id)}
            />
          ))
        : NATURAL_BEARD.map(([id, color]) => (
            <button
              key={id}
              className="barber-swatch natural"
              style={{ background: color }}
              aria-label={t('barber.natural')}
              aria-pressed={swatchOn('beardColor', id)}
              onClick={() => {
                setNatLast(false);
                tryOn(id, 'beardColor');
              }}
            />
          ))}
      {items('color').map((item) => (
        <button
          key={item.id}
          className="barber-swatch"
          style={{ background: colorSwatch(item.id) }}
          aria-label={name(item.id)}
          aria-pressed={swatchOn(target, item.id)}
          onClick={() => tryPremium(item.id, target)}
        >
          {!store?.owned.has(item.id) && <span className="barber-lock">{item.price}</span>}
        </button>
      ))}
    </div>
  );
  const balance = store && (
    <span className="store-balance" title={t('coins.balance', { n: String(store.balance) })}>
      <CoinIcon />
      {store.balance}
    </span>
  );

  return (
    <main className="store-page">
      <div className="barber">
        {/* Phones: the kinds as a rail. */}
        <div className="store-tabs barber-tabs" role="tablist">
          {BARBER_SLOTS.map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={kind === s}
              className={kind === s ? 'on' : ''}
              onClick={() => {
                setKind(s);
                if (s === 'cut' || s === 'beard') setList(s);
              }}
            >
              <svg className="cp-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d={SHOP_ICONS[s]} />
              </svg>
              <span className="cp-short">{t(`barber.short.${s}` as MessageKey)}</span>
            </button>
          ))}
          <button className="shop-switch" onClick={() => onOpen('/street')}>
            <svg className="cp-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d={STREET_ICON} />
            </svg>
            <span className="cp-short">{t('menu.streetShort')}</span>
          </button>
          <span className="barber-pole" aria-hidden="true" />
          {store && (
            <span className="store-rail-balance" title={t('coins.balance', { n: String(store.balance) })}>
              <CoinIcon />
              {store.balance}
            </span>
          )}
        </div>
        {/* Left: the cuts or the beards (two kinds, one list); on phones the rail picks the kind. */}
        <section
          className={`barber-panel barber-cuts${kind === 'cut' || kind === 'beard' ? ' on' : ''}`}
          role="tabpanel"
          aria-label={t(`barber.slot.${list}` as MessageKey)}
        >
          <h1 className="store-title">{t('barber.title')}</h1>
          <div className="barber-kinds" role="tablist">
            {(['cut', 'beard'] as const).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={list === k}
                className={list === k ? 'on' : ''}
                onClick={() => {
                  setList(k);
                  setKind(k);
                }}
              >
                {t(`barber.short.${k}` as MessageKey)}
              </button>
            ))}
          </div>
          <div className="barber-list">
            {items(list).map((item) => (
              <button
                key={item.id}
                className="barber-row"
                aria-pressed={isTrying(item.id)}
                aria-label={name(item.id)}
                onClick={() => tryPremium(item.id, list)}
              >
                {preview(item)}
                <b>{name(item.id)}</b>
                {price(item)}
              </button>
            ))}
          </div>
        </section>
        <div className="barber-chair">
          <div className="barber-chair-top">
            {balance}
            <button className="link-button" onClick={() => onOpen('/street')}>
              ← {t('street.back')}
            </button>
          </div>
          <div className="barber-mirror">
            {/* The hat comes off at the barber's. */}
            <AvatarView avatar={mirrorAvatar} outfit={mirrorOutfit} view={TALL_VIEW} />
          </div>
          <span className="barber-pole" aria-hidden="true" />
          <div className="store-booth-foot">
            {natLast && footer ? (
              <>
                <b className="store-tried">{footer.label}</b>
                {footer.action}
              </>
            ) : cart.length ? (
              <FittingCart shop={shop} />
            ) : (
              <span className="store-label">{t('barber.pick')}</span>
            )}
            <p className={msg?.bad ? 'store-msg bad' : 'store-msg'} role="status">
              {msg?.text ?? ''}
            </p>
          </div>
        </div>
        <aside className="barber-side">
          {/* Right: only the colours, the hair's and the beard's. */}
          <section className={`${panel('color')} barber-colors`} aria-label={t('barber.slot.color')}>
            <h2 className="store-label">{t('barber.hairColor')}</h2>
            {swatches('color')}
            <h2 className="store-label">{t('barber.beardColor')}</h2>
            {swatches('beardColor')}
          </section>
        </aside>
        {/* Phones: the tried item and its button stay at the bottom. */}
        <div className="store-bar">
          <div className="store-bar-text">
            <b>{footer ? footer.label : t('barber.pick')}</b>
            <span className={msg?.bad ? 'store-msg bad' : 'store-msg'}>{msg?.text ?? footer?.note ?? ''}</span>
          </div>
          {footer?.action}
        </div>
      </div>
    </main>
  );
}
