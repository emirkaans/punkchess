// A shop's storefront (the street menu and the street page): an awning in the shop's colour, a
// window with its sign, a door; a closed shop is dim, its door behind a rolled-down shutter.
// A 120×110 SVG; pure (a string).

const esc = (s: string) => s.replace(/[<&"]/g, '');

export function storefront(color: string, sign: string, closed: boolean, soon = ''): string {
  const stripes = [0, 1, 2, 3, 4, 5]
    .map((i) => `<path d="M${10 + i * 18} 20h9l-2 10h-9z" fill="${i % 2 ? '#f1eee8' : color}"/>`)
    .join('');
  const shutter = closed
    ? `<rect x="72" y="40" width="34" height="66" fill="#3a3640"/>${[46, 54, 62, 70, 78, 86, 94, 102].map((y) => `<path d="M72 ${y}h34" stroke="#232027" stroke-width="2"/>`).join('')}` +
      (soon
        ? `<text x="89" y="76" text-anchor="middle" font-family="Space Mono, monospace" font-size="6" fill="#a3a0a8">${esc(soon)}</text>`
        : '')
    : `<rect class="sf-door" x="73" y="41" width="32" height="64" fill="${color}" opacity=".12"/>`;
  return (
    `<svg viewBox="0 0 120 110" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g opacity="${closed ? 0.55 : 1}">` +
    `<rect x="6" y="20" width="108" height="86" fill="#1f1b24" stroke="#0a0a0b" stroke-width="3"/>` +
    `<path d="M2 20h116l-8-14H10z" fill="${color}" stroke="#0a0a0b" stroke-width="3"/>${stripes}` +
    `<rect x="14" y="40" width="50" height="42" fill="#2b2532" stroke="#0a0a0b" stroke-width="3"/>` +
    `<rect x="72" y="40" width="34" height="66" fill="#141016" stroke="#0a0a0b" stroke-width="3"/>` +
    `<circle cx="100" cy="74" r="2.5" fill="${color}"/>` +
    `<text x="39" y="66" text-anchor="middle" font-family="Sedgwick Ave, Permanent Marker, cursive" font-size="13" fill="${color}">${esc(sign)}</text>` +
    shutter +
    `</g></svg>`
  );
}
