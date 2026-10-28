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

(`brollmedia/post-prod-claude-plugin` is the GitHub repository this folder is published to; see below.) Or from a shell:

```
claude plugin marketplace add brollmedia/post-prod-claude-plugin
claude plugin install post-prod@post-prod
```

Then run `/mcp`, choose `post-prod` and sign in. Ask Claude: "send this render to post-prod for review", or run the skill directly as `/post-prod:post-prod-review`.

Not wanting the plugin? The server alone is one command: `claude mcp add --transport http post-prod https://mcp.post-prod.io/mcp`.

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
.mcp.json                         registers the remote MCP server
skills/post-prod-review/SKILL.md  the review-loop skill
```
