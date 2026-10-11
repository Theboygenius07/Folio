/* Fig. 8: one card, the shipped bow (cards.js:197-219) and the flex vertex
   shader verbatim (materials.js:192-210). Speed comes from this page's own
   scroll, converted into the showcase's scroll units, then damped exactly as
   main.js:798-803 does; or from the slider. */
import * as THREE from "three";
import { K, clamp } from "./rig.js";
import { makeRenderer, clothGeometry, cardTexture, cardMaterial } from "./scene-kit.js";

const HOLD = 0.16;    // main.js:445, the closing hold at the end of the track
const TRACK_VH = 600; // style.css:20, #scene-track height
const SPAN = 4;       // seconds of history in the trace

export function mountFlex(fig) {
  const Study = window.Study;
  const wrap = fig.querySelector(".fx-canvas");
  const canvas = wrap.querySelector("canvas");
  const trace = fig.querySelector(".fx-trace");
  const tabs = [...fig.querySelectorAll("[data-src]")];
  const input = fig.querySelector(".fx-scrub input");
  const out = fig.querySelector(".fx-scrub output");
  const read = fig.querySelector(".fx-read");

  let renderer;
  try { renderer = makeRenderer(canvas); } catch (e) { return { start() {}, stop() {} }; }
  const scene = new THREE.Scene();
  const shared = { uFlex: { value: 0 }, uTime: { value: 0 } };
  const card = new THREE.Mesh(clothGeometry(), cardMaterial(cardTexture(10, renderer), shared));
  card.material.uniforms.uTintAmt.value = 0;
  scene.add(card);
  const cam = new THREE.PerspectiveCamera(26, 2, 0.1, 50);
  cam.position.set(1.15, 0.42, 2.55); cam.lookAt(0, -0.02, 0);

  let W = 0, H = 0;
  const layout = () => {
    const r = wrap.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    renderer.setSize(W, H, false);
    cam.aspect = W / H;
    // keep the whole card in view on narrow screens
    cam.fov = cam.aspect < 1.4 ? 26 * (1.4 / cam.aspect) ** 0.85 : 26;
    cam.updateProjectionMatrix();
  };
  new ResizeObserver(layout).observe(wrap);

  // ---- the speed signal ----
  let src = "page";
  const pageUnits = () => scrollY / ((TRACK_VH / 100 - 1) * innerHeight * (1 - HOLD)); // main.js:437-449
  let scroll = pageUnits(), smooth = scroll, lastSmooth = smooth, flex = 0, sliderVel = 0, tm = 0;
  addEventListener("scroll", () => { scroll = pageUnits(); }, { passive: true });
  tabs.forEach((b) => b.addEventListener("click", () => {
    src = b.dataset.src;
    tabs.forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    input.disabled = src !== "slider";
    if (src === "slider") { sliderVel = +input.value / 1000; } else { scroll = smooth = lastSmooth = pageUnits(); }
  }));
  input.addEventListener("input", () => { sliderVel = +input.value / 1000; });

  // ---- the trace ----
  const NS = "http://www.w3.org/2000/svg";
  const hist = [];
  let tW = 0, tH = 0, lineRaw, lineFlex;
  const buildTrace = () => {
    tW = Math.round(trace.clientWidth); tH = Math.round(trace.clientHeight);
    if (!tW || !tH) return;
    trace.setAttribute("viewBox", `0 0 ${tW} ${tH}`);
    trace.replaceChildren();
    const mk = (tag, a) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); trace.appendChild(e); return e; };
    const L = 34;
    [[1, "+1"], [0, "0"], [-1, "−1"]].forEach(([v, s]) => {
      const y = (tH - 14) / 2 - v * ((tH - 14) / 2 - 8);
      mk("line", { x1: L, x2: tW, y1: y, y2: y, class: v === 0 ? "pl-axis" : "pl-grid" });
      const t = mk("text", { x: L - 6, y: y + 4, class: "ann", "text-anchor": "end" }); t.textContent = s;
    });
    const t1 = mk("text", { x: L, y: tH - 1, class: "ann" }); t1.textContent = "4 s ago";
    const t2 = mk("text", { x: tW, y: tH - 1, class: "ann", "text-anchor": "end" }); t2.textContent = "now";
    lineRaw = mk("polyline", { class: "pl-line pl-thin" });
    lineFlex = mk("polyline", { class: "pl-line pl-line--tint" });
  };
  new ResizeObserver(buildTrace).observe(trace);

  function drawTrace(now) {
    if (!lineRaw) return;
    const L = 34, X = (t) => L + (1 - (now - t) / SPAN) * (tW - L), Y = (v) => (tH - 14) / 2 - v * ((tH - 14) / 2 - 8);
    lineRaw.setAttribute("points", hist.map((h) => X(h.t).toFixed(1) + "," + Y(h.want).toFixed(1)).join(" "));
    lineFlex.setAttribute("points", hist.map((h) => X(h.t).toFixed(1) + "," + Y(h.flex).toFixed(1)).join(" "));
  }

  let on = false, stopper = null;
  function loop(t, dt) {
    if (!on) return false;
    tm += dt;
    let vel, want;
    if (src === "page") {
      smooth += (scroll - smooth) * Math.min(1, dt * 4.5);       // main.js:798
      vel = (smooth - lastSmooth) / Math.max(dt, 1e-3);           // main.js:801
      lastSmooth = smooth;
      input.value = String(Math.round(clamp(vel, -0.3, 0.3) * 1000));
    } else vel = sliderVel;
    want = clamp(vel * 6.0, -1, 1);
    flex += (want - flex) * Math.min(1, dt * 7);                  // main.js:803
    shared.uFlex.value = flex;
    shared.uTime.value = Study.reduce ? 0 : tm;
    renderer.render(scene, cam);

    hist.push({ t: tm, want, flex });
    while (hist.length && tm - hist[0].t > SPAN) hist.shift();
    drawTrace(tm);
    out.textContent = (vel < 0 ? "−" : "") + Math.abs(vel).toFixed(3) + "/s";
    const bow = (0.2 * Math.abs(flex)) / K.W * 100, twist = (0.085 * Math.abs(flex)) / K.W * 100;
    read.innerHTML = `<li>uFlex <b>${(flex < 0 ? "−" : "") + Math.abs(flex).toFixed(2)}</b></li><li>bow <b>${bow.toFixed(1)}%</b> of width</li><li>corner twist <b>±${twist.toFixed(1)}%</b></li><li>ripple <b>${(0.014 * (0.25 + Math.abs(flex)) / K.W * 100).toFixed(1)}%</b></li>`;
    return true;
  }
  return {
    start() { if (on) return; on = true; layout(); scroll = smooth = lastSmooth = pageUnits(); stopper = Study.raf(loop); },
    stop() { on = false; stopper && stopper(); },
  };
}
