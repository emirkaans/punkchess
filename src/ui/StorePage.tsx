import { useEffect, useState } from 'react';
import { DEFAULT_AVATAR } from '../avatar/avatar.ts';
import { figureSvg, itemView } from '../avatar/figure.ts';
import { EMPTY_OUTFIT, OUTFIT_SLOTS, STORE_ITEMS, storeItem } from '../avatar/outfit.ts';
import type { Outfit, OutfitSlot, StoreItem } from '../avatar/outfit.ts';
import type { MessageKey } from '../i18n/index.ts';
import { refreshAccount, signInWithGoogle, useAccount } from './account.ts';
import { refreshCoins } from './coins.ts';
import { CoinIcon } from './CoinToast.tsx';
import { useI18n } from './i18n.tsx';

interface StoreState {
  readonly owned: ReadonlySet<string>;
  readonly outfit: Outfit;
  readonly balance: number;
}

/** Each kind's icon for the phone rail (24×24 strokes). */
const SLOT_ICONS: Readonly<Record<OutfitSlot, string>> = {
  jacket: 'M8 3l-5 4 2 4 2-1v11h10V10l2 1 2-4-5-4-2 3h-4z',
  pants: 'M6 3h12l1 18h-5l-2-10-2 10H5z',
  hat: 'M4 16c0-6 4-10 8-10s8 4 8 10zM2 16h20',
  acc: 'M7 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM17 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM11 13h2',
};

const Figure = ({ svg, className }: { svg: string; className: string }) => (
  <span className={className} dangerouslySetInnerHTML={{ __html: svg }} />
);

/**
 * The store ("Butik"): a fitting room on the left (the character full length, wearing what is
 * tried on), the goods by kind on the right; an item is bought with punk coins, then worn or
 * taken off. Coins only buy looks.
 */
export function StorePage() {
  const { t } = useI18n();
  const account = useAccount();
  const avatar = account.user?.avatar ?? DEFAULT_AVATAR;
  const [store, setStore] = useState<StoreState | null>(null);
  const [slot, setSlot] = useState<OutfitSlot>('jacket');
  const [trying, setTrying] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  const userId = account.user?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    void fetch('/api/store', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { owned: string[]; outfit: Outfit; balance: number } | null) => {
        if (d) setStore({ owned: new Set(d.owned), outfit: d.outfit, balance: d.balance });
      })
      .catch(() => {});
  }, [userId]);

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

  const name = (id: string) => t(`store.item.${id}` as MessageKey);
  const worn = store?.outfit ?? EMPTY_OUTFIT;
  const tried = trying ? storeItem(trying) : undefined;
  const shown: Outfit = tried ? { ...worn, [tried.slot]: tried.id } : worn;

  const send = async (url: string, body: unknown) => {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: res.ok, data };
    } finally {
      setBusy(false);
    }
  };

  const act = async (item: StoreItem) => {
    if (!store) return;
    if (store.owned.has(item.id)) {
      // Owned: put on, or take off when already worn.
      const on = store.outfit[item.slot] === item.id;
      const outfit = { ...store.outfit, [item.slot]: on ? null : item.id };
      const r = await send('/api/me/outfit', { outfit });
      if (!r.ok) return setMsg({ text: t('store.error'), bad: true });
      setStore({ ...store, outfit });
      setMsg({ text: t(on ? 'store.takenOff' : 'store.wearing', { item: name(item.id) }) });
    } else {
      const r = await send('/api/store/buy', { item: item.id });
      if (!r.ok) {
        return setMsg({ text: t(r.data?.error === 'not-enough' ? 'store.notEnough' : 'store.error'), bad: true });
      }
      const d = r.data as unknown as { owned: string[]; outfit: Outfit; balance: number };
      setStore({ owned: new Set(d.owned), outfit: d.outfit, balance: d.balance });
      setMsg({ text: t('store.bought', { item: name(item.id), n: String(item.price) }) });
    }
    setTrying(null);
    void refreshCoins();
    void refreshAccount();
  };

  const button = (item: StoreItem) => {
    const owned = store?.owned.has(item.id) ?? false;
    const on = store?.outfit[item.slot] === item.id;
    const short = !owned && (store?.balance ?? 0) < item.price;
    return (
      <button
        className={owned ? (on ? 'store-buy worn' : 'store-buy wear') : 'store-buy'}
        disabled={!store || busy || short}
        title={short ? t('store.notEnough') : undefined}
        onClick={(e) => {
          e.stopPropagation();
          void act(item);
        }}
      >
        {owned ? t(on ? 'store.takeOff' : 'store.wear') : t('store.buy', { n: String(item.price) })}
      </button>
    );
  };

  return (
    <main className="store-page">
      <div className="store">
        <aside className="store-booth">
          <span className="store-label">{t('store.booth')}</span>
          <Figure svg={figureSvg(avatar, shown)} className="store-figure" />
          <div className="store-booth-foot">
            {tried ? (
              <>
                <b className="store-tried">{name(tried.id)}</b>
                {button(tried)}
              </>
            ) : (
              <span className="store-label">{t('store.pick')}</span>
            )}
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
            {OUTFIT_SLOTS.map((s) => (
              <button
                key={s}
                role="tab"
                aria-selected={slot === s}
                className={slot === s ? 'on' : ''}
                onClick={() => setSlot(s)}
              >
                {/* Phones: an icon and a short name in a narrow rail; wider screens: the full name. */}
                <svg className="cp-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d={SLOT_ICONS[s]} />
                </svg>
                <span className="cp-full">{t(`store.slot.${s}` as MessageKey)}</span>
                <span className="cp-short" aria-hidden="true">
                  {t(`store.short.${s}` as MessageKey)}
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
            {STORE_ITEMS.filter((i) => i.slot === slot).map((item) => (
              <div
                key={item.id}
                className={trying === item.id ? 'store-card on' : 'store-card'}
                role="button"
                tabIndex={0}
                aria-pressed={trying === item.id}
                aria-label={name(item.id)}
                onClick={() => setTrying(trying === item.id ? null : item.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setTrying(trying === item.id ? null : item.id);
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
            <b>{tried ? name(tried.id) : t('store.pick')}</b>
            <span className={msg?.bad ? 'store-msg bad' : 'store-msg'}>
              {msg?.text ??
                (tried
                  ? store?.owned.has(tried.id)
                    ? t('store.owned')
                    : t('coins.balance', { n: String(tried.price) })
                  : '')}
            </span>
          </div>
          {tried && button(tried)}
        </div>
      </div>
    </main>
  );
}
