// Streamer Editor render toolkit: turns an "edit decision list" (EDL) into a Hyperframes composition (plain HTML + GSAP).
// Pure and deterministic: same EDL in, same HTML out. No network, no randomness, no Date.now().
//
// EDL (all times in seconds, beats/words are RELATIVE to the start of the cut clip):
// {
//   "aspect": "9:16" | "16:9" | "1:1" | "4:5",   "res": "720p" | "1080p" | "1440p" | "4k",
//   "clip":   { "start": 12.5, "end": 47.0, "title": "Clutch 1v4" },
//   "words":  [{ "text": "saya", "start": 0.1, "end": 0.4 }, { "text": "actually", "start": 0.4, "end": 0.9, "en": true }],
//   "beats":  [{ "t": 6.2, "type": "hook", "label": "HOOK" }, { "t": 14, "type": "kill", "label": "ELIMINATED" }],
//   "motion": { "titleCard": true, "lowerThird": { "name": "Streamer", "tag": "LIVE REPLAY" }, "progressBar": true, "outro": { "text": "Follow for more" } },
//   "effects": { "shake": true, "zoomPunch": true, "flash": true, "glitch": true, "vignette": true },
//   "sfx": true
// }

export const TEMPLATES = {
  motion: [
    { id: "titleCard", name: "Hook title card", note: "Big title over the first 2 seconds" },
    { id: "lowerThird", name: "Lower third", note: "Name and tag slide in" },
    { id: "hookBadge", name: "HOOK badge", note: "Pops at each hook beat" },
    { id: "killCallout", name: "Kill callout", note: "ELIMINATED text with glow at each kill beat" },
    { id: "captions", name: "Auto subtitles", note: "Poppins SemiBold, water blue, English words italic, Arabic in Traditional Arabic" },
    { id: "progressBar", name: "Progress bar", note: "Thin bar along the bottom" },
    { id: "outro", name: "Outro card", note: "Closing call to action" },
  ],
  effects: [
    { id: "shake", name: "Screen shake" },
    { id: "zoomPunch", name: "Zoom punch" },
    { id: "flash", name: "Impact flash" },
    { id: "glitch", name: "RGB glitch" },
    { id: "vignette", name: "Vignette" },
  ],
  sfx: [
    { id: "hit", name: "Impact hit", file: "sfx/hit.wav" },
    { id: "ping", name: "Hit marker ping", file: "sfx/ping.wav" },
    { id: "whoosh", name: "Whoosh", file: "sfx/whoosh.wav" },
  ],
};

const SHORT_SIDE = { "720p": 720, "1080p": 1080, "1440p": 1440, "4k": 2160 };
const even = (n) => Math.round(n / 2) * 2;

export function dims(aspect = "9:16", res = "1080p") {
  const s = SHORT_SIDE[res] || 1080;
  if (aspect === "16:9") return { width: even((s * 16) / 9), height: s, u: s / 1080 };
  if (aspect === "1:1") return { width: s, height: s, u: s / 1080 };
  if (aspect === "4:5") return { width: s, height: even(s * 1.25), u: s / 1080 };
  return { width: s, height: even((s * 16) / 9), u: s / 1080 }; // 9:16
}

const AR = /[؀-ۿݐ-ݿ]/;
export const isArabic = (t) => AR.test(t);

// 2 to 4 words per line; break on a pause longer than 0.55s
export function groupWords(words = []) {
  const groups = [];
  let cur = [];
  const flush = () => { if (cur.length) { groups.push(cur); cur = []; } };
  words.forEach((w, i) => {
    const prev = cur[cur.length - 1];
    if (cur.length >= 4 || (prev && w.start - prev.end > 0.55)) flush();
    cur.push({ ...w, i });
  });
  flush();
  return groups;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (n, d = 3) => Number(Number(n).toFixed(d));

export function buildComposition(edl) {
  const { width, height, u } = dims(edl.aspect, edl.res);
  const portrait = height >= width;
  const clip = edl.clip || {};
  const D = num(Math.max(1, (clip.end ?? 0) - (clip.start ?? 0)));
  const S = num(clip.start ?? 0);
  const motion = { titleCard: true, progressBar: true, ...(edl.motion || {}) };
  const fx = { shake: true, zoomPunch: true, flash: true, glitch: true, vignette: true, ...(edl.effects || {}) };
  const beats = (edl.beats || []).filter((b) => b.t >= 0 && b.t <= D - 0.2).sort((a, b) => a.t - b.t);
  const hooks = beats.filter((b) => b.type === "hook");
  const kills = beats.filter((b) => b.type === "kill");
  const groups = groupWords(edl.words || []);
  const sfxOn = edl.sfx !== false;

  const capBottom = portrait ? 250 : 96; // keeps clear of the TikTok/Shorts UI zones
  const html = [];
  const P = (s) => html.push(s);

  // ---------- head ----------
  P(`<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${width}, height=${height}" />
<script src="assets/gsap.min.js"></script>
<style>
@font-face{font-family:'Poppins';font-weight:600;font-style:normal;src:url(assets/fonts/poppins-600.woff2) format('woff2')}
@font-face{font-family:'Poppins';font-weight:600;font-style:italic;src:url(assets/fonts/poppins-600-italic.woff2) format('woff2')}
:root{--u:${num(u, 4)};--sky:#38BDF8;--ink:#0B1020}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${width}px;height:${height}px;overflow:hidden;background:#000}
#root{position:relative;width:${width}px;height:${height}px;overflow:hidden;font-family:'Poppins',sans-serif;color:#fff}
.fill{position:absolute;inset:0}
#punch,#stage{position:absolute;inset:0}
#v{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
#vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(0,0,0,.55) 100%);opacity:${fx.vignette ? 1 : 0}}
#flash{position:absolute;inset:0;background:#fff;opacity:0}
.gl{position:absolute;left:0;right:0;height:calc(var(--u)*46px);opacity:0;mix-blend-mode:screen}
#g1{top:30%;background:rgba(255,0,90,.45)}#g2{top:58%;background:rgba(0,230,255,.45)}
.ov{position:absolute;inset:0}
.title{position:absolute;left:7%;right:7%;top:${portrait ? "26%" : "30%"};text-align:center}
.title h1{font-weight:600;font-size:calc(var(--u)*${portrait ? 104 : 96}px);line-height:1.08;letter-spacing:-.02em;text-shadow:0 calc(var(--u)*8px) calc(var(--u)*40px) rgba(0,0,0,.7)}
.title .bar{margin:calc(var(--u)*26px) auto 0;width:calc(var(--u)*220px);height:calc(var(--u)*10px);border-radius:99px;background:linear-gradient(90deg,#22D3EE,#7C3AED,#EC4899)}
.tcover{position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,6,26,.82),rgba(11,27,99,.55))}
.lower{position:absolute;left:5%;bottom:${portrait ? "34%" : "22%"};display:flex;align-items:stretch;gap:calc(var(--u)*18px)}
.lower .accent{width:calc(var(--u)*10px);border-radius:99px;background:linear-gradient(#22D3EE,#7C3AED)}
.lower .name{font-weight:600;font-size:calc(var(--u)*54px);text-shadow:0 calc(var(--u)*4px) calc(var(--u)*18px) rgba(0,0,0,.7)}
.lower .tag{font-weight:600;font-size:calc(var(--u)*28px);letter-spacing:.14em;color:#7DF9FF;text-transform:uppercase}
.hook{position:absolute;left:6%;top:${portrait ? "9%" : "8%"}}
.hook span{display:inline-block;padding:calc(var(--u)*10px) calc(var(--u)*26px);border-radius:99px;background:#fff;color:#1D4ED8;font-weight:600;font-size:calc(var(--u)*40px);letter-spacing:.14em;box-shadow:0 0 calc(var(--u)*40px) rgba(255,255,255,.8)}
.kill{position:absolute;left:0;right:0;top:${portrait ? "40%" : "38%"};text-align:center}
.kill span{display:inline-block;font-weight:600;font-size:calc(var(--u)*${portrait ? 120 : 110}px);letter-spacing:.14em;color:#FF4D6D;text-shadow:0 0 calc(var(--u)*34px) #F43F5E,0 calc(var(--u)*6px) 0 rgba(0,0,0,.6)}
.cap{position:absolute;left:6%;right:6%;bottom:calc(var(--u)*${capBottom}px);text-align:center;line-height:1.18}
.cap .w{display:inline-block;margin:0 calc(var(--u)*.16em);font-family:'Poppins',sans-serif;font-weight:600;font-style:normal;font-size:calc(var(--u)*${portrait ? 76 : 64}px);color:var(--sky);-webkit-text-stroke:calc(var(--u)*6px) var(--ink);paint-order:stroke fill;text-shadow:0 calc(var(--u)*5px) calc(var(--u)*16px) rgba(0,0,0,.55)}
.cap .w.en{font-style:italic}
.cap .w.ar{font-family:'Traditional Arabic','Amiri','Noto Naskh Arabic','Arial',serif;font-weight:400;font-style:normal;direction:rtl}
#prog{position:absolute;left:0;bottom:0;height:calc(var(--u)*12px);width:100%;transform-origin:0 50%;background:linear-gradient(90deg,#22D3EE,#7C3AED,#EC4899);box-shadow:0 0 calc(var(--u)*24px) rgba(34,211,238,.8)}
.outro{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(60% 40% at 50% 50%,rgba(124,58,237,.55),rgba(3,6,26,.92))}
.outro h2{font-weight:600;font-size:calc(var(--u)*${portrait ? 96 : 84}px);text-align:center;padding:0 8%;text-shadow:0 0 calc(var(--u)*40px) rgba(34,211,238,.7)}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${D}" data-width="${width}" data-height="${height}">
  <div id="punch" class="fill"><div id="stage">
    <video id="v" class="clip" src="assets/source.mp4" data-start="0" data-duration="${D}" data-media-start="${S}" data-has-audio="true" playsinline></video>
  </div></div>
  <div id="vig" class="fill"></div>`);

  // ---------- timed overlays ----------
  if (motion.titleCard && clip.title) {
    P(`  <div id="tcard" class="ov clip" data-start="0" data-duration="2.4"><div class="tcover"></div><div class="title"><h1>${esc(clip.title)}</h1><div class="bar"></div></div></div>`);
  }
  if (motion.lowerThird && (motion.lowerThird.name || motion.lowerThird.tag)) {
    P(`  <div id="lower" class="ov clip" data-start="2.6" data-duration="3.2"><div class="lower"><div class="accent"></div><div><div class="name">${esc(motion.lowerThird.name || "")}</div><div class="tag">${esc(motion.lowerThird.tag || "")}</div></div></div></div>`);
  }
  hooks.forEach((b, i) => P(`  <div id="hook${i}" class="ov clip" data-start="${num(b.t)}" data-duration="1.8"><div class="hook"><span>${esc(b.label || "HOOK")}</span></div></div>`));
  kills.forEach((b, i) => P(`  <div id="kill${i}" class="ov clip" data-start="${num(b.t)}" data-duration="1.5"><div class="kill"><span>${esc(b.label || "ELIMINATED")}</span></div></div>`));
  groups.forEach((g, gi) => {
    const start = num(g[0].start);
    const end = num(Math.min(D, g[g.length - 1].end + 0.18));
    const spans = g.map((w) => `<span id="w${w.i}" class="w${w.en ? " en" : ""}${isArabic(w.text) ? " ar" : ""}">${esc(w.text)}</span>`).join(" ");
    P(`  <div id="cap${gi}" class="ov clip" data-start="${start}" data-duration="${num(Math.max(0.2, end - start))}"><div class="cap">${spans}</div></div>`);
  });
  if (motion.outro && D > 5) {
    P(`  <div id="outro" class="ov clip" data-start="${num(D - 2)}" data-duration="2"><div class="outro"><h2>${esc(motion.outro.text || "")}</h2></div></div>`);
  }
  if (motion.progressBar) P(`  <div id="prog" class="clip" data-start="0" data-duration="${D}"></div>`);
  P(`  <div id="g1" class="gl"></div><div id="g2" class="gl"></div><div id="flash"></div>`);

  // ---------- sound effects (generated locally by render.mjs) ----------
  if (sfxOn) {
    const au = (file, at, dur, vol) => P(`  <audio src="assets/${file}" data-start="${num(at)}" data-duration="${dur}" data-volume="${vol}"></audio>`);
    if (motion.titleCard && clip.title) au("sfx/whoosh.wav", 0, 0.6, 0.7);
    hooks.forEach((b) => au("sfx/ping.wav", b.t, 0.4, 0.8));
    kills.forEach((b) => au("sfx/hit.wav", b.t, 0.5, 1));
    if (motion.outro && D > 5) au("sfx/whoosh.wav", D - 2, 0.6, 0.7);
  }

  // ---------- animation ----------
  const T = [];
  const a = (s) => T.push("  " + s);
  a(`const U=${num(u, 4)};`);
  a(`const tl=gsap.timeline({paused:true});`);
  a(`tl.fromTo("#stage",{scale:1},{scale:1.05,duration:${D},ease:"none"},0);`);
  a(`function shake(t){[[-16,7],[14,-9],[-11,-7],[9,9],[-5,3],[0,0]].forEach((p,i)=>tl.to("#stage",{x:p[0]*U,y:p[1]*U,duration:.05,ease:"none"},t+i*.05))}`);
  a(`function punch(t){tl.to("#punch",{scale:1.13,duration:.07,ease:"power3.out"},t).to("#punch",{scale:1,duration:.4,ease:"power2.out"},t+.07)}`);
  a(`function flash(t){tl.fromTo("#flash",{opacity:0},{opacity:.65,duration:.04},t).to("#flash",{opacity:0,duration:.28},t+.04)}`);
  a(`function glitch(t){tl.set("#g1",{opacity:.95,x:-30*U},t).set("#g2",{opacity:.95,x:34*U},t+.04).set("#g1",{opacity:0},t+.09).set("#g2",{opacity:.9,x:-26*U},t+.1).set("#g2",{opacity:0},t+.18)}`);
  if (motion.titleCard && clip.title) {
    a(`tl.fromTo("#tcard .title",{y:60*U,opacity:0,scale:.94},{y:0,opacity:1,scale:1,duration:.5,ease:"power4.out"},0.05).fromTo("#tcard .bar",{scaleX:0},{scaleX:1,duration:.5,ease:"power3.out"},0.35).to("#tcard",{opacity:0,duration:.35,ease:"power1.in"},2.05);`);
  }
  if (motion.lowerThird && (motion.lowerThird.name || motion.lowerThird.tag)) {
    a(`tl.fromTo("#lower .lower",{x:-420*U,opacity:0},{x:0,opacity:1,duration:.5,ease:"power4.out"},2.6).to("#lower .lower",{x:-420*U,opacity:0,duration:.4,ease:"power2.in"},5.4);`);
  }
  hooks.forEach((b, i) => {
    a(`tl.fromTo("#hook${i} .hook span",{scale:.3,opacity:0},{scale:1,opacity:1,duration:.3,ease:"back.out(2)"},${num(b.t)}).to("#hook${i} .hook span",{scale:1.08,duration:.35,yoyo:true,repeat:2,ease:"sine.inOut"},${num(b.t + 0.3)});`);
    if (fx.zoomPunch) a(`punch(${num(b.t)});`);
    if (fx.flash) a(`flash(${num(b.t)});`);
  });
  kills.forEach((b, i) => {
    a(`tl.fromTo("#kill${i} .kill span",{scale:1.8,opacity:0},{scale:1,opacity:1,duration:.22,ease:"power4.out"},${num(b.t)}).to("#kill${i} .kill span",{opacity:0,y:-30*U,duration:.3,ease:"power2.in"},${num(b.t + 1.15)});`);
    if (fx.shake) a(`shake(${num(b.t)});`);
    if (fx.zoomPunch) a(`punch(${num(b.t)});`);
    if (fx.flash) a(`flash(${num(b.t)});`);
    if (fx.glitch) a(`glitch(${num(b.t + 0.04)});`);
  });
  groups.forEach((g) => g.forEach((w) => a(`tl.fromTo("#w${w.i}",{y:22*U,opacity:0,scale:.9},{y:0,opacity:1,scale:1,duration:.14,ease:"back.out(2.2)"},${num(w.start)});`)));
  if (motion.outro && D > 5) a(`tl.fromTo("#outro h2",{scale:.85,opacity:0},{scale:1,opacity:1,duration:.5,ease:"power4.out"},${num(D - 2)});`);
  if (motion.progressBar) a(`tl.fromTo("#prog",{scaleX:0},{scaleX:1,duration:${D},ease:"none"},0);`);
  a(`window.__timelines=window.__timelines||{};window.__timelines["main"]=tl;tl.seek(0);`);
  P(`</div>\n<script>\n${T.join("\n").replace(/<\/script/gi, "<\\/script")}\n</script>\n</body>\n</html>\n`);

  return { html: html.join("\n"), width, height, duration: D, counts: { hooks: hooks.length, kills: kills.length, captionGroups: groups.length } };
}
