import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { isLocaleReady, loadLocale, translator } from '../i18n/index.ts';
import type { Locale, Translate } from '../i18n/index.ts';
import { variantTexts } from '../i18n/variant.ts';
import type { LocalizedVariant } from '../i18n/variant.ts';
import type { VariantDefinition } from '../engine/index.ts';

const LocaleContext = createContext<Locale>('tr');

/** Provides `locale`; a language that comes as a pack shows English until the pack is in. */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const [, setLoaded] = useState(0);
  const ready = isLocaleReady(locale);
  useEffect(() => {
    if (ready) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bump = () => setLoaded((n) => n + 1);
    // A failed load (offline, a file gone after a deploy) is tried once more a little later.
    loadLocale(locale).then(bump, () => {
      timer = setTimeout(() => loadLocale(locale).then(bump, () => undefined), 3000);
    });
    return () => clearTimeout(timer);
  }, [locale, ready]);
  const shown = ready ? locale : 'en';
  // The tab title and <html lang> follow the language (index.html names the tab in Turkish). A
  // page that set its own title (LegalPage) keeps it: only the site's own title is replaced.
  useEffect(() => {
    const title = translator(shown)('meta.title');
    if (document.title === siteTitle || document.title === INDEX_TITLE) document.title = title;
    siteTitle = title;
    document.documentElement.lang = shown;
  }, [shown]);
  return <LocaleContext.Provider value={shown}>{children}</LocaleContext.Provider>;
}

/** The tab title index.html ships with, and the site's title in the language last shown. */
const INDEX_TITLE = translator('tr')('meta.title');
let siteTitle = INDEX_TITLE;

export interface I18n {
  readonly locale: Locale;
  readonly t: Translate;
  /** The variant's name, rules, piece names etc. in the current language. */
  readonly vt: (v: VariantDefinition) => LocalizedVariant;
}

/** Current language (Turkish outside a provider). */
export function useI18n(): I18n {
  const locale = useContext(LocaleContext);
  return useMemo(() => ({ locale, t: translator(locale), vt: (v) => variantTexts(v, locale) }), [locale]);
}

/**
 * Text with its English words ("online") marked as English: in capitals they stay ONLINE, not
 * ONLİNE (Turkish capitalises i as İ, and the display font draws a lowercase i as İ in Turkish).
 */
export function withEnglishWords(text: string): ReactNode {
  const parts = text.split(/(online)/i);
  if (parts.length === 1) return text;
  return parts.map((p, i) =>
    i % 2 ? (
      <span key={i} lang="en">
        {p}
      </span>
    ) : (
      p
    ),
  );
}
