// @vitest-environment happy-dom
// The game setup dialog grows with the window, its proportions kept.

import { describe, expect, it } from 'vitest';

const { dialogScale } = await import('../../src/ui/VariantPlayDialog.tsx');

describe('oyun başlatma penceresi ölçeği', () => {
  it('küçük ekranda kendi boyu; büyük ekranda büyür ama en fazla 2 kat', () => {
    expect(dialogScale(375, 667)).toBe(1);
    expect(dialogScale(1024, 768)).toBeCloseTo(1.06, 2);
    expect(dialogScale(1747, 930)).toBeCloseTo(1.81, 2);
    expect(dialogScale(3840, 2160)).toBe(2);
  });

  it('alçak pencerede yüksekliğe göre sınırlanır', () => {
    // A wide but low window: 75% of the height decides.
    expect(dialogScale(2400, 700)).toBeCloseTo(((700 - 48) * 0.75) / 360, 2);
  });
});
