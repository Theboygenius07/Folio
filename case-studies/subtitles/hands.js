/* Hand control for this page. Loaded only when someone presses
   "Control this page with your hand".

   The tracker is Subtitles/components/tracking.js, ported: the same MediaPipe
   HandLandmarker (tasks-vision 0.10.14, one hand, VIDEO mode, GPU if it can), the same
   smoothing, pinch test and depth proxy, and it announces every frame as a
   "hand:move" event on document, as the site did.

   The controller is new, built for a page instead of a full-screen view: the index tip
   moves a cursor, an open hand near the top or bottom of the frame scrolls, a pinch held
   still for a second presses whatever is under the cursor (the site's hold-to-open), and
   the figure under the cursor gets its own "hand" events so the globe can zoom when you
   push and pull, the canvas can be dragged, and the corridor walked. */
import {
  PINCH, DEAD, SMOOTH, HOLD_MS, HOLD_TRAVEL, PAGE_DEAD, TIP_INDEX, TIP_THUMB,
  joystick, pinchDist, spanOf, depthOf, BONES,
} from "./handmath.js";

const VISION = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
// tracking.js:63, the model file the site used
const MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

/* ---------------- tracker (tracking.js:28-149) ---------------- */
let visionP = null;
const getVision = () => {
  if (!visionP) {
    visionP = import(`${VISION}/vision_bundle.mjs`).then(async (mod) => ({
      mod, files: await mod.FilesetResolver.forVisionTasks(`${VISION}/wasm`),
    }));
    visionP.catch(() => { visionP = null; });
  }
  return visionP;
};

const T = {
  active: false, video: null, stream: null, lm: null, raf: 0, last: -1,
  sx: null, sy: null, sz: null, joyX: 0, joyY: 0, pinch: false, hadHand: false,
};

async function startTracker(video, onCamera) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } });
  if (!C.on) { stream.getTracks().forEach((t) => t.stop()); throw new DOMException("stopped", "AbortError"); }
  T.stream = stream;
  video.srcObject = stream;
  video.muted = true; video.playsInline = true; video.autoplay = true;
  await video.play();
  T.video = video;
  onCamera && onCamera();
  const { mod, files } = await getVision();
  const make = (delegate) => mod.HandLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: MODEL, delegate },
    runningMode: "VIDEO",
    numHands: 1,
  });
  try { T.lm = await make("GPU"); } catch (e) { T.lm = await make("CPU"); }
  if (!T.stream) { T.lm.close(); T.lm = null; throw new DOMException("stopped", "AbortError"); }
  T.active = true;
  loop();
}

function stopTracker() {
  T.active = false;
  cancelAnimationFrame(T.raf);
  T.stream && T.stream.getTracks().forEach((t) => t.stop());
  T.stream = null;
  if (T.video) T.video.srcObject = null;
  T.lm && T.lm.close();
  T.lm = null;
  T.sx = T.sy = T.sz = null;
  T.joyX = T.joyY = 0; T.pinch = false;
  emit({ joyX: 0, joyY: 0, pinch: false, active: false, off: true });
}

function loop() {
  if (!T.active) return;
  const now = performance.now();
  if (T.video && T.video.readyState >= 2 && now !== T.last) {
    T.last = now;
    let res = null;
    try { res = T.lm.detectForVideo(T.video, now); } catch (e) { res = null; }
    if (res && res.landmarks && res.landmarks.length) {
      const lm = res.landmarks[0];
      const tip = lm[TIP_INDEX], thb = lm[TIP_THUMB];
      T.sx = (T.sx ?? tip.x) * (1 - SMOOTH) + tip.x * SMOOTH;     // tracking.js:105
      T.sy = (T.sy ?? tip.y) * (1 - SMOOTH) + tip.y * SMOOTH;     // tracking.js:106
      T.joyX = T.joyX * 0.55 + joystick(1 - T.sx) * 0.45;          // tracking.js:112-114
      T.joyY = T.joyY * 0.55 + joystick(T.sy) * 0.45;              // tracking.js:113-115
      const was = T.pinch;
      const dist = pinchDist(lm);
      T.pinch = dist < PINCH;                                       // tracking.js:118
      const span = spanOf(lm);                                      // tracking.js:122-123
      T.sz = (T.sz ?? span) * 0.8 + span * 0.2;                     // tracking.js:124
      T.hadHand = true;
      emit({
        joyX: T.joyX, joyY: T.joyY, rawX: 1 - T.sx, rawY: T.sy, rawZ: depthOf(T.sz),
        pinch: T.pinch, pinchStart: T.pinch && !was, active: true,
        landmarks: lm, dist, span: T.sz,
      });
    } else if (T.hadHand || Math.abs(T.joyX) + Math.abs(T.joyY) > 0.001) {
      T.sx = T.sy = T.sz = null;                                    // tracking.js:136
      T.joyX *= 0.7; T.joyY *= 0.7; T.pinch = false;
      T.hadHand = false;
      emit({ joyX: T.joyX, joyY: T.joyY, pinch: false, active: false });
    }
  }
  T.raf = requestAnimationFrame(loop);
}

const emit = (detail) => document.dispatchEvent(new CustomEvent("hand:move", { detail }));

/* ---------------- the floating camera print, and the cursor ---------------- */
let ui = null;
function buildUI() {
  const wrap = document.createElement("div");
  wrap.className = "hand-ui";
  wrap.setAttribute("data-overlay", "");
  wrap.setAttribute("role", "region");
  wrap.setAttribute("aria-label", "Hand control");
  wrap.innerHTML = `
    <div class="hand-print">
      <div class="hand-cam">
        <video muted playsinline aria-label="Your camera, mirrored. It stays in this browser."></video>
        <canvas class="hand-skel" aria-hidden="true"></canvas>
        <p class="hand-sub" aria-live="polite"><span>- Starting the camera. -</span></p>
      </div>
      <div class="hand-foot">
        <svg class="hand-meter" viewBox="0 0 168 34" aria-hidden="true">
          <line class="hm-track" x1="4" y1="14" x2="164" y2="14"/>
          <g class="hm-ticks"></g>
          <line class="hm-th" x1="0" y1="5" x2="0" y2="23"/>
          <text class="hm-th-t" x="0" y="33">0.06</text>
          <rect class="hm-bar" x="4" y="12.5" width="0" height="3"/>
          <circle class="hm-dot" cx="4" cy="14" r="4"/>
        </svg>
        <p class="hand-num"><span data-hn-dist>thumb to index –</span><span data-hn-z></span></p>
        <button type="button" class="hand-off">Turn off</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  const cursor = document.createElement("div");
  cursor.className = "hand-cursor";
  cursor.setAttribute("aria-hidden", "true");
  cursor.innerHTML = `<svg viewBox="0 0 44 44"><circle class="hc-ring-w" cx="22" cy="22" r="13"/><circle class="hc-ring" cx="22" cy="22" r="13"/><circle class="hc-hold" cx="22" cy="22" r="18" pathLength="100"/><circle class="hc-dot" cx="22" cy="22" r="2.5"/></svg>`;
  document.body.appendChild(cursor);

  // meter scale: 0 to 0.20 of the frame
  const X = (d) => 4 + Math.min(1, d / 0.2) * 160;
  const ticks = wrap.querySelector(".hm-ticks");
  for (let v = 0; v <= 0.2001; v += 0.05) {
    const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
    l.setAttribute("x1", X(v)); l.setAttribute("x2", X(v)); l.setAttribute("y1", 10); l.setAttribute("y2", 18);
    ticks.appendChild(l);
  }
  ["hm-th"].forEach((c) => { const l = wrap.querySelector("." + c); l.setAttribute("x1", X(PINCH)); l.setAttribute("x2", X(PINCH)); });
  wrap.querySelector(".hm-th-t").setAttribute("x", X(PINCH) - 9);

  ui = {
    wrap, cursor, X,
    video: wrap.querySelector("video"),
    skel: wrap.querySelector(".hand-skel"),
    sub: wrap.querySelector(".hand-sub span"),
    dot: wrap.querySelector(".hm-dot"),
    bar: wrap.querySelector(".hm-bar"),
    dist: wrap.querySelector("[data-hn-dist]"),
    z: wrap.querySelector("[data-hn-z]"),
    hold: cursor.querySelector(".hc-hold"),
  };
  wrap.querySelector(".hand-off").addEventListener("click", () => toggle(false));
  return ui;
}

let subText = "";
function say(t) {
  if (!ui || t === subText) return;
  subText = t;
  ui.sub.textContent = `- ${t} -`;   // set like the lines burned into the photos
}

function drawSkeleton(lm, pinch) {
  const c = ui.skel;
  const r = c.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  if (c.width !== Math.round(r.width * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, r.width, r.height);
  if (!lm) return;
  // the video is mirrored with CSS, so mirror the points to match
  const P = (p) => [(1 - p.x) * r.width, p.y * r.height];
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  BONES.forEach(([a, b]) => { const [x1, y1] = P(lm[a]); const [x2, y2] = P(lm[b]); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); });
  ctx.stroke();
  ctx.fillStyle = "#fff";
  lm.forEach((p) => { const [x, y] = P(p); ctx.beginPath(); ctx.arc(x, y, 1.8, 0, 6.283); ctx.fill(); });
  // thumb tip to index tip: the pinch
  const [ax, ay] = P(lm[TIP_THUMB]); const [bx, by] = P(lm[TIP_INDEX]);
  ctx.strokeStyle = "#ffff00";
  ctx.lineWidth = pinch ? 3 : 1.5;
  ctx.setLineDash(pinch ? [] : [3, 3]);
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#ffff00";
  [[ax, ay], [bx, by]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 6.283); ctx.fill(); });
}

/* ---------------- controller ---------------- */
const C = {
  on: false, x: -100, y: -100, tx: -100, ty: -100, seen: false,
  over: null, hold: null, holdDone: false, lastSay: 0, pageJoy: 0, stopLoop: null,
};
// Reaching the very edge of a webcam frame is awkward, so the middle 84% of it covers the window.
const MARGIN = 0.08;
const toScreen = (v) => Math.max(0, Math.min(1, (v - MARGIN) / (1 - 2 * MARGIN)));

function clickAt(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return;
  const ctl = el.closest("button, a[href], [role='tab'], input, select, label, summary");
  if (ctl) { ctl.focus({ preventScroll: true }); ctl.click(); return; }
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window }));
}

function onHandMove({ detail: d }) {
  if (!C.on || !ui) return;
  if (d.off) return;
  if (!d.active) {
    C.seen = false;
    ui.cursor.classList.remove("is-on", "is-pinch");
    drawSkeleton(null);
    if (C.over) { C.over.dispatchEvent(new CustomEvent("hand:leave")); C.over = null; }
    C.hold = null; C.pageJoy = 0;
    say(T.active ? "Hold up one hand." : "Starting the camera.");
    ui.dist.textContent = "thumb to index –";
    ui.z.textContent = "";
    ui.hold.style.strokeDashoffset = 100;
    return;
  }
  // cursor target from the smoothed, mirrored index tip (globe.js:353-354)
  C.tx = toScreen(d.rawX) * innerWidth;
  C.ty = toScreen(d.rawY) * innerHeight;
  if (!C.seen) { C.seen = true; C.x = C.tx; C.y = C.ty; }
  ui.cursor.classList.add("is-on");
  ui.cursor.classList.toggle("is-pinch", d.pinch);
  drawSkeleton(d.landmarks, d.pinch);

  // the meter
  const dist = d.dist ?? 1;
  const xd = ui.X(dist);
  ui.dot.setAttribute("cx", xd.toFixed(1));
  ui.bar.setAttribute("width", Math.max(0, xd - 4).toFixed(1));
  ui.wrap.classList.toggle("is-pinch", d.pinch);
  ui.dist.textContent = `thumb to index ${dist.toFixed(3)}`;
  ui.z.textContent = d.rawZ !== undefined ? ` · depth ${d.rawZ.toFixed(2)}` : "";

  // which figure is under the cursor
  const el = document.elementFromPoint(C.x, C.y);
  const fig = el && el.closest("[data-hand]");
  if (fig !== C.over) {
    if (C.over) C.over.dispatchEvent(new CustomEvent("hand:leave"));
    C.over = fig;
  }
  const detail = { ...d, cx: C.x, cy: C.y, claimScroll: false, hint: "" };
  if (fig) fig.dispatchEvent(new CustomEvent("hand", { detail }));

  // hold to press (freeform.js:443-471): a second, travelling less than 60 px
  const now = performance.now();
  if (d.pinchStart || (d.pinch && !C.hold)) { C.hold = { t: now, x: C.x, y: C.y, max: 0 }; C.holdDone = false; }
  if (d.pinch && C.hold) {
    C.hold.max = Math.max(C.hold.max, Math.hypot(C.x - C.hold.x, C.y - C.hold.y));
    const p = C.hold.max < HOLD_TRAVEL ? Math.min(1, (now - C.hold.t) / HOLD_MS) : 0;
    ui.hold.style.strokeDashoffset = (100 - p * 100).toFixed(1);
    if (p >= 1 && !C.holdDone) {
      C.holdDone = true;
      const ev = new CustomEvent("hand:hold", { cancelable: true, detail: { x: C.x, y: C.y } });
      if (document.dispatchEvent(ev)) clickAt(C.x, C.y);
      say("Pressed.");
      C.lastSay = now;
    } else if (!C.holdDone) {
      say(C.hold.max >= HOLD_TRAVEL ? "Pinch and move to drag." : "Pinch. Hold still to press.");
    }
  } else if (!d.pinch) {
    C.hold = null;
    ui.hold.style.strokeDashoffset = 100;
  }

  // open hand near the top or bottom of the frame scrolls the page
  C.pageJoy = !d.pinch && !detail.claimScroll ? joystick(d.rawY, PAGE_DEAD) : 0;
  if (!d.pinch && now - C.lastSay > 600) {
    if (detail.hint) say(detail.hint);
    else if (C.pageJoy > 0.02) say("Scrolling down.");
    else if (C.pageJoy < -0.02) say("Scrolling up.");
    else say("Open hand. Point, then pinch.");
  }
}

function frame(t, dt) {
  if (!C.on) { C.stopLoop = null; return false; }
  const f = dt * 60;
  // cursor follows at 0.28 a frame (globe.js:333)
  const k = Study.reduce ? 1 : 1 - (1 - 0.28) ** f;
  C.x += (C.tx - C.x) * k;
  C.y += (C.ty - C.y) * k;
  if (ui) ui.cursor.style.transform = `translate(${C.x.toFixed(1)}px, ${C.y.toFixed(1)}px)`;
  if (C.seen && Math.abs(C.pageJoy) > 0.001) window.scrollBy({ top: C.pageJoy * 14 * f, behavior: "instant" });
}

/* ---------------- the toggle ---------------- */
const toggles = () => [...document.querySelectorAll("[data-hand-toggle]")];
const msg = (t) => document.querySelectorAll("[data-hand-msg]").forEach((m) => { m.textContent = t; m.hidden = !t; });
const label = (state) => toggles().forEach((b) => {
  b.setAttribute("aria-pressed", String(state === "on"));
  b.textContent = state === "on" ? "Turn off hand control" : state === "loading" ? "Starting the camera" : "Control this page with your hand";
  b.disabled = state === "loading";
});

let busy = false;
export async function toggle(want = !C.on) {
  if (!want) {
    C.on = false;
    if (C.stopLoop) { C.stopLoop(); C.stopLoop = null; }
    stopTracker();
    if (ui) { ui.wrap.classList.remove("is-on"); ui.cursor.classList.remove("is-on", "is-pinch"); }
    if (C.over) { C.over.dispatchEvent(new CustomEvent("hand:leave")); C.over = null; }
    document.documentElement.classList.remove("hand-on");
    label("off");
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    msg("This browser won't share a camera with the page, so hand control is off here. Everything works with a mouse, a finger or the keys.");
    return;
  }
  if (busy) return;
  busy = true;
  msg("");
  label("loading");
  if (!ui) buildUI();
  ui.wrap.classList.add("is-on");
  say("Starting the camera.");
  C.on = true;
  document.documentElement.classList.add("hand-on");
  if (!C.stopLoop) C.stopLoop = Study.raf(frame);
  try {
    await startTracker(ui.video, () => say("Loading the hand model."));
    say("Hold up one hand.");
    label("on");
  } catch (e) {
    C.on = false;
    stopTracker();
    ui.wrap.classList.remove("is-on");
    document.documentElement.classList.remove("hand-on");
    label("off");
    const n = e && e.name;
    msg(n === "NotAllowedError" || n === "SecurityError"
      ? "The camera wasn't allowed, so hand control stays off. Everything works with a mouse, a finger or the keys."
      : n === "NotFoundError" || n === "OverconstrainedError"
        ? "No camera was found, so hand control stays off. Everything works with a mouse, a finger or the keys."
        : n === "AbortError" ? ""
          : "The hand model didn't load. Check the connection and try again.");
  } finally {
    busy = false;
    if (!C.on && C.stopLoop) { C.stopLoop(); C.stopLoop = null; }
    if (C.on && !C.stopLoop) C.stopLoop = Study.raf(frame);
  }
}

document.addEventListener("hand:move", onHandMove);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && C.on && !document.querySelector(".fc-veil")) toggle(false); });
