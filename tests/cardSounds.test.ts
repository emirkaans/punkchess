import { describe, expect, it } from 'vitest';
import { CHAOS } from '../src/engine/index.ts';
import { cardMove } from '../src/engine/types.ts';
import { CHAOS_CARDS, TRICKS } from '../src/engine/variants/anarsi.ts';
import { hasCardSound } from '../src/ui/cardSounds.ts';
import { cardSound } from '../src/ui/sound.ts';

describe('kart sesleri', () => {
  it('her numaranın ve kaos kartının kendi sesi var', () => {
    for (const id of [...TRICKS, ...CHAOS_CARDS]) expect(hasCardSound(id), id).toBe(true);
  });

  it('kart hamlesi hamle sesi yerine kartın sesini çalar; kaos kartı neye döndüyse onunkini', () => {
    expect(cardSound(cardMove({ id: 'mine', squares: [9] }))).toBe('card:mine');
    expect(cardSound(cardMove({ id: CHAOS, squares: [], kind: 'nitro', outcome: '+' }))).toBe('card:nitro');
    expect(cardSound(undefined)).toBeNull();
  });
});
