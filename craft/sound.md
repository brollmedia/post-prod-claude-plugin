# Sound

Read this when a scene, cut or mix needs sound: effects on a graphic, music under a voice, a master for delivery.
Contents: Working blind · Levels · The kit · What to use, when · Hit timing · Music under voice · Room tone · Layers and pan · Mix order · Delivery · Checks · Looks generated · Examples

## Working blind
You cannot hear, so every rule below has a measurement. `animate.mjs sound` is your ear. These numbers catch defects. They do not prove taste, and the EBU itself says no meter replaces listening. Say that when you report, and ask a person to listen once. Numbers marked "start at" are mixing practice with no published source: set, measure, adjust.

## Levels
The voice is the anchor. Everything else is set relative to the loudest moment of the voice, so measure that first.
| Layer | Measure | Target |
|---|---|---|
| Final mix | Integrated | -14.0 LUFS, accept -14.5 to -13.5 |
| Final mix | True peak | -1.0 dBTP or lower |
| Final mix | LRA | start at 3 to 8 LU for voice-led video; meaningless under 60 s |
| Voice stem | Integrated | start at -16 to -14 LUFS; sample peaks -6 to -3 dBFS before the master |
| Voice stem | Short-term, line to line | within 2 LU; a dip of 6 LU or more inside speech means ducked too deep or muted |
| Music | Short-term against the voice | 14 to 20 LU under while the voice speaks; start at +6 to +10 dB in pauses over 0.8 s (24 frames) |
| Whoosh | Max momentary against voice max | start at -8 to -12 LU |
| Tick, pop | same | start at -10 to -14 LU |
| Impact | same | start at -3 to -6 LU, only where the voice is silent or very short |
| Riser | same, at its peak | start at -6 LU |
| Room tone | RMS in a gap | start at -65 to -45 dB |

YouTube publishes no number. Practitioners measure about -14, and it turns loud audio down. No source says it turns quiet audio up, so -20 plays 6 dB under its neighbours, and going over -14 just loses dynamics. Other targets: Spotify -14 at -1 dBTP, Apple Podcasts -16 ±1 at -1 dBFS, EBU R128 -23 at -1 dBTP.
The SFX bands are ceilings for a featured moment. Over continuous speech go lower: the library lower third sits 20 LU or more under a voice peaking at -12 (whoosh `gain_db` -22, tick -27). Loudness meters undercount bass: a test sub hit read only 4 LU under the voice while its peak was 11.6 dB under. For sub and impact read the waveform too.

## The kit
`sfx` writes 48 kHz 24-bit stereo, the same every time for the same seed, peak-normalised to -3 dBFS. That is very loud: a `gain_db` left out plays it at full size. Always set it. Every kind below was measured at gain 0, seed 3, default length.
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

Starting gain: `gain_db = voice max M + rule - kit max M`. Voice max M -12, whoosh at -10 LU: -22 + 12.6 = -9.4. A short `dur` lowers max M because the meter window is 400 ms, so measure the stem after. Voice max M on any file (the pad gives sounds under 400 ms a reading):
`ffmpeg -hide_banner -nostats -i stem.wav -af apad=pad_dur=1,ebur128 -f null - 2>&1 | grep -oE "M: *-?[0-9.]+ +S:" | grep -oE "\-?[0-9.]+" | sort -g | tail -1`
Never download music: use the creator's own track as `{ src, at, gain_db, fade_in, fade_out }`, or a `pad`.

## What to use, when
- Sound goes only where something visibly moves, lands or changes, and mostly on the emphasis beats, not on every one. Start at no more than one SFX per 2 s (60 frames) outside a montage.
- One gesture per move. An element gets a whoosh or a pop, not both. A hero moment may stack layers on one frame (swell + impact, or rollup + impact). That is still one gesture.
- One big hit per section. It feels big because it is rare, so keep the rest well under it.
- Silence is the strongest contrast you have. Before the biggest moment, drop the music 1 to 2 beats early and leave 0.25 to 1 s (8 to 30 frames) of room tone, then fire the impact on the downbeat frame. Music short-term must fall 12 LU or more in that gap. With a `pad`, end its `dur` at the gap: it has a built-in tail of up to 1.5 s, so end it that much earlier if the gap has to be clean.
- Vary: never the same file twice in a row. New `seed`, note ±3-6%, `dur` ±10%, `gain_db` ±1.5. A look's `sound` line sets the palette, not the density.

## Hit timing
ITU-R BT.1359: we notice sound early from about 45 ms, sound late only from about 125 ms. So sound is never early. At 30 fps a frame is 33.3 ms.
- `hit` puts the loudest moment of a kit sound on that time, so write the picture's number: `{ sfx: 'impact', hit: LAND }`. For a `{ src }` file, `hit` is simply its start.
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
`compose`: add `duck: true` to a bed in `audio`. It runs the filter below with no lookahead. List the bed first, because the trigger is everything mixed so far, so an SFX listed earlier would duck it too. `compose` does no mastering.
Tested filter: `sidechaincompress=threshold=0.03:ratio=4:attack=20:release=400`. Input 0 is the music, input 1 the voice. Thresholds are linear: 0.03 is -30 dB.
| threshold | ratio | attack | release | depth | back within 1 dB |
|---|---|---|---|---|---|
| 0.04 | 4 | 20 | 400 | -12.0 dB | 0.40 s |
| 0.03 | 4 | 20 | 400 | -13.9 dB | 0.45 s |
| 0.03 | 4 | 20 | 800 | -15.4 dB | 1.0 s |
| 0.03 | 4 | 5 | 150 | -13.5 dB | 0.20 s |

Those depths are for a voice at about -17 LUFS and move with the voice, so always measure. Release sets recovery time: 150 to 250 for quick conversation, 500 to 800 for slow narration so the bed does not pump between words. Set the bed's gain first, then duck. Lookahead: trim 40 ms off a copy of the trigger (`atrim=start=0.04,asetpts=PTS-STARTPTS`). The music ducks before the first word and does not move, so beat sync holds. Carve room for the words: `equalizer=f=2500:t=q:w=1:g=-4` on the music, 3 to 6 dB (start at). Both are in the recipe below.
Duck check: render the ducked music alone and the raw music, then print both in 50 ms blocks and subtract:
`ffmpeg -i m.wav -af "asetnsamples=n=2400:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-" -f null -`
Pass: -12 to -16 dB for narration, varying under 3 dB inside a sentence after the first 100 ms. A swing inside a sentence is pumping, so raise release.
Cutting a track: frames per beat = fps × 60 / BPM, so 15 at 120 BPM, 18 at 100, 20 at 90, and 14.06 at 128 (4 bars = 225 frames at 30 fps). Round each hit to the nearest frame. Cut on bar lines and change sections on 4 or 8 bars. Inside a beat, crossfade: `acrossfade=d=0.03:c1=qsin:c2=qsin`.

## Room tone
Digital silence sounds like a dropout and exposes every cut, so every gap holds room noise.
- On a voice cut, copy 5 to 10 s of quiet room from the same take and loop it with 50 to 100 ms crossfades (start at). A 1 s loop has an audible pattern. Lay it under every cut, 0.5 s past each edit.
- On a graphic, `{ sfx: 'room', at: 0, dur: D, gain_db: -46 }` reads about -62 dB RMS. The range -49 to -30 covers the target.
- Check: `silencedetect=n=-80dB:d=0.05` on the final mix prints nothing. Gap level: `ffmpeg -ss 3.2 -t 1 -i mix.wav -af astats=measure_perchannel=none:measure_overall=RMS_level -f null -` must not read `-inf`.

## Layers and pan
The kit's impact is already three layers. For your own stacks, start at: sub 30-120 Hz, body 120-2000 Hz, air and click 2-10 kHz. High-pass every non-sub layer at 100-150 Hz, low-pass the sub at 150-200 Hz, keep the sub centred, align transients within 1-2 ms. If the summed peak is lower than the largest layer, a layer is out of polarity: flip it.
Pan follows the motion. `dir: 'right'` sweeps -0.6 to +0.6, `dir: 'left'` the reverse, and no `dir` stays centred. For a harder sweep (±0.8 on a fast cross-screen move) pan your own file. Keep ticks and pops within `pan` ±0.3 (start at). Impact, sub, riser and swell have no pan option: they stay centred, which is right.
Reverb: the kit has a small room built in, so do not add more. For your own files start at impacts RT60 0.4-0.8 s at 8-15% wet, whooshes 0.2-0.4 s, ticks none.
Keep the voice clear: during speech, voice must beat music + SFX by 10 dB in the 1-4 kHz band, 15 dB on key words (start at). The default whoosh sweeps straight through that band, so check it:
`ffmpeg -ss T -t D -i stem.wav -af "highpass=f=1000,lowpass=f=4000,astats=measure_perchannel=none:measure_overall=RMS_level" -f null - 2>&1 | grep "RMS level"`. Run it on both stems and subtract.

## Mix order
1. Voice (all values here start at): `highpass=f=80:poles=2` (100 for a higher voice), `afftdn=nr=10:nf=-40`, EQ (cut 2-4 dB at 200-400 Hz if heavy, add 1-3 dB at 3-5 kHz), `acompressor=threshold=-20dB:ratio=3:attack=15:release=120:makeup=4dB:knee=3`, `deesser=i=0.4:m=0.5:f=0.5`, gain to level. Do less than you think.
2. Music: trim to bars, high-pass 30-40 Hz, carve, duck. SFX: each by its LU rule.
3. Sum with `amix=normalize=0`. The default silently divides every input by the input count.
4. Bus compression 1.5-2:1, attack 30, release 150-250, at most 1-2 dB. Then pre-limit, two-pass loudnorm, encode.

## Delivery
`render --final` masters a full-frame piece to -14 with one measured gain (clamped -12 to +24 dB) and a limiter at -1 dBFS sample peak. That is fine for a sting, but `sound` may still flag TRUE_PEAK. Overlays with alpha are not mastered. That master is for a piece that stands alone. Cut into a voiced video it would jump out (measured: a piece peaking 4.6 LU over the voice), so it is tagged, and `compose` and `effect` bring it down to the voice around it: 3 LU under the voice's loudest moment where the voice stops for it, 10 LU under where the voice goes on over it. Anywhere else, use `animate.mjs level <piece> --into <video> --out <file>` (add `--gap` when the voice stops). Check the result with `sound --overlay`.
For any finished mix, use the tested recipe. Stems are v.wav, m.wav, s.wav.
```
# 1) build + pre-limit (music ducked by voice, 40 ms lookahead on the sidechain copy)
ffmpeg -y -i v.wav -i m.wav -i s.wav -filter_complex "\
[0:a]asplit=2[v][vsc];[vsc]atrim=start=0.04,asetpts=PTS-STARTPTS[vs];\
[1:a]equalizer=f=2500:t=q:w=1:g=-4[m0];[m0][vs]sidechaincompress=threshold=0.03:ratio=4:attack=20:release=400[m];\
[v][m][2:a]amix=inputs=3:normalize=0:duration=first,\
alimiter=limit=0.5:attack=5:release=60:level=0[mix]" -map "[mix]" -c:a pcm_f32le premix.wav
# 2) pass 1, measure only
ffmpeg -hide_banner -nostats -i premix.wav -af "loudnorm=I=-14:TP=-1:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p'
# 3) pass 2 with YOUR numbers: input_i, input_tp, input_lra, input_thresh, target_offset go in order below
ffmpeg -y -i premix.wav -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=-18.46:measured_TP=-5.97:measured_LRA=1.60:measured_thresh=-28.46:offset=0.18:linear=true:print_format=summary" -ar 48000 -c:a pcm_s16le final.wav
```
The loudnorm trap: asked for linear, it silently goes dynamic, and pass 1 says `dynamic` every time, so only pass 2 tells you.
- Linear needs room. Gain = -14 - input_i. Room = -1 - input_tp. Gain must not exceed room. A raw mix (-16.81, -0.49) needed +2.8 with -0.5 of room, fell to dynamic, and landed at -14.4 with LRA 1.7. Limit peaks first, then normalise.
- Input LRA must also fit under the LRA you ask for: a file with LRA 10.6 ran linear at `LRA=11` and dynamic at `LRA=2`.
- Pass: the summary prints `Normalization Type: Linear`. If not, fix the input and rerun. `-ar 48000` is required, or the output is 192 kHz.
- `alimiter` re-amplifies unless `level=0`. It limits sample peaks only.
- `limit=0.5` is -6 dBFS and can leave headroom unused (one run ended at -4.8 dBTP). Try `limit=0.56` while input_tp + gain stays under -1.
- Lay it on the picture: `ffmpeg -i cut.mp4 -i final.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k out.mp4`, the harness's own audio setting.

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
| Stereo file | `ffprobe -v error -show_entries stream=channels -of csv=p=0 f` | 2; a mono file reads 3 dB low |
| Balance | voice max M command on each stem | inside the Levels bands |
| Clipping | `-af astats=measure_perchannel=none:measure_overall=Peak_level+Peak_count+Flat_factor` | Flat factor under 1; Peak count 10 or less at 0 dBFS (my limits) |
| Mono safety | `-af "pan=stereo\|c0=0.5*c0+0.5*c1\|c1=0.5*c0+0.5*c1,ebur128=framelog=quiet"` | within 1.5 LU of stereo (start at) |
| Gaps | `-af silencedetect=n=-60dB:d=0.3` | only the gaps you meant, 0.25-1 s; a surprise gap under 0.1 s is a dropout |
| Beat grid | 10 ms peaks (`asetnsamples=n=480:p=0` + astats as above) | spacing = 60000/BPM ms |
| After encoding | decode the AAC, repeat Final level | peak -1.0 or lower, else `TP=-1.5` on both passes |

Reading the pictures. Whoosh: a diagonal band up and back. Impact: a bright low block with a vertical start. A thin vertical line anywhere is a click or hard edit. Flat tops on the wave are clipping. Two channels that look very different mean a pan or phase problem.

## Looks generated
- A whoosh on every cut at one level → whooshes on emphasis cuts only, each with its own seed and `dur`.
- SFX at gain 0 → `gain_db` from the formula, then measured.
- Sound that lands 2 frames after the picture → `hit` from the same variable the picture uses.
- Music flat under speech and pauses → duck, and let it rise 6 to 10 dB in pauses over 0.8 s.
- Digital silence between lines → room tone at -65 to -45 dB RMS.
- Impacts all through a piece → one per section, small `pop` and `tick` around it.
- Reverb on everything → impacts only, 8 to 15% wet. LRA near 0 → bus compression under 2 dB.
Don't turn these replacements into the new habit either. Vary the sound, the note and the gesture with the piece, and let some moves pass in silence.

## Examples
<example>Lower third over continuous speech, voice max M -12. No impact, because the voice owns this moment. Plate whoosh `hit: T.plate + LEN.plate * 0.3`, `dur` .36, `gain_db` -22, `low` 500, `high` 4200, `dir: 'right'`, panning with the plate. Tick when the name lands, `gain_db` -27, `note` 1900. Exit whoosh at -27, `dir: 'left'`. It sits 20 LU or more under the voice. Check: 1-4 kHz voice lead over 10 dB in the speech window, `sound --overlay` for peaks.</example>
<example>A stat reveal in a 1.2 s speech gap, voice max M -12, music bed underneath. Bed stops down 2 beats before the reveal, falling 12 LU, leaving 0.5 s (15 frames) of room tone. `rollup` over the count, `swell` `dur` .7 and `impact` `size` .8 all on `hit: LAND`. Impact target -16 LUFS max M: `gain_db` -16 + 8.7 = -7.3. The number stops and the hit lands on the same frame, the only loud sound in the section. Check: `silencedetect` onset equals LAND or 1 frame later; ignore the +96 ms reading.</example>
<example>A 6 s title opener, full frame, no voice. `pad` `dur` 6, `note` 98, `gain_db` -9, room at -46 under it so the fades never reach digital zero. `swell` `dur` 1.1 and `impact` `size` 1.2 at `gain_db` -10 on `hit: T.title + PP.f(2)`. One `shimmer` 10 frames later at -32. `render --final` masters it to -14. Check: `sound` with hits on the title frame, then the spectrogram for a low block at the title and no vertical line at the end.</example>
<example>A map zoom under 40 s of slow narration, the creator's own track. In `compose` the bed comes first in `audio` with `duck: true`, gain set so it sits 16 LU under the voice. Narration is slow, so run the recipe by hand with `release=600`. Aim for depth -12 to -16 dB, steady within 3 dB through each sentence, and a rise of 6 to 10 dB in each pause over 0.8 s. One whoosh only, peak on the zoom's fastest frame. Check: `Normalization Type: Linear`, final inside -14.5 to -13.5, -1.0 dBTP or lower.</example>
<example>A 9:16 montage on a creator's 128 BPM track at 30 fps. A bar is 56.25 frames, so round each cut to the nearest frame: 56, 113, 169, 225. Cut on the bars, not every beat, or it turns frantic. A montage may go over one SFX per 2 s, but every whoosh takes a new seed, `dur` .26 to .4, and `gain_db` shifts ±1.5. The last bar drops the music for 8 frames, then one impact on the downbeat. Check: 10 ms peaks in the music stem are 469 ms apart, and no two consecutive sounds share a seed.</example>