// @vitest-environment happy-dom
// The crowning at the end of a tournament or a gang war: who is crowned, from the viewer's side.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SheetEntry, TournamentView } from '../../src/online/tournament.ts';

const { Coronation, crowning } = await import('../../src/ui/Coronation.tsx');

const sheet = (...rs: SheetEntry['r'][]): SheetEntry[] =>
  rs.map((r, i) => ({ gameId: `g${i}`, r, pts: r === 'w' ? 1 : r === 'd' ? 0.5 : 0, fire: false }));
const player = (userId: string, username: string, score: number, s: SheetEntry[]) => ({
  userId,
  username,
  score,
  sheet: s,
  streak: 0,
  paused: false,
  game: null,
  fire: false,
  buchholz: 0,
});

const base = {
  id: 'T1',
  name: 'x',
  variantId: 'standard',
  timeControlId: '5+0',
  rated: true,
  startsAt: 0,
  endsAt: 0,
  createdBy: 'x',
  round: 2,
  nextRoundAt: null,
  status: 'finished' as const,
  playoff: null,
  games: 0,
  now: 0,
};

const war = (you: string | null, d1: SheetEntry[], d1score: number): TournamentView => ({
  ...base,
  format: 'war',
  rounds: 2,
  you,
  war: {
    warId: 'w',
    pairs: [],
    players: [
      { id: 'c0', username: 'MrPunk', side: 'c' },
      { id: 'c1', username: 'yukselova', side: 'c' },
      { id: 'd0', username: 'AdaPunk', side: 'd' },
      { id: 'd1', username: 'BoraRiot', side: 'd' },
    ],
    tags: { c: 'PNK', d: 'RIOT' },
  },
  standings: [
    player('c0', 'MrPunk', 2, sheet('w', 'w')),
    player('c1', 'yukselova', 0.5, sheet('d', 'l')),
    player('d0', 'AdaPunk', 0, sheet('l', 'l')),
    player('d1', 'BoraRiot', d1score, d1),
  ],
});

afterEach(cleanup);

describe('taç töreni', () => {
  it('savaş: kazanan çete taç giyer; kaybeden taraf rövanş görür; izleyici kazananı görür', () => {
    const won = crowning(war('c0', sheet('d', 'w'), 1.5));
    expect(won).toMatchObject({ outcome: 'win', names: ['PNK'], sub: 'crown.war', myTag: 'PNK' });
    expect(won!.roster).toEqual(['MrPunk · 2', 'yukselova · ½']);
    expect(won!.score).toBe('[PNK] 2½ – 1½ [RIOT]');
    expect(crowning(war('d0', sheet('d', 'w'), 1.5))).toMatchObject({
      outcome: 'lose',
      names: ['PNK'],
      sub: 'crown.lost',
      myTag: 'RIOT',
      winnerTag: 'PNK',
    });
    expect(crowning(war(null, sheet('d', 'w'), 1.5))).toMatchObject({ outcome: 'win', myTag: null });
  });

  it('savaş berabere (uzatmasız eski savaş): iki etiket, taç ortada', () => {
    const v = war('c0', sheet('w', 'w'), 2.5);
    expect(crowning(v)).toMatchObject({ outcome: 'draw', names: ['PNK', 'RIOT'], sub: 'crown.draw', roster: [] });
  });

  it('turnuva: birinci taç giyer, ilk üç sıralanır; kimse puan almadıysa gösterilmez', () => {
    const v: TournamentView = {
      ...base,
      format: 'arena',
      you: 'b',
      standings: [
        player('a', 'Ada', 6, []),
        player('b', 'Bora', 4, []),
        player('c', 'Can', 2, []),
        player('d', 'Dev', 0, []),
      ],
    };
    expect(crowning(v)).toMatchObject({ names: ['Ada'], sub: 'crown.tournament' });
    expect(crowning(v)!.roster).toEqual(['1. Ada · 6', '2. Bora · 4', '3. Can · 2']);
    expect(crowning({ ...v, you: 'a' })!.sub).toBe('crown.champion');
    expect(crowning({ ...v, standings: [player('a', 'Ada', 0, [])] })).toBeNull();
  });

  it('ekran: yazılar Türkçe; rövanş kazananın çete sayfasına götürür; Kapat ve Escape kapatır', () => {
    const onClose = vi.fn();
    const onOpen = vi.fn();
    render(<Coronation v={war('d0', sheet('d', 'w'), 1.5)} onClose={onClose} onOpen={onOpen} />);
    expect(screen.getByRole('dialog', { name: 'TAÇ ONLARDA · RÖVANŞ SENDE' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Rövanş iste' }));
    expect(onOpen).toHaveBeenCalledWith('/gang/PNK');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
