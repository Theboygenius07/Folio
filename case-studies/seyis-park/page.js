/* Seyi's Park, the case study's live figures.

   Source: "Seyi's 3d Park/main.js" (three.js 0.149.0, GSAP 3.12.5, Howler 2.2.4),
   its style.css, and Portfolio-test2.glb. Every constant below is the park's own,
   cited as main.js:line or style.css:line. Figures build only when they come near
   the screen (Study.onVisible) and pause when they leave.

     Fig. 2  #fig-file   the GLB, every object named, three cameras
     Fig. 3  #fig-hop    the hop in 2D: per-frame physics + the GSAP squash curve
     Fig. 4  #fig-floor  the hidden collider, the capsule, the real movement code
     Fig. 5  #fig-sound  the four sounds and what triggers them
     Fig. 6  #fig-night  the 1 s theme tween, frame by frame
*/

const S = window.Study;
const DPR = () => Math.min(2, window.devicePixelRatio || 1);
const css = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();
const asset = (f) => new URL(f, import.meta.url).href;
const fmt = (n, d = 2) => (n < 0 ? "−" : "") + Math.abs(n).toFixed(d);

/* ---------- the park's constants ---------- */
const GRAVITY = 30;          // main.js:61
const CAPSULE_RADIUS = 0.35; // main.js:62
const CAPSULE_HEIGHT = 1;    // main.js:63
const JUMP_HEIGHT = 11;      // main.js:64
const MOVE_SPEED = 7;        // main.js:65
const STEP = 0.035;          // main.js:529 and 532: a fixed step per frame, not the frame's real length
const CHARACTER_TALL = 7.57; // the Character mesh in Portfolio-test2.glb, 0 to 7.57 units

/* ---------- GSAP, loaded once, only when a figure needs it ---------- */
let gsapP = null;
const loadGsap = () => gsapP || (gsapP = new Promise((res, rej) => {
  if (window.gsap) return res(window.gsap);
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js";
  s.onload = () => res(window.gsap);
  s.onerror = () => rej(new Error("GSAP did not load"));
  document.head.appendChild(s);
}));

/* handleJumpAnimation, main.js:679-717. The character's squash and stretch on take-off. */
function squashTimeline(gsap, target) {
  const jumpDuration = 0.5;
  const t1 = gsap.timeline();
  t1.to(target, { x: 1.08, y: 0.9, z: 1.08, duration: jumpDuration * 0.2, ease: "power2.out" });
  t1.to(target, { x: 0.92, y: 1.1, z: 0.92, duration: jumpDuration * 0.3, ease: "power2.out" });
  t1.to(target, { x: 1, y: 1, z: 1, duration: jumpDuration * 0.3, ease: "power1.inOut" });
  t1.to(target, { x: 1, y: 1, z: 1, duration: jumpDuration * 0.2 });
  return t1;
}

/* One hop worked out the way updatePlayer does it (main.js:520-537): no gravity on the
   first frame (the character was on the floor), then gravity, then move, until it lands. */
function analyseHop(jump, move, grav) {
  let y = 0, vy = jump, x = 0, onFloor = true, frames = 0, apex = 0, apexX = 0;
  do {
    frames++;
    if (!onFloor) vy -= grav * STEP;
    y += vy * STEP; x += move * STEP;
    onFloor = false;
    if (y > apex) { apex = y; apexX = x; }
  } while (y > 0 && frames < 4000);
  return { apex, frames, len: x, apexX };
}

/* =====================================================================
   The model, shared by Fig. 2 and Fig. 4: one fetch, one parse.
   ===================================================================== */
let parkP = null;
function loadPark() {
  return parkP || (parkP = (async () => {
    const THREE = await import("three");
    // three 0.149 ran with colour management off and linear output. Matching both
    // here makes the park the colour it is on seyi3d-park.vercel.app.
    THREE.ColorManagement.enabled = false;
    const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
    const gltf = await new GLTFLoader().loadAsync(asset("Portfolio-test2.glb"));
    return { THREE, gltf };
  })());
}

function makeRenderer(THREE, host) {
  let r;
  try {
    r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    host.classList.add("no-gl");
    const w = host.querySelector(".park-wait");
    if (w) w.textContent = "This figure needs WebGL, which this browser has turned off.";
    return null;
  }
  r.setPixelRatio(DPR());
  r.setClearColor(0x000000, 0);                     // the park floats on the paper
  r.outputColorSpace = THREE.LinearSRGBColorSpace;  // 0.149's default LinearEncoding
  r.shadowMap.type = THREE.PCFSoftShadowMap;        // main.js:93
  r.shadowMap.enabled = true;                       // main.js:94
  r.toneMapping = THREE.ACESFilmicToneMapping;      // main.js:95
  r.toneMappingExposure = 1.7;                      // main.js:96
  r.domElement.setAttribute("aria-hidden", "true");
  host.prepend(r.domElement);
  return r;
}

/* The sun and the ambient light, main.js:287-308. three 0.155 dropped "legacy" lighting,
   which multiplied every intensity by pi behind the scenes, so the pi is written out here. */
function addLights(THREE, scene) {
  const sun = new THREE.DirectionalLight(0xffffff, 1 * Math.PI);
  sun.castShadow = true;
  sun.position.set(280, 200, -80);
  sun.target.position.set(100, 0, -10);
  sun.shadow.mapSize.set(2048, 2048); // the park uses 4096; halved because this page draws it twice
  Object.assign(sun.shadow.camera, { left: -150, right: 300, top: 150, bottom: -100 });
  sun.shadow.normalBias = 0.2;
  scene.add(sun.target, sun);
  const amb = new THREE.AmbientLight(0x404040, 2.7 * Math.PI);
  scene.add(amb);
  return { sun, amb };
}

function cloneRoot(gltf) {
  const root = gltf.scene.clone(true);
  const nodes = {};
  root.children.forEach((c) => { nodes[c.name] = c; });
  root.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); // main.js:256-259
  return { root, nodes };
}

/* The page draws the park's camera view as a square of ground cut out round the
   character, so it sits on the paper like a model instead of filling a box.
   R keeps the cut inside the frame: half the view's width, and the view's height
   less the hedges (about 9 units tall) that rise off the back edge. */
function clipRadius(zoom, aspect) {
  return Math.max(4, Math.min(0.3 * aspect * 100 / zoom, (50 / zoom - 8.2) / 0.74));
}
function clipPlanes(THREE) {
  const P = [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)];
  P.set = (cx, cz, R) => { P[0].constant = -(cx - R); P[1].constant = cx + R; P[2].constant = -(cz - R); P[3].constant = cz + R; P.c = [cx, cz, R]; };
  P.inside = (p) => !P.c || (Math.abs(p.x - P.c[0]) <= P.c[2] && Math.abs(p.z - P.c[1]) <= P.c[2]);
  return P;
}

const CLICKABLE = ["Project_1", "Project_2", "Project_3", "Picnic", "Squirtle", "Chicken", "Pikachu", "Bulbasaur", "Charmander", "Snorlax", "Chest"]; // main.js:187-199
const CREATURES = ["Bulbasaur", "Chicken", "Pikachu", "Charmander", "Squirtle", "Snorlax"]; // main.js:448-455

/* What main.js does with each name. */
const WIRE = {
  Character: ["The player. Where it stands in Blender is where you start, and the capsule starts there too.", "main.js:261"],
  Project_1: ["Opens the Bybull card. View Project goes to bybull.ai.", "main.js:134"],
  Project_2: ["Opens the Clark AI card. View Project goes to clarkai-fe.vercel.app.", "main.js:120"],
  Project_3: ["Opens the Linnked card. View Project goes to linnked.vercel.app.", "main.js:127"],
  Chest: ["Opens About Me. The card has no View Project button.", "main.js:141"],
  Picnic: ["Opens My Mind. The card has no View Project button.", "main.js:147"],
  Squirtle: ["Hops when clicked, and plays the creature sound.", "main.js:447"],
  Chicken: ["Hops when clicked, and plays the creature sound.", "main.js:447"],
  Pikachu: ["Hops when clicked, and plays the creature sound.", "main.js:447"],
  Bulbasaur: ["Hops when clicked, and plays the creature sound.", "main.js:447"],
  Charmander: ["Hops when clicked, and plays the creature sound.", "main.js:447"],
  Snorlax: ["Hops when clicked, from its own size, and plays the creature sound.", "main.js:359"],
  Level: ["The hedges, paths, trees, benches and fountain: 63,470 triangles the code only draws.", "never read by name"],
  Text: ["The lettering. The code only draws it.", "never read by name"],
};
const CARDS = {
  Project_1: ["Bybull", "Bybull is a modern platform focused on finance, markets, and intelligent insights."],
  Project_2: ["Clark AI", "Clark is an AI-powered workspace designed to help users think, create, and execute faster."],
  Project_3: ["Linnked", "Linnked is a platform for sending meaningful, beautifully designed messages through a simple link."],
  Chest: ["About Me", "Hey, you found this. I'm Seyi Ogundipe, a Design Engineer, 3D Artist, and Writer."],
  Picnic: ["My Mind", "I like building, thinking, and experimenting."],
};

/* Small pointer helper: a drag turns, a press without movement is a click. */
function dragOrClick(el, { onDrag, onClick, onHover, onLeave }) {
  let down = null, dragging = false;
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    down = { x: e.clientX, y: e.clientY, type: e.pointerType }; dragging = false;
  });
  el.addEventListener("pointermove", (e) => {
    if (down) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (!dragging && Math.hypot(dx, dy) > 5) { dragging = true; try { el.setPointerCapture(e.pointerId); } catch (_) {} }
      if (dragging) { onDrag && onDrag(e.movementX || 0, e.movementY || 0, down.type); return; }
    }
    if (e.pointerType === "mouse") onHover && onHover(e);
  });
  const end = (e) => {
    if (down && !dragging && e.type === "pointerup") onClick && onClick(e);
    down = null; dragging = false;
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener("pointerleave", (e) => { if (!down && e.pointerType === "mouse") onLeave && onLeave(e); });
}

/* =====================================================================
   Fig. 2  Everything is found by name
   ===================================================================== */
function figFile(fig) {
  const host = fig.querySelector(".park-canvas");
  const tip = fig.querySelector(".park-tip");
  const pinsEl = fig.querySelector(".park-pins");
  const rCam = fig.querySelector('[data-r="cam"]'), rInfo = fig.querySelector('[data-r="info"]');
  const tabs = [...fig.querySelectorAll("[data-cam]")];
  let built = false, running = false, needs = true, animUntil = 0;
  let THREE, renderer, scene, root, nodes, gsap, raycaster, pointer;
  let mode = "whole", cams = {}, cam, target, base = {}, dAz = 0, dPol = 0;
  let boxes = {}, helpers = {}, hoverHelper, pins = {}, hovered = null, pinned = null, footprint, footTop, clip;
  let isCharacterReady = true; // main.js:351
  let W = 0, H = 0;

  S.onVisible(fig, start, stop);

  async function start() {
    running = true;
    if (!built) { built = true; await build(); }
    if (!renderer || !running) return;
    needs = true;
    S.raf(loop);
  }
  function stop() { running = false; }

  async function build() {
    let park;
    try { park = await loadPark(); } catch (e) { host.querySelector(".park-wait").textContent = "The model didn't load. Open the park instead."; return; }
    THREE = park.THREE;
    renderer = makeRenderer(THREE, host);
    if (!renderer) return;
    loadGsap().then((g) => { gsap = g; }).catch(() => {});
    scene = new THREE.Scene();
    addLights(THREE, scene);
    ({ root, nodes } = cloneRoot(park.gltf));
    nodes.Ground_Collider.visible = false; // main.js:273
    scene.add(root);
    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();

    const tint = new THREE.Color(css("--tint") || "#3a8f3a");
    CLICKABLE.forEach((n) => {
      boxes[n] = new THREE.Box3().setFromObject(nodes[n]);
      helpers[n] = new THREE.Box3Helper(boxes[n], tint);
      scene.add(helpers[n]);
      pins[n] = makePin(n, `${n}: ${WIRE[n][0]}`, () => activate(n));
    });
    hoverHelper = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color(css("--ink") || "#1d1b18"));
    hoverHelper.visible = false;
    scene.add(hoverHelper);

    // what the park's camera sees from the start, on a 16:9 screen: its frustum met with the ground
    {
      const ch0 = nodes.Character.position, a = 16 / 9;
      const pc = new THREE.OrthographicCamera(-a * 50, a * 50, 50, -50, 1, 1000);
      pc.position.set(ch0.x - 33, 39, ch0.z - 37); pc.lookAt(ch0.x + 10, 0, ch0.z + 10); pc.zoom = 2.2;
      pc.updateMatrixWorld(); pc.updateProjectionMatrix();
      const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ch0.y), ray = new THREE.Raycaster();
      const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => { ray.setFromCamera(new THREE.Vector2(x, y), pc); return ray.ray.intersectPlane(ground, new THREE.Vector3()); });
      footTop = pts.reduce((m, p) => (p.x + p.z > m.x + m.z ? p : m), pts[0]);
      footprint = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts.map((p) => p.clone().setY(p.y + 0.3))), new THREE.LineBasicMaterial({ color: new THREE.Color(css("--ink") || "#1d1b18"), depthTest: false }));
      footprint.renderOrder = 4;
      scene.add(footprint);
      pins.view = makePin("The park's camera", "The park's camera: show what it sees", () => setMode("park"));
      pins.view.classList.add("pin--view");
    }
    clip = clipPlanes(THREE);

    // cameras: the park's own, main.js:313-329 and 805-816
    const aspect = 16 / 9;
    cams.ortho = new THREE.OrthographicCamera(-aspect * 50, aspect * 50, 50, -50, 1, 2000);
    cams.persp = new THREE.PerspectiveCamera(50, aspect, 1, 3000);
    const levelBox = new THREE.Box3().setFromObject(nodes.Level);
    const ch = nodes.Character.position;
    base.whole = { target: levelBox.getCenter(new THREE.Vector3()), box: levelBox };
    base.park = { target: new THREE.Vector3(ch.x + 10, 0, ch.z + 10), pos: new THREE.Vector3(ch.x - 33, 39, ch.z - 37) };
    base.persp = base.whole;

    host.classList.add("is-ready");
    resize();
    new ResizeObserver(resize).observe(host);
    wire();
    setMode("whole");
  }

  /* each marker is a button too, so a tap or the Tab key can reach the small things */
  const pinXY = {};
  function makePin(label, aria, onPress) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "pin"; b.innerHTML = `<i></i><span>${label}</span>`;
    b.setAttribute("aria-label", aria);
    ["pointerdown", "pointerup", "pointermove"].forEach((ev) => b.addEventListener(ev, (e) => e.stopPropagation()));
    b.addEventListener("click", (e) => { e.stopPropagation(); onPress(); });
    b.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse" && !pinned && WIRE[label]) { const at = pinXY[label]; setHover(label); showTip(label, at.x, at.y + 6, false); } });
    pinsEl.appendChild(b);
    return b;
  }
  function activate(n) {
    const at = pinXY[n] || { x: W / 2, y: H / 2 };
    setHover(n);
    if (CREATURES.includes(n)) jumpCharacter(n);
    pinned = n;
    showTip(n, at.x, at.y + 6, !!CARDS[n]);
  }

  /* the direction the park's camera looks from: camera minus look-at point = (-43, 39, -47) */
  const viewDir = () => new THREE.Vector3(-43, 39, -47).normalize();

  function fitOrtho(c, box, dir) {
    const center = box.getCenter(new THREE.Vector3());
    c.position.copy(center).addScaledVector(dir, 600);
    c.lookAt(center); c.updateMatrixWorld();
    const inv = c.matrixWorldInverse, v = new THREE.Vector3();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(inv);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
    // centre the box in the frame
    const right = new THREE.Vector3().setFromMatrixColumn(c.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(c.matrixWorld, 1);
    const shift = right.multiplyScalar((x0 + x1) / 2).add(up.multiplyScalar((y0 + y1) / 2));
    const t = center.clone().add(shift);
    const aspect = W / H;
    c.zoom = Math.min(100 / ((y1 - y0) * 1.04), (100 * aspect) / ((x1 - x0) * 1.04));
    return t;
  }

  function fitPersp(c, box, dir) {
    const center = box.getCenter(new THREE.Vector3());
    const pts = [];
    for (let i = 0; i < 8; i++) pts.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
    const fits = (d) => {
      c.position.copy(center).addScaledVector(dir, d); c.lookAt(center); c.updateMatrixWorld(); c.updateProjectionMatrix();
      return pts.every((p) => { const q = p.clone().project(c); return Math.abs(q.x) < 0.97 && Math.abs(q.y) < 0.93 && q.z < 1; });
    };
    let lo = 50, hi = 3000;
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    return { target: center, dist: hi };
  }

  function setMode(m) {
    mode = m; dAz = 0; dPol = 0; pinned = null; tip.hidden = true;
    tabs.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.cam === m)));
    footprint.visible = m !== "park";
    placeCamera();
    if (m === "whole") { rCam.innerHTML = "<b>OrthographicCamera</b>"; rInfo.textContent = `zoom ${cams.ortho.zoom.toFixed(2)}, fitted to the whole park`; }
    if (m === "park") { rCam.innerHTML = "<b>OrthographicCamera</b>"; rInfo.textContent = `zoom 2.2, ${(100 / 2.2).toFixed(1)} units tall, from where Character starts`; }
    if (m === "persp") { rCam.innerHTML = "<b>PerspectiveCamera</b>"; rInfo.textContent = "fov 50°, from the same direction"; }
    needs = true;
  }

  let orbit = { target: null, r: 1, az: 0, pol: 0 };
  function placeCamera() {
    if (!THREE || !W) return;
    const dir = viewDir();
    let t, pos;
    if (mode === "whole") {
      cam = cams.ortho; t = fitOrtho(cam, base.whole.box, dir);
      pos = t.clone().addScaledVector(dir, 600);
    } else if (mode === "park") {
      cam = cams.ortho; cam.zoom = 2.2; // main.js:328
      t = base.park.target.clone(); pos = base.park.pos.clone();
      const ch0 = nodes.Character.position;
      clip.set(ch0.x - 0.6, ch0.z - 1.6, clipRadius(2.2, W / H));
    } else {
      cam = cams.persp; const f = fitPersp(cam, base.persp.box, dir);
      t = f.target; pos = f.target.clone().addScaledVector(dir, f.dist);
    }
    renderer.clippingPlanes = mode === "park" ? clip : [];
    const off = pos.clone().sub(t);
    orbit = { target: t, r: off.length(), az: Math.atan2(off.x, off.z), pol: Math.acos(off.y / off.length()) };
    applyOrbit();
  }
  function applyOrbit() {
    const pol = Math.min(Math.PI / 2 - 0.12, Math.max(0.2, orbit.pol + dPol));
    const az = orbit.az + dAz;
    cam.position.set(
      orbit.target.x + orbit.r * Math.sin(pol) * Math.sin(az),
      orbit.target.y + orbit.r * Math.cos(pol),
      orbit.target.z + orbit.r * Math.sin(pol) * Math.cos(az));
    cam.lookAt(orbit.target);
    cam.updateProjectionMatrix();
    needs = true;
  }

  function resize() {
    const r = host.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(DPR());
    renderer.setSize(W, H, false);
    renderer.domElement.style.width = W + "px"; renderer.domElement.style.height = H + "px";
    const aspect = W / H;
    // main.js:339-343: the frustum keeps its height and stretches with the screen
    Object.assign(cams.ortho, { left: -aspect * 50, right: aspect * 50, top: 50, bottom: -50 });
    cams.persp.aspect = aspect;
    cams.ortho.updateProjectionMatrix(); cams.persp.updateProjectionMatrix();
    const keepAz = dAz, keepPol = dPol;
    if (cam) { placeCamera(); dAz = keepAz; dPol = keepPol; applyOrbit(); }
    if (mode === "whole" && rInfo) rInfo.textContent = `zoom ${cams.ortho.zoom.toFixed(2)}, fitted to the whole park`;
    needs = true;
  }

  function nameOf(obj) {
    let o = obj;
    while (o && o.parent && o.parent !== root) o = o.parent;
    return o && o.parent === root ? o.name : null;
  }
  function pick(e) {
    const r = host.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(pointer, cam);
    const list = root.children.filter((c) => c.visible);
    const hit = raycaster.intersectObjects(list, true).find((h) => mode !== "park" || clip.inside(h.point));
    return { name: hit ? nameOf(hit.object) : null, x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function showTip(name, x, y, card) {
    if (!name || !WIRE[name]) { tip.hidden = true; return; }
    const [what, where] = WIRE[name];
    let body = what;
    if (card && CARDS[name]) body = `The ${CARDS[name][0]} card: “${CARDS[name][1]}”`;
    tip.innerHTML = `<b>${name}</b><span>${body}</span><em>${where}</em>`;
    tip.hidden = false;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = Math.min(W - tw - 4, Math.max(4, x + 14));
    let top = y + 18;
    if (top + th > H - 4) top = Math.max(4, y - th - 14);
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }

  function setHover(name) {
    if (hovered === name) return;
    hovered = name;
    Object.entries(pins).forEach(([n, p]) => p.classList.toggle("is-on", n === name));
    if (name && name !== "Level" && nodes[name]) {
      hoverHelper.box.setFromObject(nodes[name]);
      hoverHelper.visible = true;
    } else hoverHelper.visible = false;
    needs = true;
  }

  /* jumpCharacter, main.js:353-425, ported as is. Snorlax's branch scales from its own size. */
  function jumpCharacter(meshID) {
    if (!isCharacterReady || !gsap) return;
    const mesh = nodes[meshID];
    const jumpHeight = 2, jumpDuration = 0.5, isSnorlax = meshID === "Snorlax";
    const currentScale = { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z };
    const t1 = gsap.timeline();
    t1.to(mesh.scale, { x: isSnorlax ? currentScale.x * 1.2 : 1.2, y: isSnorlax ? currentScale.y * 0.8 : 0.8, z: isSnorlax ? currentScale.z * 1.2 : 1.2, duration: jumpDuration * 0.2, ease: "power2.out" });
    t1.to(mesh.scale, { x: isSnorlax ? currentScale.x * 0.8 : 0.8, y: isSnorlax ? currentScale.y * 1.3 : 1.3, z: isSnorlax ? currentScale.z * 0.8 : 0.8, duration: jumpDuration * 0.3, ease: "power2.out" });
    t1.to(mesh.position, { y: mesh.position.y + jumpHeight, duration: jumpDuration * 0.5, ease: "power2.out" }, "<");
    t1.to(mesh.scale, { x: isSnorlax ? currentScale.x * 1.2 : 1, y: isSnorlax ? currentScale.y * 1.2 : 1, z: isSnorlax ? currentScale.z * 1.2 : 1, duration: jumpDuration * 0.3, ease: "power1.inOut" });
    t1.to(mesh.position, { y: mesh.position.y, duration: jumpDuration * 0.5, ease: "bounce.out", onComplete: () => { isCharacterReady = true; } }, ">");
    if (!isSnorlax) t1.to(mesh.scale, { x: 1, y: 1, z: 1, duration: jumpDuration * 0.2, ease: "elastic.out(1, 0.3)" });
    isCharacterReady = false; // main.js:462
    animUntil = performance.now() + (t1.duration() + 0.1) * 1000;
  }

  function wire() {
    tabs.forEach((b) => b.addEventListener("click", () => setMode(b.dataset.cam)));
    dragOrClick(host, {
      onDrag: (dx, dy, type) => {
        dAz -= dx * 0.006;
        if (type === "mouse") dPol -= dy * 0.004;
        tip.hidden = true; pinned = null; applyOrbit();
      },
      onHover: (e) => {
        if (pinned) return;
        const p = pick(e); setHover(p.name); showTip(p.name, p.x, p.y, false);
        host.style.cursor = p.name && CLICKABLE.includes(p.name) ? "pointer" : "";
      },
      onLeave: () => { pinned = null; setHover(null); tip.hidden = true; host.style.cursor = ""; },
      onClick: (e) => {
        const p = pick(e);
        setHover(p.name);
        if (p.name && CREATURES.includes(p.name)) jumpCharacter(p.name);
        pinned = p.name;
        showTip(p.name, p.x, p.y, !!(p.name && CARDS[p.name]));
        if (e.pointerType === "mouse") setTimeout(() => { if (pinned === p.name) pinned = null; }, 2600);
      },
    });
    host.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault(); dAz += (e.key === "ArrowLeft" ? 1 : -1) * 0.14; applyOrbit();
      }
    });
  }

  const v3 = () => new THREE.Vector3();
  function placePins() {
    const placed = [];
    const items = CLICKABLE.map((n) => {
      const b = boxes[n];
      const w = v3().set((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2);
      const p = w.clone().project(cam);
      return { n, x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H, off: p.z > 1 || Math.abs(p.x) > 1.02 || Math.abs(p.y) > 1.02 || (mode === "park" && !clip.inside(w)) };
    });
    { const p = footTop.clone().project(cam); items.push({ n: "view", label: "The park's camera", x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H, off: mode === "park" }); }
    items.sort((a, b) => a.y - b.y);
    const narrow = W < 640;
    items.forEach((it) => {
      const el = pins[it.n];
      if (it.off) { el.style.display = "none"; return; }
      el.style.display = "";
      const w = narrow ? 8 : 16 + (it.label || it.n).length * 6.7;
      let y = it.y - 6;
      for (let k = 0; k < 8; k++) {
        const hit = placed.find((q) => it.x - 4 < q.r && it.x + w > q.l && y - 9 < q.b && y + 9 > q.t);
        if (!hit) break;
        y = hit.t - 10;
      }
      placed.push({ l: it.x - 4, r: it.x + w, t: y - 9, b: y + 9 });
      el.style.transform = `translate(${Math.round(it.x - 4)}px, ${Math.round(y)}px) translateY(-50%)`;
      pinXY[it.n] = { x: it.x, y };
    });
  }

  function loop() {
    if (!running) return false;
    const animating = performance.now() < animUntil;
    if (!needs && !animating) return true;
    if (animating) {
      CLICKABLE.forEach((n) => boxes[n].setFromObject(nodes[n]));
      if (hovered && nodes[hovered] && hovered !== "Level") hoverHelper.box.setFromObject(nodes[hovered]);
    }
    needs = false;
    renderer.render(scene, cam);
    placePins();
    return true;
  }
}

/* =====================================================================
   Fig. 3  Every step is a hop (2D)
   ===================================================================== */
function figHop(fig) {
  const host = fig.querySelector(".hop-canvas");
  const cv = host.querySelector("canvas"), g = cv.getContext("2d");
  const svg = fig.querySelector(".hop-curve");
  const inputs = [...fig.querySelectorAll("input[data-k]")];
  const out = (k) => fig.querySelector(`[data-o="${k}"]`);
  const hzTabs = [...fig.querySelectorAll("[data-hz]")];
  const playBtn = fig.querySelector("[data-play]");
  const P = { jump: JUMP_HEIGHT, move: MOVE_SPEED, grav: GRAVITY, hz: 60 };
  const st = { x: 0, y: 0, vx: 0, vy: 0, onFloor: true, isMoving: false, face: 1 };
  const scale = { x: 1, y: 1, z: 1 }; // stands in for character.instance.scale
  let gsap = null, curve = null, tlStart = -1;
  let dir = 0, trail = [], hopId = 0, cur = null, last = null;
  let running = false, inited = false, acc = 0, demo = !S.reduce, demoRest = 0, demoHops = 0, played = false;
  let W = 0, H = 0, unit = 20, groundY = 0;
  const C = {};

  const readColours = () => Object.assign(C, { ink: css("--ink"), ink2: css("--ink-2"), ink3: css("--ink-3"), rule: css("--rule"), tint: css("--tint-ink"), paper: css("--paper") });

  if (S.reduce) playBtn.hidden = false;
  S.onVisible(fig, start, stop);
  wireControls();

  async function start() {
    readColours();
    if (!inited) {
      inited = true;
      try { gsap = await loadGsap(); curve = makeCurve(gsap); } catch (e) { gsap = null; }
      resize();
      new ResizeObserver(resize).observe(host);
      new ResizeObserver(drawChart).observe(svg);
      if (S.reduce) staticHop();
    }
    running = true; acc = 0;
    if (S.reduce && !demo && !played) { draw(); return; }
    S.raf(loop);
  }
  function stop() { running = false; dir = demo ? 0 : dir; }

  /* the ideal curve of the timeline above, for the chart: same segments, same eases */
  function makeCurve(gs) {
    const e2 = gs.parseEase("power2.out"), e1 = gs.parseEase("power1.inOut"), e0 = gs.parseEase("power1.out");
    const segs = [[0, 0.1, [1, 1], [1.08, 0.9], e2], [0.1, 0.25, [1.08, 0.9], [0.92, 1.1], e2], [0.25, 0.4, [0.92, 1.1], [1, 1], e1], [0.4, 0.5, [1, 1], [1, 1], e0]];
    return (t) => {
      for (const [a, b, f, to, e] of segs) if (t <= b) { const k = e(Math.max(0, (t - a) / (b - a))); return [f[0] + (to[0] - f[0]) * k, f[1] + (to[1] - f[1]) * k]; }
      return [1, 1];
    };
  }

  function takeOff() {
    hopId++;
    cur = { x0: st.x, apex: 0, apexX: st.x };
    trail.push({ x: st.x, y: 0, h: hopId });
    trail = trail.filter((p) => p.h > hopId - 4);
    if (gsap) { squashTimeline(gsap, scale); tlStart = performance.now(); }
    if (demo && ++demoHops >= 4) demoRest = 1.5;
  }
  function land() { if (cur) { cur.x1 = st.x; last = cur; cur = null; } }

  /* One park frame. */
  function step() {
    // updatePlayer, main.js:528-534
    if (!st.onFloor) st.vy -= P.grav * STEP;
    st.x += st.vx * STEP; st.y += st.vy * STEP;
    // playerCollisions, main.js:504-518, against a flat floor at y = 0
    st.onFloor = false;
    if (st.y < 0 || (st.y === 0 && st.vy <= 0)) {
      st.y = 0; st.onFloor = true;
      if (st.isMoving) { trail.push({ x: st.x, y: 0, h: hopId }); land(); }
      st.isMoving = false; st.vx = 0;
    } else if (st.isMoving) {
      trail.push({ x: st.x, y: st.y, h: hopId });
      if (cur && st.y > cur.apex) { cur.apex = st.y; cur.apexX = st.x; }
    }
    // handleContinuousMovement, main.js:719-750
    if (dir && !st.isMoving) {
      st.vx += dir * P.move; st.face = dir;
      st.vy = P.jump; st.isMoving = true;
      takeOff();
    }
  }

  function staticHop() {
    // reduced motion: one hop, already drawn
    dir = 1; let n = 0; step(); dir = 0;
    while (st.isMoving && n++ < 4000) step();
  }

  function loop(t, dt) {
    if (!running) return false;
    if (demo) {
      if (demoRest > 0) { dir = 0; demoRest -= dt; if (demoRest <= 0) demoHops = 0; }
      else dir = 1;
    }
    acc += dt;
    const h = 1 / P.hz;
    let n = 0;
    while (acc >= h && n < 12) { step(); acc -= h; n++; }
    draw();
    drawPlayhead();
    return true;
  }

  function resize() {
    const r = host.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    const d = DPR();
    cv.width = Math.round(W * d); cv.height = Math.round(H * d);
    cv.style.width = W + "px"; cv.style.height = H + "px";
    g.setTransform(d, 0, 0, d, 0, 0);
    groundY = H - 40;
    fitUnit();
    draw();
  }

  /* the world is about 26 units wide (22 on a phone, 44 at most), and always tall
     enough for the character plus the highest hop the sliders allow right now */
  function fitUnit() {
    const across = Math.max(22, Math.min(44, W / 26));
    const tall = CHARACTER_TALL + analyseHop(P.jump, P.move, P.grav).apex + 1.4;
    unit = Math.min(W / across, (groundY - 8) / tall);
  }

  /* the character, flat, in its GLB colours, feet at (0, 0), 7.57 units tall */
  const BODY = [
    ["#f2eef0", -0.55, 0, 0.55, 0.7],    // boots
    ["#efa47f", -0.42, 0.7, 0.42, 2.35], // legs
    ["#df3a83", -1.05, 2.35, 1.0, 4.9],  // dress
    ["#f6f2f5", -1.05, 2.35, 1.0, 2.7],  // hem
    ["#efa47f", 0.2, 3.0, 0.62, 4.6],    // arm
    ["#efa47f", -0.85, 4.9, 0.9, 6.75],  // head
    ["#3b2518", -0.98, 6.3, 0.98, 7.57], // hair, top
    ["#3b2518", -0.98, 3.7, -0.3, 7.57], // hair, back
    ["#1d1b18", 0.5, 5.7, 0.72, 5.98],   // eye
  ];
  function drawCharacter(sx, sy) {
    g.save();
    g.translate(sx, sy);
    g.scale(scale.x * st.face * unit, -scale.y * unit);
    BODY.forEach(([c, x0, y0, x1, y1]) => { g.fillStyle = c; g.fillRect(x0, y0, x1 - x0, y1 - y0); });
    g.restore();
  }

  function draw() {
    if (!W) return;
    g.clearRect(0, 0, W, H);
    const camX = st.x - (W * 0.36) / unit;
    const X = (x) => (x - camX) * unit, Y = (y) => groundY - y * unit;
    // ground and a tick every unit
    g.strokeStyle = C.ink; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, groundY + 0.5); g.lineTo(W, groundY + 0.5); g.stroke();
    g.strokeStyle = C.ink3; g.beginPath();
    for (let u = Math.floor(camX); u < camX + W / unit + 1; u++) { const x = Math.round(X(u)) + 0.5; g.moveTo(x, groundY); g.lineTo(x, groundY + (u % 5 === 0 ? 7 : 4)); }
    g.stroke();
    // the last hop: apex and length
    if (last) {
      g.setLineDash([3, 3]); g.strokeStyle = C.ink3;
      g.beginPath(); g.moveTo(X(last.apexX - 1.6), Y(last.apex) + 0.5); g.lineTo(X(last.apexX + 1.6), Y(last.apex) + 0.5); g.stroke();
      g.setLineDash([]);
      g.font = "500 11px " + css("--mono"); g.fillStyle = C.ink2; g.textAlign = "right";
      g.fillText(`apex ${last.apex.toFixed(2)}`, Math.max(64, X(last.apexX)), Y(last.apex) - 8);
      g.textAlign = "center";
      const a = X(last.x0), b = X(last.x1), yb = groundY + 15;
      g.strokeStyle = C.ink2; g.beginPath();
      g.moveTo(a, yb - 3); g.lineTo(a, yb); g.lineTo(b, yb); g.lineTo(b, yb - 3); g.stroke();
      g.fillText(`${Math.abs(last.x1 - last.x0).toFixed(2)}`, (a + b) / 2, yb + 15);
    }
    // a dot for every frame
    trail.forEach((p) => {
      const age = hopId - p.h;
      g.fillStyle = age === 0 ? C.ink : age === 1 ? C.ink2 : C.ink3;
      g.globalAlpha = age >= 3 ? 0.5 : 1;
      g.beginPath(); g.arc(X(p.x), Y(p.y), age === 0 ? 2.4 : 2, 0, Math.PI * 2); g.fill();
    });
    g.globalAlpha = 1;
    drawCharacter(X(st.x), Y(st.y));
  }

  /* ---- the squash chart ---- */
  let ch = null;
  function drawChart() {
    if (!curve) return;
    const w = Math.max(240, Math.round(svg.getBoundingClientRect().width)), h = Math.round(svg.getBoundingClientRect().height) || 200;
    const l = 40, r = 14, t = 34, b = 46, T = 0.6;
    const x = (s) => l + (s / T) * (w - l - r);
    const y = (v) => t + ((1.14 - v) / 0.28) * (h - t - b);
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    const N = 120; let py = "", px = "";
    for (let i = 0; i <= N; i++) { const s = (i / N) * 0.5, [sx, sy] = curve(s); py += `${i ? "L" : "M"}${x(s).toFixed(1)},${y(sy).toFixed(1)}`; px += `${i ? "L" : "M"}${x(s).toFixed(1)},${y(sx).toFixed(1)}`; }
    py += `L${x(T)},${y(1)}`; px += `L${x(T)},${y(1)}`;
    const grid = [0.9, 1.0, 1.1].map((v) => `<line class="c-grid" x1="${l}" x2="${w - r}" y1="${y(v)}" y2="${y(v)}"/><text x="${l - 8}" y="${y(v) + 4}" text-anchor="end">${v.toFixed(1)}</text>`).join("");
    const segs = [[0, "power2.out", 0], [0.1, "power2.out", 1], [0.25, "power1.inOut", 0], [0.4, "hold", 1]];
    const segEls = segs.map(([s, n, row]) => `<line class="c-seg" x1="${x(s)}" x2="${x(s)}" y1="${t - (row ? 2 : 16)}" y2="${h - b}"/><text x="${x(s) + 4}" y="${t - (row ? 4 : 18)}">${n}</text>`).join("") + `<line class="c-seg" x1="${x(0.5)}" x2="${x(0.5)}" y1="${t - 2}" y2="${h - b}"/>`;
    const xt = [0, 0.1, 0.25, 0.4, 0.5].map((s) => `<text x="${x(s)}" y="${h - b + 17}" text-anchor="middle">${s}</text>`).join("") + `<text x="${w - r}" y="${h - b + 17}" text-anchor="end">s</text>`;
    const marks = `<text class="c-strong" x="${x(0.1)}" y="${y(0.9) + 16}" text-anchor="middle">height 0.9</text><text x="${x(0.1)}" y="${y(1.08) - 7}" text-anchor="middle">width 1.08</text><text class="c-strong" x="${x(0.25)}" y="${y(1.1) - 7}" text-anchor="middle">1.1</text><text x="${x(0.25)}" y="${y(0.92) + 16}" text-anchor="middle">0.92</text>`;
    svg.innerHTML = `${grid}<line class="c-axis" x1="${l}" x2="${w - r}" y1="${h - b}" y2="${h - b}"/>${segEls}${xt}<path class="c-x" d="${px}"/><path class="c-y" d="${py}"/>${marks}<line class="c-land" data-land y1="${t - 2}" y2="${h - b + 22}"/><text class="c-tint" data-landt y="${h - b + 36}"></text><circle class="c-dotx" data-dx r="3.5" visibility="hidden"/><circle class="c-dot" data-dy r="4" visibility="hidden"/>`;
    ch = { x, y, T, w, r, land: svg.querySelector("[data-land]"), landT: svg.querySelector("[data-landt]"), dx: svg.querySelector("[data-dx]"), dy: svg.querySelector("[data-dy]") };
    updateLanding();
  }
  function updateLanding() {
    const a = analyseHop(P.jump, P.move, P.grav);
    out("apex").textContent = a.apex.toFixed(2);
    out("frames").textContent = a.frames;
    out("secs").textContent = (a.frames / P.hz).toFixed(2);
    out("len").textContent = a.len.toFixed(2);
    if (!ch) return;
    const tl = a.frames / P.hz;
    const xx = ch.x(Math.min(tl, ch.T));
    ch.land.setAttribute("x1", xx); ch.land.setAttribute("x2", xx);
    const label = tl > ch.T ? `lands at ${tl.toFixed(2)} s →` : `lands, next hop at ${tl.toFixed(2)} s`;
    ch.landT.textContent = label;
    const half = (label.length * 6.7) / 2;
    ch.landT.setAttribute("x", Math.max(half, Math.min(ch.w - half, xx)));
    ch.landT.setAttribute("text-anchor", "middle");
  }
  function drawPlayhead() {
    if (!ch) return;
    const s = tlStart < 0 ? -1 : (performance.now() - tlStart) / 1000;
    const show = !(s < 0 || s > ch.T);
    ch.dy.setAttribute("visibility", show ? "visible" : "hidden"); ch.dx.setAttribute("visibility", show ? "visible" : "hidden");
    if (!show) return;
    ch.dy.setAttribute("cx", ch.x(s)); ch.dy.setAttribute("cy", ch.y(scale.y));
    ch.dx.setAttribute("cx", ch.x(s)); ch.dx.setAttribute("cy", ch.y(scale.x));
  }

  function interact() {
    if (demo) { demo = false; dir = 0; }
    if (!played) { played = true; host.classList.add("is-played"); }
    if (!running) { running = true; S.raf(loop); }
  }

  function wireControls() {
    const keyDir = (e) => (e.code === "ArrowRight" || e.code === "KeyD" || e.code === "Space") ? 1 : (e.code === "ArrowLeft" || e.code === "KeyA") ? -1 : 0;
    host.addEventListener("keydown", (e) => { const d = keyDir(e); if (!d) return; e.preventDefault(); interact(); dir = d; });
    host.addEventListener("keyup", (e) => { const d = keyDir(e); if (d && d === dir) dir = 0; });
    host.addEventListener("blur", () => { if (!demo) dir = 0; });
    host.addEventListener("pointerdown", (e) => {
      interact();
      const r = host.getBoundingClientRect();
      dir = e.clientX - r.left > W * 0.36 ? 1 : -1;
    });
    const release = () => { if (!demo) dir = 0; };
    host.addEventListener("pointerup", release);
    host.addEventListener("pointercancel", release);
    host.addEventListener("pointerleave", release);
    inputs.forEach((inp) => inp.addEventListener("input", () => {
      P[inp.dataset.k] = +inp.value;
      inp.parentElement.querySelector("output").textContent = inp.value;
      updateLanding(); fitUnit(); draw();
    }));
    fig.querySelector("[data-reset]").addEventListener("click", () => {
      const def = { jump: JUMP_HEIGHT, move: MOVE_SPEED, grav: GRAVITY };
      inputs.forEach((inp) => { inp.value = def[inp.dataset.k]; P[inp.dataset.k] = def[inp.dataset.k]; inp.parentElement.querySelector("output").textContent = inp.value; });
      updateLanding(); fitUnit(); draw();
    });
    hzTabs.forEach((b) => b.addEventListener("click", () => {
      P.hz = +b.dataset.hz;
      hzTabs.forEach((o) => o.setAttribute("aria-selected", String(o === b)));
      updateLanding();
    }));
    playBtn.addEventListener("click", () => {
      demo = true; played = true; playBtn.hidden = true;
      if (!running) { running = true; S.raf(loop); }
      else S.raf(loop);
    });
  }
}

/* =====================================================================
   Fig. 4  The floor you never see
   ===================================================================== */
function figFloor(fig) {
  const host = fig.querySelector(".floor-canvas");
  const capLabel = fig.querySelector(".cap-label");
  const viewTabs = [...fig.querySelectorAll("[data-view]")], zoomTabs = [...fig.querySelectorAll("[data-zoom]")];
  const out = (k) => fig.querySelector(`[data-o="${k}"]`);
  let built = false, running = false, acc = 0, frame = 0;
  let THREE, renderer, scene, root, nodes, cam, gsap, octree, playerCollider, character;
  let colFill, colWire, colVol, colEdges, capsule, view = "both", clip, needs = true, lastKey = "";
  let W = 0, H = 0;
  const pressed = { up: false, left: false, right: false, down: false }; // main.js:672
  let playerVelocity, playerOnFloor = false, targetRotation = Math.PI / 2, spawn, isMoving = false; // main.js:67-82
  let origMaterials = new Map();

  S.onVisible(fig, start, stop);

  async function start() {
    running = true; needs = true;
    if (!built) { built = true; await build(); }
    if (!renderer || !running) return;
    S.raf(loop);
  }
  function stop() { running = false; Object.keys(pressed).forEach((k) => { pressed[k] = false; }); }

  async function build() {
    let park;
    try { park = await loadPark(); } catch (e) { host.querySelector(".park-wait").textContent = "The model didn't load. Open the park instead."; return; }
    THREE = park.THREE;
    const [{ Octree }, { Capsule }] = await Promise.all([import("three/addons/math/Octree.js"), import("three/addons/math/Capsule.js")]);
    renderer = makeRenderer(THREE, host);
    if (!renderer) return;
    try { gsap = await loadGsap(); } catch (e) { gsap = null; }
    scene = new THREE.Scene();
    addLights(THREE, scene);
    ({ root, nodes } = cloneRoot(park.gltf));
    scene.add(root);
    character = nodes.Character;

    // main.js:271-274: the collider becomes an octree, then hides
    const collider = nodes.Ground_Collider;
    octree = new Octree();
    octree.fromGraphNode(collider);
    collider.visible = false;

    // what this figure adds: the collider drawn, as a white model and as its triangles
    colFill = new THREE.Mesh(collider.geometry, new THREE.MeshLambertMaterial({ color: 0xe9e5da, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
    colFill.castShadow = true; colFill.receiveShadow = true;
    colWire = new THREE.LineSegments(new THREE.WireframeGeometry(collider.geometry), new THREE.LineBasicMaterial({ color: new THREE.Color(css("--ink") || "#1d1b18"), transparent: true, opacity: 0.3 }));
    colWire.renderOrder = 5;
    // over the drawn park: the collider as see-through green volumes with their hard edges
    colVol = new THREE.Mesh(collider.geometry, new THREE.MeshBasicMaterial({ color: new THREE.Color(css("--tint") || "#3a8f3a"), transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
    colVol.renderOrder = 3;
    colEdges = new THREE.LineSegments(new THREE.EdgesGeometry(collider.geometry, 20), new THREE.LineBasicMaterial({ color: new THREE.Color(css("--tint-ink") || "#2b6b2b"), transparent: true, opacity: 0.85, depthTest: false }));
    colEdges.renderOrder = 5;
    [colFill, colWire, colVol, colEdges].forEach((o) => { o.position.copy(collider.position); o.quaternion.copy(collider.quaternion); o.scale.copy(collider.scale); root.add(o); });

    // the capsule, main.js:62-63 and 75-79, drawn over everything
    capsule = new THREE.Mesh(new THREE.CapsuleGeometry(CAPSULE_RADIUS, CAPSULE_HEIGHT - CAPSULE_RADIUS, 6, 18), new THREE.MeshBasicMaterial({ color: new THREE.Color(css("--tint") || "#3a8f3a"), depthTest: false, transparent: true, opacity: 0.92 }));
    capsule.renderOrder = 6;
    scene.add(capsule);

    playerVelocity = new THREE.Vector3();
    playerCollider = new Capsule(new THREE.Vector3(0, CAPSULE_RADIUS, 0), new THREE.Vector3(0, CAPSULE_HEIGHT, 0), CAPSULE_RADIUS);
    spawn = character.position.clone(); // main.js:262
    respawn();

    const aspect = 16 / 9;
    cam = new THREE.OrthographicCamera(-aspect * 50, aspect * 50, 50, -50, 1, 1000); // main.js:313-320
    cam.zoom = 2.2; // main.js:328
    clip = clipPlanes(THREE);
    renderer.clippingPlanes = clip;

    host.classList.add("is-ready");
    resize();
    new ResizeObserver(resize).observe(host);
    setView("both");
    wire();
  }

  function setView(v) {
    view = v; needs = true;
    viewTabs.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === v)));
    const onlyCollider = v === "collider";
    root.children.forEach((c) => {
      if (c === colFill || c === colWire || c === colVol || c === colEdges || c.name === "Ground_Collider") return;
      c.visible = c.name === "Character" ? true : !onlyCollider;
    });
    colFill.visible = onlyCollider;
    colWire.visible = onlyCollider;
    colVol.visible = v === "both";
    colEdges.visible = v === "both";
    capsule.visible = v !== "drawn";
    capLabel.hidden = v === "drawn";
  }

  function resize() {
    const r = host.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(DPR());
    renderer.setSize(W, H, false);
    renderer.domElement.style.width = W + "px"; renderer.domElement.style.height = H + "px";
    const aspect = W / H; // main.js:335-347
    Object.assign(cam, { left: -aspect * 50, right: aspect * 50, top: 50, bottom: -50 });
    cam.updateProjectionMatrix();
    needs = true;
  }

  /* main.js:490-502 */
  function respawn() {
    character.position.copy(spawn);
    playerCollider.start.copy(spawn).add(new THREE.Vector3(0, CAPSULE_RADIUS, 0));
    playerCollider.end.copy(spawn).add(new THREE.Vector3(0, CAPSULE_HEIGHT, 0));
    playerVelocity.set(0, 0, 0);
    isMoving = false;
  }

  /* main.js:504-518 */
  function playerCollisions() {
    const result = octree.capsuleIntersect(playerCollider);
    playerOnFloor = false;
    if (result) {
      playerOnFloor = result.normal.y > 0;
      playerCollider.translate(result.normal.multiplyScalar(result.depth));
      if (playerOnFloor) { isMoving = false; playerVelocity.x = 0; playerVelocity.z = 0; }
    }
  }

  /* main.js:520-551 */
  function updatePlayer() {
    if (character.position.y < -20) { respawn(); return; }
    if (!playerOnFloor) playerVelocity.y -= GRAVITY * STEP;
    playerCollider.translate(playerVelocity.clone().multiplyScalar(STEP));
    playerCollisions();
    character.position.copy(playerCollider.start);
    character.position.y -= CAPSULE_RADIUS;
    const rotationDiff = ((((targetRotation - character.rotation.y) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
    const finalRotation = character.rotation.y + rotationDiff;
    character.rotation.y = THREE.MathUtils.lerp(character.rotation.y, finalRotation, 0.4);
  }

  /* main.js:719-750 */
  function handleContinuousMovement() {
    if (Object.values(pressed).some((p) => p) && !isMoving) {
      if (pressed.up) { playerVelocity.z += MOVE_SPEED; targetRotation = 0; }
      if (pressed.down) { playerVelocity.z -= MOVE_SPEED; targetRotation = Math.PI; }
      if (pressed.left) { playerVelocity.x += MOVE_SPEED; targetRotation = Math.PI / 2; }
      if (pressed.right) { playerVelocity.x -= MOVE_SPEED; targetRotation = -Math.PI / 2; }
      playerVelocity.y = JUMP_HEIGHT;
      isMoving = true;
      if (gsap) squashTimeline(gsap, character.scale);
      host.classList.add("is-played");
    }
  }

  function loop(t, dt) {
    if (!running) return false;
    // one park frame per 1/60 s, so the hop matches a 60 Hz screen everywhere
    acc += dt; let n = 0;
    while (acc >= 1 / 60 && n < 6) { updatePlayer(); handleContinuousMovement(); acc -= 1 / 60; n++; }
    // the camera, main.js:805-816
    const p = character.position;
    cam.position.set(p.x - 33, 39, p.z - 37);
    cam.lookAt(p.x + 10, cam.position.y - 39, p.z + 10);
    clip.set(p.x - 0.6, p.z - 1.6, clipRadius(cam.zoom, W / H));
    capsule.position.copy(playerCollider.start).add(playerCollider.end).multiplyScalar(0.5);
    // draw only when something moved: standing still costs nothing
    const key = [p.x, p.y, p.z, character.rotation.y, character.scale.x, character.scale.y, cam.zoom, W, H].map((v) => v.toFixed(4)).join();
    if (key === lastKey && !needs) return true;
    lastKey = key; needs = false;
    renderer.render(scene, cam);
    if (!capLabel.hidden) {
      const q = capsule.position.clone(); q.x -= 0.5; q.y += 0.2;
      const s = q.project(cam);
      capLabel.style.transform = `translate(${Math.round((s.x * 0.5 + 0.5) * W + 6)}px, ${Math.round((-s.y * 0.5 + 0.5) * H)}px) translateY(-50%)`;
    }
    if (++frame % 3 === 0) {
      out("x").textContent = fmt(p.x); out("y").textContent = fmt(p.y); out("z").textContent = fmt(p.z);
      out("vy").textContent = fmt(playerOnFloor ? 0 : playerVelocity.y);
      out("floor").textContent = playerOnFloor ? "yes" : "no";
    }
    return true;
  }

  function wire() {
    viewTabs.forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
    zoomTabs.forEach((b) => b.addEventListener("click", () => {
      cam.zoom = +b.dataset.zoom; cam.updateProjectionMatrix();
      zoomTabs.forEach((o) => o.setAttribute("aria-selected", String(o === b)));
    }));
    const map = { KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down", KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right" }; // main.js:553-598
    host.addEventListener("keydown", (e) => {
      if (e.code === "KeyR") { e.preventDefault(); respawn(); return; } // main.js:554
      const d = map[e.code]; if (!d) return;
      e.preventDefault(); pressed[d] = true;
    });
    host.addEventListener("keyup", (e) => { const d = map[e.code]; if (d) pressed[d] = false; });
    host.addEventListener("blur", () => Object.keys(pressed).forEach((k) => { pressed[k] = false; })); // main.js:782
    fig.querySelectorAll("[data-dir]").forEach((b) => {
      const d = b.dataset.dir;
      const on = (e) => { e.preventDefault(); pressed[d] = true; b.setAttribute("aria-pressed", "true"); try { b.setPointerCapture(e.pointerId); } catch (_) {} };
      const off = () => { pressed[d] = false; b.setAttribute("aria-pressed", "false"); };
      b.addEventListener("pointerdown", on);
      ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => b.addEventListener(ev, off));
      b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pressed[d] = true; } });
      b.addEventListener("keyup", (e) => { if (e.key === "Enter" || e.key === " ") off(); });
      b.addEventListener("contextmenu", (e) => e.preventDefault());
    });
    fig.querySelector("[data-respawn]").addEventListener("click", respawn);
  }
}

/* =====================================================================
   Fig. 5  Four sounds
   ===================================================================== */
const PEAKS = {
  hop: [0, 0.08, 0.06, 0.11, 0.17, 0.2, 0.17, 0.51, 0.91, 0.76, 0.75, 0.67, 0.95, 0.82, 0.92, 0.85, 0.9, 0.96, 1, 0.76, 0.8, 0.83, 0.73, 0.81, 0.51, 0.57, 0.42, 0.57, 0.41, 0.29, 0.47, 0.31, 0.22, 0.18, 0.12, 0.19, 0.14, 0.1, 0.11, 0.06],
  card: [0, 0, 0, 0, 0, 0, 0, 0, 0.03, 0.19, 1, 0.42, 0.27, 0.1, 0.04, 0.02, 0.02, 0.01, 0.01, 0, 0, 0, 0, 0.03, 0.94, 0.56, 0.1, 0.02, 0.01, 0.01, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  creature: [0, 0, 0, 0, 0.99, 1, 1, 1, 0.96, 0.94, 0.9, 0.86, 0.83, 0.8, 0.76, 0.73, 0.69, 0.66, 0.62, 0.59, 0.56, 0.53, 0.49, 0.46, 0.42, 0.39, 0.36, 0.33, 0.29, 0.26, 0.23, 0.19, 0.16, 0.13, 0.09, 0.06, 0.02, 0, 0, 0],
  music: null, // filled from MUSIC_PEAKS below
};
const MUSIC_PEAKS = [0.18,0.52,0.89,0.89,0.89,0.92,0.9,0.9,0.9,0.86,0.86,0.88,0.88,0.83,0.89,0.88,0.79,0.91,0.9,0.94,0.89,0.89,0.87,0.88,0.91,0.93,0.88,0.93,0.88,0.85,0.93,0.9,0.86,0.88,0.88,0.86,0.83,0.87,0.89,0.86,0.87,0.87,0.87,0.86,0.89,0.88,0.88,0.89,0.88,0.88,0.85,0.83,0.89,0.87,0.86,0.89,0.89,0.88,0.85,0.85,0.89,0.86,0.91,0.87,0.89,0.9,0.9,0.85,1.0,0.89,0.93,0.89,0.89,0.91,0.87,0.88,0.91,0.91,0.92,0.88,0.87,0.88,0.94,0.87,0.88,0.87,0.9,0.92,0.87,0.9,0.89,0.92,0.89,0.91,0.9,0.91,0.9,0.86,0.9,0.91,0.88,0.89,0.86,0.85,0.9,0.88,0.81,0.9,0.92,0.88,0.87,0.88,0.88,0.88,0.89,0.9,0.86,0.87,0.9,0.87,0.87,0.91,0.9,0.85,0.88,0.88,0.88,0.88,0.85,0.87,0.87,0.89,0.94,0.89,0.85,0.89,0.85,0.91,0.87,0.96,0.91,0.86,0.91,0.92,0.87,0.91,0.9,0.82,0.79,0.72,0.63,0.6,0.55,0.43,0.4,0.31,0.25,0.19,0.12,0.05]; // 160 peaks of music.mp3, measured with ffmpeg

function figSound(fig) {
  PEAKS.music = MUSIC_PEAKS;
  const VOL = { music: 0.3, card: 0.5, creature: 0.5, hop: 1.0 }; // main.js:8-33
  const FILE = { music: "music.mp3", card: "card.mp3", creature: "creature.mp3", hop: "hop.mp3" };
  const DUR = { music: 123.56, card: 0.141, creature: 0.189, hop: 0.156 };
  const TRIG = { // what main.js plays, and where
    enter: ["card", "music"],  // main.js:237-240
    soundon: ["music"],        // main.js:655, toggleAudio while muted
    hop: ["hop"],              // main.js:726
    open: ["card"],            // main.js:467
    close: ["card"],           // main.js:176
    theme: ["card"],           // main.js:602
    sound: ["card"],           // main.js:648, toggleAudio while not muted
    poke: ["creature"],        // main.js:458
  };
  const rows = Object.fromEntries([...fig.querySelectorAll(".sb-row")].map((r) => [r.dataset.row, r]));
  const waves = Object.fromEntries([...fig.querySelectorAll("[data-wave]")].map((c) => [c.dataset.wave, c]));
  const gate = fig.querySelector("[data-mute]");
  const musicBtn = fig.querySelector('[data-play="music"]');
  const musicTime = fig.querySelector('[data-time="music"]');
  let ctx = null, music = null, isMuted = false, onScreen = false;
  const buffers = {}, playing = {};
  const C = {};

  const ensure = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };
  const getBuffer = (name) => buffers[name] || (buffers[name] = fetch(asset(FILE[name]))
    .then((r) => r.arrayBuffer())
    .then((a) => new Promise((res, rej) => ensure().decodeAudioData(a, res, rej))));

  async function playSfx(name) {
    if (isMuted) return; // main.js:40
    ensure();
    const buf = await getBuffer(name);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const gain = ctx.createGain(); gain.gain.value = VOL[name];
    src.connect(gain).connect(ctx.destination);
    src.start();
    playing[name] = { t0: performance.now(), dur: Math.max(buf.duration, 0.35) * 1000, real: buf.duration * 1000 };
    tick();
  }
  function musicOn() {
    ensure();
    if (!music) {
      music = new Audio(asset(FILE.music)); music.loop = true; music.preload = "auto";
      const node = ctx.createMediaElementSource(music), gain = ctx.createGain();
      gain.gain.value = VOL.music; // main.js:12
      node.connect(gain).connect(ctx.destination);
    }
    music.play().catch(() => {});
    musicBtn.setAttribute("aria-pressed", "true"); musicBtn.textContent = "Stop music";
    tick();
  }
  function musicOff() {
    if (music) music.pause();
    musicBtn.setAttribute("aria-pressed", "false"); musicBtn.textContent = "Music";
  }
  function setMuted(m) {
    isMuted = m;
    gate.textContent = `isMuted = ${m}`; gate.setAttribute("aria-pressed", String(m));
    fig.classList.toggle("is-muted", m);
  }
  /* toggleAudio, main.js:647-662 */
  function toggleAudio() {
    if (!isMuted) { playSfx("card"); setMuted(true); musicOff(); }
    else { setMuted(false); musicOn(); }
  }

  function run(names) { names.forEach((n) => (n === "music" ? (isMuted ? null : musicOn()) : playSfx(n))); }

  fig.querySelectorAll("[data-play]").forEach((b) => b.addEventListener("click", () => {
    const n = b.dataset.play;
    if (n === "music") { if (music && !music.paused) musicOff(); else if (!isMuted) musicOn(); }
    else playSfx(n);
  }));
  fig.querySelectorAll("[data-trig]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.trig;
    if (k === "sound") { if (!isMuted) toggleAudio(); return; }
    if (k === "soundon") { if (isMuted) toggleAudio(); else musicOn(); return; }
    run(TRIG[k]);
  }));
  gate.addEventListener("click", toggleAudio);

  /* waveforms and wires */
  function drawWave(name, f) {
    const c = waves[name]; const r = c.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height)), d = DPR();
    if (c.width !== Math.round(w * d)) { c.width = Math.round(w * d); c.height = Math.round(h * d); }
    const g = c.getContext("2d"); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, h);
    const pk = PEAKS[name]; if (!pk) return;
    const bw = w / pk.length;
    pk.forEach((v, i) => {
      const bh = Math.max(1, v * (h - 2));
      g.fillStyle = f >= 0 && i / pk.length <= f ? C.tint : C.ink3;
      g.fillRect(i * bw + 0.5, (h - bh) / 2, Math.max(1, bw - 1.5), bh);
    });
    if (f >= 0) { g.fillStyle = C.ink; g.fillRect(Math.min(w - 1.5, f * w), 0, 1.5, h); }
  }
  function drawWires() {
    Object.values(rows).forEach((row) => {
      const svg = row.querySelector(".sb-wire");
      if (getComputedStyle(svg).display === "none") return;
      const rr = svg.getBoundingClientRect();
      const play = row.querySelector(".sb-play").getBoundingClientRect();
      const y2 = play.top + play.height / 2 - rr.top, w = rr.width;
      const paths = [...row.querySelectorAll(".sb-trig button")].map((b) => {
        const br = b.getBoundingClientRect(); const y1 = br.top + br.height / 2 - rr.top;
        return `<path d="M0,${y1.toFixed(1)} C${(w * 0.55).toFixed(1)},${y1.toFixed(1)} ${(w * 0.45).toFixed(1)},${y2.toFixed(1)} ${(w - 6).toFixed(1)},${y2.toFixed(1)}"/>`;
      }).join("");
      svg.setAttribute("viewBox", `0 0 ${w} ${rr.height}`);
      svg.innerHTML = paths;
    });
  }
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  let ticking = false;
  function tick() {
    if (ticking || !onScreen) return;
    ticking = true;
    S.raf(() => {
      const now = performance.now(); let any = false;
      ["hop", "card", "creature"].forEach((n) => {
        const p = playing[n];
        if (p && now - p.t0 < p.dur) { any = true; rows[n].classList.add("is-on"); drawWave(n, Math.min(1, (now - p.t0) / p.real)); }
        else if (p) { delete playing[n]; rows[n].classList.remove("is-on"); drawWave(n, -1); }
      });
      const m = music && !music.paused;
      rows.music.classList.toggle("is-on", !!m);
      if (m) { any = true; drawWave("music", music.currentTime / (music.duration || DUR.music)); musicTime.textContent = `${fmtTime(music.currentTime)} of 2:04`; }
      if (!any || !onScreen) { ticking = false; if (!m) { drawWave("music", -1); musicTime.textContent = "2:04"; } return false; }
      return true;
    });
  }
  function layout() {
    Object.assign(C, { ink: css("--ink"), ink3: css("--ink-3"), tint: css("--tint-ink") });
    Object.keys(waves).forEach((n) => drawWave(n, -1));
    drawWires();
  }
  S.onVisible(fig, () => { onScreen = true; layout(); tick(); }, () => { onScreen = false; musicOff(); });
  new ResizeObserver(() => { if (onScreen) layout(); }).observe(fig);
}

/* =====================================================================
   Fig. 6  Night takes a second
   ===================================================================== */
function figNight(fig) {
  const svg = fig.querySelector(".night-svg");
  const tabs = [...fig.querySelectorAll("[data-theme]")];
  const replay = fig.querySelector("[data-replay]");
  const out = (k) => fig.querySelector(`[data-o="${k}"]`);
  // power2.inOut and CSS ease-in, written out so the figure needs no library
  const power2InOut = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
  const cubic = (x1, y1, x2, y2) => (x) => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let lo = 0, hi = 1, s = x;
    for (let i = 0; i < 30; i++) { s = (lo + hi) / 2; const bx = 3 * (1 - s) * (1 - s) * s * x1 + 3 * (1 - s) * s * s * x2 + s * s * s; if (bx < x) lo = s; else hi = s; }
    return 3 * (1 - s) * (1 - s) * s * y1 + 3 * (1 - s) * s * s * y2 + s * s * s;
  };
  const easeIn = cubic(0.42, 0, 1, 1);

  const LOADED = { amb: [0x40 / 255, 0x40 / 255, 0x40 / 255, 2.7], sun: [1, 1, 1, 1], card: "#1E9A64" }; // main.js:287, 307; style.css:9
  const NIGHT = { amb: [0.25, 0.31, 0.78, 0.9], sun: [0.25, 0.41, 0.88, 0.8], card: "#755DCB" };        // main.js:617-643; style.css:10
  const DAY = { amb: [1, 1, 1, 0.8], sun: [1, 1, 1, 1], card: "#1E9A64" };                              // main.js:617-643
  let state = "day", from = LOADED, to = NIGHT, label = "As loaded, to night";
  let t = 0, playing = false, onScreen = false, built = false, L = null;

  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const rgb = (c) => `rgb(${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)).join(",")})`;
  const lit = (c) => [c[0] * c[3], c[1] * c[3], c[2] * c[3]];
  const cardAt = (s) => { const k = easeIn(Math.min(1, Math.max(0, (s - 0.1) / 0.4))); const a = hex(from.card), b = hex(to.card); return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(",")})`; }; // style.css:123-124
  const at = (s) => { const e = power2InOut(Math.min(1, Math.max(0, s))); return { e, amb: mix(from.amb, to.amb, e), sun: mix(from.sun, to.sun, e) }; };

  function build() {
    const w = Math.max(300, Math.round(svg.getBoundingClientRect().width));
    const narrow = w < 560;
    const rowH = narrow ? 24 : 30, lab = 18, gap = narrow ? 14 : 18;
    const y0 = 22;
    const rowsY = [0, 1, 2].map((i) => y0 + lab + i * (lab + rowH + gap));
    const cy0 = rowsY[2] + rowH + 34, ch = narrow ? 92 : 120;
    const axisY = cy0 + ch;
    const h = axisY + 26;
    const x = (s) => 1 + s * (w - 2);
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.style.height = h + "px";
    const names = [["AmbientLight", "colour × intensity"], ["DirectionalLight, the sun", "colour × intensity"], ["Cards and buttons", "CSS, 0.4 s ease-in after 0.1 s"]];
    let s = `<text class="n-strong" data-title x="0" y="12">${label}</text>`;
    names.forEach(([a, b], i) => {
      s += `<text class="n-strong" x="0" y="${rowsY[i] - 7}">${a}</text><text x="${w}" y="${rowsY[i] - 7}" text-anchor="end">${narrow && i === 2 ? "CSS" : b}</text>`;
      s += `<g data-strip="${i}">`;
      for (let f = 0; f < 60; f++) s += `<rect class="n-cell" x="${x(f / 60).toFixed(2)}" y="${rowsY[i]}" width="${Math.max(1, (w - 2) / 60 - (w < 560 ? 1 : 2)).toFixed(2)}" height="${rowH}"/>`;
      s += `</g>`;
    });
    // curves
    let pg = "", pc = "";
    for (let i = 0; i <= 120; i++) { const p = i / 120; pg += `${i ? "L" : "M"}${x(p).toFixed(1)},${(axisY - power2InOut(p) * ch).toFixed(1)}`; pc += `${i ? "L" : "M"}${x(p).toFixed(1)},${(axisY - easeIn(Math.min(1, Math.max(0, (p - 0.1) / 0.4))) * ch).toFixed(1)}`; }
    s += `<line class="n-grid" x1="0" x2="${w}" y1="${axisY - ch}" y2="${axisY - ch}"/><line class="n-axis" x1="0" x2="${w}" y1="${axisY}" y2="${axisY}"/>`;
    s += `<path class="n-css" d="${pc}"/><path class="n-gsap" d="${pg}"/>`;
    s += `<text x="${x(0.5) + 8}" y="${axisY - ch * 0.5 + 16}">power2.inOut, 1 s</text><text x="${x(0.5) + 8}" y="${axisY - ch + 14}">ease-in</text>`;
    for (let k = 0; k <= 10; k++) { if (narrow && k % 2) continue; s += `<line class="n-axis" x1="${x(k / 10)}" x2="${x(k / 10)}" y1="${axisY}" y2="${axisY + 5}"/><text x="${x(k / 10)}" y="${axisY + 19}" text-anchor="${k === 0 ? "start" : k === 10 ? "end" : "middle"}">${k === 10 ? "1 s" : (k / 10).toFixed(1).replace(/^0/, k ? "0" : "0")}</text>`; }
    s += `<line class="n-head" data-head y1="${rowsY[0] - 2}" y2="${axisY}"/><circle class="n-dot" data-dg r="4"/><circle class="n-dot" data-dc r="3.5"/>`;
    svg.innerHTML = s;
    L = { x, axisY, ch, head: svg.querySelector("[data-head]"), dg: svg.querySelector("[data-dg]"), dc: svg.querySelector("[data-dc]"), strips: [0, 1, 2].map((i) => [...svg.querySelectorAll(`[data-strip="${i}"] rect`)]), title: svg.querySelector("[data-title]") };
    paintStrips();
    paintHead();
  }
  function paintStrips() {
    if (!L) return;
    L.title.textContent = label;
    for (let f = 0; f < 60; f++) {
      const s = (f + 1) / 60, v = at(s);
      L.strips[0][f].setAttribute("fill", rgb(lit(v.amb)));
      L.strips[1][f].setAttribute("fill", rgb(lit(v.sun)));
      L.strips[2][f].setAttribute("fill", cardAt(s));
    }
  }
  function paintHead() {
    if (!L) return;
    const v = at(t), xx = L.x(t);
    L.head.setAttribute("x1", xx); L.head.setAttribute("x2", xx);
    L.dg.setAttribute("cx", xx); L.dg.setAttribute("cy", L.axisY - v.e * L.ch);
    L.dc.setAttribute("cx", xx); L.dc.setAttribute("cy", L.axisY - easeIn(Math.min(1, Math.max(0, (t - 0.1) / 0.4))) * L.ch);
    out("t").textContent = t.toFixed(2);
    out("e").textContent = v.e.toFixed(2);
    out("amb").textContent = `${v.amb.slice(0, 3).map((n) => n.toFixed(2)).join(" ")} × ${v.amb[3].toFixed(2)}`;
    out("sun").textContent = `${v.sun.slice(0, 3).map((n) => n.toFixed(2)).join(" ")} × ${v.sun[3].toFixed(2)}`;
  }
  function run() {
    t = 0; paintStrips();
    if (S.reduce || !onScreen) { t = 1; paintHead(); return; }
    let t0 = -1;
    if (playing) return;
    playing = true;
    S.raf((now) => {
      if (t0 < 0) t0 = now;
      t = Math.min(1, (now - t0) / 1000); // the tween's duration, main.js:621
      paintHead();
      if (t >= 1 || !onScreen) { playing = false; t = 1; paintHead(); return false; }
      return true;
    });
  }
  let firstNight = true;
  tabs.forEach((b) => b.addEventListener("click", () => {
    const n = b.dataset.theme;
    if (n === "night" && state !== "night") { from = firstNight ? LOADED : DAY; to = NIGHT; label = firstNight ? "As loaded, to night" : "Day to night"; firstNight = false; state = "night"; }
    else if (n === "day" && state !== "day") { from = NIGHT; to = DAY; label = "Night back to day"; state = "day"; }
    tabs.forEach((o) => o.setAttribute("aria-selected", String(o.dataset.theme === state)));
    run();
  }));
  replay.addEventListener("click", () => run());
  S.onVisible(fig, () => { onScreen = true; if (!built) { built = true; build(); new ResizeObserver(() => build()).observe(svg); } }, () => { onScreen = false; });
}

/* ---------- wire up ---------- */
const by = (id) => document.getElementById(id);
if (S) {
  if (by("fig-file")) figFile(by("fig-file"));
  if (by("fig-hop")) figHop(by("fig-hop"));
  if (by("fig-floor")) figFloor(by("fig-floor"));
  if (by("fig-sound")) figSound(by("fig-sound"));
  if (by("fig-night")) figNight(by("fig-night"));
}
