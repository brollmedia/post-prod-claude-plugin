# Colour and depth

Read this when you choose a palette, put text over footage, add shadow, grain or vignette, or need a graphic to survive YouTube's compression.

Contents: Palette | Neutrals | Contrast | Text over footage | Depth | What survives YouTube | Looks generated | Examples

Figures tagged with a standard, or marked measured, are solid. The rest is working practice: start there and tune by eye on a `still`.

## Palette
Think in OKLCH, because lightness and hue hold steady where HSL drifts. Write hex into `style.json` and text colours: `check` reads only rgb colours, so text set in `oklch()` or `color-mix()` silently skips LOW_CONTRAST. Render only in sRGB/BT.709; P3 values clip.

Colour count: one neutral ramp, one accent, one optional second accent. Three hues at most in a graphic. A chart series beyond 3 varies lightness inside one hue. Split the area 60% neutral or footage, 30% secondary, 10% accent. Above about 15% the accent stops meaning anything.

From one seed hue h:

| Role | L | C | H |
|---|---|---|---|
| Accent | 0.65-0.75 | 0.12-0.18 | h |
| Second accent, optional | as needed | 0.14 or less | h ±30, or h + 180 |
| Neutral ramp | 0.17, 0.22, 0.32, 0.60, 0.85, 0.96 | 0.005-0.02 | h, or h + 180 |

Hue anchors, computed from the sRGB primaries: red 29, yellow 110, green 142, cyan 195, blue 264, magenta 328. Equal-brightness series: fix L and C and rotate h.

Cap C at 0.18 for text and large fills. Above 0.20, reds, oranges and magentas sit at the sRGB edge and smear after 4:2:0. Many hues cannot go that high anyway, and an out-of-gamut value clips and shifts hue. Largest sRGB C, computed at L 0.70: hue 25 0.19, 45 0.20, 140 0.22, 200 0.12, 300 0.19; at L 0.75 hue 90 0.15; at L 0.65 hue 260 0.19.

From a frame of the person's video: downsample to about 8x8, run k-means with 5 clusters in OKLab, sort by population. The biggest cluster becomes the ground neutral, with C pulled to 0.01-0.02. The highest-chroma cluster with L 0.5-0.85 becomes the accent. Then check text against a crop of the frame under the graphic. Never take text colour from skin or sky: those tones are for tints and shadows.

Blends and gradients go in OKLCH too: `linear-gradient(in oklch, A, B)` and `color-mix(in oklch, A 30%, B)` avoid the grey middle sRGB gives between complements. Keep a gradient within 20-30 degrees of hue and an L span of 0.15 or less. Use a mixed result as a fill, or bake it to hex for text. Match the thumbnail's accent and ground tint in the first 5-10 s.

## Neutrals
Tint every neutral: C 0.005-0.02 at the seed hue, since grey looks dead next to coloured footage. Dark ground L 0.17-0.23, about #0E0F12 to #1B1C20. Light ground L 0.95-0.97, about #F4F3EF. Text on dark L 0.93-0.97, secondary text L 0.72-0.80. Pure white over dark glares and blooms on OLED. The `impact` look uses #FFFFFF on purpose; that is a loud choice, not a default.

## Contrast
Web tiers are for a screen at arm's length with still text. Video is further away, moving and compressed, so go one tier up.

| Use on video | APCA | WCAG 2 |
|---|---|---|
| Label, support, role line | Lc 75+ | 7:1 |
| Title, hero | Lc 60+ | 4.5:1 |
| Chart data series, icons | Lc 45+ | 3:1 |
| Gridlines, axes | Lc 30+ | |

For reference, the published tiers: APCA Lc 90 preferred body, 75 minimum body, 60 content text, 45 headlines, 30 spot text, 15 non-text. WCAG AA 4.5:1, large text 3:1, AAA 7:1, non-text 3:1.

On dark grounds trust APCA, because WCAG 2 flatters mid-tone colour. Measured: #E8452C on #0E1217 is 4.8:1, which sounds fine, and only Lc 36. A red reaches Lc 60 at about #FF8F86. Passing `check` is not enough either: it asks only 3:1 for anything 43 px or over, and it reads the text's colour without its opacity.

What this means for any look:
- `--pp-muted` is for rules and shapes on a dark ground, not for words you need read.
- `--pp-accent` is a fill, a bar or a marker first. Set words on it with `PP.on(colour)`, which picks the look's ink or paper and says how well it stands out. A mid-tone accent carries neither at 7:1, so put the words on ink and keep the accent in the move.
- `--pp-ink` at reduced opacity loses contrast fast, on a coloured ground fastest. Keep 48 px labels at 90%. A word dimmed on purpose after it has been read takes `data-pp-spent`, so `check` leaves it out.

## Text over footage
An overlay meets every kind of picture, so plan for the bright case. Take the brightest moment under the text across the shot (the 95th percentile, not the average). LOW_CONTRAST tests against #EBEBEB and #181818.

Scrim maths: CSS and `compose` blend gamma-encoded values, so a black scrim of opacity a turns an encoded value v into v(1 - a), and luminance falls faster than a. Alpha needed for L 0.95 ink, computed:

| Worst luminance under text | For 4.5:1 | For 7:1 |
|---|---|---|
| 1.0, clipped sky | 0.57 | 0.69 |
| 0.8, white wall | 0.53 | 0.65 |
| 0.5 | 0.42 | 0.57 |
| 0.3 | 0.27 | 0.46 |
| 0.2 | 0.12 | 0.35 |

Why a solid plate usually wins. On clipped white footage, the same ink gets 2.9:1 from a scrim at alpha 0.45 and 7.4:1 at 0.70, but 10.6:1 from a tinted plate (L 0.18) at 85%, 13.4:1 at 92% and 16.3:1 solid. A plate also barely moves with the shot: 92% goes from 13.4:1 on white to 15.8:1 on dark. It touches less of the picture: a lower-third plate covers 8.5% of the frame, a scrim 35% of H tall covers 35%. And an overlay gets no grain, so a dark gradient bands while a flat fill compresses cleanly.

When bare text fits better:
- Bottom scrim: three stops or more, `linear-gradient(to top, rgba(0,0,0,.70) 0%, rgba(0,0,0,.45) 40%, rgba(0,0,0,0) 100%)`, over the bottom 30-40% of H (320-430 px). Keep the text low in it, where alpha is 0.60 or more (5:1 on a clipped sky). Two stops show a hard edge.
- Full-frame dim behind a centred title: 40-55% black. At 55% the worst case is 4.1:1, so raise it for white skies. With a 20-40 px blur of the footage, 35-50%.
- Text shadow is a backup: `0 1px 2px rgba(0,0,0,.6), 0 2px 12px rgba(0,0,0,.5)`. It muddies thin type. For a caption outline, `-webkit-text-stroke: 3px; paint-order: stroke fill;` keeps the stroke outside the letter.
- No coloured scrims on faces: they change the skin.

An overlay scene cannot see the footage. Blur or dim the real picture only in a scene or `compose` step that contains it.

## Depth
One depth cue per object: shadow or outline, not both, and no glow on top. Three elevations at most in a video.

Shadows layer, offset and blur doubling each step, alpha falling as the layers grow (Ahlin, Comeau). Web values doubled for 1080p, tinted with the ground's hue, never pure black:

```css
--s: 240 40% 6%;  /* hue of the ground */
box-shadow: 0 2px 2px hsl(var(--s) / .14), 0 4px 4px hsl(var(--s) / .14), 0 8px 8px hsl(var(--s) / .14),
  0 16px 16px hsl(var(--s) / .14), 0 32px 32px hsl(var(--s) / .14), 0 64px 64px hsl(var(--s) / .14);
```

- Bright footage: raise each layer to .18-.22. Dark footage hides shadows, so use a slightly lighter panel and `inset 0 2px 0 rgba(255,255,255,.08)`.
- One light for the video. `PP.ground({ light: [0.15, 0.1] })` puts it top left, so every shadow falls right and down, x offset half of y. Centred stacks take no x offset.

Ground: `PP.ground` gives paper, one soft light and the vignette, and is the right start for full-frame scenes. Drifting blobs and mesh gradients fill space without meaning, so reach for them only when the brief asks for atmosphere, and then with grain.

Vignette: 10-25% at the corners, from about 60% of the radius, centre untouched. Past 30% it looks like a filter app, unless the look wants it (`casefile` sets 0.35 for dread).

Grain and banding: YouTube serves 8-bit (measured). Steps show on slow dark gradients, at L under 0.25 and fewer than about 20 levels across 300 px. Encoder settings do nothing: measured mean flat run 12.4 px with or without `-tune grain`, 5.3 px with noise before the encode.
- `--final` adds the look's `grain` in the encoder, at about ±(grain × 70) levels on luma. Keep grain out of the page: a full-frame noise layer costs about 175-235 ms a frame there.
- Working range: 1-3% amplitude, ±2 to ±8 of 255. Start low on a short test and raise until the bands go. Film look: 3-6%. More grain costs more bitrate.
- Check the look's `grain` in `style.json`: several have 0.02 or none. Set `grain` in `style.json` for a slow dark gradient, or avoid one: flat colour, or an L span of 0.15 or more.
- Overlays get no grain, on purpose: it would sit on someone's footage. Keep overlay fills flat.
- Fine 1 px noise can be stripped by YouTube; 1.5-2 px survives better. The encoder's grain is 1 px. Test a bad case at 3 Mbps before trusting it.

## What survives YouTube
Upload spec: 8 Mbps at 24-30 fps, 12 Mbps at 48-60 fps, 4:2:0, BT.709 (published). Delivered, measured on two videos: 1080p AVC 3.0-3.3 Mbps, VP9 and AV1 1.1-2.1 Mbps. So plan for 62-73% fewer bits than you upload, and for the 720p stream, where graphics shrink to 67%.

4:2:0 stores colour at 960x540, one sample for each 2x2 block, while luma stays sharp. BT.709 luma is 0.21 red, 0.72 green, 0.07 blue, so saturated red or blue carries almost no sharp signal.

- Carry meaning in lightness. A hue difference alone disappears.
- Coloured strokes and stems at 4 px or more, on even pixel coordinates, so they fill whole chroma blocks.
- No 1 px lines. Use 4 px rules or 8 px bars. Hairlines also shimmer in motion.
- Red or orange text: lift to L 0.65 or more, with a 2-4 px dark outline or a dark plate. Red at L 0.45 on dark is the classic failure.
- No saturated neighbours: red on blue, magenta on green, cyan on red. The bleed vibrates.
- Whole pixels at rest for text and shapes.
- Text still for at least 0.5 s before it must be read. Fast whips smear, since moving frames get fewer bits.

Dies: hairlines, sub-1.5 px grain, soft gradients, small text on busy footage, fine stripes (moire). Survives: flat fills, large shapes, luma edges of 4 px and up, text at 48 px and weight 500 and up.

Own ffmpeg steps: tag BT.709 and set the matrix, or colour shifts. Measured: untagged, #E8512F came back as (245,92,43). The engine does this; a hand-made encode needs `scale=out_color_matrix=bt709:out_range=tv`. Test by encoding at 3 Mbps and viewing at 33% size, or on a real phone at 720p.

## Looks generated
- Purple-to-blue or pink gradient ground → flat tinted neutral plus one accent, from the footage's hue.
- Glass card (blur, 10% white, 1 px white border) → solid panel at 85-92% in a tinted neutral.
- Gradient text, neon glow, shine sweep → flat colour, revealed with a mask.
- Coloured glow as a premium cue → layered shadow tinted to the ground.
- Default `0 2px 4px` black shadow → five or six tinted layers.
- Pure black, white and grey → L 0.17-0.23 and 0.95-0.97, C 0.005-0.02.
- Floating blobs, grid dots, particles → remove them; light, grain and vignette at the amounts above.

These are habits to break, not a new set of defaults: choose differently for each video and each channel.

## Examples
<example>
Brief: travel film with a teal-green grade, no brand colours.
Decisions: 8x8 k-means on a frame. Biggest cluster, a dark teal at h about 190, becomes the ground at L 0.20, C 0.015. Highest-chroma cluster is a sunlit ochre at h 75, which becomes the accent at L 0.72, C 0.13. A hue from the shot, opposite the ground.
Frame: the title card feels cut from the same film, and the ochre rule under the title picks up the light on the rocks.
</example>
<example>
Brief: a name over a snowfield, peak luminance 0.9, 4 s.
Decisions: a scrim would need alpha near 0.6 across a third of a white frame, grey and heavy. Use a plate at 92% in L 0.20 with L 0.95 ink, about 13:1, covering under 9% of the picture.
Frame: the snow stays white everywhere but the small dark block.
</example>
<example>
Brief: a one-word red warning at 72 px on a dark card.
Decisions: #E8452C text on dark is Lc 36 and red carries little luma, so it fails and smears. Put the red in a solid tag instead, 112 px tall, with L 0.95 text on it at Lc 60. Dark text there gets only Lc 38.
Frame: the red is a block that still reads as red at 720p, and the word on it stays sharp, because its edge lives in luma.
</example>
<example>
Brief: a dark opener with a slow radial light, in the `scoreboard` look.
Decisions: the look has grain 0 and the gradient spans few levels, so it would band. Raise `lift` in `PP.ground` until the light spans L 0.15, set `grain: 0.04` in `style.json`, render `--final`, re-encode a copy at 3 Mbps to check.
Frame: a smooth pool of light with soft noise, no rings around it on the phone.
</example>
