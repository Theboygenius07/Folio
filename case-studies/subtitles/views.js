/* Fig. 3: the five views, small, and how the site switches between them.
   Each small view is laid out with its view's own numbers, scaled down to this screen:
   horizontal.js:100-123, vertical.js:94-128, freeform.js:9-14, globe.js:52-57,
   gallery.js:5-26. Switching follows main.js:47-84: fade the old view out over 0.1 s,
   build the new one only the first time, then two animation frames later fade it in
   over 0.2 s. */
import { WEEKS } from "./data.js";
import { cloudinaryUrl, shuffle, fitCanvas } from "./util.js";
import { fib } from "./fib.js";
import { layoutPhotos } from "./roomlayout.js";

const NAMES = ["horizontal", "vertical", "canvas", "globe", "gallery"];
const OUT_MS = 100, IN_MS = 200;   // main.js:52-54, main.js:76-81

const imgCache = new Map();
const thumb = (p) => {
  let im = imgCache.get(p.url);
  if (!im) { im = new Image(); im.decoding = "async"; im.src = cloudinaryUrl(p.url, 200); imgCache.set(p.url, im); }
  return im;
};
// small photos as painted boxes, clipped by the screen like the site's own views clip them
const domImg = (p, cls = "") => { const d = document.createElement("i"); d.className = "vw-ph " + cls; d.style.backgroundImage = `url("${cloudinaryUrl(p.url, 200)}")`; return d; };

const builders = {
  horizontal(layer) {
    const W = layer.clientWidth, H = layer.clientHeight;
    const A = Math.round(W * 0.70), I = Math.round(W * 0.35);
    const SLOT = Math.round((A + I) / 2 + 24 * W / 1440);
    const c = 2;
    for (let i = 0; i <= 5; i++) {
      const dist = Math.abs(i - c);
      const w = Math.round(I + (A - I) * Math.max(0, 1 - dist)), h = Math.round(w * 9 / 16);
      const im = domImg(WEEKS[i], i === c ? "is-on" : "");
      im.style.cssText += `;width:${w}px;height:${h}px;left:${Math.round(W / 2 + (i - c) * SLOT - w / 2)}px;top:${Math.round(H * 0.44 - h / 2)}px;opacity:${dist > 2.5 ? 0.5 : 1}`;
      layer.appendChild(im);
    }
    const tick = document.createElement("div");
    tick.className = "vw-ticks";
    WEEKS.forEach((p, i) => {
      const t = Math.max(0, 1 - Math.abs(i - c) / 4.5);
      const s = document.createElement("i");
      s.style.height = ((21.5 + (68.8 - 21.5) * t * t) * W / 1440).toFixed(1) + "px";
      s.style.opacity = i === c ? 1 : (0.22 + 0.56 * t * t).toFixed(2);
      tick.appendChild(s);
    });
    layer.appendChild(tick);
  },
  vertical(layer) {
    const W = layer.clientWidth, H = layer.clientHeight;
    const left = Math.round(410 * W / 1440), avail = W - left;
    const A = Math.round(H * 0.56), I = Math.round(H * 0.30);
    const SLOT = Math.round((A + I) / 2 + 20 * W / 1440);
    const c = 3;
    for (let i = 0; i <= 6; i++) {
      const dist = Math.abs(i - c);
      const h = Math.round(I + (A - I) * Math.max(0, 1 - dist)), w = Math.round(h * 16 / 9);
      const im = domImg(WEEKS[i], i === c ? "is-on" : "");
      im.style.cssText += `;width:${w}px;height:${h}px;left:${Math.round(left + (avail - w) / 2)}px;top:${Math.round(H / 2 + (i - c) * SLOT - h / 2)}px;opacity:${dist > 2.5 ? 0.5 : 1}`;
      layer.appendChild(im);
    }
    const tick = document.createElement("div");
    tick.className = "vw-ticks vw-ticks--v";
    WEEKS.forEach((p, i) => {
      const t = Math.max(0, 1 - Math.abs(i - c) / 4.5);
      const s = document.createElement("i");
      s.style.width = ((21.5 + (68.8 - 21.5) * t * t) * W / 1440).toFixed(1) + "px";
      s.style.opacity = i === c ? 1 : (0.22 + 0.56 * t * t).toFixed(2);
      tick.appendChild(s);
    });
    layer.appendChild(tick);
  },
  canvas(layer) {
    const W = layer.clientWidth, H = layer.clientHeight;
    const s = W / 1440;
    const cw = 280 * s, ch = Math.round(280 * 9 / 16) * s, gx = 200 * s;
    const list = shuffle(WEEKS, 11);
    const ox = W / 2 - (3 * (cw + gx) + cw / 2), oy = H / 2 - (1 * (ch + gx) + ch / 2);
    list.forEach((p, i) => {
      const x = ox + (i % 7) * (cw + gx), y = oy + Math.floor(i / 7) * (ch + gx);
      if (x > W || y > H || x + cw < 0 || y + ch < 0) return;
      const im = domImg(p, "is-on");
      im.style.cssText += `;width:${cw.toFixed(1)}px;height:${ch.toFixed(1)}px;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px`;
      layer.appendChild(im);
    });
  },
  globe(layer) {
    const cv = document.createElement("canvas");
    layer.appendChild(cv);
    const list = shuffle(WEEKS, 7);
    const draw = () => {
      const { ctx, w, h } = fitCanvas(cv);
      ctx.clearRect(0, 0, w, h);
      const rx = 0.35, ry = 0.6, camZ = 13, f = h / (2 * Math.tan(35 * Math.PI / 180));
      const pts = [];
      for (let i = 0; i < 80; i++) {
        const p = fib(i);
        let y = p.y * Math.cos(rx) - p.z * Math.sin(rx), z = p.y * Math.sin(rx) + p.z * Math.cos(rx);
        let x = p.x * Math.cos(ry) + z * Math.sin(ry); z = -p.x * Math.sin(ry) + z * Math.cos(ry);
        pts.push({ x, y, z, i });
      }
      pts.sort((a, b) => a.z - b.z);
      pts.forEach((p) => {
        const d = camZ - p.z, k = f / d;
        const pw = 1.6 * k, ph = pw * 9 / 16;
        const sx = w / 2 + p.x * k, sy = h / 2 - p.y * k;
        ctx.globalAlpha = p.z < 0 ? 0.35 : 1;
        const im = thumb(list[p.i % list.length]);
        if (im.complete && im.naturalWidth) ctx.drawImage(im, sx - pw / 2, sy - ph / 2, pw, ph);
        else { ctx.fillStyle = "#333"; ctx.fillRect(sx - pw / 2, sy - ph / 2, pw, ph); }
      });
      ctx.globalAlpha = 1;
    };
    draw();
    list.forEach((p) => { const im = thumb(p); if (!im.complete) im.addEventListener("load", draw, { once: true }); });
  },
  gallery(layer) {
    const cv = document.createElement("canvas");
    layer.appendChild(cv);
    const spots = layoutPhotos(WEEKS);
    const draw = () => {
      const { ctx, w, h } = fitCanvas(cv);
      const camZ = 45, eye = 1.7, f = h / (2 * Math.tan(32.5 * Math.PI / 180));
      const cx = w / 2, cy = h / 2;
      const X = (x, d) => cx + (x * f) / d, Y = (y, d) => cy - ((y - eye) * f) / d;
      const near = 0.6, far = camZ + 55;
      const quad = (pts, col) => { ctx.fillStyle = col; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); };
      ctx.fillStyle = "#cfc6b6"; ctx.fillRect(0, 0, w, h);                       // walls
      quad([[X(-7, near), Y(0, near)], [X(7, near), Y(0, near)], [X(7, far), Y(0, far)], [X(-7, far), Y(0, far)]], "#9a6a3c");      // floor
      quad([[X(-7, near), Y(5.5, near)], [X(7, near), Y(5.5, near)], [X(7, far), Y(5.5, far)], [X(-7, far), Y(5.5, far)]], "#7b5631"); // ceiling, the floor again
      quad([[X(-7, far), Y(0, far)], [X(7, far), Y(0, far)], [X(7, far), Y(5.5, far)], [X(-7, far), Y(5.5, far)]], "#b9b0a0");       // far wall
      for (let i = 0; i < 24; i++) {   // lights
        const lz = 55 - 1.5 - (i / 23) * 107, d = camZ - lz;
        if (d < 1) continue;
        ctx.fillStyle = "#ffee88"; ctx.beginPath(); ctx.arc(X(0, d), Y(5.3, d), Math.max(0.8, 2.4 * f / d / 30), 0, 6.283); ctx.fill();
      }
      // photos, far ones first; each drawn in vertical slices, which is exact on a side wall
      spots.filter((s) => camZ - s.z > 1.2).sort((a, b) => a.z - b.z).forEach((s) => {
        const im = thumb(s.photo);
        const N = 14;
        for (let k = 0; k < N; k++) {
          const u0 = k / N, u1 = (k + 1) / N;
          // the left wall faces +x, so its image runs toward the viewer; the right wall the other way
          const z0 = s.z + (s.side < 0 ? -1 : 1) * (u0 - 0.5) * s.w, z1 = s.z + (s.side < 0 ? -1 : 1) * (u1 - 0.5) * s.w;
          const d0 = camZ - z0, d1 = camZ - z1;
          if (d0 < 1 || d1 < 1) continue;
          const xa = X(s.x, d0), xb = X(s.x, d1);
          const dm = (d0 + d1) / 2;
          const top = Y(s.y + s.h / 2, dm), bot = Y(s.y - s.h / 2, dm);
          const x = Math.min(xa, xb), sw = Math.abs(xb - xa) + 0.6;
          if (im.complete && im.naturalWidth) ctx.drawImage(im, u0 * im.naturalWidth, 0, im.naturalWidth / N, im.naturalHeight, x, top, sw, bot - top);
          else { ctx.fillStyle = "#222"; ctx.fillRect(x, top, sw, bot - top); }
        }
      });
    };
    draw();
    spots.forEach((s) => { const im = thumb(s.photo); if (!im.complete) im.addEventListener("load", draw, { once: true }); });
  },
};

export function initViews(fig) {
  const scrolly = fig.closest(".scrolly");
  const screen = fig.querySelector(".vw-screen");
  const layers = Object.fromEntries(NAMES.map((n) => [n, screen.querySelector(`[data-vw="${n}"]`)]));
  const built = new Set();
  const marks = Object.fromEntries(NAMES.map((n) => [n, fig.querySelector(`[data-built="${n}"]`)]));
  const head = fig.querySelector(".tm-head");
  const tmOut = fig.querySelector(".tm-out"), tmIn = fig.querySelector(".tm-in");
  const label = fig.querySelector("[data-vw-label]");
  let active = null, token = 0;

  const markBuilt = (n) => { built.add(n); marks[n].classList.add("is-built"); marks[n].querySelector("span").textContent = "built"; };

  async function show(name) {
    if (name === active) return;
    const my = ++token;
    const prev = active ? layers[active] : null;
    active = name;
    label.textContent = name[0].toUpperCase() + name.slice(1);
    Object.values(marks).forEach((m) => m.removeAttribute("aria-current"));
    marks[name].setAttribute("aria-current", "true");
    const t0 = performance.now();
    let stopHead = null;
    if (!Study.reduce) {
      head.style.opacity = 1;
      stopHead = Study.raf(() => {
        const ms = performance.now() - t0;
        const x = Math.min(1, ms / 360);
        head.setAttribute("transform", `translate(${(x * 360).toFixed(1)} 0)`);
        if (x >= 1) { head.style.opacity = 0.35; return false; }
      });
    }
    if (prev) {   // main.js:51-55
      prev.style.transition = Study.reduce ? "none" : `opacity ${OUT_MS / 1000}s ease`;
      prev.style.opacity = "0";
      if (!Study.reduce) await new Promise((r) => setTimeout(r, OUT_MS));
      prev.classList.remove("is-on");
    }
    if (my !== token) return;
    const layer = layers[name];
    layer.style.transition = "none";
    layer.style.opacity = "0";
    layer.classList.add("is-on");
    if (!built.has(name)) { builders[name](layer); markBuilt(name); }   // main.js:69-72
    requestAnimationFrame(() => requestAnimationFrame(() => {             // main.js:76
      if (my !== token) return;
      layer.style.transition = Study.reduce ? "none" : `opacity ${IN_MS / 1000}s ease`;
      layer.style.opacity = "1";
    }));
  }

  scrolly.addEventListener("step", (e) => show(NAMES[e.detail.index] || NAMES[0]));
  show(NAMES[+scrolly.dataset.step || 0]);
  new ResizeObserver(() => {
    // rebuild what has been built, at the new size
    NAMES.forEach((n) => { if (built.has(n)) { layers[n].innerHTML = ""; builders[n](layers[n]); } });
  }).observe(screen);
}
