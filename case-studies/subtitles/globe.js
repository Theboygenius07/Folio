/* Fig. 1: the globe view, live.
   Ported from Subtitles/views/globe.js. Same sphere (R 6), same 80 planes cut from a
   shuffled, repeated list, same Fibonacci placement, fly-in, inertia and zoom limits.
   Changes for a page: the canvas is transparent so it floats on the paper, it rests
   far enough back that the whole sphere fits (the site rests at R + 3 = 9), plain
   scrolling scrolls the page (ctrl-scroll or a pinch zooms), and the focus card opens
   inside the figure. */
import * as THREE from "three";
import { WEEKS } from "./data.js";
import { cloudinaryUrl, shuffle, fmt, clamp } from "./util.js";
import { openFocus, isOpen } from "./focus.js";
import { fib } from "./fib.js";

const R = 6;                 // globe.js:5
const COUNT = 80;            // globe.js:6
const PW = 1.6;              // globe.js:7
const PH = PW * (9 / 16);    // globe.js:8
const SITE_REST = R + 3;     // globe.js:234
const ENTRY_FROM = 55;       // globe.js:233
const ENTRY_STEP = 0.008;    // globe.js:438, per frame at 60 fps
const INERTIA = 0.92;        // globe.js:449
const FOLLOW = 0.08;         // globe.js:451
const ZOOM_FOLLOW = 0.07;    // globe.js:445
const Z_MIN = 0.5, Z_MAX = 30; // globe.js:264

/* globe.js:10-20: shuffle, use, shuffle again, cut at 80 */
function makeList(photos) {
  const out = [];
  let round = 0;
  while (out.length < COUNT) out.push(...shuffle(photos, 7 + round++));
  return out.slice(0, COUNT);
}

export function initGlobe(fig) {
  const host = fig.querySelector(".stage-canvas");
  const out = fig.querySelector("[data-globe-readout]");
  const tabs = [...fig.querySelectorAll("[data-globe-mode]")];
  const list = makeList(WEEKS);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 200);  // globe.js:36-38
  camera.position.set(0, 0, ENTRY_FROM);
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));

  const globe = new THREE.Group();
  scene.add(globe);

  // One texture per photo; the 80 planes share them.
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  const texCache = new Map();
  const texFor = (photo, mat) => {
    let entry = texCache.get(photo.url);
    if (!entry) {
      entry = { tex: null, waiting: [] };
      texCache.set(photo.url, entry);
      loader.load(cloudinaryUrl(photo.url, 280), (tex) => {   // globe.js:63
        tex.colorSpace = THREE.SRGBColorSpace;
        entry.tex = tex;
        entry.waiting.forEach((m) => { m.map = tex; m.color.set(0xffffff); m.needsUpdate = true; });
        entry.waiting = [];
        dirty = true;
      });
    }
    if (entry.tex) { mat.map = entry.tex; mat.color.set(0xffffff); }
    else entry.waiting.push(mat);
  };

  const geo = new THREE.PlaneGeometry(PW, PH);
  const planes = [];
  const pts = [];
  for (let i = 0; i < COUNT; i++) {
    const p = fib(i);
    const mat = new THREE.MeshBasicMaterial({ color: 0xd8d3c7, side: THREE.DoubleSide, transparent: true, opacity: 1 });
    texFor(list[i], mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(p.x, p.y, p.z);
    mesh.lookAt(p.x * 2, p.y * 2, p.z * 2);  // globe.js:70, front face points outward
    mesh.userData = { photo: list[i], i };
    globe.add(mesh);
    planes.push(mesh);
    pts.push(new THREE.Vector3(p.x, p.y, p.z));
  }

  // The spiral underneath: the same 80 points, joined in the order i runs.
  const ink = new THREE.Color(0x1d1b18);
  const spiral = new THREE.Group();
  const lineMat = new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0 });
  spiral.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
  const disc = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.beginPath(); x.arc(32, 32, 30, 0, Math.PI * 2); x.fill();
    return new THREE.CanvasTexture(c);
  })();
  const dotMat = new THREE.PointsMaterial({ color: ink, size: 6, map: disc, alphaTest: 0.5, sizeAttenuation: false, transparent: true, opacity: 0 });
  spiral.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(pts), dotMat));
  const tint = new THREE.Color(getComputedStyle(document.body).getPropertyValue("--tint-ink").trim() || "#4d3fc4");
  const markMat = new THREE.PointsMaterial({ color: tint, size: 14, map: disc, alphaTest: 0.5, sizeAttenuation: false, transparent: true, opacity: 0, depthTest: false });
  const markGeo = new THREE.BufferGeometry().setFromPoints([pts[0].clone()]);
  spiral.add(new THREE.Points(markGeo, markMat));
  globe.add(spiral);

  // State (globe.js:232-242)
  let entry = Study.reduce ? 1 : 0;
  let entryDone = Study.reduce;
  let rest = 13;
  let camZ = Study.reduce ? rest : ENTRY_FROM;
  let camTarget = rest;
  let rotX = 0, rotY = 0, targetX = 0.35, targetY = 0, velX = 0, velY = 0;
  if (Study.reduce) { rotX = targetX; }
  let dragging = false, dirty = true;
  let mode = "photos", mix = 0; // 0 photos, 1 spiral
  let markI = 0, markT = 0, markHover = -1;

  function size() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // rest just far enough back for the whole sphere and its planes to fit
    const v = THREE.MathUtils.degToRad(35);
    const hh = Math.atan(Math.tan(v) * camera.aspect);
    const fitted = (R + 0.9) / Math.sin(Math.min(v, hh) * 0.97);
    if (camTarget === rest) camTarget = fitted;
    rest = fitted;
    if (entryDone && Study.reduce) camZ = camTarget;
    dirty = true;
  }
  size();
  const ro = new ResizeObserver(size);
  ro.observe(host);

  // ---------- input ----------
  canvas.style.touchAction = "pan-y";
  const pointers = new Map();
  let downAt = null, moved = 0, pinch0 = null;
  canvas.addEventListener("pointerdown", (e) => {
    if (isOpen(host)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    if (pointers.size === 1) { downAt = { x: e.clientX, y: e.clientY }; moved = 0; dragging = entryDone; }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dragging = false; moved = 99;
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 2 && pinch0 !== null) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      camTarget = clamp(camTarget - (d - pinch0) * 0.06, Z_MIN, Z_MAX);  // globe.js:306
      pinch0 = d; dirty = true;
      return;
    }
    if (!dragging) return;
    if (downAt) moved = Math.max(moved, Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y));
    targetY += dx * 0.004; targetX += dy * 0.004;   // globe.js:255
    velX = dx * 0.002; velY = dy * 0.002;            // globe.js:256
    dirty = true;
  });
  const up = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch0 = null;
    if (pointers.size === 0) {
      dragging = false;
      if (downAt && moved <= 8 && e.type === "pointerup") pick(e.clientX, e.clientY);  // globe.js:271
      downAt = null;
    }
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  // A click with no pointerdown before it is the hand controller pressing here.
  canvas.addEventListener("click", (e) => { if (e.isTrusted) return; pick(e.clientX, e.clientY); });
  host.addEventListener("wheel", (e) => {
    if (!e.ctrlKey || !entryDone || isOpen(host)) return;   // plain wheel scrolls the page
    e.preventDefault();
    camTarget = clamp(camTarget + e.deltaY * 0.02, Z_MIN, Z_MAX);  // globe.js:264
    dirty = true;
  }, { passive: false });
  host.addEventListener("keydown", (e) => {
    if (isOpen(host)) return;
    const k = e.key;
    if (k === "ArrowLeft") velX = -0.03;
    else if (k === "ArrowRight") velX = 0.03;
    else if (k === "ArrowUp") velY = -0.03;
    else if (k === "ArrowDown") velY = 0.03;
    else if (k === "+" || k === "=") camTarget = clamp(camTarget - 1.5, Z_MIN, Z_MAX);
    else if (k === "-" || k === "_") camTarget = clamp(camTarget + 1.5, Z_MIN, Z_MAX);
    else if (k === "Enter" || k === " ") openNearest();
    else return;
    e.preventDefault(); dirty = true;
  });

  // Hand, while the hand cursor is over this figure (globe.js:348-428)
  let prevZ = null, prevHX = null, prevHY = null;
  fig.addEventListener("hand", ({ detail: d }) => {
    if (!d.active || isOpen(host)) { prevZ = null; prevHX = null; return; }
    if (d.rawZ !== undefined && prevZ !== null) {
      const delta = d.rawZ - prevZ;
      if (Math.abs(delta) > 0.010) camTarget = clamp(camTarget - delta * 18, Z_MIN, Z_MAX);  // globe.js:365-367
    }
    prevZ = d.rawZ;
    if (d.pinch && prevHX !== null && entryDone) {
      const dx = d.cx - prevHX, dy = d.cy - prevHY;
      targetY += dx * 0.006; targetX += dy * 0.006;   // globe.js:415
      velX = dx * 0.003; velY = dy * 0.003;            // globe.js:416
    }
    prevHX = d.pinch ? d.cx : null; prevHY = d.pinch ? d.cy : null;
    dirty = true;
  });
  fig.addEventListener("hand:leave", () => { prevZ = null; prevHX = null; });

  // ---------- picking and the focus card ----------
  const ray = new THREE.Raycaster();
  function meshRect(mesh) {   // globe.js:77-95, relative to the figure
    const cr = host.getBoundingClientRect();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => {
      const c = new THREE.Vector3(a * PW / 2, b * PH / 2, 0).applyMatrix4(mesh.matrixWorld).project(camera);
      const sx = (c.x + 1) / 2 * cr.width, sy = (-c.y + 1) / 2 * cr.height;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    });
    return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
  }
  // keyboard: open the front plane nearest the middle of the view
  function openNearest() {
    if (!entryDone || isOpen(host) || mode !== "photos") return;
    const v = new THREE.Vector3();
    let best = null, bd = Infinity;
    planes.forEach((m) => {
      m.getWorldPosition(v);
      if (v.z < 0) return;                 // the far side of the sphere
      v.project(camera);
      const d = v.x * v.x + v.y * v.y;
      if (d < bd) { bd = d; best = m; }
    });
    if (best) openFocus({ host, photo: best.userData.photo, fromRect: meshRect(best), getRect: () => meshRect(best), onClose: () => host.focus({ preventScroll: true }) });
  }
  function pick(cx, cy) {
    if (!entryDone || isOpen(host) || mode !== "photos") return;
    const r = host.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObjects(planes)[0];
    if (!hit) return;
    const mesh = hit.object;
    openFocus({ host, photo: mesh.userData.photo, fromRect: meshRect(mesh), getRect: () => meshRect(mesh), onClose: () => host.focus({ preventScroll: true }) });
  }

  // Spiral: point at a point to read its numbers
  canvas.addEventListener("pointermove", (e) => {
    if (mode !== "spiral" || e.pointerType !== "mouse") return;
    const r = host.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    let best = -1, bd = 18 * 18;
    const v = new THREE.Vector3();
    for (let i = 0; i < COUNT; i++) {
      v.copy(pts[i]).applyMatrix4(globe.matrixWorld).project(camera);
      const sx = (v.x + 1) / 2 * r.width, sy = (-v.y + 1) / 2 * r.height;
      const d = (sx - mx) ** 2 + (sy - my) ** 2;
      if (d < bd && v.z < 1) { bd = d; best = i; }
    }
    markHover = best;
  });
  canvas.addEventListener("pointerleave", () => { markHover = -1; });

  function setMode(m) {
    if (m === "spiral" && mode !== "spiral") {
      // tip the pole toward the camera so the winding reads as a spiral
      const TAU = Math.PI * 2;
      targetX = Math.round(rotX / TAU) * TAU + 0.62;
      targetY = Math.round(rotY / TAU) * TAU;
      velX = velY = 0;
      if (Study.reduce) { rotX = targetX; rotY = targetY; }
    }
    mode = m;
    tabs.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.globeMode === m)));
    if (m === "spiral" && isOpen(host)) { /* leave the card */ }
    dirty = true;
  }
  tabs.forEach((b) => b.addEventListener("click", () => setMode(b.dataset.globeMode)));

  // ---------- readout ----------
  let lastOut = "";
  function writeOut() {
    let html;
    if (mix > 0.5) {
      const i = markHover >= 0 ? markHover : markI;
      const p = fib(i);
      html = `<li>i <b>${i}</b></li><li>phi = acos(−1 + 2·${i}/80) = <b>${fmt(p.phi, 3)}</b></li><li>theta = √(80π)·phi = <b>${fmt(p.theta, 2)}</b></li><li>height cos(phi) = <b>${fmt(Math.cos(p.phi), 3)}</b></li>`;
    } else {
      html = `<li>80 planes · r <b>6</b></li><li>camera z <b>${fmt(camZ, 1)}</b></li><li>spin <b>${fmt(velX, 4)}</b></li><li>inertia <b>0.92</b>/frame</li>`;
    }
    if (html !== lastOut) { out.innerHTML = html; lastOut = html; }
  }

  // ---------- loop (globe.js:434-457), per-frame constants scaled to real time ----------
  let stopLoop = null;
  const frame = (t, dt) => {
    const f = dt * 60;
    if (!entryDone) {
      entry = Math.min(1, entry + ENTRY_STEP * f);
      camZ = ENTRY_FROM + (camTarget - ENTRY_FROM) * entry;   // lerpVectors, globe.js:439
      globe.scale.setScalar(0.3 + 0.7 * entry);               // globe.js:440
      if (entry >= 1) { entryDone = true; globe.scale.setScalar(1); }
    } else {
      camZ += (camTarget - camZ) * (1 - (1 - ZOOM_FOLLOW) ** f);
    }
    if (!dragging) {
      targetY += velX * f; targetX += velY * f;
      velX *= INERTIA ** f; velY *= INERTIA ** f;
    }
    rotX += (targetX - rotX) * (1 - (1 - FOLLOW) ** f);
    rotY += (targetY - rotY) * (1 - (1 - FOLLOW) ** f);
    globe.rotation.x = rotX;
    globe.rotation.y = rotY;
    camera.position.z = camZ;

    // photos <-> spiral
    const want = mode === "spiral" ? 1 : 0;
    mix += (want - mix) * (Study.reduce ? 1 : 1 - 0.0001 ** dt);
    if (Math.abs(want - mix) < 0.002) mix = want;
    const op = 1 - mix;
    planes.forEach((m) => { m.material.opacity = op; m.visible = op > 0.01; });
    lineMat.opacity = 0.32 * mix; dotMat.opacity = 0.9 * mix; markMat.opacity = mix;
    spiral.visible = mix > 0.01;
    if (mix > 0.01) {
      if (markHover < 0 && !Study.reduce) {
        markT += dt;
        if (markT > 0.16) { markT = 0; markI = (markI + 1) % COUNT; }
      }
      const i = markHover >= 0 ? markHover : markI;
      markGeo.attributes.position.setXYZ(0, pts[i].x, pts[i].y, pts[i].z);
      markGeo.attributes.position.needsUpdate = true;
    }

    const busy = !entryDone || dragging || dirty || isOpen(host) || mix > 0 ||
      Math.abs(velX) + Math.abs(velY) > 1e-5 || Math.abs(targetX - rotX) + Math.abs(targetY - rotY) > 1e-5 ||
      Math.abs(camTarget - camZ) > 1e-3;
    if (busy) renderer.render(scene, camera);
    dirty = false;
    writeOut();
  };
  const start = () => { if (!stopLoop) stopLoop = Study.raf((t, dt) => { frame(t, dt); }); };
  const stop = () => { if (stopLoop) { stopLoop(); stopLoop = null; } };
  Study.onVisible(fig, start, stop, "0px");
  start();

  fig.classList.add("is-live");
  return { setMode };
}
