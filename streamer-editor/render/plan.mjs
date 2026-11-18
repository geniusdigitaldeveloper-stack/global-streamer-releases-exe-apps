// Export rules, pure and testable.
//  - format: mp4 or mov
//  - resolution: 1080p (minimum) up to 4k; if 4k would take too long for the worker it falls back to 2k (1440p), then 1080p
//  - fps: whole numbers from 30 to 200
// Seconds per frame were MEASURED with Hyperframes on a 4-core machine (1080p 0.11, 4k 0.36); 1440p is interpolated by pixel count.
export const RES_ORDER = ["1080p", "1440p", "4k"];
export const SEC_PER_FRAME = { "1080p": 0.11, "1440p": 0.2, "4k": 0.36 };
export const FPS_MIN = 30;
export const FPS_MAX = 200;
export const FORMATS = ["mp4", "mov"];

export const clampFps = (n) => Math.min(FPS_MAX, Math.max(FPS_MIN, Math.round(Number(n) || 60)));
export const normRes = (r) => {
  const s = String(r || "1080p").toLowerCase();
  if (s === "2k" || s === "1440" || s === "1440p") return "1440p";
  if (s === "4k" || s === "2160p" || s === "uhd") return "4k";
  return "1080p"; // anything lower is raised to the 1080p minimum
};

export function planExport({ res = "1080p", fps = 60, format = "mp4", duration = 30, maxSeconds = 1500 } = {}) {
  const f = FORMATS.includes(String(format).toLowerCase()) ? String(format).toLowerCase() : "mp4";
  const rate = clampFps(fps);
  const frames = Math.ceil(duration * rate);
  const requested = normRes(res);
  const estimate = (r) => Math.round(frames * SEC_PER_FRAME[r] + 8); // +8s start-up
  let used = requested, note = "";
  while (used !== "1080p" && estimate(used) > maxSeconds) used = RES_ORDER[RES_ORDER.indexOf(used) - 1];
  if (used !== requested) note = `${requested === "4k" ? "4K" : "2K"} would take about ${Math.round(estimate(requested) / 60)} min on the worker, so ${used === "1440p" ? "2K (1440p)" : "1080p"} is used instead.`;
  const overBudget = estimate(used) > maxSeconds; // already at the 1080p minimum
  if (overBudget) note = (note ? note + " " : "") + `Even at 1080p this needs about ${Math.round(estimate(used) / 60)} min.`;
  return { format: f, fps: rate, frames, requested, used, fellBack: used !== requested, estimateSeconds: estimate(used), overBudget, note };
}
