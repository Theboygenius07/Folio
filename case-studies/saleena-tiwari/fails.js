/* Fig. 3: five rejected approaches and the one that shipped, as small loops.
   All six run on the real camera path (rig.sampleCamera). Loops 1 to 5 are
   rebuilt from descriptions of the rejected approaches; loop 6 runs the shipped card code (rig.shippedCard,
   ported from cards.js:341-541). */
import { K, sampleCamera, warpScroll, shippedCards, shippedCard, staticCards, staticVisible, makeView, clamp, DEG, rng } from "./rig.js";

const PERIOD = 12; // seconds per loop
const INK = "#1d1b18", INK3 = "#9a958b", PAPER = "#f3f1ea", CARD = "#fbfaf6", HER = "#d6dccf", ROCK = "#3b3f3a", TINT = "#46623d";

const ship = shippedCards(21);
const steps = staticCards(21);

// rotate v by Euler angles, XYZ order (three's default): Rz, then Ry, then Rx
function rotXYZ(v, rx, ry, rz) {
  let [x, y, z] = v;
  let c = Math.cos(rz), s = Math.sin(rz); [x, y] = [x * c - y * s, x * s + y * c];
  c = Math.cos(ry); s = Math.sin(ry); [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(rx); s = Math.sin(rx); [y, z] = [y * c - z * s, y * s + z * c];
  return [x, y, z];
}
// first-version steps: yaw to face out, then local X, then local Z (YXZ)
function rotYXZ(v, rx, ry, rz) {
  let [x, y, z] = v;
  let c = Math.cos(rz), s = Math.sin(rz); [x, y] = [x * c - y * s, x * s + y * c];
  c = Math.cos(rx); s = Math.sin(rx); [y, z] = [y * c - z * s, y * s + z * c];
  c = Math.cos(ry); s = Math.sin(ry); [x, z] = [x * c + z * s, -x * s + z * c];
  return [x, y, z];
}
const corners = (scale) => { const w = (K.W / 2) * scale, h = (K.H / 2) * scale; return [[-w, -h, 0], [w, -h, 0], [w, h, 0], [-w, h, 0]]; };

/* each scene returns a list of things to draw: cards {quad|rect, n, alpha, depth} */
const scenes = {
  // 01: every card flies its own arc. They pop in at full size, bob, swing out
  // past the frame edge and back, and vanish.
  1(t, cam, view) {
    const out = [];
    for (let k = 0; k < 6; k++) {
      const r = rng(k + 31);
      const start = (k / 6 + r() * 0.05) % 1, dur = 0.34 + r() * 0.1;
      let u = (t - start + 1) % 1;
      if (u > dur) continue;
      u /= dur;
      const camAz = Math.atan2(cam.x, cam.z);
      const a = camAz + (-70 + 140 * u + (r() - 0.5) * 30) * DEG * (k % 2 ? 1 : -1);
      const rad = 1.7 + 1.9 * Math.sin(Math.PI * 2 * u + k);          // swings out and back
      const y = 0.4 + 1.6 * u + 0.55 * Math.abs(Math.sin(Math.PI * 3 * u)); // bounces
      out.push(card3d(view, Math.sin(a) * rad, y, Math.cos(a) * rad, 0, a, 0, 1.25, (k * 3 + 2) % 21, 1, XYZ));
    }
    return out;
  },
  // 02: solved on the screen: flat, square to the viewer, perfectly spaced
  2(t) {
    const out = [];
    for (let k = 0; k < 7; k++) {
      const u = ((t * 1.6 + k / 7) % 1);
      const x = -1.25 + 2.5 * u, y = -0.75 + 1.5 * u;
      const d = Math.min(1, Math.hypot(x, y * 0.85));
      const h = 0.15 + 0.25 * (1 - d) * (1 - d);
      out.push({ rect: [x, y, h], n: k + 3, alpha: 1, depth: -1 });
    }
    return out;
  },
  // 03: a shell of cards held in the world, scaled up with the push in
  3(t, cam, view) {
    const zoom = (10.77 / cam.dist) * (cam.lens / 60);
    return steps.filter((c) => staticVisible(c, t).on).map((c) =>
      card3d(view, c.x, c.y, c.z, c.jx, c.angle + c.jy, c.jz, 0.9 * zoom * zoom, c.i, 1, YXZ));
  },
  // 04: the shipped sweep with every card at one height: a ring
  4(t, cam, view) {
    const r = warpScroll(t), cm = { ...cam, aspect: 16 / 11 };
    return ship.map((c) => {
      const s = shippedCard(c, cm, r, cam.tgtY);
      if (!s.on) return null;
      return card3d(view, s.x, 1.0, s.z, s.rotX, s.rotY, s.rotZ, s.scale, c.i, 1, XYZ);
    }).filter(Boolean);
  },
  // 05: cards that never move, faded in and out on scroll slots
  5(t, cam, view) {
    const out = [];
    const slots = [[-0.55, 0.35], [0.5, 0.1], [-0.2, -0.35], [0.35, 0.55], [0.6, -0.4]];
    slots.forEach(([x, y], k) => {
      const u = (t * 2.2 + k / slots.length) % 1;
      const a = Math.sin(Math.PI * u) ** 2;
      out.push({ rect: [x, y, 0.2], n: (k * 4 + 1) % 21, alpha: a, depth: 0, world: true });
    });
    return out;
  },
  // 06: what shipped
  6(t, cam, view) {
    const r = warpScroll(t), cm = { ...cam, aspect: 16 / 11 };
    return ship.map((c) => {
      const s = shippedCard(c, cm, r, cam.tgtY);
      if (!s.on) return null;
      return card3d(view, s.x, s.y, s.z, s.rotX, s.rotY, s.rotZ, s.scale, c.i, 1, XYZ);
    }).filter(Boolean);
  },
};
const XYZ = 0, YXZ = 1;
function card3d(view, x, y, z, rx, ry, rz, scale, n, alpha, order) {
  const q = corners(scale).map((v) => {
    const [a, b, c] = order === XYZ ? rotXYZ(v, rx, ry, rz) : rotYXZ(v, rx, ry, rz);
    return view(x + a, y + b, z + c);
  });
  const ctr = view(x, y, z);
  return { quad: q, n, alpha, depth: ctr.w };
}

export function mountFails(grid) {
  const Study = window.Study;
  const playBtn = document.getElementById("fails-play");
  const items = [...grid.querySelectorAll(".fl")].map((f) => {
    const cv = f.querySelector("canvas");
    return { id: +f.dataset.fail, cv, ctx: cv.getContext("2d"), W: 0, H: 0 };
  });
  const size = () => items.forEach((it) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = it.cv.clientWidth, h = it.cv.clientHeight;
    if (!w || !h) return;
    it.W = w; it.H = h;
    it.cv.width = Math.round(w * dpr); it.cv.height = Math.round(h * dpr);
    it.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  });
  const ro = new ResizeObserver(() => { size(); drawAll(still); });
  items.forEach((it) => ro.observe(it.cv));
  size();

  function draw(it, t) {
    const { ctx, W, H } = it;
    if (!W) return;
    const fw = W * 0.74, fh = fw * 11 / 16 > H * 0.74 ? H * 0.74 : fw * 11 / 16;
    const fW = fh * 16 / 11, cx = W / 2, cy = H / 2;
    const X = (x) => cx + x * fW / 2, Y = (y) => cy - y * fh / 2;
    ctx.clearRect(0, 0, W, H);

    const cam = sampleCamera(t);
    const view = makeView(cam, cam.tgtY, 16 / 11);
    const things = scenes[it.id](t, cam, view);

    // her and the rock, at her depth
    const ft = view(0, 0, 0), hd = view(0, 2, 0), side = view(0.18, 1, 0), mid = view(0, 1, 0);
    const half = Math.max(2, Math.abs(side.x - mid.x) * fW / 2);
    const herDepth = mid.w;
    const drawHer = () => {
      const rw = view(0.95, -0.42, 0), rc = view(0, -0.42, 0), rb = view(0, -0.95, 0);
      ctx.fillStyle = ROCK;
      ctx.beginPath();
      ctx.ellipse(X(rc.x), Y(rc.y), Math.abs(X(rw.x) - X(rc.x)), Math.abs(Y(rb.y) - Y(rc.y)), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = HER; ctx.strokeStyle = INK3; ctx.lineWidth = 1;
      const x0 = X(ft.x) - half, y0 = Y(hd.y), h = Y(ft.y) - Y(hd.y);
      ctx.beginPath(); ctx.roundRect(x0, y0, half * 2, h, Math.min(half, 6)); ctx.fill(); ctx.stroke();
    };

    // back to front; screen-space cards (depth -1) always on top
    const sorted = things.slice().sort((a, b) => b.depth - a.depth);
    let herDrawn = false;
    for (const c of sorted) {
      if (!herDrawn && c.depth >= 0 && c.depth < herDepth) { drawHer(); herDrawn = true; }
      if (!herDrawn && c.depth === -1) { drawHer(); herDrawn = true; }
      ctx.globalAlpha = c.alpha;
      if (c.quad) {
        ctx.beginPath();
        c.quad.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))));
        ctx.closePath();
        ctx.fillStyle = CARD; ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
        const hpx = Math.abs(Y(c.quad[3].y) - Y(c.quad[0].y));
        if (hpx > 16) label(ctx, c.n, (X(c.quad[0].x) + X(c.quad[2].x)) / 2, (Y(c.quad[0].y) + Y(c.quad[2].y)) / 2, hpx);
      } else if (c.rect) {
        const [x, y, h] = c.rect;
        const hp = h * fh, wp = hp * 16 / 9;
        ctx.fillStyle = CARD; ctx.strokeStyle = INK; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(X(x) - wp / 2, Y(y) - hp / 2, wp, hp, 3); ctx.fill(); ctx.stroke();
        label(ctx, c.n, X(x), Y(y), hp);
      }
      ctx.globalAlpha = 1;
    }
    if (!herDrawn) drawHer();

    // outside the frame is off screen: wash it back, then draw the edge
    ctx.fillStyle = "rgba(243,241,234,0.72)";
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.rect(cx - fW / 2, cy - fh / 2, fW, fh); ctx.fill("evenodd");
    ctx.setLineDash([4, 4]); ctx.strokeStyle = INK3; ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(cx - fW / 2) + 0.5, Math.round(cy - fh / 2) + 0.5, Math.round(fW), Math.round(fh));
    ctx.setLineDash([]);
    // a hairline scrubber under the frame shows where in the scroll we are
    const by = Math.min(H - 6, cy + fh / 2 + 10);
    ctx.fillStyle = "rgba(29,27,24,0.14)"; ctx.fillRect(cx - fW / 2, by, fW, 1);
    ctx.fillStyle = it.id === 6 ? TINT : INK; ctx.fillRect(cx - fW / 2, by - 1, fW * t, 3);
  }
  function label(ctx, n, x, y, hp) {
    ctx.fillStyle = INK;
    ctx.font = `400 ${Math.round(Math.min(22, hp * 0.5))}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(n), x, y + 1);
  }

  const still = 0.36;
  const drawAll = (t) => items.forEach((it) => draw(it, t));
  let on = false, stopper = null, t0 = null, playing = !Study.reduce;
  const loop = (now) => {
    if (!on || !playing) return false;
    if (t0 == null) t0 = now;
    drawAll(((now - t0) / 1000 / PERIOD) % 1);
    return true;
  };
  drawAll(still);
  if (Study.reduce && playBtn) {
    playBtn.hidden = false;
    playBtn.addEventListener("click", () => {
      playing = !playing;
      playBtn.textContent = playing ? "Pause the loops" : "Play the loops";
      if (playing && on) { t0 = null; stopper = Study.raf(loop); }
    });
  }
  return {
    start() { on = true; if (playing) { t0 = null; stopper = Study.raf(loop); } },
    stop() { on = false; stopper && stopper(); },
  };
}
