// The week's window on Punk Street: from Monday 00:00 (Turkey's time) for seven days, one item of
// each shop a quarter off, and one jacket sold only that week (src/avatar/more.ts VITRIN_ITEMS,
// each back in turn eight weeks later). The same for everyone, from the week's date; the server
// charges these prices too (server/store.ts). Pure.

import { BARBER_SLOTS, SHOE_SLOTS, STORE_ITEMS, STORE_SLOTS, TATTOO_SLOTS } from '../avatar/outfit.ts';
import type { OutfitSlot, StoreItem } from '../avatar/outfit.ts';

/** Turkey is UTC+3 all year (as the daily puzzle's day: src/online/daily.ts). */
const OFFSET_MS = 3 * 3_600_000;
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
/** A Monday, at 00:00 in Turkey: the weeks count from it. */
const EPOCH = Date.UTC(2026, 0, 5) - OFFSET_MS;

/** The window's discount: a quarter off. */
export const VITRIN_OFF = 0.25;

/** The shops with an item in the window, each with its slots. */
export const VITRIN_SHOPS: readonly {
  readonly shop: 'store' | 'barber' | 'shoes' | 'tattoo';
  readonly slots: readonly OutfitSlot[];
}[] = [
  { shop: 'store', slots: STORE_SLOTS },
  { shop: 'barber', slots: BARBER_SLOTS },
  { shop: 'shoes', slots: SHOE_SLOTS },
  { shop: 'tattoo', slots: TATTOO_SLOTS },
];

export interface Vitrin {
  /** The week's number (0 for the week of 2026-01-05). */
  readonly week: number;
  /** When it changes (ms). */
  readonly endsAt: number;
  /** The jacket sold only this week. */
  readonly exclusive: string;
  /** One item of each shop, a quarter off (in VITRIN_SHOPS order). */
  readonly deals: readonly string[];
}

const weekOf = (now: number) => Math.floor((now - EPOCH) / WEEK_MS);

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const cache = new Map<number, Vitrin>();

/** The window of the week `now` is in. */
export function vitrinOf(now: number): Vitrin {
  const week = weekOf(now);
  const hit = cache.get(week);
  if (hit) return hit;
  const exclusives = STORE_ITEMS.filter((i) => i.vitrin);
  const deals = VITRIN_SHOPS.map(({ shop, slots }) => {
    const pool = STORE_ITEMS.filter((i) => !i.vitrin && slots.includes(i.slot));
    return pool[hash(`${week}|${shop}`) % pool.length].id;
  });
  const v: Vitrin = {
    week,
    endsAt: EPOCH + (week + 1) * WEEK_MS,
    exclusive: exclusives[((week % exclusives.length) + exclusives.length) % exclusives.length].id,
    deals,
  };
  cache.set(week, v);
  return v;
}

/** Can `item` be bought at `now`? Everything, but a window jacket only in its week. */
export const onSale = (item: StoreItem, now: number): boolean => !item.vitrin || vitrinOf(now).exclusive === item.id;

/** Is `item` a quarter off at `now`? */
export const onDeal = (item: StoreItem, now: number): boolean => vitrinOf(now).deals.includes(item.id);

/** What `item` costs at `now`. */
export const priceOf = (item: StoreItem, now: number): number =>
  onDeal(item, now) ? Math.round(item.price * (1 - VITRIN_OFF)) : item.price;

/** `item` with the price it costs at `now` (the server charges this one). */
export const pricedNow = (item: StoreItem, now: number): StoreItem => ({ ...item, price: priceOf(item, now) });
