---
name: animate
description: Make any animation, motion graphic or edit for a video in the creator's own style with post-prod's harness (titles, lower thirds, subtitles, callouts, charts, counters, maps, diagrams, screen-recording zooms, logo reveals and end screens, countdowns, before/after and split screens, meme captions, 3D, transitions), render it exactly (any size, 9:16 too, with alpha for overlays), put it on the footage, and send it to post-prod.io for review, then change it from the notes. Also renders Remotion and HyperFrames projects.
when_to_use: Phrases like /post-prod:animate, make an animation, make a graphic, motion graphics, lower third, animated title, add a map, a chart, a counter, an end screen, a callout, an intro, a transition, render this Remotion project, render my HyperFrames composition.
model: claude-opus-5-5
argument-hint: "[what to make, or a post-prod.io link]"
allowed-tools: Bash(node:*) Bash(ffmpeg:*) Bash(ffprobe:*) Bash(npx:*) Read Write Edit Glob mcp__plugin_post-prod_post-prod__get_style_guide mcp__plugin_post-prod_post-prod__list_attachments mcp__plugin_post-prod_post-prod__read_attachment mcp__plugin_post-prod_post-prod__get_frame mcp__plugin_post-prod_post-prod__get_review mcp__plugin_post-prod_post-prod__get_transcript mcp__plugin_post-prod_post-prod__get_version_context mcp__plugin_post-prod_post-prod__upload_file mcp__plugin_post-prod_post-prod__attach_working_files mcp__plugin_post-prod_post-prod__create_review_link mcp__plugin_post-prod_post-prod__wait_for_feedback mcp__plugin_post-prod_post-prod__reply_to_note mcp__plugin_post-prod_post-prod__open_link
---

# Animate with post-prod's harness

Good animation needs Opus 5.5 (`claude-opus-5-5`). If you are any other model, say once, in one line: "For good edits, use
Opus 5.5: type /model claude-opus-5-5, then ask again." Then carry on.

The engine and its contract: `${CLAUDE_PLUGIN_ROOT}/harness/README.md`. Read it once before the first scene. Run every command as
`node "${CLAUDE_PLUGIN_ROOT}/bin/animate.mjs" …`; each prints JSON (`ok`, or `code` and `message`).

## 1. Know the creator before drawing anything
- **The video.** When there's a post-prod.io link or a project, open it (`open_link`). Then read:
  - `get_review`: the notes;
  - `get_transcript`: what is said where;
  - `get_frame`: the frames where the graphic goes.
- **Their style.**
  - Save `get_style_guide`'s `look` as `style.json`.
  - Put their fonts, logo and reference graphics (`list_attachments`, `read_attachment`) in the scene's `reference/` folder.
  - With no style profile, ask once whether to learn it from a video they like; never invent one.
- **Content.** Real numbers, names and words come from the transcript and the person. A fact you do not know is a placeholder: say so and ask for it.

## 2. Make it
1. `animate.mjs list` shows the starter library. `new <scene> <folder>` copies the closest one (with the kit, its fonts and a `reference/` folder).
   - Change its `scene.json` props first, then its `frame(t)` code when the idea needs more.
   - A brand-new kind of piece starts from the closest scene's structure, not a blank page.
2. Draw everything from the time `t` alone (`PP.scene({ duration, frame(t) })`), with the style's tokens: `var(--pp-accent)`, `var(--pp-display)` and the rest. Lay it out in `vw`/`vh`, so 9:16 and 1:1 work too.
3. `still <folder> --t <s> --style style.json` at the build-in, the hold and the exit. Look at each one. Fix anything that is off-centre, touching, overlapping, crossing text, outside 5% safe, or more than two lines.
4. `render <folder> --style style.json`, at the video's size and fps (`--aspect 9:16` for Shorts):
   - `--format prores` (alpha) for anything that sits over footage;
   - `--format mp4` for a full-screen piece;
   - `--format webm` or `png` when their editor wants those.
5. `SLOP` means it has an AI-default look. Fix it; only pass `--allow-slop "<their words>"` when the person asked for that look.

## 3. Put it on the footage
- `compose spec.json` lays overlays at their times, joins clips with cuts or a transition scene, does picture-in-picture, and adds music under the voice (`duck`). See the README.
- For a long video, compose only the section (`cut-footage.mjs` `get_section` / `splice`, as the watch skill does), so only that stretch is encoded again.

## 4. Review, then change it from the notes
1. Upload the result as the next version (`upload_file` with `version_of`, or as a new video). Write version notes saying what you made and where.
2. Attach the scene folder as working files (`npx post-prod-mcp zip <folder>`, then `attach_working_files`).
3. Share the review link.
4. Notes come back through `wait_for_feedback`. For each one, `get_frame` its frame (the drawing on it shows what they mean). Change the scene, `still` that moment, and render again. Upload V(n+1) to the same link, and reply to each note with what changed.

## Remotion and HyperFrames
- A folder with `remotion` in package.json renders with `render <folder>` through `npx remotion render`. Pass `--composition`, `--format prores` for alpha, and `--props`.
- A HyperFrames project renders through its own CLI. Its HTML page renders here if that CLI isn't installed.
- Change their source files the same way, and attach the project as working files.

## Credits and limits
The harness renders on the person's own computer, so it costs them nothing in post-prod.io credits. Uploads count as versions and storage, as usual.
