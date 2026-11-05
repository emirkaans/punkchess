// The shops on Punk Street (src/ui/StreetPage.tsx), in order; four to a street, more streets as
// shops are added. A shop without a path is still to open.

import type { MessageKey } from '../i18n/index.ts';

export interface StreetShop {
  readonly id: string;
  readonly label: MessageKey;
  readonly sign: MessageKey;
  readonly color: string;
  readonly path: string | null;
}

export const STREET_SHOPS: readonly StreetShop[] = [
  { id: 'store', label: 'menu.store', sign: 'menu.sign.store', color: '#ff2e93', path: '/store' },
  { id: 'shoes', label: 'menu.shoes', sign: 'menu.sign.shoes', color: '#e8c84a', path: '/shoes' },
  { id: 'barber', label: 'menu.barber', sign: 'menu.sign.barber', color: '#4aa8ff', path: '/barber' },
  { id: 'tattoo', label: 'menu.tattoo', sign: 'menu.sign.tattoo', color: '#c6ff3d', path: '/tattoo' },
  { id: 'spray', label: 'menu.spray', sign: 'menu.sign.spray', color: '#ffb02e', path: null },
  { id: 'vinyl', label: 'menu.vinyl', sign: 'menu.sign.vinyl', color: '#a77bff', path: null },
];

export const SHOPS_PER_STREET = 4;

/** The streets: the shops in groups of four. */
export const streets = (shops: readonly StreetShop[] = STREET_SHOPS): StreetShop[][] =>
  Array.from({ length: Math.ceil(shops.length / SHOPS_PER_STREET) }, (_, i) =>
    shops.slice(i * SHOPS_PER_STREET, (i + 1) * SHOPS_PER_STREET),
  );
