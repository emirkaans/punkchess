// The picture in the middle of each Anarşi card (card face, design "Afiş"): one per trick and
// chaos card, drawn in currentColor on a 100×100 box. A card with no picture here shows none.

const S = 'fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor"';

const ART: Readonly<Record<string, string>> = {
  // Kara Delik: a hole with rings pulled into it.
  void: `<circle cx="50" cy="50" r="40" ${S} opacity=".35"/><circle cx="50" cy="50" r="28" ${S} opacity=".65"/><circle cx="50" cy="50" r="16" ${F}/>`,
  // Piyon Avı: a pawn in the sights.
  pawn: `<circle cx="50" cy="36" r="9" ${F}/><path d="M42 48h16l4 22H38z" ${F}/><path d="M32 78h36" ${S}/><circle cx="50" cy="52" r="34" ${S} opacity=".8"/><path d="M50 8v12M50 84v12M6 52h12M82 52h12" ${S}/>`,
  // Buz: a snowflake.
  ice: `<path d="M50 8v84M14 29l72 42M14 71l72-42M38 14l12 12 12-12M38 86l12-12 12 12M10 42l16 4-4 16M90 58l-16-4 4-16" ${S}/>`,
  // Işınlanma: two arrows going round.
  swap: `<path d="M22 42a30 30 0 0 1 52-14" ${S}/><path d="M78 16v14H64" ${S}/><path d="M78 58a30 30 0 0 1-52 14" ${S}/><path d="M22 84V70h14" ${S}/>`,
  // Kalkan: a shield with a tick.
  shield: `<path d="M50 8l34 12v26c0 22-14 38-34 46C30 84 16 68 16 46V20z" ${S}/><path d="M50 22l22 8v17c0 14-9 25-22 31-13-6-22-17-22-31V30z" ${F} opacity=".3"/><path d="M38 50l9 9 17-19" ${S}/>`,
  // Barikat: a striped barrier on legs.
  wall: `<rect x="10" y="32" width="80" height="26" rx="3" ${S}/><path d="M24 58l14-26M46 58l14-26M68 58l14-26" ${S}/><path d="M22 58v26M78 58v26" ${S}/>`,
  // Diriliş: rising out of the ground, light above.
  revive: `<path d="M50 74V30M34 44l16-16 16 16" ${S}/><path d="M14 84h72" ${S}/><path d="M30 18l-6-6M70 18l6-6M50 12V4" ${S} opacity=".6"/>`,
  // Sürgün: sent back home.
  exile: `<path d="M80 70V46a20 20 0 0 0-20-20H22" ${S}/><path d="M36 12L22 26l14 14" ${S}/><path d="M14 86h40" ${S} opacity=".5"/>`,
  // Ateşkes: a white flag.
  truce: `<path d="M24 92V10" ${S}/><path d="M28 14c16-8 30 8 50 0v34c-20 8-34-8-50 0z" ${F} opacity=".85"/>`,
  // Mayın: a studded disc with a fuse.
  mine: `<ellipse cx="50" cy="60" rx="40" ry="20" ${F} opacity=".25"/><ellipse cx="50" cy="54" rx="40" ry="20" fill="none" stroke="currentColor" stroke-width="5"/><ellipse cx="50" cy="52" rx="24" ry="11" ${F}/>${Array.from(
    { length: 10 },
    (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return `<circle cx="${(50 + Math.cos(a) * 33).toFixed(1)}" cy="${(54 + Math.sin(a) * 16).toFixed(1)}" r="3.4" ${F}/>`;
    },
  ).join('')}<path d="M50 40V18M44 24l6-6 6 6" ${S}/>`,
  // Zaman Hırsızı: an hourglass.
  time: `<path d="M24 8h52M24 92h52" ${S}/><path d="M30 8c0 22 16 26 16 42S30 70 30 92M70 8c0 22-16 26-16 42s16 20 16 42" ${S}/><path d="M38 76h24l-12-12z" ${F}/>`,
  // Pusu: eyes in the dark.
  ambush: `<path d="M8 50c14-22 70-22 84 0-14 22-70 22-84 0z" ${F} opacity=".25"/><ellipse cx="34" cy="50" rx="10" ry="5" ${F}/><ellipse cx="66" cy="50" rx="10" ry="5" ${F}/><path d="M22 36l18 8M78 36l-18 8" ${S}/>`,
  // Hain: a face split in two colours.
  traitor: `<circle cx="50" cy="50" r="38" ${S}/><path d="M50 12a38 38 0 0 1 0 76z" ${F}/><circle cx="36" cy="44" r="5" ${F}/><path d="M30 64h14M56 64h14" ${S}/>`,
  // Nitro: a flame.
  nitro: `<path d="M50 6c6 18 26 26 26 50a26 26 0 0 1-52 0c0-12 6-20 12-26 0 10 4 16 10 18-2-14 0-28 4-42z" ${S}/><path d="M50 50c4 8 12 12 12 22a12 12 0 0 1-24 0c0-6 4-10 6-12 1 4 3 6 5 6-1-6 0-12 1-16z" ${F}/>`,
  // Rütbe Düşürme: rank chevrons, one torn off.
  demote: `<path d="M22 22l28 16 28-16M22 44l28 16 28-16" ${S}/><path d="M22 70l12 7M66 77l12-7" ${S} opacity=".45"/><path d="M50 74v18M42 84l8 8 8-8" ${S}/>`,
  // Deprem: the ground cracks.
  quake: `<path d="M8 50h18l8-16 10 32 10-40 10 36 8-12h20" ${S}/><path d="M18 80l10-8M82 80l-10-8M50 92v-10" ${S} opacity=".6"/>`,
};

/** The card's picture as an SVG string, or null. */
export const cardArt = (id: string): string | null =>
  ART[id] ? `<svg viewBox="0 0 100 100" aria-hidden="true">${ART[id]}</svg>` : null;
