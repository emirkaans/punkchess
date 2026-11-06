import { TIME_CONTROLS } from '../clock/clock.ts';
import { listVariants } from '../engine/index.ts';
import type { Color } from '../engine/index.ts';
import { useI18n } from './i18n.tsx';

// The options for an online game, in the game setup dialog's look (src/ui/VariantPlayDialog.tsx,
// styles .ps-*): the variants as their emblems, the times as pills, your colour as the colour
// itself, rated as a switch. Used by the lobby's form for an open game and the challenge form.

export function VariantPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { t, vt } = useI18n();
  return (
    <div className="ps-group">
      <span className="ps-label">{t('newGame.variant')}</span>
      <div className="ps-variants">
        {listVariants().map((v) => (
          <button key={v.id} type="button" aria-pressed={value === v.id} onClick={() => onChange(v.id)}>
            {v.emblem && <svg viewBox="0 0 48 48" aria-hidden="true" dangerouslySetInnerHTML={{ __html: v.emblem }} />}
            <b>{vt(v).name}</b>
          </button>
        ))}
      </div>
    </div>
  );
}

export function TimePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { t } = useI18n();
  return (
    <div className="ps-group">
      <span className="ps-label">{t('newGame.time')}</span>
      <div className="ps-times">
        {TIME_CONTROLS.map((tc) => (
          <button key={tc.id} type="button" aria-pressed={value === tc.id} onClick={() => onChange(tc.id)}>
            {tc.initialMs === null ? t('time.none') : tc.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Your colour (white, half and half for random, black) and, signed in, the rated switch beside it. */
export function ColorPicker({
  value,
  onChange,
  rated,
  onRated,
}: {
  value: Color | 'random';
  onChange: (c: Color | 'random') => void;
  /** Rated or not; absent: no switch (a guest). */
  rated?: boolean;
  onRated?: (rated: boolean) => void;
}) {
  const { t } = useI18n();
  const label = (c: Color | 'random') => (c === 'random' ? t('online.random') : t(`color.${c}`));
  return (
    <div className="ps-group">
      <span className="ps-label">{t('online.color')}</span>
      <div className="ps-colorrow">
        <div className="ps-colors">
          {(['w', 'random', 'b'] as const).map((c) => (
            <button
              key={c}
              type="button"
              className={`ps-swatch ${c}`}
              aria-pressed={value === c}
              aria-label={label(c)}
              title={label(c)}
              onClick={() => onChange(c)}
            />
          ))}
        </div>
        {rated !== undefined && onRated && (
          <button type="button" className="setup-toggle" aria-pressed={rated} onClick={() => onRated(!rated)}>
            <i aria-hidden="true" />
            {t(rated ? 'lobby.rated' : 'lobby.casual')}
          </button>
        )}
      </div>
    </div>
  );
}
