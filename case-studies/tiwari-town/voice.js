/* Fig. 6: the narration.

     ui/Narration.ts:79-366         the queue, the phases, the timing (ported below as Narration)
     world/NarrationScript.ts       the town's trigger circles and their lines, the ambient pool,
                                    and the welcome cue main.ts:237 says on arrival
     player/PlayerController.ts:19  WALK_SPEED, for the walk */
import { heightAt, surfaceColor, SEA_LEVEL, WATER, DEEP, makeRng, clamp, WORLD_SEED } from "./world.js";
import { Study, s, txt, fitSvg, readout } from "./util.js";

/* ---------------- Narration.ts ---------------- */
const FADE_IN = 0.34, FADE_OUT = 0.42, GAP = 0.24, MAX_QUEUE = 4;
const dwellFor = (text) => clamp(1.5 + text.length / 14, 2.2, 7.5);
const toLine = (spec) => (typeof spec === "string" ? { text: spec } : spec);

class Narration {
  constructor(seed = WORLD_SEED) {
    this.rng = makeRng(seed ^ 0x5ca1ab1e);
    this.triggers = []; this.states = new Map();
    this.queue = []; this.current = null; this.phase = "idle"; this.phaseT = 0; this.gapT = 0; this.alpha = 0;
    this.ambient = []; this.ambientBag = []; this.ambientOpts = { minSilence: 26, minDistance: 45 };
    this.silence = 0; this.walked = 0; this.lastPos = null;
    this.onStart = null;
    this.dropped = 0; // counted here for the figure; the game doesn't keep a tally
  }
  addTriggers(ts) { for (const t of ts) { this.triggers.push(t); this.states.set(t.id, { spent: false, inside: false, cool: 0 }); } }
  setAmbient(lines) { this.ambient = lines.map(toLine); this.ambientBag = []; }
  say(spec, opts = {}) {
    const specs = Array.isArray(spec) ? spec : [spec];
    if (opts.interrupt) { this.queue = []; this.cut(); }
    for (const sp of specs) {
      const line = toLine(sp);
      if (this.current?.text === line.text || this.queue.some((q) => q.text === line.text)) continue;
      if (this.queue.length >= MAX_QUEUE) { this.dropped++; if (!line.priority) continue; this.queue.shift(); }
      this.queue.push(line);
    }
    this.queue.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    this.silence = 0;
  }
  cut() { if (this.phase === "in" || this.phase === "hold") { this.phase = "out"; this.phaseT = (1 - this.alpha) * FADE_OUT; } }
  get isSpeaking() { return this.phase !== "idle"; }
  update(p, dt) {
    const step = Math.min(dt, 0.05);
    this.trackMovement(p, step); this.scanTriggers(p, step); this.advance(step);
  }
  trackMovement(p, dt) {
    if (this.lastPos) this.walked += Math.hypot(p.x - this.lastPos.x, p.z - this.lastPos.z);
    this.lastPos = { x: p.x, z: p.z };
    if (this.isSpeaking || this.queue.length) { this.silence = 0; return; }
    this.silence += dt;
    if (this.ambient.length && this.silence >= this.ambientOpts.minSilence && this.walked >= this.ambientOpts.minDistance) {
      this.walked = 0; this.say(this.drawAmbient());
    }
  }
  drawAmbient() {
    if (!this.ambientBag.length) {
      this.ambientBag = this.ambient.map((_, i) => i);
      for (let i = this.ambientBag.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); const t = this.ambientBag[i]; this.ambientBag[i] = this.ambientBag[j]; this.ambientBag[j] = t; }
    }
    return this.ambient[this.ambientBag.pop()];
  }
  scanTriggers(p, dt) {
    for (const t of this.triggers) {
      const st = this.states.get(t.id);
      if (!st || st.spent) continue;
      if (st.cool > 0) st.cool -= dt;
      const inside = (p.x - t.x) ** 2 + (p.z - t.z) ** 2 <= t.radius * t.radius;
      if (inside && !st.inside && st.cool <= 0) {
        this.say(t.lines);
        if (t.once ?? true) st.spent = true; else st.cool = t.cooldown ?? 30;
      }
      st.inside = inside;
    }
  }
  advance(dt) {
    switch (this.phase) {
      case "idle": {
        if (this.gapT > 0) { this.gapT -= dt; return; }
        const next = this.queue.shift();
        if (!next) return;
        this.current = next; this.phase = "in"; this.phaseT = 0;
        this.onStart && this.onStart(next);
        break;
      }
      case "in": this.phaseT += dt; if (this.phaseT >= FADE_IN) { this.phase = "hold"; this.phaseT = 0; } break;
      case "hold": {
        this.phaseT += dt;
        const dwell = this.current?.dwell ?? dwellFor(this.current?.text ?? "");
        const pressure = this.queue.length >= 2 ? 0.6 : 1;
        if (this.phaseT >= dwell * pressure) { this.phase = "out"; this.phaseT = 0; }
        break;
      }
      case "out": this.phaseT += dt; if (this.phaseT >= FADE_OUT) { this.phase = "idle"; this.phaseT = 0; this.current = null; this.gapT = GAP; } break;
    }
    this.alpha = this.phase === "in" ? clamp(this.phaseT / FADE_IN, 0, 1) : this.phase === "out" ? clamp(1 - this.phaseT / FADE_OUT, 0, 1) : this.phase === "hold" ? 1 : 0;
  }
}

/* ---------------- NarrationScript.ts: the town's circles ---------------- */
const TRIGGERS = [
  { id: "spawn", x: 0, z: 8, radius: 7, lines: [{ text: "Okay. We are recording.", priority: 1 }, "Hi. Good morning. I have absolutely no idea where I am."] },
  { id: "first_steps", x: 0, z: 2, radius: 6, lines: ["Walking. This is the walking part of the video.", { text: "Riveting stuff.", tone: "aside" }] },
  { id: "town_square", x: 0, z: -4, radius: 9, lines: ["So this is the town. Small. Extremely small.", "I have counted the houses. There are not many houses."] },
  { id: "well", x: 0, z: 0, radius: 4, lines: [{ text: "Made a wish. Not telling.", tone: "aside" }] },
  { id: "momo_shop", x: 0, z: 12.4, radius: 6, lines: ["A momo shop. Of course there is a momo shop.", { text: "Whoever built this knew exactly what they were doing.", tone: "aside" }] },
  { id: "yarn", x: -10, z: -6, radius: 6, lines: ["Is that yarn. That is yarn."] },
  { id: "town_return", x: 0, z: 0, radius: 14, once: false, cooldown: 90, lines: [{ text: "Back in town. It is still small.", tone: "aside" }] },
];
const AMBIENT = [
  { text: "Still walking. Great content.", tone: "aside" },
  { text: "I will edit this bit out. I will not edit this bit out.", tone: "aside" },
  { text: "This is where the music would go.", tone: "aside" },
  { text: "The dog has thoughts. The dog is not sharing them.", tone: "aside" },
  { text: "B-roll. This is what B-roll is.", tone: "aside" },
  { text: "Note to self: fewer establishing shots.", tone: "aside" },
];
const WELCOME = [{ text: "Willkommen. Welcome. स्वागतम्.", tone: "title", priority: 3, dwell: 5 }];
/* where each circle's name goes, so the crowded middle of town stays legible */
const LABEL_AT = {
  spawn: [7.4, 6.9, "start"], first_steps: [-6.4, 2.9, "end"], town_square: [6.6, -11, "start"], well: [4.3, -1.8, "start"],
  momo_shop: [5.2, 18.6, "start"], yarn: [-10, -12.5, "middle"], town_return: [-10.2, 11.6, "end"],
};

const WALK_SPEED = 4.6;
const REGION = { x0: -22, x1: 18, z0: -18, z1: 27 }; // 40 m by 45 m, the middle of town, with room under it for the caption
const SPAWN = { x: 0, z: 4.5 }; // where the world puts her on arrival (main.ts)
const PATH = [[0, 4.5], [0, 9.6], [0, 3], [0, -8], [-6, -10], [-11, -4], [-17, 4], [-12, 16], [-2, 17], [8, 8]];

export function mountVoice(fig) {
  const plate = fig.querySelector(".vc-plate");
  const canvas = fig.querySelector(".vc-ground");
  const svg = fig.querySelector(".vc-svg");
  const walker = fig.querySelector(".vc-walker");
  const cap = fig.querySelector(".vc-cap");
  const plotSvg = fig.querySelector(".vc-plot");
  const queueEl = fig.querySelector(".vc-queue");
  const walkBtn = fig.querySelector(".vc-walk");
  const resetBtn = fig.querySelector(".vc-reset");
  const r = readout(fig);
  const tintInk = getComputedStyle(document.body).getPropertyValue("--tint-ink").trim() || "#2a6db0";
  const ink3 = "#9a958b", rule = "#e0dbd0";

  /* ---------- ground: the map's bake, closer in ---------- */
  const PX = 4; // samples per metre
  const BW = (REGION.x1 - REGION.x0) * PX, BH = (REGION.z1 - REGION.z0) * PX;
  canvas.width = BW; canvas.height = BH;
  (function bake() {
    const ctx = canvas.getContext("2d"), img = ctx.createImageData(BW, BH), c = [0, 0, 0];
    const H = new Float32Array((BW + 2) * (BH + 2));
    for (let j = -1; j <= BH; j++) for (let i = -1; i <= BW; i++) H[(j + 1) * (BW + 2) + i + 1] = heightAt(REGION.x0 + (i + 0.5) / PX, REGION.z0 + (j + 0.5) / PX);
    const step = 1 / PX, lx = -0.52, ly = 0.74, lz = -0.43;
    for (let j = 0; j < BH; j++) for (let i = 0; i < BW; i++) {
      const k = (j + 1) * (BW + 2) + i + 1, h = H[k];
      const nx = H[k - 1] - H[k + 1], ny = 2 * step, nz = H[k - (BW + 2)] - H[k + (BW + 2)];
      const inv = 1 / Math.hypot(nx, ny, nz), steep = 1 - Math.min(1, Math.max(0, ny * inv));
      const x = REGION.x0 + (i + 0.5) / PX, z = REGION.z0 + (j + 0.5) / PX;
      surfaceColor(x, z, h, steep, c);
      let shade = 0.74 + 0.46 * ((nx * lx + ny * ly + nz * lz) * inv);
      if (h < SEA_LEVEL) { const t = Math.min(1, (SEA_LEVEL - h) / 7); c[0] = WATER[0] + (DEEP[0] - WATER[0]) * t; c[1] = WATER[1] + (DEEP[1] - WATER[1]) * t; c[2] = WATER[2] + (DEEP[2] - WATER[2]) * t; shade = 1; }
      const o = (j * BW + i) * 4;
      img.data[o] = Math.min(255, c[0] * 255 * shade); img.data[o + 1] = Math.min(255, c[1] * 255 * shade); img.data[o + 2] = Math.min(255, c[2] * 255 * shade); img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  })();

  /* ---------- circles ---------- */
  svg.setAttribute("viewBox", `${REGION.x0} ${REGION.z0} ${REGION.x1 - REGION.x0} ${REGION.z1 - REGION.z0}`);
  const circ = {};
  for (const t of TRIGGERS) {
    const g = s("g", {}, svg);
    const c = s("circle", { cx: t.x, cy: t.z, r: t.radius, fill: "rgba(253,252,249,0.1)", stroke: "#fdfcf9", "stroke-width": 0.22, "stroke-dasharray": t.once === false ? "0.9 0.7" : null }, g);
    const [lx, lz, anchor] = LABEL_AT[t.id];
    const l = txt(g, lx, lz, t.id, { "text-anchor": anchor, fill: "#fdfcf9", "font-size": 1.25, "font-weight": 600, "paint-order": "stroke", stroke: "rgba(10,12,18,0.7)", "stroke-width": 0.22, "stroke-linejoin": "round", style: "font-family: var(--mono)" });
    circ[t.id] = { c, l };
  }

  /* ---------- the system ---------- */
  let nar, pos, heading = Math.PI, history, clockT, starts;
  function reset() {
    nar = new Narration();
    nar.addTriggers(TRIGGERS);
    nar.setAmbient(AMBIENT);
    nar.onStart = (line) => starts.push({ t: clockT, text: line.text });
    pos = { ...SPAWN };
    history = []; clockT = 0; starts = [];
    walking = null;
    // main.ts:237, the world's opening line
    nar.say(WELCOME);
    placeWalker();
    paint();
  }
  function placeWalker() {
    walker.style.left = ((pos.x - REGION.x0) / (REGION.x1 - REGION.x0)) * 100 + "%";
    walker.style.top = ((pos.z - REGION.z0) / (REGION.z1 - REGION.z0)) * 100 + "%";
    walker.style.setProperty("--hd", `${heading}rad`);
  }

  function paint() {
    // Narration.ts:352-361: opacity, and a 9px rise as it lands
    const a = nar.alpha;
    if (nar.current) { cap.textContent = nar.current.text; cap.dataset.tone = nar.current.tone ?? "say"; }
    cap.style.opacity = a.toFixed(3);
    cap.style.visibility = a > 0.001 ? "visible" : "hidden";
    cap.style.transform = `translateY(${((1 - a) * 9).toFixed(2)}px)`;
    for (const t of TRIGGERS) {
      const st = nar.states.get(t.id), o = circ[t.id];
      const inside = st.inside;
      o.c.setAttribute("fill", st.spent ? "rgba(10,12,18,0.13)" : "rgba(253,252,249,0.1)");
      o.c.setAttribute("stroke", inside ? "#1f5f9e" : st.spent ? "rgba(253,252,249,0.5)" : "#fdfcf9");
      o.c.setAttribute("stroke-width", inside ? 0.45 : 0.22);
    }
    // the queue: what's showing, then what's waiting
    let html = nar.current ? `<li class="is-now">${esc(nar.current.text)}</li>` : `<li class="is-empty">Nothing showing</li>`;
    for (let i = 0; i < MAX_QUEUE; i++) html += nar.queue[i] ? `<li>${esc(nar.queue[i].text)}</li>` : `<li class="is-empty">empty slot</li>`;
    if (queueEl.dataset.h !== html) { queueEl.innerHTML = html; queueEl.dataset.h = html; }
    r("phase", nar.phase);
    r("alpha", a.toFixed(2));
    r("queued", `${nar.queue.length} of ${MAX_QUEUE}`);
    r("dropped", String(nar.dropped));
    r("silence", `${nar.silence.toFixed(1)} s`);
    r("walked", `${Math.round(nar.walked)} m`);
    drawPlot();
  }
  const esc = (t) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

  /* ---------- the plot: opacity over the last 12 s ---------- */
  const SPAN = 12;
  let P = null;
  fitSvg(plotSvg, () => 150, (w, h) => {
    plotSvg.textContent = "";
    const L = 26, R = w - 4, T = 30, B = h - 20;
    txt(plotSvg, 0, 12, "Caption opacity, last 12 seconds", { class: "ann", fill: "#1d1b18" });
    s("line", { x1: L, x2: R, y1: B, y2: B, stroke: rule }, plotSvg);
    s("line", { x1: L, x2: R, y1: T, y2: T, stroke: rule, "stroke-dasharray": "2 3" }, plotSvg);
    txt(plotSvg, L - 6, T + 4, "1", { class: "ann", "text-anchor": "end", "font-size": 11 });
    txt(plotSvg, L - 6, B, "0", { class: "ann", "text-anchor": "end", "font-size": 11 });
    txt(plotSvg, R, B + 14, "now", { class: "ann", "text-anchor": "end", "font-size": 11 });
    txt(plotSvg, L, B + 14, "−12 s", { class: "ann", "font-size": 11 });
    const area = s("path", { fill: "rgba(74,159,224,0.22)", stroke: tintInk, "stroke-width": 1.5, "stroke-linejoin": "round" }, plotSvg);
    const marks = s("g", {}, plotSvg);
    P = { L, R, T, B, area, marks };
  });
  function drawPlot() {
    if (!P) return;
    const { L, R, T, B, area, marks } = P;
    const x = (t) => R - ((clockT - t) / SPAN) * (R - L);
    let d = `M${R} ${B}`;
    for (let i = history.length - 1; i >= 0; i--) {
      const hpt = history[i];
      if (clockT - hpt.t > SPAN) { d += ` L${L} ${B - hpt.a * (B - T)}`; break; }
      d += ` L${x(hpt.t).toFixed(1)} ${(B - hpt.a * (B - T)).toFixed(1)}`;
    }
    d += ` L${history.length && clockT - history[0].t > SPAN ? L : x(history[0]?.t ?? clockT).toFixed(1)} ${B} Z`;
    area.setAttribute("d", d);
    marks.textContent = "";
    let lastEnd = -1e9;
    for (const st of starts) {
      if (clockT - st.t > SPAN) continue;
      const sx = x(st.t);
      s("line", { x1: sx, x2: sx, y1: T - 4, y2: B, stroke: ink3, "stroke-width": 1 }, marks);
      const words = st.text.split(" ").slice(0, 3).join(" ");
      const label = words.length > 18 ? words.slice(0, 17) + "…" : words;
      const tw = label.length * 6.1;
      // pinned to the right edge when it would run off it; skipped when it would sit on the last one
      const x0 = Math.min(sx + 3, R - tw);
      if (x0 < lastEnd + 8) continue;
      txt(marks, x0, T - 7, label, { class: "ann", "font-size": 11 });
      lastEnd = x0 + tw;
    }
  }

  /* ---------- moving her ---------- */
  let walking = null, lastStep = 0;
  function moveTo(x, z) {
    x = clamp(x, REGION.x0 + 1, REGION.x1 - 1); z = clamp(z, REGION.z0 + 1, REGION.z1 - 1);
    const dx = x - pos.x, dz = z - pos.z;
    if (Math.hypot(dx, dz) > 0.05) heading = Math.atan2(dx, -dz);
    pos.x = x; pos.z = z;
    placeWalker();
    wake();
  }
  const toWorld = (e) => {
    const rc = plate.getBoundingClientRect();
    return { x: REGION.x0 + ((e.clientX - rc.left) / rc.width) * (REGION.x1 - REGION.x0), z: REGION.z0 + ((e.clientY - rc.top) / rc.height) * (REGION.z1 - REGION.z0) };
  };
  let dragging = false;
  walker.addEventListener("pointerdown", (e) => { dragging = true; walking = null; walker.setPointerCapture(e.pointerId); e.preventDefault(); });
  walker.addEventListener("pointermove", (e) => { if (!dragging) return; const p = toWorld(e); moveTo(p.x, p.z); });
  const end = () => { dragging = false; };
  walker.addEventListener("pointerup", end); walker.addEventListener("pointercancel", end);
  plate.addEventListener("pointerdown", (e) => { if (e.target === walker) return; walking = { pts: [[pos.x, pos.z], (() => { const p = toWorld(e); return [p.x, p.z]; })()], i: 0 }; wake(); });
  walker.addEventListener("keydown", (e) => {
    const m = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
    if (!m) return;
    e.preventDefault(); walking = null;
    moveTo(pos.x + m[0] * 1.2, pos.z + m[1] * 1.2);
  });
  walkBtn.addEventListener("click", () => { walking = { pts: PATH.map((p) => p.slice()), i: 0 }; pos = { x: PATH[0][0], z: PATH[0][1] }; placeWalker(); wake(); });
  resetBtn.addEventListener("click", () => { reset(); wake(); });

  function stepWalk(dt) {
    if (!walking) return;
    const tgt = walking.pts[walking.i + 1];
    if (!tgt) { walking = null; return; }
    const dx = tgt[0] - pos.x, dz = tgt[1] - pos.z, d = Math.hypot(dx, dz), stepLen = WALK_SPEED * dt;
    if (d <= stepLen) { moveTo(tgt[0], tgt[1]); walking.i++; }
    else moveTo(pos.x + (dx / d) * stepLen, pos.z + (dz / d) * stepLen);
  }

  /* ---------- the loop ---------- */
  let stop = null, visible = false;
  const loop = (t, dt) => {
    clockT += dt;
    stepWalk(dt);
    nar.update(pos, dt);
    history.push({ t: clockT, a: nar.alpha });
    while (history.length && clockT - history[0].t > SPAN + 1) history.shift();
    paint();
    // rest when there's nothing left to say and nobody is moving
    if (!walking && !dragging && nar.phase === "idle" && !nar.queue.length && nar.gapT <= 0) { idleFor += dt; if (idleFor > 2 && (Study.reduce || nar.silence > 30)) { stop = null; return false; } } else idleFor = 0;
  };
  let idleFor = 0;
  function wake() { idleFor = 0; if (visible && !stop) stop = Study.raf(loop); }

  reset();
  return {
    start() { visible = true; if (!Study.reduce) wake(); },
    stop() { visible = false; stop && stop(); stop = null; },
  };
}
