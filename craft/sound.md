# Sound

Read this only when they asked for sound or brought their own: effects on a graphic, music under a voice, a master for delivery. With neither, a graphic has no sound.
These are the rules from `skills/launch-video-craft` sections 3 to 6, and `compose` and `render --final` apply them by default.
Contents: Working blind · Levels · What moves, what it sounds like · Recorded sounds · The kit · Variation · Hit timing · Music under voice · Music that moves · Beds · Room tone · Layers and pan · Mix order · Delivery · Checks · Looks generated · Examples

## Working blind
You cannot hear. `animate.mjs sound` catches defects: clipping, a cut-off tail, a late hit. It can't tell you a sound is good, and a mix that passes every number can still be horrible. If you can't say why this sound fits this move, leave it out. Say what you measured and that nobody has listened.

## Levels
Give every sound a `kind` in `compose`'s `audio` list, and it goes to its level by itself.
| Kind | Level | What the code does |
|---|---|---|
| `voice` | -16 LUFS | High-pass 80 Hz, compressor -22 dB 3:1 at 5/80 ms, +1.5 dB at 3.2 kHz, -2.5 dB at 6.8 kHz |
| `music` | -16 LUFS unducked | Then the movement below, then the duck |
| `sfx` | The stem stops at -25 LUFS | A small room at 25% wet, filtered 300 Hz to 9 kHz, 2:1 compression. It never turns quiet effects up |
| `bed` | Starts at -32 LUFS | High-pass 300 Hz, low-pass 11 kHz, a little air, medium reverb, wide, a slow breath, ducks 4 dB |
| Master | -14 LUFS, about -1.2 peak | Glue 1.5:1 at 20/200 ms, the gain, a limiter, a 0.55 s fade. Only with `"master": -14` |

**Effects alone are never mastered.** With no voice or music, the effects are the whole mix, and bringing them to -14 raises them 9 to 14 dB. Leave them at their own level, or give the piece a real bed.

Set a sound by its peak with `peak_db`. These come from a finished launch film, with the effects stem 4 to 9 LU under the music:
| Sound | Peak, dBFS |
|---|---|
| A big hit, only on a drop or major reveal | -14 to -18 |
| A click, a whoosh, a paper slide | -15 to -18 |
| A pop, a soft sweep | -18 to -23 |
| A confirm, a select | -20 to -21 |
| A tick | -23 |
| A counter running | -30 |

YouTube publishes no number. Practitioners measure about -14, and it turns loud audio down.

## What moves, what it sounds like
Start from silence, and add a sound only if the move has one in real life. Most graphics get nothing, and the rest get one sound.
- Keep small sounds subtle and airy: soft glassy clicks, light whooshes, gentle confirms. They sit under the voice and never compete with it.
- Booms, sharp transients and riser peaks go only on drops and major reveals. A graphic usually has neither.
- Line up each sound's peak with the frame where the visual lands, not the start of the file: `hit` does this for kit sounds and recordings.
- Pan small sounds towards the element with `pan`, up to 0.6.
- Fewer, better sounds. Leave out ticks on small moves: the silence between sounds is what makes them land.
| What moves | Sound | Why |
|---|---|---|
| Text rising, sliding or fading in | Nothing | Nothing touched anything |
| A number rolling | Nothing, or quiet ticks on the number's own ease, thinning as it slows | The roll stopping is the landing, so no hit on the last digit |
| A line drawing itself, a route, a bar growing, a wipe | Nothing, or one soft stroke whose level follows the move's speed | It's continuous, so it has no transient |
| A highlighter sweep | A marker stroke across the sweep only | A pen on paper is the real sound |
| A dim, a fade, a slow push, a map camera move | Nothing | Nothing happens that could make a sound |
| A fast whip across the frame, under 0.3 s | One soft whoosh | Air is the only moving thing that's loud |
| Two things really touching: a stamp, a slam, a bounce | One low, soft thud | Only real contact earns a hit |

- An `impact` is for a collision on screen. Something easing to rest hasn't collided with anything.
- A bed goes in only when they asked for sound. Keep it as atmosphere: if you can clearly hear it, it's too loud.
- Use one gesture per move. Before anything, ask whether it would be better with no sound.

## Recorded sounds
Anything physical (pen, paper, a click, a switch) sounds better recorded than synthesised. Use what they brought first, from the project folder or their own library. With HyperFrames and their own sign-in, they can use its catalog through the CLI: never copy those files into a project you hand to anyone else. Never download music. Name any sound that wasn't theirs, with its licence, in your reply.

## The kit
`sfx` writes 48 kHz 24-bit stereo, the same every time for the same seed, peak-normalised to -3 dBFS. That is very loud, so always set `peak_db`. Every kind below was measured at gain 0, seed 3, default length.
| Kind | Use | Options (range) | Max M at gain 0 |
|---|---|---|---|
| whoosh | a fast move, a transition | dur .12-2.5, low 260, high 3200, peak .3-.8 (default .6), dir left/right | -12.6 |
| riser | a build of 1 to 4 s (start at) into a hit | dur .5-8, note 110 | -9.6 |
| impact | the one big landing | size .4-2 | -8.7 |
| tick | a value lands, a small UI change | note 2600, pan | -18.9 |
| pop | a small element arrives | note 340, pan | -18.1 |
| sub | weight under a reveal, no attack of its own | dur .3-3 | -6.1 |
| swell | a reversed room breathing into a hit | dur .25-3 | -14.2 |
| shimmer | light on a payoff | dur .4-3, note 880 | -7.0 |
| rollup | a counter: ticks that slow with the count | dur .3-6, rate 26, note 2100 | -10.3 |
| pad | a held chord under a title; a bed, not a song | dur 1-60, note 110, minor | -11.0 |
| room | room tone | dur .5-120 | -13.5 (RMS -15.7) |

In a list, set `peak_db` from the table above. Then measure the mix.
`ffmpeg -hide_banner -nostats -i stem.wav -af apad=pad_dur=1,ebur128 -f null - 2>&1 | grep -oE "M: *-?[0-9.]+ +S:" | grep -oE "\-?[0-9.]+" | sort -g | tail -1`
Never download music: use the creator's own track as `{ src, at, gain_db, fade_in, fade_out }`, or a `pad`.

## Variation
- Never the same file twice in a row. New `seed`, note ±3-6%, `dur` ±10%, `gain_db` ±1.5. A look's `sound` line sets the palette, not the density, and the table above beats it.
- Keep at least 2 s (60 frames) between effects outside a montage.

## Hit timing
ITU-R BT.1359: we notice sound early from about 45 ms, sound late only from about 125 ms. So sound is never early. At 30 fps a frame is 33.3 ms.
- `hit` puts a sound's loudest moment on that time, for a recording as well as a kit sound, so write the picture's number: `{ sfx: 'tick', hit: LAND }`.
- Percussive sounds (impact, tick, pop): the onset goes on the frame where the change first shows, or 1 frame after. The library uses `T.title + PP.f(2)` because an eased entrance shows nothing in its first frames. Never earlier than that frame.
- Whoosh over a cut: its peak goes on the first frame of the new shot. Over a move: on the fastest point, not the clock's middle. Start at `start + len * 0.5` for `move`, `start + len * 0.3` for `enter`, which is fastest early (the library lower third does this). The ear locates a swell by its peak, not its start.
- Whoosh length: start at 1.0 to 1.6× the move, so a 15-frame move (0.5 s) takes `dur` 0.5 to 0.8. Lead before the peak: 6 to 12 frames, or 3 to 6 for a quick 0.25 s one. At the default peak .6, `dur` .5 leads 9 frames.
- Riser and swell finish on the hit. Their `hit` lands 10 to 12 ms before the file ends, which the impact covers.
- `hit` clamps at 0. A 2 s riser with `hit: 1` silently lands 1 s late, so hold the picture until `hit` is past the sound's lead.
`sound --hits` reads the loudest 2 ms within 120 ms of each hit, and it fails on `-12 ms` early or a frame + 3 ms late (+36 ms at 30 fps). That window suits ticks and pops. Correctly placed kit sounds read as follows, so do not "fix" them:
| Kind | Reading when correct | Trust |
|---|---|---|
| tick, pop | 0 to -2 ms | yes |
| whoosh | -34 to +26 ms over 6 tests (noise) | under 2 frames off is fine |
| impact | +96 ms: the sub crest, not the onset | use the onset check below |
| riser, swell, rollup | -16, -110, -52 ms | ignore |

Impact onset: on a stem with silence before it, `ffmpeg -hide_banner -nostats -i stem.wav -af silencedetect=n=-50dB:d=0.05 -f null - 2>&1 | grep silence_end`. The first `silence_end` is the onset; `hit` 2.0 printed 1.998. Compare with n/fps. Run hit checks on the scene's own render, never on the full mix: the voice would be the loudest thing nearby.

## Music under voice
`compose` ducks `music` and `bed` under the voice by default, keyed on the voice at the -42 dBFS gate, with a 40 ms attack and a 375 ms release, so the music breathes back up between phrases without pumping on every breath.
- Depth: `"duck": 9` under narration (the default), 6 to 7 under lively sections, about 5 when a word lands on a drop, 4 for a bed. `"duck": false` turns it off. The ratio is worked out from the voice's level.
- The listener should feel the change, not notice it. Changes between sections happen over about 200 ms.
- Effects aren't ducked for each other: they all go in last, as one stem.
Check it by rendering the music alone, ducked and raw, printing both in 100 ms blocks and subtracting. Pass: 8 to 10 dB under narration, back to 0 in the gaps. A swing inside a sentence is pumping.
Cutting a track: frames per beat = fps × 60 / BPM, so 15 at 120 BPM, 18 at 100, 20 at 90, and 14.06 at 128 (4 bars = 225 frames at 30 fps). Edit in whole bars with crossfades of about 20 ms (`acrossfade=d=0.02:c1=qsin:c2=qsin`), and lock the drops to the story first. If you need more time, add pre-roll from earlier in the song, or repeat one bar and shift everything after it by exactly one bar. Lean towards warm, sparse tracks over big trailer hits. One real drop per film is usually enough.

## Music that moves
Add `"drops": [12.4]` to a `music` sound and its level moves with the story, in dB against the music at -16 LUFS:
- Up to the first drop it rises from -5 to -3.
- About half a beat before each drop (0.3 s) it stops down to -21. Anything loud needs something quiet before it.
- The drop slams to +2 on the downbeat, then settles over 1.2 s.
- It holds at `"base"`: -2.5 under narration, 0 for lively hands-on moments, -3.5 for a calm recap.
- It ends at +0.5, and the master fades the last 0.55 s.
- With a filter sweep, start muffled (a low-pass around 650 Hz) and open it on the hook word. Close it about 4.8 s before a drop and sweep it open into the stopdown. These aren't in the code yet.

## Beds
A `bed` is atmosphere, never a wall. If you can clearly hear a pad, it's probably too loud.
- Tune a pad to the song's key, or its relative major or minor: `pad` takes `note`.
- Bring it up where the music is sparse: the pre-roll, thinking moments, the build into a drop, a calm recap, the end card. Sink it almost out of sight under drops and busy sections.
- The code handles the rest: the filters, a medium reverb, side gain 1.5×, a slow breath of about 2 dB, and a 4 dB duck with the voice.

## Room tone
Under a voice, digital silence sounds like a dropout and exposes every cut, so every gap holds room noise.
- On a voice cut, copy 5 to 10 s of quiet room from the same take and loop it with 50 to 100 ms crossfades (start at). A 1 s loop has an audible pattern. Lay it under every cut, 0.5 s past each edit.
- Check: `silencedetect=n=-80dB:d=0.05` on the final mix prints nothing. Gap level: `ffmpeg -ss 3.2 -t 1 -i mix.wav -af astats=measure_perchannel=none:measure_overall=RMS_level -f null -` must not read `-inf`.

## Layers and pan
The kit's impact is already three layers. For your own stacks, start at: sub 30-120 Hz, body 120-2000 Hz, air and click 2-10 kHz. High-pass every non-sub layer at 100-150 Hz, low-pass the sub at 150-200 Hz, keep the sub centred, align transients within 1-2 ms. If the summed peak is lower than the largest layer, a layer is out of polarity: flip it.
Sounds that land together add up, so one leads. Hits whose peaks fall within 0.25 s (0.04 s for ticks and clicks) are held within 1.5 dB of the loudest alone: `compose` turns down the others, only those. Layers of one hit that you built on purpose take `stack: false`.
Pan follows the motion. `dir: 'right'` sweeps -0.6 to +0.6, `dir: 'left'` the reverse, and no `dir` stays centred. For a harder sweep (±0.8 on a fast cross-screen move) pan your own file. Keep ticks and pops within `pan` ±0.3 (start at). Impact, sub, riser and swell have no pan option: they stay centred, which is right.
Reverb: every `sfx` gets the small room from the chain, so don't add more.
Keep the voice clear: during speech, voice must beat music + SFX by 10 dB in the 1-4 kHz band, 15 dB on key words (start at). The default whoosh sweeps straight through that band, so check it:

## Mix order
1. Voice, then music, then the bed, then effects last as one stem. `compose` does this order for you.
2. Sum with `amix=normalize=0`. The default silently divides every input by the input count.
3. Master, only when a voice or music is in it.

## Delivery
`render --final` masters a full-frame piece with a voice or a track in it to -14, with light glue, one measured gain (clamped -12 to +24 dB), a limiter at -1.2 dBFS sample peak and a 0.55 s fade. Effects alone are left where you set them. `sound` may still flag a master on true peak, so for a voiced delivery use the two passes below.
For any finished mix, use the tested recipe. Stems are v.wav, m.wav, s.wav.
```
# 1) build + pre-limit (music ducked by voice, 40 ms lookahead on the sidechain copy)
ffmpeg -y -i v.wav -i m.wav -i s.wav -filter_complex "\
[0:a]asplit=2[v][vsc];[vsc]atrim=start=0.04,asetpts=PTS-STARTPTS[vs];\
[1:a]equalizer=f=2500:t=q:w=1:g=-4[m0];[m0][vs]sidechaincompress=threshold=0.00794:ratio=1.7:attack=40:release=375[m];\
[v][m][2:a]amix=inputs=3:normalize=0:duration=first,\
alimiter=limit=0.5:attack=5:release=60:level=0[mix]" -map "[mix]" -c:a pcm_f32le premix.wav
# 2) pass 1, measure only
ffmpeg -hide_banner -nostats -i premix.wav -af "loudnorm=I=-14:TP=-1:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p'
# 3) pass 2 with YOUR numbers: input_i, input_tp, input_lra, input_thresh, target_offset go in order below
ffmpeg -y -i premix.wav -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=-18.46:measured_TP=-5.97:measured_LRA=1.60:measured_thresh=-28.46:offset=0.18:linear=true:print_format=summary" -ar 48000 -c:a pcm_s16le final.wav
```
The loudnorm trap: asked for linear, it silently goes dynamic, and pass 1 says `dynamic` every time, so only pass 2 tells you.
- Linear needs room. Gain = -14 - input_i. Room = -1 - input_tp. Gain must not exceed room. A raw mix (-16.81, -0.49) needed +2.8 with -0.5 of room, fell to dynamic, and landed at -14.4 with LRA 1.7. Limit peaks first, then normalise.
- Pass: the summary prints `Normalization Type: Linear`. If not, fix the input and rerun. `-ar 48000` is required, or the output is 192 kHz.

## Checks
Start with `animate.mjs sound <file> --hits 1.2,3.4 [--fps 30] [--target -14] [--overlay]`. It returns `lufs`, `lra`, `true_peak_db`, `sample_peak_db`, `hits`, `problems`, and `waveform.png` and `spectrogram.png` in `sound-check/`. Use `--overlay` when the file is not a finished mix: it drops the loudness problem.
| Code | Fires at | Do |
|---|---|---|
| LOUDNESS | over 1 LU from target | hold finals to ±0.5 yourself; the flag is looser |
| TRUE_PEAK | over -1 dBTP | lower the limit, rerun the recipe |
| CLIPPED | over 3 samples at full scale | find the sound with no `gain_db` |
| CUT_OFF | last 10 ms above -40 dB | fade it, or the file ends in a click |
| OFF_THE_HIT | outside -12 ms to +1 frame + 3 ms | read the table in Hit timing first |

The harness does not check balance, voice masking, phase, room tone or SFX rate. Run these yourself.
| Rule | Command | Pass |
|---|---|---|
| Final level | `ffmpeg -nostats -i f -af ebur128=peak=true -f null - 2>&1 \| tail -18` | `I:` -14.5 to -13.5, `Peak:` -1.0 or lower |
| Balance | voice max M command on each stem | inside the Levels bands |
| After encoding | decode the AAC, repeat Final level | peak -1.0 or lower, else `TP=-1.5` on both passes |

Reading the pictures. Whoosh: a diagonal band up and back. Impact: a bright low block with a vertical start. A thin vertical line anywhere is a click or hard edit. Flat tops on the wave are clipping. Two channels that look very different mean a pan or phase problem.

## Looks generated
- SFX at full size → `peak_db` from the Levels table, then measured.
- Sound that lands 2 frames after the picture → `hit` from the same variable the picture uses.
- Music flat under speech and pauses → duck, and let it rise 6 to 10 dB in pauses over 0.8 s.
- Digital silence between lines → room tone at -65 to -45 dB RMS.
Don't turn these replacements into the new habit either. Vary the sound, the note and the gesture with the piece, and let some moves pass in silence.

## Examples
<example>Lower third over continuous speech, voice max M -12. No impact, because the voice owns this moment. Plate whoosh `hit: T.plate + LEN.plate * 0.3`, `dur` .36, `gain_db` -22, `low` 500, `high` 4200, `dir: 'right'`, panning with the plate. Tick when the name lands, `gain_db` -27, `note` 1900. Exit whoosh at -27, `dir: 'left'`. It sits 20 LU or more under the voice. Check: 1-4 kHz voice lead over 10 dB in the speech window, `sound --overlay` for peaks.</example>
<example>A stat reveal in a 1.2 s speech gap, voice max M -12, and they asked for sound. The count gets quiet ticks on the number's own ease, 26 LU under the voice, thinning as it slows. No hit when it stops, and nothing on the words beside it.</example>
<example>A 6 s title opener, full frame, no voice, and they asked for sound but brought none. The title rises and settles, so it gets nothing. If a line draws first, one pencil stroke follows the line's speed at max M -30. No bed, no impact.</example>
<example>A map zoom under 40 s of slow narration, the creator's own track. In `compose` the bed comes first in `audio` with `duck: true`, gain set so it sits 16 LU under the voice. Narration is slow, so run the recipe by hand with `release=600`. Aim for depth -12 to -16 dB, steady within 3 dB through each sentence, and a rise of 6 to 10 dB in each pause over 0.8 s. One whoosh only, peak on the zoom's fastest frame. Check: `Normalization Type: Linear`, final inside -14.5 to -13.5, -1.0 dBTP or lower.</example>
<example>A 9:16 montage on a creator's 128 BPM track at 30 fps. A bar is 56.25 frames, so round each cut to the nearest frame: 56, 113, 169, 225. Cut on the bars, not every beat, or it turns frantic. A montage may go over one SFX per 2 s, but every whoosh takes a new seed, `dur` .26 to .4, and `gain_db` shifts ±1.5. The last bar drops the music for 8 frames, then one impact on the downbeat. Check: 10 ms peaks in the music stem are 469 ms apart, and no two consecutive sounds share a seed.</example>