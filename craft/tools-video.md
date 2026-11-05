# Tools: ffmpeg and frameworks
Read this when a job needs Remotion or HyperFrames, an ffmpeg recipe, or finishing on footage.

- Which engine | Remotion | HyperFrames
- ffmpeg recipes
- Finishing chain | Looks generated | Worked examples

The ffmpeg results were measured on ffmpeg 9.0.2.

## Which engine
Use a harness scene by default: it gets `check`, `--final`, the look's grain and the slop check. Use the others only when:
- Remotion: the creator already has a Remotion project, or the piece is React driven by data they own.
- HyperFrames: the creator already has a HyperFrames project.

`render <folder>` spots both from `package.json` or `hyperframes.json` and calls their CLI. What you lose: `--final` does nothing there (no blur, no supersampling, no grain), and `check` refuses them, so render stills and look. Grade and grain go on afterwards with the chain below.

## Remotion
The licence in one line: free for individuals, non-profits and companies of up to 3 people; everyone else needs a Remotion Company License, so render their project under their licence and never bundle Remotion.

Springs. The default config (mass 1, damping 10, stiffness 100) has a damping ratio of .5: 16% overshoot, which reads as playful. Always set it.

| damping (stiffness 100, mass 1) | ratio | peak | `PP.spring` give |
|---|---|---|---|
| 20 | 1 | none | 0 |
| 18 | .9 | .2% | .1 |
| 16 | .8 | 1.5% | .2 |
| 14 | .7 | 4.6% | .3 |
| 10 (default) | .5 | 16.3% | past the .4 limit |

Ratio = damping ÷ (2 × √(stiffness × mass)). Peaks are for a closed-form spring. Remotion's stepped integrator departs from the formula at extreme damping: `{ damping: 200 }` settles in 23 frames at 30 fps by `measureSpring`, where a true spring takes about 318. Use `measureSpring` for the real length and don't carry 200 into `PP.spring`.

Exact length:
```tsx
const s = spring({ frame: frame - 12, fps, config: { damping: 20 }, durationInFrames: 30, durationRestThreshold: 0.001 });
```
`durationInFrames` stretches the curve to that length. `durationRestThreshold` only works with it and sets how close to the end counts as finished: .001 means 99.9% of the way after 30 frames, so the visible move fills the whole length. Options apply in this order: duration, reverse, delay. Never spring opacity or colour.

Other parts:
- Zoom: `interpolate(frame, [0, 90], [1, 1.5], { output: 'perceptual-scale' })` for even speed. Always `extrapolateRight: 'clamp'`.
- `<TransitionSeries>`: total length is scenes minus transitions. A transition can't outlast a neighbour, and two can't touch.
- Motion blur: `<CameraMotionBlur shutterAngle={180} samples={10}>`, children absolutely positioned. It dims colours, so keep samples low. `<Trail>` is a stylised echo, not exposure.
- three.js needs `chromiumOptions: { gl: 'angle' }`.

Render. `animate.mjs` sets alpha flags for `--format prores` and `webm`, but for mp4 it passes no colour or image flags. Remotion then uses JPEG frames at quality 80 and the bt601 default, so colours shift. Run it yourself:
```
npx remotion render Main out/final.mp4 --image-format=png --color-space=bt709 --crf=14
npx remotion render Main out/final.mov --codec=prores --prores-profile=4444 --image-format=png --pixel-format=yuva444p10le
```

## HyperFrames
Open source (Apache 2.0), HTML rendered to video, Node 22+ and ffmpeg. One paused GSAP timeline per composition, and the engine seeks it frame by frame.
```html
<div data-composition-id="main" data-start="0" data-width="1920" data-height="1080" data-duration="6">
  <h1 id="t" class="clip" data-start="0.4" data-duration="5" data-track-index="1">Title</h1>
</div>
<script>
  const tl = gsap.timeline({ paused: true });
  tl.from('#t', { yPercent: 100, duration: .6, ease: 'expo.out' }, .4);
  window.__timelines['main'] = tl;
</script>
```
- Its rules: no `Date.now`, unseeded `Math.random`, fetches, timers or `repeat: -1`. Never tween `display` or `visibility` on a clip, and never add a CSS `transform` to an element GSAP transforms. Paths are `assets/...`.
- `animate.mjs render` passes only the output and fps, so it makes an mp4. For alpha run `npx hyperframes render` yourself, pick mov (ProRes 4444) or webm, and leave `html` and `body` unpainted. `--prores-profile hq|422|lt|proxy` have no alpha.
- Check: `npx hyperframes check --json`, `npx hyperframes snapshot --review`. Default quality is crf 16, and `--crf` overrides it.
- Motion blur: `data-motion-blur="on"`. It blurs each mover along its path rather than averaging frames. Its default shutter is 240; set `data-motion-blur-shutter="180"` to match our film look.
- Its guide rates springs by ratio: 1 none, .7-.85 premium, .4-.6 playful, under .3 cartoon. We stay at .7 or above.
- With no CLI, `render` draws the page here on its own clock. It won't seek in parallel, so it is slower.

## ffmpeg: zoom without jitter
Plain `zoompan` moves in uneven steps, because it rounds to whole pixels. A line 300 px off centre stepped up to 1.6 px against an ideal .33 (spread .49 px). Upscaling 4× first cut that to .61 max (spread .12).
```
-vf "scale=5120:2880:flags=lanczos,zoompan=z='1+0.1*on/90':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=5120x2880:fps=30,scale=1280:720:flags=area"
```
- 1080p needs 7680:4320 and is slow. Better: put the footage in a scene and scale a wrapper with CSS, which is sub-pixel accurate, or use the `cut-footage.mjs` effects.
- `scale=...:eval=frame` then `crop` gave about 3× too much zoom in this build. Don't use it.
- `minterpolate` to fake sub-frames took 34 s for 2 s of 720p and tears on overlays. Short plates only.

## ffmpeg: transitions
57 `xfade` names, and `compose` takes any of them. Soft-edge wipe with a 10% feather, left to right:
```
xfade=transition=custom:duration=0.8:offset=4.2:expr='clip(((X/W)-(1-P)*1.1+0.1)*10,0,1)*A+(1-clip(((X/W)-(1-P)*1.1+0.1)*10,0,1))*B'
```
- P runs 1 to 0, so `1-P` is progress. Ease it by replacing `(1-P)` with `(1-P)*(1-P)*(3-2*(1-P))`.
- The trap: writing this with `st(0,...)` and `ld(0)` gives wrong pixels, different on every run, because slice threads share the evaluator. Either inline the sub-expression as above, or run with `-filter_threads 1 -filter_complex_threads 1`.
- Both clips need the same size, pixel format and fps.
- `tmix=frames=3:weights='1 2 1'` is a cheap frame blend. For a 16-bit average on N× fps frames: `format=rgb48le,tmix=frames=8,framestep=8`.

## ffmpeg: colour
An untagged RGB to yuv420p encode uses the BT.601 matrix, and players assume 709 for HD. Source #E8512F came back as (245,92,43). With the matrix set it came back (231,79,46).
```
scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p,setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv
```
`setparams` writes all four tags. The harness handles this, so add it only to your own ffmpeg lines. Check: `ffprobe -v error -select_streams v -show_entries stream=color_space,color_primaries,color_transfer,color_range -of csv=p=0 f.mp4` should print `tv,bt709,bt709,bt709`.

Use yuv420p for delivery. yuv444p is for ProRes and archive, where thin red text on black would bleed. High 10 H.264 fails on some Safari and hardware decoders, so keep it to masters.

## ffmpeg: gradients, grain, deband
Banding is made when the 8-bit frame is made, so encoder flags can't fix it. Mean run of identical luma along 360 px of a dark gradient: 12.4 with default x264, 12.4 with `-tune grain`, 12.4 with aq-mode 3, 10.9 with error-diffusion dither, 5.3 with `noise=alls=2:allf=t+u` before the encode. Add noise to fix it.
- `noise=alls=4` to `8` is fine grain; `allf=t+u` is new each frame. `alls=2` is enough for banding alone.
- `--final` uses luma-only `noise=c0s=<grain × 140>`: look grain .03 is 4, .05 is 7, .08 is 11.
- On footage that already bands, deband first and then grain: `deband=1thr=0.02:2thr=0.02:3thr=0.02:blur=1,noise=alls=4:allf=t+u`. It runs, but the effect is unmeasured, so compare a still.
- x264 for gradients: `-crf 14-16 -preset slow -x264-params aq-mode=3:aq-strength=0.9`, `-tune grain` for heavy grain. These hold the grain; they don't remove banding.

## ffmpeg: alpha and overlays
```
ProRes 4444: -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le -alpha_bits 16 -vendor apl0
VP9 alpha:   -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 24 -auto-alt-ref 0
```
- ffprobe shows VP9 as yuv420p with the tag `alpha_mode=1`, because alpha is a side channel. It's still there, but decode it with `-c:v libvpx-vp9` placed before `-i`.
- Overlay: `[bg][fg]overlay=x=0:y=0:format=auto:eof_action=pass:enable='between(t,2,6)'`.
- These streams are straight alpha. Around any blur or scale use `premultiply=inplace=1` and `unpremultiply=inplace=1`, or soft edges go dark.

## ffmpeg: captions
The `subtitles` scene looks better. For a quick burn on long footage: `-vf "ass=cap.ass"`, with `YCbCr Matrix: TV.709` in the file. ASS colours are BGR: `&H3D6AFF&` is orange #FF6A3D.

## Finishing chain for footage
This runs on the whole mix after `compose`, so graphics and footage share one grain. Order: grade, vignette, grain, then matrix and tags. Grain goes last, or the LUT stretches it.
```
ffmpeg -i mix.mp4 -vf "format=gbrp16le,lut3d=look.cube:interp=tetrahedral,vignette=angle=PI/4.5,noise=alls=7:allf=t+u,scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p,setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv" -c:v libx264 -preset slow -crf 16 -x264-params aq-mode=3:aq-strength=0.9 -c:a copy final.mp4
```
- One LUT for the whole film, 17-33 points, so scenes from different engines match. Make the `.cube` in code, with no download. Shadows lean teal, highlights warm; these amounts are start-at values, so tune by eye on a real frame:
```js
const N = 17, sh = [-.02, .01, .03], hi = [.03, .01, -.02]; let s = `LUT_3D_SIZE ${N}\n`;
for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) {
  const c = [r, g, b].map((v) => v / (N - 1)), y = .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  s += c.map((v, i) => Math.min(1, Math.max(0, v + sh[i] * (1 - y) + hi[i] * y)).toFixed(5)).join(' ') + '\n'; }
```
- Don't stack grain: a piece rendered with `--final` already has the look's. If you'll run the chain, render it without, or drop `noise` here.
- Vignette: `PI/4.5` is the tested angle, and a smaller angle is lighter. A full-frame scene already has the look's vignette from `PP.ground`, so don't apply both.
- Chromatic aberration on hero reveals and transitions only: split planes, scale red up .3-.6% and blue down by the same. `rgbashift=rh=-2:bh=2` is the cheap flat version. Lenses shift most at the edges, and `rgbashift` shifts everywhere.

## Looks generated → instead
- `zoompan` on raw footage → 4× upscale first, or scale in a scene.
- `-pix_fmt yuv420p` alone → matrix and four tags.
- Dark gradient at higher bitrate → noise before the encode.
- `fade` on every join → a cut, or one custom wipe with a reason.
- Remotion's default spring → set damping, or use `durationInFrames`.
- A new grade per scene → one LUT across the film.
- Grain at the same strength on everything → by look: none on scoreboard, heavy on casefile.

Keep the chain modest and vary it: a clean tutorial may need only the tags.

<example>
Travel vlog with amber sunsets and cool interiors. Compose first, then the chain: 17-point LUT, vignette at `PI/4.5`, `noise=alls=7`. Skin stays in range because the shift is 2-3%. Frame: interiors and lower thirds now share one black and one grain, with no visible step at the join.
</example>

<example>
Remotion lower third in the creator's project. `{ damping: 16 }` on x gives 1.5% over on the plate; text uses damping 20. `durationInFrames: 18`, threshold .001. Rendered with `--color-space=bt709 --image-format=png`. ffprobe confirms bt709, and the logo's red now matches their brand hex.
</example>

<example>
Push-in on a still map plate, 1.0 to 1.1 over 90 f. With plain `zoompan` a coastline shimmers. Upscale 4× and the steps fall from 1.6 to .61 px max; the line now slides without crawling.
</example>

<example>
Dark mesh ground on impact look, where grain is 0: bands show on a phone. Add `"grain": .02` and re-render with `--final`, which gives `noise` strength 3. The picture reads as a smooth gradient, and the grain itself can't be seen.
</example>
