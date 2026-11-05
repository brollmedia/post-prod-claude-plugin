---
name: launch-video-craft
description: Use when making, editing or reviewing a short launch, product, explainer or screen-recording demo video, for its motion design, pacing, music edit, sound design, mix and polished screen-recorder-style demos.
---

# Launch video craft

Best practice for short promo, launch and explainer videos (30–90 s): motion, timing, music, sound design and the final mix. Every number here is a starting point that worked in practice. Tune it by ear and eye, and check the result before delivering.

---

## 0. Whose look is this?

Make the film in the creator's own look: their brand, or a look chosen by subject (`${CLAUDE_PLUGIN_ROOT}/craft/CORE.md`). Where this file says brand typefaces, palette or green, read that as theirs. Only a film about post-prod.io itself uses post-prod's house style: `${CLAUDE_PLUGIN_ROOT}/skills/launch-video-craft/references/house-style.md`.

For a screen-recording demo also read `${CLAUDE_PLUGIN_ROOT}/skills/launch-video-craft/references/screen-demos.md`.

## 1. Pacing and timing

- **Hook in the first 1–2 seconds.** Open on the problem or the payoff. Don't open on a logo.
- **Tie picture to sound.** Big reveals land on musical drops, and on-screen changes land on the word that names them. Timing taken from a voiceover drifts when lines change, so time cues to words rather than fixed seconds, and re-time everything whenever a line changes.
- **Give each idea a beat.** After a key visual lands, let it sit for about 1 s before moving on. Holds that are too short read as rushed; holds longer than about 2 s read as dead air.
- **Cut setup animations back.** An intro animation should last only as long as the line it supports, plus that short hold.
- **One thing at a time.** Introduce one element, let it settle, then the next. If two moves overlap, one should clearly lead.
- **Follow an energy curve.** Build under the setup, go big under the exciting middle, calm for the recap, then one last build into the end card.
- **End with intent.** Fade the picture and music together over the last 0.5–1 s. Never hard-cut to black mid-phrase.

## 2. Motion design

### Easing
- **Nothing moves at a constant speed.** Linear motion looks mechanical and cheap.
- **Use an asymmetric ease.** Start slow, reach top speed about a third of the way through, then take a long, soft settle into place. Think of it as a velocity curve with its peak at about 35%: a short wind-up, a fast middle and a gentle landing.
- **Keep it consistent.** Use the same family of easing curves across the whole piece, so it feels made by one hand. Interface moves use one quick curve throughout (`cubic-bezier(.23, 1, .32, 1)`, 150 to 300 ms).
- **Springs, not glitches.** An element can overshoot slightly and settle (one soft bounce at most, and in the house style usually none). It should never jitter, pop in stepped jumps or snap back.
- **Springs land on the beat.** Time the moment an element arrives to the music, not just when it starts moving.

### Camera
- **Push-ins are slow and continuous.** A gentle zoom of 3–6% over several seconds reads as cinematic. Stepped or jerky zooms read as broken.
- **Speed ramps follow a curve.** Ease into the fast section and out of it, with a smooth S-shaped speed curve rather than abrupt jumps between speeds.
- **No white flashes as transitions.** Use a whip, a match move, a push or a crossfade instead.

### Depth and layering
- **Build a world, not a flat fill.** Use a soft dark background with gentle gradients and light, never a flat grey or one solid colour.
- **Blur sets depth.** Background elements are smaller, softer (blurred) and lower in contrast. Foreground elements are sharp. Never put every element at the same depth.
- **Reveal with blur, not just fade.** A UI element or headline arrives from about 10 px of blur and a short rise (a few percent of its height) over 0.6–1 s, staggered by 80–120 ms between elements.
- **Put a blurred, dimmed backdrop behind pop-up cards** so they separate from busy content and stay readable.
- **Never cover what matters.** Overlays, glows and blurs must not sit on top of the UI or text the viewer needs to read at that moment.

### Layout and type
- **Centre with care.** Title cards, end cards and key graphics should be optically centred, both across and down. Check the bounding box of the whole group, not just its first element.
- **Keep spacing even.** Groups of icons or cards get even gaps and a shared baseline or centre line.
- **No overlaps.** Watch for labels colliding with each other, timecodes colliding with scrubbers, or menus sitting over captions. Check every busy frame.
- **Type**
  - Use the brand typefaces (section 0).
  - Don't use default serif or system fonts, heavy drop shadows, or colours from outside the palette.
  - Keep contrast high enough to read in a fraction of a second.
- **Reveal text word by word** (about 50–60 ms stagger), with key words picked out in the accent colour.
- **Make important cards big.** If a graphic carries a key idea, give it real screen space. Small text in a big frame gets missed.

### Colour
- **Work from a tight palette:** a tinted neutral base, one ink colour for text and one accent. Off-palette colours make it look amateur.
- **Use colour to mean something:** the accent marks what matters, such as the key word, the active state or the final logo. The room's edit hues (cut, zoom, blur and so on) appear only on edit chips and tracks; Review with voice's red only on the REC light.

### A human touch
- **Hand-drawn marks should look human.** Use rough, slightly uneven strokes with a little wobble, varying pressure and a small overshoot at the ends, not perfect geometric lines.
- **Animated characters and avatars change state smoothly.** Blend between moods or reactions over 150–300 ms instead of jumping, and scale reactions with how loud or excited the voice is.

### Logo moment
- **Assemble the logo on a drop.** Its parts come in decelerating (`cubic-bezier(.16, 1, .3, 1)`, about 0.7 s), and the lock lands exactly on the downbeat.
- **Add one accent on impact:** a thin light glint along the seam (about 0.6 s), or a single soft ring. One, not both.
- **Then settle:** the wordmark rises in under the mark about 0.1 s after the lock, and the tagline follows about 0.3–0.5 s later.
- **Keep it clean.** No starbursts, no "NEW!" stickers, no shake, no tiny off-centre corner logos.

## 3. Music edit

- **Edit in whole bars,** with crossfades of about 20 ms, so the drops stay locked to the beat.
- **Lock the drops to the story first,** then fit everything else around them.
- **Need more time before the first word?** Add pre-roll taken from earlier in the song, and keep the drops where they are.
- **Need room for a new line?** Repeat one bar from a peak section and shift everything after it by exactly one bar.
- **Match each section to the emotion on screen:**
  - a build under the setup;
  - the peak bars under the frantic or exciting moments;
  - a riser into each reveal;
  - a calmer build into the logo.
- **House style:** lean towards warm, sparse, modern tracks (soft synths, light percussion) over big trailer hits. One real drop per film is usually enough.

## 4. Music automation (the level moves with the story)

All levels are in dB, relative to the music normalised to −16 LUFS.

- **Intro:** about −5 dB, rising to −3 dB over the bars before the first drop.
- **Stopdown before every drop:** about half a beat (~0.3 s) of near-silence, at −20 to −22 dB. Contrast is what makes the hit feel big: anything loud needs something quiet before it.
- **The drop:** slam to +1.5 to +2 dB on the downbeat, then settle back to 0 dB over about 1.2 s.
- **Section bases:**
  - narration sits at a base of −2 to −3 dB;
  - excited, hands-on moments sit at about 0 dB;
  - the recap or calm sections sit at −3 to −4 dB, then build back up before the final drop.
- **End card:** hold at about +0.5 dB, then fade over the last 0.6 s.
- **Filter sweeps:**
  - Start the opening muffled (a low-pass around 650 Hz) and open it fully on the hook word.
  - Before each drop, close the filter about 4.8 s out, then sweep it open into the stopdown, so each build "opens up" into its hit.

### Voice-keyed duck
- **Envelope:** RMS of the voice over 30 ms, gated at about −42 dBFS.
- **Timing:** attack about 40 ms, release 350–400 ms. The music breathes back up between phrases without pumping on every breath.
- **Depth:**
  - 8–10 dB under narration;
  - 6–7 dB under excited or lively sections;
  - about 5 dB when a word lands right on a drop.
- **Smooth the depth curve** over about 200 ms so the changes between sections can't be heard.
- **Keep it gradual.** The listener should feel the change, not notice it.

## 5. Sound design

### UI sounds
- **Keep them subtle and airy:** soft glassy clicks, light whooshes and gentle confirms. They sit under the voice and never compete with it.
- **Save the big hits for the drops.** Booms, sharp transients and riser peaks go only on drops and major reveals.
- **Line up each sound's peak** with the frame where the visual lands, not the start of the sound file.
- **Pan small UI sounds** slightly towards where the element is on screen (no more than about 60%).
- **Fewer, better sounds.** Leave out ticks and blips on every small move. Silence between sounds is what makes them land.

### Atmospheric beds (pads and drones)
- **Tune pads to the song's key.** Pitch-shift so they agree with the music; a pad in the relative major or minor works too.
- **Keep them airy and out of the way:**
  - high-pass at about 300 Hz and low-pass at about 11 kHz, with a gentle high shelf for air;
  - medium reverb;
  - widen the stereo image (side gain about 1.5×).
- **Bring them up where the music is sparse:** the pre-roll, "thinking" or working moments, the build into a drop, the calm recap and the end card.
- **Sink them almost out of sight** under drops and busy sections.
- **Give them a slow "breath":** a gentle level change of a few dB over several seconds, so they never sit static.
- **Duck them slightly with the voice** (about 4 dB).
- **Use them as atmosphere, never a wall.** If you can clearly hear a pad, it's probably too loud.

## 6. Mix chain and delivery levels

- **Voice:**
  - high-pass at 80 Hz;
  - compressor at −22 dB threshold, 3:1 ratio, 5 ms attack, 80 ms release;
  - +1.5 dB at about 3.2 kHz for presence;
  - about −2.5 dB at 6.8 kHz as a de-ess;
  - normalise to −16 LUFS.
- **Music:** normalise unducked to −16 LUFS, then apply the automation curve multiplied by the duck.
- **SFX:**
  - a short reverb send (a small room, about 25% wet, filtered 300 Hz–9 kHz);
  - gentle 2:1 compression;
  - normalise to about −24 to −26 LUFS.
- **Master:**
  - light glue compression (1.5:1, 20 ms attack, 200 ms release);
  - −14 LUFS integrated;
  - −1 to −1.2 dBTP true peak;
  - a fade over the last 0.5–0.6 s.

## 7. Common mistakes (what a bad cut looks like)

Use this as a review checklist. Each item is a quick note to give an editor.

| Mistake | Fix |
|---|---|
| Linear, constant-speed motion | Ease it: slow start, fast middle, soft settle |
| Flat grey or single-colour background | A soft, lit, dark world with depth |
| Background elements as sharp as the foreground | Blur and shrink the background |
| Off-palette colours, heavy black drop shadows | Use the palette: ink, a tinted neutral, one accent |
| Default system fonts | A face chosen for the subject, a mono for numbers |
| Title slightly off-centre | Optically centre the whole group |
| Subtitle overlapping the title | Space them, and stagger their entrances |
| Icons popping with a glitchy overshoot, unevenly spaced | Blur-rise in on the beat, evenly spaced |
| Generic beeps and boops | Subtle, airy UI sounds lined up to the visuals |
| Stepped or jerky zoom | One slow, continuous push-in |
| Camera zoomed so far the UI looks blurry or cropped | Stay at 1.3–1.6× and keep the window edge out of shot |
| White flash as a transition | A whip, match move or crossfade |
| Logo pops in late, tiny, off the beat | Its parts lock on the drop, centred |
| A drawn look-alike of the logo | The real logo file |
| Stickers, starbursts, "NEW!" badges | Remove them, and let the type and motion do the work |
| Clicking without the hover state ever showing | Rest the cursor ~150 ms on the control first |
| Old room UI in a new film | Re-record on the current room |
| Music at one flat level, hard cut at the end | Automate to the story, duck under the voice, fade out |

## 8. Production workflow

- **Render deterministically.** Draw each frame as a pure function of time (`renderAt(t)`), so any frame can be re-rendered exactly, and renders can be split across parallel workers and joined losslessly.
- **Check assets before rendering.** Confirm every image and font has actually loaded, not just "completed", and abort the render if not. A silent load failure in one worker gives a video where the logo vanishes halfway through.
- **Check stills first.** Before a full render, look at full-size frames from the busiest moments: overlaps, centring, readability.
- **Check the whole thing before delivery:**
  - listen to every drop (stopdown, hit, settle);
  - read the music gain curve at each section boundary;
  - confirm the voice is clear over the busiest music;
  - meter the final loudness and true peak.
- **Re-time after any voiceover change.** Re-derive every cue from the new word timings, and make sure each word's start is snapped past leading silence.

---

Sources for the music and mix approach: Rareform Audio, "What the drop in film trailers really means" (drops and stopdowns); film-mixing.com, "Mixing and sound editing a trailer" (loud needs soft before it); SmartSound, "Audio ducking and automation" (gradual ducks, release on the long side). Streaming loudness targets follow the common −14 LUFS / −1 dBTP platform norm.
