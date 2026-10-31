import { describe, expect, it } from 'vitest';
import { newSession, restoreSession, saveSession } from '../src/ui/game/session.ts';
import { DEFAULT_SETTINGS } from '../src/ui/settings.ts';

describe('sayfa yenilenince oyun sürer', () => {
  it('hiç hamle oynanmadan yenilenen bot oyunu aynı oyun olarak döner', () => {
    const s = newSession({ ...DEFAULT_SETTINGS, mode: 'bot', variantId: 'standard', humanColor: 'w' }, 1);
    const saved = saveSession(s, 0);
    expect(saved).not.toBeNull();
    const back = restoreSession(JSON.parse(JSON.stringify(saved)), 2, 0)!;
    expect(back.gameId).toBe(s.gameId);
    expect(back.players).toEqual(s.players);
    expect(back.timeline.states).toHaveLength(1);
  });

  it('kart seçimi sürerken yenilenen Anarşi oyunu aynı oyun, aynı taraflar ve kartlarla, seçim baştan', () => {
    const s = newSession({ ...DEFAULT_SETTINGS, mode: 'bot', variantId: 'anarsi', humanColor: 'b' }, 1);
    expect(s.setup).not.toBeNull();
    const saved = saveSession(s, 0)!;
    expect(saved.setup).toBe(true);
    const back = restoreSession(JSON.parse(JSON.stringify(saved)), 2, 0)!;
    expect(back.gameId).toBe(s.gameId);
    expect(back.players).toEqual(s.players);
    expect(back.chaos).toEqual(s.chaos);
    expect(back.setup?.questions.map((q) => q.id)).toEqual(s.setup!.questions.map((q) => q.id));
  });
});
