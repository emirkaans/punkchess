// The page shown when the Worker itself breaks on a page request (design 3, "Kapalı tabelası"),
// instead of Cloudflare's own error page: one self-contained page, in the browser's language (one of the
// site's languages), that tries again every 30 seconds. Its fonts are static files, which
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
  es: {
    title: 'Pausa corta · punkchess',
    sign: 'PAUSA CORTA',
    sub: 'volvemos enseguida',
    body: 'Algo falla en el servidor; lo sabemos y estamos en ello. La página se recargará sola, no tienes que hacer nada.',
    retry: 'reintentando en 30 s',
  },
  pt: {
    title: 'Pausa rápida · punkchess',
    sign: 'PAUSA RÁPIDA',
    sub: 'já voltamos',
    body: 'Algo deu errado no servidor; já sabemos e estamos cuidando. A página recarrega sozinha, não precisa fazer nada.',
    retry: 'tentando de novo em 30 s',
  },
  fr: {
    title: 'Petite pause · punkchess',
    sign: 'PETITE PAUSE',
    sub: 'on revient dans un instant',
    body: "Quelque chose cloche sur le serveur ; on est au courant et on s'en occupe. La page se rechargera toute seule, rien à faire.",
    retry: 'nouvel essai dans 30 s',
  },
  it: {
    title: 'Piccola pausa · punkchess',
    sign: 'PICCOLA PAUSA',
    sub: 'torniamo subito',
    body: 'Qualcosa non va sul server; lo sappiamo e ci stiamo lavorando. La pagina si ricarica da sola, non devi fare nulla.',
    retry: 'riprovo tra 30 s',
  },
  de: {
    title: 'Kurze Pause · punkchess',
    sign: 'KURZE PAUSE',
    sub: 'gleich wieder da',
    body: 'Auf dem Server ist etwas kaputt; wir wissen Bescheid und kümmern uns. Die Seite lädt von selbst neu, du musst nichts tun.',
    retry: 'neuer Versuch in 30 s',
  },
} as const;

type Lang = keyof typeof TEXT;

/** Turkish whenever the browser lists it, else its first language the page has, else English. */
function pickLang(header: string): Lang {
  const codes = header.split(',').map((part) => part.trim().slice(0, 2).toLowerCase());
  if (codes.includes('tr')) return 'tr';
  return (codes.find((c) => c in TEXT) as Lang | undefined) ?? 'en';
}

/** The outage page for a request (its language from Accept-Language). */
export function outagePage(request: Request): Response {
  const lang = pickLang(request.headers.get('accept-language') ?? 'tr');
  const t = TEXT[lang];
  const html = `<!doctype html>
<html lang="${lang}">
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
