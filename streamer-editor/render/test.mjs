import assert from "node:assert/strict";
import { buildComposition, dims, groupWords, isArabic, TEMPLATES } from "./compose.mjs";

// sizes for every aspect/resolution the app offers
assert.deepEqual(dims("9:16", "1080p"), { width: 1080, height: 1920, u: 1 });
assert.deepEqual(dims("16:9", "720p"), { width: 1280, height: 720, u: 720 / 1080 });
assert.equal(dims("1:1", "4k").width, 2160);
assert.equal(dims("4:5", "1080p").height, 1350);

// word grouping: max 4 words, break on pauses
const g = groupWords([{ text: "a", start: 0, end: 0.2 }, { text: "b", start: 0.2, end: 0.4 }, { text: "c", start: 1.5, end: 1.7 }, { text: "d", start: 1.7, end: 1.9 }, { text: "e", start: 1.9, end: 2 }, { text: "f", start: 2, end: 2.1 }, { text: "g", start: 2.1, end: 2.3 }]);
assert.deepEqual(g.map((x) => x.length), [2, 4, 1]);
assert.ok(isArabic("بسم") && !isArabic("hello"));

const edl = {
  aspect: "9:16", res: "720p",
  clip: { start: 10, end: 30, title: "Clutch <1v4>" },
  words: [{ text: "saya", start: 0.2, end: 0.5 }, { text: "actually", start: 0.5, end: 1, en: true }, { text: "بسم", start: 1, end: 1.4 }],
  beats: [{ t: 5, type: "hook", label: "HOOK" }, { t: 9, type: "kill", label: "ELIMINATED" }, { t: 99, type: "kill" }],
  motion: { lowerThird: { name: "Streamer", tag: "LIVE REPLAY" }, outro: { text: "Follow" } },
};
const c = buildComposition(edl);
assert.equal(c.duration, 20);
assert.deepEqual(c.counts, { hooks: 1, kills: 1, captionGroups: 1 }); // the out-of-range beat is dropped
assert.ok(c.html.includes('data-media-start="10"'), "source trimmed to the clip start");
assert.ok(c.html.includes("Clutch &lt;1v4&gt;"), "text is escaped");
assert.ok(c.html.includes('class="w en"'), "English words are italic");
assert.ok(c.html.includes('class="w ar"'), "Arabic words use the Arabic class");
assert.ok(c.html.includes("#38BDF8") && c.html.includes("font-weight:600"), "fixed subtitle style");
assert.ok(c.html.includes("assets/sfx/hit.wav") && c.html.includes("assets/sfx/ping.wav"), "sound effects wired to beats");
assert.equal(buildComposition(edl).html, c.html, "deterministic");
assert.ok(!/Math\.random|Date\.now/.test(c.html), "no non-deterministic code");
assert.ok(TEMPLATES.motion.length >= 7 && TEMPLATES.effects.length >= 5);
console.log("render compose tests ok");
