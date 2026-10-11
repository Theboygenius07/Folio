/* Fig. 8: the gallery view, live, with a plan of where you are in it.
   Ported from Subtitles/views/gallery.js: the same room (14 x 5.5 x 110 m), the same
   24 lights down the middle, the same frames and hanging, the same walk-to-a-photo.
   Lighter for a page: the Poly Haven textures are copies at 512 px instead of 1k,
   photos load at half the site's resolution, and the renderer stops off screen. */
import * as THREE from "three";
import { WEEKS } from "./data.js";
import { cloudinaryUrl, tween, formatSubtitle, fmt, clamp } from "./util.js";
import { ROOM_W, ROOM_H, ROOM_D, EYE_Y, WALL_X, layoutPhotos } from "./roomlayout.js";

const LIGHTS = 24;                               // gallery.js:589
const SPEED = 0.055;                             // gallery.js:443
const TEX_FLOOR = new URL("./wood-floor-512.jpg", import.meta.url).href;     // Poly Haven wood_floor
const TEX_WALL = new URL("./concrete-wall-512.jpg", import.meta.url).href;   // Poly Haven concrete_wall_008

function scaledTex(src, worldW, worldH, tile, mirrorY = false) {   // gallery.js:29-36
  const t = src.clone();
  const ry = worldH / tile;
  t.repeat.set(worldW / tile, mirrorY ? -ry : ry);
  if (mirrorY) t.offset.y = 1;
  t.needsUpdate = true;
  return t;
}

export function initMuseum(fig) {
  const host = fig.querySelector(".stage-canvas");
  const plan = fig.querySelector("[data-plan]");
  const out = fig.querySelector("[data-mu-readout]");
  const panel = fig.querySelector(".mu-panel");
  const spots = layoutPhotos(WEEKS);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;   // gallery.js:55-56
  renderer.toneMappingExposure = 1.30;
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  host.prepend(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1e1c1a);
  const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 80);
  camera.rotation.order = "YXZ";
  scene.add(new THREE.AmbientLight(0xfff8f0, 1.10));

  const tl = new THREE.TextureLoader();
  // the tiled copies are made once each texture has loaded (gallery.js:69-80)
  const pending = { floor: [], wall: [] };
  const loadBase = (url, key) => tl.load(url, (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    pending[key].forEach(([mat, w, h, tile, mirror]) => { mat.map = scaledTex(t, w, h, tile, mirror); mat.needsUpdate = true; });
    dirty = true;
  });
  const textured = (key, w, h, tile, mirror, opts) => { const m = new THREE.MeshStandardMaterial(opts); pending[key].push([m, w, h, tile, mirror]); return m; };
  loadBase(TEX_FLOOR, "floor"); loadBase(TEX_WALL, "wall");

  // room (gallery.js:519-585): the ceiling is the floor's wood, flipped
  const wallMat = (w, h) => textured("wall", w, h, 5.0, false, { color: 0xf0ede8, roughness: 0.78, metalness: 0 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), textured("floor", ROOM_W, ROOM_D, 1.5, false, { color: 0xccaa72, roughness: 0.72, metalness: 0.01 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), textured("floor", ROOM_W, ROOM_D, 1.5, true, { color: 0xbb9960, roughness: 0.60, metalness: 0.02 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = ROOM_H; scene.add(ceil);
  const lw = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_D, ROOM_H), wallMat(ROOM_D, ROOM_H));
  lw.rotation.y = Math.PI / 2; lw.position.set(-ROOM_W / 2, ROOM_H / 2, 0); scene.add(lw);
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_D, ROOM_H), wallMat(ROOM_D, ROOM_H));
  rw.rotation.y = -Math.PI / 2; rw.position.set(ROOM_W / 2, ROOM_H / 2, 0); scene.add(rw);
  const bw = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_H), wallMat(ROOM_W, ROOM_H));
  bw.position.set(0, ROOM_H / 2, -ROOM_D / 2); scene.add(bw);
  const fw = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_H), wallMat(ROOM_W, ROOM_H));
  fw.rotation.y = Math.PI; fw.position.set(0, ROOM_H / 2, ROOM_D / 2); scene.add(fw);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xdddad3, roughness: 0.8, metalness: 0 });
  const BH = 0.14;
  [[ROOM_D, Math.PI / 2, -ROOM_W / 2 + 0.002, 0], [ROOM_D, -Math.PI / 2, ROOM_W / 2 - 0.002, 0]].forEach(([len, ry, x, z]) => {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(len, BH), baseMat); b.rotation.y = ry; b.position.set(x, BH / 2, z); scene.add(b);
  });

  // lights (gallery.js:588-608)
  const fixMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffee88 });
  const fixGeo = new THREE.CylinderGeometry(0.035, 0.065, 0.20, 8), bulbGeo = new THREE.SphereGeometry(0.038, 8, 8);
  const lightZ = [];
  for (let i = 0; i < LIGHTS; i++) {
    const lz = ROOM_D / 2 - 1.5 - (i / (LIGHTS - 1)) * (ROOM_D - 3);
    lightZ.push(lz);
    const light = new THREE.PointLight(0xffedd0, 3.5, 11);
    light.position.set(0, ROOM_H - 0.08, lz); scene.add(light);
    const fix = new THREE.Mesh(fixGeo, fixMat); fix.position.set(0, ROOM_H - 0.10, lz); scene.add(fix);
    const bulb = new THREE.Mesh(bulbGeo, bulbMat); bulb.position.set(0, ROOM_H - 0.20, lz); scene.add(bulb);
  }

  // photos and frames (gallery.js:84-117, 611-631)
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1c1710, roughness: 0.20, metalness: 0.92 });
  const clickables = [];
  spots.forEach((sp) => {
    const ry = sp.side === -1 ? Math.PI / 2 : -Math.PI / 2;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(sp.w, sp.h), new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.18, metalness: 0 }));
    mesh.rotation.y = ry;
    mesh.position.set(sp.x - sp.side * 0.01, sp.y, sp.z);
    mesh.userData = { ...sp, loaded: false };
    scene.add(mesh); clickables.push(mesh);
    const FW = 0.026, FD = 0.018;
    const hBar = new THREE.BoxGeometry(sp.w + FW * 2, FW, FD), vBar = new THREE.BoxGeometry(FW, sp.h, FD);
    const px = sp.x - sp.side * 0.01;
    [[hBar, px, sp.y + sp.h / 2 + FW / 2, sp.z], [hBar, px, sp.y - sp.h / 2 - FW / 2, sp.z], [vBar, px, sp.y, sp.z + sp.w / 2 + FW / 2], [vBar, px, sp.y, sp.z - sp.w / 2 - FW / 2]]
      .forEach(([g, x, y, z]) => { const m = new THREE.Mesh(g, frameMat); m.rotation.y = ry; m.position.set(x, y, z); scene.add(m); });
  });
  const photoLoader = new THREE.TextureLoader();
  photoLoader.setCrossOrigin("anonymous");

  // camera (gallery.js:120-123)
  let camYaw = 0, camPitch = 0, targetYaw = 0, targetPitch = 0;
  const entryZ = ROOM_D / 2 - 10;
  const targetPos = new THREE.Vector3(0, EYE_Y, Study.reduce ? entryZ : ROOM_D / 2 - 0.5);
  camera.position.copy(targetPos);
  let focus = null, dirty = true;
  const clampPos = () => {   // gallery.js:245-248
    targetPos.x = clamp(targetPos.x, -(WALL_X - 1.5), WALL_X - 1.5);
    targetPos.z = clamp(targetPos.z, -(ROOM_D / 2 - 0.5), ROOM_D / 2 - 0.5);
  };

  function size() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    camera.aspect = w / h; camera.updateProjectionMatrix();
    dirty = true;
    drawPlanStatic();
  }

  // ---------- input ----------
  const keys = new Set();
  host.addEventListener("keydown", (e) => {
    if (focus) {
      if (e.key === "Escape") { e.preventDefault(); closeFocus(); }
      else if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); step(e.key === "ArrowRight" ? 1 : -1); }
      return;
    }
    if (e.key === "Enter") { const r = canvas.getBoundingClientRect(); handleClick(r.left + r.width / 2, r.top + r.height / 2); e.preventDefault(); return; }
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) { keys.add(e.code); e.preventDefault(); }
  });
  host.addEventListener("keyup", (e) => keys.delete(e.code));
  host.addEventListener("blur", () => keys.clear());

  canvas.style.touchAction = "pan-y";
  const pointers = new Map();
  let down = null, pinch0 = null;
  canvas.addEventListener("pointerdown", (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    if (pointers.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); down = null; }
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 2 && pinch0 !== null && !focus) {   // pinch to walk, gallery.js:208-216
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      targetPos.addScaledVector(new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw)), (d - pinch0) * 0.018);
      clampPos(); pinch0 = d; return;
    }
    if (focus) return;
    if (e.pointerType === "mouse") {   // drag to look, gallery.js:158-163
      targetYaw -= dx * 0.003;
      targetPitch = clamp(targetPitch - dy * 0.003, -0.65, 0.55);
    } else {                            // swipe sideways to turn, gallery.js:222
      targetYaw -= dx * 0.004;
    }
  });
  const up = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch0 = null;
    if (pointers.size === 0 && down && e.type === "pointerup") {
      // a short, still press is a click (gallery.js:167)
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8 && performance.now() - down.t < 280) handleClick(e.clientX, e.clientY);
      down = null;
    }
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("click", (e) => { if (!e.isTrusted) handleClick(e.clientX, e.clientY); });

  const rc = new THREE.Raycaster();
  function handleClick(cx, cy) {   // gallery.js:250-261
    if (focus) return;
    const r = canvas.getBoundingClientRect();
    rc.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
    const hit = rc.intersectObjects(clickables)[0];
    if (hit) walkTo(hit.object);
  }

  // ---------- walk to a photo (gallery.js:315-348) ----------
  const proxies = [];
  const cancelAll = () => { proxies.forEach((c) => c()); proxies.length = 0; };
  function walkTo(mesh, saved) {
    const { photo, side, index = mesh.userData.i } = mesh.userData;
    const destX = mesh.position.x - side * 2.2;
    const destYaw = side * (-Math.PI / 2);
    focus = { mesh, index, saved: saved || { pos: targetPos.clone(), yaw: targetYaw, pitch: targetPitch } };
    cancelAll();
    const y = { v: targetYaw }, pi = { v: targetPitch };
    proxies.push(tween(targetPos, { x: destX, z: mesh.position.z }, { duration: 1.3, ease: "power3.inOut" }));
    proxies.push(tween(y, { v: destYaw }, { duration: 1.0, ease: "power2.inOut", onUpdate: () => { targetYaw = y.v; } }));
    proxies.push(tween(pi, { v: 0 }, { duration: 0.7, ease: "power2.out", onUpdate: () => { targetPitch = pi.v; } }));
    showPanel(photo);
  }
  function closeFocus() {   // gallery.js:404-425
    if (!focus) return;
    const { saved } = focus;
    focus = null;
    panel.hidden = true;
    cancelAll();
    const y = { v: targetYaw }, pi = { v: targetPitch };
    proxies.push(tween(targetPos, { x: saved.pos.x, z: saved.pos.z }, { duration: 1.1, ease: "power2.inOut" }));
    proxies.push(tween(y, { v: saved.yaw }, { duration: 0.9, ease: "power2.inOut", onUpdate: () => { targetYaw = y.v; } }));
    proxies.push(tween(pi, { v: saved.pitch }, { duration: 0.6, ease: "power2.out", onUpdate: () => { targetPitch = pi.v; } }));
    host.focus({ preventScroll: true });
  }
  function step(dir) {   // gallery.js:427-439
    if (!focus) return;
    const next = focus.index + dir;
    if (next < 0 || next >= clickables.length) return;
    const saved = focus.saved;
    focus = null;
    walkTo(clickables[next], saved);
  }
  function showPanel(photo) {
    panel.querySelector(".mu-week").textContent = `Week ${photo.week}`;
    const box = panel.querySelector(".mu-sub");
    box.innerHTML = "";
    box.appendChild(formatSubtitle(photo.subtitle));
    panel.hidden = false;
  }
  panel.querySelector("[data-mu-back]").addEventListener("click", closeFocus);
  panel.querySelector("[data-mu-prev]").addEventListener("click", () => step(-1));
  panel.querySelector("[data-mu-next]").addEventListener("click", () => step(1));

  // hand (gallery.js:266-311): the joystick walks, a pinch on a photo walks to it
  let handOver = false;
  fig.addEventListener("hand", ({ detail: d }) => {
    handOver = true;
    if (!d.active) return;
    d.claimScroll = true;
    d.hint = focus ? "Pinch and hold to step back." : "Your hand walks the corridor.";
    if (focus) return;
    const fwd = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const rgt = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
    targetPos.addScaledVector(fwd, -d.joyY * SPEED);
    targetPos.addScaledVector(rgt, d.joyX * SPEED);
    clampPos();
    if (d.pinchStart) handleClick(d.cx, d.cy);
  });
  fig.addEventListener("hand:leave", () => { handOver = false; });
  document.addEventListener("hand:hold", (e) => { if (focus && handOver) { e.preventDefault(); closeFocus(); } });

  // ---------- the plan ----------
  const NS = "http://www.w3.org/2000/svg";
  const mk = (tag, attrs, parent = plan) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); parent.appendChild(el); return el; };
  // plan x runs from the entrance (z = 55) to the far wall (z = -55); plan y is the room's width
  const PX = (z) => ROOM_D / 2 - z, PY = (x) => x + ROOM_W / 2;
  plan.setAttribute("viewBox", `-1 -3.2 ${ROOM_D + 2} ${ROOM_W + 6.4}`);
  mk("rect", { x: 0, y: 0, width: ROOM_D, height: ROOM_W, class: "pl-room" });
  for (let m = 0; m <= ROOM_D; m += 10) mk("line", { x1: m, x2: m, y1: ROOM_W, y2: ROOM_W + 0.9, class: "pl-tick" });
  [0, 50, 110].forEach((m) => { const t = mk("text", { x: m, y: ROOM_W + 2.9, class: "pl-label", "text-anchor": m === 0 ? "start" : m === 110 ? "end" : "middle" }); t.textContent = m + " m"; });
  lightZ.forEach((z) => mk("circle", { cx: PX(z), cy: ROOM_W / 2, r: 0.32, class: "pl-light" }));
  const photoEls = spots.map((sp) => {
    const y = sp.side === -1 ? 0.35 : ROOM_W - 0.35;
    return mk("line", { x1: PX(sp.z) - sp.w / 2, x2: PX(sp.z) + sp.w / 2, y1: y, y2: y, class: "pl-photo" });
  });
  const cone = mk("path", { class: "pl-cone", d: "" });
  const me = mk("circle", { class: "pl-me", r: 0.75, cx: 0, cy: 0 });
  const t0 = mk("text", { x: 0, y: -1.1, class: "pl-label" }); t0.textContent = "entrance";
  const t1 = mk("text", { x: ROOM_D, y: -1.1, class: "pl-label", "text-anchor": "end" }); t1.textContent = "far wall";
  function drawPlanStatic() {
    const pxPerUnit = (plan.getBoundingClientRect().width || 900) / (ROOM_D + 2);
    plan.style.setProperty("--pl-fs", (12 / pxPerUnit).toFixed(3) + "px");
  }
  plan.addEventListener("click", (e) => {
    const r = plan.getBoundingClientRect();
    const vb = plan.viewBox.baseVal;
    const sx = vb.x + ((e.clientX - r.left) / r.width) * vb.width;
    const sy = vb.y + ((e.clientY - r.top) / r.height) * vb.height;
    if (focus) { focus = null; panel.hidden = true; }
    cancelAll();
    const z = clamp(ROOM_D / 2 - sx, -(ROOM_D / 2 - 0.5), ROOM_D / 2 - 0.5);
    const x = clamp(sy - ROOM_W / 2, -(WALL_X - 1.5), WALL_X - 1.5);
    proxies.push(tween(targetPos, { x, z }, { duration: 1.3, ease: "power3.inOut" }));
  });
  function drawPlan() {
    const px = PX(camera.position.z), py = PY(camera.position.x);
    me.setAttribute("cx", px.toFixed(2)); me.setAttribute("cy", py.toFixed(2));
    // the view cone: facing -z is facing +x on the plan
    const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(65 / 2)) * camera.aspect);
    const L = 9;
    const a = -camYaw;   // yaw turns left on the plan as it grows
    const p1 = [px + Math.cos(a - half) * L, py + Math.sin(a - half) * L];
    const p2 = [px + Math.cos(a + half) * L, py + Math.sin(a + half) * L];
    cone.setAttribute("d", `M${px.toFixed(2)} ${py.toFixed(2)}L${p1[0].toFixed(2)} ${p1[1].toFixed(2)}L${p2[0].toFixed(2)} ${p2[1].toFixed(2)}Z`);
    const nearest = focus ? focus.index : -1;
    photoEls.forEach((el, i) => el.classList.toggle("is-on", i === nearest || clickables[i].userData.loaded));
  }

  // ---------- loop (gallery.js:445-483) ----------
  let lastOut = "";
  const frame = (t, dt) => {
    const f = dt * 60;
    if (!focus) {
      const fwd = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
      const rgt = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
      if (keys.has("ArrowUp") || keys.has("KeyW")) targetPos.addScaledVector(fwd, SPEED * f);
      if (keys.has("ArrowDown") || keys.has("KeyS")) targetPos.addScaledVector(fwd, -SPEED * f);
      if (keys.has("KeyA")) targetPos.addScaledVector(rgt, -SPEED * f);
      if (keys.has("KeyD")) targetPos.addScaledVector(rgt, SPEED * f);
      if (keys.has("ArrowLeft")) targetYaw += 0.028 * f;
      if (keys.has("ArrowRight")) targetYaw -= 0.028 * f;
      clampPos();
    }
    const k1 = 1 - (1 - 0.10) ** f, k2 = 1 - (1 - 0.08) ** f;
    const before = camera.position.clone(), by = camYaw, bp = camPitch;
    camYaw += (targetYaw - camYaw) * k1;
    camPitch += (targetPitch - camPitch) * k1;
    camera.position.lerp(targetPos, k2);
    camera.rotation.y = camYaw; camera.rotation.x = camPitch;
    const moving = before.distanceToSquared(camera.position) > 1e-8 || Math.abs(by - camYaw) + Math.abs(bp - camPitch) > 1e-6;

    clickables.forEach((mesh) => {   // gallery.js:466-480, within 22 m
      if (mesh.userData.loaded) return;
      if (camera.position.distanceTo(mesh.position) < 22) {
        mesh.userData.loaded = true;
        photoLoader.load(cloudinaryUrl(mesh.userData.photo.url, Math.round(mesh.userData.w * 220), "auto:best", 1), (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          mesh.material.map = tex; mesh.material.color.set(0xffffff); mesh.material.needsUpdate = true;
          dirty = true;
        });
      }
    });
    if (moving || dirty) { renderer.render(scene, camera); drawPlan(); dirty = false; }
    const walked = clamp(ROOM_D / 2 - camera.position.z, 0, ROOM_D);
    const deg = ((THREE.MathUtils.radToDeg(camYaw) % 360) + 540) % 360 - 180;
    const html = `<li>walked <b>${fmt(walked, 1)}</b> of 110 m</li><li>facing <b>${fmt(deg, 0)}°</b></li><li>lights <b>24</b></li><li>photos loaded <b>${clickables.filter((m) => m.userData.loaded).length}</b> of ${clickables.length}</li>`;
    if (html !== lastOut) { out.innerHTML = html; lastOut = html; }
  };

  size();
  drawPlan();
  new ResizeObserver(size).observe(host);
  let stop = null, entered = false;
  Study.onVisible(fig, () => {
    if (!entered) {   // gallery.js:486, walk in from the door
      entered = true;
      if (!Study.reduce) proxies.push(tween(targetPos, { z: entryZ }, { duration: 2.8, ease: "power3.out" }));
    }
    dirty = true;
    if (!stop) stop = Study.raf(frame);
  }, () => { if (stop) { stop(); stop = null; } keys.clear(); }, "100px 0px");
  fig.classList.add("is-live");
}
