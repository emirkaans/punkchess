import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomId } from '../src/ui/online/randomId.ts';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('rastgele kimlik', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('randomUUID varken onu kullanır', () => {
    expect(randomId()).toMatch(UUID_V4);
  });

  it('randomUUID olmayan tarayıcıda da geçerli ve farklı UUID üretir', () => {
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) });
    const a = randomId();
    const b = randomId();
    expect(a).toMatch(UUID_V4);
    expect(b).toMatch(UUID_V4);
    expect(a).not.toBe(b);
  });
});
