import { describe, expect, it } from 'vitest';
import { parseSquare as sq, squareName } from '../src/engine/board.ts';
import { FastBoard, moveFrom, moveTo } from '../src/engine/fast/board.ts';
import { chaosPlayable, createGame, drawChaos, makeMove, playSan, setupStartPosition } from '../src/engine/game.ts';
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
    expect(start.endsWith(' wall.pawn.0000.2')).toBe(true);
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

  it('Piyon Avı: rakibin iki piyonu kalkar; tek piyon kaldıysa o', () => {
    let g = createGame(v, fen('4k3/3pp3/8/7p/8/8/8/4K3', 'w', 'pawn.-.0000'));
    expect(cards(g).filter((m) => m.card!.id === 'pawn')).toHaveLength(3);
    g = makeMove(v, g, card('pawn', 'd7', 'e7'));
    expect(g.position.board[sq('d7')]).toBeNull();
    expect(g.position.board[sq('e7')]).toBeNull();
    expect(g.position.board[sq('h5')]).toEqual({ type: 'p', color: 'b' });
    expect(g.moves[0].san).toBe('PA@d7-e7');
    const one = makeMove(v, createGame(v, fen('4k3/3p4/8/8/8/8/8/4K3', 'w', 'pawn.-.0000')), card('pawn', 'd7'));
    expect(one.position.board[sq('d7')]).toBeNull();
    expect(one.moves[0].san).toBe('PA@d7');
  });

  it('Buz: donan taş 3 tur oynayamaz ama şah çeker; sayaç tam hamle sayar', () => {
    let g = createGame(v, fen('4k3/8/8/8/8/8/1r6/4K3', 'w', 'ice.-.0000'));
    const left = () => v.squareMarks!(g.position).find((m) => m.kind === 'ice')?.label;
    g = makeMove(v, g, card('ice', 'b2'));
    expect(targets(g, 'b2')).toEqual([]);
    expect(left()).toBe('3');
    g = playSan(v, g, 'Kd8');
    // Rakip oynadı ama tam hamle bitmedi: sayaç düşmez.
    expect(left()).toBe('3');
    // Kale donuk ama 2. yatayı tutuyor: beyaz şah 2. yataya çıkamaz.
    expect(targets(g, 'e1').some((s) => s.endsWith('2'))).toBe(false);
    g = playSan(v, g, 'Kf1');
    expect(left()).toBe('2');
    expect(targets(g, 'b2')).toEqual([]);
    g = playSan(v, g, 'Ke8', 'Kg1');
    expect(left()).toBe('1');
    expect(targets(g, 'b2')).toEqual([]);
    g = playSan(v, g, 'Kd8', 'Kh1');
    expect(left()).toBeUndefined();
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

  it('Kalkan: rakibin sonraki iki hamlesinde yenmez, sonra yenir', () => {
    let g = createGame(v, fen('3rk3/8/8/8/3N4/8/8/4K3', 'w', 'shield.-.0000'));
    g = makeMove(v, g, card('shield', 'd4'));
    expect(targets(g, 'd8')).not.toContain('d4');
    expect(v.squareMarks!(g.position).find((m) => m.kind === 'shield')?.label).toBe('2');
    g = playSan(v, g, 'Rd7', 'Kf1');
    expect(targets(g, 'd7')).not.toContain('d4');
    expect(v.squareMarks!(g.position).find((m) => m.kind === 'shield')?.label).toBe('1');
    g = playSan(v, g, 'Rd6', 'Kg1');
    expect(targets(g, 'd6')).toContain('d4');
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

  it('Nitro: hafif taş iki hamle vezir gibi oynar, sonra geri döner', () => {
    let g = createGame(v, fen('4k3/7p/8/8/8/8/7P/1N2K3', 'w', '-.-.0000'));
    g = makeMove(v, g, drawChaos(v, g.position, 'nitro', rng(0.1, 0)));
    expect(g.position.board[sq('b1')]).toEqual({ type: 'y', color: 'w' });
    g = playSan(v, g, 'Kd8');
    expect(targets(g, 'b1')).toContain('b7');
    // İlk vezir hamlesinden sonra hâlâ nitrolu.
    g = playSan(v, g, 'Nb3');
    expect(g.position.board[sq('b3')]).toEqual({ type: 'y', color: 'w' });
    g = playSan(v, g, 'Kc8');
    expect(targets(g, 'b3')).toContain('b8');
    // İkinci hamleden sonra yeniden at.
    g = playSan(v, g, 'Nb6');
    expect(g.position.board[sq('b6')]).toEqual({ type: 'n', color: 'w' });
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

describe('Anarşi: bot', () => {
  // punkchess.com/NK4KsZEP: the wall on e2 comes down with White's next move, so Kd1 walks
  // into the queen on f3. The fast board knows no wall expiry and offered Kd1; the bot crashed.
  it('arama, duvar inince yasa dışı kalan hamleyi önermez', async () => {
    const { search } = await import('../src/ai/search.ts');
    const state = createGame(
      v,
      'r4rk1/p1p2pb1/1p1p4/8/4B2P/4Bq2/PP1QoooR/2K2R2 w - - 1 25 ice.wall.1101;wall.b.49.e2f2g2',
    );
    expect(targets(state, 'c1')).toEqual(['b1', 'c2']);
    const r = search(v, state, {
      maxDepth: 2,
      quiescence: true,
      transpositionTable: false,
      mobility: false,
      timeLimitMs: 500,
      rootExact: { topK: 1, margin: 0 },
    });
    expect(r.scores.map((x) => `${squareName(x.move.from)}${squareName(x.move.to)}`)).not.toContain('c1d1');
  });
});

describe('Anarşi: yeni kartlar', () => {
  const rng = (...xs: number[]) => {
    let i = 0;
    return () => xs[i++ % xs.length];
  };
  const tricks = (state: GameState, id: string) =>
    cards(state)
      .filter((m) => m.card!.id === id)
      .map((m) => squareName(m.card!.squares[0]));
  it('Diriliş: yenmiş fil ilk sıradaki seçilen boş kareye döner; notasyon DR@c1', () => {
    // Beyazın iki atı da duruyor, bir fili eksik: fil döner.
    let g = createGame(v, fen('4k3/8/8/8/8/8/8/1N2K1NB', 'w', 'revive.-.0000'));
    expect(tricks(g, 'revive').sort()).toEqual(['a1', 'c1', 'd1', 'f1']);
    g = makeMove(v, g, card('revive', 'd1'));
    expect(g.position.board[sq('d1')]).toEqual({ type: 'b', color: 'w' });
    expect(g.moves[0].san).toBe('DR@d1');
    expect(playSan(v, createGame(v, fen('4k3/8/8/8/8/8/8/1N2K1NB', 'w', 'revive.-.0000')), 'DR@d1').position).toEqual(
      g.position,
    );
  });

  it('Diriliş: iki fil de duruyorsa at döner; hiçbiri yenmediyse kart yok', () => {
    const g = makeMove(v, createGame(v, fen('4k3/8/8/8/8/8/8/2B1KB2', 'w', 'revive.-.0000')), card('revive', 'a1'));
    expect(g.position.board[sq('a1')]).toEqual({ type: 'n', color: 'w' });
    expect(tricks(createGame(v, fen('4k3/8/8/8/8/8/8/1NB1KBN1', 'w', 'revive.-.0000')), 'revive')).toEqual([]);
  });

  it('Sürgün: rakibin hafif taşı başladığı kareye döner (fil kendi renginde, at yakındakine)', () => {
    let g = createGame(v, fen('4k3/p7/8/3b4/8/8/P7/4K3', 'w', 'exile.-.0000'));
    g = makeMove(v, g, card('exile', 'd5'));
    // d5 açık renk kare: siyahın açık kareli fili c8'de başlar.
    expect(g.position.board[sq('c8')]).toEqual({ type: 'b', color: 'b' });
    expect(g.position.board[sq('d5')]).toBeNull();
    const h = makeMove(v, createGame(v, fen('4k3/p7/8/5n2/8/8/P7/4K3', 'w', 'exile.-.0000')), card('exile', 'f5'));
    expect(h.position.board[sq('g8')]).toEqual({ type: 'n', color: 'b' });
    expect(h.moves[0].san).toBe('SG@f5');
  });

  it('Sürgün: başlangıç karesi doluysa ya da taş zaten oradaysa oynanmaz', () => {
    const g = createGame(v, fen('2b1k3/8/8/3b4/8/8/8/4K3', 'w', 'exile.-.0000'));
    expect(tricks(g, 'exile')).toEqual([]);
  });

  it('Rütbe Düşürme: isabet rakibin veziri kale olur, geri tepme kendi kalen fil olur', () => {
    const g = createGame(v, fen('3qk3/8/8/8/8/8/8/R3K3', 'w', '-.-.0000'));
    const hit = makeMove(v, g, drawChaos(v, g.position, 'demote', rng(0.1, 0)));
    expect(hit.position.board[sq('d8')]).toEqual({ type: 'r', color: 'b' });
    expect(hit.moves[0].san).toBe('RD+@d8');
    const back = makeMove(v, g, drawChaos(v, g.position, 'demote', rng(0.9, 0)));
    expect(back.position.board[sq('a1')]).toEqual({ type: 'b', color: 'w' });
    // Köşedeki kale düşünce rok hakkı gider.
    expect(back.position.castling.wQ).toBe(false);
  });

  it('Deprem: rakibin iki farklı taşı yer değiştirir, piyon ve şah karışmaz', () => {
    const g = createGame(v, fen('r3k3/p7/8/8/8/2n5/8/4K3', 'w', '-.-.0000'));
    const ways = v.cards!.resolveChaos(g.position, 'quake');
    expect(ways['+'].map((m) => m.card!.squares.map(squareName))).toEqual([['c3', 'a8']]);
    const after = makeMove(v, g, ways['+'][0]);
    expect(after.position.board[sq('a8')]).toEqual({ type: 'n', color: 'b' });
    expect(after.position.board[sq('c3')]).toEqual({ type: 'r', color: 'b' });
    expect(after.moves[0].san).toBe('DP+@c3-a8');
  });
});

describe('Anarşi: kart sonucu (ekranda gösterilen)', () => {
  it('değişen kareler, önceki ve sonraki taşlarıyla okunur', async () => {
    const { cardResult } = await import('../src/ui/cardResult.ts');
    const start = createGame(v, fen('4k3/p7/8/5n2/8/8/P7/4K3', 'w', 'exile.-.0000'));
    const after = makeMove(v, start, card('exile', 'f5'));
    const r = cardResult(start.position, after.moves[0].move, after.position)!;
    expect(r).toMatchObject({ color: 'w', id: 'exile', chaos: false, outcome: null, empty: false });
    expect(r.changes.map((c) => [squareName(c.square), c.before?.type ?? null, c.after?.type ?? null])).toEqual([
      ['f5', 'n', null],
      ['g8', null, 'n'],
    ]);
  });
});

describe('Anarşi: nitrolu taşın rozeti', () => {
  it('nitrolu at ve fil, sürdüğü sürece vezir rozeti taşır', () => {
    const pos = createGame(v, fen('4k3/8/8/8/8/8/8/2Z1K1Y1', 'w', '-.-.0000')).position;
    expect(v.pieces.z.badge!(pos, 'w')?.label).toBe('♛');
    expect(v.pieces.y.badge!(pos, 'w')?.label).toBe('♛');
    expect(v.pieces.b.badge).toBeUndefined();
  });
});

describe('Anarşi: Ateşkes ve Mayın', () => {
  it('Ateşkes: 2 tur boyunca kimse taş yiyemez, şah yine şahtır; sonra yeme döner', () => {
    let g = createGame(v, fen('4k3/8/8/3p4/4P3/8/8/R3K3', 'w', 'truce.-.0000'));
    expect(cards(g).filter((m) => m.card!.id === 'truce')).toHaveLength(1);
    g = makeMove(v, g, cardMove({ id: 'truce', squares: [] }));
    expect(g.moves[0].san).toBe('AK');
    // Siyah d5 piyonu e4'ü yiyemez.
    expect(targets(g, 'd5')).toEqual(['d4']);
    g = playSan(v, g, 'Kd7');
    expect(targets(g, 'e4')).toEqual(['e5']);
    // Kale şah çeker: şah hâlâ saldırı altında sayılır.
    g = playSan(v, g, 'Ra7+');
    expect(isInCheck(v, g.position)).toBe(true);
    g = playSan(v, g, 'Kd6');
    g = playSan(v, g, 'Kf1');
    // İki tur doldu: yeme serbest.
    expect(targets(g, 'd5')).toContain('e4');
  });

  it('Mayın: rakip taş basınca patlar, sahibinin taşı basınca bir şey olmaz; şah sadece temizler', () => {
    let g = createGame(v, fen('4k3/8/8/8/8/2n5/8/R3K3', 'w', 'mine.-.0000'));
    g = makeMove(v, g, card('mine', 'b1'));
    expect(g.moves[0].san).toBe('MY@b1');
    // Sadece sahibine görünen işaret.
    expect(v.squareMarks!(g.position)).toMatchObject([{ square: sq('b1'), kind: 'mine', label: '', owner: 'w' }]);
    expect(v.squareMarks!(g.position)[0].icon).toContain('<svg');
    const boom = playSan(v, g, 'Nb1');
    expect(boom.position.board[sq('b1')]).toBeNull();
    expect(v.squareMarks!(boom.position)).toEqual([]);
    // Kendi taşı (beyaz kale) mayına basarsa bir şey olmaz.
    const safe = playSan(v, g, 'Kd8', 'Rb1');
    expect(safe.position.board[sq('b1')]).toEqual({ type: 'r', color: 'w' });
    expect(v.squareMarks!(safe.position)).toHaveLength(1);
  });

  it('Mayın: hamlenin yasallığı mayına bağlı değil; şahı açacak taş patlamaz, mayını temizler', () => {
    let g = createGame(v, fen('4kb2/7p/8/8/3Q4/8/8/7K', 'w', 'mine.-.0000'));
    g = makeMove(v, g, card('mine', 'e7'));
    g = playSan(v, g, 'h6', 'Qe4+');
    // e7'yi kapatmak yasal: mayın şahın yasal hamlelerinden belli olmaz.
    expect(targets(g, 'f8')).toContain('e7');
    const block = playSan(v, g, 'Be7');
    expect(block.position.board[sq('e7')]).toEqual({ type: 'b', color: 'b' });
    expect(v.squareMarks!(block.position)).toEqual([]);
  });

  it('Mayın: temizlenince balon "temizlendi" der, patlayınca demez', async () => {
    const { lastCardResult } = await import('../src/ui/cardResult.ts');
    let g = createGame(v, fen('4kb2/7p/8/8/3Q4/8/8/7K', 'w', 'mine.-.0000'));
    g = makeMove(v, g, card('mine', 'e7'));
    g = playSan(v, g, 'h6', 'Qe4+', 'Be7');
    expect(lastCardResult(v, g, 'all')).toMatchObject({ blast: true, cleared: true });
    expect(lastCardResult(v, g, 'all')?.icon).toContain('<svg');
    let h = createGame(v, fen('4k3/8/8/8/8/2n5/8/R3K3', 'w', 'mine.-.0000'));
    h = playSan(v, makeMove(v, h, card('mine', 'b1')), 'Nb1');
    expect(lastCardResult(v, h, 'all')).toMatchObject({ blast: true, cleared: false });
  });

  it('Mayın: bot rakibin mayınını bilmez', () => {
    let g = createGame(v, fen('4k3/8/8/8/8/2n5/8/R3K3', 'w', 'mine.-.0000'));
    g = makeMove(v, g, card('mine', 'b1'));
    expect(v.squareMarks!(v.withoutSecrets!(g.position, 'b'))).toEqual([]);
    expect(v.squareMarks!(v.withoutSecrets!(g.position, 'w'))).toHaveLength(1);
  });

  it('Mayın: rakibe gizli; patlayınca herkes görür', async () => {
    const { lastCardResult, secretMoves } = await import('../src/ui/cardResult.ts');
    let g = createGame(v, fen('4k3/8/8/8/8/2n5/8/R3K3', 'w', 'mine.-.0000'));
    g = makeMove(v, g, card('mine', 'b1'));
    expect(lastCardResult(v, g, 'b')).toMatchObject({ id: 'mine', hidden: true, changes: [] });
    expect(lastCardResult(v, g, 'w')).toMatchObject({ id: 'mine', changes: [{ square: sq('b1') }] });
    expect([...secretMoves(v, g, 'b')]).toEqual([0]);
    expect([...secretMoves(v, g, 'w')]).toEqual([]);
    g = playSan(v, g, 'Nb1');
    expect(lastCardResult(v, g, 'b')).toMatchObject({ id: 'mine', blast: true, color: 'b' });
    expect([...secretMoves(v, g, 'b')]).toEqual([]);
  });
});

describe('Anarşi: 2026-11 kuralları (FEN başı ".2")', () => {
  const sqs = (m: Move) => m.card!.squares.map(squareName).join('-');
  const ids = (g: GameState, id: string) =>
    cards(g)
      .filter((m) => m.card!.id === id)
      .map(sqs);
  const extra = (g: GameState) =>
    g.position.extra as unknown as { fx: { k: string; c: string; exp: number; sq: number[] }[] };

  it('Sürgün: dönüş karesini oyuncu seçer, taş 2 tur donuk kalır; eski kayıtlar eski kuralla', () => {
    let g = createGame(v, fen('4k3/7p/2n5/8/8/8/7P/4K3', 'w', 'exile.-.0000.2'));
    expect(ids(g, 'exile').sort()).toEqual(['c6-b8', 'c6-g8']);
    g = playSan(v, g, 'SG@c6-g8');
    expect(g.position.board[sq('g8')]).toEqual({ type: 'n', color: 'b' });
    expect(targets(g, 'g8')).toEqual([]);
    g = playSan(v, g, 'Kd8', 'Kd1');
    expect(targets(g, 'g8')).toEqual([]);
    g = playSan(v, g, 'Kc8', 'Kc1');
    expect(targets(g, 'g8').length).toBeGreaterThan(0);
    // Before the new rules: one square, the nearer home, nothing frozen.
    const old = createGame(v, fen('4k3/7p/2n5/8/8/8/7P/4K3', 'w', 'exile.-.0000'));
    expect(ids(old, 'exile')).toEqual(['c6']);
    const sent = playSan(v, old, 'SG@c6');
    expect(sent.position.board[sq('b8')]).toEqual({ type: 'n', color: 'b' });
    expect(targets(sent, 'b8').length).toBeGreaterThan(0);
  });

  it('Kalkan: 3 tur, taşla gider; yiyince ya da kendisi şah çekince düşer, açarak şahta kalır', () => {
    let g = createGame(v, fen('4k3/p7/8/8/4R3/8/4Q3/K7', 'w', 'shield.-.0000.2'));
    g = playSan(v, g, 'KL@e4');
    expect(extra(g).fx[0]).toMatchObject({ k: 'shield', exp: 18 + 6 });
    // Ra4 uncovers the queen's check: the shield goes along to a4.
    g = playSan(v, g, 'Kf8', 'Ra4');
    expect(extra(g).fx.find((e) => e.k === 'shield')?.sq).toEqual([sq('a4')]);
    g = playSan(v, g, 'Kg8', 'Rxa7');
    expect(extra(g).fx.some((e) => e.k === 'shield')).toBe(false);

    let c = createGame(v, fen('4k3/8/8/8/3R4/8/8/K7', 'w', 'shield.-.0000.2'));
    c = playSan(v, c, 'KL@d4', 'Kf7', 'Rd7+');
    expect(extra(c).fx.some((e) => e.k === 'shield')).toBe(false);
  });

  it('Barikat: 5 tur, alt alta da kurulur; eski kuralda yalnız yan yana', () => {
    const g = createGame(v, fen('4k3/7p/8/8/8/8/7P/K7', 'w', 'wall.-.0000.2'));
    expect(ids(g, 'wall')).toContain('e3-e4-e5');
    expect(ids(g, 'wall')).toContain('d4-e4-f4');
    const after = playSan(v, g, 'BR@e3-e4-e5');
    expect(extra(after).fx[0]).toMatchObject({ k: 'wall', exp: 18 + 10 });
    const old = createGame(v, fen('4k3/7p/8/8/8/8/7P/K7', 'w', 'wall.-.0000'));
    expect(ids(old, 'wall')).not.toContain('e3-e4-e5');
  });

  it('Işınlanma: piyon da gider, ama ilk sırasına ve terfiye iki adım yakına değil', () => {
    const g = createGame(v, fen('4k3/1N6/8/8/3P4/2N5/8/1R2K3', 'w', 'swap.-.0000.2'));
    const m = ids(g, 'swap');
    expect(m).toContain('c3-d4');
    expect(m).not.toContain('b1-d4');
    expect(m).not.toContain('d4-b7');
    const old = createGame(v, fen('4k3/1N6/8/8/3P4/2N5/8/1R2K3', 'w', 'swap.-.0000'));
    expect(ids(old, 'swap')).not.toContain('c3-d4');
  });

  it('Ateşkes: 5 hamle; şah çeken taş alınır, öteki alınmaz', () => {
    const g = playSan(v, createGame(v, fen('4k3/7p/8/8/8/8/7P/K7', 'w', 'truce.-.0000.2')), 'AK');
    expect(extra(g).fx[0]).toMatchObject({ k: 'truce', exp: 18 + 11 });
    const t = createGame(v, fen('4k3/p7/8/8/8/8/R2q4/4K3', 'w', 'truce.-.1000.2;truce.w.40.'));
    expect(targets(t, 'a2')).toContain('d2');
    expect(targets(t, 'a2')).not.toContain('a7');
    expect(targets(t, 'e1')).toContain('d2');
    // The bot's board agrees.
    const fast = new FastBoard(v).load(t.position).legalMoves();
    expect(fast.map((m) => squareName(moveFrom(m)) + squareName(moveTo(m)))).toContain('a2d2');
    const old = createGame(v, fen('4k3/p7/8/8/8/8/R2q4/4K3', 'w', 'truce.-.1000;truce.w.40.'));
    expect(targets(old, 'a2')).not.toContain('d2');
  });

  it('Ateşkes sayacı 5, 5, 4, 4, … 1, 1 iner; kalkan rok yapan kaleyle gider', () => {
    let g = createGame(v, fen('4k3/7p/8/8/8/8/7P/K7', 'w', 'truce.-.0000.2'));
    g = playSan(v, g, 'AK');
    const labels: string[] = [];
    const steps = ['Kd8', 'Kb1', 'Kc8', 'Kc1', 'Kb8', 'Kd1', 'Ka8', 'Ke1', 'Kb8', 'Kf1'];
    for (const s of steps) {
      labels.push(v.squareMarks!(g.position).find((m) => m.kind === 'truce')!.label);
      g = playSan(v, g, s);
    }
    expect(labels).toEqual(['5', '5', '4', '4', '3', '3', '2', '2', '1', '1']);
    expect(v.squareMarks!(g.position).some((m) => m.kind === 'truce')).toBe(false);

    let c = createGame(v, fen('4k3/7p/8/8/8/8/7P/4K2R', 'w', 'shield.-.0000.2', 10).replace(' - - ', ' K - '));
    c = playSan(v, c, 'KL@h1', 'Kd8', 'O-O');
    expect(extra(c).fx.find((e) => e.k === 'shield')?.sq).toEqual([sq('f1')]);

    // Buz on the corner rook keeps the castling right, but a frozen rook does not castle.
    let i = createGame(v, fen('4k3/7p/8/8/8/8/7P/4K2R', 'b', '-.ice.0000.2', 10).replace(' - - ', ' K - '));
    i = playSan(v, i, 'BZ@h1');
    expect(i.position.castling.wK).toBe(true);
    expect(targets(i, 'e1')).not.toContain('g1');
  });

  it('Mayın: rok yapan kale mayının üstüne gelirse patlar (eski kuralda patlamazdı)', () => {
    const castle = (head: string) => {
      let g = createGame(v, fen('4k3/7p/8/8/8/8/7P/4K2R', 'b', head, 10).replace(' - - ', ' K - '));
      g = playSan(v, g, 'MY@f1', 'O-O');
      return g.position.board;
    };
    const now = castle('-.mine.0000.2');
    expect(now[sq('f1')]).toBeNull();
    expect(now[sq('g1')]).toEqual({ type: 'k', color: 'w' });
    expect(castle('-.mine.0000')[sq('f1')]).toEqual({ type: 'r', color: 'w' });
  });

  it('gizli mayın (karesiz gelen) oyuna olduğu gibi girer', () => {
    const g = createGame(v, fen('4k3/7p/8/8/8/8/7P/K7', 'w', 'mine.-.0000.2'));
    const next = makeMove(v, g, cardMove({ id: 'mine', squares: [] }));
    expect(extra(next).fx[0]).toMatchObject({ k: 'mine', sq: [] });
    expect(() => makeMove(v, next, cardMove({ id: 'mine', squares: [] }))).toThrow();
  });

  it('kaos kartı, geri tepmede vuracak bir şey yoksa oynanamaz', () => {
    const none = parseFen(v, fen('4k3/8/2n5/8/8/8/8/4K3', 'w', 'void.-.0000.2'));
    expect(chaosPlayable(v, none, 'ambush')).toBe(false);
    expect(chaosPlayable(v, none, 'time')).toBe(true);
    const both = parseFen(v, fen('4k3/8/2n5/8/8/2N5/8/4K3', 'w', 'void.-.0000.2'));
    expect(chaosPlayable(v, both, 'ambush')).toBe(true);
  });
});
