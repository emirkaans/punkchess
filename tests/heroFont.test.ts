import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PACK_LOADERS, dictionaries } from '../src/i18n/index.ts';

// The home headline font is cut down to the headline's letters (scripts/subset-hero-font.py).
const covered = new Set<string>(JSON.parse(readFileSync('public/fonts/hero-chars.json', 'utf-8')) as string);

describe('ana sayfa başlık fontu', () => {
  it('her dilde başlığın tüm harflerini içeriyor (yoksa: python scripts/subset-hero-font.py)', async () => {
    const packs = await Promise.all(
      Object.entries(PACK_LOADERS).map(async ([l, load]) => [l, (await load()).default.messages] as const),
    );
    for (const [locale, dict] of [...Object.entries(dictionaries), ...packs]) {
      const missing = [...new Set(dict['home.lede1'] + dict['home.lede2'])].filter(
        (c) => c !== '\n' && !covered.has(c),
      );
      expect(missing, locale).toEqual([]);
    }
  });
});
