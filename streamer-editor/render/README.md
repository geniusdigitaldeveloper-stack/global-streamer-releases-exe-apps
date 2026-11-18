# Render toolkit (Hyperframes, built in)

Turns a source video plus an edit plan (EDL json) into an edited MP4: cut to the clip, motion graphics,
effects (shake, zoom punch, flash, glitch, vignette), auto subtitles in the fixed style
(Poppins SemiBold, water blue `#38BDF8`, English words italic, Arabic in Traditional Arabic), and sound effects.

- `compose.mjs`  pure function: EDL -> Hyperframes HTML. Templates: title card, lower third, HOOK badge, kill callout,
  captions, progress bar, outro. Deterministic (see `test.mjs`).
- `render.mjs`   CLI. `node render.mjs --video source.mp4 --edl edit.json --out out.mp4 --fps 60`.
  Needs Node 22+, FFmpeg and Chrome. Uses the free open-source Hyperframes CLI (pinned version). No API key.
  Sound effects are synthesised locally with FFmpeg (no files to license).
- `vendor/`      GSAP and Poppins, bundled so rendering never needs the network.

Tested here: 12s 9:16 clip, 720x1280, 30fps, rendered in about 36s with video, audio and all overlays.

NOT done yet: nothing calls this renderer from the app. It still needs a worker (GitHub Actions or a small server),
somewhere to store the finished video, and the AI step that writes the EDL from the user's footage.
Arabic uses a fallback font on Linux because Traditional Arabic is a Microsoft font.

## Output file (MP4 / MOV)
`node render.mjs --video in.mp4 --edl edit.json --out out.mov --res 4k --fps 120 --format mov`
- Format: MP4 or MOV (same H.264 + AAC, MOV is a remux with no quality loss).
- Resolution: 1080p minimum, 2K (1440p), 4K. If 4K would exceed the time budget (`--max-seconds`, default 1500) it is made in 2K, then 1080p; the result reports `resolutionUsed` and a `note`.
- Frame rate: 30 to 200. Measured on 4 cores: 1080p about 0.11 s/frame, 4K about 0.36 s/frame.
- Tested: 4K@30 MP4 and MOV, and a 200 fps request falling back to 1080p. A fps above the source's repeats frames; 4K from a small source is upscaled.
