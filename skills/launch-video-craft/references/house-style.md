# post-prod.io house style

Read this only when the film is about post-prod.io itself. Everyone else's film is in their own look.

post-prod's look since the 1 Nov 2026 room redesign. It sets the tone for everything below: when a rule further down allows a range, take the calmer end.

- **Restraint reads as premium.** Fewer things on screen, quieter states, one move at a time. If a frame needs a caption to explain where to look, the frame has too much in it.
- **Dark only.** The base is the logo black (#0B0D0C) with soft, slightly green-tinted greys. No light backgrounds, no light-mode UI.
- **One green.** Brand green (#43DD97) marks the one thing that matters in a shot: the primary button, the active state, the key word, the logo. Everything else is ink and grey.
- **Type:** Instrument Sans for everything readable, display sizes tracked tight (−0.03 to −0.045 em); JetBrains Mono with tabular figures for timecodes, counts and file details.
- **Hairlines, not boxes.** Panels and cards separate with 0.5–1 px rings at about 9–15% white, never heavy borders or black drop shadows.
- **Quiet states.** Hover, pressed and selected are white at 4–12% over the surface; selected adds a thin green ring. Show them. Let the cursor rest on a control for about 150 ms before clicking so the hover state is seen.
- **One UI curve.** Interface moves (menus, tabs, rows, toggles) use `cubic-bezier(.23, 1, .32, 1)` at 150–300 ms. Camera and big moves use the asymmetric ease in section 2.
- **Our icons.** The room's icons are cut on the logo's diagonal (32°): on hover the two halves part slightly, and the lower half turns green when a tool is on. Keep that detail visible in close-ups. Never swap in stock icon sets in a graphic.
- **The real logo, always.** Use the logo file (the green P with its diagonal cut on black). The logo moment is the share-link opener: the two halves slide in along the cut, slow down, lock, and a thin light glints along the seam (section 2, Logo moment). Never draw a look-alike P.
- **Each view keeps its own look.** Notes is the picture and the notes; Edits is the editor with its tracks; Review with voice is the recording booth (everything else dims, a red REC light); Edit with Claude is a conversation. A demo stays in one view per beat and changes view with a quick crossfade (about 250 ms), never a cut mid-move.
