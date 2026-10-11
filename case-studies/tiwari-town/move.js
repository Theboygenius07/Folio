/* Fig. 9: W means forward, at every heading.

     player/PlayerController.ts:286-304   the movement basis, and a wrong one beside it: the input
                                          rotated by minus yaw, right at 0° and 180°, mirrored elsewhere.
     tools/check-movement.mjs:20-38       HEADINGS, KEYS, TOLERANCE = 0.985 */
import { s, txt, fitSvg, tabs, readout, drag } from "./util.js";

const HEADINGS = [0, 45, 90, 135, 180, 225, 270, 315];
const KEYS = [
  { label: "W", ix: 0, iz: -1, along: "forward", sign: 1 },
  { label: "S", ix: 0, iz: 1, along: "forward", sign: -1 },
  { label: "D", ix: 1, iz: 0, along: "right", sign: 1 },
  { label: "A", ix: -1, iz: 0, along: "right", sign: -1 },
];
const TOLERANCE = 0.985;
const rad = (d) => (d * Math.PI) / 180;

/* camera.rotation.set(pitch, yaw, 0, 'YXZ'): forward (-sin y, -cos y), right (cos y, -sin y) */
const forward = (y) => [-Math.sin(y), -Math.cos(y)];
const right = (y) => [Math.cos(y), -Math.sin(y)];
/* PlayerController.ts:301-304, as shipped */
const fixed = (ix, iz, y) => { const sn = Math.sin(y), c = Math.cos(y); return [ix * c + iz * sn, iz * c - ix * sn]; };
/* a wrong basis: X mirrored wherever sin(yaw) isn't zero */
const before = (ix, iz, y) => { const sn = Math.sin(y), c = Math.cos(y); return [ix * c - iz * sn, iz * c + ix * sn]; };
const passes = (fn, key, y) => {
  const m = fn(key.ix, key.iz, y), e = key.along === "forward" ? forward(y) : right(y);
  const l = Math.hypot(m[0], m[1]) || 1;
  return (m[0] * e[0] * key.sign + m[1] * e[1] * key.sign) / l >= TOLERANCE;
};
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
/* a world direction (x, z) as a compass bearing, north being -z */
const bearing = (v) => { const b = ((Math.atan2(v[0], -v[1]) * 180) / Math.PI + 360) % 360; return b; };
const name = (b) => COMPASS[Math.round(b / 45) % 8];

export function mountMove(fig) {
  const dial = fig.querySelector(".mv-dial");
  const grid = fig.querySelector(".mv-grid");
  const rd = readout(fig);
  const tintInk = getComputedStyle(document.body).getPropertyValue("--tint-ink").trim() || "#2a6db0";
  const ink = "#1d1b18", ink2 = "#67625a", ink3 = "#9a958b", rule = "#e0dbd0", bad = "#b8432f";
  let yawDeg = 45, code = "old";

  /* ---------- the dial ---------- */
  const R = 118;
  s("circle", { r: R, fill: "none", stroke: rule, "stroke-width": 1.5 }, dial);
  for (const h of HEADINGS) {
    const f = forward(rad(h));
    s("line", { x1: f[0] * (R - 6), y1: f[1] * (R - 6), x2: f[0] * (R + 6), y2: f[1] * (R + 6), stroke: ink3, "stroke-width": 1.5 }, dial);
  }
  for (const [lab, x, y] of [["N", 0, -R + 22], ["E", R - 20, 5], ["S", 0, R - 14], ["W", -R + 20, 5]]) txt(dial, x, y, lab, { "text-anchor": "middle", fill: ink3, "font-size": 13, "font-weight": 600, style: "font-family: var(--font)" });
  const arrows = s("g", {}, dial);
  s("circle", { r: 7, fill: ink }, dial);
  const knob = s("circle", { r: 10, fill: "#f3f1ea", stroke: ink, "stroke-width": 2 }, dial);
  const knobLab = txt(dial, 0, 0, "facing", { fill: ink, "font-size": 12.5, "font-weight": 600, style: "font-family: var(--font)", "paint-order": "stroke", stroke: "#f3f1ea", "stroke-width": 4 });
  // a key for the two arrows
  for (const [i, c, label] of [[0, tintInk, "W, shipped"], [1, bad, "W, wrong basis"]]) {
    s("line", { x1: -148, x2: -130, y1: 170, y2: 170, stroke: c, "stroke-width": 3, transform: `translate(${i * 150} 0)` }, dial);
    txt(dial, -124 + i * 150, 174, label, { fill: c, "font-size": 12, "font-weight": 600, style: "font-family: var(--font)" });
  }

  function arrow(g, v, len, color, width, label, dy = 0) {
    const l = Math.hypot(v[0], v[1]) || 1, ux = v[0] / l, uy = v[1] / l;
    const x = ux * len, y = uy * len;
    s("line", { x1: 0, y1: 0, x2: x - ux * 10, y2: y - uy * 10, stroke: color, "stroke-width": width, "stroke-linecap": "round" }, g);
    s("path", { d: `M${x} ${y} L${x - ux * 14 - uy * 7} ${y - uy * 14 + ux * 7} L${x - ux * 14 + uy * 7} ${y - uy * 14 - ux * 7} Z`, fill: color }, g);
    if (label) {
      const tx = ux * (len + 16), ty = uy * (len + 16) + 4 + dy;
      txt(g, tx, ty, label, { "text-anchor": Math.abs(ux) < 0.3 ? "middle" : ux > 0 ? "start" : "end", fill: color, "font-size": 12.5, "font-weight": 600, style: "font-family: var(--font)", "paint-order": "stroke", stroke: "#f3f1ea", "stroke-width": 4 });
    }
  }

  function draw() {
    const y = rad(yawDeg);
    arrows.textContent = "";
    const f = forward(y);
    const wOld = before(0, -1, y), wNew = fixed(0, -1, y);
    arrow(arrows, wOld, 98, bad, 2.5, null);
    arrow(arrows, wNew, 98, tintInk, 3, null);
    knob.setAttribute("cx", f[0] * R); knob.setAttribute("cy", f[1] * R);
    const lx = f[0] * (R + 26), ly = f[1] * (R + 26) + 4;
    knobLab.setAttribute("x", lx); knobLab.setAttribute("y", ly);
    knobLab.setAttribute("text-anchor", Math.abs(f[0]) < 0.35 ? "middle" : f[0] > 0 ? "start" : "end");
    dial.setAttribute("aria-valuenow", String(Math.round(yawDeg)));
    // readouts, for the version the tabs pick
    const fn = code === "old" ? before : fixed;
    const w = fn(0, -1, y);
    const off = Math.round((Math.acos(Math.max(-1, Math.min(1, (w[0] * f[0] + w[1] * f[1]) / Math.hypot(w[0], w[1])))) * 180) / Math.PI);
    rd("hd", `${Math.round(yawDeg)}°, facing ${name(bearing(f))}`);
    rd("w", name(bearing(w)));
    rd("err", `${off}°`);
    let failed = 0;
    for (const h of HEADINGS) for (const k of KEYS) if (!passes(fn, k, rad(h))) failed++;
    rd("fail", `${failed} of 32`);
    drawGrid();
  }

  const toYaw = (e) => {
    const p = dial.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const q = p.matrixTransform(dial.getScreenCTM().inverse());
    // forward = (-sin y, -cos y) on the page, so y = atan2(-x, -y)
    return ((((Math.atan2(-q.x, -q.y) * 180) / Math.PI) % 360) + 360) % 360;
  };
  drag(dial, { start: (e) => { yawDeg = toYaw(e); draw(); }, move: (e) => { yawDeg = toYaw(e); draw(); } });
  dial.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") yawDeg = (yawDeg + 15) % 360;
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") yawDeg = (yawDeg + 345) % 360;
    else return;
    e.preventDefault(); draw();
  });

  /* ---------- the 32 cases ---------- */
  let G = null;
  fitSvg(grid, () => 236, (w, h) => {
    grid.textContent = "";
    const L = 92, top = 34, rowH = 23, cw = Math.min(64, (w - L) / 4);
    txt(grid, 0, 12, "check:movement, 8 headings × 4 keys", { class: "ann", fill: ink });
    KEYS.forEach((k, j) => txt(grid, L + j * cw + cw / 2, top - 4, k.label, { "text-anchor": "middle", fill: ink2, "font-size": 12.5, "font-weight": 600, style: "font-family: var(--mono)" }));
    const rows = HEADINGS.map((hd, i) => {
      const y = top + 6 + i * rowH;
      const hl = s("rect", { x: 0, y: y - 3, width: L + 4 * cw, height: rowH, fill: "rgba(74,159,224,0.12)", opacity: 0 }, grid);
      txt(grid, 0, y + 13, `yaw ${hd}°`, { class: "ann", "font-size": 11.5 });
      const cells = KEYS.map((k, j) => s("g", { transform: `translate(${L + j * cw + cw / 2} ${y + 8})` }, grid));
      return { hd, hl, cells };
    });
    G = { rows };
    drawGrid();
  });
  function drawGrid() {
    if (!G) return;
    const fn = code === "old" ? before : fixed;
    const near = HEADINGS.reduce((a, h) => (Math.abs(((yawDeg - h + 540) % 360) - 180) < Math.abs(((yawDeg - a + 540) % 360) - 180) ? h : a), 0);
    for (const row of G.rows) {
      row.hl.setAttribute("opacity", row.hd === near ? 1 : 0);
      KEYS.forEach((k, j) => {
        const c = row.cells[j];
        c.textContent = "";
        if (passes(fn, k, rad(row.hd))) s("rect", { x: -7, y: -7, width: 14, height: 14, fill: tintInk }, c);
        else {
          s("rect", { x: -6.5, y: -6.5, width: 13, height: 13, fill: "none", stroke: bad, "stroke-width": 1.5 }, c);
          s("path", { d: "M-4 -4 L4 4 M4 -4 L-4 4", stroke: bad, "stroke-width": 1.5 }, c);
        }
      });
    }
  }

  tabs(fig.querySelector('[aria-label="Which code the check runs against"]'), "data-code", (v) => { code = v; draw(); });
  draw();
  return { start() {}, stop() {} };
}
