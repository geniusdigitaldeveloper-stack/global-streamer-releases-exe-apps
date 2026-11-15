// Pure helpers (no network) so they can be tested.
export function tsToSec(t) {
  const m = t.match(/(?:(\d+):)?(\d+):(\d+)[.,](\d+)/);
  if (!m) return 0;
  return +(m[1] || 0) * 3600 + +m[2] * 60 + +m[3] + +("0." + m[4]);
}
export function parseVtt(vtt) {
  const cues = []; let cur = null;
  for (const l of vtt.split(/\r?\n/)) {
    const m = l.match(/^(\S+)\s+-->\s+(\S+)/);
    if (m) { cur = { start: tsToSec(m[1]), end: tsToSec(m[2]), text: "" }; cues.push(cur); continue; }
    if (!cur) continue;
    if (!l.trim()) { cur = null; continue; }
    cur.text += (cur.text ? " " : "") + l.replace(/<[^>]+>/g, "").trim();
  }
  const out = [];
  for (const c of cues) {
    const text = c.text.trim(); const p = out[out.length - 1];
    if (!text || (p && p.text === text)) continue;
    out.push({ start: c.start, end: c.end, text });
  }
  return out;
}
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
export function chunkTranscript(cues, maxChars = 90000) {
  const chunks = []; let buf = "";
  for (const c of cues) {
    const line = `[${mmss(c.start)}|${Math.floor(c.start)}] ${c.text}\n`;
    if (buf.length + line.length > maxChars && buf) { chunks.push(buf); buf = ""; }
    buf += line;
  }
  if (buf) chunks.push(buf);
  return chunks;
}
export function buildPrompt(mode, transcript) {
  const goal = mode === "short"
    ? "Find every strong hook moment worth cutting as a standalone short content clip (a suggested length is about 60 seconds, but let the moment decide). Return as many or as few clips as the video really has."
    : "This is a full YouTube video that will be edited as a whole. Do not cut it. Return the best highlight moments only, as short ranges, so effects and sound effects can be placed on them.";
  return `You edit gaming and live-stream videos. ${goal}
The transcript lines look like [m:ss|seconds] text. Use the seconds value for start and end.
Return ONLY a JSON array, no prose. Each item: {"start":number,"end":number,"title":string,"score":number 0-100,"reason":string}.
Titles are short, in the language of the transcript. Do not invent moments that are not in the transcript. Return [] if there is nothing.

Transcript:
${transcript}`;
}
export function parseClips(raw, duration = Infinity) {
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) return [];
  let arr; try { arr = JSON.parse(m[0]); } catch { return []; }
  const ok = arr.filter((c) => c && Number.isFinite(c.start) && Number.isFinite(c.end))
    .map((c) => ({ start: Math.max(0, c.start), end: Math.min(duration, c.end), title: String(c.title || "").slice(0, 80), score: Number.isFinite(c.score) ? Math.round(Math.min(100, Math.max(0, c.score))) : null, reason: String(c.reason || "").slice(0, 200) }))
    .filter((c) => c.end - c.start >= 3)
    .sort((a, b) => a.start - b.start);
  const res = [];
  for (const c of ok) { const p = res[res.length - 1]; if (p && c.start < p.end) continue; res.push(c); }
  return res.map((c, i) => ({ id: i, title: c.title, score: c.score, reason: c.reason, start: Math.round(c.start), at: Math.round(c.start), end: Math.round(c.end), dur: Math.round(c.end - c.start) }));
}
