#!/usr/bin/env node
// Streamer Editor renderer: source video + EDL json  ->  edited MP4 (cut, motion graphics, effects, subtitles, sound effects).
// Runs anywhere with Node 22+, FFmpeg and Chrome (for example a GitHub Actions runner). Free: uses the open-source Hyperframes CLI.
//
//   node render.mjs --video source.mp4 --edl edit.json --out out.mp4 [--fps 60] [--quality looks|delivery|draft]
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, copyFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { buildComposition } from "./compose.mjs";

const HF_VERSION = "0.9.67"; // pinned so renders stay identical over time
const here = dirname(fileURLToPath(import.meta.url));

function arg(name, dflt) {
  const i = process.argv.indexOf("--" + name);
  return i > -1 ? process.argv[i + 1] : dflt;
}
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  if (r.status !== 0) throw new Error(`${cmd} failed (${r.status}): ${(r.stderr || r.stdout || "").slice(-600)}`);
  return r.stdout;
};

// Sound effects are synthesised locally with FFmpeg, so there is nothing to license or download.
function makeSfx(dir) {
  mkdirSync(dir, { recursive: true });
  const ff = (out, args) => run("ffmpeg", ["-y", "-loglevel", "error", ...args, join(dir, out)]);
  ff("hit.wav", ["-f", "lavfi", "-i", "sine=frequency=58:duration=0.55", "-f", "lavfi", "-i", "anoisesrc=d=0.18:c=pink:a=0.8", "-filter_complex", "[0]afade=t=out:st=0.04:d=0.5,volume=3[a];[1]lowpass=f=2400,afade=t=out:st=0:d=0.18[b];[a][b]amix=inputs=2:duration=longest,alimiter=limit=0.95"]);
  ff("ping.wav", ["-f", "lavfi", "-i", "sine=frequency=1320:duration=0.4", "-af", "afade=t=in:d=0.005,afade=t=out:st=0.02:d=0.38,volume=0.8"]);
  ff("whoosh.wav", ["-f", "lavfi", "-i", "anoisesrc=d=0.7:c=white:a=0.5", "-af", "highpass=f=500,lowpass=f=7000,afade=t=in:d=0.3,afade=t=out:st=0.3:d=0.4"]);
}

export function renderEdit({ video, edl, out, fps = 30, quality = "looks", keep = false }) {
  const spec = typeof edl === "string" ? JSON.parse(readFileSync(edl, "utf8")) : edl;
  const comp = buildComposition(spec);
  const proj = join(tmpdir(), `se-render-${process.pid}-${Date.now()}`);
  mkdirSync(join(proj, "assets", "fonts"), { recursive: true });
  copyFileSync(resolve(video), join(proj, "assets", "source.mp4"));
  copyFileSync(join(here, "vendor", "gsap.min.js"), join(proj, "assets", "gsap.min.js"));
  for (const f of ["poppins-600.woff2", "poppins-600-italic.woff2"]) copyFileSync(join(here, "vendor", "fonts", f), join(proj, "assets", "fonts", f));
  makeSfx(join(proj, "assets", "sfx"));
  writeFileSync(join(proj, "index.html"), comp.html);
  writeFileSync(join(proj, "meta.json"), JSON.stringify({ id: "se-edit", name: "Streamer Editor edit" }));
  writeFileSync(join(proj, "hyperframes.json"), JSON.stringify({ paths: { blocks: "compositions", components: "compositions/components", assets: "assets" }, media: { autoProxy: true } }));
  mkdirSync(dirname(resolve(out)), { recursive: true });
  try {
    const r = spawnSync("npx", ["--yes", `hyperframes@${HF_VERSION}`, "render", proj, "-o", resolve(out), "-f", String(fps), "-q", quality, "--quiet"], { encoding: "utf8", env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: "1", DO_NOT_TRACK: "1" } });
    if (r.status !== 0) throw new Error("hyperframes render failed: " + (r.stderr || r.stdout || "").slice(-1200));
  } finally {
    if (!keep) rmSync(proj, { recursive: true, force: true });
  }
  return { out: resolve(out), width: comp.width, height: comp.height, duration: comp.duration, counts: comp.counts, project: keep ? proj : undefined };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const video = arg("video"), edl = arg("edl"), out = arg("out", "out.mp4");
  if (!video || !edl || !existsSync(video) || !existsSync(edl)) {
    console.error("Usage: node render.mjs --video source.mp4 --edl edit.json --out out.mp4 [--fps 60] [--quality looks|delivery|draft]");
    process.exit(2);
  }
  const res = renderEdit({ video, edl, out, fps: Number(arg("fps", 30)), quality: arg("quality", "looks"), keep: process.argv.includes("--keep") });
  console.log(JSON.stringify(res));
}
