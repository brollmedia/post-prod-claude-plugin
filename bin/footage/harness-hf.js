// COPY of post-prod's server/harness-hf.js, made by tools/build-plugin-footage.js. Change the original, then run that.
// HyperFrames on the person's own computer (5 Nov 2026, Seth: "hyperframes could be another tab above the notes tab. users can connect
// their own account"). Their Claude drives their CLI; nothing here runs on our servers. This file is the one way the plugin touches it:
// hfStatus says what the room may show (tools.hyperframes, the fields server/claude-watch.js cleanTools keeps), hfRun runs a command and
// says plainly why it failed. Their account is theirs: hfRun refuses sign-in and anything that spends or uploads, the person runs those
// themselves, and no output that could hold an address or a key leaves this file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const HF_NODE_MIN = 22;
// the person's telemetry stays off unless they choose it, and installing skills into their tools is not ours to do as a side effect
const QUIET = { HYPERFRAMES_NO_TELEMETRY: '1', DO_NOT_TRACK: '1', HYPERFRAMES_SKIP_SKILLS: '1' };
const LOGIN = 'npx hyperframes auth login';

const major = (v) => parseInt(String(v), 10) || 0;
export const nodeTooOld = (v = process.versions.node) => major(v) < HF_NODE_MIN;
export const versionIn = (s) => /\b(\d{1,3}\.\d{1,3}\.\d{1,4})\b/.exec(String(s || ''))?.[1] || null;
/** Signed in, signed out, or not known (pure). Their exit code alone is not enough: anything else that fails is not "signed out". */
export function signedInFrom(code, out) {
  if (/not signed in/i.test(out)) return false;
  return code === 0 && /signed in/i.test(out) ? true : null;
}
/** The plan, only if the CLI says one in so many words (pure). Never guessed: a wrong plan name in the room is worse than none. */
export const planFrom = (out) => /\bplan:\s*([a-z][a-z0-9 _-]{0,23})\s*$/im.exec(String(out || ''))?.[1]?.trim().toLowerCase() || null;

/** Why a command failed, in words a person can act on (pure). → { code, say } */
export function classifyHf(exit, out) {
  if (!exit) return { code: null, say: null };
  const s = String(out || '');
  if (/requires Node\.js/i.test(s)) return { code: 'HF_NODE_OLD', say: `HyperFrames needs Node ${HF_NODE_MIN} or newer on this computer.` };
  if (/could not determine executable|npm (?:error|ERR!)[^\n]*404|is not recognized|command not found|ENOENT/i.test(s)) return { code: 'HF_NO_CLI', say: 'The HyperFrames CLI is not available here. It needs npm and a network connection the first time.' };
  if (/no heygen credentials|not signed in|auth login/i.test(s)) return { code: 'HF_NEEDS_ACCOUNT', say: `That needs a HyperFrames account. To connect yours, run ${LOGIN} in your own terminal: it opens your browser.` };
  if (/\b(pro plan|hyperframes pro|upgrade to|requires? pro|not enough credits|insufficient credits|out of credits)\b/i.test(s)) return { code: 'HF_NEEDS_PRO', say: 'That needs a paid HyperFrames plan or credits on your own account.' };
  return { code: 'HF_FAILED', say: 'HyperFrames could not do that.' };
}

// sign-in, spending and uploading to someone else's service belong to the person: the plugin never does them for anyone
const THEIRS = [[/^auth$/, /^(login|logout)$/], [/^billing$/], [/^cloud$/], [/^lambda$/], [/^cloudrun$/], [/^publish$/], [/^reverse$/], [/^templates$/], [/^feedback$/]];
/** A command only the person may run (pure). */
export function personsOwn(args) {
  const [a, b] = args;
  return THEIRS.some(([x, y]) => x.test(a || '') && (!y || y.test(b || '')));
}
/** What may be shown of a command's output (pure): the end of it, without any line that could hold an address, a key or a token. */
export const safeOutput = (out, max = 3000) => String(out || '').split(/\r?\n/).filter((l) => !/@[\w-]+\.[\w.-]+|bearer|token|api[-_ ]?key|secret|password|credential|authorization/i.test(l) || /no heygen credentials/i.test(l)).join('\n').slice(-max);

/** Run npx. → { code, out }. Never rejects: not being able to run it is an answer too. */
function npx(args, { cwd, timeout = 600000, env = {} } = {}) {
  return new Promise((res) => {
    let out = '', done = false;
    const finish = (code, extra = '') => { if (!done) { done = true; clearTimeout(t); res({ code, out: out + extra }); } };
    // never through a shell: a file name in a command must stay one argument. On Windows npx is a .cmd only a shell can start, so go to npm's own script
    const cli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');
    const win = process.platform === 'win32';
    if (win && !fs.existsSync(cli)) { res({ code: 127, out: 'ENOENT npx' }); return; }
    const p = spawn(win ? process.execPath : 'npx', win ? [cli, ...args] : args, { cwd, windowsHide: true, env: { ...process.env, ...QUIET, ...(process.env.PP_HF_HOME ? { USERPROFILE: process.env.PP_HF_HOME, HOME: process.env.PP_HF_HOME } : {}), ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    const t = setTimeout(() => { p.kill(); finish(124, '\ntimed out'); }, timeout);
    p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; });
    p.on('error', (e) => finish(127, `\nENOENT ${e.message}`));
    p.on('close', (code) => finish(code ?? 1));
  });
}

/**
 * What the loop tells the room (tools.hyperframes): { installed, version, signed_in, plan, reason }. reason: node_old or no_cli when it
 * cannot run here. Signed out is not a failure: local renders need no account. install: fetch the CLI when it is missing (the room's
 * Connect asks for this; it never signs in). exec and node are for the tests.
 */
export async function hfStatus({ install = false, exec = npx, node = process.versions.node } = {}) {
  const none = (reason) => ({ installed: false, version: null, signed_in: null, plan: null, reason });
  if (nodeTooOld(node)) return none('node_old');
  const v = await exec([install ? '--yes' : '--no-install', 'hyperframes', '--version'], { timeout: install ? 180000 : 45000 });
  const version = v.code === 0 ? versionIn(v.out) : null;
  if (!version) return none(/requires Node\.js/i.test(v.out) ? 'node_old' : 'no_cli');
  const a = await exec(['--no-install', 'hyperframes', 'auth', 'status'], { timeout: 45000 });
  return { installed: true, version, signed_in: signedInFrom(a.code, a.out), plan: planFrom(a.out), reason: null };
}

/** Run a HyperFrames command. → { ok, code, say, output }, where say is a sentence for the person when it failed. */
export async function hfRun(args, { cwd, exec = npx, node = process.versions.node, timeout } = {}) {
  if (!args.length) return { ok: false, code: 'BAD_ARGS', say: 'Say which HyperFrames command to run.', output: '' };
  if (personsOwn(args)) return { ok: false, code: 'HF_PERSONS_OWN', say: `That is for you to run yourself, on your own account: npx hyperframes ${args.slice(0, 2).join(' ')}. Claude never signs in or spends for you.`, output: '' };
  if (nodeTooOld(node)) return { ok: false, ...classifyHf(1, 'requires Node.js'), output: '' };
  // a missing folder looks like a missing program to spawn: say which it is
  if (cwd && !fs.existsSync(cwd)) return { ok: false, code: 'BAD_ARGS', say: `There is no folder at ${cwd}: make it first.`, output: '' };
  const r = await exec(['--yes', 'hyperframes', ...args], { cwd, timeout });
  const c = classifyHf(r.code, r.out);
  return { ok: !r.code, code: c.code, say: c.say, output: safeOutput(r.out) };
}

/**
 * A copy of a HyperFrames project our check can step through (their runtime stitches a project together at render, so a page on its own is
 * not the film): sub-compositions inlined, every timeline seeked on the film's clock, clips shown only inside their time, the fonts they
 * name loaded, their variables filled in. Their project is not touched. → { dir, duration, cleanup }
 */
export function hfCheckCopy(src, { alpha = false } = {}) {
  const to = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-hf-check-'));
  fs.cpSync(src, to, { recursive: true, filter: (f) => !/[\\/](\.hyperframes|\.thumbnails|node_modules|renders|out)([\\/]|$)/.test(f.slice(src.length)) });
  let html = fs.readFileSync(path.join(to, 'index.html'), 'utf8');
  html = html.replace(/(<[a-z]+\b[^>]*?data-composition-src="([^"]+)"[^>]*>)/g, (tag, open, file) => {
    const f = path.join(to, file); if (!fs.existsSync(f)) return tag;
    const sub = fs.readFileSync(f, 'utf8');
    return open + (/<template[^>]*>([\s\S]*)<\/template>/i.exec(sub)?.[1] ?? sub);
  });
  const duration = +(/data-duration="([\d.]+)"/.exec(html)?.[1] || 6);
  const faces = [...new Set([...html.matchAll(/font-family:\s*["']?([A-Z][A-Za-z ]+?)["']?\s*[,;]/g), ...html.matchAll(/["']([A-Z][A-Za-z]+(?: [A-Z][a-z]+)*)["']\s*,\s*(?:Georgia|serif|sans-serif|monospace|ui-|system-ui|Times|Inter|Arial|Helvetica)/g)].map((m) => m[1]).filter((n) => !/^(Georgia|Arial|Helvetica|Times|Inter Tight)$/.test(n)))];
  const fonts = faces.length ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${faces.map((f) => `family=${f.replace(/ /g, '+')}:ital,wght@0,400;0,700;1,400;1,700`).join('&')}&display=block">` : '';
  const early = `<script>window.__timelines = window.__timelines || {}; window.__hyperframes = window.__hyperframes || { getVariables: () => { for (const el of document.querySelectorAll('[data-variable-values]')) { try { return JSON.parse(el.dataset.variableValues); } catch {} } return {}; } };</script>`;
  const shim = `<script>(() => {
    const hostOf = (id) => document.querySelector('[data-composition-id="' + id + '"]');
    const startOf = (el) => { let t = 0; for (let e = el; e; e = e.parentElement && e.parentElement.closest('[data-start]')) t += parseFloat(e.dataset.start) || 0; return t; };
    window.seek = async (t) => {
      for (const [id, tl] of Object.entries(window.__timelines || {})) { const h = hostOf(id); tl.pause(); tl.seek(Math.max(0, t - (h && id !== 'main' ? startOf(h) : 0)), false); }
      for (const el of document.querySelectorAll('[data-start][data-duration]')) { const a = startOf(el), d = parseFloat(el.dataset.duration); if (el.id === 'root' || !Number.isFinite(d)) continue; el.style.visibility = t >= a && t < a + d ? 'visible' : 'hidden'; }
    };
    window.ready = async () => { for (const f of ${JSON.stringify(faces)}) { try { await document.fonts.load('400 40px "' + f + '"'); } catch {} } await document.fonts.ready; await window.seek(0); return { duration: ${duration} }; };
  })();</script>`;
  fs.writeFileSync(path.join(to, 'scene.html'), html.replace(/<head>/i, `<head>${early}`).replace('</head>', `${fonts}</head>`).replace('</body>', `${shim}</body>`));
  for (const f of ['index.html', 'hyperframes.json', 'package.json']) fs.rmSync(path.join(to, f), { force: true });
  fs.writeFileSync(path.join(to, 'scene.json'), JSON.stringify({ width: +(/data-width="(\d+)"/.exec(html)?.[1] || 1920), height: +(/data-height="(\d+)"/.exec(html)?.[1] || 1080), fps: 30, duration, alpha }));
  return { dir: to, duration, cleanup: () => fs.rmSync(to, { recursive: true, force: true }) };
}
