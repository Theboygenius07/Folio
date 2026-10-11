/* Fig. 8: both dot grids, opened up. The fields are dots.js (ports of HeroParticles.tsx
   and RepelDotGrid.tsx). On top: the radius each one uses, the real pointer (a cross),
   the eased pointer HeroParticles actually measures from (the ring's centre), and two
   plots: the falloff by distance and how far behind the easing runs. */
import { S, $, $$, svgEl, tabs, clamp, playGate } from "./util.js";
import { brightGrid, repelGrid, track, BRIGHT, REPEL } from "./dots.js";

export function initDots(fig) {
  const box = $(".fg-canvas", fig), canvas = $("canvas", box), copy = $("[data-fg-copy]", fig);
  const read = $("[data-fg-read]", fig), fall = $(".fg-fall", fig), lagSvg = $(".fg-lag", fig);
  const h1 = $("[data-fg-h1]", fig), h2 = $("[data-fg-h2]", fig);
  const bright = brightGrid(canvas, { fade: 64 });
  const repel = repelGrid(canvas, { fade: 64 });
  let mode = "brighten", W = 0, H = 0, ctx = null;
  let pointer = null, ghostOn = !S().reduce, ghostT = 0, quietFor = 99;
  const hist = [];

  const layout = () => {
    const r = box.getBoundingClientRect();
    W = r.width; H = r.height;
    (mode === "brighten" ? bright : repel).layout(W, H);
    ctx = canvas.getContext("2d");
    if (mode === "brighten") {
      const c = copy.getBoundingClientRect();
      bright.copyRect = { left: c.left - r.left, top: c.top - r.top, right: c.right - r.left, bottom: c.bottom - r.top };
    }
  };

  // pointer
  track(box, (p) => { pointer = p; quietFor = 0; }, () => { pointer = null; quietFor = 0; });
  // keyboard: with the field focused, the arrow keys move a pointer through it
  box.tabIndex = 0;
  box.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 48 : 16;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (e.key === "Escape") { pointer = null; quietFor = 0; return; }
    if (!d) return;
    e.preventDefault();
    const p0 = pointer || { x: W / 2, y: H / 2 };
    pointer = { x: clamp(p0.x + d[0], 0, W), y: clamp(p0.y + d[1], 0, H) };
    quietFor = 0;
  });
  box.addEventListener("blur", () => { pointer = null; });

  // reduced motion: HeroParticles holds the breathing still (HeroParticles.tsx:86) and
  // RepelDotGrid turns the repel off (RepelDotGrid.tsx:55). Play turns both back on.
  if (S().reduce) {
    bright.breathe = false; repel.setEnabled(false);
    playGate($("[data-fg-play]", fig), () => { bright.breathe = true; repel.setEnabled(true); ghostOn = true; });
  }

  const ui = tabs($("[role=tablist]", fig), (b) => {
    mode = b.dataset.mode; fig.dataset.mode = mode; hist.length = 0;
    h1.textContent = mode === "brighten" ? "Opacity by distance" : "Push by distance";
    h2.textContent = mode === "brighten" ? "Pointer lag, last 2 seconds" : "Largest push, last 2 seconds";
    layout();
  });
  fig.dataset.mode = mode;

  /* ---------- plots ---------- */
  const P = { x0: 34, x1: 312, y0: 104, y1: 12 };
  const px = (d) => P.x0 + (d / 200) * (P.x1 - P.x0);
  const plotFall = (near) => {
    let h = `<line class="ax ax--ink" x1="${P.x0}" x2="${P.x1}" y1="${P.y0}" y2="${P.y0}"/><line class="ax" x1="${P.x0}" x2="${P.x0}" y1="${P.y0}" y2="${P.y1}"/>`;
    for (const d of [0, 50, 100, 150, 200]) h += `<text class="num" x="${px(d)}" y="${P.y0 + 15}" text-anchor="middle">${d}</text>`;
    h += `<text class="num" x="${P.x1}" y="${P.y0 + 27}" text-anchor="end">pixels from the pointer</text>`;
    if (mode === "brighten") {
      const C = BRIGHT, py = (a) => P.y0 - a * (P.y0 - P.y1);
      const base = near ? near.base : (C.ALPHA_MIN + C.ALPHA_MAX) / 2;
      h += `<rect class="band" x="${P.x0}" y="${py(C.ALPHA_MAX)}" width="${P.x1 - P.x0}" height="${py(C.ALPHA_MIN) - py(C.ALPHA_MAX)}"/>`;
      h += `<line class="guide" x1="${px(C.HOVER_RADIUS)}" x2="${px(C.HOVER_RADIUS)}" y1="${P.y0}" y2="${P.y1}"/>`;
      h += `<text class="num" x="${px(C.HOVER_RADIUS) + 4}" y="${P.y1 + 8}">160</text>`;
      for (const a of [0, 0.28, 0.85]) h += `<text class="num" x="${P.x0 - 6}" y="${py(a) + 3}" text-anchor="end">${a}</text>`;
      let d = "";
      for (let i = 0; i <= 50; i++) { const dist = i * 4; const p = dist < C.HOVER_RADIUS ? 1 - dist / C.HOVER_RADIUS : 0; const a = Math.max(base, base + (C.HOVER_ALPHA_MAX - base) * p); d += `${i ? "L" : "M"}${px(dist).toFixed(1)},${py(a).toFixed(1)}`; }
      h += `<path class="curve" d="${d}"/>`;
      if (near) h += `<circle class="dot" r="4.5" cx="${px(clamp(near.dist, 0, 200))}" cy="${py(near.alpha)}"/>`;
    } else {
      const C = REPEL, py = (o) => P.y0 - (o / 60) * (P.y0 - P.y1);
      h += `<line class="guide" x1="${px(C.REPEL_RADIUS)}" x2="${px(C.REPEL_RADIUS)}" y1="${P.y0}" y2="${P.y1}"/>`;
      h += `<text class="num" x="${px(C.REPEL_RADIUS) + 4}" y="${P.y1 + 8}">130</text>`;
      for (const o of [0, 30, 60]) h += `<text class="num" x="${P.x0 - 6}" y="${py(o) + 3}" text-anchor="end">${o}</text>`;
      let d = "";
      for (let i = 0; i <= 50; i++) { const dist = i * 4; const o = dist < C.REPEL_RADIUS ? (1 - dist / C.REPEL_RADIUS) * C.REPEL_STRENGTH : 0; d += `${i ? "L" : "M"}${px(dist).toFixed(1)},${py(o).toFixed(1)}`; }
      h += `<path class="curve" d="${d}"/>`;
      if (near) {
        const tgt = near.d < C.REPEL_RADIUS ? (1 - near.d / C.REPEL_RADIUS) * C.REPEL_STRENGTH : 0;
        h += `<circle class="sale" r="4" cx="${px(clamp(near.d, 0, 200))}" cy="${py(tgt)}" style="fill:var(--paper);stroke:var(--ink);stroke-width:1.25"/>`;
        h += `<circle class="dot" r="4.5" cx="${px(clamp(near.d, 0, 200))}" cy="${py(clamp(near.off, 0, 60))}"/>`;
      }
    }
    fall.innerHTML = h;
  };
  const plotLag = (now) => {
    const max = mode === "brighten" ? 120 : 60;
    const py = (v) => P.y0 - (clamp(v, 0, max) / max) * (P.y0 - P.y1);
    const tx = (t) => P.x1 - ((now - t) / 2000) * (P.x1 - P.x0);
    let h = `<line class="ax ax--ink" x1="${P.x0}" x2="${P.x1}" y1="${P.y0}" y2="${P.y0}"/><line class="ax" x1="${P.x0}" x2="${P.x0}" y1="${P.y0}" y2="${P.y1}"/>`;
    h += `<text class="num" x="${P.x0}" y="${P.y0 + 15}">−2s</text><text class="num" x="${P.x1}" y="${P.y0 + 15}" text-anchor="end">now</text>`;
    for (const v of [0, max / 2, max]) h += `<text class="num" x="${P.x0 - 6}" y="${py(v) + 3}" text-anchor="end">${v}</text>`;
    h += `<text class="num" x="${P.x1}" y="${P.y0 + 27}" text-anchor="end">${mode === "brighten" ? "pixels between pointer and eased pointer" : "pixels, the dot furthest from home"}</text>`;
    const pts = hist.filter((s) => now - s.t <= 2000);
    if (pts.length > 1) {
      h += `<path class="curve" d="${pts.map((s, i) => `${i ? "L" : "M"}${tx(s.t).toFixed(1)},${py(s.v).toFixed(1)}`).join("")}"/>`;
      const s = pts[pts.length - 1];
      h += `<circle class="dot" r="4.5" cx="${tx(s.t).toFixed(1)}" cy="${py(s.v).toFixed(1)}"/>`;
    }
    lagSvg.innerHTML = h;
  };

  /* ---------- overlay on the canvas ---------- */
  const ring = (x, y, r, label) => {
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = "rgba(11, 11, 12, 0.32)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(11, 11, 12, 0.55)";
    ctx.font = "500 11px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.fillText(label, x, y - r - 6);
    ctx.restore();
  };
  const cross = (x, y) => {
    ctx.save(); ctx.strokeStyle = "#0b0b0c"; ctx.lineWidth = 1.25;
    ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y); ctx.moveTo(x, y - 7); ctx.lineTo(x, y + 7); ctx.stroke();
    ctx.restore();
  };
  const center = (x, y) => {
    ctx.save(); ctx.fillStyle = "#e4f222"; ctx.strokeStyle = "#0b0b0c"; ctx.lineWidth = 1.25;
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
  };

  /* ---------- the loop ---------- */
  let visible = false, built = false, lastRead = "", plotT = 0;
  const loop = (t, dt) => {
    if (!visible) return false;
    quietFor += dt;
    // a demo pointer drifts through the field until the reader takes over
    let p = pointer, ghost = false;
    if (!p && ghostOn && quietFor > 1.2) {
      ghostT += dt;
      p = { x: W * (0.56 + 0.3 * Math.sin(ghostT * 0.55)), y: H * (0.5 + 0.22 * Math.sin(ghostT * 0.83 + 1)) };
      ghost = true;
    }
    let near = null, r = "";
    if (mode === "brighten") {
      const m = bright.mouse;
      const cr = bright.copyRect;
      if (p) { m.targetX = p.x; m.targetY = p.y; m.active = true; } else { m.active = false; m.targetX = -9999; m.targetY = -9999; } // HeroParticles.tsx:131-141
      bright.draw(dt);
      if (cr) { // the headline's dimmed box and its 48px feather (HeroParticles.tsx:17-18, 90-101)
        ctx.save(); ctx.setLineDash([2, 4]); ctx.strokeStyle = "rgba(11, 11, 12, 0.22)"; ctx.lineWidth = 1;
        ctx.strokeRect(cr.left, cr.top, cr.right - cr.left, cr.bottom - cr.top);
        const f = BRIGHT.COPY_FEATHER;
        ctx.beginPath(); ctx.roundRect(cr.left - f, cr.top - f, cr.right - cr.left + 2 * f, cr.bottom - cr.top + 2 * f, f); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = "rgba(11, 11, 12, 0.5)"; ctx.font = "500 11px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillText("dots at 70%", cr.left, cr.bottom + 16);
        ctx.fillText("back to 100% over 48px", cr.left - f + 8, cr.top - f - 6);
        ctx.restore();
      }
      if (m.active && m.x > -9000) {
        const d = bright.nearest(m.x, m.y);
        near = d && { base: d.base, alpha: d.alpha, dist: Math.hypot(d.x - m.x, d.y - m.y), r: d.r };
        ring(m.x, m.y, BRIGHT.HOVER_RADIUS, "160px");
        center(m.x, m.y);
        cross(p.x, p.y);
        const lag = Math.hypot(p.x - m.x, p.y - m.y);
        hist.push({ t, v: lag });
        r = `<li>nearest dot <b>${near.alpha.toFixed(2)}</b> opacity</li><li><b>${near.r.toFixed(2)}×</b> size</li><li>lag <b>${lag.toFixed(1)}px</b></li><li>ease <b>0.12</b>/frame</li>${ghost ? "<li>demo pointer</li>" : ""}`;
      } else { hist.push({ t, v: 0 }); r = `<li>breathing <b>0.05 to 0.28</b></li><li>radius <b>160px</b></li><li>ease <b>0.12</b>/frame</li>`; }
    } else {
      repel.setMouse(p);
      repel.idle = false; // the overlay is redrawn every frame, so the field must be too
      repel.draw(dt);
      if (p) {
        const n = repel.nearest(p.x, p.y);
        near = n;
        ring(p.x, p.y, REPEL.REPEL_RADIUS, "130px");
        cross(p.x, p.y);
        hist.push({ t, v: repel.maxOff });
        const tgt = n.d < REPEL.REPEL_RADIUS ? (1 - n.d / REPEL.REPEL_RADIUS) * REPEL.REPEL_STRENGTH : 0;
        r = `<li>nearest dot <b>${n.off.toFixed(1)}px</b> from home</li><li>heading for <b>${tgt.toFixed(1)}px</b></li><li>(1 − d/130) × <b>60</b></li><li>ease <b>0.12</b>/frame</li>${ghost ? "<li>demo pointer</li>" : ""}`;
      } else { hist.push({ t, v: repel.maxOff }); r = `<li>radius <b>130px</b></li><li>push <b>60px</b></li><li>ease <b>0.12</b>/frame</li>`; }
    }
    while (hist.length && t - hist[0].t > 2100) hist.shift();
    plotT += dt;
    if (plotT > 1 / 30) {
      plotT = 0; plotFall(near); plotLag(t);
      if (r !== lastRead) { read.innerHTML = r; lastRead = r; }
    }
  };

  S().onVisible(fig, () => {
    if (!built) { built = true; layout(); new ResizeObserver(() => layout()).observe(box); }
    visible = true; S().raf(loop);
  }, () => { visible = false; });
}
