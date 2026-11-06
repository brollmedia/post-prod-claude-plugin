// COPY of post-prod's server/harness-sound.js, made by tools/build-plugin-footage.js. Change the original, then run that.
// Sound for the harness (5 Nov 2026). Two jobs. makeSfx() synthesises a small kit of original, licence-free effects from code (no
// samples, nothing downloaded: post-prod never pulls sound from the web for someone), the same every time for the same seed.
// soundCheck() measures a mix, because Claude cannot hear: loudness, true peak, clipping, how far each transient sits from the frame
// it marks, a cut-off tail, and a waveform and a spectrogram to look at. Pure node + ffmpeg; copied into the plugin with the harness.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { FF } from './footage-run.js';

const SR = 48000;
const TAU = Math.PI * 2;
const dbToGain = (db) => 10 ** (db / 20);
const err = (code, message) => Object.assign(new Error(message), { code });

/** A small seeded generator: the same seed gives the same sound, on any computer. */
function rng(seed) { let a = (seed * 2654435761) >>> 0 || 1; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const logLerp = (a, b, t) => a * (b / a) ** t;

/** Pink-leaning noise (Paul Kellet's filter): white noise has too much hiss to sound like air. */
function pinkNoise(n, rand) {
  const o = new Float32Array(n); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = rand() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    o[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
  }
  return o;
}
/** A state-variable filter with a cutoff that moves. mode: lp, bp, hp. freq(i) in Hz. */
function svf(x, freq, q, mode = 'bp') {
  const o = new Float32Array(x.length); let lo = 0, ba = 0;
  const damp = 1 / q;
  for (let i = 0; i < x.length; i++) {
    const f = 2 * Math.sin(Math.PI * Math.min(0.24, freq(i) / SR));
    // two passes per sample keep the filter stable when the cutoff is high
    for (let p = 0; p < 2; p++) { lo += (f / 2) * ba; const hi = x[i] - lo - damp * ba; ba += (f / 2) * hi; if (p === 1) o[i] = mode === 'lp' ? lo : mode === 'hp' ? hi : ba; }
  }
  return o;
}
const addTo = (d, s, g = 1, at = 0) => { for (let i = 0; i < s.length && i + at < d.length; i++) d[i + at] += s[i] * g; };
const shape = (x, drive) => { const k = Math.tanh(drive); for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * drive) / k; return x; };

/** A short, dark room: four combs and two all-passes, different on each side so it is wide. Makes a dry synth sound like a place. */
function room(x, { size = 1, damp = 0.35, seed = 1 } = {}) {
  const rand = rng(seed + 11), out = new Float32Array(x.length), combs = [1116, 1188, 1277, 1356].map((d) => Math.round(d * size * (1 + (rand() - 0.5) * 0.06)));
  for (const d of combs) {
    const buf = new Float32Array(d); let p = 0, s = 0;
    for (let i = 0; i < x.length; i++) { const y = buf[p]; s = y * (1 - damp) + s * damp; buf[p] = x[i] + s * 0.72; out[i] += y * 0.25; p = (p + 1) % d; }
  }
  for (const d of [Math.round(225 * size), Math.round(556 * size)]) {
    const buf = new Float32Array(d); let p = 0;
    for (let i = 0; i < x.length; i++) { const b = buf[p], y = -out[i] + b; buf[p] = out[i] + b * 0.5; out[i] = y; p = (p + 1) % d; }
  }
  return out;
}
const stereo = (m, wet = 0, seed = 1, size = 1) => {
  const L = Float32Array.from(m), R = Float32Array.from(m);
  if (wet > 0) { addTo(L, room(m, { size, seed }), wet); addTo(R, room(m, { size: size * 1.07, seed: seed + 5 }), wet); }
  return [L, R];
};
const panned = ([L, R], pan) => { for (let i = 0; i < L.length; i++) { const p = clamp(((typeof pan === 'function' ? pan(i) : pan) + 1) / 2) * (Math.PI / 2); L[i] *= Math.cos(p) * Math.SQRT2; R[i] *= Math.sin(p) * Math.SQRT2; } return [L, R]; };

const tone = (n, freq, amp, rand, phase = 0) => { const o = new Float32Array(n); let ph = phase; for (let i = 0; i < n; i++) { ph += (TAU * freq(i)) / SR; o[i] = Math.sin(ph) * amp(i); } return o; };

// ── the kit. Each returns { ch: [L, R], peak: seconds into the file of its loudest moment } ──
const KIT = {
  /** The air a move pushes: band-passed noise sweeping up and back, loudest about 60% through, with a low body and a top edge. */
  whoosh(o, r) {
    const d = clamp(+o.dur || 0.5, 0.12, 2.5), n = Math.round(d * SR), peakAt = clamp(+o.peak || 0.6, 0.3, 0.8);
    const lo = +o.low || 260, hi = +o.high || 3200;
    const env = (i) => { const t = i / n; return t < peakAt ? (t / peakAt) ** 2.2 : (1 - (t - peakAt) / (1 - peakAt)) ** 1.6; };
    const f = (i) => { const t = i / n; return t < peakAt ? logLerp(lo, hi, (t / peakAt) ** 1.3) : logLerp(hi, lo * 1.4, ((t - peakAt) / (1 - peakAt)) ** 0.8); };
    const mid = svf(pinkNoise(n, r), f, 1.1, 'bp'), air = svf(pinkNoise(n, r), (i) => f(i) * 2.6, 1.6, 'hp'), body = svf(pinkNoise(n, r), (i) => f(i) * 0.3 + 60, 1.4, 'lp');
    const m = new Float32Array(n);
    for (let i = 0; i < n; i++) { const e = env(i); m[i] = (mid[i] * 2.2 + air[i] * 0.5 * e + body[i] * 1.5) * e; }
    shape(m, 1.6);
    const dir = o.dir === 'left' ? -1 : o.dir === 'right' ? 1 : 0;
    return { ch: panned(stereo(m, 0.05, o.seed), (i) => dir * lerp(-0.6, 0.6, i / n)), peak: d * peakAt };
  },
  /** Tension going up: noise opening and a detuned pair climbing about an octave and a half, stopping dead at its end. */
  riser(o, r) {
    const d = clamp(+o.dur || 2, 0.5, 8), n = Math.round(d * SR), base = +o.note || 110;
    const up = (i) => (i / n) ** 2.4;
    const air = svf(pinkNoise(n, r), (i) => logLerp(300, 9000, up(i)), 0.9, 'bp');
    const a = tone(n, (i) => base * 2 ** (up(i) * 1.6), up, r), b = tone(n, (i) => base * 1.006 * 2 ** (up(i) * 1.6), up, r);
    const m = new Float32Array(n);
    for (let i = 0; i < n; i++) m[i] = air[i] * 2 * up(i) + (a[i] + b[i]) * 0.22 + Math.sin((TAU * base * 2 * i) / SR) * 0.1 * up(i);
    shape(m, 1.4);
    const fade = Math.round(0.006 * SR); for (let i = 0; i < fade; i++) m[n - 1 - i] *= i / fade;
    return { ch: stereo(m, 0.04, o.seed), peak: d - 0.01 };
  },
  /** A hit in three layers: a click for the edge, a body for the weight, a sub falling from about 120 to 45 Hz, in a small room. */
  impact(o, r) {
    const size = clamp(+o.size || 1, 0.4, 2), d = 0.9 * size + 0.35, n = Math.round(d * SR), top = 130 / size ** 0.4;
    const sub = tone(n, (i) => 38 + (top - 38) * Math.exp(-i / (0.09 * SR)), (i) => Math.exp(-i / ((0.32 * size) * SR)), r);
    const body = svf(pinkNoise(n, r), (i) => 180 + 1400 * Math.exp(-i / (0.03 * SR)), 0.8, 'lp');
    const click = svf(pinkNoise(Math.round(0.006 * SR), r), () => 2800, 0.7, 'hp');
    const m = new Float32Array(n);
    for (let i = 0; i < n; i++) m[i] = sub[i] * 0.9 + body[i] * 3.2 * Math.exp(-i / (0.05 * SR));
    addTo(m, click, 2.4);
    shape(m, 2.2);
    const c = stereo(m, 0.1, o.seed, 1.15);
    // the tail dies away on its own; the file never stops while it is still ringing
    const fade = Math.round(n * 0.35); for (const x of c) for (let i = 0; i < fade; i++) x[n - 1 - i] *= (i / fade) ** 2;
    return { ch: c, peak: 0.002 };
  },
  /** A small glass tick for a value landing: FM on a high carrier, gone in about 30 ms. */
  tick(o, r) {
    const n = Math.round(0.07 * SR), c = (+o.note || 2600) * (1 + (r() - 0.5) * 0.08), mod = c * 1.41, m = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = i / SR, idx = 3.2 * Math.exp(-t / 0.0045); m[i] = Math.sin(TAU * c * t + idx * Math.sin(TAU * mod * t)) * Math.exp(-t / 0.011); }
    addTo(m, svf(pinkNoise(Math.round(0.0015 * SR), r), () => 5000, 0.7, 'hp'), 0.9);
    return { ch: panned(stereo(m, 0.04, o.seed, 0.7), +o.pan || 0), peak: 0.001 };
  },
  /** A soft woody tap for an element arriving: a falling sine with a touch of noise. */
  pop(o, r) {
    const n = Math.round(0.14 * SR), f0 = +o.note || 340;
    const m = tone(n, (i) => f0 * (0.55 + 0.9 * Math.exp(-i / (0.012 * SR))), (i) => Math.exp(-i / (0.03 * SR)), r);
    addTo(m, svf(pinkNoise(Math.round(0.005 * SR), r), () => 2400, 1, 'bp'), 0.6);
    return { ch: panned(stereo(m, 0.06, o.seed, 0.8), +o.pan || 0), peak: 0.002 };
  },
  /** Weight under a reveal: a sine falling to the bottom of hearing, with a little harmonics so a phone speaker still gets it. */
  sub(o, r) {
    const d = clamp(+o.dur || 1.2, 0.3, 3), n = Math.round(d * SR), m = tone(n, (i) => 34 + 46 * Math.exp(-i / (0.25 * d * SR)), (i) => Math.min(1, i / (0.012 * SR)) * Math.exp(-i / (0.42 * d * SR)), r);
    shape(m, 2.4);
    return { ch: stereo(m, 0, o.seed), peak: 0.02 };
  },
  /** A breath in: a reversed room swelling into the hit. Loudest at its very end. */
  swell(o, r) {
    const d = clamp(+o.dur || 0.8, 0.25, 3), n = Math.round(d * SR), burst = new Float32Array(n);
    addTo(burst, svf(pinkNoise(Math.round(0.05 * SR), r), () => 1500, 0.8, 'bp'), 3);
    const tail = room(burst, { size: 2.4, damp: 0.25, seed: o.seed }), tailR = room(burst, { size: 2.55, damp: 0.25, seed: (o.seed || 1) + 3 });
    const rev = (a) => { const b = Float32Array.from(a).reverse(); for (let i = 0; i < n; i++) b[i] *= (i / n) ** 1.4; return b; };
    return { ch: [rev(tail), rev(tailR)], peak: d - 0.012 };
  },
  /** Light on a reveal: a few high partials ringing out at different speeds. */
  shimmer(o, r) {
    const d = clamp(+o.dur || 1.4, 0.4, 3), n = Math.round(d * SR), base = +o.note || 880, m = new Float32Array(n);
    for (const [ratio, a, tau] of [[2, 0.5, 0.5], [3, 0.3, 0.35], [4.02, 0.28, 0.28], [6.01, 0.16, 0.18], [8.03, 0.1, 0.12]]) {
      addTo(m, tone(n, () => base * ratio * (1 + (r() - 0.5) * 0.0004), (i) => Math.min(1, i / (0.003 * SR)) * Math.exp(-i / (tau * d * SR)), r), a);
    }
    return { ch: stereo(m, 0.22, o.seed, 1.6), peak: 0.01 };
  },
  /** Numbers rolling: ticks that slow down with the count, so the sound lands with the last digit. rate is ticks a second at the start. */
  rollup(o, r) {
    const d = clamp(+o.dur || 1.6, 0.3, 6), n = Math.round((d + 0.1) * SR), m = new Float32Array(n);
    const rate = +o.rate || 26; let t = 0, k = 0;
    while (t < d) {
      const p = t / d, g = lerp(0.8, 0.35, p) * (0.85 + r() * 0.3);
      const one = KIT.tick({ note: (+o.note || 2100) * (1 + p * 0.25), seed: k + 1 }, r).ch[0];
      addTo(m, one, g, Math.round(t * SR));
      t += 1 / (rate * (1 - p) ** 1.4 + 3); k++;
    }
    return { ch: stereo(m, 0.03, o.seed), peak: d };
  },
  /** A warm held chord to sit under a title: detuned stacks, opening slowly, tuned to note (Hz). It is a bed, not a song. */
  pad(o, r) {
    const d = clamp(+o.dur || 8, 1, 60), n = Math.round(d * SR), base = +o.note || 110, chord = o.minor ? [1, 1.189, 1.498, 2, 2.378] : [1, 1.26, 1.498, 2, 2.52];
    const L = new Float32Array(n), R = new Float32Array(n);
    for (const [j, ratio] of chord.entries()) for (const det of [-1, 1]) {
      const f = base * ratio * (1 + det * 0.0028), ph = r() * TAU, lfo = 0.05 + r() * 0.08, lp = r() * TAU;
      const s = new Float32Array(n);
      for (let i = 0; i < n; i++) { const t = i / SR; let v = 0; for (let h = 1; h <= 5; h++) v += Math.sin(TAU * f * h * t + ph * h) / h ** 1.5; s[i] = v * (0.75 + 0.25 * Math.sin(TAU * lfo * t + lp)); }
      addTo(det < 0 ? L : R, s, 0.16 / (1 + j * 0.25)); addTo(det < 0 ? R : L, s, 0.05 / (1 + j * 0.25));
    }
    const open = (i) => 500 + 1500 * clamp(i / n * 1.4) ** 1.5, a = svf(L, open, 0.7, 'lp'), b = svf(R, open, 0.7, 'lp');
    const fade = Math.min(n / 3, 1.2 * SR), tail = Math.min(n / 3, 1.5 * SR);
    for (let i = 0; i < n; i++) { const e = Math.min(1, i / fade) ** 1.5 * Math.min(1, (n - i) / tail) ** 1.5; a[i] *= e; b[i] *= e; }
    return { ch: [a, b], peak: d * 0.5 };
  },
  /** Room tone: the sound of nothing. A silent graphic in a mix sounds like a hole. Comes out peak-normalised like the rest: gain_db -46 sits about -60 dB. */
  room(o, r) {
    const d = clamp(+o.dur || 5, 0.5, 120), n = Math.round(d * SR);
    const mk = () => { const x = svf(pinkNoise(n, r), () => 900, 0.6, 'lp'), y = svf(x, () => 60, 0.7, 'hp'); return y; };
    return { ch: [mk(), mk()], peak: 0 };
  },
};
export const SFX_KINDS = Object.keys(KIT);

function wav(ch) {
  const n = ch[0].length, data = Buffer.alloc(n * 2 * 3);
  for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) { const v = Math.round(clamp(ch[c][i], -1, 1) * 8388607); data.writeIntLE(v, (i * 2 + c) * 3, 3); }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 6, 28); h.writeUInt16LE(6, 32); h.writeUInt16LE(24, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/**
 * One effect as a 48 kHz 24-bit stereo WAV. o: { file, seed, dur, note, dir, pan, size, ... } → { file, kind, seconds, peak_s }.
 * Peak-normalised to -3 dBFS; set its level in the mix with gain_db. peak_s is where its loudest moment is, for hit: timing.
 */
export function makeSfx(kind, o = {}) {
  if (!KIT[kind]) throw err('BAD_SFX', `No sound called ${kind}. There are: ${SFX_KINDS.join(', ')}.`);
  const seed = Math.round(+o.seed || 1), r = rng(seed), { ch, peak } = KIT[kind]({ ...o, seed }, r);
  let p = 0; for (const c of ch) for (let i = 0; i < c.length; i++) p = Math.max(p, Math.abs(c[i]));
  const g = p ? dbToGain(-3) / p : 1;
  const n = ch[0].length, fade = Math.min(Math.round(0.004 * SR), n >> 1);
  for (const c of ch) { for (let i = 0; i < n; i++) c[i] *= g; for (let i = 0; i < fade; i++) c[n - 1 - i] *= i / fade; }
  const file = path.resolve(o.file || `${kind}-${seed}.wav`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, wav(ch));
  return { file, kind, seconds: n / SR, peak_s: peak };
}

/** A small room's impulse, for the effects' reverb send. */
export function roomImpulse(file) {
  const m = new Float32Array(Math.round(0.3 * SR)); m[0] = 1;
  fs.writeFileSync(file, wav([room(m, { size: 0.6, seed: 3 }), room(m, { size: 0.64, seed: 8 })]));
  return file;
}
/** Seconds into a file of its loudest sample, so a recording's peak can land on the frame. */
export async function peakSeconds(file) {
  const raw = await ff(['-hide_banner', '-loglevel', 'error', '-i', path.resolve(file), '-ac', '1', '-ar', '12000', '-f', 'f32le', '-'], { bin: true });
  const s = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length - (raw.length % 4)));
  let at = 0, top = 0; for (let i = 0; i < s.length; i++) { const a = Math.abs(s[i]); if (a > top) { top = a; at = i; } }
  return at / 12000;
}

// ── the check ──
const ff = (args, { bin = false } = {}) => new Promise((res, rej) => {
  const p = spawn(FF, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }); const o = [], e = [];
  p.stdout.on('data', (d) => o.push(d)); p.stderr.on('data', (d) => e.push(d));
  p.on('error', (x) => rej(err('FFMPEG_FAILED', x.message)));
  p.on('close', (c) => (c === 0 ? res(bin ? Buffer.concat(o) : Buffer.concat(e).toString()) : rej(err('FFMPEG_FAILED', Buffer.concat(e).toString().slice(-300)))));
});

/** Reads ffmpeg's ebur128 summary (pure). */
export function parseEbur(s) {
  const tail = s.slice(s.lastIndexOf('Summary:'));
  const num = (re) => { const m = re.exec(tail); return m ? +m[1] : null; };
  return { lufs: num(/I:\s+(-?[\d.]+) LUFS/), lra: num(/LRA:\s+(-?[\d.]+) LU/), true_peak_db: num(/Peak:\s+(-?[\d.]+) dBFS/) };
}

// ── a graphic's sound going into a voiced video ──
// A full-frame piece mastered on its own sits at -14 LUFS with its hit at the top of the range, and a voice in a video is about the same
// loudness on average but far below that hit. Cut in as it is, the effects jump out of the video (measured 5 Nov 2026). So a piece
// mastered on its own carries this tag, and whatever puts it into a video brings it down to the voice around it.
export const MASTERED_TAG = 'post-prod graphic, mastered on its own';
export const UNDER_VOICE = { gap: 3, speech: 10 }; // LU under the voice's loudest moment: on its own in a gap (the impact band), or with the voice still going (the whoosh band)
const momentary = (log) => [...log.matchAll(/ M:\s*(-?[\d.]+)/g)].map((m) => +m[1]).filter((v) => v > -70);
/** The loudest momentary loudness in a file or a stretch of it, or null when it is silent there. */
export async function maxMomentary(file, { from = null, to = null } = {}) {
  const log = await ff(['-hide_banner', '-nostats', ...(from != null ? ['-ss', String(Math.max(0, from))] : []), ...(to != null ? ['-t', String(to - Math.max(0, from || 0))] : []), '-i', file, '-map', '0:a:0', '-af', 'apad=pad_dur=1,ebur128', '-f', 'null', '-']).catch(() => '');
  const m = momentary(String(log)); return m.length ? Math.max(...m) : null;
}
/** Was this mastered on its own by render --final? */
export async function isMastered(file) {
  const meta = await ff(['-hide_banner', '-loglevel', 'error', '-i', file, '-f', 'ffmetadata', '-'], { bin: true }).catch(() => Buffer.alloc(0));
  return Buffer.from(meta).toString('utf8').includes(MASTERED_TAG);
}
/**
 * How far to bring a graphic down to sit under the voice in a video: { gain_db, piece_max, voice_max }. Never up, and 0 when there is no
 * voice there. around: { from, to } the stretch of the video to measure, with a little either side, not the whole of a long file.
 */
export async function levelGain(piece, video, { around = {}, under = UNDER_VOICE.speech } = {}) {
  const [piece_max, voice_max] = [await maxMomentary(piece), await maxMomentary(video, around)];
  if (piece_max == null || voice_max == null) return { gain_db: 0, piece_max, voice_max };
  return { gain_db: Math.round(Math.min(0, voice_max - under - piece_max) * 10) / 10, piece_max, voice_max };
}
/** The piece at the level of the voice, as a new file (picture copied): { file, gain_db, piece_max, voice_max }. */
export async function levelInto(piece, video, { out, around, under } = {}) {
  const g = await levelGain(piece, video, { around, under });
  const a = /\.mov$/i.test(out) ? ['-c:a', 'pcm_s16le'] : ['-c:a', 'aac', '-b:a', '256k'];
  await ff(['-hide_banner', '-loglevel', 'error', '-y', '-i', piece, '-map', '0', '-c:v', 'copy', '-af', `volume=${g.gain_db}dB`, ...a, '-metadata', 'comment=', ...(/\.mp4$/i.test(out) ? ['-movflags', '+faststart'] : []), out]);
  return { file: out, ...g };
}

/** How far the transient near each hit starts from it (pure), ms, negative = the sound is early: where the sound rises to within 10 dB of its loudest. samples: mono Float32 at sr. */
export function hitOffsets(samples, sr, hits, win = 0.12) {
  const hop = Math.round(sr * 0.002), out = [];
  for (const h of hits) {
    const a = Math.max(0, Math.round((h - win) * sr)), b = Math.min(samples.length, Math.round((h + win) * sr));
    const env = []; let best = -1;
    for (let i = a; i < b; i += hop) { let e = 0; for (let j = i; j < Math.min(b, i + hop); j++) e += samples[j] * samples[j]; env.push(e); if (e > best) best = e; }
    // the attack is the sharpest jump, not the first thing within 10 dB of the peak: a riser climbing into a hit is close to the peak
    // well before the hit, and read as the sound coming early. Over 8 ms a real transient jumps; a riser or a bed does not.
    let jump = 0, onset = -1;
    for (let i = 0; i + 4 < env.length; i++) { if (env[i + 4] < best / 10) continue; const r = env[i + 4] / Math.max(1e-9, env[i]); if (r > jump) { jump = r; onset = i; } }
    if (jump >= 2) { const top = env[onset + 4]; while (env[onset] < top / 4) onset++; } // the first step of the jump, not the window before it
    const at = a + (jump >= 2 ? onset : env.findIndex((e) => e >= best / 10)) * hop;
    const level = 10 * Math.log10(Math.max(1e-12, best / hop));
    out.push({ hit: h, offset_ms: Math.round((at / sr - h) * 1000), level_db: Math.round(level * 10) / 10 });
  }
  return out;
}

/**
 * Measure a mix. o: { hits: [seconds], target: -14, out: folder, fps } → { lufs, lra, true_peak_db, hits, problems, waveform, spectrogram }.
 * Claude cannot hear: this is its ear.
 */
export async function soundCheck(file, o = {}) {
  const src = path.resolve(file);
  if (!fs.existsSync(src)) throw err('NO_AUDIO', `Nothing at ${src}.`);
  const target = o.target == null ? null : +o.target, fps = +o.fps || 30; // -14 is for a finished voiced mix: asked for, never assumed
  const log = await ff(['-hide_banner', '-nostats', '-i', src, '-map', '0:a:0', '-af', 'ebur128=peak=true', '-f', 'null', '-']).catch((e) => { throw /does not contain|matches no streams/.test(e.message) ? err('NO_AUDIO', 'This file has no sound.') : e; });
  const m = parseEbur(log);
  const raw = await ff(['-hide_banner', '-loglevel', 'error', '-i', src, '-map', '0:a:0', '-ac', '2', '-ar', '48000', '-f', 'f32le', '-'], { bin: true });
  const st = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length - (raw.length % 8)));
  const s = new Float32Array(st.length >> 1);
  let peak = 0, clipped = 0;
  for (let i = 0; i < s.length; i++) { const l = st[i * 2], r = st[i * 2 + 1]; s[i] = (l + r) / 2; const a = Math.max(Math.abs(l), Math.abs(r)); if (a > peak) peak = a; if (a >= 0.999) clipped++; }
  const tail = s.subarray(Math.max(0, s.length - 480)); let end = 0; for (const v of tail) end = Math.max(end, Math.abs(v));
  const hits = o.hits?.length ? hitOffsets(s, 48000, o.hits.map(Number)) : [];
  const problems = [], frame = 1000 / fps;
  if (m.lufs != null && target != null && o.overlay !== true && Math.abs(m.lufs - target) > 1) problems.push({ code: 'LOUDNESS', what: `${m.lufs} LUFS, target ${target}: ${m.lufs > target ? 'too loud' : 'too quiet'}` });
  if (m.true_peak_db != null && m.true_peak_db > -1) problems.push({ code: 'TRUE_PEAK', what: `true peak ${m.true_peak_db} dBTP is over -1` });
  if (clipped > 3) problems.push({ code: 'CLIPPED', what: `${clipped} samples at full scale` });
  if (end > dbToGain(-40)) problems.push({ code: 'CUT_OFF', what: 'the sound is still going on the last sample: fade it or it clicks' });
  for (const h of hits) if (h.offset_ms > frame + 3 || h.offset_ms < -12) problems.push({ code: 'OFF_THE_HIT', what: `the hit at ${h.hit} s is ${h.offset_ms} ms ${h.offset_ms > 0 ? 'late' : 'early'}: a transient lands on its frame or up to one frame after it, never before (we notice early sound soonest: ITU-R BT.1359)` });
  const dir = path.resolve(o.out || path.join(path.dirname(src), 'sound-check')); fs.mkdirSync(dir, { recursive: true });
  const waveform = path.join(dir, 'waveform.png'), spectrogram = path.join(dir, 'spectrogram.png');
  await ff(['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-filter_complex', '[0:a:0]showwavespic=s=1600x300:split_channels=1:scale=sqrt[v]', '-map', '[v]', '-frames:v', '1', waveform]);
  await ff(['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-filter_complex', '[0:a:0]showspectrumpic=s=1600x500:legend=1:scale=log:fscale=log[v]', '-map', '[v]', '-frames:v', '1', spectrogram]);
  return { ...m, sample_peak_db: Math.round(20 * Math.log10(Math.max(1e-9, peak)) * 10) / 10, seconds: s.length / 48000, hits, problems, waveform, spectrogram };
}
