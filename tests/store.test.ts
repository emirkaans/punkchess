import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR, TALL_VIEW, avatarSvg } from '../src/avatar/avatar.ts';
import { figureSvg, itemView } from '../src/avatar/figure.ts';
import { shoeKind } from '../src/avatar/shoes.ts';
import {
  BARBER_SLOTS,
  EMPTY_OUTFIT,
  SHOE_SLOTS,
  OUTFIT_SLOTS,
  STORE_SLOTS,
  parseKombins,
  wearKombin,
  STORE_ITEMS,
  parseOutfit,
  serializeOutfit,
  wearsOnlyOwned,
} from '../src/avatar/outfit.ts';

describe('mağaza', () => {
  it('kıyafet kaydedilip geri okunur; bilinmeyen ya da yanlış yuvadaki eşya düşer', () => {
    const o = { ...EMPTY_OUTFIT, jacket: 'leather', hat: 'beanie' };
    expect(parseOutfit(serializeOutfit(o))).toEqual(o);
    expect(parseOutfit({ jacket: 'beanie', hat: 'ejderha' })).toEqual(EMPTY_OUTFIT);
    expect(parseOutfit('bozuk{')).toEqual(EMPTY_OUTFIT);
  });

  it('sadece sahip olunan eşyalar giyilebilir', () => {
    const o = { ...EMPTY_OUTFIT, jacket: 'leather', acc: 'shades' };
    expect(wearsOnlyOwned(o, new Set(['leather', 'shades']))).toBe(true);
    expect(wearsOnlyOwned(o, new Set(['leather']))).toBe(false);
    expect(wearsOnlyOwned(EMPTY_OUTFIT, new Set())).toBe(true);
  });

  it('katalog: her eşya bir yuvada, fiyatı pozitif, kimlikler benzersiz; hepsi çizilir', () => {
    expect(new Set(STORE_ITEMS.map((i) => i.id)).size).toBe(STORE_ITEMS.length);
    for (const item of STORE_ITEMS) {
      expect(OUTFIT_SLOTS).toContain(item.slot);
      expect(item.price).toBeGreaterThan(0);
      const svg = figureSvg(DEFAULT_AVATAR, { ...EMPTY_OUTFIT, [item.slot]: item.id }, itemView(item.slot, item.id));
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).not.toContain('undefined');
    }
  });

  it('her yuva tek bir dükkânda satılır', () => {
    // The beard's colour is not sold on its own: it takes the hair colours (or a natural one).
    expect([...STORE_SLOTS, ...BARBER_SLOTS, ...SHOE_SLOTS, 'beardColor'].sort()).toEqual([...OUTFIT_SLOTS].sort());
  });

  it('kuaför: saç kendi saçın yerine çizilir, renk ve sakal karakterde görünür', () => {
    const plain = avatarSvg(DEFAULT_AVATAR, EMPTY_OUTFIT);
    const cut = avatarSvg(DEFAULT_AVATAR, { ...EMPTY_OUTFIT, cut: 'giant' }, TALL_VIEW);
    expect(cut).toContain(`viewBox="${TALL_VIEW}"`);
    expect(cut).toContain('L100 -48');
    // The own mohawk is gone under the barber's cut.
    expect(plain).toContain('L100 0 L106 26');
    expect(cut).not.toContain('L100 0 L106 26');
    const grad = avatarSvg(DEFAULT_AVATAR, { ...EMPTY_OUTFIT, color: 'grad' });
    expect(grad).toContain('url(#pc-hair-grad)');
    expect(grad).toContain('<linearGradient id="pc-hair-grad"');
    expect(avatarSvg(DEFAULT_AVATAR, { ...EMPTY_OUTFIT, color: 'neon' })).toContain('filter="url(#pc-hair-neon)"');
    expect(avatarSvg(DEFAULT_AVATAR, { ...EMPTY_OUTFIT, beard: 'full' })).toContain('#3a2a20');
    expect(plain).not.toContain('#3a2a20');
  });

  it('dolap: kombin sadece kıyafeti tutar, giyilince saç ve sakal kalır', () => {
    const worn = { ...EMPTY_OUTFIT, jacket: 'leather', cut: 'afro', beard: 'full' };
    const kombins = parseKombins(JSON.stringify([{ jacket: 'hoodie', hat: 'beanie', cut: 'giant' }, null]));
    expect(kombins).toHaveLength(3);
    expect(kombins[0]).toEqual({ ...EMPTY_OUTFIT, jacket: 'hoodie', hat: 'beanie' });
    expect(kombins[1]).toBeNull();
    expect(wearKombin(worn, kombins[0]!)).toEqual({
      ...EMPTY_OUTFIT,
      jacket: 'hoodie',
      hat: 'beanie',
      cut: 'afro',
      beard: 'full',
    });
    expect(parseKombins('bozuk')).toEqual([null, null, null]);
  });

  it('her eşyanın iki dilde de adı var, her saç ve sakal çizilir', async () => {
    const { tr, en } = await import('../src/i18n/messages.ts');
    for (const item of STORE_ITEMS) {
      for (const lang of [tr, en]) expect((lang as Record<string, string>)[`store.item.${item.id}`]).toBeTruthy();
    }
    for (const item of STORE_ITEMS.filter((i) => i.slot === 'cut' || i.slot === 'beard' || i.slot === 'color')) {
      const svg = avatarSvg(DEFAULT_AVATAR, { ...EMPTY_OUTFIT, [item.slot]: item.id });
      expect(svg).not.toContain('undefined');
      if (item.slot === 'beard') expect(svg.length).toBeGreaterThan(avatarSvg(DEFAULT_AVATAR, EMPTY_OUTFIT).length);
    }
  });

  it('sakal rengi ayrı: doğal renkler bedava, özel renk sahip olunursa; saç rengi sakala değmez', () => {
    const o = parseOutfit({ beard: 'full', beardColor: 'nat-ginger', color: 'fire' });
    expect(o.beardColor).toBe('nat-ginger');
    expect(parseOutfit({ beardColor: 'ocean' }).beardColor).toBe('ocean');
    expect(parseOutfit({ beardColor: 'giant' }).beardColor).toBeNull();
    expect(wearsOnlyOwned(o, new Set(['full', 'fire']))).toBe(true);
    expect(wearsOnlyOwned({ ...o, beardColor: 'ocean' }, new Set(['full', 'fire']))).toBe(false);
    const ginger = avatarSvg(DEFAULT_AVATAR, o);
    expect(ginger).toContain('#b8541e');
    // The hair's premium colour no longer paints the beard brown-free.
    const hairOnly = avatarSvg(DEFAULT_AVATAR, { ...EMPTY_OUTFIT, beard: 'full', color: 'grad' });
    expect(hairOnly).toContain('#3a2a20');
  });

  it('vücut: her eşya her vücut tipinde çizilir; özel vücut kaydedilip okunur', async () => {
    const { parseAvatar, serializeAvatar } = await import('../src/avatar/avatar.ts');
    for (const body of ['slim', 'mid', 'broad', 'curvy', 'c-0-100-0', 'c-100-0-100']) {
      const avatar = { ...DEFAULT_AVATAR, body };
      for (const item of STORE_ITEMS) {
        const svg = figureSvg(avatar, { ...EMPTY_OUTFIT, [item.slot]: item.id });
        expect(svg).not.toMatch(/undefined|NaN/);
      }
    }
    const custom = { ...DEFAULT_AVATAR, body: 'c-30-60-90', lashes: 'long', lips: 'red', blush: 'pink' };
    expect(parseAvatar(serializeAvatar(custom))).toEqual(custom);
    expect(parseAvatar({ ...custom, body: 'c-30-60-900' }).body).toBe('mid');
    // An old avatar (no body, no face extras) gets the defaults.
    expect(parseAvatar({ head: 'round' }).body).toBe('mid');
  });
});

describe('aksesuar türleri', () => {
  it('gözlük, boyun ve kulak/yüz ayrı yerlerde: üçü birden takılır, iki gözlük takılmaz', () => {
    const o = parseOutfit({ eyewear: 'shades', neck: 'scarf', acc: 'hoops' });
    expect(o).toMatchObject({ eyewear: 'shades', neck: 'scarf', acc: 'hoops' });
    expect(parseOutfit({ eyewear: 'scarf' }).eyewear).toBeNull();
    expect(STORE_ITEMS.find((i) => i.id === 'eyepatch')?.slot).toBe('eyewear');
    expect(STORE_ITEMS.find((i) => i.id === 'choker')?.slot).toBe('neck');
  });

  it('eski kayıtta "acc" olarak duran gözlük ve kolye kendi yerine geçer', () => {
    expect(parseOutfit({ acc: 'shades' })).toMatchObject({ acc: null, eyewear: 'shades' });
    expect(parseOutfit({ acc: 'chain' })).toMatchObject({ acc: null, neck: 'chain' });
    expect(parseOutfit({ acc: 'phones' })).toMatchObject({ acc: 'phones' });
  });

  it('tasma kafadan sonra çizilir (boyun onu örtmez); pantolon tişörtün üstünde', () => {
    const svg = figureSvg(DEFAULT_AVATAR, { ...EMPTY_OUTFIT, neck: 'choker', pants: 'camo' });
    expect(svg.lastIndexOf('<svg x="40"')).toBeLessThan(
      svg.indexOf('M84 108') === -1 ? svg.length : svg.lastIndexOf('#d8d4dc'),
    );
    // The plain T-shirt's anarchy sign comes before the trousers' camo.
    expect(svg.indexOf('#ff2e93')).toBeLessThan(svg.indexOf('#6b7a45'));
    const coat = figureSvg(DEFAULT_AVATAR, { ...EMPTY_OUTFIT, jacket: 'leather', pants: 'camo' });
    expect(coat.indexOf('#6b7a45')).toBeLessThan(coat.indexOf('#1d1b21'));
  });
});

describe('ayakkabıcı', () => {
  it('30 çift, üç türde; çoğu postal ve çizme, spor da var', () => {
    const shoes = STORE_ITEMS.filter((i) => i.slot === 'shoes');
    expect(shoes).toHaveLength(30);
    const kinds = shoes.map((i) => shoeKind(i.id));
    expect(kinds.filter((k) => k === 'sneaker').length).toBeGreaterThanOrEqual(5);
    expect(kinds.filter((k) => k !== 'sneaker').length).toBeGreaterThanOrEqual(20);
  });

  it('bir çift düz siyah botların yerine çizilir, etek üstünde kalır', () => {
    const plain = figureSvg(DEFAULT_AVATAR, EMPTY_OUTFIT);
    const shod = figureSvg(DEFAULT_AVATAR, { ...EMPTY_OUTFIT, shoes: 'pinkcombat' });
    expect(plain).not.toContain('#ff2e93" stroke="#141016" stroke-width="2" stroke-linejoin');
    expect(shod).toContain('fill="#ff2e93" stroke="#141016" stroke-width="2" stroke-linejoin="round"');
    expect(shod).not.toContain('h28c4 4');
    const skirt = figureSvg(DEFAULT_AVATAR, { ...EMPTY_OUTFIT, shoes: 'kneehigh', skirt: 'tutupink' });
    expect(skirt.indexOf('translate(')).toBeLessThan(skirt.lastIndexOf('#ff2e93'));
  });

  it('kaydedilen kombin ayakkabıyı da tutar', () => {
    const [k] = parseKombins([{ jacket: 'leather', shoes: 'combat8' }]);
    expect(k?.shoes).toBe('combat8');
  });
});
