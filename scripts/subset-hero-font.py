"""Cuts the hero headline font (Protest Revolution) down to the letters the headline uses.

The full font is about 320 KB of brush strokes for one heading, too much to preload. This keeps
only the characters of every language's 'home.lede1' and 'home.lede2' (src/i18n/messages.ts)
and writes them to public/fonts/hero-*.woff2, with the list in public/fonts/hero-chars.json
(tests/heroFont.test.ts checks the headline against it).

Run after changing the headline:  python scripts/subset-hero-font.py   (needs fonttools, brotli)
"""
import json
import re
from pathlib import Path

from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
messages = (ROOT / 'src/i18n/messages.ts').read_text(encoding='utf-8')
lines = re.findall(r"^  'home\.lede[12]': ([\"'])(.*?)\1,$", messages, flags=re.M)
assert lines, 'no headline found in messages.ts'
chars = sorted(set(''.join(text for _, text in lines)) | {' '})

for part in ('latin', 'latin-ext'):
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']
    font = subset.load_font(str(ROOT / f'fonts-src/protest-revolution-{part}-400-normal.woff2'), options)
    cmap = font.getBestCmap()
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=[ord(c) for c in chars if ord(c) in cmap])
    subsetter.subset(font)
    subset.save_font(font, str(ROOT / f'public/fonts/hero-{part}.woff2'), options)

(ROOT / 'public/fonts/hero-chars.json').write_text(json.dumps(''.join(chars), ensure_ascii=False) + '\n', encoding='utf-8')
print(len(chars), 'characters:', ''.join(chars))
