/* Fig. 5: four kinds of light.

     world/TimeOfDay.ts:93-238      the four presets and the auto clock (modeForHour)
     world/Atmosphere.ts:56-131     the sky dome shader: horizon to zenith ramp, stars, sun glow
     world/Atmosphere.ts:144,242    TRANSITION = 1.1 s, smoothstep k, lerpLive (sun slerped)

   The sky strip runs the shader's maths on the CPU across the whole dome. Colours are
   converted to linear, mixed and written raw, which is what the game's ShaderMaterial does
   (it has no colour-space step), and is why the strip matches the captures pixel for pixel. */
import { Study, s, txt, fitSvg, tabs, readout } from "./util.js";

const PRESETS = {
  morning: { label: "Morning", sunDir: [0.88, 0.26, 0.4], sunIntensity: 2.35, skyHorizon: 0xffdcc2, skyZenith: 0x6ea4dd, glowColor: 0xffc78a, glowStrength: 0.85, fogNear: 55, fogFar: 285, exposure: 1.02, lamps: 1.15, stars: 0.0, bloom: 0.0 },
  day: { label: "Day", sunDir: [0.45, 0.62, 0.3], sunIntensity: 2.7, skyHorizon: 0xcfe4f2, skyZenith: 0x5c95d6, glowColor: 0xfff0cf, glowStrength: 0.55, fogNear: 70, fogFar: 320, exposure: 1.0, lamps: 1.0, stars: 0.0, bloom: 0.0 },
  evening: { label: "Evening", sunDir: [-0.82, 0.2, -0.5], sunIntensity: 2.0, skyHorizon: 0xf6a05c, skyZenith: 0x2d5a9e, glowColor: 0xff9a45, glowStrength: 1.15, fogNear: 50, fogFar: 250, exposure: 1.06, lamps: 1.2, stars: 0.12, bloom: 0.26 },
  night: { label: "Night", sunDir: [-0.38, 0.7, -0.5], sunIntensity: 0.6, skyHorizon: 0x1d2d4a, skyZenith: 0x070c1c, glowColor: 0xd4e2ff, glowStrength: 0.95, fogNear: 42, fogFar: 215, exposure: 1.2, lamps: 1.55, stars: 1.0, bloom: 0.62 },
};
const TRANSITION = 1.1;
/* TimeOfDay.ts:224-229 */
const modeForHour = (h) => (h >= 5 && h < 9 ? "morning" : h >= 9 && h < 17 ? "day" : h >= 17 && h < 20 ? "evening" : "night");

const srgbToLinear = (c) => (c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4));
const lin = (hex) => [srgbToLinear(((hex >> 16) & 255) / 255), srgbToLinear(((hex >> 8) & 255) / 255), srgbToLinear((hex & 255) / 255)];
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
const live = (p) => ({ horizon: lin(p.skyHorizon), zenith: lin(p.skyZenith), glowColor: lin(p.glowColor), glow: p.glowStrength, sunDir: norm(p.sunDir), sunIntensity: p.sunIntensity, fogNear: p.fogNear, fogFar: p.fogFar, exposure: p.exposure, lamps: p.lamps, stars: p.stars, bloom: p.bloom });
const snap = (l) => JSON.parse(JSON.stringify(l));
const mixA = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
function lerpLive(a, b, k) {
  const n = (x, y) => x + (y - x) * k;
  const dot = Math.max(-1, Math.min(1, a.sunDir[0] * b.sunDir[0] + a.sunDir[1] * b.sunDir[1] + a.sunDir[2] * b.sunDir[2]));
  const ang = Math.acos(dot);
  let sd = b.sunDir.slice();
  if (ang >= 1e-4) {
    const sn = Math.sin(ang), wa = Math.sin((1 - k) * ang) / sn, wb = Math.sin(k * ang) / sn;
    sd = norm([a.sunDir[0] * wa + b.sunDir[0] * wb, a.sunDir[1] * wa + b.sunDir[1] * wb, a.sunDir[2] * wa + b.sunDir[2] * wb]);
  }
  return { horizon: mixA(a.horizon, b.horizon, k), zenith: mixA(a.zenith, b.zenith, k), glowColor: mixA(a.glowColor, b.glowColor, k), glow: n(a.glow, b.glow), sunDir: sd,
    sunIntensity: n(a.sunIntensity, b.sunIntensity), fogNear: n(a.fogNear, b.fogNear), fogFar: n(a.fogFar, b.fogFar), exposure: n(a.exposure, b.exposure), lamps: n(a.lamps, b.lamps), stars: n(a.stars, b.stars), bloom: n(a.bloom, b.bloom) };
}

/* Atmosphere.ts:66-106, Dave Hoskins' hash31 and the star field */
const fract = (x) => x - Math.floor(x);
function hash31(x, y, z) {
  x = fract(x * 0.1031); y = fract(y * 0.1031); z = fract(z * 0.1031);
  const d = x * (y + 33.33) + y * (z + 33.33) + z * (x + 33.33);
  x += d; y += d; z += d;
  return fract((x + y) * z);
}
function starField(dx, dy, dz) {
  const GRID = 110.0, STAR_R = 0.26, CUTOFF = 0.978;
  const px = dx * GRID, py = dy * GRID, pz = dz * GRID;
  const cx = Math.floor(px), cy = Math.floor(py), cz = Math.floor(pz);
  const h = hash31(cx, cy, cz);
  if (h < CUTOFF) return 0;
  const jx = hash31(cx + 11.3, cy + 11.3, cz + 11.3) - 0.5, jy = hash31(cx + 27.1, cy + 27.1, cz + 27.1) - 0.5, jz = hash31(cx + 43.7, cy + 43.7, cz + 43.7) - 0.5;
  const ex = fract(px) - 0.5 - jx * 0.5, ey = fract(py) - 0.5 - jy * 0.5, ez = fract(pz) - 0.5 - jz * 0.5;
  const d = Math.hypot(ex, ey, ez);
  const mag = (h - CUTOFF) / (1 - CUTOFF);
  const t = Math.min(1, Math.max(0, (d - STAR_R) / (0.02 - STAR_R)));
  return t * t * (3 - 2 * t) * (0.35 + 0.65 * mag) * 0.87; // twinkle held at its mean
}
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

export function mountLight(fig) {
  const imgs = {};
  fig.querySelectorAll(".lt-shot img").forEach((im) => { imgs[im.dataset.mode] = im; });
  const canvas = fig.querySelector(".lt-dome canvas");
  const ann = fig.querySelector(".lt-dome-ann");
  const clockSvg = fig.querySelector(".lt-clock");
  const curveSvg = fig.querySelector(".lt-curve");
  const r = readout(fig);
  const ctx = canvas.getContext("2d");
  let setting = "day", mode = "day";
  let from = live(PRESETS.day), to = from, cur = from, blend = 1, k01 = 1, prevMode = "day";

  /* ---------- the dome: equirectangular, N at the left, horizon at the bottom ---------- */
  let W = 0, H = 0, dirs = null, starMask = null, img = null, starRow = 0;
  function sizeDome() {
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    const w = Math.min(1200, Math.round(cw * Math.min(devicePixelRatio, 2))), h = Math.min(240, Math.round(ch * Math.min(devicePixelRatio, 2)));
    if (!w || !h || (w === W && h === H)) return false;
    W = w; H = h; canvas.width = W; canvas.height = H;
    dirs = new Float32Array(W * H * 3);
    starMask = new Float32Array(W * H);
    starRow = 0;
    img = ctx.createImageData(W, H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const az = ((i + 0.5) / W) * Math.PI * 2, el = (1 - (j + 0.5) / H) * (Math.PI / 2);
      const k = (j * W + i) * 3;
      dirs[k] = Math.sin(az) * Math.cos(el); dirs[k + 1] = Math.sin(el); dirs[k + 2] = -Math.cos(az) * Math.cos(el);
    }
    requestAnimationFrame(bakeStars);
    return true;
  }
  /* Stars are smaller than a pixel at this scale, so each pixel keeps the brightest of 2 by 2
     samples. Worked out a few rows a frame, so it never holds the page up. */
  function bakeStars() {
    const S = 2, t0 = performance.now(), w0 = W;
    while (starRow < H && performance.now() - t0 < 8) {
      const j = starRow++;
      for (let i = 0; i < W; i++) {
        let best = 0;
        for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) {
          const az2 = ((i + (a + 0.5) / S) / W) * Math.PI * 2, el2 = (1 - (j + (b + 0.5) / S) / H) * (Math.PI / 2);
          const v = starField(Math.sin(az2) * Math.cos(el2), Math.sin(el2), -Math.cos(az2) * Math.cos(el2));
          if (v > best) best = v;
        }
        starMask[j * W + i] = best * smooth(-0.02, 0.3, Math.sin((1 - (j + 0.5) / H) * (Math.PI / 2)));
      }
    }
    if (w0 !== W) return;
    if (starRow < H) requestAnimationFrame(bakeStars);
    else if (cur.stars > 0.001) paintDome(cur);
  }
  function paintDome(L) {
    if (!W) return;
    const d = img.data, sd = L.sunDir, gc = L.glowColor;
    for (let p = 0, n = W * H; p < n; p++) {
      const k = p * 3, dx = dirs[k], dy = dirs[k + 1], dz = dirs[k + 2];
      const h = Math.pow(Math.max(0, Math.min(1, dy)), 0.45);
      let r0 = L.horizon[0] + (L.zenith[0] - L.horizon[0]) * h;
      let g0 = L.horizon[1] + (L.zenith[1] - L.horizon[1]) * h;
      let b0 = L.horizon[2] + (L.zenith[2] - L.horizon[2]) * h;
      if (L.stars > 0.001) { const st = starMask[p] * L.stars; r0 += 0.86 * st; g0 += 0.9 * st; b0 += st; }
      const sun = Math.pow(Math.max(dx * sd[0] + dy * sd[1] + dz * sd[2], 0), 24) * L.glow;
      r0 += gc[0] * sun; g0 += gc[1] * sun; b0 += gc[2] * sun;
      const o = p * 4;
      d[o] = Math.min(255, r0 * 255); d[o + 1] = Math.min(255, g0 * 255); d[o + 2] = Math.min(255, b0 * 255); d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // the sun (the moon, at night) on the strip
    const az = Math.atan2(sd[0], -sd[2]), el = Math.asin(sd[1]);
    const x = (((az / (Math.PI * 2)) % 1) + 1) % 1, y = 1 - el / (Math.PI / 2);
    const aw = canvas.clientWidth, ah = canvas.clientHeight;
    ann.setAttribute("viewBox", `0 0 ${aw} ${ah}`);
    ann.textContent = "";
    const cx = x * aw, cy = y * ah;
    s("circle", { cx, cy, r: 6, fill: "none", stroke: "#fdfcf9", "stroke-width": 1.5 }, ann);
    const right = cx < aw - 120;
    txt(ann, cx + (right ? 11 : -11), cy + 4, `${mode === "night" ? "moon" : "sun"} ${Math.round((el * 180) / Math.PI)}° up`, { "text-anchor": right ? "start" : "end", fill: "#fdfcf9", "font-size": 12, "font-weight": 600, style: "font-family: var(--font)" });
  }

  /* ---------- the 24 hours, and the blend curve ---------- */
  const ink2 = "#67625a", ink3 = "#9a958b", rule = "#e0dbd0";
  const tintInk = getComputedStyle(document.body).getPropertyValue("--tint-ink").trim() || "#2a6db0";
  const BANDS = [["night", 0, 5], ["morning", 5, 9], ["day", 9, 17], ["evening", 17, 20], ["night", 20, 24]];
  const bandRGB = (m) => { const L = live(PRESETS[m]); return mixA(L.horizon, L.zenith, Math.pow(0.5, 0.45)); };
  const bandFill = (m) => `rgb(${bandRGB(m).map((v) => Math.round(v * 255)).join(",")})`;
  const bandDark = (m) => { const c = bandRGB(m); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] < 0.42; };
  let clock = null;
  fitSvg(clockSvg, () => 76, (w) => {
    clockSvg.textContent = "";
    const L = 0, R = w, y0 = 22, bh = 24;
    txt(clockSvg, 0, 12, "Auto, by the hour on your clock", { class: "ann", fill: "#1d1b18" });
    const bands = BANDS.map(([m, a, b]) => {
      const x0 = L + (a / 24) * (R - L), x1 = L + (b / 24) * (R - L);
      const rect = s("rect", { x: x0, y: y0, width: x1 - x0, height: bh, fill: bandFill(m) }, clockSvg);
      if (x1 - x0 > 46) txt(clockSvg, (x0 + x1) / 2, y0 + 16, PRESETS[m].label, { "text-anchor": "middle", fill: bandDark(m) ? "#f3f1ea" : "#1d1b18", "font-size": 11.5, "font-weight": 600, style: "font-family: var(--font)" });
      return { m, rect };
    });
    for (const hr of [0, 5, 9, 17, 20, 24]) {
      const x = L + (hr / 24) * (R - L);
      s("line", { x1: x, x2: x, y1: y0 + bh, y2: y0 + bh + 5, stroke: ink3 }, clockSvg);
      txt(clockSvg, x, y0 + bh + 17, w < 480 ? String(hr) : String(hr).padStart(2, "0") + ":00", { "text-anchor": hr === 0 ? "start" : hr === 24 ? "end" : "middle", class: "ann", "font-size": 11 });
    }
    const now = new Date(), hrs = now.getHours() + now.getMinutes() / 60;
    const nx = L + (hrs / 24) * (R - L);
    const nowG = s("g", {}, clockSvg);
    s("line", { x1: nx, x2: nx, y1: y0 - 6, y2: y0 + bh, stroke: tintInk, "stroke-width": 2 }, nowG);
    const lbl = `now ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    txt(nowG, nx + (nx > R - 70 ? -5 : 5), y0 - 8 + 2, lbl, { "text-anchor": nx > R - 70 ? "end" : "start", fill: tintInk, "font-size": 11, "font-weight": 600, style: "font-family: var(--mono)" });
    clock = { bands };
    paintClock();
  });
  function paintClock() {
    if (!clock) return;
    clock.bands.forEach((b) => b.rect.setAttribute("opacity", setting === "auto" ? (b.m === mode ? 1 : 0.35) : 0.9));
  }
  let curve = null;
  fitSvg(curveSvg, (w) => Math.round(w * 0.55), (w, h) => {
    curveSvg.textContent = "";
    const L = 30, R = w - 6, T = 22, B = h - 20;
    txt(curveSvg, 0, 12, "The blend, 1.1 s", { class: "ann", fill: "#1d1b18" });
    s("line", { x1: L, x2: R, y1: B, y2: B, stroke: rule }, curveSvg);
    s("line", { x1: L, x2: L, y1: T, y2: B, stroke: rule }, curveSvg);
    txt(curveSvg, L - 6, T + 4, "1", { class: "ann", "text-anchor": "end", "font-size": 11 });
    txt(curveSvg, L - 6, B, "0", { class: "ann", "text-anchor": "end", "font-size": 11 });
    txt(curveSvg, R, B + 14, "1.1 s", { class: "ann", "text-anchor": "end", "font-size": 11 });
    txt(curveSvg, L, B + 14, "0", { class: "ann", "font-size": 11 });
    let d = "";
    for (let i = 0; i <= 60; i++) { const b = i / 60, k = b * b * (3 - 2 * b); d += (i ? " L" : "M") + (L + b * (R - L)).toFixed(1) + " " + (B - k * (B - T)).toFixed(1); }
    s("path", { d, fill: "none", stroke: ink2, "stroke-width": 1.5 }, curveSvg);
    s("path", { d: `M${L} ${B} L${R} ${T}`, fill: "none", stroke: ink3, "stroke-dasharray": "3 3" }, curveSvg);
    const dot = s("circle", { r: 5, fill: tintInk, stroke: "#f3f1ea", "stroke-width": 2 }, curveSvg);
    curve = { L, R, T, B, dot };
    placeDot();
  });
  function placeDot() {
    if (!curve) return;
    const { L, R, T, B, dot } = curve;
    dot.setAttribute("cx", L + blend * (R - L));
    dot.setAttribute("cy", B - k01 * (B - T));
  }

  /* ---------- state: Atmosphere.setMode, then update(dt) ---------- */
  function setMode(next) {
    setting = next;
    const m = next === "auto" ? modeForHour(new Date().getHours()) : next;
    paintClock();
    if (m === mode && blend >= 1) { show(); return; }
    prevMode = mode;
    mode = m;
    from = snap(cur);
    to = live(PRESETS[m]);
    // the captures cross-fade on the same curve; the newest on top
    Object.entries(imgs).forEach(([k, im]) => { im.style.zIndex = k === m ? 2 : k === prevMode ? 1 : 0; im.style.opacity = k === m ? 0 : k === prevMode ? 1 : 0; });
    paintClock();
    if (Study.reduce) { blend = 1; k01 = 1; cur = to; finish(); return; }
    blend = 0; k01 = 0;
    go();
  }
  function finish() {
    Object.entries(imgs).forEach(([k, im]) => { im.style.opacity = k === mode ? 1 : 0; });
    show();
  }
  function show() {
    paintDome(cur);
    placeDot();
    const el = (Math.asin(cur.sunDir[1]) * 180) / Math.PI;
    r("sun", `${el.toFixed(0)}°`);
    r("int", cur.sunIntensity.toFixed(2));
    r("exp", cur.exposure.toFixed(2));
    r("fog", `${Math.round(cur.fogNear)} to ${Math.round(cur.fogFar)} m`);
    r("lamps", `×${cur.lamps.toFixed(2)}`);
    r("stars", cur.stars.toFixed(2));
    r("bloom", cur.bloom.toFixed(2));
  }

  let stop = null;
  const loop = (t, dt) => {
    blend = Math.min(1, blend + dt / TRANSITION);
    k01 = blend * blend * (3 - 2 * blend);
    cur = lerpLive(from, to, k01);
    imgs[mode].style.opacity = k01.toFixed(3);
    show();
    if (blend >= 1) { finish(); stop = null; return false; }
  };
  const go = () => { if (!stop) stop = Study.raf(loop); };

  tabs(fig.querySelector('[aria-label="Mood"]'), "data-set", setMode);
  new ResizeObserver(() => { if (sizeDome()) show(); }).observe(canvas);
  sizeDome();
  show();
  return {
    start() { if (blend < 1) go(); },
    stop() { stop && stop(); stop = null; },
  };
}
