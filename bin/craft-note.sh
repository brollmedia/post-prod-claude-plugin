#!/bin/sh
# The note the plugin leaves at the start of a session and after a compaction (the hook's output goes into context). Small on purpose:
# it runs in every session on the person's computer, including ones that have nothing to do with video.
root="${CLAUDE_PLUGIN_ROOT:-$(dirname "$0")/..}"
printf '%s\n' "post-prod: when you make any graphic, title, animation, on-screen text or sound for a video, first read $root/craft/CORE.md, even with no reference or style guide. In a post-prod watch loop, re-read it before each such job."
