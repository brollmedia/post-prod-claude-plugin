// COPY of post-prod's server/harness-mix.js, made by tools/build-plugin-footage.js. Change the original, then run that.
// Seth's mix as defaults (skills/launch-video-craft, sections 4 to 6). Levels, the voice-keyed duck, beds, the music's movement, the
// effects chain and the master. What a piece gets depends on each sound's `kind`: voice, music, bed or sfx.
import fs from 'node:fs';
import path from 'node:path';
import { run, FF } from './footage-run.js';
import { roomImpulse } from './harness-sound.js';

export const LEVELS = { voice: -16, music: -16, sfx: -25, bed: -32, master: -14 }; // bed: our start, his rule is "if you can clearly hear a pad, it's probably too loud"
export const BIG_PEAK = -14; // the loudest hit in his films, dBFS
export const DUCK = { gate: -42, attack: 40, release: 375, narration: 9, lively: 6.5, drop: 5, bed: 4 };
export const KIND_ORDER = { voice: 0, sfx: 3 }; // a voice goes in first, so a duck hears it; effects go last, so nothing ducks under them

/** The ratio that gives this depth for a voice at this level, with the threshold at his gate (pure). The depth is what he sets, so the ratio follows the voice. */
export function duckRatio(voiceLufs, depth = DUCK.narration, gate = DUCK.gate) {
  const above = Math.max(6, voiceLufs - gate), d = Math.min(depth, above * 0.9);
  return Math.round((1 / (1 - d / above)) * 100) / 100;
}
export const duckFilter = (voiceLufs = -18, depth = DUCK.narration) => `sidechaincompress=threshold=${(10 ** (DUCK.gate / 20)).toFixed(5)}:ratio=${duckRatio(voiceLufs, depth)}:attack=${DUCK.attack}:release=${DUCK.release}:detection=rms`;
export const VOICE_CHAIN = 'highpass=f=80,acompressor=threshold=-22dB:ratio=3:attack=5:release=80,equalizer=f=3200:t=q:w=1:g=1.5,equalizer=f=6800:t=q:w=1:g=-2.5';
/** A bed: airy, out of the way, and never static (a slow breath of 2 dB each way, with a little of every bed's own period). */
export const bedFilter = (seed = 1) => `highpass=f=300,lowpass=f=11000,treble=g=1.5:f=8000,aecho=0.85:0.7:43|71|109:0.28|0.2|0.13,stereotools=slev=1.5,volume='pow(10,2*sin(2*PI*t/${(8 + (seed % 5) * 0.7).toFixed(1)})/20)':eval=frame`;
/** Lean a small sound towards its element, up to 60% (pure). */
export function panFilter(pan) {
  const p = Math.max(-0.6, Math.min(0.6, +pan || 0)); if (!p) return '';
  const a = ((p + 1) / 2) * (Math.PI / 2), l = Math.cos(a) * Math.SQRT2, r = Math.sin(a) * Math.SQRT2;
  return `pan=stereo|c0=${l.toFixed(3)}*c0|c1=${r.toFixed(3)}*c1`;
}
/** His master: light glue, the gain to -14, peaks held at about -1.2, and a fade over the last 0.55 s. */
export const GLUE = 'acompressor=threshold=-18dB:ratio=1.5:attack=20:release=200';
export const masterFilter = (gainDb, seconds) => `${GLUE},volume=${Math.max(-12, Math.min(24, gainDb)).toFixed(2)}dB,alimiter=limit=0.87:level=0${seconds > 2 ? `,afade=t=out:st=${(seconds - 0.55).toFixed(3)}:d=0.55` : ''}`;

/**
 * The music moves with the story (pure). Levels in dB against the music at -16 LUFS. → [{ a, b, from, to }]: straight runs from second a to b.
 * Up to the first drop it rises -5 to -3. Half a beat before each drop it stops down to -21. The drop slams to +2 and settles to the base over
 * 1.2 s. It holds the base (-2.5 under narration) and ends at +0.5.
 */
export function musicRuns({ drops = [], end, base = -2.5 } = {}) {
  const ds = [...drops].map(Number).filter((d) => d > 0.4 && d < end).sort((a, b) => a - b), runs = [];
  let t = 0, level = ds.length ? -5 : base;
  const go = (to, a, b) => { if (to > t) { runs.push({ a: t, b: to, from: a, to: b }); t = to; level = b; } };
  ds.forEach((d, i) => {
    const stop = d - 0.3;
    go(stop - 0.03, level, i === 0 ? -3 : level); go(stop, level, -21); go(d - 0.01, -21, -21); go(d, -21, 2); go(Math.min(d + 1.2, ds[i + 1] ? ds[i + 1] - 0.33 : end), 2, base);
  });
  if (end > 1) { go(end - 1, level, level); go(end - 0.9, level, 0.5); }
  go(end, level, level);
  return runs;
}
export function curveDb(runs, t) { for (const r of runs) if (t < r.b) return r.from + ((r.to - r.from) * (t - r.a)) / (r.b - r.a); return runs[runs.length - 1]?.to ?? 0; }
export function musicFilter(opts) {
  const runs = musicRuns(opts);
  const e = runs.reduceRight((rest, r) => `if(lt(t,${r.b.toFixed(3)}),${r.from}+(${(r.to - r.from).toFixed(3)})*(t-${r.a.toFixed(3)})/${(r.b - r.a).toFixed(3)},${rest})`, String(runs[runs.length - 1]?.to ?? 0));
  return `volume='pow(10,(${e})/20)':eval=frame`;
}

const num = (x, re) => { const m = re.exec(x); return m ? +m[1] : null; };
/** Loudness and sample peak of a file, after an optional chain. */
export async function measure(file, chain = '', { from = 0, to = null } = {}) {
  const { err } = await run(FF, ['-hide_banner', '-nostats', ...(from ? ['-ss', String(from)] : []), ...(to != null ? ['-t', String(to - from)] : []), '-i', file, '-af', `${chain ? `${chain},` : ''}apad=pad_dur=0.5,ebur128=peak=sample`, '-f', 'null', '-']);
  const sum = err.slice(err.lastIndexOf('Summary'));
  return { lufs: num(sum, /I:\s+(-?[\d.]+) LUFS/), peak: num(sum, /Peak:\s+(-?[\d.]+) dBFS/) };
}
export const chainOf = (kind, x = {}) => (kind === 'voice' ? VOICE_CHAIN : kind === 'bed' ? bedFilter(x.seed) : '');
/** The gain that brings a voice, music or bed to its level (a measured file), plus any gain_db on top. */
export async function kindGain(file, kind, x = {}) {
  const m = await measure(file, chainOf(kind, x));
  return (Number.isFinite(m.lufs) && m.lufs > -70 ? LEVELS[kind] - m.lufs : 0) + (+x.gain_db || 0);
}

/**
 * The effects, as one stem: his chain, a small room at 25% wet filtered 300 Hz to 9 kHz, 2:1 compression, and no louder than -25 LUFS.
 * An item with peak_db is set by its peak, the way his films set each sound. items: [{ src, at, from, to, gain_db, peak_db, pan, fade_in, fade_out }].
 * Quiet effects stay quiet: this only ever turns the stem down. → the wav
 */
export async function sfxStem(items, { dir, seconds, work, name = 'sfx' }) {
  const ins = [], parts = [];
  for (const [i, x] of items.entries()) {
    const src = path.resolve(dir, x.src), len = x.to != null ? Math.max(0.01, +x.to - (+x.from || 0)) : null;
    if (!fs.existsSync(src)) throw Object.assign(new Error(`The sound ${x.src} is not there.`), { code: 'NO_AUDIO' });
    const gain = x.peak_db != null ? +x.peak_db - ((await measure(src, '', { from: +x.from || 0, to: x.to })).peak ?? 0) : +x.gain_db || 0, ms = Math.round(Math.max(0, +x.at || 0) * 1000), pan = panFilter(x.pan);
    ins.push('-ss', String(+x.from || 0), ...(len ? ['-t', String(len)] : []), '-i', src);
    parts.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${gain.toFixed(2)}dB${x.fade_in ? `,afade=t=in:st=0:d=${+x.fade_in}` : ''}${x.fade_out && len ? `,afade=t=out:st=${Math.max(0, len - x.fade_out)}:d=${+x.fade_out}` : ''}${pan ? `,${pan}` : ''},adelay=${ms}|${ms}[a${i}]`);
  }
  const dry = path.join(work, `${name}-dry.wav`), wet = path.join(work, `${name}-wet.wav`), ir = path.join(work, `${name}-room.wav`), out = path.join(work, `${name}.wav`);
  await run(FF, ['-hide_banner', '-loglevel', 'error', '-y', ...ins, '-filter_complex', `${parts.join(';')};${items.map((_, i) => `[a${i}]`).join('')}amix=inputs=${items.length}:normalize=0:dropout_transition=0,apad=whole_dur=${seconds},atrim=0:${seconds}[m]`, '-map', '[m]', '-c:a', 'pcm_f32le', dry]);
  roomImpulse(ir);
  await run(FF, ['-hide_banner', '-loglevel', 'error', '-y', '-i', dry, '-i', ir, '-filter_complex', '[0:a]highpass=f=300,lowpass=f=9000[w];[w][1:a]afir=gtype=-1:irnorm=1[m]', '-map', '[m]', '-c:a', 'pcm_f32le', wet]);
  const [a, b] = [await measure(dry), await measure(wet)], wetGain = Number.isFinite(a.lufs) && Number.isFinite(b.lufs) ? a.lufs - 12 - b.lufs : -40; // 25% wet
  const graph = `[1:a]volume=${wetGain.toFixed(2)}dB[w];[0:a][w]amix=inputs=2:normalize=0:duration=first,acompressor=threshold=-30dB:ratio=2:attack=10:release=120`;
  const now = await chainLevel(dry, wet, graph), gain = Math.min(0, Number.isFinite(now.lufs) ? LEVELS.sfx - now.lufs : 0, BIG_PEAK - (now.peak ?? BIG_PEAK));
  await run(FF, ['-hide_banner', '-loglevel', 'error', '-y', '-i', dry, '-i', wet, '-filter_complex', `${graph},volume=${gain.toFixed(2)}dB[m]`, '-map', '[m]', '-c:a', 'pcm_s24le', out]);
  return out;
}
async function chainLevel(dry, wet, graph) {
  const { err } = await run(FF, ['-hide_banner', '-nostats', '-i', dry, '-i', wet, '-filter_complex', `${graph},apad=pad_dur=0.5,ebur128=peak=sample[m]`, '-map', '[m]', '-f', 'null', '-']);
  const sum = err.slice(err.lastIndexOf('Summary'));
  return { lufs: num(sum, /I:\s+(-?[\d.]+) LUFS/), peak: num(sum, /Peak:\s+(-?[\d.]+) dBFS/) };
}
