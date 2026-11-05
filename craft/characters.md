# Characters
Read this when a simple character or mascot has to move in SVG or canvas: idle, walk, look, talk.

Frames are at 30 fps, converted from the 24 fps numbers animators teach. Values are starting points; tune by eye. Invent the character: never use a real channel's cast.

## Rig
- A group per part with its pivot at the joint, nested parent to child: upper arm, forearm, hand. SVG: `rotate(a, jx, jy)`. Canvas: `save`, `translate(joint)`, `rotate`, draw, `restore`.
- Overlap parts (hair over ear, sleeve over hand), so joints show no gap or seam.
- Build from one pure `pose(t)`. Delay is sampling the parent at `t - lag`, so no frame depends on the last one.

## On twos
Most character animation holds each pose 2 frames. The stepping is the look, and it hides thin drawing.
- At 30 fps: `tq = Math.floor(t * 15 + 0.25) / 15`. Drive poses from `tq`. The `+ 0.25` matters: `--final` samples ±¼ frame around each frame, and a plain `floor(t * 15)` steps inside that window on every even frame, so two poses double-expose.
- Fast limbs go on ones. The camera, type and background are always on ones.
- Moving hold: a pose held past 10 to 15 f keeps creeping 1 to 3% of the last move, so it stays alive.
- Key expressions earn a hold of 10 to 30 f after landing.

## Idle
A frozen character reads as a picture. Layer these on unrelated periods:
- Breath every 3 to 5 s: chest scaleY 1.01 to 1.02, shoulders 1 to 2 px per 100 px of height, head 4 to 8 f behind. Inhale 40% of the cycle, exhale 60%.
- Weight shift every 6 to 12 s, over 10 to 18 f.
- Blink: 3 to 5 f in total. Close 1 to 2, shut 0 to 1, open 2 to 3. Closing is faster. Upper lid falls 80 to 100% of the eye, lower rises 10 to 20%; do not scale the eye to zero.
- Blink gaps seeded 2 to 8 s (`PP.hash(i)`, listed in `setup`). About 1 in 10 is a double. Blink on head turns and after a thought ends, never on the line's key beat.

## Look and turn
- Order: eyes, then head 3 to 5 f later, torso 3 to 8 f after that, feet last.
- Pupils jump in 1 to 3 f and hold: eyes make saccades. An eased 15 f glide reads as a robot panning.
- Before a big head turn, a 1 to 4 f small counter-move. After it, 3 to 5 f past by 5 to 10% of the turn, then back.
- Heads and limbs travel on arcs, not straight lines.

## Overlap
- Hair, tail, tie, antenna: each segment lags its parent 3 to 5 f.
- For a bounce on stop, use `PP.spring`. Lively: `dur` 0.25 to 0.5, give 0.4 to 0.6. Heavy cloth: `dur` 0.5 to 1, give 0 to 0.3. These are the 2 to 4 Hz and 1 to 2 Hz springs animators use, in closed form, so frames stay independent.
- Wind: two sines of unrelated periods at 0.3 to 1 Hz, 2 to 6° at the tips.
- Squash and stretch 5 to 10% on fast moves, keeping volume: `scaleX = 1 / scaleY`.

## Walk
- Each step has 4 poses, then mirror. At 120 steps a minute one step is 15 f: contact 0, down 4, passing 8, up 11, contact 15. Full cycle 30 f.
- Body is lowest at down, highest at up. Pelvis travel 2 to 3% of body height.
- Arms oppose legs, shoulders counter-rotate hips, head stays level and lags 1 to 3 f.
- One phase drives all: `p = (tq / cycle) % 1` (cycle 1 s here), angle = base + A * sin(2π p + offset). Parent-to-child offsets 0.03 to 0.08 of a cycle.
- Speed (start at): relaxed or sneaking 20 to 30 f a step, brisk 10 f. Bob and swing grow with speed.
- Scroll the ground at stride length per step, or the planted foot skates.

## Talk
- 6 mouths minimum: closed, small open, wide, round, teeth on lip, rest. Rhubarb's set of 9 is better: A closed (P B M), B slightly open (K S T EE), C open (EH AE), D wide (AA), E rounded (AO ER), F puckered (UW OW W), G teeth on lip (F V), H long L, X rest.
- Shape leads the sound by 1 to 3 f. Hold each at least 2 f.
- Speech runs 4 to 5 syllables a second. Hit stressed vowels, one shape every 6 f or so, not each phoneme.
- Going from A or B to D, pass through C, so the mouth does not teleport.
- Add a 1 to 3° head nod on stressed syllables.
- Time shapes from word timings in the transcript. You cannot hear: use `sound` and the waveform to confirm where the words land.

## Looks generated → instead
- Mirror-symmetric pose → head tilt 2 to 5°, one shoulder 5 to 8% higher, pupils offset.
- Uniform 2 px outline → heavier line on the bottom and shadow side, or no outline with colour-shifted edges.
- One flat fill per part → 2 tones plus one highlight, shadow on the same side of every part, rim colour opposite.
- All parts start and stop together → 3 to 5 f offsets.
- Pose held dead → breath, blink, gaze drift, moving hold.
- Puppet slides on straight lines → arcs and squash.
- Six-colour rainbow cast → 4 to 6 colours, one accent, shapes that read in solid black. Round reads friendly, angular reads threat.

Vary these: give each character its own proportions, timing and tics, or every one becomes the same mascot.

## Examples
<example>
Brief: a small mascot reacts when a stat lands.
Decisions: pupils jump to the number at the hit, head follows 4 f later, torso 5 f after. Antenna springs with `dur` 0.4, give 0.5. Hold 20 f, double blink.
Frame: the look arrives before the body, so the viewer's eye follows the mascot's onto the number.
</example>
<example>
Brief: a character walks across a map for 4 s.
Decisions: 18 f steps, on twos, pelvis 2.5% of height, map scrolls at stride per step, tie lags 4 f.
Frame: the planted foot stays fixed on the map, and the hop of each step reads as weight.
</example>
<example>
Brief: a host talks a 10 s intro.
Decisions: 6 mouths from word timings, 2 f lead, head nods 2° on stressed words, breath in the pauses, blink after each sentence, none on the punchline.
Frame: the face rests in the gaps, so the talking looks like thought, not a loop.
</example>
