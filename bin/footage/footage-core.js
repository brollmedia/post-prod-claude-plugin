// COPY of post-prod's server/footage-core.js, made by tools/build-plugin-footage.js. Change the original, then run that.
// The footage cut engine, pure part (2 Nov 2026, Edit with Claude on talking-head and YouTube footage, Seth picked plan A):
// the person's Claude decides WHAT plays (which takes, in what order, which seam), this code decides WHERE each cut lands and
// HOW the seams sound. Measured in Retti's Auto Editor: cuts set by judgement broke 389 of 1,129 sentences until the edges
// moved onto Whisper's word clock, and no model hears music or seams reliably (truth bench, 3 Oct). So an edge snaps to the
// gap between words, a cut that skips heard words of a sentence is refused, and J/L cuts, crossfades, dissolves and dips are
// arithmetic on the timeline, never a guess.
//
// No ffmpeg, no files, no network here: server/footage-run.js runs it, and the plugin ships a copy of both files
// (integrations/claude-code-plugin/bin/footage/, made by tools/build-plugin-footage.js) so the person's own computer cuts
// their footage at no cost to us. Keep this file free of imports other than node:* so the copy runs on its own.
//
// The edit list ("EDL") Claude writes:
//   { sources: { <id>: { path, words?: [{start,end,word}] | "<words.json>" } },
//     clips: [{ src, in, out, seam?: { type: 'cut'|'j'|'l'|'crossfade'|'dissolve'|'dip', ms } }],   seam = the join INTO this clip
//     output, quality?: 'draft'|'high', allow_mid_sentence?: false }

export const SEAMS = ['cut', 'j', 'l', 'crossfade', 'dissolve', 'dip'];
/** Default and allowed lengths of each seam, in milliseconds. A 'cut' still blends its sound over a few ms (a hard cut clicks). */
export const SEAM_MS = {
  cut: { def: 12, min: 6, max: 40 },
  j: { def: 400, min: 80, max: 2000 },
  l: { def: 400, min: 80, max: 2000 },
  crossfade: { def: 120, min: 20, max: 1000 },
  dissolve: { def: 500, min: 120, max: 2000 },
  dip: { def: 600, min: 200, max: 2000 },
};
/** The sound blend at the moved edge of a J or L cut (the voice comes in under the picture, so it must not pop). */
export const JL_BLEND_S = 0.04;
/** An edge moves at most this far to reach a gap between words; further and the plan says so instead. */
export const SNAP_MAX_S = 0.35;
/** Air kept before the first word of a clip and after its last (Whisper's word edges sit tight on the voice). */
export const PAD_IN_S = 0.1, PAD_OUT_S = 0.14;
export const MIN_CLIP_S = 0.25;
export const RATE = 48000;
/** Retention cues (Retti's content backtest, 4,790 videos, 150 channels, 20 Oct 2026): the only two transcript cues that beat
 *  chance as places viewers leave, measured ~22 s after the cue. Long-form only (8 min+); Shorts curves are a different
 *  population. Never a claim that an edit lifts retention. */
export const CUES = [
  { kind: 'subscribe_ask', lift: 1.9, re: /\b(subscribe|subscribed|hit (the )?(like|bell)|notification bell|smash (that|the) like|join (the|my) (channel|membership)|merch|patreon|link in (the )?(description|bio))\b/i, words: 'a subscribe, like or merch ask' },
  { kind: 'sponsor_read', lift: 1.6, re: /\b(sponsor(ed)?|brought to you by|thanks to .{0,30} for (sponsoring|supporting)|use (my )?code|promo code|discount code|percent off|% off)\b/i, words: 'a sponsor read' },
];
export const CUE_AFTER_S = 22, CUE_MIN_OUTPUT_S = 8 * 60;
const FILLERS = new Set(['um', 'uh', 'erm', 'er', 'ah', 'eh', 'hmm', 'mm', 'uhm', 'umm']);

const r3 = (x) => Math.round(x * 1000) / 1000;
const r6 = (x) => Math.round(x * 1e6) / 1e6;
export const clock = (s) => { const x = Math.max(0, +s || 0), m = Math.floor(x / 60), r = x - m * 60; return `${m}:${r.toFixed(1).padStart(4, '0')}`; };
const err = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });

// ── 1. the edit list, checked ──

/** The edit list in a clean shape, or a thrown error with a code and the clip's number. Sources' lengths come from `infos`
 *  ({ <id>: { duration, fps, width, height, hasAudio } }, from ffprobe). */
export function cleanEdl(edl, infos = {}) {
  if (!edl || typeof edl !== 'object') throw err('BAD_EDL', 'The edit list should be a JSON object with sources and clips.');
  const sources = edl.sources && typeof edl.sources === 'object' ? edl.sources : null;
  if (!sources || !Object.keys(sources).length) throw err('BAD_EDL', 'Give sources: { "<id>": { "path": "<file>" } } for every file the clips use.');
  if (!Array.isArray(edl.clips) || !edl.clips.length) throw err('BAD_EDL', 'Give clips: [{ "src", "in", "out" }] in play order.');
  const clips = edl.clips.map((c, i) => {
    const n = i + 1;
    if (!c || typeof c !== 'object') throw err('BAD_CLIP', `Clip ${n} should be an object with src, in and out.`, { clip: n });
    if (!sources[c.src]) throw err('BAD_CLIP', `Clip ${n}: no source "${c.src}" in sources.`, { clip: n });
    const D = +infos[c.src]?.duration;
    const tin = +c.in || 0, tout = c.out == null ? D : +c.out;
    if (!Number.isFinite(tin) || !Number.isFinite(tout) || tin < 0) throw err('BAD_CLIP_TIME', `Clip ${n}: in and out are seconds into its source.`, { clip: n });
    if (Number.isFinite(D) && tin >= D) throw err('CLIP_RANGE', `Clip ${n}: in (${tin}) is at or past the end of ${c.src} (${r3(D)} s).`, { clip: n });
    const out = Number.isFinite(D) ? Math.min(tout, D) : tout;
    if (!(out - tin >= MIN_CLIP_S)) throw err('CLIP_TOO_SHORT', `Clip ${n}: ${r3(out - tin)} s is too short to play (at least ${MIN_CLIP_S} s).`, { clip: n });
    const seam = cleanSeam(i === 0 ? null : c.seam, n);
    return { i, src: String(c.src), in: tin, out, seam, why: typeof c.why === 'string' ? c.why.slice(0, 200) : null };
  });
  return { sources, clips, output: edl.output || null, quality: edl.quality === 'draft' ? 'draft' : 'high', allow_mid_sentence: edl.allow_mid_sentence === true };
}

export function cleanSeam(s, n = 0) {
  if (s == null) return { type: 'cut', ms: SEAM_MS.cut.def };
  const type = typeof s === 'string' ? s : s.type;
  if (!SEAMS.includes(type)) throw err('BAD_SEAM', `Clip ${n}: seam "${type}" is not one of ${SEAMS.join(', ')}.`, { clip: n });
  const lim = SEAM_MS[type], ms = typeof s === 'object' && s.ms != null ? +s.ms : lim.def;
  if (!Number.isFinite(ms)) throw err('BAD_SEAM', `Clip ${n}: seam ms should be a number.`, { clip: n });
  return { type, ms: Math.max(lim.min, Math.min(lim.max, Math.round(ms))) };
}

// ── 2. words: Whisper's answer, tidied ──

/** Words sorted, with Whisper's zero-length words given a share of the word before (it folds a lost word into its
 *  neighbour; Retti 4 Oct: ~1 in 30 words). Each word gets `s` (its sentence number) and `filler`. */
export function tidyWords(raw, segments = null) {
  const w = (raw || []).map((x) => ({ start: +x.start, end: +x.end, word: String(x.word ?? x.text ?? '').trim() }))
    .filter((x) => Number.isFinite(x.start) && Number.isFinite(x.end) && x.word).sort((a, b) => a.start - b.start);
  for (let k = 0; k < w.length; k++) {
    if (w[k].end > w[k].start) continue;
    const prev = w[k - 1];
    if (prev && prev.end > prev.start && Math.abs(prev.end - w[k].start) < 0.05) {
      const share = (prev.end - prev.start) * (w[k].word.length / (w[k].word.length + prev.word.length));
      w[k].start = prev.end - share; prev.end = w[k].start;
    } else w[k].end = w[k].start + 0.05;
  }
  // where sentences end: Whisper's words carry no punctuation (2 Nov 2026, the bench: every join read as mid-sentence), so the
  // ends come from the punctuation of the transcript's lines, matched word by word; with no lines, a pause of PAUSE_END_S
  const ends = punctuated(w) ? null : segments && segments.length ? sentenceEndsFrom(w, segments) : pauseEnds(w);
  let s = 0;
  w.forEach((x, k) => {
    x.s = s;
    x.filler = FILLERS.has(x.word.toLowerCase().replace(/[^a-z]/g, ''));
    if (ends ? ends.has(k) : /[.?!]["')\]]?$/.test(x.word)) s++;
  });
  return w;
}

export const PAUSE_END_S = 0.8;
const END_RE = /[.?!]["')\]]*$/;
const tok = (s) => String(s).toLowerCase().replace(/[^a-z0-9']/g, '');
/** Whether the words carry their own sentence ends (at least one in 40 words ends one). */
const punctuated = (w) => w.length > 0 && w.filter((x) => END_RE.test(x.word)).length >= Math.max(1, w.length / 40);
/** Sentence ends from a pause alone. */
function pauseEnds(w) {
  const out = new Set();
  for (let k = 0; k + 1 < w.length; k++) if (w[k + 1].start - w[k].end >= PAUSE_END_S) out.add(k);
  if (w.length) out.add(w.length - 1);
  return out;
}
/**
 * The indexes of the words that end a sentence, from the transcript's lines: each line's words in order, a word followed by
 * . ? or ! ends one. Lines and words are matched token by token in time order, looking a few tokens ahead (the two can
 * differ: "40" against "forty", a dropped "um"), and resyncing further when they drift. segments: [{start,end,text}] or
 * [[start,end,text]].
 */
export function sentenceEndsFrom(w, segments) {
  const segs = segments.map((x) => (Array.isArray(x) ? { start: +x[0], end: +x[1], text: String(x[2] || '') } : { start: +x.start, end: +x.end, text: String(x.text || '') })).sort((a, b) => a.start - b.start);
  const toks = [];
  for (const sg of segs) for (const raw of sg.text.split(/\s+/)) { const n = tok(raw); if (n) toks.push({ n, end: END_RE.test(raw), at: sg.start }); }
  const out = new Set();
  let j = 0, miss = 0;
  for (let k = 0; k < w.length; k++) {
    const n = tok(w[k].word);
    if (!n) continue;
    const reach = miss >= 4 ? 40 : 6;
    let hit = -1;
    for (let d = 0; d < reach && j + d < toks.length; d++) if (toks[j + d].n === n) { hit = j + d; break; }
    if (hit < 0) { miss++; continue; }
    miss = 0;
    if (toks[hit].end) out.add(k);
    j = hit + 1;
  }
  if (w.length) out.add(w.length - 1);
  return out;
}

/** The index of the first word that ends after t (a binary search). */
const firstEndingAfter = (w, t) => { let lo = 0, hi = w.length; while (lo < hi) { const m = (lo + hi) >> 1; if (w[m].end <= t) lo = m + 1; else hi = m; } return lo; };

/**
 * An edge moved onto a gap between words. side 'in' starts a clip (keep air before the next word), 'out' ends one (keep air
 * after the last). An edge inside a word goes to the nearer side of it within SNAP_MAX_S; a word longer than that is not
 * cut through: the edge goes to the side the clip keeps less of and the plan says it moved. -> { t, moved, inWord }.
 */
export function snapEdge(words, t, side) {
  if (!words?.length) return { t, moved: 0, inWord: false };
  const k = firstEndingAfter(words, t), w = words[k];
  let x = t, inWord = false;
  if (w && w.start < t && t < w.end) {
    inWord = true;
    const before = t - w.start, after = w.end - t;
    // in: start before the word (keep it) or after it (drop it); out: end after the word (keep it) or before it (drop it)
    if (side === 'in') x = before <= SNAP_MAX_S && before <= after ? w.start : after <= SNAP_MAX_S ? w.end : w.start;
    else x = after <= SNAP_MAX_S && after <= before ? w.end : before <= SNAP_MAX_S ? w.start : w.end;
  }
  // air: an in-point sits PAD_IN_S before the next word (never before the previous word's end), an out-point PAD_OUT_S after
  // the last word (never past the next word's start): a cut on the word clock still breathes like an editor's
  const j = firstEndingAfter(words, x + 1e-6), next = words[j] && words[j].start >= x - 1e-6 ? words[j] : null, prev = j > 0 ? words[j - 1] : null;
  if (side === 'in' && next) x = Math.max(prev ? prev.end : 0, next.start - PAD_IN_S);
  if (side === 'out' && prev && prev.end <= x + 1e-6) x = Math.min(next ? next.start : Infinity, prev.end + PAD_OUT_S);
  return { t: r6(x), moved: r3(x - t), inWord };
}

/** Words of `w` heard between a and b (more than half of the word inside). */
export const wordsIn = (w, a, b) => (w || []).filter((x) => Math.min(b, x.end) - Math.max(a, x.start) > (x.end - x.start) / 2);

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9']/g, '');

/**
 * Sentence breaks at one join: the words a jump SKIPS of a sentence that is heard on that side (Retti's scorecard rule, 7 Oct:
 * a side counts only the words its jump skips, and only when some of that sentence is heard). Not a break: skipped fillers
 * ("um", or a whole "you know", "I mean"), and a restart (Retti's rule, 4 Oct: the skipped run is said again right after the
 * jump, in order; only its last word may be cut off or differ). 2 Nov 2026, the bench: "any skipped word recurs in the next 12"
 * let "to", "a", "the" through and passed 30 heard breaks. -> [{ side, src, sentence, skipped }].
 */
export const SOFT_FILLERS = new Set(['you know', 'i mean', 'kind of', 'sort of', 'like', 'so', 'well', 'basically', 'actually', 'literally', 'okay', 'ok', 'right', 'you know what i mean']);
/** Whether skipped tokens are a restart of what plays right after: all but the last said again, in order, from the first or second word. */
export function isRestart(skipped, played) {
  if (!skipped.length) return false;
  const need = skipped.length === 1 ? skipped : skipped.slice(0, -1);
  return [0, 1].some((k) => need.every((t, i) => played[k + i] === t));
}
const softOnly = (ws) => SOFT_FILLERS.has(ws.map((x) => norm(x.word)).join(' '));
export function joinBreaks(prev, next, wordsOf) {
  const out = [];
  const wa = wordsOf(prev.src), wb = wordsOf(next.src);
  const sameFlow = prev.src === next.src && Math.abs(next.in - prev.out) < 0.05;
  if (sameFlow) return out;
  const playedB = wordsIn(wb, next.in, next.out).slice(0, 12).map((x) => norm(x.word));
  if (wa?.length) {
    const heard = wordsIn(wa, prev.in, prev.out), last = heard[heard.length - 1];
    if (last) {
      const rest = wa.filter((x) => x.s === last.s && x.start >= prev.out - 0.02 && !heard.includes(x));
      const skipped = rest.filter((x) => !x.filler && !(prev.src === next.src && x.start >= next.in));
      const restart = isRestart(skipped.map((x) => norm(x.word)), playedB) || softOnly(skipped);
      if (skipped.length && !restart) out.push({ side: 'out', src: prev.src, sentence: last.s, skipped: skipped.map((x) => x.word).join(' '), at: r3(prev.out) });
    }
  }
  if (wb?.length) {
    const heard = wordsIn(wb, next.in, next.out), first = heard[0];
    if (first) {
      const before = wb.filter((x) => x.s === first.s && x.end <= next.in + 0.02 && !heard.includes(x));
      const skipped = before.filter((x) => !x.filler && !(prev.src === next.src && x.end <= prev.out));
      // a restart: the skipped opening is said again right after ("so we're going to- so we're going to")
      const restart = isRestart(skipped.map((x) => norm(x.word)), playedB) || softOnly(skipped);
      if (skipped.length && !restart) out.push({ side: 'in', src: next.src, sentence: first.s, skipped: skipped.map((x) => x.word).join(' '), at: r3(next.in) });
    }
  }
  return out;
}

// ── 3. the plan ──

/**
 * The plan for an edit list: every edge snapped to the word clock, the sentence check per join, the seams as timeline
 * arithmetic, and where each clip lands. infos: ffprobe per source; wordsBy: { <src>: tidied words }.
 * -> { fps, W, H, frames, out_dur, clips: [...], video: [...pieces], audio: [...segments], joins: [...], problems, warnings }
 */
export function planCut(edl, infos, wordsBy = {}) {
  const e = cleanEdl(edl, infos);
  const first = infos[e.clips[0].src] || {};
  if (!(first.width > 0 && first.height > 0)) throw err('NO_PICTURE', `Source ${e.clips[0].src} has no picture to set the size from.`);
  const fps = exactFps(+first.fps || 30), W = even(first.width), H = even(first.height);
  const wordsOf = (src) => wordsBy[src] || null;
  const warnings = [], problems = [];

  // 1) snap every edge onto the word clock (a clip that continues its neighbour in the same source is left alone)
  const clips = e.clips.map((c) => ({ ...c, asked: { in: c.in, out: c.out } }));
  for (let k = 0; k < clips.length; k++) {
    const c = clips[k], w = wordsOf(c.src), prev = clips[k - 1], next = clips[k + 1];
    if (!w) continue;
    const contIn = prev && prev.src === c.src && Math.abs(prev.asked.out - c.asked.in) < 0.05;
    const contOut = next && next.src === c.src && Math.abs(next.asked.in - c.asked.out) < 0.05;
    if (!contIn) { const s = snapEdge(w, c.in, 'in'); c.in = s.t; if (Math.abs(s.moved) > 0.02) c.snapped_in = s.moved; }
    if (!contOut) { const s = snapEdge(w, c.out, 'out'); c.out = Math.min(s.t, +infos[c.src]?.duration || Infinity); if (Math.abs(s.moved) > 0.02) c.snapped_out = s.moved; }
    if (c.out - c.in < MIN_CLIP_S) throw err('CLIP_TOO_SHORT', `Clip ${k + 1}: after moving its edges onto the gaps between words only ${r3(c.out - c.in)} s is left. Check its in and out.`, { clip: k + 1 });
  }

  // 2) whole frames, and where each clip lands
  let at = 0;
  for (const c of clips) {
    c.frames = Math.max(1, Math.round((c.out - c.in) * fps));
    c.out = r6(c.in + c.frames / fps);
    c.start = at / fps; c.end = (at + c.frames) / fps; at += c.frames;
  }
  const frames = at, out_dur = frames / fps;

  // 3) the sentence check at every join
  const joins = [];
  for (let k = 1; k < clips.length; k++) {
    const breaks = joinBreaks(clips[k - 1], clips[k], wordsOf);
    joins.push({ k, at: r3(clips[k].start), seam: clips[k].seam, breaks });
    for (const b of breaks) {
      const msg = `Join ${k} (${clock(clips[k].start)} in the cut): the ${b.side === 'out' ? `end of clip ${k}` : `start of clip ${k + 1}`} skips "${b.skipped}" of a sentence that is heard`;
      (e.allow_mid_sentence ? warnings : problems).push({ code: 'MID_SENTENCE', join: k, ...b, message: `${msg}. Move the edge to the sentence's ${b.side === 'out' ? 'end' : 'start'}, or set allow_mid_sentence if it is meant.` });
    }
  }

  // 4) the seams. A clip's in and out are where its SOUND starts and stops (on the word clock); a J or L cut moves the
  // PICTURE edge instead: J keeps the outgoing picture d longer over the incoming voice, L brings the incoming picture d
  // early over the outgoing voice. A blend (cut, crossfade, dissolve) overlaps both sides by half its length; a dip fades
  // each side to black (picture) and to silence (sound) inside the clips. Every seam needs footage past the edge (a
  // handle); without it the join falls back to a plain cut and the plan says so.
  const dur = (c) => +infos[c.src]?.duration || Infinity;
  const vshift = clips.map(() => 0), ov = clips.map(() => 0), dip = clips.map(() => 0);
  for (let k = 1; k < clips.length; k++) {
    const A = clips[k - 1], B = clips[k], s = B.seam, d = s.ms / 1000;
    const afterA = dur(A) - A.out, beforeB = B.in;
    const need = { cut: [d / 2, d / 2], crossfade: [d / 2, d / 2], dissolve: [d / 2, d / 2], dip: [0, 0], j: [d + JL_BLEND_S / 2, JL_BLEND_S / 2], l: [JL_BLEND_S / 2, d + JL_BLEND_S / 2] }[s.type];
    const shorter = Math.min(A.end - A.start, B.end - B.start);
    if (afterA < need[0] - 1e-6 || beforeB < need[1] - 1e-6) {
      if (s.type !== 'cut') warnings.push({ code: 'NO_HANDLE', join: k, message: `Join ${k}: a ${s.type === 'j' ? 'J cut' : s.type === 'l' ? 'L cut' : s.type} of ${s.ms} ms needs ${Math.round(Math.max(...need) * 1000)} ms of footage ${need[0] >= need[1] ? `after clip ${k}'s out` : `before clip ${k + 1}'s in`}, which the source does not have; made a plain cut instead.` });
      B.seam = { type: 'cut', ms: 0 }; continue; // no handle at all: a butt join, its sound faded over 3 ms each side
    }
    if ((s.type === 'dissolve' || s.type === 'j' || s.type === 'l' || s.type === 'dip') && d >= shorter * 0.8) {
      warnings.push({ code: 'SEAM_TOO_LONG', join: k, message: `Join ${k}: a ${s.ms} ms ${s.type} is about as long as a clip beside it; made a cut instead.` });
      B.seam = { type: 'cut', ms: SEAM_MS.cut.def }; ov[k] = SEAM_MS.cut.def / 1000; continue;
    }
    if (s.type === 'j') { vshift[k] = d; ov[k] = JL_BLEND_S; }
    else if (s.type === 'l') { vshift[k] = -d; ov[k] = JL_BLEND_S; }
    else if (s.type === 'dip') dip[k] = d;
    else ov[k] = d;
  }
  // the picture: join k is at output frame J[k]; clip k shows frames [J[k], J[k+1]) from its own source
  const J = clips.map((c, k) => (k === 0 ? 0 : Math.round(c.start * fps) + Math.round(vshift[k] * fps)));
  J.push(frames);
  for (let k = 0; k + 1 < J.length; k++) if (!(J[k + 1] > J[k])) throw err('SEAM_TOO_LONG', `Clip ${k + 1} is shorter than the J and L cuts on its two sides.`, { clip: k + 1 });
  const srcT = (k, f) => clips[k].in + (f - Math.round(clips[k].start * fps)) / fps; // source time of output frame f in clip k
  const picture_moves = flashFree(J, clips, infos, fps, srcT, warnings);
  const video = [];
  for (let k = 0; k < clips.length; k++) {
    const c = clips[k], dIn = k > 0 && clips[k].seam.type === 'dissolve' ? clips[k].seam.ms / 1000 : 0, dOut = k + 1 < clips.length && clips[k + 1].seam.type === 'dissolve' ? clips[k + 1].seam.ms / 1000 : 0;
    const fIn = Math.round((dIn / 2) * fps), fOut = Math.round((dOut / 2) * fps);
    if (dIn) {
      // the transition: fA frames before the join from A (run on into its handle past the join), fIn after from B
      const fA = Math.round((dIn / 2) * fps), a0 = J[k] - fA;
      video.push({ kind: 'dissolve', a: { src: clips[k - 1].src, t: r6(srcT(k - 1, a0)) }, b: { src: c.src, t: r6(srcT(k, a0)) }, frames: fA + fIn });
    }
    const f0 = J[k] + fIn, f1 = J[k + 1] - fOut;
    if (f1 - f0 < 1) throw err('SEAM_TOO_LONG', `Clip ${k + 1} is shorter than the dissolves on its two sides.`, { clip: k + 1 });
    video.push({
      kind: 'clip', clip: k, src: c.src, t: r6(srcT(k, f0)), frames: f1 - f0,
      ...(dip[k] ? { fadeIn: Math.max(1, Math.round((dip[k] / 2) * fps)) } : {}),
      ...(dip[k + 1] ? { fadeOut: Math.max(1, Math.round((dip[k + 1] / 2) * fps)) } : {}),
    });
  }
  // a dissolve piece is frames from both sides centred on the join: fix its frame count against the bodies around it
  const vFrames = video.reduce((n, p) => n + p.frames, 0);
  if (vFrames !== frames) throw err('PLAN_FRAMES', `Internal: the pieces hold ${vFrames} frames, the plan ${frames}.`);

  // the sound: segment k is its clip, reaching half a blend into each neighbour
  const audio = clips.map((c, k) => {
    const a = k > 0 ? ov[k] : 0, b = k + 1 < clips.length ? ov[k + 1] : 0;
    return { clip: k, src: c.src, from: r6(c.in - a / 2), to: r6(c.out + b / 2), at: r6(c.start - a / 2), ovIn: a, ovOut: b, dipIn: dip[k] || 0, dipOut: dip[k + 1] || 0 };
  });
  return {
    fps, W, H, frames, out_dur: r6(out_dur), quality: e.quality, output: e.output,
    clips: clips.map((c) => ({ i: c.i, src: c.src, in: r3(c.in), out: r3(c.out), start: r3(c.start), end: r3(c.end), frames: c.frames, seam: c.seam, asked: c.asked, ...(c.snapped_in ? { snapped_in: c.snapped_in } : {}), ...(c.snapped_out ? { snapped_out: c.snapped_out } : {}), ...(c.why ? { why: c.why } : {}) })),
    video, audio, joins, problems, warnings, ...(picture_moves.length ? { picture_moves } : {}),
    cues: cuesFor(clips, wordsOf, out_dur),
  };
}

/** Under this much of a shot at a picture edge reads as a flash, not a shot. */
export const FLASH_S = 0.4;
/**
 * A shot change in the source a few frames from a picture edge shows as a flash: 1-3 frames of a graphic or a cutaway
 * before the join (Seth, 2 Nov 2026: cavetown's tweet card at 0:09, 4 of its 13 joins). Edges sit on the word clock, which
 * cannot see the picture. Each picture join moves to the nearest frame where neither side shows under
 * FLASH_S of another shot; the sound stays where it is, so the move is a few frames of J or L. infos[src].shots: the
 * source's shot changes in seconds (readSources finds them near the edges); none known, nothing moves. Moves J in place;
 * -> [{ join, frames }] for the joins moved. A join with no clean frame within reach stays and the plan warns.
 */
export function flashFree(J, clips, infos, fps, srcT, warnings = []) {
  const moves = [], e = 0.5 / fps, M = Math.ceil(3 * FLASH_S * fps); // reach: the stray shot plus a whole FLASH_S of the other side
  const half = (k) => (clips[k]?.seam?.type === 'dissolve' ? Math.round((clips[k].seam.ms / 2000) * fps) : 0);
  for (let k = 1; k < clips.length; k++) {
    const sA = infos[clips[k - 1].src]?.shots || [], sB = infos[clips[k].src]?.shots || [];
    if (!sA.length && !sB.length) continue;
    const durA = +infos[clips[k - 1].src]?.duration || Infinity;
    // A shows source frames [a0, ta), B shows [tb, b1) (a dissolve: each runs on half the blend past the join): a shot change
    // inside either, under FLASH_S from where it stops showing, is a flash
    const h = half(k);
    const flashA = (Jk) => { const ta = srcT(k - 1, Jk + h), a0 = srcT(k - 1, J[k - 1]); return sA.some((s) => s > ta - FLASH_S && s < ta - e && s > a0 + e); };
    const flashB = (Jk) => { const tb = srcT(k, Jk - h), b1 = srcT(k, J[k + 1]); return sB.some((s) => s > tb + e && s < tb + FLASH_S && s < b1 - e); };
    const fA = flashA(J[k]), fB = flashB(J[k]);
    if (!fA && !fB) continue;
    // the stray shot is cut away, never shown longer: a flash at A's end moves the join earlier (A ends before it), one at
    // B's start later (B starts after it); both, either way
    const steps = fA && !fB ? [-1] : fB && !fA ? [1] : [-1, 1];
    const lo = J[k - 1] + half(k - 1) + h + 2, hi = J[k + 1] - half(k + 1) - h - 2;
    let best = null;
    for (let m = 1; m <= M && best == null; m++) {
      for (const d of steps) {
        const Jk = J[k] + d * m;
        if (Jk <= lo || Jk >= hi || srcT(k, Jk - h) < 0 || srcT(k - 1, Jk + h) > durA) continue;
        if (!flashA(Jk) && !flashB(Jk)) { best = Jk; break; }
      }
    }
    if (best == null) { warnings.push({ code: 'FLASH_FRAMES', join: k, message: `Join ${k}: the source changes shot a few frames from the join and no nearby frame avoids it; a short flash of the other shot may show. Move the edge a little.` }); continue; }
    moves.push({ join: k, frames: best - J[k] });
    J[k] = best;
  }
  return moves;
}

// ── 4. retention cues on the cut ──

/** The measured cues in the cut, at their time in the output: [{ kind, at, window: [from, to], words, lift, said }].
 *  None below CUE_MIN_OUTPUT_S (Shorts and short pieces are a different population). */
export function cuesFor(clips, wordsOf, outDur) {
  if (!(outDur >= CUE_MIN_OUTPUT_S)) return [];
  const out = [];
  for (const c of clips) {
    const w = wordsOf(c.src);
    if (!w) continue;
    const heard = wordsIn(w, c.in, c.out);
    const bySentence = new Map();
    for (const x of heard) { if (!bySentence.has(x.s)) bySentence.set(x.s, []); bySentence.get(x.s).push(x); }
    for (const ws of bySentence.values()) {
      const text = ws.map((x) => x.word).join(' ');
      for (const cue of CUES) {
        if (!cue.re.test(text)) continue;
        const at = c.start + (ws[0].start - c.in);
        if (out.some((o) => o.kind === cue.kind && Math.abs(o.at - at) < 30)) continue;
        out.push({ kind: cue.kind, at: r3(at), window: [r3(at), r3(Math.min(outDur, at + CUE_AFTER_S + 10))], words: cue.words, lift: cue.lift, said: text.slice(0, 160) });
      }
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

// ── 5. the sound mix: equal-power blends, sample-exact ──

/** Sample counts of a segment: where it starts in the output, how long it is, its blend lengths. */
export function segmentSamples(seg) {
  const at = Math.round(seg.at * RATE), len = Math.round((seg.to - seg.from) * RATE);
  return { at, len, ovIn: Math.round(seg.ovIn * RATE), ovOut: Math.round(seg.ovOut * RATE), dipIn: Math.round(seg.dipIn * RATE / 2), dipOut: Math.round(seg.dipOut * RATE / 2) };
}
/** The gain of a segment's sample i (of len): equal-power in over ovIn, out over ovOut; a dip fades to silence over half its
 *  length on each side; the first and last 6 ms of the whole cut fade so it never starts or ends on a click. */
export function gainAt(i, s) {
  let g = 1;
  if (s.ovIn > 0 && i < s.ovIn) g *= Math.sin((Math.PI / 2) * ((i + 0.5) / s.ovIn));
  if (s.ovOut > 0 && i >= s.len - s.ovOut) g *= Math.cos((Math.PI / 2) * ((i - (s.len - s.ovOut) + 0.5) / s.ovOut));
  if (s.dipIn > 0 && i < s.dipIn) g *= (i + 0.5) / s.dipIn;
  if (s.dipOut > 0 && i >= s.len - s.dipOut) g *= (s.len - i - 0.5) / s.dipOut;
  if (s.edgeIn > 0 && i < s.edgeIn) g *= (i + 0.5) / s.edgeIn;
  if (s.edgeOut > 0 && i >= s.len - s.edgeOut) g *= (s.len - i - 0.5) / s.edgeOut;
  return g;
}

// ── 6. splicing: change one stretch of a finished file, copy the rest ──

/**
 * Where to splice a new stretch into a file whose keyframes are `keys` (seconds, sorted): the copied head ends at the last
 * keyframe at or before `from`, the copied tail starts at the first keyframe at or after `to`. Everything between is encoded
 * again (the frames of the base around the change plus the new stretch). -> { k0, k1, head, tail } or null when the change
 * covers most of the file (a full render is then as fast).
 */
export function spliceWindow(keys, from, to, dur, { minCopy = 0.25 } = {}) {
  const ks = (keys || []).filter((k) => Number.isFinite(k)).sort((a, b) => a - b);
  if (!ks.length) return null;
  let k0 = 0;
  for (const k of ks) if (k <= from + 1e-6) k0 = k; else break;
  const k1 = ks.find((k) => k >= to - 1e-6) ?? dur;
  const copied = k0 + (dur - k1);
  if (copied < Math.max(minCopy * dur, 1)) return null;
  return { k0: r6(k0), k1: r6(Math.min(k1, dur)), head: r6(k0), tail: r6(Math.max(0, dur - k1)) };
}

/** x264's own settings string (it writes them in the stream as an SEI), as -x264-params, so a re-encoded stretch gets the
 *  same SPS/PPS as the file it goes into. null when the file was not made by x264. */
export function x264ParamsFrom(seiText) {
  const m = /options:\s*([^\0\n]+)/.exec(seiText || '');
  if (!m) return null;
  // the rate control too: the picture parameter set's starting QP comes from it (a stretch at crf 16 in a file made at crf 23
  // gets a different PPS, and its slices would decode wrong against the file's)
  const keep = ['crf', 'qp', 'bitrate', 'vbv_maxrate', 'vbv_bufsize', 'ip_ratio', 'pb_ratio', 'cabac', 'ref', 'deblock', 'analyse', 'me', 'subme', 'psy', 'mixed_ref', 'me_range', 'chroma_me', 'trellis', '8x8dct', 'cqm', 'deadzone', 'fast_pskip', 'chroma_qp_offset', 'decimate', 'interlaced', 'bluray_compat', 'constrained_intra', 'bframes', 'b_pyramid', 'b_adapt', 'b_bias', 'direct', 'weightb', 'open_gop', 'weightp', 'keyint', 'keyint_min', 'scenecut', 'intra_refresh', 'rc_lookahead', 'mbtree', 'qcomp', 'qpmin', 'qpmax', 'qpstep', 'aq'];
  const rc = /\brc=(\w+)/.exec(m[1])?.[1] || 'crf';
  // x264 lowers the chroma QP offset by 1 or 2 for each of psy-rd and psy-trellis (when on) and writes the lowered value here;
  // asked for as written it would lower it again (2 Nov 2026, the live splice: -2 became -4 and the PPS no longer matched)
  const opt = (k) => (m[1].split(/\s+/).find((kv) => kv.startsWith(`${k}=`)) || '').slice(k.length + 1) || null;
  const [psyRd, psyTrellis] = String(opt('psy_rd') || '0:0').split(':').map(Number);
  const psyOn = opt('psy') === '1', subme = +opt('subme') || 0, trellis = +opt('trellis') || 0;
  const psyLift = (psyOn && psyRd > 0 && subme >= 6 ? (psyRd < 0.25 ? 1 : 2) : 0) + (psyOn && psyTrellis > 0 && trellis > 0 ? (psyTrellis < 0.25 ? 1 : 2) : 0);
  const map = { ip_ratio: 'ipratio', pb_ratio: 'pbratio', vbv_maxrate: 'vbv-maxrate', vbv_bufsize: 'vbv-bufsize', analyse: 'partitions', me: 'me', '8x8dct': '8x8dct', mixed_ref: 'mixed-refs', me_range: 'merange', chroma_me: 'chroma-me', fast_pskip: 'fast-pskip', chroma_qp_offset: 'chroma-qp-offset', b_pyramid: 'b-pyramid', b_adapt: 'b-adapt', b_bias: 'b-bias', open_gop: 'open-gop', keyint_min: 'min-keyint', rc_lookahead: 'rc-lookahead', intra_refresh: 'intra-refresh', bluray_compat: 'bluray-compat', constrained_intra: 'constrained-intra' };
  const out = [];
  for (const kv of m[1].trim().split(/\s+/)) {
    const [k, v] = kv.split('=');
    if (!keep.includes(k) || v == null) continue;
    if (k === 'analyse' || k === 'psy' || k === 'cqm' || k === 'deadzone' || k === 'aq' || k === 'interlaced' || k === 'decimate' || k === 'qcomp') continue; // not settable 1:1, and not in the SPS/PPS
    if (k === 'keyint' && v === 'infinite') continue;
    if ((k === 'crf' && rc !== 'crf') || (k === 'qp' && rc !== 'cqp') || (k === 'bitrate' && !['abr', 'cbr', '2pass'].includes(rc))) continue;
    if (k === 'chroma_qp_offset') { out.push(`chroma-qp-offset=${+v + psyLift}`); continue; }
    if (k === 'deblock') { const [on, a, b] = v.split(':'); out.push(on === '0' ? 'no-deblock=1' : `deblock=${a},${b}`); continue; }
    out.push(`${map[k] || k}=${v.replace(/:/g, ',')}`);
  }
  return out.join(':');
}

/** The fields of an H.264 picture parameter set (hex of the NAL unit, header byte included) that x264 settings decide. */
export function ppsFields(hex) {
  const b = Buffer.from(hex, 'hex').subarray(1);
  let pos = 0;
  const bit = () => { const v = (b[pos >> 3] >> (7 - (pos & 7))) & 1; pos++; return v; };
  const bits = (n) => { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | bit(); return v; };
  const ue = () => { let z = 0; while (bit() === 0 && z < 32) z++; return (1 << z) - 1 + bits(z); };
  const se = () => { const k = ue(); return k & 1 ? (k + 1) / 2 : -(k / 2); };
  const o = { pps_id: ue(), sps_id: ue(), cabac: bit(), bottom_field_pic_order: bit(), slice_groups: ue() };
  if (o.slice_groups) return o;
  Object.assign(o, { ref_l0: ue(), ref_l1: ue(), weighted_pred: bit(), weighted_bipred: bits(2), init_qp: se(), init_qs: se(), chroma_qp: se(), deblock_control: bit(), constrained_intra: bit(), redundant_pic_cnt: bit() });
  return o;
}

// ── helpers ──

export function exactFps(f) {
  for (const den of [24000 / 1001, 30000 / 1001, 48000 / 1001, 60000 / 1001, 120000 / 1001]) if (Math.abs(f - den) < 0.01) return den;
  return Math.abs(f - Math.round(f)) < 0.01 ? Math.round(f) : f;
}
export function fpsArg(fps) {
  for (const [base, den] of [[24, 24000 / 1001], [30, 30000 / 1001], [48, 48000 / 1001], [60, 60000 / 1001], [120, 120000 / 1001]]) if (Math.abs(fps - den) < 1e-6) return `${base * 1000}/1001`;
  return Number.isInteger(fps) ? String(fps) : String(Math.round(fps * 1e6) / 1e6);
}
const even = (x) => Math.max(2, Math.round(x / 2) * 2);

/** What the plan did, in plain words for Claude to pass on. */
export function planSummary(p) {
  const kinds = {};
  for (const j of p.joins) kinds[j.seam.type] = (kinds[j.seam.type] || 0) + 1;
  const seams = Object.entries(kinds).map(([k, n]) => `${n} ${k === 'cut' ? 'hard' : k === 'j' ? 'J' : k === 'l' ? 'L' : k}${n === 1 ? '' : 's'}`).join(', ');
  const moved = p.clips.filter((c) => c.snapped_in || c.snapped_out).length;
  return `${p.clips.length} clips, ${clock(p.out_dur)} long${seams ? `; seams: ${seams}` : ''}; ${moved} clip${moved === 1 ? '' : 's'} had an edge moved onto a gap between words; ${p.problems.length} sentence${p.problems.length === 1 ? '' : 's'} cut mid-way${p.problems.length ? ' (refused)' : ''}.`;
}
