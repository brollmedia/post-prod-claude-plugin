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
case "$k" in
  cr_live_*|cr_test_*) printf '{"Authorization":"Bearer %s"}\n' "$k" ;;
  *) printf '{}\n' ;;
esac
