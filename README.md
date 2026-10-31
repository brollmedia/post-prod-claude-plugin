# post-prod.io for Claude Code

A Claude Code plugin that connects Claude Code to post-prod.io (video review with notes on exact frames) and adds one skill, `post-prod-review`, which runs the whole loop: upload a version, share a review link, read the feedback with frames and timecodes, make the change, upload the next version, and check which notes it fixed.

- Server: `https://mcp.post-prod.io/mcp` (remote, HTTP transport, OAuth sign-in in the browser)
- Needs a paid post-prod.io plan (Creator, Creator+ or Agency)
- Docs: https://post-prod.io/mcp and https://post-prod.io/developers
- Support: contact@post-prod.io, privacy: https://post-prod.io/privacy

## Install (for users)

Inside Claude Code:

```
/plugin marketplace add brollmedia/post-prod-claude-plugin
/plugin install post-prod@post-prod
```

(`brollmedia/post-prod-claude-plugin` is the public GitHub repository this folder is published to; see below.) Or from a shell:

```
claude plugin marketplace add brollmedia/post-prod-claude-plugin
claude plugin install post-prod@post-prod
```

Then run `/mcp`, choose `post-prod` and sign in. Ask Claude: "send this render to post-prod for review", or run the skill directly as `/post-prod:post-prod-review`.

Not wanting the plugin? The server alone is one command: `claude mcp add --transport http post-prod https://mcp.post-prod.io/mcp`.

## Edit with Claude: `/post-prod:watch`

Review in post-prod.io and talk to your own Claude about the video, as you would in a chat. It changes the real thing (the
project the video is made from, or the footage itself with ffmpeg) and posts the next version in the room. In the review room
open the **Edit with Claude** tab (key 4): it walks through setup and turns green when your Claude is watching. Needs a paid
Claude plan (Pro or Max); it runs on your plan, on Opus.

### In the Claude desktop app (most people)

The Claude app's **Code** tab is Claude Code inside the app, on your Claude sign-in, with nothing else to install.

1. In the room's Edit with Claude tab press **Download the connector** and open it. It adds this plugin to the Claude app
   (and to Claude Code in a terminal: they share `~/.claude`). On Windows the Claude app needs Git for Windows.
2. Open the Claude app, then **Code**, and choose a folder: the video's project folder when it is made from one (code, an
   editing project), otherwise any folder.
3. Type `/post-prod:watch`, pick **Opus** in the model picker, and send. Leave it open while you review.
4. The first time, if Claude asks you to sign in to post-prod, a browser window opens. (A personal connector download carries
   its own key in `~/.claude/post-prod.key`, so no sign-in is needed with it.)

### Prefer the terminal?

Install and start (Mac and Linux), from the video's project folder if it has one:

```
claude update && claude plugin marketplace add brollmedia/post-prod-claude-plugin && claude plugin install post-prod@post-prod && claude --model opus "/post-prod:watch"
```

Windows PowerShell (5 does not accept `&&`, so run it with semicolons):

```
claude update; claude plugin marketplace add brollmedia/post-prod-claude-plugin; claude plugin install post-prod@post-prod; claude --model opus "/post-prod:watch"
```

Then, once, in Claude Code type `/mcp`, choose `post-prod` and sign in. Next time just run `/post-prod:watch` (or
`claude --model opus "/post-prod:watch"`) from the project folder and leave it open. `/post-prod:watch team` also takes
teammates' notes when their own Claude is not watching.

### What it does

When you post notes in the review room (Talk through it, or Send to Claude), write in the tab's chat, or give it a brief
("What should your Claude know first?", with pictures, clips and links), it picks them up at once:

- **Made from a project** (a folder linked in the tab, the folder it was started in, or one you tell it): it edits the source
  like a normal Claude Code session (the colour, the timing of an animation, the burst), runs the project's render command,
  checks a few frames, and uploads the result as the next version.
- **Footage**: it downloads the exact uploaded file, makes the change with ffmpeg in a temporary folder (the original is never
  touched), checks frames, and uploads the next version.
- **Not sure, or it needs you**: it asks you in the room (`ask_person`), with an answer box and choices, and carries on with
  your answer. It never fakes a change with the room's suggested edits.

The tab shows it as a conversation: your messages, its replies and questions, a line per note, and "V2 is ready" (the room
switches to it). Idle, it costs almost nothing: one wait every ~9 minutes that answers a few bytes, and after two hours with
nothing to do it goes to sleep (type `/post-prod:watch` to wake it). Full guide: https://post-prod.io/tutorials/edit-with-claude

### The connection

`.mcp.json` registers the server with a `headersHelper` (`bin/post-prod-headers.sh`): with a personal key in
`~/.claude/post-prod.key` it sends `Authorization: Bearer <key>`; without one it sends nothing and Claude Code signs in with
OAuth as before. `POST_PROD_MCP_URL` points it at another server (tests). Claude Code does not pass credential-like variables
such as `POST_PROD_KEY` to a headersHelper (seen on Windows, Claude Code 2.1.316), which is why the key lives in a file.

## Publish (for Seth)

The marketplace file is `.claude-plugin/marketplace.json` and lists one plugin whose source is this folder's root (`"./"`), so this folder must be the root of its own repository (Claude Code reads `.claude-plugin/marketplace.json` from the repo root).

1. Create a public GitHub repository, for example `post-prod/claude-plugin` (any name; the owner/name goes into `brollmedia/post-prod-claude-plugin` above). Do not use the private cutroom repo: users must be able to clone it.
2. Copy the contents of this folder (including the hidden `.claude-plugin/` directory) into the root of that repository and push to its default branch.
3. Check it locally before announcing: `claude plugin validate .` in the repository, then `claude plugin marketplace add brollmedia/post-prod-claude-plugin` and `claude plugin install post-prod@post-prod` on a clean machine or account, run `/mcp` and sign in.
4. Post the two install commands above (replace `brollmedia/post-prod-claude-plugin`) on https://post-prod.io/mcp and in the announcement.

Updates: bump `version` in `.claude-plugin/plugin.json` on every release and push. Users get it with `claude plugin update post-prod@post-prod`. Never rename the plugin (`post-prod`); installs are recorded by that name.

Checked on 28 Oct 2026 against the Claude Code docs (https://code.claude.com/docs/en/plugins-reference, /plugin-marketplaces, /plugins/marketplace-reference, /plugins/publish, /skills) and with `claude plugin validate` and a local `marketplace add` plus `install` on Claude Code 2.1.112. Newer manifest fields (`displayName`, `icon`, `documentationUrl`, `supportUrl`, `privacyPolicyUrl`) were left out because that version rejects them.

## Optional: Anthropic's directory

Submitting the plugin to Anthropic's directory is separate and optional: https://claude.ai/directory/manage (needs a paid claude.ai plan). The portal reads `icon`, `documentationUrl`, `supportUrl` and `privacyPolicyUrl` from `plugin.json`; add them then, with the icon at https://post-prod.io/icon-512.png saved into the plugin (for example `assets/icon.png`, `"icon": "./assets/icon.png"`), and run `claude plugin validate --strict` on a current Claude Code first. The server itself is already prepared for the connector directory: see `docs/mcp-directory-listing.md`.

## What is inside

```
.claude-plugin/plugin.json        plugin manifest
.claude-plugin/marketplace.json   the one-plugin marketplace
.mcp.json                         registers the remote MCP server (with the key headersHelper)
bin/post-prod-headers.sh          the connection header: a personal key, else the usual sign-in
skills/post-prod-review/SKILL.md  the review-loop skill
skills/post-prod-first-cut/SKILL.md the first-cut skill
skills/watch/SKILL.md            /post-prod:watch, Edit with Claude
```
