// Pure helpers for the local worker (no network, no ffmpeg), so they can be tested.
// Flow: recording -> loud moments + transcript -> Claude picks clips and beats -> EDL per clip -> render/render.mjs.

// Turn per-second loudness (dB, negative) into the loudest separate moments.
export function topPeaks(levels, { count = 40, minGap = 8 } = {}) {
  const idx = levels.map((v, i) => [i, v]).filter(([, v]) => Number.isFinite(v)).sort((a, b) => b[1] - a[1]);
  const out = [];
  for (const [i, v] of idx) {
    if (out.length >= count) break;
    if (out.every((p) => Math.abs(p.t - i) >= minGap)) out.push({ t: i, db: Math.round(v * 10) / 10 });
  }
  return out.sort((a, b) => a.t - b.t);
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function buildEditPrompt({ mode, duration, cues, peaks, targetSeconds = 60 }) {
  const goal = mode === "long"
    ? "The whole video will be kept. Return ONE item that covers it all (start 0, end the video length) and put the beats on its best moments."
    : `Cut the strongest standalone short clips (about ${targetSeconds} seconds each, let the moment decide, return as many or as few as the video really has).`;
  const tx = cues.map((c) => `[${mmss(c.start)}|${Math.floor(c.start)}] ${c.text}`).join("\n");
  const pk = peaks.map((p) => `${mmss(p.t)}|${p.t}s ${p.db}dB`).join(", ");
  return `You edit gaming and live-stream recordings. The video is ${Math.round(duration)} seconds long. ${goal}
You cannot see the video. You have the speech transcript and the loudest moments of the audio (shouts, explosions, hype). Use only these. Do not invent moments.
Return ONLY a JSON array. Each item:
{"start":number,"end":number,"title":string,"beats":[{"t":number,"type":"hook"|"kill","label":string}],"english":[string]}
- start/end are seconds in the recording. beats[].t is in seconds in the recording and must lie inside the clip.
- Exactly one "hook" beat near the start of each clip. Use "kill" beats only where the transcript or a loud peak points to a kill, win or big play.
- english: English words that appear inside non-English speech (they will be shown in italic).
Titles are short, in the language of the transcript. Return [] if there is nothing.

Loudest moments: ${pk || "none"}

Transcript:
${tx || "(no transcript)"}`;
}

export function parseEdit(raw, duration = Infinity) {
  const m = String(raw).match(/\[[\s\S]*\]/);
  if (!m) return [];
  let arr; try { arr = JSON.parse(m[0]); } catch { return []; }
  const items = arr.filter((c) => c && Number.isFinite(c.start) && Number.isFinite(c.end))
    .map((c) => ({
      start: Math.max(0, c.start), end: Math.min(duration, c.end), title: String(c.title || "Clip").slice(0, 80),
      beats: (Array.isArray(c.beats) ? c.beats : []).filter((b) => b && Number.isFinite(b.t) && (b.type === "hook" || b.type === "kill")).map((b) => ({ t: b.t, type: b.type, label: String(b.label || (b.type === "hook" ? "HOOK" : "ELIMINATED")).slice(0, 30) })),
      english: (Array.isArray(c.english) ? c.english : []).map((w) => String(w).toLowerCase()).slice(0, 200),
    }))
    .filter((c) => c.end - c.start >= 3).sort((a, b) => a.start - b.start);
  const res = [];
  for (const c of items) { const p = res[res.length - 1]; if (p && c.start < p.end) continue; res.push(c); }
  return res;
}

// Spread each cue's text across its time span (no word timestamps without a speech model), relative to the clip start.
export function cuesToWords(cues, start, end, english = []) {
  const en = new Set(english);
  const words = [];
  for (const c of cues) {
    if (c.end <= start || c.start >= end) continue;
    const toks = c.text.split(/\s+/).filter(Boolean);
    if (!toks.length) continue;
    const step = (c.end - c.start) / toks.length;
    toks.forEach((tx, i) => {
      const a = c.start + i * step, b = a + step;
      if (a < start || b > end) return;
      const clean = tx.replace(/[^\p{L}\p{N}'’-]/gu, "").toLowerCase();
      words.push({ text: tx, start: +(a - start).toFixed(2), end: +(b - start).toFixed(2), ...(en.has(clean) ? { en: true } : {}) });
    });
  }
  return words;
}

export function buildEdl(item, cues, o = {}) {
  const beats = item.beats.filter((b) => b.t >= item.start && b.t <= item.end).map((b) => ({ ...b, t: +(b.t - item.start).toFixed(2) }));
  return {
    aspect: o.aspect || "9:16", res: o.res || "1080p",
    clip: { start: item.start, end: item.end, title: item.title },
    words: cuesToWords(cues, item.start, item.end, item.english),
    beats,
    motion: { titleCard: true, hookBadge: true, killCallout: true, captions: cues.length > 0, progressBar: true, lowerThird: o.name ? { name: o.name, tag: "LIVE REPLAY" } : undefined, outro: o.outro ? { text: o.outro } : undefined },
    effects: { shake: true, zoomPunch: true, flash: true, glitch: true, vignette: true },
    sfx: true,
  };
}
