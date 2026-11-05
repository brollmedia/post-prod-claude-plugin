// The scene kit (post-prod harness, 4 Nov 2026). A scene draws itself from the time alone: PP.scene({ duration, frame(t) })
// gives the page window.ready() and window.seek(t), so the harness can draw any frame, in any order, exactly. Everything a
// scene needs to look like the creator's is here: PP.style (their colours and fonts, also CSS variables --pp-ink, --pp-paper,
// --pp-accent, --pp-accent2, --pp-muted, --pp-display, --pp-body, --pp-mono), PP.props (the words and numbers for this one),
// and easing that settles. The named curves and PP.spring are the ones in craft/motion.md: use them by name, never a default ease.
(function () {
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  /** A CSS cubic-bezier as a function of progress. */
  const bezier = (x1, y1, x2, y2) => {
    const fx = (u) => 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u;
    const fy = (u) => 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
    return (t) => {
      if (t <= 0) return 0; if (t >= 1) return 1;
      let lo = 0, hi = 1, u = t;
      for (let i = 0; i < 24; i++) { const x = fx(u); if (Math.abs(x - t) < 1e-5) break; if (x < t) lo = u; else hi = u; u = (lo + hi) / 2; }
      return fy(u);
    };
  };
  const ease = {
    linear: (t) => t,
    out: (t) => 1 - Math.pow(1 - t, 3),            // quick start, gentle settle
    outQuart: (t) => 1 - Math.pow(1 - t, 4),
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    in: (t) => t * t * t,
    // the working set (craft/motion.md). enter: most entrances; 90% of the way there by a third of the time, then a long settle
    enter: bezier(0.16, 1, 0.3, 1),
    snap: bezier(0.23, 1, 0.32, 1),                // quicker to rest: small things, UI
    glide: bezier(0.25, 0.1, 0.1, 1),              // calm: titles, documentary
    move: bezier(0.77, 0, 0.175, 1),               // something already on screen going somewhere else
    camera: bezier(0.45, 0, 0.15, 1),              // a camera has weight: slow off, long settle
    exit: bezier(0.3, 0, 0.8, 0.15),               // leaving: accelerates away, shorter than it came in
  };
  // a time-independent seeded random and smooth noise: a scene must look the same however its frames are drawn
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const noise2 = (x, y, seed = 0) => { const i = Math.floor(x), j = Math.floor(y), f = x - i, g = y - j, u = f * f * (3 - 2 * f), v = g * g * (3 - 2 * g), h = (a, b) => hash(a * 12.9898 + b * 78.233 + seed * 37.7); return lerp(lerp(h(i, j), h(i + 1, j), u), lerp(h(i, j + 1), h(i + 1, j + 1), u), v) * 2 - 1; };
  const noise = (x, seed = 0) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i + seed * 57), hash(i + 1 + seed * 57), u) * 2 - 1; };
  const style = window.PP_STYLE || { colours: {}, fonts: {}, pace: 1 };
  const props = window.PP_PROPS || {};
  const pace = +style.pace || 1;
  const PP = {
    style, props, pace, clamp, lerp, ease, bezier, hash, noise, noise2, motion: style.motion || {},
    size: window.PP_SIZE || { width: innerWidth, height: innerHeight },
    /** 0..1: how far t is through [a, b] (seconds), eased. */
    p(t, a, b, e = ease.out) { return e(clamp((t - a) / Math.max(1e-6, b - a))); },
    /** in, hold, out in one: 0 → 1 over [a, a + inS], 1 until b, back to 0 over [b, b + outS]. */
    io(t, a, b, inS = 0.4, outS = 0.35, e = ease.out) { return t < b ? e(clamp((t - a) / inS)) : 1 - ease.in(clamp((t - b) / outS)); },
    /**
     * A spring from 0 to 1 starting at a, with a closed form so any frame stands alone. dur: seconds to settle (Apple's perceptual
     * duration). give: 0 no overshoot, 0.15-0.3 reads as premium (about 1-5% over), 0.4 is the most a hero should get. Never on data.
     */
    spring(t, a, dur = 0.5, give = 0.2) {
      const x = t - a; if (x <= 0) return 0;
      const w = (2 * Math.PI) / Math.max(0.05, dur), z = 1 - clamp(give, 0, 0.6);
      if (z >= 0.999) return 1 - Math.exp(-w * x) * (1 + w * x);
      const wd = w * Math.sqrt(1 - z * z);
      return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + ((z * w) / wd) * Math.sin(wd * x));
    },
    /** The delay of item i of n: step seconds apart, closing up as it goes, never longer in all than cap (a long list stays quick). */
    stagger(i, n, step = 0.08, cap = 0.8) { const s = Math.min(step, cap / Math.max(1, n - 1)); return s * i * (1 - (0.2 * i) / Math.max(1, n)); },
    /** Seconds from frames at 30 fps, scaled by the look's pace: times stay readable as frames, the way an animator thinks. */
    f(n) { return (n / 30) * pace; },
    /** Which of the look's ink and paper to set on a colour, and how well it stands out: { colour, ratio }. */
    on(bg) {
      const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      const lum = (h) => { const m = /#?(..)(..)(..)/.exec(h) || []; return 0.2126 * lin(parseInt(m[1], 16)) + 0.7152 * lin(parseInt(m[2], 16)) + 0.0722 * lin(parseInt(m[3], 16)); };
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const c = style.colours || {}, picks = [c.ink, c.paper].filter(Boolean).map((colour) => ({ colour, ratio: ratio(colour, bg) }));
      return picks.sort((a, b) => b.ratio - a.ratio)[0] || { colour: '#000000', ratio: 1 };
    },
    /** The look's entrance curve and how much give its springs have. */
    get enter() { return ease[style.motion?.enter] || ease.enter; },
    get give() { return +(style.motion?.give) || 0; },
    /**
     * A number that never shifts as it counts: every digit sits in a cell as wide as the widest digit, in any font. → set(text, rest).
     * rest, 0 to 1, closes the cells to the digits' own widths once it has landed: a narrow 1 left in a wide cell reads as a hole at a hold.
     * A comma or a letter keeps its own width. Call it after fonts load (in setup).
     */
    digits(el) {
      const probe = document.createElement('span'); probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre'; el.appendChild(probe);
      let w = 0; const own = {}; for (const d of '0123456789') { probe.textContent = d; own[d] = probe.getBoundingClientRect().width; w = Math.max(w, own[d]); }
      probe.remove(); el.textContent = ''; el.dataset.ppCount = '1';
      let last = null;
      return (text, rest = 0) => {
        const key = `${text}|${rest}`; if (key === last) return; last = key; el.textContent = '';
        const chars = [...String(text)];
        for (const [i, ch] of chars.entries()) { const s = document.createElement('span'); s.textContent = ch; s.style.display = 'inline-block'; s.style.whiteSpace = 'pre'; if (/\d/.test(ch)) { s.style.width = `${w + (own[ch] - w) * rest}px`; s.style.textAlign = !i || /[,.]/.test(chars[i - 1]) ? 'left' : /[,.]/.test(chars[i + 1] || '') ? 'right' : 'center'; } el.appendChild(s); }
      };
    },
    /** Font size that fits text in maxW px, no bigger than maxPx and no smaller than minPx (the phone floor is 48 px on 1080p). */
    fit(el, maxW, maxPx, minPx = 48) {
      el.style.fontSize = '100px'; const w = el.getBoundingClientRect().width || 1;
      const px = Math.max(minPx, Math.min(maxPx, (100 * maxW) / w)); el.style.fontSize = `${px}px`; return px;
    },
    /**
     * A ground with depth for a full-frame scene: the paper colour, one soft light and the look's vignette, behind everything. The look's
     * grain is added by the encoder on the final render: it stops a dark gradient banding after compression, and it is far quicker there.
     */
    ground({ light = [0.3, 0.2], lift = 0.07, vignette = style.vignette ?? 0.15 } = {}) {
      const box = document.createElement('div'); box.style.cssText = 'position:absolute;inset:0;overflow:hidden;background:var(--pp-paper);z-index:-1';
      const glow = document.createElement('div');
      glow.style.cssText = `position:absolute;inset:0;background:radial-gradient(90% 90% at ${light[0] * 100}% ${light[1] * 100}%, color-mix(in oklab, var(--pp-accent) ${lift * 100}%, color-mix(in oklab, var(--pp-ink) ${lift * 100}%, transparent)) 0%, transparent 70%)`;
      const vig = document.createElement('div');
      vig.style.cssText = `position:absolute;inset:0;background:radial-gradient(75% 75% at 50% 50%, transparent 45%, rgba(0,0,0,${vignette}) 100%)`;
      box.append(glow, vig); document.body.prepend(box);
      return () => {};
    },
    /** A number shown as it counts: decimals, thousands separator, prefix/suffix. */
    num(n, d = 0, pre = '', suf = '') { return pre + Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) + suf; },
    /** Split an element's text into word (and letter) spans, for per-word or per-letter timing. → [{ el, word, letters: [el] }] */
    split(el, letters = false) {
      const words = el.textContent.split(/(\s+)/); el.textContent = '';
      const out = [];
      for (const w of words) {
        if (/^\s+$/.test(w)) { el.appendChild(document.createTextNode(w)); continue; }
        const s = document.createElement('span'); s.className = 'pp-w'; s.style.display = 'inline-block';
        const ls = [];
        if (letters) for (const ch of w) { const l = document.createElement('span'); l.className = 'pp-l'; l.style.display = 'inline-block'; l.textContent = ch; s.appendChild(l); ls.push(l); }
        else s.textContent = w;
        el.appendChild(s); out.push({ el: s, word: w, letters: ls });
      }
      return out;
    },
    /**
     * Register the scene: frame(t) draws the moment t (seconds); setup() runs once after fonts load (may be async). sound: a list (or a
     * function giving one) of { sfx: 'whoosh', hit: seconds, gain_db, dur, seed, ... }: it is timed from the same numbers as the picture,
     * so a change to the timing moves the sound with it. The harness makes the sounds and mixes them in.
     */
    scene({ duration, setup, frame, sound }) {
      let ready = null;
      window.ready = async () => {
        if (!ready) ready = (async () => { if (document.fonts) await document.fonts.ready; if (setup) await setup(); frame(0); window.PP_SOUND = typeof sound === 'function' ? sound() : sound || []; })();
        await ready;
        return { duration: typeof duration === 'function' ? duration() : duration };
      };
      window.seek = async (t) => { await window.ready(); frame(t); };
      // opened in a normal browser (to look at it while making it): play it on a loop
      if (!window.__ppAdvance) window.addEventListener('load', async () => {
        const { duration: d } = await window.ready(); const t0 = performance.now();
        const loop = () => { frame(((performance.now() - t0) / 1000) % d); requestAnimationFrame(loop); };
        requestAnimationFrame(loop);
      });
    },
  };
  window.PP = PP;
})();
