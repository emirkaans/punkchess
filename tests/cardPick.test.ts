// Picking a card's targets on the board (src/ui/cardPick.ts): Sürgün piece first, then where it
// goes; a Barikat that could stand either way asks for its direction.

import { describe, expect, it } from 'vitest';
import { parseSquare as sq, squareName } from '../src/engine/board.ts';
import { createGame } from '../src/engine/game.ts';
import { legalMoves } from '../src/engine/legality.ts';
import { anarsi as v } from '../src/engine/variants/anarsi.ts';
import { clickTarget, pickTargets, pickWays } from '../src/ui/cardPick.ts';

const movesOf = (placement: string, head: string) =>
  legalMoves(v, createGame(v, `${placement} w - - 0 10 ${head}`).position).filter((m) => m.card);
const names = (s: number[]) => s.map(squareName).sort();
const played = (r: ReturnType<typeof clickTarget>) =>
  r && 'move' in r ? r.move.card!.squares.map(squareName).join('-') : null;

describe('kart hedefi seçme', () => {
  it('Sürgün: önce taş, sonra dönüş karesi; tek kare varsa hemen oynar', () => {
    const two = movesOf('4k3/7p/2n5/8/8/8/7P/4K3', 'exile.-.0000.2');
    const pick = { id: 'exile', picked: [] };
    expect(names(pickTargets(two, pick))).toEqual(['c6']);
    const first = clickTarget(two, pick, sq('c6'));
    expect(first && 'pick' in first ? first.pick.picked : null).toEqual([sq('c6')]);
    const next = { id: 'exile', picked: [sq('c6')] };
    expect(names(pickTargets(two, next))).toEqual(['b8', 'g8']);
    expect(played(clickTarget(two, next, sq('g8')))).toBe('c6-g8');

    // g8 taken: only b8 is left, so the first click plays.
    const one = movesOf('4k1n1/7p/2n5/8/8/8/7P/4K3', 'exile.-.0000.2');
    expect(played(clickTarget(one, pick, sq('c6')))).toBe('c6-b8');
  });

  it('Barikat: iki yöne de kurulabiliyorsa uçlardan biri yönü seçer', () => {
    const moves = movesOf('4k3/7p/8/8/8/8/7P/K7', 'wall.-.0000.2');
    const pick = { id: 'wall', picked: [] };
    const first = clickTarget(moves, pick, sq('e4'));
    expect(first && 'pick' in first ? first.pick.picked : null).toEqual([sq('e4')]);
    const next = { id: 'wall', picked: [sq('e4')] };
    expect(names(pickTargets(moves, next))).toEqual(['d4', 'e3', 'e5', 'f4']);
    expect(played(clickTarget(moves, next, sq('e5')))).toBe('e3-e4-e5');
    expect(played(clickTarget(moves, next, sq('d4')))).toBe('d4-e4-f4');
    // On the edge file only the column fits: one click.
    expect(played(clickTarget(moves, pick, sq('a4')))).toBe('a3-a4-a5');
    const old = movesOf('4k3/7p/8/8/8/8/7P/K7', 'wall.-.0000');
    expect(played(clickTarget(old, pick, sq('e4')))).toBe('d4-e4-f4');
  });

  it('Barikat: iki yön varsa ikisi de hayalet duvar olarak gösterilir, yoksa hiçbiri', () => {
    const moves = movesOf('4k3/7p/8/8/8/8/7P/K7', 'wall.-.0000.2');
    expect(pickWays(moves, { id: 'wall', picked: [] })).toEqual([]);
    const ways = pickWays(moves, { id: 'wall', picked: [sq('e4')] }).map((w) => w.map(squareName).join('-'));
    expect(ways.sort()).toEqual(['d4-e4-f4', 'e3-e4-e5']);
    // On the edge file only the column fits: nothing to choose.
    expect(pickWays(moves, { id: 'wall', picked: [sq('a4')] })).toEqual([]);
  });
});
