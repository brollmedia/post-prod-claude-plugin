# Cutting footage in a watch job

Read this before anything that cuts, reorders, chooses takes, joins clips or fits a new section in.

Any change that cuts, reorders, chooses takes, joins clips or fits a new section in goes through the **cut engine**, never
ffmpeg commands you write yourself. You decide WHAT plays; the engine decides where each cut lands (in the gap between
words, never inside one), makes the seams (the sound blended so nothing clicks, J and L cuts, dissolves, dips), renders and
checks the result. Measured on our own footage: cuts placed by judgement broke sentences at about one join in three until
they moved onto the word clock, and no model hears seams reliably, you included (you get no sound). So never place a cut by
ear or by eye alone, and never hand-write a filter graph of many cuts.

If the footage tools (`get_words`, `find_takes`, `get_section`, `upload_section`) are missing or answer `FIRST_CUT_NOT_OPEN`,
they are not open on this workspace yet: make simple cuts with ffmpeg as above, at pauses, and say so in your reply.

The engine: `node "${CLAUDE_PLUGIN_ROOT}/bin/cut-footage.mjs" <command> …` (needs ffmpeg and ffprobe on the PATH; if they are
missing, `ask_person` to install ffmpeg and stop the task). Each command prints JSON.

1. **The words.** `get_words` on every version you cut from (it starts Whisper the first time; ask again a minute later),
   then run the curl it gives to save `<name>.words.json`. Footage that is only in the project folder has no words: upload
   each clip first with `upload_file` (no `version_of`) so it becomes a file in the project, then `get_words` on it. Without
   words the engine cannot protect sentences: say so in your reply if you cut without them.
2. **Takes.** When there is more than one clip, or the speaker restarts lines, run `find_takes` with the versions. For every
   line with more than one whole take, `ask_person` with that group's `choices` exactly as given (the room shows each take as
   a card with a frame and your pick marked) and use the one the person picks. Never choose between whole takes yourself.
   The order of sections is the story: if it is not clear from the brief or the notes, ask.
3. **The edit list**, a JSON file in your working folder:
   ```json
   { "sources": { "a": { "path": "A001.mp4", "words": "A001.words.json" }, "b": { "path": "A002.mp4", "words": "A002.words.json" } },
     "clips": [ { "src": "a", "in": 12.4, "out": 41.9, "why": "intro, take 2" },
                { "src": "b", "in": 3.1, "out": 88.0, "seam": { "type": "j", "ms": 400 } } ],
     "output": "cut.mp4", "from": { "length_s": 1000.5, "number": 1 } }
   ```
   `in` and `out` are where the voice starts and stops in that source (seconds); `seam` is the join INTO that clip. Seams:
   `cut` (the default: a hard picture cut, the sound blended over 12 ms), `j` (the next voice starts under the picture
   before, ms is how early: a new thought or a reply), `l` (the picture changes while the voice before finishes: a
   reaction), `crossfade` (sound blended longer, for a change of room tone), `dissolve` (picture and sound blended: time has
   passed), `dip` (through black: a new chapter). Talking heads are mostly hard cuts; use dissolves and dips rarely and
   say why. A J or L cut only between two different pictures (another angle, a cutaway, a different person): on the same
   framing the speaker's mouth would not match the words, so the engine makes a same-framing J or L a cut with the sound
   crossfaded and says so (`JL_SAME_SHOT`). The engine also keeps stray frames of the source's own shots out of every join:
   it moves an edge onto the source's cut when only silence is between, holds a clean frame over a few stray ones, or moves
   the picture edge (the plan's `picture_moves`). To replace an exact stretch frame for frame, set `"exact": true`: none of
   that happens. `from` is the version you started from (its length and number) for the room's report. A section from another recording (a pickup, a new take filmed later) is just another source: the engine brings its voice to the level of the first clip; its picture is not colour-matched, so look at a frame either side and say so if it jumps.
4. **Plan, then render.** `plan <edit-list.json>` first. Each `MID_SENTENCE` problem is a cut that skips words of a sentence
   that is heard: move that edge to the sentence's start or end (the problem says which), or, only when the person asked for
   exactly that cut, set `"allow_mid_sentence": true`. Then `render <edit-list.json>`. It refuses while problems remain.
5. **Look.** Grab a frame either side of a few seams (`ffmpeg -ss <t> -i cut.mp4 -frames:v 1 <png>`) and look at them: a
   jump cut on the same framing is normal for talking heads; a flash of something unrelated is not. The render's `report`
   must say `ok`, no unasked-for black, no level jumps at seams; fix the edit list and render again if not.
6. **Upload** with `upload_file` (`version_of`) as usual, then `complete_task` with `cut_report` set to the render's
   `cut_report` exactly as printed: the room shows it under your reply (length, cuts, seams, sentences cut, black).

**A change to part of a long video** (a note at 12:40 on a 30-minute cut) does not need the whole file: `get_section` with a
few seconds either side of the change (the curl saves it), change that stretch with the engine (its source's `words_from` is
the stretch's `from`, so the version's words file lines up: `{ "path": "section.mp4", "words": "v2.words.json", "words_from":
755 }`), then `upload_section` with the same `from` and `to` and run its curl. post-prod splices it in (only the frames around
the change are encoded again) and that becomes the next version; `splice_status` says when it is ready. If the version cannot
take a stretch (not made by x264, e.g. the camera file), `upload_section` says so: upload the whole file instead. When you
already have the whole version on disk, `cut-footage.mjs splice --base <file> --from <s> --to <s> --section <file> --out <file>`
does the same locally before `upload_file`.

**Retention cues.** When a render's `cues` lists a subscribe or merch ask, or a sponsor read, say once in your reply where it
is and that in Retti's data viewers leave more in the ~22 seconds after one (correlation, long-form only), and offer to
shorten or move it. Never claim that an edit improves retention, and never move it without the person saying so.
