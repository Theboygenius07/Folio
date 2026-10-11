/* Fig. 4: what the tracker reads off a hand.
   A diagram of the 21 points MediaPipe returns, with the 4 the site uses (tracking.js:99-126):
   the index tip is the pointer, thumb tip to index tip is the pinch, wrist to the base of
   the little finger is the depth. With the camera off you move a drawn hand; with hand
   control on, it is your hand. */
import {
  PINCH, DEAD, PAGE_DEAD, TIP_INDEX, TIP_THUMB, WRIST, PINKY_BASE,
  joystick, pinchDist, spanOf, depthOf, BONES,
} from "./handmath.js";
import { fitCanvas, css, fmt, clamp, tween } from "./util.js";

// A resting open hand, drawn as offsets from the wrist in frame units (x already
// squeezed by 3/4 so it looks right in a 4:3 frame, as the camera's numbers would).
const BASE = [
  [0, 0], [-0.09, -0.06], [-0.16, -0.15], [-0.21, -0.24], [-0.25, -0.31],
  [-0.08, -0.30], [-0.10, -0.42], [-0.11, -0.50], [-0.12, -0.57],
  [-0.01, -0.32], [-0.01, -0.45], [-0.01, -0.54], [-0.01, -0.61],
  [0.06, -0.30], [0.07, -0.42], [0.08, -0.50], [0.09, -0.56],
  [0.12, -0.25], [0.15, -0.34], [0.17, -0.40], [0.19, -0.46],
].map(([x, y]) => [x * 0.75, y]);

export function initHandFig(fig) {
  const canvas = fig.querySelector("canvas");
  const out = fig.querySelector("[data-hf-readout]");
  const scrub = fig.querySelector("[data-hf-depth]");
  const scrubOut = fig.querySelector("[data-hf-depth-out]");
  const pinchBtn = fig.querySelector("[data-hf-pinch]");
  const meter = fig.querySelector("[data-hf-meter]");
  const state = fig.querySelector("[data-hf-state]");

  const hand = { ox: 0.5, oy: 0.84, s: 0.55, pinch: 0 };
  const extra = BASE.map(() => [0, 0]);       // per-point nudges from dragging a tip
  let live = null;                              // live landmarks in display coords
  let dirty = true;

  const drawn = () => {
    if (live) return live;
    return BASE.map(([x, y], i) => {
      let px = x, py = y;
      if (i === TIP_THUMB || i === 3) {        // the pinch pulls the thumb onto the index tip
        const k = i === TIP_THUMB ? hand.pinch : hand.pinch * 0.55;
        const [tx, ty] = BASE[TIP_INDEX];
        px += (tx + 0.035 - px) * k; py += (ty + 0.03 - py) * k;
      }
      return { x: hand.ox + (px + extra[i][0]) * hand.s, y: hand.oy + (py + extra[i][1]) * hand.s };
    });
  };

  let box = { x: 0, y: 0, w: 1, h: 1 };
  function draw() {
    const { ctx, w, h } = fitCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const fw = Math.min(w, h * 4 / 3), fh = fw * 3 / 4;
    box = { x: (w - fw) / 2, y: (h - fh) / 2, w: fw, h: fh };
    const X = (v) => box.x + v * box.w, Y = (v) => box.y + v * box.h;
    const ink = css("--ink"), ink2 = css("--ink-2"), ink3 = css("--ink-3"), tint = css("--tint-ink");
    ctx.font = `500 ${w < 500 ? 10.5 : 12}px ${css("--font")}`;
    ctx.textBaseline = "middle";

    // viewfinder corners for the 640 x 480 frame
    ctx.strokeStyle = ink; ctx.lineWidth = 1.25;
    const c = Math.min(22, fw * 0.05);
    [[0, 0, 1, 1], [1, 0, -1, 1], [0, 1, 1, -1], [1, 1, -1, -1]].forEach(([a, b, sx, sy]) => {
      ctx.beginPath(); ctx.moveTo(X(a) + sx * c, Y(b)); ctx.lineTo(X(a), Y(b)); ctx.lineTo(X(a), Y(b) + sy * c); ctx.stroke();
    });

    // this page's scroll bands
    ctx.strokeStyle = ink3; ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
    [0.5 - PAGE_DEAD, 0.5 + PAGE_DEAD].forEach((v) => { ctx.beginPath(); ctx.moveTo(X(0.02), Y(v)); ctx.lineTo(X(0.98), Y(v)); ctx.stroke(); });
    ctx.setLineDash([]);
    ctx.fillStyle = ink3;
    ctx.textAlign = "left";
    ctx.fillText("this page scrolls up", X(0.03), Y(0.5 - PAGE_DEAD) - 9);
    ctx.fillText("this page scrolls down", X(0.03), Y(0.5 + PAGE_DEAD) + 10);

    // the site's joystick dead zone, ±0.07 round the middle
    ctx.strokeStyle = ink2; ctx.setLineDash([3, 3]);
    ctx.strokeRect(X(0.5 - DEAD), Y(0.5 - DEAD), X(0.5 + DEAD) - X(0.5 - DEAD), Y(0.5 + DEAD) - Y(0.5 - DEAD));
    ctx.setLineDash([]);
    ctx.fillStyle = ink2; ctx.textAlign = "left";
    ctx.fillText("dead zone \u00b10.07", X(0.5 + DEAD) + 6, Y(0.5 + DEAD) - 4);

    const lm = drawn();
    const P = (i) => [X(lm[i].x), Y(lm[i].y)];
    // bones
    ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.lineCap = "round";
    ctx.beginPath();
    BONES.forEach(([a, b]) => { const [x1, y1] = P(a); const [x2, y2] = P(b); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); });
    ctx.stroke();
    // joints, numbered lightly
    lm.forEach((p, i) => {
      const [x, y] = P(i);
      ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 6.283); ctx.fill();
    });

    // span: wrist to the base of the little finger
    const [wx, wy] = P(WRIST), [px, py] = P(PINKY_BASE);
    ctx.strokeStyle = tint; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(px, py); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = tint; ctx.textAlign = "left";
    ctx.fillText("0 wrist", wx + 8, wy + 4);
    ctx.fillText("17 → depth", px + 8, py + 2);

    // the pinch
    const dist = pinchDist(lm);
    const isPinch = dist < PINCH;
    const [ax, ay] = P(TIP_THUMB), [bx, by] = P(TIP_INDEX);
    ctx.strokeStyle = isPinch ? tint : ink2; ctx.lineWidth = isPinch ? 3 : 1.25;
    ctx.setLineDash(isPinch ? [] : [3, 3]);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
    [[ax, ay], [bx, by]].forEach(([x, y]) => { ctx.fillStyle = tint; ctx.beginPath(); ctx.arc(x, y, 6, 0, 6.283); ctx.fill(); });
    ctx.fillStyle = ink; ctx.textAlign = "right";
    ctx.fillText("4 thumb tip", ax - 10, ay);
    ctx.textAlign = "center";
    ctx.fillText("8 index tip, the pointer", bx, by - 16);

    // readout and meter
    const span = spanOf(lm);
    const jx = joystick(lm[TIP_INDEX].x), jy = joystick(lm[TIP_INDEX].y);
    out.innerHTML = `<li>thumb to index <b>${fmt(dist, 3)}</b> ${isPinch ? "<b>pinch</b>" : "open"}</li><li>joystick x <b>${fmt(jx)}</b> y <b>${fmt(jy)}</b></li><li>span <b>${fmt(span, 3)}</b> → depth <b>${fmt(depthOf(span))}</b></li>`;
    const mx = 6 + Math.min(1, dist / 0.2) * 288;
    meter.querySelector(".hf-dot").setAttribute("cx", mx.toFixed(1));
    meter.querySelector(".hf-bar").setAttribute("width", Math.max(0, mx - 6).toFixed(1));
    meter.classList.toggle("is-pinch", isPinch);
    pinchBtn.setAttribute("aria-pressed", String(hand.pinch > 0.5));
    if (!live) scrubOut.textContent = fmt(depthOf(span));
  }

  // ---------- dragging the drawn hand ----------
  let drag = null;
  canvas.style.touchAction = "none";
  const toFrame = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left - box.x) / box.w, y: (e.clientY - r.top - box.y) / box.h };
  };
  canvas.addEventListener("pointerdown", (e) => {
    if (live) return;
    const p = toFrame(e);
    const lm = drawn();
    const near = (i) => Math.hypot((lm[i].x - p.x) * box.w, (lm[i].y - p.y) * box.h) < 22;
    if (near(TIP_INDEX)) drag = { kind: "tip", i: TIP_INDEX, p };
    else if (near(TIP_THUMB)) drag = { kind: "tip", i: TIP_THUMB, p };
    else drag = { kind: "hand", p };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("is-drag");
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) {
      if (live || e.pointerType !== "mouse") return;
      const p = toFrame(e); const lm = drawn();
      const n = [TIP_INDEX, TIP_THUMB].some((i) => Math.hypot((lm[i].x - p.x) * box.w, (lm[i].y - p.y) * box.h) < 22);
      canvas.style.cursor = n ? "grab" : "move";
      return;
    }
    const p = toFrame(e);
    const dx = p.x - drag.p.x, dy = p.y - drag.p.y;
    drag.p = p;
    if (drag.kind === "hand") {
      hand.ox = clamp(hand.ox + dx, 0.08, 0.92); hand.oy = clamp(hand.oy + dy, 0.3, 1.05);
    } else {
      const i = drag.i;
      if (i === TIP_THUMB && hand.pinch > 0) { hand.pinch = 0; }
      extra[i][0] += dx / hand.s; extra[i][1] += dy / hand.s;
      extra[i - 1][0] += dx / hand.s * 0.5; extra[i - 1][1] += dy / hand.s * 0.5;
    }
    dirty = true;
  });
  const end = () => { drag = null; canvas.classList.remove("is-drag"); };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("keydown", (e) => {
    if (live) return;
    const k = { ArrowLeft: [-0.03, 0], ArrowRight: [0.03, 0], ArrowUp: [0, -0.03], ArrowDown: [0, 0.03] }[e.key];
    if (k) { hand.ox = clamp(hand.ox + k[0], 0.08, 0.92); hand.oy = clamp(hand.oy + k[1], 0.3, 1.05); dirty = true; e.preventDefault(); }
    if (e.key === "p" || e.key === "P") { pinchBtn.click(); e.preventDefault(); }
  });

  let pinchStop = () => {};
  pinchBtn.addEventListener("click", () => {
    if (live) return;
    extra[TIP_THUMB] = [0, 0]; extra[3] = [0, 0]; extra[TIP_INDEX] = [0, 0]; extra[7] = [0, 0];
    pinchStop();
    pinchStop = tween(hand, { pinch: hand.pinch > 0.5 ? 0 : 1 }, { duration: 0.35, ease: "power2.inOut", onUpdate: () => { dirty = true; } });
  });
  scrub.addEventListener("input", () => { hand.s = +scrub.value; dirty = true; });
  fig.querySelector("[data-hf-reset]").addEventListener("click", () => {
    hand.ox = 0.5; hand.oy = 0.84; hand.s = 0.55; hand.pinch = 0; scrub.value = "0.55";
    extra.forEach((e) => { e[0] = 0; e[1] = 0; });
    dirty = true;
  });

  // ---------- your hand, when hand control is on ----------
  document.addEventListener("hand:move", ({ detail: d }) => {
    if (d.active && d.landmarks) {
      live = d.landmarks.map((p) => ({ x: 1 - p.x, y: p.y }));
      state.textContent = "Your hand, live.";
      fig.classList.add("is-live-hand");
    } else if (live) {
      live = null;
      state.textContent = d.off ? "" : "Hold up one hand to see it here.";
      fig.classList.remove("is-live-hand");
    }
    dirty = true;
  });

  let stop = null;
  const loop = () => { if (dirty) { dirty = false; draw(); } };
  Study.onVisible(fig, () => { dirty = true; if (!stop) stop = Study.raf(loop); }, () => { if (stop) { stop(); stop = null; } });
  new ResizeObserver(() => { dirty = true; }).observe(canvas);
  draw();
}
