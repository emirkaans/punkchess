import { describe, expect, it } from 'vitest';
import { RENAME_RULES, nextRenameAt, renameCost, sameName } from '../src/online/rename.ts';

describe('kullanıcı adı değişimi', () => {
  it('ilki bedava, sonrakiler ücretli; 30 günde bir; sadece büyük-küçük harf ayrı', () => {
    expect(renameCost(0)).toBe(0);
    expect(renameCost(1)).toBe(RENAME_RULES.price);
    expect(renameCost(5)).toBe(200);
    expect(nextRenameAt(null)).toBeNull();
    expect(nextRenameAt(1000)).toBe(1000 + 30 * 86_400_000);
    expect(sameName('Aybo', 'aybo')).toBe(true);
    expect(sameName('aybo', 'aybo2')).toBe(false);
  });
});
