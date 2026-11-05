#!/bin/sh
# Sends a direct `npx hyperframes render` back through `animate.mjs hf run`, where a final has to pass check. It runs on every Bash call in every
# session on the person's computer, so it does nothing unless the command is a HyperFrames render, in a folder our flow has been in: their own
# projects are theirs. Exit 2 blocks the call and tells Claude why.
input=$(cat)
case "$input" in *hyperframes*render*) ;; *) exit 0 ;; esac
case "$input" in *animate.mjs*) exit 0 ;; esac
printf '%s' "$input" | grep -Eq 'hyperframes(@[^ "]+)? +(-[^ "]+ +)*render' || exit 0
dir=$(printf '%s' "$input" | sed -n 's/.*"cwd"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | sed 's/\\\\/\//g')
for f in "${dir:-.}"/look.json "${dir:-.}"/.pp-check.json "${dir:-.}"/*/look.json "${dir:-.}"/*/.pp-check.json; do
  if [ -e "$f" ]; then
    echo "Render through the wrapper, so the check counts: node \"\${CLAUDE_PLUGIN_ROOT}/bin/animate.mjs\" hf run --dir <folder> -- render . -o out.mp4" >&2
    exit 2
  fi
done
exit 0
