// The character's poses in a game (src/avatar/poses.ts): the same in every browser, a new
// thinking pose every 5–6 moves, the result taken as a win, a loss or a draw.

import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR } from '../src/avatar/avatar.ts';
import { bodyGeom } from '../src/avatar/body.ts';
import { figureSvg } from '../src/avatar/figure.ts';
import { EMPTY_OUTFIT } from '../src/avatar/outfit.ts';
import { LOSSES, POSES, THINKING, WINS, endPose, framesOf, poseAt, posedGeom, seedOf } from '../src/avatar/poses.ts';

describe('oyun içi pozlar', () => {
  it('ayakta başlar; 10–12 yarım hamlede bir yeni bir düşünme pozuna geçer, aynısını üst üste tekrarlamaz', () => {
    const seed = seedOf('AbCd1234');
    for (const color of ['w', 'b'] as const) {
      expect(poseAt(seed, color, 0)).toBe('idle');
      expect(poseAt(seed, color, 9)).toBe('idle');
      let last = 'idle';
      let since = 0;
      for (let ply = 1; ply <= 200; ply++) {
        const p = poseAt(seed, color, ply);
        since++;
        if (p !== last) {
          expect(THINKING).toContain(p);
          expect(since).toBeGreaterThanOrEqual(10);
          expect(since).toBeLessThanOrEqual(12);
          last = p;
          since = 0;
        }
      }
    }
    // Every browser works out the same.
    expect(poseAt(seedOf('AbCd1234'), 'w', 57)).toBe(poseAt(seed, 'w', 57));
  });

  it('oyun sonu: kazanan sevinir, kaybeden üzülür, beraberlikte ikisi de omuz silker', () => {
    const seed = seedOf('game');
    expect(WINS).toContain(endPose(seed, 'w', 'w'));
    expect(LOSSES).toContain(endPose(seed, 'b', 'w'));
    expect(endPose(seed, 'w', null)).toBe('shrug');
  });

  it('her poz her vücut tipinde kolları değiştirir; poz yokken figür eskisi gibi çizilir', () => {
    for (const body of ['slim', 'mid', 'broad', 'curvy']) {
      const g = bodyGeom(body);
      for (const id of Object.keys(POSES)) {
        for (let f = 0; f < framesOf(id); f++) {
          const posed = posedGeom(g, id, f);
          if (id === 'idle') expect(posed).toBe(g);
          else expect(posed.armL !== g.armL || posed.armR !== g.armR).toBe(true);
        }
      }
    }
    expect(posedGeom(bodyGeom('mid'), 'pockets').hands).toEqual([]);
    const plain = figureSvg(DEFAULT_AVATAR, EMPTY_OUTFIT);
    expect(plain).not.toContain('fig-body');
    const cross = figureSvg(DEFAULT_AVATAR, { ...EMPTY_OUTFIT, jacket: 'leather' }, undefined, 'cross');
    expect(cross).toContain('class="fig-body"');
    expect(cross).toContain('class="fig-head"');
  });
});
