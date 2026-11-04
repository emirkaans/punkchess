import { useEffect, useState } from 'react';
import { EMPTY_OUTFIT, clothesOf, naturalBeard, storeItem, wearKombin } from '../avatar/outfit.ts';
import type { Outfit, OutfitSlot, StoreItem } from '../avatar/outfit.ts';
import type { MessageKey } from '../i18n/index.ts';
import { refreshAccount, useAccount } from './account.ts';
import { refreshCoins } from './coins.ts';
import { CoinIcon } from './CoinToast.tsx';
import { useI18n } from './i18n.tsx';

interface ShopState {
  readonly owned: ReadonlySet<string>;
  readonly outfit: Outfit;
  readonly balance: number;
  readonly kombins: readonly (Outfit | null)[];
}

interface StoreData {
  owned: string[];
  outfit: Outfit;
  balance: number;
  kombins: (Outfit | null)[];
}
const stateOf = (d: StoreData): ShopState => ({ ...d, owned: new Set(d.owned) });

/**
 * A shop's state and actions, shared by the store and the barber: what the player owns and
 * wears, the item being tried on, and buying, wearing and taking off (server/store.ts).
 */
export function useShop() {
  const { t } = useI18n();
  const account = useAccount();
  const [store, setStore] = useState<ShopState | null>(null);
  // What is tried on, one item per slot (a cut, its colour and a beard can be tried together);
  // the last one tried is the one the buy button is for.
  const [tries, setTries] = useState<Partial<Record<OutfitSlot, string>>>({});
  const [last, setLast] = useState<OutfitSlot | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  const userId = account.user?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    void fetch('/api/store', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: StoreData | null) => {
        if (d) setStore(stateOf(d));
      })
      .catch(() => {});
  }, [userId]);

  const name = (id: string) => t(`store.item.${id}` as MessageKey);
  const worn = store?.outfit ?? EMPTY_OUTFIT;
  const trying = last ? (tries[last] ?? null) : null;
  const tried = trying ? storeItem(trying) : undefined;
  /** The slot the last tried item goes to (a hair colour may be tried on the beard). */
  const triedSlot = tried ? last! : null;
  /** What the character wears with everything tried on. */
  const shown: Outfit = { ...worn, ...tries };
  /** Whether `id` is being tried in `slot` (its own slot by default). */
  const isTrying = (id: string, slot: OutfitSlot | undefined = storeItem(id)?.slot) => !!slot && tries[slot] === id;

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

  const act = async (item: StoreItem, slot: OutfitSlot = item.slot) => {
    if (!store) return;
    if (store.owned.has(item.id)) {
      // Owned: put on, or take off when already worn.
      const on = store.outfit[slot] === item.id;
      const outfit = { ...store.outfit, [slot]: on ? null : item.id };
      const r = await send('/api/me/outfit', { outfit });
      if (!r.ok) return setMsg({ text: t('store.error'), bad: true });
      setStore({ ...store, outfit });
      setMsg({ text: t(on ? 'store.takenOff' : 'store.wearing', { item: name(item.id) }) });
    } else {
      const r = await send('/api/store/buy', { item: item.id, wear: slot });
      if (!r.ok) {
        return setMsg({ text: t(r.data?.error === 'not-enough' ? 'store.notEnough' : 'store.error'), bad: true });
      }
      setStore(stateOf(r.data as unknown as StoreData));
      setMsg({ text: t('store.bought', { item: name(item.id), n: String(item.price) }) });
    }
    setTries(({ [slot]: _done, ...rest }) => rest);
    setLast(null);
    void refreshCoins();
    void refreshAccount();
  };

  /** Puts on what needs no buying (a natural beard colour, or nothing) in `slot`. */
  const wearFree = async (slot: OutfitSlot, id: string | null) => {
    if (!store) return;
    const outfit = { ...store.outfit, [slot]: id };
    const r = await send('/api/me/outfit', { outfit });
    if (!r.ok) return setMsg({ text: t('store.error'), bad: true });
    setStore({ ...store, outfit });
    setTries(({ [slot]: _done, ...rest }) => rest);
    setLast(null);
    void refreshAccount();
  };

  /** An item's button: buy (with its price), wear or take off. */
  const button = (item: StoreItem, slot: OutfitSlot = item.slot) => {
    const owned = store?.owned.has(item.id) ?? false;
    const on = store?.outfit[slot] === item.id;
    const short = !owned && (store?.balance ?? 0) < item.price;
    return (
      <button
        className={owned ? (on ? 'store-buy worn' : 'store-buy wear') : 'store-buy'}
        disabled={!store || busy || short}
        title={short ? t('store.notEnough') : undefined}
        onClick={(e) => {
          e.stopPropagation();
          void act(item, slot);
        }}
      >
        {owned ? t(on ? 'store.takeOff' : 'store.wear') : t('store.buy', { n: String(item.price) })}
      </button>
    );
  };

  /** What is tried on in `slot`, or null. */
  const triedIn = (slot: OutfitSlot): string | null => tries[slot] ?? null;
  /** Stops trying anything in `slot`. */
  const untry = (slot: OutfitSlot) => {
    setTries(({ [slot]: _old, ...rest }) => rest);
    if (last === slot) setLast(null);
  };

  /**
   * The fitting room's basket: everything tried on, each with its price (0 when owned or a free
   * beard colour), and the total still to pay.
   */
  const cart = (Object.entries(tries) as [OutfitSlot, string][]).map(([slot, id]) => {
    const item = storeItem(id);
    const free = !item || (store?.owned.has(id) ?? false);
    return { slot, id, item, price: free ? 0 : item!.price, natural: !item && naturalBeard(id) !== null };
  });
  const total = cart.reduce((sum, c) => sum + c.price, 0);

  /** Buys what is not owned yet in the basket and wears all of it (one charge, all or nothing). */
  const buyAll = async () => {
    if (!store || !cart.length) return;
    const r = await send('/api/store/buy', { items: cart.map((c) => ({ item: c.id, wear: c.slot })) });
    if (!r.ok) {
      return setMsg({ text: t(r.data?.error === 'not-enough' ? 'store.notEnough' : 'store.error'), bad: true });
    }
    setStore(stateOf(r.data as unknown as StoreData));
    setMsg({ text: total ? t('store.boughtAll', { n: String(total) }) : t('store.woreAll') });
    setTries({});
    setLast(null);
    void refreshCoins();
    void refreshAccount();
  };

  /**
   * The basket's button: one item keeps its own (buy, wear or take off); several (or a free
   * beard colour) get "buy all" / "wear all".
   */
  const cartButton = (className = '') => {
    const single = cart.length === 1 ? cart[0] : null;
    if (single?.item) return button(single.item, single.slot);
    const short = (store?.balance ?? 0) < total;
    return (
      <button
        className={`store-buy ${className}`}
        disabled={!store || busy || short}
        title={short ? t('store.notEnough') : undefined}
        onClick={() => void buyAll()}
      >
        {total ? t('store.buyAll', { n: String(total) }) : t('store.wearAll')}
      </button>
    );
  };

  /** Tries an item on (in its own slot, or another it fits), or stops trying it. */
  const tryOn = (id: string, slot: OutfitSlot | undefined = storeItem(id)?.slot) => {
    if (!slot) return;
    const off = tries[slot] === id;
    setTries(({ [slot]: _old, ...rest }) => (off ? rest : { ...rest, [slot]: id }));
    setLast(off ? null : slot);
    setMsg(null);
  };

  /** Puts on a saved outfit (its clothes; the hair and beard stay). */
  const wearSaved = async (i: number) => {
    const kombin = store?.kombins[i];
    if (!store || !kombin) return;
    const outfit = wearKombin(store.outfit, kombin);
    const r = await send('/api/me/outfit', { outfit });
    if (!r.ok) return setMsg({ text: t('store.error'), bad: true });
    setStore({ ...store, outfit });
    setMsg({ text: t('wardrobe.worn', { n: String(i + 1) }) });
    void refreshAccount();
  };

  /** Saves the clothes worn now in place `i`, or with `remove` empties it. */
  const saveKombin = async (i: number, remove = false) => {
    if (!store) return;
    const r = await send('/api/me/kombin', { index: i, outfit: remove ? null : clothesOf(store.outfit) });
    if (!r.ok) return setMsg({ text: t('store.error'), bad: true });
    setStore({ ...store, kombins: (r.data as unknown as { kombins: (Outfit | null)[] }).kombins });
    setMsg({ text: t(remove ? 'wardrobe.deleted' : 'wardrobe.saved', { n: String(i + 1) }) });
  };

  return {
    store,
    trying,
    tried,
    triedSlot,
    isTrying,
    shown,
    msg,
    name,
    button,
    tryOn,
    triedIn,
    untry,
    cart,
    total,
    buyAll,
    cartButton,
    act,
    wearFree,
    busy,
    wearSaved,
    saveKombin,
  };
}

/** The way back to Punk Street (a storefront with an arrow). */
export const STREET_ICON = 'M3 9l2-5h14l2 5zM4 9v11h16V9M10 20v-6h4v6M9 13H5';

/** Each kind's icon for the shops' phone rails (24×24 strokes). */
export const SHOP_ICONS: Readonly<Record<OutfitSlot, string>> = {
  jacket: 'M8 3l-5 4 2 4 2-1v11h10V10l2 1 2-4-5-4-2 3h-4z',
  pants: 'M6 3h12l1 18h-5l-2-10-2 10H5z',
  skirt: 'M8 4h8l5 16H3zM8 4h8',
  hat: 'M4 16c0-6 4-10 8-10s8 4 8 10zM2 16h20',
  eyewear: 'M7 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM17 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM11 13h2',
  neck: 'M6 4c0 9 3 13 6 13s6-4 6-13M12 17v3',
  shoes: 'M4 6h6v8l9 3c1 .4 1 2 0 3H4zM4 17h16',
  acc: 'M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H4zM17 14h3v6h-3z',
  cut: 'M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM8 16L19 4M16 16L5 4',
  color: 'M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z',
  beard: 'M5 9c0 7 3 12 7 12s7-5 7-12c-2 2-4 3-7 3S7 11 5 9z',
  beardColor: 'M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z',
};

/**
 * The fitting room's basket (store and barber): every item tried on, its price or "yours", a ×
 * to take it off, and one button that buys what is not owned and wears it all.
 */
export function FittingCart({ shop }: { shop: ReturnType<typeof useShop> }) {
  const { t } = useI18n();
  const { cart, untry, name } = shop;
  if (!cart.length) return null;
  const label = (c: (typeof cart)[number]) =>
    c.natural
      ? t('barber.beardColor')
      : name(c.id) + (c.slot === 'beardColor' && c.item?.slot === 'color' ? ` · ${t('barber.onBeard')}` : '');
  return (
    <div className="fit-cart">
      <ul className="fit-cart-list">
        {cart.map((c) => (
          <li key={c.slot}>
            <span className="fit-cart-name">{label(c)}</span>
            {c.price ? (
              <span className="store-price">
                <CoinIcon />
                {c.price}
              </span>
            ) : (
              <span className="store-owned">{c.natural ? t('store.free') : t('store.owned')}</span>
            )}
            <button className="fit-cart-x" aria-label={t('store.cart.remove')} onClick={() => untry(c.slot)}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="fit-cart-buy">{shop.cartButton()}</div>
    </div>
  );
}
