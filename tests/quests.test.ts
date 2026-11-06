// Daily quests (src/quests/rules.ts, server/quests.ts) and the week's window (src/store/vitrin.ts).
// The server's part: tests/server/quests.test.ts.

import { describe, expect, it } from 'vitest';
import { STORE_ITEMS, storeItem } from '../src/avatar/outfit.ts';
import { QUESTS, advance, questsOf, streakOf } from '../src/quests/rules.ts';
import type { QuestEvent } from '../src/quests/rules.ts';
import { VITRIN_SHOPS, onDeal, onSale, priceOf, vitrinOf } from '../src/store/vitrin.ts';

const game = (over: Partial<Extract<QuestEvent, { k: 'game' }>> = {}): QuestEvent => ({
  k: 'game',
  finished: true,
  won: false,
  color: 'w',
  variantId: 'standard',
  checkmate: false,
  tournament: false,
  card: false,
  beatHigher: false,
  ...over,
});

describe('günlük görevler: kurallar', () => {
  it('her gün kolay, orta, zor birer görev; herkese ve her güne göre, değiştirilince aynı zorluktan bir başkası', () => {
    const a = questsOf('u1', '2026-11-07');
    expect(a.map((q) => q.tier)).toEqual([1, 2, 3]);
    expect(questsOf('u1', '2026-11-07').map((q) => q.id)).toEqual(a.map((q) => q.id));
    const swapped = questsOf('u1', '2026-11-07', 1);
    expect(swapped[0].id).toBe(a[0].id);
    expect(swapped[1].id).not.toBe(a[1].id);
    expect(swapped[1].tier).toBe(2);
    const days = new Set(Array.from({ length: 30 }, (_, i) => questsOf('u1', `2026-12-${i + 1}`)[2].id));
    expect(days.size).toBeGreaterThan(2);
  });

  it('olaylar görevleri ilerletir, hedefte durur; bitmemiş oyun ve bot sayılmaz', () => {
    const qs = [
      QUESTS.find((q) => q.id === 'play1')!,
      QUESTS.find((q) => q.id === 'win2')!,
      QUESTS.find((q) => q.id === 'mate')!,
    ];
    let p = advance(qs, [0, 0, 0], game({ finished: false, won: true, checkmate: true }));
    expect(p).toEqual([0, 0, 0]);
    p = advance(qs, p, game({ won: true }));
    expect(p).toEqual([1, 1, 0]);
    p = advance(qs, p, game({ won: true, checkmate: true }));
    p = advance(qs, p, game({ won: true, checkmate: true }));
    expect(p).toEqual([1, 2, 1]);
    expect(advance(qs, [0, 0, 0], { k: 'puzzle' })).toEqual([0, 0, 0]);
  });

  it('seri: bugün ya da dün biten günlerden geriye, boşlukta durur', () => {
    expect(streakOf(['2026-11-05', '2026-11-06'], '2026-11-07')).toBe(2);
    expect(streakOf(['2026-11-05', '2026-11-06', '2026-11-07'], '2026-11-07')).toBe(3);
    expect(streakOf(['2026-11-04', '2026-11-06'], '2026-11-07')).toBe(1);
    expect(streakOf(['2026-11-05'], '2026-11-07')).toBe(0);
  });
});

describe('haftanın vitrini', () => {
  const monday = Date.UTC(2026, 10, 9) - 3 * 3_600_000;

  it('hafta boyunca aynı, pazartesi 00:00 (Türkiye) değişir; her dükkandan bir indirim ve bir özel ceket', () => {
    const v = vitrinOf(monday + 1000);
    expect(vitrinOf(monday + 6 * 86_400_000).week).toBe(v.week);
    expect(vitrinOf(monday - 1000).week).toBe(v.week - 1);
    expect(v.endsAt).toBe(monday + 7 * 86_400_000);
    expect(v.deals).toHaveLength(VITRIN_SHOPS.length);
    v.deals.forEach((id, i) => {
      const item = storeItem(id)!;
      expect(VITRIN_SHOPS[i].slots).toContain(item.slot);
      expect(item.vitrin).toBeUndefined();
      expect(priceOf(item, monday + 1000)).toBe(Math.round(item.price * 0.75));
      expect(onDeal(item, monday + 1000)).toBe(true);
    });
    expect(storeItem(v.exclusive)!.vitrin).toBe(true);
  });

  it('özel ceketler sırayla gelir; yalnız kendi haftasında satılır', () => {
    const exclusives = STORE_ITEMS.filter((i) => i.vitrin);
    expect(exclusives.length).toBe(8);
    const seen = new Set<string>();
    for (let w = 0; w < 8; w++) seen.add(vitrinOf(monday + w * 7 * 86_400_000).exclusive);
    expect(seen.size).toBe(8);
    const thisWeek = storeItem(vitrinOf(monday).exclusive)!;
    expect(onSale(thisWeek, monday)).toBe(true);
    expect(onSale(thisWeek, monday + 7 * 86_400_000)).toBe(false);
    expect(onSale(storeItem('leather')!, monday)).toBe(true);
  });
});
