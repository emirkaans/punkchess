import { describe, expect, it } from 'vitest';
import { botWinCoins, COIN_RULES, DAILY_COIN_CAP, dailyMax, rushCoins } from '../src/coins/rules.ts';
import { wonBotGame } from '../src/coins/botGame.ts';
import { createGame, getVariant, toFen } from '../src/engine/index.ts';

const start = toFen(getVariant('standard'), createGame(getVariant('standard')).position);
// Fool's mate for black needs 4 plies; pawn moves before it reach the minimum length (no repetition).
const pad = ['a3', 'a6', 'b3', 'b6', 'c3', 'c6', 'a4', 'd6', 'b4', 'h6', 'c4', 'a5', 'Na3', 'b5', 'Ra2', 'c5'];
const mateByBlack = [...pad, 'f3', 'e5', 'g4', 'Qh4#'];

describe('punk coin', () => {
  it('kurallar: bot seviyesine göre, Rush puana göre, günlük tavanlar toplam tavanı aşmaz', () => {
    expect(botWinCoins(1)).toBe(COIN_RULES.bot.win[0]);
    expect(botWinCoins(5)).toBe(COIN_RULES.bot.win[4]);
    expect(botWinCoins(99)).toBe(COIN_RULES.bot.win[4]);
    expect(rushCoins(9)).toBe(4);
    expect(rushCoins(-3)).toBe(0);
    for (const r of ['online', 'bot', 'puzzle', 'daily', 'rush'] as const)
      expect(dailyMax(r)).toBeLessThanOrEqual(DAILY_COIN_CAP);
  });

  it('bot oyunu: mat eden taraf için geçerli, değilse ya da kısa/bozuk/elle kurulmuş konumsa değil', () => {
    expect(wonBotGame({ variantId: 'standard', startFen: start, moves: mateByBlack, color: 'b' })).toBe(true);
    expect(wonBotGame({ variantId: 'standard', startFen: start, moves: mateByBlack, color: 'w' })).toBe(false);
    expect(wonBotGame({ variantId: 'standard', startFen: start, moves: ['f3', 'e5', 'g4', 'Qh4#'], color: 'b' })).toBe(
      false,
    );
    expect(wonBotGame({ variantId: 'standard', startFen: start, moves: [...pad, 'Qh5'], color: 'w' })).toBe(false);
    // A position set up by hand does not count.
    expect(
      wonBotGame({ variantId: 'standard', startFen: '4k3/8/8/8/8/8/8/4K2R w K - 0 1', moves: mateByBlack, color: 'b' }),
    ).toBe(false);
    expect(wonBotGame({ variantId: 'yok', startFen: start, moves: mateByBlack, color: 'b' })).toBe(false);
  });
});
