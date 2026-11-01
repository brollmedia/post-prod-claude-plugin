---
name: launch-video-craft
description: Use when making, editing or reviewing a short launch, product, explainer or screen-recording demo video, for its motion design, pacing, music edit, sound design, mix and polished screen-recorder-style demos.
---

# Launch video craft

Best practice for short promo, launch and explainer videos (30–90 s): motion, timing, music, sound design and the final mix. Every number here is a starting point that worked in practice. Tune it by ear and eye, and check the result before delivering.

---

## 0. The house style: refined, quiet, precise

post-prod's look since the 1 Nov 2026 room redesign. It sets the tone for everything below: when a rule further down allows a range, take the calmer end.

- **Restraint reads as premium.** Fewer things on screen, quieter states, one move at a time. If a frame needs a caption to explain where to look, the frame has too much in it.
- **Dark only.** The base is the logo black (#0B0D0C) with soft, slightly green-tinted greys. No light backgrounds, no light-mode UI.
- **One green.** Brand green (#43DD97) marks the one thing that matters in a shot: the primary button, the active state, the key word, the logo. Everything else is ink and grey.
- **Type:** Instrument Sans for everything readable, display sizes tracked tight (−0.03 to −0.045 em); JetBrains Mono with tabular figures for timecodes, counts and file details.
- **Hairlines, not boxes.** Panels and cards separate with 0.5–1 px rings at about 9–15% white, never heavy borders or black drop shadows.
- **Quiet states.** Hover, pressed and selected are white at 4–12% over the surface; selected adds a thin green ring. Show them. Let the cursor rest on a control for about 150 ms before clicking so the hover state is seen.
- **One UI curve.** Interface moves (menus, tabs, rows, toggles) use `cubic-bezier(.23, 1, .32, 1)` at 150–300 ms. Camera and big moves use the asymmetric ease in section 2.
- **Our icons.** The room's icons are cut on the logo's diagonal (32°): on hover the two halves part slightly, and the lower half turns green when a tool is on. Keep that detail visible in close-ups. Never swap in stock icon sets in a graphic.
- **The real logo, always.** Use the logo file (the green P with its diagonal cut on black). The logo moment is the share-link opener: the two halves slide in along the cut, slow down, lock, and a thin light glints along the seam (section 2, Logo moment). Never draw a look-alike P.
- **Each view keeps its own look.** Notes is the picture and the notes; Edits is the editor with its tracks; Talk through it is the recording booth (everything else dims, a red REC light); Edit with Claude is a conversation. A demo stays in one view per beat and changes view with a quick crossfade (about 250 ms), never a cut mid-move.

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
- **Keep it consistent.** Use the same family of easing curves across the whole piece, so it feels made by one hand. Interface moves use the house UI curve (section 0).
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
- **Work from a tight palette:** the dark neutral base, one ink colour for text and the green accent. Off-palette colours make it look amateur.
- **Use colour to mean something:** the accent marks what matters, such as the key word, the active state or the final logo. The room's edit hues (cut, zoom, blur and so on) appear only on edit chips and tracks; Talk through it's red only on the REC light.

### A human touch
- **Hand-drawn marks should look human.** Use rough, slightly uneven strokes with a little wobble, varying pressure and a small overshoot at the ends, not perfect geometric lines.
- **Animated characters and avatars change state smoothly.** Blend between moods or reactions over 150–300 ms instead of jumping, and scale reactions with how loud or excited the voice is.

### Logo moment
- **Assemble the logo on a drop.** post-prod's: the two halves of the P slide in along the diagonal cut from opposite sides, decelerating (`cubic-bezier(.16, 1, .3, 1)`, about 0.7 s), and the lock lands exactly on the downbeat.
- **Add one accent on impact:** a thin light glint along the seam (about 0.6 s), or a single soft ring. One, not both.
- **Then settle:** the wordmark "post-prod.io" (".io" in green) rises in under the mark about 0.1 s after the lock, and the tagline follows about 0.3–0.5 s later.
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
| Off-palette colours, heavy black drop shadows | Use the palette: ink, dark neutral, one green; hairline rings |
| Default system fonts | Instrument Sans, JetBrains Mono for numbers |
| Title slightly off-centre | Optically centre the whole group |
| Subtitle overlapping the title | Space them, and stagger their entrances |
| Icons popping with a glitchy overshoot, unevenly spaced | Blur-rise in on the beat, evenly spaced |
| Generic beeps and boops | Subtle, airy UI sounds lined up to the visuals |
| Stepped or jerky zoom | One slow, continuous push-in |
| Camera zoomed so far the UI looks blurry or cropped | Stay at 1.3–1.6× and keep the window edge out of shot |
| White flash as a transition | A whip, match move or crossfade |
| Logo pops in late, tiny, off the beat | The two halves slide along the cut and lock on the drop, centred |
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

## 9. Screen-recording demos (the polished screen-recorder look)

Use this when turning a rough screen capture, or a set of step-by-step screenshots, into a clean, realistic product demo.

### Capture it smooth in the first place
- **Record real motion, not slideshows.** Drive the real app in a headed browser and capture the window at 60 fps (for example `ffmpeg -f gdigrab -framerate 60` on Windows, `avfoundation` on a Mac), or step the page frame by frame with a virtual clock. A headless screenshot loop or CDP screencast drops frames and reads as laggy.
- **Set the stage before recording:** a 1440 × 900 window at 2× device pixel ratio (and 390 × 844 for phone cuts), first-run tips dismissed, seeded demo data that looks real (a real-looking project, two or three named reviewers, notes with real words), notifications and extensions off, the system cursor hidden (it is drawn in post).
- **Log the cursor, not just the pixels.** Record the pointer position and clicks with timestamps alongside the capture, so the post cursor can follow the real path.
- **Show the opener on share-link demos:** open the link with `?opener=1` so the two halves of the P lock before the room appears.

### Diagnose the source first
- **Check whether it's really video.** Diff consecutive frames. Automated captures are often a slideshow of screenshots held for 1–3 s, which reads as laggy. If so, treat each held frame as a "state", and build all motion yourself.
- **List every overlay to remove:** the recorder's step captions ("Typed…", "Clicked", "wait"), click markers, burnt-in cursors, labels in the margins, and browser-extension clutter (spell-check icons and dots in text fields).

### Build clean plates
- **One clean image per UI state,** with no cursor and no overlays.
- **Patch from a sibling frame** of the same screen where that region is clean (a header from a frame with no caption, say). For small marks on flat backgrounds, use inpainting or a fill from the surrounding colour.
- **For typing, make two plates:** the field empty (with focus) and the field full. Reveal the real typed pixels from the full plate, line by line, roughly one character width at a time, with a caret at the reveal edge.
- **Where text under a burnt-in cursor is damaged,** park the new cursor over the same spot while that text is on screen, and press Return rather than moving the mouse away.
- **Fill missing states** (a player still loading, say) from another frame of the same content, scaled to fit.
- **Synthesise new states in the app's own style when the story needs them** (a new chat message, a reply card, a new version):
  - Sample the real colours, radii and spacing.
  - Match the font size by measuring a real line's width.
  - Reuse real UI pieces (status cards, icons) cropped from other frames.
  - Tell the person which parts are reconstructed.

### Motion
- **Frame it as a window on a wallpaper:**
  - a soft, dark, brand-tinted gradient (the logo black lifting to a faint green glow behind the window) with a little noise;
  - the window at about 86–88% width, with rounded corners (about 16 px), a 0.5–1 px light ring and a large soft shadow;
  - optionally a minimal browser bar with traffic-light buttons and a URL pill reading post-prod.io.
- **Make the camera zoom eased and purposeful:**
  - Zoom about 1.35–1.6× onto the area of action (the note box, the tray, the chat, a track), and back to 1× to re-establish. Go past 1.6× only for a single control, never for reading.
  - Each move takes about 1.0–1.2 s on the asymmetric ease (slow start, fast middle, long settle).
  - Interpolate the zoom on a log scale so the speed feels even.
  - Start the zoom before the cursor arrives, so the camera leads the action.
  - Drift slowly (about 2–3% over a hold) instead of sitting dead still between moves.
- **Keep the zoomed view inside the window.** When zoomed past about 1.3×, clamp the camera so it never shows the edge of the window. Ease the clamp in as the zoom rises.
- **The cursor is a crisp vector arrow** (white with a thin dark outline and a soft shadow), about the system size. It scales with the zoom.
- **Cursor paths:**
  - Glide on the same ease, along a gentle arc (about 10% of the distance), never in a straight robotic line.
  - Moves take about 0.6–1.0 s.
  - Settle on the target for about 150 ms so the hover state shows, then click.
  - Rest the cursor where a person would leave it.
- **Clicks:**
  - The cursor dips to about 88% size over 90 ms and springs back over 200 ms.
  - A thin green ring (about 1.5 px) ripples out and fades over 0.45 s.
- **Hide the idle cursor** (fade it over about 0.35 s) when the focus moves to content playing back.
- **Bring the UI to life where the source is static:**
  - redraw spinners as rotating arcs;
  - scroll chat lists smoothly (about 0.45 s, eased) when new messages arrive;
  - fade replies in over about 0.25 s with a short rise;
  - crossfade state changes quickly (0.12–0.35 s).
- **Typing speed:** about 40–45 characters per second reads as fast but human. Blink the caret (about 2 Hz) only while idle.
- **Pacing:** hold about 1–1.5 s on each result so it can be read. Zoom out on reveals, such as a new version appearing. End on a wide shot, then fade.
- **Export at 60 fps.** Smooth cursor and zoom motion is what sells the "recorded" feel.

### Sound
- **A quiet lofi or ambient bed,** about 5 dB under everything else, faded in over 1 s and out over 2 s.
- **A short, soft mouse-click transient** on every click, varied by about 1 dB.
- **Soft laptop-keyboard typing** for exactly the length of each typed stretch, with 40 ms fades.
- **A slightly heavier key** for Return.
- **A very quiet glass notification** when a reply or result lands.
- **Master** to about −16 LUFS, with a soft clip just under −1.5 dBFS.

### Rendering
- **Draw each frame as a pure function of time:** the plate state, then typing, spinners and scroll, then the camera, then the cursor drawn in output space.
- **Use one resample per frame** (scale plus translate), cubic when enlarging and area-averaged when shrinking, so the UI text stays crisp. Capturing at 2× means a 1.6× zoom never enlarges past the source.
- **Split the render into parallel chunks** and join them losslessly.

---

Sources for the music and mix approach: Rareform Audio, "What the drop in film trailers really means" (drops and stopdowns); film-mixing.com, "Mixing and sound editing a trailer" (loud needs soft before it); SmartSound, "Audio ducking and automation" (gradual ducks, release on the long side). Streaming loudness targets follow the common −14 LUFS / −1 dBTP platform norm.
