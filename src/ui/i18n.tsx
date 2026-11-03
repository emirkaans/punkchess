import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { translator } from '../i18n/index.ts';
import type { Locale, Translate } from '../i18n/index.ts';
import { variantTexts } from '../i18n/variant.ts';
import type { LocalizedVariant } from '../i18n/variant.ts';
import type { VariantDefinition } from '../engine/index.ts';

const LocaleContext = createContext<Locale>('tr');

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

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
