import { describe, expect, it } from 'vitest';
import { genieFrames } from '../src/ui/genie.tsx';

describe('menü açılışı (genie)', () => {
  it('menü sözcüğünün altından dar başlar, tam açık biter; adımlar sıralı', () => {
    const f = genieFrames(30);
    expect(f[0].offset).toBe(0);
    expect(f.at(-1)!.offset).toBe(1);
    expect(f.every((k, i) => i === 0 || (k.offset as number) > (f[i - 1].offset as number))).toBe(true);
    expect(f[0].clipPath).toContain('28.80%');
    expect(f.at(-1)!.clipPath).toBe('polygon(0.00% 0, 100.00% 0, 100.00% 100%, 0.00% 100%)');
    expect(f.at(-1)!.transform).toBe('scale(1.000, 1.000)');
  });
});
