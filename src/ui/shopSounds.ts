// A sound for each shop on Punk Street, played as the player walks in, and one for the street.
// Made in code with the Web Audio API like the other sounds (no audio files).

/** The shops with a sound of their own, and the street itself. */
export type Shop = 'store' | 'barber' | 'shoes' | 'tattoo' | 'street';

let noise: AudioBuffer | null = null;

/** Two seconds of white noise, made once. */
function noiseSource(ac: BaseAudioContext): AudioBufferSourceNode {
  if (!noise || noise.sampleRate !== ac.sampleRate) {
    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource();
  src.buffer = noise;
  return src;
}

/** A gain rising to `peak` over `attack`, then falling to silence by `len`. */
function envelope(ac: BaseAudioContext, out: AudioNode, t: number, peak: number, attack: number, len: number) {
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
  out: AudioNode,
  type: OscillatorType,
  f0: number,
  f1: number,
  t: number,
  len: number,
  vol: number,
  attack = 0.004,
) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + len);
  o.connect(envelope(ac, out, t, vol, attack, len));
  o.start(t);
  o.stop(t + len + 0.05);
}

/** Filtered noise, the filter sweeping from f0 to f1. */
function hiss(
  ac: BaseAudioContext,
  out: AudioNode,
  type: BiquadFilterType,
  f0: number,
  f1: number,
  q: number,
  t: number,
  len: number,
  vol: number,
) {
  const src = noiseSource(ac);
  const f = ac.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + len);
  src.connect(f);
  f.connect(envelope(ac, out, t, vol, 0.003, len));
  src.start(t);
  src.stop(t + len + 0.05);
}

/** A small bell: inharmonic partials, the high ones dying first. */
function bell(ac: BaseAudioContext, out: AudioNode, f: number, t: number, len: number, vol: number) {
  [
    [1, 1],
    [2.76, 0.5],
    [5.4, 0.25],
    [8.9, 0.12],
  ].forEach(([m, v], i) => tone(ac, out, 'sine', f * m, f * m, t, len / (1 + i * 0.8), vol * v, 0.002));
}

/** The parlour: a tattoo machine's coil buzzing for a moment, rising as it starts. */
function tattooMachine(ac: BaseAudioContext, out: AudioNode, t: number) {
  const len = 0.6;
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1400;
  f.Q.value = 1.5;
  f.connect(out);
  const coil = ac.createOscillator();
  coil.type = 'sawtooth';
  coil.frequency.setValueAtTime(90, t);
  coil.frequency.exponentialRampToValueAtTime(150, t + 0.12);
  coil.connect(envelope(ac, f, t, 0.3, 0.04, len));
  coil.start(t);
  coil.stop(t + len + 0.05);
  // The needle's tick on every stroke.
  hiss(ac, out, 'highpass', 6000, 6000, 0.7, t, len, 0.05);
}

/** The street: a car passes from left to right over the city's hum, its engine falling in pitch. */
function passingCar(ac: BaseAudioContext, out: AudioNode, t: number) {
  const pan = ac.createStereoPanner();
  pan.connect(out);
  pan.pan.setValueAtTime(-0.9, t);
  pan.pan.linearRampToValueAtTime(0.9, t + 1.3);
  // Loudest as it passes, in the middle.
  const swell = (vol: number) => {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.65);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.35);
    g.connect(pan);
    return g;
  };
  // The tyres on the asphalt.
  const tyres = noiseSource(ac);
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 0.7;
  f.frequency.setValueAtTime(400, t);
  f.frequency.linearRampToValueAtTime(1400, t + 0.65);
  f.frequency.linearRampToValueAtTime(350, t + 1.3);
  tyres.connect(f);
  f.connect(swell(0.45));
  tyres.start(t);
  tyres.stop(t + 1.4);
  // The engine, its pitch dropping as it goes away.
  const engine = ac.createOscillator();
  engine.type = 'sawtooth';
  engine.frequency.setValueAtTime(95, t);
  engine.frequency.linearRampToValueAtTime(88, t + 0.6);
  engine.frequency.linearRampToValueAtTime(70, t + 1.3);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 300;
  engine.connect(lp);
  lp.connect(swell(0.18));
  engine.start(t);
  engine.stop(t + 1.4);
  // The city's hum under it.
  const hum = noiseSource(ac);
  const hf = ac.createBiquadFilter();
  hf.type = 'lowpass';
  hf.frequency.value = 200;
  hum.connect(hf);
  hf.connect(envelope(ac, out, t, 0.08, 0.3, 1.4));
  hum.start(t);
  hum.stop(t + 1.45);
}

/** Plays `shop`'s sound at `t` on `ac`. */
export function playShopSound(ac: BaseAudioContext, shop: Shop, t: number): void {
  const out = ac.createGain();
  out.gain.value = 0.7;
  out.connect(ac.destination);
  switch (shop) {
    case 'store':
      // The till: the drawer's clack, then the "ka-ching".
      hiss(ac, out, 'bandpass', 2500, 1800, 2, t, 0.05, 0.5);
      tone(ac, out, 'square', 140, 90, t, 0.06, 0.12);
      hiss(ac, out, 'highpass', 6000, 6000, 0.7, t + 0.09, 0.25, 0.18);
      bell(ac, out, 2093, t + 0.1, 0.9, 0.2);
      bell(ac, out, 2637, t + 0.16, 0.9, 0.16);
      break;
    case 'barber':
      // Two snips of the scissors.
      [0, 0.17].forEach((dt) => {
        hiss(ac, out, 'bandpass', 5500, 3500, 3, t + dt, 0.06, 0.45);
        hiss(ac, out, 'highpass', 8000, 8000, 1, t + dt + 0.055, 0.03, 0.35);
        tone(ac, out, 'sine', 3800, 3600, t + dt + 0.055, 0.18, 0.05);
      });
      break;
    case 'shoes':
      // Two heavy boot steps on a wooden floor, each with the heel's click.
      [0, 0.28].forEach((dt, i) => {
        tone(ac, out, 'sine', 120, 45, t + dt, 0.22, 0.7 - i * 0.1);
        hiss(ac, out, 'lowpass', 1800, 400, 1, t + dt, 0.09, 0.35);
        hiss(ac, out, 'bandpass', 3000, 3000, 2, t + dt + 0.01, 0.03, 0.12);
      });
      break;
    case 'tattoo':
      tattooMachine(ac, out, t);
      break;
    case 'street':
      passingCar(ac, out, t);
      break;
  }
}
