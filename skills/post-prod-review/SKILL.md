---
name: post-prod-review
description: Get a video cut reviewed in post-prod.io and act on the notes. Use after rendering or exporting a video, or when the user asks to send a cut for review, share a review link, read or apply feedback or notes on a video, upload the next version, or check whether the notes were fixed.
when_to_use: Phrases like send this cut for review, share a review link, what did the client say, apply the notes, upload v2, did that fix the notes. Needs the post-prod MCP server connected (a paid post-prod.io plan).
---

# Review loop with post-prod.io

post-prod.io holds video reviews: notes sit on an exact frame, with the file's own timecode. This skill runs the loop end to end with the post-prod MCP tools. Use the tool names as they appear in the tool list (they carry a `post-prod` prefix).

If the post-prod tools are missing or ask you to sign in, tell the user to run `/mcp`, pick `post-prod` and sign in. Connecting needs a paid post-prod.io plan. Do not try to work around a refusal.

## The loop

1. **Find the project.** `list_projects` shows projects, files and their latest `version_id`s. Use the project the user names. If it is unclear which one, ask. Do not create guesses.

2. **Upload the version.** Call `upload_file` with `project_id`, `file_path` (where the render is on this computer) and `size_bytes` (exact; from `stat -c %s`, `wc -c` or PowerShell `(Get-Item f).Length`). For the next version of a file that is already in the project, also pass `version_of` (the previous `version_id`) so it becomes version N+1 and not a new file. The answer holds a one-time link and a `curl` command: run that command exactly as given, from the folder of the file. Then wait until the version is ready: `get_activity` (pass `since` with the cursor from the last call) lists "version ready"; `list_projects` shows the new `version_id` and status. A video takes a short while to process; poll every 20 to 30 seconds, not faster.

3. **Share the link.** `create_review_link` with `version_id` makes a link that opens without an account, where people leave notes on the frame and approve. Optional: `password`, `expires_days`, `allow_download`, `can_approve`, `label`. Give the user the link. Do not set a password or download option unless asked.

4. **Wait for feedback.** Reviewers need time, so do not poll in a tight loop. Tell the user the link is out and what you will check. When they say feedback is in, or when you are asked to check: `get_activity` with the saved `since` cursor shows new notes, replies, resolved notes and approvals. A tool that waits for feedback (`wait_for_feedback`) is coming; use it if it is in your tool list, otherwise use `get_activity`.

5. **Read the notes.** `get_review` with the `version_id` returns open and resolved notes with author, frame, timecode, labels, suggested edits, mistake checks and approval status, and the notes carried over from the version before. Each note sits on one frame, the moment the reviewer was at when they made it (a voice note: where they stopped and talked, or the words they talked over); it has a range (→) only when they marked one, so treat the rest as that frame, not a stretch. Tags on a note: **important** (the reviewer flagged it: do it first, get it right) and **not for Claude** (the team took it off Claude's list in the room's Claude tab: leave it to them unless the user asks you for it by name). Carried-over notes are given at their moment in this version (or "that part was cut") with the fix check's verdict: *looks fixed in V<n>*, *still there* or *can't tell*, each with a reason. Before judging a note, look at the picture: `get_frame` with `note_id` shows the frame the note is on (a carried note at its moment in this version). Use `get_transcript` when a note is about what is said (`make_transcript` starts one if none exists). Sort the notes into what you can do, what needs the user's decision, and what you disagree with. Say so; do not silently skip a note.

6. **Make the change.** Apply the notes that you can in the project you are working in (the edit script, the composition, the render settings). Use each note's frame and timecode to find the moment; for a carried note, its time in this version, never the old one. For an editor working in Premiere, Resolve, Final Cut or Avid, `export_markers` returns the notes as a marker file. Do not mark a note resolved yet.

7. **Upload the next version.** Render again and repeat step 2 with `version_of` set to the version the notes were on. Then `reply_to_note` for notes where a short answer helps (what you changed, or why you did not). Replies email the note's author, so keep them short, factual and only where useful; do not reply to every note by reflex.

8. **Check the fixes.** `check_fixes` with the new `version_id` runs the check of which notes from the version before the new cut fixed (about a minute), then `did_it_get_fixed` returns each earlier note as looks fixed in V<n>, still there, or can't tell, with a reason. `compare_versions` shows where each noted moment is now in the new cut (same place, moved or cut). Report it in those words: "looks fixed in V3", "still there (the logo is still blue)", "can't tell". Never say a note is fixed because you uploaded a version or because the check says it looks fixed: the check is a pointer, and a note is done only once someone resolves it. Only call `resolve_note` for notes the user wants closed, or that you and the check agree are fixed after looking at the frame. Share the new version with `create_review_link` again if the user asks.

Repeat from step 4 until the version is approved. Do not call `set_approval` yourself unless the user tells you to; approval belongs to the reviewers.

## Rules

- Everything here changes the user's real workspace and can email people. Upload, link creation, replies, resolving and approvals each need the user's say-so in the request or in the conversation. Reading is always fine.
- A file path and exact byte size are needed for `upload_file`. Never invent a size; get it from the file.
- Keep the `since` cursor from `get_activity` and the `version_id` of each version in your notes so the loop survives a long wait.
- If a tool answers with a plan or permission error, report the message to the user as it is. Do not retry in a loop.
- Webhooks (`watch_events`) are for the user's own automation. Do not set them up unless asked.
