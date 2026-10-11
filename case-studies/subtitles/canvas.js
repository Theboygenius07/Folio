/* Fig. 6: the canvas view, live, with a map of the 9 copies it is drawn as.
   Ported from Subtitles/views/freeform.js: 7 columns, 280 px cards with 200 px gaps
   (220 and 70 under 768 px wide), the grid drawn 3 x 3 times, a jump of exactly one grid
   when you drift into an outer copy, and momentum that keeps 93% a frame.
   Pointer events stand in for the site's separate mouse and touch handlers. */
import { WEEKS } from "./data.js";
import { cloudinaryUrl, shuffle, fmt, tween } from "./util.js";
import { openFocus, isOpen } from "./focus.js";

const TILES = 3;        // freeform.js:4
const COLS = 7;         // freeform.js:14
const FRICTION = 0.93;  // freeform.js:104
const VEL_GAIN = 14;    // freeform.js:129, px per ms times 14

export function initCanvas(fig) {
  const host = fig.querySelector(".stage-canvas");
  const map = fig.querySelector("[data-cv-map]");
  const out = fig.querySelector("[data-cv-readout]");
  const isMobile = window.innerWidth < 768;                 // freeform.js:8
  const CARD_W = isMobile ? 220 : 280;                      // freeform.js:9
  const CARD_H = Math.round(CARD_W * 9 / 16);               // freeform.js:10
  const GAP = isMobile ? 70 : 200;                          // freeform.js:11
  const SLOT_W = CARD_W + GAP, SLOT_H = CARD_H + GAP;
  const photos = shuffle(WEEKS, 11);
  const ROWS = Math.ceil(photos.length / COLS);
  const GRID_W = COLS * SLOT_W, GRID_H = ROWS * SLOT_H;

  const plane = document.createElement("div");
  plane.className = "cv-plane";
  plane.style.width = TILES * GRID_W + "px";
  plane.style.height = TILES * GRID_H + "px";
  host.appendChild(plane);

  const lazy = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const img = e.target;
      if (img.dataset.src) { img.src = img.dataset.src; img.removeAttribute("data-src"); }
      lazy.unobserve(img);
    });
  }, { root: host, rootMargin: "300px" });

  for (let ty = 0; ty < TILES; ty++) for (let tx = 0; tx < TILES; tx++) {
    photos.forEach((photo, i) => {
      const card = document.createElement("div");
      card.className = "cv-card";
      card.style.cssText = `left:${tx * GRID_W + (i % COLS) * SLOT_W}px;top:${ty * GRID_H + Math.floor(i / COLS) * SLOT_H}px;width:${CARD_W}px;height:${CARD_H}px`;
      card.dataset.i = i;
      const img = document.createElement("img");
      img.alt = "";
      img.draggable = false;
      img.dataset.src = cloudinaryUrl(photo.url, CARD_W);
      img.addEventListener("load", () => img.classList.add("loaded"), { once: true });
      card.appendChild(img);
      plane.appendChild(card);
      lazy.observe(img);
    });
  }

  // ---------- pan (freeform.js:66-111) ----------
  const vw = () => host.clientWidth, vh = () => host.clientHeight;
  let panX = 0, panY = 0, velX = 0, velY = 0, coasting = false, jumps = 0;
  let ghost = null;   // the last jump, drawn on the map for a moment

  function normalize() {   // freeform.js:84-91
    const cx = vw() / 2, cy = vh() / 2;
    const before = { x: panX, y: panY };
    while (panX > cx - 0.5 * GRID_W) panX -= GRID_W;
    while (panX < cx - 2.5 * GRID_W) panX += GRID_W;
    while (panY > cy - 0.5 * GRID_H) panY -= GRID_H;
    while (panY < cy - 2.5 * GRID_H) panY += GRID_H;
    if (before.x !== panX || before.y !== panY) {
      jumps++;
      ghost = { x: before.x, y: before.y, t: performance.now() };
    }
  }
  function apply() {
    normalize();
    plane.style.transform = `translate(${Math.round(panX)}px,${Math.round(panY)}px)`;
    drawMap();
  }
  function centre() {
    panX = vw() / 2 - GRID_W * 1.5;
    panY = vh() / 2 - GRID_H * 1.5;
    apply();
  }

  let stopCoast = null;
  function coast() {
    if (stopCoast) return;
    coasting = true;
    stopCoast = Study.raf((t, dt) => {
      const f = dt * 60;
      const k = FRICTION ** f;
      velX *= k; velY *= k;
      panX += velX * f; panY += velY * f;
      apply();
      if (Math.abs(velX) < 0.1 && Math.abs(velY) < 0.1) { coasting = false; stopCoast = null; drawMap(); return false; }
    });
  }
  function halt() { if (stopCoast) { stopCoast(); stopCoast = null; } coasting = false; velX = velY = 0; }

  let down = null, moved = false;
  host.addEventListener("pointerdown", (e) => {
    if (isOpen(host) || (e.button !== undefined && e.button > 0)) return;
    halt();
    down = { x: e.clientX, y: e.clientY, px: panX, py: panY, lx: e.clientX, ly: e.clientY, lt: performance.now(), id: e.pointerId };
    moved = false;
    host.setPointerCapture(e.pointerId);
    host.classList.add("is-grab");
  });
  host.addEventListener("pointermove", (e) => {
    if (!down || e.pointerId !== down.id) return;
    const now = performance.now();
    const dt = Math.max(1, now - down.lt);
    velX = (e.clientX - down.lx) / dt * VEL_GAIN;
    velY = (e.clientY - down.ly) / dt * VEL_GAIN;
    down.lx = e.clientX; down.ly = e.clientY; down.lt = now;
    panX = down.px + (e.clientX - down.x);
    panY = down.py + (e.clientY - down.y);
    if (Math.abs(e.clientX - down.x) > 4 || Math.abs(e.clientY - down.y) > 4) moved = true;
    apply();
  });
  const up = (e) => {
    if (!down || e.pointerId !== down.id) return;
    host.classList.remove("is-grab");
    const wasDown = down;
    down = null;
    if (!moved && e.type === "pointerup") { pickAt(wasDown.x, wasDown.y); return; }
    if (performance.now() - wasDown.lt > 120) { velX = velY = 0; drawMap(); }   // held still before letting go
    if (Math.abs(velX) > 0.5 || Math.abs(velY) > 0.5) coast();   // freeform.js:142-144
  };
  host.addEventListener("pointerup", up);
  host.addEventListener("pointercancel", up);
  host.addEventListener("click", (e) => { if (!e.isTrusted) pickAt(e.clientX, e.clientY); });

  // sideways wheel pans; up and down is left to the page (freeform.js:192-205 took both)
  let wheelEnd = null;
  host.addEventListener("wheel", (e) => {
    if (isOpen(host) || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    if (stopCoast) { stopCoast(); stopCoast = null; }
    panX -= e.deltaX; panY -= e.deltaY;
    velX = -e.deltaX * 0.6; velY = -e.deltaY * 0.6;
    apply();
    clearTimeout(wheelEnd);
    wheelEnd = setTimeout(coast, 80);
  }, { passive: false });

  host.addEventListener("keydown", (e) => {
    if (isOpen(host)) return;
    const k = { ArrowLeft: [9, 0], ArrowRight: [-9, 0], ArrowUp: [0, 9], ArrowDown: [0, -9] }[e.key];
    if (k) { e.preventDefault(); velX = k[0] * 2.2; velY = k[1] * 2.2; coast(); return; }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); const r = host.getBoundingClientRect(); pickAt(r.left + r.width / 2, r.top + r.height / 2, true); }
  });

  // ---------- open a photo (freeform.js:358-368) ----------
  function pickAt(x, y, nearest) {
    if (isOpen(host)) return;
    let el = document.elementFromPoint(x, y);
    let card = el && el.closest(".cv-card");
    if (!card && nearest) {
      let best = null, bd = Infinity;
      plane.querySelectorAll(".cv-card").forEach((c) => {
        const r = c.getBoundingClientRect();
        const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
        if (d < bd) { bd = d; best = c; }
      });
      card = best;
    }
    if (!card || !host.contains(card)) return;
    const photo = photos[+card.dataset.i];
    const rect = () => {
      const a = card.getBoundingClientRect(), b = host.getBoundingClientRect();
      return { left: a.left - b.left, top: a.top - b.top, width: a.width, height: a.height };
    };
    halt();
    openFocus({ host, photo, fromRect: rect(), getRect: rect, onClose: () => host.focus({ preventScroll: true }) });
  }

  // ---------- hand: a held pinch drags (freeform.js:473-497) ----------
  let hp = null;
  fig.addEventListener("hand", ({ detail: d }) => {
    if (!d.active || isOpen(host)) { hp = null; return; }
    if (d.pinch) {
      d.hint = "";
      const now = performance.now();
      if (!hp) { halt(); hp = { x: d.cx, y: d.cy, px: panX, py: panY, lx: d.cx, ly: d.cy, lt: now }; return; }
      const dt = Math.max(1, now - hp.lt);
      velX = (d.cx - hp.lx) / dt * VEL_GAIN; velY = (d.cy - hp.ly) / dt * VEL_GAIN;
      hp.lx = d.cx; hp.ly = d.cy; hp.lt = now;
      panX = hp.px + (d.cx - hp.x); panY = hp.py + (d.cy - hp.y);
      apply();
    } else if (hp) {
      hp = null;
      if (Math.abs(velX) > 0.5 || Math.abs(velY) > 0.5) coast();
    } else {
      d.hint = "Pinch and move to drag the canvas.";
    }
  });
  fig.addEventListener("hand:leave", () => { if (hp) { hp = null; coast(); } });

  // ---------- the map of the 9 copies ----------
  const NS = "http://www.w3.org/2000/svg";
  const MW = 3 * GRID_W, MH = 3 * GRID_H;
  map.setAttribute("viewBox", `0 0 ${MW} ${MH}`);
  const mk = (tag, attrs, parent = map) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); parent.appendChild(el); return el; };
  for (let ty = 0; ty < 3; ty++) for (let tx = 0; tx < 3; tx++) {
    const g = mk("g", { class: tx === 1 && ty === 1 ? "cvm-tile is-mid" : "cvm-tile" });
    mk("rect", { x: tx * GRID_W, y: ty * GRID_H, width: GRID_W, height: GRID_H, class: "cvm-frame" }, g);
    photos.forEach((p, i) => mk("rect", { x: tx * GRID_W + (i % COLS) * SLOT_W, y: ty * GRID_H + Math.floor(i / COLS) * SLOT_H, width: CARD_W, height: CARD_H, class: "cvm-card" }, g));
  }
  const ghostEl = mk("rect", { class: "cvm-ghost", x: 0, y: 0, width: 0, height: 0 });
  const jumpEl = mk("line", { class: "cvm-jump", x1: 0, y1: 0, x2: 0, y2: 0 });
  const viewEl = mk("rect", { class: "cvm-view", x: 0, y: 0, width: 0, height: 0 });
  let lastOut = "";
  let ghostStop = null;
  function drawMap() {
    const w = vw(), h = vh();
    const set = (el, x, y) => { el.setAttribute("x", x); el.setAttribute("y", y); el.setAttribute("width", w); el.setAttribute("height", h); };
    set(viewEl, -panX, -panY);
    if (ghost) {
      const age = (performance.now() - ghost.t) / 900;
      if (age >= 1 || Study.reduce && age > 0.5) { ghostEl.style.opacity = 0; jumpEl.style.opacity = 0; ghost = null; }
      else {
        set(ghostEl, -ghost.x, -ghost.y);
        jumpEl.setAttribute("x1", -ghost.x + w / 2); jumpEl.setAttribute("y1", -ghost.y + h / 2);
        jumpEl.setAttribute("x2", -panX + w / 2); jumpEl.setAttribute("y2", -panY + h / 2);
        const o = (1 - age).toFixed(3);
        ghostEl.style.opacity = o; jumpEl.style.opacity = o;
        if (!ghostStop) ghostStop = Study.raf(() => { if (!ghost) { ghostStop = null; return false; } drawMap(); });
      }
    }
    const gx = ((((-panX + w / 2) % GRID_W) + GRID_W) % GRID_W), gy = ((((-panY + h / 2) % GRID_H) + GRID_H) % GRID_H);
    const html = `<li>centre <b>${Math.round(gx)}, ${Math.round(gy)}</b> px into the grid</li><li>vel <b>${fmt(Math.hypot(velX, velY), 1)}</b> px/frame</li><li>jumps <b>${jumps}</b></li>`;
    if (html !== lastOut) { out.innerHTML = html; lastOut = html; }
  }

  // glide left until the frame crosses into the next copy and jumps back
  let glideStop = () => {};
  fig.querySelector("[data-cv-glide]").addEventListener("click", () => {
    if (isOpen(host)) return;
    halt(); glideStop();
    const toEdge = panX - (vw() / 2 - 2.5 * GRID_W);   // how far until the next copy
    const p = { x: panX }, from = panX;
    let last = from;
    glideStop = tween(p, { x: from - toEdge - 0.35 * GRID_W }, {
      duration: 2.4, ease: "power2.inOut", instant: false,
      onUpdate: () => { panX += p.x - last; last = p.x; apply(); },
    });
  });

  new ResizeObserver(() => { if (!isOpen(host)) centre(); }).observe(host);
  centre();
  jumps = 0;
  drawMap();
  Study.onVisible(fig, null, () => halt());
}
