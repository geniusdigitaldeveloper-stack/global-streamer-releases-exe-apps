#!/usr/bin/env node
// Connects this computer to the Streamer Editor web app. Sign in once, leave it running.
// It waits for jobs queued in the app by the SAME user, runs worker/edit.mjs on a recording in the inbox folder,
// and writes progress and the saved file names back. Video files never leave this computer.
//
//   SE_EMAIL=you@mail.com SE_PASSWORD=... node connect.mjs [--inbox ./inbox] [--out ./out]
// Signed up with Google? Use "Set password" in the app first, then use that password here.
import { spawn } from "node:child_process";
import { mkdirSync, existsSync, readdirSync } from "node:fs";
import { resolve, join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i > -1 ? process.argv[i + 1] : d; };
const KEY = "AIzaSyAlS_7BDvWImg2LUgdHIekHYN0nAKP6KWk", PROJECT = "streamer-editor"; // public web identifiers
const inbox = resolve(arg("inbox", "inbox")), outRoot = resolve(arg("out", "out"));
mkdirSync(inbox, { recursive: true }); mkdirSync(outRoot, { recursive: true });
const { SE_EMAIL, SE_PASSWORD } = process.env;
if (!SE_EMAIL || !SE_PASSWORD) { console.error("Set SE_EMAIL and SE_PASSWORD (the account you use in the app)."); process.exit(2); }

let token = "", uid = "", exp = 0;
async function login() {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: SE_EMAIL, password: SE_PASSWORD, returnSecureToken: true }) });
  const j = await r.json();
  if (!r.ok) throw new Error("login_failed: " + (j.error && j.error.message));
  token = j.idToken; uid = j.localId; exp = Date.now() + (Number(j.expiresIn) - 120) * 1000;
}
const fs = async (path, opt = {}) => {
  if (Date.now() > exp) await login();
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents${path}`, { ...opt, headers: { authorization: "Bearer " + token, "content-type": "application/json" } });
  if (!r.ok) throw new Error("firestore_" + r.status);
  return r.json();
};
const val = (v) => v.stringValue ?? (v.integerValue !== undefined ? Number(v.integerValue) : v.doubleValue);
const enc = (v) => typeof v === "number" ? { doubleValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map((x) => ({ mapValue: { fields: Object.fromEntries(Object.entries(x).map(([k, y]) => [k, enc(y)])) } })) } } : { stringValue: String(v) };
async function patch(id, data) {
  const fields = Object.fromEntries(Object.entries({ ...data, updatedAt: new Date().toISOString() }).map(([k, v]) => [k, enc(v)]));
  const mask = Object.keys(fields).map((k) => "updateMask.fieldPaths=" + k).join("&");
  await fs(`/users/${uid}/jobs/${id}?${mask}`, { method: "PATCH", body: JSON.stringify({ fields }) });
}

function runEdit(job, id) {
  return new Promise((done) => {
    const file = join(inbox, basename(job.file)); // basename only: the app can never point the worker outside the inbox
    if (!existsSync(file)) return done({ ok: false, msg: "file_not_in_inbox: " + basename(job.file) });
    const out = join(outRoot, id);
    const a = [join(here, "edit.mjs"), "--video", file, "--out", out, "--mode", job.mode, "--aspect", job.aspect, "--res", job.res, "--fps", String(job.fps), "--format", job.format, "--engine", job.engine];
    const srt = ["srt", "vtt"].map((e) => file.replace(/\.[^.]+$/, "." + e)).find(existsSync);
    if (srt) a.push("--transcript", srt);
    const p = spawn(process.execPath, a, { env: process.env });
    let so = "", se = "";
    p.stdout.on("data", (d) => (so += d));
    p.stderr.on("data", (d) => { se += d; const l = String(d).split("\n").filter(Boolean).pop() || ""; const m = l.includes("reading audio") ? "reading" : l.includes("asking Claude") ? "asking" : l.includes("rendering") ? "rendering" : ""; if (m) patch(id, { status: "working", msg: m }).catch(() => {}); });
    p.on("close", (code) => {
      if (code !== 0) return done({ ok: false, msg: (se.split("\n").filter(Boolean).pop() || "failed").slice(0, 150) });
      try { done({ ok: true, outputs: JSON.parse(so).map((o) => ({ file: o.file, title: basename(o.file), seconds: o.seconds })) }); } catch { done({ ok: false, msg: "bad_output" }); }
    });
  });
}

await login();
console.log(`Connected as ${SE_EMAIL}. Put recordings (and an optional .srt with the same name) in ${inbox}. Saved clips go to ${outRoot}.`);
const busy = new Set();
for (;;) {
  try {
    const q = await fs(`/users/${uid}:runQuery`, { method: "POST", body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "jobs" }], where: { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "queued" } } }, limit: 5 } }) });
    for (const row of q) {
      if (!row.document) continue;
      const id = row.document.name.split("/").pop();
      if (busy.has(id)) continue;
      busy.add(id);
      const f = row.document.fields, job = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, val(v)]));
      console.log("Job", id, job.file);
      await patch(id, { status: "working", msg: "reading" });
      const r = await runEdit(job, id);
      await patch(id, r.ok ? { status: "done", msg: "done", outputs: r.outputs } : { status: "error", msg: r.msg });
      console.log(r.ok ? "Done " + id : "Error " + r.msg);
    }
  } catch (e) { console.error("poll:", String(e.message || e)); }
  await new Promise((r) => setTimeout(r, 4000));
}
