#!/usr/bin/env node
// post-prod's animation harness from the command line (4 Nov 2026; the engine is bin/footage/harness.js, a copy of
// server/harness.js). Claude runs it from the watch loop or /post-prod:animate:
//   node animate.mjs list                                   the starter library
//   node animate.mjs new <library-scene> <folder>           copy a library scene to edit (scene.html, scene.json)
//   node animate.mjs still <scene> [--t 2.5] [--out f.png]  one frame, to look at before rendering it all
//   node animate.mjs render <scene> [--aspect 9:16 | --size 1080x1920] [--fps 60] [--format mp4|prores|webm|png]
//        [--duration 6] [--workers 4] [--style look.json] [--ref <reference folder>] [--props props.json] [--out f.mp4] [--allow-slop "why"]
//   node animate.mjs compose <spec.json>                    clips, transitions, overlays, picture in picture and sound
// A failure prints { ok: false, code, message } and exits 1; success prints the result as JSON.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderScene, still, compose, inspect } from './footage/harness.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = path.resolve(HERE, '../harness/library');
const [cmd, target, ...rest] = process.argv.slice(2);
const opt = {};
for (let i = 0; i < rest.length; i++) if (rest[i].startsWith('--')) { const k = rest[i].slice(2).replace(/-/g, '_'); const v = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true; opt[k] = v; }
const json = (f) => (f ? JSON.parse(fs.readFileSync(path.resolve(f), 'utf8')) : undefined);
const log = (m) => process.stderr.write(`${m}\n`);
const done = (r) => { process.stdout.write(`${JSON.stringify({ ok: true, ...r }, null, 1)}\n`); };
const scenePath = (t) => (t && !fs.existsSync(t) && fs.existsSync(path.join(LIB, t)) ? path.join(LIB, t) : t);
// a library scene rendered in place takes the harness's own fonts as its reference folder
const refFor = (s) => opt.ref || (s && path.resolve(s).startsWith(LIB) ? path.resolve(HERE, '../harness') : undefined);
const common = () => ({ scene: scenePath(target), out: opt.out, width: opt.size ? +opt.size.split('x')[0] : undefined, height: opt.size ? +opt.size.split('x')[1] : undefined, aspect: opt.aspect, fps: opt.fps && +opt.fps, duration: opt.duration && +opt.duration, style: json(opt.style), ref: refFor(scenePath(target)), props: json(opt.props), log });

try {
  if (cmd === 'list') {
    done({ library: fs.readdirSync(LIB).filter((d) => fs.existsSync(path.join(LIB, d, 'scene.html'))).map((d) => { const m = json(path.join(LIB, d, 'scene.json')) || {}; return { name: d, what: m.what || '', duration: m.duration, alpha: !!m.alpha }; }) });
  } else if (cmd === 'new') {
    const src = scenePath(target), to = path.resolve(rest[0] || target);
    if (!src || !fs.existsSync(path.join(src, 'scene.html'))) throw Object.assign(new Error(`No library scene ${target}. Run: node animate.mjs list`), { code: 'NO_SCENE' });
    fs.cpSync(src, to, { recursive: true });
    // the kit and the fonts travel with the scene, so the folder renders anywhere and attaches as working files whole
    const kit = path.resolve(HERE, '../harness');
    fs.copyFileSync(path.join(kit, 'pp-scene.js'), path.join(to, 'pp-scene.js'));
    const html = path.join(to, 'scene.html'); fs.writeFileSync(html, fs.readFileSync(html, 'utf8').replace(/(src=["'])\.\.\/\.\.\/pp-scene\.js/g, '$1pp-scene.js').replace(/\.\.\/\.\.\/vendor\//g, 'vendor/'));
    if (/vendor\//.test(fs.readFileSync(html, 'utf8'))) fs.cpSync(path.join(kit, 'vendor'), path.join(to, 'vendor'), { recursive: true });
    fs.cpSync(path.join(kit, 'fonts'), path.join(to, 'reference', 'fonts'), { recursive: true });
    done({ scene: to, files: fs.readdirSync(to) });
  } else if (cmd === 'still') {
    done(await still({ ...common(), t: +(opt.t || 0), alpha: opt.alpha === true }));
  } else if (cmd === 'render') {
    done(await renderScene({ ...common(), format: opt.format, workers: opt.workers && +opt.workers, allow_slop: opt.allow_slop, from: opt.from && +opt.from, to: opt.to && +opt.to, composition: opt.composition, entry: opt.entry }));
  } else if (cmd === 'compose') {
    const spec = json(target);
    done(await compose(spec, { base: path.dirname(path.resolve(target)), log }));
  } else if (cmd === 'inspect') {
    done(inspect(scenePath(target)));
  } else {
    throw Object.assign(new Error('Commands: list, new, still, render, compose, inspect'), { code: 'BAD_COMMAND' });
  }
} catch (e) {
  process.stdout.write(`${JSON.stringify({ ok: false, code: e.code || 'FAILED', message: e.message, ...(e.slop ? { slop: e.slop } : {}) }, null, 1)}\n`);
  process.exit(1);
}
