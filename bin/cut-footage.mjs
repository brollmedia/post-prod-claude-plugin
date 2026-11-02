#!/usr/bin/env node
// post-prod's cut engine on the person's own computer (2 Nov 2026, Edit with Claude on footage). Claude decides what plays; this
// decides where each cut lands (on the gap between words) and how the seams sound, renders with ffmpeg and checks the result.
// The engine is a copy of post-prod's server/footage-core.js and footage-run.js (tools/build-plugin-footage.js), tested there.
//
//   node cut-footage.mjs plan   <edit-list.json>            what it would do: edges moved, sentences cut mid-way (refused), seams
//   node cut-footage.mjs render <edit-list.json> [--force]  make the file and check it; --force renders past MID_SENTENCE problems
//   node cut-footage.mjs splice --base <file> --from <s> --to <s> --section <file> --out <file>
//                                                           change one stretch of a finished file, copy the rest
//   node cut-footage.mjs check  <file>                      decode errors, black, sound and picture lengths
//   node cut-footage.mjs effect <effects.json>              titles, a checklist, subtitles, graphics, a zoom, a blur on a stretch
//   node cut-footage.mjs graphic <page.html> --seconds <s> [--fps 30] [--size 1920x1080] [--alpha] [--out <file>]
//                                                           an HTML animation recorded to video in the person's Chrome or Edge
//
// Every command prints one JSON object. render and splice include "cut_report": pass it to complete_task as is.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const { planCut, planSummary } = await import(pathToUrl(path.join(here, 'footage', 'footage-core.js')));
const { readSources, render, splice, check, reportLines, probe } = await import(pathToUrl(path.join(here, 'footage', 'footage-run.js')));
const { applyEffects, graphic } = await import(pathToUrl(path.join(here, 'footage', 'footage-fx.js')));
function pathToUrl(p) { return new URL(`file:///${p.replace(/\\/g, '/').replace(/^\/+/, '')}`).href; }

const [cmd, ...rest] = process.argv.slice(2);
const flag = (k) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? rest[i + 1] : null; };
const out = (o) => { process.stdout.write(`${JSON.stringify(o, null, 2)}\n`); };
const fail = (e) => { out({ ok: false, code: e.code || 'FAILED', error: e.message, ...(e.plan ? { problems: e.plan.problems, summary: planSummary(e.plan) } : {}) }); process.exit(1); };

/** The report the room shows under Claude's reply (complete_task cut_report). */
function cutReport({ plan, report, from = null, mode = null, window = null }) {
  const seams = {};
  for (const j of plan.joins) seams[j.seam.type] = (seams[j.seam.type] || 0) + 1;
  return {
    length_s: report?.duration ?? plan.out_dur, from_length_s: from?.length_s ?? null, from_number: from?.number ?? null,
    cuts: plan.joins.length, seams, sentences_cut: plan.problems.length + plan.warnings.filter((w) => w.code === 'MID_SENTENCE').length,
    black_s: Math.round((report?.black || []).reduce((s, b) => s + (b.to - b.from), 0) * 10) / 10, mode, encoded_s: window?.encoded_s ?? null,
  };
}
const readEdl = (f) => { if (!f) throw Object.assign(new Error('Give the edit list: a .json file.'), { code: 'NO_EDL' }); return { edl: JSON.parse(fs.readFileSync(f, 'utf8')), base: path.dirname(path.resolve(f)) }; };

try {
  if (cmd === 'plan') {
    const { edl, base } = readEdl(rest[0]);
    const src = await readSources(edl, { base });
    const p = planCut(edl, src.infos, src.wordsBy, { looks: src.looks });
    out({ ok: !p.problems.length, summary: planSummary(p), clips: p.clips, joins: p.joins.map((j) => ({ k: j.k, at: j.at, seam: j.seam })), problems: p.problems, warnings: p.warnings, cues: p.cues, out_dur: p.out_dur });
  } else if (cmd === 'render') {
    const { edl, base } = readEdl(rest[0]);
    const t0 = Date.now();
    const r = await render(edl, { base, force: rest.includes('--force'), log: (m) => process.stderr.write(`${m}\n`) });
    const single = Object.keys(edl.sources).length === 1 ? (await probe(path.resolve(base, Object.values(edl.sources)[0].path))).duration : null;
    const from = edl.from || (single ? { length_s: Math.round(single * 10) / 10 } : null);
    out({ ok: r.report.ok, file: r.file, seconds: Math.round((Date.now() - t0) / 100) / 10, lines: reportLines({ plan: r.plan, report: r.report }), report: r.report, cues: r.plan.cues, cut_report: cutReport({ plan: r.plan, report: r.report, from, mode: 'full' }) });
  } else if (cmd === 'splice') {
    const base = flag('base'), section = flag('section'), outFile = flag('out'), from = +flag('from'), to = +flag('to');
    if (!base || !section || !outFile || !Number.isFinite(from) || !Number.isFinite(to)) throw Object.assign(new Error('splice needs --base --from --to --section --out'), { code: 'BAD_ARGS' });
    const t0 = Date.now(), bInfo = await probe(base);
    const s = await splice({ base, from, to, section, out: outFile, quality: flag('quality') || 'high', log: (m) => process.stderr.write(`${m}\n`) });
    const p = { joins: [{ seam: { type: 'cut' } }, { seam: { type: 'cut' } }], problems: [], warnings: [], out_dur: s.report.duration };
    out({ ok: s.report.ok, file: s.file, mode: s.mode, reason: s.reason || null, window: s.window || null, seconds: Math.round((Date.now() - t0) / 100) / 10, lines: reportLines({ report: s.report, mode: s.mode, reason: s.reason, window: s.window }), report: s.report, cut_report: cutReport({ plan: p, report: s.report, from: { length_s: Math.round(bInfo.duration * 10) / 10 }, mode: s.mode, window: s.window }) });
  } else if (cmd === 'check') {
    if (!rest[0]) throw Object.assign(new Error('Give the file to check.'), { code: 'NO_FILE' });
    const r = await check(rest[0]);
    out({ ok: r.ok, report: r, lines: reportLines({ report: r }) });
  } else if (cmd === 'effect') {
    const { edl: spec, base } = readEdl(rest[0]);
    const t0 = Date.now();
    const r = await applyEffects(spec, { base, quality: spec.quality === 'draft' ? 'draft' : 'high', log: (m) => process.stderr.write(`${m}\n`) });
    const rep = await check(r.file);
    out({ ok: rep.ok, file: r.file, seconds: Math.round((Date.now() - t0) / 100) / 10, layers: r.layers, length_s: r.length_s, input_length_s: r.input_length_s, lines: reportLines({ report: rep }), report: rep });
  } else if (cmd === 'graphic') {
    if (!rest[0] || rest[0].startsWith('--')) throw Object.assign(new Error('Give the page: graphic <page.html> --seconds <s>.'), { code: 'BAD_ARGS' });
    const [w, h] = String(flag('size') || '1920x1080').split('x').map(Number);
    const t0 = Date.now();
    const r = await graphic({ html: rest[0], output: flag('out'), width: w, height: h, fps: +flag('fps') || 30, seconds: +flag('seconds') || 5, alpha: rest.includes('--alpha'), log: (m) => process.stderr.write(`${m}\n`) });
    out({ ok: true, ...r, seconds_taken: Math.round((Date.now() - t0) / 100) / 10 });
  } else {
    out({ ok: false, code: 'USAGE', error: 'Commands: plan <edit-list.json> | render <edit-list.json> [--force] | splice --base --from --to --section --out | check <file> | effect <effects.json> | graphic <page.html> --seconds <s> [--alpha]' });
    process.exit(2);
  }
} catch (e) { fail(e); }
