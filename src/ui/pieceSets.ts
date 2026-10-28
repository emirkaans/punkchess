import { useSyncExternalStore } from 'react';

/**
 * Drawn piece sets. 'glyph' is the font (the chess symbols); every other set
 * draws the six standard pieces as SVG in a 100×100 box. The drawings take
 * their colours from the piece theme through CSS (fill, stroke, --line, --accent),
 * so any set works with any piece theme.
 */
export const PIECE_SETS = [
  'glyph',
  'sablon',
  'mohawk',
  'zimbali',
  'damla',
  'rozet',
  'kirik',
  'kafatasi',
  'tup',
  'piksel',
  'firca',
  'murekkep',
  'zincir',
  'sprey',
  'brutal',
] as const;
export type PieceSet = (typeof PIECE_SETS)[number];
type Drawn = Exclude<PieceSet, 'glyph' | 'murekkep' | 'zincir' | 'sprey' | 'brutal'>;
type StandardKind = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';
/** The variants' own pieces: Bürokrat, Diplomat, Jester (by piece type). */
type VariantKind = 'u' | 'd' | 'j';
type Kind = StandardKind | VariantKind;
const VARIANT_KINDS: readonly string[] = ['u', 'd', 'j'];

const LINE = 'style="fill: var(--line); stroke: none"';
const ACCENT = 'style="fill: var(--accent)"';
const FACET = 'style="fill: none; stroke: var(--line); stroke-width: 1.6; opacity: .55"';

const studs = (points: [number, number][]) =>
  points.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" ${LINE}/>`).join('');
const studBase = `<rect x="22" y="78" width="56" height="12" rx="3"/>${studs([
  [30, 84],
  [40, 84],
  [50, 84],
  [60, 84],
  [70, 84],
])}`;
const dripBase =
  '<path d="M22 72 H78 V82 Q78 86 75 86 Q72 86 72 82 V80 H62 V90 Q62 95 58 95 Q54 95 54 90 V80 H40 V86 Q40 89 37 89 Q34 89 34 86 V80 H28 V84 Q28 88 25 88 Q22 88 22 84 Z"/>';
const badge =
  '<circle cx="50" cy="52" r="42" style="fill: rgba(0,0,0,.35); stroke: none"/><circle cx="50" cy="50" r="42"/><circle cx="50" cy="50" r="35" style="fill: none; stroke: var(--accent); stroke-width: 3; stroke-dasharray: 6 4"/>';
/** A small silhouette drawn inside the badge in the line colour. */
const inBadge = (inner: string) =>
  `${badge}<g transform="translate(25 23) scale(.5)" style="fill: var(--line); stroke: none">${inner}</g>`;
const skull = `<rect x="26" y="80" width="48" height="10" rx="2"/><rect x="42" y="68" width="16" height="12"/><path d="M30 48 Q30 22 50 22 Q70 22 70 48 Q70 57 62 59 L62 70 L38 70 L38 59 Q30 57 30 48 Z"/><circle cx="42" cy="45" r="5.5" ${LINE}/><circle cx="58" cy="45" r="5.5" ${LINE}/><polygon points="50,51 46.5,58 53.5,58" ${LINE}/><path d="M44 63 V70 M50 63 V70 M56 63 V70" style="fill: none; stroke: var(--line); stroke-width: 1.6"/>`;
const hat = (shape: string) => skull + shape.replace('/>', ` ${ACCENT}/>`);

const DRAWINGS: Record<Drawn, Record<StandardKind, string>> = {
  // Cut like a spray stencil: the parts stand apart.
  sablon: {
    k: '<rect x="24" y="80" width="52" height="10"/><polygon points="32,76 36,42 64,42 68,76"/><rect x="30" y="32" width="40" height="6"/><polygon points="30,28 30,10 40,18 50,6 60,18 70,10 70,28"/>',
    q: '<rect x="24" y="80" width="52" height="10"/><polygon points="34,76 40,42 60,42 66,76"/><rect x="32" y="32" width="36" height="6"/><polygon points="30,28 24,12 40,20 50,6 60,20 76,12 70,28"/>',
    r: '<rect x="24" y="80" width="52" height="10"/><rect x="32" y="40" width="36" height="36"/><rect x="28" y="26" width="44" height="10"/><rect x="28" y="12" width="10" height="10"/><rect x="45" y="12" width="10" height="10"/><rect x="62" y="12" width="10" height="10"/>',
    b: '<rect x="24" y="80" width="52" height="10"/><polygon points="36,76 40,54 60,54 64,76"/><polygon points="38,48 40,30 47,18 47,40 53,40 53,18 60,30 62,48"/><circle cx="50" cy="10" r="4"/>',
    n: '<rect x="24" y="80" width="52" height="10"/><polygon points="30,76 34,58 26,50 30,38 44,22 50,22 52,76"/><polygon points="56,76 56,20 62,22 74,32 76,46 68,48 62,44 60,52 64,76"/>',
    p: '<rect x="28" y="80" width="44" height="10"/><polygon points="36,76 42,52 58,52 64,76"/><rect x="36" y="44" width="28" height="5"/><circle cx="50" cy="28" r="11"/>',
  },
  // Rounded bodies, each with a crest.
  mohawk: {
    k: `<polygon points="38,28 40,4 45,20 50,0 55,20 60,4 62,28" ${ACCENT}/><rect x="24" y="80" width="52" height="10" rx="4"/><rect x="34" y="42" width="32" height="38" rx="8"/><rect x="37" y="26" width="26" height="18" rx="7"/><rect x="34" y="54" width="32" height="6" ${ACCENT}/>`,
    q: `<polygon points="36,34 36,10 43,26 50,4 57,26 64,10 64,34" ${ACCENT}/><rect x="24" y="80" width="52" height="10" rx="4"/><path d="M34 80 L39 48 Q50 42 61 48 L66 80 Z"/><circle cx="50" cy="38" r="11"/>`,
    r: `<polygon points="32,38 33,16 39,32 44,12 50,32 56,12 61,32 67,16 68,38" ${ACCENT}/><rect x="24" y="80" width="52" height="10" rx="4"/><rect x="32" y="34" width="36" height="46" rx="6"/>`,
    b: `<polygon points="44,40 50,4 56,40" ${ACCENT}/><rect x="24" y="80" width="52" height="10" rx="4"/><path d="M38 80 L42 70 Q30 56 36 44 Q42 32 50 32 Q58 32 64 44 Q70 56 58 70 L62 80 Z"/>`,
    n: `<polygon points="46,30 40,12 50,22 52,6 58,22 66,10 66,28 72,22 70,36" ${ACCENT}/><rect x="24" y="80" width="52" height="10" rx="4"/><path d="M32 80 L34 60 Q24 52 30 40 Q38 26 54 24 Q70 26 76 44 L68 50 Q60 44 56 52 Q62 64 64 80 Z"/><circle cx="54" cy="38" r="3" ${LINE}/>`,
    p: `<polygon points="42,32 43,16 47,28 50,10 53,28 57,16 58,32" ${ACCENT}/><rect x="28" y="80" width="44" height="10" rx="4"/><path d="M36 80 Q36 58 50 54 Q64 58 64 80 Z"/><circle cx="50" cy="42" r="12"/>`,
  },
  // Chunky, with studs.
  zimbali: {
    k: `${studBase}<rect x="30" y="36" width="40" height="42" rx="2"/><rect x="32" y="18" width="36" height="18"/><circle cx="36" cy="13" r="4.5" ${ACCENT}/><circle cx="50" cy="9" r="4.5" ${ACCENT}/><circle cx="64" cy="13" r="4.5" ${ACCENT}/>${studs(
      [
        [40, 56],
        [50, 56],
        [60, 56],
      ],
    )}`,
    q: `${studBase}<polygon points="32,78 38,38 62,38 68,78"/><polygon points="30,38 26,16 40,28 50,12 60,28 74,16 70,38"/><circle cx="26" cy="14" r="4.5" ${ACCENT}/><circle cx="50" cy="10" r="4.5" ${ACCENT}/><circle cx="74" cy="14" r="4.5" ${ACCENT}/>`,
    r: `${studBase}<rect x="30" y="32" width="40" height="46"/><rect x="26" y="16" width="48" height="16"/>${studs([
      [34, 24],
      [50, 24],
      [66, 24],
    ])}`,
    b: `${studBase}<polygon points="34,78 40,40 50,14 60,40 66,78"/>${studs([
      [50, 40],
      [50, 52],
      [50, 64],
    ])}`,
    n: `${studBase}<polygon points="28,78 30,58 24,48 30,32 48,18 62,20 76,36 72,46 62,42 58,50 66,78"/>${studs([
      [40, 30],
      [34, 40],
      [32, 52],
    ])}<circle cx="58" cy="30" r="3" ${LINE}/>`,
    p: `${studBase}<polygon points="36,78 40,52 60,52 64,78"/><rect x="36" y="48" width="28" height="6"/><circle cx="50" cy="34" r="14"/>`,
  },
  // Paint running off the base and the crowns.
  damla: {
    k: `${dripBase}<path d="M36 72 L37 42 H63 L64 72 Z"/><path d="M32 42 L30 16 L40 26 L50 12 L60 26 L70 16 L68 42 Z"/><path d="M40 42 V48 Q40 51 42.5 51 Q45 51 45 48 V42 M56 42 V52 Q56 55 58.5 55 Q61 55 61 52 V42"/>`,
    q: `${dripBase}<path d="M36 72 L40 40 H60 L64 72 Z"/><path d="M36 14 Q43 26 43 31 Q43 37 36 37 Q29 37 29 31 Q29 26 36 14 Z"/><path d="M50 8 Q57 20 57 25 Q57 31 50 31 Q43 31 43 25 Q43 20 50 8 Z"/><path d="M64 14 Q71 26 71 31 Q71 37 64 37 Q57 37 57 31 Q57 26 64 14 Z"/>`,
    r: `${dripBase}<rect x="32" y="34" width="36" height="38"/><path d="M28 20 H72 V34 H62 V40 Q62 43 59.5 43 Q57 43 57 40 V34 H40 V38 Q40 41 37.5 41 Q35 41 35 38 V34 H28 Z"/><rect x="28" y="10" width="10" height="10"/><rect x="45" y="10" width="10" height="10"/><rect x="62" y="10" width="10" height="10"/>`,
    b: `${dripBase}<rect x="42" y="58" width="16" height="14"/><path d="M50 8 Q66 32 63 48 Q61 60 50 60 Q39 60 37 48 Q34 32 50 8 Z"/>`,
    n: `${dripBase}<path d="M30 72 L34 54 Q24 46 32 34 Q42 18 60 18 Q74 22 76 40 L70 46 Q62 40 58 48 L64 72 Z"/><path d="M66 44 V52 Q66 55 68.5 55 Q71 55 71 52 V42"/>`,
    p: `${dripBase}<path d="M38 72 L42 50 H58 L62 72 Z"/><circle cx="50" cy="36" r="13"/>`,
  },
  // Pin badges.
  rozet: {
    k: inBadge(
      '<rect x="24" y="80" width="52" height="10"/><rect x="32" y="40" width="36" height="36"/><polygon points="30,34 30,10 40,20 50,6 60,20 70,10 70,34"/>',
    ),
    q: inBadge(
      '<rect x="24" y="80" width="52" height="10"/><polygon points="34,76 40,40 60,40 66,76"/><polygon points="28,34 22,10 38,22 50,4 62,22 78,10 72,34"/>',
    ),
    r: inBadge(
      '<rect x="24" y="80" width="52" height="10"/><rect x="32" y="36" width="36" height="40"/><polygon points="26,32 26,10 38,10 38,20 45,20 45,10 55,10 55,20 62,20 62,10 74,10 74,32"/>',
    ),
    b: inBadge(
      '<rect x="24" y="80" width="52" height="10"/><polygon points="38,76 42,60 58,60 62,76"/><path d="M50 6 Q70 32 64 48 Q60 56 50 56 Q40 56 36 48 Q30 32 50 6 Z"/>',
    ),
    n: inBadge(
      '<rect x="24" y="80" width="52" height="10"/><polygon points="30,76 34,56 24,48 30,32 46,16 60,16 76,34 74,46 62,42 58,50 64,76"/>',
    ),
    p: inBadge(
      '<rect x="28" y="80" width="44" height="10"/><polygon points="36,76 42,48 58,48 64,76"/><circle cx="50" cy="30" r="14"/>',
    ),
  },
  // Angular shards with facet lines.
  kirik: {
    k: `<polygon points="28,90 34,78 36,40 28,32 34,10 50,22 66,10 72,32 64,40 66,78 72,90"/><path d="M34,10 42,32 50,22 58,32 66,10 M36,40 50,56 64,40 M50,56 40,90 M50,56 62,90" ${FACET}/>`,
    q: `<polygon points="26,90 32,78 38,40 22,14 42,30 50,6 58,30 78,14 62,40 68,78 74,90"/><path d="M42,30 50,48 58,30 M38,40 50,48 62,40 M50,48 44,90" ${FACET}/>`,
    r: `<polygon points="26,90 32,78 34,36 26,12 40,18 50,10 60,18 74,12 66,36 68,78 74,90"/><path d="M34,36 50,28 66,36 M50,28 46,60 58,90 M46,60 32,78" ${FACET}/>`,
    b: `<polygon points="28,90 36,76 42,56 34,34 50,6 66,34 58,56 64,76 72,90"/><path d="M50,6 46,34 58,56 M46,34 34,34 M42,56 50,64 58,56 M50,64 46,90" ${FACET}/>`,
    n: `<polygon points="26,90 32,78 36,56 24,44 36,24 58,10 78,32 70,44 58,40 54,52 62,78 70,90"/><path d="M58,10 52,30 70,44 M52,30 36,24 M52,30 44,48 54,52 M44,48 40,90" ${FACET}/><polygon points="58,26 64,28 60,32" ${LINE}/>`,
    p: `<polygon points="30,90 38,78 42,50 36,40 40,24 50,16 60,24 64,40 58,50 62,78 70,90"/><path d="M50,16 46,34 64,40 M46,34 36,40 M42,50 54,66 58,50 M54,66 48,90" ${FACET}/>`,
  },
  // Skulls; the headgear tells the pieces apart.
  kafatasi: {
    k: `${hat('<path d="M33 28 L32 6 L41 14 L50 4 L59 14 L68 6 L67 28 Z"/>')}<rect x="45" y="14" width="10" height="8" ${LINE}/>`,
    q: `${hat('<path d="M33 28 L28 12 L40 20 L50 8 L60 20 L72 12 L67 28 Z"/>')}<circle cx="28" cy="10" r="3.5" ${ACCENT}/><circle cx="50" cy="6" r="3.5" ${ACCENT}/><circle cx="72" cy="10" r="3.5" ${ACCENT}/>`,
    r: hat('<path d="M30 28 V10 H39 V17 H45 V10 H55 V17 H61 V10 H70 V28 Z"/>'),
    b: `${hat('<path d="M35 30 Q38 12 50 2 Q62 12 65 30 Z"/>')}<path d="M46 12 L54 22" style="fill: none; stroke: var(--line); stroke-width: 3"/>`,
    n: hat('<polygon points="38,28 38,10 43,20 47,4 50,18 53,4 57,20 62,10 62,28"/>'),
    p: skull,
  },
  // Neon tubes: lines only.
  tup: {
    k: '<path d="M28 88 H72 M37 88 V44 H63 V88 M35 44 L33 14 L43 24 L50 12 L57 24 L67 14 L65 44 M43 60 H57"/>',
    q: '<path d="M28 88 H72 M36 88 L40 44 H60 L64 88 M40 44 L28 16 L42 30 L50 10 L58 30 L72 16 L60 44"/><circle cx="28" cy="12" r="3"/><circle cx="50" cy="6" r="3"/><circle cx="72" cy="12" r="3"/>',
    r: '<path d="M28 88 H72 M36 88 V38 H64 V88 M32 38 V14 H41 V22 H46 V14 H54 V22 H59 V14 H68 V38"/>',
    b: '<path d="M30 88 H70 M40 88 L42 66 H58 L60 88 M42 66 Q30 50 40 34 Q46 24 50 18 Q54 24 60 34 Q70 50 58 66 M46 40 L56 30"/><circle cx="50" cy="11" r="4"/>',
    n: '<path d="M28 88 H72 M36 88 L38 64 Q26 56 32 40 Q40 22 58 18 Q74 22 76 42 L68 46 Q60 40 56 50 Q60 66 62 88"/><circle cx="56" cy="32" r="2.5"/>',
    p: '<path d="M32 88 H68 M40 88 Q42 62 50 56 Q58 62 60 88"/><circle cx="50" cy="40" r="13"/>',
  },
  // 8-bit pixels.
  piksel: {
    k: `<path d="M42 10h16v8h-16z M26 18h48v8h-48z M18 26h64v16h-64z M26 42h48v24h-48z M18 66h64v8h-64z M10 74h80v16h-80z"/><rect x="42" y="26" width="16" height="8" ${ACCENT}/>`,
    q: `<path d="M18 10h8v8h-8z M42 10h16v8h-16z M74 10h8v8h-8z M18 18h16v8h-16z M42 18h16v8h-16z M66 18h16v8h-16z M18 26h64v8h-64z M26 34h48v16h-48z M34 50h32v16h-32z M26 66h48v8h-48z M18 74h64v16h-64z"/><rect x="46" y="10" width="8" height="8" ${ACCENT}/>`,
    r: '<path d="M18 18h16v8h-16z M42 18h16v8h-16z M66 18h16v8h-16z M18 26h64v8h-64z M26 34h48v32h-48z M18 66h64v8h-64z M10 74h80v16h-80z"/>',
    b: '<path d="M42 10h16v8h-16z M34 18h32v8h-32z M26 26h48v8h-48z M26 34h24v8h-24z M58 34h16v8h-16z M26 42h48v8h-48z M34 50h32v8h-32z M42 58h16v8h-16z M26 66h48v8h-48z M18 74h64v16h-64z"/>',
    n: `<path d="M42 10h16v8h-16z M34 18h40v8h-40z M26 26h56v8h-56z M18 34h64v8h-64z M18 42h24v8h-24z M50 42h32v8h-32z M50 50h32v8h-32z M42 58h40v8h-40z M34 66h48v8h-48z M18 74h64v16h-64z"/><rect x="34" y="26" width="8" height="8" ${ACCENT}/>`,
    p: '<path d="M42 18h16v8h-16z M34 26h32v16h-32z M42 42h16v8h-16z M34 50h32v16h-32z M26 66h48v8h-48z M18 74h64v16h-64z"/>',
  },
  // Thick brush strokes (drawn twice: an outline, then the colour).
  firca: {
    k: '<path d="M30 86 H70 M40 78 V44 H60 V78 M36 34 L32 14 L44 24 L50 10 L56 24 L68 14 L64 34 Z"/>',
    q: '<path d="M30 86 H70 M40 76 L34 32 M60 76 L66 32 M34 32 Q50 46 66 32"/><circle cx="32" cy="20" r="3"/><circle cx="50" cy="14" r="3"/><circle cx="68" cy="20" r="3"/>',
    r: '<path d="M30 86 H70 M38 76 V40 M62 76 V40 M34 32 H66 M34 30 V16 M50 30 V16 M66 30 V16"/>',
    b: '<path d="M32 86 H68 M50 72 Q32 50 50 24 Q68 50 50 72 Z M50 12 V12"/>',
    n: '<path d="M30 86 H70 M40 76 Q38 58 30 50 Q38 26 62 22 Q74 32 70 44 Q60 40 56 50 Q60 64 62 76"/>',
    p: '<path d="M34 86 H66 M50 74 V58"/><circle cx="50" cy="40" r="11"/>',
  },
};

/**
 * The variant pieces in each drawn set, in the set's own style: the Bürokrat as a briefcase,
 * the Diplomat as a flag on a pole, the Jester as a three-pointed cap with bells.
 */
const VARIANT_DRAWINGS: Record<Drawn, Record<VariantKind, string>> = {
  sablon: {
    u: '<rect x="24" y="80" width="52" height="10"/><rect x="28" y="48" width="44" height="28"/><rect x="40" y="36" width="20" height="4"/><rect x="40" y="40" width="4" height="5"/><rect x="56" y="40" width="4" height="5"/><polygon points="62,30 80,6 72,30"/>',
    d: '<rect x="24" y="80" width="52" height="10"/><rect x="34" y="20" width="6" height="56"/><circle cx="37" cy="12" r="5"/><polygon points="44,18 78,22 70,31 78,40 44,40"/>',
    j: '<rect x="24" y="80" width="52" height="10"/><rect x="30" y="64" width="40" height="12"/><polygon points="36,60 50,18 64,60"/><polygon points="31,60 14,38 34,46"/><polygon points="69,60 86,38 66,46"/><circle cx="11" cy="33" r="5"/><circle cx="50" cy="10" r="5"/><circle cx="89" cy="33" r="5"/>',
  },
  mohawk: {
    u: `<polygon points="40,40 42,22 46,32 50,18 54,32 58,22 60,40" ${ACCENT}/><rect x="24" y="80" width="52" height="10" rx="4"/><rect x="38" y="36" width="24" height="12" rx="6"/><rect x="28" y="44" width="44" height="36" rx="8"/><rect x="46" y="56" width="8" height="7" ${LINE}/>`,
    d: `<polygon points="31,12 33,0 37,8 39,-2 41,8 45,0 46,12" ${ACCENT}/><rect x="24" y="80" width="52" height="10" rx="4"/><rect x="34" y="14" width="8" height="66" rx="4"/><circle cx="38" cy="14" r="6"/><path d="M42 20 Q60 10 78 22 V46 Q60 36 42 46 Z"/>`,
    j: `<rect x="24" y="80" width="52" height="10" rx="4"/><rect x="34" y="54" width="32" height="26" rx="8"/><path d="M32 58 Q20 32 10 42 Q14 22 34 36 Q40 16 50 10 Q60 16 66 36 Q86 22 90 42 Q80 32 68 58 Z"/><circle cx="10" cy="43" r="5" ${ACCENT}/><circle cx="50" cy="9" r="5" ${ACCENT}/><circle cx="90" cy="43" r="5" ${ACCENT}/>`,
  },
  zimbali: {
    u: `${studBase}<rect x="38" y="32" width="24" height="12"/><rect x="28" y="42" width="44" height="36" rx="2"/><rect x="44" y="36" width="12" height="6" ${LINE}/><circle cx="50" cy="58" r="4.5" ${ACCENT}/>${studs(
      [
        [34, 48],
        [66, 48],
        [34, 72],
        [66, 72],
      ],
    )}`,
    d: `${studBase}<rect x="34" y="14" width="8" height="64"/><circle cx="38" cy="10" r="5" ${ACCENT}/><rect x="42" y="16" width="36" height="28"/>${studs(
      [
        [52, 30],
        [62, 30],
        [72, 30],
      ],
    )}`,
    j: `${studBase}<polygon points="32,78 36,52 64,52 68,78"/><polygon points="30,52 18,24 38,38 50,10 62,38 82,24 70,52"/><circle cx="18" cy="21" r="4.5" ${ACCENT}/><circle cx="50" cy="8" r="4.5" ${ACCENT}/><circle cx="82" cy="21" r="4.5" ${ACCENT}/>${studs(
      [
        [40, 64],
        [50, 64],
        [60, 64],
      ],
    )}`,
  },
  damla: {
    u: `${dripBase}<path d="M30 72 V46 H70 V72 Z"/><path d="M40 46 V36 H60 V46 H55 V41 H45 V46 Z"/><path d="M60 46 V56 Q60 59 62.5 59 Q65 59 65 56 V46"/>`,
    d: `${dripBase}<rect x="34" y="14" width="6" height="58"/><circle cx="37" cy="10" r="5"/><path d="M40 16 H76 V40 H68 V48 Q68 51 65.5 51 Q63 51 63 48 V40 H52 V44 Q52 47 49.5 47 Q47 47 47 44 V40 H40 Z"/>`,
    j: `${dripBase}<path d="M36 72 L40 52 H60 L64 72 Z"/><path d="M34 54 L22 28 L40 40 L50 14 L60 40 L78 28 L66 54 Z"/><path d="M22 12 Q27 20 27 23 Q27 27 22 27 Q17 27 17 23 Q17 20 22 12 Z"/><path d="M50 0 Q55 8 55 11 Q55 15 50 15 Q45 15 45 11 Q45 8 50 0 Z"/><path d="M78 12 Q83 20 83 23 Q83 27 78 27 Q73 27 73 23 Q73 20 78 12 Z"/>`,
  },
  rozet: {
    u: inBadge(
      '<rect x="24" y="80" width="52" height="10"/><rect x="24" y="42" width="52" height="34" rx="3"/><path d="M38 42 V30 H62 V42 H56 V36 H44 V42 Z"/>',
    ),
    d: inBadge(
      '<rect x="24" y="80" width="52" height="10"/><rect x="28" y="10" width="8" height="70"/><path d="M36 12 Q56 2 78 14 V46 Q56 34 36 44 Z"/>',
    ),
    j: inBadge(
      '<rect x="24" y="80" width="52" height="10"/><polygon points="34,76 38,56 62,56 66,76"/><path d="M32 58 Q18 30 6 40 Q10 16 34 32 Q40 12 50 2 Q60 12 66 32 Q90 16 94 40 Q82 30 68 58 Z"/>',
    ),
  },
  kirik: {
    u: `<polygon points="24,90 30,78 26,46 40,44 42,32 58,32 60,44 74,46 70,78 76,90"/><path d="M26,46 50,60 74,46 M50,60 44,90 M42,32 50,44 58,32" ${FACET}/>`,
    d: `<polygon points="32,90 34,14 30,8 38,2 42,12 76,18 66,30 78,42 42,46 40,90"/><path d="M42,12 56,30 42,46 M56,30 76,18 M36,60 40,72" ${FACET}/>`,
    j: `<polygon points="26,90 32,78 36,56 20,24 40,40 50,4 60,40 80,24 64,56 68,78 74,90"/><path d="M40,40 50,56 60,40 M36,56 64,56 M50,56 46,90" ${FACET}/>`,
  },
  kafatasi: {
    u: hat('<path d="M24 30 H76 V25 H68 Q68 6 50 6 Q32 6 32 25 H24 Z"/>'),
    d: hat('<path d="M38 26 V2 H42 V4 H64 L58 10 L64 16 H42 V26 Z"/>'),
    j: `${hat('<path d="M32 30 Q22 16 12 22 Q16 6 36 16 Q42 4 50 0 Q58 4 64 16 Q84 6 88 22 Q78 16 68 30 Z"/>')}<circle cx="12" cy="23" r="3.5" ${LINE}/><circle cx="50" cy="2" r="3.5" ${LINE}/><circle cx="88" cy="23" r="3.5" ${LINE}/>`,
  },
  tup: {
    u: '<path d="M28 88 H72 M30 80 V48 H70 V80 Z M42 48 V40 H58 V48 M30 62 H70"/><circle cx="50" cy="62" r="3"/>',
    d: '<path d="M28 88 H72 M38 88 V12 M38 16 Q56 8 72 18 V42 Q56 34 38 42"/><circle cx="38" cy="8" r="3"/>',
    j: '<path d="M28 88 H72 M36 88 L40 60 H60 L64 88 M38 60 L24 32 L42 42 L50 16 L58 42 L76 32 L62 60"/><circle cx="22" cy="28" r="3"/><circle cx="50" cy="12" r="3"/><circle cx="78" cy="28" r="3"/>',
  },
  piksel: {
    u: `<path d="M34 26h32v8h-32z M34 34h8v8h-8z M58 34h8v8h-8z M26 42h48v32h-48z M18 74h64v16h-64z"/><rect x="42" y="50" width="16" height="8" ${ACCENT}/>`,
    d: `<path d="M26 2h24v8h-24z M34 10h8v64h-8z M42 18h32v8h-32z M42 26h40v8h-40z M42 34h32v8h-32z M26 74h48v8h-48z M18 82h64v8h-64z"/><rect x="50" y="26" width="16" height="8" ${ACCENT}/>`,
    j: `<path d="M42 18h16v8h-16z M18 26h8v8h-8z M34 26h32v8h-32z M74 26h8v8h-8z M18 34h64v8h-64z M26 42h48v8h-48z M34 50h32v16h-32z M26 66h48v8h-48z M18 74h64v16h-64z"/><rect x="10" y="18" width="8" height="8" ${ACCENT}/><rect x="82" y="18" width="8" height="8" ${ACCENT}/><rect x="42" y="10" width="16" height="8" ${ACCENT}/>`,
  },
  firca: {
    u: '<path d="M30 86 H70 M32 74 H68 V48 H32 Z M42 46 V38 H58 V46"/>',
    d: '<path d="M30 86 H70 M38 78 V14 M40 18 Q56 10 70 20 Q60 30 70 40 Q56 32 40 40"/>',
    j: '<path d="M30 86 H70 M40 76 V60 H60 V76 M36 58 L22 30 M36 58 L50 16 L64 58 L78 30"/><circle cx="20" cy="26" r="3"/><circle cx="50" cy="12" r="3"/><circle cx="80" cy="26" r="3"/>',
  },
};

/*
 * Tattooed sets: classic outlines (each piece easy to tell apart) with a texture on the body,
 * clipped to the piece. Drawn in three layers: the outline (the shapes in the line colour, a
 * thick stroke), the body, then the texture in the line and accent colours.
 */
type Tattooed = 'murekkep' | 'zincir';
const TATTOOED: readonly PieceSet[] = ['murekkep', 'zincir'];

const PEDESTAL =
  '<rect x="22" y="80" width="56" height="10" rx="3"/><rect x="28" y="73" width="44" height="9" rx="2"/>';
const CLASSIC: Record<Kind, string> = {
  u: `${PEDESTAL}<rect x="28" y="44" width="44" height="30" rx="3"/><path d="M40 46 V36 Q40 32 44 32 H56 Q60 32 60 36 V46 H55 V38 H45 V46 Z"/>`,
  d: `${PEDESTAL}<rect x="33" y="12" width="7" height="62" rx="1"/><circle cx="36.5" cy="9" r="5"/><path d="M40 16 Q56 8 74 18 V44 Q56 36 40 42 Z"/>`,
  j: `${PEDESTAL}<path d="M36 74 L40 56 H60 L64 74 Z"/><ellipse cx="50" cy="56" rx="16" ry="4"/><path d="M34 54 Q22 32 12 40 Q14 20 36 34 Q42 16 50 8 Q58 16 64 34 Q86 20 88 40 Q78 32 66 54 Z"/><circle cx="12" cy="42" r="4"/><circle cx="50" cy="7" r="4"/><circle cx="88" cy="42" r="4"/>`,
  p: '<rect x="26" y="80" width="48" height="10" rx="3"/><path d="M34 81 Q37 60 43 53 H57 Q63 60 66 81 Z"/><ellipse cx="50" cy="52" rx="13" ry="4"/><circle cx="50" cy="37" r="12"/>',
  r: `${PEDESTAL}<path d="M34 74 L37 41 H63 L66 74 Z"/><rect x="32" y="38" width="36" height="6" rx="1"/><rect x="29" y="26" width="42" height="14" rx="1"/><rect x="29" y="15" width="10" height="13"/><rect x="45" y="15" width="10" height="13"/><rect x="61" y="15" width="10" height="13"/>`,
  b: `${PEDESTAL}<path d="M38 74 Q40 61 44 56 H56 Q60 61 62 74 Z"/><ellipse cx="50" cy="55" rx="14" ry="4"/><path d="M50 18 Q67 32 61 47 Q57 52 50 52 Q43 52 39 47 Q33 32 50 18 Z"/><circle cx="50" cy="13" r="5"/>`,
  n: `${PEDESTAL}<path d="M31 74 Q30 58 40 50 Q45 46 43 42 L29 48 Q22 47 24 40 Q33 25 45 19 L47 9 L54 17 Q71 20 75 40 Q78 58 70 74 Z"/>`,
  q: `${PEDESTAL}<path d="M36 74 L40 47 H60 L64 74 Z"/><ellipse cx="50" cy="46" rx="15" ry="4"/><path d="M34 44 L27 19 L40 32 L50 13 L60 32 L73 19 L66 44 Z"/><circle cx="27" cy="16" r="4"/><circle cx="50" cy="10" r="4"/><circle cx="73" cy="16" r="4"/>`,
  k: `${PEDESTAL}<path d="M36 74 L40 47 H60 L64 74 Z"/><ellipse cx="50" cy="46" rx="15" ry="4"/><path d="M34 44 Q29 30 38 26 H62 Q71 30 66 44 Z"/><rect x="46" y="4" width="8" height="23" rx="1"/><rect x="39" y="10" width="22" height="7" rx="1"/>`,
};
const ink = (width: number, extra = '') =>
  `style="fill: none; stroke: var(--line); stroke-width: ${width}; stroke-linecap: round; stroke-linejoin: round${extra}"`;
const red = (width: number, extra = '') =>
  `style="fill: none; stroke: var(--accent); stroke-width: ${width}; stroke-linecap: round; stroke-linejoin: round${extra}"`;
const INK_FILL = 'style="fill: var(--line); stroke: none"';
const RED_FILL = 'style="fill: var(--accent); stroke: var(--line); stroke-width: 1"';
// What every tattooed set keeps so the piece reads at a glance: the bishop's slit, the knight's eye and mane.
const MARKS: Partial<Record<Kind, string>> = {
  u: `<path d="M28 58 H72" ${ink(1.4, '; opacity: .6')}/>`,
  b: `<path d="M55 28 L45 40" ${ink(3)}/>`,
  n: `<circle cx="45" cy="31" r="2.6" ${INK_FILL}/><path d="M52 20 Q64 30 66 48" ${ink(1.4, '; opacity: .6')}/>`,
};
// The middle of each body, where a tattoo sits.
const CHEST: Record<Kind, [number, number]> = {
  u: [50, 61],
  d: [58, 29],
  j: [50, 67],
  k: [50, 61],
  q: [50, 61],
  r: [50, 57],
  b: [50, 66],
  n: [57, 57],
  p: [50, 68],
};
// The neck, where the barbed wire runs.
const NECK: Record<Kind, number> = { k: 46, q: 46, r: 41, b: 55, n: 50, p: 52, u: 44, d: 30, j: 56 };

/** Each piece's flash tattoo: crossbones, rose, anchor, dagger, lightning, star. */
const FLASH: Record<Kind, string> = {
  // Bürokrat: a wax seal; Diplomat: a peace sign; Jester: a card diamond.
  u: `<circle r="5.5" ${RED_FILL}/><path d="M-2.5 0 H2.5 M0 -2.5 V2.5" ${ink(1.2)}/>`,
  d: `<circle r="6" ${ink(1.6)}/><path d="M0 -6 V6 M0 1 L-4.2 4.2 M0 1 L4.2 4.2" ${ink(1.6)}/>`,
  j: `<path d="M0 -7 L5 0 L0 7 L-5 0 Z" ${RED_FILL}/>`,
  k: `<path d="M-7 -7 L7 7 M7 -7 L-7 7" ${ink(2.2)}/>${[
    [-7, -7],
    [7, -7],
    [-7, 7],
    [7, 7],
  ]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" ${INK_FILL}/>`)
    .join('')}<circle cx="0" cy="-1" r="3.2" style="fill: var(--accent); stroke: none"/>`,
  q: `<circle r="6" style="fill: var(--accent); stroke: none"/><path d="M0 -3 Q3 -3 3 0 Q3 3 0 3 Q-3 3 -3 0 Q-3 -1.5 -1.5 -1.5" ${ink(1.2)}/><path d="M-6 4 Q-10 9 -4 10 M6 4 Q10 9 4 10" ${ink(1.6)}/>`,
  r: `<path d="M0 -8 V8 M-6 3 Q-6 9 0 9 Q6 9 6 3 M-4 -4 H4" ${ink(2)}/><circle cx="0" cy="-9.5" r="2" ${ink(1.4)}/><path d="M-6 3 l-2 -2 M6 3 l2 -2" ${red(1.6)}/>`,
  b: `<path d="M0 -9 V7" ${ink(2.4)}/><path d="M-5 -3 H5" ${red(2.2)}/><path d="M0 7 L-1.5 11 H1.5 Z" ${INK_FILL}/>`,
  n: `<path d="M2 -9 L-4 1 H2 L-2 10 L6 -2 H0 Z" ${RED_FILL}/>`,
  p: `<path d="M0 -6 L1.8 -1.9 L6 -1.9 L2.6 0.8 L3.8 5 L0 2.5 L-3.8 5 L-2.6 0.8 L-6 -1.9 L-1.8 -1.9 Z" ${RED_FILL}/>`,
};

/** Dotwork around the tattoo, the same for every game (a fixed seed per piece). */
function dotwork(kind: Kind): string {
  let s = kind.charCodeAt(0) * 7919;
  const next = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const [x, y] = CHEST[kind];
  let dots = '';
  for (let i = 0; i < 26; i++) {
    const a = next() * Math.PI * 2;
    const d = 9 + next() * 7;
    const r = 0.5 + next() * 0.5;
    dots += `<circle cx="${(x + Math.cos(a) * d).toFixed(1)}" cy="${(y + Math.sin(a) * d * 0.8).toFixed(1)}" r="${r.toFixed(2)}" style="fill: var(--line); stroke: none; opacity: .55"/>`;
  }
  return dots;
}

/** A chain across the body from the bottom left, barbed wire at the neck, rivets on the base. */
function chain(kind: Kind): string {
  const [x0, y0, x1, y1] = [22, 84, 80, 18];
  const links = 13;
  const angle = ((Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI).toFixed(1);
  let s = '';
  for (let i = 0; i <= links; i++) {
    const x = (x0 + ((x1 - x0) * i) / links).toFixed(1);
    const y = (y0 + ((y1 - y0) * i) / links).toFixed(1);
    const at = `transform="translate(${x} ${y}) rotate(${angle})"`;
    s +=
      i % 2
        ? `<rect x="-4.6" y="-1.3" width="9.2" height="2.6" rx="1.3" ${at} ${INK_FILL}/>`
        : `<ellipse rx="5" ry="3" ${at} ${ink(1.8)}/>`;
  }
  const y = NECK[kind];
  s += `<path d="M18 ${y} Q34 ${y - 3} 50 ${y} T82 ${y}" ${red(1.4)}/>`;
  for (let x = 24; x <= 76; x += 9)
    s += `<path d="M${x - 2} ${y - 3} L${x + 2} ${y + 3} M${x + 2} ${y - 3} L${x - 2} ${y + 3}" ${red(1.2)}/>`;
  for (let x = 30; x <= 70; x += 10)
    s += `<circle cx="${x}" cy="85" r="2" ${INK_FILL}/><circle cx="${x - 0.6}" cy="84.4" r=".7" style="stroke: none"/>`;
  return s;
}

const TATTOOS: Record<Tattooed, (kind: Kind) => string> = {
  murekkep: (kind) => {
    const [x, y] = CHEST[kind];
    return `${dotwork(kind)}<g transform="translate(${x} ${y})">${FLASH[kind]}</g><path d="M24 85 H76" ${ink(1.3, '; stroke-dasharray: 3 2.4')}/>`;
  },
  zincir: chain,
};

/** A tattooed piece; `id` names its clip path, so it must be unique on the page. */
function tattooedSvg(set: Tattooed, kind: Kind, id: string): string {
  const shapes = CLASSIC[kind];
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><clipPath id="${id}">${shapes}</clipPath></defs><g class="ol">${shapes}</g><g class="bd">${shapes}</g><g clip-path="url(#${id})">${TATTOOS[set](kind)}${MARKS[kind] ?? ''}</g></svg>`;
}

/*
 * Spray: classic pieces painted with a spray can. A soft glow under a sharp outline, then
 * drips, a scribbled doodle and spray dust in the spray colour (CSS: --spray, --wire, --dust).
 */
const f1 = (n: number) => Math.round(n * 10) / 10;
const ring = (cx: number, cy: number, r: number) =>
  `M${f1(cx - r)} ${f1(cy)}a${f1(r)} ${f1(r)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-2 * r)} 0`;
const drip = ([x, y, len]: [number, number, number]) => `M${x - 2} ${y}h4v${len}a2 2 0 0 1-4 0Z`;
const SPRAY_BASE = 'M20 90H80V85Q80 81 76 81H24Q20 81 20 85Z' + 'M26 81L29 75H71L74 81Z';
const barbs = (points: [number, number][]) =>
  points.map(([x, y]) => `M${x - 2} ${y - 2.5}L${x + 2} ${y + 2.5}M${x + 2} ${y - 2.5}L${x - 2} ${y + 2.5}`).join('');

/** The knight's mane: spikes along the back of the neck. */
function sprayMane(): string {
  let d = '';
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const x = (1 - t) * (1 - t) * 52 + 2 * (1 - t) * t * 78 + t * t * 74;
    const y = (1 - t) * (1 - t) * 22 + 2 * (1 - t) * t * 28 + t * t * 62;
    const dx = 2 * (1 - t) * 26 - 8 * t;
    const dy = 2 * (1 - t) * 6 + 68 * t;
    const len = Math.hypot(dx, dy);
    const [nx, ny, tx, ty] = [dy / len, -dx / len, dx / len, dy / len];
    const h = 10 + 5 * Math.sin(t * Math.PI);
    d += `M${f1(x - tx * 3.5 - nx * 3)} ${f1(y - ty * 3.5 - ny * 3)}L${f1(x + nx * h)} ${f1(y + ny * h)}L${f1(x + tx * 3.5 - nx * 3)} ${f1(y + ty * 3.5 - ny * 3)}Z`;
  }
  return d;
}

interface Sprayed {
  /** The piece's shapes (SVG elements). */
  shapes: string;
  shine?: string;
  lines?: string;
  wire?: string;
  /** Doodle on both colours, or [black, white]. */
  doodle?: string | [string, string];
  drips: [number, number, number][];
  mane?: boolean;
}
const p = (d: string) => `<path d="${d}"/>`;
const SPRAYED: Record<Kind, Sprayed> = {
  p: {
    shapes: p(
      SPRAY_BASE + 'M33 75Q35 64 43 59Q38 57 38 54H62Q62 57 57 59Q65 64 67 75Z' + 'M37 54H63V50H37Z' + ring(50, 39, 11),
    ),
    shine: 'M44 34Q46 31 49 30',
    doodle: 'M40 22L38 10L45 16L50 7L55 16L62 10L60 22Z',
    drips: [
      [41, 22, 3],
      [58, 22, 5],
      [30, 90, 4],
      [66, 90, 7],
    ],
  },
  r: {
    shapes: p(SPRAY_BASE + 'M34 75L36 42H64L66 75Z' + 'M30 42V22H38V28H45V22H55V28H62V22H70V42Z'),
    shine: 'M39 46V70',
    lines: 'M36 46H64',
    doodle: 'M42 66L41 56L46 60L50 53L54 60L59 56L58 66Z',
    drips: [
      [33, 42, 7],
      [67, 42, 4],
      [65, 70, 6],
      [28, 90, 6],
    ],
  },
  n: {
    shapes: p(SPRAY_BASE + 'M30 75Q32 66 40 60Q30 60 24 54Q20 48 26 43L42 28Q50 20 60 22Q76 28 74 54L72 75Z'),
    mane: true,
    shine: 'M45 30Q52 25 58 26',
    lines: 'M27 49L30 48' + ring(44, 36, 1.6),
    // An anarchy A on the black knight, an X on the white one.
    doodle: [ring(60, 62, 6.5) + 'M56 67L60 56L64 67M55.5 63H64.5', 'M55 56L66 68M66 56L55 68'],
    drips: [
      [29, 54, 7],
      [37, 60, 4],
      [70, 90, 6],
    ],
  },
  b: {
    shapes: p(
      SPRAY_BASE +
        'M33 75Q37 68 44 65Q37 60 38 50Q40 36 50 27Q60 36 62 50Q63 60 56 65Q63 68 67 75Z' +
        'M41 65H59V62H41Z' +
        ring(50, 22, 4),
    ),
    shine: 'M43 50Q43 42 48 36',
    doodle: 'M45 40L54 49M54 40L45 49',
    drips: [
      [47, 49, 9],
      [53, 49, 5],
      [28, 90, 4],
    ],
  },
  q: {
    shapes: p(
      SPRAY_BASE +
        'M31 75Q35 68 41 64L38 44H62L59 64Q65 68 69 75Z' +
        'M35 44H65V39H35Z' +
        'M35 39L29 16L40 29L44 10L50 25L56 10L60 29L71 16L65 39Z',
    ),
    shine: 'M42 48L44 66',
    doodle: 'M74 66L73 58L77 61L80 55L83 61L87 58L86 66Z',
    drips: [
      [36, 39, 9],
      [64, 39, 6],
      [44, 29, 4],
      [69, 90, 5],
    ],
  },
  // A round, arched crown (the queen's is spiked), with a knob on top and barbed wire.
  k: {
    shapes: p(
      SPRAY_BASE +
        'M35 69L36 75H64L65 69Z' +
        'M33 62H67V69H33Z' +
        'M33 62C20 54 18 36 32 34C40 33 46 40 50 48C54 40 60 33 68 34C82 36 80 54 67 62Z' +
        'M50 48C45 40 45 30 50 25C55 30 55 40 50 48Z' +
        ring(50, 21, 4),
    ),
    shine: 'M26 44Q25 50 29 55',
    lines: 'M36 65.5H64',
    wire:
      'M30 56Q50 50 70 56' +
      barbs([
        [36, 53.6],
        [44, 52],
        [52, 51.6],
        [60, 52.4],
        [66, 54.5],
      ]),
    drips: [
      [35, 69, 6],
      [65, 69, 4],
      [71, 90, 7],
    ],
  },
  // The variant pieces keep their classic outlines, with drips at the base.
  u: {
    shapes: CLASSIC.u,
    drips: [
      [30, 90, 5],
      [68, 90, 7],
    ],
  },
  d: {
    shapes: CLASSIC.d,
    drips: [
      [30, 90, 5],
      [68, 90, 7],
    ],
  },
  j: {
    shapes: CLASSIC.j,
    drips: [
      [30, 90, 5],
      [68, 90, 7],
    ],
  },
};

/** Spray dust scattered around a piece, the same every game (a fixed seed per piece). */
function sprayDust(kind: Kind): string {
  let s = kind.charCodeAt(0) * 7919;
  const next = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  let d = '';
  for (let i = 0; i < 16; i++) {
    const a = next() * Math.PI * 2;
    const r = 38 + next() * 10;
    d += ring(50 + Math.cos(a) * r, 55 + Math.sin(a) * r * 0.85, 0.5 + next() * 0.9);
  }
  return d;
}

function spraySvg(kind: Kind): string {
  const s = SPRAYED[kind];
  const path = (cls: string, d: string | undefined) => (d ? `<path class="${cls}" d="${d}"/>` : '');
  const [black, white] = typeof s.doodle === 'string' ? [s.doodle, s.doodle] : (s.doodle ?? ['', '']);
  return (
    '<svg viewBox="0 0 100 100" aria-hidden="true">' +
    `<g class="gl">${s.shapes}</g>` +
    path('mn', s.mane ? sprayMane() : undefined) +
    `<g class="bd">${s.shapes}</g>` +
    path('sh', s.shine) +
    path('ln', s.lines) +
    path('wu', s.wire) +
    path('wr', s.wire) +
    (black === white ? path('dd', black) : path('dd db', black) + path('dd dw', white)) +
    path('dr', s.drips.map(drip).join('')) +
    path('du', sprayDust(kind)) +
    '</svg>'
  );
}

/*
 * Brutal: chunky faceted pieces, straight lines only. A hard pink slab behind each piece,
 * one side shaded with halftone grain, and pink slashes and doodles (CSS: --slab, --shade).
 */
const B_BASE = 'M20 90L22 82H78L80 90Z' + 'M27 82L30 76H70L73 82Z';
interface Brutal {
  /** The piece's shapes (SVG elements). */
  shapes: string;
  lines?: string;
  doodle?: string;
  drips?: [number, number, number][];
  mane?: boolean;
}
const BRUTAL: Record<Kind, Brutal> = {
  p: {
    shapes: p(
      B_BASE +
        'M34 76L38 66L44 58H56L62 66L66 76Z' +
        'M38 58L40 53H60L62 58Z' +
        'M44 29H56L61 34V46L56 51H44L39 46V34Z',
    ),
    doodle: 'M40 23L38 11L45 17L50 8L55 17L62 11L60 23Z',
  },
  r: {
    shapes: p(B_BASE + 'M34 76L36 44H64L66 76Z' + 'M30 44V22H39V29H46V22H54V29H61V22H70V44Z'),
    lines: 'M35 49H65',
    doodle: 'M44 71L43 60L48 64L52 57L56 64L61 60L60 71Z',
    drips: [[64, 76, 9]],
  },
  n: {
    shapes: p(B_BASE + 'M30 76L34 62L44 55L26 54L20 46L36 30L44 18L50 26L62 22L74 36L76 58L72 76Z'),
    mane: true,
    lines: 'M38 37L45 35L42 40Z' + 'M24 47L28 46',
    doodle: 'M53 54L66 69M66 54L53 69',
    drips: [[31, 62, 7]],
  },
  b: {
    shapes: p(
      B_BASE + 'M36 76L42 62L44 55H56L58 62L64 76Z' + 'M40 55L42 50H58L60 55Z' + 'M50 12L62 32L56 50H44L38 32Z',
    ),
    lines: 'M50 18V40',
    doodle: 'M58 64L66 46',
  },
  q: {
    shapes: p(
      B_BASE +
        'M33 76L40 58L42 47H58L60 58L67 76Z' +
        'M36 47L38 42H62L64 47Z' +
        'M34 42L28 14L40 28L44 8L50 24L56 8L60 28L72 14L66 42Z',
    ),
    doodle: 'M39 73L56 54M46 75L60 59',
  },
  // The king's crown: two broad arches and a middle peak (the queen's is all spikes), a knob on top.
  k: {
    shapes: p(
      B_BASE +
        'M35 69L36 76H64L65 69Z' +
        'M33 62H67V69H33Z' +
        'M33 62L22 52V40L30 34L40 36L50 48L60 36L70 34L78 40V52L67 62Z' +
        'M50 48L44 37L50 25L56 37Z' +
        'M50 14L55 19.5L50 25L45 19.5Z',
    ),
    lines: 'M36 65.5H64',
    doodle: 'M40 75L62 56',
    drips: [[66, 69, 6]],
  },
  u: { shapes: CLASSIC.u },
  d: { shapes: CLASSIC.d },
  j: { shapes: CLASSIC.j },
};

/** Halftone grain for the shaded side, the same every game (a fixed seed per piece). */
function grain(kind: Kind): string {
  let s = kind.charCodeAt(0) * 104729;
  const next = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  let d = '';
  for (let i = 0; i < 70; i++) d += ring(52 + next() * 30, 8 + next() * 84, 0.35 + next() * 0.75);
  return d;
}

/** A brutal piece; `id` names its clip path, so it must be unique on the page. */
function brutalSvg(kind: Kind, id: string): string {
  const b = BRUTAL[kind];
  const path = (cls: string, d: string | undefined) => (d ? `<path class="${cls}" d="${d}"/>` : '');
  return (
    `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><clipPath id="${id}">${b.shapes}</clipPath></defs>` +
    `<g class="sl" transform="translate(-4 3)">${b.shapes}${path('', b.mane ? sprayMane() : undefined)}</g>` +
    path('mn', b.mane ? sprayMane() : undefined) +
    `<g class="bd">${b.shapes}</g>` +
    `<g clip-path="url(#${id})"><rect class="fl" x="0" y="0" width="50" height="100"/><rect class="fr" x="50" y="0" width="50" height="100"/>` +
    `${path('gr', grain(kind))}</g>` +
    path('ln', b.lines) +
    path('dd', b.doodle) +
    path('dr', b.drips?.map(drip).join('')) +
    '</svg>'
  );
}

const KIND_OF_GLYPH: Record<string, Kind> = { '♚': 'k', '♛': 'q', '♜': 'r', '♝': 'b', '♞': 'n', '♟': 'p' };

/**
 * The SVG of a standard piece in `set`, or null when the set (or the glyph) has no drawing.
 * `id` is unique on the page (the tattooed sets clip their texture with it).
 */
export function pieceSvg(set: PieceSet, glyph: string, id = `pc-${set}`): string | null {
  const kind = KIND_OF_GLYPH[glyph.charAt(0)];
  return kind ? drawing(set, kind, id) : null;
}

/** A variant piece (Bürokrat, Diplomat, Jester; by piece type) in `set`, or null for the font set or other pieces. */
export function variantPieceSvg(set: PieceSet, type: string, id = `pc-${set}`): string | null {
  return VARIANT_KINDS.includes(type) ? drawing(set, type as VariantKind, id) : null;
}

function drawing(set: PieceSet, kind: Kind, id: string): string | null {
  if (set === 'glyph') return null;
  if (TATTOOED.includes(set)) return tattooedSvg(set as Tattooed, kind, `${id}-${kind}`);
  if (set === 'sprey') return spraySvg(kind);
  if (set === 'brutal') return brutalSvg(kind, `${id}-${kind}`);
  const drawn = set as Drawn;
  const body = kind === 'u' || kind === 'd' || kind === 'j' ? VARIANT_DRAWINGS[drawn][kind] : DRAWINGS[drawn][kind];
  const inner = drawn === 'firca' ? `<g class="o">${body}</g><g class="m">${body}</g>` : body;
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${inner}</svg>`;
}

// The chosen set, shared with every piece on the page (set from the prefs).
let current: PieceSet = 'glyph';
const listeners = new Set<() => void>();

export function setPieceSet(set: PieceSet): void {
  if (set === current) return;
  current = set;
  for (const l of listeners) l();
}

export function usePieceSet(): PieceSet {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
}
