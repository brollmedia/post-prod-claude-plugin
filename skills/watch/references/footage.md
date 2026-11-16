# Finding ffmpeg in a watch job

Read this when `ffmpeg -version` says it is not found.

Finding ffmpeg (seconds, never minutes): run `ffmpeg -version`. If it is not found, look in these places only, in this order:
- Windows after a winget install: `$LOCALAPPDATA/Microsoft/WinGet/Links/ffmpeg.exe` (in PowerShell `$env:LOCALAPPDATA/Microsoft/WinGet/Links/ffmpeg.exe`). A shell opened before the install has no PATH
  entry for it yet.
- `where ffmpeg` on Windows, `command -v ffmpeg` elsewhere.
- `/opt/homebrew/bin`, `/usr/local/bin`, `C:/ffmpeg/bin`.
Never search the disk recursively for it (Get-ChildItem -Recurse, find /): that takes minutes while the person waits. Once found,
use its full path (or put its folder on PATH for the session) for the rest of the loop. If it is in none of those places, `ask_person`
to install it.
