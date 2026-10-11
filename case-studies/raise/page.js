/* Cohort / Raise case study: the live figures.

   Every figure ports code from the investor page, Cohort/raise/js/raise.js,
   with its constants unchanged. Line references sit next to each port.
   GSAP isn't loaded here: the eases and quickTo are written out below with
   GSAP 3's own formulas, so the plots and the motion use the same maths.
*/

const S = window.Study || {
  reduce: matchMedia("(prefers-reduced-motion: reduce)").matches,
  hover: matchMedia("(hover: hover)").matches,
  onVisible: (el, a) => { a && a(); return () => {}; },
  raf: (fn) => { const f = (t) => { if (fn(t, 1 / 60) !== false) requestAnimationFrame(f); }; requestAnimationFrame(f); },
};
const REDUCE = S.reduce;
const dprOf = () => Math.min(2, window.devicePixelRatio || 1);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const NS = "http://www.w3.org/2000/svg";
const now = () => performance.now() / 1000;
const svg = (tag, attrs = {}, parent) => {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(el);
  return el;
};
const fmt = (v, d = 1) => (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d);

/* GSAP 3 eases (gsap-core: PowerN has exponent N + 1; Back uses an overshoot). */
const E = {
  linear: (p) => p,
  p1out: (p) => 1 - (1 - p) ** 2,
  p2in: (p) => p ** 3,
  p2out: (p) => 1 - (1 - p) ** 3,
  p2io: (p) => (p < 0.5 ? (2 * p) ** 3 / 2 : 1 - (2 * (1 - p)) ** 3 / 2),
  p3out: (p) => 1 - (1 - p) ** 4,
  p3io: (p) => (p < 0.5 ? (2 * p) ** 4 / 2 : 1 - (2 * (1 - p)) ** 4 / 2),
  backOut: (s = 1.70158) => (p) => { const q = 1 - p; return 1 - (q ? q * q * ((s + 1) * q - s) : 0); },
};

/* A tween on the shared loop. Returns { kill }. */
function tween({ from = 0, to = 1, dur, delay = 0, ease = E.linear, update, done }) {
  const t0 = now() + delay;
  let dead = false;
  S.raf(() => {
    if (dead) return false;
    const t = now();
    if (t < t0) return true;
    const p = dur > 0 ? clamp((t - t0) / dur, 0, 1) : 1;
    update(lerp(from, to, ease(p)), p);
    if (p >= 1) { dead = true; done && done(); return false; }
    return true;
  });
  return { kill() { dead = true; } };
}

/* gsap.quickTo: every call restarts a tween from the current value to the new target. */
function quickTo(get, set, dur, ease) {
  let tw = null;
  return (target) => { tw && tw.kill(); tw = tween({ from: get(), to: target, dur, ease, update: set }); };
}

/* A DOM sprite with gsap-style .set and .to (overwrite: auto). */
function sprite(el) {
  const st = { x: 0, y: 0, s: 1, r: 0, o: 0 };
  const tws = {};
  const render = () => {
    el.style.transform = `translate(${st.x.toFixed(2)}px,${st.y.toFixed(2)}px) rotate(${st.r.toFixed(2)}deg) scale(${st.s.toFixed(4)})`;
    el.style.opacity = clamp(st.o, 0, 1).toFixed(3);
  };
  return {
    el, st,
    set(p) { for (const k in p) { tws[k] && tws[k].kill(); delete tws[k]; st[k] = p[k]; } render(); },
    to(p, dur, ease, delay = 0, done) {
      let first = true;
      for (const k in p) {
        tws[k] && tws[k].kill();
        const from = st[k];
        tws[k] = tween({ from, to: p[k], dur, delay, ease, update: (v) => { st[k] = v; render(); }, done: first ? done : undefined });
        first = false;
      }
    },
  };
}

/* Plots are drawn at their real pixel size, so their labels never shrink. */
function sized(el, h, draw) {
  let w = 0;
  const go = () => {
    const nw = Math.round(el.getBoundingClientRect().width);
    if (!nw || nw === w) return;
    w = nw;
    el.setAttribute("viewBox", `0 0 ${w} ${h}`);
    el.setAttribute("height", h);
    draw(w, h);
  };
  new ResizeObserver(go).observe(el);
  go();
  return () => w;
}
const txt = (parent, x, y, s, cls = "rz-lbl", anchor = "start") => {
  const t = svg("text", { x, y, class: cls, "text-anchor": anchor }, parent);
  t.textContent = s;
  return t;
};
const pathFrom = (pts) => pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");

/* ------------------------------------------------------------------
   Shared copy, from the two pages
   ------------------------------------------------------------------ */
const HOUR = new Date().getHours();
// raise.js:39-44, picked by the reader's clock
const INV_MORNING = ["Good morning", "Buenos días", "Bonjour", "Guten Morgen", "Buon giorno", "Bom dia", "おはようございます", "좋은 아침", "صباح الخير", "Доброе утро", "Habari za asubuhi", "Günaydın"];
const INV_AFTERNOON = ["Good afternoon", "Buenas tardes", "Bon après-midi", "Guten Tag", "Buon pomeriggio", "Boa tarde", "こんにちは", "안녕하세요", "مرحبا", "Добрый день", "Haujambo", "İyi günler"];
const INV_EVENING = ["Good evening", "Buenas noches", "Bonsoir", "Guten Abend", "Buona sera", "Boa noite", "こんばんは", "좋은 저녁", "مساء الخير", "Добрый вечер", "Habari za jioni", "İyi akşamlar"];
const INV_HELLO = HOUR >= 5 && HOUR < 12 ? INV_MORNING : HOUR >= 12 && HOUR < 17 ? INV_AFTERNOON : INV_EVENING;
// Cohort/js/main.js:166-169, the student page, any hour
const STU_HELLO = ["Hello", "¡Hola!", "Bonjour", "Ciao", "Hallo", "Olá", "Привет", "مرحبا", "こんにちは", "안녕하세요", "नमस्ते", "नमस्कार", "Merhaba", "你好", "Sawubona", "Salut"];
// raise.js:72
const STATS = ["2,083 STUDENTS WAITING", "ZERO PAID ACQUISITION", "FALL '26 LAUNCH"];
// Cohort/js/main.js:1083-1086
const VIBE_LABEL = HOUR >= 5 && HOUR < 10 ? "GOOD MORNING" : HOUR >= 10 && HOUR < 17 ? "GOOD DAY" : HOUR >= 17 && HOUR < 21 ? "GOOD EVENING" : "GOOD NIGHT";
// raise.js:76
const clockText = () => {
  const d = new Date(), h = d.getHours(), m = d.getMinutes();
  return `${String(h % 12 || 12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

/* One rotating label, the way raise.js does it (49-58 for the greeting,
   86 for the corner): tween out on power2.in, change the words, tween in
   on power2.out. Driven by a clock you pass in, so a figure can pause. */
class Swap {
  constructor(el, { list, out, inn, dy, max }) {
    Object.assign(this, { el, list, out, inn, dy, max });
    this.i = 0; this.a = null;
    el.textContent = list[0];
    this.paint(max, 0);
  }
  paint(o, y) { this.el.style.opacity = o.toFixed(3); this.el.style.transform = y ? `translateY(${y.toFixed(2)}px)` : ""; }
  go(t) { if (this.a) this.finish(); this.a = { t0: t, to: (this.i + 1) % this.list.length }; }
  jump() { if (this.a) this.finish(); this.i = (this.i + 1) % this.list.length; this.el.textContent = this.list[this.i]; }
  finish() { this.i = this.a.to; this.el.textContent = this.list[this.i]; this.paint(this.max, 0); this.a = null; }
  tick(t) {
    const a = this.a;
    if (!a) return;
    const tau = t - a.t0;
    if (tau < this.out) { const e = E.p2in(tau / this.out); this.paint(this.max * (1 - e), -this.dy * e); }
    else if (tau < this.out + this.inn) {
      if (this.el.textContent !== this.list[a.to]) this.el.textContent = this.list[a.to];
      const e = E.p2out((tau - this.out) / this.inn);
      this.paint(this.max * e, this.dy * (1 - e));
    } else this.finish();
  }
  setList(list) { this.a = null; this.list = list; this.i = 0; this.el.textContent = list[0]; this.paint(this.max, 0); }
  opacityAt(tau) { // the same curve as tick(), as a pure function, for plots
    if (tau < this.out) return this.max * (1 - E.p2in(tau / this.out));
    if (tau < this.out + this.inn) return this.max * E.p2out((tau - this.out) / this.inn);
    return this.max;
  }
}
const CORNER = { out: 0.2, inn: 0.3, dy: 4, max: 0.7 }; // raise.js:86
const GREET_INV = { out: 0.13, inn: 0.18, dy: 5, max: 1 }; // raise.js:52-56
const GREET_STU = { out: 0.14, inn: 0.2, dy: 6, max: 1 }; // main.js:181-185

/* ==================================================================
   Fig. 1: both letters, live
   ================================================================== */
function letterFig() {
  const root = document.getElementById("letter");
  if (!root) return;
  const letter = root.querySelector(".rz-letter");
  const timeEl = root.querySelector(".rz-time");
  const statEl = root.querySelector(".rz-stat");
  const helloEl = root.querySelector(".rz-hello");
  const fly = root.querySelector(".rz-fly");
  const copies = [...root.querySelectorAll(".rz-copy")];
  const tabs = [...root.querySelectorAll(".tabs button")];
  const play = root.querySelector(".rz-play");

  let reader = "investor";
  const stat = new Swap(statEl, { list: STATS, ...CORNER });
  const hello = new Swap(helloEl, { list: INV_HELLO, ...GREET_INV });
  timeEl.textContent = clockText();

  // the clock: setInterval(rotateStat, 4000) and setInterval(cycle, 5000), on a clock that pauses off screen
  let T = 0, nextStat = 4, nextHello = 5, on = false, running = false, lastMin = 0, playing = !REDUCE;
  const loop = (t, dt) => {
    if (!on) { running = false; return false; }
    T += dt;
    if (playing) {
      if (reader === "investor" && T >= nextStat) { stat.go(T); nextStat += 4; }
      if (T >= nextHello) { hello.go(T); nextHello += 5; }
    }
    stat.tick(T); hello.tick(T);
    if (T - lastMin > 5) { lastMin = T; timeEl.textContent = clockText(); }
  };
  const start = () => { on = true; if (!running) { running = true; S.raf(loop); } };
  S.onVisible(root, start, () => { on = false; });

  if (REDUCE) {
    play.hidden = false;
    play.addEventListener("click", () => { playing = !playing; play.textContent = playing ? "Pause" : "Play"; nextStat = T + 4; nextHello = T + 5; });
  }

  // tap the greeting to change it (raise.js:61-62)
  const cycleHello = () => { if (REDUCE && !playing) hello.jump(); else hello.go(T); };
  helloEl.addEventListener("click", cycleHello);
  helloEl.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cycleHello(); } });

  // the two readers
  const setReader = (r) => {
    if (r === reader) return;
    reader = r;
    closeAll();
    letter.dataset.reader = r;
    tabs.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.reader === r)));
    copies.forEach((c) => {
      const off = c.dataset.for !== r;
      c.setAttribute("aria-hidden", String(off));
      c.querySelectorAll("button, [tabindex]").forEach((b) => b.setAttribute("tabindex", off ? "-1" : "0"));
    });
    if (r === "investor") { stat.setList(STATS); hello.setList(INV_HELLO); Object.assign(hello, GREET_INV); }
    else { stat.setList([VIBE_LABEL]); hello.setList(STU_HELLO); Object.assign(hello, GREET_STU); }
    nextStat = T + 4; nextHello = T + 5;
  };
  tabs.forEach((b) => b.addEventListener("click", () => setReader(b.dataset.reader)));

  /* --- chips that open text in place (raise.js:280-305) --- */
  root.querySelectorAll(".rz-chip[data-ix]").forEach((chip) => {
    const ix = chip.nextElementSibling && chip.nextElementSibling.classList.contains("rz-ix") ? chip.nextElementSibling : null;
    if (!ix) return;
    let tw = null;
    chip.addEventListener("click", () => {
      const open = !chip.classList.contains("open");
      chip.classList.toggle("open", open);
      chip.setAttribute("aria-expanded", String(open));
      tw && tw.kill();
      if (open) {
        ix.hidden = false;
        if (!REDUCE) tw = tween({ from: 0, to: 1, dur: 0.35, ease: E.p2out, update: (v) => { ix.style.opacity = v; } });
      } else if (REDUCE) ix.hidden = true;
      else tw = tween({ from: +(ix.style.opacity || 1), to: 0, dur: 0.22, ease: E.p2in, update: (v) => { ix.style.opacity = v; }, done: () => { ix.hidden = true; } });
    });
  });

  /* --- fans: "six apps" and "right people" (raise.js:135-178) --- */
  const FANS = {
    apps: { S: 52, R: 120, BASE: [-75, -45, -15, 15, 45, 75], stagger: 0.055, ease: E.backOut(1.8), rot: true, cls: "rz-app",
      src: ["app-canvas.webp", "app-mail.webp", "app-calendar.webp", "app-messages.webp", "app-notion.webp", "app-discord.svg"] },
    people: { S: 56, R: 122, BASE: [-50, 0, 50], stagger: 0.06, ease: E.backOut(1.7), rot: false, cls: "rz-av",
      src: ["avatar-1.webp", "avatar-2.webp", "avatar-3.webp"] },
  };
  const made = {};
  const items = (kind) => made[kind] || (made[kind] = FANS[kind].src.map((s) => {
    const img = document.createElement("img");
    img.src = "raise/" + s; img.alt = ""; img.className = FANS[kind].cls; img.decoding = "async";
    fly.appendChild(img);
    return sprite(img);
  }));
  const centre = (el) => {
    const r = el.getBoundingClientRect(), b = root.getBoundingClientRect();
    return { cx: r.left + r.width / 2 - b.left, cy: r.top + r.height / 2 - b.top, w: r.width, vx: r.left + r.width / 2 };
  };
  const fanPos = (F, a, cx, cy) => { const r = ((a - 90) * Math.PI) / 180; return { x: cx + Math.cos(r) * F.R - F.S / 2, y: cy + Math.sin(r) * F.R - F.S / 2 }; };
  const openFans = new Map();
  function openFan(chip, kind) {
    if (REDUCE && kind === "people") return; // raise.js:168 skips the faces with reduced motion
    const F = FANS[kind], its = items(kind);
    const { cx, cy, vx } = centre(chip);
    const off = window.innerWidth < 768 ? (vx < window.innerWidth / 2 ? 90 : -90) : 0; // raise.js:142
    const st = { off, active: false, chip, kind };
    openFans.set(chip, st);
    its.forEach((it, i) => {
      it.set({ x: cx - F.S / 2, y: cy - F.S / 2, o: 0, s: 0.3, r: F.rot ? (Math.random() - 0.5) * 20 : 0 });
      const a = F.BASE[i] + off, p = fanPos(F, a, cx, cy);
      it.to({ x: p.x, y: p.y, o: 1, s: 1, ...(F.rot ? { r: a * 0.13 } : {}) }, 0.5, F.ease, i * F.stagger);
    });
    tween({ dur: 0.5 + (its.length - 1) * F.stagger + 0.1, update: () => {}, done: () => { st.active = true; } });
  }
  function moveFan(chip, clientX) {
    const st = openFans.get(chip);
    if (!st || !st.active) return;
    const F = FANS[st.kind], { cx, cy, w } = centre(chip), b = root.getBoundingClientRect();
    const rot = clamp(((clientX - b.left - cx) / (w * 2.5)) * 60, -30, 30);
    items(st.kind).forEach((it, i) => {
      const a = F.BASE[i] + st.off + rot, p = fanPos(F, a, cx, cy);
      it.to({ x: p.x, y: p.y, ...(F.rot ? { r: a * 0.13 } : {}) }, 0.2, E.p2out);
    });
  }
  function closeFan(chip) {
    const st = openFans.get(chip);
    if (!st) return;
    openFans.delete(chip);
    const F = FANS[st.kind], { cx, cy } = centre(chip);
    items(st.kind).forEach((it, i) => it.to({ x: cx - F.S / 2, y: cy - F.S / 2, o: 0, s: 0.2 }, 0.28, E.p2in, i * 0.03));
  }
  root.querySelectorAll(".rz-chip[data-fan]").forEach((chip) => {
    const kind = chip.dataset.fan;
    chip.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") openFan(chip, kind); });
    chip.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") moveFan(chip, e.clientX); });
    chip.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") closeFan(chip); });
    chip.addEventListener("focus", () => { if (chip.matches(":focus-visible") && !openFans.has(chip)) openFan(chip, kind); });
    chip.addEventListener("blur", () => closeFan(chip));
    chip.addEventListener("click", (e) => {
      if (e.pointerType === "mouse" || (e.detail && S.hover)) return;
      if (openFans.has(chip)) closeFan(chip); else openFan(chip, kind);
    });
  });

  /* --- the Cohort chip: the logo lifts out of the pill (raise.js:251-269) --- */
  let logoSp = null;
  const logo = () => {
    if (logoSp) return logoSp;
    const img = document.createElement("img");
    img.src = "raise/cohort-logo.webp"; img.alt = ""; img.className = "rz-logo";
    fly.appendChild(img);
    return (logoSp = sprite(img));
  };
  root.querySelectorAll(".rz-chip[data-logo]").forEach((chip) => {
    const inline = chip.querySelector(".rz-chip-img");
    const W = 160;
    let active = false, natW = 0, natM = 0, offX = 0, offY = 0, aCx = 0, aTop = 0;
    let xTo, yTo, rTo, wTw = null;
    const setInline = (w, m, o) => { inline.style.width = w + "px"; inline.style.marginRight = m + "px"; inline.style.opacity = o; };
    const inlineTo = (w, m, o, dur, ease) => {
      wTw && wTw.kill();
      const w0 = inline.getBoundingClientRect().width, m0 = parseFloat(getComputedStyle(inline).marginRight) || 0, o0 = +(inline.style.opacity || 1);
      wTw = tween({ dur, ease, update: (_, p) => { const e = ease(p); setInline(lerp(w0, w, e), lerp(m0, m, e), lerp(o0, o, e)); } });
    };
    chip.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse" || REDUCE) return;
      const L = logo();
      xTo = xTo || quickTo(() => L.st.x, (v) => L.set({ x: v }), 0.5, E.p3out);
      yTo = yTo || quickTo(() => L.st.y, (v) => L.set({ y: v }), 0.5, E.p3out);
      rTo = rTo || quickTo(() => L.st.r, (v) => L.set({ r: v }), 0.5, E.p3out);
      const b = root.getBoundingClientRect(), cr = chip.getBoundingClientRect();
      if (!active) {
        const ir = inline.getBoundingClientRect();
        if (ir.width > 2) { natW = ir.width; natM = parseFloat(getComputedStyle(inline).marginRight) || 0; offX = ir.left + ir.width / 2 - cr.left; offY = ir.top + ir.height / 2 - cr.top; }
      }
      active = true;
      aCx = cr.left - b.left + cr.width / 2; aTop = cr.top - b.top;
      L.el.style.transformOrigin = "50% 50%";
      L.set({ x: cr.left - b.left + offX - W / 2, y: cr.top - b.top + offY - W / 2, s: natW / W, r: 0 });
      L.to({ s: 1, o: 1 }, 0.6, E.p3out);
      xTo(aCx - W / 2); yTo(aTop - W - 18); rTo(0);
      inlineTo(0, 0, 0, 0.5, E.p3out);
    });
    chip.addEventListener("pointermove", (e) => {
      if (!active || e.pointerType !== "mouse") return;
      const b = root.getBoundingClientRect(), dx = e.clientX - b.left - aCx;
      xTo(aCx - W / 2 + clamp(dx * 0.42, -44, 44)); yTo(aTop - W - 18); rTo(clamp(dx * 0.06, -8, 8));
    });
    chip.addEventListener("pointerleave", (e) => {
      if (!active || e.pointerType !== "mouse") return;
      active = false;
      const L = logo(), b = root.getBoundingClientRect(), cr = chip.getBoundingClientRect();
      xTo(cr.left - b.left + offX - W / 2); yTo(cr.top - b.top + offY - W / 2); rTo(0);
      L.to({ s: natW / W, o: 0 }, 0.45, E.p3io);
      inlineTo(natW, natM, 1, 0.45, E.p3out);
    });
  });

  function closeAll() {
    [...openFans.keys()].forEach(closeFan);
    root.querySelectorAll(".rz-chip.open").forEach((c) => c.click());
  }

  /* --- "shared network" and "the network compounds" open Fig. 4 --- */
  root.querySelectorAll(".rz-chip[data-goto]").forEach((chip) => chip.addEventListener("click", () => {
    const fig = document.getElementById("netfig");
    if (!fig) return;
    fig.scrollIntoView({ behavior: REDUCE ? "auto" : "smooth", block: "center" });
    document.dispatchEvent(new CustomEvent("rz:net", { detail: chip.dataset.goto }));
  }));
}

/* ==================================================================
   Fig. 3: the corner and the greeting on one 20 second timeline
   ================================================================== */
function clockFig() {
  const root = document.getElementById("clockfig");
  if (!root) return;
  const stat = new Swap(root.querySelector(".rz-stat"), { list: STATS, ...CORNER });
  const hello = new Swap(root.querySelector(".rz-hello"), { list: INV_HELLO, ...GREET_INV });
  root.querySelector(".rz-time").textContent = clockText();
  const lanes = root.querySelector(".rz-lanes");
  const tracks = { corner: lanes.querySelector('[data-lane="corner"] .rz-lane-track'), greet: lanes.querySelector('[data-lane="greet"] .rz-lane-track') };
  const head = lanes.querySelector(".rz-playhead");
  const read = {};
  root.querySelectorAll(".rz-clock-read [data-k]").forEach((b) => { read[b.dataset.k] = b; });
  const playBtn = root.querySelector(".rz-play");
  const SHORT = ["2,083 waiting", "Zero paid", "Fall '26"];
  const SPAN = 20;

  // axis
  const axis = lanes.querySelector(".rz-axis");
  for (let s = 0; s <= SPAN; s++) {
    const tick = document.createElement("i");
    tick.style.left = (s / SPAN) * 100 + "%";
    axis.appendChild(tick);
  }
  [0, 5, 10, 15, 20].forEach((s) => {
    const l = document.createElement("span");
    l.style.left = (s / SPAN) * 100 + "%";
    l.textContent = s === 20 ? "20 s" : String(s);
    axis.appendChild(l);
  });

  // one lane = segments with the words they show, and the opacity curve over them
  const lanePaths = {};
  ["corner", "greet"].forEach((k) => {
    const s = svg("svg", { viewBox: "0 0 2000 100", preserveAspectRatio: "none" }, tracks[k]);
    lanePaths[k] = svg("path", { d: "" }, s);
  });
  let windowAt = -1;
  const segEls = { corner: [], greet: [] };
  function drawWindow(w0) {
    windowAt = w0;
    const per = { corner: 4, greet: 5 }, sw = { corner: stat, greet: hello };
    for (const k of ["corner", "greet"]) {
      const P = per[k], n = SPAN / P;
      tracks[k].querySelectorAll(".rz-seg").forEach((e) => e.remove());
      segEls[k] = [];
      for (let i = 0; i < n; i++) {
        const t = w0 + i * P, idx = Math.floor(t / P);
        const seg = document.createElement("span");
        seg.className = "rz-seg";
        seg.style.left = ((i * P) / SPAN) * 100 + "%";
        seg.style.width = (P / SPAN) * 100 + "%";
        seg.textContent = k === "corner" ? SHORT[idx % 3] : INV_HELLO[idx % 12];
        tracks[k].appendChild(seg);
        segEls[k].push(seg);
      }
      const pts = [];
      for (let j = 0; j <= 2000; j++) {
        const t = w0 + (j / 2000) * SPAN;
        const since = t >= P ? t - Math.floor(t / P) * P : 99;
        const o = sw[k].opacityAt(since) / sw[k].max; // normalised: top of the lane is each label's own full opacity
        pts.push([j, 96 - o * 88]);
      }
      lanePaths[k].setAttribute("d", pathFrom(pts));
    }
  }

  // the zoom: one swap, opacity against time
  const plot = root.querySelector(".rz-swap");
  const dotC = plot.querySelector(".rz-swap-dot-c"), dotG = plot.querySelector(".rz-swap-dot-g");
  let px = () => 0, py = () => 0;
  sized(plot, 190, (w, h) => {
    const g = plot.querySelector(".rz-swap-grid");
    g.innerHTML = "";
    const L = 34, R = w - 10, Tp = 16, B = h - 34;
    px = (t) => L + (t / 0.5) * (R - L);
    py = (o) => B - o * (B - Tp);
    svg("path", { class: "rz-ax", d: `M${L} ${Tp} V${B} H${R}` }, g);
    [0.7, 1].forEach((o) => { svg("path", { class: "rz-grid", d: `M${L} ${py(o)} H${R}` }, g); txt(g, L - 6, py(o) + 4, String(o), "rz-num", "end"); });
    txt(g, L - 6, B + 4, "0", "rz-num", "end");
    [0, 0.1, 0.2, 0.3, 0.4, 0.5].forEach((t) => { svg("path", { class: "rz-ax", d: `M${px(t)} ${B} v4` }, g); txt(g, px(t), B + 16, t === 0.5 ? "0.5 s" : String(t), "rz-num", t === 0 ? "start" : t === 0.5 ? "end" : "middle"); });
    txt(g, L + 4, B + 30, "one swap: out, change the words, in", "rz-lbl");
    const curve = (sw) => { const pts = []; for (let i = 0; i <= 120; i++) { const t = (i / 120) * 0.5; pts.push([px(t), py(sw.opacityAt(t))]); } return pathFrom(pts); };
    plot.querySelector(".rz-swap-c").setAttribute("d", curve(stat));
    plot.querySelector(".rz-swap-g").setAttribute("d", curve(hello));
    txt(g, px(0.5) - 2, py(0.22), "corner, 0.2 + 0.3 s", "rz-lbl rz-lbl--tint", "end");
    txt(g, px(0.5) - 2, py(1) - 6, "greeting, 0.13 + 0.18 s", "rz-lbl rz-lbl--ink", "end");
  });

  let T = 0, on = false, running = false, playing = !REDUCE, rn = 0;
  const place = (dot, sw) => {
    const tau = sw.a ? Math.min(0.5, T - sw.a.t0) : 0.5;
    dot.setAttribute("cx", px(tau).toFixed(1));
    dot.setAttribute("cy", py(sw.opacityAt(tau)).toFixed(1));
  };
  const frame = () => {
    const w0 = Math.floor(T / SPAN) * SPAN;
    if (w0 !== windowAt) drawWindow(w0);
    const s = T - w0;
    head.style.left = (s / SPAN) * 100 + "%";
    const ci = Math.floor(s / 4), gi = Math.floor(s / 5);
    segEls.corner.forEach((e, i) => e.classList.toggle("is-now", i === ci));
    segEls.greet.forEach((e, i) => e.classList.toggle("is-now", i === gi));
    place(dotC, stat); place(dotG, hello);
    if (++rn % 4 === 0 || !playing) {
      read.t.textContent = s.toFixed(1) + " s";
      read.c.textContent = `${stat.i + 1} / 3`;
      read.o.textContent = (+stat.el.style.opacity).toFixed(2);
      read.g.textContent = `${hello.i + 1} / 12`;
    }
  };
  const loop = (t, dt) => {
    if (!on || !playing) { running = false; return false; }
    const prev = T;
    T += dt;
    if (Math.floor(T / 4) > Math.floor(prev / 4)) stat.go(Math.floor(T / 4) * 4);
    if (Math.floor(T / 5) > Math.floor(prev / 5)) hello.go(Math.floor(T / 5) * 5);
    stat.tick(T); hello.tick(T);
    frame();
  };
  const start = () => { on = true; if (playing && !running) { running = true; S.raf(loop); } };
  S.onVisible(root, start, () => { on = false; });
  frame();
  if (REDUCE) {
    playBtn.hidden = false;
    playBtn.addEventListener("click", () => {
      playing = !playing;
      playBtn.textContent = playing ? "Pause" : "Play";
      if (playing) start();
    });
  }
}

/* ==================================================================
   Fig. 4: the network overlay, as a floating figure (raise.js:497-752)
   ================================================================== */
function netFig() {
  const root = document.getElementById("netfig");
  if (!root) return;
  const wrap = root.querySelector(".rz-net-canvas");
  const cvs = wrap.querySelector("canvas");
  const ctx = cvs.getContext("2d", { alpha: true });
  const range = root.querySelector("#net-grow");
  const outEl = root.querySelector(".rz-scrub output");
  const lineEls = [...root.querySelectorAll(".rz-net-lines li")];
  const growBtn = root.querySelector('[data-act="grow"]');
  const forceBtn = root.querySelector('[data-act="forces"]');
  const legend = root.querySelector(".rz-legend");
  const modeTabs = [...root.querySelectorAll(".rz-net-top .tabs button")];
  const read = {};
  root.querySelectorAll("#net-read [data-k]").forEach((b) => { read[b.dataset.k] = b; });
  const hoverRow = root.querySelector("[data-k-hover]");

  const MAX = 32; // raise.js:694
  const RGB = "45,91,227"; // the day colour, raise.js:513
  const LINES = {
    // raise.js:695-699
    compounds: [["12%", "More students join - the graph gets denser."], ["42%", "Denser graph - every intro faster, every match sharper."], ["75%", "Better matching - harder to leave, impossible to copy."]],
    // raise.js:541, shown at 0.8 + i × 0.75 s (raise.js:546)
    shared: [["0.8 s", "Every student has an assistant."], ["1.55 s", "Every assistant talks to every other."], ["2.3 s", "That's the network."]],
  };
  let W = 0, H = 0, maxD = 0, BX = 0, BY = 0, dpr = 1;
  let mode = "compounds";
  let nodes = [], edges = [], seq = [], hovered = null, showF = false;
  let simT = 0, acc = 0, growing = false, nextSpawn = 0, on = false, running = false, modeT0 = 0;
  let pulse = !REDUCE;

  // per-object tweens on the figure's own clock, so they pause with it
  const anim = (o, k, to, dur, ease, delay = 0) => { (o.an || (o.an = {}))[k] = { from: o[k], to, t0: simT + delay, dur, ease }; };
  const stepAnims = (o) => {
    if (!o.an) return;
    for (const k in o.an) {
      const a = o.an[k];
      if (simT < a.t0) continue;
      const p = clamp((simT - a.t0) / a.dur, 0, 1);
      o[k] = a.from + (a.to - a.from) * a.ease(p);
      if (p >= 1) delete o.an[k];
    }
  };
  const finishAnims = (o) => { if (!o.an) return; for (const k in o.an) o[k] = o.an[k].to; o.an = null; };

  function size() {
    const r = wrap.getBoundingClientRect();
    const nW = Math.round(r.width), nH = Math.round(r.height);
    if (!nW || !nH) return;
    if (W && H) nodes.forEach((n) => { n.x *= nW / W; n.y *= nH / H; });
    W = nW; H = nH; dpr = dprOf();
    cvs.width = Math.round(W * dpr); cvs.height = Math.round(H * dpr);
    cvs.style.width = W + "px"; cvs.style.height = H + "px";
    maxD = Math.min(W, H) * 0.34; // raise.js:675
    BX = W * 0.17; BY = H * 0.14; // raise.js:582
    draw();
  }

  /* --- the compounding graph --- */
  function seed() {
    nodes = []; edges = []; hovered = null;
    const n0 = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 9, rT: 9, alpha: 0, phase: 0 }; // raise.js:703
    anim(n0, "alpha", 1, 0.7, E.p2out);
    nodes.push(n0);
  }
  function addNode() { // raise.js:707-731, each step recorded so the slider can replay it
    const i = nodes.length;
    let ev = seq[i];
    if (!ev) {
      const R = Math.random;
      ev = seq[i] = {
        pidx: Math.floor(R() * R() * nodes.length), // raise.js:710, leans towards the oldest nodes
        ang: R() * Math.PI * 2, dist: 40 + R() * 55,
        vx: (R() - 0.5) * 1.5, vy: (R() - 0.5) * 1.5, r: 5 + R() * 5, phase: R() * Math.PI * 2, jit: R() * 80, links: null,
      };
    }
    const p = nodes[ev.pidx];
    const nn = { x: clamp(p.x + Math.cos(ev.ang) * ev.dist, 60, W - 60), y: clamp(p.y + Math.sin(ev.ang) * ev.dist, 60, H - 60), vx: ev.vx, vy: ev.vy, r: ev.r, rT: ev.r, alpha: 0, phase: ev.phase, grew: [] };
    anim(nn, "alpha", 1, 0.5, E.backOut(1.6));
    nodes.push(nn);
    if (!ev.links) {
      ev.links = [];
      for (let j = 0; j < i && ev.links.length < 3; j++) if (Math.hypot(nodes[j].x - nn.x, nodes[j].y - nn.y) < maxD * 0.88) ev.links.push(j);
    }
    ev.links.forEach((j) => {
      const e = { a: j, b: i, alpha: 0 };
      anim(e, "alpha", 0.85, 0.35, E.p1out, 0.06);
      edges.push(e);
      const n = nodes[j], newR = Math.min(n.rT + 1.4, 22); // raise.js:728
      nn.grew.push([j, newR - n.rT]);
      n.rT = newR;
      anim(n, "r", newR, 0.45, E.backOut(1.8));
    });
    return ev;
  }
  function removeLast() {
    const i = nodes.length - 1;
    if (i < 1) return;
    nodes[i].grew.forEach(([j, dr]) => { const n = nodes[j]; n.rT -= dr; anim(n, "r", n.rT, 0.3, E.p2out); });
    edges = edges.filter((e) => e.b !== i);
    nodes.pop();
    if (hovered !== null && hovered >= nodes.length) hovered = null;
  }
  // a step not yet recorded is grown with the original's waiting time run first, so jumping
  // ahead on the slider gives the same kind of graph as watching it grow
  const advance = (sec) => { for (let i = 0, n = Math.round(sec * 60); i < n; i++) { simT += 1 / 60; nodes.forEach(stepAnims); edges.forEach(stepAnims); step(); } };
  function setCount(k) {
    k = clamp(k, 1, MAX);
    if (mode !== "compounds") return;
    while (nodes.length > k) removeLast();
    while (nodes.length < k) {
      if (!seq[nodes.length]) advance(nodes.length === 1 ? 0.4 : (spawnDelay(nodes.length) + 40) / 1000);
      addNode();
    }
    sync();
  }
  const spawnDelay = (n) => (n < 5 ? 500 : n < 14 ? 280 : n < 24 ? 160 : 100); // raise.js:738

  /* --- the shared network (raise.js:678-688) --- */
  function buildShared() {
    nodes = []; edges = []; hovered = null; seq = [];
    const N = 18;
    for (let i = 0; i < N; i++) {
      const n = { x: W / 2 + (Math.random() - 0.5) * W * 0.5, y: H / 2 + (Math.random() - 0.5) * H * 0.5, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, r: 5 + Math.random() * 5, alpha: 0, phase: Math.random() * Math.PI * 2 };
      n.rT = n.r;
      anim(n, "alpha", 1, 0.4, E.p1out, i * 0.028);
      nodes.push(n);
    }
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      if (Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) < maxD) edges.push({ a: i, b: j, alpha: 0 });
    }
    edges.forEach((e, i) => anim(e, "alpha", 0.85, 0.5, E.p1out, 0.3 + i * 0.004));
    modeT0 = simT;
  }

  /* --- physics, one step = one frame of the original at 60 Hz (raise.js:591-617) --- */
  function step() {
    const fShow = showF;
    if (fShow) nodes.forEach((n) => { n.fr = [0, 0]; n.fs = [0, 0]; n.fc = [0, 0]; });
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + 1;
      const f = 700 / d2;
      a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
      if (fShow) { a.fr[0] += dx * f; a.fr[1] += dy * f; b.fr[0] -= dx * f; b.fr[1] -= dy * f; }
    }
    edges.forEach((e) => {
      const a = nodes[e.a], b = nodes[e.b];
      if (!a || !b) return;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const str = (d - maxD * 0.4) * 0.008;
      a.vx += (dx / d) * str; a.vy += (dy / d) * str; b.vx -= (dx / d) * str; b.vy -= (dy / d) * str;
      if (fShow) { a.fs[0] += (dx / d) * str; a.fs[1] += (dy / d) * str; b.fs[0] -= (dx / d) * str; b.fs[1] -= (dy / d) * str; }
    });
    nodes.forEach((n) => {
      const cx = (W / 2 - n.x) * 0.007, cy = (H / 2 - n.y) * 0.007;
      n.vx += cx; n.vy += cy;
      if (fShow) n.fc = [cx, cy];
      if (n.x < BX) n.vx += (BX - n.x) * 0.12;
      if (n.x > W - BX) n.vx += (W - BX - n.x) * 0.12;
      if (n.y < BY) n.vy += (BY - n.y) * 0.12;
      if (n.y > H - BY) n.vy += (H - BY - n.y) * 0.12;
      n.vx *= 0.82; n.vy *= 0.82;
      const vMax = 4;
      n.vx = clamp(n.vx, -vMax, vMax); n.vy = clamp(n.vy, -vMax, vMax);
      n.x += n.vx; n.y += n.vy;
      n.x = clamp(n.x, BX, W - BX); n.y = clamp(n.y, BY, H - BY);
    });
  }
  const pinned = (n) => n.x <= BX + 0.5 || n.x >= W - BX - 0.5 || n.y <= BY + 0.5 || n.y >= H - BY - 0.5;

  /* --- drawing (raise.js:618-651), on paper, without the glow --- */
  function arrow(x, y, vx, vy, col) {
    const m = Math.hypot(vx, vy);
    if (m < 0.02) return;
    const len = Math.min(36, 7 * Math.sqrt(m)), ux = vx / m, uy = vy / m;
    const ex = x + ux * len, ey = y + uy * len;
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex + ux * 3, ey + uy * 3); ctx.lineTo(ex - ux * 3 - uy * 3, ey - uy * 3 + ux * 3); ctx.lineTo(ex - ux * 3 + uy * 3, ey - uy * 3 - ux * 3); ctx.closePath(); ctx.fill();
  }
  const css = getComputedStyle(document.documentElement);
  const FC = { rep: css.getPropertyValue("--f-rep").trim() || "#2f45d6", spr: css.getPropertyValue("--f-spr").trim() || "#1d1b18", ctr: css.getPropertyValue("--f-ctr").trim() || "#c2410c", wal: css.getPropertyValue("--f-wal").trim() || "#9a958b" };
  function draw() {
    if (!W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (showF) {
      ctx.save(); ctx.setLineDash([3, 5]); ctx.strokeStyle = FC.wal; ctx.lineWidth = 1;
      ctx.strokeRect(BX, BY, W - 2 * BX, H - 2 * BY);
      ctx.restore();
    }
    const hs = new Set();
    if (hovered !== null) { hs.add(hovered); edges.forEach((e) => { if (e.a === hovered) hs.add(e.b); if (e.b === hovered) hs.add(e.a); }); }
    edges.forEach((e) => {
      const a = nodes[e.a], b = nodes[e.b];
      if (!a || !b || a.alpha < 0.01 || b.alpha < 0.01) return;
      const isH = hovered !== null && (e.a === hovered || e.b === hovered);
      const op = hovered !== null ? (isH ? 0.8 : 0.04) : clamp(e.alpha, 0, 1) * clamp(Math.min(a.alpha, b.alpha), 0, 1);
      if (op < 0.005) return;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `rgba(${RGB},${op})`; ctx.lineWidth = isH ? 2.5 : 2; ctx.stroke();
    });
    nodes.forEach((n, i) => {
      if (n.alpha < 0.01) return;
      const al = clamp(n.alpha, 0, 1);
      const pr = Math.max(0.5, n.r + (pulse ? Math.sin(simT * 2 + n.phase) * 1.4 : 0)); // raise.js:634
      const inH = hs.has(i);
      let op = hovered !== null ? (inH ? al : al * 0.05) : al * 0.88;
      if (showF) op *= 0.55;
      if (op < 0.005) return;
      ctx.beginPath(); ctx.arc(n.x, n.y, pr + 4, 0, Math.PI * 2); ctx.fillStyle = `rgba(${RGB},${op * 0.14})`; ctx.fill();
      ctx.beginPath(); ctx.arc(n.x, n.y, pr, 0, Math.PI * 2); ctx.fillStyle = `rgba(${RGB},${op})`; ctx.fill();
      if (showF && pinned(n)) { ctx.beginPath(); ctx.arc(n.x, n.y, pr + 4, 0, Math.PI * 2); ctx.strokeStyle = FC.wal; ctx.lineWidth = 1; ctx.stroke(); }
      if (hovered === i) { ctx.beginPath(); ctx.arc(n.x, n.y, pr + 7, 0, Math.PI * 2); ctx.strokeStyle = `rgba(${RGB},0.9)`; ctx.lineWidth = 1.5; ctx.stroke(); }
    });
    if (showF) nodes.forEach((n) => {
      if (!n.fr || n.alpha < 0.3) return;
      arrow(n.x, n.y, n.fr[0], n.fr[1], FC.rep);
      arrow(n.x, n.y, n.fs[0], n.fs[1], FC.spr);
      arrow(n.x, n.y, n.fc[0], n.fc[1], FC.ctr);
    });
  }

  /* --- the readouts and the three lines --- */
  let rn = 0;
  function sync() {
    const N = nodes.length, Ecount = edges.length;
    read.n.textContent = N;
    read.e.textContent = Ecount;
    read.d.textContent = N ? ((2 * Ecount) / N).toFixed(1) : "0.0";
    read.w.textContent = nodes.filter(pinned).length;
    if (mode === "compounds") {
      const pct = N / MAX; // raise.js:734
      read.p.textContent = Math.round(pct * 100) + "%";
      range.value = String(Math.round(pct * 100));
      range.setAttribute("aria-valuetext", `${N} nodes`);
      outEl.textContent = Math.round(pct * 100) + "%";
      const th = [0.12, 0.42, 0.75]; // raise.js:735-737
      lineEls.forEach((li, i) => li.classList.toggle("is-on", pct > th[i]));
    } else {
      read.p.textContent = "all at once";
      const t = simT - modeT0;
      lineEls.forEach((li, i) => li.classList.toggle("is-on", t > 0.8 + i * 0.75));
    }
    if (hovered !== null && nodes[hovered]) {
      const deg = edges.filter((e) => e.a === hovered || e.b === hovered).length;
      hoverRow.hidden = false;
      read.h.textContent = `#${hovered} · ${deg} link${deg === 1 ? "" : "s"}`;
    } else hoverRow.hidden = true;
  }
  function setMode(m) {
    mode = m;
    root.dataset.mode = m;
    modeTabs.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
    lineEls.forEach((li, i) => { li.innerHTML = `<span>${LINES[m][i][0]}</span>${LINES[m][i][1]}`; li.classList.remove("is-on"); });
    growBtn.textContent = m === "compounds" ? "Grow it" : "Replay";
    growing = false;
  }

  /* --- the loop --- */
  const loop = (t, dt) => {
    if (!on) { running = false; return false; }
    acc += dt;
    let steps = 0;
    while (acc >= 1 / 60 && steps < 4) {
      acc -= 1 / 60; steps++;
      simT += 1 / 60;
      if (growing && simT >= nextSpawn) {
        const ev = addNode(); // raise.js:707-739
        if (nodes.length >= MAX) growing = false;
        else nextSpawn = simT + (spawnDelay(nodes.length) + ev.jit) / 1000;
      }
      nodes.forEach(stepAnims); edges.forEach(stepAnims);
      step();
    }
    if (steps > 3) acc = 0;
    draw();
    if (++rn % 5 === 0) sync();
  };
  const start = () => { on = true; if (!running) { running = true; S.raf(loop); } };

  function grow() {
    if (mode !== "compounds") setMode("compounds");
    if (nodes.length >= MAX || nodes.length === 0) { seq = []; seed(); nextSpawn = simT + 0.4; } // raise.js:750
    else nextSpawn = simT + 0.3;
    growing = true; pulse = true;
    sync(); start();
  }
  function shared() { setMode("shared"); buildShared(); pulse = true; sync(); start(); }

  // settle a full graph without drawing, for the reduced-motion still and the first paint
  function settleFull() {
    seed(); setCount(MAX);
    for (let i = 0; i < 360; i++) { simT += 1 / 60; nodes.forEach(stepAnims); edges.forEach(stepAnims); step(); }
    nodes.forEach(finishAnims); edges.forEach(finishAnims);
    sync(); draw();
  }

  /* --- input: hover within r + 14, tap within r + 22 (raise.js:660-667) --- */
  const hit = (x, y, pad) => { let f = null; nodes.forEach((n, i) => { if (Math.hypot(x - n.x, y - n.y) < n.r + pad) f = i; }); return f; };
  const local = (e) => { const r = cvs.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cvs.addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse") return; const [x, y] = local(e); hovered = hit(x, y, 14); if (REDUCE || !running) draw(); sync(); });
  cvs.addEventListener("pointerleave", (e) => { if (e.pointerType !== "mouse") return; hovered = null; draw(); sync(); });
  cvs.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") return; const [x, y] = local(e); const f = hit(x, y, 22); hovered = hovered === f ? null : f; draw(); sync(); });
  cvs.addEventListener("keydown", (e) => {
    if (!nodes.length) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") hovered = hovered === null ? 0 : (hovered + 1) % nodes.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") hovered = hovered === null ? nodes.length - 1 : (hovered - 1 + nodes.length) % nodes.length;
    else if (e.key === "Escape") hovered = null;
    else return;
    e.preventDefault(); draw(); sync();
  });

  range.addEventListener("input", () => {
    growing = false;
    if (mode !== "compounds") { setMode("compounds"); seq = []; seed(); }
    setCount(Math.max(1, Math.round((+range.value / 100) * MAX)));
    start();
  });
  growBtn.addEventListener("click", () => (mode === "compounds" ? grow() : shared()));
  forceBtn.addEventListener("click", () => {
    showF = !showF;
    forceBtn.setAttribute("aria-pressed", String(showF));
    forceBtn.textContent = showF ? "Hide forces" : "Show forces";
    legend.hidden = !showF;
    if (showF && !running) { step(); }
    draw();
  });
  modeTabs.forEach((b) => b.addEventListener("click", () => (b.dataset.mode === "shared" ? shared() : grow())));
  document.addEventListener("rz:net", (e) => { (e.detail === "shared" ? shared : grow)(); });

  new ResizeObserver(size).observe(wrap);
  size();
  setMode("compounds");
  let first = true;
  S.onVisible(root, () => {
    if (first) {
      first = false;
      if (REDUCE) return; // a still graph until asked
      seq = []; seed(); nextSpawn = simT + 0.4; growing = true; // grows once, the way the chip does
    }
    if (!REDUCE || growing || mode === "shared") start();
  }, () => { on = false; });
  if (REDUCE) settleFull();
}

/* ==================================================================
   Fig. 5: the sticky-note wall (raise.js:180-249, countUp at 367-372)
   ================================================================== */
function wallFig() {
  const root = document.getElementById("wallfig");
  if (!root) return;
  const stage = root.querySelector(".rz-wall-canvas");
  const chip = root.querySelector(".rz-chip");
  const ix = root.querySelector(".rz-wall-ix");
  const nEl = ix.querySelector(".n");
  const layer = root.querySelector(".rz-notes");
  const sched = root.querySelector(".rz-sched");
  const schedSvg = sched.querySelector(".rz-sched-svg");
  const head = sched.querySelector(".rz-sched-head");
  const axis = sched.querySelector(".rz-sched-axis");
  const read = {};
  root.querySelectorAll(".rz-wall-read [data-k]").forEach((b) => { read[b.dataset.k] = b; });
  const COLORS = ["#F2A0C2", "#7DC77F", "#7FA8E6", "#B488E2", "#F4D34E", "#F08A6E"]; // raise.js:187
  const SPAN = 4.5;
  const pop = E.backOut(1.7);

  // axis and the two moments
  for (let s = 0; s <= 4; s++) { const l = document.createElement("span"); l.style.left = (s / SPAN) * 100 + "%"; l.textContent = s === 0 ? "0 s" : String(s); axis.appendChild(l); }
  [[1.1, "count 1.1 s"], [2.2, "fall 2.2 s"]].forEach(([t, s]) => { const g = document.createElement("span"); g.className = "rz-sched-tag"; g.style.left = (t / SPAN) * 100 + "%"; g.textContent = s; sched.appendChild(g); });

  let plan = null;
  function makePlan() {
    const w = stage.clientWidth, h = stage.clientHeight;
    const N = Math.min(window.innerWidth < 640 ? 12 : 24, 24); // raise.js:215
    const notes = [];
    for (let i = 0; i < N; i++) {
      notes.push({
        x: Math.random() * Math.max(40, w - 170), y: Math.random() * Math.max(40, h - 140), // raise.js:226-227
        rot: Math.random() * 40 - 20, dur: 0.32 + Math.random() * 0.2, delay: Math.random() * 0.7, // raise.js:228-229
        fRot: Math.random() * 120 - 60, fDur: 0.9 + Math.random() * 0.7, fDelay: Math.random() * 0.5, // raise.js:245
        color: COLORS[i % COLORS.length], lines: [0.42 + Math.random() * 0.3, 0.7 + Math.random() * 0.3, 0.55 + Math.random() * 0.4, 0.3 + Math.random() * 0.4],
      });
    }
    return { N, notes, h };
  }
  function drawPlan() {
    const N = plan.N;
    schedSvg.setAttribute("viewBox", `0 0 ${SPAN * 100} ${N}`);
    schedSvg.innerHTML = "";
    plan.notes.forEach((n, i) => {
      svg("rect", { class: "pop", x: n.delay * 100, y: i + 0.2, width: n.dur * 100, height: 0.6, fill: n.color }, schedSvg);
      svg("rect", { class: "fall", x: (2.2 + n.fDelay) * 100, y: i + 0.2, width: n.fDur * 100, height: 0.6 }, schedSvg);
    });
    [110, 220].forEach((x) => svg("line", { class: "mark", x1: x, x2: x, y1: -0.5, y2: N + 0.5 }, schedSvg));
    read.n.textContent = N;
  }
  plan = makePlan();
  drawPlan();

  // the pop curve: scale 0.5 to 1 on back.out(1.7)
  const pp = root.querySelector(".rz-pop");
  const popDot = pp.querySelector(".rz-pop-dot");
  let ppx = () => 0, ppy = () => 0;
  let peak = 0;
  for (let i = 0; i <= 1000; i++) peak = Math.max(peak, 0.5 + 0.5 * pop(i / 1000));
  sized(pp, 150, (w, h) => {
    const g = pp.querySelector(".rz-pop-grid");
    g.innerHTML = "";
    const L = 30, R = w - 8, Tp = 14, B = h - 30;
    ppx = (p) => L + p * (R - L);
    ppy = (s) => B - ((s - 0.5) / 0.6) * (B - Tp);
    svg("path", { class: "rz-ax", d: `M${L} ${Tp} V${B} H${R}` }, g);
    [1].forEach((s) => { svg("path", { class: "rz-grid", d: `M${L} ${ppy(s)} H${R}` }, g); txt(g, L - 5, ppy(s) + 4, "1", "rz-num", "end"); });
    txt(g, L - 5, B + 4, "0.5", "rz-num", "end");
    txt(g, L, B + 16, "0", "rz-num");
    txt(g, R, B + 16, "pop", "rz-num", "end");
    const pts = [];
    for (let i = 0; i <= 100; i++) pts.push([ppx(i / 100), ppy(0.5 + 0.5 * pop(i / 100))]);
    pp.querySelector(".rz-pop-curve").setAttribute("d", pathFrom(pts));
    let pk = 0, pkp = 0;
    for (let i = 0; i <= 100; i++) { const v = 0.5 + 0.5 * pop(i / 100); if (v > pk) { pk = v; pkp = i / 100; } }
    txt(g, ppx(pkp), ppy(pk) - 8, `peak ${peak.toFixed(2)}×`, "rz-lbl rz-lbl--tint", "middle");
    txt(g, L + 4, B + 28, "scale, back.out(1.7)", "rz-lbl");
    popDot.setAttribute("cx", ppx(1)); popDot.setAttribute("cy", ppy(1));
  });

  let shown = false, run = null;
  function build() {
    layer.innerHTML = "";
    return plan.notes.map((n) => {
      const el = document.createElement("div");
      el.className = "rz-note";
      el.style.background = n.color;
      el.innerHTML = n.lines.map((w) => `<i style="width:${(w * 100).toFixed(0)}%"></i>`).join("");
      layer.appendChild(el);
      return el;
    });
  }
  const place = (el, x, y, r, s, o) => { el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${r.toFixed(2)}deg) scale(${s.toFixed(4)})`; el.style.opacity = clamp(o, 0, 1).toFixed(3); };

  function open() {
    shown = true;
    chip.classList.add("open"); chip.setAttribute("aria-expanded", "true");
    const els = build();
    if (REDUCE) { // a still wall: every note popped, the count already counted
      els.forEach((el, i) => { const n = plan.notes[i]; place(el, n.x, n.y, n.rot, 1, 1); });
      ix.hidden = false; ix.style.opacity = 1; nEl.textContent = plan.N;
      return;
    }
    const t0 = now(), h = stage.clientHeight, myRun = {};
    run = myRun;
    const end = Math.max(...plan.notes.map((n) => 2.2 + n.fDelay + n.fDur));
    head.style.opacity = 1;
    S.raf(() => {
      if (run !== myRun) return false;
      const t = now() - t0;
      plan.notes.forEach((n, i) => {
        const el = els[i];
        const fs = 2.2 + n.fDelay;
        if (t >= fs) { // the fall, raise.js:245
          const e = E.p2in(clamp((t - fs) / n.fDur, 0, 1));
          place(el, n.x, lerp(n.y, h + 280, e), n.rot + n.fRot * e, 1, 1 - e);
        } else if (t >= n.delay) { // the pop, raise.js:228-229
          const e = pop(clamp((t - n.delay) / n.dur, 0, 1));
          place(el, n.x, n.y, n.rot, lerp(0.5, 1, e), e);
        } else place(el, n.x, n.y, n.rot, 0.5, 0);
      });
      if (t >= 1.1 && shown) { // raise.js:232-240
        if (ix.hidden) ix.hidden = false;
        ix.style.opacity = E.p2out(clamp((t - 1.1) / 0.5, 0, 1)).toFixed(3);
        nEl.textContent = Math.round(plan.N * E.p2out(clamp((t - 1.1) / 1.0, 0, 1))).toLocaleString();
      }
      const n0 = plan.notes[0], p0 = clamp((t - n0.delay) / n0.dur, 0, 1);
      popDot.setAttribute("cx", ppx(p0).toFixed(1)); popDot.setAttribute("cy", ppy(0.5 + 0.5 * pop(p0)).toFixed(1));
      head.style.left = (Math.min(t, SPAN) / SPAN) * 100 + "%";
      read.t.textContent = Math.min(t, end).toFixed(2) + " s";
      if (t > end) { layer.innerHTML = ""; head.style.opacity = 0; run = null; return false; }
      return true;
    });
  }
  function close() {
    shown = false;
    chip.classList.remove("open"); chip.setAttribute("aria-expanded", "false");
    ix.hidden = true; ix.style.opacity = 0;
    if (REDUCE) layer.innerHTML = "";
  }
  chip.addEventListener("click", () => {
    if (shown) { close(); return; }
    if (!run) { plan = makePlan(); drawPlan(); }
    open();
  });
  root.querySelector('[data-act="replay"]').addEventListener("click", () => {
    run = null; close();
    plan = makePlan(); drawPlan();
    open();
  });
  window.addEventListener("resize", () => { if (!run && !shown) { plan = makePlan(); drawPlan(); } });
}

/* ==================================================================
   Fig. 6: the pen strike (raise.js:754-763)
   ================================================================== */
function strikeFig() {
  const root = document.getElementById("strikefig");
  if (!root) return;
  const path = root.querySelector(".rz-ads path");
  const range = root.querySelector("#strike-t");
  const outEl = root.querySelector(".scrub output");
  const read = {};
  root.querySelectorAll(".rz-strike-read [data-k]").forEach((b) => { read[b.dataset.k] = b; });
  const DUR = 0.65, DASH = 300; // raise.js:760, index.html:227
  const Lp = path.getTotalLength();
  let T = 0;
  // when is the line fully drawn? solve 300 × ease(p) = L
  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (DASH * E.p2io(m) >= Lp) hi = m; else lo = m; }
  const tFull = hi * DUR;
  document.querySelectorAll('[data-strike="len"]').forEach((s) => { s.textContent = String(Math.round(Lp)); });
  document.querySelectorAll('[data-strike="tfull"]').forEach((s) => { s.textContent = `${tFull.toFixed(2)} s`; });

  const off = root.querySelector(".rz-off");
  const dot = off.querySelector(".rz-off-dot");
  let ox = () => 0, oy = () => 0;
  const dash = root.querySelector(".rz-dash");
  const bar = dash.querySelector(".rz-dash-bar"), win = dash.querySelector(".rz-dash-win"), onR = dash.querySelector(".rz-dash-on");
  let sx = (s) => s, dashLbl = null;

  // the dash diagram: the path is a window from 0 to L; the dash sits at [-offset, 300 - offset]
  sized(dash, 120, (w) => {
    const g = dash.querySelector(".rz-dash-axis"), lab = dash.querySelector(".rz-dash-labels");
    g.innerHTML = ""; lab.innerHTML = "";
    const L = 12, R = w - 12;
    sx = (s) => L + ((s + 320) / 640) * (R - L);
    svg("path", { class: "rz-ax", d: `M${L} 84 H${R}` }, g);
    [-300, -200, -100, 0, 100, 200, 300].forEach((s) => { svg("path", { class: "rz-ax", d: `M${sx(s)} 84 v4` }, g); txt(g, sx(s), 100, String(s), "rz-num", "middle"); });
    svg("path", { class: "rz-grid", d: `M${sx(0)} 22 V84`, "stroke-dasharray": "2 3" }, g);
    win.setAttribute("x", sx(0)); win.setAttribute("width", sx(Lp) - sx(0));
    txt(lab, sx(0), 18, `the path, ${Lp.toFixed(1)} long`, "rz-lbl rz-lbl--ink");
    dashLbl = txt(lab, sx(-150), 73, "the dash, 300 long", "rz-lbl", "middle");
    txt(lab, L, 116, "units along the path", "rz-lbl");
    setT(T);
  });

  // the offset plot
  sized(off, 190, (w, h) => {
    const g = off.querySelector(".rz-off-grid");
    g.innerHTML = "";
    const L = 38, R = w - 10, Tp = 14, B = h - 34;
    ox = (t) => L + (t / DUR) * (R - L);
    oy = (o) => B - (o / DASH) * (B - Tp);
    svg("rect", { class: "rz-burn-band", x: L, y: oy(DASH), width: R - L, height: oy(DASH - Lp) - oy(DASH) }, g);
    svg("path", { class: "rz-ax", d: `M${L} ${Tp} V${B} H${R}` }, g);
    [0, 300].forEach((o) => txt(g, L - 6, oy(o) + 4, String(o), "rz-num", "end"));
    txt(g, L - 6, oy(DASH - Lp) + 4, String(Math.round(DASH - Lp)), "rz-num", "end");
    [0, 0.65].forEach((t) => txt(g, ox(t), B + 16, t ? "0.65 s" : "0", "rz-num", t ? "end" : "start"));
    svg("path", { class: "rz-grid", d: `M${ox(tFull)} ${Tp} V${B}`, "stroke-dasharray": "3 3" }, g);
    txt(g, ox(tFull) + 5, oy(DASH - Lp) + 16, `drawn by ${tFull.toFixed(2)} s`, "rz-lbl rz-lbl--tint");
    txt(g, R, oy(DASH) + 13, "the visible part", "rz-lbl", "end");
    txt(g, L + 4, B + 30, "stroke-dashoffset, power2.inOut", "rz-lbl");
    const pts = [];
    for (let i = 0; i <= 120; i++) { const t = (i / 120) * DUR; pts.push([ox(t), oy(DASH * (1 - E.p2io(t / DUR)))]); }
    off.querySelector(".rz-off-curve").setAttribute("d", pathFrom(pts));
    setT(T);
  });

  function setT(t) {
    T = clamp(t, 0, DUR);
    const o = DASH * (1 - E.p2io(T / DUR));
    path.setAttribute("stroke-dashoffset", o.toFixed(2));
    const drawn = clamp(DASH - o, 0, Lp);
    bar.setAttribute("x", sx(-o)); bar.setAttribute("width", Math.max(0, sx(DASH - o) - sx(-o)));
    if (dashLbl) dashLbl.setAttribute("x", sx(DASH / 2 - o));
    onR.setAttribute("x", sx(0)); onR.setAttribute("width", Math.max(0, sx(drawn) - sx(0)));
    dot.setAttribute("cx", ox(T).toFixed(1)); dot.setAttribute("cy", oy(o).toFixed(1));
    range.value = String(Math.round(T * 1000));
    outEl.textContent = T.toFixed(2) + " s";
    read.o.textContent = o.toFixed(1);
    read.d.textContent = `${drawn.toFixed(1)} / ${Lp.toFixed(1)}`;
  }
  let playing = null;
  function strike() { // gsap.to(path, {strokeDashoffset: 0, duration: 0.65, ease: 'power2.inOut'})
    const me = {};
    playing = me;
    const t0 = now();
    setT(0);
    S.raf(() => {
      if (playing !== me) return false;
      const t = now() - t0;
      setT(t);
      if (t >= DUR) { playing = null; return false; }
      return true;
    });
  }
  range.addEventListener("input", () => { playing = null; setT(+range.value / 1000); });
  root.querySelector('[data-act="replay"]').addEventListener("click", strike);
  if (REDUCE) setT(DUR); // raise.js:759
  else {
    setT(0);
    const io = new IntersectionObserver((en) => { if (en[0].isIntersecting) { strike(); io.disconnect(); } }, { threshold: 0.5 }); // raise.js:761
    io.observe(root.querySelector(".rz-strike-line"));
  }
}

/* ==================================================================
   Fig. 7: the phones, with the burn-in shader (raise.js:853-906)
   ================================================================== */
function phoneFig() {
  const root = document.getElementById("phonefig");
  if (!root) return;
  const cvs = { b2c: root.querySelector('canvas[data-side="b2c"]'), b2b: root.querySelector('canvas[data-side="b2b"]') };
  const SRC = { b2c: "media/cohort/phone.webp", b2b: "media/raise/phone.webp" };
  const tabs = [...root.querySelectorAll(".tabs button")];
  const read = {};
  root.querySelectorAll(".rz-phone-read [data-k]").forEach((b) => { read[b.dataset.k] = b; });
  let side = "b2c";
  const ph = {};

  const VS = "attribute vec2 aPos;varying vec2 vUv;void main(){vUv=vec2(aPos.x*0.5+0.5,1.0-(aPos.y*0.5+0.5));gl_Position=vec4(aPos,0.0,1.0);}";
  // raise.js:864-870, unchanged
  const FS = `precision mediump float;uniform sampler2D uTex;uniform float uProg;varying vec2 vUv;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<6;i++){v+=a*noise(p);p*=2.1;a*=0.48;}return v;}
    void main(){vec4 color=texture2D(uTex,vUv);float bias=vUv.y*0.30;float n=fbm(vUv*4.4+vec2(0.5,1.3))-bias;
      float prog=clamp(uProg,-0.35,1.2);float edge=0.055;
      if(n>prog){discard;}else if(n>prog-edge){float t=(prog-n)/edge;vec3 ember=mix(vec3(1.00,0.90,0.55),vec3(0.92,0.30,0.04),smoothstep(0.0,1.0,t));float glow=smoothstep(0.0,0.45,t)*(1.0-smoothstep(0.45,1.0,t));gl_FragColor=mix(color,vec4(ember,1.0),glow*0.78);gl_FragColor.a=color.a;}else{gl_FragColor=color;}}`;

  function setup(key) {
    return new Promise((resolve) => {
      const canvas = cvs[key], img = new Image();
      img.decoding = "async";
      img.onload = () => {
        const w = Math.min(img.naturalWidth, Math.round(canvas.getBoundingClientRect().width * dprOf()) || img.naturalWidth);
        canvas.width = w; canvas.height = Math.round((w * img.naturalHeight) / img.naturalWidth);
        const p = { cur: -0.35, target: -0.35, frame: 0, revealed: false, draw: null, ticking: false };
        ph[key] = p;
        const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false });
        if (!gl) { const c2 = canvas.getContext("2d"); p.draw = () => { c2.clearRect(0, 0, canvas.width, canvas.height); if (p.cur > 0) c2.drawImage(img, 0, 0, canvas.width, canvas.height); }; resolve(p); return; }
        const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); return sh; };
        const prog = gl.createProgram();
        gl.attachShader(prog, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, FS));
        gl.linkProgram(prog); gl.useProgram(prog);
        const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const aPos = gl.getAttribLocation(prog, "aPos"); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
        const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.uniform1i(gl.getUniformLocation(prog, "uTex"), 0);
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        const uProg = gl.getUniformLocation(prog, "uProg");
        p.draw = () => { gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.uniform1f(uProg, p.cur); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
        resolve(p);
      };
      img.src = SRC[key];
    });
  }
  // raise.js:879: current += d * 0.016 every frame until |d| < 0.0004
  function tick(key) {
    const p = ph[key];
    if (!p || p.ticking) return;
    p.ticking = true;
    S.raf(() => {
      const d = p.target - p.cur;
      if (Math.abs(d) > 0.0004) { p.cur += d * 0.016; p.frame++; p.draw(); }
      else { p.cur = p.target; p.draw(); p.ticking = false; showRead(); return false; }
      if (key === side) showRead();
      return true;
    });
  }
  const reveal = (key) => { const p = ph[key]; if (!p || p.revealed) return; p.revealed = true; p.target = 1.15; tick(key); };
  function replay() {
    const p = ph[side];
    if (!p) return;
    p.cur = -0.35; p.frame = 0; p.revealed = true; p.target = 1.15; p.draw(); tick(side);
  }

  // the burn plot: uProg(f) = 1.15 − 1.5 × 0.984^f, and the band where most pixels flip
  const plot = root.querySelector(".rz-burn");
  const dot = plot.querySelector(".rz-burn-dot");
  const band = (() => { // the same fbm as the shader, in JS doubles, sampled over the picture
    const fr = (x) => x - Math.floor(x);
    const hash = (x, y) => fr(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
    const noise = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); return lerp(lerp(hash(ix, iy), hash(ix + 1, iy), fx), lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), fx), fy); };
    const fbm = (x, y) => { let v = 0, a = 0.5; for (let i = 0; i < 6; i++) { v += a * noise(x, y); x *= 2.1; y *= 2.1; a *= 0.48; } return v; };
    const ns = [];
    for (let j = 0; j < 60; j++) for (let i = 0; i < 50; i++) { const u = (i + 0.5) / 50, v = (j + 0.5) / 60; ns.push(fbm(u * 4.4 + 0.5, v * 4.4 + 1.3) - v * 0.3); }
    ns.sort((a, b) => a - b);
    return [ns[Math.floor(ns.length * 0.05)], ns[Math.floor(ns.length * 0.95)]];
  })();
  const curveAt = (f) => 1.15 - 1.5 * 0.984 ** f;
  let fDone = 0;
  while (curveAt(fDone) < band[1] && fDone < 1000) fDone++;
  let bx = () => 0, by = () => 0;
  const FR = 300;
  sized(plot, 210, (w, h) => {
    const g = plot.querySelector(".rz-burn-grid");
    g.innerHTML = "";
    const L = 40, R = w - 10, Tp = 14, B = h - 36;
    bx = (f) => L + (Math.min(f, FR) / FR) * (R - L);
    by = (u) => B - ((u + 0.35) / 1.5) * (B - Tp);
    const bd = plot.querySelector(".rz-burn-band");
    bd.setAttribute("x", L); bd.setAttribute("width", R - L); bd.setAttribute("y", by(band[1])); bd.setAttribute("height", by(band[0]) - by(band[1]));
    svg("path", { class: "rz-ax", d: `M${L} ${Tp} V${B} H${R}` }, g);
    [-0.35, 1.15].forEach((u) => txt(g, L - 6, by(u) + 4, u.toFixed(2), "rz-num", "end"));
    [0, 60, 120, 180, 240, 300].forEach((f) => { svg("path", { class: "rz-ax", d: `M${bx(f)} ${B} v4` }, g); txt(g, bx(f), B + 16, f === 300 ? "5 s" : `${f / 60}`, "rz-num", f === 0 ? "start" : f === 300 ? "end" : "middle"); });
    svg("path", { class: "rz-grid", d: `M${bx(fDone)} ${Tp} V${B}`, "stroke-dasharray": "3 3" }, g);
    txt(g, bx(fDone) + 5, by(band[0]) + 14, `mostly in by ${(fDone / 60).toFixed(1)} s`, "rz-lbl rz-lbl--tint");
    txt(g, R, by(band[1]) - 6, "pixels appear here", "rz-lbl", "end");
    txt(g, L + 4, B + 30, "uProg, frame by frame at 60 Hz", "rz-lbl");
    const pts = [];
    for (let f = 0; f <= FR; f += 2) pts.push([bx(f), by(curveAt(f))]);
    plot.querySelector(".rz-burn-curve").setAttribute("d", pathFrom(pts));
    showRead();
  });
  function showRead() {
    const p = ph[side];
    const cur = p ? p.cur : -0.35, f = p ? p.frame : 0;
    read.u.textContent = cur.toFixed(3);
    read.f.textContent = String(f);
    dot.setAttribute("cx", bx(f).toFixed(1)); dot.setAttribute("cy", by(cur).toFixed(1));
  }

  // the toggle (raise.js:898-905)
  function setSide(s) {
    if (s === side) return;
    side = s;
    tabs.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.side === s)));
    const show = cvs[s], hide = cvs[s === "b2c" ? "b2b" : "b2c"];
    show.style.opacity = "1"; show.style.pointerEvents = "auto"; show.removeAttribute("aria-hidden");
    hide.style.opacity = "0"; hide.style.pointerEvents = "none"; hide.setAttribute("aria-hidden", "true");
    if (!REDUCE) reveal(s);
    showRead();
  }
  tabs.forEach((b) => b.addEventListener("click", () => setSide(b.dataset.side)));
  root.querySelector('[data-act="replay"]').addEventListener("click", replay);

  let built = null;
  S.onVisible(root, () => {
    if (built) return;
    built = Promise.all([setup("b2c"), setup("b2b")]).then(() => {
      if (REDUCE) { ["b2c", "b2b"].forEach((k) => { ph[k].cur = ph[k].target = 1.15; ph[k].frame = fDone; ph[k].revealed = true; ph[k].draw(); }); showRead(); return; }
      ph.b2c.draw(); ph.b2b.draw();
      const inView = () => { const r = cvs.b2c.getBoundingClientRect(), vis = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0); return r.height > 0 && vis / r.height >= 0.12; };
      if (inView()) { reveal(side); return; }
      const io = new IntersectionObserver((en) => { if (inView()) { reveal(side); io.disconnect(); } }, { threshold: [0, 0.12, 0.5] }); // raise.js:883
      io.observe(cvs.b2c);
    });
  }, null, "400px 0px");
}

/* ==================================================================
   Fig. 8: the email button (raise.js:929-962)
   ================================================================== */
function askFig() {
  const root = document.getElementById("askfig");
  if (!root) return;
  const stage = root.querySelector(".rz-ask-canvas");
  const btn = root.querySelector(".rz-cta");
  const label = btn.querySelector(".rz-cta-label");
  const lines = root.querySelector(".rz-ask-lines");
  const reach = lines.querySelector(".rz-ask-reach"), pull = lines.querySelector(".rz-ask-pull");
  const rest = lines.querySelector(".rz-ask-rest"), cur = lines.querySelector(".rz-ask-cur"), ghost = lines.querySelector(".rz-ask-ghost");
  let reachD = 0;
  const read = {};
  root.querySelectorAll(".rz-ask-read [data-k]").forEach((b) => { read[b.dataset.k] = b; });
  const EMAIL = "ogemgoldsmith07@gmail.com"; // the original copies founders@; this one copies mine

  // the label swap: out 0.15 s power2.in to y −6, in 0.18 s power2.out from y 6
  let lab = { o: 1, y: 0 }, swapTw = null;
  const paintLabel = () => { label.style.opacity = lab.o.toFixed(3); label.style.transform = lab.y ? `translateY(${lab.y.toFixed(2)}px)` : ""; };
  function swapLabel(text) {
    if (REDUCE) { label.textContent = text; read.l.textContent = text === EMAIL ? "email" : text; return; }
    swapTw && swapTw.kill();
    const o0 = lab.o, y0 = lab.y;
    swapTw = tween({ dur: 0.15, ease: E.p2in, update: (_, p) => { const e = E.p2in(p); lab = { o: lerp(o0, 0, e), y: lerp(y0, -6, e) }; paintLabel(); }, done: () => {
      label.textContent = text;
      read.l.textContent = text === EMAIL ? "email" : text;
      swapTw = tween({ dur: 0.18, ease: E.p2out, update: (_, p) => { const e = E.p2out(p); lab = { o: e, y: lerp(6, 0, e) }; paintLabel(); } });
    } });
  }

  // the magnet: quickTo x and y, 0.5 s power3.out, towards 0.32 × the offset from the button's centre
  const pos = { x: 0, y: 0 };
  const paintBtn = () => {
    btn.style.transform = pos.x || pos.y ? `translate(${pos.x.toFixed(2)}px,${pos.y.toFixed(2)}px)` : "";
    read.x.textContent = fmt(pos.x) + " px"; read.y.textContent = fmt(pos.y) + " px";
    read.s.textContent = reachD > 1 ? (Math.hypot(pos.x, pos.y) / reachD).toFixed(2) : "0.00";
    const rx = btn.offsetLeft + btn.offsetWidth / 2, ry = btn.offsetTop + btn.offsetHeight / 2;
    pull.setAttribute("x1", rx); pull.setAttribute("y1", ry); pull.setAttribute("x2", rx + pos.x); pull.setAttribute("y2", ry + pos.y);
  };
  const xTo = quickTo(() => pos.x, (v) => { pos.x = v; paintBtn(); }, 0.5, E.p3out);
  const yTo = quickTo(() => pos.y, (v) => { pos.y = v; paintBtn(); }, 0.5, E.p3out);
  const placeRest = () => {
    const rx = btn.offsetLeft + btn.offsetWidth / 2, ry = btn.offsetTop + btn.offsetHeight / 2;
    rest.setAttribute("cx", rx); rest.setAttribute("cy", ry);
    ghost.setAttribute("x", btn.offsetLeft + 0.5); ghost.setAttribute("y", btn.offsetTop + 0.5);
    ghost.setAttribute("width", btn.offsetWidth - 1); ghost.setAttribute("height", btn.offsetHeight - 1);
    reach.setAttribute("x1", rx); reach.setAttribute("y1", ry);
    paintBtn();
  };
  // hold the button at the email's width, so a shorter label never pulls the edge out from under the cursor
  const holdWidth = () => { if (label.textContent !== EMAIL) return; label.style.minWidth = ""; label.style.minWidth = Math.ceil(label.getBoundingClientRect().width) + "px"; };
  holdWidth();
  if (document.fonts) document.fonts.ready.then(() => { holdWidth(); placeRest(); });
  new ResizeObserver(() => { holdWidth(); placeRest(); }).observe(stage);
  lines.classList.add("is-off");

  let copied = false;
  btn.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse" && !copied) swapLabel("Copy Email"); });
  btn.addEventListener("pointerleave", (e) => {
    if (e.pointerType !== "mouse") return;
    if (!copied) swapLabel(EMAIL);
    if (!REDUCE) { xTo(0); yTo(0); }
    lines.classList.add("is-off");
  });
  btn.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const s = stage.getBoundingClientRect();
    cur.setAttribute("cx", e.clientX - s.left); cur.setAttribute("cy", e.clientY - s.top);
    reachD = Math.hypot(e.clientX - s.left - (btn.offsetLeft + btn.offsetWidth / 2), e.clientY - s.top - (btn.offsetTop + btn.offsetHeight / 2));
    reach.setAttribute("x2", e.clientX - s.left); reach.setAttribute("y2", e.clientY - s.top);
    lines.classList.remove("is-off");
    if (REDUCE) return; // raise.js:957
    const r = btn.getBoundingClientRect(); // includes the pull so far, as in the original
    xTo((e.clientX - (r.left + r.width / 2)) * 0.32);
    yTo((e.clientY - (r.top + r.height / 2)) * 0.32);
  });
  btn.addEventListener("focus", () => { if (!copied && !btn.matches(":hover")) swapLabel("Copy Email"); });
  btn.addEventListener("blur", () => { if (!copied) swapLabel(EMAIL); });

  const fallbackCopy = () => {
    const ta = document.createElement("textarea");
    ta.value = EMAIL; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (_) { ok = false; }
    ta.remove();
    return ok;
  };
  const done = () => { copied = true; swapLabel("Copied ✓"); setTimeout(() => { copied = false; swapLabel(EMAIL); }, 2000); };
  btn.addEventListener("click", () => {
    const p = navigator.clipboard && window.isSecureContext ? navigator.clipboard.writeText(EMAIL) : Promise.reject();
    p.then(done).catch(() => { if (fallbackCopy()) done(); else window.location.href = "mailto:" + EMAIL; });
  });
}

/* ------------------------------------------------------------------ */
const boot = () => {
  [letterFig, clockFig, netFig, wallFig, strikeFig, phoneFig, askFig].forEach((f) => {
    try { f(); } catch (err) { console.error(f.name, err); }
  });
};
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
