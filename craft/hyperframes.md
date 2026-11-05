# Making it on HyperFrames
Read this when `animate.mjs hf status` says `installed: true`. HyperFrames is the engine; the craft is ours. `CORE.md` still decides the look, the story, the floors and the sound.
Contents: What it adds | The work | Sound | When it fails

## What it adds
It renders quickly (about 30 s for 10 s of 1080p), and it has about 450 ready-made parts. It has no sound of its own here, and its defaults are small type on a dark ground: don't take them.

## The work
Run every command through the wrapper: `node "${CLAUDE_PLUGIN_ROOT}/bin/animate.mjs" hf run --dir <folder> -- <command>`. It keeps telemetry off and refuses what belongs to the person's own account. On Windows keep the project in a short path.
1. Write the treatment and `look.json` first, as `CORE.md` says, in the exact shape `genres.md` shows: `check` reads `colours` and `fonts` from it.
2. `hf run -- init <name> --non-interactive --skip-skills --skip-transcribe --resolution landscape`, or `portrait` for 9:16. Copy `look.json` into the project. Read the project's `CLAUDE.md` once: it has the file format. Fonts come from Google Fonts or the project's own files.
3. Read the closest scene in `${CLAUDE_PLUGIN_ROOT}/harness/library/` for its structure, beats and timing, then build that design as a composition in the look's numbers. These scenes carry what works: `stat-reveal` has the number riding a to-scale curve, `title-sequence` has a route through named stops with a running distance, `quote-card` fills the frame. A library scene can't render here, so rebuild it; don't copy its code. A part from the registry is fine when it's the right idea (`hf run -- catalog --json`, `hf run --dir <name> -- add <part> --no-clipboard --json`), but restyle it: nothing stays at its default size or colour.
4. Hold the floors while you build: 48 px, the hero at 40% of the width, safe areas, frame 0 not empty, nothing touching, no line through words. A slow camera moves everything, so keep lines clear of the title at the end of the move, not only the start. An animation that ends early leaves a black frame: run it to the end of the film, and leave a real hold.
5. `hf run --dir <name> -- check . --json`, then ours: `animate.mjs check <name>`, with `--alpha` for anything over the picture. Fix both, then look at `out/check/sheet.jpg` and `no-words.jpg`.
6. Render: `hf run --dir <name> -- render . -o out.mp4` for full-screen, `-o out.mov --format mov` for anything over the picture (it keeps transparency). It refuses until `check` is clean for exactly those files: fix what it names. A false alarm you have looked at: `hf run --dir <name> --accept CODE --because "what you saw" -- render …`, and say so in your reply.

## Sound
It comes out silent, and silent isn't finished. Write the beats down from your timeline, then:
- **Full-screen: a render refuses without sound.** Make effects with `animate.mjs sfx`, then write `sounds.json` beside `index.html`: `{ "audio": [ { "src": "hit.wav", "at": 2.1, "gain_db": -9 } ] }`, with room tone and a bed the whole way, as `sound.md` says. The render mixes it in and masters it to -14. A piece that plays under a voice: `--silent "<why>"`, and say so in your reply.
- **Over the picture: it may stay silent** when it sits under a voice. When there's a gesture worth hearing, keep it quiet (whoosh about -22, tick about -27) and put it in the `.mov`: `ffmpeg -i out.mov -i sound.wav -c:v copy -c:a pcm_s16le -shortest final.mov`.
Then `animate.mjs sound <file> --hits <times>`.

## When it fails
`hf run` says why in plain words. Pass that on, and make the piece with the harness instead: `new`, `check`, `render --final`. `HF_PERSONS_OWN`, `HF_NEEDS_ACCOUNT` and `HF_NEEDS_PRO` belong to the person's own account: Claude never signs in or spends for them.
