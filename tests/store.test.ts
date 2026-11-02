import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR } from '../src/avatar/avatar.ts';
import { figureSvg, itemView } from '../src/avatar/figure.ts';
import {
  EMPTY_OUTFIT,
  OUTFIT_SLOTS,
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
});
