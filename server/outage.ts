// The page shown when the Worker itself breaks on a page request (design 3, "Kapalı tabelası"),
// instead of Cloudflare's own error page: one self-contained page, in Turkish or English by the
// browser's language, that tries again every 30 seconds. Its fonts are static files, which
// Cloudflare serves without the Worker, so they load even then.

const TEXT = {
  tr: {
    title: 'Kısa bir ara · punkchess',
    sign: 'KISA BİR ARA',
    sub: 'birazdan dönüyoruz',
    body: 'Sunucuda bir sorun var, haberimiz var ve uğraşıyoruz. Sayfa kendini yenileyecek, bir şey yapmana gerek yok.',
    retry: '30 sn sonra yeniden denenecek',
  },
  en: {
    title: 'Short break · punkchess',
    sign: 'SHORT BREAK',
    sub: 'back in a moment',
    body: 'Something is wrong on the server; we know and we are on it. The page will reload by itself, nothing to do.',
    retry: 'trying again in 30 s',
  },
} as const;

/** The outage page for a request (its language from Accept-Language). */
export function outagePage(request: Request): Response {
  const tr = /^tr\b|,\s*tr\b/i.test(request.headers.get('accept-language') ?? 'tr');
  const t = TEXT[tr ? 'tr' : 'en'];
  const html = `<!doctype html>
<html lang="${tr ? 'tr' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="30">
<meta name="robots" content="noindex">
<title>${t.title}</title>
<style>
@font-face{font-family:'Bebas Neue';src:url('/fonts/bebas-neue-latin-400-normal.woff2') format('woff2');unicode-range:U+0000-00FF}
@font-face{font-family:'Bebas Neue';src:url('/fonts/bebas-neue-latin-ext-400-normal.woff2') format('woff2');unicode-range:U+0100-024F}
@font-face{font-family:'Sedgwick Ave';src:url('/fonts/sedgwick-ave-latin-400-normal.woff2') format('woff2');unicode-range:U+0000-00FF}
@font-face{font-family:'Sedgwick Ave';src:url('/fonts/sedgwick-ave-latin-ext-400-normal.woff2') format('woff2');unicode-range:U+0100-024F}
@font-face{font-family:'Space Mono';src:url('/fonts/space-mono-latin-400-normal.woff2') format('woff2');unicode-range:U+0000-00FF}
@font-face{font-family:'Space Mono';src:url('/fonts/space-mono-latin-ext-400-normal.woff2') format('woff2');unicode-range:U+0100-024F}
@font-face{font-family:'Permanent Marker';src:url('/fonts/permanent-marker-latin-400-normal.woff2') format('woff2')}
html,body{margin:0;height:100%;background:#0a0a0b;color:#f1eee8;color-scheme:dark}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:20px;box-sizing:border-box;text-align:center;font:15px/1.6 'Space Mono',ui-monospace,monospace}
.logo{font:46px 'Permanent Marker',cursive;color:#ff2e93;text-decoration:none}.logo span{color:#f1eee8}
.sign{border:4px solid #f1eee8;padding:14px 26px;transform:rotate(-2deg);background:#0a0a0b;box-shadow:8px 8px 0 #ff2e93}
.sign b{display:block;font:400 clamp(38px,9vw,60px)/.95 'Bebas Neue','Arial Narrow',sans-serif;letter-spacing:3px}
.sign small{font:20px 'Sedgwick Ave',cursive;color:#c6ff3d}
p{margin:0;max-width:420px;color:#a3a0a8;font-size:13px}
.auto{font-size:11px;font-weight:700;color:#777}
</style>
</head>
<body>
<a class="logo" href="/">punk<span>chess</span></a>
<div class="sign"><b>${t.sign}</b><small>${t.sub}</small></div>
<p>${t.body}</p>
<span class="auto">⟳ ${t.retry}</span>
</body>
</html>`;
  return new Response(html, {
    status: 503,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'retry-after': '30' },
  });
}
