// Runs inside GitHub Actions. Fetches captions, asks Claude for hooks, writes the result to Firestore.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, mkdirSync } from "node:fs";
import admin from "firebase-admin";
import { parseVtt, chunkTranscript, buildPrompt, parseClips } from "./lib.mjs";

const { UID, JOB_ID, URL: VIDEO_URL, MODE, FIREBASE_SERVICE_ACCOUNT, CLAUDE_MODEL = "claude-sonnet-5-5" } = process.env;
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)) });
const ref = admin.firestore().doc(`users/${UID}/jobs/${JOB_ID}`);
const set = (d) => ref.update(d);

// Every user brings their OWN Anthropic key. It is read here with the admin SDK (users/{uid}/private/anthropic),
// never from a shared secret, never logged, and never sent anywhere except api.anthropic.com.
let USER_KEY = "";

async function claude(prompt) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": USER_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
  });
  if (r.status === 401 || r.status === 403) throw new Error("bad_key");
  if (!r.ok) throw new Error("claude_" + r.status);
  const j = await r.json();
  return j.content.map((b) => b.text || "").join("");
}

try {
  const keySnap = await admin.firestore().doc(`users/${UID}/private/anthropic`).get();
  USER_KEY = keySnap.exists ? String(keySnap.data().key || "") : "";
  if (!USER_KEY) { await set({ status: "error", msg: "no_key" }); process.exit(0); }
  await set({ status: "analyzing", msg: "fetching_captions" });
  mkdirSync("out", { recursive: true });
  const y = spawnSync("yt-dlp", ["--skip-download", "--write-subs", "--write-auto-subs", "--sub-langs", "en.*,ms.*,id.*,ar.*", "--sub-format", "vtt", "--print", "duration", "-o", "out/%(id)s", VIDEO_URL], { encoding: "utf8" });
  const duration = parseFloat((y.stdout || "").trim().split("\n").pop()) || Infinity;
  const vtt = readdirSync("out").find((f) => f.endsWith(".vtt"));
  if (!vtt) { await set({ status: "error", msg: "no_captions" }); process.exit(0); }
  const cues = parseVtt(readFileSync(`out/${vtt}`, "utf8"));
  if (!cues.length) { await set({ status: "error", msg: "no_captions" }); process.exit(0); }

  await set({ msg: "finding_hooks", duration: Number.isFinite(duration) ? Math.round(duration) : null });
  let clips = [];
  for (const chunk of chunkTranscript(cues)) clips = clips.concat(parseClips(await claude(buildPrompt(MODE, chunk)), duration));
  clips = parseClips(JSON.stringify(clips), duration); // re-sort, drop overlaps, re-number
  await set({ status: "done", msg: "done", clips });
} catch (e) {
  await set({ status: "error", msg: String(e.message || e).slice(0, 80) });
  process.exit(1);
}
