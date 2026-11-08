// The sitemap (server/pages.ts): every page a search engine may show as a link of its own.

import { describe, expect, it } from 'vitest';
import type { AuthEnv } from '../../server/auth.ts';
import { sitemap } from '../../server/pages.ts';

describe('site haritası', () => {
  it('ana sayfalar, oyun, turnuva, çete ve sokak sayfaları listede', async () => {
    const res = await sitemap({} as AuthEnv, new URL('https://punkchess.com/sitemap.xml'));
    const xml = await res.text();
    for (const p of ['/', '/online', '/puzzles', '/tournaments', '/tv', '/gangs', '/street', '/store'])
      expect(xml).toContain(`<loc>https://punkchess.com${p}</loc>`);
  });
});
