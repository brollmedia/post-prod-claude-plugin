# Genres
Read this when writing a look, deciding what deserves a graphic, or taking the accent from a video.

- What deserves a graphic | The accent | Evidence on retention
- Writing a look
- Stock looks, for when someone names one: documentary, newsroom, impact, scoreboard, studio, maker, casefile, classroom, poster, blueprint, gallery, riso
- Shorts | Looks generated | Worked examples

## What deserves a graphic
Run this in order for every candidate moment. Stop at the first answer.
1. Is the viewer told a place, number, comparison, process or name they can't easily hold in their head? If yes, it may earn a graphic. Go on.
2. Can the real thing be shown instead (the document, the screen, the footage)? Show it and annotate lightly.
3. Is the picture static for longer than the idea needs? Write picture beside narration in two columns. A long run with nothing opposite needs a change of image, which may be a cut, not an animation.
4. Does it only emphasise what is already obvious? Cut it, or make it smaller.
5. Would it stop the viewer reading the face or the footage? Move or shrink it.

Then pick the metaphor before drawing anything, and time to the recorded voice, not to the clock. Each moving thing says what the voice is saying at that moment. The harder the content, the flatter and simpler the graphic.

## Writing a look
Work down this list and stop at the first that exists: what the person specified, their brand, a reference they gave, the subject's own world.
For the world, answer three questions, then turn each into numbers. What era is it from? What is it made of? Where would it be shown? A rule of thumb that fails: picking by genre. "Travel" gives every travel film the same look. "A London-to-Istanbul ride" gives road dust, ferry steel and Iznik tile.

This is the shape of `look.json`:
```json
{ "source": "world",
  "world": "Road dust to Iznik tile, an old touring map, seen on a living-room TV",
  "colours": { "ink": "#F4F1E8", "paper": "#0F4C5C", "accent": "#E8603C", "accent2": "#D8B26E", "muted": "#9DB7B8" },
  "fonts": { "display": "Young Serif", "body": "Figtree", "mono": "IBM Plex Mono" },
  "typeset": { "display_weight": 400, "display_tracking": "-0.01em", "display_case": "none", "body_weight": 600, "body_tracking": "0" },
  "pace": 1.15, "grain": 0.05, "vignette": 0.2,
  "motion": { "character": "patient, a slow drift, things settle", "enter": "glide", "give": 0, "stagger_frames": 5, "main_frames": 22 },
  "sound": "wind and a low chord, one soft hit on the title" }
```
The ground is often the decision that makes it this film and not another. Write three grounds that are true of this subject and take the least expected: dark, cream and forest green are where a model lands first. Name its material too: how a riso print slips 3 px, how chalk breaks up.

Grounds to reach past the first idea, by what the world is made of. Take the idea, not the hex:
| World | Grounds |
|---|---|
| Road, travel, maps | route-sign blue, tarmac grey, atlas sea, faded pass stamp, dusty ochre |
| Money, business | ledger paper, banknote mauve, receipt white, terminal amber on black |
| Food, home | tomato tin red, enamel white, oat, butter, plum |
| Tech, engineering | safety orange, cable yellow, oscilloscope green on black, drafting-film blue |
| Nature, science | lichen, peat, glacier grey, kelp, sodium-lamp orange |
| Sport, games | astroturf, clay court, gym-floor maple, chalk-line white, arcade magenta |
| History, crime | carbon-copy blue, foxed page, manila, bruise purple, redaction black |
| Music, comedy | cassette-label pink, fluoro yellow, sleeve teal, stage-gel red |
Two films in a row in dark green or near-black means you have stopped looking at the subject. Ink needs 7:1 on it, accent 3:1. Fonts come from the list in `animate.mjs looks`, or the person's own files in `reference/fonts`. Mono for code, not for seeming technical.

## Evidence on retention
There is no public evidence that graphics lift retention, at any frequency. No study shows it. YouTube's help only defines dips and spikes. "Pattern interrupt" advice runs from every 4-6 s to every 60-90 s, and none of it cites data. So never promise a lift, and never set a per-minute graphic quota.

What is measured sits elsewhere: in lab studies of comprehension and recall, cues that guide attention have small to moderate effects (d = .31 for colour contrast, .41 for combined cues), and irrelevant animation adds load. Justify a graphic by what the viewer understands.

## The accent
When there is footage, take the accent from the video.
1. Pull the frame the graphic sits on, plus the thumbnail if there is one: `ffmpeg -ss 12 -i cut.mp4 -frames:v 1 -vf scale=8:8:flags=area -f rawvideo -pix_fmt rgb24 frame.rgb` gives 64 RGB colours.
2. Most common colour: the neutral. Pull its chroma to C .01-.02 and use it to tint the paper and shadows.
3. Most saturated colour with L .5-.85: the accent hue. Prefer the object the story is about (the product, the kit, the logo), so check it by eye on the frame.
4. Keep the hue, set L .65-.75 and C .12-.20, and write it to `colours.accent` in `style.json`.
5. Never use a skin or sky tone for text. Those are for tints only.
6. Run `check`: LOW_CONTRAST tests overlays on bright and dark footage. The accent stays under 10-15% of the area, or it stops meaning anything.

## The looks
`new <scene> <folder> --look <name>`. Times are the look's own: read `PP.motion.main_frames` through `PP.f()`, which applies the pace. A number without a source below is marked "start at".

### documentary (travel, history, long stories)
- Tokens: Instrument Serif + Instrument Sans, warm paper #121714, amber accent; pace 1.2, glide, give 0, 24 f main, 5 f stagger, grain .05, vignette .28.
- Pick when the video should feel like a film and places or dates carry it.
- Practice: strip a map of every label the story doesn't need, mute the water, put the one accent on the focus. Graphics are real places and dates. Title cards stay 60-75% empty.
- Pace: start at a new image every 4-8 s, on idea boundaries. Every stop holds long enough to read, and a slow push keeps a still alive.
- Moves: wide to country to city, a slight pitch-down in the hold, the label anchored to the place so both move as one, the highlight fading as the camera leaves. `map-route` is the base.
- Sound: `pad` low and warm, a slow `swell` into the title, one soft `impact`. No ticks.
- Not templated: draw the route the story took and take the map colours from the footage's grade. Don't hold the same zoom at every stop.

### newsroom (explainers, investigations, business, politics)
- Tokens: Newsreader + Public Sans, cool newsprint #E1E7ED, red accent, yellow highlighter; pace 1, snap, give 0, 16 f main, 4 f stagger, grain .05, no vignette.
- Pick when the proof is a document, a chart or a quote.
- Practice: write toward what can be shown. Put an abstract number back into its record (the filing, the page). Mix a typed face with handwriting, a gritty scan with clean vectors. State the source on every number, at 48 px (4.4% of height) at the frame edge, inside safe.
- Pace: start at a new image every 4-8 s. Hold key images several seconds. Transitions carry no information, so cut clean.
- Moves: highlight draws left to right behind the exact phrase; the camera pushes along the line being read; a cut-out on paper with a soft shadow; a chart built in the order narrated.
- Sound: dry and quiet. Paper slides, soft `tick`, a small `impact` at section breaks only.
- Not templated: use the real document, and vary how the page arrives. If you don't have it, say the page is a placeholder. A drawn "document" reads as fake.

### impact (big-stakes entertainment, challenges, gaming)
- Tokens: Anton + Archivo, near-black, yellow accent; pace .75, snap, give .3, 10 f main, 2 f stagger, no grain, vignette .18. A dark edge on text over footage.
- Pick when stakes rise and the picture should show them.
- Practice: the stake is on screen, in digits, and it moves one way only. The first graphic pays off the title, never a logo. Claimed but not shown is suspect. Open matching the title and thumbnail.
- Pace: editors in this genre describe a change every 1.3-1.5 s, but don't copy that as a target. One big channel's count fell from 38 to 23 cuts in a sampled minute and its creator told others to slow down; that is two minutes of video, so an anecdote. The signal is the break: start at a 3-5 s held shot against the fast run.
- Moves: text on the one word that carries the sentence, a punch on the number, reaction first and the thing looked at second, a stop-down before the reveal. One leaked handbook wants a spectacle near 3:00 and 6:00; authenticity is unconfirmed and it covers one channel, and it says nothing on graphics.
- Sound: short `impact` and `whoosh`, a `riser` into the reveal, music dropping out on the key line.
- Not templated: invent the stake's object (a shrinking tank, a day strip), not another yellow number. Leave words without a pop.

### scoreboard (sport, rankings, stats, finance)
- Tokens: Oswald + Archivo + IBM Plex Mono, #0D1319, green up, red down; pace .85, snap, give 0, 12 f main, 3 f stagger, no grain, no vignette.
- Pick when dense numbers must stay calm and be read in seconds on a small screen.
- Practice: one data item per cell, one number loudest, and only the data that matters now. A graphic turns on when it is needed and goes away. Colour means up, down or the leader, nothing else.
- Pace: in and out in 6-12 f. The hold is the content.
- Moves: a plate wipes on by a clipped bar, a number rolls, a row slides when rank changes, a short flash on the changed cell. Nothing floats. Use `PP.digits` so figures never shift. No overshoot on data.
- Sound: one `tick` per change, `rollup` under counters. The crowd or the voice stays the mix.
- Not templated: build the grid from what this sport counts, and take the team colour as a thin stripe. Avoid a dashboard of equal tiles with no leader.

### studio (product films, launches, tech, tutorials)
- Tokens: Hanken Grotesk + Geist Mono, #0A0B0D, blue accent; pace 1.05, enter, give 0, 18 f main, 3 f stagger, grain .04, vignette .15.
- Pick when the product is the hero. Take the accent from the product.
- Practice: real screens only, never redrawn from memory. One motion at a time, one focal point per shot, no intro card. Screens bleed off the frame and don't float as cards. Define colours, radii, shadows and timings once and reuse them. Big type with a small caption, and small still means 48 px.
- Pace: few cuts, every state held until readable. Aim for one feature understood in about 20 s.
- Moves: slow push with a 30-60 f ramp in and out, zoom to where the cursor acts and pull back when it is done, type resolves from slight blur, a light sweep across an edge. Settle fast when on-screen text must be read. `screen-frame` is the base.
- Sound: sparse glassy `tick` on the key interaction, one low `impact` on the title, silence around them.
- Not templated: move through the product as a user would. A hero screen floating on a gradient with a stock shadow is the template.

### maker (creators, vlogs, personal brands, how-tos)
- Tokens: Bricolage Grotesque + Figtree, a sunflower field #FFC21A, red accent; pace .9, enter, give .22, 14 f main, 3 f stagger, grain .03, no vignette.
- Pick when a person is the draw and the graphics should sound like them.
- Practice (mostly vendor reports, nothing from the creators): rounded inset screens, floating notes on one idea, a hand-drawn underline in Caveat, solid colour blocks with no gradients, sounds tied to on-screen actions. Keep the awkward human moments.
- Pace: start at 14 f in and a quick settle, then hold. Graphics follow speech, not a beat.
- Moves: small springs, a note landing with a little give, an underline that draws under the spoken word.
- Sound: soft `pop` and taps, one bright `shimmer` on the payoff.
- Not templated: use the creator's own handwriting, objects or desk. Paper tears on every section read as a preset pack.

### casefile (true crime, mysteries, investigations)
- Tokens: Oswald + Special Elite, #0C0C0B, red accent; pace 1.25, glide, give 0, 26 f main, 6 f stagger, grain .08, vignette .35.
- Pick when tension and evidence carry it. Never decorate a real person's story.
- Practice: date cards and inserts built from real paperwork, names and dates, key passages, plenty of black. Red only on the one fact. Real documents only: any you don't have are placeholders, and say so.
- Pace: titles hold 2-4 s (60-120 f) over a held shot, then cut to black.
- Moves: type-on, a document pans to the highlighted line, a map pin, a timeline that fills left to right, redaction bars.
- Sound: `room` or a low `pad` as drone, one `sub`, typewriter `tick`s. No stings, no orchestra.
- Not templated: degrade only what the story earns. Don't stamp CONFIDENTIAL on everything, or add a red thread for its own sake.

### classroom (education, science, teaching, kids)
- Tokens: Figtree 800, sky paper #D6E8F7, orange accent, blue second; pace 1.1, enter, give .12, 18 f main, 4 f stagger, no grain, no vignette.
- Pick when understanding is the product. For a blackboard feel, set `colours.paper` near black and keep thin strokes.
- Practice: concrete example before the idea, never a definition first. One idea per frame. Colour means the same thing throughout: give each term one colour. Picture and voice make the same point at the same moment.
- Pace: long holds led by narration. Name each change before it happens.
- Moves: write-on, one expression transforming into the next, a dot on a curve with a fading tail, zoom out from the example to the general case. Smooth easing, and linear only when speed is the data.
- Sound: a light bed, a soft `pop` per annotation. Maths can run on a sparse bed with no effects.
- Not templated: choose a metaphor for this topic in a sketch first. Icons in a row teach nothing.

## Shorts
Any look, with `--aspect 9:16`. The caption is the main graphic and doubles as the sound-off track (69% in one self-reported survey said they watch with sound off in public).
- Safe zone: keep key text out of the top 288 px (15%), the bottom 480-672 px (25-35%) and the side 108-162 px (10-15%). Vendors disagree and none is official, so this is the conservative set. `check` only knows the 5% edge, so measure this yourself, at the widest highlight state.
- Caption: 1-2 lines, 2-4 words a card, break by meaning, active word in the accent. No specific font is established; use the look's display face.
- Timing: no card under 25 f unless it is one punchy word (adapted from Netflix's 5/6 s minimum).
- Pace: start at a visible change every 1-3 s, but keep one calm held beat. Hook in the first second, shown not said. No logo, no title card. End so the last frame leads into the first.
- Moves: fewer graphics, bigger, held shorter, one idea per sentence. `subtitles`, `meme-caption`.
- Sound: voice forward, thin bed, at most one `pop` per text hit.
- Not templated: the durable idea is one phrase at a time, active word coloured. Colouring every word removes the signal.

`poster`, `blueprint`, `gallery` and `riso` carry everything they need in their own files: `animate.mjs looks`.

## Looks generated → instead
- Cream paper, a serif and a soft shadow on anything that asks for restraint → `check` calls this DEFAULT_LOOK. Name the subject's colour instead, and let the ground come from it.
- A graphic on a timer → one that passes the test above, or nothing.
- The same whoosh on every cut → sound only the moves that matter, with `seed` and `dur` changed per use.
- One duration on everything → by role: marker 5-8 f, panel 11-18 f, camera 24-45 f (start at).
- Everything moving at once → one dominant motion per moment.
- Centred icon on a gradient card → the real object, left-anchored.
- Near-match UI, filler data → the real screen and real numbers, or a labelled placeholder.
- Fade to black between everything → a cut on action, with a dip only for a real change of chapter.
- Glow everywhere → one hot core, chosen, or none.
- Timing near the beat → on the word or the bar, measured with `sound --hits`.

Remove one effect after the first pass. Don't let any of these become the new default: vary the look's tokens, entrance and rhythm from video to video.

<example>
Travel film, a 1,900 km rail line (placeholder distance), documentary look. Map stripped to the coast and the line. Accent taken from the train's livery, L .7, C .16. Route draws over 60 f on `move`, camera 36 f on `camera` with a 2° pitch-down (start at), a 90 f hold on each stop with one 64 px label. `swell` lands on the title, no ticks. Frame: 70% dark water, one amber thread.
</example>

<example>
Explainer on a court filing, newsroom look. Real scan, 1400 px wide, bleeding off the right edge. Slide on in 16 f with `snap`, then a 40 f push along the line. Yellow highlight draws behind nine words over 22 f, timed to the voice reading them, held 3 s. Paper slide at -20 dB, no music change. Source at 48 px bottom left.
</example>

<example>
Challenge video, $10,000 at stake (placeholder), impact look. Counter fixed top left, 160 px Anton, drops by a punch of 10 f with give .3 on each failure, red flash on the digits for 4 f. Before the last attempt, cut the music, hold the face 120 f with the counter still. `impact` lands on the reveal frame.
</example>

<example>
League table with one rank change, scoreboard look. Eight rows of 72 px, Plex Mono figures. Plate wipes on in 10 f, stays. Row 3 slides to row 2 in 12 f on `move`, its gap cell flashes green for 4 f, one `tick`. Leader alone gets the accent. Out in 8 f. Frame: dark, calm, one colour moving.
</example>

<example>
Short from a how-to, maker look, 9:16. Three-word cards, Bricolage 120 px at y 1100, inside the safe zone at the widest word. Active word orange, one `pop` on the single key word. First frame is the finished result, not the host. Last line leads back to it. No card under 25 f.
</example>
