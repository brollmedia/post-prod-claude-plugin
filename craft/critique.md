# Critique: judging your own frames

Read this when you have a contact sheet in front of you, before you call anything finished.

A model grading its own work is too kind: the person making it sees what they meant, not what is there. So run the measurable checks first, then look as a stranger would, then name faults rather than give a score. Praise is no use here. If you find nothing, you did not look hard enough.

## Order
1. **Measure.** `animate.mjs check <scene>`. Everything it prints is a fact, not an opinion. Fix each line, or be able to say why it is right (a code in the list is allowed to stand when it is a decision, not an oversight).
2. **Over footage, look on the real frame:** `check <scene> --over frame.png`. A plate that clears a checkerboard can still sit on a sign, a face or a busy object. Leave a real gap, and move it if it can't have one.
3. **Look at `out/check/sheet.jpg`,** every tile, including the ones mid-move. Transitions are where text gets crossed and things touch. Then the phone view at the bottom: can you read every word at that size?
4. **Open full size** any frame you are not sure of (`still --t <s>`) and look at the edges of the text, the gaps and the corners.
5. **Sound.** `animate.mjs sound <file> --hits ...`, and read the spectrogram: ticks are thin vertical lines, a whoosh is a hump that rises and falls, an impact is a bright start over a low block. A straight vertical line at the very end of a sound is a click.
6. **Write the faults,** worst first, each as one line a person could fix: what, where (time), why it's wrong, the fix with a number. Fix the worst, then look again.

## When you hand it over
A line each: what was measured, what you only looked at, the weakest shot and why you kept it. For every fix a note asks for, say what stays the same too, so it doesn't come back different.

## The six questions
Each passes or fails, with evidence: a time, a measurement, or what you see in the frame.

1. **Is the hierarchy obvious in half a second?** Cover the sheet with your hand and uncover one tile. The eye lands on one thing. If two things compete, one is too big or the other too small. Fail example: a stat where the label and number are close in size.
2. **Does it say the idea?** Without the voice, does the picture carry the point? Is every number on screen true and from the person? A made-up figure is an automatic failure.
3. **Is the layout deliberate?** Shared edges, even gaps, nothing nearly aligned. Nothing off-centre that should be centred, touching, overlapping or crossing text, at any moment. Empty space looks chosen, not left over.
4. **Is the motion directed?** One hero move, support moving less. A clear start order, not everything at once. Fast off, long settle. Things land and rest. Exits quicker than entrances.
5. **Does it look designed for this video?** Would this exact graphic fit any other video unchanged? If so the look is a template: change the accent, the face or the structure so it could only be this one. Could you tell a machine made it? Say what gives it away.
6. **Does the sound belong?** One gesture per move, on the frame, at a level that sits under the voice. Silence somewhere. Nothing hits with no picture reason.

## Reading the sheet: what bad looks like
- A tile where the type is half-revealed and something crosses it: a transition problem, not a final-frame problem.
- The last tile still shows the graphic on an overlay: it will cut off.
- A big dark soft shape around the words: a smudge. Use a plate, or put the words where the picture is calm.
- The top third empty and everything piled low, or the reverse: move the group to the optical centre, about 46% down.
- Thin lines and small grey words: they disappear at YouTube's bitrate. Thicker, larger, or gone.
- Twelve tiles that look the same: nothing happens. Either it should be shorter, or something should change.

## The second opinion
For anything full-frame or important, ask the `art-director` agent for a cold read: give it only the brief and the sheet's path, not your reasoning. It has not seen you make the thing, so it sees what is there. Fix what it ranks P0 and P1. At most two rounds: then keep the best version, not the last, and say in your reply anything you know is still weak.
