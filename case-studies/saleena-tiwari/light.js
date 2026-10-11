/* Fig. 7: the light, the marble and the fog, live. One render per side of a
   divider: FogExp2 0.062 on the left (before the fix), 0.012 on the
   right (main.js:62). Pointing at the column eases the fresnel rim 1.00 -> 1.26
   at the source's rate (main.js:161, 863-866). Cards are the shipped ones at
   the same scroll, and like the source's card shader they take no fog. */
import * as THREE from "three";
import { K, sampleCamera, warpScroll, shippedCards, shippedCard, clamp, DEG } from "./rig.js";
import { makeRenderer, addLights, greenEnvironment, addFigure, clothGeometry, cardTexture, cardMaterial, FOG_COLOR } from "./scene-kit.js";

const T = 0.107;          // between two featured cards, so none hides her
const HOVER_RIM = 0.26;   // main.js:161

export function mountLight(fig) {
  const Study = window.Study;
  const wrap = fig.querySelector(".lt-canvas");
  const canvas = wrap.querySelector("canvas");
  const split = wrap.querySelector(".lt-split");
  const tagL = wrap.querySelector(".lt-tag--l"), tagR = wrap.querySelector(".lt-tag--r");
  const input = fig.querySelector(".lt-scrub input");
  const read = fig.querySelector(".lt-read");
  const curve = fig.querySelector(".lt-curve");

  let renderer;
  try { renderer = makeRenderer(canvas, { alpha: false }); } catch (e) { return { start() {}, stop() {} }; }
  renderer.autoClear = false;
  const scene = new THREE.Scene();
  addLights(scene);
  greenEnvironment(renderer, scene);
  const rim = { value: 1 };
  const { fig: column } = addFigure(scene, rim);

  const s = sampleCamera(T);
  const cam = new THREE.PerspectiveCamera(s.fov, 16 / 9, 0.1, 200);
  cam.position.set(s.x, s.y, s.z); cam.lookAt(0, s.tgtY, 0); cam.updateMatrixWorld();

  const shared = { uFlex: { value: 0 }, uTime: { value: 0 } };
  const rope = warpScroll(T);
  shippedCards(21).forEach((c) => {
    const st = shippedCard(c, { x: s.x, y: s.y, z: s.z, fov: s.fov, aspect: 16 / 9 }, rope, s.tgtY);
    if (!st.on) return;
    const g = new THREE.Group();
    g.add(new THREE.Mesh(clothGeometry(), cardMaterial(cardTexture(c.i, renderer), shared)));
    g.position.set(st.x, st.y, st.z); g.rotation.set(st.rotX, st.rotY, st.rotZ); g.scale.setScalar(st.scale);
    scene.add(g);
  });

  const fogBefore = new THREE.FogExp2(FOG_COLOR, 0.062), fogAfter = new THREE.FogExp2(FOG_COLOR, 0.012);
  const voidC = new THREE.Color(FOG_COLOR);
  const dHer = Math.hypot(s.x, s.y - 1, s.z);
  const amount = (d, D) => 1 - Math.exp(-(D * D) * d * d); // three's FogExp2

  let W = 0, H = 0, at = 0.5, hover = 0, want = 0, dirty = true, on = false, stopper = null;
  const layout = () => {
    const r = wrap.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    renderer.setSize(W, H, false); dirty = true;
  };
  new ResizeObserver(layout).observe(wrap);

  function render() {
    if (!W) layout();
    rim.value = 1 + HOVER_RIM * hover;
    const xs = Math.round(W * at);
    renderer.setScissorTest(true);
    renderer.setViewport(0, 0, W, H);
    renderer.setClearColor(voidC, 1);
    // left: before
    renderer.setScissor(0, 0, xs, H); renderer.clear();
    scene.fog = fogBefore; renderer.render(scene, cam);
    // right: after
    renderer.setScissor(xs, 0, W - xs, H); renderer.clear();
    scene.fog = fogAfter; renderer.render(scene, cam);
    renderer.setScissorTest(false);
    split.style.left = xs + "px";
    tagL.style.visibility = xs > 90 ? "visible" : "hidden";
    tagR.style.visibility = W - xs > 90 ? "visible" : "hidden";
    read.innerHTML = `<li>her, <b>${dHer.toFixed(1)} m</b> away</li><li>fog before <b>${(amount(dHer, 0.062) * 100).toFixed(1)}%</b></li><li>after <b>${(amount(dHer, 0.012) * 100).toFixed(1)}%</b></li><li>rim <b>×${rim.value.toFixed(2)}</b></li>`;
  }

  // ---- the fog curve: how much of an object is fog at each distance ----
  (function drawCurve() {
    const NS = "http://www.w3.org/2000/svg";
    const mk = (tag, a, p = curve) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); p.appendChild(e); return e; };
    const build = () => {
      const Wc = Math.round(curve.clientWidth), Hc = Math.round(curve.clientHeight);
      if (!Wc || !Hc) return;
      curve.setAttribute("viewBox", `0 0 ${Wc} ${Hc}`);
      curve.replaceChildren();
      const L = 38, R = 10, Tp = 24, B = 28, maxD = 16;
      const X = (d) => L + (d / maxD) * (Wc - L - R);
      const Yv = (v) => Hc - B - (v / 0.6) * (Hc - Tp - B);
      const t = (x, y, s, anchor = "start", cls = "ann") => { const e = mk("text", { x, y, class: cls, "text-anchor": anchor }); e.textContent = s; };
      t(L, 13, "fog over an object, by distance", "start", "ann pl-title");
      [0, 0.3, 0.6].forEach((v) => { mk("line", { x1: L, x2: Wc - R, y1: Yv(v), y2: Yv(v), class: "pl-grid" }); t(L - 6, Yv(v) + 4, Math.round(v * 100) + "%", "end"); });
      mk("line", { x1: L, x2: Wc - R, y1: Hc - B, y2: Hc - B, class: "pl-axis" });
      [0, 4, 8, 12, 16].forEach((d) => t(X(d), Hc - B + 17, d + " m", "middle"));
      const line = (D, cls) => { const p = []; for (let i = 0; i <= 120; i++) { const d = (i / 120) * maxD; p.push(X(d).toFixed(1) + "," + Yv(Math.min(0.6, amount(d, D))).toFixed(1)); } mk("polyline", { points: p.join(" "), class: cls }); };
      line(0.062, "pl-line pl-thin");
      line(0.012, "pl-line pl-line--tint");
      mk("line", { x1: X(dHer), x2: X(dHer), y1: Tp, y2: Hc - B, class: "pl-grid pl-dash" });
      t(X(dHer) - 6, Tp + 10, "her", "end");
      mk("circle", { cx: X(dHer), cy: Yv(amount(dHer, 0.062)), r: 4, class: "pl-dot pl-dot--ink" });
      mk("circle", { cx: X(dHer), cy: Yv(amount(dHer, 0.012)), r: 4.5, class: "pl-dot" });
      t(X(dHer) + 8, Yv(amount(dHer, 0.062)) + 4, "0.062");
      t(X(dHer) + 8, Yv(amount(dHer, 0.012)) - 6, "0.012");
    };
    new ResizeObserver(build).observe(curve);
    build();
  })();

  // ---- input: drag to move the divider, point at the column for the rim ----
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const hit = (e) => {
    const r = wrap.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    return ray.intersectObject(column, false).length > 0;
  };
  let drag = null;
  const setAt = (v) => { at = clamp(v, 0, 1); input.value = String(Math.round(at * 1000)); dirty = true; };
  wrap.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, moved: false };
    wrap.setPointerCapture(e.pointerId);
  });
  wrap.addEventListener("pointermove", (e) => {
    const r = wrap.getBoundingClientRect();
    if (drag) {
      if (Math.abs(e.clientX - drag.x) > 4) drag.moved = true;
      if (drag.moved) setAt((e.clientX - r.left) / r.width);
    } else if (e.pointerType === "mouse") {
      want = hit(e) ? 1 : 0;
    }
  });
  const up = (e) => {
    if (drag && !drag.moved && e.pointerType !== "mouse") want = hit(e) ? (want ? 0 : 1) : 0; // tap toggles on touch
    drag = null;
  };
  wrap.addEventListener("pointerup", up);
  wrap.addEventListener("pointercancel", () => (drag = null));
  wrap.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") want = 0; });
  input.addEventListener("input", () => setAt(+input.value / 1000));

  function loop(t, dt) {
    if (!on) return false;
    const before = hover;
    hover += (want - hover) * Math.min(1, dt * 3); // main.js:863, same rate as the source
    if (Math.abs(want - hover) < 0.002) hover = want;
    if (hover !== before || dirty) { render(); dirty = false; }
    return true;
  }
  return {
    start() { if (on) return; on = true; dirty = true; stopper = Study.raf(loop); },
    stop() { on = false; stopper && stopper(); },
  };
}
