/* Subtitles case study. Each figure is built the first time it comes near the screen;
   three.js and MediaPipe load only for the figures that need them. */
import { WEEKS } from "./data.js";
import { cloudinaryUrl, formatSubtitle, fmt, clamp, tween, DPR_SITE_MAX } from "./util.js";
import { R, COUNT, fib } from "./fib.js";

const $ = (s, el = document) => el.querySelector(s);
const lazy = (sel, load, margin = "400px 0px") => {
  const el = $(sel);
  if (!el) return;
  let done = false;
  const off = Study.onVisible(el, () => {
    if (done) return;
    done = true;
    off && off();
    load(el);
  }, null, margin);
};
const fail = (el, err) => {
  console.warn(err);
  el.classList.add("is-failed");
};

/* ---------- Fig. 1, the globe (hero) ---------- */
lazy("#globe-fig", (el) => import("./globe.js").then((m) => m.initGlobe(el)).catch((e) => fail(el, e)), "200px 0px");

/* ---------- hand control: MediaPipe loads on the first press ---------- */
document.querySelectorAll("[data-hand-toggle]").forEach((b) => {
  b.addEventListener("click", async () => {
    const m = await import("./hands.js");
    m.toggle(b.getAttribute("aria-pressed") !== "true");
  });
});

/* ---------- Fig. 2, a line as data and as set ---------- */
(() => {
  const fig = $("#type-fig");
  if (!fig) return;
  const raw = $("[data-type-raw]", fig), rule = $("[data-type-rule]", fig), out = $("[data-type-out]", fig);
  const spec = $("[data-type-spec]", fig), img = $("[data-type-img]", fig), set = $(".type-set", fig);
  const weekTabs = [...fig.querySelectorAll("[data-week]")], themeTabs = [...fig.querySelectorAll("[data-theme-set]")];
  let theme = "dark";
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  function show(week) {
    const p = WEEKS.find((w) => w.week === week);
    weekTabs.forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.week === week)));
    img.src = cloudinaryUrl(p.url, 560);
    img.alt = `Week ${week}, with its subtitle burned in: ${p.subtitle.replace(/\n/g, " ")}`;
    // the string exactly as data.json stores it, escapes and all
    const json = JSON.stringify(p.subtitle);
    const marked = esc(json).replace(/\\n/g, "<mark>\\n</mark>").replace(/^"—/, '"<mark>—</mark>');
    raw.innerHTML = `<span class="k">"subtitle": </span>${marked}`;
    const dialogue = p.subtitle.trim().startsWith("—");
    const rows = p.subtitle.split(/\n/).filter(Boolean).length;
    rule.innerHTML = dialogue
      ? `starts with a dash? <b>yes</b><br>split at \\n into <b>${rows} rows</b>, Courier New`
      : `starts with a dash? <b>no</b><br>one paragraph, Satoshi`;
    out.innerHTML = "";
    out.appendChild(formatSubtitle(p.subtitle));
    paintSpec(dialogue);
  }
  function paintSpec(dialogue) {
    const col = theme === "dark" ? "#ffff00" : "#d4a800";
    spec.innerHTML = `<i style="--sw:${col}"></i>--subtitle-color ${col}<br>${dialogue ? "Courier New 13/1.55" : "Satoshi 14/1.65"} on the site, drawn here at 1.4×`;
  }
  weekTabs.forEach((b) => b.addEventListener("click", () => show(+b.dataset.week)));
  themeTabs.forEach((b) => b.addEventListener("click", () => {
    theme = b.dataset.themeSet;
    themeTabs.forEach((t) => t.setAttribute("aria-pressed", String(t === b)));
    set.dataset.theme = theme;
    paintSpec(!!out.querySelector(".dialogue"));
  }));
  show(3);
})();

/* ---------- Fig. 3, the five views (scrollytelling) ---------- */
lazy("#views-fig", (el) => import("./views.js").then((m) => m.initViews(el)).catch((e) => fail(el, e)), "600px 0px");

/* ---------- Fig. 4, the hand ---------- */
lazy("#hand-fig", (el) => import("./handfig.js").then((m) => m.initHandFig(el)).catch((e) => fail(el, e)));

/* ---------- Fig. 5, the strip ---------- */
lazy("#strip-fig", (el) => import("./strip.js").then((m) => m.initStrip(el)).catch((e) => fail(el, e)));

/* ---------- Fig. 6, the canvas ---------- */
lazy("#canvas-fig", (el) => import("./canvas.js").then((m) => m.initCanvas(el)).catch((e) => fail(el, e)));

/* ---------- Fig. 7, the card ---------- */
lazy("#card-fig", (el) => import("./cardfig.js").then((m) => m.initCardFig(el)).catch((e) => fail(el, e)));

/* ---------- Fig. 8, the globe from the side ---------- */
lazy("#side-fig", (fig) => {
  const svg = $("svg", fig), scrub = $("input", fig), outV = $("output", fig), read = $("[data-side-readout]", fig);
  const NS = "http://www.w3.org/2000/svg";
  // the hero's resting distance, worked out the way globe.js does it here
  const heroRest = () => {
    const c = $("#globe-fig .stage-canvas");
    const a = c ? c.clientWidth / Math.max(1, c.clientHeight) : 1.6;
    const v = 35 * Math.PI / 180, h = Math.atan(Math.tan(v) * a);
    return (R + 0.9) / Math.sin(Math.min(v, h) * 0.97);
  };
  const st = { z: 9, scale: 1, frame: 125 };
  let geo = null;
  function build() {
    const w = svg.getBoundingClientRect().width || 900;
    const narrow = w < 640;
    const zMin = -7.5, zMax = narrow ? 32 : 57;
    const VW = 1000, k = VW / (zMax - zMin);
    const px = VW / w;                       // user units per screen pixel
    const fs = 12 * px;
    const top = 7.2 * k, Y0 = top;           // the axis runs through the sphere's centre
    const rulerY = Y0 + 6.9 * k + 18 * px;
    const VH = rulerY + (narrow ? 94 : 58) * px;
    svg.setAttribute("viewBox", `0 0 ${VW} ${VH}`);
    svg.innerHTML = "";
    const X = (z) => (z - zMin) * k;
    const mk = (tag, a, parent = svg) => { const e = document.createElementNS(NS, tag); for (const n in a) e.setAttribute(n, a[n]); parent.appendChild(e); return e; };
    const clipId = "sd-clip";
    const defs = mk("defs", {});
    const cp = mk("clipPath", { id: clipId }, defs);
    mk("rect", { x: 0, y: Y0 - 7 * k, width: VW, height: 14 * k }, cp);
    const fov = mk("path", { class: "sd-fov", "clip-path": `url(#${clipId})` });
    const g = mk("g", {});
    mk("circle", { class: "sd-sphere", cx: 0, cy: 0, r: R * k }, g);
    // the 80 planes seen from the side: their heights along the axis step evenly
    for (let i = 0; i < COUNT; i++) {
      const p = fib(i);
      const near = (p.x / R + 1) / 2;   // how far round toward the viewer
      mk("circle", { cx: p.z * k, cy: -p.y * k, r: (1.6 + 1.6 * near) * px, class: "sd-dot", opacity: (0.25 + 0.75 * near).toFixed(2) }, g);
    }
    mk("line", { class: "sd-axis", x1: 0, x2: VW, y1: Y0, y2: Y0 });
    // the ruler under it
    mk("line", { class: "sd-axis", x1: X(zMin + 0.3), x2: VW, y1: rulerY, y2: rulerY });
    const rest = heroRest();
    const marks = [[0.5, "0.5 zoom in limit"], [R, "6 surface"], [9, "9 site rests"], [+rest.toFixed(1), `${rest.toFixed(1)} Fig. 1 rests`], [30, "30 zoom out limit"]];
    if (!narrow) marks.push([55, "55 fly-in starts"]);
    else marks[0][1] = "0.5 zoom in";
    marks.forEach(([z, t], j) => {
      mk("line", { class: "sd-mark", x1: X(z), x2: X(z), y1: rulerY - 5 * px, y2: rulerY + 5 * px });
      mk("line", { class: "sd-guide", x1: X(z), x2: X(z), y1: Y0, y2: rulerY - 5 * px });
      const row = narrow ? j : j % 3;
      const anchor = z < 3 ? "start" : X(z) > VW * 0.7 ? "end" : narrow ? "start" : "middle";
      const tx = mk("text", { class: "sd-t sd-t--m", x: X(z) + (anchor === "start" && z >= 3 ? -3 * px : 0), y: rulerY + (19 + row * 15) * px, "text-anchor": anchor, "font-size": fs * 0.95 });
      tx.textContent = t;
    });
    const cam = mk("circle", { class: "sd-cam", r: 6 * px, cy: Y0 });
    const camT = mk("text", { class: "sd-t sd-t--cam", y: Y0 - 14 * px, "text-anchor": "middle", "font-size": fs });
    camT.textContent = "camera";
    geo = { X, Y0, k, g, fov, cam, camT, VH, VW, w };
    paint();
  }
  function paint() {
    if (!geo) return;
    const { X, Y0, k, g, fov, cam, camT, VH } = geo;
    g.setAttribute("transform", `translate(${X(0)} ${Y0}) scale(${st.scale})`);
    const cx = X(st.z);
    cam.setAttribute("cx", cx); camT.setAttribute("x", cx);
    const half = 35 * Math.PI / 180, L = (st.z + 8) * k;
    fov.setAttribute("d", `M${cx - L} ${Y0 - Math.tan(half) * L}L${cx} ${Y0}L${cx - L} ${Y0 + Math.tan(half) * L}`);
    const inside = st.z < R * st.scale;
    read.innerHTML = `<li>camera z <b>${fmt(st.z, 1)}</b></li><li>${inside ? "inside the sphere" : `<b>${fmt(st.z - R * st.scale, 1)}</b> outside the surface`}</li><li>globe scale <b>${fmt(st.scale, 2)}</b></li><li>fly-in frame <b>${Math.round(st.frame)}</b> of 125</li>`;
    scrub.value = st.z; outV.textContent = fmt(st.z, 1);
  }
  let stop = () => {};
  scrub.addEventListener("input", () => { stop(); st.z = +scrub.value; st.scale = 1; st.frame = 125; paint(); });
  $("[data-side-fly]", fig).addEventListener("click", () => {
    // globe.js:437-442: 0.008 a frame, so 125 frames, a straight line from 55 to rest
    stop();
    const p = { t: 0 };
    stop = tween(p, { t: 1 }, {
      duration: 125 / 60, ease: "linear", instant: false,
      onUpdate: () => { st.z = 55 + (9 - 55) * p.t; st.scale = 0.3 + 0.7 * p.t; st.frame = p.t * 125; paint(); },
    });
  });
  new ResizeObserver(build).observe(svg);
  build();
});

/* ---------- Fig. 9, the corridor ---------- */
lazy("#museum-fig", (el) => import("./museum.js").then((m) => m.initMuseum(el)).catch((e) => fail(el, e)), "300px 0px");

/* ---------- Fig. 10, the address the page asks for ---------- */
lazy("#pipe-fig", (fig) => {
  const photo = WEEKS.find((p) => p.week === 16);   // a 1280 px original
  const img = $("img", fig), scrub = $("input", fig), outW = $("output", fig);
  const url = $("[data-pipe-url]", fig), read = $("[data-pipe-readout]", fig);
  const dprTabs = [...fig.querySelectorAll("[data-dpr]")];
  let dpr = Math.min(3, Math.max(1, Math.round(window.devicePixelRatio || 1)));
  let timer = null, want = "";
  function paint() {
    const w = +scrub.value;
    const used = Math.min(dpr, DPR_SITE_MAX);   // utils.js:1
    const asked = Math.round(w * used);
    outW.textContent = w + " px";
    img.style.width = `min(100%, ${w}px)`;
    dprTabs.forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.dpr === dpr)));
    const u = cloudinaryUrl(photo.url, w, "auto:best", used);
    url.innerHTML = u.replace(/(w_\d+,q_auto:best,f_auto,c_limit)/, "<mark>$1</mark>");
    read.innerHTML = `<li>${w} × ${used}${dpr > DPR_SITE_MAX ? ` (screen is ${dpr}, capped at 3)` : ""} = <b>${asked} px</b> asked for</li><li data-got>…</li>`;
    clearTimeout(timer);
    want = u;
    timer = setTimeout(() => { img.src = u; }, 350);
  }
  img.addEventListener("load", () => {
    if (img.src !== want) return;
    const got = img.naturalWidth;
    const asked = Math.round(+scrub.value * Math.min(dpr, DPR_SITE_MAX));
    const li = $("[data-got]", fig);
    if (li) li.innerHTML = `Cloudinary sent <b>${got} × ${img.naturalHeight}</b>${got < asked ? ", the original's full width (c_limit never enlarges)" : ""}`;
  });
  img.alt = `Week 16, with its subtitle burned in: ${photo.subtitle}`;
  scrub.addEventListener("input", paint);
  dprTabs.forEach((b) => b.addEventListener("click", () => { dpr = +b.dataset.dpr; paint(); }));
  paint();
});
