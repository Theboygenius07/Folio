/* Clark, the live figures.

   Clark has no codebase I can port: these are rebuilds of my own design files, with
   the numbers measured off them. Where a value comes from a file, the comment says
   which one. Where the designs are still frames (motion, timing, physics), the value
   is mine and the page says so.

     Fig. 1, 9  the badge: a rigid tag on two cords        (clark-logo.png, the cover slide)
     Fig. 2     the home screen, keyed                      (Clark-home.png)
     Fig. 3     the composer                                (Onclark1 iio.png, Clark-home.png)
     Fig. 4     onboarding                                  (Onclark1.png, Onclark2 to 5.png)
     Fig. 5     the flashcard viewer                        (Onclark1jghky.png)
     Fig. 6     empty and full                              (Onclark1 t/r/y/yyy.png, Clark-folder.svg)
     Fig. 8     the streak                                  (clark-card-streak.png, Clark Main Landing Page.pdf)
*/

const S = window.Study || {
  reduce: matchMedia("(prefers-reduced-motion: reduce)").matches,
  hover: matchMedia("(hover: hover)").matches,
  onVisible: (el, start) => { start && start(); return () => {}; },
  raf: (fn) => { let on = true; const t = (n) => { if (on && fn(n, 1 / 60) !== false) requestAnimationFrame(t); }; requestAnimationFrame(t); return () => { on = false; }; },
};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const pad2 = (n) => String(n).padStart(2, "0");
const deg = (r) => (r * 180) / Math.PI;
const fmtDeg = (d, p = 1) => (d < 0 ? "−" : "") + Math.abs(d).toFixed(p) + "°";
const DPR = () => Math.min(2, window.devicePixelRatio || 1);
const icon = (id, cls = "") => `<svg${cls ? ` class="${cls}"` : ""} aria-hidden="true"><use href="#${id}"/></svg>`;
const later = (fn, ms) => (S.reduce ? fn() : setTimeout(fn, ms));
const arrive = (el, ms = 0) => { if (S.reduce) { el.classList.add("is-in"); return; } requestAnimationFrame(() => setTimeout(() => el.classList.add("is-in"), ms)); };
const goTo = (sel) => {
  const el = $(sel);
  if (!el) return;
  el.scrollIntoView({ behavior: S.reduce ? "auto" : "smooth", block: "center" });
};

/* Shared state: the streak (Fig. 8) is also what @track shows in the composer (Fig. 3). */
const streak = {
  days: new Set([1, 2, 3, 4, 5]), // clark-card-streak.png: the first 5 of 31 filled
  subs: new Set(),
  set(days) { this.days = new Set(days); this.subs.forEach((f) => f()); },
  count() {
    if (!this.days.size) return { n: 0, latest: 0, gap: 0, run: [] };
    const latest = Math.max(...this.days);
    const run = [];
    let d = latest;
    while (d >= 1 && this.days.has(d)) { run.push(d); d--; }
    return { n: run.length, latest, gap: d, run };
  },
};

/* =====================================================================
   Fig. 1 and Fig. 9: the badge.

   Measured off clark-logo.png (426×310): the tag is 405×148 px, so its height is
   0.37 of its width; the punch hole sits 0.11 of the height below the top edge,
   at 0.49 of the width; the tag is drawn 2.4° anticlockwise of level; the cord is
   16 px, 0.04 of the tag's width; the wordmark's cap height is 0.31 of the tag's
   width. The cover slide and the home screen draw the
   two cords at the same angles: the left one 62° from the horizontal, the right
   one 40°. Orange #ff3d00 on black, a white ring round the hole.

   The physics is mine. The tag is 5 Verlet points (4 corners and the hole) held
   rigid by 10 sticks. Each cord is a rope constraint from a fixed point to the
   hole: it pulls when stretched and does nothing when slack. The hole sits just
   right of centre, so the tag rests at the logo's −2.4°.
   ===================================================================== */
const LOGO = { aspect: 148 / 405, holeY: 0.11, tilt: (-2.4 * Math.PI) / 180, cord: 0.04, cordL: (62 * Math.PI) / 180, cordR: (40 * Math.PI) / 180 };
const PHYS = { g: 6000, hz: 240, iters: 10, damp: 0.9975, hm: 1 };

class Rig {
  constructor(w, h, opt) {
    this.opt = opt;
    this.damp = PHYS.damp;
    this.build(w, h);
  }
  build(w, h) {
    const o = this.opt;
    this.w = w; this.h = h;
    const tw = (this.tw = o.tagW(w));
    const th = (this.th = tw * LOGO.aspect);
    const hy = th * LOGO.holeY;
    // hole position that makes the rest angle the logo's tilt (centre of mass straight under the pin)
    const hx = tw / 2 - (th / 2 - hy) * Math.tan(LOGO.tilt);
    this.local = [[0, 0], [tw, 0], [tw, th], [0, th], [hx, hy]];
    this.mass = [1, 1, 1, 1, PHYS.hm];
    const hy0 = o.holeY(h, tw);
    const top = o.top(w, hy0);
    const D = hy0 - top;
    const H0 = { x: o.cx(w, D), y: hy0 };
    this.anchors = [
      { x: H0.x - D / Math.tan(LOGO.cordL), y: top, L: D / Math.sin(LOGO.cordL) },
      { x: H0.x + D / Math.tan(LOGO.cordR), y: top, L: D / Math.sin(LOGO.cordR) },
    ];
    const c = Math.cos(LOGO.tilt), s = Math.sin(LOGO.tilt);
    this.p = this.local.map(([lx, ly]) => {
      const dx = lx - hx, dy = ly - hy;
      const x = H0.x + dx * c - dy * s, y = H0.y + dx * s + dy * c;
      return { x, y, px: x, py: y };
    });
    this.sticks = [];
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
      const [ax, ay] = this.local[i], [bx, by] = this.local[j];
      this.sticks.push([i, j, Math.hypot(bx - ax, by - ay)]);
    }
    this.grab = null;
    this.t = 0;
    this.still = 0;
    // settle quietly so the first frame is already at rest
    const d = this.damp; this.damp = 0.9;
    for (let i = 0; i < 400; i++) this.step(1 / PHYS.hz);
    this.damp = d;
    this.p.forEach((q) => { q.px = q.x; q.py = q.y; });
    this.rest = this.angle();
    this.lastAng = this.rest;
    this.cont = this.rest; // the angle without wrapping, for the trace
    this.omega = 0;
  }
  angle() { const [a, b] = this.p; return Math.atan2(b.y - a.y, b.x - a.x); }
  com() {
    let x = 0, y = 0, m = 0;
    this.p.forEach((q, i) => { x += q.x * this.mass[i]; y += q.y * this.mass[i]; m += this.mass[i]; });
    return { x: x / m, y: y / m };
  }
  taut() { const H = this.p[4]; return this.anchors.map((a) => Math.hypot(H.x - a.x, H.y - a.y) >= a.L - 0.6); }
  // where a point on the tag is, from its local (u, v) in 0..1
  at(u, v) {
    const [a, b, c, d] = this.p;
    return { x: a.x * (1 - u) * (1 - v) + b.x * u * (1 - v) + c.x * u * v + d.x * (1 - u) * v, y: a.y * (1 - u) * (1 - v) + b.y * u * (1 - v) + c.y * u * v + d.y * (1 - u) * v };
  }
  toLocal(x, y) {
    const [a, b, , d] = this.p;
    const ex = { x: (b.x - a.x) / this.tw, y: (b.y - a.y) / this.tw };
    const ey = { x: (d.x - a.x) / this.th, y: (d.y - a.y) / this.th };
    const rx = x - a.x, ry = y - a.y;
    return { u: (rx * ex.x + ry * ex.y) / this.tw, v: (rx * ey.x + ry * ey.y) / this.th };
  }
  hit(x, y, slop) {
    const { u, v } = this.toLocal(x, y);
    const su = slop / this.tw, sv = slop / this.th;
    return u > -su && u < 1 + su && v > -sv && v < 1 + sv ? { u: Math.min(1, Math.max(0, u)), v: Math.min(1, Math.max(0, v)) } : null;
  }
  push(vx) { this.p.forEach((q) => { q.px -= vx; }); this.still = 0; }
  step(dt) {
    const g = PHYS.g * dt * dt, k = this.damp;
    for (const q of this.p) {
      const vx = (q.x - q.px) * k, vy = (q.y - q.py) * k;
      q.px = q.x; q.py = q.y;
      q.x += vx; q.y += vy + g;
    }
    for (let it = 0; it < PHYS.iters; it++) {
      if (this.grab) {
        // pull the grabbed point of the tag towards the pointer, shared out over the corners
        const { u, v, x, y } = this.grab;
        const w = [(1 - u) * (1 - v), u * (1 - v), u * v, (1 - u) * v];
        const cur = this.at(u, v);
        const ws = w.reduce((s, a) => s + a * a, 0);
        const ex = (x - cur.x) * 0.5, ey = (y - cur.y) * 0.5;
        for (let i = 0; i < 4; i++) { this.p[i].x += (w[i] * ex) / ws; this.p[i].y += (w[i] * ey) / ws; }
      }
      for (const [i, j, L] of this.sticks) {
        const a = this.p[i], b = this.p[j];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6;
        const ia = 1 / this.mass[i], ib = 1 / this.mass[j];
        const f = (d - L) / d / (ia + ib);
        a.x += dx * f * ia; a.y += dy * f * ia;
        b.x -= dx * f * ib; b.y -= dy * f * ib;
      }
      // the cords last: a rope only pulls when it is stretched
      const H = this.p[4];
      for (const A of this.anchors) {
        const dx = H.x - A.x, dy = H.y - A.y, d = Math.hypot(dx, dy);
        if (d > A.L) { const f = (d - A.L) / d; H.x -= dx * f; H.y -= dy * f; }
      }
    }
    // a hard flick shouldn't throw the tag through the page
    for (const q of this.p) {
      const vx = q.x - q.px, vy = q.y - q.py, sp = Math.hypot(vx, vy), cap = 26;
      if (sp > cap) { q.px = q.x - (vx / sp) * cap; q.py = q.y - (vy / sp) * cap; }
    }
    this.t += dt;
    const a = this.angle();
    let da = a - this.lastAng;
    if (da > Math.PI) da -= 2 * Math.PI; else if (da < -Math.PI) da += 2 * Math.PI;
    this.omega = this.omega * 0.8 + (da / dt) * 0.2;
    this.cont += da;
    this.lastAng = a;
    const moving = this.p.some((q) => Math.abs(q.x - q.px) + Math.abs(q.y - q.py) > 0.01);
    this.still = moving || this.grab ? 0 : this.still + 1;
  }
  get asleep() { return this.still > 90; }
}

function rigFigure(root, mode) {
  const box = $(`[data-rig="${mode}"]`, root);
  const canvas = $("canvas", box);
  const ctx = canvas.getContext("2d");
  const read = $(`[data-rig-read="${mode}"]`, root);
  const playBtn = $(`[data-rig-play="${mode}"]`, root);
  const R = (k) => read && $(`[data-r="${k}"]`, read);
  const css = getComputedStyle(document.body);
  const INK = css.getPropertyValue("--ink").trim() || "#1d1b18";
  const INK2 = css.getPropertyValue("--ink-2").trim() || "#67625a";
  const INK3 = css.getPropertyValue("--ink-3").trim() || "#9a958b";
  const ORANGE = "#ff3d00";
  const FONT = css.getPropertyValue("--font").trim();

  const opt = mode === "hero"
    ? { tagW: (w) => Math.max(170, Math.min(290, w * 0.19)), cx: (w) => w / 2, holeY: (h, tw) => h - tw * 0.62 - 26, top: () => -12 }
    : {
        // keep both fixed points on the canvas: the cords span 1/tan62° + 1/tan40° = 1.72 times their drop
        tagW: (w) => Math.max(140, Math.min(200, w * 0.3)),
        holeY: (h, tw) => h - tw * 0.62 - 30,
        top: (w, hy) => Math.max(34, hy - (w - 48) / 1.724),
        cx: (w, D) => 24 + D / Math.tan(LOGO.cordL) + (w - 48 - 1.724 * D) / 2,
      };
  let rig = null, W = 0, H = 0, running = false, stopLoop = null, visible = false;
  let enabled = !S.reduce;
  const trace = mode === "xray" ? traceFigure(root) : null;

  const size = () => {
    const r = box.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (Math.abs(r.width - W) < 1 && Math.abs(r.height - H) < 1 && rig) return;
    W = r.width; H = r.height;
    const d = DPR();
    canvas.width = Math.round(W * d); canvas.height = Math.round(H * d);
    const damp = rig ? rig.damp : PHYS.damp;
    rig = new Rig(W, H, opt);
    rig.damp = damp;
    trace && trace.reset(rig);
    draw(); readout();
  };

  const cordPath = (A, Hp, L) => {
    const d = Math.hypot(Hp.x - A.x, Hp.y - A.y);
    ctx.beginPath(); ctx.moveTo(A.x, A.y);
    if (d >= L - 0.6) { ctx.lineTo(Hp.x, Hp.y); return true; }
    const sag = Math.sqrt(Math.max(0, L * L - d * d)) * 0.5; // a slack cord hangs below its chord
    ctx.quadraticCurveTo((A.x + Hp.x) / 2, (A.y + Hp.y) / 2 + sag, Hp.x, Hp.y);
    return false;
  };

  function drawHero() {
    const [a, , , , h] = rig.p;
    const th = rig.angle(), tw = rig.tw, tH = rig.th;
    const cords = () => { ctx.strokeStyle = ORANGE; ctx.lineWidth = tw * LOGO.cord; ctx.lineCap = "round"; ctx.lineJoin = "round"; rig.anchors.forEach((A) => { cordPath(A, h, A.L); ctx.stroke(); }); };
    cords();
    // the tag, with a soft shadow on the paper behind it
    ctx.save();
    ctx.translate(a.x, a.y); ctx.rotate(th);
    ctx.shadowColor = "rgba(29, 27, 24, 0.26)"; ctx.shadowBlur = 26 * DPR(); ctx.shadowOffsetY = 14 * DPR(); ctx.shadowOffsetX = 3 * DPR();
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.roundRect(0, 0, tw, tH, tw * 0.05); ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = ORANGE;
    ctx.font = `700 ${tw * 0.225}px ${FONT}`;
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText("Clark", tw * 0.5, tH * 0.79);
    ctx.restore();
    // the cords run behind the tag; near the hole they come over its edge and into the ring
    ctx.save(); ctx.beginPath(); ctx.arc(h.x, h.y, tw * 0.13, 0, 7); ctx.clip(); cords(); ctx.restore();
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(h.x, h.y, tw * 0.042, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(h.x, h.y, tw * 0.031, 0, 7); ctx.fill();
    ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(h.x, h.y, tw * 0.015, 0, 7); ctx.fill();
  }

  function label(t, x, y, align = "left", color = INK2) {
    ctx.fillStyle = color; ctx.font = `500 12px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = "middle";
    ctx.fillText(t, x, y);
  }

  function drawXray() {
    const P = rig.p, h = P[4], th = rig.angle(), com = rig.com();
    const taut = rig.taut();
    // the circles the hole can reach on each cord
    ctx.lineWidth = 1; ctx.setLineDash([3, 5]); ctx.strokeStyle = INK3;
    rig.anchors.forEach((A) => { ctx.beginPath(); ctx.arc(A.x, A.y, A.L, 0.05, Math.PI - 0.05); ctx.stroke(); });
    ctx.setLineDash([]);
    // fixed points
    ctx.fillStyle = INK;
    rig.anchors.forEach((A) => { ctx.fillRect(A.x - 4, A.y - 4, 8, 8); });
    // cords: solid when taut, dashed when slack
    rig.anchors.forEach((A, i) => {
      ctx.strokeStyle = taut[i] ? ORANGE : INK2; ctx.lineWidth = taut[i] ? 2 : 1.4;
      ctx.setLineDash(taut[i] ? [] : [5, 4]);
      cordPath(A, h, A.L); ctx.stroke();
    });
    ctx.setLineDash([]);
    // the sticks that keep the tag rigid
    ctx.strokeStyle = INK3; ctx.lineWidth = 0.8;
    rig.sticks.forEach(([i, j]) => { ctx.beginPath(); ctx.moveTo(P[i].x, P[i].y); ctx.lineTo(P[j].x, P[j].y); ctx.stroke(); });
    // the tag's outline, lightly filled so it still reads as the badge
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.fillStyle = "rgba(29, 27, 24, 0.05)";
    ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y); for (let i = 1; i < 4; i++) ctx.lineTo(P[i].x, P[i].y); ctx.closePath(); ctx.fill(); ctx.stroke();
    // points
    ctx.fillStyle = INK;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(P[i].x, P[i].y, 3.2, 0, 7); ctx.fill(); }
    ctx.strokeStyle = ORANGE; ctx.lineWidth = 2; ctx.fillStyle = "#f3f1ea";
    ctx.beginPath(); ctx.arc(h.x, h.y, 5.5, 0, 7); ctx.fill(); ctx.stroke();
    // centre of mass and gravity
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(com.x, com.y, 6, 0, 7); ctx.moveTo(com.x - 10, com.y); ctx.lineTo(com.x + 10, com.y); ctx.moveTo(com.x, com.y - 10); ctx.lineTo(com.x, com.y + 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(com.x, com.y + 12); ctx.lineTo(com.x, com.y + 46); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(com.x - 4, com.y + 40); ctx.lineTo(com.x, com.y + 47); ctx.lineTo(com.x + 4, com.y + 40); ctx.stroke();
    label("g", com.x + 8, com.y + 40);
    // the angle, measured from level at the hole, with its ray carried past the tag's edge
    const r = rig.tw * 0.24, ray = rig.tw * 0.66;
    ctx.strokeStyle = INK3; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x + ray, h.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = ORANGE; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(h.x, h.y, r, Math.min(0, th), Math.max(0, th)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x + Math.cos(th) * ray, h.y + Math.sin(th) * ray); ctx.stroke();
    // labels, kept to the few that matter
    label("fixed", rig.anchors[0].x + 9, rig.anchors[0].y + 2);
    label("fixed", rig.anchors[1].x - 9, rig.anchors[1].y + 2, "right");
    label("hole", h.x - 12, h.y - 14, "right", INK);
    label("centre of mass", com.x + 14, com.y + 2, "left", INK);
    label("θ " + fmtDeg(deg(th)), h.x + Math.cos(th) * (ray + 8), h.y + Math.sin(th) * (ray + 8), "left", "#c23c0a");
  }

  function draw() {
    if (!rig) return;
    const d = DPR();
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (mode === "hero") drawHero(); else drawXray();
  }

  let lastRead = 0;
  function readout(force) {
    if (!read || !rig) return;
    const now = performance.now();
    if (!force && now - lastRead < 90) return;
    lastRead = now;
    R("theta").textContent = fmtDeg(deg(rig.angle()));
    R("omega").textContent = fmtDeg(Math.abs(rig.asleep ? 0 : deg(rig.omega)), 0) + "/s";
    R("taut").textContent = rig.taut().map((t) => (t ? "taut" : "slack")).join(", ");
    if (R("damp")) R("damp").textContent = rig.damp.toFixed(4);
    if (trace) {
      R("period").textContent = trace.period ? trace.period.toFixed(2) + " s" : "not yet";
      R("keep").textContent = trace.keep ? Math.round(trace.keep * 100) + "%" : "not yet";
    }
  }

  let acc = 0;
  const loop = (t, dt) => {
    if (!rig) return true;
    acc += dt;
    const h = 1 / PHYS.hz;
    let n = 0;
    while (acc >= h && n < 12) { rig.step(h); acc -= h; n++; trace && trace.sample(rig); }
    draw(); readout(); trace && trace.draw();
    if (rig.asleep) { running = false; readout(true); trace && trace.draw(true); return false; }
    return true;
  };
  const wake = () => {
    if (!enabled || !visible || running) return;
    running = true; acc = 0;
    stopLoop = S.raf(loop);
  };
  const sleep = () => { if (stopLoop) stopLoop(); running = false; };

  // pointer: grab the tag anywhere, drag, and let go to throw it
  const pos = (e) => { const r = box.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  box.addEventListener("pointerdown", (e) => {
    if (!rig || !enabled) return;
    const p = pos(e);
    const slop = e.pointerType === "touch" ? 28 : 12;
    const hit = rig.hit(p.x, p.y, slop);
    if (!hit) return;
    rig.grab = { ...hit, x: p.x, y: p.y };
    box.setPointerCapture(e.pointerId);
    box.classList.add("is-grab");
    trace && trace.mark();
    wake();
  });
  box.addEventListener("pointermove", (e) => {
    if (!rig) return;
    const p = pos(e);
    if (rig.grab) { rig.grab.x = p.x; rig.grab.y = p.y; rig.still = 0; wake(); return; }
    if (S.hover && enabled) box.style.cursor = rig.hit(p.x, p.y, 12) ? "grab" : "default";
  });
  const drop = () => { if (rig && rig.grab) { rig.grab = null; box.classList.remove("is-grab"); } };
  box.addEventListener("pointerup", drop);
  box.addEventListener("pointercancel", drop);
  box.addEventListener("keydown", (e) => {
    if (!rig || !enabled) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      rig.push((e.key === "ArrowLeft" ? -1 : 1) * 2.4);
      trace && trace.mark();
      wake();
    }
  });

  if (playBtn && S.reduce) {
    playBtn.hidden = false;
    playBtn.addEventListener("click", () => {
      enabled = true; playBtn.hidden = true;
      rig.push(4); trace && trace.mark(); wake();
    });
  }

  const api = {
    flick() { if (!rig) return; enabled = true; if (playBtn) playBtn.hidden = true; rig.push(4); trace && trace.mark(); wake(); },
    setDamp(v) { if (rig) rig.damp = v; readout(true); },
  };

  new ResizeObserver(() => size()).observe(box);
  S.onVisible(box, () => { visible = true; size(); wake(); }, () => { visible = false; sleep(); });
  return api;
}

/* Fig. 9's right half: the tag's angle over the last 8 seconds, with each turning point marked. */
function traceFigure(root) {
  const svg = $("[data-trace]", root);
  const VW = 360, VH = 220, L = 40, Rm = 12, T = 14, B = 30, SPAN = 8;
  let pts = [], peaks = [], rest = 0, t0 = 0, lastDraw = 0, lastSample = -1;
  let prev = null, prevD = 0, ups = [];
  const api = {
    period: 0, keep: 0,
    reset(rig) { pts = []; peaks = []; ups = []; rest = deg(rig.rest); prev = null; api.period = 0; api.keep = 0; t0 = rig.t; api.draw(true); },
    mark() { peaks = []; ups = []; api.period = 0; api.keep = 0; },
    sample(rig) {
      if (rig.t - lastSample < 1 / 60) return;
      lastSample = rig.t;
      const a = deg(rig.cont) - rest;
      pts.push([rig.t, a]);
      while (pts.length && pts[0][0] < rig.t - SPAN - 0.5) pts.shift();
      if (rig.grab) { prev = null; return; }
      if (prev !== null) {
        const d = a - prev[1];
        if (prevD !== 0 && Math.sign(d) !== Math.sign(prevD) && Math.abs(prev[1]) > 0.4) {
          peaks.push(prev);
          if (peaks.length > 12) peaks.shift();
          const n = peaks.length;
          if (n >= 3 && Math.sign(peaks[n - 1][1]) === Math.sign(peaks[n - 3][1])) api.keep = Math.abs(peaks[n - 1][1] / peaks[n - 3][1]);
        }
        if (prev[1] < 0 && a >= 0) { ups.push(rig.t); if (ups.length > 4) ups.shift(); if (ups.length >= 2) api.period = ups[ups.length - 1] - ups[ups.length - 2]; }
        prevD = d;
      }
      prev = [rig.t, a];
      api.now = rig.t;
    },
    draw(force) {
      const now = performance.now();
      if (!force && now - lastDraw < 33) return;
      lastDraw = now;
      const tn = api.now || t0;
      const amp = Math.max(20, ...pts.map((p) => Math.abs(p[1]))) * 1.1;
      const X = (t) => L + ((t - (tn - SPAN)) / SPAN) * (VW - L - Rm);
      const Y = (a) => T + (1 - (a + amp) / (2 * amp)) * (VH - T - B);
      const line = pts.filter((p) => p[0] >= tn - SPAN).map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" ");
      const tick = Math.ceil(amp / 2 / 10) * 10;
      svg.innerHTML = `
        <line class="grid" x1="${L}" x2="${VW - Rm}" y1="${Y(tick)}" y2="${Y(tick)}"/>
        <line class="grid" x1="${L}" x2="${VW - Rm}" y1="${Y(-tick)}" y2="${Y(-tick)}"/>
        <line class="rest" x1="${L}" x2="${VW - Rm}" y1="${Y(0)}" y2="${Y(0)}"/>
        <line class="ax" x1="${L}" x2="${L}" y1="${T}" y2="${VH - B}"/>
        <line class="ax" x1="${L}" x2="${VW - Rm}" y1="${VH - B}" y2="${VH - B}"/>
        <text x="${L - 6}" y="${Y(tick) + 4}" text-anchor="end">+${tick}°</text>
        <text x="${L - 6}" y="${Y(0) + 4}" text-anchor="end">rest</text>
        <text x="${L - 6}" y="${Y(-tick) + 4}" text-anchor="end">−${tick}°</text>
        <text x="${L}" y="${VH - 10}">8 s ago</text>
        <text x="${VW - Rm}" y="${VH - 10}" text-anchor="end">now</text>
        ${line ? `<polyline class="ln" points="${line}"/>` : ""}
        ${peaks.filter((p) => p[0] >= tn - SPAN).map((p) => `<circle class="pk" cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="3.2"/>`).join("")}`;
    },
  };
  return api;
}

/* =====================================================================
   Fig. 2: the home screen with a key. Pins and key lines light each other.
   ===================================================================== */
function homeKey() {
  const fig = $("#home-fig");
  if (!fig) return;
  const pins = $$(".ck-pin", fig), rows = $$(".ck-legend li", fig);
  let sticky = null;
  const on = (k) => {
    pins.forEach((p) => p.classList.toggle("is-on", p.dataset.pin === k));
    rows.forEach((r) => r.classList.toggle("is-on", r.dataset.pin === k));
  };
  const off = () => on(sticky);
  pins.forEach((p) => {
    p.addEventListener("pointerenter", () => on(p.dataset.pin));
    p.addEventListener("pointerleave", off);
    p.addEventListener("focus", () => on(p.dataset.pin));
    p.addEventListener("blur", off);
    p.addEventListener("click", () => { sticky = sticky === p.dataset.pin ? null : p.dataset.pin; on(sticky); });
  });
  rows.forEach((r) => {
    r.addEventListener("pointerenter", () => on(r.dataset.pin));
    r.addEventListener("pointerleave", off);
  });
}

/* =====================================================================
   Fig. 3: the composer. The commands and their tips are the designs' own copy
   (the onboarding tips, the quiz empty state, the flashcard tip).
   ===================================================================== */
const CMDS = [
  { k: "ask", tip: "in chat after uploading a PDF", ret: "an answer, with its actions" },
  { k: "update", tip: "in chat to transform any PDF", ret: "the material, to open in Canvas" },
  { k: "materials", tip: "in chat to start organizing your space", ret: "your materials" },
  { k: "board", tip: "in chat to start a shared canvas", ret: "a shared whiteboard" },
  { k: "track", tip: "in chat to see your streak and learning stats", ret: "your streak card" },
  { k: "quiz", tip: "to generate a quiz instantly", ret: "Quiz Generated!" },
  { k: "flashcard", tip: "to generate a Flashcard set", ret: "Flashcard Pack Generated" },
];
const MAKE = {
  workspace: "a new workspace", chat: "a new chat", flashcard: "Flashcard Pack Generated", canvas: "a shared whiteboard", material: "the material, to open in Canvas",
};

// Clark-folder.svg, ported: the back panel and the tab-shaped front, in the file's own greys
const FOLDER_BACK = "M149.659 0.486C159.588 0.486 167.637 8.536 167.637 18.465V119.533C167.637 129.462 159.588 137.512 149.659 137.512H18.465C8.536 137.512 0.486 129.462 0.486 119.533V18.465C0.486 8.536 8.536 0.487 18.465 0.486H149.659Z";
const FOLDER_FRONT = "M59.313 10.69C65.887 10.69 71.628 14.726 76.469 19.174C77.821 20.416 79.299 21.545 80.895 22.542L83.713 24.302C88.499 27.291 94.029 28.876 99.672 28.876H154.519C164.18 28.876 172.011 36.708 172.011 46.369V120.504C172.011 130.165 164.179 137.996 154.518 137.996H17.494C7.833 137.996 0.002 130.165 0.002 120.504V28.182C0.002 18.521 7.833 10.69 17.494 10.69H59.313Z";
const folderSVG = (globe = "#9a5bff") => `<svg class="ck-fsvg" viewBox="-1 -1 174 140" aria-hidden="true"><path d="${FOLDER_BACK}" fill="#2C2C2C" stroke="#525252" stroke-width="0.97"/><path d="${FOLDER_FRONT}" fill="#404040" stroke="#525252" stroke-width="0.97"/><g transform="translate(13 108) scale(0.85)" style="color:${globe}"><use href="#i-globe" width="24" height="24" style="fill:none;stroke:currentColor;stroke-width:1.8"/></g></svg>`;

function composer() {
  const fig = $("#composer-fig");
  if (!fig) return;
  const input = $("[data-input]", fig), ph = $("[data-ph]", fig), menu = $("[data-menu]", fig), create = $("[data-create]", fig);
  const convo = $("[data-convo]", fig), quick = $("[data-quick]", fig);
  const modeBtns = $$("[data-mode]", fig);
  const CR = (k) => $(`[data-cr="${k}"]`, fig);
  let mode = "Ask", list = [], active = 0, trig = null;

  quick.innerHTML = CMDS.map((c) => `<li><button type="button" data-q="${c.k}">@${c.k}</button></li>`).join("");

  const chip = (k) => { const s = document.createElement("span"); s.className = "ck-chip"; s.contentEditable = "false"; s.dataset.k = k; s.textContent = "@" + k; return s; };
  const empty = () => !input.textContent.replace(/ /g, " ").trim() && !$(".ck-chip", input);
  const syncPh = () => { ph.hidden = !empty(); };
  const setRead = (k) => {
    CR("mode").textContent = mode;
    if (k) { CR("cmd").textContent = k.startsWith("@") ? k : "@" + k; const c = CMDS.find((x) => "@" + x.k === CR("cmd").textContent); CR("ret").textContent = c ? c.ret : MAKE[k.replace("@", "")] || "an answer"; }
  };

  // the caret is right after "@" plus letters, at the start or after a space
  const trigger = () => {
    const sel = getSelection();
    if (!sel.rangeCount || !input.contains(sel.anchorNode)) return null;
    const r = sel.getRangeAt(0);
    if (!r.collapsed || r.startContainer.nodeType !== 3) return null;
    const node = r.startContainer, off = r.startOffset;
    const m = node.data.slice(0, off).match(/(^|[\s ])@([a-z]*)$/i);
    if (!m) return null;
    return { node, start: off - m[2].length - 1, end: off, q: m[2].toLowerCase() };
  };
  const renderMenu = () => {
    menu.innerHTML = list.length
      ? list.map((c, i) => `<button type="button" role="option" tabindex="-1" id="ck-opt-${c.k}" class="ck-cmd" aria-selected="${i === active}" data-k="${c.k}"><span class="ck-chip">@${c.k}</span><small>${c.tip}</small></button>`).join("")
      : `<p class="ck-cmd-none">No command starts with that.</p>`;
    if (list[active]) input.setAttribute("aria-activedescendant", "ck-opt-" + list[active].k); else input.removeAttribute("aria-activedescendant");
  };
  const openMenu = (q) => {
    const next = CMDS.filter((c) => c.k.startsWith(q));
    if (next.map((c) => c.k).join() !== list.map((c) => c.k).join()) active = 0;
    list = next;
    renderMenu();
    menu.hidden = false; create.hidden = true;
    input.setAttribute("aria-expanded", "true");
  };
  const closeMenu = () => { menu.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); trig = null; };
  const caretEnd = (node) => {
    const r = document.createRange();
    if (node && node.nodeType === 3) r.setStart(node, node.data.length); else { r.selectNodeContents(input); r.collapse(false); }
    r.collapse(true);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  };
  const insertChip = (k) => {
    const c = chip(k), sp = document.createTextNode(" ");
    const t = trig;
    if (t && t.node.isConnected) {
      const r = document.createRange();
      r.setStart(t.node, t.start); r.setEnd(t.node, Math.min(t.end, t.node.data.length));
      r.deleteContents(); r.insertNode(sp); r.insertNode(c);
    } else {
      input.querySelectorAll("br").forEach((b) => b.remove());
      input.append(c, sp);
    }
    input.focus(); caretEnd(sp);
    closeMenu(); syncPh(); setRead(k);
  };
  const pick = (k) => insertChip(k);

  input.addEventListener("input", () => {
    if (input.innerHTML === "<br>") input.innerHTML = "";
    syncPh();
    trig = trigger();
    if (trig) openMenu(trig.q); else closeMenu();
  });
  input.addEventListener("keydown", (e) => {
    if (!menu.hidden && list.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        active = (active + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length;
        renderMenu(); return;
      }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); trig = trigger() || trig; pick(list[active].k); return; }
    }
    if (e.key === "Escape") { closeMenu(); create.hidden = true; return; }
    if (e.key === "Enter") { e.preventDefault(); submit(); }
  });
  input.addEventListener("paste", (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text").replace(/\s+/g, " ");
    const sel = getSelection(); if (!sel.rangeCount) return;
    const r = sel.getRangeAt(0); r.deleteContents(); const tn = document.createTextNode(text); r.insertNode(tn); caretEnd(tn); syncPh();
  });
  input.addEventListener("blur", () => setTimeout(() => { if (!fig.contains(document.activeElement)) closeMenu(); }, 120));
  menu.addEventListener("mousedown", (e) => e.preventDefault());
  menu.addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (b) pick(b.dataset.k); });

  $("[data-at]", fig).addEventListener("click", () => {
    input.focus();
    let last = input.lastChild;
    const needsSpace = last && !/[\s ]$/.test(last.textContent || "");
    const tn = document.createTextNode((needsSpace ? " " : "") + "@");
    input.append(tn); caretEnd(tn); syncPh();
    trig = trigger(); openMenu("");
  });
  quick.addEventListener("click", (e) => { const b = e.target.closest("[data-q]"); if (!b) return; trig = null; insertChip(b.dataset.q); });
  $("[data-send]", fig).addEventListener("click", submit);

  // modes: a radio group, arrow keys move along it
  const setMode = (m, focus) => {
    mode = m;
    modeBtns.forEach((b) => { const on = b.dataset.mode === m; b.setAttribute("aria-checked", String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
    setRead();
    if (m === "Create") { closeMenu(); create.hidden = false; const f = $("button", create); f && f.focus(); } else create.hidden = true;
  };
  modeBtns.forEach((b, i) => {
    b.addEventListener("click", () => setMode(b.dataset.mode));
    b.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const n = modeBtns[(i + (e.key === "ArrowRight" ? 1 : -1) + modeBtns.length) % modeBtns.length];
      setMode(n.dataset.mode, true);
    });
  });
  create.addEventListener("keydown", (e) => {
    const items = $$("button", create), i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus(); }
    if (e.key === "Escape") { create.hidden = true; $('[data-mode="Create"]', fig).focus(); }
  });
  create.addEventListener("click", (e) => {
    const b = e.target.closest("[data-make]"); if (!b) return;
    create.hidden = true;
    const k = b.dataset.make;
    CR("mode").textContent = "Create"; CR("cmd").textContent = "Create › " + b.textContent.trim(); CR("ret").textContent = MAKE[k];
    convo.innerHTML = "";
    if (k === "chat") { input.focus(); return; }
    reply(k);
  });

  // the thread
  const acts = () => `<div class="ck-acts" aria-hidden="true">${["i-speaker", "i-copy", "i-thumb", "i-thumbdown", "i-pencil", "i-regen"].map((i) => icon(i)).join("")}</div>`;
  const RESULT = {
    ask: () => `<div class="ck-lines" aria-label="Clark's answer"><i></i><i></i><i></i></div>`,
    flashcard: () => `<div class="ck-obj"><div class="ck-obj-h">${icon("i-cards")}Flashcard Pack Generated</div><div class="ck-obj-center"><button type="button" class="ck-obj-btn" data-go="#flashcards-fig">${icon("i-link")}Open Flashcards</button></div></div>`,
    quiz: () => `<div class="ck-obj"><div class="ck-obj-h">${icon("i-quiz", "ck-o")}Quiz Generated!</div><ul class="ck-qrows"><li>${icon("i-quiz")}Intro to Photosynthesis</li><li>${icon("i-file")}Source - <u>biology_notes.pdf</u></li><li>${icon("i-cal")}Created Date - June 29, 2025</li><li><i class="ck-sw"></i>Score - Not taken yet.</li></ul><button type="button" class="ck-obj-btn is-o" data-go="#ef-fig" data-ef="quizzes">Start Quiz</button></div>`,
    track: () => {
      const { n } = streak.count();
      return `<div class="ck-obj"><div class="ck-mini-grid" aria-hidden="true">${Array.from({ length: 31 }, (_, i) => `<i class="${streak.days.has(i + 1) ? "on" : ""}"></i>`).join("")}</div><div class="ck-obj-h">${n ? n + "-day streak!!" : "No streak yet."}</div><button type="button" class="ck-obj-btn is-text${n ? "" : " is-quiet"}" data-go="#streak-fig">${n ? "View Full Stats" : "Study today to ignite your first flame!"}</button></div>`;
    },
    materials: () => `<div class="ck-obj"><div class="ck-mat-stats"><b>20 Mat. Uploaded</b><span>4 links</span><span>10 Docs</span><span>6 Scans</span></div><div class="ck-files" aria-hidden="true">${"<span><i></i>Bio45.pdf</span>".repeat(4)}</div></div>`,
    update: () => `<div class="ck-reply-file"><p class="ck-above">Open in Canvas ›</p><div class="ck-obj ck-file">${icon("i-file")}<div>Bio45.pdf<small>PDF</small></div></div></div>`,
    board: () => `<div class="ck-obj"><div class="ck-obj-h">${icon("i-canvas")}Whiteboard</div><div class="ck-board" aria-hidden="true"><svg class="ck-scrib" viewBox="0 0 100 40" preserveAspectRatio="none"><path d="M4 30 C 20 4, 30 36, 48 18 S 80 6, 96 26"/></svg><span style="left:8px;top:8px;background:#cfe0ff">You</span></div></div>`,
    workspace: () => `<div class="ck-obj ck-wsnew"><div class="ck-folder" style="padding:0;width:150px">${folderSVG()}<p class="nm" style="color:var(--ck-t1)">Math Revision</p><p class="ct" style="color:var(--ck-t2)">0 File</p></div></div>`,
  };
  RESULT.canvas = RESULT.board;
  RESULT.material = RESULT.update;

  const userBubble = (nodes) => {
    const b = document.createElement("div");
    b.className = "ck-msg-u ck-in";
    nodes.forEach((n) => b.append(n));
    return b;
  };
  function reply(k, instant) {
    const wrap = document.createElement("div");
    wrap.className = "ck-reply";
    convo.append(wrap);
    const show = () => {
      wrap.innerHTML = `<div class="ck-pop-in">${(RESULT[k] || RESULT.ask)()}</div>${acts()}`;
      if (instant) $(".ck-pop-in", wrap).classList.add("is-in"); else arrive($(".ck-pop-in", wrap));
    };
    if (instant || S.reduce) { show(); return; }
    wrap.innerHTML = `<div class="ck-think" aria-label="Clark is answering"><i></i><i></i><i></i></div>`;
    setTimeout(show, 650);
  }
  function submit() {
    closeMenu();
    const nodes = [];
    let text = "", first = null;
    input.childNodes.forEach((n) => {
      if (n.nodeType === 3) { text += n.data; nodes.push(document.createTextNode(n.data)); }
      else if (n.classList && n.classList.contains("ck-chip")) { first = first || n.dataset.k; nodes.push(chip(n.dataset.k)); }
      else if (n.textContent) { text += n.textContent; nodes.push(document.createTextNode(n.textContent)); }
    });
    if (!text.replace(/ /g, " ").trim() && !first) { input.focus(); return; }
    const k = first || "ask";
    convo.innerHTML = "";
    const b = userBubble(nodes);
    convo.append(b); arrive(b);
    input.innerHTML = ""; syncPh(); setRead(k);
    reply(k);
    input.focus();
  }
  convo.addEventListener("click", (e) => {
    const b = e.target.closest("[data-go]");
    if (!b) return;
    if (b.dataset.ef) document.dispatchEvent(new CustomEvent("ck:ef", { detail: { screen: b.dataset.ef, full: true } }));
    goTo(b.dataset.go);
  });

  // the design's own exchange, Onclark1 iio.png
  const seed = [document.createTextNode("Can you help me generate a "), chip("flashcard"), document.createTextNode(" on Keynesian economics?")];
  seed[1].textContent = "@Flashcard";
  const sb = userBubble(seed); sb.classList.add("is-in"); convo.append(sb);
  reply("flashcard", true);
  syncPh(); setRead("flashcard");
}

/* =====================================================================
   Fig. 4: onboarding. Copy from Onclark1.png and Onclark2 to 5.png; the designs'
   em dashes became commas and full stops. Dark or light per the screens.
   ===================================================================== */
const STEPS = [
  { k: "ask", theme: "dark", title: "Talk to your materials. Get instant clarity.",
    body: "Upload any file and Clark responds like a savvy study buddy, breaking down everything from slides to 200-page PDFs with clear, instant answers.",
    ben: [["Based on context", "Chat is aware of the exact content of your uploaded files, not just general knowledge."], ["Ask anything", "From “what does this mean?” to “explain like I'm 5,” Clark helps you understand fast."], ["Built for learning", "It doesn't just answer. You learn as you go, with examples, follow-ups, and flashbacks."]],
    tip: "in chat after uploading a PDF." },
  { k: "update", theme: "dark", title: "Turn PDFs into smart, editable materials.",
    body: "Clark helps you summarize entire chapters, highlight key points, or even edit and rebuild your materials with fresh updates, based on new uploads, class notes, or AI-generated insights.",
    ben: [["Summarize better", "No more TL;DRs. You get summaries that teach, not just reduce."], ["Edit on the Go.", "Swap sections, update figures, and rebuild the PDF. No extra tools."], ["Make your own", "Draft fresh materials from scratch or merge multiple sources."]],
    tip: "in chat to transform any PDF." },
  { k: "materials", theme: "light", title: "All your study files, perfectly organized.",
    body: "Studying isn't linear. Clark gives you Boards to organize materials, themes, or semesters, with drag-and-drop flow, visibility controls, and smart linking between files.",
    ben: [["Built around you", "Label and group things how you actually think: by exams, modules, or weeks."], ["Study, don't search", "Instantly find what you need, with filters, folders, and previews."], ["Share with Control", "Share a whole folder, or just a file. Decide who sees what."]],
    tip: "in chat to start organizing your space." },
  { k: "board", theme: "light", title: "Group study, redefined.",
    body: "No more messy group chats. Jump into a shared infinite whiteboard, brainstorm ideas, explain concepts to others, or drop visual summaries directly from chat.",
    ben: [["Draw together", "Use the canvas to sketch diagrams, flowcharts, mindmaps, live or async."], ["Explain anything", "Need to help a friend with a tricky problem? Drop visuals straight from chat."], ["All synced", "Everyone in the whiteboard sees the same thing in real time."]],
    tip: "in chat to start a shared canvas." },
  { k: "track", theme: "dark", title: "Accountability, minus the stress.",
    body: "Keep track of your learning with streaks, reminders, and progress check-ins. Clark nudges you to stay consistent and celebrates the little wins that build big knowledge.",
    ben: [["Streaks that matter", "You don't just show up. You show growth."], ["Smart reminders", "Based on what you study and when you retain it best."], ["Celebrate progress", "From badges to milestones, Clark keeps it fun and rewarding."]],
    tip: "in chat to see your streak and learning stats." },
];

function onboarding() {
  const fig = $("#onb-fig");
  if (!fig) return;
  const modal = $("[data-modal]", fig), map = $("[data-o-map]", fig);
  const O = (k) => $(`[data-o="${k}"]`, fig);
  const prev = $("[data-o-prev]", fig), next = $("[data-o-next]", fig), readFull = $("[data-o-readfull]", fig);
  const pager = $$("[data-o-pager] span", fig), preview = $("[data-o-preview]", fig);
  let i = 0;
  map.innerHTML = STEPS.map((s, j) => {
    const card = s.theme === "dark" ? "#191919" : "#f5f5f5", pv = s.theme === "dark" ? "#fafafa" : "#262626";
    return `<li><button type="button" data-step="${j}" aria-label="Step ${j + 1}: ${s.title} Teaches @${s.k}. ${s.theme === "dark" ? "Dark" : "Light"} card."><span class="sw" style="background:${card};box-shadow:0 0 0 1px rgba(29,27,24,.12)"><i></i><i style="background:${pv}"></i></span><span class="n">${pad2(j + 1)}</span><span class="t">${s.title}</span><span class="wire"></span><span class="ck-chip">@${s.k}</span></button></li>`;
  }).join("");
  const mapBtns = $$("button", map);
  const go = (j) => {
    i = (j + STEPS.length) % STEPS.length;
    const s = STEPS[i];
    modal.dataset.theme = s.theme;
    modal.setAttribute("aria-label", `Step ${i + 1} of 5`);
    O("title").textContent = s.title;
    O("body").textContent = s.body;
    O("ben").innerHTML = s.ben.map(([b, t]) => `<li>${icon("i-globe")}<div><b>${b}</b><span>${t}</span></div></li>`).join("");
    O("tip").innerHTML = `${icon("i-globe")}<span>Type <span class="ck-chip">@${s.k}</span> ${s.tip}</span>`;
    preview.innerHTML = `<span class="ck-chip">@${s.k}</span>`;
    prev.hidden = i === 0; readFull.hidden = i !== 0;
    pager.forEach((p, j2) => p.classList.toggle("on", j2 === i));
    mapBtns.forEach((b, j2) => { if (j2 === i) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current"); });
  };
  $("[data-o-continue]", fig).addEventListener("click", () => go(i + 1));
  next.addEventListener("click", () => go(i + 1));
  prev.addEventListener("click", () => go(i - 1));
  map.addEventListener("click", (e) => { const b = e.target.closest("[data-step]"); if (b) go(+b.dataset.step); });
  go(0);
}

/* =====================================================================
   Fig. 5: the flashcard viewer (Onclark1jghky.png). The cards are mine, written
   from this page. The flip's timing is mine too; the plot shows it.
   ===================================================================== */
const CARDS = [
  ["What is Clark?", "An AI-native study workspace. Built by students, for students."],
  ["How many apps do students use to study, by Clark's count?", "7. None of them talk to each other."],
  ["Where does Clark get its context?", "From your workspace: the materials you bring in, not just what you type."],
  ["What happens when you type @ in the composer?", "Clark offers its magic commands, and the one you pick lands in your sentence as an orange chip."],
  ["How does onboarding teach the commands?", "5 steps, one command each: @ask, @update, @materials, @board, @track."],
  ["What does the streak card show before you start?", "No streak yet. Study today to ignite your first flame!"],
];
const EASES = {
  out: { bez: [0.22, 1, 0.36, 1], name: "Ease out" },
  inout: { bez: [0.65, 0, 0.35, 1], name: "Ease in-out" },
  linear: { bez: [0, 0, 1, 1], name: "Linear" },
};
const FLIP_MS = 560;
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t, sy = (t) => ((ay * t + by) * t + cy) * t, dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) { const e = sx(t) - x; if (Math.abs(e) < 1e-6) return t; const d = dx(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
    let lo = 0, hi = 1; t = x;
    for (let i = 0; i < 40; i++) { const v = sx(t); if (Math.abs(v - x) < 1e-6) break; if (x > v) lo = t; else hi = t; t = (lo + hi) / 2; }
    return t;
  };
  return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sy(solve(x)));
}
const swapAt = (f) => { let lo = 0, hi = 1; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (f(m) < 0.5) lo = m; else hi = m; } return (lo + hi) / 2; };

function flashcards() {
  const fig = $("#flashcards-fig");
  if (!fig) return;
  const card = $("[data-fc-card]", fig), front = $("[data-fc-front]", fig), back = $("[data-fc-back]", fig);
  const count = $("[data-fc-count]", fig), lab = $("[data-fc-label]", fig), list = $("[data-fc-list]", fig), prevBtn = $("[data-fc-preview]", fig);
  const svg = $("[data-fc-svg]", fig);
  const FR = (k) => $(`[data-fr="${k}"]`, fig);
  let i = 0, ang = 0, target = 0, easeKey = "out", stop = null, prog = 0;
  let ease = bezier(...EASES.out.bez);

  list.innerHTML = CARDS.map(([q, a], j) => `<li><b>${j + 1}. ${q}</b>${a}</li>`).join("");
  prevBtn.textContent = ""; prevBtn.insertAdjacentHTML("afterbegin", `Preview Set (${CARDS.length} Cards)${icon("i-chev")}`);

  const faces = () => {
    const [q, a] = CARDS[i];
    front.innerHTML = `${icon("i-cards", "ic")}<p class="q">${q}</p><p class="click">Click</p>`;
    back.innerHTML = `${icon("i-cards", "ic")}<p class="q">${q}</p><p class="a">${a}</p><p class="click">Click</p>`;
  };
  const showing = () => (ang % 360 > 90 && ang % 360 < 270 ? "back" : "front");
  const sync = () => {
    card.style.transform = `rotateY(${ang.toFixed(2)}deg)`;
    const side = showing();
    front.setAttribute("aria-hidden", String(side === "back"));
    back.setAttribute("aria-hidden", String(side === "front"));
    count.textContent = `${i + 1}/${CARDS.length}`;
    lab.textContent = target % 360 === 180 ? "Show Front" : "Show Back";
    card.setAttribute("aria-label", `Flashcard ${i + 1} of ${CARDS.length}, ${side}. Press to turn it over.`);
    FR("deg").textContent = Math.round(ang % 360) + "°";
  };

  // the plot: rotation against time, the 90° line where the face swaps, and the other curves as ghosts
  const P = { L: 46, R: 404, T: 22, B: 250 };
  const px = (t) => P.L + t * (P.R - P.L), py = (a) => P.B - (a / 180) * (P.B - P.T);
  const pathOf = (f, upto = 1) => { let d = ""; for (let s = 0; s <= 80; s++) { const t = (s / 80) * upto; d += (s ? "L" : "M") + px(t).toFixed(1) + " " + py(f(t) * 180).toFixed(1); } return d; };
  const plot = () => {
    const sw = swapAt(ease), swMs = Math.round(sw * FLIP_MS);
    const ghosts = Object.keys(EASES).filter((k) => k !== easeKey).map((k) => `<path class="ghost" d="${pathOf(bezier(...EASES[k].bez))}"/>`).join("");
    svg.innerHTML = `
      <line class="grid" x1="${P.L}" x2="${P.R}" y1="${py(180)}" y2="${py(180)}"/>
      <line class="ax" x1="${P.L}" x2="${P.L}" y1="${P.T - 6}" y2="${P.B}"/>
      <line class="ax" x1="${P.L}" x2="${P.R}" y1="${P.B}" y2="${P.B}"/>
      <text x="${P.L - 8}" y="${py(180) + 4}" text-anchor="end">180°</text>
      <text x="${P.L - 8}" y="${py(90) + 4}" text-anchor="end">90°</text>
      <text x="${P.L - 8}" y="${py(0) + 4}" text-anchor="end">0°</text>
      <text x="${P.L}" y="${P.B + 20}">0</text>
      <text x="${P.R}" y="${P.B + 20}" text-anchor="end">${FLIP_MS} ms</text>
      ${ghosts}
      <line class="swap" x1="${P.L}" x2="${P.R}" y1="${py(90)}" y2="${py(90)}"/>
      <line class="swap" x1="${px(sw)}" x2="${px(sw)}" y1="${py(90)}" y2="${P.B}"/>
      <text class="o" x="${P.R}" y="${py(90) - 8}" text-anchor="end">the face swaps here, edge-on</text>
      <text class="o" x="${px(sw) + 6}" y="${P.B - 8}">${swMs} ms</text>
      <path class="crv" d="${pathOf(ease)}"/>
      <path class="done" data-done d=""/>
      <circle class="dot" data-dot cx="${px(0)}" cy="${py(0)}" r="5"/>`;
    FR("swap").textContent = swMs + " ms";
    FR("bez").textContent = easeKey === "linear" ? "linear" : `cubic-bezier(${EASES[easeKey].bez.join(", ")})`;
    FR("dur").textContent = FLIP_MS;
  };
  const mark = (p) => {
    const dot = $("[data-dot]", svg), done = $("[data-done]", svg);
    if (!dot) return;
    dot.setAttribute("cx", px(p).toFixed(1)); dot.setAttribute("cy", py(ease(p) * 180).toFixed(1));
    done.setAttribute("d", p > 0 ? pathOf(ease, p) : "");
    FR("t").textContent = Math.round(p * FLIP_MS);
  };

  const flip = () => {
    const from = ang;
    target = Math.round(ang / 180) * 180 + 180;
    if (stop) stop();
    if (S.reduce) { ang = target; prog = 1; sync(); mark(1); return; }
    const t0 = performance.now();
    stop = S.raf((t) => {
      prog = Math.min(1, (t - t0) / FLIP_MS);
      ang = from + (target - from) * ease(prog);
      sync(); mark(prog);
      if (prog >= 1) { stop = null; ang = target; sync(); return false; }
      return true;
    });
    sync();
  };
  const goCard = (j) => {
    if (stop) { stop(); stop = null; }
    i = (j + CARDS.length) % CARDS.length;
    ang = 0; target = 0; faces(); sync(); mark(0);
  };
  card.addEventListener("click", flip);
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); }
    if (e.key === "ArrowRight") { e.preventDefault(); goCard(i + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); goCard(i - 1); }
  });
  $("[data-fc-show]", fig).addEventListener("click", flip);
  $("[data-fc-prev]", fig).addEventListener("click", () => goCard(i - 1));
  $("[data-fc-next]", fig).addEventListener("click", () => goCard(i + 1));
  prevBtn.addEventListener("click", () => { const open = list.hidden; list.hidden = !open; prevBtn.setAttribute("aria-expanded", String(open)); });
  const tabs = $$("[data-ease]", fig);
  const setEase = (k, focus) => {
    easeKey = k; ease = bezier(...EASES[k].bez);
    tabs.forEach((b) => { const on = b.dataset.ease === k; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
    plot(); mark(0);
  };
  tabs.forEach((b, j) => {
    b.addEventListener("click", () => setEase(b.dataset.ease));
    b.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      setEase(tabs[(j + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length].dataset.ease, true);
    });
  });
  faces(); plot(); sync(); mark(0);
}

/* =====================================================================
   Fig. 6: empty and full. Copy from Onclark1 t.png, r.png, y.png and yyy.png.
   ===================================================================== */
function emptyFull() {
  const fig = $("#ef-fig");
  if (!fig) return;
  const stage = $("[data-ef-stage]", fig);
  const screenTabs = $$("[data-screen]", fig), stateBtns = $$("[data-state]", fig);
  const st = { screen: "workspaces", full: { workspaces: false, quizzes: false } };
  const starred = new Set(["Bio Revision"]);
  const FOLDERS = ["Bio Revision", "Math Revision", "CS Revision", "Calculus 101 Prep", "Calculus 104 Prep"];
  const GLOBES = ["#9a5bff", "#3b82f6", "#ff7a1a", "#9a5bff", "#22a3e8"];

  const folder = (name, j, ghost) => `
    <div class="ck-folder${ghost ? " ck-ghost" : ""}${!ghost && j === 0 ? " is-sel" : ""}">
      <div style="position:relative;width:100%">${folderSVG(GLOBES[j] || "#9a5bff")}
        ${ghost ? `<span class="ck-star" aria-hidden="true" style="left:88.4%;top:11.6%;transform:translate(-50%,-50%);right:auto">${icon("i-star")}</span>`
          : `<button type="button" class="ck-star" style="left:88.4%;top:11.6%;transform:translate(-50%,-50%);right:auto" aria-pressed="${starred.has(name)}" aria-label="Star ${name}" data-star="${name}">${icon("i-star")}</button>`}
      </div>
      <p class="nm">${ghost ? "Your workspace goes here" : name}</p>${ghost ? "" : `<p class="ct">15 Files</p>`}
    </div>`;
  const qcard = (ghost) => ghost
    ? `<div class="ck-qcard ck-ghost ck-qghost"><ul><li>${icon("i-quiz")}<span>Your Created Quizzes go here</span></li></ul></div>`
    : `<div class="ck-qcard"><ul><li>${icon("i-quiz")}<span>Intro to Photosynthesis</span></li><li>${icon("i-file")}<span>Source - <u>biology_notes.pdf</u></span></li><li>${icon("i-cal")}<span>Created Date - June 29, 2025</span></li><li><i class="ck-sw"></i><span>Score - <span class="ck-o">8/10 (80%)</span></span></li></ul><div class="acts" aria-hidden="true">${icon("i-open")}${icon("i-quiz")}${icon("i-share")}${icon("i-trash")}</div></div>`;
  const stats = (full) => `<ul class="ck-stats"><li>${full ? 10 : 0} Quizzes Created</li><li>${icon("i-quiz")}${full ? 4 : 0} taken</li><li>${icon("i-share")}${full ? 8 : 0} shared</li><li>${icon("i-file")}${full ? 83 : 0}% Average Score</li></ul>`;

  const render = (animate) => {
    const full = st.full[st.screen];
    let html = "";
    if (st.screen === "workspaces") {
      html = full
        ? `<div class="ck-ef-pane"><div class="ck-folders">${FOLDERS.map((n, j) => folder(n, j)).join("")}</div></div>`
        : `<div class="ck-ef-pane"><div class="ck-folders is-one">${folder("", 0, true)}</div><div class="ck-empty"><h3>Looks a little quiet in here… ${icon("i-globe")}</h3><p>Workspaces help you organize everything you're learning, from subjects to side projects, into custom spaces built for deep focus, collaboration, and creativity.</p><button type="button" class="ck-cta" data-fill>Create Workspace</button></div></div>`;
    } else {
      html = full
        ? `<div class="ck-ef-pane">${stats(true)}<div class="ck-quizzes">${qcard() + qcard() + qcard()}</div></div>`
        : `<div class="ck-ef-pane">${stats(false)}${qcard(true)}<div class="ck-empty"><h3>Nothing to answer here… yet ${icon("i-quiz")}</h3><p>Create quizzes from your uploaded materials, notes, or custom questions to start testing your knowledge.</p><p>Clark helps you generate questions in seconds, organized, trackable, and tailored to what you're learning. You'll be able to revisit them, share with friends, or build streaks by taking them daily.</p><p>Use the <span class="ck-chip">@quiz</span> tag or “create” button in chat to generate one instantly.</p><button type="button" class="ck-cta" data-fill>Create a Quiz</button></div></div>`;
    }
    stage.innerHTML = html;
    screenTabs.forEach((b) => { const on = b.dataset.screen === st.screen; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
    stateBtns.forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.state === "full") === full)));
    if (animate && full && !S.reduce) {
      $$(".ck-folder, .ck-qcard", stage).forEach((el, j) => { el.classList.add("ck-drop"); arrive(el, 40 + j * 45); });
    }
  };
  stage.addEventListener("click", (e) => {
    if (e.target.closest("[data-fill]")) { st.full[st.screen] = true; render(true); const f = $("[data-star], .ck-qcard", stage); return; }
    const s = e.target.closest("[data-star]");
    if (s) { const n = s.dataset.star; if (starred.has(n)) starred.delete(n); else starred.add(n); s.setAttribute("aria-pressed", String(starred.has(n))); }
  });
  screenTabs.forEach((b, j) => {
    b.addEventListener("click", () => { st.screen = b.dataset.screen; render(); });
    b.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const n = screenTabs[(j + 1) % screenTabs.length];
      st.screen = n.dataset.screen; render(); n.focus();
    });
  });
  stateBtns.forEach((b) => b.addEventListener("click", () => { st.full[st.screen] = b.dataset.state === "full"; render(st.full[st.screen]); }));
  document.addEventListener("ck:ef", (e) => { st.screen = e.detail.screen; st.full[st.screen] = !!e.detail.full; render(true); });
  render();
}

/* =====================================================================
   Fig. 8: the streak. clark-card-streak.png: 31 squares, 10 to a row, #262626 on a
   #404040 card. The landing card (Clark Main Landing Page.pdf) lays the same 31
   out 7 to a row, the last 3 pushed to the right.
   ===================================================================== */
function streakFig() {
  const fig = $("#streak-fig");
  if (!fig) return;
  const grid = $("[data-st-grid]", fig), lgrid = $("[data-st-lgrid]", fig);
  const label = $("[data-st-label]", fig), sub = $("[data-st-sub]", fig);
  const lbig = $("[data-st-lbig]", fig), lsmall = $("[data-st-lsmall]", fig);
  const SR = (k) => $(`[data-sr="${k}"]`, fig);
  grid.innerHTML = Array.from({ length: 31 }, (_, j) => `<button type="button" class="ck-day" data-day="${j + 1}" aria-pressed="false" tabindex="${j ? -1 : 0}" aria-label="Day ${j + 1}"><span class="k" aria-hidden="true"></span></button>`).join("");
  const cells = $$(".ck-day", grid);
  // the landing card: 4 rows of 7, then 4 blanks and days 29 to 31
  lgrid.innerHTML = Array.from({ length: 35 }, (_, j) => (j >= 28 && j < 32 ? `<i class="pad"></i>` : `<i data-l="${j < 28 ? j + 1 : j - 3}"></i>`)).join("");
  const lcells = $$("[data-l]", lgrid);
  let anim = null;

  const paint = (shown) => {
    const { n, latest, gap, run } = streak.count();
    const counted = new Map(run.map((d, j) => [d, j + 1]));
    const k = shown == null ? n : shown;
    cells.forEach((c) => {
      const d = +c.dataset.day, on = streak.days.has(d), idx = counted.get(d);
      c.setAttribute("aria-pressed", String(on));
      c.classList.toggle("is-old", on && !idx);
      c.classList.toggle("is-gap", !!latest && d === gap && gap >= 1);
      const showK = idx && idx <= k;
      c.classList.toggle("is-walk", !!(idx && idx === k && shown != null && shown < n));
      $(".k", c).textContent = showK ? idx : "";
      c.setAttribute("aria-label", `Day ${d}${on ? ", studied" : ""}${idx ? `, counted ${idx}` : on ? ", before the gap" : ""}`);
    });
    if (k === 0) { label.textContent = "No streak yet."; sub.textContent = "Study today to ignite your first flame!"; sub.classList.add("is-empty"); }
    else { label.textContent = `${k}-day streak!!`; sub.textContent = "View Full Stats"; sub.classList.remove("is-empty"); }
    // the landing page's voice: padded, held up against the next 10
    const next10 = (Math.floor(k / 10) + 1) * 10;
    lbig.textContent = `⚡${pad2(k)} Days In!`;
    lsmall.textContent = (k > 0 && k * 2 === next10 ? `Halfway to ${next10}! ` : "") + "Stay consistent! 💪";
    lcells.forEach((c) => c.classList.toggle("on", streak.days.has(+c.dataset.l)));
    SR("latest").textContent = latest ? pad2(latest) : "none";
    SR("walk").textContent = run.length ? run.slice(0, 7).map(pad2).join(" ") + (run.length > 7 ? " …" : "") : "none";
    SR("gap").textContent = !latest ? "nothing studied" : gap >= 1 ? `day ${pad2(gap)}, not studied` : "start of month";
    SR("n").textContent = k;
  };
  const walk = () => {
    if (anim) { clearInterval(anim); anim = null; }
    const { n } = streak.count();
    if (S.reduce || n <= 1) { paint(); return; }
    let k = 0;
    paint(0);
    anim = setInterval(() => { k++; paint(k); if (k >= n) { clearInterval(anim); anim = null; paint(); } }, 70);
  };
  grid.addEventListener("click", (e) => {
    const c = e.target.closest("[data-day]"); if (!c) return;
    const d = +c.dataset.day, days = new Set(streak.days);
    if (days.has(d)) days.delete(d); else days.add(d);
    streak.set(days);
  });
  grid.addEventListener("keydown", (e) => {
    const c = e.target.closest("[data-day]"); if (!c) return;
    const d = +c.dataset.day;
    const m = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 10, ArrowUp: -10 }[e.key];
    if (!m) return;
    e.preventDefault();
    const nd = Math.min(31, Math.max(1, d + m));
    cells.forEach((x) => (x.tabIndex = -1));
    cells[nd - 1].tabIndex = 0; cells[nd - 1].focus();
  });
  $("[data-st-clear]", fig).addEventListener("click", () => streak.set([]));
  $("[data-st-reset]", fig).addEventListener("click", () => streak.set([1, 2, 3, 4, 5]));
  streak.subs.add(walk);
  paint();
}

/* =====================================================================
   boot: each figure builds the first time it comes near the screen
   ===================================================================== */
const lazy = (sel, fn) => { const el = $(sel); if (!el) return; let done = false; S.onVisible(el, () => { if (!done) { done = true; fn(); } }, null, "400px 0px"); };

const hero = $("#badge-fig");
if (hero) rigFigure(hero, "hero");
lazy("#home-fig", homeKey);
lazy("#composer-fig", composer);
lazy("#onb-fig", onboarding);
lazy("#flashcards-fig", flashcards);
lazy("#ef-fig", emptyFull);
lazy("#streak-fig", streakFig);
lazy("#xray-fig", () => {
  const fig = $("#xray-fig");
  const api = rigFigure(fig, "xray");
  const r = $("[data-damp]", fig), out = $("[data-damp-out]", fig);
  r.addEventListener("input", () => { const v = +r.value; out.textContent = v.toFixed(4); api.setDamp(v); });
  $("[data-flick]", fig).addEventListener("click", () => api.flick());
});
