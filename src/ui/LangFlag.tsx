import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LOCALES } from '../i18n/index.ts';
import type { Locale } from '../i18n/index.ts';
import { useI18n } from './i18n.tsx';

// Each language's flag, drawn (emoji flags show as two letters on Windows): English with the
// United Kingdom's, Portuguese with Brazil's (the translation is Brazilian Portuguese).
const FLAGS: Readonly<Record<Locale, string>> = {
  tr: '<rect width="30" height="20" fill="#e30a17"/><circle cx="11" cy="10" r="5" fill="#fff"/><circle cx="12.3" cy="10" r="4" fill="#e30a17"/><path d="M16.4 10l3.7-1.2-2.3 3.1V8.1l2.3 3.1z" fill="#fff"/>',
  en: '<rect width="30" height="20" fill="#012169"/><path d="M0 0l30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0l30 20M30 0L0 20" stroke="#c8102e" stroke-width="1.5"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6"/><path d="M15 0v20M0 10h30" stroke="#c8102e" stroke-width="3.5"/>',
  es: '<rect width="30" height="20" fill="#aa151b"/><rect y="5" width="30" height="10" fill="#f1bf00"/>',
  pt: '<rect width="30" height="20" fill="#009c3b"/><path d="M15 2.5L27 10 15 17.5 3 10z" fill="#ffdf00"/><circle cx="15" cy="10" r="4.2" fill="#002776"/><path d="M11 9.2c2.8-.6 5.6-.2 8 1.2" stroke="#fff" stroke-width=".8" fill="none"/>',
  fr: '<rect width="10" height="20" fill="#002395"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ed2939"/>',
  it: '<rect width="10" height="20" fill="#009246"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ce2b37"/>',
  de: '<rect width="30" height="7" fill="#000"/><rect y="6.6" width="30" height="7" fill="#dd0000"/><rect y="13.3" width="30" height="6.7" fill="#ffce00"/>',
};

/** A language's flag as a small sticker (white edge, a little crooked). */
export function LangFlag({ locale }: { locale: Locale }) {
  return (
    <svg
      className="lang-flag"
      viewBox="0 0 30 20"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: FLAGS[locale] }}
    />
  );
}

/** The footer's language picker: one button (flag and code); the list opens upward. */
export function LangPicker({ locale, onLocale }: { locale: Locale; onLocale: (locale: Locale) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const drop = useRef<HTMLDivElement>(null);
  // The list hangs from the button's right edge; where that would cross the screen's left edge
  // (the picker wraps to the left on a phone) it hangs from the left edge instead.
  useLayoutEffect(() => {
    const d = drop.current;
    if (!open || !d) return;
    d.classList.remove('from-left');
    if (d.getBoundingClientRect().left < 8) d.classList.add('from-left');
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div className={`lang-picker${open ? ' open' : ''}`} ref={box}>
      <button
        className="lang-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t('toolbar.language')}: ${LOCALES[locale]}`}
        onClick={() => setOpen((o) => !o)}
      >
        <LangFlag locale={locale} />
        <b>{locale.toUpperCase()}</b>
        <svg className="lang-chev" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M1 3l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div className="lang-drop" ref={drop} role="menu" aria-label={t('toolbar.language')}>
          {(Object.entries(LOCALES) as [Locale, string][]).map(([code, name]) => (
            <button
              key={code}
              role="menuitemradio"
              aria-checked={code === locale}
              className={code === locale ? 'lang-row on' : 'lang-row'}
              lang={code}
              onClick={() => {
                onLocale(code);
                setOpen(false);
              }}
            >
              <LangFlag locale={code} />
              <span>{name}</span>
              <span className="lang-code" aria-hidden="true">
                {code.toUpperCase()}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
