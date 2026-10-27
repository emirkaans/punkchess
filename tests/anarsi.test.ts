import { describe, expect, it } from 'vitest';
import { parseSquare as sq, squareName } from '../src/engine/board.ts';
import { FastBoard, moveFrom, moveTo } from '../src/engine/fast/board.ts';
import { createGame, drawChaos, makeMove, playSan, setupStartPosition } from '../src/engine/game.ts';
import { isInCheck, legalMoves, legalMovesFrom } from '../src/engine/legality.ts';
import { moveToSan, parseFen, toFen } from '../src/engine/notation.ts';
import { cardMove } from '../src/engine/types.ts';
import type { GameState, Move } from '../src/engine/types.ts';
import { anarsi as v } from '../src/engine/variants/anarsi.ts';

const fen = (placement: string, turn: 'w' | 'b', head: string, move = 10) =>
  `${placement} ${turn} - - 0 ${move} ${head}`;
const cards = (state: GameState) => legalMoves(v, state.position).filter((m) => m.card);
const card = (id: string, ...squares: string[]): Move => cardMove({ id, squares: squares.map(sq) });
const targets = (state: GameState, from: string) =>
  legalMovesFrom(v, state.position, sq(from))
    .map((m) => squareName(m.to))
    .sort();

describe('Anarşi: kurulum ve FEN', () => {
  it('seçilen numaralar başlangıç konumuna yazılır, FEN gidiş-dönüş', () => {
    const start = setupStartPosition(v, { w: 'wall', b: 'pawn' });
    expect(start.endsWith(' wall.pawn.0000')).toBe(true);
    const g = createGame(v, start);
    expect(toFen(v, g.position)).toBe(start);
    // İlk hamlede kaos kartı yok; numara var.
    expect(cards(g).some((m) => m.card!.id === 'chaos')).toBe(false);
    expect(cards(g).every((m) => m.card!.id === 'wall')).toBe(true);
  });

  it('etkiler FEN alanında saklanır', () => {
    const f = fen('4k3/8/8/8/8/8/8/4K3', 'w', 'ice.void.1000;ice.b.21.e8;wall.w.24.c4d4e4');
    expect(toFen(v, parseFen(v, f))).toBe(f);
  });
});

describe('Anarşi: numaralar', () => {
  it('Kara Delik: kare silinir, kale geçemez; notasyon KD@e4', () => {
    let g = createGame(v, fen('4k3/8/8/8/R7/8/8/4K3', 'w', 'void.-.0000'));
    const m = card('void', 'e4');
    expect(moveToSan(v, g.position, cardMove(m.card!))).toBe('KD@e4');
    g = makeMove(v, g, m);
    expect(g.position.board[sq('e4')]).toEqual({ type: 'x', color: 'w' });
    g = playSan(v, g, 'Kd8');
    expect(targets(g, 'a4')).not.toContain('f4');
    expect(targets(g, 'a4')).toContain('d4');
    // Numara bir kez oynanır.
    expect(cards(g).filter((x) => x.card!.id === 'void')).toHaveLength(0);
  });

  it('Piyon Avı: rakip piyonu kalkar', () => {
    const g = makeMove(v, createGame(v, fen('4k3/3p4/8/8/8/8/8/4K3', 'w', 'pawn.-.0000')), card('pawn', 'd7'));
    expect(g.position.board[sq('d7')]).toBeNull();
    expect(g.moves[0].san).toBe('PA@d7');
  });

  it('Buz: donan taş 2 tur oynayamaz ama şah çeker', () => {
    let g = createGame(v, fen('4k3/8/8/8/8/8/1r6/4K3', 'w', 'ice.-.0000'));
    g = makeMove(v, g, card('ice', 'b2'));
    expect(targets(g, 'b2')).toEqual([]);
    g = playSan(v, g, 'Kd8');
    // Kale donuk ama 2. yatayı tutuyor: beyaz şah 2. yataya çıkamaz.
    expect(targets(g, 'e1').some((s) => s.endsWith('2'))).toBe(false);
    g = playSan(v, g, 'Kf1');
    expect(targets(g, 'b2')).toEqual([]);
    g = playSan(v, g, 'Ke8', 'Kg1');
    expect(targets(g, 'b2').length).toBeGreaterThan(0);
  });

  it('Işınlanma: iki taş yer değiştirir, köşeden çıkan kale rok hakkını kaybeder', () => {
    let g = createGame(v, '4k3/8/8/8/8/8/8/R3K1N1 w Q - 0 10 swap.-.0000');
    g = makeMove(v, g, card('swap', 'a1', 'g1'));
    expect(g.position.board[sq('a1')]?.type).toBe('n');
    expect(g.position.board[sq('g1')]?.type).toBe('r');
    expect(g.position.castling.wQ).toBe(false);
    expect(g.moves[0].san).toBe('IS@a1-g1');
  });

  it('Kalkan: rakibin bir sonraki hamlesinde yenmez, sonra yenir', () => {
    let g = createGame(v, fen('3rk3/8/8/8/3N4/8/8/4K3', 'w', 'shield.-.0000'));
    g = makeMove(v, g, card('shield', 'd4'));
    expect(targets(g, 'd8')).not.toContain('d4');
    g = playSan(v, g, 'Rd7', 'Kf1');
    expect(targets(g, 'd7')).toContain('d4');
  });

  it('Barikat: 3 kare 3 tur kapalı, sonra açılır', () => {
    let g = createGame(v, fen('4k3/8/8/8/8/8/8/R3K3', 'w', 'wall.-.0000'));
    g = makeMove(v, g, card('wall', 'b8', 'c8', 'd8'));
    expect(g.moves[0].san).toBe('BR@b8-c8-d8');
    expect(['b8', 'c8', 'd8'].map((s) => g.position.board[sq(s)]?.type)).toEqual(['o', 'o', 'o']);
    g = playSan(v, g, 'Kf7', 'Ke2', 'Ke7', 'Ke1');
    expect(g.position.board[sq('c8')]?.type).toBe('o');
    g = playSan(v, g, 'Kf7');
    expect(g.position.board[sq('c8')]).toBeNull();
  });

  it('şah çekiliyken kart oynanmaz', () => {
    const g = createGame(v, fen('4k3/8/8/8/8/8/8/r3K3', 'w', 'void.-.0000'));
    expect(isInCheck(v, g.position)).toBe(true);
    expect(cards(g)).toEqual([]);
  });
});

describe('Anarşi: kaos kartları', () => {
  const rng = (...xs: number[]) => {
    let i = 0;
    return () => xs[i++ % xs.length];
  };

  it(`kaos kartı 6. hamleden önce oynanmaz`, () => {
    expect(cards(createGame(v, fen('4k3/8/8/8/8/8/8/4K3', 'w', '-.-.0000', 5)))).toEqual([]);
    expect(cards(createGame(v, fen('4k3/8/8/8/8/8/8/4K3', 'w', '-.-.0000', 6))).map((m) => m.card!.id)).toEqual([
      'chaos',
    ]);
  });

  it('Pusu: isabet rakibin hafif taşını, geri tepme kendininkini alır', () => {
    const g = createGame(v, fen('4k3/8/2n5/8/8/5B2/8/4K3', 'w', '-.-.0000'));
    const hit = drawChaos(v, g.position, 'ambush', rng(0.1, 0));
    expect(hit.card).toMatchObject({ kind: 'ambush', outcome: '+', squares: [sq('c6')] });
    const after = makeMove(v, g, hit);
    expect(after.position.board[sq('c6')]).toBeNull();
    expect(after.moves[0].san).toBe('PU+@c6');
    const back = makeMove(v, g, drawChaos(v, g.position, 'ambush', rng(0.9, 0)));
    expect(back.position.board[sq('f3')]).toBeNull();
    expect(back.position.extra).toMatchObject({ chaos: { w: true, b: false } });
  });

  it('uydurma kaos sonucu kabul edilmez', () => {
    const g = createGame(v, fen('4k3/8/2n5/8/8/5B2/8/4K3', 'w', '-.-.0000'));
    const fake = cardMove({ id: 'chaos', squares: [sq('e8')], kind: 'ambush', outcome: '+' });
    expect(() => makeMove(v, g, fake)).toThrow();
  });

  it('Hain: rakibin piyonu senin olur', () => {
    const g = createGame(v, fen('4k3/8/8/8/3p4/8/8/4K3', 'w', '-.-.0000'));
    const after = makeMove(v, g, drawChaos(v, g.position, 'traitor', rng(0.1, 0)));
    expect(after.position.board[sq('d4')]).toEqual({ type: 'p', color: 'w' });
  });

  it('Hain: terfiye 2 kareden yakın piyon taraf değiştirmez; hedef yoksa kart boşa gider', () => {
    const g = createGame(v, fen('4k3/8/3p4/8/8/8/8/4K3', 'w', '-.-.0000'));
    const ways = v.cards!.resolveChaos(g.position, 'traitor');
    expect(ways['+'].map((m) => m.card!.squares)).toEqual([[]]);
    expect(makeMove(v, g, ways['+'][0]).moves[0].san).toBe('HN+');
  });

  it('Nitro: hafif taş bir hamlelik vezir gibi oynar, sonra geri döner', () => {
    let g = createGame(v, fen('4k3/7p/8/8/8/8/7P/1N2K3', 'w', '-.-.0000'));
    g = makeMove(v, g, drawChaos(v, g.position, 'nitro', rng(0.1, 0)));
    expect(g.position.board[sq('b1')]).toEqual({ type: 'y', color: 'w' });
    g = playSan(v, g, 'Kd8');
    expect(targets(g, 'b1')).toContain('b7');
    g = playSan(v, g, 'Nb7+');
    expect(g.position.board[sq('b7')]).toEqual({ type: 'n', color: 'w' });
  });

  it('Zaman Hırsızı tahtaya dokunmaz; kaos notasyonu geri okunur', () => {
    const g = createGame(v, fen('4k3/7p/8/8/8/8/7P/4K3', 'w', '-.-.0000'));
    const after = makeMove(v, g, drawChaos(v, g.position, 'time', rng(0.9)));
    expect(after.moves[0].san).toBe('ZH-');
    expect(after.position.board).toEqual(g.position.board);
    const replay = playSan(v, createGame(v, fen('4k3/7p/8/8/8/8/7P/4K3', 'w', '-.-.0000')), 'ZH-', 'Kd8');
    expect(replay.position.extra).toMatchObject({ chaos: { w: true } });
  });

  it('geri tepme şahı açmaz: bağlı taş seçilmez', () => {
    // f2'deki fil şahı vezirden koruyor; geri tepen Pusu onu alamaz, a1'deki atı alır.
    const g = createGame(v, fen('4k3/8/8/8/8/6q1/5B2/N3K3', 'w', '-.-.0000'));
    expect(v.cards!.resolveChaos(g.position, 'ambush')['-'].map((m) => m.card!.squares)).toEqual([[sq('a1')]]);
  });
});

describe('Anarşi: hızlı tahta', () => {
  const same = (f: string) => {
    const pos = parseFen(v, f);
    const fast = new FastBoard(v).load(pos).legalMoves();
    const engine = legalMoves(v, pos).filter((m) => !m.card);
    expect(fast.length).toBe(engine.length);
    return fast.map((m) => squareName(moveFrom(m)) + squareName(moveTo(m)));
  };

  it('donuk taşın hamlesi yok', () => {
    const moves = same(fen('3rk3/8/8/8/3N4/8/1R6/4K3', 'w', 'ice.-.0000;ice.w.21.b2'));
    expect(moves.some((m) => m.startsWith('b2'))).toBe(false);
  });

  it('kalkanlı taş yenmez', () => {
    const moves = same(fen('3rk3/8/8/8/3N4/8/1R6/4K3', 'b', 'shield.-.1000;shield.w.20.d4'));
    expect(moves).not.toContain('d8d4');
  });
});
