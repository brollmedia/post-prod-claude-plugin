// COPY of post-prod's server/harness.js, made by tools/build-plugin-footage.js. Change the original, then run that.
// The animation harness (4 Nov 2026, Seth: "Build the harness, we need to ensure that its able to create any type of animation,
// graphic, edit. beacuse we're going to have a very vast variety of creators"). One way for Claude to make any animation,
// graphic or edit in the creator's own style, render it exactly, put it on their footage, and take notes on it in post-prod.io.
//
// THE SCENE CONTRACT. A scene is a folder with scene.html (any HTML/CSS/JS: SVG, canvas, WebGL/three.js, Lottie, GSAP) and an
// optional scene.json { width, height, fps, duration, alpha, props, audio: [{ src, at, from, to, gain_db, fade_in, fade_out }] }.
// The page may define window.ready() (returns { duration } or nothing, may be async: load what it needs) and window.seek(t)
// (draw the frame at t seconds, may be async). A page with seek() is drawn frame by frame at exactly t = frame / fps, in any
// order, so it renders in parallel. A page without it still renders exactly: its clock (requestAnimationFrame, timers, Date,
// performance.now, CSS and Web Animations, <video>) is replaced and moved one frame at a time (footage-fx.js CLOCK).
// Before any of its code runs the page gets window.PP_STYLE (the creator's style profile as tokens), window.PP_PROPS (the
// scene's content: the words, numbers, places) and the same tokens as CSS variables (--pp-ink, --pp-accent, --pp-display …)
// with @font-face rules for the fonts found in the reference folder. Remotion and HyperFrames projects render through their
// own CLIs (a HyperFrames page renders here too when its CLI is not there: it is HTML on a clock).
//
// RENDER. Any size, fps, aspect and length; mp4 (H.264), prores (ProRes 4444 with alpha), webm (VP9 with alpha) or png (a
// numbered sequence with alpha). Frames are drawn by up to `workers` browsers at once, each a stretch of the timeline written
// as its own segment, joined without encoding again. Audio from the manifest is mixed in sync after. Fonts that fail to load
// are an error, not a silent fallback. The person's own Chrome or Edge renders it (no download); on our server, Chromium.
//
// SLOP OUT. slopCheck (footage-fx.js) reads the scene and its stylesheets before a frame is drawn; anything it finds stops
// the render (code SLOP) unless the caller passes allow_slop with the reason the creator wants it (a gaming channel's neon).
//
// COMPOSE. Clips in order with cuts or transitions (ffmpeg xfade, or a transition scene laid over the join), overlays with
// alpha at frame ranges, picture in picture, and audio, from the originals at full quality (compose()). Zooms, blurs (still
// or tracked), captions and cuts on a whole cut stay with the existing engines (footage-fx.js applyEffects, server/render.js).
// Pure node + ffmpeg + a browser; copied into the plugin by tools/build-plugin-footage.js like the cut engine.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { run, probe, FF } from './footage-run.js';
import { findBrowser, slopCheck, CLOCK, cdp } from './footage-fx.js';

const err = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });
export const FORMATS = ['mp4', 'prores', 'webm', 'png'];
export const ASPECTS = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350], '4:3': [1440, 1080], '21:9': [2560, 1080] };
const FONT_EXT = /\.(woff2?|ttf|otf)$/i;
const even = (n) => Math.max(2, 2 * Math.round(n / 2));
// the scene kit's folder (its fonts are a scene's last-resort reference folder): beside the plugin's copy, or in the repo for the server's
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const KIT_DIR = [path.resolve(HERE, '../../harness'), path.resolve(HERE, '../integrations/claude-code-plugin/harness'), path.resolve(HERE, '../harness')].find((d) => fs.existsSync(path.join(d, 'pp-scene.js'))) || null;
/** ffmpeg's atempo takes 0.5-2 per step: a speed outside that is a chain of steps. */
export function atempoChain(sp) { const out = []; let r = sp; while (r > 2) { out.push('atempo=2'); r /= 2; } while (r < 0.5) { out.push('atempo=0.5'); r /= 0.5; } out.push(`atempo=${Math.round(r * 1e4) / 1e4}`); return out.join(','); }

// ── the scene ──
/** What a folder (or a file) holds: { kind: 'html' | 'remotion' | 'hyperframes', dir, entry, manifest }. */
export function inspect(target) {
  const abs = path.resolve(target);
  if (!fs.existsSync(abs)) throw err('NO_SOURCE', `Nothing at ${abs}.`);
  const isFile = fs.statSync(abs).isFile();
  const dir = isFile ? path.dirname(abs) : abs;
  let pkg = null; try { pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); } catch { /* not a node project */ }
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
  let manifest = {}; const mf = path.join(dir, 'scene.json');
  if (fs.existsSync(mf)) { try { manifest = JSON.parse(fs.readFileSync(mf, 'utf8')); } catch (e) { throw err('BAD_MANIFEST', `scene.json is not valid JSON: ${e.message}`); } }
  if (!isFile && (deps.remotion || deps['@remotion/cli'])) return { kind: 'remotion', dir, entry: null, manifest };
  const html = isFile ? abs : ['scene.html', 'index.html'].map((f) => path.join(dir, f)).find((f) => fs.existsSync(f));
  if (!isFile && (deps.hyperframes || deps['@hyperframes/core'] || fs.existsSync(path.join(dir, 'hyperframes.json')))) return { kind: 'hyperframes', dir, entry: html || null, manifest };
  if (!html) throw err('NO_SCENE', `No scene.html or index.html in ${dir}, and it is not a Remotion or HyperFrames project.`);
  return { kind: 'html', dir, entry: html, manifest };
}

/** The page and the stylesheets and scripts it loads from this folder, as one text for the slop check. */
function sourceText(entry) {
  let s = fs.readFileSync(entry, 'utf8');
  const dir = path.dirname(entry);
  for (const m of s.matchAll(/<(?:link[^>]+href|script[^>]+src)=["']([^"':]+\.(?:css|js|mjs))["']/gi)) {
    const f = path.resolve(dir, m[1]);
    // the harness's own scene kit is checked once, by its tests, not as part of every scene
    if (fs.existsSync(f) && !/pp-scene\.js$|three(\.module)?(\.min)?\.js$/.test(f)) s += '\n' + fs.readFileSync(f, 'utf8');
  }
  return s;
}

// ── style in ──
const ROLE = [['paper', /\b(background|paper|base|bg)\b/i], ['ink', /\b(text|ink|type|foreground)\b/i], ['accent', /\b(accent|brand|highlight|primary|key)\b/i], ['accent2', /\b(second|secondary|support|alt)\b/i], ['muted', /\b(muted|grey|gray|neutral|subtle)\b/i]];
/** The fonts in a reference folder (and its fonts/ folder), by family name as written in the file name. */
export function fontsIn(dir) {
  const out = [];
  for (const d of [dir, dir && path.join(dir, 'fonts')].filter(Boolean)) {
    if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) continue;
    for (const f of fs.readdirSync(d)) if (FONT_EXT.test(f)) out.push({ file: path.join(d, f), name: f.replace(FONT_EXT, '').replace(/[-_](latin|var|variable|vf|regular|webfont).*$/i, '').replace(/[-_]+/g, ' ').trim() });
  }
  return out;
}
/**
 * The creator's style as tokens a scene reads (pure but for listing fonts). style: the style profile's look (get_style_guide:
 * { type: [{ face, use, free_match }], colours: [{ hex, role }], text, pace, graphics, rules }) or tokens already ({ colours:
 * { ink, paper, accent … }, fonts: { display, body, mono } }). ref: the reference folder. → { tokens, css, warnings }
 */
export function styleTokens(style = {}, { ref = null, fallback = {} } = {}) {
  const warnings = [];
  const colours = { ink: '#F4F1EA', paper: '#14110F', accent: '#E8A33D', accent2: '#7FB7A4', muted: '#8A837A', ...(fallback.colours || {}) };
  if (style?.colours && !Array.isArray(style.colours)) Object.assign(colours, style.colours);
  for (const c of Array.isArray(style?.colours) ? style.colours : []) {
    const r = ROLE.find(([, re]) => re.test(c.role || ''));
    if (r && /^#[0-9a-f]{6}$/i.test(c.hex)) colours[r[0]] = c.hex.toUpperCase();
  }
  const fonts = { display: null, body: null, mono: null, ...(fallback.fonts || {}), ...(style?.fonts || {}) };
  const have = fontsIn(ref);
  const pick = (want) => { if (!want) return null; const w = want.toLowerCase().replace(/[^a-z0-9]/g, ''); return have.find((f) => f.name.toLowerCase().replace(/[^a-z0-9]/g, '').startsWith(w)) || null; };
  for (const t of Array.isArray(style?.type) ? style.type : []) {
    const slot = /\b(body|paragraph|small|caption)\b/i.test(t.use || '') ? 'body' : /\b(mono|code|number|data)\b/i.test(t.use || '') ? 'mono' : fonts.display && fonts.display !== fallback.fonts?.display ? 'body' : 'display';
    const f = pick(t.face) || pick(t.free_match);
    if (f) fonts[slot] = f.name; else warnings.push(`The font "${t.face}"${t.free_match ? ` (or ${t.free_match})` : ''} is not in the reference folder: add its file so the render uses it.`);
  }
  // nothing said about type: the reference folder's own fonts (a serif for display when there is one), never the browser's default
  const named = (re) => have.find((f) => re.test(f.name))?.name || null;
  if (!fonts.display) fonts.display = named(/fraunces|serif|display/i) || have[0]?.name || null;
  if (!fonts.body) fonts.body = named(/sans|grotesk|instrument/i) || fonts.display;
  if (!fonts.mono) fonts.mono = named(/mono|code/i) || fonts.body;
  if (!have.length) warnings.push('No font files in the reference folder: the scene keeps whatever its own CSS loads.');
  const faces = have.filter((f) => Object.values(fonts).includes(f.name));
  const css = [
    ...faces.map((f) => `@font-face{font-family:"${f.name}";src:url("${pathToFileUrl(f.file)}");font-display:block;font-weight:100 900}`),
    `:root{${Object.entries(colours).map(([k, v]) => `--pp-${k}:${v}`).join(';')};--pp-display:"${fonts.display || fonts.body}",serif;--pp-body:"${fonts.body || fonts.display}",serif;--pp-mono:"${fonts.mono || fonts.body}",monospace;--pp-pace:${paceOf(style)}}`,
  ].join('\n');
  return { tokens: { colours, fonts, pace: paceOf(style), text: style?.text || [], graphics: style?.graphics || [], rules: style?.rules || [] }, css, warnings };
}
const pathToFileUrl = (f) => 'file:///' + path.resolve(f).replace(/\\/g, '/').replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/').replace(/^([A-Za-z])%3A/, '$1:');
/** A pace multiplier from the profile: 1 normal, under 1 quicker moves, over 1 slower. */
function paceOf(style) {
  const words = [...(style?.pace || []).map((p) => `${p.value} ${p.label}`), ...(style?.text || [])].join(' ').toLowerCase();
  if (typeof style?.pace === 'number') return style.pace;
  return /\b(fast|snappy|quick|punchy|hype)\b/.test(words) ? 0.8 : /\b(slow|calm|gentle|cinematic|documentary)\b/.test(words) ? 1.25 : 1;
}

// ── render ──
const ENCODE = {
  mp4: { ext: '.mp4', v: ['-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p'], a: ['-c:a', 'aac', '-b:a', '256k'], alpha: false },
  prores: { ext: '.mov', v: ['-c:v', 'prores_ks', '-profile:v', '4', '-pix_fmt', 'yuva444p10le', '-vendor', 'apl0'], a: ['-c:a', 'pcm_s16le'], alpha: true },
  webm: { ext: '.webm', v: ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '22', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-auto-alt-ref', '0'], a: ['-c:a', 'libopus', '-b:a', '192k'], alpha: true },
};

async function openBrowser(width, height) {
  const browser = findBrowser();
  if (!browser) throw err('NO_BROWSER', 'Rendering needs Chrome or Edge installed (or CHROME_PATH set to one).');
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-harness-'));
  const proc = spawn(browser, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio', '--force-device-scale-factor=1', '--allow-file-access-from-files', '--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...(typeof process.getuid === 'function' && process.getuid() === 0 ? ['--no-sandbox'] : []), `--window-size=${width},${height}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  const wsUrl = await new Promise((res, rej) => {
    let buf = ''; const t = setTimeout(() => rej(err('NO_BROWSER', 'The browser did not start in 20 s.')), 20000);
    proc.stderr.on('data', (d) => { buf += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) { clearTimeout(t); res(m[1]); } });
    proc.on('exit', () => rej(err('NO_BROWSER', `The browser stopped: ${buf.slice(-300)}`)));
  });
  const c = await cdp(wsUrl);
  const close = async () => {
    try { c.close(); } catch { /* gone */ }
    if (proc.exitCode == null) { const gone = new Promise((r) => proc.once('exit', r)); try { if (process.platform === 'win32') spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); else proc.kill(); } catch { /* gone */ } await Promise.race([gone, new Promise((r) => setTimeout(r, 5000))]); }
    try { fs.rmSync(prof, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch (e) { if (e.code !== 'EPERM' && e.code !== 'EBUSY') console.error(`[harness] the browser's temporary profile ${prof} was left behind: ${e.message}`); }
  };
  return { c, close };
}

// Every <video> to its frame at t: currentTime = data-pp-from + t × data-pp-rate (default 0 and 1), held inside the clip; a video
// with data-pp-manual (the scene seeks it itself) or no source is left alone. Waits for seeked on the page's real timer, at most 3 s.
const videoSeek = (t) => `await Promise.all([...document.querySelectorAll('video')].map(v=>new Promise(r=>{v.pause();if(v.dataset.ppManual!=null||!(v.currentSrc||v.src)||v.error||v.networkState===3)return r();
  const from=+(v.dataset.ppFrom||0),rate=+(v.dataset.ppRate||1),d=v.duration;let at=from+${t}*rate;if(Number.isFinite(d)&&d>0)at=Math.min(Math.max(0,at),d-0.001);
  if(Math.abs(v.currentTime-at)<1e-4&&v.readyState>=2)return r();const done=()=>{v.removeEventListener('seeked',done);r();};v.addEventListener('seeked',done);(window.__ppRealTimeout||setTimeout)(done,3000);v.currentTime=at;})));`;
/** One page of the scene, loaded and ready: { s (session), seekable, duration, fonts }. */
async function openPage(c, { entry, width, height, alpha, style, props, log, duration = 0 }) {
  const { targetId } = await c.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: s } = await c.send('Target.attachToTarget', { targetId, flatten: true });
  await c.send('Page.enable', {}, s);
  await c.send('Runtime.enable', {}, s);
  await c.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, s);
  if (alpha) await c.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } }, s);
  const inject = `window.__ppRealTimeout=window.setTimeout.bind(window);window.PP_STYLE=${JSON.stringify(style.tokens)};window.PP_PROPS=${JSON.stringify(props || {})};window.PP_SIZE={width:${width},height:${height}};window.PP_DURATION=${+duration || 0};
document.addEventListener('DOMContentLoaded',()=>{const st=document.createElement('style');st.id='pp-style';st.textContent=${JSON.stringify(style.css)};document.head.prepend(st);});`;
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: inject + '\n' + CLOCK }, s);
  const before = c.events.length;
  await c.send('Page.navigate', { url: pathToFileUrl(entry) }, s);
  for (let i = 0; i < 400 && !c.events.slice(before).some((e) => e.method === 'Page.loadEventFired' && e.sessionId === s); i++) await new Promise((r) => setTimeout(r, 50));
  const thrown = c.events.slice(before).find((e) => e.method === 'Runtime.exceptionThrown' && e.sessionId === s);
  if (thrown) { const d = thrown.params?.exceptionDetails; throw err('SCENE_ERROR', `The scene's script failed as it loaded: ${d?.exception?.description || d?.text || 'an error'}${d?.lineNumber != null ? ` (line ${d.lineNumber + 1})` : ''}`.slice(0, 600)); }
  const ev = async (expression) => {
    const r = await c.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, s);
    if (r.exceptionDetails) throw err('SCENE_ERROR', `The scene threw: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`.slice(0, 600));
    return r.result.value;
  };
  const info = await ev(`(async()=>{const r=typeof window.ready==='function'?await window.ready():null;await (document.fonts?document.fonts.ready:null);
    await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));
    const failed=document.fonts?[...document.fonts].filter(f=>f.status==='error').map(f=>f.family):[];
    const used=new Set();for(const el of document.querySelectorAll('body *')){if(!el.childNodes.length||/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(el.tagName))continue;const has=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());if(has)used.add(getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g,'').trim());}
    const generic=/^(serif|sans-serif|monospace|system-ui|cursive|fantasy)$/;const missing=[...used].filter(f=>!generic.test(f)&&document.fonts&&!document.fonts.check('16px "'+f+'"'));
    const bg=[getComputedStyle(document.documentElement).backgroundColor,getComputedStyle(document.body).backgroundColor];
    const loaded=new Set(document.fonts?[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family.replace(/["']/g,'')):[]);const system=[...used].filter(f=>!generic.test(f)&&!loaded.has(f)&&!missing.includes(f));
    return {duration:r&&r.duration,seekable:typeof window.seek==='function',failed,missing,system,used:[...used],bg};})()`);
  if (info.failed.length) throw err('FONT_FAILED', `These fonts did not load: ${[...new Set(info.failed)].join(', ')}. Check the font files in the scene or reference folder.`);
  if (info.missing.length) log(`harness: no font file for ${info.missing.join(', ')}: the browser would substitute one, so add the file (fonts/ in the reference folder)`);
  if (info.missing.length) throw err('FONT_MISSING', `The scene uses ${info.missing.join(', ')} but no file for it is loaded: add the font file (the reference folder's fonts/), or use the style's --pp-display / --pp-body.`);
  if (info.system.length) log(`harness: ${info.system.join(', ')} come from this computer, not a font file: another computer (or our server) may not have them. Put the file in the reference folder.`);
  if (alpha && info.bg.some((b) => !/rgba\(.*,\s*0\)|transparent/.test(b))) log('harness: alpha was asked for but the page paints a background on html or body: it will come out opaque');
  return { s, ev, ...info };
}

/**
 * Render a scene. o: { scene (folder or html), out, width, height, aspect, fps, duration, format, workers, style (a look or
 * tokens), ref (the reference folder), props, audio, allow_slop, from, to, log } → { file, frames, seconds, render_s, … }
 */
export async function renderScene(o = {}) {
  const log = o.log || (() => {});
  const sc = inspect(o.scene);
  const m = sc.manifest || {};
  if (sc.kind === 'remotion') return renderRemotion(sc, o);
  if (sc.kind === 'hyperframes') { try { return await renderHyperframes(sc, o); } catch (e) { if (!sc.entry || e.code !== 'NO_CLI') throw e; log(`harness: ${e.message} Rendering its page here instead.`); } }
  const [aw, ah] = ASPECTS[o.aspect] || [];
  const width = even(+o.width || aw || +m.width || 1920), height = even(+o.height || ah || +m.height || 1080);
  const fps = +o.fps || +m.fps || 30;
  const format = o.format || m.format || (m.alpha ? 'prores' : 'mp4');
  if (!FORMATS.includes(format)) throw err('BAD_FORMAT', `format is one of ${FORMATS.join(', ')}.`);
  const alpha = format !== 'mp4' && (o.alpha ?? m.alpha ?? true);
  // slop out, before a frame is drawn
  const slop = slopCheck(sourceText(sc.entry));
  if (slop.length && !o.allow_slop) throw err('SLOP', `The scene has the look of AI defaults, so it was not rendered:\n- ${slop.join('\n- ')}\nFix them, or pass allow_slop with the creator's reason.`, { slop });
  const style = styleTokens(o.style || m.style || {}, { ref: o.ref || path.join(sc.dir, 'reference'), fallback: m.fallback_style || {} });
  for (const w of style.warnings) log(`harness: ${w}`);
  const props = { ...(m.props || {}), ...(o.props || {}) };
  const t0 = Date.now();
  const first = await openBrowser(width, height);
  let page;
  try { page = await openPage(first.c, { entry: sc.entry, width, height, alpha, style, props, log, duration: +o.duration || +m.duration || 0 }); } catch (e) { await first.close(); throw e; }
  const duration = +o.duration || +m.duration || +page.duration;
  if (!(duration > 0)) { await first.close(); throw err('NO_DURATION', 'How long is it? Give duration (seconds) in scene.json, as an option, or return { duration } from window.ready().'); }
  const from = Math.max(0, +o.from || 0), to = Math.min(duration, +o.to || duration);
  const F0 = Math.round(from * fps), F1 = Math.max(F0 + 1, Math.round(to * fps));
  const N = F1 - F0;
  // parallel only when frames can be drawn in any order; a clock-driven page plays from the start in one browser
  const workers = page.seekable ? Math.max(1, Math.min(+o.workers || Math.max(1, Math.min(6, Math.floor(os.cpus().length / 2))), Math.ceil(N / (fps * 2)))) : 1;
  const out = path.resolve(o.out || path.join(sc.dir, 'out', `${path.basename(sc.dir)}${format === 'png' ? '' : ENCODE[format].ext}`));
  fs.mkdirSync(format === 'png' ? out : path.dirname(out), { recursive: true });
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-render-'));
  if (!page.seekable) log('harness: no window.seek(): played on its own clock from the start, in one browser (PP.scene gives a scene seek)');
  log(`harness: ${N} frames at ${width}x${height} ${fps} fps, ${format}${alpha ? ' with alpha' : ''}, ${workers} at once${page.seekable ? '' : ' (no seek(): played on its clock)'}`);
  const chunks = Array.from({ length: workers }, (_, i) => [F0 + Math.floor((N * i) / workers), F0 + Math.floor((N * (i + 1)) / workers)]);
  let done = 0; const tick = () => { done++; if (done % Math.max(1, fps * 2) === 0) log(`harness: frame ${done}/${N} (${Math.round((Date.now() - t0) / 1000)} s)`); };
  const browsers = [first];
  try {
    const segs = await Promise.all(chunks.map(async ([a, b], i) => {
      let br = first, pg = page;
      if (i > 0) { br = await openBrowser(width, height); browsers.push(br); pg = await openPage(br.c, { entry: sc.entry, width, height, alpha, style, props, log, duration }); }
      return drawChunk({ c: br.c, pg, a, b, fps, format, out, work, i, alpha, tick });
    }));
    for (const b of browsers.splice(0)) await b.close();
    if (format !== 'png') await joinSegments(segs, out, work, format);
    const audio = [...(m.audio || []), ...(o.audio || [])];
    if (audio.length) await mixAudio({ audio, dir: sc.dir, out, format, from, seconds: N / fps, work });
    const render_s = Math.round((Date.now() - t0) / 100) / 10;
    log(`harness: done in ${render_s} s -> ${out}`);
    return { file: out, kind: 'html', frames: N, seconds: N / fps, width, height, fps, format, alpha, workers, render_s, fonts: page.used, warnings: style.warnings, slop_allowed: slop.length ? slop : undefined };
  } finally {
    for (const b of browsers) await b.close();
    try { fs.rmSync(work, { recursive: true, force: true }); } catch (e) { console.error(`[harness] left ${work}: ${e.message}`); }
  }
}

async function drawChunk({ c, pg, a, b, fps, format, out, work, i, alpha, tick }) {
  const seg = path.join(work, `seg-${String(i).padStart(3, '0')}${format === 'png' ? '' : ENCODE[format].ext}`);
  let enc = null, encErr = '', done = null;
  if (format !== 'png') {
    enc = spawn(FF, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(fps), '-i', '-', ...ENCODE[format].v, '-r', String(fps), seg], { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
    enc.stderr.on('data', (d) => { encErr += d; });
    done = new Promise((res, rej) => enc.on('close', (code) => (code === 0 ? res() : rej(err('FFMPEG_FAILED', `ffmpeg could not write the frames: ${encErr.slice(-300)}`)))));
  }
  try {
    // a clock-driven page plays from 0 (this is the only worker); a seekable one goes straight to its frame
    for (let f = a; f < b; f++) {
      const t = f / fps;
      if (pg.seekable) await pg.ev(`(async()=>{await window.seek(${t});for(const x of document.getAnimations()){x.pause();x.currentTime=${t * 1000};}${videoSeek(t)}})()`);
      else await pg.ev(`window.__ppAdvance(${f === a ? 0 : 1000 / fps})`);
      const { data } = await c.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false, optimizeForSpeed: true }, pg.s);
      const buf = Buffer.from(data, 'base64');
      if (format === 'png') fs.writeFileSync(path.join(out, `frame_${String(f + 1).padStart(6, '0')}.png`), buf);
      else if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once('drain', r));
      tick();
    }
  } finally { if (enc) enc.stdin.end(); }
  if (done) await done;
  return seg;
}

async function joinSegments(segs, out, work, format) {
  if (segs.length === 1) { fs.copyFileSync(segs[0], out); return; }
  const list = path.join(work, 'segments.txt');
  fs.writeFileSync(list, segs.map((s) => `file '${s.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
  await run(FF, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', ...(format === 'mp4' ? ['-movflags', '+faststart'] : []), out]);
}

/** The manifest's sounds, each at its moment, mixed and laid under the picture (the picture is not encoded again). */
async function mixAudio({ audio, dir, out, format, from, seconds, work }) {
  const ins = [], parts = [];
  audio.forEach((x, i) => {
    const src = path.resolve(dir, x.src);
    if (!fs.existsSync(src)) throw err('NO_AUDIO', `The sound ${x.src} is not there.`);
    const len = x.to != null ? Math.max(0.01, +x.to - (+x.from || 0)) : null;
    ins.push('-ss', String(+x.from || 0), ...(len ? ['-t', String(len)] : []), '-i', src);
    const at = Math.max(0, (+x.at || 0) - from), ms = Math.round(at * 1000);
    const f = [`aresample=48000`, `aformat=channel_layouts=stereo`, `volume=${(+x.gain_db || 0)}dB`];
    if (x.fade_in) f.push(`afade=t=in:st=0:d=${+x.fade_in}`);
    if (x.fade_out && len) f.push(`afade=t=out:st=${Math.max(0, len - x.fade_out)}:d=${+x.fade_out}`);
    f.push(`adelay=${ms}|${ms}`);
    parts.push(`[${i}:a]${f.join(',')}[a${i}]`);
  });
  const graph = `${parts.join(';')};${audio.map((_, i) => `[a${i}]`).join('')}amix=inputs=${audio.length}:normalize=0:dropout_transition=0,atrim=0:${seconds},apad=whole_dur=${seconds}[mix]`;
  if (format === 'png') { await run(FF, ['-hide_banner', '-loglevel', 'error', '-y', ...ins, '-filter_complex', graph, '-map', '[mix]', '-c:a', 'pcm_s16le', path.join(out, 'audio.wav')]); return; }
  const tmp = path.join(work, `withsound${ENCODE[format].ext}`);
  await run(FF, ['-hide_banner', '-loglevel', 'error', '-y', '-i', out, ...ins, '-filter_complex', graph.replace(/\[(\d+):a\]/g, (_, n) => `[${+n + 1}:a]`), '-map', '0:v', '-map', '[mix]', '-c:v', 'copy', ...ENCODE[format].a, '-shortest', ...(format === 'mp4' ? ['-movflags', '+faststart'] : []), tmp]);
  fs.copyFileSync(tmp, out);
}

/** One frame as a PNG (to look at before rendering it all): { file }. */
export async function still(o = {}) {
  const sc = inspect(o.scene), m = sc.manifest || {};
  const [aw, ah] = ASPECTS[o.aspect] || [];
  const width = even(+o.width || aw || +m.width || 1920), height = even(+o.height || ah || +m.height || 1080);
  const style = styleTokens(o.style || m.style || {}, { ref: o.ref || path.join(sc.dir, 'reference'), fallback: m.fallback_style || {} });
  const br = await openBrowser(width, height);
  try {
    const pg = await openPage(br.c, { entry: sc.entry, width, height, alpha: !!o.alpha, style, props: { ...(m.props || {}), ...(o.props || {}) }, log: o.log || (() => {}) });
    const t = +o.t || 0, fps = +o.fps || +m.fps || 30;
    if (pg.seekable) await pg.ev(`(async()=>{await window.seek(${t});for(const x of document.getAnimations()){x.pause();x.currentTime=${t * 1000};}${videoSeek(t)}})()`);
    else { for (let f = 0; f <= Math.round(t * fps); f++) await pg.ev(`window.__ppAdvance(${f === 0 ? 0 : 1000 / fps})`); }
    const { data } = await br.c.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, pg.s);
    const file = path.resolve(o.out || path.join(sc.dir, 'out', `${path.basename(sc.dir)}-${t}s.png`));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    return { file, t, width, height, seekable: pg.seekable, slop: slopCheck(sourceText(sc.entry)) };
  } finally { await br.close(); }
}

// ── Remotion and HyperFrames, through their own CLIs ──
function npx(args, cwd, log) {
  return new Promise((res, rej) => {
    const p = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { cwd, shell: process.platform === 'win32', windowsHide: true });
    let e = ''; p.stdout.on('data', (d) => log(String(d).trim())); p.stderr.on('data', (d) => { e += d; });
    p.on('error', (x) => rej(err('NO_CLI', `npx could not start: ${x.message}`)));
    p.on('close', (code) => (code === 0 ? res() : rej(err(/not found|could not determine|404/i.test(e) ? 'NO_CLI' : 'CLI_FAILED', `${args.slice(0, 2).join(' ')} failed: ${e.split(/\r?\n/).filter(Boolean).slice(-3).join(' | ')}`))));
  });
}
async function renderRemotion(sc, o) {
  const log = o.log || (() => {});
  const format = o.format || 'mp4', t0 = Date.now();
  const out = path.resolve(o.out || path.join(sc.dir, 'out', `${o.composition || 'remotion'}${format === 'png' ? '' : ENCODE[format]?.ext || '.mp4'}`));
  const args = ['remotion', 'render', ...(o.entry ? [o.entry] : []), o.composition || sc.manifest.composition || 'Main', out];
  if (format === 'prores') args.push('--codec=prores', '--prores-profile=4444', '--image-format=png', '--pixel-format=yuva444p10le');
  else if (format === 'webm') args.push('--codec=vp9', '--image-format=png', '--pixel-format=yuva420p');
  else if (format === 'png') args.push('--sequence', '--image-format=png');
  if (o.workers) args.push(`--concurrency=${o.workers}`);
  if (o.width) args.push(`--width=${o.width}`);
  if (o.height) args.push(`--height=${o.height}`);
  if (o.props) { const pf = path.join(os.tmpdir(), `pp-props-${Date.now()}.json`); fs.writeFileSync(pf, JSON.stringify(o.props)); args.push(`--props=${pf}`); }
  await npx(args, sc.dir, log);
  return { file: out, kind: 'remotion', format, render_s: Math.round((Date.now() - t0) / 100) / 10 };
}
async function renderHyperframes(sc, o) {
  const log = o.log || (() => {});
  const t0 = Date.now(), out = path.resolve(o.out || path.join(sc.dir, 'out', 'hyperframes.mp4'));
  await npx(['hyperframes', 'render', '--output', out, ...(o.fps ? ['--fps', String(o.fps)] : [])], sc.dir, log);
  return { file: out, kind: 'hyperframes', render_s: Math.round((Date.now() - t0) / 100) / 10 };
}

// ── compose onto footage ──
/**
 * spec: { size: '1920x1080' | aspect, fps, clips: [{ src, from, to, transition?: { type: xfade name | 'scene', scene, ms } }],
 * base?: one file instead of clips, layers: [{ src, at, from, to, x, y, w, h (fractions), opacity, border?: '#hex' }],
 * audio: [{ src, at, from, to, gain_db, duck? }], keep_audio: true, out }. Paths are from spec's folder (base). → { file, seconds }
 */
export async function compose(spec, { base = process.cwd(), log = () => {} } = {}) {
  const P = (f) => path.resolve(base, f);
  const [W, H] = /^\d+x\d+$/.test(spec.size || '') ? spec.size.split('x').map(Number) : ASPECTS[spec.size || spec.aspect || '16:9'] || ASPECTS['16:9'];
  const fps = +spec.fps || 30;
  const clips = spec.base ? [{ src: spec.base, from: spec.from || 0, to: spec.to }] : spec.clips || [];
  if (!clips.length) throw err('NO_CLIPS', 'Give base (one file) or clips (in order).');
  const ins = [], f = [];
  const fit = `scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},setsar=1,fps=${fps},format=yuv420p`;
  // the clips, each trimmed and fitted, joined by cuts or crossfades
  let total = 0; const lens = [];
  for (const [i, c] of clips.entries()) {
    const info = await probe(P(c.src));
    const a = +c.from || 0, b = c.to != null ? +c.to : info.duration, sp = Math.max(0.25, Math.min(4, +c.speed || 1));
    if (!(b > a)) throw err('BAD_CLIP', `Clip ${i + 1} (${c.src}) ends before it starts.`);
    ins.push('-ss', String(a), '-t', String(b - a), '-i', P(c.src));
    // speed: slower or faster (0.25-4×), the picture's frames re-timed and the sound kept at its pitch
    f.push(`[${i}:v]setpts=(PTS-STARTPTS)/${sp},${fit},settb=AVTB,setpts=PTS-STARTPTS[v${i}]`);
    const hasA = info.hasAudio && spec.keep_audio !== false;
    const tempo = sp === 1 ? '' : `,${atempoChain(sp)}`;
    f.push(hasA ? `[${i}:a]aresample=48000,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS${tempo}[a${i}]` : `anullsrc=r=48000:cl=stereo,atrim=0:${(b - a) / sp}[a${i}]`);
    lens.push((b - a) / sp);
  }
  let vl = 'v0', al = 'a0'; total = lens[0];
  const sceneJoins = [];
  for (let i = 1; i < clips.length; i++) {
    const tr = clips[i].transition, d = tr ? Math.max(0.05, (+tr.ms || 500) / 1000) : 0;
    if (tr && tr.type !== 'scene') {
      const off = total - d;
      f.push(`[${vl}][v${i}]xfade=transition=${tr.type || 'fade'}:duration=${d}:offset=${off}[vx${i}]`, `[${al}][a${i}]acrossfade=d=${d}[ax${i}]`);
      total = off + lens[i];
    } else {
      f.push(`[${vl}][${al}][v${i}][a${i}]concat=n=2:v=1:a=1[vx${i}][ax${i}]`);
      if (tr?.type === 'scene') sceneJoins.push({ at: total, scene: tr.scene, ms: +tr.ms || 800 });
      total += lens[i];
    }
    vl = `vx${i}`; al = `ax${i}`;
  }
  // a transition scene is rendered (alpha) and laid over its join, centred on it
  const layers = [...(spec.layers || [])];
  for (const j of sceneJoins) {
    const r = await renderScene({ scene: P(j.scene), width: W, height: H, fps, duration: j.ms / 1000, props: { duration: j.ms / 1000 }, format: 'prores', style: spec.style, ref: spec.ref ? P(spec.ref) : fs.existsSync(path.join(P(j.scene), 'reference')) ? path.join(P(j.scene), 'reference') : KIT_DIR, log, out: path.join(os.tmpdir(), `pp-tr-${Date.now()}.mov`) });
    layers.push({ src: r.file, at: j.at - j.ms / 2000, abs: true });
  }
  let n = clips.length;
  for (const [k, L] of layers.entries()) {
    const src = L.abs ? L.src : P(L.src);
    const isImg = /\.(png|jpe?g|webp)$/i.test(src);
    const a = +L.from || 0;
    ins.push(...(isImg ? ['-loop', '1', '-t', String((+L.to || 3) - a)] : ['-ss', String(a), ...(L.to != null ? ['-t', String(+L.to - a)] : [])]), '-i', src);
    const w = even((L.w ?? 1) * W), h = even((L.h ?? 1) * H), x = Math.round((L.x ?? 0) * W), y = Math.round((L.y ?? 0) * H);
    const at = +L.at || 0;
    const border = L.border ? `,pad=${w + 8}:${h + 8}:4:4:color=${L.border}` : '';
    f.push(`[${n}:v]scale=${w}:${h}:flags=lanczos,format=yuva444p${border}${L.opacity != null && L.opacity < 1 ? `,colorchannelmixer=aa=${L.opacity}` : ''},setpts=PTS-STARTPTS+${at}/TB[l${k}]`);
    f.push(`[${vl}][l${k}]overlay=x=${x - (L.border ? 4 : 0)}:y=${y - (L.border ? 4 : 0)}:eof_action=pass:enable='between(t,${at},${at + ((L.to != null ? +L.to : 1e6) - a)})'[o${k}]`);
    vl = `o${k}`;
    if (L.audio && !isImg) { const ms = Math.round(at * 1000); f.push(`[${n}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${+L.gain_db || 0}dB,adelay=${ms}|${ms}[la${k}]`, `[${al}][la${k}]amix=inputs=2:normalize=0:duration=first[lam${k}]`); al = `lam${k}`; }
    n++;
  }
  // more sound: music beds and effects, mixed with the clips' own sound (a bed ducks under it when duck is set)
  for (const [k, x] of (spec.audio || []).entries()) {
    ins.push('-ss', String(+x.from || 0), ...(x.to != null ? ['-t', String(+x.to - (+x.from || 0))] : []), '-i', P(x.src));
    const ms = Math.round((+x.at || 0) * 1000);
    f.push(`[${n}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${+x.gain_db || 0}dB${x.fade_in ? `,afade=t=in:d=${x.fade_in}` : ''},adelay=${ms}|${ms}[m${k}]`);
    if (x.duck) { f.push(`[${al}]asplit[sc${k}][dry${k}]`, `[m${k}][sc${k}]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[dk${k}]`, `[dry${k}][dk${k}]amix=inputs=2:normalize=0:duration=first[am${k}]`); }
    else f.push(`[${al}][m${k}]amix=inputs=2:normalize=0:duration=first[am${k}]`);
    al = `am${k}`; n++;
  }
  const out = P(spec.out || 'composed.mp4');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const t0 = Date.now();
  await run(FF, ['-hide_banner', '-loglevel', 'error', '-y', ...ins, '-filter_complex', [...f, `[${vl}]tpad=stop_mode=clone:stop_duration=0.5[vout]`].join(';'), '-map', '[vout]', '-map', `[${al}]`, '-frames:v', String(Math.round(total * fps)), '-t', String(total), ...ENCODE.mp4.v, '-r', String(fps), ...ENCODE.mp4.a, '-movflags', '+faststart', out]);
  log(`harness: composed ${total.toFixed(2)} s in ${Math.round((Date.now() - t0) / 1000)} s -> ${out}`);
  return { file: out, seconds: total, width: W, height: H, fps };
}
