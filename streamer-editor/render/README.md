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
