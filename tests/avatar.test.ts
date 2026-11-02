import { describe, expect, it } from 'vitest';
import {
  AVATAR_OPTIONS,
  AVATAR_PARTS,
  DEFAULT_AVATAR,
  avatarSvg,
  isAvatar,
  parseAvatar,
  randomAvatar,
  serializeAvatar,
} from '../src/avatar/avatar.ts';

describe('karakter', () => {
  it('kaydedilen hali geri okunur', () => {
    const a = randomAvatar(() => 0.7);
    expect(parseAvatar(serializeAvatar(a))).toEqual(a);
    expect(isAvatar(a)).toBe(true);
  });

  it('bilinmeyen ya da bozuk parça varsayılana döner, istek olarak kabul edilmez', () => {
    expect(parseAvatar('bozuk{')).toEqual(DEFAULT_AVATAR);
    expect(parseAvatar(null)).toEqual(DEFAULT_AVATAR);
    const bad = { ...DEFAULT_AVATAR, hair: 'ejderha' };
    expect(parseAvatar(bad).hair).toBe(DEFAULT_AVATAR.hair);
    expect(isAvatar(bad)).toBe(false);
    expect(isAvatar({ ...DEFAULT_AVATAR, extra: '<script>' })).toBe(false);
    // Fazladan alanlar saklanmaz.
    expect(serializeAvatar(parseAvatar({ ...DEFAULT_AVATAR, evil: 'x' }))).not.toContain('evil');
  });

  it('her parça seçeneği çizilir', () => {
    for (const part of AVATAR_PARTS)
      for (const o of AVATAR_OPTIONS[part]) {
        const svg = avatarSvg({ ...DEFAULT_AVATAR, [part]: o.id });
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg).not.toContain('undefined');
      }
  });
});
