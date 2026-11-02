// COPY of post-prod's server/footage-run.js, made by tools/build-plugin-footage.js. Change the original, then run that.
// The footage cut engine, ffmpeg part (2 Nov 2026; the pure part and the why are in server/footage-core.js). It runs on the
// person's own computer (the plugin's copy, bin/footage/) and in our tests; nothing here touches the database or storage.
//
//   render   an edit list -> one file: a picture piece per clip (and per dissolve), joined without encoding again; the sound
//            mixed sample-exact here in JS (equal-power blends, J/L edges moved), encoded once.
//   splice   change one stretch of a finished file: only the keyframe groups around the change are encoded again (with the
//            file's own x264 settings, so the stream stays one stream), the rest is copied; the sound is rebuilt whole (cheap).
//            Seth, 2 Nov: "instead of re-rendering the entire video every change ... just cut out the section the user wants
//            edited ... ensure that we test it flows smoothly with the before and after sections".
//   check    what a viewer would hit: decode errors, frames vs the plan, black, sound and picture lengths, loudness steps at
//            every seam, sentences cut mid-way.
//
// Memory is bounded the way the 28 Oct lesson taught: one plain ffmpeg at a time, and the sound streamed through a small
// carry buffer rather than held whole.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { planCut, tidyWords, segmentSamples, gainAt, spliceWindow, x264ParamsFrom, ppsFields, fpsArg, RATE, SEAM_MS, planSummary, clock, MIN_CLIP_S } from './footage-core.js';

const FF71 = 'C:/Users/sethf/tools/ffmpeg-7.1-essentials_build/bin/ffmpeg.exe';
export const FF = process.env.FFMPEG || (fs.existsSync(FF71) ? FF71 : 'ffmpeg');
export const FP = process.env.FFPROBE || (FF.endsWith('ffmpeg.exe') ? FF.replace(/ffmpeg\.exe$/, 'ffprobe.exe') : FF === 'ffmpeg' ? 'ffprobe' : FF.replace(/ffmpeg$/, 'ffprobe'));
const num = (x) => (Math.round(x * 1e6) / 1e6).toString();
const r3 = (x) => Math.round(x * 1000) / 1000;

/** Run a program; resolve with { out (Buffer), err (string) }, reject with the last lines of stderr on a non-zero exit. */
export function run(bin, args, { input = null, raw = false } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'], windowsHide: true });
    const out = [], err = [];
    p.stdout.on('data', (d) => out.push(d));
    p.stderr.on('data', (d) => { err.push(d); if (err.length > 400) err.splice(0, 200); });
    p.on('error', (e) => reject(Object.assign(new Error(`${path.basename(bin)} could not start: ${e.message}. Is ffmpeg installed and on the PATH?`), { code: 'NO_FFMPEG' })));
    p.on('close', (code) => {
      const e = Buffer.concat(err).toString('utf8');
      if (code !== 0) return reject(Object.assign(new Error(`${path.basename(bin)} failed (${code}): ${e.split(/\r?\n/).filter(Boolean).slice(-4).join(' | ')}`), { code: 'FFMPEG_FAILED', stderr: e }));
      resolve({ out: raw ? Buffer.concat(out) : Buffer.concat(out), err: e });
    });
    if (input) { p.stdin.end(input); }
  });
}
const ff = (args) => run(FF, ['-hide_banner', '-nostdin', '-loglevel', 'error', ...args]);

/** What a file is: { duration, fps, width, height, hasAudio, audioStreams, codec, pix_fmt, profile, timescale }. */
export async function probe(file) {
  const { out } = await run(FP, ['-v', 'error', '-show_entries', 'format=duration:stream=index,codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,pix_fmt,profile,time_base,nb_frames,duration', '-of', 'json', file]);
  const j = JSON.parse(out.toString('utf8'));
  const v = (j.streams || []).find((s) => s.codec_type === 'video'), a = (j.streams || []).filter((s) => s.codec_type === 'audio');
  const rate = (s) => { const [n, d] = String(s || '0/1').split('/').map(Number); return d ? n / d : 0; };
  const fps = rate(v?.avg_frame_rate) || rate(v?.r_frame_rate);
  return {
    duration: +j.format?.duration || +v?.duration || 0, fps, width: +v?.width || 0, height: +v?.height || 0,
    hasAudio: a.length > 0, audioStreams: a.length, codec: v?.codec_name || null, pix_fmt: v?.pix_fmt || null, profile: v?.profile || null,
    timescale: v?.time_base ? +String(v.time_base).split('/')[1] : null, nb_frames: v?.nb_frames ? +v.nb_frames : null,
  };
}

/** The video packets in decode order: [{ pts, key }] (read from the container, no decoding: fast on any length). */
export async function packets(file) {
  const { out } = await run(FP, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time,flags', '-of', 'csv=p=0', file]);
  return out.toString('utf8').split(/\r?\n/).filter(Boolean).map((l) => { const [pts, flags] = l.split(','); return { pts: +pts, key: /K/.test(flags || '') }; });
}

/** The first frame's parameter sets (SPS, PPS) and x264's settings SEI, read from the stream in Annex B. */
export async function streamHeaders(file) {
  const { out } = await run(FF, ['-hide_banner', '-nostdin', '-loglevel', 'error', '-i', file, '-map', '0:v:0', '-c:v', 'copy', '-bsf:v', 'h264_mp4toannexb', '-frames:v', '1', '-f', 'h264', '-'], { raw: true });
  const nals = [];
  for (let i = 0; i + 3 < out.length; i++) {
    if (out[i] === 0 && out[i + 1] === 0 && (out[i + 2] === 1 || (out[i + 2] === 0 && out[i + 3] === 1))) {
      const s = out[i + 2] === 1 ? i + 3 : i + 4;
      nals.push(s); i = s;
    }
  }
  const units = nals.map((s, k) => { let e = k + 1 < nals.length ? nals[k + 1] - 3 : out.length; while (e > s && out[e - 1] === 0) e--; return out.subarray(s, e); });
  const sps = units.filter((u) => (u[0] & 0x1f) === 7).map((u) => u.toString('hex'));
  const pps = units.filter((u) => (u[0] & 0x1f) === 8).map((u) => u.toString('hex'));
  const sei = units.filter((u) => (u[0] & 0x1f) === 6).map((u) => u.toString('latin1')).join('\n');
  return { sps, pps, x264: x264ParamsFrom(sei) };
}

/** Words for a source: an array, or a path to a JSON file holding [{start,end,word}] or [[start,end,word]] or { words }. */
export function loadWords(w, clockAt = 0) {
  if (!w) return null;
  let j = w;
  if (typeof w === 'string') j = JSON.parse(fs.readFileSync(w, 'utf8'));
  const arr = Array.isArray(j) ? j : Array.isArray(j?.words) ? j.words : [];
  // clockAt: where this file starts on the words' clock (a stretch from get_section starts at its "from" of the version); the
  // lines (segments) give the sentence ends Whisper's words lack
  const segs = Array.isArray(j?.segments) ? j.segments.map((x) => (Array.isArray(x) ? [x[0] - clockAt, x[1] - clockAt, x[2]] : { ...x, start: x.start - clockAt, end: x.end - clockAt })) : null;
  return tidyWords(arr.map((x) => (Array.isArray(x) ? { start: x[0], end: x[1], word: x[2] } : x)).map((x) => ({ ...x, start: +x.start - clockAt, end: +x.end - clockAt })), segs).filter((x) => x.end > 0);
}

// ── encoding ──

export const ENC = {
  high: ['-preset', 'medium', '-crf', '16'],
  draft: ['-preset', 'veryfast', '-crf', '23'],
};
/** The picture chain that brings a source to the cut's shape (never stretched; padded with black). */
export const fitChain = ({ W, H, fps }) => [`fps=${fpsArg(fps)}`, `scale=${W}:${H}:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=bicubic`, `pad=${W}:${H}:trunc((ow-iw)/4)*2:trunc((oh-ih)/4)*2:color=black`, 'setsar=1', 'format=yuv420p', 'tpad=stop_mode=clone:stop_duration=1'].join(',');
const x264Args = ({ quality, fps, x264 = null }) => ['-c:v', 'libx264', ...(ENC[quality] || ENC.high), '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-g', String(Math.max(1, Math.round(fps * 2))), ...(x264 ? ['-x264-params', x264] : [])];

/** One picture piece: a clip's body (with dip fades) or a dissolve between two sources. */
export async function renderPiece(piece, { srcPath, shape, quality, out, x264 = null, timescale = null }) {
  const chain = fitChain(shape), N = piece.frames, enc = x264Args({ quality, fps: shape.fps, x264 });
  const ts = timescale ? ['-video_track_timescale', String(timescale)] : [];
  if (piece.kind === 'dissolve') {
    const D = N / shape.fps;
        // a straight blend by frame number (xfade wants its first input longer than the fade; this is exact on N frames)
    const fc = `[0:v]${chain},trim=end_frame=${N},setpts=PTS-STARTPTS[a];[1:v]${chain},trim=end_frame=${N},setpts=PTS-STARTPTS[b];[a][b]blend=all_expr='A*(1-(N+0.5)/${N})+B*((N+0.5)/${N})',format=yuv420p[v]`;
    return ff(['-y', '-ss', num(piece.a.t), '-t', num(D + 1), '-i', srcPath(piece.a.src), '-ss', num(piece.b.t), '-t', num(D + 1), '-i', srcPath(piece.b.src), '-filter_complex', fc, '-map', '[v]', '-an', '-frames:v', String(N), '-r', fpsArg(shape.fps), ...enc, ...ts, out]);
  }
  const fades = [...(piece.fadeIn ? [`fade=t=in:s=0:n=${piece.fadeIn}`] : []), ...(piece.fadeOut ? [`fade=t=out:s=${Math.max(0, N - piece.fadeOut)}:n=${Math.max(1, piece.fadeOut - 1)}`] : [])]; // the last frame fully black
  return ff(['-y', '-ss', num(piece.t), '-t', num(N / shape.fps + 1), '-i', srcPath(piece.src), '-map', '0:v:0', '-an', '-vf', [chain, ...fades].join(','), '-frames:v', String(N), '-r', fpsArg(shape.fps), ...enc, ...ts, out]);
}

/** One sound segment as raw 48 kHz stereo s16le: every audio track of the source mixed (OBS writes several: mic, game,
 *  a master; Retti 14 Sep), or nothing when the source has no sound. Returns the file or null. */
export async function extractSound(seg, { srcPath, info, out }) {
  if (!info?.hasAudio) return null;
  const n = info.audioStreams || 1, dur = seg.to - seg.from;
  const pre = seg.from < 0 ? -seg.from : 0; // a segment may start before 0 only by rounding: pad silence in front
  const af = n > 1 ? ['-filter_complex', `${Array.from({ length: n }, (_, i) => `[0:a:${i}]`).join('')}amix=inputs=${n}:normalize=0[a]`, '-map', '[a]'] : ['-map', '0:a:0'];
  await ff(['-y', '-ss', num(Math.max(0, seg.from)), '-t', num(dur - pre + 0.05), '-i', srcPath(seg.src), ...af, '-ac', '2', '-ar', String(RATE), '-f', 's16le', out]);
  return { file: out, pre: Math.round(pre * RATE) };
}

/**
 * The sound of the cut, mixed sample-exact and streamed to `out` (s16le stereo): each segment at its place with its blends.
 * segs: plan.audio with { file, pre } from extractSound (file null = silence). total: samples. Returns the loudness (RMS dBFS)
 * 300 ms either side of every join, so a seam that jumps in level is reported.
 */
export function mixSound(segs, total, out, joinsAt = []) {
  const fd = fs.openSync(out, 'w');
  const CH = 2, CHUNK = RATE; // a second at a time
  let carry = new Float32Array(0), carryAt = 0; // samples from carryAt not yet written
  const flush = (upto) => { // write [carryAt, upto)
    const n = Math.max(0, Math.min(upto, total) - carryAt);
    if (!n) return;
    const pcm = new Int16Array(n * CH);
    for (let i = 0; i < n * CH; i++) { const v = Math.round(carry[i] || 0); pcm[i] = v > 32767 ? 32767 : v < -32768 ? -32768 : v; }
    fs.writeSync(fd, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength));
    carry = carry.slice(n * CH); carryAt += n;
  };
  const ensure = (upto) => { const need = (upto - carryAt) * CH; if (need > carry.length) { const c = new Float32Array(need); c.set(carry); carry = c; } };
  const sorted = [...segs].sort((a, b) => a.at - b.at);
  for (let k = 0; k < sorted.length; k++) {
    const seg = sorted[k], s = { ...segmentSamples(seg) };
    s.edgeIn = k === 0 ? Math.round(0.006 * RATE) : (!s.ovIn && !s.dipIn ? Math.round(0.003 * RATE) : 0);
    s.edgeOut = k === sorted.length - 1 ? Math.round(0.006 * RATE) : (!s.ovOut && !s.dipOut ? Math.round(0.003 * RATE) : 0);
    flush(Math.max(carryAt, s.at)); // everything before this segment's start is final now
    const skip = s.at < carryAt ? carryAt - s.at : 0; // never write before what is written (only by rounding)
    ensure(s.at + s.len);
    if (!seg.file) continue;
    const fh = fs.openSync(seg.file.file, 'r'), have = Math.floor(fs.fstatSync(fh).size / (CH * 2));
    const buf = Buffer.alloc(CHUNK * CH * 2), view = new Int16Array(buf.buffer, buf.byteOffset, CHUNK * CH);
    for (let i = skip; i < s.len; i += CHUNK) {
      const n = Math.min(CHUNK, s.len - i), srcI = i - seg.file.pre;
      const lo = Math.max(0, srcI), hi = Math.min(have, srcI + n);
      if (hi > lo) fs.readSync(fh, buf, 0, (hi - lo) * CH * 2, lo * CH * 2);
      for (let j = 0; j < n; j++) {
        const si = srcI + j;
        if (si < lo || si >= hi) continue;
        const g = gainAt(i + j, s), o = (s.at + i + j - carryAt) * CH, b = (si - lo) * CH;
        carry[o] += view[b] * g; carry[o + 1] += view[b + 1] * g;
      }
    }
    fs.closeSync(fh);
  }
  ensure(total); flush(total);
  fs.closeSync(fd);
  return seamLevels(out, total, joinsAt);
}

/** Loudness (RMS dBFS) 300 ms either side of every join, read back from the mixed sound: a seam that jumps in level shows. */
export function seamLevels(file, total, joinsAt) {
  const CH = 2, W = Math.round(0.3 * RATE), fd = fs.openSync(file, 'r');
  const rms = (a, b) => {
    a = Math.max(0, a); b = Math.min(total, b);
    if (b <= a) return -120;
    const buf = Buffer.alloc((b - a) * CH * 2);
    fs.readSync(fd, buf, 0, buf.length, a * CH * 2);
    const v = new Int16Array(buf.buffer, buf.byteOffset, (b - a) * CH);
    let sum = 0;
    for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
    const ms = sum / v.length;
    return ms > 0 ? Math.round(10 * Math.log10(ms / (32768 * 32768)) * 10) / 10 : -120;
  };
  const out = joinsAt.map((t) => { const at = Math.round(t * RATE), before_db = rms(at - W, at), after_db = rms(at, at + W); return { t: r3(t), before_db, after_db, step_db: Math.round((after_db - before_db) * 10) / 10 }; });
  fs.closeSync(fd);
  return out;
}

// ── render ──

/** Sources of an edit list read and words loaded: { infos, wordsBy, srcPath }. */
export async function readSources(edl, { base = process.cwd() } = {}) {
  const infos = {}, wordsBy = {}, paths = {};
  for (const [id, s] of Object.entries(edl.sources || {})) {
    const p = path.resolve(base, s.path || '');
    if (!fs.existsSync(p)) throw Object.assign(new Error(`Source ${id}: no file at ${p}.`), { code: 'NO_SOURCE' });
    paths[id] = p; infos[id] = await probe(p);
    if (s.words) wordsBy[id] = loadWords(typeof s.words === 'string' ? path.resolve(base, s.words) : s.words, +s.words_from || 0);
  }
  return { infos, wordsBy, srcPath: (id) => paths[id] };
}

/**
 * An edit list to a finished file. Refuses (code MID_SENTENCE) when a cut skips heard words of a sentence, unless
 * allow_mid_sentence. -> { file, plan, report } where report is check()'s answer plus the seam loudness.
 */
export async function render(edl, { base = process.cwd(), work = null, force = false, log = () => {}, only = null } = {}) {
  const src = await readSources(edl, { base });
  const plan = planCut(edl, src.infos, src.wordsBy);
  if (plan.problems.length && !force) throw Object.assign(new Error(`Not rendered: ${plan.problems.map((p) => p.message).join(' ')}`), { code: 'MID_SENTENCE', plan });
  const out = path.resolve(base, edl.output || 'cut.mp4');
  const dir = work || fs.mkdtempSync(path.join(os.tmpdir(), 'pp-cut-'));
  fs.mkdirSync(dir, { recursive: true });
  try {
    const file = await renderPlan(plan, { srcPath: src.srcPath, infos: src.infos, dir, out, log, only });
    const report = await check(file, { plan });
    return { file, plan, report };
  } finally { if (!work) fs.rmSync(dir, { recursive: true, force: true }); }
}

/** A plan to a file: picture pieces, the sound mix, the mux. opts.x264 / timescale make the pieces match another file's
 *  stream (a splice); opts.videoPieces renders only those pieces' indexes and returns their files instead of muxing. */
export async function renderPlan(plan, { srcPath, infos, dir, out, log = () => {}, x264 = null, timescale = null, soundOnly = false, videoPieces = null }) {
  const shape = { W: plan.W, H: plan.H, fps: plan.fps };
  const vfiles = [];
  if (!soundOnly) {
    for (let k = 0; k < plan.video.length; k++) {
      if (videoPieces && !videoPieces.includes(k)) continue;
      const f = path.join(dir, `v${String(k).padStart(4, '0')}.mp4`);
      log(`picture ${k + 1}/${plan.video.length}`);
      await renderPiece(plan.video[k], { srcPath, shape, quality: plan.quality, out: f, x264, timescale });
      const got = await packets(f);
      if (got.length !== plan.video[k].frames) throw Object.assign(new Error(`Picture piece ${k + 1} came out ${got.length} frames, the plan says ${plan.video[k].frames}.`), { code: 'PIECE_FRAMES' });
      vfiles.push(f);
    }
    if (videoPieces) return { vfiles };
  }
  const segs = [];
  for (let k = 0; k < plan.audio.length; k++) {
    const seg = plan.audio[k];
    log(`sound ${k + 1}/${plan.audio.length}`);
    segs.push({ ...seg, file: await extractSound(seg, { srcPath, info: infos[seg.src], out: path.join(dir, `a${String(k).padStart(4, '0')}.pcm`) }) });
  }
  const total = Math.round((plan.frames / plan.fps) * RATE), mix = path.join(dir, 'mix.pcm');
  plan.seam_levels = mixSound(segs, total, mix, plan.joins.map((j) => j.at));
  for (const s of segs) if (s.file) fs.rmSync(s.file.file, { force: true });
  if (soundOnly) return { mix };
  const list = path.join(dir, 'v.txt');
  fs.writeFileSync(list, vfiles.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
  log('joining');
  await ff(['-y', '-f', 'concat', '-safe', '0', '-i', list, '-f', 's16le', '-ar', String(RATE), '-ac', '2', '-i', mix, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-t', num(plan.frames / plan.fps), '-movflags', '+faststart', out]);
  return out;
}

// ── splice ──

/**
 * Replace base[from, to) with `section` (a finished file, or an edit list rendered first) and write `out`. Only the keyframe
 * groups the change touches are encoded again, with the base's own x264 settings so the stream stays one stream; the rest is
 * copied. When that cannot be done safely (not H.264 from x264, the parameter sets differ, the change covers most of the file)
 * it renders the whole file instead and says so. -> { file, mode: 'splice'|'full', reason?, window, report }.
 */
export async function splice({ base, from, to, section, out, quality = 'high', work = null, log = () => {}, noFull = false }) {
  const dir = work || fs.mkdtempSync(path.join(os.tmpdir(), 'pp-splice-'));
  fs.mkdirSync(dir, { recursive: true });
  try {
    const info = await probe(base), secInfo = await probe(section);
    if (!(to > from) || from < 0 || to > info.duration + 0.05) throw Object.assign(new Error(`The stretch ${from}-${to} s is not inside the file (${r3(info.duration)} s).`), { code: 'BAD_RANGE' });
    // the whole cut as an edit list: base before, the new stretch, base after (hard cuts; the sound blends over 12 ms)
    const clips = [
      // a change starting (or ending) under MIN_CLIP_S from the file's start (or end) takes that sliver with it
      ...(from >= MIN_CLIP_S ? [{ src: 'base', in: 0, out: from }] : []),
      { src: 'section', in: 0, out: secInfo.duration, seam: { type: 'cut', ms: SEAM_MS.cut.def } },
      ...(to <= info.duration - MIN_CLIP_S ? [{ src: 'base', in: to, out: info.duration, seam: { type: 'cut', ms: SEAM_MS.cut.def } }] : []),
    ];
    const edl = { sources: { base: { path: base }, section: { path: section } }, clips, quality };
    const infos = { base: info, section: secInfo }, srcPath = (id) => (id === 'base' ? base : section);
    const plan = planCut(edl, infos, {});
    const full = async (reason) => {
      if (noFull) throw Object.assign(new Error(`This version cannot take a new stretch on its own: ${reason}.`), { code: 'SPLICE_NOT_POSSIBLE' });
      log(`full render: ${reason}`);
      const file = await renderPlan(plan, { srcPath, infos, dir, out, log });
      return { file, mode: 'full', reason, report: await check(file, { plan }) };
    };
    if (info.codec !== 'h264') return await full(`the file is ${info.codec}, not H.264`);
    const hdr = await streamHeaders(base);
    if (!hdr.x264) return await full('the file was not made by x264, so a new stretch cannot match its stream');
    if (Math.abs(plan.fps - info.fps) > 0.01 || plan.W !== info.width || plan.H !== info.height) return await full('the file\'s size or frame rate is uneven');
    const pk = await packets(base);
    const keys = pk.filter((p) => p.key).map((p) => p.pts);
    // a sliver of the base between a keyframe and the change (under MIN_CLIP_S) cannot play on its own: reach to the keyframe before
    // (or after) instead, so the encoded stretch holds at least that much of the base on each side
    const kBefore = (t) => keys.filter((k) => k <= t + 1e-6).pop() ?? 0, kAfter = (t) => keys.find((k) => k >= t - 1e-6) ?? info.duration;
    const k0 = from - kBefore(from) > 0.001 && from - kBefore(from) < MIN_CLIP_S ? kBefore(Math.max(0, kBefore(from) - 0.001)) : null;
    const k1 = kAfter(to) - to > 0.001 && kAfter(to) - to < MIN_CLIP_S ? kAfter(kAfter(to) + 0.001) : null;
    const win0 = spliceWindow(keys, from, to, info.duration);
    const win = win0 && { ...win0, ...(k0 != null ? { k0, head: k0 } : {}), ...(k1 != null ? { k1: Math.min(k1, info.duration), tail: Math.max(0, info.duration - k1) } : {}) };
    if (!win) return await full('the change covers most of the file');

    // the middle: base[k0, from) + section + base[to, k1), encoded with the base's settings
    const mclips = [
      ...(from - win.k0 > 0.001 ? [{ src: 'base', in: win.k0, out: from }] : []),
      { src: 'section', in: 0, out: secInfo.duration, seam: { type: 'cut' } },
      ...(win.k1 - to > 0.001 ? [{ src: 'base', in: to, out: win.k1, seam: { type: 'cut' } }] : []),
    ];
    if (!mclips[0].seam) delete mclips[0].seam;
    let mplan;
    try { mplan = planCut({ sources: edl.sources, clips: mclips, quality }, infos, {}); }
    catch (e) { if (e.code !== 'CLIP_TOO_SHORT') throw e; return await full('the change starts or ends too close to the first or last keyframe'); }
    log(`encoding ${r3(mplan.out_dur)} s around the change, copying ${r3(win.head)} s before and ${r3(win.tail)} s after`);
    const { vfiles } = await renderPlan(mplan, { srcPath, infos, dir, out: null, log, x264: hdr.x264, timescale: info.timescale, videoPieces: mplan.video.map((_, k) => k) });
    let mh = await streamHeaders(vfiles[0]);
    if (mh.sps.join() === hdr.sps.join() && mh.pps.join() !== hdr.pps.join() && mh.pps.length === 1 && hdr.pps.length === 1) {
      // an x264 build that lowers the chroma offset differently: correct it by the difference once and encode the middle again
      const want = ppsFields(hdr.pps[0]), got = ppsFields(mh.pps[0]), d = want.chroma_qp - got.chroma_qp;
      const others = Object.keys(want).filter((k) => k !== 'chroma_qp' && want[k] !== got[k]);
      if (d && !others.length) {
        const fixed = hdr.x264.replace(/chroma-qp-offset=(-?\d+)/, (m0, x) => `chroma-qp-offset=${+x + d}`);
        log(`the stretch's chroma offset came out ${got.chroma_qp}, the file's is ${want.chroma_qp}: encoding it again`);
        for (const f of vfiles) fs.rmSync(f, { force: true });
        vfiles.splice(0, vfiles.length, ...(await renderPlan(mplan, { srcPath, infos, dir, out: null, log, x264: fixed, timescale: info.timescale, videoPieces: mplan.video.map((_, k) => k) })).vfiles);
        mh = await streamHeaders(vfiles[0]);
      }
    }
    if (mh.sps.join() !== hdr.sps.join() || mh.pps.join() !== hdr.pps.join()) {
      const diff = mh.pps[0] && hdr.pps[0] ? Object.entries(ppsFields(hdr.pps[0])).filter(([k, v]) => ppsFields(mh.pps[0])[k] !== v).map(([k]) => k).join(', ') : 'sps';
      console.error(`[footage] splice: the stretch's parameter sets differ from the file's (${diff || 'sps'})`);
      return await full(`the new stretch's stream settings do not match the file's (${diff || 'sequence'})`);
    }

    // head: the packets before the keyframe at k0 in decode order (a closed group of pictures ends right before it);
    // tail: from the keyframe at k1
    const files = [];
    const k0i = pk.findIndex((p) => p.key && Math.abs(p.pts - win.k0) < 1e-4);
    if (win.k0 > 0) {
      const head = path.join(dir, 'head.mp4');
      await ff(['-y', '-i', base, '-map', '0:v:0', '-c', 'copy', '-frames:v', String(k0i), '-video_track_timescale', String(info.timescale), head]);
      files.push(head);
    }
    files.push(...vfiles);
    if (win.k1 < info.duration - 1e-3) {
      const tail = path.join(dir, 'tail.mp4');
      await ff(['-y', '-ss', num(win.k1), '-i', base, '-map', '0:v:0', '-c', 'copy', '-avoid_negative_ts', 'make_zero', '-video_track_timescale', String(info.timescale), tail]);
      files.push(tail);
    }
    // the sound, rebuilt whole from the full plan (seconds of work even for an hour)
    const { mix } = await renderPlan(plan, { srcPath, infos, dir, out: null, log, soundOnly: true });
    const list = path.join(dir, 's.txt');
    fs.writeFileSync(list, files.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
    await ff(['-y', '-f', 'concat', '-safe', '0', '-i', list, '-f', 's16le', '-ar', String(RATE), '-ac', '2', '-i', mix, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-t', num(plan.frames / plan.fps), '-movflags', '+faststart', out]);
    const report = await check(out, { plan, around: [win.k0, win.k0 + mplan.out_dur] });
    if (!report.ok) {
      console.error(`[footage] splice check failed (${report.failures.join('; ')}): rendering the whole file instead`);
      return await full(`the spliced file failed its check (${report.failures.join('; ')})`);
    }
    return { file: out, mode: 'splice', window: { ...win, encoded_s: r3(mplan.out_dur) }, report };
  } finally { if (!work) fs.rmSync(dir, { recursive: true, force: true }); }
}

// ── check ──

/**
 * What a viewer would hit, read from the finished file: decode errors, the frame count against the plan, picture and sound
 * lengths, black stretches (in `around` only, when given: a splice checks the stretch it made), plus the plan's seam
 * levels and sentence problems. -> { ok, failures, frames, duration, black, decode_errors, seam_levels, sentences_cut }.
 */
export async function check(file, { plan = null, around = null } = {}) {
  const info = await probe(file), failures = [];
  const pk = await packets(file);
  const frames = pk.length;
  if (plan && frames !== plan.frames) failures.push(`${frames} frames, the plan says ${plan.frames}`);
  const { out: aOut } = await run(FP, ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=duration', '-of', 'csv=p=0', file]);
  const aDur = +aOut.toString().trim() || 0;
  if (plan && info.hasAudio && Math.abs(aDur - plan.frames / plan.fps) > 0.05) failures.push(`the sound is ${r3(aDur)} s, the picture ${r3(plan.frames / plan.fps)} s`);
  const range = around ? ['-ss', num(Math.max(0, around[0] - 1)), '-t', num(around[1] - around[0] + 2)] : [];
  let decode = '', black = [];
  try {
    const { err } = await run(FF, ['-hide_banner', '-nostdin', '-v', 'error', ...range, '-i', file, '-map', '0:v:0', '-vf', 'blackdetect=d=0.1:pix_th=0.08', '-f', 'null', '-'].map(String));
    decode = err;
  } catch (e) { decode = e.stderr || e.message; }
  // blackdetect logs at info level; run it again at info just for its lines (the error pass above catches broken frames)
  try {
    const { err } = await run(FF, ['-hide_banner', '-nostdin', '-v', 'info', ...range, '-i', file, '-map', '0:v:0', '-vf', 'blackdetect=d=0.1:pix_th=0.08', '-an', '-f', 'null', '-']);
    const off = around ? Math.max(0, around[0] - 1) : 0;
    black = [...err.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => ({ from: r3(+m[1] + off), to: r3(+m[2] + off) }));
  } catch (e) { console.error(`[footage] black check: ${e.message}`); }
  const decode_errors = decode.split(/\r?\n/).filter((l) => l && !/black_start/.test(l));
  if (decode_errors.length) failures.push(`${decode_errors.length} decode error line(s): ${decode_errors.slice(0, 2).join(' | ')}`);
  // black the edit list did not ask for (a dip is asked-for black)
  const dips = (plan?.joins || []).filter((j) => j.seam.type === 'dip').map((j) => [j.at - j.seam.ms / 1000, j.at + j.seam.ms / 1000]);
  const unasked = black.filter((b) => !dips.some(([a, z]) => b.from >= a - 0.1 && b.to <= z + 0.1));
  const steps = (plan?.seam_levels || []).filter((s) => Math.abs(s.step_db) >= 9 && s.before_db > -50 && s.after_db > -50);
  return {
    ok: !failures.length, failures, frames, duration: r3(info.duration), sound_s: r3(aDur), decode_errors: decode_errors.slice(0, 5),
    black: unasked, black_asked_for: black.length - unasked.length, seam_levels: plan?.seam_levels || [], loud_steps: steps,
    sentences_cut: plan ? plan.problems.length + plan.warnings.filter((w) => w.code === 'MID_SENTENCE').length : null,
  };
}

/** The report in plain words for Claude to pass on (and for the room's version notes). */
export function reportLines({ plan, report, mode = null, reason = null, window = null }) {
  const lines = [];
  if (plan) lines.push(planSummary(plan));
  if (mode === 'splice') lines.push(`Spliced: encoded ${window.encoded_s} s around the change and copied the rest (${window.head} s before, ${window.tail} s after).`);
  if (mode === 'full') lines.push(`Rendered whole: ${reason}.`);
  if (report) {
    lines.push(report.ok ? `Checked: ${report.frames} frames as planned, no decode errors, sound and picture the same length.` : `CHECK FAILED: ${report.failures.join('; ')}.`);
    lines.push(report.black.length ? `Black on screen: ${report.black.map((b) => `${clock(b.from)}-${clock(b.to)}`).join(', ')}.` : 'No black frames.');
    if (report.loud_steps.length) lines.push(`Level jumps at seams: ${report.loud_steps.map((s) => `${clock(s.t)} ${s.step_db > 0 ? '+' : ''}${s.step_db} dB`).join(', ')}.`);
  }
  for (const w of plan?.warnings || []) lines.push(`Note: ${w.message}`);
  for (const c of plan?.cues || []) lines.push(`Retention cue at ${clock(c.at)}: ${c.words} ("${c.said.slice(0, 60)}"). In Retti's data viewers leave more in the ~22 s after one (${c.lift}x, correlation only).`);
  return lines;
}
