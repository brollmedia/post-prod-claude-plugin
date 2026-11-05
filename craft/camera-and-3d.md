# Camera and 3D
Read this when a shot needs a camera move, depth, three.js, a collage or paper look, or particles.

Contents: Camera moves · Handheld · Parallax · Rack focus · three.js set-up · Lens · Light · Materials · Form · Tone and colour · Post · 2.5D and collage · Particles · Looks generated · Examples

Frames are at 30 fps. Values are practitioner starting points, tune by eye, unless a spec or formula is named. Start from `particles-3d` (`new particles-3d <folder>` brings the vendor folder). Anything the scene shows that is the creator's stays the creator's: never fetch footage or images for them.

## Camera moves
The move carries meaning. Push in on emotion or a key line. Pull out to reveal or isolate. Orbit to show form. Truck along a row. A zoom has no parallax and looks like a presentation; a dolly or orbit changes the perspective, so prefer them in 3D.
- Push on 2D: scale 1.03 to 1.08 across a shot, about 1% a second, on a wrapper with `transform-origin` on the subject. Scale of 15 to 25% reads as a digital zoom. Over 3% a second reads as a deliberate zoom (start at; a judgement, no source).
- Drift on a hold: a few px, at most ±6 px (0.6% H), `PP.noise(t * .2, seed)`. In 3D, 3 to 5° a second.
- Curve: `PP.ease.camera`, a long settle. Short symmetric eases feel like UI.
- End with 6 to 15 f of 1 to 2% continued drift, not a dead stop.
- A shot cut in mid-move must already be moving on frame 0, or there is a visible pause then go. Run the curve from before the shot: `PP.p(t, -1, D + 1, PP.ease.camera)`. Ease fully to rest only on the last shot.
- The world moves, type stays. Landed text sits on an unscaled layer unless it belongs to the place. Otherwise `check` may say NOTHING_RESTS, and it is right.
- A slow push on type shimmers in a draft. Judge it in `--final`, which draws the page at 2×.
- Dolly zoom: subject width stays constant if `d = W / (2 * tan(fov / 2))`. With W = 2: fov 30° gives d 3.73, fov 60° gives d 1.73. Ease `fov`, recompute `d` every frame, call `updateProjectionMatrix()`, run 60 to 120 f.
- Height: product at mid-height to 10 to 25° above. Eye level or lower for a person or anything powerful. View objects 30 to 45° off front, not dead on.
- Hero reveal holds 3 to 5 s with a slow move; a motion beat 1.5 to 3 s.

## Handheld
Operators shake more in rotation than position, so build rotation first (Cinemachine guidance).
- Layer three seeded noises: sway 0.1 to 0.5 Hz, mid 0.8 to 1.5 Hz, jitter 3 to 4 Hz at much lower amplitude. `rx = A * (PP.noise(t * .3, 1) + .5 * PP.noise(t * 1.1, 2) + .12 * PP.noise(t * 3.5, 3))`.
- Rotation 0.1 to 1° for documentary, 2° at most for run and gun. Position under 1% of subject distance. One published preset sits at 0.92 Hz with 0.1° pitch and roll, 0.05° yaw, a good floor.
- On 2D, 2 px of noise-driven offset does the job. Never `Math.random`: jitter has no inertia and changes on every render.
- Handheld over a slow dolly makes CG feel filmed. Turn it off for charts and UI.

## Parallax
Sideways shift is `f * dx / z`, so layer speed scales with 1/depth.
- Depths 1, 2, 4, 8 give speeds 100, 50, 25, 12.5%. Keep nearest to farthest under 10:1. Use 4 to 6 layers.
- Each layer extends past the frame by its travel plus the push, plus 5 to 10% around cut-outs, or edges show.
- Far layers: blur 0.5 to 2 px, slight desaturation and haze. Foreground: more blur, passing quickly.
- CSS 3D: parent `perspective` 800 to 1200 px; `translateZ(z)` scales by `p / (p - z)`, so scale by `(p - z) / p` to keep a layer's size. Tilt the stack 2 to 5°. Past 10° the layers show as flat cards.

## Rack focus
- 15 to 45 f on a smooth ease. Start 6 to 9 f before the thing to look at, and hold the new focus 30 f or more.
- On 2.5D layers, animate `filter: blur()` opposite ways on two layers. It costs about 35 ms a frame per 600 px box at 40 px, so it is cheap.
- Blur is in pixels: judge at final size. Keep the background recognisable, and never let the hero go soft unless that is the story.

## three.js set-up that works here
The kit ships three r170 core only (`vendor/three.module.min.js`). Tested on this harness:
- `new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })`, `setPixelRatio(1)`, `setSize(W, H, false)`. Draw in `frame(t)`, set every transform from `t`. No `THREE.Clock`, `performance.now` or `Math.random`.
- SwiftShader runs on the CPU. On one Windows machine at 1080p: physical material, soft shadow, draft about 0.9 s a frame with bloom; `--final` 3.6 s a frame direct, 6.6 s with bloom, 9 s at full device pixel ratio. So stay at ratio 1, `still` first, and keep 3D shots short. Tell the person the render time before a long final.
- Addons are not in the kit. When one is worth it, fetch MIT files once from `https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/` into the scene's `vendor/addons/` and add `<script type="importmap">{"imports":{"three":"./vendor/three.module.min.js","three/addons/":"./vendor/addons/"}}</script>`, before the module script. Keep the folder structure; a pass imports its neighbours. Same version as the core.
- Words go in the DOM over the canvas: lowest risk, and `check` cannot see inside WebGL, so 3D text gets no TOO_SMALL or OUTSIDE_SAFE. If text must sit in the world, draw it to a 2× canvas and use a `CanvasTexture`, then check it by eye with `still`.
- For alpha overlays, pass `alpha: true`, clear to 0 opacity, and keep `html` and `body` transparent.

## Lens
three.js `fov` is vertical. `setFocalLength(f)` uses film gauge 35 mm, so film height is `35 / max(aspect, 1)`.
| Focal | fov at 16:9 | fov at 9:16 or 1:1 |
|---|---|---|
| 35 mm | 31.4° | 53.1° |
| 50 mm | 22.3° | 38.6° |
| 85 mm | 13.2° | 23.3° |
| 135 mm | 8.3° | not needed |

- The default fov 50 is a wide lens at 16:9: on a close object it reads as a snapshot.
- Products 50 to 85 mm: long, low distortion. Environments and wide hero angles 35 mm. Under 24 mm bends edges.
- Frame from the subject. Compute distance from the width you want on screen (`particles-3d` shows how), so 9:16 gets its own distance.

## Light
- Stops: 1 = 2:1, 2 = 4:1, 3 = 8:1. Film's "3:1" often means (key + fill):fill, so 2:1 key to fill. Here, ratios are key to fill.
- Key 1, fill 0.25 to 0.5 for product and beauty. Fill 0.1 to 0.125 for low-key drama. Rim 1 to 2 × key.
- Key 30 to 45° off camera and above. Fill opposite and low. Rim behind and above, opposite the key.
- In three.js units, `particles-3d` runs key 2.4, rim 1.2. These change with tone mapper, so retune after switching.
- Fill comes from an environment map, not `AmbientLight`, which flattens. Metal with no environment is near black.
- A mostly dark studio with 2 to 3 bright panels gives long clean edge highlights; even bright surroundings give plastic. Core-only recipe, tested: a small `Scene` with a near-black background and 3 `MeshBasicMaterial` planes at colour values 4 to 12 (above 1 on purpose), then `new THREE.PMREMGenerator(renderer).fromScene(env, 0.04).texture` as `scene.environment`. Addon `RoomEnvironment` is the quick version, but flatter. This also replaces `RectAreaLight`, which needs addon uniforms.
- `scene.environmentIntensity` 0.5 to 1.2. Rotate `scene.environmentRotation` to place a highlight; do not turn the object.
- Shadows: `VSMShadowMap` honours `shadow.radius` and `blurSamples` but can leak through thin parts. `PCFSoftShadowMap` ignores `radius`. mapSize 2048, bias -0.0001 to -0.001, normalBias 0.01 to 0.02. Fit the shadow camera tight.
- Ground: a `ShadowMaterial` plane at opacity 0.2 to 0.45 shows only the shadow on the paper colour, with no horizon line. A lit plane in the paper colour will not match: the clear colour skips tone mapping, the plane does not.
- On a dark paper a shadow cannot read. Separate the object with a rim, or a soft pool of light behind it.

## Materials
- Metalness is 0 or 1. Mid values only for rust or dust. Non-metals reflect about 4% head on.
- Base colour between 0.02 and 0.85 linear (charcoal and snow measured). In sRGB, about 35 to 235. No pure black or white.
- Roughness: polished metal 0.1 to 0.3, brushed 0.3 to 0.5, glossy plastic 0.2 to 0.4, matte plastic 0.5 to 0.7, rubber or cloth 0.8 to 1, glass 0 to 0.1 with transmission. Never exactly 0: the highlight aliases.
- Noise the roughness by ±0.05 to 0.1. Set colour, roughness and metalness every time; the default is grey clay.
- Lacquer or car paint: `MeshPhysicalMaterial`, clearcoat 0.5 to 1, clearcoatRoughness 0.03 to 0.1.

## Form
- Sharp 90° edges catch no light. Bevel 2 to 5% of the smallest side, 4 to 6 segments or more.
- Core-only rounded box, tested and smooth: `BoxGeometry` with 24 or more segments per side; for each vertex, `c` = vertex clamped to the box shrunk by r; `o` = normalised (vertex - c); position = c + o * r; normal = o.
- `ExtrudeGeometry` for logos: bevel on, but side and bevel show a hard band (tested). Run it through `toCreasedNormals(geo, 0.7)` from addon `utils/BufferGeometryUtils.js`.
- Hero curves 64 × 32 segments or more. Vary scale and rotation 2 to 5%.
- Sizes in 1:2:4, clustered, with empty space. Not a grid of equals.
- Premium in one line: 3 to 4 colours, soft studio light, bevels, contact shadow, long lens, slow eased camera, one hero, empty space.

## Tone and colour
- Product or brand colour: `NeutralToneMapping`, which keeps the hue. Cinematic: `ACESFilmicToneMapping`, which shifts hue (oranges go yellow, intense colours collapse). Flat base: `AgXToneMapping`.
- Neutral crushes near-blacks (tested: a near-black lit floor went to pure black). Lift dark surfaces, or use ACES on a very dark scene.
- Leave `ColorManagement` on, `outputColorSpace = SRGBColorSpace`. Hex colours are read as sRGB; colour maps are tagged sRGB, data maps stay linear. Read colours from `PP.style.colours`. Exposure starts at 1: retune it and the lights after changing mapper.

## Post
Most hero shots need no post stack. Bloom and depth of field cost the most render time, so earn them.
- Order: AO, depth of field, bloom, tone map, grade, vignette, chromatic aberration, anti-aliasing, sRGB. Tone mapping before bloom kills glow, as nothing exceeds 1 any more. The look's grain comes later from the encoder.
- Addon route, tested: `EffectComposer` on a `WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 })`, then `RenderPass`, `UnrealBloomPass`, `OutputPass` last. Without `OutputPass`, tone mapping and sRGB never happen and the image washes out. Call `composer.render(0)` so no clock leaks in.
- Bloom strength 0.15 to 0.6, radius 0.5 to 0.8, threshold 1 on HDR values, so only emissive parts glow (emissive colour above 1). Strength 1 reads as a 2012 demo, and `slopCheck` stops big coloured glows. For one small glow, skip the composer: an additive `Sprite` with a soft radial `CanvasTexture`.
- Vignette 10 to 25% through `PP.ground` or a CSS layer. Chromatic aberration 1 to 2 px, hero or transition only.
- AO radius 0.1 to 0.5 scene units, intensity 0.5 to 1: strongest cue for solid. Depth of field and AO passes are untested here; try one `still` first.
- No grain in the page. A full-frame `feTurbulence` cost 235 ms a frame; `--final` adds the look's grain in the encoder.

## 2.5D and collage
- Paper cut-out: two shadows. Contact offset 1 to 2 px, blur 2 to 4 px, opacity 0.35. Ambient offset 6 to 14 px, blur 16 to 30 px, opacity 0.15 to 0.25. Both grow with layer height.
- Cream or white paper edge 2 to 6 px (0.2 to 0.6% H). Torn edge: `feTurbulence` baseFrequency 0.02 to 0.05, 2 to 3 octaves, `feDisplacementMap` scale 4 to 12 on the mask. Render it once in `setup`, as an image.
- Collage: the creator's photo cut-outs, 1 to 2 px feather, 3 to 6 px keyline, shadow. Rotate each -4 to +4°, never on a grid. 2 to 3 faces, one accent. Halftone: dot pitch 6 to 12 px at 45° for one colour.
- Pieces enter over 9 to 15 f on `PP.enter` with 1 to 3° rotation settle. Then hold; do not keep everything moving.
- Boil: jitter ±0.5 to 1° or re-seed turbulence every 2nd or 3rd frame, from `Math.floor(t * 10)`. Burn or leak: warm gradient in `screen` blend, 8 to 18 f at a transition, never over text.

## Particles
- Closed form, so any frame stands alone: `age = (t + offset[i]) % life`, position = origin + velocity * age + noise. No step-by-step sim. `InstancedMesh` with seeded values (`PP.hash(i)`) handles thousands.
- Noise: 2 to 4 octaves, frequency ×2, amplitude ×0.5, spatial scale 0.3 to 1 per scene unit, time speed 0.05 to 0.3 per second.
- Curl noise (Bridson 2007) swirls instead of clumping into gutters: `v = (dψ/dy, -dψ/dx)` by central difference. Fade the field near frame edges.
- Vary size and blur 5 to 10× with depth. Fade by distance. Ease life fades over 0.2 to 0.4 of life at each end.
- Dust done right: 50 to 300 motes, 1 to 4 px, opacity 0.1 to 0.5, under 5 px/s, lit only where the key falls.
- Often better than a field: a few large slow soft shapes plus grain.

## Looks generated → instead
- Default grey box, one hard light → bevel 3%, panel environment, key plus rim, soft shadow.
- fov 50 close-up → 85 mm, `fov` 13.2°, camera pulled back.
- Linear turntable forever → 30 to 45° arc on `PP.ease.camera`, landing on the best angle.
- Spin with constant zoom on a flat card → 3 to 8% push with real parallax across 4 layers.
- Heavy bloom on everything → threshold 1, strength under 0.6, one emissive part.
- Shake on a chart → still frame, push on the hold.
- Purple-blue dark void with sparkles → the look's paper, one hero, 100 dust motes at most.
- Particles bursting from a point → seeded field with depth, 5 to 10× size spread, tied to the story.
- Floor with a visible horizon → `ShadowMaterial` on the paper colour.

These are defaults, not a house style. Pick the lens, light and move that suit this shot, and change them from one shot to the next.

## Examples
<example>
Brief: the creator's logo appears as a physical object for an end card.
Decisions: their SVG path to `ExtrudeGeometry`, depth 15% of height, bevel 3%, 5 segments, creased normals, brushed metal at roughness 0.35. Dark studio of 3 panels, Neutral so the brand colour holds, 85 mm, 20° above. Camera orbits 35° over 90 f on `PP.ease.camera`, starting in motion.
Frame: a long highlight slides along the bevel and stops on the logo's edge as the camera settles, with `whoosh` under it and DOM tagline landing after.
</example>
<example>
Brief: a still historic photo needs to live for 6 s under narration.
Decisions: the creator's photo split into 4 layers (sky, far buildings, figure, foreground rail) at depths 8, 4, 1.5, 1. Truck 60 px over 180 f. 5% push on the figure. Far layer blur 2 px. Bleed 8%.
Frame: the rail slides past fast while the sky barely moves, so a flat photo gets a real camera. No handheld: the subject is still and calm.
</example>
<example>
Brief: a dramatic low-key reveal of a single coin or trophy.
Decisions: gold metalness 1, roughness 0.25, ACES, fill 0.1. One strip panel in the environment, rim 1.5 × key, 135 mm. Black paper, so no shadow plane. Environment rotates 40° over 120 f while the object stays still.
Frame: a band of light crosses the surface from dark to full shape, and a small additive sprite marks the peak. Render stays 3.6 s a frame, no composer.
</example>
<example>
Brief: a paper-collage segment on an old trade dispute.
Decisions: placeholder shapes until the creator gives photos, cream edges 4 px, two-layer shadows, torn map base, pieces rotated between -3 and +4°. Boil at 10 updates a second on tape and scribbles only; a 4% push in 3 layers.
Frame: pieces land with a 2° settle in sync with the narration's nouns, then rest, so the eye reads a desk of evidence rather than a moving template.
</example>
