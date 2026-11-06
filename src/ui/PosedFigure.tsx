import { useEffect, useMemo, useState } from 'react';
import type { Avatar } from '../avatar/avatar.ts';
import { figureSvg } from '../avatar/figure.ts';
import { EMPTY_OUTFIT } from '../avatar/outfit.ts';
import type { Outfit } from '../avatar/outfit.ts';
import { framesOf } from '../avatar/poses.ts';

/** How long a new pose takes to fade in over the old one (the CSS transition as well). */
const FADE_MS = 300;

function Frames({ avatar, outfit, pose, view }: { avatar: Avatar; outfit: Outfit; pose: string; view?: string }) {
  const svgs = useMemo(
    () => Array.from({ length: framesOf(pose) }, (_, i) => figureSvg(avatar, outfit, view, pose, i)),
    [avatar, outfit, pose, view],
  );
  if (svgs.length === 1) return <span className="pf-frame" dangerouslySetInnerHTML={{ __html: svgs[0] }} />;
  // Two frames take turns (CSS): a fist pumping, a dance.
  return (
    <>
      {svgs.map((svg, i) => (
        <span key={i} className={`pf-frame pf-f${i + 1}`} dangerouslySetInnerHTML={{ __html: svg }} />
      ))}
    </>
  );
}

/**
 * The character in a pose (src/avatar/poses.ts), breathing; a new pose fades in over the old.
 * `view` crops it (the strip's head-to-waist), else the whole figure.
 */
export function PosedFigure({
  avatar,
  outfit,
  pose,
  view,
  className = '',
}: {
  avatar: Avatar;
  outfit: Outfit | null;
  pose: string;
  view?: string;
  className?: string;
}) {
  const wear = outfit ?? EMPTY_OUTFIT;
  // The pose shown and, for a moment after a change, the one fading out under it.
  const [layers, setLayers] = useState<{ pose: string; key: number }[]>([{ pose, key: 0 }]);
  const [shownPose, setShownPose] = useState(pose);
  if (shownPose !== pose) {
    setShownPose(pose);
    setLayers((l) => [...l.slice(-1), { pose, key: (l.at(-1)?.key ?? 0) + 1 }]);
  }
  useEffect(() => {
    if (layers.length < 2) return;
    const timer = setTimeout(() => setLayers((l) => l.slice(-1)), FADE_MS);
    return () => clearTimeout(timer);
  }, [layers]);
  return (
    <span className={`posed p-${pose} ${className}`}>
      {layers.map((l, i) => (
        <span key={l.key} className={`pf-layer${i < layers.length - 1 ? ' old' : ''}`}>
          <Frames avatar={avatar} outfit={wear} pose={l.pose} view={view} />
        </span>
      ))}
    </span>
  );
}
