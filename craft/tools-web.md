# Tools: the scene page
Read this when writing `scene.html`: HTML, CSS, SVG, canvas, WebGL or GSAP, and what lifts it from web animation to an After Effects look.

- Time | Reveals | Colour and depth | Type | Sharpness | Noise and camera | Blur
- Canvas and WebGL | GSAP | Traps | Looks generated | Worked examples

Ranked by gain for the effort: motion blur and supersampling (`--final`), role easing, springs with no overshoot, overlap, mask reveals, layered shadows, a slow camera, grain from the encoder.

## Time
Each frame is a pure function of `t`. The harness may draw frames in any order, across several browsers.
- Banned in a scene: `Math.random`, `Date.now`, `performance.now`, `setTimeout`, `THREE.Clock`, `repeat: -1`, and any "since the last frame" state.
- Use `PP.hash(i)` for a fixed random per item and `PP.noise(x, seed)` for drift.
- Set every style in `frame(t)`. Measure once in `setup()`, after fonts load.
- Write the timing once as a cue sheet, so a change moves picture and sound together.

```js
const F = PP.f, A = { label: F(4), hero: F(8), pay: F(40) }, OUT = 6 - F(14);
const dots = [...Array(40)].map((_, i) => ({ x: PP.hash(i), y: PP.hash(i + 99), lag: PP.hash(i + 7) * F(10) }));
```
`PP.p` and `PP.spring` take seconds and do not apply the pace. Wrap times in `F()`.

## Reveals
A fade is the weakest reveal. Text rising from behind an edge reads as designed.

Line mask (wrapper clips, inner rises, as in `stat-reveal`):
```css
.mask { overflow: clip; }
```
```js
el.style.transform = `translateY(${(1 - PP.p(t, a, a + F(18), PP.enter)) * 110}%)`;
```
- A tight box cuts descenders: start at `padding-bottom: .12em` on the wrapper.
- Shape: `clip-path: inset(0 ${(1 - p) * 100}% 0 0 round 24px)`. Iris: `clip-path: circle(${r}px at 50% 50%)`.
- Soft edge, with `--p` set per frame:
```css
.soft { mask-image: linear-gradient(90deg, #000 calc(var(--p) * 110% - 10%), transparent calc(var(--p) * 110%)); }
```
The 110% carries the feather fully past the edge at `p = 1`.

Path draw. `pathLength="1"` makes the maths independent of the real length:
```html
<path id="r" pathLength="1" d="M96 900 C500 760 900 1000 1500 860" fill="none" stroke="var(--pp-accent)" stroke-width="6" stroke-linecap="round"/>
```
```js
r.style.strokeDasharray = '1'; r.style.strokeDashoffset = 1 - PP.p(t, a, b, PP.ease.move);
const L = r.getTotalLength(), pt = r.getPointAtLength(L * p), ahead = r.getPointAtLength(L * p + .5);
const deg = Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180 / Math.PI;   // a marker's heading
```
A round cap shows a dot at `p = 0`, so hide the path until `p > 0`.

## Colour and depth
Build in OKLCH so lightness steps look even. Tints: `color-mix(in oklch, var(--pp-accent) 30%, var(--pp-paper))`.
- `linear-gradient(in oklch, A, B)` keeps mid-tones clean. It also walks the hue wheel: orange to teal goes through green. Keep hues within 20-30° of each other, or use `in oklab` for far-apart colours.
- Cards: 2-3 shadows with doubling blur, plus a 1 px top highlight. One light, one side.
```css
.card { box-shadow: 0 1px 2px rgba(0,0,0,.2), 0 8px 16px rgba(0,0,0,.2), 0 32px 64px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.15); }
```
- Tint the shadow to the ground with `oklch(18% .04 <hue> / .4)` rather than pure black.
- Slop check: at 20 px blur or more, any shadow written as hex (even `#0004`) or as `rgba(0 0 0 / .25)` counts as a coloured glow and stops the render. Use comma `rgba(0,0,0,.25)` or `oklch()`.
- `PP.ground()` gives paper, one light and vignette. On impact and scoreboard the look's grain is 0, so a dark gradient bands. Set `"grain": .02` in `style.json`, or keep the ground flat.

## Type
- Optical size gives the tight, high-contrast display cut. Bundled axes: Newsreader `opsz` 6-72, Bricolage Grotesque `opsz` 12-96 and `wdth` 75-100, Fraunces `opsz` up to 144, Archivo `wdth` 62-125. Set them through `font-variation-settings: "opsz" 72` or the look's `--pp-dv`.
- Set `opsz` to the top of the range on anything over 100 px. Small text keeps the low end, or hairlines vanish after compression.
- Static faces: Anton, Instrument Serif, Young Serif, Special Elite, IBM Plex Mono (one weight each here). Add `font-synthesis: none`, because a bold on these is fake.
- `PP.split(el, true)` wraps letters in inline-blocks, which breaks kerning and ligatures. Split by word. Use letters only for display type, and look at the still.
- A line from a label: give the line `data-pp-from="<the label's id>"`, and `check` confirms it starts on the label. Sweeps go over the words and uncover them, never behind them.
- Words on a colour: `PP.on(hex)` gives `{ colour, ratio }`, the look's ink or paper, whichever stands out.
- Counters: `PP.digits(el)`. `PP.fit(el, maxW, maxPx, minPx)` once in `setup()`, per string, never per frame. `text-wrap: balance` on two-line titles.
- Outline over footage: `-webkit-text-stroke: 3px #000; paint-order: stroke fill;` keeps thin letters whole.

## Sharpness and text jitter
At normal scale Chrome snaps glyphs to a coarse sub-pixel grid. A 120 px word moved .25 px a frame stepped .16-.43 px (spread .111 px): the shimmer on a slow push. At 2× the spread was .004 px. `text-rendering` and hinting flags change nothing.
- `--final` renders at 2× with Lanczos down. A draft shows shimmer the final won't have, so judge slow text from `render --ss 2`.

## Noise and camera
Every shot should move a little. Scale the whole scene 1 to 1.04 over its length, and let landed type sit still inside it.
```js
const push = Math.exp(PP.lerp(Math.log(1), Math.log(1.04), PP.p(t, 0, D, PP.ease.linear)));   // a 1 to 4 zoom looks even this way
const dx = PP.noise(t * .7, 1) * 2 * u, dy = PP.noise(t * .7, 2) * 2 * u, rot = PP.noise(t * .7, 3) * .1;
cam.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${push})`;
```
Handheld is about 2 px and .1° at .5-1 Hz. CSS 3D: `perspective: 1200px` on the parent, tiny rotations, a drift of 3-5°/s. A `filter` on a parent flattens its 3D children.

Mesh ground with no images: 4-5 `radial-gradient`s whose positions follow `PP.noise`, on a layer 20% oversize so the blur edge stays off-frame, `filter: blur(60px)`. It is costly, so keep it to one layer.

## Blur
- `--final` is a 180° shutter with 8 centred sub-frames. A smear is px per frame × .5. Samples: smear ÷ 2 for hard edges, ÷ 4 for text and soft shapes. A 120 px smear at 8 samples shows 8 steps, so use `--samples 32`. Cost scales with samples, though held frames are skipped.
- Analytic blur for a whip or slide, with no extra renders: blur a box of length L with sigma .29 L, along the move only. Peak 6-12 px on text, 15-20 px full frame. Moves over 9-18 f. Translation only; spins need sub-frames.
```html
<filter id="mb"><feGaussianBlur id="mbg" stdDeviation="0 0"/></filter>
```
```js
mbg.setAttribute('stdDeviation', `${.29 * smearPx} 0`);
```
- Type resolving from blur: `filter: blur(${(1 - p) * 6}px)` with opacity over 4-6 f, no translate.

## Canvas and WebGL
- Canvas: set `width` to CSS size × `devicePixelRatio`, and draw from `t`. Clear every frame. Its 8-bit gradients band, so add dither.
- three.js: `vendor/three.module.min.js` comes with `new`. `new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })`, and call `renderer.render()` inside `frame(t)`, as `particles-3d` does.
- WebGL runs on the CPU in headless Chrome. Bloom at 4K can take seconds a frame, so render with `--final --ss 1`.
- Load fonts, textures and models in `setup()`, never lazily. For headings, draw DOM-quality text to a 2× canvas and use `CanvasTexture`.
- Biggest step from flat to rendered: `RoomEnvironment` through `PMREMGenerator` with `MeshPhysicalMaterial` (clearcoat 1, roughness .2-.35). Addons aren't vendored: copy `RoomEnvironment.js` from `three@0.170.0` into the folder, and add `<script type="importmap">{"imports":{"three":"./vendor/three.module.min.js"}}</script>` before any module.
- Bloom, start at strength .35-.6, radius .5-.8, threshold .85-1, with `OutputPass` last or the picture washes out.
- Fragment dither, driven by `t` only:
```glsl
float ign(vec2 p){ return fract(52.9829189*fract(dot(p, vec2(.06711056,.00583715)))); }
c += (ign(gl_FragCoord.xy + fract(t)*91.) - .5) / 255. * 1.5;
```

## GSAP
The kit covers most scenes. Use GSAP for SplitText, MorphSVG or a long choreography. Copy `gsap.min.js` from npm into the scene folder so it renders offline. All plugins are free for commercial use; the licence bars building a competing no-code animation tool, so never bundle it in a product.
```js
const tl = gsap.timeline({ paused: true });
tl.to('#card', { x: 400 * u, duration: PP.f(18), ease: 'expo.out' });
PP.scene({ duration: 4, frame(t) { tl.seek(t, false); } });
```
- GSAP's file names `bounce` and `elastic`, so a local `<script src="gsap.min.js">` stops the render with `SLOP`. Pass `--allow-slop "GSAP's own file names those eases; this scene does not use them"`. That turns the check off for everything, so self-police: no `back.out`, no `elastic`, no bounce.
- No `from: 'random'` stagger, no `delayedCall`, no `onUpdate` clocks.

## Traps
- `will-change: transform` on text smooths motion by moving a rasterised bitmap, which softens it. Use supersampling.
- Grain in the page costs far more than it gives: full-frame `feTurbulence` added 235 ms a frame at 1080p (98 to 334 ms), a tiled canvas 175-190 ms. The encoder adds the look's grain on `--final`. Overlays get none, which is right: it would sit on the footage.
- A 40 px CSS blur on a 600 px box adds about 35 ms a frame. Fine once, not on a dozen layers.
- `backdrop-filter: blur` stops the render as a glass panel. `background-clip: text` stops it as gradient text.
- `cubic-bezier` with y outside 0-1 stops the render. For give, use `PP.spring`, and never on data.
- Geist, Inter, Montserrat and Roboto are refused as a `font-family`. Geist Mono is fine.
- A `<video>` in a scene is placed by `data-pp-from` and `data-pp-rate`. Never seek it yourself without `data-pp-manual`.
- A CDN script makes a render depend on the network. Keep everything in the folder.

## Looks generated → instead
- Opacity fade on every entrance → mask rise, clip or path draw, each by role.
- `translateY(20px)` plus .3 s ease → `PP.enter` over `F(18)`, with a travel sized to the element.
- One flat shadow → three stacked, plus the top highlight.
- Flat fill ground → `PP.ground`, tinted from the video.
- Sprites placed with `Math.random` → `PP.hash`, spaced by `PP.noise`.
- Everything still at the hold → a 1.04 push on the wrapper.
- Sine-wave float on a card → nothing moves without a reason; only the camera drifts.

Pick reveals per scene. If two scenes in a row use the same one, change the second.

<example>
Title on documentary look: two lines in Instrument Serif, 132 px. Each line sits in a clip wrapper and rises 110% over `F(24)` on `glide`, second line 5 f later. The wrapper pushes 1 to 1.04 for the whole 6 s, plus 2 px noise. `--final` removes the shimmer. Frame: the type stays razor sharp while the whole picture drifts.
</example>

<example>
Route on a map: SVG path with `pathLength="1"`, 6 px accent stroke, dash offset on `PP.ease.move` over 60 f. A marker reads `getPointAtLength` and turns to the heading. Sound: `whoosh` with `pan` from -.5 to .5 across the draw. The line and the marker never part, because they share one `p`.
</example>

<example>
Slide whip between two cards: 9 f, peak 90 px per frame. Horizontal `stdDeviation` .29 × 45 = 13 px at peak, zero at both ends. No extra samples. Same direction on both cards. `whoosh` with `hit` on the middle frame.
</example>

<example>
Glass product in three.js, studio look: `RoomEnvironment`, clearcoat 1, roughness .25, drift of 4°/s, bloom .4 on a hot edge only. Rendered with `--final --ss 1`, heading in DOM above the canvas. A 1 px highlight rides round the rim as it turns. Particles placed with `PP.hash`, so frame 412 is the same on every run.
</example>
