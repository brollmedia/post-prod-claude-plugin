---
name: animate
description: Make any animation, motion graphic or edit for a video with post-prod's harness, at senior motion designer standard from the first prompt, with no reference needed (titles, lower thirds, subtitles, callouts, charts, counters, stat reveals, title sequences, maps, diagrams, screen-recording zooms, logo reveals and end screens, countdowns, before/after and split screens, meme captions, 3D, transitions), render it exactly (any size, 9:16 too, with alpha for overlays), put it on the footage, and send it to post-prod.io for review, then change it from the notes. Follows the creator's style when they have one. Also renders Remotion and HyperFrames projects.
when_to_use: Phrases like /post-prod:animate, make an animation, make a graphic, motion graphics, lower third, animated title, title sequence, stat reveal, add a map, a chart, a counter, an end screen, a callout, an intro, a transition, sound design, render this Remotion project, render my HyperFrames composition.
model: claude-opus-5-5
argument-hint: "[what to make, or a post-prod.io link]"
allowed-tools: Bash(node:*) Bash(ffmpeg:*) Bash(ffprobe:*) Bash(npx:*) Bash(curl:*) Read Write Edit Glob Agent mcp__plugin_post-prod_post-prod__get_style_guide mcp__plugin_post-prod_post-prod__list_attachments mcp__plugin_post-prod_post-prod__read_attachment mcp__plugin_post-prod_post-prod__get_frame mcp__plugin_post-prod_post-prod__get_review mcp__plugin_post-prod_post-prod__get_transcript mcp__plugin_post-prod_post-prod__get_version_context mcp__plugin_post-prod_post-prod__upload_file mcp__plugin_post-prod_post-prod__attach_working_files mcp__plugin_post-prod_post-prod__create_review_link mcp__plugin_post-prod_post-prod__wait_for_feedback mcp__plugin_post-prod_post-prod__reply_to_note mcp__plugin_post-prod_post-prod__open_link
---

# Animate with post-prod's harness

Good animation needs Opus 5.5 (`claude-opus-5-5`). If you are any other model, say once, in one line: "For good edits, use
Opus 5.5: type /model claude-opus-5-5, then ask again." Then carry on.

**Before anything else, read `${CLAUDE_PLUGIN_ROOT}/craft/CORE.md`** and follow it: it is how this work is done here, and it has the
table of what else to read. Then read `${CLAUDE_PLUGIN_ROOT}/harness/README.md` once before the first scene. Run every command as
`node "${CLAUDE_PLUGIN_ROOT}/bin/animate.mjs" …`; each prints JSON (`ok`, or `code` and `message`).

## 1. Know the job
- **The video.** When there's a post-prod.io link or a project, open it (`open_link`). Then read:
  - `get_review`: the notes;
  - `get_transcript`: what is said where;
  - `get_frame`: the frames where the graphic goes. Take the accent from what you see.
- **Their style.** Save `get_style_guide`'s `look` as `style.json` (for a brand they gave you by hand, add `"theirs": true`), and put their fonts, logo and reference graphics (`list_attachments`, `read_attachment`) in the scene's `reference/` folder.
- **No style profile? Go.** Never stop to ask for one, and never wait for a reference: write the look from the subject's world, as CORE.md says, and make your best work. In your reply, say where the look came from and offer once to learn their style from a video they like.
- **Content.** Real numbers, names and words come from the transcript and the person. A fact you do not know is a placeholder: say so and ask for it. Never invent a figure to fill a chart.

## 2. Make it
Run `animate.mjs hf status` first. With `installed: true`, make it on HyperFrames: follow `${CLAUDE_PLUGIN_ROOT}/craft/hyperframes.md` in place of steps 2 to 5 below, and it falls back to these steps if it can't run. Otherwise, go on here.
1. Write the treatment (CORE.md). Then read the craft files the job needs.
2. `list` and `looks`, write `look.json`, then `new <scene> <folder> --sheet look.json` (`--look <name> --named` only when the person named one). A brand-new kind of piece starts from the closest scene's structure, not a blank page. Change what the idea needs, not only the props.
3. Draw everything from the time `t` alone (`PP.scene({ duration, frame(t), sound })`), with the style's tokens, in `vw`/`vh` or from `PP.size`, so 9:16 and 1:1 work too. Keep one table of timings at the top.
4. `check <folder>`, fix what it prints, and look at `out/check/sheet.jpg` as `craft/critique.md` says. On anything full-frame or important, get the `art-director` agent's cold read (only the brief, the sheet's path, `no-words.jpg`, and after the render the video).
5. `render <folder> --final`, at the video's size and fps (`--aspect 9:16` for Shorts). It refuses until `check` is clean for exactly those files; CORE.md says what to do:
   - `--format prores` (alpha) for anything that sits over footage;
   - `--format mp4` for a full-screen piece;
   - `--format webm` or `png` when their editor wants those.
6. No sound unless they asked for it or brought their own. A library scene is silent until `props.sound` is true. When there is sound: `sound <file> --hits <the render's hits>` (add `--overlay` for an overlay: only the mix target differs), and fix what it says.
7. `SLOP` means it has an AI-default look. Fix it; only pass `--allow-slop "<their words>"` when the person asked for that look.

## 3. Put it on the footage
- `compose spec.json` lays overlays at their times, joins clips with cuts or a transition scene, does picture-in-picture, and adds music under the voice (`duck`). See the README.
- For a long video, compose only the section (`cut-footage.mjs` `get_section` / `splice`, as the watch skill does), so only that stretch is encoded again.

## 4. Review, then change it from the notes
1. Upload the result as the next version (`upload_file` with `version_of`, or as a new video). Write version notes saying what you made and where.
2. Attach the scene folder as working files (`npx post-prod-mcp zip <folder>`, then `attach_working_files`).
3. Share the review link.
4. Notes come back through `wait_for_feedback`. For each one, `get_frame` its frame (the drawing on it shows what they mean). Change the scene, `check`, render again. Upload V(n+1) to the same link, and reply to each note with what changed.
5. What vague notes mean:
   - "too fast": hold the reading frames longer and take moves to 0.7x; leave the sound's timing to the picture.
   - "feels like slides": enter the next shot through something on screen, not a cut to a new card.
   - "too busy": remove a level; keep the hero.
   - "not punchy": shorten the lead-in and hit harder on the land.

## Remotion and HyperFrames
- A folder with `remotion` in package.json renders with `render <folder>` through `npx remotion render`. Pass `--composition`, `--format prores` for alpha, and `--props`.
- A HyperFrames project (`hyperframes.json`) goes through `animate.mjs hf run --dir <folder> -- <command>`, which keeps telemetry off and refuses sign-in and spending: those are the person's own to run. Its HTML page renders here if the CLI can't run.
- Change their source files the same way, and attach the project as working files. `craft/tools-video.md` has what to do differently in each.

## Credits and limits
The harness renders on the person's own computer, so it costs them nothing in post-prod.io credits. Uploads count as versions and storage, as usual. `--final` takes a few minutes for a 10-second piece: use draft renders while you work.
