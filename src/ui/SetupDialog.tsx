import { useRef, useState } from 'react';
import type { SetupQuestion, VariantDefinition } from '../engine/index.ts';
import { useI18n } from './i18n.tsx';
import { PieceView } from './PieceView.tsx';
import { useDialogFocus } from './useDialogFocus.ts';

/** Options per page: long lists of described options (Anarşi's tricks) are paged so the dialog fits on the board. */
const PAGE = 6;

interface Props {
  variant: VariantDefinition;
  question: SetupQuestion;
  step: number;
  total: number;
  onPick: (optionId: string) => void;
}

/** Pre-game choice dialog; driven entirely by the variant's setup questions. */
export function SetupDialog({ variant, question: original, step, total, onPick }: Props) {
  const { t, vt } = useI18n();
  const question = vt(variant).question(original);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  // Only cards with a description take that much room; short choices (Jester's pieces) stay on one page.
  const pages = question.options.some((o) => o.detail) ? Math.ceil(question.options.length / PAGE) : 1;
  // Each question starts on the page with its default option.
  const [paging, setPaging] = useState({ step, page: 0 });
  const startPage = Math.max(0, Math.floor(question.options.findIndex((o) => o.id === question.defaultOption) / PAGE));
  const page = paging.step === step ? paging.page : startPage;
  const turn = (to: number) => setPaging({ step, page: (to + pages) % pages });
  const shown = pages > 1 ? question.options.slice(page * PAGE, page * PAGE + PAGE) : question.options;
  return (
    <div className="modal-backdrop">
      <div
        className="modal setup"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label={question.title}
      >
        <p>
          {question.title}
          {total > 1 && (
            <span className="muted">
              {' '}
              ({step + 1}/{total})
            </span>
          )}
        </p>
        <div className={pages > 1 ? 'setup-options paged' : 'setup-options'}>
          {shown.map((o) => (
            <button
              key={o.id}
              className={o.id === question.defaultOption ? 'setup-option default' : 'setup-option'}
              onClick={() => onPick(o.id)}
            >
              {o.icon && (
                <span className="setup-icon">
                  <PieceView variant={variant} piece={o.icon} />
                </span>
              )}
              {o.detail ? (
                <span className="setup-text">
                  {o.label}
                  <small>{o.detail}</small>
                </span>
              ) : (
                o.label
              )}
            </button>
          ))}
        </div>
        {pages > 1 && (
          <div className="setup-pager">
            <button type="button" className="pager-arrow" aria-label={t('pager.prev')} onClick={() => turn(page - 1)}>
              ‹
            </button>
            <span className="setup-dots" aria-label={t('pager.page', { page: page + 1, pages })}>
              {Array.from({ length: pages }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  className={i === page ? 'setup-dot on' : 'setup-dot'}
                  aria-label={t('pager.page', { page: i + 1, pages })}
                  aria-current={i === page}
                  onClick={() => turn(i)}
                />
              ))}
            </span>
            <button type="button" className="pager-arrow" aria-label={t('pager.next')} onClick={() => turn(page + 1)}>
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
