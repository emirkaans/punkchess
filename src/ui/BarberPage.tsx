import { useState } from 'react';
import { AVATAR_OPTIONS, DEFAULT_AVATAR, TALL_VIEW } from '../avatar/avatar.ts';
import { colorSwatch } from '../avatar/barber.ts';
import { BARBER_SLOTS, EMPTY_OUTFIT, NATURAL_BEARD, STORE_ITEMS, naturalBeard } from '../avatar/outfit.ts';
import type { OutfitSlot, StoreItem } from '../avatar/outfit.ts';
import type { MessageKey } from '../i18n/index.ts';
import { refreshAccount, signInWithGoogle, useAccount } from './account.ts';
import { AvatarView } from './CharacterCreator.tsx';
import { CoinIcon } from './CoinToast.tsx';
import { useI18n } from './i18n.tsx';
import { SHOP_ICONS, useShop } from './shop.tsx';

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
  const { store, trying, tried, triedSlot, isTrying, shown, msg, name, button, tryOn, wearFree, busy } = useShop();
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
  const tryHair = (id: string) => {
    setNatHair(natHair === id ? null : id);
    setNatLast(natHair !== id);
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
  const naturalBeardTried = !natLast && trying !== null && naturalBeard(trying) !== null;
  // Below the mirror: the last thing picked, and its button.
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
      : naturalBeardTried
        ? {
            label: t('barber.beardColor'),
            note: t('barber.natural'),
            action:
              worn.beardColor === trying ? null : (
                <button className="store-buy wear" disabled={busy} onClick={() => void wearFree('beardColor', trying)}>
                  {t('barber.use')}
                </button>
              ),
          }
        : tried
          ? {
              label: name(tried.id) + (triedSlot === 'beardColor' ? ` · ${t('barber.onBeard')}` : ''),
              note: store?.owned.has(tried.id) ? t('store.owned') : t('coins.balance', { n: String(tried.price) }),
              action: button(tried, triedSlot ?? tried.slot),
            }
          : null;
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
              aria-pressed={natHair ? natHair === o.id : !worn.color && avatar.hairColor === o.id}
              onClick={() => tryHair(o.id)}
            />
          ))
        : NATURAL_BEARD.map(([id, color]) => (
            <button
              key={id}
              className="barber-swatch natural"
              style={{ background: color }}
              aria-label={t('barber.natural')}
              aria-pressed={isTrying(id, 'beardColor') || (!trying && worn.beardColor === id)}
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
          aria-pressed={isTrying(item.id, target) || (!isTrying(item.id, target) && worn[target] === item.id)}
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
              onClick={() => setKind(s)}
            >
              <svg className="cp-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d={SHOP_ICONS[s]} />
              </svg>
              <span className="cp-short">{t(`barber.short.${s}` as MessageKey)}</span>
            </button>
          ))}
          <button className="shop-switch" onClick={() => onOpen('/store')}>
            <svg className="cp-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d={SHOP_ICONS.jacket} />
            </svg>
            <span className="cp-short">{t('barber.toStore')}</span>
          </button>
          <span className="barber-pole" aria-hidden="true" />
          {store && (
            <span className="store-rail-balance" title={t('coins.balance', { n: String(store.balance) })}>
              <CoinIcon />
              {store.balance}
            </span>
          )}
        </div>
        <section className={`${panel('cut')} barber-cuts`} role="tabpanel" aria-label={t('barber.slot.cut')}>
          <h1 className="store-title">{t('barber.title')}</h1>
          <div className="barber-list">
            {items('cut').map((item) => (
              <button
                key={item.id}
                className="barber-row"
                aria-pressed={isTrying(item.id)}
                aria-label={name(item.id)}
                onClick={() => tryPremium(item.id, 'cut')}
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
            <button className="link-button" onClick={() => onOpen('/store')}>
              {t('store.title')} →
            </button>
          </div>
          <div className="barber-mirror">
            {/* The hat comes off at the barber's. */}
            <AvatarView avatar={mirrorAvatar} outfit={mirrorOutfit} view={TALL_VIEW} />
          </div>
          <span className="barber-pole" aria-hidden="true" />
          <div className="store-booth-foot">
            {footer ? (
              <>
                <b className="store-tried">{footer.label}</b>
                {footer.action}
              </>
            ) : (
              <span className="store-label">{t('barber.pick')}</span>
            )}
            <p className={msg?.bad ? 'store-msg bad' : 'store-msg'} role="status">
              {msg?.text ?? ''}
            </p>
          </div>
        </div>
        <aside className="barber-side">
          <section className={`${panel('color')} barber-colors`} aria-label={t('barber.slot.color')}>
            <h2 className="store-label">{t('barber.hairColor')}</h2>
            {swatches('color')}
            <h2 className="store-label">{t('barber.beardColor')}</h2>
            {swatches('beardColor')}
          </section>
          <section className={`${panel('beard')} barber-beards`} aria-label={t('barber.slot.beard')}>
            <h2 className="store-label">{t('barber.slot.beard')}</h2>
            <div className="barber-grid">
              {items('beard').map((item) => (
                <button
                  key={item.id}
                  className="barber-opt"
                  aria-pressed={isTrying(item.id)}
                  aria-label={name(item.id)}
                  onClick={() => tryPremium(item.id, 'beard')}
                >
                  {preview(item)}
                  <b>{name(item.id)}</b>
                  {price(item)}
                </button>
              ))}
            </div>
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
