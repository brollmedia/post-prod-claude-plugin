// COPY of post-prod's server/harness-check.js, made by tools/build-plugin-footage.js. Change the original, then run that.
// The harness's eyes (5 Nov 2026, Seth: "ensure that our claude has AS MUCH motion design/graphic design/sound design/animation
// knowledge as humanly possible"). A rule in a skill is only as good as the checking behind it, and a model that writes "nothing
// overlaps" has often not measured. So every scene can be measured: `check` steps through the scene frame by frame, reads where
// everything is from the page itself (a pure function of t, so this is exact), and answers in numbers: what is off-centre, what
// touches, what crosses text, what is too small for a phone, what starts at the same moment, what moves at a constant speed, how
// long the words are held against how long they take to read. It writes a contact sheet (with the frames that matter, on a plate
// when the scene has alpha, and a phone-sized view) so the model looks at the moments that go wrong, not the finished frame.
// The thresholds are in LIMITS, with their sources in docs/claude-craft-research-2026-11.md. Pure parts (analyse*) have no browser.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const LIMITS = {
  safe: 0.05,            // title-safe, each side, as a fraction of the frame (EBU R95 keeps 5%)
  min_text_h: 0.044,     // smallest text a viewer must read on a 16:9 frame, as a fraction of its height (48 px of 1080: the phone floor)
  min_text_v: 0.025,     // the same on an upright frame (48 px of 1920)
  numeral_gap: 0.07,     // a hole in a big number wider than this share of its size
  ink_gap: 0.011,        // the real letter shapes, ascenders and tails included, keep this far from the edge of the plate they sit on (fraction of the short side)
  pointer_gap: 0.012,    // a pointer's line starts this close to its label (fraction of the short side), or it has come adrift
  touch_gap: 0.006,      // two blocks of text closer than this fraction of the short side read as touching
  almost_centre_lo: 0.002, almost_centre_hi: 0.04, // a group this far from the centre (fraction of the width) looks like a mistake, not a choice
  max_lines: 2,
  read_wps: 3,           // hold = max(1.5 s, 0.5 s + words / 3): craft/motion.md
  read_pad: 0.5, read_min: 1.5,
  linear_cv: 0.12,       // a move whose speed barely changes (spread / mean under this) is linear
  min_move_frames: 6,    // shorter moves are too few frames to judge
  exit_ratio: 1.0,       // an exit no longer than its entrance
  pop_px: 2,
  dead_band_v: 0.3, dead_band_h: 0.42,    // an empty band across the frame this deep, as a fraction of the height (top, bottom) or width (sides) ...
  dead_excess_v: 0.1, dead_excess_h: 0.24, dead_ratio: 1.4, // ... and this much deeper than the band opposite it, by this ratio too: a centred title has empty space on both sides, and that is balance
  recent_looks: 8,       // how far back a look counts as just used
  recent_faces: 4,       // and how far back a display face does
  hero_w: 0.4, hero_h: 0.12, // the biggest words on a full-frame piece reach this share of the width, or this share of the height
  stale_s: 3,            // longer than this with nothing changing on a full-frame piece, unless the words need it to be read
  first_frame_used: 0.006, // under this share of the frame in use, the first frame is empty, and on social the first frame is the thumbnail
};

// ── the page probe: what is on screen at this moment ──
/** Runs in the page. → [{ id, kind: 'text'|'shape', text, x, y, w, h, op, size, lines, group, colour, thin }] */
export const PROBE = `(() => {
  if (!window.__ppIds) { window.__ppIds = new WeakMap(); window.__ppNext = 1; }
  const idOf = (el) => { let i = window.__ppIds.get(el); if (!i) { i = window.__ppNext++; window.__ppIds.set(el, i); } return i; };
  const W = innerWidth, H = innerHeight, out = [];
  // any CSS colour (oklch, color-mix) as sRGB numbers: a canvas pixel is the one conversion that always works
  const cc = (window.__ppCc = window.__ppCc || document.createElement('canvas').getContext('2d', { willReadFrequently: true }));
  const toRgb = (c) => { cc.clearRect(0, 0, 1, 1); cc.fillStyle = '#000'; cc.fillStyle = c; cc.fillRect(0, 0, 1, 1); const d = cc.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
  const isBlock = (el) => { const d = getComputedStyle(el).display; return !/^inline/.test(d) && d !== 'contents'; };
  // what is left of a box once every clipping ancestor has cut it, and the opacity it really shows at
  const seen = (el) => {
    let r = el.getBoundingClientRect(), x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom, op = 1;
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.display === 'none' || s.visibility === 'hidden') return null;
      op *= +s.opacity;
      if (s.clipPath.startsWith('inset(')) { // a wipe: inset(top right bottom left), each px or a share of the box
        const c = a.getBoundingClientRect(), v = s.clipPath.slice(6, s.clipPath.indexOf(')')).split(' round')[0].trim().split(' '), px = (t, size) => (t.endsWith('%') ? (parseFloat(t) / 100) * size : parseFloat(t) || 0);
        const [t, r2, b, l] = [v[0], v[1] ?? v[0], v[2] ?? v[0], v[3] ?? v[1] ?? v[0]];
        x0 = Math.max(x0, c.left + px(l, c.width)); y0 = Math.max(y0, c.top + px(t, c.height)); x1 = Math.min(x1, c.right - px(r2, c.width)); y1 = Math.min(y1, c.bottom - px(b, c.height));
      }
      if (a !== el && /(hidden|clip)/.test(s.overflow + s.overflowX + s.overflowY)) { const c = a.getBoundingClientRect(); x0 = Math.max(x0, c.left); y0 = Math.max(y0, c.top); x1 = Math.min(x1, c.right); y1 = Math.min(y1, c.bottom); }
    }
    if (x1 - x0 < 0.5 || y1 - y0 < 0.5 || op < 0.02) return null;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, op, full: { x: r.left, y: r.top, w: r.width, h: r.height } };
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textEls = new Set();
  // a counter's digits (PP.digits) are one thing on screen, however its cells change; a twin (data-pp-twin) is a second colouring of the same words
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.textContent.trim() && n.parentElement && !n.parentElement.closest('[data-pp-twin]') && !/^(SCRIPT|STYLE|TITLE|NOSCRIPT)$/.test(n.parentElement.tagName)) textEls.add(n.parentElement.closest('[data-pp-count]') || n.parentElement);
  for (const el of textEls) {
    const v = seen(el); if (!v) continue;
    if (v.h < v.full.h * 0.25) continue; // a sliver left by a mask is not text on screen yet
    const s = getComputedStyle(el);
    let blk = el; while (blk.parentElement && blk !== document.body && !isBlock(blk)) blk = blk.parentElement;
    const rg = document.createRange(); rg.selectNodeContents(el);
    const boxes = [...rg.getClientRects()].filter((c) => c.width > 1);
    const tops = [...new Set(boxes.map((c) => Math.round(c.top / 3)))];
    // where the letters really are: a box is the font's whole line, and a g's tail can sit on a plate's edge inside it
    const mc = (window.__ppMc = window.__ppMc || document.createElement('canvas').getContext('2d')); mc.font = [s.fontStyle, s.fontWeight, s.fontSize, s.fontFamily].join(' '); mc.letterSpacing = s.letterSpacing === 'normal' ? '0px' : s.letterSpacing;
    const mt = mc.measureText((s.textTransform === 'uppercase' ? el.textContent.toUpperCase() : el.textContent).trim());
    const parts = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => {
      const r = document.createRange(); r.selectNodeContents(n); const bx = [...r.getClientRects()].filter((c) => c.width > 0.5); if (!bx.length) return null;
      const m = mc.measureText(n.textContent.trim());
      return { text: n.textContent.trim(), top: bx[0].top + m.fontBoundingBoxAscent - m.actualBoundingBoxAscent, bottom: bx[bx.length - 1].top + m.fontBoundingBoxAscent + m.actualBoundingBoxDescent, left: Math.min(...bx.map((c) => c.left)), right: bx.length === 1 ? Math.min(bx[0].right, bx[0].left + m.actualBoundingBoxRight) : Math.max(...bx.map((c) => c.right)) };
    }).filter(Boolean);
    const ink = boxes.length ? { top: boxes[0].top + mt.fontBoundingBoxAscent - mt.actualBoundingBoxAscent, bottom: boxes[boxes.length - 1].top + mt.fontBoundingBoxAscent + mt.actualBoundingBoxDescent, left: Math.min(...boxes.map((c) => c.left)), right: boxes.length === 1 ? Math.min(boxes[0].right, boxes[0].left + mt.actualBoundingBoxRight) : Math.max(...boxes.map((c) => c.right)) } : null;
    out.push({ id: idOf(el), kind: 'text', text: el.textContent.trim().slice(0, 40), ...v, size: parseFloat(s.fontSize) || 0, lines: tops.length, group: idOf(blk), colour: s.color, rgb: toRgb(s.color), svg: el instanceof SVGElement, counter: !!el.dataset?.ppCount, spent: !!el.closest('[data-pp-spent]'), ink, parts });
  }
  const shapes = document.querySelectorAll('body *');
  let count = 0;
  for (const el of shapes) {
    if (textEls.has(el) || /^(SCRIPT|STYLE|VIDEO|CANVAS|DEFS|FILTER|CLIPPATH|MASK)$/i.test(el.tagName)) continue;
    const s = getComputedStyle(el), svgShape = el instanceof SVGGeometryElement;
    const painted = svgShape ? (s.stroke !== 'none' || (s.fill !== 'none' && s.fill !== 'rgba(0, 0, 0, 0)')) : (s.backgroundColor !== 'rgba(0, 0, 0, 0)' || s.backgroundImage !== 'none' || parseFloat(s.borderTopWidth) > 0 || parseFloat(s.borderBottomWidth) > 0);
    if (!painted) continue;
    const v = seen(el); if (!v) continue;
    if (v.w >= W * 0.9 && v.h >= H * 0.9) continue; // a full-frame ground or scrim is not a shape on the layout
    if (s.backgroundImage !== 'none' && /radial|linear/.test(s.backgroundImage) && s.backgroundColor === 'rgba(0, 0, 0, 0)' && v.w > W * 0.3) continue; // a soft field
    if (++count > 160) break;
    const thin = Math.min(v.w, v.h) <= 6;
    out.push({ id: idOf(el), kind: 'shape', text: el.id || el.className?.baseVal || (typeof el.className === 'string' ? el.className : '') || el.tagName.toLowerCase(), ...v, thin, plate: !svgShape && s.backgroundColor !== 'rgba(0, 0, 0, 0)' });
  }
  for (const el of document.querySelectorAll('img, video, canvas, svg')) { const v = seen(el); if (v && v.w * v.h > W * H * 0.3) out.push({ id: idOf(el), kind: 'picture', text: el.tagName.toLowerCase(), ...v }); }
  // a pointer declares what it leaves from (data-pp-from="label"): the start of its line has to be on that thing
  for (const el of document.querySelectorAll('[data-pp-from]')) {
    const from = document.getElementById(el.dataset.ppFrom), v = el.getTotalLength && el.getAttribute('d') ? seen(el) : null; if (!from || !v) continue;
    const m = el.getScreenCTM(), p0 = el.getPointAtLength(0), r = from.getBoundingClientRect();
    out.push({ id: idOf(el), kind: 'pointer', text: el.id || 'pointer', ...v, start: { x: m.a * p0.x + m.c * p0.y + m.e, y: m.b * p0.x + m.d * p0.y + m.f }, from: { x: r.left, y: r.top, w: r.width, h: r.height, id: from.id } });
  }
  return out;
})()`;

// ── pure: the layout at one moment ──
const inter = (a, b) => { const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); return w > 0 && h > 0 ? { w, h } : null; };
const gap = (a, b) => { const dx = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), 0), dy = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h), 0); return Math.hypot(dx, dy); };
const union = (rs) => { const x = Math.min(...rs.map((r) => r.x)), y = Math.min(...rs.map((r) => r.y)), x1 = Math.max(...rs.map((r) => r.x + r.w)), y1 = Math.max(...rs.map((r) => r.y + r.h)); return { x, y, w: x1 - x, h: y1 - y }; };
const shortText = (s) => `"${String(s).slice(0, 28)}"`;

/** Text groups of one frame: the words of one line or block taken together (they sit side by side on purpose). */
export function textBlocks(items) {
  const byGroup = new Map();
  for (const it of items) if (it.kind === 'text') { if (!byGroup.has(it.group)) byGroup.set(it.group, []); byGroup.get(it.group).push(it); }
  return [...byGroup.values()].map((g) => ({ ...union(g), text: g.map((i) => i.text).join(' ').slice(0, 40), op: Math.max(...g.map((i) => i.op)), size: Math.max(...g.map((i) => i.size)), lines: Math.max(...g.map((i) => i.lines)), ids: g.map((i) => i.id) }));
}

/** Layout problems at one moment (pure). items from PROBE, W × H the frame. → [{ code, what }] */
export function analyseLayout(items, W, H, L = LIMITS) {
  const out = [], blocks = textBlocks(items).filter((b) => b.op >= 0.3);
  const portrait = H > W, short = Math.min(W, H);
  const sx = W * L.safe, sy = H * L.safe;
  const minPx = H * (portrait ? L.min_text_v : L.min_text_h);
  for (const b of blocks) {
    if (b.x < sx - 1 || b.x + b.w > W - sx + 1 || b.y < sy - 1 || b.y + b.h > H - sy + 1) out.push({ code: 'OUTSIDE_SAFE', what: `${shortText(b.text)} leaves the 5% safe area` });
    if (b.size && b.size < minPx - 0.5) out.push({ code: 'TOO_SMALL', what: `${shortText(b.text)} is ${Math.round(b.size)} px: under ${Math.round(minPx)} px it is unreadable at phone width` });
    if (b.lines > L.max_lines) out.push({ code: 'TOO_MANY_LINES', what: `${shortText(b.text)} runs to ${b.lines} lines` });
  }
  for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
    const a = blocks[i], b = blocks[j];
    if (inter(a, b)) out.push({ code: 'TEXT_OVERLAP', what: `${shortText(a.text)} overlaps ${shortText(b.text)}` });
    else if (gap(a, b) < short * L.touch_gap) out.push({ code: 'TOUCHING', what: `${shortText(a.text)} and ${shortText(b.text)} are ${gap(a, b).toFixed(1)} px apart` });
  }
  for (const s of items) {
    if (s.kind !== 'shape' || s.op < 0.15) continue;
    for (const b of blocks) {
      const hit = inter(s, b);
      if (!hit) continue;
      if (s.thin) { // a rule or line through the words; under the baseline (the bottom sixth) is an underline
        const horizontal = s.w > s.h, inside = horizontal ? s.y > b.y + b.h * 0.08 && s.y + s.h < b.y + b.h * 0.86 : s.x > b.x + 2 && s.x + s.w < b.x + b.w - 2;
        if (inside) out.push({ code: 'LINE_THROUGH_TEXT', what: `${shortText(s.text)} crosses ${shortText(b.text)}` });
      }
    }
  }
  return out;
}

/**
 * A shape that is thin only while it opens is a wipe or a highlight on its way, not a line through the words (pure; changes the
 * items): the early frames of a highlighter drawing across a word are not a fault.
 */
export function settleThin(frames) {
  const wide = new Set();
  for (const f of frames) for (const i of f.items) if (i.kind === 'shape' && !i.thin) wide.add(i.id);
  for (const f of frames) for (const i of f.items) if (i.thin && wide.has(i.id)) i.thin = false;
}

/** Runs in the page at a hold: points along the drawn lines, so a line can be tested against the words. */
export const PATHS = `(() => {
  const out = [];
  for (const el of [...document.querySelectorAll('path, polyline, line')].slice(0, 200)) {
    const s = getComputedStyle(el); if (s.stroke === 'none' || s.visibility === 'hidden' || !el.getTotalLength) continue;
    let op = 1; for (let a = el; a && a !== document.documentElement; a = a.parentElement) op *= +getComputedStyle(a).opacity; if (op < 0.1) continue;
    const m = el.getScreenCTM(); if (!m) continue;
    const len = el.getTotalLength(); if (len < 40) continue;
    const dash = parseFloat(s.strokeDashoffset) || 0, end = /px|^[0-9.]+$/.test(s.strokeDasharray) ? Math.max(0, len - dash) : len, n = Math.min(160, Math.ceil(end / 6)), pts = [];
    if (!(end > 0)) continue; // not drawn yet
    for (let i = 0; i <= n; i++) { const p = el.getPointAtLength((end * i) / n); pts.push([m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f]); }
    out.push({ pts, name: el.id || el.tagName.toLowerCase() });
  }
  return out;
})()`;
/** A drawn line through the letters at a hold (pure): the box around a line says nothing, so its points are tested against each word's ink. */
export function analyseLineThrough(paths, items) {
  const out = [];
  for (const b of items) {
    if (b.kind !== 'text' || !b.ink || b.op < 0.4) continue;
    const i = b.ink, hit = paths.find((p) => p.pts.some(([x, y]) => x > i.left && x < i.right && y > i.top && y < i.bottom));
    if (hit) out.push({ code: 'LINE_THROUGH_TEXT', what: `a line (${hit.name}) runs through ${shortText(b.text)}` });
  }
  return out;
}

/** A pointer at a hold (pure): its line starts on the thing it declares it belongs to. */
export function analysePointers(items, W, H, L = LIMITS) {
  const out = [], short = Math.min(W, H);
  for (const p of items) {
    if (p.kind !== 'pointer' || p.op < 0.15 || p.from.w < 2) continue;
    const dx = Math.max(p.from.x - p.start.x, p.start.x - (p.from.x + p.from.w), 0), dy = Math.max(p.from.y - p.start.y, p.start.y - (p.from.y + p.from.h), 0), off = Math.hypot(dx, dy);
    if (off > short * L.pointer_gap) out.push({ code: 'POINTER_ADRIFT', what: `${p.text} starts ${Math.round(off)} px away from ${p.from.id}: a line has to leave the thing it belongs to` });
  }
  return out;
}

/** Letters against the plate they sit on, at a hold (pure): touching is a fault at any size. */
export function analyseInk(items, W, H, L = LIMITS) {
  const out = [], need = Math.min(W, H) * L.ink_gap;
  for (const whole of items) {
    if (whole.kind !== 'text' || !whole.ink || whole.op < 0.6) continue;
    for (const piece of whole.parts?.length ? whole.parts : [{ ...whole.ink, text: whole.text }]) {
    const t = { text: piece.text, ink: piece };
    const cx = (t.ink.left + t.ink.right) / 2, cy = (t.ink.top + t.ink.bottom) / 2;
    for (const s of items) {
      if (s.kind !== 'shape' || !s.plate || s.thin || s.op < 0.5) continue;
      // outside: words beside a plate they don't sit on keep a gap as well. A plate its own text sits on is judged from inside
      if (cx < s.x || cx > s.x + s.w || cy < s.y || cy > s.y + s.h) {
        const dx = Math.max(s.x - t.ink.right, t.ink.left - (s.x + s.w), 0), dy = Math.max(s.y - t.ink.bottom, t.ink.top - (s.y + s.h), 0), off = Math.hypot(dx, dy);
        if (off < need && s.w * s.h < W * H * 0.5) { out.push({ code: 'INK_TIGHT', what: `${shortText(t.text)} is ${off.toFixed(1)} px from the ${shortText(s.text)} beside it: it needs ${Math.round(need)} px or more` }); break; }
        continue;
      }
      if (s.w < (t.ink.right - t.ink.left) * 0.9 || s.h < (t.ink.bottom - t.ink.top) * 0.9) continue; // smaller than the words: an underline, not a plate
      const edge = Math.min(t.ink.top - s.y, s.y + s.h - t.ink.bottom, t.ink.left - s.x, s.x + s.w - t.ink.right);
      if (edge < need) { out.push({ code: 'INK_TIGHT', what: `${shortText(t.text)} is ${edge.toFixed(1)} px from the edge of its plate: it needs ${Math.round(need)} px or more` }); break; }
    }
    }
  }
  return out;
}

/** The whole composition's balance at a hold (pure): a group nearly but not quite centred is the classic tell. */
export function analyseCentre(items, W, H, L = LIMITS) {
  const vis = items.filter((i) => i.kind === 'text' && i.op >= 0.6);
  if (!vis.length) return [];
  const u = union(vis), off = (u.x + u.w / 2 - W / 2) / W, out = [];
  // a block hung from the left margin is left-aligned, wherever its right edge happens to fall
  const big = textBlocks(items).sort((a, b) => b.w - a.w)[0];
  if (big && big.x < W * 0.15) return [];
  if (Math.abs(off) >= L.almost_centre_lo && Math.abs(off) <= L.almost_centre_hi) out.push({ code: 'ALMOST_CENTRED', what: `the text sits ${Math.round(Math.abs(off) * W)} px ${off > 0 ? 'right' : 'left'} of centre: centre it, or move it clearly off` });
  return out;
}

// ── pure: is the frame used? ──
/**
 * Where a picture has something in it (pure). rgb: raw bytes of a frame scaled to cols×cell by rows×cell. A cell counts when it has
 * detail in it (an edge, type) or sits well away from the ground colour (the inside of a big solid shape). A vignette or a soft
 * gradient does neither, and a faint texture is not a composition. → rows of booleans
 */
export function contentGrid(rgb, cols, rows, cell = 4) {
  const W = cols * cell, H = rows * cell, px = (x, y) => { const i = 3 * (y * W + x); return [rgb[i], rgb[i + 1], rgb[i + 2]]; };
  const samples = [];
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) samples.push(px(x, y));
  const mid = (k) => samples.map((p) => p[k]).sort((a, b) => a - b)[samples.length >> 1], ground = [mid(0), mid(1), mid(2)];
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      let lo = 255, hi = 0, far = 0;
      for (let y = r * cell; y < (r + 1) * cell; y++) for (let x = c * cell; x < (c + 1) * cell; x++) {
        const p = px(x, y), l = (p[0] + p[1] + p[2]) / 3;
        lo = Math.min(lo, l); hi = Math.max(hi, l);
        far = Math.max(far, Math.hypot(p[0] - ground[0], p[1] - ground[1], p[2] - ground[2]));
      }
      row.push(hi - lo > 16 || far > 42);
    }
    grid.push(row);
  }
  return grid;
}

/** The empty bands around what is in the frame, as fractions of its height and width (pure). A stray cell or two does not hold a band open. */
export function emptyBands(grid) {
  const rows = grid.length, cols = grid[0]?.length || 0;
  const rowUsed = grid.map((r) => r.filter(Boolean).length > 1), colUsed = Array.from({ length: cols }, (_, c) => grid.filter((r) => r[c]).length > 1);
  const lead = (a) => { const i = a.indexOf(true); return i < 0 ? a.length : i; };
  return { top: lead(rowUsed) / rows, bottom: lead([...rowUsed].reverse()) / rows, left: lead(colUsed) / cols, right: lead([...colUsed].reverse()) / cols, used: grid.flat().filter(Boolean).length / (rows * cols) };
}

/**
 * A large dead zone (pure): an empty band across the frame much deeper than the one opposite it, so the empty space reads as left
 * over and not as chosen. A full-frame piece only: over footage, the rest of the frame is the picture.
 */
export function analyseDeadZone(b, L = LIMITS) {
  const out = [], pc = (v) => Math.round(v * 100);
  const check = (name, big, small, band, excess) => { if (big >= band && big - small >= excess && big >= small * L.dead_ratio) out.push({ code: 'DEAD_ZONE', what: `the ${name} ${pc(big)}% of the frame is empty at the hold, against ${pc(small)}% opposite: fill it, move the weight down into it, or spread the layout across the frame` }); };
  const vertical = b.bottom >= b.top ? ['bottom', b.bottom, b.top] : ['top', b.top, b.bottom];
  const sideways = b.right >= b.left ? ['right', b.right, b.left] : ['left', b.left, b.right];
  check(...vertical, L.dead_band_v, L.dead_excess_v);
  check(...sideways, L.dead_band_h, L.dead_excess_h);
  return out;
}

// ── pure: is this a look, or the default? ──
const rgbOf = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null; };
/** Warm off-white, the paper colour a model reaches for when told not to use a dark gradient. */
export const isCream = (hex) => { const c = rgbOf(hex); return !!c && Math.min(...c) >= 196 && c[0] >= c[1] && c[1] >= c[2] && c[0] - c[2] >= 6 && c[0] - c[2] <= 56; };
const SERIF = /serif|newsreader|fraunces|garamond|playfair|lora|merriweather|georgia|times|baskerville|caslon|bodoni|didot/i;
export const isSerif = (name) => SERIF.test(name || '') && !/sans/i.test(name || '');
/** dark, pale or a colour, with its hue in 30° steps: what the eye files a ground under (pure). */
export function groundKind(hex) {
  const c = rgbOf(hex); if (!c) return 'unknown';
  const [r, g, b] = c.map((v) => v / 255), hi = Math.max(r, g, b), lo = Math.min(r, g, b), d = hi - lo, l = (hi + lo) / 2;
  if (l < 0.2 && d < 0.2) return 'dark';
  if (l > 0.8 && d < 0.25) return 'pale';
  const h = (hi === r ? ((g - b) / d + 6) % 6 : hi === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  return `colour-${Math.round(h / 30) % 12}`;
}

const hex = (v) => /^#[0-9a-f]{6}$/i.test(v || '');
const ratioOf = (a, b) => { const [x, y] = [rgbOf(a), rgbOf(b)]; return contrast(luminance(...x), luminance(...y)); };
/** Where a look can come from, most authoritative first. The first three are the person's, and they can choose anything. */
export const LOOK_SOURCES = ['spec', 'brand', 'reference', 'world'];
/** What is wrong with a look sheet (pure): a look written down as numbers before the first scene. → [problem] */
export function sheetProblems(l = {}) {
  const out = [];
  if (!LOOK_SOURCES.includes(l.source)) out.push(`source: one of ${LOOK_SOURCES.join(', ')}, the first that applies`);
  if (l.source === 'world' && String(l.world || '').trim().length < 20) out.push('world: its era, its materials and where it would be shown, in a line');
  for (const k of ['ink', 'paper', 'accent']) if (!hex(l.colours?.[k])) out.push(`colours.${k}: a hex colour`);
  for (const k of ['display', 'body']) if (!l.fonts?.[k]) out.push(`fonts.${k}: a named face`);
  if (!(+l.typeset?.display_weight > 0)) out.push('typeset.display_weight: a number');
  if (!l.typeset?.display_tracking) out.push('typeset.display_tracking: such as "-0.02em"');
  if (!l.motion?.enter) out.push('motion.enter: enter, snap or glide');
  if (!(+l.motion?.main_frames > 0)) out.push('motion.main_frames: frames for the main move');
  if (!l.sound) out.push('sound: what it sounds like, in a line');
  if (hex(l.colours?.ink) && hex(l.colours?.paper) && ratioOf(l.colours.ink, l.colours.paper) < 7) out.push(`colours: ink on paper is ${ratioOf(l.colours.ink, l.colours.paper).toFixed(1)}:1, and needs 7:1`);
  if (hex(l.colours?.accent) && hex(l.colours?.paper) && ratioOf(l.colours.accent, l.colours.paper) < 3) out.push(`colours: accent on paper is ${ratioOf(l.colours.accent, l.colours.paper).toFixed(1)}:1, and needs 3:1`);
  return out;
}

/**
 * Faults of the look itself (pure). style: what the scene was given; tokens: colours and fonts in force. A look that came from the
 * person is theirs to choose: a style profile (colours as a list), a sheet from their spec, brand or reference, a look they named, or a
 * hand-made one with theirs: true. Nothing here applies to those. Banning one default only moves it to the next, so what is measured
 * is not a list of bad looks but where this one came from, and whether it is the last one again. recent: recentLooks.
 */
export function analyseLook(style = {}, tokens = {}, recent = [], L = LIMITS) {
  if (Array.isArray(style?.colours) || style?.theirs || style?.named || ['spec', 'brand', 'reference'].includes(style?.source)) return [];
  const out = [], { colours = {}, fonts = {} } = tokens;
  if (!style?.colours) return [{ code: 'NO_LOOK', what: 'no look was written down, so this is the harness fallback. Write one as numbers from the subject\'s world and start again: new <scene> <folder> --sheet look.json' }];
  if (style.from_look) out.push({ code: 'STOCK_LOOK', what: `${style.from_look} is for when someone names it (--look ${style.from_look} --named). Nobody did, so write this one as numbers from the subject's world: new <scene> <folder> --sheet look.json` });
  if (isCream(colours.paper)) out.push({ code: 'DEFAULT_LOOK', what: `${colours.paper} is cream paper, the look a model falls back on. What in this subject's world is that colour? If nothing is, choose again` });
  const amber = rgbOf(colours.accent); if (amber && isSerif(fonts.display) && groundKind(colours.paper) === 'dark' && amber[0] > 190 && amber[1] > 120 && amber[1] < 200 && amber[2] < 90) out.push({ code: 'DEFAULT_LOOK', what: 'amber on a dark ground with a serif is the other fallback: pick the accent and the type from the subject' });
  const same = recent.find((r) => r.display === fonts.display && r.ground === groundKind(colours.paper));
  if (same) out.push({ code: 'REPEATED_LOOK', what: `the same ground and type as "${same.name}", made for another video. Change them; if it is the same channel, save this as their style and set theirs: true` });
  else if (fonts.display && recent.slice(-L.recent_faces).some((r) => r.display === fonts.display)) out.push({ code: 'REPEATED_FACE', what: `${fonts.display} was the display face on another video just now. A face you reach for every time is the next default: choose one for this subject` });
  return out;
}

// ── pure: does anything happen, and when? ──
/**
 * The longest stretch with nothing changing on a full-frame piece. changed: for each pair of samples step seconds apart, did the picture
 * change? need: seconds the words need to be read: a hold they need is a hold, not a stall.
 */
export function analyseStale(changed, step, { need = 0, L = LIMITS } = {}) {
  let best = 0, at = 0, run = 0;
  changed.forEach((c, i) => { run = c ? 0 : run + 1; if (run > best) { best = run; at = (i + 1 - run) * step; } });
  const s = best * step, limit = Math.max(L.stale_s, need + 0.5);
  return s > limit ? [{ code: 'STALE', at: Math.round(at * 100) / 100, what: `nothing changes for ${s.toFixed(1)} s from ${at.toFixed(1)} s: end it sooner, or give the hold a slow move` }] : [];
}
/** Which samples differ from the one before (pure). gray: one byte a pixel, frames of w × h, one after another. */
export function changesIn(gray, w, h) {
  const n = w * h, out = [];
  for (let f = 1; (f + 1) * n <= gray.length; f++) { let hit = false; for (let i = 0; i < n && !hit; i++) hit = Math.abs(gray[f * n + i] - gray[(f - 1) * n + i]) > 3; out.push(hit); }
  return out;
}
/** The hero, at a hold on a full-frame piece (pure): the biggest words have to be big. A piece with no words is not asked. */
export function analyseHero(items, W, H, L = LIMITS) {
  if (items.some((i) => i.w * i.h > W * H * 0.3 && (i.kind === 'picture' || (i.kind === 'shape' && !i.thin && i.w < W * 0.95)))) return []; // a picture or a panel is the hero, and the words are its labels
  const big = textBlocks(items).filter((b) => b.op >= 0.5).sort((a, b) => b.size - a.size)[0];
  if (!big || big.w >= W * L.hero_w || big.size >= H * L.hero_h) return [];
  return [{ code: 'HERO_SMALL', what: `the biggest words are ${shortText(big.text)} at ${Math.round(big.size)} px and ${Math.round((big.w / W) * 100)}% of the width: on a full-frame piece the hero takes 40% of the width or more` }];
}
/**
 * Big numerals (pure). cols: for each pixel column across the number, is there ink? A tabular digit or a stray space leaves a hole beside
 * the comma that a viewer spots at once, and only the ink shows it: the boxes are all correct.
 */
export function analyseNumerals(cols, size, text, L = LIMITS) {
  const gaps = []; let run = 0, seen = false;
  for (const on of cols) { if (on) { if (seen && run) gaps.push(run); run = 0; seen = true; } else if (seen) run++; }
  if (gaps.length < 2) return [];
  const sorted = [...gaps].sort((a, b) => a - b), most = sorted[sorted.length - 1], rest = sorted.slice(0, -1), mid = rest[rest.length >> 1];
  return most > size * L.numeral_gap && most > mid * 2 ? [{ code: 'LOOSE_NUMERAL', what: `${shortText(text)} has a ${most} px hole in it where the other gaps are about ${mid} px: set the comma tight against its digits` }] : [];
}
/** On social the first frame is the thumbnail (pure). bands from emptyBands. */
export const analyseFirstFrame = (bands, L = LIMITS) => (bands.used < L.first_frame_used ? [{ code: 'EMPTY_FIRST_FRAME', at: 0, what: 'the first frame is empty, and on social the first frame is the thumbnail: have something on screen from frame 0' }] : []);
/** A full-frame piece with no sound (pure). Advice, not a fault: effects are off unless asked (6 Nov 2026). Silence beats a bad sound. */
export const analyseSilence = ({ sounds }) => (!sounds ? [{ code: 'SILENT_PIECE', at: 0, what: 'no sound, which is the default: leave it silent unless they asked for sound or brought their own' }] : []);

// ── what stops a final ──
/** Faults a viewer sees. The rest of what check says is advice: worth a look, and no reason to stop a render. */
export const BLOCKING = ['DEFAULT_LOOK', 'OUTSIDE_SAFE', 'TEXT_OVERLAP', 'LINE_THROUGH_TEXT', 'TOUCHING', 'LOW_CONTRAST', 'LOOSE_NUMERAL', 'INK_TIGHT', 'POINTER_ADRIFT', 'DEAD_ZONE', 'HERO_SMALL', 'EMPTY_FIRST_FRAME', 'TOO_SMALL', 'TOO_MANY_LINES', 'NO_EXIT', 'NOT_ENOUGH_READ_TIME'];
export const CHECK_FILE = '.pp-check.json';
/** What a check result is true of: the files that make the picture, and how it was asked for. Change either and it must be checked again. */
export function sceneHash(dir, extra = '') {
  const h = crypto.createHash('sha1'); h.update(String(extra));
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (/^(out|renders|node_modules|\.hyperframes|\.thumbnails|sound-check)$/.test(f.name) || f.name === CHECK_FILE || f.name === 'sounds.json') continue;
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p); else if (/\.(html|css|js|json)$/i.test(f.name)) { h.update(f.name); h.update(fs.readFileSync(p)); }
  } };
  walk(dir); return h.digest('hex').slice(0, 16);
}
/** Keep a check's answer beside the scene. */
export function saveCheck(dir, issues, extra) { fs.writeFileSync(path.join(dir, CHECK_FILE), JSON.stringify({ hash: sceneHash(dir, extra), at: new Date().toISOString(), issues: issues.map((i) => ({ code: i.code, what: i.what })) }, null, 1)); }
/**
 * May this become a final (pure but for the record it reads)? accept: codes the person's Claude has looked at and judged wrong, with a reason.
 * → { ok } or { ok: false, code, message }, or { ok, accepted } when an override was used: that goes in the reply to the person.
 */
export function finalGate(dir, { accept = [], because = '', extra = '' } = {}) {
  let rec = null; try { rec = JSON.parse(fs.readFileSync(path.join(dir, CHECK_FILE), 'utf8')); } catch { /* never checked */ }
  if (!rec) return { ok: false, code: 'CHECK_FIRST', message: 'Run check on this first: a final needs a check of exactly these files.' };
  if (rec.hash !== sceneHash(dir, extra)) return { ok: false, code: 'CHECK_FIRST', message: 'These files changed after the last check: run check again.' };
  const blocking = rec.issues.filter((i) => BLOCKING.includes(i.code)), open = blocking.filter((i) => !accept.includes(i.code)), accepted = blocking.filter((i) => accept.includes(i.code));
  if (open.length) return { ok: false, code: 'CHECK_FAILED', message: `Not a final yet. Fix these and check again:\n- ${open.map((i) => `${i.code}: ${i.what}`).join('\n- ')}\nIf one is a false alarm, say so: --accept ${[...new Set(open.map((i) => i.code))].join(',')} --because "<what you saw on the frame>".` };
  if (accepted.length && String(because).trim().length < 12) return { ok: false, code: 'CHECK_FAILED', message: 'An override needs --because with what you saw on the frame.' };
  return { ok: true, accepted: accepted.length ? { codes: [...new Set(accepted.map((i) => i.code))], because } : null };
}

// ── what was used lately, on this machine ──
const usedFile = () => process.env.PP_LOOKS_USED || path.join(os.homedir(), '.post-prod', 'looks-used.json');
export const readUsedLooks = () => readUsed();
const readUsed = () => { try { const v = JSON.parse(fs.readFileSync(usedFile(), 'utf8')); return Array.isArray(v) ? v : []; } catch { return []; } };
/**
 * The kind of ground and accent to reach for, from the words of the brief, so runs that can't see each other don't all fall in the same place,
 * skipping what is already in use: the kinds on this machine lately, and any hex in avoid, such as the channel's own recent colours (pure).
 * A nudge and not a guarantee: two briefs can still land on one kind, and with nothing shared between runs nothing can promise otherwise.
 */
export const GROUND_KINDS = ['pale and cool, not white', 'a saturated mid-tone', 'bright and loud', 'a deep colour that is clearly a colour', 'a warm earth mid-tone', 'pale with a strong tint', 'near-black', 'split in two grounds, one strong'];
export const ACCENT_KINDS = ['with a cool accent', 'with a warm accent', 'with an accent the ground fights'];
export function groundFor(brief, { recent = [], avoid = [] } = {}) {
  const d = crypto.createHash('sha1').update(String(brief).trim().toLowerCase()).digest(), n = d.readUInt32BE(0), m = d.readUInt32BE(4);
  const accent = ACCENT_KINDS[m % ACCENT_KINDS.length];
  const start = n % GROUND_KINDS.length, near = [...recent, ...avoid.map(groundKind)];
  const hit = (k) => (/near-black/.test(k) && near.includes('dark')) || (/^pale/.test(k) && near.includes('pale')) ;
  for (let i = 0; i < GROUND_KINDS.length; i++) { const k = GROUND_KINDS[(start + i) % GROUND_KINDS.length]; if (!hit(k)) return `${k}, ${accent}`; }
  return `${GROUND_KINDS[start]}, ${accent}`;
}
/** Looks just used for other videos. Scenes in one folder are one video, and belong together. */
export const recentLooks = (dir, L = LIMITS) => { const home = path.dirname(path.resolve(dir)); return readUsed().slice(-L.recent_looks).filter((r) => r.home !== home); };
/** Note what a scene ended up with: { look, name, home, display, ground, accent }. Never fails a check. */
export function rememberLook(dir, tokens = {}, style = {}) {
  const home = path.dirname(path.resolve(dir)), key = path.resolve(dir);
  const row = { key, home, name: path.basename(key), look: style?.from_look || style?.name || null, display: tokens.fonts?.display || null, ground: groundKind(tokens.colours?.paper), accent: tokens.colours?.accent || null, at: new Date().toISOString() };
  try {
    const f = usedFile(); fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify([...readUsed().filter((r) => r.key !== key), row].slice(-24), null, 1));
  } catch (e) { console.error(`[harness] could not note the look: ${e.message}`); }
}

// ── pure: motion over the frames ──
/** Tracks per element from frames [{ t, items }] → [{ id, kind, text, in, settle, out, end, inDur, outDur, speeds, travel, popped }] */
export function motionTracks(frames, fps) {
  const tr = new Map();
  frames.forEach((f, n) => {
    for (const it of f.items) {
      if (it.kind === 'pointer' || it.kind === 'picture') continue;
      const k = it.id; let x = tr.get(k);
      if (!x) { x = { id: k, kind: it.kind, text: it.text, group: it.group, size: it.size, counter: it.counter, pts: [] }; tr.set(k, x); }
      x.pts.push({ n, cx: it.full.x + it.full.w / 2, cy: it.full.y + it.full.h / 2, w: it.w, h: it.h, sw: it.full.w, op: it.op, text: it.text });
    }
  });
  const out = [];
  for (const x of tr.values()) {
    const p = x.pts; if (p.length < 2) continue;
    // a single number for "how different is this frame": travel in px, size change in px, opacity scaled to the element's size
    const span = Math.max(40, Math.hypot(p[0].w, p[0].h) * 0.4);
    const d = [0];
    for (let i = 1; i < p.length; i++) d.push(Math.hypot(p[i].cx - p[i - 1].cx, p[i].cy - p[i - 1].cy) + Math.abs(p[i].w - p[i - 1].w) + Math.abs(p[i].h - p[i - 1].h) + Math.abs(p[i].op - p[i - 1].op) * span);
    const moving = d.map((v) => v > 0.7); // slower than this is a camera drifting, not a move: the viewer can read it
    const active = new Set(p.filter((q, i) => moving[i] || (i > 0 && q.text !== p[i - 1].text)).map((q) => q.n));
    const first = moving.indexOf(true);
    // runs of movement: the first is the entrance, a last one that ends unseen or at the end is the exit
    const runs = []; let a = -1, still = 0;
    for (let i = 0; i < d.length; i++) {
      if (moving[i]) { if (a < 0) a = i; still = 0; } else if (a >= 0 && ++still > 2) { runs.push([a, i - still]); a = -1; still = 0; }
    }
    if (a >= 0) runs.push([a, d.length - 1 - still]);
    const firstN = p[0].n, lastN = p[p.length - 1].n;
    // on screen and still from frame 0 until it leaves late on: it never entered, so what moves is its exit
    const already = firstN === 0 && p[0].op > 0.5 && runs.length > 0 && runs[0][0] >= p.length * 0.6 && runs[runs.length - 1][1] >= p.length - 4;
    const entry = already ? null : runs[0] || null, last = already ? [runs[0][0], runs[runs.length - 1][1]] : runs.length > 1 ? runs[runs.length - 1] : null;
    const popped = firstN > 0 && p[0].op > 0.9 && (first < 0 || first > 1) && p[0].sw > 0;
    out.push({
      id: x.id, kind: x.kind, text: x.text, group: x.group, size: x.size, counter: x.counter,
      in: (p[entry ? entry[0] : 0].n) / fps, settle: entry ? p[entry[1]].n / fps : firstN / fps, inDur: entry ? (entry[1] - entry[0] + 1) / fps : 0,
      out: last ? p[last[0]].n / fps : null, outDur: last ? (last[1] - last[0] + 1) / fps : 0,
      seenFrom: firstN / fps, seenTo: lastN / fps, popped, active,
      speeds: entry ? d.slice(entry[0], entry[1] + 1) : [], outSpeeds: last ? d.slice(last[0], last[1] + 1) : [],
    });
  }
  return out;
}

const cv = (a) => { const m = a.reduce((s, v) => s + v, 0) / a.length; if (!m) return 0; return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length) / m; };
/** Where in the move the speed peaks, 0-1 (pure): 0.1-0.4 reads as fast then settling; about 0.5 is a symmetrical ease; 0.9 accelerates into a stop. */
export const peakAt = (s) => (s.length < 2 ? 0 : s.indexOf(Math.max(...s)) / (s.length - 1));

/** Motion problems over the scene (pure). tracks from motionTracks. → [{ code, what, at }] */
export function analyseMotion(tracks, { duration, alpha, wordsShown = 0, holdFrom = null, holdTo = null, L = LIMITS } = {}) {
  const out = [];
  const live = tracks.filter((x) => x.speeds.length >= 2);
  for (const x of live) {
    // the middle of the move, without its first and last frames, which are slow on any ease
    const mid = x.speeds.slice(Math.ceil(x.speeds.length * 0.2), Math.floor(x.speeds.length * 0.8));
    if (x.counter) continue; // a counter's width changes as it counts: its move is the number
    if (x.speeds.length >= L.min_move_frames && mid.length >= 3 && cv(x.speeds) < L.linear_cv) out.push({ code: 'LINEAR_MOVE', at: x.in, what: `${shortText(x.text)} moves at a constant speed for ${x.inDur.toFixed(2)} s: ease it` });
    else if (x.kind === 'text' && x.speeds.length >= L.min_move_frames && peakAt(x.speeds) > 0.62) out.push({ code: 'ACCELERATES_IN', at: x.in, what: `${shortText(x.text)} is fastest at the end of its entrance: it should arrive slowly` });
    const longest = Math.max(...live.filter((y) => y.kind === 'text').map((y) => y.inDur), 0);
    if (x.kind === 'text' && x.out != null && longest && x.outDur > longest * L.exit_ratio + 0.05) out.push({ code: 'SLOW_EXIT', at: x.out, what: `${shortText(x.text)} leaves in ${x.outDur.toFixed(2)} s, but nothing took longer than ${longest.toFixed(2)} s to arrive: exits are shorter than entrances` });
  }
  for (const x of tracks) if (x.popped) out.push({ code: 'POPS_IN', at: x.seenFrom, what: `${shortText(x.text)} appears from nothing in one frame` });
  // staging: starts bunched on one frame, or every move the same length
  const texts = live.filter((x) => x.kind === 'text');
  const groups = new Map(); for (const x of texts) { if (!groups.has(x.group)) groups.set(x.group, x); }
  const leads = [...groups.values()];
  const byStart = new Map(); for (const x of leads) { const k = Math.round(x.in * 30); byStart.set(k, [...(byStart.get(k) || []), x]); }
  for (const [k, g] of byStart) if (g.length >= 3) out.push({ code: 'ALL_AT_ONCE', at: k / 30, what: `${g.length} text blocks start on the same frame: stagger them so the eye has one thing to follow` });
  if (leads.length >= 3 && new Set(leads.map((x) => Math.round(x.inDur * 30))).size === 1) out.push({ code: 'EQUAL_TIMING', at: leads[0].in, what: `every text block takes exactly ${leads[0].inDur.toFixed(2)} s: give the hero more weight, the support less` });
  // reading time: from the moment the last words have landed to the moment the first leave
  if (wordsShown && holdFrom != null && holdTo != null) {
    // reading starts when the first words land, not when the last do
    const landed = Math.min(...tracks.filter((x) => x.kind === 'text' && x.inDur).map((x) => x.settle), holdFrom);
    const need = Math.max(L.read_min, L.read_pad + wordsShown / L.read_wps), have = holdTo - landed;
    if (have < need - 0.05) out.push({ code: 'NOT_ENOUGH_READ_TIME', at: holdFrom, what: `${wordsShown} words held ${have.toFixed(1)} s: they need about ${need.toFixed(1)} s` });
  }
  if (holdFrom == null) out.push({ code: 'NOTHING_RESTS', at: 0, what: 'nothing ever stands still: a viewer needs a hold to read' });
  if (alpha && tracks.some((x) => x.kind === 'text' && x.seenTo >= duration - 0.05)) out.push({ code: 'NO_EXIT', at: duration, what: 'text is still on screen on the last frame of an overlay: it would cut off' });
  return out;
}

/** The frames worth looking at (pure): the middle of each entrance and exit, the hold, and an even spread. */
export function keyMoments(tracks, duration, n = 12) {
  const want = [];
  for (const x of tracks) { if (x.inDur) want.push(x.in + x.inDur * 0.5); if (x.outDur) want.push(x.out + x.outDur * 0.5); }
  const even = Array.from({ length: n }, (_, i) => ((i + 0.5) / n) * duration);
  const pick = [...want.sort((a, b) => a - b).filter((t, i, a) => !i || t - a[i - 1] > duration / (n * 2)), ...even].slice(0, n * 2).sort((a, b) => a - b);
  const out = [];
  for (const t of pick) if (!out.some((o) => Math.abs(o - t) < duration / (n * 1.6))) out.push(t);
  return out.slice(0, n).map((t) => Math.round(t * 100) / 100);
}

// ── contrast, from the rendered frame ──
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export const luminance = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
export const parseRgb = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return v.length >= 3 ? v.slice(0, 3) : null; };

/** The contact sheet's page: frames with their times, a phone-sized view of the busiest one, and the plate alpha sits on. */
export function sheetHtml(frames, { W, H, plate = false, over = null, title = '' } = {}) {
  const cols = frames.length > 9 ? 4 : 3, w = 2400 / cols, h = (w * H) / W;
  const ground = over ? `background:#000 url("${over}") center/cover no-repeat;` : plate ? 'background:#6f7478 url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\'%3E%3Crect width=\'20\' height=\'20\' fill=\'%23666a6e\'/%3E%3Crect x=\'20\' y=\'20\' width=\'20\' height=\'20\' fill=\'%23666a6e\'/%3E%3C/svg%3E");' : 'background:#000;';
  return `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:24px;background:#16181a;color:#e6e6e6;font:600 26px/1.2 Consolas,monospace;width:2400px}
.g{display:grid;grid-template-columns:repeat(${cols},${w}px);gap:12px 0}.f{position:relative;width:${w - 12}px;height:${(h * (w - 12)) / w}px;${ground}overflow:hidden}.f img{width:100%;height:100%;display:block}
.t{position:absolute;left:6px;bottom:6px;background:#000c;padding:2px 8px}.s{position:absolute;inset:5%;outline:1px dashed #fff5}.p{display:flex;gap:16px;align-items:flex-end;margin-top:20px}.ph{width:390px;${ground}overflow:hidden;position:relative}.ph img{width:100%;display:block}</style>
<div style="margin-bottom:12px">${title}</div><div class="g">${frames.map((f) => `<div class="f"><img src="${f.url}"><div class="s"></div><div class="t">${f.t.toFixed(2)} s</div></div>`).join('')}</div>
<div class="p"><div class="ph"><img src="${frames[Math.floor(frames.length / 2)].url}"></div><div>phone width (390 px): can you read every word?</div></div>`;
}

/** The written answer for a check (pure): counted, worst first, each problem once with the first time it happened. */
export function summarise(issues) {
  const seen = new Map();
  for (const i of issues) { const k = `${i.code}|${i.what.replace(/[0-9.]+/g, '#')}`; if (!seen.has(k)) seen.set(k, { ...i, frames: 1 }); else seen.get(k).frames++; }
  const rank = ['NO_LOOK', 'DEFAULT_LOOK', 'STOCK_LOOK', 'REPEATED_LOOK', 'OUTSIDE_SAFE', 'TEXT_OVERLAP', 'LINE_THROUGH_TEXT', 'TOUCHING', 'LOW_CONTRAST', 'LOOSE_NUMERAL', 'INK_TIGHT', 'POINTER_ADRIFT', 'DEAD_ZONE', 'HERO_SMALL', 'EMPTY_FIRST_FRAME', 'SILENT_PIECE', 'STALE', 'REPEATED_FACE', 'ALMOST_CENTRED', 'TOO_SMALL', 'NOT_ENOUGH_READ_TIME', 'NO_EXIT', 'POPS_IN', 'LINEAR_MOVE', 'ALL_AT_ONCE', 'EQUAL_TIMING', 'ACCELERATES_IN', 'SLOW_EXIT', 'TOO_MANY_LINES', 'NOTHING_RESTS'];
  return [...seen.values()].sort((a, b) => rank.indexOf(a.code) - rank.indexOf(b.code));
}

export function wordsIn(items) { return new Set(items.filter((i) => i.kind === 'text' && i.op > 0.3).flatMap((i) => i.text.split(/\s+/).filter(Boolean))).size; }
export const pngDir = (dir) => { fs.mkdirSync(dir, { recursive: true }); return dir; };
export const fileUrl = (f) => `file:///${path.resolve(f).replace(/\\/g, '/').replace(/^\/+/, '')}`;
