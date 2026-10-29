import { fileOf, opposite, parseSquare, rankOf, squareName } from '../board.ts';
import { isInCheck, isLegal, legalMoves } from '../legality.ts';
import { applyMove } from '../movegen.ts';
import type {
  CardPlay,
  CastlingRights,
  Color,
  Move,
  Piece,
  PieceDefinition,
  Position,
  SetupQuestion,
  SetupQuestionTexts,
  SquareMark,
  VariantDefinition,
  VariantExtra,
} from '../types.ts';
import { cardMove } from '../types.ts';
import type { FastHooks } from '../fast/hooks.ts';
import {
  QUEEN,
  STANDARD_PIECES,
  STANDARD_PIECE_NAMES_EN,
  STANDARD_START,
  STANDARD_VALUES,
  defineVariant,
  fixedPatterns,
} from './standard.ts';

// Anarşi: standard chess plus cards. Before the game each player picks one trick ("numara"),
// and each is dealt a hidden chaos card; either is played once, instead of a move.
//
// Tricks always help the player. A chaos card either hits (helps the player) or backfires
// (helps the opponent), drawn half and half when it is played. Which chaos card a player holds
// is not part of the position: whoever runs the game deals it, keeps it secret and resolves it
// (see `resolveChaos`); the position only records whether it was played.

export const TRICKS = ['void', 'pawn', 'ice', 'swap', 'shield', 'wall', 'revive', 'exile'] as const;
export type Trick = (typeof TRICKS)[number];
export const CHAOS_CARDS = ['time', 'ambush', 'traitor', 'nitro', 'demote', 'quake'] as const;
export type ChaosCard = (typeof CHAOS_CARDS)[number];

/** Notation codes of the cards (Kara Delik, Piyon Avı, … / Zaman Hırsızı, Pusu, …). */
export const CARD_CODES: Readonly<Record<Trick | ChaosCard, string>> = {
  void: 'KD',
  pawn: 'PA',
  ice: 'BZ',
  swap: 'IS',
  shield: 'KL',
  wall: 'BR',
  revive: 'DR',
  exile: 'SG',
  time: 'ZH',
  ambush: 'PU',
  traitor: 'HN',
  nitro: 'NT',
  demote: 'RD',
  quake: 'DP',
};
const CARD_OF_CODE = new Map(Object.entries(CARD_CODES).map(([id, code]) => [code, id]));

/** Chaos cards may be played from this move number on. */
export const CHAOS_FROM_MOVE = 6;

/** A lasting effect. `c`: the frozen / shielded / nitro pieces' colour, or who built the wall. */
export interface Effect {
  readonly k: 'ice' | 'shield' | 'wall' | 'nitro';
  readonly c: Color;
  /** Ply (see plyOf) from which the effect is gone. */
  readonly exp: number;
  readonly sq: readonly number[];
}

export interface AnarsiExtra {
  /** Each player's trick (picked before the game). */
  readonly trick: { readonly w: Trick | null; readonly b: Trick | null };
  /** Trick played. */
  readonly used: { readonly w: boolean; readonly b: boolean };
  /** Chaos card played. */
  readonly chaos: { readonly w: boolean; readonly b: boolean };
  readonly fx: readonly Effect[];
}

const extraOf = (pos: Position) => pos.extra as unknown as AnarsiExtra;
const asExtra = (e: AnarsiExtra) => e as unknown as VariantExtra;

/** Half-moves played before `pos` (0 at the start). */
export const plyOf = (pos: Position) => (pos.fullmove - 1) * 2 + (pos.turn === 'b' ? 1 : 0);

// ---------------------------------------------------------------------------
// Pieces: blockers the cards put on the board, and nitro pieces

const holeSvg = () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">
  <circle cx="22.5" cy="22.5" r="17" fill="#000" stroke="#ff2e93" stroke-width="2"/>
  <circle cx="22.5" cy="22.5" r="10" fill="none" stroke="#ff2e93" stroke-width="1" opacity=".55"/>
  <circle cx="22.5" cy="22.5" r="4" fill="#ff2e93" opacity=".35"/>
</svg>`;

const wallSvg = () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">
  <defs><pattern id="hz" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
    <rect width="4" height="8" fill="#c6ff3d"/><rect x="4" width="4" height="8" fill="#111"/></pattern></defs>
  <rect x="4" y="12" width="37" height="21" rx="2" fill="url(#hz)" stroke="#111" stroke-width="2"/>
  <path d="M10 33v6M35 33v6" stroke="#111" stroke-width="3" stroke-linecap="round"/>
</svg>`;

const blocker = (type: string, name: string, svg: () => string): PieceDefinition => ({
  type,
  name,
  fenChar: type,
  sanLetter: type.toUpperCase(),
  patterns: fixedPatterns(),
  canCapture: false,
  capturable: false,
  material: 'none',
  icon: { kind: 'svg', svg },
});

/** A square taken off the board by Kara Delik: nothing enters or passes it. */
export const HOLE = blocker('x', 'Kara delik', holeSvg);
/** A square closed by Barikat until the wall comes down. */
export const WALL = blocker('o', 'Barikat', wallSvg);

const nitro = (type: string, base: 'n' | 'b', name: string): PieceDefinition => ({
  ...STANDARD_PIECES[base],
  type,
  name,
  fenChar: type,
  patterns: fixedPatterns(QUEEN),
});

/** A knight / bishop that moves like a queen for one move (Nitro). */
export const NITRO_KNIGHT = nitro('y', 'n', 'Nitrolu at');
export const NITRO_BISHOP = nitro('z', 'b', 'Nitrolu fil');
const NITRO_OF: Readonly<Record<string, string>> = { n: 'y', b: 'z' };
const BASE_OF: Readonly<Record<string, string>> = { y: 'n', z: 'b' };

const MINORS = new Set(['n', 'b', 'y', 'z']);
/** Pieces Deprem may move: knights, bishops, rooks, queens (nitro ones too). */
const QUAKE_TYPES = new Set(['n', 'b', 'r', 'q', 'y', 'z']);
/** Rütbe Düşürme: each piece one rank down (a nitro piece as its base piece). */
const DEMOTED: Readonly<Record<string, string>> = { q: 'r', r: 'b', b: 'n', z: 'n', n: 'p', y: 'p' };
const homeRank = (c: Color) => (c === 'w' ? 0 : 7);
const kindOf = (type: string) => BASE_OF[type] ?? type;

/** The minor piece Diriliş brings back for `c`: a bishop if one was taken, else a knight (null: none). */
function revived(pos: Position, c: Color): 'b' | 'n' | null {
  let bishops = 0;
  let knights = 0;
  for (const p of pos.board) {
    if (!p || p.color !== c) continue;
    if (kindOf(p.type) === 'b') bishops++;
    if (kindOf(p.type) === 'n') knights++;
  }
  return bishops < 2 ? 'b' : knights < 2 ? 'n' : null;
}

/**
 * Where Sürgün sends the minor piece on `sq`: its own starting square (a bishop the one of its
 * square colour, a knight the nearer one), if that is empty and not where it stands; else null.
 */
function exileHome(pos: Position, sq: number): number | null {
  const p = pos.board[sq];
  if (!p) return null;
  const rank = homeRank(p.color);
  const kind = kindOf(p.type);
  let homes: number[];
  if (kind === 'b')
    homes = [2, 5]
      .map((f) => rank * 8 + f)
      .filter((h) => (fileOf(h) + rankOf(h)) % 2 === (fileOf(sq) + rankOf(sq)) % 2);
  else if (kind === 'n')
    homes = [1, 6]
      .map((f) => rank * 8 + f)
      .sort((a, b) => Math.abs(fileOf(a) - fileOf(sq)) - Math.abs(fileOf(b) - fileOf(sq)));
  else return null;
  if (homes.includes(sq)) return null;
  return homes.find((h) => !pos.board[h]) ?? null;
}
/** Pieces the cards treat as ordinary pieces (not the king, not blockers). */
const isPlain = (p: Piece | null): p is Piece => !!p && p.type !== 'k' && p.type !== 'x' && p.type !== 'o';

// ---------------------------------------------------------------------------
// Card moves

const play = (id: string, squares: readonly number[], kind?: string, outcome?: '+' | '-'): Move =>
  cardMove(kind ? { id, squares, kind, outcome } : { id, squares });

function trickMoves(pos: Position, trick: Trick): Move[] {
  const me = pos.turn;
  const board = pos.board;
  const out: Move[] = [];
  const each = (test: (p: Piece | null, sq: number) => boolean) => {
    for (let sq = 0; sq < 64; sq++) if (test(board[sq], sq)) out.push(play(trick, [sq]));
  };
  switch (trick) {
    case 'void':
      each((p) => !p);
      break;
    case 'pawn':
      each((p) => p?.type === 'p' && p.color !== me);
      break;
    case 'ice':
      each((p) => isPlain(p) && p.color !== me);
      break;
    case 'shield':
      each((p) => isPlain(p) && p.color === me);
      break;
    case 'swap':
      for (let a = 0; a < 64; a++) {
        const pa = board[a];
        if (!isPlain(pa) || pa.color !== me || pa.type === 'p') continue;
        for (let b = a + 1; b < 64; b++) {
          const pb = board[b];
          if (isPlain(pb) && pb.color === me && pb.type !== 'p' && pb.type !== pa.type) out.push(play('swap', [a, b]));
        }
      }
      break;
    case 'wall':
      for (let sq = 0; sq < 64; sq++) {
        const f = fileOf(sq);
        if (f > 0 && f < 7 && !board[sq - 1] && !board[sq] && !board[sq + 1])
          out.push(play('wall', [sq - 1, sq, sq + 1]));
      }
      break;
    case 'revive':
      if (revived(pos, me)) each((p, sq) => !p && rankOf(sq) === homeRank(me));
      break;
    case 'exile':
      each((p, sq) => !!p && p.color !== me && MINORS.has(p.type) && exileHome(pos, sq) !== null);
      break;
  }
  return out;
}

function cardMoves(pos: Position): Move[] {
  const ex = extraOf(pos);
  const me = pos.turn;
  // No card while in check: a card is never the way out.
  if (isInCheck(anarsi, pos)) return [];
  const trick = ex.trick[me];
  const out = trick && !ex.used[me] ? trickMoves(pos, trick) : [];
  if (!ex.chaos[me] && pos.fullmove >= CHAOS_FROM_MOVE) out.push(play('chaos', []));
  return out;
}

const CORNER_RIGHTS: Readonly<Record<number, keyof CastlingRights>> = { 0: 'wQ', 7: 'wK', 56: 'bQ', 63: 'bK' };

function applyCard(pos: Position, move: Move): Position {
  const card = move.card!;
  const me = pos.turn;
  const them = opposite(me);
  const ply = plyOf(pos);
  const board = pos.board.slice();
  const ex = extraOf(pos);
  const fx = [...ex.fx];
  const sq = card.squares;
  let removed = false;
  const what = card.id === 'chaos' ? card.kind : card.id;
  const forMe = card.outcome !== '-';
  switch (what) {
    case 'void':
      board[sq[0]] = { type: 'x', color: me };
      break;
    case 'pawn':
      board[sq[0]] = null;
      removed = true;
      break;
    case 'ice':
      fx.push({ k: 'ice', c: them, exp: ply + 6, sq });
      break;
    case 'shield':
      fx.push({ k: 'shield', c: me, exp: ply + 2, sq });
      break;
    case 'swap':
      [board[sq[0]], board[sq[1]]] = [board[sq[1]], board[sq[0]]];
      break;
    case 'wall':
      for (const s of sq) board[s] = { type: 'o', color: me };
      fx.push({ k: 'wall', c: me, exp: ply + 6, sq });
      break;
    case 'revive':
      board[sq[0]] = { type: revived(pos, me)!, color: me };
      break;
    case 'exile': {
      const home = exileHome(pos, sq[0])!;
      const p = board[sq[0]]!;
      board[home] = { type: kindOf(p.type), color: p.color };
      board[sq[0]] = null;
      break;
    }
    case 'demote':
      for (const s of sq) board[s] = { type: DEMOTED[board[s]!.type], color: board[s]!.color };
      break;
    case 'quake':
      if (sq.length === 2) [board[sq[0]], board[sq[1]]] = [board[sq[1]], board[sq[0]]];
      break;
    case 'ambush':
      for (const s of sq) board[s] = null;
      removed = sq.length > 0;
      break;
    case 'traitor':
      for (const s of sq) board[s] = { type: 'p', color: forMe ? me : them };
      break;
    case 'nitro':
      for (const s of sq) board[s] = { type: NITRO_OF[board[s]!.type] ?? board[s]!.type, color: forMe ? me : them };
      // Mine lasts until after my next move, theirs until after theirs (the very next).
      if (sq.length) fx.push({ k: 'nitro', c: forMe ? me : them, exp: ply + (forMe ? 3 : 2), sq: [] });
      break;
    // 'time' changes only the clocks; an unresolved chaos card (legality check) changes nothing.
  }
  // A rook taken from its corner (Işınlanma) loses its castling right.
  const castling = { ...pos.castling };
  for (const s of sq) {
    const right = CORNER_RIGHTS[s];
    if (right) castling[right] = false;
  }
  const extra: AnarsiExtra =
    card.id === 'chaos'
      ? { ...ex, chaos: { ...ex.chaos, [me]: true }, fx }
      : { ...ex, used: { ...ex.used, [me]: true }, fx };
  return {
    board,
    turn: them,
    castling,
    ep: null,
    halfmove: removed ? 0 : pos.halfmove + 1,
    fullmove: me === 'b' ? pos.fullmove + 1 : pos.fullmove,
    extra: asExtra(extra),
  };
}

/** Can the side to move in `pos` mate at once? */
function mateInOne(pos: Position): boolean {
  for (const m of legalMoves(anarsi, pos)) {
    if (m.card) continue;
    const next = applyMove(anarsi, pos, m);
    if (isInCheck(anarsi, next) && legalMoves(anarsi, next).length === 0) return true;
  }
  return false;
}

function resolveChaos(pos: Position, kind: string): { '+': Move[]; '-': Move[] } {
  const me = pos.turn;
  const them = opposite(me);
  const board = pos.board;
  const squares = (test: (p: Piece, sq: number) => boolean) => {
    const out: number[] = [];
    for (let sq = 0; sq < 64; sq++) if (board[sq] && test(board[sq]!, sq)) out.push(sq);
    return out;
  };
  // A pawn that changes sides never lands within two steps of promoting.
  const farFromPromotion = (sq: number, owner: Color) => (owner === 'w' ? rankOf(sq) <= 4 : rankOf(sq) >= 3);
  const targets = (outcome: '+' | '-'): number[] => {
    const victim = outcome === '+' ? them : me;
    switch (kind) {
      case 'ambush':
      case 'nitro': {
        const side = kind === 'ambush' ? victim : outcome === '+' ? me : them;
        return squares((p) => p.color === side && MINORS.has(p.type) && (kind === 'ambush' || p.type in NITRO_OF));
      }
      case 'traitor':
        return squares((p, sq) => p.type === 'p' && p.color === victim && farFromPromotion(sq, opposite(victim)));
      case 'demote': {
        // The victim's most valuable piece (a knight never becomes a pawn on its first or last rank).
        const can = squares(
          (p, sq) =>
            p.color === victim && p.type in DEMOTED && (DEMOTED[p.type] !== 'p' || (rankOf(sq) > 0 && rankOf(sq) < 7)),
        );
        const value = (sq: number) => STANDARD_VALUES[kindOf(board[sq]!.type)] ?? 0;
        const top = Math.max(0, ...can.map(value));
        return can.filter((sq) => value(sq) === top);
      }
      default:
        return [];
    }
  };
  // Deprem: two of the victim's pieces of different kinds swap places.
  const quakePairs = (outcome: '+' | '-'): number[][] => {
    const victim = outcome === '+' ? them : me;
    const sqs = squares((p) => p.color === victim && QUAKE_TYPES.has(p.type));
    const pairs: number[][] = [];
    for (let i = 0; i < sqs.length; i++)
      for (let j = i + 1; j < sqs.length; j++)
        if (kindOf(board[sqs[i]]!.type) !== kindOf(board[sqs[j]]!.type)) pairs.push([sqs[i], sqs[j]]);
    return pairs;
  };
  const resolve = (outcome: '+' | '-'): Move[] => {
    if (kind === 'time') return [play('chaos', [], kind, outcome)];
    const moves = (kind === 'quake' ? quakePairs(outcome) : targets(outcome).map((sq) => [sq]))
      .map((sq) => play('chaos', sq, kind, outcome))
      .filter((m) => {
        if (!isLegal(anarsi, pos, m)) return false;
        // A backfire never hands the opponent a mate in one.
        return outcome === '+' || !mateInOne(applyMove(anarsi, pos, m));
      });
    return moves.length ? moves : [play('chaos', [], kind, outcome)];
  };
  if (!(CHAOS_CARDS as readonly string[]).includes(kind)) throw new Error(`Unknown chaos card: ${kind}`);
  return { '+': resolve('+'), '-': resolve('-') };
}

/** Card notation: code, outcome of a chaos card, target squares. "KD@e5", "IS@c3-f3", "PU+@f6", "ZH-". */
function cardSan(move: Move): string {
  const card = move.card!;
  const code =
    card.id === 'chaos' ? (card.kind ? CARD_CODES[card.kind as ChaosCard] : 'KAOS') : CARD_CODES[card.id as Trick];
  const target = card.squares.length ? '@' + card.squares.map(squareName).join('-') : '';
  return code + (card.outcome ?? '') + target;
}

const CARD_SAN = /^([A-Z]{2,4})([+-]?)(?:@([a-h][1-8](?:-[a-h][1-8])*))?$/;

function parseCardSan(san: string): CardPlay | null {
  const m = CARD_SAN.exec(san);
  if (!m) return null;
  const squares = m[3] ? m[3].split('-').map(parseSquare) : [];
  if (m[1] === 'KAOS') return m[2] ? null : { id: 'chaos', squares };
  const id = CARD_OF_CODE.get(m[1]);
  if (!id) return null;
  if ((CHAOS_CARDS as readonly string[]).includes(id)) {
    return m[2] ? { id: 'chaos', squares, kind: id, outcome: m[2] as '+' | '-' } : null;
  }
  return m[2] ? null : { id, squares };
}

// ---------------------------------------------------------------------------
// Effects

const effectOn = (pos: Position, k: Effect['k'], sq: number) =>
  extraOf(pos).fx.find((e) => e.k === k && e.sq.includes(sq));

/** Effects run out at their ply; a frozen or shielded piece that is gone takes its effect along. */
function afterApply(_prev: Position, next: Position, _move: Move): Position {
  const ex = extraOf(next);
  if (!ex.fx.length) return next;
  const ply = plyOf(next);
  let board: (Piece | null)[] | null = null;
  const keep: Effect[] = [];
  for (const e of ex.fx) {
    const piece = next.board[e.sq[0]];
    const gone = (e.k === 'ice' || e.k === 'shield') && (!piece || piece.color !== e.c);
    if (e.exp > ply && !gone) {
      keep.push(e);
      continue;
    }
    board ??= next.board.slice();
    if (e.k === 'wall') for (const s of e.sq) if (board[s]?.type === 'o') board[s] = null;
    if (e.k === 'nitro') {
      for (let s = 0; s < 64; s++) {
        const p = board[s];
        if (p && p.color === e.c && p.type in BASE_OF) board[s] = { type: BASE_OF[p.type], color: p.color };
      }
    }
  }
  if (keep.length === ex.fx.length) return next;
  return { ...next, board: board ?? next.board, extra: asExtra({ ...ex, fx: keep }) };
}

function squareMarks(pos: Position): SquareMark[] {
  const ply = plyOf(pos);
  const marks: SquareMark[] = [];
  for (const e of extraOf(pos).fx) {
    // Moves left, counted like move numbers: one White and one Black half-move make a move, so
    // the count drops when the card's player has moved again (3, 3, 2, 2, 1 for a 3-move effect).
    const left = String(Math.floor((e.exp - ply) / 2) + 1);
    if (e.k === 'ice') marks.push({ square: e.sq[0], kind: 'ice', label: left });
    if (e.k === 'shield') marks.push({ square: e.sq[0], kind: 'shield', label: '' });
    if (e.k === 'wall') e.sq.forEach((s, i) => marks.push({ square: s, kind: 'wall', label: i === 0 ? left : '' }));
  }
  return marks;
}

// ---------------------------------------------------------------------------
// FEN field 7: tricks, played flags, effects. "void.ice.0010" + ";ice.b.15.c4;wall.w.20.c5d5e5"

const initialExtra = (): VariantExtra =>
  asExtra({ trick: { w: null, b: null }, used: { w: false, b: false }, chaos: { w: false, b: false }, fx: [] });

function serializeExtra(extra: VariantExtra): string {
  const ex = extra as unknown as AnarsiExtra;
  const bit = (b: boolean) => (b ? '1' : '0');
  const head = `${ex.trick.w ?? '-'}.${ex.trick.b ?? '-'}.${bit(ex.used.w)}${bit(ex.used.b)}${bit(ex.chaos.w)}${bit(ex.chaos.b)}`;
  return [head, ...ex.fx.map((e) => `${e.k}.${e.c}.${e.exp}.${e.sq.map(squareName).join('')}`)].join(';');
}

function parseExtra(field: string | undefined): VariantExtra {
  if (!field) return initialExtra();
  const [head, ...effects] = field.split(';');
  const m = /^([a-z-]+)\.([a-z-]+)\.([01]{4})$/.exec(head);
  const trick = (s: string) => {
    if (s === '-') return null;
    if (!(TRICKS as readonly string[]).includes(s)) throw new Error(`Invalid Anarşi FEN field: ${field}`);
    return s as Trick;
  };
  if (!m) throw new Error(`Invalid Anarşi FEN field: ${field}`);
  const fx = effects.map((e): Effect => {
    const [k, c, exp, sqs = ''] = e.split('.');
    if (!['ice', 'shield', 'wall', 'nitro'].includes(k) || (c !== 'w' && c !== 'b') || !/^\d+$/.test(exp)) {
      throw new Error(`Invalid Anarşi effect: ${e}`);
    }
    const sq = (sqs.match(/[a-h][1-8]/g) ?? []).map(parseSquare);
    return { k: k as Effect['k'], c, exp: Number(exp), sq };
  });
  const f = m[3];
  return asExtra({
    trick: { w: trick(m[1]), b: trick(m[2]) },
    used: { w: f[0] === '1', b: f[1] === '1' },
    chaos: { w: f[2] === '1', b: f[3] === '1' },
    fx,
  });
}

// ---------------------------------------------------------------------------
// Setup: each player picks a trick

export const TRICK_NAMES: Readonly<Record<Trick | ChaosCard, string>> = {
  void: 'Kara Delik',
  pawn: 'Piyon Avı',
  ice: 'Buz',
  swap: 'Işınlanma',
  shield: 'Kalkan',
  wall: 'Barikat',
  revive: 'Diriliş',
  exile: 'Sürgün',
  time: 'Zaman Hırsızı',
  ambush: 'Pusu',
  traitor: 'Hain',
  nitro: 'Nitro',
  demote: 'Rütbe Düşürme',
  quake: 'Deprem',
};

export const TRICK_NAMES_EN: Readonly<Record<Trick | ChaosCard, string>> = {
  void: 'Black Hole',
  pawn: 'Pawn Hunt',
  ice: 'Ice',
  swap: 'Teleport',
  shield: 'Shield',
  wall: 'Barricade',
  revive: 'Revival',
  exile: 'Exile',
  time: 'Time Thief',
  ambush: 'Ambush',
  traitor: 'Traitor',
  nitro: 'Nitro',
  demote: 'Demotion',
  quake: 'Earthquake',
};

const TRICK_DETAILS: Readonly<Record<Trick, string>> = {
  void: 'Boş bir kare oyun sonuna kadar silinir.',
  pawn: 'Rakibin bir piyonu tahtadan alınır.',
  ice: 'Rakibin bir taşı 3 tur oynayamaz.',
  swap: 'Kendi iki taşının yeri değişir.',
  shield: 'Taşın bir tur yenemez.',
  wall: '3 boş kare 3 tur kapanır.',
  revive: 'Yenmiş filin (yoksa atın) ilk sırandaki seçtiğin boş kareye döner.',
  exile: 'Rakibin bir hafif taşı başladığı kareye geri döner.',
};

const TRICK_DETAILS_EN: Readonly<Record<Trick, string>> = {
  void: 'An empty square leaves the board for good.',
  pawn: 'One opponent pawn leaves the board.',
  ice: 'An opponent piece cannot move for 3 turns.',
  swap: 'Two of your pieces swap places.',
  shield: 'Your piece cannot be taken for a turn.',
  wall: '3 empty squares close for 3 turns.',
  revive: 'A bishop of yours that was taken (else a knight) returns to an empty square of your first rank.',
  exile: 'An opponent minor piece goes back to its starting square.',
};

const question = (color: Color): SetupQuestion => ({
  id: color,
  color,
  title: `${color === 'w' ? 'Beyaz' : 'Siyah'}: numaranı seç`,
  defaultOption: color === 'w' ? 'void' : 'ice',
  options: TRICKS.map((t) => ({ id: t, label: TRICK_NAMES[t], detail: TRICK_DETAILS[t] })),
});

const questionEn = (color: Color): SetupQuestionTexts => ({
  title: `${color === 'w' ? 'White' : 'Black'}: pick your trick`,
  options: Object.fromEntries(TRICKS.map((t) => [t, TRICK_NAMES_EN[t]])),
  details: TRICK_DETAILS_EN,
});

function startPosition(answers: Readonly<Record<string, string>>): string {
  const extra = parseExtra(`${answers.w}.${answers.b}.0000`);
  return `${STANDARD_START} ${serializeExtra(extra)}`;
}

// ---------------------------------------------------------------------------
// Fast board (bot search): frozen pieces cannot move, a shielded piece cannot be taken; both
// wear off as the search goes deeper. Walls and nitro pieces stay as they are there.
// extra: [ice 1, ice 2, shield] as (1 + square + 64 * side, plies left).

const FAST: FastHooks = {
  extraSlots: 6,
  readExtra: (b, pos) => {
    const ply = plyOf(pos);
    let ice = 0;
    for (const e of extraOf(pos).fx) {
      const code = 1 + e.sq[0] + 64 * (e.c === 'w' ? 0 : 1);
      if (e.k === 'ice' && ice < 2) {
        b.extra[ice * 2] = code;
        b.extra[ice * 2 + 1] = e.exp - ply;
        ice++;
      }
      if (e.k === 'shield') {
        b.extra[4] = code;
        b.extra[5] = e.exp - ply;
      }
    }
  },
  afterMove: (b) => {
    for (let i = 1; i < 6; i += 2) {
      if (b.extra[i] > 0 && --b.extra[i] === 0) b.extra[i - 1] = 0;
    }
  },
  frozen: (b, from) => {
    const code = 1 + from + 64 * b.side;
    return b.extra[0] === code || b.extra[2] === code;
  },
  captureAllowed: (b, _from, victimSq) => b.extra[4] === 0 || (b.extra[4] - 1) % 64 !== victimSq,
  hashExtra: (b) => b.extra[0] ^ (b.extra[2] << 7) ^ (b.extra[4] << 14),
};

// ---------------------------------------------------------------------------

export const anarsi: VariantDefinition = defineVariant({
  id: 'anarsi',
  name: 'Anarşi',
  // Chaos cards bring luck into it.
  unrated: true,
  description: [
    'Standart satranç, artı kartlar. Her kart oyunda bir kez, o turun hamlesi yerine oynanır.',
    'Oyundan önce herkes bir numara seçer: Kara Delik, Piyon Avı, Buz, Işınlanma, Kalkan, Barikat, Diriliş ya da Sürgün. Numara hep sana yarar.',
    'Herkese bir de gizli kaos kartı gelir: Zaman Hırsızı, Pusu, Hain, Nitro, Rütbe Düşürme ya da Deprem. Oynayınca ya isabet eder (sana yarar) ya geri teper (rakibe yarar).',
    `Kaos kartı ${CHAOS_FROM_MOVE}. hamleden önce oynanmaz. Şah çekiliyken hiçbir kart oynanmaz.`,
    'Geri tepen kart şahını açmaz, rakibe tek hamlede mat fırsatı vermez.',
  ],
  startPosition: startPosition({ w: 'void', b: 'ice' }),
  setup: { questions: [question('w'), question('b')], startPosition },
  pieces: { ...STANDARD_PIECES, x: HOLE, o: WALL, y: NITRO_KNIGHT, z: NITRO_BISHOP },
  promotionTypes: ['q', 'r', 'b', 'n'],
  pieceValues: { ...STANDARD_VALUES, x: 0, o: 0, y: 350, z: 380 },
  initialExtra,
  serializeExtra,
  parseExtra,
  hashExtra: (pos) => serializeExtra(pos.extra),
  generateMoves: (pos, from, base) => {
    const p = pos.board[from];
    const ice = p && effectOn(pos, 'ice', from);
    return ice && ice.c === p.color ? [] : base(pos, from);
  },
  captureAllowed: (pos, _from, victimSquare, _attacker, victim) => {
    const shield = effectOn(pos, 'shield', victimSquare);
    return !shield || shield.c !== victim.color;
  },
  cards: {
    chaosKinds: CHAOS_CARDS,
    moves: cardMoves,
    apply: applyCard,
    resolveChaos,
    san: cardSan,
    parseSan: parseCardSan,
  },
  afterApply,
  squareMarks,
  fast: FAST,
  emblem: '<circle cx="24" cy="24" r="18"/><path d="M14 38L24 9l10 29M16 28h21"/>',
  rules: {
    title: 'Anarşi',
    summary: 'Standart satranç, artı bir numara ve bir kaos kartı. Kart oynamak hamle yerine geçer.',
    bullets: [
      'Oyundan önce bir numara seçersin ve oyunda bir kez, hamle yerine oynarsın. Numara hep sana yarar.',
      'Kara Delik boş bir kareyi oyun sonuna kadar siler; Barikat yan yana 3 boş kareyi 3 tur kapatır. Oralara hiçbir taş giremez, üstünden geçemez.',
      'Piyon Avı rakibin bir piyonunu alır; Buz rakibin bir taşını 3 tur dondurur (donan taş yine saldırır ve korur); Sürgün rakibin bir hafif taşını başladığı kareye geri yollar.',
      'Işınlanma kendi iki taşının yerini değiştirir (şah ve piyon olmaz); Kalkan taşını bir tur yenmez yapar; Diriliş yenmiş filini (yoksa atını) ilk sırandaki seçtiğin boş kareye geri getirir.',
      `Gizli kaos kartı (${CHAOS_FROM_MOVE}. hamleden sonra): Zaman Hırsızı 60 saniye, Pusu bir hafif taş, Hain bir piyon, Nitro bir hamlelik vezir gücü, Rütbe Düşürme en değerli taşı bir rütbe indirir, Deprem iki taşın yerini değiştirir. İsabet sana, geri tepme rakibe yarar.`,
      'Şah çekiliyken kart oynanmaz. Geri tepen kart şahını açmaz, rakibe tek hamlede mat fırsatı vermez.',
    ],
    examples: [],
  },
  translations: {
    en: {
      name: 'Anarchy',
      description: [
        'Standard chess plus cards. Each card is played once in a game, instead of that turn’s move.',
        'Before the game each player picks a trick: Black Hole, Pawn Hunt, Ice, Teleport, Shield, Barricade, Revival or Exile. A trick always helps you.',
        'Each player also gets a hidden chaos card: Time Thief, Ambush, Traitor, Nitro, Demotion or Earthquake. Played, it either hits (helps you) or backfires (helps the opponent).',
        `A chaos card cannot be played before move ${CHAOS_FROM_MOVE}. No card can be played while in check.`,
        'A backfire never leaves your king open and never hands the opponent a mate in one.',
      ],
      rules: {
        title: 'Anarchy',
        summary: 'Standard chess plus one trick and one chaos card. Playing a card takes your move.',
        bullets: [
          'Before the game you pick a trick and play it once, instead of a move. A trick always helps you.',
          'Black Hole takes an empty square off the board for good; Barricade closes 3 empty squares in a row for 3 turns. No piece enters or passes them.',
          'Pawn Hunt takes an opponent pawn; Ice freezes an opponent piece for 3 turns (it still attacks and defends); Exile sends an opponent minor piece back to its starting square.',
          'Teleport swaps two of your pieces (not the king, not pawns); Shield keeps your piece from being taken for a turn; Revival brings back a taken bishop (else a knight) to an empty square of your first rank.',
          `Hidden chaos card (from move ${CHAOS_FROM_MOVE}): Time Thief 60 seconds, Ambush a minor piece, Traitor a pawn, Nitro one queen move, Demotion takes the best piece one rank down, Earthquake swaps two pieces. A hit helps you, a backfire the opponent.`,
          'No card while in check. A backfire never leaves your king open or hands the opponent a mate in one.',
        ],
        captions: [],
      },
      pieceNames: { ...STANDARD_PIECE_NAMES_EN, x: 'Black hole', o: 'Barricade', y: 'Nitro knight', z: 'Nitro bishop' },
      setup: { w: questionEn('w'), b: questionEn('b') },
    },
  },
});
