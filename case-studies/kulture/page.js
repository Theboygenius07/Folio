/* KULTURE* case study: the live figures.

   Every mechanic here is ported from the event site and its print scripts,
   with the same constants. Sources, all in /Users/user/Downloads/Kulture:
     js/main.js            hero panels 36-98, cursor 101-119, tilt 219-243,
                           tiers and name 245-315, marquee 324-373,
                           font cycle 376-430, experience cards 500-545,
                           flip clock 553-608
     tickets/generate.js   buildSVG(): the printed passes
     backdrop/generate.js  buildBackdrop(): the step-and-repeat
   GSAP is the same 3.12.5 the site loaded from cdnjs.
*/
const S = window.Study;
const gsap = window.gsap;

const NS = "http://www.w3.org/2000/svg";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const minus = (s) => s.replace(/^-/, "−");
const fix = (v, d) => { const f = Math.pow(10, d); const r = Math.round(v * f) / f; return minus((Object.is(r, -0) ? 0 : r).toFixed(d)); };
const deg = (v, d = 1) => fix(v, d) + "°";
const DPR = () => Math.min(2, window.devicePixelRatio || 1);

function el(tag, attrs, parent, text) {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
/* Diagrams are drawn in real pixels: the viewBox is the rendered size, so a 12px label is 12px. */
function sizeSvg(svg, h) {
  const w = Math.max(220, Math.round(svg.getBoundingClientRect().width || svg.parentNode.getBoundingClientRect().width));
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("height", h);
  svg.replaceChildren();
  return w;
}
function onResize(node, fn) {
  let w = -1, q = 0;
  new ResizeObserver(([e]) => {
    const nw = Math.round(e.contentRect.width);
    if (nw === w) return;
    w = nw; cancelAnimationFrame(q); q = requestAnimationFrame(fn);
  }).observe(node);
}
function curve(fn, n, X, Y) {
  let d = "";
  for (let i = 0; i <= n; i++) { const t = i / n; d += (i ? "L" : "M") + X(t).toFixed(1) + "," + Y(fn(t)).toFixed(1); }
  return d;
}
function pressOne(group, btn) { $$("button", group).forEach((b) => b.setAttribute("aria-pressed", String(b === btn))); }

/* Lagos is UTC+1 all year, so 21:00 WAT is 20:00 UTC. */
function nextDoors(now) {
  const d = new Date(now);
  let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 20, 0, 0);
  if (t <= now) t += 864e5;
  return t;
}
/* js/main.js:556-561 */
const UNITS = [
  { t: "d0", u: "d1", get: (d) => Math.floor(d / 864e5) },
  { t: "h0", u: "h1", get: (d) => Math.floor((d % 864e5) / 36e5) },
  { t: "m0", u: "m1", get: (d) => Math.floor((d % 36e5) / 6e4) },
  { t: "s0", u: "s1", get: (d) => Math.floor((d % 6e4) / 1e3) },
];

/* ------------------------------------------------------------------
   The tilt. js/main.js:219-243, plus touch, pen and keys.
   ------------------------------------------------------------------ */
const MAX_TILT = 12;  // js/main.js:223
const PERSP = 900;    // js/main.js:224

function tilt(card, hooks = {}) {
  let on = !S.reduce, drag = false, kx = 0, ky = 0, n = 0;
  const to = (x, y) => {
    x = clamp(x, -0.5, 0.5); y = clamp(y, -0.5, 0.5);
    gsap.to(card, { rotateX: -y * MAX_TILT, rotateY: x * MAX_TILT, transformPerspective: PERSP, duration: 0.35, ease: "power2.out" });
    n++;
    hooks.move && hooks.move(x, y, n);
  };
  const at = (e) => {
    const r = card.getBoundingClientRect();
    to((e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5);
  };
  const back = () => {
    gsap.to(card, { rotateX: 0, rotateY: 0, duration: 0.55, ease: "elastic.out(1,0.5)" });
    kx = ky = 0;
    hooks.leave && hooks.leave();
  };
  card.addEventListener("pointermove", (e) => { if (on && (e.pointerType === "mouse" || drag)) at(e); });
  card.addEventListener("pointerleave", (e) => { if (on && e.pointerType === "mouse") back(); });
  card.addEventListener("pointerdown", (e) => { if (on && e.pointerType !== "mouse") { drag = true; at(e); } });
  const up = () => { if (drag) { drag = false; back(); } };
  card.addEventListener("pointerup", up);
  card.addEventListener("pointercancel", up);
  card.addEventListener("keydown", (e) => {
    if (!on || e.target !== card) return;
    const k = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[e.key];
    if (k) { e.preventDefault(); kx = clamp(kx + k[0], -0.5, 0.5); ky = clamp(ky + k[1], -0.5, 0.5); to(kx, ky); }
    else if (e.key === "Escape" || e.key === "0") back();
  });
  card.addEventListener("blur", () => { if (kx || ky) back(); });
  return { enable() { on = true; } };
}
/* A cast shadow under a floating card: the lifted edge throws its shadow further out. */
function shadowFor(shadow, base) {
  return (rx, ry) => { shadow.style.transform = `translate3d(${(-ry * 1.8).toFixed(2)}px, ${(base + rx * 1.8).toFixed(2)}px, 0) scale(0.97)`; };
}

/* ------------------------------------------------------------------
   Fig. 1: the pass on the paper
   ------------------------------------------------------------------ */
function hero() {
  const fig = $("#kHero");
  const card = $("#ticketCard");
  if (!fig || !card) return;
  const rx = $("[data-rx]", fig), ry = $("[data-ry]", fig);
  const cast = shadowFor($(".k-shadow", fig), 24);
  const t = tilt(card);
  const go = $("[data-tilt-on]", fig);
  go && go.addEventListener("click", () => { t.enable(); go.remove(); });

  let lx = NaN, ly = NaN, stop = null;
  const frame = () => {
    const x = gsap.getProperty(card, "rotateX"), y = gsap.getProperty(card, "rotateY");
    if (x === lx && y === ly) return;
    lx = x; ly = y;
    cast(x, y);
    rx.textContent = deg(x); ry.textContent = deg(y);
  };
  S.onVisible(fig, () => { stop = S.raf(frame); }, () => stop && stop());

  /* tiers, js/main.js:255-258 and 263-280 */
  const tierData = {
    earlybird: { label: "EARLY BIRD", code: "KULTURE25 · EB · OJO" },
    vip: { label: "VIP", code: "KULTURE25 · VIP · OJO" },
    table: { label: "TABLE", code: "KULTURE25 · TBL · OJO" },
  };
  const tierVal = $("#ticketTierVal"), stubTier = $("#stubTier"), code = $("#ticketCode");
  const tabs = $(".tabs", fig);
  tabs.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tier]");
    if (!b) return;
    const d = tierData[b.dataset.tier];
    pressOne(tabs, b);
    tierVal.textContent = d.label;
    stubTier.textContent = d.label;
    code.textContent = d.code;
    if (!S.reduce) gsap.from(tierVal, { y: -6, opacity: 0, duration: 0.25, ease: "power2.out" });
  });

  /* the name, mirrored to the stub. js/main.js:287-314 */
  const name = $("#ticketName"), stub = $("#stubName");
  name.addEventListener("input", () => {
    const v = name.textContent.trim();
    stub.textContent = v || "YOUR NAME";
    name.classList.toggle("has-content", v !== "" && v !== "YOUR NAME");
  });
  name.addEventListener("focus", () => {
    if (name.textContent !== "YOUR NAME") return;
    const sel = getSelection(), range = document.createRange();
    range.selectNodeContents(name); sel.removeAllRanges(); sel.addRange(range);
  });
  name.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); name.blur(); } });
  name.addEventListener("blur", () => { if (!name.textContent.trim()) { name.textContent = "YOUR NAME"; name.classList.remove("has-content"); } });
  name.addEventListener("paste", (e) => { e.preventDefault(); document.execCommand("insertText", false, (e.clipboardData.getData("text") || "").replace(/\s+/g, " ")); });
}

/* ------------------------------------------------------------------
   Fig. 2: the pass as a build plan, on tickets/generate.js's grid
   (W 850, H 350, PERF_X 645, STUB_X 668, PAD 38)
   ------------------------------------------------------------------ */
const QR = [
  [0,0,7,1],[8,0,1,1],[10,0,1,1],[14,0,7,1],[0,1,1,1],[6,1,1,1],[10,1,2,1],[14,1,1,1],[20,1,1,1],
  [0,2,1,1],[2,2,3,1],[6,2,1,1],[8,2,1,1],[11,2,1,1],[14,2,1,1],[16,2,3,1],[20,2,1,1],
  [0,3,1,1],[2,3,3,1],[6,3,1,1],[9,3,1,1],[12,3,1,1],[14,3,1,1],[16,3,3,1],[20,3,1,1],
  [0,4,1,1],[2,4,3,1],[6,4,1,1],[8,4,1,1],[10,4,1,1],[14,4,1,1],[16,4,3,1],[20,4,1,1],
  [0,5,1,1],[6,5,1,1],[9,5,1,1],[11,5,2,1],[14,5,1,1],[20,5,1,1],
  [0,6,7,1],[8,6,1,1],[10,6,1,1],[12,6,1,1],[14,6,7,1],[9,7,1,1],[11,7,1,1],
  [1,8,1,1],[3,8,1,1],[6,8,1,1],[8,8,1,1],[10,8,1,1],[15,8,1,1],[17,8,1,1],[20,8,1,1],
  [2,9,1,1],[4,9,1,1],[9,9,1,1],[12,9,1,1],[14,9,1,1],[16,9,1,1],[19,9,1,1],
  [0,10,1,1],[3,10,1,1],[5,10,2,1],[8,10,1,1],[10,10,1,1],[15,10,1,1],[18,10,1,1],
  [1,11,1,1],[4,11,1,1],[9,11,1,1],[11,11,1,1],[14,11,1,1],[17,11,1,1],[19,11,1,1],
  [0,12,1,1],[2,12,1,1],[5,12,2,1],[8,12,1,1],[12,12,1,1],[15,12,2,1],[20,12,1,1],
  [8,13,1,1],[10,13,1,1],[13,13,1,1],[17,13,1,1],
  [0,14,7,1],[9,14,1,1],[12,14,1,1],[14,14,1,1],[18,14,1,1],
  [0,15,1,1],[6,15,1,1],[8,15,1,1],[10,15,1,1],[15,15,1,1],[17,15,1,1],[20,15,1,1],
  [0,16,1,1],[2,16,3,1],[6,16,1,1],[11,16,1,1],[14,16,1,1],[19,16,1,1],
  [0,17,1,1],[2,17,3,1],[6,17,1,1],[8,17,1,1],[12,17,1,1],[15,17,1,1],[17,17,1,1],[20,17,1,1],
  [0,18,1,1],[2,18,3,1],[6,18,1,1],[9,18,1,1],[11,18,1,1],[14,18,1,1],[18,18,1,1],
  [0,19,1,1],[6,19,1,1],[8,19,1,1],[10,19,1,1],[16,19,1,1],[19,19,1,1],
  [0,20,7,1],[11,20,1,1],[14,20,1,1],[17,20,1,1],[20,20,1,1],
]; // tickets/generate.js:12-36, the same 130 rectangles as the site's QR
const BARS = [[0,2],[3,1],[5,2],[9,3],[13,1],[16,2],[20,3],[24,1],[27,2],[30,2],[33,1],[35,2]]; // generate.js:39

function anatomy() {
  const box = $("#kAnat");
  const host = box && $(".k-anat-fig", box);
  if (!host) return;
  const svg = el("svg", { viewBox: "-6 -6 862 362", "aria-hidden": "true" }, host);
  const W = 850, H = 350, PERF = 656, STUB_X = 668, PAD = 38;
  const T = (g, x, y, s, size, cls, more) => el("text", Object.assign({ x, y, "font-size": size, class: cls }, more || {}), g, s);
  const part = (plan, hl) => {
    const g = el("g", { class: "pt", "data-state": "plan" }, svg);
    el("rect", { class: "hl-box", x: hl[0], y: hl[1], width: hl[2], height: hl[3], rx: 4 }, g);
    const p = el("g", { class: "plan" }, g);
    plan.forEach((r) => el("rect", { x: r[0], y: r[1], width: r[2], height: r[3], rx: 3 }, p));
    return { g, built: el("g", { class: "built" }, g) };
  };

  // 0. the shape: body, stub, perforation, notches
  const shape = part([[0, 0, W, H]], [PERF - 22, 0, 44, H]);
  el("path", { d: `M0,0 H${PERF - 14} A14,14 0 0 0 ${PERF + 14},0 H${W} V${H} H${PERF + 14} A14,14 0 0 0 ${PERF - 14},${H} H0 Z`, fill: "rgba(237,217,163,0.32)", stroke: "var(--ink)", "stroke-width": 1.5 }, shape.built);
  el("line", { x1: PERF, y1: 16, x2: PERF, y2: H - 16, stroke: "var(--ink-2)", "stroke-width": 1.2, "stroke-dasharray": "4 4" }, shape.built);
  T(shape.built, PAD, 64, "KULTURE", 30, "fd ink", { "letter-spacing": -0.5 });
  T(shape.built, PAD + 145, 64, "*", 30, "fd red");
  el("line", { x1: PAD, y1: 82, x2: PERF - 20, y2: 82, stroke: "var(--rule)", "stroke-width": 1.2 }, shape.built);
  el("line", { x1: PAD, y1: 198, x2: PERF - 20, y2: 198, stroke: "var(--rule)", "stroke-width": 1.2 }, shape.built);

  // 1. route
  const route = part([[358, 26, 214, 46]], [352, 20, 226, 58]);
  T(route.built, 365, 49, "OJO", 22, "fd ink", { "letter-spacing": 0.5 });
  el("line", { x1: 428, y1: 53, x2: 512, y2: 53, class: "stroke", "stroke-width": 1.2 }, route.built);
  el("path", { d: "M504,48 L512,53 L504,58", class: "stroke", "stroke-width": 1.2 }, route.built);
  T(route.built, 523, 49, "PTY", 22, "fd ink", { "letter-spacing": 0.5 });
  T(route.built, 365, 66, "LAGOS", 11, "fu ink-2", { "letter-spacing": 1.5 });
  T(route.built, 523, 66, "PARTY", 11, "fu ink-2", { "letter-spacing": 1.5 });

  // 2. passenger
  const pass = part([[PAD - 4, 90, 300, 48]], [PAD - 10, 86, 312, 56]);
  T(pass.built, PAD, 103, "PASSENGER", 11, "fu ink-2", { "letter-spacing": 2.5 });
  T(pass.built, PAD, 131, "YOUR NAME", 24, "fd ink", { "letter-spacing": 1 });
  el("line", { x1: PAD, y1: 137, x2: PAD + 178, y2: 137, stroke: "var(--ink-3)", "stroke-dasharray": "3 3" }, pass.built);

  // 3. gate, departs, date
  const gate = part([[PAD - 4, 150, 362, 40]], [PAD - 10, 146, 374, 48]);
  [["GATE", "A1", PAD], ["DEPARTS", "21:00", 144], ["DATE", "JUL 2025", 280]].forEach(([l, v, x]) => {
    T(gate.built, x, 164, l, 11, "fu ink-2", { "letter-spacing": 2 });
    T(gate.built, x, 184, v, 17, "fd ink");
  });

  // 4. class
  const cls = part([[414, 150, 190, 40]], [408, 146, 202, 48]);
  T(cls.built, 420, 164, "CLASS", 11, "fu ink-2", { "letter-spacing": 2 });
  const clsVal = T(cls.built, 420, 184, "VIP", 17, "fd red");

  // 5. the code
  const qr = part([[PAD - 4, 204, 340, 78]], [PAD - 10, 200, 352, 86]);
  const qg = el("g", { class: "ink" }, qr.built);
  const u = 70 / 21;
  QR.forEach(([x, y, w, h]) => el("rect", { x: PAD + x * u, y: 208 + y * u, width: w * u, height: h * u }, qg));
  T(qr.built, PAD + 88, 230, "KULTURE25 · VIP · OJO", 12, "fu ink", { "letter-spacing": 1 });
  T(qr.built, PAD + 88, 250, "SCAN TO VERIFY", 11, "fu ink-2", { "letter-spacing": 1.5 });

  // 6. the stub
  const stub = part([[STUB_X + 8, 28, 160, 300]], [STUB_X + 2, 22, 172, 312]);
  T(stub.built, STUB_X + 20, 58, "K", 26, "fd ink");
  T(stub.built, STUB_X + 40, 58, "*", 26, "fd red");
  T(stub.built, STUB_X + 20, 98, "BOARDING", 12, "fu ink", { "letter-spacing": 2.5 });
  T(stub.built, STUB_X + 20, 114, "PASS", 12, "fu ink", { "letter-spacing": 2.5 });
  el("line", { x1: STUB_X + 20, y1: 128, x2: W - 20, y2: 128, stroke: "var(--rule)", "stroke-width": 1.2 }, stub.built);
  const stubTier = T(stub.built, STUB_X + 20, 160, "VIP", 20, "fd red");
  T(stub.built, STUB_X + 20, 186, "YOUR NAME", 12, "fu ink", { "letter-spacing": 1 });
  T(stub.built, STUB_X + 20, 210, "JUL 2025", 11, "fu ink-2", { "letter-spacing": 2 });
  const bg = el("g", { class: "ink" }, stub.built);
  BARS.forEach(([x, w]) => el("rect", { x: STUB_X + 20 + x * 2.8, y: 255, width: w * 2.8, height: 32 }, bg));
  T(stub.built, STUB_X + 20, 304, "OJO LAG · JUL25", 10, "fu ink-2", { "letter-spacing": 1 });

  const parts = [shape, route, pass, gate, cls, qr, stub];
  const classes = ["EARLY BIRD", "VIP", "TABLE"];
  let cyc = 0, timer = 0;
  const set = (k) => {
    parts.forEach((p, i) => p.g.setAttribute("data-state", i < k ? "built" : i === k ? "on" : "plan"));
    clearInterval(timer);
    clsVal.textContent = stubTier.textContent = "VIP";
    if (k === 4 && !S.reduce) {
      cyc = 1;
      timer = setInterval(() => { cyc = (cyc + 1) % 3; clsVal.textContent = stubTier.textContent = classes[cyc]; }, 1100);
    }
  };
  box.addEventListener("step", (e) => set(e.detail.index));
  set(+box.dataset.step || 0);
  S.onVisible(box, () => set(+box.dataset.step || 0), () => clearInterval(timer));
}

/* ------------------------------------------------------------------
   Fig. 3: the tilt with its numbers drawn out
   ------------------------------------------------------------------ */
function tiltFigure() {
  const fig = $("#kTilt");
  if (!fig) return;
  const pad = $(".k-pad", fig), padSvg = $(".k-pad-svg", fig);
  const trace = $(".k-trace", fig);
  const [easeF, easeR] = $$(".k-ease", fig);
  const out = { px: $("[data-px]", fig), py: $("[data-py]", fig), rx: $("[data-rx]", fig), ry: $("[data-ry]", fig), n: $("[data-n]", fig) };
  const cast = shadowFor($(".k-pad-shadow", fig), 20);
  const followE = gsap.parseEase("power2.out");
  const returnE = gsap.parseEase("elastic.out(1,0.5)");

  // the test card: the tilt's own coordinates printed on it
  padSvg.setAttribute("viewBox", "0 0 850 350");
  padSvg.setAttribute("preserveAspectRatio", "none");
  const pg = el("g", {}, padSvg);
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) {
    el("circle", { cx: 40 + i * 192.5, cy: 30 + j * 72.5, r: 4, fill: "rgba(8,12,5,0.28)" }, pg);
  }
  el("line", { x1: 425, y1: 0, x2: 425, y2: 350, stroke: "rgba(8,12,5,0.18)", "stroke-dasharray": "6 6" }, pg);
  el("line", { x1: 0, y1: 175, x2: 850, y2: 175, stroke: "rgba(8,12,5,0.18)", "stroke-dasharray": "6 6" }, pg);
  const pl = (x, y, s, a) => el("text", { x, y, "text-anchor": a || "middle", "font-size": 26, "font-family": "var(--mono)", fill: "rgba(8,12,5,0.62)" }, pg, s);
  pl(40, 168, "x −0.5", "start"); pl(810, 168, "x 0.5", "end");
  pl(436, 66, "y −0.5", "start"); pl(436, 330, "y 0.5", "start");
  const ch = el("g", { opacity: 0 }, padSvg);
  const chV = el("line", { y1: 0, y2: 350, stroke: "#c01920", "stroke-width": 2 }, ch);
  const chH = el("line", { x1: 0, x2: 850, stroke: "#c01920", "stroke-width": 2 }, ch);
  const chD = el("circle", { r: 9, fill: "#c01920" }, ch);

  let fStart = -1, rStart = -1;
  const t = tilt(pad, {
    move(x, y, n) {
      fStart = performance.now(); rStart = -1;
      const X = (x + 0.5) * 850, Y = (y + 0.5) * 350;
      chV.setAttribute("x1", X); chV.setAttribute("x2", X); chH.setAttribute("y1", Y); chH.setAttribute("y2", Y);
      chD.setAttribute("cx", X); chD.setAttribute("cy", Y); ch.setAttribute("opacity", 1);
      out.px.textContent = fix(x, 2); out.py.textContent = fix(y, 2); out.n.textContent = n;
      wake();
    },
    leave() { rStart = performance.now(); fStart = -1; ch.setAttribute("opacity", 0); out.px.textContent = out.py.textContent = "0.00"; wake(); },
  });
  const go = $("[data-tilt-on]", fig);
  go && go.addEventListener("click", () => { t.enable(); go.remove(); });

  // trace: rotateX and rotateY over the last 3 seconds
  const TW = 3000, buf = [];
  let tr = null;
  const drawTraceFrame = () => {
    const w = sizeSvg(trace, 176);
    const L = 40, R = w - 70, T = 14, B = 150;
    const Y = (v) => T + (8 - v) / 16 * (B - T);
    el("line", { x1: L, y1: Y(0), x2: R, y2: Y(0), class: "ax-2" }, trace);
    el("line", { x1: L, y1: Y(6), x2: R, y2: Y(6), class: "ax-d" }, trace);
    el("line", { x1: L, y1: Y(-6), x2: R, y2: Y(-6), class: "ax-d" }, trace);
    el("line", { x1: L, y1: T, x2: L, y2: B, class: "ax" }, trace);
    el("text", { x: L - 6, y: Y(6) + 4, "text-anchor": "end", class: "lbl-m" }, trace, "6°");
    el("text", { x: L - 6, y: Y(0) + 4, "text-anchor": "end", class: "lbl-m" }, trace, "0°");
    el("text", { x: L - 6, y: Y(-6) + 4, "text-anchor": "end", class: "lbl-m" }, trace, "−6°");
    el("text", { x: L, y: B + 18, class: "lbl" }, trace, "3 seconds ago");
    el("text", { x: R, y: B + 18, "text-anchor": "end", class: "lbl" }, trace, "now");
    el("text", { x: (L + R) / 2, y: Y(6) - 6, "text-anchor": "middle", class: "lbl" }, trace, "the most it can lean");
    tr = {
      L, R, Y,
      py: el("path", { class: "crv" }, trace),
      px: el("path", { class: "crv-live" }, trace),
      ly: el("text", { x: R + 8, class: "lbl-b" }, trace, "rotateY"),
      lx: el("text", { x: R + 8, class: "lbl", fill: "#c01920" }, trace, "rotateX"),
    };
    tr.lx.style.fill = "var(--live)";
  };
  const drawTrace = (now) => {
    if (!tr) return;
    while (buf.length && buf[0].t < now - TW) buf.shift();
    let dy = "", dx = "";
    buf.forEach((s, i) => {
      const X = tr.L + (1 - (now - s.t) / TW) * (tr.R - tr.L);
      dy += (i ? "L" : "M") + X.toFixed(1) + "," + tr.Y(s.ry).toFixed(1);
      dx += (i ? "L" : "M") + X.toFixed(1) + "," + tr.Y(s.rx).toFixed(1);
    });
    tr.py.setAttribute("d", dy); tr.px.setAttribute("d", dx);
    const last = buf[buf.length - 1] || { rx: 0, ry: 0 };
    let a = tr.Y(last.ry) + 4, b = tr.Y(last.rx) + 4;
    if (Math.abs(a - b) < 14) { if (a <= b) { a -= 7; b += 7; } else { a += 7; b -= 7; } }
    tr.ly.setAttribute("y", a); tr.lx.setAttribute("y", b);
  };

  // the two easing curves, each with a dot that runs while its tween does
  const ease = (svg, E, dur, title, lo, hi) => {
    const narrow = svg.getBoundingClientRect().width < 250;
    const w = sizeSvg(svg, narrow ? 180 : 168);
    const L = 34, R = w - 10, T = narrow ? 46 : 30, B = narrow ? 144 : 132;
    const X = (t) => L + t * (R - L), Y = (v) => B - (v - lo) / (hi - lo) * (B - T);
    el("text", { x: 0, y: 14, class: "lbl-b" }, svg, title[0]);
    el("text", narrow ? { x: 0, y: 30, class: "lbl-m" } : { x: R, y: 14, "text-anchor": "end", class: "lbl-m" }, svg, title[1]);
    el("line", { x1: L, y1: B, x2: R, y2: B, class: "ax" }, svg);
    el("line", { x1: L, y1: T - 6, x2: L, y2: B, class: "ax" }, svg);
    el("line", { x1: L, y1: Y(1), x2: R, y2: Y(1), class: "ax-d" }, svg);
    el("text", { x: L - 6, y: Y(1) + 4, "text-anchor": "end", class: "lbl-m" }, svg, "1");
    el("text", { x: L - 6, y: B + 4, "text-anchor": "end", class: "lbl-m" }, svg, "0");
    el("text", { x: L, y: B + 18, class: "lbl-m" }, svg, "0s");
    el("text", { x: R, y: B + 18, "text-anchor": "end", class: "lbl-m" }, svg, dur + "s");
    el("path", { d: curve(E, 120, X, Y), class: "crv" }, svg);
    const dot = el("circle", { r: 5, class: "dot-live", opacity: 0 }, svg);
    const tail = el("path", { class: "crv-live", "stroke-width": 3, opacity: 0.9 }, svg);
    return (p) => {
      if (p < 0) { dot.setAttribute("opacity", 0); tail.setAttribute("d", ""); return; }
      const q = Math.min(1, p);
      dot.setAttribute("cx", X(q)); dot.setAttribute("cy", Y(E(q))); dot.setAttribute("opacity", 1);
      tail.setAttribute("d", curve((t) => E(t * q), Math.max(2, Math.round(q * 60)), (t) => X(t * q), Y));
    };
  };
  let dotF = () => {}, dotR = () => {};
  let max = 1; for (let i = 0; i <= 400; i++) max = Math.max(max, returnE(i / 400));
  const draw = () => {
    drawTraceFrame();
    dotF = ease(easeF, followE, 0.35, ["follow", "power2.out"], 0, 1.05);
    dotR = ease(easeR, returnE, 0.55, ["return", "elastic.out(1, 0.5)"], 0, Math.max(1.2, max + 0.05));
    wake();
  };
  onResize(fig, draw);

  // one loop while the figure is on screen; it sleeps when nothing is moving
  let stop = null, visible = false, idle = 0;
  function frame(now) {
    const x = gsap.getProperty(pad, "rotateX"), y = gsap.getProperty(pad, "rotateY");
    buf.push({ t: now, rx: x, ry: y });
    drawTrace(now);
    cast(x, y);
    out.rx.textContent = deg(x); out.ry.textContent = deg(y);
    const fp = fStart < 0 ? -1 : (now - fStart) / 350;
    const rp = rStart < 0 ? -1 : (now - rStart) / 550;
    dotF(fp > 1.6 ? -1 : fp); dotR(rp > 2 ? -1 : rp);
    const still = Math.abs(x) < 0.01 && Math.abs(y) < 0.01 && fp < 0 && (rp < 0 || rp > 2);
    idle = still ? idle + 1 : 0;
    if (idle > 200) { stop = null; return false; } // the trace has gone flat, so stop drawing
  }
  function wake() { if (visible && !stop) { idle = 0; stop = S.raf((t) => frame(performance.now())); } }
  S.onVisible(fig, () => { visible = true; wake(); }, () => { visible = false; stop && stop(); stop = null; });
}

/* ------------------------------------------------------------------
   Fig. 4: the 3 panels in miniature. js/main.js:36-98 and 101-119
   ------------------------------------------------------------------ */
function sideways() {
  const fig = $("#kSide");
  if (!fig) return;
  const canvas = $(".k-side-canvas", fig), heroWrap = $(".k-side-view", fig);
  const panels = $$(".k-p", heroWrap);
  const svg = $(".k-side-track-svg", fig), tabs = $(".tabs", fig);
  const outSL = $("[data-sl]", fig), outMax = $("[data-max]", fig), outSwipe = $("[data-swipe]", fig);
  const behavior = S.reduce ? "auto" : "smooth";

  /* The site only took over the wheel while the page sat at scrollY 0, with the hero filling the
     screen. The same condition here: only while the miniature is wholly on screen. */
  const onScreen = () => { const r = heroWrap.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; };

  /* Wheel to sideways. js/main.js:40-53 */
  heroWrap.addEventListener("wheel", (e) => {
    if (!onScreen()) return;
    const maxScroll = heroWrap.scrollWidth - heroWrap.clientWidth;
    const atEnd = heroWrap.scrollLeft >= maxScroll - 2;
    const atStart = heroWrap.scrollLeft <= 2;
    if (atEnd && e.deltaY > 0) return;   // panels done, the page scrolls on
    if (atStart && e.deltaY < 0) return; // at the start, nothing above
    e.preventDefault();
    heroWrap.scrollLeft += e.deltaY;
  }, { passive: false });

  /* Touch: a vertical swipe moves the track 2.5 times, 15% of a panel snaps. */
  let startY = 0, startScrollLeft = 0, swiping = false;
  heroWrap.addEventListener("touchstart", (e) => {
    startY = e.touches[0].clientY;
    startScrollLeft = heroWrap.scrollLeft;
    swiping = true;
  }, { passive: true });
  heroWrap.addEventListener("touchmove", (e) => {
    if (!onScreen()) return;
    const dy = startY - e.touches[0].clientY;
    const maxScroll = heroWrap.scrollWidth - heroWrap.clientWidth;
    const atEnd = heroWrap.scrollLeft >= maxScroll - 2;
    const atStart = heroWrap.scrollLeft <= 2;
    if (atEnd && dy > 0) return;
    if (atStart && dy < 0) return;
    e.preventDefault();
    heroWrap.scrollLeft = startScrollLeft + dy * 2.5;
  }, { passive: false });
  const snap = () => {
    const panelW = heroWrap.clientWidth;
    const current = Math.round(startScrollLeft / panelW);
    const moved = heroWrap.scrollLeft - startScrollLeft;
    let target = current;
    if (moved > panelW * 0.15) target = Math.min(current + 1, panels.length - 1);
    else if (moved < -panelW * 0.15) target = Math.max(current - 1, 0);
    heroWrap.scrollTo({ left: target * panelW, behavior });
    const pct = Math.round((moved / panelW) * 100);
    outSwipe.textContent = (pct > 0 ? "+" : "") + minus(String(pct)) + "% → " + (target === current ? "stays on " : "snaps to ") + (target + 1);
    swiping = false;
    paint();
  };
  heroWrap.addEventListener("touchend", snap, { passive: true });

  /* With a mouse, dragging up and down stands in for the swipe. */
  let dragging = false;
  heroWrap.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    dragging = swiping = true; startY = e.clientY; startScrollLeft = heroWrap.scrollLeft;
    heroWrap.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  heroWrap.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    heroWrap.scrollLeft = startScrollLeft + (startY - e.clientY) * 2.5;
  });
  const end = () => { if (dragging) { dragging = false; snap(); } };
  heroWrap.addEventListener("pointerup", end);
  heroWrap.addEventListener("pointercancel", end);

  /* Keys and tabs move one panel at a time. */
  const goTo = (i) => heroWrap.scrollTo({ left: clamp(i, 0, 2) * heroWrap.clientWidth, behavior });
  heroWrap.addEventListener("keydown", (e) => {
    const cur = Math.round(heroWrap.scrollLeft / heroWrap.clientWidth);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); goTo(cur + 1); }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); goTo(cur - 1); }
  });
  tabs.addEventListener("click", (e) => { const b = e.target.closest("button[data-panel]"); if (b) goTo(+b.dataset.panel); });

  /* The track drawn to scale underneath: 3 × 100vw, your window outlined. */
  let d = null;
  const draw = () => {
    const w = sizeSvg(svg, 104);
    const L = 1, R = w - 1, top = 30, h = 34, seg = (R - L) / 3;
    ["01 Ticket", "02 For the Kulture", "03 Countdown"].forEach((s, i) => {
      el("rect", { x: L + i * seg, y: top, width: seg, height: h, fill: i === 1 ? "rgba(192,25,32,0.12)" : "rgba(8,12,5,0.06)", stroke: "var(--ink)", "stroke-width": 1 }, svg);
      el("text", { x: L + i * seg + seg / 2, y: top + h / 2 + 4, "text-anchor": "middle", class: "lbl" }, svg, w < 420 ? s.slice(0, 2) : s);
    });
    ["0", "100vw", "200vw", "300vw"].forEach((s, i) => el("text", { x: L + i * seg, y: top - 10, "text-anchor": i === 0 ? "start" : i === 3 ? "end" : "middle", class: "lbl-m" }, svg, s));
    const ticks = el("g", {}, svg);
    const win = el("rect", { y: top - 5, height: h + 10, width: seg, fill: "none", stroke: "var(--live)", "stroke-width": 2.5 }, svg);
    el("text", { x: L, y: top + h + 26, class: "lbl" }, svg, "a swipe has to cross a dashed line to snap");
    d = { L, R, seg, top, h, win, ticks };
    paint();
  };
  const paint = () => {
    if (!d) return;
    const sw = heroWrap.scrollWidth || 1, panelW = heroWrap.clientWidth || 1;
    const sl = heroWrap.scrollLeft;
    const x = d.L + (sl / sw) * (d.R - d.L);
    d.win.setAttribute("x", x.toFixed(1));
    d.ticks.replaceChildren();
    const base = swiping ? startScrollLeft : Math.round(sl / panelW) * panelW;
    [-0.15, 0.15].forEach((f) => {
      const v = base + f * panelW;
      if (v < 0 || v > sw - panelW) return;
      const tx = d.L + (v / sw) * (d.R - d.L);
      el("line", { x1: tx, y1: d.top + d.h + 2, x2: tx, y2: d.top + d.h + 12, class: "ax-d", "stroke-width": 1.5 }, d.ticks);
      el("line", { x1: tx, y1: d.top - 4, x2: tx, y2: d.top + d.h + 4, class: "ax-d" }, d.ticks);
    });
    outSL.textContent = Math.round(sl);
    outMax.textContent = Math.round(heroWrap.scrollWidth - heroWrap.clientWidth);
    const cur = Math.round(sl / panelW);
    $$("button", tabs).forEach((b, i) => b.setAttribute("aria-pressed", String(i === cur)));
  };
  let q = 0;
  heroWrap.addEventListener("scroll", () => { cancelAnimationFrame(q); q = requestAnimationFrame(paint); }, { passive: true });
  onResize(canvas, draw);

  /* the site's cursor. js/main.js:101-119 */
  if (S.hover) {
    const dot = $(".k-cur-dot", fig), ring = $(".k-cur-ring", fig);
    const moveX = gsap.quickTo(ring, "x", { duration: 0.55, ease: "power3" });
    const moveY = gsap.quickTo(ring, "y", { duration: 0.55, ease: "power3" });
    heroWrap.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      gsap.set(dot, { x, y });
      if (!canvas.classList.contains("is-cur")) gsap.set(ring, { x, y });
      moveX(x); moveY(y);
      canvas.classList.add("is-cur");
    });
    heroWrap.addEventListener("pointerleave", () => canvas.classList.remove("is-cur"));
    $$("[data-hot]", heroWrap).forEach((h) => {
      h.addEventListener("pointerenter", () => gsap.to(ring, { scale: 1.65, duration: 0.25 }));
      h.addEventListener("pointerleave", () => gsap.to(ring, { scale: 1, duration: 0.25 }));
    });
  }

  /* the miniature's own countdown, to the next 9PM in Lagos */
  const slots = { d: $("[data-d]", fig), h: $("[data-h]", fig), m: $("[data-m]", fig), s: $("[data-s]", fig) };
  const tickMini = () => {
    const diff = Math.max(0, nextDoors(Date.now()) - Date.now());
    const v = UNITS.map((u) => u.get(diff));
    ["d", "h", "m", "s"].forEach((k, i) => { const s = String(v[i]).padStart(2, "0"); slots[k].innerHTML = `<b>${s[0]}</b><b>${s[1]}</b>`; });
  };
  tickMini();
  let iv = 0;
  S.onVisible(fig, () => { tickMini(); clearInterval(iv); iv = setInterval(tickMini, 1000); }, () => clearInterval(iv));
}

/* ------------------------------------------------------------------
   Fig. 5: the type cycle. js/main.js:376-430
   ------------------------------------------------------------------ */
const FONTS = [
  "'Bebas Neue', sans-serif",
  "'Playfair Display', Georgia, serif",
  "'Syne', 'Helvetica Neue', sans-serif",
  "'DM Serif Display', Georgia, serif",
  "'Fraunces', Georgia, serif",
  "'Space Grotesk', Arial, sans-serif",
  "'Courier New', Courier, monospace",
  "'Helvetica Neue', Arial, sans-serif",
  "Georgia, 'Times New Roman', serif",
  "Impact, 'Arial Black', sans-serif",
]; // js/main.js:377-388

function typeCycle() {
  const fig = $("#kCycle");
  if (!fig) return;
  const els = $$(".font-cycle-el", fig);
  const svg = $(".k-cycle-svg", fig), canvas = $(".k-cycle-canvas", fig);
  const outs = $$("[data-f]", fig);
  const playBtn = $("[data-play]", fig), speedTabs = $(".tabs", fig);
  const LINES = ["FOR", "THE", "KULTURE"];
  /* js/main.js:396-405: line i waits i × 40ms, then swaps every 120 + i × 23ms, starting from face i */
  const plan = els.map((_, i) => ({ start: i * 40, every: 120 + i * 23 }));
  const WIN = 2000;
  let cycling = false, allowed = !S.reduce, paused = false, speed = 1;
  let vt = 0, idx = [], next = [], win = -1, stopLoop = null, d = null;

  const draw = () => {
    const w = sizeSvg(svg, 156);
    const L = w < 460 ? 74 : 112, R = w - 8, T = 8, laneH = 38;
    const X = (t) => L + ((t - Math.max(0, win) * WIN) / WIN) * (R - L);
    const lanes = LINES.map((s, i) => {
      const y = T + i * laneH;
      el("text", { x: 0, y: y + 15, class: "lbl-b" }, svg, s);
      el("text", { x: 0, y: y + 30, class: "lbl-m" }, svg, (w < 460 ? "" : "every ") + plan[i].every + "ms");
      el("line", { x1: L, y1: y + 22, x2: R, y2: y + 22, class: "ax-2" }, svg);
      return { y, g: el("g", {}, svg), ticks: [] };
    });
    const axY = T + 3 * laneH + 4;
    el("line", { x1: L, y1: axY, x2: R, y2: axY, class: "ax" }, svg);
    const axis = el("g", {}, svg);
    const head = el("line", { y1: T - 2, y2: axY, stroke: "var(--live)", "stroke-width": 1.5 }, svg);
    d = { L, R, X, lanes, axY, axis, head };
    win = -1;
    paint(true);
  };
  const ticksFor = (k) => {
    const a = k * WIN, b = a + WIN;
    d.axis.replaceChildren();
    for (let t = 0; t <= WIN; t += 500) {
      const x = d.L + (t / WIN) * (d.R - d.L);
      el("line", { x1: x, y1: d.axY, x2: x, y2: d.axY + 5, class: "ax" }, d.axis);
      el("text", { x, y: d.axY + 20, "text-anchor": t === 0 ? "start" : t === WIN ? "end" : "middle", class: "lbl-m" }, d.axis, (a + t) + (t === WIN ? "ms" : ""));
    }
    d.lanes.forEach((ln, i) => {
      ln.g.replaceChildren(); ln.ticks = [];
      const p = plan[i];
      if (k === 0) el("line", { x1: d.L, y1: ln.y + 22, x2: d.X(p.start + p.every), y2: ln.y + 22, class: "ax-d", "stroke-width": 1.5 }, ln.g);
      for (let t = p.start + p.every; t <= b; t += p.every) {
        if (t < a) continue;
        const x = d.X(t);
        ln.ticks.push({ t, e: el("line", { x1: x, y1: ln.y + 10, x2: x, y2: ln.y + 30, stroke: "var(--ink-3)", "stroke-width": 1.5 }, ln.g) });
      }
    });
  };
  const paint = (force) => {
    if (!d) return;
    const k = Math.floor(vt / WIN);
    if (k !== win || force) { win = k; ticksFor(k); }
    const x = d.X(vt);
    d.head.setAttribute("x1", x); d.head.setAttribute("x2", x);
    d.lanes.forEach((ln) => ln.ticks.forEach((tk) => tk.e.setAttribute("stroke", tk.t <= vt ? "var(--ink)" : "var(--ink-3)")));
  };
  onResize(canvas, draw);

  const step = (ms) => {
    vt += ms;
    els.forEach((elm, i) => {
      while (vt >= next[i]) {
        idx[i] = (idx[i] + 1) % FONTS.length;
        elm.style.fontFamily = FONTS[idx[i]];
        next[i] += plan[i].every;
      }
    });
    paint();
    outs.forEach((o, i) => { o.textContent = next[i] > plan[i].start + plan[i].every ? "face " + (idx[i] + 1) + " of 10" : "Futura"; });
  };
  /* _startFontCycle / _stopFontCycle, on a clock that can slow down */
  const start = () => {
    if (cycling || !allowed) return;
    cycling = true;
    vt = 0;
    idx = els.map((_, i) => i % FONTS.length);
    next = plan.map((p) => p.start + p.every);
    paint(true);
    stopLoop = S.raf((t, dt) => { if (!paused) step(dt * 1000 * speed); });
  };
  const stop = () => {
    if (!cycling) return;
    cycling = false;
    stopLoop && stopLoop();
    els.forEach((elm) => { elm.style.fontFamily = ""; });
    outs.forEach((o) => { o.textContent = "Futura"; });
    vt = 0; paint(true);
  };
  /* js/main.js:420-429: start and stop at 30% visible */
  new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) start(); else stop(); });
  }, { threshold: 0.3 }).observe(canvas);

  playBtn.textContent = allowed ? "Pause" : "Play";
  playBtn.addEventListener("click", () => {
    if (!allowed) { allowed = true; paused = false; playBtn.textContent = "Pause"; start(); return; }
    paused = !paused;
    playBtn.textContent = paused ? "Play" : "Pause";
  });
  speedTabs.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-speed]");
    if (!b) return;
    pressOne(speedTabs, b);
    speed = +b.dataset.speed;
  });
}

/* ------------------------------------------------------------------
   Fig. 6: the departures board. js/main.js:553-608
   ------------------------------------------------------------------ */
function board() {
  const fig = $("#kBoard");
  if (!fig) return;
  const tiles = {};
  $$(".flip-digit", fig).forEach((t) => {
    t.innerHTML = '<div class="fd-top"><span class="fd-num">0</span></div><div class="fd-bot"><span class="fd-num">0</span></div><div class="fd-flap" aria-hidden="true" style="display:none"><span class="fd-flap-num">0</span></div>';
    tiles[t.dataset.u] = t;
  });
  const clockEl = $(".k-clock", fig);
  const sideSvg = $(".k-flap-side", fig), easeSvg = $(".k-flap-ease", fig);
  const outA = $("[data-angle]", fig), outD = $("[data-dur]", fig);
  const playBtn = $("[data-play]", fig), tabs = $(".tabs", fig);
  const E = gsap.parseEase("power2.in");

  let speed = 1, anchorV = Date.now(), anchorP = performance.now();
  const vnow = () => anchorV + (performance.now() - anchorP) * speed;
  let allowed = !S.reduce, stopLoop = null, last = null; // last = { flap, tween }

  const prev = UNITS.map(() => ({ t: -1, u: -1 }));
  function setDigit(elm, val) {
    elm.querySelector(".fd-top .fd-num").textContent = val;
    elm.querySelector(".fd-bot .fd-num").textContent = val;
  }
  function flipDigit(elm, newVal, oldVal) {
    const flap = elm.querySelector(".fd-flap");
    const flapNum = flap.querySelector(".fd-flap-num");
    flapNum.textContent = oldVal;
    gsap.set(flap, { display: "flex", rotateX: 0 });
    setDigit(elm, newVal);
    const tween = gsap.to(flap, {
      rotateX: -90, duration: 0.28 / speed, ease: "power2.in",
      onComplete: () => gsap.set(flap, { display: "none" }),
    });
    last = { flap, tween };
  }
  function tick(animate) {
    const diff = Math.max(0, nextDoors(vnow()) - vnow());
    UNITS.forEach((u, i) => {
      const val = u.get(diff);
      const tens = Math.floor(val / 10), unit = val % 10, p = prev[i];
      const elT = tiles[u.t], elU = tiles[u.u];
      if (tens !== p.t) { if (p.t < 0 || !animate) setDigit(elT, tens); else flipDigit(elT, tens, p.t); p.t = tens; }
      if (unit !== p.u) { if (p.u < 0 || !animate) setDigit(elU, unit); else flipDigit(elU, unit, p.u); p.u = unit; }
    });
    const lbl = UNITS.map((u, i) => String(u.get(diff)).padStart(2, "0"));
    clockEl.setAttribute("aria-label", `Countdown to the next 9PM in Lagos: ${lbl[1]} hours, ${lbl[2]} minutes, ${lbl[3]} seconds`);
  }
  tick(false);

  /* the side view and the curve */
  let s = null, c = null;
  const drawSide = () => {
    const w = sizeSvg(sideSvg, 178);
    const cx = Math.min(w * 0.36, 120), cy = 100, Lh = 58;
    el("rect", { x: cx - 6, y: cy - Lh, width: 6, height: Lh - 1, fill: "#2a2e24" }, sideSvg);
    el("rect", { x: cx - 6, y: cy + 1, width: 6, height: Lh, fill: "#1c1f18" }, sideSvg);
    el("path", { d: `M${cx},${cy - Lh} A${Lh},${Lh} 0 0 1 ${cx + Lh},${cy}`, class: "ax-d" }, sideSvg);
    el("circle", { cx, cy, r: 3, fill: "var(--ink)" }, sideSvg);
    el("text", { x: cx - 12, y: cy - Lh + 4, "text-anchor": "end", class: "lbl-m" }, sideSvg, "0°");
    el("text", { x: cx + Lh + 4, y: cy + 18, "text-anchor": "middle", class: "lbl-m" }, sideSvg, "−90°");
    el("text", { x: cx - 12, y: cy + 4, "text-anchor": "end", class: "lbl" }, sideSvg, "hinge");
    el("text", { x: cx - 12, y: cy + Lh - 2, "text-anchor": "end", class: "lbl" }, sideSvg, "tile");
    el("text", { x: Math.min(w - 4, cx + Lh + 70), y: cy - 30, "text-anchor": "end", class: "lbl" }, sideSvg, "you →");
    el("text", { x: 0, y: 14, class: "lbl-b" }, sideSvg, "Side view");
    const flap = el("line", { x1: cx, y1: cy, stroke: "var(--live)", "stroke-width": 4, "stroke-linecap": "round" }, sideSvg);
    s = { cx, cy, Lh, flap };
  };
  const drawEase = () => {
    const w = sizeSvg(easeSvg, 178);
    const L = 44, R = w - 10, T = 30, B = 140;
    const X = (t) => L + t * (R - L), Y = (a) => T + (a / -90) * (B - T);
    el("text", { x: 0, y: 14, class: "lbl-b" }, easeSvg, "The flap's angle");
    el("text", { x: R, y: 14, "text-anchor": "end", class: "lbl-m" }, easeSvg, "power2.in");
    el("line", { x1: L, y1: T, x2: R, y2: T, class: "ax-2" }, easeSvg);
    el("line", { x1: L, y1: B, x2: R, y2: B, class: "ax" }, easeSvg);
    el("line", { x1: L, y1: T - 6, x2: L, y2: B, class: "ax" }, easeSvg);
    el("text", { x: L - 6, y: T + 4, "text-anchor": "end", class: "lbl-m" }, easeSvg, "0°");
    el("text", { x: L - 6, y: B + 4, "text-anchor": "end", class: "lbl-m" }, easeSvg, "−90°");
    el("text", { x: L, y: B + 18, class: "lbl-m" }, easeSvg, "0s");
    const end = el("text", { x: R, y: B + 18, "text-anchor": "end", class: "lbl-m" }, easeSvg, (0.28 / speed).toFixed(2) + "s");
    el("path", { d: curve((t) => -90 * E(t), 100, X, Y), class: "crv" }, easeSvg);
    const dot = el("circle", { r: 5, class: "dot-live" }, easeSvg);
    c = { X, Y, dot, end };
  };
  const paint = () => {
    const tw = last && last.tween;
    const active = tw && tw.isActive();
    const a = active ? gsap.getProperty(last.flap, "rotateX") : 0;
    const p = active ? tw.progress() : 0;
    outA.textContent = deg(a);
    if (s) {
      const r = (-a * Math.PI) / 180;
      s.flap.setAttribute("x2", (s.cx + s.Lh * Math.sin(r)).toFixed(1));
      s.flap.setAttribute("y2", (s.cy - s.Lh * Math.cos(r)).toFixed(1));
      s.flap.setAttribute("opacity", active ? 1 : 0.25);
    }
    if (c) { c.dot.setAttribute("cx", c.X(p)); c.dot.setAttribute("cy", c.Y(-90 * E(p))); c.dot.setAttribute("opacity", active ? 1 : 0.3); }
  };
  onResize($(".k-flap-plots", fig), () => { drawSide(); drawEase(); paint(); });

  const run = () => { if (!stopLoop && allowed) stopLoop = S.raf(() => { tick(true); paint(); }); };
  const halt = () => { stopLoop && stopLoop(); stopLoop = null; };
  S.onVisible(fig, run, halt);

  tabs.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-speed]");
    if (!b) return;
    pressOne(tabs, b);
    const sp = +b.dataset.speed;
    anchorV = sp === 1 ? Date.now() : vnow();
    anchorP = performance.now();
    speed = sp;
    outD.textContent = sp === 1 ? "0.28s" : "2.80s (0.28 × 10)";
    drawEase(); paint();
  });
  playBtn.addEventListener("click", () => { allowed = true; playBtn.remove(); run(); });
}

/* ------------------------------------------------------------------
   Fig. 7: the velocity marquee. js/main.js:324-373, on this page's scroll
   ------------------------------------------------------------------ */
function marquee() {
  const fig = $("#kMq");
  if (!fig) return;
  const configs = [
    { dir: -1, speed: 1.4 },
    { dir: 1, speed: 1.1 },
    { dir: -1, speed: 1.7 },
  ]; // js/main.js:325-329
  const tracks = $$(".mq-track", fig);
  const spark = $(".k-mq-spark", fig);
  const outB = $("[data-boost]", fig), outS = $("[data-speed]", fig);
  const outBand = [$("[data-b1]", fig), $("[data-b2]", fig), $("[data-b3]", fig)];
  const playBtn = $("[data-play]", fig);

  let lastScrollY = window.scrollY, velocityMult = 1, lastScrollTime = performance.now(), lastSpeed = 0;
  window.addEventListener("scroll", () => {
    const now = performance.now();
    const dy = Math.abs(window.scrollY - lastScrollY);
    const dt = now - lastScrollTime || 1;
    const speed = dy / dt; // px/ms
    velocityMult = 1 + Math.min(speed * 6, 8);
    lastScrollY = window.scrollY;
    lastScrollTime = now;
    lastSpeed = speed;
  }, { passive: true });

  const rows = configs.map(({ dir, speed }, i) => {
    const track = tracks[i];
    const content = track.querySelector(".mq-content");
    return { track, content, dir, speed, w: content.offsetWidth, x: dir === -1 ? 0 : -content.offsetWidth };
  });
  const measure = () => rows.forEach((r) => { r.w = r.content.offsetWidth || r.w; if (r.dir === 1 && r.x > 0) r.x -= r.w; });
  window.addEventListener("resize", measure, { passive: true });
  document.fonts && document.fonts.ready.then(measure);
  rows.forEach((r) => { r.track.style.transform = `translate3d(${r.x}px,0,0)`; });

  /* the boost over the last 4 seconds */
  const SW = 4000, buf = [];
  let sp = null;
  const drawSpark = () => {
    const w = sizeSvg(spark, 96);
    const L = 34, R = w - 4, T = 12, B = 72;
    const Y = (v) => B - ((v - 1) / 8) * (B - T);
    el("line", { x1: L, y1: Y(9), x2: R, y2: Y(9), class: "ax-d" }, spark);
    el("line", { x1: L, y1: B, x2: R, y2: B, class: "ax" }, spark);
    el("text", { x: L - 6, y: Y(9) + 4, "text-anchor": "end", class: "lbl-m" }, spark, "×9");
    el("text", { x: L - 6, y: B + 4, "text-anchor": "end", class: "lbl-m" }, spark, "×1");
    el("text", { x: L, y: B + 18, class: "lbl" }, spark, "4 seconds ago");
    el("text", { x: R, y: B + 18, "text-anchor": "end", class: "lbl" }, spark, "now");
    sp = { L, R, Y, path: el("path", { class: "crv-live" }, spark), dot: el("circle", { r: 4, class: "dot-live" }, spark) };
  };
  const paintSpark = (now) => {
    if (!sp) return;
    while (buf.length && buf[0].t < now - SW) buf.shift();
    let d = "";
    buf.forEach((s, i) => { d += (i ? "L" : "M") + (sp.L + (1 - (now - s.t) / SW) * (sp.R - sp.L)).toFixed(1) + "," + sp.Y(s.v).toFixed(1); });
    sp.path.setAttribute("d", d);
    sp.dot.setAttribute("cx", sp.R); sp.dot.setAttribute("cy", sp.Y(velocityMult));
  };
  onResize($(".k-mq-meter", fig), () => { drawSpark(); paintSpark(performance.now()); });

  let allowed = !S.reduce, stopLoop = null;
  const frame = () => {
    // js/main.js:346-348: decay toward 1, 5% a frame
    velocityMult += (1 - velocityMult) * 0.05;
    // js/main.js:364-371
    rows.forEach((r) => {
      r.x += r.dir * r.speed * velocityMult;
      if (r.dir === -1 && r.x <= -r.w) r.x += r.w;
      if (r.dir === 1 && r.x >= 0) r.x -= r.w;
      r.track.style.transform = `translate3d(${r.x.toFixed(2)}px,0,0)`;
    });
    const now = performance.now();
    buf.push({ t: now, v: velocityMult });
    paintSpark(now);
    outB.textContent = "×" + velocityMult.toFixed(1);
    outS.textContent = (now - lastScrollTime > 160 ? 0 : lastSpeed).toFixed(2);
    rows.forEach((r, i) => { outBand[i].textContent = (r.speed * velocityMult).toFixed(1); });
  };
  const run = () => { if (!stopLoop && allowed) stopLoop = S.raf(frame); };
  S.onVisible(fig, run, () => { stopLoop && stopLoop(); stopLoop = null; });
  playBtn.addEventListener("click", () => { allowed = true; playBtn.remove(); run(); });
}

/* ------------------------------------------------------------------
   Fig. 8: the experience cards. js/main.js:500-545 (the desktop branch)
   ------------------------------------------------------------------ */
function lineup() {
  const fig = $("#kExp");
  if (!fig) return;
  const cards = $$(".exp-scene-card", fig);
  const range = $("#kExpRange"), outP = $("[data-out]", fig);
  const outCard = $("[data-card]", fig), outXp = $("[data-xp]", fig), outRot = $("[data-rot]", fig);
  const gantt = $(".k-exp-gantt", fig), tabs = $(".tabs", fig);
  const names = ["Red Carpet", "Photo Activation", "DJ Sets", "VIP Section", "Lagos Vibes", "Limited Entry"];

  /* js/main.js:515-522: off-screen with alternating tilt */
  cards.forEach((card, i) => {
    const fromLeft = card.dataset.from === "left";
    gsap.set(card, { xPercent: fromLeft ? -130 : 130, rotation: fromLeft ? -14 : 14, zIndex: i + 1 });
  });
  /* js/main.js:525-544, with the ScrollTrigger swapped for this slider */
  const tl = gsap.timeline({ paused: true });
  cards.forEach((card, i) => {
    const fromLeft = card.dataset.from === "left";
    const endRot = fromLeft ? -(1.5 + i * 0.4) : (1.5 + i * 0.4);
    tl.to(card, { xPercent: 0, rotation: endRot, duration: 1, ease: "power2.out" }, i * 0.9);
  });
  const TOTAL = tl.duration(); // 5 × 0.9 + 1 = 5.5

  /* scrub: 1.5. ScrollTrigger chases the scroll with a tween of that many seconds on the
     "expo" ease (gsap/src/ScrollTrigger.js, the scrubTween); this does the same to the slider. */
  let scrub = 1.5, target = +range.value / 1000, chase = null;
  tl.totalProgress(target);
  const to = (v) => {
    target = v;
    if (scrub) chase = gsap.to(tl, { totalProgress: v, duration: scrub, ease: "expo", overwrite: true });
    else { chase && chase.kill(); tl.totalProgress(v); }
    wake();
  };
  range.addEventListener("input", () => { outP.textContent = Math.round(range.value / 10) + "%"; to(+range.value / 1000); });
  tabs.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-scrub]");
    if (!b) return;
    pressOne(tabs, b);
    scrub = +b.dataset.scrub;
    to(target);
  });

  let g = null;
  const draw = () => {
    const w = sizeSvg(gantt, 6 * 20 + 46);
    const L = w < 460 ? 92 : 128, R = w - 8, T = 4, rowH = 20;
    const X = (t) => L + (t / TOTAL) * (R - L);
    const fills = [];
    names.forEach((n, i) => {
      const y = T + i * rowH;
      el("text", { x: 0, y: y + 13, class: "lbl" }, gantt, n);
      el("rect", { x: X(i * 0.9), y: y + 4, width: X(1) - X(0), height: 11, fill: "var(--rule)" }, gantt);
      fills.push(el("rect", { x: X(i * 0.9), y: y + 4, width: 0, height: 11, fill: "var(--ink)" }, gantt));
    });
    const axY = T + 6 * rowH + 6;
    el("line", { x1: L, y1: axY, x2: R, y2: axY, class: "ax" }, gantt);
    [0, 0.9, 1.8, 2.7, 3.6, 4.5, 5.5].forEach((t, i) => {
      el("line", { x1: X(t), y1: axY, x2: X(t), y2: axY + 5, class: "ax" }, gantt);
      if (w >= 460 || i % 2 === 0 || i === 6) el("text", { x: X(t), y: axY + 19, "text-anchor": i === 0 ? "start" : i === 6 ? "end" : "middle", class: "lbl-m" }, gantt, String(t));
    });
    const head = el("line", { y1: 0, y2: axY, stroke: "var(--live)", "stroke-width": 1.5 }, gantt);
    const mark = el("rect", { width: 10, height: 10, y: axY - 5, fill: "var(--ink)" }, gantt);
    g = { X, fills, head, mark };
    paint();
  };
  const paint = () => {
    if (!g) return;
    const t = tl.time();
    g.fills.forEach((f, i) => f.setAttribute("width", Math.max(0, g.X(clamp(t - i * 0.9, 0, 1)) - g.X(0)).toFixed(1)));
    const hx = g.X(target * TOTAL);
    g.head.setAttribute("x1", hx); g.head.setAttribute("x2", hx);
    g.mark.setAttribute("x", (g.X(t) - 5).toFixed(1));
    let k = 0;
    for (let i = 0; i < cards.length; i++) if (t >= i * 0.9) k = i;
    outCard.textContent = k + 1 + " of 6";
    outXp.textContent = fix(gsap.getProperty(cards[k], "xPercent"), 0);
    outRot.textContent = deg(gsap.getProperty(cards[k], "rotation"));
  };
  onResize(fig, draw);

  let stop = null, visible = false;
  function wake() { if (visible && !stop) stop = S.raf(() => { paint(); if (!chase || !chase.isActive()) { stop = null; return false; } }); }
  S.onVisible(fig, () => { visible = true; paint(); wake(); }, () => { visible = false; stop && stop(); stop = null; });
}

/* ------------------------------------------------------------------
   Fig. 9: the printed passes. tickets/generate.js buildSVG(), in the browser
   ------------------------------------------------------------------ */
const TIERS = [
  { id: "regular", label: "REGULAR", code: "KULTURE25 · REG · OJO", bg: "#EDD9A3", text: "#0E1807", accent: "#C01920", rule: "rgba(14,24,7,0.15)", muted: "rgba(14,24,7,0.45)" },
  { id: "vip", label: "VIP", code: "KULTURE25 · VIP · OJO", bg: "#080C05", text: "#EDD9A3", accent: "#C01920", rule: "rgba(237,217,163,0.15)", muted: "rgba(237,217,163,0.45)" },
  { id: "table", label: "TABLE", code: "KULTURE25 · TBL · OJO", bg: "#C01920", text: "#EDD9A3", accent: "#080C05", rule: "rgba(237,217,163,0.2)", muted: "rgba(237,217,163,0.5)" },
]; // tickets/generate.js:42-73

function buildSVG(tier) {
  const { bg, text, accent, rule, muted, label, code, id } = tier;
  const W = 850, H = 350, PERF_X = 645, STUB_X = 668, PAD = 38;
  const QR_SIZE = 70, QR_UNIT = QR_SIZE / 21, QR_X = PAD, QR_Y = 208;
  const qrRects = QR.map(([x, y, w, h]) => `<rect x="${QR_X + x * QR_UNIT}" y="${QR_Y + y * QR_UNIT}" width="${w * QR_UNIT}" height="${h * QR_UNIT}"/>`).join("");
  const BAR_SCALE = 2.8, BAR_H = 32, BAR_Y = 265, BAR_X_START = STUB_X + 20;
  const barRects = BARS.map(([x, w]) => `<rect x="${BAR_X_START + x * BAR_SCALE}" y="${BAR_Y}" width="${w * BAR_SCALE}" height="${BAR_H}"/>`).join("");
  const arrowX1 = 428, arrowX2 = 512, arrowY = 53;
  const arrowHead = `M${arrowX2 - 8},${arrowY - 5} L${arrowX2},${arrowY} L${arrowX2 - 8},${arrowY + 5}`;
  const FD = `font-family="FuturaCyrillic, Futura, sans-serif" font-weight="900"`;
  const FU = `font-family="Riposte, 'Arial Narrow', sans-serif"`;
  /* The script paints white circles over the notches (generate.js:131-132). Here a mask cuts them. */
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="${NS}" aria-hidden="true">
  <defs><mask id="notch-${id}"><rect width="${W}" height="${H}" fill="#fff"/><circle cx="${PERF_X + 11}" cy="0" r="14" fill="#000"/><circle cx="${PERF_X + 11}" cy="${H}" r="14" fill="#000"/></mask></defs>
  <g mask="url(#notch-${id})">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <line x1="${PERF_X + 11}" y1="14" x2="${PERF_X + 11}" y2="${H - 14}" stroke="${muted}" stroke-width="1.2" stroke-dasharray="4 4"/>
  <text x="${PAD}" y="64" ${FD} font-size="30" fill="${text}" letter-spacing="-0.5">KULTURE</text>
  <text x="${PAD + 145}" y="64" ${FD} font-size="30" fill="${accent}">*</text>
  <text x="365" y="49" ${FD} font-size="22" fill="${text}" letter-spacing="0.5">OJO</text>
  <line x1="${arrowX1}" y1="${arrowY}" x2="${arrowX2}" y2="${arrowY}" stroke="${text}" stroke-width="1.1" opacity="0.7"/>
  <path d="${arrowHead}" stroke="${text}" stroke-width="1.1" fill="none" opacity="0.7"/>
  <text x="523" y="49" ${FD} font-size="22" fill="${text}" letter-spacing="0.5">PTY</text>
  <text x="365" y="64" ${FU} font-size="8.5" fill="${muted}" letter-spacing="1.5">LAGOS</text>
  <text x="523" y="64" ${FU} font-size="8.5" fill="${muted}" letter-spacing="1.5">PARTY</text>
  <line x1="${PAD}" y1="82" x2="${PERF_X - 20}" y2="82" stroke="${rule}" stroke-width="1"/>
  <text x="${PAD}" y="102" ${FU} font-size="8" fill="${muted}" letter-spacing="2.5">PASSENGER</text>
  <text x="${PAD}" y="130" ${FD} font-size="24" fill="${text}" letter-spacing="2">ADMITS ONE</text>
  <text x="${PAD}" y="163" ${FU} font-size="8" fill="${muted}" letter-spacing="2">GATE</text>
  <text x="${PAD}" y="182" ${FD} font-size="17" fill="${text}">A1</text>
  <text x="144" y="163" ${FU} font-size="8" fill="${muted}" letter-spacing="2">DEPARTS</text>
  <text x="144" y="182" ${FD} font-size="17" fill="${text}">21:00</text>
  <text x="280" y="163" ${FU} font-size="8" fill="${muted}" letter-spacing="2">DATE</text>
  <text x="280" y="182" ${FD} font-size="17" fill="${text}">JUL 2025</text>
  <text x="420" y="163" ${FU} font-size="8" fill="${muted}" letter-spacing="2">CLASS</text>
  <text x="420" y="182" ${FD} font-size="17" fill="${text}">${label}</text>
  <line x1="${PAD}" y1="198" x2="${PERF_X - 20}" y2="198" stroke="${rule}" stroke-width="1"/>
  <g fill="${text}">${qrRects}</g>
  <text x="${QR_X + QR_SIZE + 18}" y="${QR_Y + 22}" ${FU} font-size="9" fill="${text}" letter-spacing="1">${code}</text>
  <text x="${QR_X + QR_SIZE + 18}" y="${QR_Y + 42}" ${FU} font-size="8" fill="${muted}" letter-spacing="1.5">SCAN TO VERIFY</text>
  <text x="${STUB_X + 20}" y="58" ${FD} font-size="26" fill="${text}">K</text>
  <text x="${STUB_X + 52}" y="58" ${FD} font-size="26" fill="${accent}">*</text>
  <text x="${STUB_X + 20}" y="98" ${FU} font-size="10" fill="${text}" letter-spacing="2.5">BOARDING</text>
  <text x="${STUB_X + 20}" y="114" ${FU} font-size="10" fill="${text}" letter-spacing="2.5">PASS</text>
  <line x1="${STUB_X + 20}" y1="128" x2="${W - 20}" y2="128" stroke="${rule}" stroke-width="1"/>
  <text x="${STUB_X + 20}" y="160" ${FD} font-size="20" fill="${text}">${label}</text>
  <text x="${STUB_X + 20}" y="200" ${FU} font-size="9" fill="${muted}" letter-spacing="2">JUL 2025</text>
  <text x="${STUB_X + 20}" y="230" ${FU} font-size="8" fill="${muted}" letter-spacing="1.5">ADMITS ONE</text>
  <g fill="${text}">${barRects}</g>
  <text x="${BAR_X_START}" y="${BAR_Y + BAR_H + 14}" ${FU} font-size="7" fill="${muted}" letter-spacing="1">OJO LAG · JUL25</text>
  </g></svg>`;
}

function printPasses() {
  const fig = $("#kPrint");
  if (!fig) return;
  const stack = $(".k-print-stack", fig), tabs = $(".tabs", fig);
  const outBg = $("[data-bg]", fig), outCode = $("[data-code]", fig);
  const passes = TIERS.map((t, i) => {
    const p = document.createElement("div");
    p.className = "k-pt";
    p.tabIndex = 0;
    p.setAttribute("role", "button");
    p.setAttribute("aria-label", `The printed ${t.label} pass. Bring it to the front.`);
    p.innerHTML = `<div class="k-pt-shadow" aria-hidden="true"></div>` + buildSVG(t);
    p.style.zIndex = i + 1;
    stack.appendChild(p);
    return p;
  });
  let front = 2;
  const show = (i) => {
    front = i;
    passes.forEach((p, j) => { p.style.zIndex = j === i ? 10 : j + 1; });
    pressOne(tabs, $$("button", tabs)[i]);
    outBg.textContent = TIERS[i].bg;
    outCode.textContent = TIERS[i].code;
  };
  passes.forEach((p, i) => {
    p.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") p.classList.add("is-up"); });
    p.addEventListener("pointerleave", () => p.classList.remove("is-up"));
    p.addEventListener("focus", () => p.classList.add("is-up"));
    p.addEventListener("blur", () => p.classList.remove("is-up"));
    p.addEventListener("click", () => { show(i); passes.forEach((q) => q.classList.toggle("is-up", q === p)); });
    p.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(i); } });
  });
  tabs.addEventListener("click", (e) => { const b = e.target.closest("button[data-tier]"); if (b) show(+b.dataset.tier); });
  show(front);
}

/* ------------------------------------------------------------------
   Fig. 10: the step-and-repeat. backdrop/generate.js buildBackdrop(), on a canvas
   ------------------------------------------------------------------ */
const VARIANTS = [
  { id: "dark", BG: "#080C05", TEXT: "#EDD9A3", ACCENT: "#C01920", LOGO_TINT: "#EDD9A3" },
  { id: "red", BG: "#C01920", TEXT: "#EDD9A3", ACCENT: "#080C05", LOGO_TINT: "#EDD9A3" },
  { id: "green", BG: "#0B2310", TEXT: "#EDD9A3", ACCENT: "#C01920", LOGO_TINT: "#EDD9A3" },
]; // backdrop/generate.js:26-30
const SIZES = [
  { label: "8x8", W: 2400, H: 2400 },
  { label: "8x10", W: 2400, H: 3000 },
  { label: "10x8", W: 3000, H: 2400 },
]; // backdrop/generate.js:33-37
const SPONSOR_FILES = ["seyetheplug", "bigbolaji", "leeyat", "godfather", "infowithsammy", "olakiits", "trimmy"]; // generate.js:17-20

function backdrop() {
  const fig = $("#kBd");
  if (!fig) return;
  const host = $(".k-bd-canvas", fig), sheet = $(".k-bd-sheet", fig), cv = $("canvas", fig);
  const ctx = cv.getContext("2d");
  const tabs = $$(".tabs", fig);
  const layoutBtn = $("[data-layout]", fig);
  const out = { wh: $("[data-wh]", fig), cell: $("[data-cell]", fig), lr: $("[data-lr]", fig), tr: $("[data-tr]", fig), logos: $("[data-logos]", fig), faded: $("[data-faded]", fig) };
  let vi = 2, si = 2, showLayout = false, imgs = null, loading = null;

  const load = (src) => new Promise((res, rej) => { const i = new Image(); i.decoding = "async"; i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const tint = (img, color) => {
    // the SVG filter: feFlood the tint colour, composited into the logo's alpha
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = "source-in";
    x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    return c;
  };
  const ensure = () => loading || (loading = Promise.all([
    ...SPONSOR_FILES.map((f) => load(`kulture/logos/${f}.webp`)),
    load("kulture/logos/kulture-wordmark.webp"),
    load("kulture/logos/kulture-star.webp"),
    document.fonts ? Promise.all([document.fonts.load("300 20px Riposte"), document.fonts.load("900 20px FuturaCyrillic")]) : null,
  ]).then((r) => {
    imgs = { sponsors: r.slice(0, 7).map((i) => tint(i, "#EDD9A3")), wordmark: r[7], star: r[8] };
  }));
  const contain = (img, x, y, w, h) => {
    const iw = img.width, ih = img.height, s = Math.min(w / iw, h / ih);
    ctx.drawImage(img, x + (w - iw * s) / 2, y + (h - ih * s) / 2, iw * s, ih * s);
  };
  const spaced = (s, px) => { ctx.letterSpacing = px + "px"; return s; };

  function fit() {
    const { W, H } = SIZES[si];
    const avail = host.clientWidth;
    const maxH = Math.min(window.innerHeight * 0.74, 720);
    let w = Math.min(avail, 900), h = (w * H) / W;
    if (h > maxH) { h = maxH; w = (h * W) / H; }
    sheet.style.width = Math.round(w) + "px";
    sheet.style.height = Math.round(h) + "px";
    const dpr = DPR();
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    draw();
  }

  function draw() {
    const { W, H } = SIZES[si];
    const { BG, TEXT, ACCENT } = VARIANTS[vi];
    const s = cv.width / W;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = BG; ctx.fillRect(0, 0, cv.width, cv.height);
    if (!imgs) return;
    ctx.setTransform(s, 0, 0, s, 0, 0);

    // backdrop/generate.js:44-62
    const COLS = 5;
    const CELL_W = W / COLS;
    const LOGO_ROW_H = Math.round(CELL_W * 0.40);
    const TEXT_ROW_H = Math.round(LOGO_ROW_H * 0.34);
    const PATTERN_H = LOGO_ROW_H + TEXT_ROW_H;
    const LOGO_PX = CELL_W * 0.74;
    const CX = W / 2, CY = H / 2;
    const SAFE_W = W * 0.72, SAFE_H = H * 0.28;
    const TILE = "FOR THE KULTURE*  ·  OJO · LAGOS · JULY 2025  ·  ";
    const textStr = TILE.repeat(8);
    const fontSize = Math.round(CELL_W * 0.038);

    // generate.js:65-117: alternating text strips and logo rows, odd rows offset half a cell
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    const cells = [];
    let logoRowIdx = 0, sponsorIdx = 0, y = -PATTERN_H;
    while (y < H + PATTERN_H) {
      const textY = y, logoY = y + TEXT_ROW_H;
      ctx.globalAlpha = 0.12; ctx.strokeStyle = TEXT; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(0, textY); ctx.lineTo(W, textY); ctx.stroke();
      ctx.globalAlpha = 0.22; ctx.fillStyle = TEXT;
      ctx.font = `300 ${fontSize}px Riposte, sans-serif`;
      ctx.fillText(spaced(textStr, 4), -400, textY + TEXT_ROW_H * 0.72);
      const isOdd = logoRowIdx % 2 === 1;
      const xShift = isOdd ? CELL_W / 2 : 0;
      const extraCol = isOdd ? 1 : 0;
      for (let col = 0; col < COLS + extraCol; col++) {
        const cellX = xShift + col * CELL_W;
        const inSafe = cellX + CELL_W > CX - SAFE_W / 2 && cellX < CX + SAFE_W / 2 && logoY + LOGO_ROW_H > CY - SAFE_H / 2 && logoY < CY + SAFE_H / 2;
        const img = imgs.sponsors[sponsorIdx % imgs.sponsors.length];
        sponsorIdx++;
        const imgX = cellX + (CELL_W - LOGO_PX) / 2;
        const imgY = logoY + LOGO_ROW_H * 0.12;
        const imgH = LOGO_ROW_H * 0.76;
        ctx.globalAlpha = inSafe ? 0.07 : 0.65;
        contain(img, imgX, imgY, LOGO_PX, imgH);
        if (cellX < W && cellX + CELL_W > 0 && logoY < H && logoY + LOGO_ROW_H > 0) cells.push({ x: cellX, y: logoY, inSafe, odd: isOdd });
      }
      logoRowIdx++;
      y += PATTERN_H;
    }
    ctx.restore();
    ctx.letterSpacing = "0px";

    // generate.js:173-176 and 156-163: the vignette, a radial fade in the ellipse's own box (r 46%)
    const rx = SAFE_W * 0.78, ry = SAFE_H * 2.4;
    ctx.save();
    ctx.translate(CX, CY); ctx.scale(rx, ry);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.92);
    const a = (o) => BG + Math.round(o * 255).toString(16).padStart(2, "0");
    g.addColorStop(0, a(1)); g.addColorStop(0.38, a(0.88)); g.addColorStop(0.68, a(0.30)); g.addColorStop(1, a(0));
    ctx.globalAlpha = 1; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // generate.js:120-140: the centre piece
    const WM_ASPECT = 2.733, STAR_ASPECT = 1.038;
    const WM_W = SAFE_W * 0.60, WM_H = WM_W / WM_ASPECT;
    const STAR_H = WM_H * 0.92, STAR_W = STAR_H * STAR_ASPECT;
    const GAP = WM_H * 0.05, TOTAL_W = WM_W + GAP + STAR_W;
    const WM_X = CX - TOTAL_W / 2, WM_Y = CY - WM_H / 2;
    const STAR_X = WM_X + WM_W + GAP, STAR_Y = CY - STAR_H / 2;
    const TAG_Y = WM_Y + WM_H + Math.round(WM_H * 0.18);
    const DATE_Y = TAG_Y + Math.round(WM_H * 0.14);
    const tagSize = Math.round(WM_H * 0.085), dateSize = Math.round(WM_H * 0.060);
    ctx.globalAlpha = 1;
    contain(imgs.wordmark, WM_X, WM_Y, WM_W, WM_H);
    contain(imgs.star, STAR_X, STAR_Y, STAR_W, STAR_H);

    // tagline, with the asterisk in the accent colour, centred as one line
    ctx.font = `300 ${tagSize}px Riposte, sans-serif`; spaced("", 10);
    const w1 = ctx.measureText("FOR THE KULTURE").width;
    ctx.font = `900 ${tagSize}px FuturaCyrillic, sans-serif`;
    const w2 = ctx.measureText("*").width;
    let tx = CX - (w1 + w2) / 2;
    ctx.globalAlpha = 0.6; ctx.fillStyle = TEXT;
    ctx.font = `300 ${tagSize}px Riposte, sans-serif`;
    ctx.fillText("FOR THE KULTURE", tx, TAG_Y);
    ctx.fillStyle = ACCENT; ctx.font = `900 ${tagSize}px FuturaCyrillic, sans-serif`;
    ctx.fillText("*", tx + w1, TAG_Y);
    ctx.globalAlpha = 0.32; ctx.fillStyle = TEXT;
    ctx.font = `300 ${dateSize}px Riposte, sans-serif`; spaced("", 8);
    ctx.textAlign = "center"; ctx.fillText("OJO · LAGOS · JULY 2025", CX, DATE_Y); ctx.textAlign = "left";
    ctx.letterSpacing = "0px";
    ctx.globalAlpha = 1;

    // the layout, drawn over it on request
    if (showLayout) {
      const dpr = cv.width / sheet.clientWidth;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const P = (v) => v * s;
      ctx.lineWidth = 1 * dpr; ctx.strokeStyle = "#F7F780"; ctx.setLineDash([4 * dpr, 4 * dpr]);
      cells.forEach((c) => { ctx.globalAlpha = c.inSafe ? 0.45 : 0.85; ctx.strokeRect(P(c.x), P(c.y), P(CELL_W), P(LOGO_ROW_H)); });
      ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.lineWidth = 2 * dpr;
      ctx.strokeRect(P(CX - SAFE_W / 2), P(CY - SAFE_H / 2), P(SAFE_W), P(SAFE_H));
      ctx.font = `600 ${12 * dpr}px ${getComputedStyle(document.body).fontFamily}`;
      const label = (t, x, y) => { const m = ctx.measureText(t).width; ctx.fillStyle = "#F7F780"; ctx.fillRect(x - 4 * dpr, y - 13 * dpr, m + 8 * dpr, 18 * dpr); ctx.fillStyle = "#080C05"; ctx.fillText(t, x, y); };
      label("safe zone, 72% × 28%: logos at 7%", P(CX - SAFE_W / 2) + 6 * dpr, P(CY - SAFE_H / 2) - 8 * dpr);
      const odd = cells.find((c) => c.odd && c.y > 0);
      if (odd) label("odd rows shift half a cell", 8 * dpr, P(odd.y) + 22 * dpr);
      const even = cells.find((c) => !c.odd && c.y >= 0);
      if (even) label(`cell ${CELL_W} × ${LOGO_ROW_H}`, P(even.x) + 6 * dpr, P(even.y) + 22 * dpr);
    }

    out.wh.textContent = `${W} × ${H}`;
    out.cell.textContent = CELL_W;
    out.lr.textContent = LOGO_ROW_H;
    out.tr.textContent = TEXT_ROW_H;
    out.logos.textContent = cells.length;
    out.faded.textContent = cells.filter((c) => c.inSafe).length;
  }

  tabs[0].addEventListener("click", (e) => { const b = e.target.closest("button[data-variant]"); if (!b) return; pressOne(tabs[0], b); vi = +b.dataset.variant; draw(); });
  tabs[1].addEventListener("click", (e) => { const b = e.target.closest("button[data-size]"); if (!b) return; pressOne(tabs[1], b); si = +b.dataset.size; fit(); });
  layoutBtn.addEventListener("click", () => {
    showLayout = !showLayout;
    layoutBtn.setAttribute("aria-pressed", String(showLayout));
    layoutBtn.textContent = showLayout ? "Hide the layout" : "Show the layout";
    draw();
  });
  let ready = false;
  S.onVisible(fig, () => {
    if (ready) return;
    ready = true;
    fit();
    ensure().then(fit).catch(() => {});
    onResize(host, fit);
  }, null, "600px 0px");
}

/* Figures that reach into the left margin. study.js steps the contents list aside
   while any element marked data-wide passes under it. */
function tocAway() {
  $$(".k-tilt-grid, .k-mq-bands, .k-exp-stage, .k-bd-sheet").forEach((n) => { n.dataset.wide = ""; });
}

/* ------------------------------------------------------------------ */
if (S && gsap) {
  tocAway();
  hero();
  anatomy();
  tiltFigure();
  sideways();
  typeCycle();
  board();
  marquee();
  lineup();
  printPasses();
  backdrop();
}
