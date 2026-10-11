/* Wire's two dot grids, ported to plain canvas.

   repelGrid    components/landing/RepelDotGrid.tsx   (home, product cards, checkout, dashboard)
   brightGrid   components/landing/HeroParticles.tsx  (Relay's hero, the developer page)

   The constants are the originals. Each per-frame rate is applied as a 60fps frame,
   scaled by dt, so the feel is the same on every display. */

export const REPEL = { // RepelDotGrid.tsx:5-11
  SPACING: 16, RADIUS: 1, DOT_COLOR: "11, 11, 12", DOT_ALPHA: 0.16,
  REPEL_RADIUS: 130, REPEL_STRENGTH: 60, EASE: 0.12,
};

export const BRIGHT = { // HeroParticles.tsx:5-18
  SPACING: 15, RADIUS: 1, ALPHA_MIN: 0.05, ALPHA_MAX: 0.28,
  HOVER_RADIUS: 160, HOVER_ALPHA_MAX: 0.85, HOVER_RADIUS_BOOST: 1.6, EASE: 0.12,
  COPY_DIM_FACTOR: 0.7, COPY_FEATHER: 48,
};

/* per-frame ease e, applied over dt seconds as if at 60fps */
export const ease60 = (e, dt) => 1 - Math.pow(1 - e, dt * 60);

export function sizeCanvas(canvas, w, h) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2); // capped at 2, as in both originals
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/* fade dots out near the edges of a field that sits straight on the paper, so the
   field has no hard rectangle round it */
const edge = (x, y, w, h, f) => (f ? Math.max(0, Math.min(1, Math.min(x, w - x, y, h - y) / f)) : 1);

/* Pointer tracking that works for mouse, pen and touch. On touch, the position is held
   for a moment after the finger lifts so the spring back is visible. */
export function track(el, onMove, onLeave) {
  let t = 0;
  const pos = (e) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const move = (e) => { clearTimeout(t); onMove(pos(e), e); };
  const leave = (e) => {
    if (e.pointerType === "touch") { clearTimeout(t); t = setTimeout(onLeave, 650); }
    else onLeave();
  };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerdown", move);
  el.addEventListener("pointerleave", leave);
  el.addEventListener("pointercancel", leave);
  el.addEventListener("pointerup", (e) => { if (e.pointerType === "touch") leave(e); });
}

/* ---------- RepelDotGrid ---------- */
export function repelGrid(canvas, { fade = 0 } = {}) {
  const C = REPEL;
  let ctx, w = 0, h = 0, dots = [];
  const g = {
    mouse: null,          // { x, y } in canvas px, or null. Set it with setMouse.
    enabled: true,        // false with reduced motion until the reader presses Play
    idle: false,          // nothing moved last frame and nothing has changed since
    maxOff: 0,
    setMouse(m) { g.mouse = m; g.idle = false; },
    setEnabled(on) { g.enabled = on; g.idle = false; },
    layout(width, height) {
      w = width; h = height;
      ctx = sizeCanvas(canvas, w, h);
      dots = [];
      // RepelDotGrid.tsx:43-47
      for (let y = C.SPACING / 2; y < h; y += C.SPACING) {
        for (let x = C.SPACING / 2; x < w; x += C.SPACING) dots.push({ hx: x, hy: y, x, y, a: edge(x, y, w, h, fade) });
      }
      g.idle = false;
      g.draw(0);
    },
    // RepelDotGrid.tsx:50-73. Returns true while anything is still moving.
    draw(dt) {
      if (!ctx || g.idle) return false;
      const m = g.enabled ? g.mouse : null;
      const k = dt ? ease60(C.EASE, dt) : 1;
      let moving = false, maxOff = 0;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = `rgba(${C.DOT_COLOR}, ${C.DOT_ALPHA})`;
      ctx.beginPath();
      const faded = [];
      for (const d of dots) {
        let tx = d.hx, ty = d.hy;
        if (m) {
          const dx = d.hx - m.x, dy = d.hy - m.y;
          const dist = Math.hypot(dx, dy);
          if (dist < C.REPEL_RADIUS && dist > 0.001) {
            const force = (1 - dist / C.REPEL_RADIUS) * C.REPEL_STRENGTH;
            tx = d.hx + (dx / dist) * force;
            ty = d.hy + (dy / dist) * force;
          }
        }
        d.x += (tx - d.x) * k;
        d.y += (ty - d.y) * k;
        if (Math.abs(tx - d.x) > 0.02 || Math.abs(ty - d.y) > 0.02) moving = true;
        const off = Math.hypot(d.x - d.hx, d.y - d.hy);
        if (off > maxOff) maxOff = off;
        if (d.a <= 0) continue;
        if (d.a < 1) { faded.push(d); continue; }
        ctx.moveTo(d.x + C.RADIUS, d.y);
        ctx.arc(d.x, d.y, C.RADIUS, 0, Math.PI * 2);
      }
      ctx.fill();
      for (const d of faded) {
        ctx.fillStyle = `rgba(${C.DOT_COLOR}, ${(C.DOT_ALPHA * d.a).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, C.RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
      g.maxOff = maxOff;
      g.idle = !moving;
      return moving;
    },
    /* the dot nearest a point, for the readouts */
    nearest(px, py) {
      let best = null, bd = Infinity;
      for (const d of dots) { const dd = (d.hx - px) ** 2 + (d.hy - py) ** 2; if (dd < bd) { bd = dd; best = d; } }
      return best && { d: Math.sqrt(bd), off: Math.hypot(best.x - best.hx, best.y - best.hy), dot: best };
    },
  };
  return g;
}

/* ---------- HeroParticles ---------- */
export function brightGrid(canvas, { fade = 0 } = {}) {
  const C = BRIGHT;
  let ctx, w = 0, h = 0, dots = [], frame = 0;
  const g = {
    // target and eased pointer, HeroParticles.tsx:38-40
    mouse: { targetX: -9999, targetY: -9999, x: -9999, y: -9999, active: false },
    copyRect: null,       // { left, top, right, bottom } of the headline, or null
    breathe: true,        // false with reduced motion: t is held at 0.5, as in the original
    layout(width, height) {
      w = width; h = height;
      ctx = sizeCanvas(canvas, w, h);
      dots = [];
      // HeroParticles.tsx:64-74
      for (let y = C.SPACING / 2; y < h; y += C.SPACING) {
        for (let x = C.SPACING / 2; x < w; x += C.SPACING) {
          dots.push({ x, y, phase: Math.random() * Math.PI * 2, speed: 0.006 + Math.random() * 0.01, e: edge(x, y, w, h, fade), alpha: 0, r: C.RADIUS, base: 0 });
        }
      }
      g.draw(0);
    },
    // HeroParticles.tsx:78-119
    draw(dt) {
      if (!ctx) return;
      frame += dt * 60;
      const m = g.mouse;
      if (m.active && m.x < -9000) { m.x = m.targetX; m.y = m.targetY; } // first contact: start where the pointer is
      const k = dt ? ease60(C.EASE, dt) : 1;
      m.x += (m.targetX - m.x) * k;
      m.y += (m.targetY - m.y) * k;
      ctx.clearRect(0, 0, w, h);
      const cr = g.copyRect;
      for (const d of dots) {
        const t = g.breathe ? (Math.sin(frame * d.speed + d.phase) + 1) / 2 : 0.5;
        let alpha = C.ALPHA_MIN + t * (C.ALPHA_MAX - C.ALPHA_MIN);
        let radius = C.RADIUS;
        if (cr) {
          const dx = Math.max(cr.left - d.x, 0, d.x - cr.right);
          const dy = Math.max(cr.top - d.y, 0, d.y - cr.bottom);
          const out = Math.sqrt(dx * dx + dy * dy);
          const factor = out <= 0 ? C.COPY_DIM_FACTOR
            : out < C.COPY_FEATHER ? C.COPY_DIM_FACTOR + (1 - C.COPY_DIM_FACTOR) * (out / C.COPY_FEATHER) : 1;
          alpha *= factor;
        }
        d.base = alpha;
        if (m.active) {
          const dx = d.x - m.x, dy = d.y - m.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < C.HOVER_RADIUS) {
            const p = 1 - dist / C.HOVER_RADIUS;
            alpha = Math.max(alpha, alpha + (C.HOVER_ALPHA_MAX - alpha) * p);
            radius = C.RADIUS + (C.HOVER_RADIUS_BOOST - 1) * C.RADIUS * p;
          }
        }
        d.alpha = alpha; d.r = radius;
        const a = alpha * d.e;
        if (a <= 0.002) continue;
        ctx.beginPath();
        ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(11, 11, 12, ${a.toFixed(3)})`;
        ctx.fill();
      }
    },
    nearest(px, py) {
      let best = null, bd = Infinity;
      for (const d of dots) { const dd = (d.x - px) ** 2 + (d.y - py) ** 2; if (dd < bd) { bd = dd; best = d; } }
      return best;
    },
  };
  return g;
}
