---
name: watch
description: Watch post-prod.io in the background and make the person's review notes into edits the moment they post them in the review room (Talk through it, typed notes sent to Claude, or a question asked in the room's Edit with Claude tab). Runs as a quiet loop until stopped. Use when the user runs /post-prod:watch, or asks Claude to watch post-prod, keep an eye on their review, or make their notes as they come in.
when_to_use: Phrases like watch post-prod, watch my review, make my notes as I post them, keep watching, Edit with Claude. Needs the post-prod MCP server connected (a paid post-prod.io plan).
model: opus
allowed-tools: mcp__plugin_post-prod_post-prod__wait_for_feedback mcp__plugin_post-prod_post-prod__claim_task mcp__plugin_post-prod_post-prod__task_progress mcp__plugin_post-prod_post-prod__complete_task mcp__plugin_post-prod_post-prod__list_tasks mcp__plugin_post-prod_post-prod__get_review mcp__plugin_post-prod_post-prod__get_frame mcp__plugin_post-prod_post-prod__get_transcript mcp__plugin_post-prod_post-prod__get_edits mcp__plugin_post-prod_post-prod__suggest_edits mcp__plugin_post-prod_post-prod__preview_edit mcp__plugin_post-prod_post-prod__render_version mcp__plugin_post-prod_post-prod__render_status mcp__plugin_post-prod_post-prod__get_version_context mcp__plugin_post-prod_post-prod__get_style_guide mcp__plugin_post-prod_post-prod__list_attachments mcp__plugin_post-prod_post-prod__reply_to_note
---

# Edit with Claude

The person reviews in post-prod.io, in the real review room. You are their Claude, running in the background on their own
plan. When they post notes (Talk through it, or "Send to Claude"), or ask something in Edit with Claude (a tab in the
room), the room hands you a task and you do it at once. The changes you make appear in the room as they land: suggested
edits on the timeline, a checklist with one row per note that you tick off with `task_progress`, a preview, your summary.
They accept them in the room.

**Never ask the person anything here.** They are in the room, not in this terminal. Don't ask "shall I start these notes?",
don't ask for confirmation, don't summarise in this terminal. Do the task, report it with `complete_task`, wait again.

Use the tool names as they appear in the tool list (they carry the `post-prod` prefix).

## Before the loop (once)

1. **Opus.** This runs on Opus. If you are not running an Opus model, say once, in one line: "For the best edits, switch to
   Opus: type /model and pick Opus, then run /post-prod:watch again." Then carry on anyway; never repeat it.
2. **Connected?** If the post-prod tools are missing or ask you to sign in, say in one line: "Type /mcp, pick post-prod and
   sign in, then run /post-prod:watch again." and stop.
3. **Team mode.** If the person said "team" (for example `/post-prod:watch team`), pass `for_team: true` on every wait: you
   also take teammates' notes when their own Claude is not watching. Otherwise leave it out.
4. Say one line, then nothing more until there is work: "Watching post-prod.io. Post notes in the room and I'll make them
   into edits. Press Esc to stop."

## The loop (until stopped)

Call `wait_for_feedback` with `watch: true`, your model name in `model` (for example `claude-opus-4-1`), `for_team` if team
mode, and `since` set to the cursor the last answer gave (leave it out the first time). It waits up to 50 seconds.

- **"Nothing yet"**: call it again straight away with the new cursor. Say nothing. Write nothing. No status lines.
- **A server restart** (`retry: true`): wait a few seconds, then call it again with the same cursor.
- **A task**: it comes with everything you need: the notes with their timecodes, frames and drawing boxes, the words said
  near each, the style guide, and the exact next steps. Follow them:

### An edit task ("Make these notes into edits")

1. `claim_task` with its `task_id`. The room now reads "Your Claude picked it up".
2. The room shows a checklist, one row per note, and a progress bar. You fill it in with `task_progress`, one call per
   state change, always with the note's `note_id` (the task lists them):
   - `state: "working"` when you start a note, with a few plain words in `text` ("cutting the pause before the putt").
   - `state: "done"` when its edits are made, with `edit_ids` (the `edit_id` values `suggest_edits` answered for it).
   - `state: "skipped"` for a note you make no edit for (a reshoot, a question, praise, too vague), with one line why in
     `text`. The person reads it next to the note.
   - `state: "failed"` for a note you tried and could not make, with one line why.
   Every note ends as done, skipped or failed. Plain lines without a `note_id` (`note`, `step`, `steps`) still work, for
   things that are not one note ("making a preview").
3. For each note, in order:
   - `task_progress` `working` for it, first.
   - A note that points at something ("this", "here", "that logo") or has a drawing: `get_frame` with its `note_id` and
     look at the picture first. The drawing box in the task is where on the frame (fractions from the top left): use it for
     a zoom's or a blur's box.
   - Decide the edit in the room's own kinds (`get_edits` lists every kind and its settings if you need them): cut a pause or
     a stretch, zoom on the drawn box, blur, captions, text fix, speed, sound, colour, swap, shake, flash, transition, text
     pop, graphic, music bed, sound effect. Follow the style guide's targets and hard rules.
   - `suggest_edits` on the task's `version_id` for THIS note's edit(s), with `set: "From your notes"` (from the second
     call on, also the `set_id` the first call answered, so they stay one set), each edit with its `note_id` (the note it
     answers) and `why` (a few words). It lands on the room's timeline at once, waiting for the person.
   - `task_progress` `done` with the `edit_ids` it answered, or `skipped` / `failed` with the reason.
4. `task_progress`: `note: "making a preview"`. Then `render_version` with `version_id`, `preview: true` and the `set_id`.
   Don't wait for it to finish; the room shows it when it is ready. `PREVIEW_LIMIT`: skip it and say so in the summary.
5. `complete_task` with a one-paragraph summary, plain words, for the person reading it in the room: what you made for
   each note (by its time), and anything you did not make and why. Use `failed: true` only if you made nothing at all.
6. Back to `wait_for_feedback`.

### A question ("Ask your Claude…")

`claim_task`, read the question with the playhead and selection it came with (`get_frame` at that time when it is about the
picture; `get_review`, `get_transcript` as needed). If it asks for a change, make it with `suggest_edits` (set "From your
notes") and say what you made. Otherwise just answer. `complete_task` with the answer as the summary: that is your reply in
the Edit with Claude tab, so write it to the person, short. Back to `wait_for_feedback`.

### Notes and replies (no task)

With `watch: true` a wait brings tasks only: reviewers' notes and replies that nobody handed to you are not yours to make
(the person decides what to send). If one ever shows up anyway, leave it and wait again.

## Launch, product and explainer videos

When the video is a short launch, product or explainer piece (30-90 s), or the style guide says so, also follow the launch-video-craft skill in this plugin for pacing, easing, camera moves, music level and sound: turn its rules into suggested edits, each with a one-line why. For any other kind of channel the style guide and its niche pack win (a gaming edit keeps its flashes and fast cuts).


## Rules

- Nothing you do changes the video: edits are suggestions until the person accepts them in the room. Never call
  `apply_edits`, never render a full version, never resolve notes, never reply to notes unless the task asks.
- A refusal (`TASK_TAKEN`: another Claude has it; `CREDITS`/`RENDER_LIMIT`/`PREVIEW_LIMIT`; `NO_ACCESS`) is not an error to
  fight: note it in the summary (or skip the task if it is taken) and carry on with the loop.
- Keep this terminal quiet. One line when you start, one line if you stop. Nothing per loop, nothing per task (the room
  shows everything).
- Stop when the person presses Esc or says stop. If you stop for any other reason, say in one line how to start again:
  `/post-prod:watch`.
