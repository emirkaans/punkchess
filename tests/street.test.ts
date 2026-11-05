import { describe, expect, it } from 'vitest';
import { parseRoute, pathOf } from '../src/ui/routes.ts';
import { STREET_SHOPS, SHOPS_PER_STREET, streets } from '../src/ui/street.ts';
import { storefront } from '../src/ui/storefront.ts';

describe('punk sokağı', () => {
  it('/street sayfası', () => {
    expect(parseRoute('/street')).toEqual({ kind: 'street' });
    expect(pathOf({ kind: 'street' })).toBe('/street');
    expect(parseRoute('/tattoo')).toEqual({ kind: 'tattoo' });
    expect(pathOf({ kind: 'tattoo' })).toBe('/tattoo');
  });

  it('her sokakta en fazla 4 dükkân; açık dükkânlar kendi sayfasına gider', () => {
    const all = streets();
    expect(all.flat()).toEqual(STREET_SHOPS);
    expect(all.every((s) => s.length <= SHOPS_PER_STREET)).toBe(true);
    expect(all[0].map((s) => s.path)).toEqual(['/store', '/shoes', '/barber', '/tattoo']);
  });

  it('vitrin: açık dükkânın kapısı parlayabilir, kapalısında kepenk iner', () => {
    expect(storefront('#ff2e93', 'Butik', false)).toContain('class="sf-door"');
    const closed = storefront('#c6ff3d', 'Mürekkep', true, 'YAKINDA');
    expect(closed).not.toContain('sf-door');
    expect(closed).toContain('YAKINDA');
  });
});
