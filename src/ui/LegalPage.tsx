import { useEffect } from 'react';
import type { MouseEvent } from 'react';
import type { Locale } from '../i18n/index.ts';
import privacyTr from '../legal/privacy.tr.html?raw';
import privacyEn from '../legal/privacy.en.html?raw';
import termsTr from '../legal/terms.tr.html?raw';
import termsEn from '../legal/terms.en.html?raw';
import licensesTr from '../legal/licenses.tr.html?raw';
import licensesEn from '../legal/licenses.en.html?raw';
import { useI18n } from './i18n.tsx';

export type LegalDoc = 'privacy' | 'terms' | 'licenses';

/**
 * The privacy policy, the terms and the licenses (src/legal/<doc>.<locale>.html), in the site's
 * language. Languages without their own text get the English one.
 */
const TEXTS: Readonly<Record<LegalDoc, Partial<Record<Locale, string>> & { en: string }>> = {
  privacy: { tr: privacyTr, en: privacyEn },
  terms: { tr: termsTr, en: termsEn },
  licenses: { tr: licensesTr, en: licensesEn },
};

export function LegalPage({ doc, onOpen }: { doc: LegalDoc; onOpen: (path: string) => void }) {
  const { locale } = useI18n();
  const text = TEXTS[doc][locale] ?? TEXTS[doc].en;
  // The tab title in the page's language (the server names it in Turkish).
  useEffect(() => {
    const heading = /<h1>(.*?)<\/h1>/.exec(text)?.[1];
    if (!heading) return;
    document.title = `${heading} · punkchess`;
    return () => {
      document.title = 'punkchess';
    };
  }, [text]);
  // Links to the site's own pages stay in the app; files (licence texts) and mail open as usual.
  const follow = (e: MouseEvent<HTMLElement>) => {
    const a = e.target instanceof Element ? e.target.closest('a') : null;
    const href = a?.getAttribute('href');
    if (!href || !/^\/[^.]*$/.test(href) || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    onOpen(href);
  };
  return (
    <main className="legal-page">
      {/* The texts are the site's own files, bundled at build time. */}
      <article lang={TEXTS[doc][locale] ? locale : 'en'} onClick={follow} dangerouslySetInnerHTML={{ __html: text }} />
    </main>
  );
}
