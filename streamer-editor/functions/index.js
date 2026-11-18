const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
admin.initializeApp();

const GH_TOKEN = defineSecret("GH_DISPATCH_TOKEN"); // fine-grained token, Contents: read/write on the repo (for repository_dispatch)
const GH_REPO = process.env.GH_REPO || "geniusdigitaldeveloper-stack/global-streamer-releases-exe-apps";
const HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"];
const LIMITS = { free: 5, pro: 30 }; // jobs per user per day; protects your Claude/Actions cost

exports.createJob = onCall({ secrets: [GH_TOKEN] }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Log in first.");
  const { url, mode } = req.data || {};
  let u;
  try { u = new URL(url); } catch { throw new HttpsError("invalid-argument", "Invalid URL."); }
  if (u.protocol !== "https:" || !HOSTS.includes(u.hostname)) throw new HttpsError("invalid-argument", "Only YouTube links are supported.");
  if (!["short", "long"].includes(mode)) throw new HttpsError("invalid-argument", "Invalid mode.");

  const uid = req.auth.uid;
  const prof = await admin.firestore().doc(`users/${uid}`).get();
  const p = prof.exists ? prof.data() : {};
  if (p.status === "disabled") throw new HttpsError("permission-denied", "Account disabled.");
  const jobs = admin.firestore().collection("users").doc(uid).collection("jobs");
  const since = admin.firestore.Timestamp.fromMillis(Date.now() - 864e5);
  const recent = await jobs.where("createdAt", ">", since).count().get();
  if (recent.data().count >= (LIMITS[p.plan] || LIMITS.free)) throw new HttpsError("resource-exhausted", "Daily limit reached.");

  // The user must have saved their own Anthropic key (the app only stores a small "meta" doc the browser can read).
  const meta = await admin.firestore().doc(`users/${uid}/private/anthropicMeta`).get();
  if (!meta.exists) throw new HttpsError("failed-precondition", "no_key");
  const ref = jobs.doc();
  await ref.set({ status: "queued", msg: "queued", url: u.href, mode, clips: [], createdAt: admin.firestore.FieldValue.serverTimestamp() });

  const r = await fetch(`https://api.github.com/repos/${GH_REPO}/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${GH_TOKEN.value()}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    body: JSON.stringify({ event_type: "streamer-editor-analyze", client_payload: { uid, jobId: ref.id, url: u.href, mode } }),
  });
  if (!r.ok) {
    await ref.update({ status: "error", msg: "dispatch_failed" });
    throw new HttpsError("internal", "Could not start the analysis worker.");
  }
  return { jobId: ref.id };
});
