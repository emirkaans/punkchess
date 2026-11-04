import { describe, expect, it } from 'vitest';
import { COIN_RULES, DAILY_COIN_CAP, dailyMax, rushCoins } from '../src/coins/rules.ts';

describe('punk coin', () => {
  it('kurallar: Rush puana göre, günlük tavanlar toplam tavanı aşmaz', () => {
    expect(rushCoins(8)).toBe(2);
    expect(rushCoins(9)).toBe(3);
    expect(rushCoins(-3)).toBe(0);
    expect(COIN_RULES.puzzle.solved).toBe(2);
    expect(COIN_RULES.daily.solved).toBe(10);
    for (const r of ['online', 'puzzle', 'daily', 'rush'] as const)
      expect(dailyMax(r)).toBeLessThanOrEqual(DAILY_COIN_CAP);
  });
});
