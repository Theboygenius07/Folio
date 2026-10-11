/* Fig. 1: the staircase in 3D. Two views of one scene, drawn into one canvas:
   a drawing you can turn (the camera's path drawn at 0.4 of its distance), and
   the real camera's own view at 16:9. Scroll through the pinned figure, or
   drag the slider, to move along the showcase's scroll.

   Cards: rig.js shippedCard (cards.js:341-541) and the first version's static
   staircase. Camera: rig.js sampleCamera (camera-path.js:42-72).
   Smoothing and flex: main.js:798-803. */
import * as THREE from "three";
import {
  K, CAMERA_PATH, CAMERA_PATH_V1, sampleCamera, warpScroll, shippedCards, shippedCard,
  staticCards, staticVisible, staticScale, progress, clamp, DEG,
} from "./rig.js";
import {
  makeRenderer, addLights, greenEnvironment, addFigure, clothGeometry, clothGeometryV1,
  cardTexture, cardMaterial, FOG_COLOR, FOG_COLOR_V1,
} from "./scene-kit.js";

const SHOW = 0.4; // the drawing pulls the camera path in to 0.4 of its distance

export function mountStair(fig) {
  const Study = window.Study;
  const wrap = fig.querySelector(".st-canvas");
  const canvas = wrap.querySelector("canvas");
  const ovEl = wrap.querySelector(".st-ov");
  const camEl = wrap.querySelector(".st-cam");
  const tag = wrap.querySelector(".st-tag--cam");
  const key = wrap.querySelector(".st-key");
  const note = wrap.querySelector(".st-cam-note");
  const input = fig.querySelector(".st-scrub input");
  const out = fig.querySelector(".st-scrub output");
  const tabs = [...fig.querySelectorAll("[data-mode]")];
  const R = Object.fromEntries([...fig.querySelectorAll("[data-r]")].map((b) => [b.dataset.r, b]));
  const pin = document.getElementById("stair-pin");

  let renderer;
  try { renderer = makeRenderer(canvas); } catch (e) {
    wrap.querySelector(".st-fallback").hidden = false;
    return { start() {}, stop() {} };
  }
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  addLights(scene);
  greenEnvironment(renderer, scene);
  addFigure(scene, { value: 1 });

  const shared = { uFlex: { value: 0 }, uTime: { value: 0 } };

  // the shipped rope
  const ship = shippedCards(21).map((c) => {
    const mat = cardMaterial(cardTexture(c.i, renderer), shared);
    const mesh = new THREE.Mesh(clothGeometry(), mat);
    const g = new THREE.Group(); g.add(mesh); g.visible = false; scene.add(g);
    return { c, g, mat };
  });
  // the first version: fixed steps facing outward
  const aug = staticCards(21).map((c) => {
    const mat = cardMaterial(cardTexture(c.i, renderer), shared);
    const mesh = new THREE.Mesh(clothGeometryV1(), mat);
    const g = new THREE.Group(); g.add(mesh);
    g.position.set(c.x, c.y, c.z);
    g.lookAt(0, c.y, 0); g.rotateY(Math.PI); g.rotateY(c.jy); g.rotateX(c.jx); g.rotateZ(c.jz);
    g.visible = false; scene.add(g);
    return { c, g, mat, on: false };
  });

  // drawing-only things live on layer 1, which the real camera never sees
  const ink = new THREE.Color(0x1d1b18), tint = new THREE.Color(0x46623d);
  const pathLine = (path) => {
    const pts = [];
    for (let i = 0; i <= 240; i++) { const s = sampleCamera(i / 240, path); pts.push(new THREE.Vector3(s.x * SHOW, s.y, s.z * SHOW)); }
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.38 }));
    l.layers.set(1); scene.add(l); return l;
  };
  const lineShip = pathLine(CAMERA_PATH), lineV1 = pathLine(CAMERA_PATH_V1);
  const keyDots = (path) => {
    const g = new THREE.BufferGeometry().setFromPoints(path.map(([, o, d, cy]) => new THREE.Vector3(Math.sin(o * DEG) * d * SHOW, cy, Math.cos(o * DEG) * d * SHOW)));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color: ink, size: 4, sizeAttenuation: false, transparent: true, opacity: 0.55 }));
    p.layers.set(1); scene.add(p); return p;
  };
  const dotsShip = keyDots(CAMERA_PATH), dotsV1 = keyDots(CAMERA_PATH_V1);

  // the camera glyph: a frustum, unit sized, scaled each frame by the real fov
  const fr = new THREE.BufferGeometry();
  const P = [0, 0, 0], C = [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
  const seg = [];
  C.forEach((c, i) => { seg.push(...P, ...c, ...c, ...C[(i + 1) % 4]); });
  seg.push(-0.45, 1.15, 1, 0, 1.55, 1, 0, 1.55, 1, 0.45, 1.15, 1); // the "up" tick
  fr.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
  const glyph = new THREE.LineSegments(fr, new THREE.LineBasicMaterial({ color: tint }));
  glyph.layers.set(1); scene.add(glyph);
  const sightG = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const sight = new THREE.Line(sightG, new THREE.LineDashedMaterial({ color: tint, dashSize: 0.12, gapSize: 0.1, transparent: true, opacity: 0.8 }));
  sight.layers.set(1); scene.add(sight);
  const camDot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color: tint }));
  camDot.layers.set(1); scene.add(camDot);

  const real = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 200);
  const ov = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
  ov.layers.enable(1);
  const fogShip = new THREE.FogExp2(FOG_COLOR, 0.012), fogV1 = new THREE.FogExp2(FOG_COLOR_V1, 0.062);
  const voidShip = new THREE.Color(FOG_COLOR), voidV1 = new THREE.Color(FOG_COLOR_V1);

  let mode = "ship";
  let az = 18 * DEG, el = 30 * DEG, turned = false; // the drawing's own view
  let W = 0, H = 0, ovRect = null, camRect = null;
  const v3 = new THREE.Vector3();

  function layout() {
    const r = wrap.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    renderer.setSize(W, H, false);
    const o = ovEl.getBoundingClientRect(), c = camEl.getBoundingClientRect();
    ovRect = { x: o.left - r.left, y: o.top - r.top, w: o.width, h: o.height };
    camRect = { x: c.left - r.left, y: c.top - r.top, w: c.width, h: c.height };
    ov.aspect = ovRect.w / Math.max(1, ovRect.h);
    ov.updateProjectionMatrix();
    // a tall drawing area looks down more steeply, so the path fills it
    if (!turned) el = ov.aspect < 1 ? 46 * DEG : 30 * DEG;
    dirty = true;
  }
  function placeOv() {
    // frame the drawn path (4.3m out at most) and the spiral's height
    const vf = ov.fov * DEG, hf = 2 * Math.atan(Math.tan(vf / 2) * ov.aspect);
    const d = Math.max(3.5 / Math.tan(vf / 2), 4.4 / Math.tan(hf / 2));
    ov.position.set(Math.sin(az) * Math.cos(el) * d, 0.95 + Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
    ov.lookAt(0, 0.95, 0);
    ov.updateMatrixWorld();
  }

  // ---- state: target from scroll and slider, smooth like main.js ----
  let target = progress.t, smooth = target, lastSmooth = smooth, flex = 0, dirty = true, running = false, stopLoop = null;
  const offProg = progress.on((v) => { target = v; reflect(); });
  function reflect() {
    input.value = String(Math.round(target * 1000));
    out.value = target.toFixed(3);
    out.textContent = target.toFixed(3);
  }
  input.addEventListener("input", () => progress.set(+input.value / 1000, "stair"));

  // the figure is pinned: moving through the pin moves the scroll forward
  const mapped = () => { const r = pin.getBoundingClientRect(); const span = pin.offsetHeight - innerHeight; return span > 0 ? clamp(-r.top / span) : 0; };
  let lastMapped = mapped();
  addEventListener("scroll", () => {
    const m = mapped();
    if (m !== lastMapped) { progress.set(progress.t + (m - lastMapped), "scroll"); lastMapped = m; }
  }, { passive: true });

  tabs.forEach((b) => b.addEventListener("click", () => {
    mode = b.dataset.mode;
    tabs.forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    dirty = true;
  }));

  // turn the drawing: drag sideways, or arrow keys
  let drag = null;
  ovEl.addEventListener("pointerdown", (e) => { turned = true; drag = { x: e.clientX, y: e.clientY, az, el }; ovEl.setPointerCapture(e.pointerId); });
  ovEl.addEventListener("pointermove", (e) => {
    if (!drag) return;
    az = drag.az - (e.clientX - drag.x) * 0.008;
    el = clamp(drag.el + (e.clientY - drag.y) * 0.004, 4 * DEG, 70 * DEG);
    dirty = true;
  });
  const end = () => { drag = null; };
  ovEl.addEventListener("pointerup", end); ovEl.addEventListener("pointercancel", end);
  ovEl.addEventListener("keydown", (e) => {
    if (e.key.startsWith("Arrow")) turned = true;
    if (e.key === "ArrowLeft") { az += 10 * DEG; dirty = true; e.preventDefault(); }
    if (e.key === "ArrowRight") { az -= 10 * DEG; dirty = true; e.preventDefault(); }
    if (e.key === "ArrowUp") { el = clamp(el + 5 * DEG, 4 * DEG, 70 * DEG); dirty = true; e.preventDefault(); }
    if (e.key === "ArrowDown") { el = clamp(el - 5 * DEG, 4 * DEG, 70 * DEG); dirty = true; e.preventDefault(); }
  });

  const ro = new ResizeObserver(layout);
  ro.observe(wrap);

  function update(t) {
    const path = mode === "ship" ? CAMERA_PATH : CAMERA_PATH_V1;
    const s = sampleCamera(t, path);
    real.position.set(s.x, s.y, s.z);
    real.fov = s.fov; real.aspect = 16 / 9; real.updateProjectionMatrix();
    real.lookAt(0, s.tgtY, 0); real.updateMatrixWorld();

    let alive = 0, feat = null, best = -Infinity;
    if (mode === "ship") {
      aug.forEach((a) => (a.g.visible = false));
      const rope = warpScroll(t);
      const cam = { x: s.x, y: s.y, z: s.z, fov: s.fov, aspect: 16 / 9 };
      ship.forEach(({ c, g }) => {
        const st = shippedCard(c, cam, rope, s.tgtY);
        g.visible = st.on;
        if (!st.on) return;
        alive++;
        g.position.set(st.x, st.y, st.z);
        g.rotation.set(st.rotX, st.rotY, st.rotZ);
        g.scale.setScalar(st.scale);
        if (st.focus > best) { best = st.focus; feat = c.i; }
      });
      if (best < 0.3) feat = null;
    } else {
      ship.forEach((a) => (a.g.visible = false));
      aug.forEach((a) => {
        const v = staticVisible(a.c, t);
        a.on = v.on;
        v3.set(a.c.x, a.c.y, a.c.z).project(real);
        a.g.scale.setScalar(staticScale(v3.x, v3.y));
        if (v.on) { alive++; const sc = -Math.abs(v.u - 0.5); if (sc > best) { best = sc; feat = a.c.i; } }
      });
    }

    // the glyph
    const gx = s.x * SHOW, gz = s.z * SHOW;
    glyph.position.set(gx, s.y, gz);
    glyph.lookAt(0, s.tgtY, 0);
    const L = 0.75, th = Math.tan(s.fov * DEG / 2);
    glyph.scale.set(L * th * 16 / 9, L * th, L);
    camDot.position.set(gx, s.y, gz);
    const sp = sightG.attributes.position;
    sp.setXYZ(0, gx, s.y, gz); sp.setXYZ(1, 0, s.tgtY, 0); sp.needsUpdate = true;
    sight.computeLineDistances();
    lineShip.visible = dotsShip.visible = mode === "ship";
    lineV1.visible = dotsV1.visible = mode !== "ship";

    R.orbit.textContent = s.orbit.toFixed(1) + "°";
    R.dist.textContent = s.dist.toFixed(2) + " m";
    R.lens.textContent = s.lens.toFixed(0) + " mm";
    R.alive.textContent = String(alive);
    R.feat.textContent = feat == null ? "none" : "card " + feat;
    note.textContent = `fov ${s.fov.toFixed(1)}° · fog ${mode === "ship" ? "0.012" : "0.062"}`;
    return s;
  }

  function render(t, time) {
    if (!ovRect || !W) layout();
    shared.uTime.value = time;
    update(t);
    placeOv();

    renderer.setScissorTest(true);
    renderer.setViewport(0, 0, W, H); renderer.setScissor(0, 0, W, H);
    renderer.setClearColor(0x000000, 0); renderer.clear();

    // the drawing, on the paper: hidden first-version steps show as ghosts
    scene.fog = null;
    aug.forEach((a) => {
      if (mode !== "ship") { a.g.visible = true; a.mat.uniforms.uAlpha.value = a.on ? 1 : 0.2; a.mat.depthWrite = a.on; }
    });
    const oy = H - ovRect.y - ovRect.h;
    renderer.setViewport(ovRect.x, oy, ovRect.w, ovRect.h);
    renderer.setScissor(ovRect.x, oy, ovRect.w, ovRect.h);
    renderer.render(scene, ov);

    // the camera's view, in the green void
    aug.forEach((a) => { if (mode !== "ship") { a.g.visible = a.on; a.mat.uniforms.uAlpha.value = 1; a.mat.depthWrite = true; } });
    scene.fog = mode === "ship" ? fogShip : fogV1;
    const cy = H - camRect.y - camRect.h;
    renderer.setViewport(camRect.x, cy, camRect.w, camRect.h);
    renderer.setScissor(camRect.x, cy, camRect.w, camRect.h);
    renderer.setClearColor(mode === "ship" ? voidShip : voidV1, 1); renderer.clear();
    renderer.render(scene, real);
    renderer.setScissorTest(false);

    // the key sits just under the drawn path, wherever the drawing has turned it
    const pl = mode === "ship" ? lineShip : lineV1, pp = pl.geometry.attributes.position;
    let minX = Infinity, maxY = -Infinity;
    for (let i = 0; i < pp.count; i += 8) {
      v3.fromBufferAttribute(pp, i).project(ov);
      minX = Math.min(minX, (v3.x + 1) / 2 * ovRect.w); maxY = Math.max(maxY, (1 - v3.y) / 2 * ovRect.h);
    }
    key.style.transform = `translate(${Math.round(Math.max(0, minX))}px, ${Math.round(Math.min(ovRect.h - 16, maxY + 18))}px)`;

    // the "camera" label follows the glyph in the drawing
    v3.copy(camDot.position).project(ov);
    const lx = (v3.x + 1) / 2 * ovRect.w, ly = (1 - v3.y) / 2 * ovRect.h;
    tag.style.transform = `translate(${Math.round(lx)}px, ${Math.round(ly)}px) translate(-50%, -190%)`;
    tag.style.visibility = v3.z < 1 ? "visible" : "hidden";
  }

  const clock = new THREE.Clock(false);
  function loop(t, dt) {
    if (!running) return false;
    const reduce = Study.reduce;
    const before = smooth;
    if (reduce) smooth = target;
    else smooth += (target - smooth) * Math.min(1, dt * 4.5); // main.js:798
    if (Math.abs(target - smooth) < 1e-5) smooth = target;
    const vel = (smooth - lastSmooth) / Math.max(dt, 1e-3);   // main.js:801
    lastSmooth = smooth;
    const want = reduce ? 0 : clamp(vel * 6.0, -1, 1);
    flex += (want - flex) * Math.min(1, dt * 7);                // main.js:803
    if (Math.abs(flex) < 1e-4) flex = 0;
    shared.uFlex.value = flex;
    const moving = smooth !== before || flex !== 0 || drag;
    if (moving || dirty) { render(smooth, reduce ? 0 : clock.getElapsedTime()); dirty = false; }
    return true;
  }

  reflect();
  return {
    start() { if (running) return; running = true; clock.start(); dirty = true; stopLoop = Study.raf(loop); },
    stop() { running = false; clock.stop(); stopLoop && stopLoop(); },
  };
}
