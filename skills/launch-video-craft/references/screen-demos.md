# Screen-recording demos

Read this when turning a rough screen capture, or a set of step-by-step screenshots, into a clean, realistic product demo.

### Capture it smooth in the first place
- **Record real motion, not slideshows.** Drive the real app in a headed browser and capture the window at 60 fps (for example `ffmpeg -f gdigrab -framerate 60` on Windows, `avfoundation` on a Mac), or step the page frame by frame with a virtual clock. A headless screenshot loop or CDP screencast drops frames and reads as laggy.
- **Set the stage before recording:** a 1440 × 900 window at 2× device pixel ratio (and 390 × 844 for phone cuts), first-run tips dismissed, seeded demo data that looks real (a real-looking project, two or three named reviewers, notes with real words), notifications and extensions off, the system cursor hidden (it is drawn in post).
- **Log the cursor, not just the pixels.** Record the pointer position and clicks with timestamps alongside the capture, so the post cursor can follow the real path.
- **Show the opener on share-link demos:** open the link with `?opener=1` so the two halves of the P lock before the room appears.

### Diagnose the source first
- **Check whether it's really video.** Diff consecutive frames. Automated captures are often a slideshow of screenshots held for 1–3 s, which reads as laggy. If so, treat each held frame as a "state", and build all motion yourself.
- **List every overlay to remove:** the recorder's step captions ("Typed…", "Clicked", "wait"), click markers, burnt-in cursors, labels in the margins, and browser-extension clutter (spell-check icons and dots in text fields).

### Build clean plates
- **One clean image per UI state,** with no cursor and no overlays.
- **Patch from a sibling frame** of the same screen where that region is clean (a header from a frame with no caption, say). For small marks on flat backgrounds, use inpainting or a fill from the surrounding colour.
- **For typing, make two plates:** the field empty (with focus) and the field full. Reveal the real typed pixels from the full plate, line by line, roughly one character width at a time, with a caret at the reveal edge.
- **Where text under a burnt-in cursor is damaged,** park the new cursor over the same spot while that text is on screen, and press Return rather than moving the mouse away.
- **Fill missing states** (a player still loading, say) from another frame of the same content, scaled to fit.
- **Synthesise new states in the app's own style when the story needs them** (a new chat message, a reply card, a new version):
  - Sample the real colours, radii and spacing.
  - Match the font size by measuring a real line's width.
  - Reuse real UI pieces (status cards, icons) cropped from other frames.
  - Tell the person which parts are reconstructed.

### Motion
- **Frame it as a window on a wallpaper:**
  - a soft, dark, brand-tinted gradient (the logo black lifting to a faint green glow behind the window) with a little noise;
  - the window at about 86–88% width, with rounded corners (about 16 px), a 0.5–1 px light ring and a large soft shadow;
  - optionally a minimal browser bar with traffic-light buttons and a URL pill reading post-prod.io.
- **Make the camera zoom eased and purposeful:**
  - Zoom about 1.35–1.6× onto the area of action (the note box, the tray, the chat, a track), and back to 1× to re-establish. Go past 1.6× only for a single control, never for reading.
  - Each move takes about 1.0–1.2 s on the asymmetric ease (slow start, fast middle, long settle).
  - Interpolate the zoom on a log scale so the speed feels even.
  - Start the zoom before the cursor arrives, so the camera leads the action.
  - Drift slowly (about 2–3% over a hold) instead of sitting dead still between moves.
- **Keep the zoomed view inside the window.** When zoomed past about 1.3×, clamp the camera so it never shows the edge of the window. Ease the clamp in as the zoom rises.
- **The cursor is a crisp vector arrow** (white with a thin dark outline and a soft shadow), about the system size. It scales with the zoom.
- **Cursor paths:**
  - Glide on the same ease, along a gentle arc (about 10% of the distance), never in a straight robotic line.
  - Moves take about 0.6–1.0 s.
  - Settle on the target for about 150 ms so the hover state shows, then click.
  - Rest the cursor where a person would leave it.
- **Clicks:**
  - The cursor dips to about 88% size over 90 ms and springs back over 200 ms.
  - A thin green ring (about 1.5 px) ripples out and fades over 0.45 s.
- **Hide the idle cursor** (fade it over about 0.35 s) when the focus moves to content playing back.
- **Bring the UI to life where the source is static:**
  - redraw spinners as rotating arcs;
  - scroll chat lists smoothly (about 0.45 s, eased) when new messages arrive;
  - fade replies in over about 0.25 s with a short rise;
  - crossfade state changes quickly (0.12–0.35 s).
- **Typing speed:** about 40–45 characters per second reads as fast but human. Blink the caret (about 2 Hz) only while idle.
- **Pacing:** hold about 1–1.5 s on each result so it can be read. Zoom out on reveals, such as a new version appearing. End on a wide shot, then fade.
- **Export at 60 fps.** Smooth cursor and zoom motion is what sells the "recorded" feel.

### Sound
- **A quiet lofi or ambient bed,** about 5 dB under everything else, faded in over 1 s and out over 2 s.
- **A short, soft mouse-click transient** on every click, varied by about 1 dB.
- **Soft laptop-keyboard typing** for exactly the length of each typed stretch, with 40 ms fades.
- **A slightly heavier key** for Return.
- **A very quiet glass notification** when a reply or result lands.
- **Master** to about −16 LUFS, with a soft clip just under −1.5 dBFS.

### Rendering
- **Draw each frame as a pure function of time:** the plate state, then typing, spinners and scroll, then the camera, then the cursor drawn in output space.
- **Use one resample per frame** (scale plus translate), cubic when enlarging and area-averaged when shrinking, so the UI text stays crisp. Capturing at 2× means a 1.6× zoom never enlarges past the source.
- **Split the render into parallel chunks** and join them losslessly.
