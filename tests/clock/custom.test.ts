// Custom time controls ("12+5"): picked on sliders, valid wherever a listed one is.

import { describe, expect, it } from 'vitest';
import { isCustomTime, timeControl } from '../../src/clock/clock.ts';
import { ratingCategory, speedOf } from '../../src/rating/categories.ts';

describe('özel süre', () => {
  it('listedeki seçeneklerden dakika+artış geçerli, gerisi süresiz sayılır', () => {
    expect(timeControl('12+5')).toMatchObject({ id: '12+5', initialMs: 720_000, incrementMs: 5000 });
    expect(isCustomTime('12+5')).toBe(true);
    expect(isCustomTime('3+2')).toBe(false);
    for (const bad of ['11+5', '12+11', '012+5', '0+1', '12+5x', '999+0']) expect(timeControl(bad).id).not.toBe(bad);
  });

  it('hızı ve puan kategorisi tahmini süresinden', () => {
    expect(speedOf('2+1')).toBe('bullet');
    expect(speedOf('4+2')).toBe('blitz');
    expect(speedOf('12+5')).toBe('rapid');
    expect(speedOf('30+20')).toBe('classical');
    expect(ratingCategory('standard', '12+5')).toBe('rapid');
  });
});
