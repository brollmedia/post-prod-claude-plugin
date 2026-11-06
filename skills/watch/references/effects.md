# Effects and graphics in a watch job

**A new title, lower third or other designed text is a graphic, not a `title` layer.** With `installed: true`, it belongs to HyperFrames (`references/hyperframes.md`); without it, to the harness. Both go through a look and `check`. A `title` or `checklist` layer is plain drawn text with neither: keep it for changing an effect list from an earlier version, or when they asked for plain text (`"plain": true` on the layer). `effect` refuses any other new title layer.

Read this before anything that lays text, a graphic or a zoom over the picture, together with `craft/CORE.md`.

**Effects: titles, checklists, subtitles, graphics, zooms, blurs.** A note like "add a checklist of the
three tips", "subtitles on the intro", "show a map of the route", "zoom in on the screen", "blur the house number" is an
effect on a stretch, not a cut: `get_section` around it, `cut-footage.mjs effect <effects.json>` on the section, then
`upload_section` as above. Never hand-write drawtext or overlay filter graphs; the effect command handles fonts, timing, fades
and the sound (copied untouched). Times are in the section's own seconds; areas are `[x, y, w, h]` as fractions of the frame
(look at a frame first to place them). **How the text looks** is `"style"`: `font` (a .ttf/.otf path beside the effect list),
`color`, `accent` (a checklist's tick) and `box` (true, or 0-1 for a bar behind the words). Use what the person asked for, in
whatever style their channel has. When they have not said, choose on purpose: a font they put in the folder first, else a free one
that fits the video from Google Fonts (`curl -L -o post-prod-folder/fonts/Name.ttf "https://github.com/google/fonts/raw/main/ofl/<family>/<File>.ttf"`),
and colours taken from the video. With no colour or box given, the words read the picture behind them (dark on a bright frame,
white on a dark one, a faint bar on a busy one). The command lists `warnings` when a default slipped through (no font chosen):
change it, or say they asked for it.
```json
{ "input": "section.mp4", "output": "section-fx.mp4", "words": "v2.words.json", "words_from": 755,
  "layers": [
    { "type": "title", "text": "Day 3: the summit", "sub": "optional second line", "position": "top|center|bottom|lower-third|left|right", "from": 0.5, "to": 4 },
    { "type": "checklist", "title": "You need", "items": ["Boots", "Water", "A map"], "at": [5, 6.5, 8], "from": 5, "to": 12 },
    { "type": "subtitles", "from": 0, "to": 20 },
    { "type": "graphic", "file": "map.mp4", "mode": "full", "from": 12, "to": 18, "fade": 0.3 },
    { "type": "graphic", "file": "logo.png", "mode": "box", "area": [0.7, 0.05, 0.25, 0.2], "from": 2, "to": 6 },
    { "type": "zoom", "area": [0.3, 0.1, 0.4, 0.4], "from": 6, "to": 9, "ease": 0.4 },
    { "type": "blur", "area": [0.05, 0.6, 0.15, 0.1], "from": 0, "to": 20, "strength": 24 } ] }
```
A checklist item appears at its `at` and is ticked half a second later (say each item where the speaker says it: find the
times in the words); give it an `area` (`[x, y, w, h]`, the rows fit inside) to keep it clear of a face. Take the section
(`get_section`) out to the end of the last sentence the effect belongs to, plus a second or two: an item said at the very end
of a section is only on screen until the section stops. A number or fact on a graphic that you do not know (a subscriber
count, a price, a date) is a placeholder: say so in your reply and ask for the real one. Subtitles come from the words file (`words_from` is the section's `from`). A **graphic** that does not
exist yet (a map, a counter, a chart, a lower third, titles, a callout, a diagram, an end screen, 3D, a transition), make it
with the harness (`${CLAUDE_PLUGIN_ROOT}/harness/README.md` is its contract; read it the first time):
1. `node "${CLAUDE_PLUGIN_ROOT}/bin/animate.mjs" list` and `looks`, then `new <closest scene> post-prod-folder/work/V<n>/<name> --sheet look.json`, with the look written down as numbers (CORE.md): start from
   the library, never from a blank page. Put the note's words and numbers in its `scene.json` props.
2. The style: save `get_style_guide`'s `look` as `style.json`, and the project's fonts, logos and references in the scene's
   `reference/` folder (list_attachments, read_attachment). No style profile: don't stop to ask. Start from a look chosen by the
   video's subject (`--sheet look.json`, from the subject's world), take the accent from a frame of the video, and say in your reply which
   look you used and that you can learn their style from a video they like.
3. `animate.mjs check <scene> --size <the video's>`: fix what it prints (a final refuses until it is clean; `--accept CODE --because "what you saw"` for a false alarm, and say so in your reply), then look at `out/check/sheet.jpg` as
   `${CLAUDE_PLUGIN_ROOT}/craft/critique.md` says: every moment, not only the last frame.
4. `animate.mjs render <scene> --final --size <the video's> --format prores` for a graphic OVER the picture
   (`"mode": "full"` in the effect list), or `--final --format mp4` for a cutaway that replaces the picture while the voice goes on. Its sound goes in with it, brought down under the voice; set `"sound": false` on the layer to leave it out.
   If it has sound: `animate.mjs sound <file> --hits <the render's hits> --overlay`, because you cannot hear it.
It refuses (`SLOP`) the looks that read as AI-made when nobody chose them: a default face, gradient text, purple gradients,
emoji, bounce, glows and glass. Change them, unless the person asked for that look (a gaming channel may want neon): then pass
`--allow-slop "<their words>"` and say so in your reply. Say what you added where. The scene folder is part of the working
files you attach, so the next note on it changes the scene and renders it again instead of starting over.
A chat message from the room that starts "Make a graphic (post-prod:animate):" (the Claude tab's New graphic) is exactly this: make
the graphic it describes with the harness, at the playhead or selection the message was sent at (the task's context), and post it
as the next version like any other change.

## Timing graphics and on-screen text

Never place a graphic at a note's time. A note is one frame, the moment the person was at when they made it: a voice note where
they stopped and talked, or at the words they talked over while it played; a typed note where they were when they asked. It
has a range only when they marked one (I and O, a drag, "from here to here"). That moment is often a few seconds after the
words the graphic belongs to. Before placing
a graphic or text, read `get_transcript` around the note (look back first, then on) and find the words that give the graphic its reason: the
line it shows, explains or puts in context. Bring it in on those words (never at 0:00 or the scene's start just because the note
is early; use the transcript's word times), out when the talk moves on. Before rendering, post a `task_progress` note naming the
words and time you chose ("Grid in on 'not every block is valued the same' at 0:03.0"), so it shows on their job card, and say it
again in your summary.
