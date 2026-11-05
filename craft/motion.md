# Motion

Read this when anything in a scene moves: choosing curves, durations, springs, stagger, holds or blur.

Contents: units · easing by role · timing · spacing · in and out · springs · overshoot, anticipation, follow-through · stagger · staging · holds · the 12 principles · motion blur · looks generated · examples

## Units
Frames are at 30 fps; 1 frame is 33 ms. Write them as `PP.f(n)` so the look's pace scales the whole scene. Pixels are at 1080p, with % of frame height beside them. `PP.p` does not scale by pace, so pass it times built from `PP.f`. Under 1 frame a stagger cannot be seen.

## Easing by role
The columns show how far through the duration the move reaches 50% and 90% of its travel. A small number means it gets there early, then settles.

| Role | Kit name | Curve | 50% at | 90% at |
|---|---|---|---|---|
| Most entrances | `PP.enter` / `enter` | .16,1,.3,1 | .10 | .33 |
| Small items, fast looks | `snap` | .23,1,.32,1 | .13 | .36 |
| Calm titles, documentary | `glide` | .25,.1,.1,1 | .24 | .57 |
| Already on screen, going elsewhere | `move` | .77,0,.175,1 | .48 | .66 |
| Camera push, pan, whole-frame move | `camera` | .45,0,.15,1 | .35 | .62 |
| Leaving | `exit` | .3,0,.8,.15 | .81 | .98 |
| Constant motion: rotation, progress, ticker | `linear` | | .50 | .90 |

- `PP.p` defaults to cubic out and `PP.io` to 0.35 s out on `ease.in`. Pass your own curve and lengths every time. Use `PP.enter` for entrances so the look chooses between `enter`, `snap` and `glide`.
- A zoom on a straight scale ramp looks like it slows down. Make it even: `Math.exp(PP.lerp(Math.log(a), Math.log(b), p))`.
- Opacity finishes well before position: 4 to 6 frames inside a 15 frame move. It takes no spring and no overshoot.
- Custom curves from After Effects habits: `PP.bezier(out, 0, 1 - in, 1)`, where out and in are velocity influence as fractions. Easy Ease (33/33) is `.33,0,.67,1`: 90% at .81, floaty. 80/80 is `.8,0,.2,1`: hold, snap, hold. An entrance wants low out and high in: `.1,0,.2,1` reaches 50% at .24.

## Timing by size and distance

| Tier | Examples | Frames | Travel at 1080p |
|---|---|---|---|
| Micro | press, tick, highlight flash | 3 to 5 | scale .97 (range .95 to .98) |
| Small | label, tag, icon, list row | 6 to 9 | 8 to 12 px (0.7 to 1.1%) |
| Main | title, card, lower third name | 12 to 20 | 30 to 60 px (2.8 to 5.6%) |
| Large | full-frame slide, push, wipe | 20 to 30 | up to the frame |

- UI ceilings (300 ms) do not apply. A viewer did not cause this move and the frame is larger, so a main move runs 400 to 670 ms. Over 700 ms on a small item drags.
- Sources cap text entrances at 0.4 s. This file uses 12 to 20 frames because `enter` is 90% there by a third of its length: an 18 frame move reads as arrived at frame 6, and the rest is settle.
- Cap one move at 30 frames; camera drift and counters run longer. Larger or farther means longer, but no one publishes the slope, so pick a tier and tune by eye. Duration is character. The same move at 10 frames is light and at 30 frames is heavy, so set it from the look's `PP.motion.character`.

## Spacing
Spacing is the gap between positions on neighbouring frames. A 60 px rise (5.6%) on `enter` over 15 frames covers 54 px by frame 5, then 6 px over the last 10. That tail is the premium feel; cut the duration and it goes.
Start states: opacity 0 plus scale .9 to .97 or a rise. Never scale from 0, since the first frames are a dot. A big title may start at scale .7 with a 60 px rise. Set the transform origin at the edge or object a thing comes from, not its centre.

## Entrances and exits
- Exit = 0.5 to 0.8 × entrance (sources run 0.5 to 0.83). A 15 frame entrance leaves in 8 to 12.
- Exits accelerate (`exit`), run in one piece with no reverse stagger, and travel less than the entrance: about 26 px (2.4%) for a block. Overlays are gone before the last frame (`NO_EXIT`).
- What arrived first may leave last, by up to 5 frames, if the group is built on it (a lower third's bar).

## Springs
`PP.spring(t, a, dur, give)`: `dur` is about the seconds to settle within 1%, `give` sets overshoot. Measured:

| give | Overshoot | Use |
|---|---|---|
| 0 | 0% | anything calm; cards, titles |
| 0.15 | 0.6% | barely felt, serious looks |
| 0.2 | 1.5% | the kit's default; lively looks |
| 0.3 | 4.6% | visible, energetic looks |
| 0.4 | 9.5% | one hero per scene, at most |

- `dur` .35 settles in 11 frames, .45 in 14, .6 in 18, and 90% comes at about a third of that. Use `dur` .35 to .6.
- A spring needs travel to show. `0.92 + 0.08 * s` at give .3 overshoots by 0.4% of scale, which is invisible and fine for a soft landing.
- Position and scale only. Never on opacity, colour, or data: bars, chart values and counters land dead on, because overshoot there states a false number.

## Overshoot, anticipation, follow-through
- Overshoot is a share of travel, so distance changes it. 4.6% on 60 px is 3 px; on 1,200 px it is 55 px. Long travels get less give. A scale pop is a different thing: 100 to 110 to 100%, with an optional second bounce about a quarter of the first. Keep it to the one payoff.
- Anticipation: hero only, a pre-move against the direction. Start at 3 to 6% of travel over 3 to 5 frames and tune by eye. On support items it reads as a wobble.
- Follow-through: parts arrive after the body. Text lands 2 to 5 frames behind its card. A held element's children stop later than it does.
- Idle drift, if used: ±4 to 6 px, noise input frame × .01 to .02, never above .05. Rotation ±2 to 3 degrees on shapes only. Stay under 0.7 px per frame or `check` counts it as moving.

## Stagger
- Same kind of item: 2 to 4 frames each via `PP.stagger(i, n, PP.f(3), PP.f(15))`. It closes the gaps as it goes, which reads less mechanical than equal steps.
- Different tiers: support starts 3 to 8 frames after the lead, so about 30 to 50% through the lead's move. Sources run from 80 ms to 50% of the move; pick the low end for fast looks.
- Whole window: at most 15 frames for four or more list items, 45 frames for anything.
- Item duration at least 3 × the step, so items overlap. On a long list, stagger the first 4 or 5 and bring the rest with the last one.
- Build order: container, content, data, the action, charts last. One entrance per container; do not stagger a parent and its children.
- Three text blocks on one frame fails `ALL_AT_ONCE`, and equal durations across three fails `EQUAL_TIMING`. Repeated items (captions, a ticker) get no stagger.

## Staging and hierarchy of moves
- One hero move per scene: the largest distance and the longest duration.
- Support moves travel 50 to 70% of the hero and differ in duration by 10 to 30%. The background stays still or very slow.
- Write a cue sheet once, as the library scenes do: `const T = { bar: F(4), plate: F(7), name: F(10) }`. More than two items sharing a start or a duration, or one curve on everything, means it is not done.

## Holds and read time
- Text hold = max(1.5 s, 0.5 s + words / 3), counted from the first words landing. Sources give 0.3 to 0.35 s per word; this file and `check` use 3 words a second. 6 words: 75 frames. 12 words: 135 frames. The last line of a sequence holds at least 2 s.
- Lower third: 3 to 6 s hold, 1 to 2 s of motion in and out together. Past 8 s it overstays.
- Counter: 0.8 to 1.5 s climb on a slow-settling curve (`PP.bezier(.35,0,.12,1)`), the real value on the first frame of the hold, then at least 1 s held.
- Landed type stays dead still, on whole pixels. Motion on the ground is fine; drift on text fights reading and shimmers on slow sub-pixel moves. Check slow moves on `--final`, since drafts show stepped text.

## The 12 principles for graphics

| Principle | In a scene |
|---|---|
| Squash and stretch | Area stays: scaleY 1.10 means scaleX .91. Presses and pops only |
| Anticipation, exaggeration | Hero pre-move; overshoot on one hero, up to 9.5% |
| Staging, appeal | One lead in motion at a time; hierarchy, restraint, a quiet state in every scene |
| Straight ahead, pose to pose | Pose to pose by default: cue sheet, then curves. Straight ahead is `PP.noise` for particles |
| Follow-through, overlap, secondary action | Children land 2 to 5 frames late; a shadow, ring or tick answers the main move |
| Slow in and out, timing | Asymmetric curves, never `.33,0,.67,1` everywhere; 10 frames light, 30 frames heavy |
| Arcs | Bend any travel past about a quarter of the frame: add a sine offset on the other axis (start value, by eye) |
| Solid drawing | One light, one perspective, one shadow direction |

## Motion blur
- `--final` adds it: 180° shutter, 8 sub-frames, centred. Drafts and `still` are sharp, so judge speed on a draft and blur on a final.
- Smear in px = px per frame × 0.5. A 1,920 px move in 8 frames is 240 px per frame, so 120 px of smear.
- Sub-frames needed: smear / 2 for hard edges, smear / 4 for text and soft shapes. The default 8 is clean to 16 px on hard edges and 32 px on text. Past that you see stepped copies. `--samples 16` fixes that and doubles the render time.
- For a straight slide, a cheaper fix is a directional blur in the scene: SVG `feGaussianBlur stdDeviation="sx 0"`, with sx = .29 × smear. Peak 6 to 12 on text, 15 to 20 on a full frame, back to 0 at rest. Spins and zooms need real sub-frames.
- Below about 2 px per frame blur adds nothing (rule of thumb). Fine detail in small moves goes soft, so keep small things slow. Blur plus glow goes muddy. Pick one. `--shutter 90` looks staccato, 360 dreamy. Stay at 180 unless the look asks.

## Looks generated → instead
- Everything fades up 20 px on a timer → one hero move, quiet supports, and a quiet state.
- Fade only → add a rise of 8 to 60 px by tier, or scale from .9 to .97.
- Same duration, curve and gap on everything → the tiers above, `PP.stagger`, and travel varied 10 to 30% between tiers.
- Easy Ease or linear on a move → `enter` in, `exit` out. `check` calls linear `LINEAR_MOVE`.
- Ease-in on an entrance → it lands at top speed (`ACCELERATES_IN`). Use `enter`.
- Everything bounces → give 0 on support; give up to .4 on one hero.
- A count-up on every number → count only when the climb is the story. Otherwise the number lands whole through a mask.
- Typewriter headline → line mask reveal. Type-on only where the look calls for it.
- A blurred glowing blob behind the focus → remove it.
- Nothing ever rests → settle, then still (`NOTHING_RESTS`).

Every one of these has a good use somewhere. Choose from what this video needs, and let two scenes in a row differ in lead move, direction or tempo, so none of the fixes turns into the new default.

## Worked examples

<example>
Brief: a business explainer shows subscribers going from a small to a large number (placeholders until the person gives them).
Decisions: the number and bars are data, so give 0. Label at frame 4, hero through its mask at 8, bars at 14, each with its own start. Hold 16 frames on the start value so it registers. Count from frame 30 for 48 frames on `.35,0,.12,1`; the bar shares that curve. 7 frames after landing, the "7×" payoff springs at give .3, dur .45, because it is words, not data.
Frame: the digits slow into the last places so they can be read, the bar stops dead on its value, and only the 7× has life.
</example>
<example>
Brief: lower third for a street-food interview, over footage, 5 s.
Decisions: 10 px bar scales up at frame 4 over 9 frames. Plate opens from it at 7 over 15. Name (76 px, 7%) rises at 10 over 16, the longest move. Role (48 px, 4.4%) at 13 over 12. Out at frame 134 in 9 frames on `exit`, 0.6 of the plate's entrance; the bar goes 5 frames later.
Frame: the plate seems to come out of the bar, four starts and no two the same, then 3.5 s of total stillness with the name readable.
</example>
<example>
Brief: date title in a slow true-crime documentary.
Decisions: `glide`, give 0. A 5 word line rises through a mask over 24 frames, with the place 6 frames behind over 18. The ground pushes 1 to 1.04 over 6 s (0.7% a second, well under a visible zoom). Type stays still for 2.5 s, then fades out over 12 frames with no travel.
Frame: heavy and quiet, with the paper slowly closing in while the words do not move at all.
</example>
<example>
Brief: five patch changes in a gaming video, the third the big one, 20 words in all.
Decisions: rows rise 30 px (2.8%) over 12 frames at `PP.stagger(i, 5, PP.f(3), PP.f(15))`: starts at 0, 3, 6, 8, 10. Row three takes 16 frames and 39 px, and its accent bar scales in 4 frames after it lands. All rows hold 7.2 s, then leave together in 8 frames.
Frame: a quick downward ripple with one row visibly weightier, so the eye knows where to go before it has read a word.
</example>
<example>
Brief: 3 s logo sting at the end of a tech review.
Decisions: the mark dips 15 px (5% of a 300 px rise, 1.4%) over 4 frames, then springs up at give .4, dur .6: 28 px past, settled in 18 frames, on a slight arc. Its shadow tightens as it lands. The wordmark starts 7 frames in through a mask at give 0. Peak speed is about 52 px per frame, so 26 px of smear on hard edges: render with `--samples 16`.
Frame: one confident jump with a soft landing, while everything around it stays disciplined.
</example>
