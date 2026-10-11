/* Shared helpers for the Subtitles case study figures.
   Ported pieces cite the file and line in Subtitles/ they come from. */

/* Subtitles/utils.js:1-6. The site multiplies by devicePixelRatio up to 3.
   Figures on this page cap it at 2 (they are smaller than the site's full-screen views). */
export const DPR_SITE_MAX = 3;
const DPR = Math.min(window.devicePixelRatio || 1, 2);
export function cloudinaryUrl(baseUrl, width, quality = "auto:best", dpr = DPR) {
  const w = Math.round(width * dpr);
  return baseUrl.replace("/upload/", `/upload/w_${w},q_${quality},f_auto,c_limit/`);
}

/* Subtitles/utils.js:18-34, unchanged: a line that starts with an em dash is a
   conversation, one row per line; anything else is one paragraph. */
export function formatSubtitle(text) {
  const el = document.createElement("div");
  el.className = "subtitle";
  const isDialogue = text.trim().startsWith("—");
  if (isDialogue) {
    el.classList.add("dialogue");
    text.split(/\n/).filter(Boolean).forEach((line) => {
      const span = document.createElement("span");
      span.className = "subtitle-line";
      span.textContent = line.trim();
      el.appendChild(span);
    });
  } else {
    el.textContent = text;
  }
  return el;
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/* Fisher-Yates, as Subtitles/views/freeform.js:19-23 and globe.js:13-16 do it.
   An optional seed keeps a figure the same between visits. */
export function shuffle(list, seed) {
  const out = [...list];
  let s = seed || 0;
  const rnd = seed ? () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) : Math.random;
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* GSAP 3.12's easing maths, written out so the curves can be drawn as well as used.
   power(n): n=2 is "power2", the cubic. expo and elastic follow gsap-core.js. */
const inOutFrom = (easeIn) => (p) => (p < 0.5 ? easeIn(p * 2) / 2 : 1 - easeIn((1 - p) * 2) / 2);
const outFrom = (easeIn) => (p) => 1 - easeIn(1 - p);
const powIn = (n) => (p) => p ** (n + 1);
const expoIn = (p) => (p ? 2 ** (10 * (p - 1)) : 0);
export const ease = {
  linear: (p) => p,
  "power2.out": outFrom(powIn(2)),
  "power2.in": powIn(2),
  "power2.inOut": inOutFrom(powIn(2)),
  "power3.out": outFrom(powIn(3)),
  "power3.inOut": inOutFrom(powIn(3)),
  "expo.out": outFrom(expoIn),
  "expo.in": expoIn,
  "expo.inOut": inOutFrom(expoIn),
};
/* elastic.out(amplitude, period), gsap-core.js _configElastic */
export function elasticOut(amplitude = 1, period = 0.3) {
  const TAU = Math.PI * 2;
  const p1 = amplitude >= 1 ? amplitude : 1;
  let p2 = period / (amplitude < 1 ? amplitude : 1);
  const p3 = (p2 / TAU) * (Math.asin(1 / p1) || 0);
  p2 = TAU / p2;
  return (p) => (p === 1 ? 1 : p1 * 2 ** (-10 * p) * Math.sin((p - p3) * p2) + 1);
}
ease["elastic.out(1, 0.55)"] = elasticOut(1, 0.55);

/* A small tween on the shared loop. Animates numeric props of `target`.
   Returns a cancel function. With reduced motion, jumps to the end. */
export function tween(target, to, { duration = 0.5, ease: e = "power2.out", onUpdate, onDone, instant } = {}) {
  const fn = typeof e === "function" ? e : ease[e] || ease.linear;
  const from = {};
  for (const k in to) from[k] = target[k];
  if (instant || (window.Study && Study.reduce && instant !== false) || duration <= 0) {
    for (const k in to) target[k] = to[k];
    onUpdate && onUpdate(1, 1);
    onDone && onDone();
    return () => {};
  }
  let t0 = null, dead = false;
  const stop = Study.raf((t) => {
    if (dead) return false;
    if (t0 === null) t0 = t;
    const p = Math.min(1, (t - t0) / 1000 / duration);
    const v = fn(p);
    for (const k in to) target[k] = from[k] + (to[k] - from[k]) * v;
    onUpdate && onUpdate(p, v);
    if (p >= 1) { onDone && onDone(); return false; }
  });
  return () => { dead = true; stop(); };
}

/* Draw a curve y = f(x) for x in 0..1 into an SVG path string, inside w x h, with
   y = 0 at the bottom. yMin/yMax let elastic overshoot show. */
export function curvePath(f, w, h, { yMin = 0, yMax = 1, steps = 120 } = {}) {
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const x = i / steps;
    const y = f(x);
    const px = x * w;
    const py = h - ((y - yMin) / (yMax - yMin)) * h;
    d += (i ? "L" : "M") + px.toFixed(1) + " " + py.toFixed(1);
  }
  return d;
}

/* Canvas sized to its box, devicePixelRatio capped at 2. */
export function fitCanvas(canvas) {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(r.width * dpr));
  const h = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: r.width, h: r.height, dpr };
}

export const css = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();
export const fmt = (v, d = 2) => (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d).replace("-", "−");
