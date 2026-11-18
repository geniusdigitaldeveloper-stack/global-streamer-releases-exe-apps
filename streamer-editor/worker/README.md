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

## Connected to the web app
`SE_EMAIL=you@mail.com SE_PASSWORD=... node worker/connect.mjs --inbox ./inbox --out ./out`
- In the app (Clips): type the recording's file name, pick the AI engine, press Find hooks. The job is queued in Firestore under your account.
- connect.mjs signs in as you, picks up the job, runs edit.mjs on `inbox/<file>` (plus `inbox/<name>.srt|vtt` if present), and writes status and saved file names back.
- Only the file name travels. The video stays on your computer, and the worker only reads files inside the inbox.
- Google-only accounts: use "Set password" in the app first.
- Not yet tested against the live Firestore with a real account.

## Easy install for users
1. Download this folder (GitHub: Code > Download ZIP) and unzip it.
2. Run once: Windows `worker/setup.ps1` (right-click, Run with PowerShell), Mac/Linux `./worker/setup.sh`. It installs Node 22, FFmpeg and whisper.cpp with its speech model.
3. Run `worker/start.ps1` or `./worker/start.sh`. Enter the app email and password. Recordings go in `~/StreamerEditor/inbox`, clips come out in `~/StreamerEditor/out`.
4. Choose the AI engine: Claude Code signed in to your Claude account, or set `ANTHROPIC_API_KEY` before starting.
- Untested: the Windows scripts and the Mac path (written for winget/Homebrew, run here only as a Linux syntax check).
- With whisper.cpp and its model, edit.mjs transcribes the recording itself, so no .srt file is needed.
