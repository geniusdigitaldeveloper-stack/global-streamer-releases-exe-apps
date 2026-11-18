#!/usr/bin/env node
// Streamer Editor local worker. Runs on the user's own computer. Needs Node 22+, FFmpeg, Chrome (Hyperframes) and one AI engine:
//   --engine claude   Claude Code CLI, signed in with the user's own Claude account (default if `claude` is installed)
//   --engine api      the user's own Anthropic API key in ANTHROPIC_API_KEY
// Nothing is uploaded anywhere except the transcript text and loudness list sent to the chosen Claude engine.
//
//   node edit.mjs --video rec.mp4 [--transcript rec.srt] [--out out] [--mode short|long] [--aspect 9:16]
//                 [--res 1080p|1440p|4k] [--fps 60] [--format mp4|mov] [--name "Streamer"] [--analyze-only]
import { spawnSync, execFileSync } from "node:child_process";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseVtt } from "../pipeline/lib.mjs";
import { topPeaks, buildEditPrompt, parseEdit, buildEdl } from "./lib.mjs";
import { renderEdit } from "../render/render.mjs";

const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i > -1 ? process.argv[i + 1] : d; };
const has = (n) => process.argv.includes("--" + n);
const log = (m) => console.error("[worker] " + m);
const have = (cmd) => spawnSync(cmd, ["--version"], { stdio: "ignore" }).status === 0;

const video = arg("video");
if (!video || !existsSync(video)) { console.error("Usage: node edit.mjs --video rec.mp4 [--transcript rec.srt] [--engine claude|api] ..."); process.exit(2); }
const out = resolve(arg("out", "out")); mkdirSync(out, { recursive: true });

const duration = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video], { encoding: "utf8" })) || 0;
if (!duration) { console.error("Cannot read the video."); process.exit(1); }

// loudness per second (RMS dB), used to find shouts, explosions and hype moments
function loudness() {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", video, "-vn", "-ac", "1", "-ar", "16000", "-af", "asetnsamples=16000,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 28 });
  return (r.stdout || "").split("\n").filter((l) => l.includes("RMS_level=")).map((l) => parseFloat(l.split("=")[1]));
}

// transcript: a subtitle file, or whisper.cpp when installed. Without either, Claude works from loudness only.
function transcript() {
  const f = arg("transcript");
  if (f && existsSync(f)) return parseVtt(readFileSync(f, "utf8"));
  if (have("whisper-cli")) {
    const wav = join(out, "audio.wav");
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", video, "-vn", "-ac", "1", "-ar", "16000", wav]);
    const model = process.env.WHISPER_MODEL || "ggml-base.bin";
    spawnSync("whisper-cli", ["-m", model, "-f", wav, "-ovtt", "-of", join(out, "audio")], { stdio: "ignore" });
    if (existsSync(join(out, "audio.vtt"))) return parseVtt(readFileSync(join(out, "audio.vtt"), "utf8"));
  }
  log("no transcript (give --transcript file.srt or install whisper.cpp): subtitles are skipped and Claude only sees loud moments");
  return [];
}

async function ask(prompt) {
  const engine = arg("engine", have("claude") ? "claude" : "api");
  if (engine === "claude") {
    const r = spawnSync("claude", ["-p", "--output-format", "text"], { input: prompt, encoding: "utf8", maxBuffer: 1 << 26 });
    if (r.status !== 0) throw new Error("claude_cli_failed: " + (r.stderr || "").slice(-300));
    return r.stdout;
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("no_key: set ANTHROPIC_API_KEY or sign in to Claude Code");
  const resp = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5", max_tokens: 4000, messages: [{ role: "user", content: prompt }] }) });
  if (resp.status === 401 || resp.status === 403) throw new Error("bad_key");
  if (!resp.ok) throw new Error("claude_" + resp.status);
  return (await resp.json()).content.map((b) => b.text || "").join("");
}

log("reading audio");
const peaks = topPeaks(loudness());
const cues = transcript();
log(`${Math.round(duration)}s video, ${cues.length} transcript lines, ${peaks.length} loud moments; asking Claude`);
const items = parseEdit(await ask(buildEditPrompt({ mode: arg("mode", "short"), duration, cues, peaks })), duration);
writeFileSync(join(out, "plan.json"), JSON.stringify(items, null, 2));
log(`Claude chose ${items.length} clip(s); plan saved to plan.json`);
if (has("analyze-only")) process.exit(0);

const fmt = arg("format", "mp4"), o = { aspect: arg("aspect", "9:16"), res: arg("res", "1080p"), name: arg("name") };
const results = [];
items.forEach((it, i) => {
  const file = join(out, `clip-${String(i + 1).padStart(2, "0")}.${fmt}`);
  log(`rendering ${i + 1}/${items.length}: ${it.title}`);
  results.push(renderEdit({ video, edl: buildEdl(it, cues, o), out: file, fps: Number(arg("fps", 60)), format: fmt, quality: arg("quality", "looks") }));
});
console.log(JSON.stringify(results.map((r) => ({ file: r.out, size: `${r.width}x${r.height}`, fps: r.fps, seconds: r.duration, note: r.note })), null, 2));
