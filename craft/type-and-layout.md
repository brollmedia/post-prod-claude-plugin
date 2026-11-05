# Type and layout

Read this when a graphic puts words or numbers on screen, or when you are deciding where anything sits in the frame.

Contents: Sizes | Weight | Spacing and numerals | Choosing fonts | Hierarchy | Grid and margins | YouTube and Shorts zones | Composition and faces | Recipes | Looks generated | Examples

All px are at 1920x1080. H is frame height. Figures tagged with a standard are published. The rest is working practice: start there and tune by eye on a `still`.

## Sizes
A phone held upright shows a 16:9 frame 36.5 mm tall, so 1 px is 0.034 mm. That is the usual way people watch, and it sets everything below.

| Role | px at 1080p | % of H |
|---|---|---|
| Hard floor for anything the viewer must read | 48 | 4.4% |
| Label, role line, chart label, source | 48-60 | 4.4-5.5% |
| Caption | 60-70 | 5.5-6.5% |
| Name line, stat label | 70-86 | 6.5-8% |
| Title | 120-240 | 11-22% |
| Stat number | 190-320 | 18-30% |

`check` flags TOO_SMALL under 48 px, but 48 is the floor, not the target. Comfortable reading on an upright phone starts at about 62 px (a 2.1 mm em). When a line matters, give it 62 or more. A watermark or tiny credit can go under the floor if it carries no information. Read the phone-width view on the contact sheet every time.

Running text follows subtitle limits: 42 characters a line and 2 lines at most (Netflix; TOO_MANY_LINES fires over 2). At 60 px, 42 characters run about 1,260 px, 66% of the width. Break after punctuation, before a conjunction or preposition. Keep first and last name together, and article with noun. Hold words for 0.5 s + 1/3 s per word, never under 1.5 s (the sum NOT_ENOUGH_READ_TIME uses): 6 words need 2.5 s.

## Weight
Keep stems at 4 px or more at 1080p, so they are still 2.7 px when YouTube serves 720p. Thin strokes are also the first detail the encoder drops, so they flicker.

- Under 80 px: weight 500 or more. Above about 120 px: 400 is fine.
- Weight 300 or lighter: only above 160 px, off-white on a flat dark field, never coloured, never over footage.
- High-contrast serifs lose their hairlines under about 90 px. Keep them at 90 px or above, in a heavier cut.
- Under 60 px stay at 700 or less: heavier weights close the counters in e, a and 8.
- One weight only in the bundle: Anton, Instrument Serif, Young Serif, IBM Plex Mono, Special Elite. Asking for bold on these fakes it. No bundled face has an italic, so a real italic means fetching it from Google Fonts.

## Spacing and numerals
Big numbers: a comma sits tight against its digits, with no hole either side, and tabular figures only where the number changes. `check` reads the ink (LOOSE_NUMERAL). Punctuation stays with its word: a highlight or plate takes the full stop in with it, and never leaves it hugging the outside edge.
| Item | Tracking | Line height |
|---|---|---|
| Display, mixed case, over 100 px | -1 to -3% | 0.95-1.1 |
| Text at 48-80 px | 0 to +1% | 1.15-1.3 |
| ALL CAPS and small labels | +4 to +10% | 0.9-1.0 for display caps |
| Heavy condensed (Anton, Oswald) | 0 to +2% | 0.9-1.0 |
| Captions | 0 to +1% | 1.2-1.3 |

Set these in `style.json` under `typeset` (`display_tracking`, `display_case`, `display_axes`) and the scene reads them as `--pp-dt`, `--pp-dc`, `--pp-dv`.

Numerals that count, tick or sit in columns must not change width. Measured on the bundled files:
- `font-variant-numeric: tabular-nums` works: Archivo, Bricolage Grotesque, Figtree, Instrument Sans, Public Sans, Young Serif.
- Even widths already: Hanken Grotesk, Newsreader, Caveat and all the monos.
- No tabular figures at all, the digits shift: Anton, Fraunces, Instrument Serif, Oswald, Special Elite.

`PP.digits(el)` fixes a counter in any face, so use it for every counter. For a static hero figure, leave proportional spacing on: it looks set by hand.

Small details: centre text by cap height, not the line box, which sits about 3-6% low. Pull large left-aligned T, V, W, A and quote marks left 0.03-0.06 em, and hang opening quotes about 0.4-0.5 em outside the margin. Use `text-wrap: balance`, with at least 2 words or 12 characters on the last line. A two-line title has a second line 60-100% as wide as the first. All caps for 3 words or fewer.

## Choosing fonts
Pick from the mood, then change one thing (width, optical size, case, tracking), so the choice looks made. Two families at most, plus a mono for numbers. Three weights at most across them. To swap, edit `fonts` in `style.json`.

| Mood | Display | Support | Note |
|---|---|---|---|
| Warm documentary | Fraunces 600-700 | Instrument Sans 500 | Set opsz high and SOFT 0-50. The default cut is getting common. |
| Essay, fashion | Instrument Serif 400 | Instrument Sans 500-600 | Best at 150 px and up. Never bold it. |
| News, investigation | Newsreader 600-700, opsz 72 | Public Sans 500-600 | Sturdy, reads as credible. |
| Teaching, warm | Young Serif 400 | Figtree 500-700 | High x-height holds up small. |
| Big-stakes entertainment | Anton 400, +1-2% | Archivo 600-700 | Caps at phone size. Needs a real colour system. |
| Sport, scores | Oswald 600-700, caps | Archivo 500-600 | Numbers in IBM Plex Mono or `PP.digits`. |
| Auto, gaming | Archivo 800-900, wdth 112-125 | Archivo 500 | One family, wide and heavy fills 16:9. |
| Tech, product | Hanken Grotesk 600-640 | Geist Mono 500 for data | Spreading across SaaS, so bland outside tech. |
| Creator, vlog | Bricolage Grotesque 700-800, opsz high | Figtree or Hanken Grotesk 500 | Character without reading as a default. |
| True crime | Oswald 500, caps, +6% | Special Elite 400, short labels only | Typewriter is the costume. Keep it to a few words. |

`Caveat` is for a hand-written note on a frame, nothing else. Worth fetching: Barlow Condensed for scores, League Gothic + Work Sans for long headlines, Big Shoulders Display + Hanken Grotesk for stats.

Axes that exist in the bundled files: `wdth` on Archivo (75 to 125) and Bricolage (75 to 100); `opsz` on Fraunces, Newsreader, Bricolage; `SOFT` and `WONK` on Fraunces. Put them in `typeset.display_axes`, for example `"opsz" 144, "wght" 650`. A high optical size is the quiet premium signal on a serif.

## Hierarchy
Three levels in any one graphic: hero, support, label. A fourth size means the hierarchy is undecided. Separate levels by at least two of size, weight, colour, case. Web ratios of 1.2 are too timid here; use 1.5, 1.618 for title cards, 2.0 for stat numbers. From a 48 px base at 1.5: label 48 px (4.4% H), support 72 (6.7%), title 108-162 (10-15%), display 243 (22.5%).

Hero to support: at least 2.5:1, usually 3:1 to 5:1 on titles and 5:1 to 8:1 on stat cards. Below 2:1 nothing leads.

Space on an 8 px unit. Gap from hero to support: 0.25-0.5 of the hero's cap height. Card padding: at least 0.75 of the biggest size on the card. One corner radius for the whole video (8, 16 or 24 px): mixed radii read as a template kit.

## Grid and margins
- Graphics safe, EBU R95: 5% each side, so 96 px left and right, 54 px top and bottom (SMPTE ST 2046-1: a centred 90%). Action safe: 3.5%, or 67 and 38 px. OUTSIDE_SAFE tests the 5%.
- YouTube has no overscan, so this is a style margin. 96-154 px sides is comfortable. Make the bottom larger than the sides: four equal margins look like a template.
- 12 columns, 96 px margins, 24 px gutters: each column 122 px. Hang card edges, text and chart axes off x = 96. Thirds at x 640 and 1280, y 360 and 720.

## YouTube and Shorts zones
No YouTube document gives player overlap, so these start points are unverified.

- Keep key text between y 108 and 885 (0.10-0.82 H), x 96 to 1824. Hover controls cover the bottom 10-14%, the title and icons the top 10-12%, and viewer captions y 0.80-0.92 H.
- Keep the bottom-right corner empty, about 12% W by 10% H: watermark, duration badge on the thumbnail, subscribe zones. Your own logo: 5-8% H (54-86 px), 50-70% opacity, another corner.
- Burned-in captions sit in the bottom 15-25%. If a lower third shares the video, end it at y 820 (0.76 H) or move the captions. Decide once per video.
- End screen (YouTube published): last 5-20 s, video at least 25 s, up to 4 elements, hidden on mobile web, Music and Kids. The elements are placed in Studio, so your render leaves holes: 640x360 each, inside the inner 80% (192 px sides, 108 px top and bottom), clear of the bottom 12%. No text or face in a hole. Since many viewers never see the elements, the frame has to work alone with a spoken call to action. Hold it 8-20 s on a 1-3% slow scale.

Shorts at 1080x1920: platforms publish nothing for organic video, and third-party guides disagree (top 120-288, bottom 480-672, right 108-192). Use the conservative box x 108-888, y 288-1248, 780x960. `check` only tests 5%, so hold this box yourself. Captions centre on y 1000-1100 at 64-80 px. Nothing on the right rail.

## Composition and faces
- Centre only title cards, openers, end frames and a lone stat. Over footage, go asymmetric: hero text on one third, subject on the other. ALMOST_CENTRED fires when a group is 0.2-4% off centre, so be exact or be clearly off.
- Faces fill roughly the central 30-45% of W in a talking-head shot. Put the graphic on the side away from the face. When the face is large, stay off the chin and neck, y 0.62-0.78 H. If the subject is dead centre, use a corner tag at 30% W or less, or a slim block at y 0.80-0.88 H.
- Coverage: overlays 15% of the frame at most, 25% for bursts under 2 s. Past 35%, make it a full-frame card. Title cards stay 60-75% empty, stat cards at least 55%.
- The optical centre is about 5% above true centre. Balance a heavy left block with a small high-contrast element on the right, not a mirror image.
- Same position, same entrance, same roles for every lower third in a video. Change only the words.
- Reuse the thumbnail's accent, ground tint and display face in the first 5-10 s, and its keyword in the on-screen title.

## Over a talking head
At 1920x1080 with a 28 px margin: picture in picture 480x270 in a corner; a split with the speaker on one side at 960 wide; a stack with the graphic on the upper 2/3 and the speaker below on a 9:16. Cards come in over 0.4 s and leave over 0.35 s. Keep them off the face and off the eyeline.

## Recipes
Lower third (library `lower-third`, overlay):
- Left edge x 96, or `side: 'right'`, away from the face. Block bottom at y 885 (0.82 H). Going down to 0.88 H means accepting hover overlap, so only for a brief hold.
- Width at most 45% W (865 px). Name 76 px (7% H), role 48 px, `PP.fit` the name down to 56 px and never the role under 48. Height follows the type: about 204 px (19% H), 8.5% of the frame.
- Padding 26 top, 38 right, 24 bottom, 30 left. Solid plate. Accent bar 10 px wide, thick enough to survive 4:2:0. Hold 3-6 s. Upright: bottom at 0.36 H, width 82%.

Stat card (library `stat-reveal`, full frame):
- One left edge at x 96. The group sits a touch above centre (46% of the free space on top).
- Number 18-30% H, label 48-72 px, source 48 px, unit 50-60% of the number. Payoff ("6.4×", placeholder) at 62% of the hero's size. Bars to scale below, never under 8 px.
- A title says the finding, not the topic. Counter 0.8-1.5 s, then hold the final value at least 1 s. Numbers land dead on, never with spring.

## Looks generated
- Inter, Space Grotesk, Poppins, Montserrat, Roboto, Outfit, Sora by reflex → a face from the mood table, with one thing changed.
- Everything centred with equal margins → left edge at x = 96 and the focal object on a third.
- Rounded card with a thick coloured left border → a rule above, a 4-8 px square marker, or just type and space.
- Icons in circles, three-column feature rows → one idea per frame, sequenced in time; one custom pictogram at 96 px or more if the topic needs it.
- "+247%" huge with a tiny grey label → number at 22% H, label at 48 px or more in strong contrast, source below.
- Generic copy ("Unlock the power of...") → specific nouns and numbers from the video.
- Emoji as graphics → a real picture or a plain shape.

These are habits to break, not a new set of defaults: choose differently for each video and each channel.

## Examples
<example>
Brief: a business explainer needs a figure over a shot of a warehouse. No number supplied.
Decisions: full-frame card, since a number over a busy shot fights it. Newsreader 680, opsz 72, for the placeholder "[$0.0M]" at 243 px (22.5% H), left on x = 96; Public Sans 560 label at 60 px above it; source at 48 px below. Tell the person the figure is a placeholder. Hero to label 4:1.
Frame: the number's left edge, the label's and the source's all fall on one line, and the right 45% stays empty.
</example>
<example>
Brief: name a guest in a talking-head interview. She sits right of centre, and the channel burns in captions.
Decisions: `side: 'left'`. Captions own the bottom band, so the block ends at y 820, not 885. Name 76 px, role 48 px, width 700 px. Hold 4 s.
Frame: the plate sits on clear wall to the left, level with her shoulder, and stops short of the caption band.
</example>
<example>
Brief: a hook line on a 9:16 Short, "this cost me everything" (user's words).
Decisions: Anton, caps, +1%. `PP.fit` to 780 px wide, capped at 112 px, on two lines with the second as wide as the first or nearly. Left at x 108, centred on y 1050. Last word in the accent.
Frame: the type stops 192 px short of the right edge, clear of the like rail, and sits just below centre, above the description area.
</example>
<example>
Brief: end screen for a tutorial, 12 s, with two video slots.
Decisions: hold on a tinted ground with `PP.ground`. Two 640x360 holes at x 192 and x 1088, y 216, with thin frames at 4 px so an empty hole still reads as designed. Channel name in display at 72 px, centred on y 720. Spoken call to action. Bottom 130 px stays empty. Slow scale 1 to 1.02.
Frame: with the elements on it reads as a finished page; on mobile web, without them, it reads as a calm sign-off with two framed gaps.
</example>
