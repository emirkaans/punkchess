import type { Move, VariantDefinition } from '../engine/index.ts';
import { detectLocale, isLocale } from '../i18n/index.ts';
import type { Locale } from '../i18n/index.ts';
import { loadJSON, saveJSON } from '../storage/local.ts';
import { PIECE_SETS, setPieceSet } from './pieceSets.ts';
import type { PieceSet } from './pieceSets.ts';

export type BoardTheme = 'punk' | 'klasik' | 'koyu' | 'dork' | PunkTheme | FadedTheme;
export type PieceTheme = 'punk' | 'klasik' | 'neon' | PunkTheme;

/** Board and piece themes drawn together: each name is both a board and a piece theme. */
export const PUNK_THEMES = [
  'sprey',
  'kulup',
  'fanzin',
  'ekose',
  'deri',
  'bant',
  'asit',
  'plak',
  'tebesir',
  'koli',
] as const;
type PunkTheme = (typeof PUNK_THEMES)[number];

/** Boards only, in faded punk colours that are easy on the eyes over a long game. */
export const FADED_THEMES = ['afis', 'kot', 'yosun', 'pas', 'morluk'] as const;
type FadedTheme = (typeof FADED_THEMES)[number];

export interface Prefs {
  readonly boardTheme: BoardTheme;
  readonly pieceTheme: PieceTheme;
  /** How the pieces are drawn: the font, or one of the drawn sets. */
  readonly pieceSet: PieceSet;
  readonly sound: boolean;
  /** Taunt stickers in online games (off: neither shown nor offered). */
  readonly stickers: boolean;
  readonly locale: Locale;
  /** Board width in px chosen by dragging its corner; null: fit the screen. */
  readonly boardSize: number | null;
  /** A pawn reaching the last rank becomes a queen without asking. */
  readonly autoQueen: boolean;
  /** Moves may be queued while the opponent thinks. */
  readonly premoves: boolean;
  /** Dots on the squares the picked piece can reach. */
  readonly moveHints: boolean;
  /** File letters and rank numbers along the board's edges. */
  readonly coordinates: boolean;
  /** The last move's squares are tinted. */
  readonly lastMove: boolean;
}

/** On/off preferences, in the order the preferences dialog lists them. */
export const SWITCHES = ['autoQueen', 'premoves', 'moveHints', 'coordinates', 'lastMove'] as const;
export type Switch = (typeof SWITCHES)[number];

// Denim first (the default), then Classic; the faded boards stay together.
export const BOARD_THEMES: readonly BoardTheme[] = [
  'kot',
  'klasik',
  'punk',
  'koyu',
  'dork',
  ...FADED_THEMES.filter((t) => t !== 'kot'),
  ...PUNK_THEMES,
];
export const PIECE_THEMES: readonly PieceTheme[] = ['punk', 'klasik', 'neon', ...PUNK_THEMES];

const DEFAULT_PREFS: Omit<Prefs, 'locale'> = {
  boardTheme: 'kot',
  pieceTheme: 'punk',
  pieceSet: 'glyph',
  sound: true,
  stickers: true,
  boardSize: null,
  autoQueen: false,
  premoves: true,
  moveHints: true,
  coordinates: true,
  lastMove: true,
};
const KEY = 'prefs';

/** Stored preferences; the language defaults to the browser's (Turkish or English). */
export function loadPrefs(): Prefs {
  const stored = loadJSON<Partial<Prefs>>(KEY, {});
  const locale = isLocale(stored.locale) ? stored.locale : detectLocale(navigator.languages ?? [navigator.language]);
  const boardTheme = BOARD_THEMES.includes(stored.boardTheme as BoardTheme)
    ? stored.boardTheme!
    : DEFAULT_PREFS.boardTheme;
  const pieceTheme = PIECE_THEMES.includes(stored.pieceTheme as PieceTheme)
    ? stored.pieceTheme!
    : DEFAULT_PREFS.pieceTheme;
  const pieceSet = PIECE_SETS.includes(stored.pieceSet as PieceSet) ? stored.pieceSet! : DEFAULT_PREFS.pieceSet;
  const boardSize =
    typeof stored.boardSize === 'number' && stored.boardSize >= 200 && stored.boardSize <= 2000
      ? stored.boardSize
      : null;
  const switches = Object.fromEntries(
    SWITCHES.map((k) => [k, typeof stored[k] === 'boolean' ? stored[k] : DEFAULT_PREFS[k]]),
  ) as Pick<Prefs, Switch>;
  return {
    ...DEFAULT_PREFS,
    ...switches,
    sound: stored.sound ?? DEFAULT_PREFS.sound,
    stickers: stored.stickers ?? DEFAULT_PREFS.stickers,
    boardTheme,
    pieceTheme,
    pieceSet,
    locale,
    boardSize,
  };
}
export const savePrefs = (p: Prefs) => saveJSON(KEY, p);

/** Applies the themes to the document root (CSS reads data-board / data-pieces). */
export function applyPrefs(p: Prefs): void {
  const root = document.documentElement;
  root.dataset.board = p.boardTheme;
  root.dataset.pieces = p.pieceTheme;
  root.dataset.hints = p.moveHints ? 'on' : 'off';
  root.dataset.coords = p.coordinates ? 'on' : 'off';
  root.dataset.last = p.lastMove ? 'on' : 'off';
  setPieceSet(p.pieceSet);
  root.lang = p.locale;
}

/**
 * The move a drop or click plays at once: the only candidate, or the first promotion
 * choice (the queen) when auto-queen is on. Null: ask which piece.
 */
export function directMove(variant: VariantDefinition, candidates: Move[], autoQueen: boolean): Move | null {
  if (candidates.length === 1) return candidates[0];
  return autoQueen ? (candidates.find((m) => m.promotion === variant.promotionTypes[0]) ?? null) : null;
}
