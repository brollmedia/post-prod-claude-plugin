// COPY of post-prod's server/footage-fx.js, made by tools/build-plugin-footage.js. Change the original, then run that.
// Effects on a stretch of footage (2 Nov 2026, Edit with Claude on footage): the edits a YouTuber asks for that are not cuts.
// A title, a checklist that ticks in line by line, subtitles from the words, a graphic (a cutaway or a box), a zoom into an
// area, a blur over an area. Claude says WHAT and WHEN in an effect list; this builds one ffmpeg pass with the sound copied
// untouched, so the result goes back as a section (upload_section) and only that stretch is re-encoded. graphic() turns an
// HTML animation (what Claude is good at making) into video in the person's own Chrome or Edge, frame by frame on a clock it
// controls, so a 60 fps animation comes out smooth however slow the machine. Pure node + ffmpeg; copied into the plugin by
// tools/build-plugin-footage.js.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { run, probe, FF, loadWords } from './footage-run.js';
import { levelGain, UNDER_VOICE } from './harness-sound.js';

const err = (code, message) => Object.assign(new Error(message), { code });
const num = (x) => (Math.round(x * 1e6) / 1e6).toString();
const even = (x) => Math.max(2, 2 * Math.round(x / 2));
export const FX_TYPES = ['title', 'checklist', 'subtitles', 'graphic', 'zoom', 'blur'];
export const POSITIONS = ['top', 'center', 'bottom', 'lower-third', 'left', 'right'];

// ── fonts: drawtext needs a file; the person's own system fonts, bold first ──
const FONT_CANDIDATES = [
  'C:/Windows/Fonts/segoeuib.ttf', 'C:/Windows/Fonts/arialbd.ttf',
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/Library/Fonts/Arial Bold.ttf', '/System/Library/Fonts/Helvetica.ttc',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
];
export function findFont(asked = null) {
  for (const f of [asked, process.env.PP_FONT, ...FONT_CANDIDATES]) if (f && fs.existsSync(f)) return f;
  return null; // drawtext's own default (fontconfig): works, plainer
}
// a path inside a filter graph: ':' and '\' and ''' escaped, forward slashes
const fpath = (p) => p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");

/** Clean an effect list against the input's size and length: every layer has a known type, a time inside the file, areas
 *  as fractions of the frame. Throws BAD_EFFECT with what to fix. */
export function cleanEffects(spec, info) {
  const D = +info.duration || 0, out = [];
  const layers = Array.isArray(spec?.layers) ? spec.layers : [];
  if (!layers.length) throw err('BAD_EFFECT', 'The effect list has no layers.');
  const area = (a, k) => {
    if (!Array.isArray(a) || a.length !== 4 || a.some((v) => !Number.isFinite(+v))) throw err('BAD_EFFECT', `Layer ${k + 1}: "area" is [x, y, w, h] as fractions of the frame (0-1).`);
    const [x, y, w, h] = a.map(Number);
    if (w <= 0.02 || h <= 0.02 || x < 0 || y < 0 || x + w > 1.0001 || y + h > 1.0001) throw err('BAD_EFFECT', `Layer ${k + 1}: the area [${a.join(', ')}] is not inside the frame.`);
    return [x, y, w, h];
  };
  layers.forEach((l, k) => {
    if (!FX_TYPES.includes(l?.type)) throw err('BAD_EFFECT', `Layer ${k + 1}: type must be one of ${FX_TYPES.join(', ')}.`);
    const from = Math.max(0, +(l.from ?? 0)), to = Math.min(D, +(l.to ?? D));
    if (!(to - from >= 0.1)) throw err('BAD_EFFECT', `Layer ${k + 1} (${l.type}): from ${l.from} to ${l.to} is not a stretch inside the file (0-${num(D)} s).`);
    const c = { type: l.type, from, to };
    if (l.type === 'title') { if (!String(l.text || '').trim()) throw err('BAD_EFFECT', `Layer ${k + 1}: a title needs "text".`); Object.assign(c, { text: String(l.text).slice(0, 200), sub: l.sub ? String(l.sub).slice(0, 200) : null, position: POSITIONS.includes(l.position) ? l.position : 'center' }); }
    if (l.type === 'checklist') {
      const items = (Array.isArray(l.items) ? l.items : []).map((s) => String(s).slice(0, 80)).filter(Boolean).slice(0, 8);
      if (!items.length) throw err('BAD_EFFECT', `Layer ${k + 1}: a checklist needs "items".`);
      // each item appears at its time (given, or spread over the first two thirds) and is ticked half a second later
      const at = items.map((_, i) => (Array.isArray(l.at) && Number.isFinite(+l.at[i]) ? Math.max(from, Math.min(to - 0.3, +l.at[i])) : from + ((to - from) * 0.66 * i) / items.length));
      Object.assign(c, { items, at, title: l.title ? String(l.title).slice(0, 80) : null, position: l.position === 'right' ? 'right' : 'left', area: Array.isArray(l.area) ? area(l.area, k) : null });
    }
    if (l.type === 'subtitles') Object.assign(c, { words: l.words || spec.words || null, words_from: +(l.words_from ?? spec.words_from ?? 0) || 0 });
    if (l.type === 'graphic') {
      if (!l.file) throw err('BAD_EFFECT', `Layer ${k + 1}: a graphic needs "file" (an image or a video; graphic makes one from HTML).`);
      Object.assign(c, { file: l.file, mode: l.mode === 'box' ? 'box' : 'full', area: l.mode === 'box' ? area(l.area || [0.55, 0.05, 0.4, 0.4], k) : null, fade: Math.max(0, Math.min(1, +(l.fade ?? 0.25))) });
    }
    if (l.type === 'zoom') Object.assign(c, { area: area(l.area, k), ease: Math.max(0, Math.min((to - from) / 2, +(l.ease ?? 0.4))) });
    if (l.type === 'blur') Object.assign(c, { area: area(l.area, k), strength: Math.max(4, Math.min(60, +(l.strength ?? 24))) });
    out.push(c);
  });
  // a zoom changes the whole picture: two at once would fight
  const zs = out.filter((l) => l.type === 'zoom').sort((a, b) => a.from - b.from);
  for (let i = 1; i < zs.length; i++) if (zs[i].from < zs[i - 1].to) throw err('BAD_EFFECT', 'Two zooms overlap in time; make one end before the next starts.');
  return out;
}

/** Text sized to fit maxW: drawtext neither wraps nor shrinks (a long title ran off both edges, 2 Nov 2026). Shrinks to
 *  fit, down to 70% of the asked size; past that, two lines broken at the space nearest the middle. A bold face averages
 *  about 0.56 of its size per character. -> { text, size, lines } */
export function fitText(text, size, maxW) {
  const w = (t, z) => t.length * 0.56 * z;
  if (w(text, size) <= maxW) return { text, size, lines: 1 };
  const shrunk = maxW / (text.length * 0.56);
  const sp = [...text.matchAll(/ /g)].map((m) => m.index);
  if (shrunk >= size * 0.7 || !sp.length) return { text, size: Math.max(8, shrunk), lines: 1 };
  const at = sp.reduce((b, i) => (Math.abs(i - text.length / 2) < Math.abs(b - text.length / 2) ? i : b), sp[0]);
  const two = [text.slice(0, at), text.slice(at + 1)], longest = Math.max(...two.map((t) => t.length));
  return { text: two.join('\n'), size: Math.max(8, Math.min(size, maxW / (longest * 0.56))), lines: 2 };
}

/** Subtitle lines from words: at most 7 words or 2.8 s a line, broken at pauses of 0.5 s or more and where a sentence ends
 *  (the engine's words carry their sentence as s; a line ran two together, 2 Nov 2026). Times in the file's clock. */
export function subtitleLines(words, from, to, offset = 0) {
  const ws = (words || []).map((w) => ({ t: +w.start - offset, e: +w.end - offset, w: String(w.word ?? w.text ?? '').trim(), s: w.s })).filter((w) => w.w && w.e > from && w.t < to);
  const lines = []; let cur = null;
  for (const w of ws) {
    if (cur && (cur.n >= 7 || w.e - cur.t > 2.8 || w.t - cur.e >= 0.5 || (w.s != null && cur.s != null && w.s !== cur.s))) { lines.push(cur); cur = null; }
    if (!cur) cur = { t: Math.max(from, w.t), e: w.e, text: w.w, n: 1, s: w.s };
    else { cur.text += ` ${w.w}`; cur.e = w.e; cur.n++; }
  }
  if (cur) lines.push(cur);
  // each line stays up until the next starts (a short gap) or 0.6 s after its last word
  return lines.map((l, i) => ({ t: l.t, e: Math.min(to, i + 1 < lines.length ? Math.min(lines[i + 1].t, l.e + 0.6) : l.e + 0.6), text: l.text }));
}

/** The filter graph for cleaned layers on a W×H picture. inputs: extra input files in order (graphics). -> { graph, inputs, texts }
 *  texts: [{ file, text }] the caller writes (drawtext reads them from files, so no text needs escaping). */
// How text looks (3 Nov 2026, Seth: "flexible, because the graphic we make will be for all different styles/niches ... if things
// AREN'T specified ... we dont default back to slop"): whatever the spec's style says wins (any font, colour, accent, a box or not).
// With nothing said, no half-black box behind the words (white system bold on a box was the template look every video got): a
// soft edge and a shadow give the contrast instead. -> { color, accent, box }
export function styleOf(spec = {}) {
  const st = spec && typeof spec.style === 'object' && spec.style ? spec.style : {};
  const colour = (c, d) => { let v = String(c ?? '').trim(); if (/^#[0-9a-f]{3}$/i.test(v)) v = `#${[...v.slice(1)].map((x) => x + x).join('')}`; return /^(#[0-9a-f]{6}|0x[0-9a-f]{6}|[a-z]{3,20})$/i.test(v) ? v.replace(/^#/, '0x') : d; };
  const box = st.box === true ? 0.55 : Number.isFinite(+st.box) && +st.box > 0 && +st.box <= 1 ? +st.box : 0;
  return { color: colour(st.color, 'white'), fixedColor: colour(st.color, null) != null, accent: colour(st.accent, null), box };
}
export function fxGraph(layers, { W, H, fps, font = null, wordsOf = () => null, dir, style = styleOf() }) {
  const parts = [], inputs = [], texts = [];
  let cur = '[0:v]', n = 0;
  const next = () => `[v${++n}]`;
  const ease = (a, b, e) => (e > 0 ? `if(lt(t,${num(a)}),0,if(lt(t,${num(a + e)}),(1-cos(PI*(t-${num(a)})/${num(e)}))/2,if(lt(t,${num(b - e)}),1,if(lt(t,${num(b)}),(1+cos(PI*(t-${num(b - e)})/${num(e)}))/2,0))))` : `between(t,${num(a)},${num(b)})`);
  const fade = (a, b, f = 0.25) => `if(lt(t,${num(a + f)}),(t-${num(a)})/${num(f)},if(gt(t,${num(b - f)}),(${num(b)}-t)/${num(f)},1))`;
  const fontArg = font ? `fontfile='${fpath(font)}':` : '';
  const text = (s) => { const f = path.join(dir, `t${texts.length}.txt`); texts.push({ file: f, text: s }); return `textfile='${fpath(f)}'`; };
  // the words read on the picture behind them (each layer's ink, measured from its frames by applyEffects; 3 Nov 2026: white words
  // with an outline looked like a meme on a bright frame and vanished on white): dark ink on a bright picture, white with a light
  // shadow on a dark one, a faint bar only on a busy middle. A box or colour in the spec's style wins over all of it.
  const inkColour = (ink) => (style.fixedColor ? style.color : ink === 'dark' ? '0x161616' : style.color);
  const look = (size, box, ink) => (style.box > 0 ? `box=1:boxcolor=black@${Math.min(1, box ?? style.box)}:boxborderw=${Math.round(size * 0.45)}`
    : ink === 'mid' && !style.fixedColor ? `box=1:boxcolor=black@0.32:boxborderw=${Math.round(size * 0.35)}`
      : ink === 'dark' && !style.fixedColor ? 'shadowcolor=white@0.25:shadowx=0:shadowy=1'
        : `shadowcolor=black@0.5:shadowx=0:shadowy=${Math.max(1, Math.round(size * 0.04))}`);
  const draw = (s, { x, y, size, a, b, ink = 'light', color = inkColour(ink), box = null, alpha = null }) => `drawtext=${fontArg}${text(s)}:fontsize=${Math.round(size)}:fontcolor=${color}:x=${x}:y=${y}:${look(size, box, ink)}:alpha='${alpha || fade(a, b)}':enable='between(t,${num(a)},${num(b)})'`;
  // 1) the picture itself: zooms, then blurs (a blur follows the zoomed picture, as the viewer sees it)
  for (const l of layers.filter((x) => x.type === 'zoom')) {
    const [ax, ay, aw, ah] = l.area, Z = Math.min(1 / aw, 1 / ah, 4), cx = ax + aw / 2, cy = ay + ah / 2, p = ease(l.from, l.to, l.ease);
    const z = `(1+${num(Z - 1)}*(${p}))`;
    const o = next();
    // scaled up by z, a W×H window kept around the area's centre (which moves from the frame's centre as z grows).
    // crop's in_w/in_h are fixed at setup (the unzoomed size), so the zoomed size is spelled out as W*z, H*z.
    const iw = `${W}*${z}`, ih = `${H}*${z}`;
    parts.push(`${cur}scale=w='${iw}':h='${ih}':eval=frame:flags=bicubic,crop=w=${W}:h=${H}:x='max(0,min(${iw}-${W},(0.5+(${num(cx)}-0.5)*(${p}))*${iw}-${W / 2}))':y='max(0,min(${ih}-${H},(0.5+(${num(cy)}-0.5)*(${p}))*${ih}-${H / 2}))',setsar=1${o}`);
    cur = o;
  }
  for (const l of layers.filter((x) => x.type === 'blur')) {
    const [ax, ay, aw, ah] = l.area, x = even(ax * W), y = even(ay * H), w = Math.min(even(aw * W), W - x), h = Math.min(even(ah * H), H - y);
    const a = next(), b = next(), o = next();
    parts.push(`${cur}split${a}${b}`, `${b}crop=${w}:${h}:${x}:${y},boxblur=${Math.round(l.strength)}:2${b.replace(']', 'b]')}`, `${a}${b.replace(']', 'b]')}overlay=${x}:${y}:enable='between(t,${num(l.from)},${num(l.to)})'${o}`);
    cur = o;
  }
  // 2) graphics over the picture
  for (const l of layers.filter((x) => x.type === 'graphic')) {
    const idx = inputs.length + 1, still = /\.(png|jpe?g|webp|gif)$/i.test(l.file);
    inputs.push(still ? ['-loop', '1', '-t', num(l.to - l.from + 0.1), '-i', l.file] : ['-i', l.file]);
    l.input = still ? null : idx;
    const [bx, by, bw, bh] = l.mode === 'box' ? l.area : [0, 0, 1, 1];
    const w = even(bw * W), h = even(bh * H), x = even(bx * W), y = even(by * H);
    const g = next(), o = next();
    const fit = l.mode === 'full' ? `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black@0` : `scale=${w}:${h}:force_original_aspect_ratio=decrease`;
    const fades = l.fade > 0 ? `,fade=t=in:st=0:d=${num(l.fade)}:alpha=1,fade=t=out:st=${num(Math.max(0, l.to - l.from - l.fade))}:d=${num(l.fade)}:alpha=1` : '';
    // its last frame is held a second past its end before the cut to length: a graphic file a frame short of the stretch let
    // a frame of the picture under it flash through at the end (found by a person's Claude on a real job, 2 Nov 2026)
    parts.push(`[${idx}:v]fps=${num(fps)},format=yuva420p,${fit},tpad=stop_mode=clone:stop_duration=1${fades},trim=duration=${num(l.to - l.from)},setpts=PTS-STARTPTS+${num(l.from)}/TB${g}`);
    parts.push(`${cur}${g}overlay=x='${x}+(${w}-overlay_w)/2':y='${y}+(${h}-overlay_h)/2':eof_action=pass:enable='between(t,${num(l.from)},${num(l.to)})'${o}`);
    cur = o;
  }
  // 3) text on top
  const S = H / 1080; // sizes are set for 1080p and scale with the frame
  const drawn = [];
  for (const l of layers.filter((x) => x.type === 'title')) {
    const size = 84 * S, sub = 44 * S;
    const yOf = { top: `${Math.round(110 * S)}`, center: `(h-text_h)/2-${l.sub ? Math.round(36 * S) : 0}`, bottom: `h-text_h-${Math.round(170 * S)}`, 'lower-third': `h-text_h-${Math.round(260 * S)}`, left: `(h-text_h)/2`, right: `(h-text_h)/2` }[l.position];
    const xOf = l.position === 'lower-third' || l.position === 'left' ? `${Math.round(110 * S)}` : l.position === 'right' ? `w-text_w-${Math.round(110 * S)}` : '(w-text_w)/2';
    const maxW = (l.position === 'center' || l.position === 'top' || l.position === 'bottom' ? 0.9 : 0.6) * W;
    const t = fitText(l.text, size, maxW), u = l.sub ? fitText(l.sub, sub, maxW) : null;
    drawn.push(draw(t.text, { x: xOf, y: yOf, size: t.size, a: l.from, b: l.to, ink: l.ink }));
    if (u) drawn.push(draw(u.text, { x: xOf, y: `${yOf}+${Math.round(t.size * (1.25 * t.lines + 0.35))}`, size: u.size, a: l.from + 0.15, b: l.to, box: 0.45, ink: l.ink }));
  }
  for (const l of layers.filter((x) => x.type === 'checklist')) {
    // placed by its area when given (the right-hand column covered a face, 2 Nov 2026): rows shrink to fit its height
    const rows = l.items.length + (l.title ? 1 : 0), A = l.area;
    const size = A ? Math.min(50 * S, (A[3] * H) / (rows * 1.9)) : 50 * S, gap = Math.round(size * 1.9);
    const x0 = A ? Math.round(A[0] * W) : l.position === 'right' ? Math.round(W * 0.56) : Math.round(110 * S);
    const y0 = A ? Math.round(A[1] * H) : Math.round(H / 2 - (rows * gap) / 2);
    let row = 0;
    if (l.title) { drawn.push(draw(l.title, { x: `${x0}`, y: `${y0}`, size: size * 1.15, a: l.from, b: l.to, ink: l.ink })); row = 1; }
    l.items.forEach((it, i) => {
      const y = y0 + (row + i) * gap, box = Math.round(size * 0.9), bx = x0, by = y + Math.round((size - box) / 2) + Math.round(size * 0.05);
      const shown = `between(t,${num(l.at[i])},${num(l.to)})`, ticked = `between(t,${num(Math.min(l.to, l.at[i] + 0.5))},${num(l.to)})`;
      drawn.push(`drawbox=x=${bx}:y=${by}:w=${box}:h=${box}:color=${inkColour(l.ink)}@0.95:t=${Math.max(2, Math.round(size * 0.08))}:enable='${shown}'`);
      drawn.push(`drawbox=x=${bx + Math.round(box * 0.2)}:y=${by + Math.round(box * 0.2)}:w=${Math.round(box * 0.6)}:h=${Math.round(box * 0.6)}:color=${style.accent || inkColour(l.ink)}@1:t=fill:enable='${ticked}'`); // the accent, else the words' own colour
      drawn.push(draw(it, { x: `${bx + Math.round(box * 1.5)}`, y: `${y}`, size: fitText(it, size, A ? A[2] * W - box * 1.6 : W * 0.42).size, a: l.at[i], b: l.to, box: 0.5, ink: l.ink }));
    });
  }
  for (const l of layers.filter((x) => x.type === 'subtitles')) {
    const words = wordsOf(l);
    if (!words?.length) throw err('NO_WORDS', 'Subtitles need the words: give "words" (the .words.json from get_words) and, for a section, "words_from" (where the section starts in that file).');
    for (const s of subtitleLines(words, l.from, l.to)) drawn.push(draw(s.text, { x: '(w-text_w)/2', y: `h-text_h-${Math.round(90 * S)}`, size: fitText(s.text, 54 * S, W * 0.9).size, a: s.t, b: s.e, box: 0.6, alpha: '1', ink: l.ink }));
  }
  if (drawn.length) { const o = next(); parts.push(`${cur}${drawn.join(',')}${o}`); cur = o; }
  return { graph: parts.length ? parts.join(';') : null, out: cur, inputs, texts };
}

// where each kind of text sits, as fractions of the frame [x, y, w, h], for reading the picture behind it
function textArea(l) {
  if (l.type === 'subtitles') return [0.1, 0.8, 0.8, 0.14];
  if (l.type === 'checklist') return l.area || (l.position === 'right' ? [0.56, 0.25, 0.4, 0.5] : [0.05, 0.25, 0.4, 0.5]);
  return { top: [0.1, 0.05, 0.8, 0.2], center: [0.15, 0.35, 0.7, 0.3], bottom: [0.1, 0.72, 0.8, 0.2], 'lower-third': [0.05, 0.6, 0.55, 0.26], left: [0.05, 0.35, 0.55, 0.3], right: [0.45, 0.35, 0.5, 0.3] }[l.position] || [0.1, 0.35, 0.8, 0.3];
}
/** A tiny grey frame at t (64x36), or null. */
function grayFrame(input, t) {
  return new Promise((res) => {
    let p; try { p = spawn(FF, ['-hide_banner', '-loglevel', 'error', '-ss', num(Math.max(0, t)), '-i', input, '-frames:v', '1', '-vf', 'scale=64:36,format=gray', '-f', 'rawvideo', '-'], { windowsHide: true }); } catch (e) { res(null); return; }
    const parts = []; p.stdout.on('data', (d) => parts.push(d)); p.on('error', () => res(null)); p.on('close', () => { const b = Buffer.concat(parts); res(b.length >= 64 * 36 ? b : null); });
  });
}
/** Each text layer's ink from the picture behind its words (two frames: its start and its middle): 'dark' on a bright picture,
 *  'light' on a dark one, 'mid' on a busy middle. A frame that cannot be read leaves the layer light (white with a shadow). */
export async function inkOf(input, layers) {
  for (const l of layers.filter((x) => x.type === 'title' || x.type === 'checklist' || x.type === 'subtitles')) {
    const [ax, ay, aw, ah] = textArea(l), vals = [];
    for (const t of [l.from + 0.2, (l.from + l.to) / 2]) {
      const b = await grayFrame(input, t); if (!b) continue;
      let sum = 0, n = 0;
      for (let y = Math.floor(ay * 36); y < Math.min(36, Math.ceil((ay + ah) * 36)); y++) for (let x = Math.floor(ax * 64); x < Math.min(64, Math.ceil((ax + aw) * 64)); x++) { sum += b[y * 64 + x]; n++; }
      if (n) vals.push(sum / n / 255);
    }
    const lum = vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : 0;
    l.ink = !vals.length ? 'light' : lum > 0.62 ? 'dark' : lum < 0.42 ? 'light' : 'mid';
  }
  return layers;
}

/** Apply an effect list. spec: { input, output, layers: [...], words?, words_from? }. -> { file, layers, check } */
/**
 * May this list draw a title (5 Nov 2026)? A title layer is plain drawn text with no look and no check, so a new title goes the graphic route,
 * where both apply and a final has to pass. Allowed: a layer marked plain (they asked for plain text), a list marked existing, or a list that
 * came out of a version's working files, which is what a change to an earlier list looks like: the job unpacks post-prod-folder/zips/v<n>-files.zip.
 * → { ok } or { ok: false, code, message }
 */
export function titleGate(spec, listPath) {
  const layers = Array.isArray(spec?.layers) ? spec.layers : [];
  const fresh = layers.filter((l) => l?.type === 'title' && l.plain !== true);
  if (!fresh.length || spec?.existing === true) return { ok: true };
  for (let d = path.dirname(path.resolve(listPath)), i = 0; i < 6; i++, d = path.dirname(d)) {
    const z = path.join(d, 'zips');
    if (fs.existsSync(z) && fs.readdirSync(z).some((f) => /\.zip$/i.test(f))) return { ok: true };
    if (path.dirname(d) === d) break;
  }
  return { ok: false, code: 'NEW_TITLE', message: `A new title is a graphic, not a title layer: it needs a look and check. Make it as references/hyperframes.md says, then lay it on with a graphic layer. If they asked for plain text, add "plain": true to the layer ("${String(fresh[0].text || '').slice(0, 40)}"). If this list came from an earlier version, add "existing": true at the top of it.` };
}

export async function applyEffects(spec, { base = process.cwd(), quality = 'high', log = () => {} } = {}) {
  const input = path.resolve(base, spec.input || '');
  if (!fs.existsSync(input)) throw err('NO_SOURCE', `No file at ${input}.`);
  const info = await probe(input);
  if (!(info.width > 0)) throw err('NO_PICTURE', 'The input has no picture.');
  const layers = cleanEffects(spec, info);
  for (const l of layers) if (l.file) { l.file = path.resolve(base, l.file); if (!fs.existsSync(l.file)) throw err('NO_SOURCE', `Graphic: no file at ${l.file}.`); }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-fx-'));
  const wordsCache = {};
  const wordsOf = (l) => {
    if (!l.words) return null;
    const f = path.resolve(base, l.words);
    // the engine's reader: get_words' compact [start, end, word] or objects, moved onto the section's clock by words_from
    const key = `${f}@${l.words_from}`;
    if (!wordsCache[key]) wordsCache[key] = loadWords(f, l.words_from) || [];
    return wordsCache[key];
  };
  try {
    const W = even(info.width), H = even(info.height), fps = info.fps || 30;
    await inkOf(input, layers);
    const askedRaw = (spec.style && spec.style.font) || spec.font || null, asked = askedRaw ? path.resolve(base, askedRaw) : null; // beside the effect list, like its graphics
    const g = fxGraph(layers, { W, H, fps, font: findFont(asked), wordsOf, dir, style: styleOf(spec) });
    // a failsafe, not a rule: text drawn in the computer's system bold because nobody chose a face is the template look
    const warnings = [];
    if (layers.some((l) => l.type === 'title' || l.type === 'checklist' || l.type === 'subtitles')) {
      if (!asked) warnings.push('No font chosen: the text is in the computer\'s system bold. Pick a face that fits this video (theirs from the folder first, or a free one from Google Fonts) and give it as style.font, unless they asked for plain.');
      else if (!fs.existsSync(asked)) warnings.push(`The font ${askedRaw} was not found, so the system bold was used. Check the path.`);
    }
    for (const t of g.texts) fs.writeFileSync(t.file, t.text, 'utf8');
    const script = path.join(dir, 'graph.txt');
    fs.writeFileSync(script, g.graph);
    const out = path.resolve(base, spec.output || input.replace(/(\.[^.]+)?$/, '-fx.mp4'));
    const crf = quality === 'draft' ? '23' : '16';
    log(`effects: ${layers.map((l) => l.type).join(', ')}`);
    // the video's own sound stays as it was, under a graphic's sound when that has any: brought down to the voice, which goes on over it
    const sounded = [];
    for (const l of layers.filter((x) => x.type === 'graphic' && x.input && x.sound !== false)) if ((await probe(l.file)).hasAudio) sounded.push(l);
    let audio = ['-map', '0:a?', '-c:a', 'copy'];
    if (sounded.length && info.hasAudio) {
      const parts = [];
      for (const [i, l] of sounded.entries()) {
        const { gain_db } = await levelGain(l.file, input, { around: { from: Math.max(0, l.from - 20), to: l.to + 20 }, under: UNDER_VOICE.speech });
        const ms = Math.round(l.from * 1000);
        parts.push(`[${l.input}:a]atrim=0:${num(l.to - l.from)},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,volume=${gain_db}dB,adelay=${ms}|${ms}[gs${i}]`);
      }
      parts.push(`[0:a]aresample=48000,aformat=channel_layouts=stereo[vo]`, `[vo]${sounded.map((_, i) => `[gs${i}]`).join('')}amix=inputs=${sounded.length + 1}:normalize=0:duration=first:dropout_transition=0,alimiter=limit=0.89:level=0[aout]`);
      fs.writeFileSync(script, `${g.graph};${parts.join(';')}`);
      audio = ['-map', '[aout]', '-c:a', 'aac', '-b:a', '256k'];
    }
    await run(FF, ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, ...g.inputs.flat(), '-filter_complex_script', script, '-map', g.out, ...audio,
      '-c:v', 'libx264', '-preset', quality === 'draft' ? 'veryfast' : 'medium', '-crf', crf, '-pix_fmt', 'yuv420p', '-r', num(fps), '-movflags', '+faststart', out]);
    const got = await probe(out);
    return { file: out, layers: layers.map((l) => ({ type: l.type, from: l.from, to: l.to })), length_s: got.duration, input_length_s: info.duration, warnings };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// ── graphic: an HTML animation to video ──

const BROWSERS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
];
export const findBrowser = () => BROWSERS.find((b) => b && fs.existsSync(b)) || null;

// The page's clock, replaced before any of its code runs: time moves only when we say, one frame at a time, so requestAnimation
// Frame, timers, Date, performance.now, CSS animations and transitions and the Web Animations API all see the same exact frame
// times (a slow machine renders slower, never jerkier).
export const CLOCK = `(() => {
  let now = 0; const t0 = Date.now(); const raf = new Map(); let rid = 0; const timers = new Map(); let tid = 0;
  const RealDate = Date;
  performance.now = () => now;
  window.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [t0 + now])); } static now() { return t0 + now; } };
  window.requestAnimationFrame = (f) => { raf.set(++rid, f); return rid; };
  window.cancelAnimationFrame = (id) => raf.delete(id);
  window.setTimeout = (f, ms = 0, ...a) => { timers.set(++tid, { f, at: now + Math.max(0, +ms || 0), a }); return tid; };
  window.setInterval = (f, ms = 0, ...a) => { const id = ++tid; const iv = Math.max(1, +ms || 0); timers.set(id, { f, at: now + iv, a, iv }); return id; };
  window.clearTimeout = window.clearInterval = (id) => timers.delete(id);
  const seen = new WeakMap();
  window.__ppAdvance = async (ms) => {
    const end = now + ms;
    for (;;) { // timers due inside this frame, in order
      let due = null; for (const [id, t] of timers) if (t.at <= end && (!due || t.at < due[1].at)) due = [id, t];
      if (!due) break;
      now = Math.max(now, due[1].at);
      if (due[1].iv) due[1].at += due[1].iv; else timers.delete(due[0]);
      try { typeof due[1].f === 'function' ? due[1].f(...due[1].a) : eval(due[1].f); } catch (e) { console.error(e); }
    }
    now = end;
    const cbs = [...raf.values()]; raf.clear();
    for (const f of cbs) { try { f(now); } catch (e) { console.error(e); } }
    for (const a of document.getAnimations()) { // CSS and WAAPI animations: held, and set to their place on this clock
      // started when first seen (the real seconds the page took to load do not count)
      if (!seen.has(a)) { seen.set(a, now); a.pause(); }
      a.currentTime = now - seen.get(a);
    }
    for (const v of document.querySelectorAll('video')) { v.pause(); v.currentTime = now / 1000; }
  };
})();`;

/** Minimal Chrome DevTools Protocol over the browser's own WebSocket (Node 22+ has WebSocket). */
export async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(err('NO_BROWSER', 'Could not talk to the browser.')); });
  let id = 0; const wait = new Map(), events = [];
  ws.onmessage = (m) => {
    const j = JSON.parse(m.data);
    if (j.id && wait.has(j.id)) { const w = wait.get(j.id); wait.delete(j.id); j.error ? w.rej(err('BROWSER_FAILED', j.error.message)) : w.res(j.result); }
    else if (j.method) events.push(j);
  };
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; wait.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); });
  return { send, events, close: () => ws.close() };
}

/**
 * An HTML page (a file) recorded to video: W×H, fps, seconds long. alpha: a transparent page background stays transparent
 * (a .mov with an alpha channel, for a graphic over the picture); otherwise an H.264 .mp4. -> { file, frames, length_s }
 */
/** The defaults that read as AI-made, found in a graphic's page (pure; 3 Nov 2026): a failsafe for when nobody said how it should
 *  look, never a ban (a gaming channel may want neon). -> [plain-words warning] */
export function slopCheck(src) {
  const s = String(src || '').replace(/<script[\s\S]*?<\/script>/gi, (m) => m.replace(/\/\/[^\n]*/g, '')), out = [];
  const firstFace = (v) => v.split(',')[0].replace(/["']/g, '').trim().toLowerCase();
  const faces = [...s.matchAll(/font-family\s*:\s*([^;}{]+)/gi)].map((m) => firstFace(m[1]))
    .concat([...s.matchAll(/(?:^|[;{\s])font\s*:\s*[^;}{]*?\d+(?:\.\d+)?(?:px|em|rem|pt|%)(?:\s*\/\s*[\d.]+\w*)?\s+([^;}{]+)/gi)].map((m) => firstFace(m[1])));
  const DEFAULT = /^(inter|geist|arial|helvetica|helvetica neue|roboto|segoe ui|system-ui|-apple-system|blinkmacsystemfont|sans-serif|serif|ui-sans-serif|open sans|montserrat|poppins)$/;
  const shown = /<(h[1-6]|p|span|div|li|text)[^>]*>\s*[^<\s]/i.test(s.replace(/<script[\s\S]*?<\/script>/gi, ''));
  if (faces.some((f) => DEFAULT.test(f)) || (shown && !faces.length)) out.push('A default face (Inter, Arial, Poppins, the system font). Pick one that fits this video and niche, or theirs.');
  if (/background-clip\s*:\s*text/i.test(s)) out.push('Gradient-filled text. A solid colour reads as designed; size or weight carries the emphasis.');
  const PURPLE = /#(8b5cf6|7c3aed|6d28d9|a855f7|9333ea|6366f1|4f46e5|818cf8|c084fc|a78bfa)\b|\b(purple|violet|indigo|blueviolet|mediumpurple|rebeccapurple)\b/i;
  if ([...s.matchAll(/gradient\(([^;]*?)\)\s*[;}"']/gi)].some((m) => PURPLE.test(m[1]))) out.push('A purple/violet gradient, the most common AI look. Take the colours from the video itself.');
  if (/\p{Extended_Pictographic}/u.test(s.replace(/<script[\s\S]*?<\/script>/gi, ''))) out.push('Emoji in the graphic (sparkles, rockets, fire). Show the real thing, or nothing.');
  const over = [...s.matchAll(/cubic-bezier\(([^)]*)\)/gi)].some((m) => { const v = m[1].split(',').map(Number); return v[1] > 1 || v[3] > 1 || v[1] < 0 || v[3] < 0; });
  if (over || /\b(bounce|elastic|easeOutBack|easeInOutBack|easeOutElastic|back\.out|elastic\.out|wiggle)\b/i.test(s)) out.push('Bounce, elastic or overshoot easing. Ease out and settle in 200-400 ms.');
  if ([...s.matchAll(/(text-shadow|box-shadow|drop-shadow)\s*[:(]([^;]*)/gi)].some((m) => /\b([2-9]\d|\d{3,})px/.test(m[2]) && /(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(m[2]) && !/rgba?\(\s*0[\s,]+0[\s,]+0|#000[0-9a-f]?\b|#0{6}(?:[0-9a-f]{2})?\b/i.test(m[2]))) out.push('A coloured glow. Contrast from the frame or a plain shadow instead.');
  if (/backdrop-filter\s*:\s*blur/i.test(s)) out.push('A frosted-glass panel. Only where layering needs it.');
  return out;
}
export async function graphic({ html, output, width = 1920, height = 1080, fps = 30, seconds = 5, alpha = false, log = () => {} }) {
  const browser = findBrowser();
  if (!browser) throw err('NO_BROWSER', 'Making a graphic needs Chrome or Edge installed (or CHROME_PATH set to one).');
  const page = path.resolve(html);
  if (!fs.existsSync(page)) throw err('NO_SOURCE', `No page at ${page}.`);
  const N = Math.max(1, Math.round(seconds * fps));
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-gfx-'));
  const out = path.resolve(output || page.replace(/\.html?$/i, alpha ? '.mov' : '.mp4'));
  const proc = spawn(browser, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio', '--force-device-scale-factor=1', `--window-size=${width},${height}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  let enc = null;
  try {
    const wsUrl = await new Promise((res, rej) => {
      let buf = ''; const t = setTimeout(() => rej(err('NO_BROWSER', 'The browser did not start in 20 s.')), 20000);
      proc.stderr.on('data', (d) => { buf += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) { clearTimeout(t); res(m[1]); } });
      proc.on('exit', () => rej(err('NO_BROWSER', `The browser stopped: ${buf.slice(-300)}`)));
    });
    const c = await cdp(wsUrl);
    const { targetId } = await c.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: s } = await c.send('Target.attachToTarget', { targetId, flatten: true });
    await c.send('Page.enable', {}, s);
    await c.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, s);
    if (alpha) await c.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } }, s);
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: CLOCK }, s);
    await c.send('Page.navigate', { url: `file:///${page.replace(/\\/g, '/').replace(/^\/+/, '')}` }, s);
    for (let i = 0; i < 300 && !c.events.some((e) => e.method === 'Page.loadEventFired'); i++) await new Promise((r) => setTimeout(r, 50));
    await c.send('Runtime.evaluate', { expression: 'document.fonts ? document.fonts.ready.then(() => 1) : 1', awaitPromise: true }, s);
    // frames are piped as PNG to ffmpeg
    const args = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(fps), '-i', '-',
      ...(alpha ? ['-c:v', 'png', '-pix_fmt', 'rgba'] : ['-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']), out];
    enc = spawn(FF, args, { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
    let encErr = ''; enc.stderr.on('data', (d) => { encErr += d; });
    const done = new Promise((res, rej) => enc.on('close', (code) => (code === 0 ? res() : rej(err('FFMPEG_FAILED', `ffmpeg could not write the graphic: ${encErr.slice(-300)}`)))));
    const t0 = Date.now();
    for (let f = 0; f < N; f++) {
      await c.send('Runtime.evaluate', { expression: `window.__ppAdvance(${f === 0 ? 0 : 1000 / fps})`, awaitPromise: true }, s);
      const { data } = await c.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }, s);
      if (!enc.stdin.write(Buffer.from(data, 'base64'))) await new Promise((r) => enc.stdin.once('drain', r));
      if (f % Math.round(fps * 2) === 0) log(`graphic: frame ${f + 1}/${N} (${Math.round((Date.now() - t0) / 1000)} s)`);
    }
    enc.stdin.end();
    await done;
    c.close();
    // the page and the stylesheets it links on this computer, read for the defaults that look AI-made
    let srcText = ''; try { srcText = fs.readFileSync(page, 'utf8'); for (const m of srcText.matchAll(/<link[^>]+href=["']([^"':]+\.css)["']/gi)) { const f = path.resolve(path.dirname(page), m[1]); if (fs.existsSync(f)) srcText += fs.readFileSync(f, 'utf8'); } } catch (e) { log(`graphic: could not read the page for its check: ${e.message}`); }
    return { file: out, frames: N, length_s: N / fps, width, height, fps, alpha, warnings: slopCheck(srcText) };
  } finally {
    if (enc && enc.exitCode == null) try { enc.kill(); } catch { /* already gone */ }
    // the browser's profile folder goes once the browser has let go of it (Windows keeps its files locked until it exits)
    if (proc.exitCode == null) { const gone = new Promise((r) => proc.once('exit', r)); try { if (process.platform === 'win32') spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); else proc.kill(); } catch { /* already gone */ } await Promise.race([gone, new Promise((r) => setTimeout(r, 5000))]); }
    try { fs.rmSync(prof, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (e) { console.error(`[footage] graphic: the browser's temporary profile ${prof} was left behind: ${e.message}`); }
  }
}
