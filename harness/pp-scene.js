// The scene kit (post-prod harness, 4 Nov 2026). A scene draws itself from the time alone: PP.scene({ duration, frame(t) })
// gives the page window.ready() and window.seek(t), so the harness can draw any frame, in any order, exactly. Everything a
// scene needs to look like the creator's is here: PP.style (their colours and fonts, also CSS variables --pp-ink, --pp-paper,
// --pp-accent, --pp-accent2, --pp-muted, --pp-display, --pp-body, --pp-mono), PP.props (the words and numbers for this one),
// and easing that settles without bouncing (overshoot reads as AI-made; the slop check refuses it).
(function () {
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = {
    linear: (t) => t,
    out: (t) => 1 - Math.pow(1 - t, 3),            // the default: quick start, gentle settle
    outQuart: (t) => 1 - Math.pow(1 - t, 4),
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    in: (t) => t * t * t,
  };
  const style = window.PP_STYLE || { colours: {}, fonts: {}, pace: 1 };
  const props = window.PP_PROPS || {};
  const pace = +style.pace || 1;
  const PP = {
    style, props, pace, clamp, lerp, ease,
    size: window.PP_SIZE || { width: innerWidth, height: innerHeight },
    /** 0..1: how far t is through [a, b] (seconds), eased. Scaled by the creator's pace from `from`. */
    p(t, a, b, e = ease.out) { return e(clamp((t - a) / Math.max(1e-6, b - a))); },
    /** in, hold, out in one: 0 → 1 over [a, a + inS], 1 until b, back to 0 over [b, b + outS]. */
    io(t, a, b, inS = 0.4, outS = 0.35, e = ease.out) { return t < b ? e(clamp((t - a) / inS)) : 1 - ease.in(clamp((t - b) / outS)); },
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
    /** Register the scene: frame(t) draws the moment t (seconds); setup() runs once after fonts load (may be async). */
    scene({ duration, setup, frame }) {
      let ready = null;
      window.ready = async () => {
        if (!ready) ready = (async () => { if (document.fonts) await document.fonts.ready; if (setup) await setup(); frame(0); })();
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
