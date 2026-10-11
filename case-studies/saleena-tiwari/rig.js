/* The showcase's own maths, ported line for line so every figure on this page
   runs on the real numbers. No three.js in here: plain functions, so the 2D
   plots and the 3D scenes share one source of truth.

   Source: the showcase (sculpture-memories)
     web/src/camera-path.js   the camera table and sampleCamera()
     web/src/cards.js         the shipped card sweep (updateCards)
     web/src/main.js          warpScroll (the opening spring), smoothing, flex
   and its first version for the static staircase and the earlier camera
   table. */

export const DEG = Math.PI / 180;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smoothstep01 = (k) => k * k * (3 - 2 * k);

/* ---------- camera (camera-path.js:9-33) ---------- */
// t, orbit deg, dist m, camY, tgtY, lens mm
export const CAMERA_PATH = [
  [0.000, 60, 10.77, 0.20, 0.62, 60],
  [0.060, 64, 10.35, 0.28, 0.70, 62],
  [0.120, 72, 9.95, 0.38, 0.80, 64],
  [0.250, 120, 9.72, 0.62, 1.00, 68],
  [0.375, 170, 9.55, 0.88, 1.18, 72],
  [0.500, 220, 9.35, 1.10, 1.30, 76],
  [0.625, 270, 8.90, 1.20, 1.31, 80],
  [0.750, 320, 8.45, 1.25, 1.29, 84],
  [0.875, 370, 8.00, 1.26, 1.26, 88],
  [1.000, 420, 7.56, 1.25, 1.25, 92],
];
// The first version's table: the turn started at once.
export const CAMERA_PATH_V1 = [
  [0.000, 60, 10.77, 0.20, 0.62, 60],
  [0.125, 105, 10.53, 0.45, 0.82, 64],
  [0.250, 150, 10.33, 0.70, 1.04, 68],
  [0.375, 195, 10.16, 0.95, 1.23, 72],
  [0.500, 240, 9.91, 1.15, 1.34, 76],
  [0.625, 285, 9.14, 1.22, 1.31, 80],
  [0.750, 330, 8.49, 1.26, 1.28, 84],
  [0.875, 375, 8.02, 1.26, 1.26, 88],
  [1.000, 420, 7.56, 1.25, 1.25, 92],
];
export const SENSOR_V = 20.25; // mm, 16:9 crop of a 36mm sensor (camera-path.js:35)
export const lensToFov = (lens) => 2 * Math.atan(SENSOR_V / (2 * lens)) / DEG; // camera-path.js:37

// camera-path.js:42-72. Linear between keys: constant orbit speed per segment.
export function sampleCamera(t, path = CAMERA_PATH) {
  t = clamp(t);
  let a = path[0], b = path[path.length - 1];
  for (let i = 0; i < path.length - 1; i++) {
    if (t >= path[i][0] && t <= path[i + 1][0]) { a = path[i]; b = path[i + 1]; break; }
  }
  const span = b[0] - a[0];
  const u = span === 0 ? 0 : (t - a[0]) / span;
  const lerp = (i) => a[i] + (b[i] - a[i]) * u;
  const orbit = lerp(1), dist = lerp(2), camY = lerp(3), tgtY = lerp(4), lens = lerp(5);
  const rad = orbit * DEG;
  return { orbit, dist, camY, tgtY, lens, fov: lensToFov(lens), x: dist * Math.sin(rad), y: camY, z: dist * Math.cos(rad) };
}

/* ---------- the opening spring (main.js:418-432) ---------- */
export const SPRING_SCROLL = 0.055;
export function warpScroll(t, springTo = 0.19) {
  if (t <= 0) return 0;
  if (t >= SPRING_SCROLL) return springTo + (t - SPRING_SCROLL) * (1 - springTo) / (1 - SPRING_SCROLL);
  const k = t / SPRING_SCROLL;
  return springTo * (1 - Math.pow(1 - k, 3)); // cubic ease-out
}
export function unwarpScroll(r, springTo = 0.19) {
  if (r <= 0) return 0;
  if (r >= springTo) return SPRING_SCROLL + (r - springTo) * (1 - SPRING_SCROLL) / (1 - springTo);
  const k = 1 - Math.cbrt(1 - r / springTo);
  return k * SPRING_SCROLL;
}

/* ---------- shipped cards (cards.js:31-167) ---------- */
export const K = {
  R_BASE: 1.55, R_TIGHT: 1.00, R_DRAW_IN: 1.00,
  ASPECT_REF: 1.6, R_FIT_MIN: 0.46, CARD_MAX_W: 0.82,
  BIRTH_DIP: 1.90, BIRTH_SPAN: 0.17,
  ROCK_TOP: 0.12, ROCK_FADE: 0.55, R_ROCK_CLEAR: 2.05,
  WIND: 360, OFFSET: -10,
  Y_START: 0.05, Y_END: 2.75, Y_POW: 1.0,
  S_MIN: 0.150, S_MAX: 0.400, PEAK_SHARP: 1.5,
  LIFE_SPAN: 0.24, TARGET_REF: 0.91, FOCUS_FIRST: 0.19, FOCUS_LAST: 0.78,
  BILLBOARD: 0, SWEEP_FROM: -135, SWEEP_ARC: -800, FOCUS_OUT_DEG: 135,
  LEAN_MAX: 0.23, BEND_SLACK: 4.3, SAG: 0.015,
  H: 0.66, W: 0.66 * 16 / 9,
};

// cards.js:159-167
export function focusTiming(sweepFrom = K.SWEEP_FROM) {
  const uFocus = (-360 - sweepFrom) / K.SWEEP_ARC;
  return { sweepFrom, uFocus, uFocusOut: (-360 - K.FOCUS_OUT_DEG - sweepFrom) / K.SWEEP_ARC, envAtFocus: 1 };
}

// cards.js:173-179
export function rng(seed) {
  let s = (seed * 9301 + 49297) % 233280;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

// cards.js:227-314 (layoutCards), the parts that are not textures. The rand()
// calls keep their original order so every card gets its original jitter.
export function shippedCards(n = 21) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const rand = rng(i + 7);
    const p = i / Math.max(1, n - 1);
    rand(); // the angle jitter, unused once cards travel (cards.js:233)
    const yJit = (rand() - 0.5) * 0.10;
    const timing = focusTiming(K.SWEEP_FROM);
    const focusAt = K.FOCUS_FIRST + (K.FOCUS_LAST - K.FOCUS_FIRST) * p;
    const phase = focusAt - timing.uFocus * K.LIFE_SPAN;
    const jitY = (rand() - 0.5) * 0.14, jitX = (rand() - 0.5) * 0.08, jitZ = (rand() - 0.5) * 0.07;
    out.push({ i, phase, focusAt, ...timing, yJit, jitX, jitY, jitZ });
  }
  return out;
}

/* updateCards for one card (cards.js:341-541), without three.js.
   cam: { x, y, z, fov, aspect }, scroll: the ROPE time (already warped),
   targetY: the camera's aim height. Returns where the card is and how big. */
export function shippedCard(c, cam, scroll, targetY = K.TARGET_REF) {
  const u = (scroll - c.phase) / K.LIFE_SPAN;
  if (!(u >= 0 && u <= 1)) return { on: false, u, focus: 0 };
  const camAz = Math.atan2(cam.x, cam.z);
  const phiDeg = c.sweepFrom + K.SWEEP_ARC * u;
  const phi = phiDeg * DEG;
  const az = camAz + phi;

  const birthSpan = Math.min(K.BIRTH_SPAN, c.uFocus * 0.7);
  const birth = 1 - Math.min(1, u / Math.max(1e-4, birthSpan));
  const dip = K.BIRTH_DIP * birth * birth * birth;
  const aim = targetY - K.TARGET_REF;
  const y = K.Y_START + (K.Y_END - K.Y_START) * Math.pow(u, K.Y_POW) + c.yJit - dip + aim;

  const draw = Math.min(1, u / K.R_DRAW_IN);
  const cone = K.R_BASE + (K.R_TIGHT - K.R_BASE) * smoothstep01(draw);
  const low = 1 - clamp((y - K.ROCK_TOP) / K.ROCK_FADE);
  let radius = cone + Math.max(0, K.R_ROCK_CLEAR - cone) * smoothstep01(low);
  radius *= K.R_FIT_MIN + (1 - K.R_FIT_MIN) * Math.min(1, cam.aspect / K.ASPECT_REF);

  const x = Math.sin(az) * radius, z = Math.cos(az) * radius;

  const frontR = (1 + Math.cos(phi)) / 2;
  let straighten;
  if (u <= c.uFocus) straighten = Math.pow(frontR, K.PEAK_SHARP);
  else { const kb = Math.min(1, (u - c.uFocus) / Math.max(1e-4, c.uFocusOut - c.uFocus)); straighten = 1 - smoothstep01(kb); }
  const bank = K.LEAN_MAX * (1 - straighten) * Math.sign(K.SWEEP_ARC);

  const frontness = (1 + Math.cos(phi)) / 2;
  const rise = Math.min(1, u / Math.max(1e-4, c.uFocus));
  const env = smoothstep01(rise);
  let hump;
  if (u <= c.uFocus) hump = Math.pow(frontness, K.PEAK_SHARP) * env;
  else { const k = (u - c.uFocus) / Math.max(1e-4, 1 - c.uFocus); hump = c.envAtFocus * (1 - smoothstep01(k)); }
  let targetH = K.S_MIN + (K.S_MAX - K.S_MIN) * hump;
  targetH = Math.min(targetH, K.CARD_MAX_W * cam.aspect / (16 / 9));
  const d = Math.hypot(cam.x - x, cam.y - y, cam.z - z);
  const frameH = 2 * d * Math.tan(cam.fov * DEG / 2);
  const scale = (targetH * frameH) / K.H;

  let focus;
  if (u <= c.uFocus) focus = Math.pow(frontness, K.PEAK_SHARP) * Math.min(1, env / 0.55);
  else { const k = Math.min(1, (u - c.uFocus) / Math.max(1e-4, c.uFocusOut - c.uFocus)); focus = 1 - smoothstep01(k); }

  return {
    on: true, u, phiDeg, x, y, z, radius, scale, targetH, frontness, env, hump, focus,
    rotX: c.jitX, rotY: az + c.jitY, rotZ: c.jitZ + bank, flat: Math.pow(straighten, 0.75),
  };
}

/* The size rule on its own, for plotting: on-screen height at life u. */
export function sizeAt(u, c = focusTiming()) {
  if (u < 0 || u > 1) return null;
  const phi = (c.sweepFrom + K.SWEEP_ARC * u) * DEG;
  const frontness = (1 + Math.cos(phi)) / 2;
  const env = smoothstep01(Math.min(1, u / c.uFocus));
  let hump;
  if (u <= c.uFocus) hump = Math.pow(frontness, K.PEAK_SHARP) * env;
  else { const k = (u - c.uFocus) / (1 - c.uFocus); hump = 1 - smoothstep01(k); }
  return { h: K.S_MIN + (K.S_MAX - K.S_MIN) * hump, frontness, env, hump };
}

/* ---------- the static staircase of the first version (cards.js) ---------- */
export const S3 = { RADIUS: 1.8, WIND: 360, OFFSET: -10, Y0: -0.55, Y_TOP: 3.05, AHEAD: 180, BEHIND: 180 };
export function staticCards(n = 21) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const rand = rng(i + 7);
    const p = i / Math.max(1, n - 1);
    const angle = (60 + S3.OFFSET + S3.WIND * p) * DEG + (rand() - 0.5) * 0.05;
    const y = S3.Y0 + (S3.Y_TOP - S3.Y0) * p + (rand() - 0.5) * 0.06;
    const jy = (rand() - 0.5) * 0.14, jx = (rand() - 0.5) * 0.08, jz = (rand() - 0.5) * 0.07;
    out.push({ i, p, angle, x: Math.sin(angle) * S3.RADIUS, y, z: Math.cos(angle) * S3.RADIUS, jx, jy, jz });
  }
  return out;
}
// visibility window and the old size rule (first version, cards.js updateCards)
export function staticVisible(c, scroll) {
  const j = (scroll - c.p) * S3.WIND;
  return { on: j > -S3.AHEAD && j < S3.BEHIND, u: (j + S3.AHEAD) / (S3.AHEAD + S3.BEHIND) };
}
// ndc: the card centre projected to clip space. Scale multiplies a 0.66m card.
export function staticScale(ndcX, ndcY) {
  const dCentre = Math.min(1, Math.hypot(ndcX, ndcY * 0.85));
  const t = 1 - dCentre;
  return 0.5 + 0.85 * smoothstep01(t);
}

/* ---------- projection without three.js, for the 2D figures ---------- */
// A look-at camera: returns project(x,y,z) -> {x, y, w} in NDC, w = view depth.
export function makeView(cam, tgtY, aspect) {
  const ex = cam.x, ey = cam.y, ez = cam.z;
  let fx = 0 - ex, fy = tgtY - ey, fz = 0 - ez;
  const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  // right = forward x up(0,1,0)
  let rx = -fz, ry = 0, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
  // up = right x forward
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  const f = 1 / Math.tan(cam.fov * DEG / 2);
  return (x, y, z) => {
    const dx = x - ex, dy = y - ey, dz = z - ez;
    const vx = dx * rx + dy * ry + dz * rz, vy = dx * ux + dy * uy + dz * uz, vz = dx * fx + dy * fy + dz * fz;
    return { x: (vx * f / aspect) / vz, y: (vy * f) / vz, w: vz };
  };
}

/* ---------- one shared progress for the linked figures ---------- */
const subs = new Set();
export const progress = {
  t: 0,
  set(v, from) { v = clamp(v); if (v === this.t) return; this.t = v; subs.forEach((fn) => fn(v, from)); },
  on(fn) { subs.add(fn); return () => subs.delete(fn); },
};

export const fmt = (v, d = 2) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(d);
