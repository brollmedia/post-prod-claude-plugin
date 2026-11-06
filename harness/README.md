# The post-prod animation harness

One way to make any animation, graphic or edit in the creator's own style, render it exactly, put it on their footage, and get notes on it in post-prod.io. The engine is `server/harness.js`; the plugin runs a copy (`bin/footage/harness.js`) through `bin/animate.mjs`.

## Commands
```
node bin/animate.mjs list                                  the starter library
node bin/animate.mjs looks                                 the starting looks (type, colour, motion, sound), for when nobody has set one, and what was used lately
node bin/animate.mjs new <library-scene> <folder> --sheet look.json   copy one to edit, in a look written as numbers (or --look <name> --named when someone named one; it brings the kit and only the fonts it needs)
node bin/animate.mjs still <scene> --t 2.5 --out f.png     one frame
node bin/animate.mjs check <scene> [--aspect 9:16]         measure every frame, and write a contact sheet and the frames with the words covered
node bin/animate.mjs render <scene> [--final] [--aspect 9:16 | --size 1080x1920] [--fps 60] [--format mp4|prores|webm|png]
     [--duration 6] [--workers 4] [--style look.json] [--ref reference/] [--props props.json] [--out f.mp4]
node bin/animate.mjs sfx <kind> [--out f.wav] [--dur .5] [--seed 3] [--note 220]   one original sound effect, made here
node bin/animate.mjs sound <file> [--hits 1.2,3.4] [--target -14] [--overlay]      measure a mix (--target for a finished voiced mix)
node bin/animate.mjs level <piece> --into <video> --out f.mp4 [--from 10 --to 40] [--gap]   bring a piece down to the voice in a video
node bin/animate.mjs strip <video> [--out folder]           the frames either side of every cut
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
- `PP.ease`: `enter`, `snap`, `glide`, `move`, `camera`, `exit` by role (`craft/motion.md`), and `out`, `outExpo`, `inOut`. `PP.bezier(x1, y1, x2, y2)`. `PP.enter` and `PP.give` are the look's.
- `PP.spring(t, a, dur, give)`: a closed-form spring. `give` 0 is no overshoot, 0.15-0.3 is about 1-5%.
- `PP.f(n)`: seconds from frames at 30 fps, scaled by the look's pace.
- `PP.stagger(i, n, step, cap)`, `PP.digits(el)` (a counter that never shifts), `PP.fit(el, maxW, maxPx, minPx)`.
- `PP.ground()`: a full-frame ground with one light and a vignette. `PP.hash`, `PP.noise`, `PP.noise2`: seeded.
- Library scenes are silent unless `props.sound` is true: no sound unless they asked for it or brought their own.
- `sound` in `PP.scene`: `[{ sfx: 'whoosh', hit: 1.2, gain_db: -20, dur: .4, seed: 3 }]`, timed from the same numbers as the picture. `hit` puts the sound's loudest moment on that time. Kinds: whoosh, riser, impact, tick, pop, sub, swell, shimmer, rollup, pad, room.
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
- **Final:** `--final` is the finished look: motion blur (180° shutter, 8 sub-frames, centred), drawn at 2×, the look's film grain, and a full-frame piece with a voice or track of theirs brought to -14 LUFS. Effects alone stay where you set them. Drafts are sharp and quick. `--shutter`, `--samples` and `--ss` set them apart.
- **Colour:** frames are converted to Rec. 709 and tagged, so a colour in a scene is the colour in the file.
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

  `check` measures all of this on every frame; look at its contact sheet before rendering.

## Compose onto footage
`compose spec.json` takes:
```json
{ "size": "1920x1080", "fps": 30,
  "clips": [ { "src": "a.mp4", "from": 2, "to": 6 }, { "src": "b.mp4", "from": 0, "to": 4, "transition": { "type": "scene", "scene": "library/transition", "ms": 800 } } ],
  "layers": [ { "src": "lower-third.mov", "at": 1.0 }, { "src": "screen.mp4", "at": 3, "x": 0.62, "y": 0.06, "w": 0.33, "h": 0.33, "border": "#F3EBDD" } ],
  "audio": [ { "src": "voice.wav", "kind": "voice" }, { "src": "song.mp3", "kind": "music", "drops": [12.4] }, { "src": "pad.wav", "kind": "bed" }, { "src": "click.wav", "kind": "sfx", "at": 3, "peak_db": -15 } ],
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
- A `compose` spec can take `"master": -14` to bring the whole piece to that level, as `render --final` does.
- **Titles and type:** `title-sequence` (contour world, a route, the title), `kinetic-title`, `title-over` (a title on plates, over footage), `quote-card` (the quote fills the frame, in two forms), `lower-third` (two forms), `subtitles` (sentence, word highlight or chunks), `meme-caption`
- **On footage:** `callout` (ring, arrow, label, highlight box, keyed to follow), `before-after` (a grade wipe and a split screen), `screen-frame` (a screen recording with zoom, cursor and highlight)
- **Data:** `stat-reveal` (a count with a to-scale bar and a payoff), `data-chart` (a waterfall), `counter` (a count with a sparkline), `countdown` (a timer dial with a target window)
- **Maps and explainers:** `map-route` (Natural Earth, Mercator, a route that draws), `diagram` (steps with line icons)
- **Brand:** `logo-endscreen` (logo reveal, subscribe and bell, YouTube end screen)
- **3D:** `particles-3d` (three.js, instanced, seeded so every frame is the same however it renders)
- **Transitions:** `transition` (an alpha wipe for `compose`'s `"type": "scene"`)

Footage in a scene's props (`src`, `video`, `screens`) is the creator's: the library ships with none set, and the scene renders without it.
