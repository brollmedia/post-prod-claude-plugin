---
name: post-prod-first-cut
description: Make a first cut of a video in post-prod.io from a description of the edit, following the channel's style guide, and hand it to the team as suggested edits they accept, change or reject in the review room. Use when the user asks to edit, cut down, tighten, auto-edit, make a first cut or rough cut of a video, add zooms or captions throughout, or set up or change their channel's editing style.
when_to_use: Phrases like make a first cut, edit this for me, cut the fluff, tighten this up, add zooms and captions, edit it like this video, set up my style guide, edit these clips together, make one video from these files. Needs the post-prod MCP server connected (a paid post-prod.io plan).
---

# First cut with post-prod.io

You plan the edit; post-prod.io measures the footage, runs a fixed formula, holds the style guide, previews and renders.
Nothing you do changes the video: every edit lands in the review room as a suggestion the team accepts, tweaks (by
talking it through or editing) or rejects. Use the tool names as they appear in the tool list (with the `post-prod`
prefix). If the tools are missing or ask you to sign in, tell the user to connect `post-prod` and sign in.

## Several files? Join them first

If the footage is more than one file, order them (ask the user if the order isn't clear: the order is the story), then call
`assemble_clips` with the project and the clips (each a `version_id`, with `in` and `out` seconds if only a stretch of it
belongs). It joins them with hard cuts into one new file in the same project and never touches the originals. When
`render_status` says it is done, run the first cut (everything below) on the **new version**, not on a source clip. It counts
as one of the team's daily renders; if it answers `RENDER_LIMIT`, `RENDER_BUSY` or `ASSEMBLY_TOO_LONG`, say so as it is.

## 1. The style guide comes first

Call `get_style_guide` for the workspace (and channel, if the user has more than one).

**No guide yet: run the brief.** Ask a few questions at a time, never a wall, and offer defaults so a busy user can
just say "yes":
1. What is it: platform (YouTube long-form, Shorts, TikTok, a client ad), target length, niche (gaming, talking head,
   podcast, tutorial, vlog), who watches it.
2. References: "Send 1 to 3 videos whose editing you want this to feel like, and one you don't." Uploaded references are
   measured with `measure_reference` (cuts a minute, shot length, lulls). Look at a few frames of each with `get_frame`
   for what numbers can't see: caption style, zoom strength, graphics. Tell the user what you measured, in numbers.
3. Pace and taste, as choices with the references' numbers as the defaults: cut tightness (natural, tight, jump-cut),
   zooms (none, subtle, punchy; how many a minute), captions (none, plain, word highlight; font, colour, position,
   words a line), sound effects (none, light, heavy), music (their own tracks, always under the voice). Show real
   options from `list_presets` rather than describing them: "here are four caption styles that suit Fortnite channels"
   (`kind: captions`, `niche: gaming_fortnite`). A niche or game **pack** is the starting point (its presets, its typical
   rates, its planner weights); say how much data stands behind it (a pack for Fortnite, GTA, Call of Duty, Minecraft or
   podcasts is editorial defaults, and the answer says so; Roblox and the broad niches are descriptive of what editors
   in that niche do, with the number of videos and channels). Save the pick as the guide's `pack`, and specific looks as
   `presets` `{ allow, deny }`. A preset marked not renderable yet can still be chosen; the room gets the closest look
   it can draw today, and `plan_cut` lists what it could not draw.
4. Hard rules: anything never to cut, keep the intro, sponsor segments left alone, words to bleep, effects never to use.
5. Their files: logo, sound effect pack, music. Uploaded once, reused.

Read the answers back in plain words, then `save_style_guide`. Never save or change a guide the user hasn't said yes to.

## 2. Measure the footage

`get_cut_signals` on the version (starts the read if needed; check back every 20 to 30 seconds). For speech, also
`find_cleanup` (ums, stutters, restarts, silences; `cleanup_status` to wait). These cost a few cents from the
workspace's AI allowance; the judgement you add costs them nothing extra.

## 3. Run the formula

`plan_cut` with the guide's preset. It uses the workspace's saved style guide by itself and says which at the top ("Using your style guide ..."); `ignore_style_guide` plans without it, `style_guide_name` picks one when there is one per channel. If Clean-up has been run, its cuts are already on the version and are not proposed again (the totals say how many): send only what the plan lists. It returns candidate cuts,
zooms, captions, highlight words, sound effects and gameplay to keep, each with a score and the numbers behind it, and
totals (new length, edits a minute, the effects stack against its cap). The formula is fixed code: the same footage
gives the same plan, and each zoom, sound effect, caption stretch and camera move carries its preset (id and
parameters; the pack and the guide's allow and deny lists choose it, never repeating one back to back). Each candidate says whether its rule is **editorial** (a pacing default the guide and the team's
choices can move) or from **Retti's data** (long-form only, correlation only).

## 4. Add the judgement numbers can't

Read the plan against `get_transcript`, and look at frames with `get_frame`:
- **Keep the story.** Never cut a sentence the next one depends on, a setup whose payoff stays, or the reason the video
  exists. Cut repeats, tangents that never pay off, and setup with no payoff, and say which.
- **Gameplay.** For each "keep" candidate, look at 2 or 3 frames (kill feed, scoreboard, a win or death screen). Keep it
  if something happens; mark it for a cut if it's a menu, a loading screen or a wander.
- **Zooms.** A zoom the plan already aimed carries its `fx.rect` (the face cam for the speaker's stress, where the screen changes for a held-still shot; its why says which): check it against a frame. A zoom without one needs its box from the frame: the face for a reaction, the action for gameplay. When the plan says it found a face cam, captions are already set off it.
- **Peaks.** On a screen recording a peak is usually the page changing: read its label (screen change, section start, loud sound, fast talking, excited) before calling a moment exciting.
- **Move or drop** any candidate the content argues against, and add one the numbers missed if you can name why.
- **Obey the hard rules.** The formula already vetoes them; don't add them back.
- Never claim an edit improves retention. Say what happens in the video and why the edit fits the guide.

## 5. Send it to the room

`suggest_edits` with every edit you keep, in one call if you can (up to 300), with `set: "First cut"` and each edit's
`why` (the formula's numbers plus your one-line reason). Sound effects and music are edit kinds (`sfx`, `music`) that use
only files already attached to the project (`list_attachments`; `fx.file` is the attachment id): build them from the
plan's `data.by_kind.sfx` and `.music` (the preset's `render_fx` has the gain and ducking), or tell the user the project
has no sound or song to use. Highlight words and camera moves have no edit kind yet: list them for the user. Tell the user where it landed (the tool's link), how many edits of each
kind, the new length, and what you chose not to do.

If the preview option is in `render_version`, offer a quick low-quality preview of the whole first cut before anyone
accepts anything. The full-quality render happens only after the team accepts the edits, as a new version.

## 6. Learn from the team

After the team has been through the set, `style_feedback` on the version summarises what they accepted and rejected per
kind ("You rejected 9 of 11 zooms during gameplay"). Offer the matching guide change in plain words ("Zoom less during
gameplay?") and call `update_style_guide` only on a yes, with the reason.

## 7. Hand it to an editor

When the team has accepted the edits and an editor wants to finish in their own app, `export_timeline` (the version id) gives
download links to the accepted cut as a Premiere Pro or DaVinci Resolve project (.xml), a Final Cut Pro one (.fcpxml) or an
EDL with an SRT, and how to open each (File > Import in Premiere; File > Import > Timeline in Resolve; File > Import > XML
in Final Cut). It is the cut the render would make, with a marker on every edit saying why. Say what it could not carry (the
"Not exported" markers: blurs, colour looks, swap shots, text fixes) and that the editor relinks to their original footage
by name, since the video is not inside the file. Edits still waiting for a yes are not in it.

## Launch, product and explainer videos

When the video is a short launch, product or explainer piece (30-90 s), or the style guide says so, also follow the launch-video-craft skill in this plugin for pacing, easing, camera moves, music level and sound: turn its rules into suggested edits, each with a one-line why. For any other kind of channel the style guide and its niche pack win (a gaming edit keeps its flashes and fast cuts).


## Rules

- Suggestions only. Never accept edits, render, share links or change the guide without the user's say-so.
- Never cut more than the formula allows (it caps cuts at a quarter of the words) and never inside a sentence.
- Long-form and Shorts are different: Retti's data is long-form only; say so if the user is making Shorts.
- If a tool answers with a plan, allowance or permission error, report it as it is. Don't retry in a loop.
