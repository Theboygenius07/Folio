/* Figs. 4, 5 and 6: plots drawn from the showcase's own numbers.
   SVGs are laid out in real pixels (viewBox = client size) so labels stay
   12px on any screen. All three share rig.progress with Fig. 1. */
import {
  K, CAMERA_PATH, CAMERA_PATH_V1, sampleCamera, warpScroll, unwarpScroll, SPRING_SCROLL,
  shippedCards, shippedCard, staticCards, staticVisible, staticScale, makeView, progress, clamp, sizeAt, fmt,
} from "./rig.js";

const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};
const text = (parent, x, y, s, cls = "ann", anchor = "start") => { const t = el("text", { x, y, class: cls, "text-anchor": anchor }, parent); t.textContent = s; return t; };
const pts = (arr) => arr.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");

/* resize-aware SVG: build(W, H) redraws the static layer */
function fitSvg(svg, build) {
  let W = 0, H = 0;
  const go = () => {
    const w = Math.round(svg.clientWidth), h = Math.round(svg.clientHeight);
    if (!w || !h || (w === W && h === H)) return;
    W = w; H = h;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.replaceChildren();
    build(W, H);
  };
  new ResizeObserver(go).observe(svg);
  go();
  return go;
}

/* a gentle loop that writes a value until the reader takes over */
function autoplay({ fig, period = 9, from = () => 0, to = () => 1, write, onStop }) {
  const Study = window.Study;
  let on = false, touched = false, stopper = null, t0 = null, btn = null;
  const loop = (t) => {
    if (!on || touched) return false;
    if (t0 == null) t0 = t;
    const k = ((t - t0) / 1000 / period) % 1;
    write(from() + (to() - from()) * k);
    return true;
  };
  const api = {
    start() { if (Study.reduce || touched) return; on = true; t0 = null; stopper = Study.raf(loop); },
    stop() { on = false; stopper && stopper(); },
    touch() { touched = true; api.stop(); onStop && onStop(); if (btn) btn.hidden = false; },
    replay() { touched = false; on = true; t0 = null; stopper && stopper(); stopper = Study.raf(loop); if (btn) btn.hidden = true; },
  };
  // reduced motion: a still frame and a Play button
  btn = document.createElement("button");
  btn.type = "button"; btn.className = "link-btn pl-play"; btn.textContent = "Play";
  btn.hidden = !Study.reduce;
  btn.addEventListener("click", () => { api.replay(); });
  fig.appendChild(btn);
  return api;
}

function bindScrub(label, get, set, digits = 3) {
  const input = label.querySelector("input"), out = label.querySelector("output");
  const max = +input.max;
  const show = (v) => { input.value = String(Math.round(v * max)); out.textContent = v.toFixed(digits); };
  return { input, show, onInput: (fn) => input.addEventListener("input", () => fn(+input.value / max)) };
}

/* ============ Fig. 4: one card, then size, then 21 ============ */
// measured track of card 10 (analysis/track-card10.json):
// [t, visible, ndcX, ndcY, screenH]
const TRACK = [[0,1,0.4402,-1.5756,0.15],[0.025,1,0.1753,-0.3257,0.3305],[0.05,1,-0.1774,-0.2866,0.3997],[0.075,1,-0.4425,-0.2489,0.3974],[0.1,1,-0.5224,-0.218,0.3931],[0.125,1,-0.4497,-0.1907,0.3868],[0.15,1,-0.2929,-0.1611,0.3789],[0.175,1,-0.1028,-0.1303,0.3694],[0.2,1,0.1028,-0.0948,0.3586],[0.225,1,0.2899,-0.0509,0.3466],[0.25,1,0.4188,0.0038,0.3337],[0.275,1,0.4473,0.0711,0.32],[0.3,1,0.3466,0.1444,0.3058],[0.325,1,0.1304,0.2138,0.2911],[0.35,1,-0.1288,0.2686,0.2762],[0.375,1,-0.3346,0.3047,0.2614],[0.4,1,-0.4255,0.337,0.2467],[0.425,1,-0.3952,0.3653,0.2323],[0.45,1,-0.2725,0.3992,0.2185],[0.475,1,-0.0963,0.4461,0.2055],[0.5,1,0.0958,0.5113,0.1933],[0.525,1,0.2692,0.6174,0.1823],[0.55,1,0.3868,0.75,0.1726],[0.575,1,0.412,0.9065,0.1644],[0.6,1,0.3206,1.075,0.1578],[0.625,1,0.1225,1.2336,0.1531],[0.65,1,-0.1245,1.3649,0.1505],[0.675,0,-0.2061,1.3862,0.1525],[0.7,0,-0.2827,1.4027,0.1539],[0.725,0,-0.351,1.4148,0.1548],[0.75,0,-0.4083,1.4233,0.1553],[0.775,0,-0.4526,1.4312,0.1554],[0.8,0,-0.4825,1.437,0.1554],[0.825,0,-0.4973,1.4417,0.1552],[0.85,0,-0.4968,1.4463,0.1551],[0.875,0,-0.4814,1.4518,0.1551],[0.9,0,-0.4516,1.4537,0.1553],[0.925,0,-0.4088,1.4579,0.1557],[0.95,0,-0.3541,1.4651,0.1564],[0.975,0,-0.289,1.476,0.1576],[1,0,-0.2148,1.4912,0.1591]];
const trackAt = (t) => {
  const f = clamp(t) * (TRACK.length - 1), i = Math.min(TRACK.length - 2, Math.floor(f)), k = f - i;
  const a = TRACK[i], b = TRACK[i + 1];
  return { t, vis: k < 0.5 ? a[1] : b[1], x: a[2] + (b[2] - a[2]) * k, y: a[3] + (b[3] - a[3]) * k, h: a[4] + (b[4] - a[4]) * k };
};

const CAPS = [
  "Card 10's path across the screen, as measured mid-tuning. Dot size is its size on screen; the dashed box is the edge of the frame.",
  "Card 10's height on screen over its life, from the shipped size rule. It peaks at its first square-on crossing, then only falls.",
  "All 21 cards' heights across the scroll, from the shipped code. Card 10 is the darker line; the upright line is where you are.",
  "The same plot. The shaded strip is the opening spring: the first 5.5% of the scroll runs the rope from 0 to 0.19.",
];

export function mountOne(root) {
  const fig = root.querySelector(".one-fig");
  const svg = fig.querySelector(".one-svg");
  const read = fig.querySelector(".one-read");
  const cap = fig.querySelector(".one-cap");
  const scrub = bindScrub(fig.querySelector(".one-scrub"));
  const cards = shippedCards(21);
  const c10 = cards[10];
  const life10 = [unwarpScroll(c10.phase), unwarpScroll(c10.phase + K.LIFE_SPAN)];
  let step = +(root.dataset.step || 0);
  let dyn = {}, W = 0, H = 0;

  const ap = autoplay({
    fig, period: 9,
    from: () => (step === 1 ? life10[0] : 0),
    to: () => (step === 1 ? life10[1] : 1),
    write: (v) => progress.set(v, "one"),
  });
  scrub.onInput((v) => { ap.touch(); progress.set(v, "one"); });

  function build(w, h) {
    W = w; H = h; dyn = {};
    if (step === 0) buildTrack(); else if (step === 1) buildSize(); else buildAll();
    update(progress.t);
  }
  const redraw = fitSvg(svg, build);

  // ---- step 1: the measured path ----
  function frameMap() {
    const sx = Math.min((W - 40) / 2, ((H - 30) / 2 / 1.62) * 16 / 9);
    const sy = sx * 9 / 16;
    return { sx, sy, cx: W / 2, cy: H / 2 + 6, X: (x) => W / 2 + x * sx, Y: (y) => H / 2 + 6 - y * sy };
  }
  function buildTrack() {
    const m = frameMap();
    el("line", { x1: m.cx, y1: 4, x2: m.cx, y2: H - 4, class: "pl-grid" }, svg);
    el("line", { x1: 4, y1: m.cy, x2: W - 4, y2: m.cy, class: "pl-grid" }, svg);
    el("rect", { x: m.X(-1), y: m.Y(1), width: 2 * m.sx, height: 2 * m.sy, class: "pl-frame" }, svg);
    text(svg, m.X(1) - 6, m.Y(1) + 16, "edge of the frame", "ann", "end");
    const vis = TRACK.filter((s) => s[1]);
    el("polyline", { points: pts(vis.map((s) => [m.X(s[2]), m.Y(s[3])])), class: "pl-line" }, svg);
    TRACK.forEach((s) => el("circle", { cx: m.X(s[2]), cy: m.Y(s[3]), r: s[1] ? Math.max(2, s[4] * 46) : 2, class: s[1] ? "pl-ring" : "pl-cull" }, svg));
    const a = vis[0], z = vis[vis.length - 1];
    text(svg, m.X(a[2]) + 12, m.Y(a[3]) + 4, "enters");
    text(svg, m.X(z[2]) + 12, m.Y(z[3]) + 4, "leaves");
    text(svg, m.X(-0.48) - 10, m.Y(1.45) - 8, "culled, off frame", "ann", "end");
    dyn.dot = el("circle", { class: "pl-dot" }, svg);
  }
  // ---- step 2: size over one life ----
  function sizeMap() {
    const L = 46, R = 16, T = 22, B = 34;
    return { L, R, T, B, X: (u) => L + u * (W - L - R), Y: (h) => H - B - ((h - 0.12) / (0.42 - 0.12)) * (H - T - B) };
  }
  function buildSize() {
    const m = sizeMap();
    [K.S_MIN, K.S_MAX].forEach((h) => {
      el("line", { x1: m.L, x2: W - m.R, y1: m.Y(h), y2: m.Y(h), class: "pl-grid" }, svg);
      text(svg, m.L - 8, m.Y(h) + 4, Math.round(h * 100) + "%", "ann", "end");
    });
    el("line", { x1: m.L, x2: W - m.R, y1: H - m.B, y2: H - m.B, class: "pl-axis" }, svg);
    [0, 0.25, 0.5, 0.75, 1].forEach((u) => text(svg, m.X(u), H - m.B + 18, u.toFixed(2), "ann", "middle"));
    text(svg, W - m.R, H - m.B - 8, "card 10's life", "ann", "end");
    const xf = m.X(c10.uFocus);
    el("line", { x1: xf, x2: xf, y1: m.T, y2: H - m.B, class: "pl-grid pl-dash" }, svg);
    text(svg, xf + 6, H - m.B - 8, "square-on, u " + c10.uFocus.toFixed(3));
    const fr = [], sz = [];
    for (let i = 0; i <= 300; i++) {
      const u = i / 300, s = sizeAt(u, c10);
      sz.push([m.X(u), m.Y(s.h)]);
      fr.push([m.X(u), m.Y(0.12 + s.frontness * 0.3)]);
    }
    el("polyline", { points: pts(fr), class: "pl-line pl-ghost" }, svg);
    text(svg, m.X(0.6) + 4, m.Y(0.12 + 0.3 * 0.96) - 6, "facing the camera", "ann");
    el("polyline", { points: pts(sz), class: "pl-line pl-line--tint" }, svg);
    dyn.dot = el("circle", { r: 6, class: "pl-dot" }, svg);
    dyn.vline = el("line", { y1: m.T, y2: H - m.B, class: "pl-play-line" }, svg);
  }
  // ---- steps 3 and 4: all 21 ----
  function allMap() {
    const L = 46, R = 16, T = 22, B = 34;
    return { L, R, T, B, X: (t) => L + t * (W - L - R), Y: (h) => H - B - ((h - 0.12) / (0.42 - 0.12)) * (H - T - B) };
  }
  function buildAll() {
    const m = allMap();
    if (step === 3) {
      el("rect", { x: m.X(0), y: m.T, width: m.X(SPRING_SCROLL) - m.X(0), height: H - m.T - m.B, class: "pl-band" }, svg);
      text(svg, m.X(SPRING_SCROLL) + 6, H - m.B - 8, "spring, 0 to 0.055");
    }
    [K.S_MIN, K.S_MAX].forEach((h) => {
      el("line", { x1: m.L, x2: W - m.R, y1: m.Y(h), y2: m.Y(h), class: "pl-grid" }, svg);
      text(svg, m.L - 8, m.Y(h) + 4, Math.round(h * 100) + "%", "ann", "end");
    });
    el("line", { x1: m.L, x2: W - m.R, y1: H - m.B, y2: H - m.B, class: "pl-axis" }, svg);
    [0, 0.25, 0.5, 0.75, 1].forEach((t) => text(svg, m.X(t), H - m.B + 18, t.toFixed(2), "ann", "middle"));
    text(svg, W - m.R, H - m.B - 8, "scroll", "ann", "end");
    dyn.lines = cards.map((c) => {
      const seg = [];
      for (let i = 0; i <= 600; i++) {
        const t = i / 600, u = (warpScroll(t) - c.phase) / K.LIFE_SPAN;
        if (u < 0 || u > 1) continue;
        seg.push([m.X(t), m.Y(sizeAt(u, c).h)]);
      }
      return el("polyline", { points: pts(seg), class: c.i === 10 ? "pl-line pl-line--tint" : "pl-line pl-thin" }, svg);
    });
    const p0 = cards[0], p20 = cards[20];
    text(svg, m.X(unwarpScroll(p0.focusAt)) + 4, m.Y(K.S_MAX) - 6, "card 0");
    text(svg, m.X(unwarpScroll(p20.focusAt)) + 4, m.Y(K.S_MAX) - 6, "card 20");
    dyn.vline = el("line", { y1: m.T, y2: H - m.B, class: "pl-play-line" }, svg);
    dyn.dots = cards.map((c) => el("circle", { r: c.i === 10 ? 5 : 3.2, class: c.i === 10 ? "pl-dot" : "pl-dot pl-dot--ink" }, svg));
  }

  function update(t) {
    scrub.show(t);
    if (!W) return;
    if (step === 0) {
      const m = frameMap(), s = trackAt(t);
      dyn.dot.setAttribute("cx", m.X(s.x)); dyn.dot.setAttribute("cy", m.Y(s.y)); dyn.dot.setAttribute("r", Math.max(3, s.h * 46));
      dyn.dot.classList.toggle("is-off", !s.vis);
      read.innerHTML = `<li>t <b>${t.toFixed(3)}</b></li><li>x <b>${fmt(s.x)}</b></li><li>y <b>${fmt(s.y)}</b></li><li>height <b>${(s.h * 100).toFixed(1)}%</b></li><li><b>${s.vis ? "drawn" : "culled"}</b></li>`;
    } else if (step === 1) {
      const m = sizeMap();
      const u = (warpScroll(t) - c10.phase) / K.LIFE_SPAN;
      const uu = clamp(u), s = sizeAt(uu, c10);
      dyn.dot.setAttribute("cx", m.X(uu)); dyn.dot.setAttribute("cy", m.Y(s.h));
      dyn.vline.setAttribute("x1", m.X(uu)); dyn.vline.setAttribute("x2", m.X(uu));
      const state = u < 0 ? "not born yet" : u > 1 ? "gone" : "alive";
      read.innerHTML = `<li>scroll <b>${t.toFixed(3)}</b></li><li>life u <b>${u < 0 ? "below 0" : u > 1 ? "above 1" : uu.toFixed(3)}</b></li><li>facing <b>${s.frontness.toFixed(2)}</b></li><li>height <b>${(s.h * 100).toFixed(1)}%</b></li><li><b>${state}</b></li>`;
    } else {
      const m = allMap(), x = m.X(t), r = warpScroll(t);
      dyn.vline.setAttribute("x1", x); dyn.vline.setAttribute("x2", x);
      let alive = 0, feat = null, fb = -1;
      cards.forEach((c, i) => {
        const u = (r - c.phase) / K.LIFE_SPAN, d = dyn.dots[i];
        if (u < 0 || u > 1) { d.setAttribute("visibility", "hidden"); return; }
        alive++;
        const s = sizeAt(u, c);
        d.setAttribute("visibility", "visible"); d.setAttribute("cx", x); d.setAttribute("cy", m.Y(s.h));
        if (s.hump > fb) { fb = s.hump; feat = c.i; }
      });
      read.innerHTML = `<li>scroll <b>${t.toFixed(3)}</b></li><li>rope <b>${r.toFixed(3)}</b></li><li>alive <b>${alive}</b></li><li>largest <b>${feat == null ? "none" : "card " + feat}</b></li>`;
    }
  }

  progress.on((v) => update(v));
  root.addEventListener("step", (e) => {
    const i = e.detail.index;
    if (i === step) return;
    step = i;
    cap.textContent = CAPS[i];
    svg.replaceChildren(); build(W, H);
  });
  step = +(root.dataset.step || 0);
  cap.textContent = CAPS[step];
  redraw();
  return { start() { ap.start(); }, stop() { ap.stop(); } };
}

/* ============ Fig. 5: card 10 under the static staircase and the sweep ============ */
function trackModel(model, n = 160) {
  const out = [];
  if (model === "v1") {
    const c = staticCards(21)[10];
    // life = the window where it is drawn: scroll from p - 0.5 to p + 0.5
    for (let i = 0; i <= n; i++) {
      const u = i / n, t = clamp(c.p - 0.5 + u);
      const cam = sampleCamera(t, CAMERA_PATH_V1);
      const v = makeView(cam, cam.tgtY, 16 / 9);
      const p = v(c.x, c.y, c.z), pc = v(0, c.y, 0);
      const sc = staticScale(p.x, p.y);
      const frameH = 2 * p.w * Math.tan((cam.fov * Math.PI) / 360);
      out.push({ u, t, x: p.x, y: p.y, h: (K.H * sc) / frameH, behind: p.w > pc.w, cam });
    }
  } else {
    const c = shippedCards(21)[10];
    for (let i = 0; i <= n; i++) {
      const u = i / n, rope = c.phase + u * K.LIFE_SPAN, t = unwarpScroll(rope);
      const cam = sampleCamera(t); cam.aspect = 16 / 9;
      const s = shippedCard(c, cam, rope, cam.tgtY);
      const v = makeView(cam, cam.tgtY, 16 / 9);
      const p = v(s.x, s.y, s.z), pc = v(0, s.y, 0);
      out.push({ u, t, x: p.x, y: p.y, h: s.targetH, behind: p.w > pc.w, cam });
    }
  }
  return out;
}

export function mountMove(fig) {
  const scrub = bindScrub(fig.querySelector(".mv-scrub"));
  let u = 0.3;
  const views = [...fig.querySelectorAll(".mv-svg")].map((svg) => {
    const model = svg.dataset.model;
    const read = fig.querySelector(`.mv-read[data-model="${model}"]`);
    const tr = trackModel(model);
    const v = { svg, model, read, tr, W: 0, H: 0, dyn: {} };
    v.map = () => {
      const sx = Math.min((v.W - 30) / 2, ((v.H - 24) / 3.4) * 16 / 9), sy = sx * 9 / 16;
      const cy = v.H * 0.48;
      return { sx, sy, X: (x) => v.W / 2 + x * sx, Y: (y) => cy - y * sy };
    };
    fitSvg(svg, (W, H) => {
      v.W = W; v.H = H;
      const m = v.map();
      el("rect", { x: m.X(-1), y: m.Y(1), width: 2 * m.sx, height: 2 * m.sy, class: "pl-frame" }, svg);
      v.dyn.her = el("rect", { class: "pl-her", rx: 3 }, svg);
      el("polyline", { points: pts(tr.map((p) => [m.X(p.x), m.Y(p.y)])), class: "pl-line pl-thin" }, svg);
      tr.forEach((p, i) => { if (i % 8 === 0) el("circle", { cx: m.X(p.x), cy: m.Y(p.y), r: Math.max(1.5, p.h * 30), class: "pl-ring" }, svg); });
      const a = tr[0], z = tr[tr.length - 1];
      el("circle", { cx: m.X(a.x), cy: m.Y(a.y), r: 3, class: "pl-dot pl-dot--ink" }, svg);
      text(svg, m.X(a.x) + (a.x < 0 ? -8 : 8), m.Y(a.y) + 4, "born", "ann", a.x < 0 ? "end" : "start");
      text(svg, m.X(z.x) + 8, m.Y(z.y) + 4, "gone", "ann", "start");
      v.dyn.dot = el("circle", { class: "pl-dot" }, svg);
      draw(v);
    });
    return v;
  });

  function draw(v) {
    if (!v.W) return;
    const m = v.map();
    const f = u * (v.tr.length - 1), i = Math.min(v.tr.length - 2, Math.floor(f)), k = f - i;
    const a = v.tr[i], b = v.tr[i + 1];
    const x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k, h = a.h + (b.h - a.h) * k;
    const behind = k < 0.5 ? a.behind : b.behind;
    // her, as an upright bar at the camera's current view
    const cam = k < 0.5 ? a.cam : b.cam;
    const vw = makeView(cam, cam.tgtY, 16 / 9);
    const ft = vw(0, 0, 0), hd = vw(0, 2, 0), wd = vw(0.18, 1, 0), ce = vw(0, 1, 0);
    const half = Math.max(3, Math.abs(wd.x - ce.x) * m.sx);
    v.dyn.her.setAttribute("x", m.X(ft.x) - half); v.dyn.her.setAttribute("width", 2 * half);
    v.dyn.her.setAttribute("y", m.Y(hd.y)); v.dyn.her.setAttribute("height", Math.max(4, m.Y(ft.y) - m.Y(hd.y)));
    v.dyn.dot.setAttribute("cx", m.X(x)); v.dyn.dot.setAttribute("cy", m.Y(y)); v.dyn.dot.setAttribute("r", Math.max(3, h * 30));
    v.dyn.dot.classList.toggle("is-behind", behind);
    const inFrame = Math.abs(x) <= 1 && Math.abs(y) <= 1;
    v.read.innerHTML = `<li>x <b>${fmt(x)}</b></li><li>y <b>${fmt(y)}</b></li><li>height <b>${(h * 100).toFixed(0)}%</b></li><li><b>${!inFrame ? "off frame" : behind ? "behind her" : "in front"}</b></li>`;
  }
  const set = (nu) => { u = clamp(nu); scrub.show(u); views.forEach(draw); };
  const ap = autoplay({ fig, period: 10, write: set });
  scrub.onInput((nu) => { ap.touch(); set(nu); });
  set(u);
  return { start() { ap.start(); }, stop() { ap.stop(); } };
}

/* ============ Fig. 6: the camera tables, plotted ============ */
const CHANNELS = [
  { key: "orbit", col: 1, label: "orbit", unit: "°", lo: 40, hi: 440, ticks: [60, 240, 420], dig: 1 },
  { key: "dist", col: 2, label: "distance", unit: " m", lo: 7.2, hi: 11.1, ticks: [7.56, 9, 10.77], dig: 2 },
  { key: "lens", col: 5, label: "lens", unit: " mm", lo: 56, hi: 96, ticks: [60, 76, 92], dig: 0 },
];
export function mountCam(fig) {
  const host = fig.querySelector(".cam-plots");
  const read = fig.querySelector(".cam-read");
  const scrub = bindScrub(fig.querySelector(".cam-scrub"));
  const plots = CHANNELS.map((ch) => {
    const svg = el("svg", { class: "cam-svg", role: "img", "aria-label": `Camera ${ch.label} over the scroll, what shipped against the first version` }, host);
    const p = { ch, svg, W: 0, H: 0, dyn: {} };
    p.map = () => {
      const L = 44, R = 10, T = 26, B = 28;
      return { L, R, T, B, X: (t) => L + t * (p.W - L - R), Y: (v) => p.H - B - ((v - ch.lo) / (ch.hi - ch.lo)) * (p.H - T - B) };
    };
    fitSvg(svg, (W, H) => {
      p.W = W; p.H = H;
      const m = p.map();
      text(svg, m.L, 14, ch.label, "ann pl-title");
      el("rect", { x: m.X(0), y: m.T, width: m.X(0.12) - m.X(0), height: H - m.T - m.B, class: "pl-band" }, svg);
      ch.ticks.forEach((v) => {
        el("line", { x1: m.L, x2: W - m.R, y1: m.Y(v), y2: m.Y(v), class: "pl-grid" }, svg);
        text(svg, m.L - 6, m.Y(v) + 4, String(v), "ann", "end");
      });
      el("line", { x1: m.L, x2: W - m.R, y1: H - m.B, y2: H - m.B, class: "pl-axis" }, svg);
      [0, 0.5, 1].forEach((t) => text(svg, m.X(t), H - m.B + 17, String(t), "ann", "middle"));
      const line = (path, cls) => {
        el("polyline", { points: pts(path.map((r) => [m.X(r[0]), m.Y(r[ch.col])])), class: cls }, svg);
        path.forEach((r) => el("circle", { cx: m.X(r[0]), cy: m.Y(r[ch.col]), r: 2.4, class: cls.includes("dash") ? "pl-ring" : "pl-dot pl-dot--ink" }, svg));
      };
      line(CAMERA_PATH_V1, "pl-line pl-thin pl-dash");
      line(CAMERA_PATH, "pl-line pl-line--tint");
      p.dyn.v = el("line", { y1: m.T, y2: H - m.B, class: "pl-play-line" }, svg);
      p.dyn.dot = el("circle", { r: 5.5, class: "pl-dot" }, svg);
      draw(p, progress.t);
    });
    // drag across a plot to scrub
    let dragging = false;
    const fromX = (e) => { const r = svg.getBoundingClientRect(), m = p.map(); return clamp(((e.clientX - r.left) * (p.W / r.width) - m.L) / (p.W - m.L - m.R)); };
    svg.addEventListener("pointerdown", (e) => { dragging = true; svg.setPointerCapture(e.pointerId); progress.set(fromX(e), "cam"); });
    svg.addEventListener("pointermove", (e) => { if (dragging) progress.set(fromX(e), "cam"); });
    svg.addEventListener("pointerup", () => (dragging = false));
    svg.addEventListener("pointercancel", () => (dragging = false));
    return p;
  });
  function draw(p, t) {
    if (!p.W) return;
    const m = p.map(), s = sampleCamera(t);
    const v = s[p.ch.key];
    p.dyn.v.setAttribute("x1", m.X(t)); p.dyn.v.setAttribute("x2", m.X(t));
    p.dyn.dot.setAttribute("cx", m.X(t)); p.dyn.dot.setAttribute("cy", m.Y(v));
  }
  function update(t) {
    scrub.show(t);
    plots.forEach((p) => draw(p, t));
    const s = sampleCamera(t), o = sampleCamera(t, CAMERA_PATH_V1);
    read.innerHTML = `<li>scroll <b>${t.toFixed(3)}</b></li><li>orbit <b>${s.orbit.toFixed(1)}°</b> <span class="pl-was">first version ${o.orbit.toFixed(1)}°</span></li><li>distance <b>${s.dist.toFixed(2)} m</b></li><li>lens <b>${s.lens.toFixed(0)} mm</b></li>`;
  }
  scrub.onInput((v) => progress.set(v, "cam"));
  progress.on(update);
  update(progress.t);
  return { start() {}, stop() {} };
}
