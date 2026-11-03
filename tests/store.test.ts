import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR, TALL_VIEW, avatarSvg } from '../src/avatar/avatar.ts';
import { figureSvg, itemView } from '../src/avatar/figure.ts';
import {
  BARBER_SLOTS,
  EMPTY_OUTFIT,
  OUTFIT_SLOTS,
  STORE_SLOTS,
  parseKombins,
  wearKombin,
  STORE_ITEMS,
  parseOutfit,
  serializeOutfit,
  wearsOnlyOwned,
} from '../src/avatar/outfit.ts';

describe('mağaza', () => {
  it('kıyafet kaydedilip geri okunur; bilinmeyen ya da yanlış yuvadaki eşya düşer', () => {
    const o = { ...EMPTY_OUTFIT, jacket: 'leather', hat: 'beanie' };
    expect(parseOutfit(serializeOutfit(o))).toEqual(o);
    expect(parseOutfit({ jacket: 'beanie', hat: 'ejderha' })).toEqual(EMPTY_OUTFIT);
    expect(parseOutfit('bozuk{')).toEqual(EMPTY_OUTFIT);
  });

  it('sadece sahip olunan eşyalar giyilebilir', () => {
    const o = { ...EMPTY_OUTFIT, jacket: 'leather', acc: 'shades' };
    expect(wearsOnlyOwned(o, new Set(['leather', 'shades']))).toBe(true);
    expect(wearsOnlyOwned(o, new Set(['leather']))).toBe(false);
    expect(wearsOnlyOwned(EMPTY_OUTFIT, new Set())).toBe(true);
  });

  it('katalog: her eşya bir yuvada, fiyatı pozitif, kimlikler benzersiz; hepsi çizilir', () => {
    expect(new Set(STORE_ITEMS.map((i) => i.id)).size).toBe(STORE_ITEMS.length);
    for (const item of STORE_ITEMS) {
      expect(OUTFIT_SLOTS).toContain(item.slot);
      expect(item.price).toBeGreaterThan(0);
      const svg = figureSvg(DEFAULT_AVATAR, { ...EMPTY_OUTFIT, [item.slot]: item.id }, itemView(item.slot, item.id));
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).not.toContain('undefined');
    }
  });

  it('her yuva tek bir dükkânda satılır', () => {
    expect([...STORE_SLOTS, ...BARBER_SLOTS].sort()).toEqual([...OUTFIT_SLOTS].sort());
  });

  it('kuaför: saç kendi saçın yerine çizilir, renk ve sakal karakterde görünür', () => {
    const plain = avatarSvg(DEFAULT_AVATAR, EMPTY_OUTFIT);
    const cut = avatarSvg(DEFAULT_AVATAR, { ...EMPTY_OUTFIT, cut: 'giant' }, TALL_VIEW);
    expect(cut).toContain(`viewBox="${TALL_VIEW}"`);
    expect(cut).toContain('L100 -48');
    // The own mohawk is gone under the barber's cut.
    expect(plain).toContain('L100 0 L106 26');
    expect(cut).not.toContain('L100 0 L106 26');
    const grad = avatarSvg(DEFAULT_AVATAR, { ...EMPTY_OUTFIT, color: 'grad' });
    expect(grad).toContain('url(#pc-hair-grad)');
    expect(grad).toContain('<linearGradient id="pc-hair-grad"');
    expect(avatarSvg(DEFAULT_AVATAR, { ...EMPTY_OUTFIT, color: 'neon' })).toContain('filter="url(#pc-hair-neon)"');
    expect(avatarSvg(DEFAULT_AVATAR, { ...EMPTY_OUTFIT, beard: 'full' })).toContain('#3a2a20');
    expect(plain).not.toContain('#3a2a20');
  });

  it('dolap: kombin sadece kıyafeti tutar, giyilince saç ve sakal kalır', () => {
    const worn = { ...EMPTY_OUTFIT, jacket: 'leather', cut: 'afro', beard: 'full' };
    const kombins = parseKombins(JSON.stringify([{ jacket: 'hoodie', hat: 'beanie', cut: 'giant' }, null]));
    expect(kombins).toHaveLength(3);
    expect(kombins[0]).toEqual({ ...EMPTY_OUTFIT, jacket: 'hoodie', hat: 'beanie' });
    expect(kombins[1]).toBeNull();
    expect(wearKombin(worn, kombins[0]!)).toEqual({
      ...EMPTY_OUTFIT,
      jacket: 'hoodie',
      hat: 'beanie',
      cut: 'afro',
      beard: 'full',
    });
    expect(parseKombins('bozuk')).toEqual([null, null, null]);
  });

  it('her eşyanın iki dilde de adı var, her saç ve sakal çizilir', async () => {
    const { tr, en } = await import('../src/i18n/messages.ts');
    for (const item of STORE_ITEMS) {
      for (const lang of [tr, en]) expect((lang as Record<string, string>)[`store.item.${item.id}`]).toBeTruthy();
    }
    for (const item of STORE_ITEMS.filter((i) => i.slot === 'cut' || i.slot === 'beard' || i.slot === 'color')) {
      const svg = avatarSvg(DEFAULT_AVATAR, { ...EMPTY_OUTFIT, [item.slot]: item.id });
      expect(svg).not.toContain('undefined');
      if (item.slot === 'beard') expect(svg.length).toBeGreaterThan(avatarSvg(DEFAULT_AVATAR, EMPTY_OUTFIT).length);
    }
  });
});
