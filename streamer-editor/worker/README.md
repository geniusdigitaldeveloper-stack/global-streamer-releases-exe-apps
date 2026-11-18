# Local worker (runs on the user's own computer, free)

Recording in, finished MP4/MOV clips out. Claude picks the clips and the beats, Hyperframes renders them.

```
node worker/edit.mjs --video rec.mp4 --transcript rec.srt --out out --mode short --aspect 9:16 --res 4k --fps 60 --format mov
```
- Needs Node 22+, FFmpeg, Chrome, and either Claude Code signed in (`--engine claude`) or `ANTHROPIC_API_KEY` (`--engine api`).
- Transcript: `--transcript file.srt|vtt`, or whisper.cpp (`whisper-cli`) if installed. With neither, Claude only sees loud moments and subtitles are skipped.
- Claude cannot see the video. It gets the transcript and the loudest audio moments, so kill picks come from speech and sound, not from the picture.
- Tests: `node worker/test.mjs`. Tested end to end with a stand-in Claude, not yet with a real Claude run.
- Not yet connected to the web app (job hand-off via Firestore is the next step).
