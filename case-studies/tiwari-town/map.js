/* Fig. 1: the world's map, live.

   The ground is baked exactly the way src/ui/MiniMap.ts:366-418 bakes it: a 352 by
   352 grid of heightAt samples, coloured by surfaceColor (the same function the
   terrain mesh uses), hill-shaded from the north-west, with the sea and the
   garden pond drawn as water. Pins come from Landmarks.ts; the dashed roads out
   of town are MiniMap.ts:430-447. Nothing here is a picture of the map. */
import { LANDMARKS, TERRAIN, SEA_LEVEL, GARDEN, GARDEN_WATER, CONNECT4, WATER, DEEP, GATE, STRAYS, DISCOVER_RADIUS,
  heightAt, surfaceColor, yawToward } from "./world.js";
import { s, txt, Study, comma } from "./util.js";

const BAKE = 352; // MiniMap.ts:51
const LIGHT = [-0.52, 0.74, -0.43]; // MiniMap.ts:381-384, raking light from the north-west
const COATS = { cream: "#e8cfa9", charcoal: "#5d5f66", ginger: "#c8763c", cocoa: "#7a5240" }; // Dog.ts:30-35

/* The line each place's own trigger plays, from NarrationScript.ts. The Observatory has none. */
const LINES = {
  town: ["spawn", "Hi. Good morning. I have absolutely no idea where I am."],
  momo: ["momo_shop", "A momo shop. Of course there is a momo shop."],
  tech: ["gateNear", "There is a door. An actual door."],
  kiel: ["vista_kiel", "Ten out of ten harbour. No notes."],
  nepal: ["vista_nepal", "Okay, hold on, let me get a proper shot of that."],
  museum: ["museum", "That is a museum. An actual museum, out here."],
  picnic: ["picnic", "Somebody set up a picnic. For me. I am deciding it is for me."],
  connect4: ["connect4", "Hold on. There is a Connect 4 board back here."],
};
const ALT = {
  town: "Arriving at the town square: the momo shop straight ahead under its red and white awning",
  momo: "Arriving at the momo shop: the counter with its steamers and a row of momos",
  tech: "Arriving at the Tech Tower: red brick, an arch marked 1888, and the door under it",
  boa: "Arriving at the Observatory: the lift door, marked Sky Deck, 44 m above",
  kiel: "Arriving at Kiel Harbour: the jetty running out to sea under signal flags, sailing boats moored either side",
  nepal: "Arriving at the Nepal Overlook: prayer flags overhead and a white stupa ahead",
  museum: "Arriving at the museum: a glass pyramid over the entrance, the building behind it",
  picnic: "Arriving at the picnic: a checked blanket and a basket on the grass, a tower in the distance",
  connect4: "Arriving at the garden: a boardwalk across a pond to a giant Connect 4 board",
};
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function mountMap(fig) {
  const canvas = fig.querySelector(".mp-ground");
  const svg = fig.querySelector(".mp-svg");
  const pinsEl = fig.querySelector(".mp-pins");
  const plate = fig.querySelector(".mp-plate");
  const img = fig.querySelector(".mp-shot img");
  const title = fig.querySelector(".mp-title");
  const note = fig.querySelector(".mp-note");
  const line = fig.querySelector(".mp-line");
  const read = fig.querySelector(".mp-read");
  const bakeOut = fig.querySelector('[data-r="bake"]');
  const scaleBar = fig.querySelector(".mp-scale i");

  const marks = LANDMARKS.filter((m) => !m.offMap);
  const found = new Set();
  let current = null;

  /* ---------- static overlay: roads, dogs ---------- */
  const routes = s("g", {}, svg);
  for (const m of marks) {
    if (m.key === "town" || m.secret) continue;
    // 2px, dash 6/7, in bake pixels; 220 m over 352 px is 0.625 m a pixel
    s("line", { x1: 0, y1: 0, x2: m.at.x, y2: m.at.z, stroke: "rgba(255,246,226,0.55)", "stroke-width": 1.25, "stroke-dasharray": "3.75 4.4", "stroke-linecap": "round" }, routes);
  }
  const dogs = s("g", {}, svg);
  for (const d of STRAYS) s("circle", { cx: d.x, cy: d.z, r: 1.35, fill: COATS[d.coat], stroke: "rgba(10,12,18,0.85)", "stroke-width": 0.5 }, dogs);
  const sel = s("g", {}, svg);

  /* ---------- pins ---------- */
  const pins = marks.map((m, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mp-pin" + (m.secret ? " is-secret" : "");
    b.style.left = ((m.at.x + 110) / 220) * 100 + "%";
    b.style.top = ((m.at.z + 110) / 220) * 100 + "%";
    b.innerHTML = `<i></i><span>${m.secret ? "?" : m.label}</span>`;
    b.setAttribute("aria-label", m.secret ? "An unnamed place" : m.label);
    b.addEventListener("click", () => select(i, true));
    b.addEventListener("focus", () => select(i, true));
    if (Study.hover) b.addEventListener("pointerenter", () => select(i, true));
    b.addEventListener("keydown", (e) => {
      const k = e.key;
      if (k !== "ArrowRight" && k !== "ArrowDown" && k !== "ArrowLeft" && k !== "ArrowUp") return;
      e.preventDefault();
      const j = (i + (k === "ArrowRight" || k === "ArrowDown" ? 1 : -1) + pins.length) % pins.length;
      pins[j].focus();
    });
    pinsEl.appendChild(b);
    return b;
  });

  const layout = () => {
    const w = plate.clientWidth;
    if (!w) return;
    scaleBar.style.setProperty("--w", ((w * 50) / 220).toFixed(1) + "px");
    // labels go right of the dot unless that runs off the plate or onto a label already placed
    const placed = [];
    const rectFor = (i, left) => {
      const b = pins[i], bw = b.offsetWidth, bh = b.offsetHeight;
      const x = ((marks[i].at.x + 110) / 220) * w, y = ((marks[i].at.z + 110) / 220) * w;
      const x0 = left ? x - bw + 6 : x - 6;
      return { x0, x1: x0 + bw, y0: y - bh / 2, y1: y + bh / 2 };
    };
    const hits = (r) => placed.filter((q) => r.x0 < q.x1 + 3 && r.x1 + 3 > q.x0 && r.y0 < q.y1 + 2 && r.y1 + 2 > q.y0).length
      + (r.x1 > w - 2 ? 5 : 0) + (r.x0 < 2 ? 5 : 0);
    pins.forEach((b, i) => {
      b.classList.remove("is-left");
      const right = rectFor(i, false), left = rectFor(i, true);
      const useLeft = hits(left) < hits(right);
      b.classList.toggle("is-left", useLeft);
      placed.push(useLeft ? left : right);
    });
  };
  new ResizeObserver(layout).observe(plate);

  function select(i, user) {
    const m = marks[i];
    if (current === i) return;
    current = i;
    if (m.secret && user) {
      // named once she has been near it, Landmarks.ts:41-50; here, once you've looked
      found.add(m.key);
      pins[i].querySelector("span").textContent = m.label;
      pins[i].classList.remove("is-secret");
      pins[i].setAttribute("aria-label", m.label);
      layout();
    }
    pins.forEach((b, j) => { b.classList.toggle("is-on", j === i); b.setAttribute("aria-pressed", String(j === i)); });

    const src = `media/tiwari-town/pin-${m.key}.webp`;
    const pre = new Image();
    pre.src = src;
    const swap = () => { img.src = src; img.alt = ALT[m.key] || ""; };
    if (pre.decode) pre.decode().then(swap, swap); else swap();

    title.textContent = m.label;
    note.textContent = m.note;
    const ln = LINES[m.key];
    line.innerHTML = ln ? `<small>What the narration says here</small>“${ln[1]}”` : "";

    const yaw = yawToward(m.stand, m.faces);
    let yawDeg = (yaw * 180) / Math.PI;
    if (yawDeg <= -179.95) yawDeg += 360; // atan2(-0, -z) is −π; same heading, read as 180
    const bearing = ((((-yaw * 180) / Math.PI) % 360) + 360) % 360;
    const dir = COMPASS[Math.round(bearing / 45) % 8];
    const dist = Math.hypot(m.stand.x, m.stand.z);
    read.innerHTML =
      `<li>lands at <b>${f(m.stand.x)}, ${f(m.stand.z)}</b></li>` +
      `<li>facing <b>${dir}</b>, yaw <b>${f(yawDeg)}°</b></li>` +
      `<li><b>${Math.round(dist)} m</b> from the square</li>`;

    drawSelection(m);
  }
  const f = (n) => (Math.abs(n) < 0.05 ? "0.0" : n.toFixed(1)).replace("-", "−");

  function drawSelection(m) {
    sel.textContent = "";
    const ink = "rgba(10,12,18,0.85)";
    if (m.secret) {
      s("circle", { cx: m.at.x, cy: m.at.z, r: DISCOVER_RADIUS, fill: "none", stroke: "#fdfcf9", "stroke-width": 0.6, "stroke-dasharray": "2 2", opacity: 0.9 }, sel);
      txt(sel, m.at.x, Math.min(104, m.at.z + DISCOVER_RADIUS + 5.5), "named within 34 m", { "text-anchor": "middle", fill: "#fdfcf9", "font-size": 4.2, "font-weight": 600, "paint-order": "stroke", stroke: ink, "stroke-width": 1.1 });
    }
    if (m.key === "tech") {
      s("circle", { cx: GATE.x, cy: GATE.z, r: GATE.range, fill: "rgba(74,159,224,0.18)", stroke: "#fdfcf9", "stroke-width": 0.6 }, sel);
      txt(sel, GATE.x + GATE.range + 2, GATE.z + 1.4, "the door, 9 m", { fill: "#fdfcf9", "font-size": 4.2, "font-weight": 600, "paint-order": "stroke", stroke: ink, "stroke-width": 1.1 });
    }
    // pin to arrival
    s("line", { x1: m.at.x, y1: m.at.z, x2: m.stand.x, y2: m.stand.z, stroke: "#fdfcf9", "stroke-width": 0.7, "stroke-dasharray": "1.6 1.4" }, sel);
    // her, at `stand`, facing `faces`
    const dx = m.faces.x - m.stand.x, dz = m.faces.z - m.stand.z;
    const a = (Math.atan2(dz, dx) * 180) / Math.PI;
    const g = s("g", { transform: `translate(${m.stand.x} ${m.stand.z}) rotate(${a})` }, sel);
    s("path", { d: "M5.2 0 L-3.2 -3.6 L-1.4 0 L-3.2 3.6 Z", fill: "#fdfcf9", stroke: ink, "stroke-width": 0.7, "stroke-linejoin": "round" }, g);
  }

  /* ---------- the bake, spread over frames so the page never stalls ---------- */
  let baked = false, baking = false;
  function bake() {
    if (baked || baking) return;
    baking = true;
    const ctx = canvas.getContext("2d");
    const step = TERRAIN.width / BAKE;
    const origin = -TERRAIN.width / 2 + step / 2;
    const heights = new Float32Array(BAKE * BAKE);
    const imgData = ctx.createImageData(BAKE, BAKE);
    const c = [0, 0, 0];
    let row = 0, pass = 0, spent = 0;
    const [lx, ly, lz] = LIGHT;
    const tick = () => {
      const t0 = performance.now();
      while (performance.now() - t0 < 10 && pass < 2) {
        const j = row;
        if (pass === 0) {
          for (let i = 0; i < BAKE; i++) heights[j * BAKE + i] = heightAt(origin + i * step, origin + j * step);
        } else {
          for (let i = 0; i < BAKE; i++) {
            const k = j * BAKE + i;
            const x = origin + i * step, z = origin + j * step, h = heights[k];
            const hL = heights[k - (i > 0 ? 1 : 0)];
            const hR = heights[k + (i < BAKE - 1 ? 1 : 0)];
            const hD = heights[k - (j > 0 ? BAKE : 0)];
            const hU = heights[k + (j < BAKE - 1 ? BAKE : 0)];
            const nx = hL - hR, ny = 2 * step, nz = hD - hU;
            const inv = 1 / Math.hypot(nx, ny, nz);
            const steep = 1 - Math.min(1, Math.max(0, ny * inv));
            surfaceColor(x, z, h, steep, c);
            const pond = Math.hypot(x - CONNECT4.x, z - CONNECT4.z) < GARDEN.bank + 1 && h < GARDEN_WATER;
            const sea = h < SEA_LEVEL;
            if (pond || sea) {
              const surface = pond ? GARDEN_WATER : SEA_LEVEL;
              const t = Math.min(1, (surface - h) / 7);
              c[0] = WATER[0] + (DEEP[0] - WATER[0]) * t;
              c[1] = WATER[1] + (DEEP[1] - WATER[1]) * t;
              c[2] = WATER[2] + (DEEP[2] - WATER[2]) * t;
            }
            const shade = pond || sea ? 1 : 0.74 + 0.46 * ((nx * lx + ny * ly + nz * lz) * inv);
            const o = k * 4;
            imgData.data[o] = Math.min(255, c[0] * 255 * shade);
            imgData.data[o + 1] = Math.min(255, c[1] * 255 * shade);
            imgData.data[o + 2] = Math.min(255, c[2] * 255 * shade);
            imgData.data[o + 3] = 255;
          }
        }
        row++;
        if (row === BAKE) { row = 0; pass++; if (pass === 2) break; }
      }
      spent += performance.now() - t0;
      if (pass === 1 && row > 0) {
        // paint the colour pass as it goes, top to bottom
        ctx.putImageData(imgData, 0, 0, 0, 0, BAKE, row);
      }
      if (pass < 2) { requestAnimationFrame(tick); return; }
      ctx.putImageData(imgData, 0, 0);
      baked = true; baking = false;
      bakeOut.textContent = `${comma(BAKE * BAKE)} heightAt samples, baked in ${Math.round(spent)} ms`;
    };
    requestAnimationFrame(tick);
  }

  select(0, false);
  layout();
  return { start: bake, stop() {} };
}
