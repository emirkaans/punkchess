import { describe, expect, it } from 'vitest';
import { parseSquare as sq } from '../../src/engine/board.ts';
import { createGame, makeMove, playSan } from '../../src/engine/game.ts';
import { cardMove } from '../../src/engine/types.ts';
import { anarsi } from '../../src/engine/variants/anarsi.ts';
import { standard } from '../../src/engine/variants/standard.ts';
import { lastCardResult } from '../../src/ui/cardResult.ts';
import { cutInFor } from '../../src/ui/cutIn.ts';

const fen = (placement: string, turn: 'w' | 'b', head: string) => `${placement} ${turn} - - 0 10 ${head}`;

describe('kesme sahne', () => {
  it('sessiz hamlede yok, şahta şah çekene, vezir alınca alana', () => {
    let g = playSan(standard, createGame(standard), 'e4');
    expect(cutInFor(standard, g, null)).toBeNull();
    g = playSan(standard, g, 'f5', 'Qh5+');
    expect(cutInFor(standard, g, null)).toEqual({ color: 'w', line: { kind: 'check' } });
    g = playSan(standard, g, 'g6', 'Qxg6+', 'hxg6');
    expect(cutInFor(standard, g, null)).toEqual({ color: 'b', line: { kind: 'queen' } });
  });

  it('kart oynayana; oyun bitince yok', () => {
    const g = makeMove(
      anarsi,
      createGame(anarsi, fen('4k3/8/8/8/8/8/1r6/4K3', 'w', 'ice.-.0000')),
      cardMove({ id: 'ice', squares: [sq('b2')] }),
    );
    expect(cutInFor(anarsi, g, lastCardResult(anarsi, g, 'all'))).toEqual({
      color: 'w',
      line: { kind: 'card', id: 'ice' },
    });
    const mate = playSan(standard, createGame(standard), 'f3', 'e5', 'g4', 'Qh4#');
    expect(cutInFor(standard, mate, null)).toBeNull();
  });
});
