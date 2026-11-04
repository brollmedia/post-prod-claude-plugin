# The post-prod animation harness

One way to make any animation, graphic or edit in the creator's own style, render it exactly, put it on their footage, and get notes on it in post-prod.io. The engine is `server/harness.js`; the plugin runs a copy (`bin/footage/harness.js`) through `bin/animate.mjs`.

## Commands
```
node bin/animate.mjs list                                  the starter library
node bin/animate.mjs new <library-scene> <folder>          copy one to edit (it brings the kit, its fonts and a reference/ folder)
node bin/animate.mjs still <scene> --t 2.5 --out f.png     one frame: look at it before rendering it all
node bin/animate.mjs render <scene> [--aspect 9:16 | --size 1080x1920] [--fps 60] [--format mp4|prores|webm|png]
     [--duration 6] [--workers 4] [--style look.json] [--ref reference/] [--props props.json] [--out f.mp4]
node bin/animate.mjs compose spec.json                      clips, transitions, overlays, picture in picture, sound
```
Every command prints JSON: `{ ok: true, … }` or `{ ok: false, code, message }`.

Error codes:
- `NO_BROWSER`, `NO_SCENE`, `BAD_MANIFEST`, `NO_DURATION`
- `SCENE_ERROR`, `FONT_FAILED`, `FONT_MISSING`
- `SLOP`, `BAD_FORMAT`, `FFMPEG_FAILED`, `NO_AUDIO`
- `NO_CLI`, `CLI_FAILED`, `NO_CLIPS`, `BAD_CLIP`

## The scene contract
A scene is a folder:
- **`scene.html`** is any HTML, CSS or JS: SVG, canvas, WebGL/three.js, Lottie or GSAP.
- **`scene.json`** (optional) holds `{ what, width, height, fps, duration, alpha, props, audio: [{ src, at, from, to, gain_db, fade_in, fade_out }] }`.

The page defines two functions:
- `window.ready()` (may be async) loads what the scene needs and returns `{ duration }`.
- `window.seek(t)` (may be async) draws the frame at `t` seconds.

**Draw from `t` alone.** Never use "since the last frame" state. Then any frame renders on its own, in any order, in parallel. `pp-scene.js` does this for you:
```js
PP.scene({ duration: 6, setup() { /* once, fonts loaded */ }, frame(t) { /* set every style from t */ } });
```
A page without `seek()` still renders exactly: the harness replaces its clock (requestAnimationFrame, timers, Date, CSS and Web Animations, `<video>`) and moves it a frame at a time. But it renders in one browser, start to end, so it is slower.

**Remotion** projects (`remotion` in package.json) and **HyperFrames** projects render through their own CLIs (`npx remotion render`, `npx hyperframes render`). A HyperFrames page renders here too if its CLI is missing.

## What a scene gets
These are injected before the scene's own code runs:
- `PP.style` / `window.PP_STYLE`: the creator's style profile as tokens: `colours { ink, paper, accent, accent2, muted }`, `fonts { display, body, mono }`, `pace` (1 is normal, 0.8 snappier, 1.25 calmer), plus `text`, `graphics` and `rules` lines.
- The same tokens as CSS variables: `--pp-ink`, `--pp-paper`, `--pp-accent`, `--pp-accent2`, `--pp-muted`, `--pp-display`, `--pp-body`, `--pp-mono`, `--pp-pace`. `@font-face` rules come with them for every font file in the reference folder (`reference/` or `reference/fonts/`).
- `PP.props` / `window.PP_PROPS`: this one's content (the words, numbers, places). Never hard-code content the creator would change.
- `PP.size`: the output size. Lay out in `vw` / `vh` (or from `PP.size`) so 16:9, 9:16, 1:1 and 4:5 all work. `window.PP_DURATION` is the length being rendered (a transition fits its join).
- Footage: a `<video>` is put on its exact frame for every frame drawn: `currentTime = data-pp-from + t × data-pp-rate` (defaults 0 and 1), held inside the clip. Give `data-pp-manual` to a video the scene seeks itself.
- A script error while the page loads stops the render (`SCENE_ERROR`, with the line), so a broken scene never renders blank.

Kit helpers:
- `PP.p(t, a, b, ease)`: progress 0 to 1 through `[a, b]`.
- `PP.io(t, a, b, in, out)`: in, hold, then out.
- `PP.ease.out` / `outExpo` / `inOut`: no overshoot.
- `PP.num()`: formats a number.
- `PP.split(el, letters)`: splits text into words (or letters).

## Render
- **Sizes:** any size, fps and length.
- **Formats:**
  - `mp4`: H.264, for a finished piece;
  - `prores`: ProRes 4444 with alpha;
  - `webm`: VP9 with alpha;
  - `png`: a numbered sequence with alpha, plus `audio.wav`.
- **Overlays:** render with alpha, and keep `html` and `body` transparent.
- **Fonts:** a font file that fails to load stops the render (`FONT_FAILED`). So does a face the page names but never loads (`FONT_MISSING`). A system font gets a warning, because it may be missing on another computer.
- **Audio:** the manifest's sounds are mixed in sync.
- **Speed:** frames are drawn by several browsers at once.
- **Where it runs:** on the creator's own Chrome or Edge on Windows or Mac, and on our server with Chromium.

## Style in, slop out
- The style profile comes from `get_style_guide`, as its `look`. Fonts and logos come from the reference folder. A scene that ignores them is wrong for the creator, however good it looks.
- **slopCheck runs before every render** and stops it (`SLOP`) on any of these:
  - a default face (Inter, Arial, Poppins, the system font);
  - gradient-filled text;
  - a purple gradient;
  - emoji;
  - bounce, elastic or overshoot easing;
  - big coloured glows;
  - glass panels.

  Pass `--allow-slop "why"` only when the creator asked for that look.
- The bar on top of the check, at every moment of the scene, not only the last frame:
  - nothing off-centre that should be centred;
  - nothing overlapping or touching;
  - no line running through text;
  - text inside the title-safe area (5% in);
  - two lines at most;
  - one accent per graphic.

  Look at stills at several times (`still --t`) before rendering.

## Compose onto footage
`compose spec.json` takes:
```json
{ "size": "1920x1080", "fps": 30,
  "clips": [ { "src": "a.mp4", "from": 2, "to": 6 }, { "src": "b.mp4", "from": 0, "to": 4, "transition": { "type": "scene", "scene": "library/transition", "ms": 800 } } ],
  "layers": [ { "src": "lower-third.mov", "at": 1.0 }, { "src": "screen.mp4", "at": 3, "x": 0.62, "y": 0.06, "w": 0.33, "h": 0.33, "border": "#F3EBDD" } ],
  "audio": [ { "src": "bed.mp3", "at": 0, "gain_db": -18, "duck": true } ],
  "out": "final.mp4" }
```
- `base` (one file) can stand in for `clips`.
- A clip can be slowed down or sped up: `speed` (0.25-4; the sound keeps its pitch).
- A layer with `audio: true` brings its own sound (a clip in picture in picture, a subtitle scene's voice), at its time.
- A clip's transition is an ffmpeg `xfade` name (fade, wipeleft, smoothup, …) or `scene` (a transition scene rendered with alpha and laid over the join).
- Everything renders from the originals at full quality.
- Cuts, zooms, blurs (still or tracked) and captions on a whole cut stay with the existing engines: `bin/cut-footage.mjs` effects and the review room's suggested edits.

## The review loop
1. Render, then upload as the next version (`upload_file` with `version_of`).
2. Attach the scene folder as its working files (`npx post-prod-mcp zip`, then `attach_working_files`). Add a version note saying how to change it ("edit `props` in scene.json, or the frame(t) code; render with animate.mjs").
3. When notes come back, use `get_frame` for each note's frame and the drawing on it, change the scene, `still` the moment, re-render, and upload V(n+1) to the same link.

## The starter library
`animate.mjs list` shows them. Each is a styled, editable scene with its content in `scene.json` props:
- **Titles and type:** `kinetic-title`, `lower-third`, `subtitles` (sentence, word highlight or chunks), `meme-caption`
- **On footage:** `callout` (ring, arrow, label, highlight box, keyed to follow), `before-after` (a grade wipe and a split screen), `screen-frame` (a screen recording with zoom, cursor and highlight)
- **Data:** `data-chart` (a waterfall), `counter` (a count with a sparkline), `countdown` (a timer dial with a target window)
- **Maps and explainers:** `map-route` (Natural Earth, Mercator, a route that draws), `diagram` (steps with line icons)
- **Brand:** `logo-endscreen` (logo reveal, subscribe and bell, YouTube end screen)
- **3D:** `particles-3d` (three.js, instanced, seeded so every frame is the same however it renders)
- **Transitions:** `transition` (an alpha wipe for `compose`'s `"type": "scene"`)

Footage in a scene's props (`src`, `video`, `screens`) is the creator's: the library ships with none set, and the scene renders without it.
