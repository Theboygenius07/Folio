/* Fig. 4: the gait. DogRig.ts, ported in dog-kit.js, driving the real dog in a side view,
   with the stride drawn out: which paws are down (FOOTFALL + duty) and one hip's angle
   (legCycle) through a stride. */
import * as THREE from "three";
import { createDog, studio, gaitMix, legCycle, FOOTFALL, GAITS, HIP_HEIGHT, STRIDE_MAX_HZ } from "./dog-kit.js";
import { Study, s, txt, fitSvg, tabs, readout, deg } from "./util.js";
import { smoothstep } from "./world.js";

const LEGS = [["lf", "Left front"], ["rf", "Right front"], ["lh", "Left hind"], ["rh", "Right hind"]];
const NAMES = ["walk", "trot", "gallop"];

export function mountDogGait(fig) {
  const stage = fig.querySelector(".dg-stage");
  const canvas = stage.querySelector("canvas");
  const feetSvg = fig.querySelector(".dg-feet");
  const hipSvg = fig.querySelector(".dg-hip");
  const slider = fig.querySelector(".dg-scrub input");
  const out = fig.querySelector(".dg-scrub output");
  const play = fig.querySelector(".dg-play");
  const r = readout(fig);

  let kit;
  try { kit = studio(canvas, { radius: 0.9 }); }
  catch (e) { stage.querySelector(".tw-fallback").hidden = false; return { start() {}, stop() {} }; }
  const { renderer, scene } = kit;
  const camera = new THREE.PerspectiveCamera(20, 2, 0.1, 40);
  const dog = createDog({ variant: "ginger", resolution: 56 });
  scene.add(dog.group);

  // ground ticks: they move at the dog's speed, so a planted paw keeps pace with them
  const ticks = new THREE.Group();
  const tickGeo = new THREE.BoxGeometry(0.004, 0.05, 0.012);
  const tickMat = new THREE.MeshBasicMaterial({ color: 0x1d1b18, transparent: true, opacity: 0.45 });
  const SPAN = 4.8, GAP = 0.2;
  for (let i = 0; i < SPAN / GAP; i++) { const m = new THREE.Mesh(tickGeo, tickMat); m.position.set(0.3, 0.025, -SPAN / 2 + i * GAP); ticks.add(m); }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.003, SPAN), tickMat); rail.position.set(0.3, 0.0015, 0); scene.add(rail);
  scene.add(ticks);

  let speed = +slider.value, posture = "stand", offset = 0;
  let g = gaitMix(speed);

  function size() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const t = Math.tan((camera.fov * Math.PI) / 360);
    const dist = Math.max(0.78 / t, 1.05 / (t * camera.aspect));
    camera.position.set(dist, 1.0, 0.08);
    camera.lookAt(0, 0.48, 0.08);
    camera.updateProjectionMatrix();
    render();
  }
  new ResizeObserver(size).observe(stage);
  const render = () => renderer.render(scene, camera);

  /* ---------- the plots ---------- */
  const ink = "#1d1b18", ink2 = "#67625a", ink3 = "#9a958b", rule = "#e0dbd0";
  const tint = getComputedStyle(document.body).getPropertyValue("--tint").trim() || "#4a9fe0";
  const tintInk = getComputedStyle(document.body).getPropertyValue("--tint-ink").trim() || "#2a6db0";
  let feet = null, hip = null;
  const MAXA = 0.95;

  const feetFit = fitSvg(feetSvg, () => 142, (w, h) => {
    feetSvg.textContent = "";
    const L = 84, R = w - 8, top = 22, row = 24;
    txt(feetSvg, 0, 12, "Paws on the ground, through a stride", { class: "ann", fill: ink });
    const lab = txt(feetSvg, R, 12, "", { class: "ann", "text-anchor": "end" });
    const rows = LEGS.map(([k, name], i) => {
      const y = top + i * row;
      txt(feetSvg, 0, y + 15, name, { class: "ann" });
      s("line", { x1: L, x2: R, y1: y + row - 2, y2: y + row - 2, stroke: rule }, feetSvg);
      return { k, y, bars: NAMES.map((n) => s("g", { "data-g": n }, feetSvg)) };
    });
    const head = s("line", { y1: top - 4, y2: top + 4 * row, stroke: tintInk, "stroke-width": 1.5 }, feetSvg);
    feet = { L, R, rows, head, lab, top, row };
    drawFeet();
  });
  function drawFeet() {
    if (!feet) return;
    const { L, R, rows, lab, top, row } = feet;
    const W = R - L, ws = [g.wWalk, g.wTrot, g.wGallop];
    for (const rw of rows) {
      NAMES.forEach((n, gi) => {
        const grp = rw.bars[gi];
        grp.textContent = "";
        if (ws[gi] < 0.02) return;
        const off = FOOTFALL[n][rw.k];
        // on the ground where frac(p + off) < duty
        const a = (1 - off) % 1, b = a + g.duty;
        const segs = b <= 1 ? [[a, b]] : [[a, 1], [0, b - 1]];
        const front = rw.k.endsWith("f");
        for (const [x0, x1] of segs) {
          s("rect", { x: L + x0 * W, y: rw.y + 5, width: Math.max(0, (x1 - x0) * W), height: row - 11, fill: front ? tint : tintInk, opacity: (0.18 + 0.82 * ws[gi]).toFixed(3) }, grp);
        }
      });
    }
    const dom = ws.indexOf(Math.max(...ws));
    lab.textContent = speed < 0.12 ? "standing" : `${NAMES[dom]}, duty ${g.duty.toFixed(2)}`;
    void top;
  }
  const hipFit = fitSvg(hipSvg, () => 142, (w, h) => {
    hipSvg.textContent = "";
    const L = 40, R = w - 8, T = 34, B = h - 26;
    txt(hipSvg, 0, 12, "Left front hip angle, through a stride", { class: "ann", fill: ink });
    s("line", { x1: L, x2: R, y1: (T + B) / 2, y2: (T + B) / 2, stroke: rule }, hipSvg);
    txt(hipSvg, L - 6, T + 4, "fwd", { class: "ann", "text-anchor": "end", "font-size": 11 });
    txt(hipSvg, L - 6, B, "back", { class: "ann", "text-anchor": "end", "font-size": 11 });
    const stance = s("path", { fill: "none", stroke: tintInk, "stroke-width": 2.5, "stroke-linecap": "round" }, hipSvg);
    const swing = s("path", { fill: "none", stroke: ink3, "stroke-width": 1.5, "stroke-dasharray": "4 3" }, hipSvg);
    const dot = s("circle", { r: 5, fill: tintInk, stroke: "#f3f1ea", "stroke-width": 2 }, hipSvg);
    const ky = h - 4;
    s("line", { x1: L, x2: L + 18, y1: ky - 4, y2: ky - 4, stroke: tintInk, "stroke-width": 2.5 }, hipSvg);
    txt(hipSvg, L + 24, ky, "paw down", { class: "ann", "font-size": 11 });
    s("line", { x1: L + 96, x2: L + 114, y1: ky - 4, y2: ky - 4, stroke: ink3, "stroke-width": 1.5, "stroke-dasharray": "4 3" }, hipSvg);
    const k1 = txt(hipSvg, L + 120, ky, "in the air", { class: "ann", "font-size": 11 });
    hip = { L, R, T, B, stance, swing, dot, k1 };
    drawHip();
  });
  // DogRig.ts:445-468: each gait votes on the hip, weighted; the cycle shows by `stride`
  function hipAt(p) {
    const ws = [g.wWalk, g.wTrot, g.wGallop];
    let a = 0;
    NAMES.forEach((n, gi) => { if (ws[gi] > 0.001) a += legCycle((p + FOOTFALL[n].lf) % 1, g.duty, g.swing, 0.52).hip * ws[gi]; });
    return a;
  }
  function strideScale() { return smoothstep(0.12, 0.8, speed) * (1 - dog.rig.settle); }
  function hipY(a) { return (hip.T + hip.B) / 2 + (a / MAXA) * ((hip.B - hip.T) / 2); }
  function drawHip() {
    if (!hip) return;
    const { L, R, stance, swing } = hip;
    const ws = [g.wWalk, g.wTrot, g.wGallop], dom = NAMES[ws.indexOf(Math.max(...ws))];
    const k = strideScale(), base = dog.rig.pose.frontHip;
    let dS = "", dW = "", prevIn = null;
    const N = 96;
    for (let i = 0; i <= N; i++) {
      const p = i / N, a = hipAt(p) * k + base;
      const inStance = ((p + FOOTFALL[dom].lf) % 1) < g.duty;
      const pt = `${(L + p * (R - L)).toFixed(1)} ${hipY(a).toFixed(1)}`;
      if (inStance) dS += (prevIn === true ? " L" : " M") + pt; else dW += (prevIn === false ? " L" : " M") + pt;
      prevIn = inStance;
    }
    stance.setAttribute("d", dS.trim());
    swing.setAttribute("d", dW.trim());
  }

  function setSpeed(v) {
    speed = v;
    g = gaitMix(speed);
    out.textContent = `${speed.toFixed(2)} m/s`;
    r("walk", `${Math.round(g.wWalk * 100)}%`);
    r("trot", `${Math.round(g.wTrot * 100)}%`);
    r("gallop", `${Math.round(g.wGallop * 100)}%`);
    r("swing", `${deg(g.swing).toFixed(1)}°`);
    r("duty", g.duty.toFixed(2));
    r("hz", `${g.hz.toFixed(2)} Hz${g.hz >= STRIDE_MAX_HZ - 1e-6 ? " (cap)" : ""}`);
    drawFeet(); drawHip();
  }
  slider.addEventListener("input", () => { setSpeed(+slider.value); if (!running) step(1 / 60); });
  tabs(fig.querySelector('[aria-label="Posture"]'), "data-posture", (v) => { posture = v; if (!running) { for (let i = 0; i < 90; i++) dog.rig.update(1 / 30, speed, { posture }); render(); } });

  function step(dt) {
    dog.rig.update(dt, speed, { posture });
    // the ground only moves while the dog is walking, not once it has sat down
    offset = (offset + speed * (1 - dog.rig.settle) * dt) % GAP;
    ticks.position.z = -offset;
    const p = dog.rig.stridePhase;
    if (feet) feet.head.setAttribute("x1", feet.L + p * (feet.R - feet.L)), feet.head.setAttribute("x2", feet.L + p * (feet.R - feet.L));
    if (hip) {
      drawHip();
      hip.dot.setAttribute("cx", hip.L + p * (hip.R - hip.L));
      hip.dot.setAttribute("cy", hipY(dog.parts.legs.find((l) => l.front && l.left).hip.rotation.x));
    }
    render();
  }

  let stop = null, running = false;
  const loop = (t, dt) => { step(dt); };
  const go = () => { if (!stop) { stop = Study.raf(loop); running = true; } };
  play.addEventListener("click", () => { if (running) { stop && stop(); stop = null; running = false; play.textContent = "Play"; } else { go(); play.textContent = "Pause"; } });

  setSpeed(speed);
  size();
  step(1 / 60);
  void HIP_HEIGHT; void GAITS; void feetFit; void hipFit;
  if (Study.reduce) play.hidden = false;
  return {
    start() { if (!Study.reduce) go(); else render(); },
    stop() { stop && stop(); stop = null; running = false; if (Study.reduce) play.textContent = "Play"; },
  };
}
