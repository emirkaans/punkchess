import { useEffect, useState } from 'react';
import { EMPTY_OUTFIT, clothesOf, storeItem, wearKombin } from '../avatar/outfit.ts';
import type { Outfit, OutfitSlot, StoreItem } from '../avatar/outfit.ts';
import type { MessageKey } from '../i18n/index.ts';
import { refreshAccount, useAccount } from './account.ts';
import { refreshCoins } from './coins.ts';
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
  const [trying, setTrying] = useState<string | null>(null);
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
  const tried = trying ? storeItem(trying) : undefined;
  /** What the character wears with the tried item on. */
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
      setStore(stateOf(r.data as unknown as StoreData));
      setMsg({ text: t('store.bought', { item: name(item.id), n: String(item.price) }) });
    }
    setTrying(null);
    void refreshCoins();
    void refreshAccount();
  };

  /** An item's button: buy (with its price), wear or take off. */
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

  /** Tries an item on, or stops trying it. */
  const tryOn = (id: string) => {
    setTrying(trying === id ? null : id);
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

  return { store, trying, tried, shown, msg, name, button, tryOn, act, busy, wearSaved, saveKombin };
}

/** Each kind's icon for the shops' phone rails (24×24 strokes). */
export const SHOP_ICONS: Readonly<Record<OutfitSlot, string>> = {
  jacket: 'M8 3l-5 4 2 4 2-1v11h10V10l2 1 2-4-5-4-2 3h-4z',
  pants: 'M6 3h12l1 18h-5l-2-10-2 10H5z',
  hat: 'M4 16c0-6 4-10 8-10s8 4 8 10zM2 16h20',
  acc: 'M7 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM17 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM11 13h2',
  cut: 'M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM8 16L19 4M16 16L5 4',
  color: 'M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z',
  beard: 'M5 9c0 7 3 12 7 12s7-5 7-12c-2 2-4 3-7 3S7 11 5 9z',
};
