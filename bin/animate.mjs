#!/usr/bin/env node
// post-prod's animation harness from the command line (4 Nov 2026; the engine is bin/footage/harness.js, a copy of
// server/harness.js). Claude runs it from the watch loop or /post-prod:animate:
//   node animate.mjs list                                   the starter library
//   node animate.mjs looks [--for "<the brief>"] [--avoid #hex,#hex]  the stock looks, faces, what was used lately, and the kind of ground to reach for
//   node animate.mjs new <library-scene> <folder> --sheet look.json  copy a library scene to edit, in a look written down as numbers (or --look <name> --named, when someone named one)
//   node animate.mjs still <scene> [--t 2.5] [--out f.png]  one frame, to look at before rendering it all
//   node animate.mjs check <scene> [--aspect 9:16] [--frames 12] [--over frame.png] [--alpha]  measure every frame: layout, motion, reading time, contrast; a contact sheet, on the real picture with --over
//   node animate.mjs render <scene> [--accept CODE,CODE --because "why"] [--aspect 9:16 | --size 1080x1920] [--fps 60] [--format mp4|prores|webm|png] [--final]
//        [--duration 6] [--workers 4] [--style look.json] [--ref <reference folder>] [--props props.json] [--out f.mp4] [--allow-slop "why"]
//   node animate.mjs sfx <kind> [--out f.wav] [--dur 0.5] [--seed 3] [--note 220]  one original sound effect, made here (no samples)
//   node animate.mjs sound <file> [--hits 1.2,3.4] [--target -14] [--overlay]  measure a mix: loudness, peaks, hits against frames, pictures of it
//   node animate.mjs hf status [--install]                 what HyperFrames can do here, as the room's tools.hyperframes (never signs in)
//   node animate.mjs hf run [--dir <folder>] -- <command>  one HyperFrames command, its failures in plain words; sign-in, spending and uploads are refused
//   node animate.mjs strip <video> [--out folder]            the frames either side of every cut, for the art director
//   node animate.mjs level <piece> --into <video> --out f.mp4 [--from 10 --to 40] [--gap]  bring a piece down to the voice in a video it is going into (--gap: the voice stops for it)
//   node animate.mjs compose <spec.json>                    clips, transitions, overlays, picture in picture and sound
// A failure prints { ok: false, code, message } and exits 1; success prints the result as JSON.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderScene, still, compose, inspect, checkScene, cutStrips, sfx, soundCheck, levelInto, UNDER_VOICE, SFX_KINDS } from './footage/harness.js';
import { contrast, groundKind, groundFor, luminance, readUsedLooks, sheetProblems, saveCheck, finalGate } from './footage/harness-check.js';
import { hfStatus, hfRun } from './footage/harness-hf.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = path.resolve(HERE, '../harness/library'), LOOKS = path.resolve(HERE, '../harness/looks');
const [cmd, target, ...rest] = process.argv.slice(2);
const opt = {};
if (target?.startsWith('--')) rest.unshift(target);
for (let i = 0; i < rest.length; i++) if (rest[i].startsWith('--')) { const k = rest[i].slice(2).replace(/-/g, '_'); const v = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true; opt[k] = v; }
const json = (f) => (f ? JSON.parse(fs.readFileSync(path.resolve(f), 'utf8')) : undefined);
const log = (m) => process.stderr.write(`${m}\n`);
const done = (r) => { process.stdout.write(`${JSON.stringify({ ok: true, ...r }, null, 1)}\n`); };
const scenePath = (t) => (t && !fs.existsSync(t) && fs.existsSync(path.join(LIB, t)) ? path.join(LIB, t) : t);
// a library scene rendered in place takes the harness's own fonts as its reference folder
const refFor = (s) => opt.ref || (s && path.resolve(s).startsWith(LIB) ? path.resolve(HERE, '../harness') : undefined);
const final = opt.final === true;
// a final only from a check of exactly these files, and an override has a name and a reason
const accepted = () => String(opt.accept || '').split(',').map((x) => x.trim()).filter(Boolean);
const askedFor = () => JSON.stringify([opt.props ? json(opt.props) : null, opt.aspect || null, opt.size || null]);
function needClean(dir, extra = askedFor()) {
  const g = finalGate(dir, { accept: accepted(), because: opt.because, extra });
  if (!g.ok) throw Object.assign(new Error(g.message), { code: g.code });
  return g.accepted;
}
const hexOf = (v, flag) => { const h = `#${String(v).replace(/^#/, '')}`.toUpperCase(); if (!/^#[0-9A-F]{6}$/.test(h)) throw Object.assign(new Error(`--${flag} takes a colour like #1B2FD6`), { code: 'BAD_COLOUR' }); return h; };
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, k) => `#${rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * k).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
const ratio = (a, b) => contrast(luminance(...rgb(a)), luminance(...rgb(b)));
/** A look with this subject's colours: a new ground brings ink that reads on it, tinted by the ground. */
function recolour(look, accent, ground) {
  const c = { ...look.colours };
  if (ground) {
    c.paper = ground;
    if (ratio(c.ink, ground) < 7) c.ink = [mix(ground, '#FFFFFF', 0.93), mix(ground, '#000000', 0.88)].sort((a, b) => ratio(b, ground) - ratio(a, ground))[0];
    c.muted = mix(c.ink, ground, 0.4);
  }
  if (accent) c.accent = accent;
  return c;
}
const common = () => ({ scene: scenePath(target), out: opt.out, width: opt.size ? +opt.size.split('x')[0] : undefined, height: opt.size ? +opt.size.split('x')[1] : undefined, aspect: opt.aspect, fps: opt.fps && +opt.fps, duration: opt.duration && +opt.duration, style: json(opt.style), ref: refFor(scenePath(target)), props: json(opt.props), log });

try {
  if (cmd === 'list') {
    done({ library: fs.readdirSync(LIB).filter((d) => fs.existsSync(path.join(LIB, d, 'scene.html'))).map((d) => { const m = json(path.join(LIB, d, 'scene.json')) || {}; return { name: d, what: m.what || '', duration: m.duration, alpha: !!m.alpha }; }) });
  } else if (cmd === 'looks') {
    done({ looks: fs.readdirSync(LOOKS).filter((f) => f.endsWith('.json')).map((f) => { const l = json(path.join(LOOKS, f)); return { name: l.name, for: l.for, type: `${l.fonts.display} + ${l.fonts.body}`, ground: l.colours.paper, ground_kind: groundKind(l.colours.paper), accent: l.colours.accent, motion: l.motion?.character, sound: l.sound }; }), faces: json(path.join(HERE, '../harness/fonts/faces.json')), used_lately: readUsedLooks().slice(-8).map((r) => ({ look: r.look, scene: r.name, ground_kind: r.ground, display_face: r.display })), ...(opt.for ? { ground_to_try: groundFor(opt.for, { recent: readUsedLooks().slice(-8).map((r) => r.ground), avoid: String(opt.avoid || '').split(',').filter(Boolean) }) } : {}), how: 'These looks are for when someone names one (new <scene> <folder> --look <name> --named), and as examples of a finished sheet. Otherwise write the look down as numbers from the subject\'s world and pass it with --sheet look.json. Do not reuse what is in used_lately.' });
  } else if (cmd === 'new') {
    const src = scenePath(target), to = path.resolve(rest[0] || target);
    if (!src || !fs.existsSync(path.join(src, 'scene.html'))) throw Object.assign(new Error(`No library scene ${target}. Run: node animate.mjs list`), { code: 'NO_SCENE' });
    fs.cpSync(src, to, { recursive: true });
    // the kit and the fonts travel with the scene, so the folder renders anywhere and attaches as working files whole
    const kit = path.resolve(HERE, '../harness');
    fs.copyFileSync(path.join(kit, 'pp-scene.js'), path.join(to, 'pp-scene.js'));
    const html = path.join(to, 'scene.html'); fs.writeFileSync(html, fs.readFileSync(html, 'utf8').replace(/(src=["'])\.\.\/\.\.\/pp-scene\.js/g, '$1pp-scene.js').replace(/\.\.\/\.\.\/vendor\//g, './vendor/'));
    if (/vendor\//.test(fs.readFileSync(html, 'utf8'))) fs.cpSync(path.join(kit, 'vendor'), path.join(to, 'vendor'), { recursive: true });
    if (opt.look || opt.sheet) {
      // a look brings its own fonts and its tokens, and only those, so the folder stays small and renders the same anywhere
      const lf = opt.sheet ? path.resolve(opt.sheet) : path.join(LOOKS, `${opt.look}.json`);
      if (!fs.existsSync(lf)) throw Object.assign(new Error(opt.sheet ? `No look sheet at ${lf}` : `No look ${opt.look}. Run: node animate.mjs looks`), { code: 'NO_LOOK' });
      const look = json(lf), want = new Set(Object.values(look.fonts || {}).filter(Boolean).map((n) => n.toLowerCase().replace(/[^a-z0-9]/g, '')));
      if (opt.sheet) {
        const wrong = sheetProblems(look);
        if (wrong.length) throw Object.assign(new Error(`The look sheet needs:\n- ${wrong.join('\n- ')}`), { code: 'BAD_LOOK_SHEET', problems: wrong });
        const have = new Set(fs.readdirSync(path.join(kit, 'fonts')).map((f) => f.toLowerCase().replace(/[^a-z0-9]/g, '')));
        const gone = Object.values(look.fonts).filter((n) => n && ![...have].some((h) => h.startsWith(n.toLowerCase().replace(/[^a-z0-9]/g, ''))));
        if (gone.length && !fs.existsSync(path.join(to, 'reference', 'fonts'))) log(`Not shipped: ${gone.join(', ')}. Put their files in ${path.join(to, 'reference', 'fonts')}, or choose from animate.mjs looks (faces).`);
      }
      fs.mkdirSync(path.join(to, 'reference', 'fonts'), { recursive: true });
      for (const f of fs.readdirSync(path.join(kit, 'fonts'))) { const base = f.replace(/\.(woff2?|ttf|otf)$/i, '').replace(/[-_](latin|var|variable|vf|regular|webfont).*$/i, '').toLowerCase().replace(/[^a-z0-9]/g, ''); if (want.has(base) || /^OFL/i.test(f)) fs.copyFileSync(path.join(kit, 'fonts', f), path.join(to, 'reference', 'fonts', f)); }
      const accent = opt.accent && hexOf(opt.accent, 'accent'), ground = opt.ground && hexOf(opt.ground, 'ground');
      fs.writeFileSync(path.join(to, 'style.json'), JSON.stringify({ ...look, colours: recolour(look, accent, ground), ...(opt.sheet ? {} : { from_look: look.name, ...(opt.named === true ? { named: true } : {}) }) }, null, 2));
    } else fs.cpSync(path.join(kit, 'fonts'), path.join(to, 'reference', 'fonts'), { recursive: true });
    done({ scene: to, look: opt.look || (opt.sheet ? path.basename(opt.sheet) : null), files: fs.readdirSync(to) });
  } else if (cmd === 'still') {
    done(await still({ ...common(), t: +(opt.t || 0), alpha: opt.alpha === true }));
  } else if (cmd === 'render') {
    const over = final && opt.skip_gate === undefined && fs.existsSync(path.join(path.resolve(scenePath(target) || '.'), 'scene.html')) && !path.resolve(scenePath(target)).startsWith(LIB) ? needClean(path.resolve(scenePath(target))) : null;
    if (over) log(`Accepted without a fix: ${over.codes.join(', ')} (${over.because}). Say so in your reply.`);
    done(await renderScene({ ...common(), final, shutter: opt.shutter, samples: opt.samples, ss: opt.ss, format: opt.format, workers: opt.workers && +opt.workers, allow_slop: opt.allow_slop, from: opt.from && +opt.from, to: opt.to && +opt.to, composition: opt.composition, entry: opt.entry }));
  } else if (cmd === 'check') {
    const r = await checkScene({ ...common(), frames: opt.frames, over: opt.over && path.resolve(opt.over), alpha: opt.alpha === true ? true : undefined, remember: true });
    const dir = path.resolve(scenePath(target)); if (!dir.startsWith(LIB)) saveCheck(dir, r.issues, askedFor());
    done(r);
  } else if (cmd === 'sfx') {
    done(sfx(target, { ...opt, file: opt.out }));
  } else if (cmd === 'sound') {
    done(await soundCheck(target, { hits: opt.hits ? String(opt.hits).split(',').map(Number) : [], target: opt.target, overlay: opt.overlay === true, fps: opt.fps, out: opt.out }));
  } else if (cmd === 'hf') {
    const raw = process.argv.slice(2), dash = raw.indexOf('--');
    if (target === 'status') done({ tools: { hyperframes: await hfStatus({ install: opt.install === true }) } });
    else if (target === 'run') {
      const args = dash < 0 ? [] : raw.slice(dash + 1), cwd = opt.dir ? path.resolve(opt.dir) : process.cwd();
      // their render is a final too, unless it is plainly a draft
      const q = args.indexOf('--quality'), final = args[0] === 'render' && !(q >= 0 && args[q + 1] === 'draft'), over = final ? needClean(cwd) : null;
      if (over) log(`Accepted without a fix: ${over.codes.join(', ')} (${over.because}). Say so in your reply.`);
      // it comes out of their render silent, and that is the default. sounds.json, there only when they asked for sound, is mixed in straight after
      const f = args.indexOf('--format'), overlay = f >= 0 && /^(mov|webm|png-sequence)$/.test(args[f + 1]), sounds = path.join(cwd, 'sounds.json'), scored = final && !overlay && fs.existsSync(sounds);
      const r = await hfRun(args, { cwd });
      if (r.ok && scored) {
        const o = args.indexOf('-o'), file = o >= 0 ? args[o + 1] : null, index = fs.readFileSync(path.join(cwd, 'index.html'), 'utf8');
        if (!file) throw Object.assign(new Error('Give the render an output with -o, so the sound can be mixed in.'), { code: 'BAD_ARGS' });
        const size = `${/data-width="(\d+)"/.exec(index)?.[1] || 1920}x${/data-height="(\d+)"/.exec(index)?.[1] || 1080}`, spec = json(sounds), tmp = `${file}.sound.mp4`;
        const c = await compose({ base: file, audio: (spec.audio || []).map((x) => ({ kind: 'sfx', ...x })), master: spec.master ?? null, size, out: tmp }, { base: cwd, log });
        fs.renameSync(c.file, path.resolve(cwd, file));
        r.output = `${r.output}\nsound mixed in and mastered: ${file}`;
      }
      if (!r.ok) throw Object.assign(new Error(r.say || 'HyperFrames could not do that.'), { code: r.code || 'HF_FAILED', output: r.output });
      done({ output: r.output });
    } else throw Object.assign(new Error('hf status or hf run'), { code: 'BAD_COMMAND' });
  } else if (cmd === 'strip') {
    done(await cutStrips(target, { out: opt.out, fps: opt.fps && +opt.fps }));
  } else if (cmd === 'level') {
    if (!target || !opt.into || !opt.out) throw Object.assign(new Error('level needs a file, --into <video> and --out <file>'), { code: 'BAD_ARGS' });
    done(await levelInto(path.resolve(target), path.resolve(opt.into), { out: path.resolve(opt.out), around: opt.from != null ? { from: +opt.from, to: opt.to != null ? +opt.to : undefined } : {}, under: opt.gap === true ? UNDER_VOICE.gap : UNDER_VOICE.speech }));
  } else if (cmd === 'compose') {
    const spec = json(target);
    done(await compose(spec, { base: path.dirname(path.resolve(target)), log }));
  } else if (cmd === 'inspect') {
    done(inspect(scenePath(target)));
  } else {
    throw Object.assign(new Error(`Commands: list, looks, new, still, check, render, sfx (${SFX_KINDS.join(', ')}), sound, strip, level, compose, inspect`), { code: 'BAD_COMMAND' });
  }
} catch (e) {
  process.stdout.write(`${JSON.stringify({ ok: false, code: e.code || 'FAILED', message: e.message, ...(e.slop ? { slop: e.slop } : {}), ...(e.output ? { output: e.output } : {}) }, null, 1)}\n`);
  process.exit(1);
}
