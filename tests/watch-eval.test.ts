// The evaluation bar beside bot-against-bot games (src/ui/analysis/watchEval.ts): its time per position.
import { describe, expect, it } from 'vitest';
import { watchEvalMs } from '../src/ui/analysis/watchEval.ts';

describe('izleme çubuğu analiz süresi', () => {
  it('kısa; telefonda ve saat azaldığında daha da kısa', () => {
    expect(watchEvalMs({ stockfish: true, cores: 8, lowClock: false })).toBe(300);
    expect(watchEvalMs({ stockfish: true, cores: 4, lowClock: false })).toBe(150);
    expect(watchEvalMs({ stockfish: true, cores: 4, lowClock: true })).toBe(50);
    expect(watchEvalMs({ stockfish: false, cores: 8, lowClock: false })).toBe(400);
  });
});
