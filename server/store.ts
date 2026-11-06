// The store (migrations/0020_store.sql, goods in src/avatar/outfit.ts): punk coins buy
// clothes, which only change looks. A purchase is one entry of −price in the coin ledger
// (reason 'store', ref the item: an item is never paid twice) and a row in user_items, written
// together and only when the balance covers the price.
//
//   GET  /api/store                  the signed-in player's items, outfit and balance
//   POST /api/store/buy { item }     buys an item (and puts it on)
//   POST /api/me/outfit { outfit }   wears owned items (null: nothing in that slot)
//   POST /api/me/kombin { index, outfit }   saves an outfit's clothes in the wardrobe (null: empties it)

import { onSale, pricedNow } from '../src/store/vitrin.ts';
import { dailyDay } from '../src/online/daily.ts';
import {
  KOMBIN_COUNT,
  OUTFIT_SLOTS,
  clothesOf,
  fitsSlot,
  naturalBeard,
  parseKombins,
  parseOutfit,
  serializeOutfit,
  storeItem,
  wearsOnlyOwned,
} from '../src/avatar/outfit.ts';
import type { Outfit, OutfitSlot, StoreItem } from '../src/avatar/outfit.ts';
import type { AuthEnv } from './auth.ts';
import { currentUser, sameOrigin } from './auth.ts';
import { coinBalance } from './coins.ts';

export interface StoreResponse {
  readonly owned: readonly string[];
  readonly outfit: Outfit;
  readonly balance: number;
  /** The wardrobe's saved outfits (clothes only; null: an empty place). */
  readonly kombins: readonly (Outfit | null)[];
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

async function owned(db: D1Database, userId: string): Promise<Set<string>> {
  const rows = await db
    .prepare('SELECT item_id FROM user_items WHERE user_id = ?1')
    .bind(userId)
    .all<{ item_id: string }>();
  return new Set(rows.results.map((r) => r.item_id));
}

async function kombinsOf(db: D1Database, userId: string): Promise<readonly (Outfit | null)[]> {
  const row = await db
    .prepare('SELECT kombins FROM users WHERE id = ?1')
    .bind(userId)
    .first<{ kombins: string | null }>();
  return parseKombins(row?.kombins ?? null);
}

async function outfitOf(db: D1Database, userId: string): Promise<Outfit> {
  const row = await db
    .prepare('SELECT outfit FROM users WHERE id = ?1')
    .bind(userId)
    .first<{ outfit: string | null }>();
  return parseOutfit(row?.outfit ?? null);
}

/**
 * The charge and the item for one purchase (run in a batch: each sees the ones before it). In a
 * purchase of several, `need` is what this and the items after it cost, and `first` is the
 * batch's first item: a later charge is only made when the first one was, so a balance spent
 * meanwhile by another request buys nothing rather than some of the items.
 */
const purchase = (
  db: D1Database,
  userId: string,
  item: StoreItem,
  now: number,
  need = item.price,
  first: string | null = null,
) => [
  db
    .prepare(
      `INSERT OR IGNORE INTO coin_ledger (user_id, amount, reason, ref, day, created_at)
       SELECT ?1, -?2, 'store', ?3, ?4, ?5
       WHERE (SELECT coalesce(sum(amount), 0) FROM coin_ledger WHERE user_id = ?1) >= ?6
         AND NOT EXISTS (SELECT 1 FROM user_items WHERE user_id = ?1 AND item_id = ?3)
         AND (?7 IS NULL OR EXISTS (SELECT 1 FROM coin_ledger WHERE user_id = ?1 AND reason = 'store' AND ref = ?7 AND created_at = ?5))`,
    )
    .bind(userId, item.price, item.id, dailyDay(now), now, need, first),
  db
    .prepare(
      `INSERT OR IGNORE INTO user_items (user_id, item_id, price, bought_at)
       SELECT ?1, ?2, ?3, ?4
       WHERE EXISTS (SELECT 1 FROM coin_ledger WHERE user_id = ?1 AND reason = 'store' AND ref = ?2)`,
    )
    .bind(userId, item.id, item.price, now),
];

/**
 * Everything tried on at once (the fitting room's "buy all"): the items not owned yet are bought
 * when the balance covers them all (else nothing is), then everything tried is worn. A natural beard
 * colour comes along free.
 */
async function buyMany(db: D1Database, userId: string, input: unknown[], now: number): Promise<Response> {
  const wanted: { slot: OutfitSlot; id: string; item: StoreItem | null }[] = [];
  for (const raw of input.slice(0, 24)) {
    const r = (raw && typeof raw === 'object' ? raw : {}) as { item?: unknown; wear?: unknown };
    if (typeof r.item !== 'string') continue;
    const found = storeItem(r.item);
    // This week's price (the window's quarter off); a window jacket only in its week.
    if (found && !onSale(found, now)) continue;
    const item = found ? pricedNow(found, now) : null;
    const slot = OUTFIT_SLOTS.find((s) => s === r.wear) ?? item?.slot;
    if (!slot) continue;
    if (item ? fitsSlot(slot, item) : slot === 'beardColor' && naturalBeard(r.item))
      wanted.push({ slot, id: r.item, item });
  }
  if (!wanted.length) return json({ error: 'bad-request' }, 400);
  const have = await owned(db, userId);
  const toBuy = [...new Map(wanted.filter((w) => w.item && !have.has(w.id)).map((w) => [w.id, w.item!])).values()];
  const total = toBuy.reduce((sum, i) => sum + i.price, 0);
  if (total > (await coinBalance(db, userId, now)).balance) return json({ error: 'not-enough' }, 409);
  let need = total;
  if (toBuy.length) {
    await db.batch(
      toBuy.flatMap((item, i) => {
        const statements = purchase(db, userId, item, now, need, i ? toBuy[0].id : null);
        need -= item.price;
        return statements;
      }),
    );
  }
  const items = await owned(db, userId);
  const outfit: Record<OutfitSlot, string | null> = { ...(await outfitOf(db, userId)) };
  for (const w of wanted) if (!w.item || items.has(w.id)) outfit[w.slot] = w.id;
  await db.prepare('UPDATE users SET outfit = ?1 WHERE id = ?2').bind(serializeOutfit(outfit), userId).run();
  const [coins, kombins] = await Promise.all([coinBalance(db, userId, now), kombinsOf(db, userId)]);
  if (toBuy.some((i) => !items.has(i.id))) return json({ error: 'not-enough' }, 409);
  return json({ owned: [...items], outfit, balance: coins.balance, kombins } satisfies StoreResponse);
}

/** Answers a store request, or returns null when `url` is not one. */
export async function handleStore(request: Request, env: AuthEnv, url: URL): Promise<Response | null> {
  const path = url.pathname;
  if (!path.startsWith('/api/store') && path !== '/api/me/outfit' && path !== '/api/me/kombin') return null;
  if (!env.DB) return json({ error: 'accounts-off' }, 503);
  const now = Date.now();

  if (path === '/api/store' && request.method === 'GET') {
    const user = await currentUser(request, env);
    if (!user) return json({ error: 'signed-out' }, 401);
    const [items, outfit, coins, kombins] = await Promise.all([
      owned(env.DB, user.id),
      outfitOf(env.DB, user.id),
      coinBalance(env.DB, user.id, now),
      kombinsOf(env.DB, user.id),
    ]);
    return json({ owned: [...items], outfit, balance: coins.balance, kombins } satisfies StoreResponse);
  }

  if (path === '/api/store/buy' && request.method === 'POST') {
    if (!sameOrigin(request, env.PUBLIC_ORIGIN || url.origin, url)) return json({ error: 'forbidden' }, 403);
    const user = await currentUser(request, env);
    if (!user) return json({ error: 'signed-out' }, 401);
    const body = (await request.json().catch(() => ({}))) as { item?: unknown; wear?: unknown; items?: unknown };
    if (Array.isArray(body.items)) return buyMany(env.DB, user.id, body.items, now);
    const found = typeof body.item === 'string' ? storeItem(body.item) : undefined;
    // This week's price (the window's quarter off); a window jacket only in its week.
    if (!found || !onSale(found, now)) return json({ error: 'not-found' }, 404);
    const item = pricedNow(found, now);
    // Where it goes on once bought: its own slot, or (a hair colour) the beard.
    const wear = body.wear === 'beardColor' && fitsSlot('beardColor', item) ? 'beardColor' : item.slot;
    // Both statements run in one transaction: the charge only when the balance covers it and the
    // item is not owned yet; the item only when this charge exists.
    await env.DB.batch([
      env.DB.prepare(
        `INSERT OR IGNORE INTO coin_ledger (user_id, amount, reason, ref, day, created_at)
         SELECT ?1, -?2, 'store', ?3, ?4, ?5
         WHERE (SELECT coalesce(sum(amount), 0) FROM coin_ledger WHERE user_id = ?1) >= ?2
           AND NOT EXISTS (SELECT 1 FROM user_items WHERE user_id = ?1 AND item_id = ?3)`,
      ).bind(user.id, item.price, item.id, dailyDay(now), now),
      env.DB.prepare(
        `INSERT OR IGNORE INTO user_items (user_id, item_id, price, bought_at)
         SELECT ?1, ?2, ?3, ?4
         WHERE EXISTS (SELECT 1 FROM coin_ledger WHERE user_id = ?1 AND reason = 'store' AND ref = ?2)`,
      ).bind(user.id, item.id, item.price, now),
    ]);
    const items = await owned(env.DB, user.id);
    if (!items.has(item.id)) return json({ error: 'not-enough' }, 409);
    // A new item goes on at once.
    const outfit = { ...(await outfitOf(env.DB, user.id)), [wear]: item.id };
    await env.DB.prepare('UPDATE users SET outfit = ?1 WHERE id = ?2').bind(serializeOutfit(outfit), user.id).run();
    const [coins, kombins] = await Promise.all([coinBalance(env.DB, user.id, now), kombinsOf(env.DB, user.id)]);
    return json({ owned: [...items], outfit, balance: coins.balance, kombins } satisfies StoreResponse);
  }

  if (path === '/api/me/outfit' && request.method === 'POST') {
    if (!sameOrigin(request, env.PUBLIC_ORIGIN || url.origin, url)) return json({ error: 'forbidden' }, 403);
    const user = await currentUser(request, env);
    if (!user) return json({ error: 'signed-out' }, 401);
    const body = (await request.json().catch(() => ({}))) as { outfit?: unknown };
    const outfit = parseOutfit(body.outfit);
    if (!wearsOnlyOwned(outfit, await owned(env.DB, user.id))) return json({ error: 'not-owned' }, 403);
    await env.DB.prepare('UPDATE users SET outfit = ?1 WHERE id = ?2').bind(serializeOutfit(outfit), user.id).run();
    return json({ outfit });
  }

  if (path === '/api/me/kombin' && request.method === 'POST') {
    if (!sameOrigin(request, env.PUBLIC_ORIGIN || url.origin, url)) return json({ error: 'forbidden' }, 403);
    const user = await currentUser(request, env);
    if (!user) return json({ error: 'signed-out' }, 401);
    const body = (await request.json().catch(() => ({}))) as { index?: unknown; outfit?: unknown };
    const index = body.index;
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= KOMBIN_COUNT)
      return json({ error: 'bad-request' }, 400);
    const kombin = body.outfit === null ? null : clothesOf(parseOutfit(body.outfit));
    if (kombin && !wearsOnlyOwned(kombin, await owned(env.DB, user.id))) return json({ error: 'not-owned' }, 403);
    const kombins = (await kombinsOf(env.DB, user.id)).map((k, i) => (i === index ? kombin : k));
    await env.DB.prepare('UPDATE users SET kombins = ?1 WHERE id = ?2')
      .bind(JSON.stringify(kombins.map((k) => (k ? JSON.parse(serializeOutfit(k)) : null))), user.id)
      .run();
    return json({ kombins });
  }

  return json({ error: 'not-found' }, 404);
}
