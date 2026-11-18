import assert from "node:assert/strict";
import { topPeaks, buildEditPrompt, parseEdit, cuesToWords, buildEdl } from "./lib.mjs";
import { buildComposition } from "../render/compose.mjs";

const lv = Array.from({ length: 100 }, (_, i) => -40);
lv[10] = -8; lv[12] = -9; lv[50] = -6; lv[90] = -12;
const pk = topPeaks(lv, { count: 3, minGap: 8 });
assert.deepEqual(pk.map((p) => p.t), [10, 50, 90], "keeps separate peaks, drops the neighbour at 12");

const cues = [{ start: 10, end: 14, text: "saya tak percaya actually gila" }, { start: 80, end: 82, text: "luar clip" }];
const raw = 'ok [{"start":8,"end":40,"title":"Clutch","beats":[{"t":10,"type":"hook"},{"t":50,"type":"kill"},{"t":20,"type":"kill","label":"WIN"},{"t":1,"type":"bad"}],"english":["Actually"]},{"start":30,"end":60,"title":"overlap"},{"start":1,"end":2,"title":"short"}]';
const items = parseEdit(raw, 100);
assert.equal(items.length, 1); assert.equal(items[0].beats.length, 3); assert.deepEqual(items[0].english, ["actually"]);
const w = cuesToWords(cues, 8, 40, items[0].english);
assert.equal(w.length, 5); assert.ok(w[3].en && !w[0].en, "English word flagged"); assert.equal(w[0].start, 2);
const edl = buildEdl(items[0], cues, { res: "4k", name: "Me" });
assert.deepEqual(edl.beats.map((b) => b.t), [2, 12], "beat outside the clip dropped, rest made relative");
const c = buildComposition(edl);
assert.ok(c.html.includes('class="w en"') && c.counts.hooks === 1 && c.counts.kills === 1);
const p = buildEditPrompt({ mode: "short", duration: 100, cues, peaks: pk });
assert.ok(p.includes("cannot see the video") && p.includes("0:10|10s"));
assert.deepEqual(parseEdit("nothing"), []);
console.log("worker tests ok");
