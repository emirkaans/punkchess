import type { CardIcon } from './cardVisual.ts';

/** A card result's picture (badge or bubble): a mine (struck out once cleared), a snowflake, a shield. */
export function CardIconView({ icon }: { icon: CardIcon }) {
  if (icon.icon === 'mine')
    return (
      <span className={`cv-icon cv-mine${icon.struck ? ' struck' : ''}`} aria-hidden="true">
        <span className="cv-svg" dangerouslySetInnerHTML={{ __html: icon.svg }} />
      </span>
    );
  return (
    <span className="cv-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        {icon.icon === 'snow' ? (
          <path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 4l3 3 3-3M9 20l3-3 3 3" />
        ) : (
          <path d="M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5z" />
        )}
      </svg>
    </span>
  );
}
