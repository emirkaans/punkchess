import { describe, expect, it } from 'vitest';
import { parseSquare as sq } from '../src/engine/board.ts';
import { createGame, makeMove, playSan } from '../src/engine/game.ts';
import { cardMove } from '../src/engine/types.ts';
import type { GameState, Move } from '../src/engine/types.ts';
import { anarsi as v } from '../src/engine/variants/anarsi.ts';
import { lastCardResult } from '../src/ui/cardResult.ts';
import { cardVisual } from '../src/ui/cardVisual.ts';

const fen = (placement: string, turn: 'w' | 'b', head: string) => `${placement} ${turn} - - 0 10 ${head}`;
const card = (id: string, ...squares: string[]): Move => cardMove({ id, squares: squares.map(sq) });
const visual = (g: GameState) => cardVisual(v, lastCardResult(v, g, 'all')!, g.position);

describe('kart sonucu resmi', () => {
  it('Mayın temizlendi: rozet ve balonda üstü çizili mayın, taş yok', () => {
    let g = createGame(v, fen('4kb2/7p/8/8/3Q4/8/8/7K', 'w', 'mine.-.0000'));
    g = makeMove(v, g, card('mine', 'e7'));
    g = playSan(v, g, 'h6', 'Qe4+', 'Be7');
    const r = visual(g);
    expect(r.badges).toMatchObject([{ square: sq('e7'), parts: [{ kind: 'icon', icon: 'mine', struck: true }] }]);
    expect(r.tiles).toMatchObject([{ kind: 'icon', icon: 'mine', struck: true }]);
  });

  it('Mayın gömüldü: rozet yok, balonda mayın ve karesi', () => {
    const g = makeMove(v, createGame(v, fen('4k3/8/8/8/8/2n5/8/R3K3', 'w', 'mine.-.0000')), card('mine', 'b1'));
    const r = visual(g);
    expect(r.badges).toEqual([]);
    expect(r.tiles).toMatchObject([{ kind: 'icon', icon: 'mine', square: sq('b1') }]);
  });

  it('Buz: rozette kar tanesi ve kalan tur, balonda kar tanesi', () => {
    const g = makeMove(v, createGame(v, fen('4k3/8/8/8/8/8/1r6/4K3', 'w', 'ice.-.0000')), card('ice', 'b2'));
    const r = visual(g);
    expect(r.badges).toMatchObject([{ square: sq('b2'), parts: [{ icon: 'snow' }, { kind: 'text', text: '3' }] }]);
    expect(r.tiles).toMatchObject([{ kind: 'icon', icon: 'snow', label: '3' }]);
  });

  it('Kalkan: sadece kalkan', () => {
    const g = makeMove(v, createGame(v, fen('3rk3/8/8/8/3N4/8/8/4K3', 'w', 'shield.-.0000')), card('shield', 'd4'));
    expect(visual(g).tiles).toMatchObject([{ kind: 'icon', icon: 'shield' }]);
  });

  it('Sürgün: rozet yeni karede, balonda taş ve gittiği kare', () => {
    const g = makeMove(v, createGame(v, fen('4k3/p7/8/3b4/8/8/P7/4K3', 'w', 'exile.-.0000')), card('exile', 'd5'));
    const r = visual(g);
    expect(r.badges).toMatchObject([{ square: sq('c8'), parts: [{ text: '↩' }] }]);
    expect(r.tiles).toMatchObject([
      { kind: 'piece', piece: { type: 'b' } },
      { kind: 'chip', text: '↩ c8' },
    ]);
  });

  it('Barikat: rozet yok, balonda üç engel', () => {
    const g = makeMove(
      v,
      createGame(v, fen('4k3/8/8/8/8/8/8/R3K3', 'w', 'wall.-.0000')),
      card('wall', 'b8', 'c8', 'd8'),
    );
    const r = visual(g);
    expect(r.badges).toEqual([]);
    expect(r.tiles.map((x) => x.kind === 'piece' && x.piece?.type)).toEqual(['o', 'o', 'o']);
  });

  it('Piyon Avı: iki karede rozet, balonda iki çizik piyon', () => {
    const g = makeMove(v, createGame(v, fen('4k3/3pp3/8/7p/8/8/8/4K3', 'w', 'pawn.-.0000')), card('pawn', 'd7', 'e7'));
    const r = visual(g);
    expect(r.badges.map((b) => b.square)).toEqual([sq('d7'), sq('e7')]);
    expect(r.tiles).toMatchObject([
      { kind: 'piece', struck: true, square: sq('d7') },
      { kind: 'piece', struck: true, square: sq('e7') },
    ]);
  });

  it('Mayın patladı: önceki taş → yok', () => {
    let g = createGame(v, fen('4k3/8/8/8/8/2n5/8/R3K3', 'w', 'mine.-.0000'));
    g = playSan(v, makeMove(v, g, card('mine', 'b1')), 'Nb1');
    expect(visual(g).tiles).toMatchObject([{ piece: { type: 'n' } }, { kind: 'sep', text: '→' }, { piece: null }]);
  });
});
