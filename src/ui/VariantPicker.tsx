import { useEffect, useId, useRef, useState } from 'react';
import { listVariants } from '../engine/index.ts';
import { useI18n } from './i18n.tsx';

const Emblem = ({ svg }: { svg?: string }) =>
  svg ? (
    <svg className="vpick-emblem" viewBox="0 0 48 48" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
  ) : null;

/**
 * The board editor's variant choice: a narrow button with the variant's emblem and name that
 * opens a list of the variants, each with its emblem. Closes on a pick, Escape or a click
 * outside.
 */
export function VariantPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { t, vt } = useI18n();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();
  const variants = listVariants();
  const current = variants.find((v) => v.id === value) ?? variants[0];

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    addEventListener('pointerdown', away);
    addEventListener('keydown', esc);
    return () => {
      removeEventListener('pointerdown', away);
      removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className={`vpick${open ? ' open' : ''}`} ref={box}>
      <span className="vpick-label" id={`${listId}-label`}>
        {t('analysisPage.variant')}
      </span>
      <button
        type="button"
        className="vpick-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={`${listId}-label ${listId}-name`}
        onClick={() => setOpen((o) => !o)}
      >
        <Emblem svg={current.emblem} />
        <span className="vpick-name" id={`${listId}-name`}>
          {vt(current).name}
        </span>
        <svg className="vpick-chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <small className="vpick-note">{t('analysisPage.variantNote')}</small>
      {open && (
        <div className="vpick-list" id={listId} role="listbox" aria-labelledby={`${listId}-label`}>
          {variants.map((v) => (
            <button
              key={v.id}
              type="button"
              role="option"
              aria-selected={v.id === current.id}
              className={v.id === current.id ? 'on' : undefined}
              onClick={() => {
                setOpen(false);
                if (v.id !== current.id) onChange(v.id);
              }}
            >
              <Emblem svg={v.emblem} />
              {vt(v).name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
