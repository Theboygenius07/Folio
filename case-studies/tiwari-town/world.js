/* Tiwari Town case study: the world's own numbers, ported.

   Everything here is lifted from the game's source so the figures on this page
   draw the same world the game builds. Nothing is restated by eye.

     core/Noise.ts          clamp, lerp, smoothstep, makeRng, Noise (value noise, fbm, ridged)
     world/geo.ts           TERRAIN, VISTAS, SEA_LEVEL
     world/Places.ts        PICNIC_SPOT, CONNECT4, GARDEN, GARDEN_AXIS
     world/height.ts        heightAt, MUSEUM_WELL, GARDEN_LEVEL, GARDEN_WATER
     world/Terrain.ts       surfaceColor (the palette the mesh and the map share)
     world/vistas/Kiel.ts   the harbour frame (kielToWorld), KIEL_PIER, KIEL_ARRIVAL
     world/Landmarks.ts     LANDMARKS, yawToward, DISCOVER_RADIUS
     config.ts              WORLD_SEED */

/* ---------- core/Noise.ts:11-151 ---------- */
export const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
/* mulberry32 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const range = (rng, lo, hi) => lo + rng() * (hi - lo);

export class Noise {
  constructor(seed) {
    const rng = makeRng(seed);
    const p = new Uint8Array(512);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    for (let i = 0; i < 256; i++) p[i + 256] = p[i];
    this.perm = p;
  }
  hash(x, y, z) {
    const p = this.perm;
    return p[(p[(p[x & 255] + y) & 255] + z) & 255] / 255;
  }
  noise3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    const u = fade(xf), v = fade(yf), w = fade(zf);
    const c000 = this.hash(xi, yi, zi), c100 = this.hash(xi + 1, yi, zi);
    const c010 = this.hash(xi, yi + 1, zi), c110 = this.hash(xi + 1, yi + 1, zi);
    const c001 = this.hash(xi, yi, zi + 1), c101 = this.hash(xi + 1, yi, zi + 1);
    const c011 = this.hash(xi, yi + 1, zi + 1), c111 = this.hash(xi + 1, yi + 1, zi + 1);
    return lerp(
      lerp(lerp(c000, c100, u), lerp(c010, c110, u), v),
      lerp(lerp(c001, c101, u), lerp(c011, c111, u), v),
      w,
    );
  }
  fbm(x, y, z, octaves = 4, lacunarity = 2, gain = 0.5) {
    let sum = 0, amp = 1, norm = 0, f = 1;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise3(x * f, y * f, z * f);
      norm += amp; amp *= gain; f *= lacunarity;
    }
    return sum / norm;
  }
  ridged(x, y, z, octaves = 4) {
    let sum = 0, amp = 1, norm = 0, f = 1;
    for (let i = 0; i < octaves; i++) {
      const n = 1 - Math.abs(this.noise3(x * f, y * f, z * f) * 2 - 1);
      sum += amp * n * n; norm += amp; amp *= 0.5; f *= 2;
    }
    return sum / norm;
  }
}

/* ---------- config.ts:19 ---------- */
export const WORLD_SEED = 20260803;

/* ---------- world/geo.ts:20-50 ---------- */
export const TERRAIN = { width: 220, depth: 220, townRadius: 26, townFalloff: 22 };
export const VISTAS = {
  tech: { x: 0, z: -74, pad: 20 },
  kiel: { x: -78, z: 26, pad: 22 },
  nepal: { x: 74, z: -30, pad: 18 },
  museum: { x: -11, z: 81, pad: 42 },
};
export const SEA_LEVEL = -1.6;

/* ---------- world/Places.ts:16-87 ---------- */
export const PICNIC_SPOT = { x: -20, z: -34 };
export const CONNECT4 = { x: 50, z: 25 };
export const GARDEN = { pad: 26, falloff: 16, island: 10.5, bank: 19, depth: 1.35, waterDrop: 0.38, deckRadius: 8.4, walkHalf: 1.5 };
const AXIS_LEN = Math.hypot(CONNECT4.x, CONNECT4.z);
export const GARDEN_AXIS = { x: -CONNECT4.x / AXIS_LEN, z: -CONNECT4.z / AXIS_LEN };

/* ---------- world/height.ts:24-172 ---------- */
const noise = new Noise(WORLD_SEED);
export const MUSEUM_WELL = { x0: -21.6, x1: -18.2, z0: 76.0, z1: 85.2, floor: -5.5 };
export const GARDEN_LEVEL = 1.7;
export const GARDEN_WATER = GARDEN_LEVEL - GARDEN.waterDrop;
const VISTA_LIST = Object.values(VISTAS);

export function heightAt(x, z) {
  let h = (noise.fbm(x * 0.008, z * 0.008, 0, 4) - 0.5) * 14;
  h += (noise.fbm(x * 0.05, z * 0.05, 11, 3) - 0.5) * 1.1;
  const nepalPull = smoothstep(46, 118, x - z * 0.35);
  if (nepalPull > 0) {
    const ridge = noise.ridged(x * 0.0075, z * 0.0075, 5, 4);
    h += Math.pow(ridge, 1.3) * 72 * nepalPull;
  }
  const seaPull = smoothstep(30, 96, -x - z * 0.15);
  if (seaPull > 0) h = lerp(h, SEA_LEVEL - 5.5, seaPull * 0.92);
  const dTown = Math.hypot(x, z);
  const townFlat = 1 - smoothstep(TERRAIN.townRadius, TERRAIN.townRadius + TERRAIN.townFalloff, dTown);
  if (townFlat > 0) {
    const gentle = (noise.fbm(x * 0.02, z * 0.02, 3, 2) - 0.5) * 1.3;
    h = lerp(h, gentle, townFlat);
  }
  for (const v of VISTA_LIST) {
    const d = Math.hypot(x - v.x, z - v.z);
    const flat = 1 - smoothstep(v.pad, v.pad + 16, d);
    if (flat <= 0) continue;
    h = lerp(h, baseHeightAt(v.x, v.z), flat * 0.95);
  }
  if (x > MUSEUM_WELL.x0 && x < MUSEUM_WELL.x1 && z > MUSEUM_WELL.z0 && z < MUSEUM_WELL.z1) {
    h = Math.min(h, MUSEUM_WELL.floor);
  }
  return shapeGarden(x, z, h);
}
function shapeGarden(x, z, h) {
  const d = Math.hypot(x - CONNECT4.x, z - CONNECT4.z);
  const flat = 1 - smoothstep(GARDEN.pad, GARDEN.pad + GARDEN.falloff, d);
  if (flat <= 0) return h;
  h = lerp(h, GARDEN_LEVEL, flat * 0.97);
  const inner = smoothstep(GARDEN.island - 2.2, GARDEN.island + 2.4, d);
  const outer = 1 - smoothstep(GARDEN.bank - 3.2, GARDEN.bank + 1.2, d);
  let basin = Math.min(inner, outer);
  const px = x - CONNECT4.x, pz = z - CONNECT4.z;
  const along = px * GARDEN_AXIS.x + pz * GARDEN_AXIS.z;
  if (along > 0) {
    const across = Math.abs(-px * GARDEN_AXIS.z + pz * GARDEN_AXIS.x);
    basin *= smoothstep(GARDEN.walkHalf, GARDEN.walkHalf + 1.1, across);
  }
  if (basin > 0) h -= GARDEN.depth * basin * flat;
  return h;
}
const baseCache = new Map();
function baseHeightAt(x, z) {
  const key = x + "," + z; // only ever asked about the four pad centres
  let h = baseCache.get(key);
  if (h !== undefined) return h;
  h = (noise.fbm(x * 0.008, z * 0.008, 0, 4) - 0.5) * 14;
  const seaPull = smoothstep(30, 96, -x - z * 0.15);
  if (seaPull > 0) h = lerp(h, SEA_LEVEL - 5.5, seaPull * 0.92);
  baseCache.set(key, h);
  return h;
}

/* ---------- world/Terrain.ts:62-109, surfaceColor ---------- */
const hex = (n) => [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
const GROUND = { grass: hex(0x7fa653), dryGrass: hex(0x9cb063), rock: hex(0xa9a294), snow: hex(0xf2f4f6), sand: hex(0xd8c9a3) };
const mix3 = (o, c, t) => { o[0] += (c[0] - o[0]) * t; o[1] += (c[1] - o[1]) * t; o[2] += (c[2] - o[2]) * t; return o; };
export function surfaceColor(x, z, h, steep, out = [0, 0, 0]) {
  out[0] = GROUND.grass[0]; out[1] = GROUND.grass[1]; out[2] = GROUND.grass[2];
  mix3(out, GROUND.dryGrass, noise.fbm(x * 0.03, z * 0.03, 7, 2));
  const shore = smoothstep(16, 58, -x - z * 0.15);
  if (shore > 0 && h < SEA_LEVEL + 2.2) mix3(out, GROUND.sand, smoothstep(SEA_LEVEL + 2.2, SEA_LEVEL - 0.4, h) * shore);
  mix3(out, GROUND.rock, smoothstep(15, 30, h));
  if (steep > 0.22) mix3(out, GROUND.rock, smoothstep(0.22, 0.6, steep));
  if (h > 17) mix3(out, GROUND.snow, smoothstep(17, 33, h));
  return out;
}
export const WATER = hex(0x3f6f92);
export const DEEP = hex(0x24455e);

/* ---------- world/vistas/Kiel.ts:42-108, the harbour frame ---------- */
const KA = (() => { const l = Math.hypot(VISTAS.kiel.x, VISTAS.kiel.z); return { x: VISTAS.kiel.x / l, y: VISTAS.kiel.z / l }; })();
/** Harbour r (town out to sea) and s (across) into world x, z. */
export const kielToWorld = (r, s) => ({ x: KA.x * r - KA.y * s, z: KA.y * r + KA.x * s });
export const KIEL_PIER = { rootR: 36.0, headR: 69.0, halfWidth: 1.85, headHalfWidth: 3.3, headFrom: 63.5 };
export const KIEL_ARRIVAL = kielToWorld(KIEL_PIER.rootR - 3, 0);

/* ---------- world/Town.ts:334 ---------- */
export const MOMO = { x: 0, z: 15.6 };

/* ---------- world/Landmarks.ts:68-285 ---------- */
export const yawToward = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));
export const DISCOVER_RADIUS = 34;
const GARDEN_APPROACH = GARDEN.bank + 3.5;
const RACE_LINE_R = 80; // KielCourse.ts:90, LINE.r
export const LANDMARKS = [
  { key: "town", label: "Town Square", note: "Where it starts.", at: { x: 0, z: 0 }, stand: { x: 0, z: 8 }, faces: MOMO },
  { key: "momo", label: "Momo Shop", note: "Steamed, not fried. Obviously.", at: MOMO, stand: { x: MOMO.x, z: MOMO.z - 6.4 }, faces: MOMO },
  { key: "tech", label: "Tech Tower", note: "Due north. You know the one.", at: VISTAS.tech, stand: { x: VISTAS.tech.x, z: VISTAS.tech.z + 15 }, faces: VISTAS.tech },
  { key: "boa", label: "The Observatory", note: "Tallest thing here. The lift runs up the outside.", at: { x: -36, z: -97 }, stand: { x: -23.71, z: -103.8 }, faces: { x: -36, z: -97 }, secret: true },
  { key: "kiel", label: "Kiel Harbour", note: "Baltic water, west side.", at: VISTAS.kiel, stand: KIEL_ARRIVAL, faces: VISTAS.kiel },
  { key: "race", label: "The Regatta", note: "Two laps, five opponents, zero experience.", at: kielToWorld(RACE_LINE_R, 0), stand: kielToWorld(KIEL_PIER.headR - 0.6, 0), faces: kielToWorld(176, 6), offMap: true },
  { key: "nepal", label: "Nepal Overlook", note: "The mountains are behind it.", at: VISTAS.nepal, stand: { x: VISTAS.nepal.x - 14, z: VISTAS.nepal.z + 6 }, faces: VISTAS.nepal },
  { key: "museum", label: "The Museum", note: "Everything worth keeping is in here.", at: VISTAS.museum, stand: { x: -25, z: 52 }, faces: { x: -25, z: 78 } },
  { key: "picnic", label: "The Picnic", note: "Blanket, thermos, questionable playlist.", at: PICNIC_SPOT, stand: { x: PICNIC_SPOT.x + 2.6, z: PICNIC_SPOT.z + 2.6 }, faces: PICNIC_SPOT },
  {
    key: "connect4", label: "The Garden", note: "Best of three. No takebacks.", at: CONNECT4,
    stand: { x: CONNECT4.x + GARDEN_AXIS.x * GARDEN_APPROACH, z: CONNECT4.z + GARDEN_AXIS.z * GARDEN_APPROACH },
    faces: CONNECT4, secret: true,
  },
];

/* ---------- world/vistas/Atlanta.ts:53-56 + TechTower.ts:45-65, the gate ---------- */
export const GATE = { x: 0, z: -69, range: 9 }; // ATLANTA.door; GATE_RANGE in TechTower.ts:551

/* ---------- world/creatures/Strays.ts:43-53, the eight dogs ---------- */
export const STRAYS = [
  { x: 3.4, z: 4.2, coat: "ginger" }, { x: -2.6, z: 11.8, coat: "charcoal" }, { x: 12.6, z: 13.2, coat: "cream" },
  { x: -24.5, z: 12.0, coat: "cocoa" }, { x: -66.0, z: 27.5, coat: "cream" }, { x: -18.6, z: -31.2, coat: "ginger" },
  { x: -6.5, z: -55.0, coat: "charcoal" }, { x: 70.5, z: -24.0, coat: "cocoa" },
];

export const fmt = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toFixed(d).replace("-", "−");
