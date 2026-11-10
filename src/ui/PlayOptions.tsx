import { useState } from 'react';
import { CUSTOM_INCREMENTS, CUSTOM_MINUTES, TIME_CONTROLS, isCustomTime, timeControl } from '../clock/clock.ts';
import { listVariants } from '../engine/index.ts';
import type { Color } from '../engine/index.ts';
import { speedOf } from '../rating/categories.ts';
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

/**
 * The time: the usual ones as pills, and "Custom" with two sliders (minutes per side, seconds added
 * a move) and the speed it counts as. Used by the game setup dialog and the lobby's form.
 */
export function TimePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { t } = useI18n();
  const custom = isCustomTime(value);
  // The last custom time, kept while a listed one is picked, so going back finds it.
  const [last, setLast] = useState(() => (custom ? value : '7+3'));
  const tc = timeControl(last);
  const minutes = (tc.initialMs ?? 0) / 60_000;
  const inc = tc.incrementMs / 1000;
  const pick = (m: number, i: number) => {
    const id = `${m}+${i}`;
    setLast(id);
    onChange(id);
  };
  const speed = speedOf(last);
  return (
    <div className="ps-group">
      <span className="ps-label">{t('newGame.time')}</span>
      <div className="ps-times">
        {TIME_CONTROLS.map((x) => (
          <button key={x.id} type="button" aria-pressed={value === x.id} onClick={() => onChange(x.id)}>
            {x.initialMs === null ? t('time.none') : x.label}
          </button>
        ))}
        <button type="button" aria-pressed={custom} onClick={() => onChange(last)}>
          {custom ? value : t('time.custom')}
        </button>
      </div>
      {custom && (
        <div className="ps-custom">
          <label>
            <span>
              {t('time.minutes')} <b>{minutes}</b>
            </span>
            <input
              type="range"
              min={0}
              max={CUSTOM_MINUTES.length - 1}
              value={Math.max(0, CUSTOM_MINUTES.indexOf(minutes as (typeof CUSTOM_MINUTES)[number]))}
              onChange={(e) => pick(CUSTOM_MINUTES[Number(e.target.value)], inc)}
            />
          </label>
          <label>
            <span>
              {t('time.increment')} <b>{inc}</b>
            </span>
            <input
              type="range"
              min={0}
              max={CUSTOM_INCREMENTS.length - 1}
              value={Math.max(0, CUSTOM_INCREMENTS.indexOf(inc as (typeof CUSTOM_INCREMENTS)[number]))}
              onChange={(e) => pick(minutes, CUSTOM_INCREMENTS[Number(e.target.value)])}
            />
          </label>
          {speed && <small className="ps-speed">{t(`lobby.speed.${speed}`)}</small>}
        </div>
      )}
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
