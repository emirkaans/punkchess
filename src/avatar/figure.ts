// The full-body character for the store (src/ui/StorePage.tsx): the character's head (with its
// hat and glasses) on a body wearing the outfit's jacket, trousers and neck accessory. 200×360.
// Pure: no DOM.

import { avatarSvg, skinColor } from './avatar.ts';
import type { Avatar } from './avatar.ts';
import { isHeadAcc } from './more.ts';
import { bodyGeom, bootsSvg } from './body.ts';
import { shoesSvg } from './shoes.ts';
import { handsSvg, jacketSvg, neckAccessorySvg, pantsSvg, skirtSvg } from './outfit.ts';
import type { Outfit, OutfitSlot } from './outfit.ts';
import { POSES, posedGeom } from './poses.ts';

const FULL = '0 0 200 360';

/**
 * The whole figure; `view` crops it (for item pictures: the head, the body, the legs). With a
 * `pose` (src/avatar/poses.ts, its frame `frame`) the arms take it, and the body and the head come
 * in groups the game's animations move (classes fig-body, fig-head).
 */
export function figureSvg(avatar: Avatar, outfit: Outfit, view = FULL, pose?: string, frame = 0): string {
  const skin = skinColor(avatar);
  const g = pose ? posedGeom(bodyGeom(avatar.body), pose, frame) : bodyGeom(avatar.body);
  const head = avatarSvg(avatar, outfit)
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '');
  // A skirt without trousers: bare legs under it.
  // Shoes from the shoe shop take the plain boots' place: over the trouser legs, under a skirt.
  const shoes = shoesSvg(outfit.shoes, g);
  const trousers = pantsSvg(outfit.pants ?? (outfit.skirt ? 'bare' : null), skin, g);
  const legs = (shoes ? trousers.replace(bootsSvg(g, '#141016'), '') + shoes : trousers) + skirtSvg(outfit.skirt, g);
  const headSvg = `<svg x="40" y="2" width="120" height="120" viewBox="0 0 200 200" overflow="visible">${head}</svg>`;
  if (pose) {
    // Arms in front: the jacket again without its body, over everything (a hand on the chin too).
    const front = POSES[pose]?.front ? jacketSvg(outfit.jacket, skin, { ...g, torso: 'M0 0Z' }) : '';
    return (
      `<svg viewBox="${view}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" overflow="visible"><g class="fig-body">` +
      jacketSvg(outfit.jacket, skin, g) +
      legs +
      handsSvg(skin, g) +
      `<g class="fig-head">${headSvg}</g>` +
      neckAccessorySvg(outfit.neck) +
      front +
      `</g></svg>`
    );
  }
  return (
    `<svg viewBox="${view}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    // The top first, the trousers or skirt over it (whatever the top), the hands over both.
    jacketSvg(outfit.jacket, skin, g) +
    legs +
    handsSvg(skin, g) +
    headSvg +
    // Neckwear after the head, or the neck would hide a collar.
    neckAccessorySvg(outfit.neck) +
    `</svg>`
  );
}

/** Where an item shows best on the figure: the head for hats and glasses, else the body or legs. */
export function itemView(slot: OutfitSlot, id: string): string {
  if (slot === 'hat' || slot === 'eyewear' || slot === 'acc' || isHeadAcc(id)) return '30 0 140 130';
  if (slot === 'tattooFace') return '60 50 80 60';
  if (slot === 'tattooNeck') return '74 94 52 34';
  if (slot === 'neck') return '40 70 120 120';
  if (slot === 'shoes') return '48 266 104 86';
  if (slot === 'pants') return '20 220 160 140';
  if (slot === 'skirt') return '20 180 160 160';
  return '20 90 160 160';
}
