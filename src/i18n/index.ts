// Translation layer: pick a language, look texts up by key, fill placeholders.
// Pure (no React); src/i18n/react.tsx provides the hook for components.

import { en, tr } from './messages.ts';
import type { MessageKey } from './messages.ts';
import type { LocalePack } from './pack.ts';

export type { MessageKey } from './messages.ts';
export type { LocalePack } from './pack.ts';

export const LOCALES = {
  tr: 'Türkçe',
  en: 'English',
  es: 'Español',
  pt: 'Português',
  fr: 'Français',
  it: 'Italiano',
  de: 'Deutsch',
} as const;
export type Locale = keyof typeof LOCALES;

/** The built-in languages; the others come as packs, loaded when picked. */
const DICTIONARIES = { tr, en } as const satisfies Record<string, Record<MessageKey, string>>;
type BuiltIn = keyof typeof DICTIONARIES;
const isBuiltIn = (l: Locale): l is BuiltIn => l in DICTIONARIES;

/** The language packs, each its own file in the build. */
export const PACK_LOADERS: Readonly<Record<Exclude<Locale, BuiltIn>, () => Promise<{ default: LocalePack }>>> = {
  es: () => import('./locales/es.ts'),
  pt: () => import('./locales/pt.ts'),
  fr: () => import('./locales/fr.ts'),
  it: () => import('./locales/it.ts'),
  de: () => import('./locales/de.ts'),
};
const packs: Partial<Record<Locale, LocalePack>> = {};

/** The pack of a loaded language (null for a built-in one or one still loading). */
export const localePack = (locale: Locale): LocalePack | null => packs[locale] ?? null;

/** True when `locale`'s texts are at hand (built in, or its pack loaded). */
export const isLocaleReady = (locale: Locale): boolean => isBuiltIn(locale) || locale in packs;

/** Loads `locale`'s pack (nothing for a built-in language). */
export async function loadLocale(locale: Locale): Promise<void> {
  if (isLocaleReady(locale)) return;
  packs[locale] = (await PACK_LOADERS[locale as Exclude<Locale, BuiltIn>]()).default;
}

/** Puts a pack in place directly (tests, and anything that already holds one). */
export function registerLocalePack(locale: Exclude<Locale, BuiltIn>, pack: LocalePack): void {
  packs[locale] = pack;
}

export type Params = Readonly<Record<string, string | number>>;
export type Translate = (key: MessageKey, params?: Params) => string;

/** Text for `key` in `locale` with {placeholders} filled in. */
export function translate(locale: Locale, key: MessageKey, params: Params = {}): string {
  const own = isBuiltIn(locale) ? DICTIONARIES[locale][key] : packs[locale]?.messages[key];
  const text = own ?? (locale === 'tr' ? undefined : en[key]) ?? tr[key];
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

export const translator =
  (locale: Locale): Translate =>
  (key, params) =>
    translate(locale, key, params);

export const isLocale = (x: unknown): x is Locale => typeof x === 'string' && x in LOCALES;

/**
 * Default language: Turkish whenever the browser lists it; otherwise the first of the browser's
 * languages the site has; English when none.
 */
export function detectLocale(languages: readonly string[]): Locale {
  const codes = languages.map((l) => l.toLowerCase().slice(0, 2));
  if (codes.includes('tr')) return 'tr';
  return codes.find(isLocale) ?? 'en';
}

export const dictionaries = DICTIONARIES;

/**
 * An error whose message can be shown in any language: `key` and `params`
 * name the text; `message` holds the Turkish one (for logs and tests).
 */
export class LocalizedError extends Error {
  constructor(
    readonly key: MessageKey,
    readonly params: Params = {},
  ) {
    super(translate('tr', key, params));
  }
}

/** Text of a caught error in `t`'s language. */
export const errorText = (e: unknown, t: Translate): string =>
  e instanceof LocalizedError ? t(e.key, e.params) : e instanceof Error ? e.message : String(e);

export const isMessageKey = (k: string): k is MessageKey => k in tr;

/** `key` translated when it exists, else `fallback` (texts stored by older versions, imported tags). */
export const translateOr = (t: Translate, key: string, fallback: string): string =>
  isMessageKey(key) ? t(key) : fallback;
