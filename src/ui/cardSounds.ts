// A sound for every Anarşi card, played instead of the move sound when the card is played.
// Made in code with the Web Audio API like the other sounds (no audio files).

type Wave = OscillatorType;
type Out = AudioNode;

let noise: AudioBuffer | null = null;

/** Two seconds of white noise, made once, looped. */
function noiseSource(ac: BaseAudioContext): AudioBufferSourceNode {
  if (!noise || noise.sampleRate !== ac.sampleRate) {
    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  return src;
}

/** A gain rising to `peak` over `attack`, then falling to silence by `len`. */
function envelope(ac: BaseAudioContext, out: Out, t: number, peak: number, attack: number, len: number): GainNode {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  g.connect(out);
  return g;
}

/** One oscillator gliding from f0 to f1. */
function tone(
  ac: BaseAudioContext,
  out: Out,
  type: Wave,
  f0: number,
  f1: number,
  t: number,
  len: number,
  vol: number,
  attack = 0.005,
): OscillatorNode {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + len);
  o.connect(envelope(ac, out, t, vol, attack, len));
  o.start(t);
  o.stop(t + len + 0.05);
  return o;
}

/** Filtered noise, the filter sweeping from f0 to f1. */
function hiss(
  ac: BaseAudioContext,
  out: Out,
  type: BiquadFilterType,
  f0: number,
  f1: number,
  q: number,
  t: number,
  len: number,
  vol: number,
  attack = 0.01,
) {
  const src = noiseSource(ac);
  const f = ac.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + len);
  src.connect(f).connect(envelope(ac, out, t, vol, attack, len));
  src.start(t, Math.random());
  src.stop(t + len + 0.05);
}

/** A slow wobble on an oscillator's pitch. */
function wobble(ac: BaseAudioContext, o: OscillatorNode, t: number, len: number, rate: number, depth: number) {
  const lfo = ac.createOscillator();
  const g = ac.createGain();
  lfo.frequency.value = rate;
  g.gain.value = depth;
  lfo.connect(g).connect(o.frequency);
  lfo.start(t);
  lfo.stop(t + len);
}

const thud = (ac: BaseAudioContext, out: Out, t: number, f = 120, vol = 0.7) => {
  tone(ac, out, 'sine', f, f * 0.4, t, 0.18, vol, 0.003);
  hiss(ac, out, 'lowpass', 900, 300, 0.7, t, 0.06, vol * 0.5, 0.002);
};
const click = (ac: BaseAudioContext, out: Out, t: number, f = 3000, vol = 0.3) =>
  hiss(ac, out, 'bandpass', f, f, 6, t, 0.03, vol, 0.001);
const bell = (ac: BaseAudioContext, out: Out, t: number, f: number, vol = 0.18, len = 0.8) => {
  tone(ac, out, 'sine', f, f, t, len, vol, 0.003);
  tone(ac, out, 'sine', f * 2.76, f * 2.76, t, len * 0.4, vol * 0.3, 0.002);
};
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
/** A low-pass in front of `out`: soft sounds with no sharp highs. */
const soft = (ac: BaseAudioContext, out: Out) => {
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 3200;
  f.connect(out);
  return f;
};

type Sound = (ac: BaseAudioContext, out: Out, t: number) => void;

/** Each card's sound and its level (brings them all to about the same loudness). */
const SOUNDS: Readonly<Record<string, readonly [number, Sound]>> = {
  // Kara Delik — Emme: a sweep down into the hole, a muffled thump.
  void: [
    0.85,
    (ac, out, t) => {
      tone(ac, out, 'sine', 700, 40, t, 0.9, 0.35, 0.02);
      hiss(ac, out, 'bandpass', 3000, 200, 3, t, 0.85, 0.25, 0.3);
      thud(ac, out, t + 0.85, 70, 0.6);
    },
  ],
  // Piyon Avı — Nişangah: lock-on beeps and a shot, for each pawn.
  pawn: [
    0.53,
    (ac, out, t) => {
      for (const x of [0, 0.5]) {
        tone(ac, out, 'square', 1800, 1800, t + x, 0.05, 0.07);
        tone(ac, out, 'square', 2400, 2400, t + x + 0.09, 0.05, 0.07);
        hiss(ac, out, 'highpass', 2500, 1200, 0.7, t + x + 0.22, 0.12, 0.45, 0.001);
        thud(ac, out, t + x + 0.22, 160, 0.4);
      }
    },
  ],
  // Buz — Kırağı: crystal glitter and a thin crack of ice.
  ice: [
    1.22,
    (ac, out, t) => {
      for (let i = 0; i < 9; i++) bell(ac, out, t + i * 0.05 + rnd(0, 0.03), rnd(2200, 4200), 0.06, 0.4);
      hiss(ac, out, 'highpass', 4000, 4000, 1, t + 0.5, 0.05, 0.3, 0.001);
      click(ac, out, t + 0.53, 5000, 0.2);
    },
  ],
  // Işınlanma — Işın: a wavering tone shoots up, then a pop each way.
  swap: [
    1.55,
    (ac, out, t) => {
      wobble(ac, tone(ac, out, 'sine', 300, 1600, t, 0.5, 0.2, 0.05), t, 0.55, 18, 40);
      tone(ac, out, 'sine', 900, 1800, t + 0.5, 0.08, 0.3, 0.002);
      tone(ac, out, 'sine', 1800, 900, t + 0.6, 0.08, 0.25, 0.002);
    },
  ],
  // Kalkan — Baloncuk: a soft rising "bwoop" with a shimmer.
  shield: [
    1.29,
    (ac, out, t) => {
      tone(ac, out, 'sine', 220, 660, t, 0.35, 0.35, 0.03);
      tone(ac, out, 'triangle', 440, 1320, t + 0.02, 0.35, 0.08, 0.03);
      for (let i = 0; i < 5; i++) bell(ac, out, t + 0.3 + i * 0.06, 1800 + i * 300, 0.05, 0.4);
    },
  ],
  // Barikat — Şerit: the tape zips taut, three clicks.
  wall: [
    1.36,
    (ac, out, t) => {
      hiss(ac, out, 'bandpass', 900, 3500, 5, t, 0.35, 0.3, 0.02);
      for (const x of [0.42, 0.52, 0.62]) {
        click(ac, out, t + x, 2200, 0.35);
        tone(ac, out, 'sine', 200, 120, t + x, 0.08, 0.3, 0.002);
      }
    },
  ],
  // Diriliş — Topraktan: a rumble underground, a rush up, a bright bell.
  revive: [
    1.32,
    (ac, out, t) => {
      tone(ac, out, 'sine', 50, 70, t, 0.5, 0.35, 0.1);
      hiss(ac, out, 'bandpass', 300, 2500, 2, t + 0.15, 0.45, 0.25, 0.2);
      bell(ac, out, t + 0.55, 1320, 0.2, 0.9);
    },
  ],
  // Sürgün — Fırlatma: a springy "boing", then the landing.
  exile: [
    0.92,
    (ac, out, t) => {
      wobble(ac, tone(ac, out, 'triangle', 200, 600, t, 0.5, 0.25, 0.005), t, 0.5, 14, 120);
      thud(ac, out, t + 0.7, 150, 0.5);
    },
  ],
  // Ateşkes — Damga: a stamp comes down, a deep gong.
  truce: [
    0.63,
    (ac, out, t) => {
      thud(ac, out, t, 140, 0.7);
      [1, 1.48, 2.1].forEach((m, i) =>
        tone(ac, out, 'sine', 110 * m, 110 * m * 0.98, t + 0.05, 1.4 - i * 0.3, 0.15 / (i + 1), 0.01),
      );
    },
  ],
  // Mayın — Kurma: ratchet clicks speeding up, two rising tones: armed.
  mine: [
    2.25,
    (ac, out, t) => {
      for (let i = 0; i < 6; i++) click(ac, out, t + i * (0.09 - i * 0.008), 2600, 0.3);
      tone(ac, out, 'sine', 880, 880, t + 0.5, 0.08, 0.2);
      tone(ac, out, 'sine', 1320, 1320, t + 0.6, 0.12, 0.2);
    },
  ],
  // Zaman Hırsızı — Saat: ticking that speeds up, then a bell.
  time: [
    1.6,
    (ac, out, t) => {
      let x = 0;
      for (let i = 0; i < 8; i++) {
        click(ac, out, t + x, i % 2 ? 2200 : 2800, 0.3);
        x += 0.12 - i * 0.011;
      }
      bell(ac, out, t + x + 0.05, 1568, 0.22, 1);
    },
  ],
  // Pusu — Tuzak Kapağı: a creaking trapdoor, the fall, the lid slams.
  ambush: [
    0.71,
    (ac, out, t) => {
      tone(ac, out, 'sawtooth', 300, 180, t, 0.3, 0.05, 0.05);
      hiss(ac, out, 'bandpass', 1800, 400, 2, t + 0.3, 0.25, 0.2, 0.02);
      thud(ac, out, t + 0.6, 100, 0.7);
      click(ac, out, t + 0.6, 900, 0.3);
    },
  ],
  // Hain — Boya: paint drips falling.
  traitor: [
    1.5,
    (ac, out, t) => {
      [0, 0.13, 0.26, 0.42].forEach((x, i) =>
        tone(ac, out, 'sine', 900 - i * 120, 300 - i * 30, t + x, 0.1, 0.3, 0.003),
      );
    },
  ],
  // Nitro — Hız Geçişi: a soft "zoom" going past and away.
  nitro: [
    1.31,
    (ac, out0, t) => {
      const out = soft(ac, out0);
      tone(ac, out, 'sine', 520, 240, t, 0.7, 0.22, 0.25);
      tone(ac, out, 'triangle', 260, 120, t, 0.7, 0.08, 0.25);
      hiss(ac, out, 'bandpass', 600, 1800, 2, t, 0.35, 0.15, 0.25);
      hiss(ac, out, 'bandpass', 1800, 500, 2, t + 0.35, 0.4, 0.12, 0.02);
    },
  ],
  // Rütbe Düşürme — Düşüş: a trombone going "wah wah waaah".
  demote: [
    3.46,
    (ac, out, t) => {
      for (const [f, x] of [
        [392, 0],
        [370, 0.22],
        [349, 0.44],
      ]) {
        const o = ac.createOscillator();
        const fl = ac.createBiquadFilter();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(f, t + x);
        fl.type = 'lowpass';
        fl.frequency.setValueAtTime(500, t + x);
        fl.frequency.linearRampToValueAtTime(1400, t + x + 0.08);
        fl.frequency.linearRampToValueAtTime(500, t + x + 0.2);
        o.connect(fl).connect(envelope(ac, out, t + x, 0.15, 0.02, 0.2));
        o.start(t + x);
        o.stop(t + x + 0.25);
      }
      tone(ac, out, 'sawtooth', 330, 250, t + 0.66, 0.55, 0.12, 0.02);
    },
  ],
  // Deprem — Fay Kırılması: a far rumble, rock snapping, rubble falling.
  quake: [
    1.06,
    (ac, out0, t) => {
      const out = soft(ac, out0);
      tone(ac, out, 'sine', 40, 34, t, 1.3, 0.35, 0.2);
      hiss(ac, out, 'lowpass', 200, 120, 0.7, t, 1.3, 0.3, 0.2);
      hiss(ac, out, 'lowpass', 1600, 400, 0.8, t + 0.35, 0.18, 0.35, 0.002);
      tone(ac, out, 'sine', 90, 45, t + 0.35, 0.3, 0.3, 0.004);
      for (let i = 0; i < 14; i++) {
        const x = t + 0.5 + i * 0.045 + rnd(0, 0.03);
        hiss(ac, out, 'bandpass', rnd(500, 1300), rnd(400, 1000), 4, x, 0.04, 0.12 * (1 - i / 16), 0.002);
      }
    },
  ],
};

/** Plays card `id`'s sound at `start`; false when the card has none. */
export function playCardSound(ac: BaseAudioContext, id: string, start: number): boolean {
  const sound = SOUNDS[id];
  if (!sound) return false;
  const [level, play] = sound;
  const out = ac.createGain();
  out.gain.value = level * 0.75;
  out.connect(ac.destination);
  play(ac, out, start);
  return true;
}

/** Whether card `id` has a sound of its own. */
export const hasCardSound = (id: string): boolean => id in SOUNDS;
