import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR, avatarSvg } from '../src/avatar/avatar.ts';
import { EMPTY_OUTFIT, STORE_ITEMS, parseKombins, parseOutfit, wearKombin } from '../src/avatar/outfit.ts';
import { TATTOO_ITEMS, faceTattooSvg, neckTattooSvg } from '../src/avatar/tattoos.ts';
import { en, tr } from '../src/i18n/messages.ts';

describe('dövmeci', () => {
  it('20 dövme: 10 yüz, 10 boyun; hepsi katalogda, fiyatlı ve adlı', () => {
    expect(TATTOO_ITEMS).toHaveLength(20);
    expect(TATTOO_ITEMS.filter((i) => i.slot === 'tattooFace')).toHaveLength(10);
    expect(TATTOO_ITEMS.filter((i) => i.slot === 'tattooNeck')).toHaveLength(10);
    const ids = STORE_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of TATTOO_ITEMS) {
      expect(ids).toContain(item.id);
      expect(item.price).toBeGreaterThan(0);
      expect(tr[`store.item.${item.id}` as keyof typeof tr]).toBeTruthy();
      expect(en[`store.item.${item.id}` as keyof typeof en]).toBeTruthy();
      const svg = item.slot === 'tattooFace' ? faceTattooSvg(item.id) : neckTattooSvg(item.id);
      expect(svg).not.toBe('');
      expect(svg).not.toMatch(/NaN|undefined/);
    }
  });

  it('dövme karakterin yüzünde ve boynunda çizilir; bilinmeyen dövme çizilmez', () => {
    const plain = avatarSvg(DEFAULT_AVATAR, EMPTY_OUTFIT);
    const inked = avatarSvg(DEFAULT_AVATAR, { ...EMPTY_OUTFIT, tattooFace: 'tf-tear', tattooNeck: 'tn-rose' });
    expect(inked).toContain(faceTattooSvg('tf-tear'));
    expect(inked).toContain(neckTattooSvg('tn-rose'));
    expect(plain).not.toContain(faceTattooSvg('tf-tear'));
    expect(faceTattooSvg('tn-rose')).toBe('');
    expect(neckTattooSvg(null)).toBe('');
  });

  it('dövme yalnızca kendi yerine takılır; dolaptan kombin giyince dövme kalır', () => {
    const o = parseOutfit({ tattooFace: 'tf-star', tattooNeck: 'tf-star' });
    expect(o.tattooFace).toBe('tf-star');
    expect(o.tattooNeck).toBeNull();
    const worn = { ...EMPTY_OUTFIT, tattooFace: 'tf-star', tattooNeck: 'tn-dagger', jacket: 'leather' };
    const kombin = parseKombins([{ jacket: 'denim', tattooFace: 'tf-heart' }])[0]!;
    expect(kombin.tattooFace).toBeNull();
    const after = wearKombin(worn, kombin);
    expect(after.jacket).toBe('denim');
    expect(after.tattooFace).toBe('tf-star');
    expect(after.tattooNeck).toBe('tn-dagger');
  });
});
