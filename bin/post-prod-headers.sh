#!/bin/sh
# post-prod.io's connection header (31 Oct 2026, Edit with Claude in the Claude desktop app's Code tab, which has no sign-in screen
# for a plugin's MCP server): Claude Code runs this as the server's headersHelper on every connection and sends what it prints.
# The connector download from post-prod.io leaves a personal key in ~/.claude/post-prod.key (one line, cr_live_…). With a key it
# prints the Bearer header; without one it prints {} and Claude Code signs in the usual way (OAuth, /mcp in the terminal), so
# anyone already signed in keeps working. Only a key's own characters ever go out.
# Tested on Windows (Claude Code 2.1.316): Claude Code does not pass variables named like credentials (POST_PROD_KEY) to a
# headersHelper, so the key is read from the file; POST_PROD_KEY still works where it is passed. POST_PROD_CONFIG_DIR moves the
# file's folder (tests).
k="${POST_PROD_KEY:-}"
f="${POST_PROD_CONFIG_DIR:-$HOME/.claude}/post-prod.key"
if [ -z "$k" ] && [ -f "$f" ]; then k=$(tr -d ' \r\n\t' < "$f"); fi
case "$k" in
  *[!A-Za-z0-9_]*) k="" ;;
esac
# its version (3 Nov 2026): the room and the watch loop say when the plugin is out of date (server/plugin-version.js)
root="${CLAUDE_PLUGIN_ROOT:-$(dirname "$0")/..}"
v=$(sed -n 's/.*"version"[^"]*"\([0-9][0-9.]*\)".*/\1/p' "$root/.claude-plugin/plugin.json" 2>/dev/null | head -n 1)
case "$v" in
  *[!0-9.]*|'') v="" ;;
esac
vh=""
[ -n "$v" ] && vh=$(printf '"X-Post-Prod-Plugin":"%s"' "$v")
case "$k" in
  cr_live_*|cr_test_*) if [ -n "$vh" ]; then printf '{"Authorization":"Bearer %s",%s}\n' "$k" "$vh"; else printf '{"Authorization":"Bearer %s"}\n' "$k"; fi ;;
  *) if [ -n "$vh" ]; then printf '{%s}\n' "$vh"; else printf '{}\n'; fi ;;
esac
