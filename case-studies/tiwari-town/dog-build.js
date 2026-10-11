/* Fig. 3: the dog, built live. Dog.ts + Sculpt.ts, ported in dog-kit.js. */
import * as THREE from "three";
import { createDog, addBallLayer, COATS, BALL_COUNT, studio } from "./dog-kit.js";
import { Study, tabs, readout, comma, drag } from "./util.js";

export function mountDogBuild(fig) {
  const stage = fig.querySelector(".db-stage");
  const canvas = stage.querySelector("canvas");
  const r = readout(fig);
  const slider = fig.querySelector(".db-scrub input");
  const out = fig.querySelector(".db-scrub output");

  let kit;
  try { kit = studio(canvas, { radius: 0.8 }); }
  catch (e) { stage.querySelector(".tw-fallback").hidden = false; return { start() {}, stop() {} }; }
  const { renderer, scene } = kit;
  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 30);
  const target = new THREE.Vector3(0, 0.52, 0.06);

  const turn = new THREE.Group();
  scene.add(turn);
  let state = { res: 64, view: "welded", coat: "cream" };
  let dog = null, layer = null;
  let yaw = -0.62, auto = !Study.reduce, dragging = false;

  function build() {
    const weld = state.view !== "soup";
    const t0 = performance.now();
    const fresh = createDog({ variant: state.coat, resolution: state.res, weld });
    const ms = performance.now() - t0;
    if (dog) { turn.remove(dog.group); }
    dog = fresh;
    turn.add(dog.group);
    layer = addBallLayer(dog, COATS[state.coat].base);
    applyView();
    const g = dog.geo;
    const verts = (geo) => geo.attributes.position.count;
    const v = verts(g.body) + verts(g.head) + 2 * verts(g.ear) + 4 * (verts(g.upperLeg) + verts(g.lowerLeg)) + verts(g.tailBase) + verts(g.tailTip) + 2 * verts(g.eye) + verts(g.nose);
    r("balls", String(BALL_COUNT));
    r("cell", `${Math.round(g.cell * 1000)} mm`);
    r("tris", comma(g.tris));
    r("verts", comma(v));
    // a cached build costs nothing; report what marching cubes actually took
    r("ms", `${Math.round(Math.max(ms, g.ms))} ms`);
    render();
  }
  function applyView() {
    const balls = state.view === "balls";
    dog.group.traverse((o) => { if (o.userData.coat) o.visible = !balls; });
    layer.set(balls);
  }
  function recolour() {
    const c = COATS[state.coat];
    dog.coatMat.color.setHex(c.base);
    dog.noseMat.color.setHex(c.nose);
    layer.pos.color.setHex(c.base);
    render();
  }

  tabs(fig.querySelector('[aria-label="What to show"]'), "data-view", (v) => {
    const rebuild = (v === "soup") !== (state.view === "soup");
    state.view = v;
    if (rebuild) build(); else { applyView(); render(); }
  });
  tabs(fig.querySelector('[aria-label="Coat"]'), "data-coat", (v) => { state.coat = v; recolour(); });

  let pending = 0;
  slider.addEventListener("input", () => {
    out.textContent = slider.value;
    clearTimeout(pending);
    pending = setTimeout(() => { state.res = +slider.value; build(); }, 90);
  });

  // turn it: drag, or arrow keys
  let lastX = 0;
  drag(stage, {
    start: (e) => { dragging = true; lastX = e.clientX; },
    move: (e) => { yaw += (e.clientX - lastX) * 0.012; lastX = e.clientX; render(); },
    end: () => { dragging = false; },
  });
  stage.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { yaw += e.key === "ArrowLeft" ? -0.2 : 0.2; auto = false; render(); e.preventDefault(); }
  });

  function size() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole dog in frame on a narrow phone as well as a wide desk
    const t = Math.tan((camera.fov * Math.PI) / 360);
    const dist = Math.max(0.72 / t, 0.8 / (t * camera.aspect));
    camera.position.set(0, target.y + dist * 0.26, dist);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    render();
  }
  new ResizeObserver(size).observe(stage);

  function render() {
    turn.rotation.y = yaw;
    renderer.render(scene, camera);
  }

  let stop = null;
  const loop = (t, dt) => {
    if (auto && !dragging) yaw += dt * 0.22;
    dog.rig.update(dt, 0);
    render();
  };

  build();
  size();
  return {
    start() { if (!Study.reduce && !stop) stop = Study.raf(loop); else render(); },
    stop() { stop && stop(); stop = null; },
  };
}
