// The shops' goods and how clothes are drawn: the store (src/ui/StorePage.tsx) sells clothes,
// the barber (src/ui/BarberPage.tsx, drawn in src/avatar/barber.ts) cuts, hair colours and
// beards. An outfit is one item per slot (or none), stored as a short JSON of item ids like the
// character itself; items only change looks. Prices are in punk coins (src/coins/rules.ts).
// Pure: no DOM.

export type OutfitSlot = 'jacket' | 'pants' | 'hat' | 'acc' | 'cut' | 'color' | 'beard';

export interface StoreItem {
  readonly id: string;
  readonly slot: OutfitSlot;
  readonly price: number;
}

/** What the player wears: an item id per slot, or null. */
export type Outfit = Readonly<Record<OutfitSlot, string | null>>;

export const OUTFIT_SLOTS: readonly OutfitSlot[] = ['jacket', 'pants', 'hat', 'acc', 'cut', 'color', 'beard'];
/** What each shop sells. */
export const STORE_SLOTS: readonly OutfitSlot[] = ['jacket', 'pants', 'hat', 'acc'];
export const BARBER_SLOTS: readonly OutfitSlot[] = ['cut', 'color', 'beard'];

/** The catalogue. New items can be added; an item must never be removed once sold (hide it instead). */
export const STORE_ITEMS: readonly StoreItem[] = [
  { id: 'leather', slot: 'jacket', price: 300 },
  { id: 'denim', slot: 'jacket', price: 180 },
  { id: 'bomber', slot: 'jacket', price: 220 },
  { id: 'tartan', slot: 'jacket', price: 160 },
  { id: 'hoodie', slot: 'jacket', price: 90 },
  { id: 'ripped', slot: 'pants', price: 120 },
  { id: 'tartanp', slot: 'pants', price: 140 },
  { id: 'leatherp', slot: 'pants', price: 200 },
  { id: 'camo', slot: 'pants', price: 110 },
  { id: 'beanie', slot: 'hat', price: 60 },
  { id: 'cap', slot: 'hat', price: 70 },
  { id: 'bandana', slot: 'hat', price: 50 },
  { id: 'army', slot: 'hat', price: 130 },
  { id: 'chain', slot: 'acc', price: 80 },
  { id: 'choker', slot: 'acc', price: 100 },
  { id: 'shades', slot: 'acc', price: 90 },
  { id: 'phones', slot: 'acc', price: 150 },
  { id: 'giant', slot: 'cut', price: 260 },
  { id: 'double', slot: 'cut', price: 220 },
  { id: 'liberty', slot: 'cut', price: 300 },
  { id: 'dreads', slot: 'cut', price: 240 },
  { id: 'half', slot: 'cut', price: 160 },
  { id: 'afro', slot: 'cut', price: 200 },
  { id: 'quiff', slot: 'cut', price: 180 },
  { id: 'braid', slot: 'cut', price: 280 },
  { id: 'fringe', slot: 'cut', price: 140 },
  { id: 'bun', slot: 'cut', price: 150 },
  { id: 'long', slot: 'cut', price: 130 },
  { id: 'flame', slot: 'cut', price: 320 },
  { id: 'grad', slot: 'color', price: 120 },
  { id: 'split', slot: 'color', price: 100 },
  { id: 'neon', slot: 'color', price: 150 },
  { id: 'full', slot: 'beard', price: 110 },
  { id: 'goatee', slot: 'beard', price: 70 },
  { id: 'handlebar', slot: 'beard', price: 90 },
  { id: 'chops', slot: 'beard', price: 60 },
];

export const storeItem = (id: string): StoreItem | undefined => STORE_ITEMS.find((i) => i.id === id);

export const EMPTY_OUTFIT: Outfit = {
  jacket: null,
  pants: null,
  hat: null,
  acc: null,
  cut: null,
  color: null,
  beard: null,
};

/** An outfit from anything (stored JSON, a request): unknown items or items in the wrong slot are dropped. */
export function parseOutfit(input: unknown): Outfit {
  let data: unknown = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch {
      data = null;
    }
  }
  const obj = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const out: Record<OutfitSlot, string | null> = { ...EMPTY_OUTFIT };
  for (const slot of OUTFIT_SLOTS) {
    const item = typeof obj[slot] === 'string' ? storeItem(obj[slot] as string) : undefined;
    if (item && item.slot === slot) out[slot] = item.id;
  }
  return out;
}

/** How many outfits a player can save in the wardrobe. */
export const KOMBIN_COUNT = 3;

/** The clothes of an outfit (the store's slots), the rest left empty: what a saved outfit keeps. */
export const clothesOf = (o: Outfit): Outfit => ({
  ...EMPTY_OUTFIT,
  ...Object.fromEntries(STORE_SLOTS.map((s) => [s, o[s]])),
});

/** Saved outfits from anything (stored JSON): always `KOMBIN_COUNT` places, clothes only. */
export function parseKombins(input: unknown): readonly (Outfit | null)[] {
  let data: unknown = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch {
      data = null;
    }
  }
  const list = Array.isArray(data) ? data : [];
  return Array.from({ length: KOMBIN_COUNT }, (_, i) => (list[i] ? clothesOf(parseOutfit(list[i])) : null));
}

/** A saved outfit put on: its clothes replace the worn ones; the hair, colour and beard stay. */
export const wearKombin = (worn: Outfit, kombin: Outfit): Outfit => ({
  ...worn,
  ...clothesOf(kombin),
  ...barberOf(worn),
});
const barberOf = (o: Outfit) => Object.fromEntries(BARBER_SLOTS.map((s) => [s, o[s]]));

/** The outfit as stored. */
export const serializeOutfit = (o: Outfit): string =>
  JSON.stringify(Object.fromEntries(OUTFIT_SLOTS.map((s) => [s, o[s]])));

/** Whether every worn item is one the player owns. */
export const wearsOnlyOwned = (o: Outfit, owned: ReadonlySet<string>): boolean =>
  OUTFIT_SLOTS.every((s) => o[s] === null || owned.has(o[s]!));

// ---------------------------------------------------------------------------
// Drawing. Head items are in the head's 200×200 box (src/avatar/avatar.ts); body items in the
// full figure's 200×360 box (src/avatar/figure.ts).

const INK = '#141016';

/** A hat, in the head's box. */
export function hatSvg(id: string | null): string {
  switch (id) {
    case 'beanie':
      return `<path d="M50 84c0-36 22-52 50-52s50 16 50 52z" fill="#ff2e93" stroke="${INK}" stroke-width="4"/><rect x="46" y="76" width="108" height="16" rx="6" fill="#d61f7a" stroke="${INK}" stroke-width="4"/><circle cx="100" cy="30" r="9" fill="#ff2e93" stroke="${INK}" stroke-width="3"/>`;
    case 'cap':
      return `<path d="M52 82c2-30 22-44 48-44s46 14 48 44z" fill="#141016" stroke="${INK}" stroke-width="4"/><path d="M140 80c14 0 26 4 30 10-10 4-22 4-32 0z" fill="#c6ff3d" stroke="${INK}" stroke-width="3"/><circle cx="100" cy="40" r="4" fill="#c6ff3d"/>`;
    case 'bandana':
      return `<path d="M50 80c20-10 80-10 100 0l-2 12c-20-8-76-8-96 0z" fill="#e5352b" stroke="${INK}" stroke-width="3"/><path d="M150 82l16-6-4 14 10 6-18 0z" fill="#e5352b" stroke="${INK}" stroke-width="3"/><g fill="#fff">${[64, 84, 104, 124].map((x) => `<circle cx="${x}" cy="84" r="2"/>`).join('')}</g>`;
    case 'army':
      return `<path d="M54 80l4-34h84l4 34z" fill="#5b6b3a" stroke="${INK}" stroke-width="4"/><path d="M50 80h100l12 10H38z" fill="#46542c" stroke="${INK}" stroke-width="3"/><circle cx="100" cy="60" r="6" fill="#e5352b" stroke="${INK}" stroke-width="2"/>`;
    default:
      return '';
  }
}

/** An accessory worn on the head (glasses, headphones), in the head's box; others draw nothing here. */
export function headAccessorySvg(id: string | null): string {
  if (id === 'shades')
    return `<path d="M64 100h28l-2 14H66zM108 100h28l-2 14h-24z" fill="${INK}"/><path d="M92 104h16" stroke="${INK}" stroke-width="3"/><path d="M70 104h6" stroke="#fff" stroke-width="2" opacity=".6"/>`;
  if (id === 'phones')
    return `<path d="M44 108c0-50 112-50 112 0" fill="none" stroke="${INK}" stroke-width="10"/><path d="M44 108c0-50 112-50 112 0" fill="none" stroke="#c6ff3d" stroke-width="5"/><rect x="32" y="98" width="20" height="34" rx="8" fill="#c6ff3d" stroke="${INK}" stroke-width="3"/><rect x="148" y="98" width="20" height="34" rx="8" fill="#c6ff3d" stroke="${INK}" stroke-width="3"/>`;
  return '';
}

/** An accessory worn at the neck (chain, choker), in the figure's box. */
export function neckAccessorySvg(id: string | null): string {
  if (id === 'chain')
    return `<path d="M80 120c4 30 36 30 40 0" fill="none" stroke="#d8d4dc" stroke-width="4" stroke-dasharray="4 2"/><circle cx="100" cy="146" r="6" fill="#d8d4dc" stroke="${INK}" stroke-width="2"/>`;
  if (id === 'choker')
    return `<rect x="84" y="108" width="32" height="8" rx="2" fill="#141016" stroke="${INK}" stroke-width="2"/>${[88, 96, 104, 112].map((x) => `<path d="M${x - 2} 108l2-5 2 5z" fill="#d8d4dc"/>`).join('')}`;
  return '';
}

const studs = (pts: readonly (readonly [number, number])[]) =>
  pts
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#d8d4dc" stroke="${INK}" stroke-width=".8"/>`)
    .join('');

/** The upper body: a jacket, or a plain punk T-shirt; arms and hands in `skin`. */
export function jacketSvg(id: string | null, skin: string): string {
  const torso = 'M62 128c4-10 14-14 38-14s34 4 38 14l6 104H56z';
  const armL = 'M62 128l-18 10-4 84h16l6-62z';
  const armR = 'M138 128l18 10 4 84h-16l-6-62z';
  const hands = `<circle cx="48" cy="226" r="8" fill="${skin}" stroke="${INK}" stroke-width="3"/><circle cx="152" cy="226" r="8" fill="${skin}" stroke="${INK}" stroke-width="3"/>`;
  const part = (fill: string, arms = fill, extra = '') =>
    `<path d="${armL}" fill="${arms}" stroke="${INK}" stroke-width="3"/><path d="${armR}" fill="${arms}" stroke="${INK}" stroke-width="3"/><path d="${torso}" fill="${fill}" stroke="${INK}" stroke-width="3"/>${extra}${hands}`;
  switch (id) {
    case 'leather':
      return part(
        '#1d1b21',
        '#1d1b21',
        `<path d="M100 116v116" stroke="#8a8590" stroke-width="2" stroke-dasharray="3 3"/><path d="M84 116l14 30M116 116l-14 30" stroke="#3a3640" stroke-width="3"/>${studs(
          [
            [68, 132],
            [74, 128],
            [80, 126],
            [132, 132],
            [126, 128],
            [120, 126],
            [52, 146],
            [148, 146],
          ],
        )}`,
      );
    case 'denim':
      return part(
        '#3a5f95',
        skin,
        `<rect x="70" y="150" width="20" height="16" fill="#ff2e93" stroke="${INK}" stroke-width="2" transform="rotate(-8 80 158)"/><rect x="110" y="170" width="18" height="18" fill="#c6ff3d" stroke="${INK}" stroke-width="2" transform="rotate(6 119 179)"/><circle cx="118" cy="140" r="7" fill="#f1eee8" stroke="${INK}" stroke-width="2"/><path d="M100 118v114" stroke="#284670" stroke-width="2"/>`,
      );
    case 'bomber':
      return part(
        '#ff2e93',
        '#ff2e93',
        `<rect x="56" y="222" width="88" height="10" fill="#7a1048"/><rect x="40" y="214" width="16" height="8" fill="#7a1048"/><rect x="144" y="214" width="16" height="8" fill="#7a1048"/><path d="M100 118v104" stroke="#7a1048" stroke-width="3"/>`,
      );
    case 'tartan':
      return part(
        '#b3202a',
        '#b3202a',
        `<g stroke="#2a0a0e" stroke-width="2" opacity=".7">${[70, 84, 98, 112, 126].map((x) => `<path d="M${x} 118v114"/>`).join('')}${[140, 160, 180, 200, 220].map((y) => `<path d="M58 ${y}h84"/>`).join('')}</g><g stroke="#e8c84a" stroke-width="1" opacity=".7">${[77, 105, 119].map((x) => `<path d="M${x} 118v114"/>`).join('')}</g>`,
      );
    case 'hoodie':
      return (
        `<path d="M72 126c0-18 56-18 56 0" fill="#57545e" stroke="${INK}" stroke-width="3"/>` +
        part(
          '#6b6872',
          '#6b6872',
          `<path d="M78 190h44v22H78z" fill="#5d5a64" stroke="${INK}" stroke-width="2"/><path d="M94 122v18M106 122v18" stroke="#e9e4d8" stroke-width="2"/>`,
        )
      );
    default:
      return part(
        '#2a2a2e',
        skin,
        `<path d="M92 160l8-18 8 18M94 154h12" fill="none" stroke="#ff2e93" stroke-width="3"/><circle cx="100" cy="154" r="14" fill="none" stroke="#ff2e93" stroke-width="2.5"/>`,
      );
  }
}

/** The legs: trousers (plain dark ones by default) and boots. */
export function pantsSvg(id: string | null, skin: string): string {
  const legs = (fill: string, extra = '') =>
    `<path d="M58 230h84l-4 100h-26l-10-76-10 76H66z" fill="${fill}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>${extra}`;
  const boots = `<path d="M62 328h30l2 18H56c0-8 2-14 6-18zM108 328h30c4 4 6 10 6 18h-38z" fill="#141016" stroke="${INK}" stroke-width="3"/><path d="M60 340h34M106 340h38" stroke="#5a5662" stroke-width="2"/>`;
  switch (id) {
    case 'ripped':
      return (
        legs(
          '#3a5f95',
          `<path d="M70 282c4-4 12-4 16 0-4 4-12 4-16 0zM114 290c4-4 12-4 16 0-4 4-12 4-16 0z" fill="${skin}" stroke="#e9e4d8" stroke-width="1.5"/><path d="M100 234v20" stroke="#284670" stroke-width="2"/>`,
        ) + boots
      );
    case 'tartanp':
      return (
        legs(
          '#b3202a',
          `<g stroke="#2a0a0e" stroke-width="2" opacity=".7">${[72, 86, 114, 128].map((x) => `<path d="M${x} 232v96"/>`).join('')}${[250, 275, 300].map((y) => `<path d="M60 ${y}h80"/>`).join('')}</g>`,
        ) + boots
      );
    case 'leatherp':
      return (
        legs('#1d1b21', `<path d="M72 240v80M126 240v80" stroke="#55525c" stroke-width="3" opacity=".7"/>`) + boots
      );
    case 'camo':
      return (
        legs(
          '#6b7a45',
          `<g fill="#4a5530">${(
            [
              [74, 250],
              [120, 262],
              [84, 300],
              [128, 310],
              [104, 240],
            ] as const
          )
            .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="10" ry="6" transform="rotate(${x % 40} ${x} ${y})"/>`)
            .join('')}</g><g fill="#2f3620">${(
            [
              [90, 270],
              [116, 292],
              [70, 314],
            ] as const
          )
            .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="7" ry="4"/>`)
            .join('')}</g>`,
        ) + boots
      );
    default:
      return legs('#2c2a30') + boots;
  }
}
