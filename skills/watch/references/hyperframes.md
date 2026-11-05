# HyperFrames in the watch loop

HyperFrames renders HTML to video on the person's own computer. Read this when a round has a note about a graphic, and when the room asks you to connect it.

## Knowing what is here
Before the loop, and whenever the room says to connect it, run:
`node "${CLAUDE_PLUGIN_ROOT}/bin/animate.mjs" hf status` (add `--install` only when the room asked you to connect it: it fetches their CLI).
Send what it prints as `tools` on your next `wait_for_feedback`, once. Don't send it on later calls.
- `installed: false`, `reason: "no_cli"`: make graphics with the harness as usual.
- `installed: false`, `reason: "node_old"`: the same, and say once that HyperFrames needs Node 22 or newer.
- `signed_in: false` is fine. Local renders need no account.

## Who owns each note
Sort a round before you start, and give every note one owner. Tell the room straight away: `task_progress` with its `note_id`, `state: "working"`, `engine` (`"hyperframes"` or `"claude"`) and `engine_reason`, one short line such as "a cut, not a graphic". The first value stands, so never move a note to the other owner mid-round. If HyperFrames fails on one, finish it with the harness and say so in the reply.

| HyperFrames, when `installed` | You, as today |
|---|---|
| Any new title, lower third, callout, caption or text on the picture, however simple | A cut, trim, re-order, pause, take or pacing change |
| A chart, map, counter, animation or transition | Sound, music or a mix |
| The look of something made in HyperFrames, or anything in a folder with `hyperframes.json` | Colour, a crop, a zoom or anything done to the footage itself |
| | A graphic in an existing harness scene: change it there |
| | Anything you are not sure of |

A note in both columns is yours: one owner, and it stays with the footage. A round with both kinds is still one version and one reply: cuts first, then graphics on top of the new timing.

## Making it
Read `${CLAUDE_PLUGIN_ROOT}/craft/hyperframes.md` and follow it. Where their guidance and `craft/CORE.md` differ, CORE.md wins: the 48 px floor, the safe areas, our own synthesised sound, and no downloaded music. Then put it on the video as `references/effects.md` says.

## What is theirs
Never run `auth login`, `billing`, `cloud`, `publish`, `reverse`, `templates` or `feedback`. The wrapper refuses them. They use the person's own account, or upload their work. When a job needs one, say so in the round's one reply, in the words the wrapper gives you, and make the local version instead:
- `HF_NEEDS_ACCOUNT`: "That needs a HyperFrames account. To connect yours, run `npx hyperframes auth login` in your own terminal: it opens your browser."
- `HF_NEEDS_PRO`: "That needs a paid HyperFrames plan or credits on your own account, so I made it locally instead."
- `HF_PERSONS_OWN`: pass on its sentence as it is.
Never ask for a token or a key, and never put one in a note, a reply or a file.

## A message from the room: "Connect HyperFrames"
Run `hf status --install`, send the result as `tools` on your next `wait_for_feedback`, and reply in one line with what is ready. If `signed_in` is false, say that local renders work now and that signing in is optional: they run `npx hyperframes auth login` in their own terminal. Don't sign in for them.
