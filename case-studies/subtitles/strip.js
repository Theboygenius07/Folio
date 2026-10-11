/* Fig. 5: the horizontal view and its spring, with the spring drawn as it runs.
   The strip is Subtitles/views/horizontal.js: the same card sizes, the same lerp while
   the wheel moves, the same spring after it stops, the same ticker. It runs at the
   site's fixed 60 steps a second so the numbers match. Drag is added here; the site
   used the wheel, the arrow keys and a 30 px swipe. */
import { WEEKS } from "./data.js";
import { cloudinaryUrl, fitCanvas, css, fmt, clamp } from "./util.js";

const K = 240, D = 30, HZ = 60;      // horizontal.js:73, vel += (dx * 240 - vel * 30) / 60
const LERP = 0.15;                    // horizontal.js:69
const WHEEL = 0.005;                  // horizontal.js:174
const SETTLE_MS = 150;                // horizontal.js:184
const HISTORY = 4;                    // seconds drawn in the plot

export function initStrip(fig) {
  const stage = fig.querySelector(".strip-stage");
  const track = fig.querySelector(".strip-track");
  const ticker = fig.querySelector(".strip-ticker");
  const plot = fig.querySelector(".strip-plot canvas");
  const out = fig.querySelector("[data-strip-readout]");
  const photos = WEEKS;
  const N = photos.length;

  let lerpPos = 2, rawTarget = 2, snapIndex = 2, vel = 0, isWheeling = false, wheelEnd = null;
  let acc = 0, running = false, stopLoop = null, visible = false, playing = false;
  const hist = [];   // {t, pos, target, vel, phase}

  const cards = photos.map((p, i) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "strip-card";
    card.setAttribute("aria-label", `Week ${p.week}`);
    card.tabIndex = -1;
    const img = document.createElement("img");
    img.alt = "";
    img.draggable = false;
    img.addEventListener("load", () => img.classList.add("loaded"));
    card.appendChild(img);
    card._img = img; card._loaded = false; card._hi = false;
    card.addEventListener("click", (e) => { if (dragMoved > 5) return; navigate(i); });
    track.appendChild(card);
    return card;
  });
  const ticks = photos.map(() => { const t = document.createElement("i"); ticker.appendChild(t); return t; });

  /* horizontal.js:96-149 */
  let dims = null;
  function measure() {
    const vw = stage.clientWidth;
    const ACTIVE_W = Math.min(960, Math.round(vw * 0.70));
    const INACT_W = Math.min(480, Math.round(vw * 0.35));
    const SLOT = Math.round((ACTIVE_W + INACT_W) / 2 + 24);
    dims = { vw, ACTIVE_W, INACT_W, SLOT, sh: stage.clientHeight };
    cards.forEach((c) => { c._hi = false; });
  }
  function render() {
    if (!dims) measure();
    const { vw, ACTIVE_W, INACT_W, SLOT, sh } = dims;
    const activeIdx = Math.round(lerpPos);
    cards.forEach((card, i) => {
      const dist = Math.abs(i - lerpPos);
      if (dist > 4) { card.style.visibility = "hidden"; return; }
      card.style.visibility = "visible";
      const t = Math.max(0, 1 - dist);
      const w = Math.round(INACT_W + (ACTIVE_W - INACT_W) * t);
      const h = Math.round(w * 9 / 16);
      const x = Math.round(vw / 2 + (i - lerpPos) * SLOT - w / 2);
      const y = Math.round((sh - h) / 2);
      card.style.transform = `translate(${x}px,${y}px)`;
      card.style.width = w + "px";
      card.style.height = h + "px";
      card.style.zIndex = Math.round(50 - dist * 10);
      card.style.opacity = dist > 3.5 ? "0" : dist > 2.5 ? "0.5" : "1";
      card.classList.toggle("is-active", i === activeIdx);
      if (!card._loaded && dist <= 3) { card._img.src = cloudinaryUrl(photos[i].url, INACT_W); card._loaded = true; }
      if (!card._hi && dist < 0.5) { card._img.src = cloudinaryUrl(photos[i].url, ACTIVE_W); card._hi = true; }
    });
    ticks.forEach((el, i) => {   // horizontal.js:140-148, the bell curve
      const dist = Math.abs(i - lerpPos);
      const t = Math.max(0, 1 - dist / 4.5);
      el.style.height = (21.5 + (68.8 - 21.5) * t * t).toFixed(2) + "px";
      el.style.opacity = dist < 0.5 ? "1" : (0.22 + 0.56 * t * t).toFixed(3);
      el.classList.toggle("is-on", dist < 0.5);
    });
  }

  /* one fixed step of horizontal.js:65-82 */
  function step() {
    let done;
    if (isWheeling) {
      lerpPos += (rawTarget - lerpPos) * LERP;
      done = Math.abs(rawTarget - lerpPos) < 0.0005;
    } else {
      const dx = snapIndex - lerpPos;
      vel += (dx * K - vel * D) / HZ;
      lerpPos += vel / HZ;
      done = Math.abs(dx) < 0.0005 && Math.abs(vel) < 0.0005;
      if (done) { lerpPos = snapIndex; vel = 0; }
    }
    return done;
  }

  let clock = 0, quiet = 0;
  function loop(t, dt) {
    if (!visible) { stopLoop = null; return false; }
    acc += dt;
    let settled = false;
    while (acc >= 1 / HZ) {
      acc -= 1 / HZ;
      clock += 1 / HZ;
      settled = running ? step() : true;
      if (settled && running) { running = false; playing = false; }
      hist.push({ t: clock, pos: lerpPos, target: isWheeling ? rawTarget : snapIndex, snap: snapIndex, vel, phase: running ? (isWheeling ? 1 : 2) : 0 });
    }
    while (hist.length && hist[0].t < clock - HISTORY) hist.shift();
    if (running || quiet < 1) render();
    if (running || quiet < HISTORY + 0.25) drawPlot();   // once the trace is flat, stop drawing it
    quiet = running ? 0 : quiet + dt;
    writeOut();
  }
  const kick = () => {
    if (Study.reduce && !playing && !isWheeling) {   // no spring for reduced motion
      lerpPos = snapIndex; vel = 0; running = false; render(); drawPlot(); writeOut();
      return;
    }
    running = true;
    if (visible && !stopLoop) stopLoop = Study.raf(loop);
  };

  function navigate(idx) {   // horizontal.js:85-93
    const next = clamp(idx, 0, N - 1);
    if (next === snapIndex && !isWheeling && !running) return;
    snapIndex = next; rawTarget = next; isWheeling = false; vel = 0;
    kick();
  }
  function wheelish(delta) {  // horizontal.js:171-187
    rawTarget = clamp(rawTarget + delta, 0, N - 1);
    snapIndex = Math.round(rawTarget);
    isWheeling = true;
    clearTimeout(wheelEnd);
    wheelEnd = setTimeout(() => { rawTarget = snapIndex; isWheeling = false; kick(); }, SETTLE_MS);
    kick();
  }

  // wheel: only sideways scrolling (or shift + wheel) moves the strip; up and down scroll the page
  stage.addEventListener("wheel", (e) => {
    const side = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    if (!side && !e.shiftKey) return;
    e.preventDefault();
    wheelish((side ? e.deltaX : e.deltaY) * WHEEL);
  }, { passive: false });

  // drag
  let drag = null, dragMoved = 0;
  stage.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button > 0) return;
    drag = { x: e.clientX, start: rawTarget, id: e.pointerId };
    dragMoved = 0;
  });
  stage.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    dragMoved = Math.max(dragMoved, Math.abs(dx));
    if (dragMoved < 6) return;
    if (!stage.hasPointerCapture(e.pointerId)) stage.setPointerCapture(e.pointerId);
    rawTarget = clamp(drag.start - dx / dims.SLOT, 0, N - 1);
    snapIndex = Math.round(rawTarget);
    isWheeling = true;
    clearTimeout(wheelEnd);
    kick();
  });
  const release = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    if (dragMoved >= 6) {
      clearTimeout(wheelEnd);
      wheelEnd = setTimeout(() => { rawTarget = snapIndex; isWheeling = false; kick(); }, SETTLE_MS);
    }
  };
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);
  stage.addEventListener("keydown", (e) => {   // horizontal.js:152-156
    if (e.key === "ArrowRight") navigate(snapIndex + 1);
    else if (e.key === "ArrowLeft") navigate(snapIndex - 1);
    else return;
    e.preventDefault();
  });
  fig.querySelector("[data-strip-prev]").addEventListener("click", () => navigate(snapIndex - 1));
  fig.querySelector("[data-strip-next]").addEventListener("click", () => navigate(snapIndex + 1));
  fig.querySelector("[data-strip-nudge]").addEventListener("click", () => {
    clearTimeout(wheelEnd);
    isWheeling = false; rawTarget = snapIndex;
    lerpPos = snapIndex + (snapIndex < N - 1 ? 0.45 : -0.45);
    vel = 0; playing = true;
    kick();
  });

  // hand: lean left or right (horizontal.js:190-201)
  fig.addEventListener("hand", ({ detail: d }) => {
    if (!d.active) return;
    d.hint = "Lean left or right to slide.";
    if (d.pinch || Math.abs(d.joyX) < 0.04) return;
    rawTarget = clamp(rawTarget + d.joyX * 0.20, 0, N - 1);
    snapIndex = Math.round(rawTarget);
    isWheeling = true;
    clearTimeout(wheelEnd);
    wheelEnd = setTimeout(() => { rawTarget = snapIndex; isWheeling = false; kick(); }, SETTLE_MS);
    kick();
  });

  // ---------- the plot ----------
  function drawPlot() {
    const { ctx, w, h } = fitCanvas(plot);
    ctx.clearRect(0, 0, w, h);
    const ink = css("--ink"), ink2 = css("--ink-2"), ink3 = css("--ink-3"), tint = css("--tint-ink"), hl = css("--hl");
    const small = w < 520;
    const padL = small ? 6 : 64, padR = 8;
    const laneH = (h - 26) / 2;
    const top1 = 4, top2 = top1 + laneH + 18;
    const now = clock;
    const tx = (t) => padL + (1 - (now - t) / HISTORY) * (w - padL - padR);
    ctx.font = `500 11px ${css("--font")}`;
    ctx.textBaseline = "middle";

    // phase bands: lerp while the wheel or a drag is moving, spring after
    for (let i = 1; i < hist.length; i++) {
      const a = hist[i - 1], b = hist[i];
      if (b.phase === 1) { ctx.fillStyle = hl; ctx.fillRect(tx(a.t), top1, tx(b.t) - tx(a.t) + 0.5, h - top1 - 4); }
    }
    // lane frames
    ctx.strokeStyle = css("--rule"); ctx.lineWidth = 1;
    [[top1, laneH], [top2, laneH]].forEach(([y, hh]) => { ctx.beginPath(); ctx.moveTo(padL, y + hh); ctx.lineTo(w - padR, y + hh); ctx.stroke(); });

    // position lane: centred on the photo it is settling to
    const centre = hist.length ? hist[hist.length - 1].snap : snapIndex;
    const span = 1.4;
    const py = (v) => top1 + laneH / 2 - ((v - centre) / span) * (laneH / 2);
    ctx.save();
    ctx.beginPath(); ctx.rect(padL, top1, w - padL - padR, laneH); ctx.clip();
    // whole-photo grid lines
    ctx.strokeStyle = css("--rule");
    for (let k = Math.floor(centre - span); k <= Math.ceil(centre + span); k++) { ctx.beginPath(); ctx.moveTo(padL, py(k)); ctx.lineTo(w - padR, py(k)); ctx.stroke(); }
    // target
    ctx.strokeStyle = ink3; ctx.setLineDash([4, 3]); ctx.beginPath();
    hist.forEach((p, i) => { const x = tx(p.t), y = py(p.target); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke(); ctx.setLineDash([]);
    // position
    ctx.strokeStyle = ink; ctx.lineWidth = 1.75; ctx.beginPath();
    hist.forEach((p, i) => { const x = tx(p.t), y = py(p.pos); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
    ctx.restore();
    if (hist.length) { const p = hist[hist.length - 1]; ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(tx(p.t), py(p.pos), 3.5, 0, 6.283); ctx.fill(); }

    // velocity lane, in photos per second
    const vmax = Math.max(4, ...hist.map((p) => Math.abs(p.vel)));
    const vy = (v) => top2 + laneH / 2 - (v / vmax) * (laneH / 2 - 3);
    ctx.strokeStyle = css("--rule"); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, vy(0)); ctx.lineTo(w - padR, vy(0)); ctx.stroke();
    ctx.strokeStyle = tint; ctx.lineWidth = 1.75; ctx.beginPath();
    hist.forEach((p, i) => { const x = tx(p.t), y = vy(p.vel); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
    if (hist.length) { const p = hist[hist.length - 1]; ctx.fillStyle = tint; ctx.beginPath(); ctx.arc(tx(p.t), vy(p.vel), 3.5, 0, 6.283); ctx.fill(); }

    if (!small) {
      ctx.fillStyle = ink2; ctx.textAlign = "left";
      ctx.fillText("position", 0, top1 + laneH / 2 - 7);
      ctx.fillStyle = ink3; ctx.fillText("photo " + (centre + 1), 0, top1 + laneH / 2 + 8);
      ctx.fillStyle = tint; ctx.fillText("velocity", 0, top2 + laneH / 2);
    } else {
      ctx.fillStyle = ink2; ctx.textAlign = "left";
      ctx.fillText("position", padL + 2, top1 + 8);
      ctx.fillStyle = tint; ctx.fillText("velocity", padL + 2, top2 + 8);
    }
    ctx.fillStyle = ink3; ctx.textAlign = "right";
    ctx.fillText("now", w - padR, h - 6);
    ctx.textAlign = "left";
    ctx.fillText(`−${HISTORY} s`, padL, h - 6);
  }
  let lastOut = "";
  function writeOut() {
    const phase = !running ? "at rest" : isWheeling ? "lerp 0.15" : "spring";
    const html = `<li>position <b>${fmt(lerpPos, 3)}</b></li><li>target <b>${isWheeling ? fmt(rawTarget, 2) : snapIndex}</b></li><li>vel <b>${fmt(vel, 2)}</b>/s</li><li>phase <b>${phase}</b></li>`;
    if (html !== lastOut) { out.innerHTML = html; lastOut = html; }
  }

  new ResizeObserver(() => { measure(); render(); drawPlot(); }).observe(stage);
  Study.onVisible(fig, () => {
    visible = true;
    if (!stopLoop) stopLoop = Study.raf(loop);
  }, () => { visible = false; });
  measure(); render(); drawPlot(); writeOut();
}
