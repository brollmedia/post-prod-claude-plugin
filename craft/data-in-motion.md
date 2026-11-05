# Data in motion
Read this when a graphic shows a number, chart, counter, map or diagram: how to stage it so the viewer follows the change and reads the true value.

Contents: Order of change · Same mark, same thing · Timing · Keeping the eye · Honest scales · Bars and lines · Counters · Maps · Diagrams · Looks generated · Examples

Frames are at 30 fps; px are at 1080p with % of frame height (H) beside them. Use `PP.f(n)` for frames. Values are practitioner starting points, tune by eye, unless a study is named. Start from `data-chart`, `counter`, `stat-reveal`, `map-route` or `diagram`. Numbers you were not given are placeholders: say so in the hand-over.

## Order of change
Motion grabs attention, so a chart that moves two things has two stories. Heer and Robertson (2007) tested this: animation beat a cut for tracking and for estimating change, and staged animation was preferred to plain.
- One change at a time: the axis moves, or the values move, or the camera moves. Keep the frame still while data moves. Move the camera only between data moves.
- If the scale must change, make it its own stage. Rescale first over 18 to 30 f, let it settle, then move the values over 24 to 36 f. Rescaling during a value change raised error in every animated condition of that study.
- Keep stages near 1 s (30 f). The study advises against 0.5 s stages.
- Do not stage for its own sake. Many small steps (stacked bars, donuts) raised error too. Split axis from values, then stop.
- Reading order inside a shot: title, then the change, then the takeaway label.
- End on a still frame the viewer can study. Break continuous change into steps with holds between them.
- Animate between two graphics only when they share a data dimension: filtering, sorting or switching a measure in one dataset. For unrelated datasets, cut or dissolve. A morph between them implies a link that is not there.

## Same mark, same thing
- Key every mark by a stable id, never an array index. Index keys send a bar to the wrong entity after a sort.
- Same entity keeps its element, colour, label and anchor through every state and across scenes.
- Updating marks move and resize. New marks fade in over 9 to 15 f. Leaving marks fade out. Nothing flies in from off screen.
- In `frame(t)`, hold each state as a `Map` of id to values, find the two states around `t`, and lerp per id with `PP.ease.move`.
- Labels are children of their marks, so they travel with them. A label left behind breaks the link.
- Tracking gets worse as more marks move at once. Past 5 or 6 bars in a frame, group, cut the list or show the top few.

## Timing
| Move | Frames | Curve |
|---|---|---|
| Element enter or fade | 9 to 15 | `PP.enter` |
| Bar growth | 18 to 30 | `PP.ease.enter`, or `PP.ease.move` when several bars grow together |
| Bar reorder | 24 to 36 | `PP.ease.move` |
| Line draw | 45 to 90 | `PP.ease.inOut`, head dot and label travelling with it |
| Whole chart to chart | 30 to 60 | staged as above |
| Mark stagger | 1 to 3 apart | `PP.stagger(i, n, 0.06, 0.5)`: past 15 f in total it reads as a slow wipe |

Time on screen: move time, plus the reading hold, plus 1 s to look at the picture. The reading hold is `max(1.5 s, 0.5 s + words / 3)`. That is what `check` enforces as NOT_ENOUGH_READ_TIME; it is slower than the 4 words a second of silent reading, because a viewer reads a moving picture while listening.
- 8 words: 3.2 s hold, 4.2 s with the look, about 5 s with the build.
- 20 words: over 8 s. A chart shot usually lives in 3 to 8 s, so cut the words before stretching the shot.
- Final state: at least 1.5 s for one number or a simple chart, more for several series.
- If the voice says the number, land the number as the voice reaches it. Change the picture when the idea changes, not on a timer.

## Keeping the eye
- Dim everything that is not the subject to 25 to 40% opacity. Dim, do not hide: the context is why the highlight means something.
- Fire a small ring or arrow 6 f before the change, so the eye is already there.
- One accent on the one mark that matters. Everything else is a mid tint of the ink. Beyond 3 series, vary lightness in one hue.
- Put labels directly on or beside marks: value at the bar's end, series name at the line's end. A legend sends the eye away and back for every read.
- Label floor is 48 px (4.4% H), the TOO_SMALL line in `check`, ticks included. Sources allowing 32 px labels and 24 px ticks lose to the phone. So use few ticks, or none when each mark carries its value.
- Keep text in the DOM or SVG over the chart, not drawn into canvas: `check` measures only DOM text.
- Data marks against the ground need Lc 45 or better (3:1); labels Lc 75. Gridlines 2 px (0.2% H) or more at 20 to 25% opacity, or none. A 1 px line flickers after compression.
- No handheld noise, no drift on a chart. A slow push over the hold is fine once data has stopped.

## Honest scales
Accuracy of reading, best to worst (Cleveland and McGill): position on a shared scale, position on separate scales, length, angle and slope, area, volume and saturation, hue. If the value matters, use position or length.
- Bars start at zero. A clipped baseline exaggerates the gap. A line may start above zero if the axis is labelled.
- To scale always. A tiny bar's smallness is often the point. Below 6 px (0.6% H) it vanishes in compression, so stop there and print its value.
- Bubbles scale by area, not radius. Prefer bars when the viewer must compare.
- No 3D pies: perspective bends angle and area, already weak encodings. A flat labelled donut holds at most 4 to 5 slices.
- No dual axes. No silent switch from cumulative to rate. A log axis says "log scale" on screen.
- Do not grow the axis range while holding the bars still: they appear to shrink, which reads as a data change.
- Show the source line at 48 px when the number is a claim. Do not invent one.

## What never gets overshoot
Overshoot says the value went past the truth. Bars, lines, points, slices, axes, counters and value fills land dead on: `PP.spring` with give 0, or a curve that ends at rest. A sloppy spring on a bar is the most common error here.
May overshoot, because they carry no value: a map pin, a label's badge, the word-based payoff such as "4×". Use `PP.spring(t, a, 0.4, 0.3)`, about 5% over.

## Bars and lines
- Bars grow from the zero baseline along the value axis: `transform-origin` at the base, never the centre. Set bar size so the end state is exact, then scale from 0 to 1.
- Bar thickness 24 px (2.2% H) or more; gap 0.4 to 0.6 of the bar.
- Sorted bars: order first, or value first, not both at once.
- Line stroke 6 to 8 px (0.6 to 0.7% H), points 16 to 24 px (1.5 to 2.2% H). A 2 px line dies on a phone.
- Draw lines with `pathLength="1"` and `stroke-dashoffset`. Put the head dot at `getPointAtLength` from the same eased progress, so dot and line cannot part.

## Counters
Tabular cells keep a number still while it climbs, but a narrow 1 left in a wide cell is a hole at the hold. Close the cells as it lands: `PP.digits` gives `set(text, rest)`, with rest going 0 to 1 over about 8 frames after the landing.
- Count on an ease-out so the last digits can be read. A linear count reads as a loading bar. `PP.ease.out`, `outExpo`, or `PP.bezier(.35,0,.12,1)` as in `stat-reveal`.
- 24 to 45 f for a stat, up to 60 f for a very large jump. Start 6 to 12 f after the card lands. Hold 45 f or more after it settles.
- `PP.digits(el)` in `setup`, so digits never shift. Fix decimals from the first frame to the final value's: `PP.num(v, 1)`. Round only when drawing.
- For a huge range, count the ratio, not the difference: `from * (to / from) ** p`. Use a short form (1.2M) with the unit fixed from frame one.
- If the last digit changes every frame, drop it during the count and restore it at landing.
- `--final` averages 8 moments per frame, so a racing number turns to mush. Feed the count a frame-locked time, `Math.round(t * 30) / 30`, and every frame shows one clean number.
- A bar with the count shares one progress value, so the eye reads one thing.
- Sound: `rollup` with `dur` equal to the count and `hit` on the landing, then `impact` on the same time.

## Maps
- Muted land on water a clear step lighter or darker, thin coast, one typeface. Land shadow offset 2 to 4 px, blur 6 to 12 px (0.2 to 0.4%, 0.6 to 1.1% H).
- Highlight regions at 60 to 80% fill and mute the rest. Outline draws first, fill follows 9 f later.
- Camera: wide to region over 60 to 90 f on `PP.ease.camera`, tilt 0 to 20°, then a 3 to 6% push through the hold. Place the first label before the camera lands, so it is read as the frame settles. All labels 48 px or more.
- Routes draw at 45 to 90 f per leg, 15 to 30% of frame width per second, with a dot at the head. The trace stays.
- Pin: spring as above, label 3 to 6 f later, leader line 9 f.
- `map-route` is Mercator on Natural Earth 1:110m. Fine for a route, wrong for comparing areas, and coarse below country scale. Say so if the job needs more; do not fake detail.

## Pointing at something in a picture
Don't guess where it is: guesses land 16 to 24% of the frame away. Cut a 9x9 grid over the frame, find the cell, crop it and look again. That lands within about 2%.

## Diagrams
- Build in the order of the narration: node, then connector drawn along its path over 12 to 24 f, then label once the node lands. Stagger 2 to 5 f.
- Fixed layout through every step. New nodes appear in place; re-flowing destroys the viewer's map.
- Highlight by colour and scale 1.05 to 1.1, others at 30 to 40%. Scale here is a state, not a bounce.
- At most 7 new items in view. Chunk the rest into a group that opens later.

## Looks generated → instead
- Every bar springing up at once with a bounce → staggered 1 to 3 f, `PP.spring` give 0, dead-on landing.
- Legend box in a corner → label on the mark, 48 px, in the mark's colour.
- Linear count to the number → ease-out, tabular cells from `PP.digits`, 45 f hold.
- Axis and values moving together → axis stage, settle, values stage.
- Gradient bars with a glow → flat fill, one accent, the rest neutral.
- Thin 2 px line with tiny ticks → 6 to 8 px line, end label, no ticks.
- Chart spinning or tilting in fake 3D → flat, still, with a 3 to 6% push on the hold.
- Decorative confetti on a stat → nothing behind it.
- Fade in the whole chart → grow marks from the baseline in reading order.

These replacements are defaults, not a formula: vary the layout, order and accent choice to fit the story, and if every chart you make looks the same, change the structure first.

## Examples
<example>
Brief: top 5 categories swap places over four years.
Decisions: 5 bars, 44 px thick (4.1% H), value at each bar's end, name at left, keyed by category id. Each year: year label steps, bars reorder over 30 f on `PP.ease.move`, 20 f hold. When one bar would pass the axis max, the sequence stops, the axis rescales over 24 f, and only then do values move on.
Frame: the climbing bar is the accent, the others a neutral tint at 60%, so one line of the story is easy to follow while four others stay readable.
</example>
<example>
Brief: an overlay stat on a talking head, "from 12,400 to 310,000".
Decisions: lower-left, hero number 216 px (20% H), 48 px label. Labels land at 8 f; hold 6 f so the starting value registers; count over 45 f by ratio, not difference, so the small early digits are visible. Frame-locked count, 45 f hold, then `PP.ease.exit` out in 12 f.
Frame: the number lands still on the word "subscribers", with `rollup` under it and `impact` on the landing.
</example>
<example>
Brief: a line chart where one event changes the trend.
Decisions: 7 px line, draw to the event over 60 f on `PP.ease.inOut`, head dot and running value riding it. Stop. Ring on the point 6 f before a 2 px dashed event marker draws. 30 f hold. Line continues in the accent over 45 f; earlier segment drops to 35%.
Frame: two states of one line, with the turn sitting where the eye already waits. Y axis starts above zero and says so.
</example>
<example>
Brief: a shipment's route across two continents, narrated in three beats.
Decisions: wide map, camera 75 f onto the origin, first label before landing. Leg one 60 f by road at about 20% of width per second; pin springs at the stop, label 4 f later. Camera moves only when the line is resting; day counter runs with the line and lands dead on.
Frame: at any moment one thing moves. Trace stays, older stops dim to 40%, so the last frame works as a summary.
</example>
<example>
Brief: explain a four-step pipeline.
Decisions: four nodes in one row, fixed from the start as 30% outlines so the viewer sees the size of the job. Each step: node fills, scales to 1.08, connector draws in 18 f, 48 px label lands 3 f after. Prior nodes settle to 40%.
Frame: the layout never reflows. At the end all four rise to full, a still picture of the whole system, held 2 s.
</example>
