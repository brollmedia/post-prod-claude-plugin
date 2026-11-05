# Transitions and kinetic type

Read this when joining two shots or scenes, or when words move: titles, quotes, type timed to speech, captions.

Contents: cut first · frames for each · building one · match cuts · whips · mask wipes · shape transitions · which unit of type · mask reveals · word and letter timing · tracking · variable axes · type synced to speech · captions · looks generated · examples

Frames are at 30 fps (`PP.f(n)`). Curves and springs are in `motion.md`.

## Cut first
A plain cut is the default. Use a transition only for a reason you can name: a shared shape, a shared direction of motion, a sound hit, or a change of chapter or place. Cut when:
- nothing matches between the two shots;
- the beat is under about 12 frames, because the transition would be most of it;
- the same transition already ran in the last 10 s or so;
- text sits across the join. A shot change is a hard event: text should start on it or within 12 frames after, and never 9 to 11 frames before it, where it reads as a mistimed flash.

Those limits are a recommendation, not a sourced standard. Across a whole video, 3 to 5 kinds at most, each with its own job. Stock wipes and spins read as a template.

## Frames for each

| Transition | Frames | Curve | Use |
|---|---|---|---|
| Cut, match cut | 0 | | The default |
| Dip cut | 3 | darken about 40%, then cut | A soft beat with no time spent |
| Iris | 4 to 5 | `enter` | A quick round reveal onto an object |
| Blur swap | 4 to 6 | 8 px to 0 | Scene to scene in one location |
| Fade | 6 to 15 | `inOut` | Time passing. Sources say 6 to 12 and 15; shorter inside a scene |
| Whip | 8 to 10, centred on the cut | `move` | Same direction across places |
| Colour flood | 12 | `inOut` | Section change, full frame |
| Mask wipe | 12 to 20; one big image up to 30 | `enter`; `move` for the big one | Graphic to graphic, or a reveal |
| Slide or push | 20; heavier spring at give 0, 25 to 30 | `move` | Next item in a sequence |
| Zoom through | 18 | `in` going in, `enter` after, 8 to 15 px blur at peak | Into a screen, a button, a map |
| Luma matte | 45 to 90, plus 15 to 30 of padding | | Rarely; it takes real time, and the padding stops a freeze on the last frame |

## Building one
- `compose` takes an `xfade` name (`fade`, `wipeleft`, `smoothup`) on a clip, or `"type": "scene"` for an alpha scene laid over the join. An `xfade` overlaps its clips, so the total shrinks: 60 + 60 frames with a 15 frame fade is 105.
- The library `transition` scene has the cut at its exact middle. `props.duration` must equal the join's `ms` / 1000. Its 800 ms default is 24 frames; try 400 to 667 first.
- An alpha scene can only cover the join. If the picture itself has to move (whip, push, zoom through), make a full-frame scene with both clips as `<video data-pp-from>`, and move them in `frame(t)`.
- Moving a layer exposes its edge. It must extend past the frame by the travel plus any scale.
- Sound lands on the join: `{ sfx: 'whoosh', hit: cutTime, dur: .4 }`. Silence is also a choice on a match cut, where the picture does the work.

## Match cuts
Zero frames. The match lives in shape, position and direction, so build them on purpose.
- Shape and position: the circle at the end of shot A sits at the same x, y and size as the circle that starts shot B. Render `still` either side of the join and compare the numbers, not your memory of them.
- Motion: the speed in px per frame and the direction carry across the cut. Ease nothing at the join, or the eye feels a stop.
- Graphic to footage: end a scene with its shape parked where the real object is in the next shot. Measure from a frame of the footage, and put the object's position in props. No published tolerance exists. If the shapes differ, keep position and direction and let the size change.

## Whips
- Lay both clips on one strip, side by side. Move the strip one frame width over 10 frames on `move`, with the cut at the midpoint: 5 frames before, 5 after.
- The direction is the same on both sides, and it goes the way the shot's own motion goes. The blur hides the cut; without it you see two shots sliding.
- Blur ramps 0 to peak to 0. Peak smear along the move is 50 to 100 px, so `feGaussianBlur stdDeviation="sx 0"` with sx about 15 to 29. Real blur from `--final` alone leaves visible copies at this speed, so keep the directional blur on and render with `--samples 16`.

## Mask wipes
- Hard: `clip-path: inset(0 var(--r) 0 0 round 24px)`, from fully closed to `0`. Round corners read as made, not defaulted.
- Soft: `mask-image: linear-gradient(90deg, #000 calc(var(--p)*100% - 10%), transparent calc(var(--p)*100%))`, setting `--p` each frame.
- Iris: `clip-path: circle(var(--r) at x y)`, centred on the object, not on the frame.
- Lead the edge with a bar of accent at 1.4% of width, so the wipe looks caused. Keep it at least 4 px for compression, on a 14 degree slant if straight looks stiff. The bar arrives first and leaves last. If nothing can lead, the edge alone is fine.

## Shape transitions
- A shape on screen grows to become the next frame: a dot in a chart, a card, a map pin. Run 15 to 20 frames on `move`, from its real position.
- Content inside changes early: new content fades in within the first 25% of progress. Going back, it fades out between 60 and 90%.
- Colour flood: one shape covers the frame in 12 frames, the scene swaps under it, and the shape leaves in the same direction.

## Three that carry the eye
- **Object becomes the world:** push into something on screen until it fills the frame, about 20 frames, with everything around it blurring to 15 px. The next shot lives inside it.
- **Morph:** a small shape grows into the next shot's main shape, about 110 to 880 px in 6 frames.
- **Carry across:** one element stays on screen through the cut and shrinks to about 0.6 of its size in the new shot.
A hard cut is fine on no more than a third of the joins in a graphics piece. Footage cuts are another matter.

## Which unit of type
- A sentence or two: lines through a mask. Calmest, reads fastest. A short line, speech-timed type: words.
- A title up to 8 characters: letters are an option. `PP.split(el, true)` makes inline-block spans, which breaks kerning and ligatures, so use it on large display type only, and look at the pairs.
- One technique per moment. Stagger, scale or path, not all three.

## Mask reveals
The default for titles, in place of fades. `.mask { overflow: hidden }` around each line or word, with the inner element moved `translateY(104%)` to 0 on `PP.enter` over 15 to 18 frames. Each line gets its own mask; the mask stays put and only the inner text moves.
- Tight display line heights cut descenders. Pad the mask (`padding-bottom: .15em; margin-bottom: -.15em`, start there and check g, y and p on a `still`).
- Alternatives: blur 6 to 8 px to 0 with opacity over 4 to 6 frames, no travel, words 2 frames apart. It suits calm tech looks. Or scale punch, from .7 to 1 on a spring at give .3 to .4, for a single word.

## Word and letter timing

| Unit | Step | Each unit's move | Rise |
|---|---|---|---|
| Letters, up to 8 characters | 2 to 4 frames | 10 to 12 frames | 40 px (3.7%) |
| Letters, long phrases | 1 to 2 frames | 10 to 12 frames | 40 px (3.7%) |
| Words, normal | 3 frames | 12 to 16 frames | 30 px (2.8%) or full mask |
| Words, emphatic line | 6 frames | 15 to 18 frames | full mask |
| Lines | 3 to 6 frames | 15 to 18 frames | full mask |

- Sources run from 1 frame per letter to 4; this file uses the longer steps on short titles. The whole cascade stays under 45 frames, even on a long title.
- The word that carries the sentence holds 2 to 4 frames longer and takes the one accent colour of the line.
- A full-frame hero word fills 60 to 90% of the frame width. `PP.fit` it once in `setup`.

## Tracking
Resting values first: display mixed case over 100 px at -.01 to -.03em, 48 to 80 px at 0 to +.01em, all caps +.04 to +.10em, condensed heavy (Anton) 0 to +.02em. `--pp-dt` holds the look's value.
Animated tracking has no published numbers. Start at no more than .05em of change over 20 to 30 frames, on slow title reveals, closing toward the resting value on `glide`. Anchor the text at one edge, or both ends will crawl. Check it on `--final`, since drafts show stepped glyphs.

## Variable axes
Animate one axis at a time. Start at weight 400 to 800 over 12 to 20 frames (no published numbers; tune by eye).
- Bundled axes: Archivo wght 100-900, wdth 62-125. Bricolage Grotesque wght 200-800, wdth 75-100, opsz 12-96. Fraunces wght 100-900, opsz 9-144, SOFT 0-100, WONK 0-1. Newsreader wght 200-800, opsz 6-72. Figtree 300-900, Hanken Grotesk and Public Sans 100-900, Oswald 200-700, Instrument Sans 400-700, all wght only.
- No axes, so nothing to animate: Anton, IBM Plex Mono, Instrument Serif, Special Elite, Young Serif. Never fake it with a stroke.
- `font-variation-settings` replaces the whole value, so repeat any axes the look sets in `--pp-dv`. Weight changes width. Run `PP.fit` at the heaviest value so the line never reflows, and keep the word in its own span.
- A useful move: one word gains weight as it is spoken, while the line stays put. Fraunces at `"opsz" 144` gives a tighter, higher contrast cut for big titles.

## Type synced to speech
Claude cannot hear, so sync comes from word timings, never from guessing. With no timings, say so and ask for a transcript.
- Frame = word start × 30. Pass the words in `PP.props`.
- The word should land on its first stressed syllable. Start 2 to 4 frames before the sound: a 9 frame `enter` move starts at -3 and is 90% there at the onset.
- Do not animate every word of fast speech. Above 3 words a second, show chunks of 1 to 3 words, and let the emphasis word alone arrive by itself.
- A chunk breaks where the speaker breathes, or at punctuation. Keep at least 10 frames per chunk.

## Captions
- Words on screen at once: 2 or 3 for fast speech, 3 to 5 normally, 4 to 6 for calm speech. A caption starts 0.1 to 0.3 s into its words and is gone before the next line needs reading.
- Text behind a speaker: cut the person out (a mask or matte from the footage), put the type between them and the background, and let them cover 30 to 55% of a large word so it still reads. Test it on the frame where they move most.
- Blending a caption into the picture: read the brightness behind it. Under 60 of 255, use screen; 60 to 180, overlay; over 180, normal. Check it stays readable.
Start from the library `subtitles` scene: it takes `words` (`{ w, start, end }`), `text` for punctuation, and `chunk_max_words`.
- Size 60 to 70 px (5.6 to 6.5%), weight 500 or more, line height 1.2 to 1.3. The floor is 48 px on 1080p (4.4%).
- At most 42 characters a line, 2 lines, 20 characters a second. Short lines on top, and no line ending on an article or a lone first name.
- A full subtitle lasts at least 25 frames, with a 2 frame gap before the next. Word-by-word: 1 to 3 words a beat, at least 10 frames. The sentence-length minimum does not apply.
- Position in 16:9: bottom edge above 82% of the height, clear of the player bar. A lower third then sits above it, or captions move up; decide once per video. In 9:16 (1080 × 1920): inside x 108 to 888, y 288 to 1248. Sources differ, so check it in the app.
- Captions stay still. The one change is the current word turning accent, from its start until the next word starts. Opacity in over 2 to 3 frames clears `POPS_IN` (start value).
- On footage, `check` tests both bright and dark. Give them a 3-stop scrim (.70, .45, 0 over the bottom 30 to 40%) or `-webkit-text-stroke: 3px` with `paint-order: stroke fill`.

## Looks generated → instead
- A transition on every join → cut. Save it for a reason named above.
- Every letter fading up in turn → line mask, or words at 3 frames.
- Bouncing captions on every word → still captions, one accent on the current word.
- Gradient text, a shine sweep or a typewriter cursor → flat colour, revealed by a mask.
- Spin or zoom pack transitions → a whip with matched direction, or a dip cut.
- Three styles of kinetic type in one video → one system, with one change at the climax.

These are defaults, not laws. If the video has a reason, break one, and do not reuse the same reveal twice in a row.

## Worked examples

<example>
Brief: "add transitions" to an 8 minute talking-head tutorial with 60 cuts and 4 chapters.
Decisions: all jump cuts stay hard. Each of the 4 chapter changes gets one wipe: accent bar leading a panel, 14 frames on `enter`, then the chapter title rising through a mask at 15 frames, held 2 s. The whoosh `hit` sits at the panel's cover point.
Frame and sound: the talk feels uninterrupted, and each chapter change arrives as one clear event a viewer could point at.
</example>
<example>
Brief: travel vlog, a push through a train window in Tokyo to a street in Lisbon.
Decisions: a strip of both clips moves left one frame width over 10 frames on `move`, since the train also moves left. Directional blur peaks at sx 20 on the middle frames, and the render uses `--samples 16`. A whoosh `dir` leftward, `hit` on frame 5.
Frame: the window smears into a streak and resolves as a tram moving the same way, with no visible join.
</example>
<example>
Brief: explainer, a chart's peak becomes the next scene about that month.
Decisions: the peak dot, 24 px (2.2%), scales from its real position to cover the frame over 18 frames on `move`, using the log-scale ramp. The new scene's headline fades in during the first 25% of the move, inside the shape, then lands through a mask at frame 20.
Frame: the viewer's eye is already on the dot, so it travels into the new subject and never has to search.
</example>
<example>
Brief: pull quote in a podcast clip, 11 words, spoken in 4 s, with "never" the key word.
Decisions: three chunks broken at the speaker's pauses, each word 12 frames through a mask, starting 3 frames before its onset from the timings. "Never" takes the accent, gains weight from 500 to 800 in Fraunces over 14 frames, and holds 3 frames extra. The whole quote then stays up until 4.2 s after the first landing.
Frame: words arrive with the voice, the line builds, and one word swells on the stress while the others rest.
</example>
<example>
Brief: captions for a 9:16 fitness Short, fast speech.
Decisions: `subtitles` with `chunk_max_words` 3, 66 px Archivo at weight 700, bottom edge at y 1248, stroke 3 px. Chunks last at least 10 frames. The current word turns accent; the chunk fades in over 2 frames with no travel.
Frame: captions sit clear of the app's buttons, the eye reads a steady block, and the colour walks along it with the voice.
</example>
