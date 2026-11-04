import { describe, expect, it } from 'vitest';
import { keyMatches } from '../server/auth-util.ts';

describe('günlük rapor anahtarı', () => {
  it('doğru anahtar kabul edilir', async () => {
    expect(await keyMatches('Bearer gizli', 'gizli')).toBe(true);
  });

  it('yanlış, eksik ya da tanımsız anahtar reddedilir', async () => {
    expect(await keyMatches('Bearer yanlis', 'gizli')).toBe(false);
    expect(await keyMatches('gizli', 'gizli')).toBe(false);
    expect(await keyMatches(null, 'gizli')).toBe(false);
    expect(await keyMatches('Bearer ', '')).toBe(false);
    expect(await keyMatches('Bearer x', undefined)).toBe(false);
  });
});
