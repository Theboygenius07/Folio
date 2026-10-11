/* The dog, ported.

     fx/Sculpt.ts:142-315              metaSurface + marching cubes (tables from three's own addon)
     world/creatures/Dog.ts:30-434     coats, pivots, ball layouts, weld, assembly
     world/creatures/DogRig.ts:52-622  the gait: stance and swing, three gaits blended, postures
     viewer.ts:132-187                 the studio the dog was tuned in

   Same numbers, same order of operations. */
import * as THREE from "three";
import { edgeTable, triTable } from "three/addons/objects/MarchingCubes.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { clamp, lerp, smoothstep, makeRng, range, WORLD_SEED } from "./world.js";

/* ---------------- Sculpt.ts ---------------- */
function boxProjectedUV(geo, scale = 1) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    let u, v;
    if (nx >= ny && nx >= nz) { u = z * scale; v = y * scale; }
    else if (ny >= nx && ny >= nz) { u = x * scale; v = z * scale; }
    else { u = x * scale; v = y * scale; }
    uv[i * 2] = u; uv[i * 2 + 1] = v;
  }
  return new THREE.BufferAttribute(uv, 2);
}

export function metaSurface(balls, opts = {}) {
  const resolution = opts.resolution ?? 48, iso = opts.isoLevel ?? 1.0, padding = opts.padding ?? 0.28, smoothK = opts.smooth ?? 1.0;
  const box = new THREE.Box3().makeEmpty(), corner = new THREE.Vector3();
  for (const b of balls) {
    if ((b.strength ?? 1) < 0) continue;
    const rx = b.r * (b.sx ?? 1), ry = b.r * (b.sy ?? 1), rz = b.r * (b.sz ?? 1);
    box.expandByPoint(corner.set(b.x - rx, b.y - ry, b.z - rz));
    box.expandByPoint(corner.set(b.x + rx, b.y + ry, b.z + rz));
  }
  if (box.isEmpty()) return { geo: new THREE.BufferGeometry(), cells: 0 };
  box.expandByScalar(padding);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const nx = Math.max(8, Math.ceil((size.x / maxDim) * resolution));
  const ny = Math.max(8, Math.ceil((size.y / maxDim) * resolution));
  const nz = Math.max(8, Math.ceil((size.z / maxDim) * resolution));
  const dx = size.x / (nx - 1), dy = size.y / (ny - 1), dz = size.z / (nz - 1);
  const field = new Float32Array(nx * ny * nz);
  // Wyvill falloff: finite support, nothing past 2r (Sculpt.ts:203-218)
  const sample = (px, py, pz) => {
    let sum = 0;
    for (const b of balls) {
      const ex = (px - b.x) / (b.sx ?? 1), ey = (py - b.y) / (b.sy ?? 1), ez = (pz - b.z) / (b.sz ?? 1);
      const d2 = ex * ex + ey * ey + ez * ez, support = b.r * b.r * 4;
      if (d2 > support) continue;
      const q = clamp(d2 / (support * smoothK), 0, 1), f = 1 - q;
      sum += (b.strength ?? 1) * f * f * f;
    }
    return sum;
  };
  for (let k = 0; k < nz; k++) {
    const pz = box.min.z + k * dz;
    for (let j = 0; j < ny; j++) {
      const py = box.min.y + j * dy, rowBase = j * nx + k * nx * ny;
      for (let i = 0; i < nx; i++) field[i + rowBase] = sample(box.min.x + i * dx, py, pz);
    }
  }
  return { geo: polygonize(field, nx, ny, nz, box.min, dx, dy, dz, iso * 0.35), cells: nx * ny * nz };
}

const CORNER_OFFSET = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
const EDGE_CORNERS = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
function polygonize(field, nx, ny, nz, origin, dx, dy, dz, iso) {
  const positions = [];
  const idx = (i, j, k) => i + j * nx + k * nx * ny;
  const vals = new Float32Array(8), edgeVerts = new Array(36).fill(0);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let cubeIndex = 0;
    for (let c = 0; c < 8; c++) {
      const [ci, cj, ck] = CORNER_OFFSET[c];
      const v = field[idx(i + ci, j + cj, k + ck)];
      vals[c] = v;
      if (v > iso) cubeIndex |= 1 << c;
    }
    const bits = edgeTable[cubeIndex];
    if (bits === 0) continue;
    for (let e = 0; e < 12; e++) {
      if ((bits & (1 << e)) === 0) continue;
      const [a, b] = EDGE_CORNERS[e], va = vals[a], vb = vals[b], denom = vb - va;
      const t = Math.abs(denom) < 1e-9 ? 0.5 : clamp((iso - va) / denom, 0, 1);
      const [ai, aj, ak] = CORNER_OFFSET[a], [bi, bj, bk] = CORNER_OFFSET[b], o = e * 3;
      edgeVerts[o] = origin.x + (i + lerp(ai, bi, t)) * dx;
      edgeVerts[o + 1] = origin.y + (j + lerp(aj, bj, t)) * dy;
      edgeVerts[o + 2] = origin.z + (k + lerp(ak, bk, t)) * dz;
    }
    const base = cubeIndex << 4;
    for (let t = 0; triTable[base + t] !== -1 && t < 15; t += 3) {
      for (const off of [2, 1, 0]) {
        const o = triTable[base + t + off] * 3;
        positions.push(edgeVerts[o], edgeVerts[o + 1], edgeVerts[o + 2]);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  geo.setAttribute("uv", boxProjectedUV(geo));
  return geo;
}

/* ---------------- Dog.ts ---------------- */
export const COATS = {
  cream: { base: 0xe8cfa9, belly: 0xf6e8d2, nose: 0x3b2f2a },
  charcoal: { base: 0x5d5f66, belly: 0x8d9099, nose: 0x2a2a2e },
  ginger: { base: 0xc8763c, belly: 0xe8b985, nose: 0x4a2f22 },
  cocoa: { base: 0x7a5240, belly: 0xbb9375, nose: 0x33241d },
};
const HEAD_PIVOT = new THREE.Vector3(0, 0.95, 0.465);
const TAIL_PIVOT = new THREE.Vector3(0, 0.6, -0.35);
const KNEE_Y = -0.17;
const EAR_PIVOT = new THREE.Vector3(0.078, 0.03, 0.03);
const EAR_SPLAY = 0.22;
const SHOULDER = { x: 0.115, y: 0.455, z: 0.235 };
const HIP = { x: 0.118, y: 0.465, z: -0.24 };
const TAIL_JOINT = new THREE.Vector3(0, 0.155, -0.045);
const DOG_SPAN = 1.55;

function bodyBalls() {
  const balls = [];
  balls.push({ x: 0, y: 0.565, z: -0.325, r: 0.126, sy: 0.96, sz: 0.98 });
  balls.push({ x: 0, y: 0.548, z: -0.2, r: 0.164, sy: 0.95, sz: 1.05 });
  balls.push({ x: 0, y: 0.552, z: -0.06, r: 0.148, sy: 0.92 });
  balls.push({ x: 0, y: 0.556, z: 0.09, r: 0.15, sy: 0.95 });
  balls.push({ x: 0, y: 0.566, z: 0.235, r: 0.168, sy: 1.0, sz: 0.92 });
  for (const s of [-1, 1]) {
    balls.push({ x: s * 0.092, y: 0.478, z: SHOULDER.z, r: 0.102, sy: 0.9 });
    balls.push({ x: s * 0.095, y: 0.482, z: HIP.z + 0.005, r: 0.116, sy: 0.95, sz: 1.05 });
  }
  balls.push({ x: 0, y: 0.685, z: 0.3, r: 0.106, sy: 1.05 });
  balls.push({ x: 0, y: 0.782, z: 0.352, r: 0.086, sy: 1.05 });
  balls.push({ x: 0, y: 0.872, z: 0.428, r: 0.062 });
  return balls;
}
function headBalls() {
  const balls = [];
  balls.push({ x: 0, y: 0, z: 0, r: 0.138 });
  balls.push({ x: 0, y: -0.05, z: 0.135, r: 0.095, sx: 0.9, sy: 0.82, sz: 1.1 });
  balls.push({ x: 0, y: -0.07, z: 0.245, r: 0.072, sx: 0.85, sy: 0.78, sz: 1.05 });
  for (const s of [-1, 1]) balls.push({ x: s * 0.072, y: 0.005, z: 0.095, r: 0.052, strength: -0.55 });
  return balls;
}
const earBalls = () => [
  { x: 0, y: 0, z: 0, r: 0.082, sx: 0.5, sy: 0.85, sz: 1.0 },
  { x: 0, y: 0.09, z: -0.01, r: 0.068, sx: 0.46, sy: 0.95, sz: 0.85 },
  { x: 0, y: 0.165, z: -0.02, r: 0.048, sx: 0.42, sy: 0.9, sz: 0.7 },
];
const upperLegBalls = () => [{ x: 0, y: 0, z: 0, r: 0.088 }, { x: 0, y: -0.09, z: 0.002, r: 0.082 }, { x: 0, y: -0.178, z: -0.004, r: 0.074 }];
const lowerLegBalls = () => [
  { x: 0, y: 0, z: 0, r: 0.056 }, { x: 0, y: -0.08, z: 0.004, r: 0.054 }, { x: 0, y: -0.165, z: 0.014, r: 0.052 },
  { x: 0, y: -0.235, z: 0.03, r: 0.07, sy: 0.62, sz: 1.2 },
];
const tailBaseBalls = () => [{ x: 0, y: 0, z: 0, r: 0.086 }, { x: 0, y: 0.075, z: -0.03, r: 0.08 }, { x: 0, y: 0.155, z: -0.045, r: 0.068 }];
const tailTipBalls = () => [{ x: 0, y: 0, z: 0, r: 0.07 }, { x: 0, y: 0.075, z: 0.045, r: 0.059 }, { x: 0, y: 0.1, z: 0.125, r: 0.048 }];

export const BALLS = { body: bodyBalls(), head: headBalls(), ear: earBalls(), upperLeg: upperLegBalls(), lowerLeg: lowerLegBalls(), tailBase: tailBaseBalls(), tailTip: tailTipBalls() };
/** Balls in the assembled dog: two ears, four legs of two parts each. */
export const BALL_COUNT = BALLS.body.length + BALLS.head.length + 2 * BALLS.ear.length + 4 * (BALLS.upperLeg.length + BALLS.lowerLeg.length) + BALLS.tailBase.length + BALLS.tailTip.length;

function ballSpan(balls) {
  const box = new THREE.Box3().makeEmpty(), corner = new THREE.Vector3();
  for (const b of balls) {
    if ((b.strength ?? 1) < 0) continue;
    const rx = b.r * (b.sx ?? 1), ry = b.r * (b.sy ?? 1), rz = b.r * (b.sz ?? 1);
    box.expandByPoint(corner.set(b.x - rx, b.y - ry, b.z - rz));
    box.expandByPoint(corner.set(b.x + rx, b.y + ry, b.z + rz));
  }
  const size = box.getSize(new THREE.Vector3());
  return Math.max(size.x, size.y, size.z);
}
/* Dog.ts:260-268. Marching cubes emits unwelded soup, so computeVertexNormals can only give
   face normals: the faceting. Welding first gives averaged normals: one smooth coat. */
function smoothSkin(geo) {
  geo.deleteAttribute("normal");
  geo.deleteAttribute("uv");
  const welded = mergeVertices(geo);
  geo.dispose();
  welded.computeVertexNormals();
  welded.setAttribute("uv", boxProjectedUV(welded));
  return welded;
}
function partGeometry(balls, cell, weld) {
  const padding = cell * 1.6;
  const resolution = Math.max(8, Math.ceil((ballSpan(balls) + padding * 2) / cell));
  const { geo, cells } = metaSurface(balls, { resolution, padding, isoLevel: 1.0, smooth: 1.0 });
  return { geo: weld ? smoothSkin(geo) : geo, cells };
}
const cache = new Map();
export function dogGeometries(resolution, weld = true) {
  const key = resolution + (weld ? "w" : "s");
  if (cache.has(key)) return cache.get(key);
  const t0 = performance.now();
  const cell = DOG_SPAN / resolution;
  let cells = 0;
  const part = (b) => { const p = partGeometry(b, cell, weld); cells += p.cells; return p.geo; };
  const built = {
    body: part(BALLS.body), head: part(BALLS.head), ear: part(BALLS.ear), upperLeg: part(BALLS.upperLeg),
    lowerLeg: part(BALLS.lowerLeg), tailBase: part(BALLS.tailBase), tailTip: part(BALLS.tailTip),
    eye: new THREE.SphereGeometry(0.032, 16, 12), nose: new THREE.SphereGeometry(0.038, 16, 12),
  };
  built.ms = performance.now() - t0;
  built.cells = cells;
  built.cell = cell;
  const tri = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
  built.tris = tri(built.body) + tri(built.head) + 2 * tri(built.ear) + 4 * (tri(built.upperLeg) + tri(built.lowerLeg)) + tri(built.tailBase) + tri(built.tailTip) + 2 * tri(built.eye) + tri(built.nose);
  cache.set(key, built);
  return built;
}

const coatMesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; m.userData.coat = true; return m; };

/** Dog.ts:323-434, plus an optional sphere layer hung on the same pivots. */
export function createDog({ variant = "cream", resolution = 64, weld = true } = {}) {
  const coat = COATS[variant];
  const geo = dogGeometries(resolution, weld);
  const coatMat = new THREE.MeshStandardMaterial({ color: coat.base, roughness: 0.85, metalness: 0, flatShading: false });
  const group = new THREE.Group();
  const chassis = new THREE.Group(); group.add(chassis);
  const balls = []; // [parent, ballList]
  chassis.add(coatMesh(geo.body, coatMat)); balls.push([chassis, BALLS.body]);
  const head = new THREE.Group(); head.position.copy(HEAD_PIVOT); head.add(coatMesh(geo.head, coatMat)); chassis.add(head); balls.push([head, BALLS.head]);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x14100e, roughness: 0.25 });
  for (const s of [-1, 1]) { const eye = new THREE.Mesh(geo.eye, eyeMat); eye.position.set(s * 0.073, 0.008, 0.14); head.add(eye); }
  const noseMat = new THREE.MeshStandardMaterial({ color: coat.nose, roughness: 0.35 });
  const nose = new THREE.Mesh(geo.nose, noseMat); nose.position.set(0, -0.066, 0.31); nose.scale.set(1.2, 0.9, 0.8); head.add(nose);
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group(); ear.position.set(s * EAR_PIVOT.x, EAR_PIVOT.y, EAR_PIVOT.z); ear.rotation.z = -s * EAR_SPLAY;
    ear.add(coatMesh(geo.ear, coatMat)); head.add(ear); ears.push(ear); balls.push([ear, BALLS.ear]);
  }
  const legs = [];
  for (const side of [-1, 1]) for (const front of [true, false]) {
    const at = front ? SHOULDER : HIP;
    const hip = new THREE.Group(); hip.position.set(side * at.x, at.y, at.z); hip.add(coatMesh(geo.upperLeg, coatMat));
    const knee = new THREE.Group(); knee.position.y = KNEE_Y; knee.add(coatMesh(geo.lowerLeg, coatMat)); hip.add(knee);
    chassis.add(hip); legs.push({ hip, knee, front, left: side < 0 });
    balls.push([hip, BALLS.upperLeg], [knee, BALLS.lowerLeg]);
  }
  const tailBase = new THREE.Group(); tailBase.position.copy(TAIL_PIVOT); tailBase.add(coatMesh(geo.tailBase, coatMat)); chassis.add(tailBase);
  const tailTip = new THREE.Group(); tailTip.position.copy(TAIL_JOINT); tailTip.add(coatMesh(geo.tailTip, coatMat)); tailBase.add(tailTip);
  balls.push([tailBase, BALLS.tailBase], [tailTip, BALLS.tailTip]);
  const parts = { chassis, head, ears, legs, tailBase, tailTip };
  return { group, parts, balls, coatMat, noseMat, eyeMat, geo, rig: new DogRig(parts) };
}

/** The spheres themselves, on the same pivots, so they move with the rig. */
export function addBallLayer(dog, color) {
  const unit = new THREE.SphereGeometry(1, 22, 16);
  const pos = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const neg = new THREE.MeshStandardMaterial({ color: 0xc8432f, roughness: 0.6 });
  const out = [];
  for (const [parent, list] of dog.balls) {
    for (const b of list) {
      const m = new THREE.Mesh(unit, (b.strength ?? 1) < 0 ? neg : pos);
      m.position.set(b.x, b.y, b.z);
      m.scale.set(b.r * (b.sx ?? 1), b.r * (b.sy ?? 1), b.r * (b.sz ?? 1));
      m.castShadow = true;
      m.visible = false;
      parent.add(m);
      out.push(m);
    }
  }
  return { meshes: out, pos, set(on) { out.forEach((m) => (m.visible = on)); } };
}

/* ---------------- DogRig.ts ---------------- */
const TAU = Math.PI * 2;
export const HIP_HEIGHT = 0.46;
const GAIT_ON = 0.12, GAIT_FULL = 0.8;
export const STRIDE_MAX_HZ = 4.3;
export const GAITS = { walk: { swing: 0.42, duty: 0.62 }, trot: { swing: 0.55, duty: 0.48 }, gallop: { swing: 0.8, duty: 0.33 } };
export const FOOTFALL = {
  walk: { lf: 0.25, lh: 0.0, rf: 0.75, rh: 0.5 },
  trot: { lf: 0.0, lh: 0.5, rf: 0.5, rh: 0.0 },
  gallop: { lf: 0.45, lh: 0.0, rf: 0.55, rh: 0.1 },
};
const KNEE_SWING_FRONT = 0.52, KNEE_SWING_REAR = 0.72, KNEE_STANCE = 0.1;
const BOB = 0.022, ROLL = 0.032, BOUND = 0.055, BREATH = 0.006;
const HEAD_DIP = 0.08, HEAD_TURN = 0.3, HEAD_YAW_MAX = 0.75, HEAD_PITCH_MAX = 0.85;
const SHAKE_TIME = 0.75, BARK_TIME = 0.3;
const rigSeeds = makeRng(WORLD_SEED ^ 0x0d09);
const STAND = { chassisY: 0, chassisPitch: 0, frontHip: 0, frontKnee: 0, rearHip: 0, rearKnee: 0, headPitch: 0, tailPitch: 0 };
export const POSTURES = {
  sit: { chassisY: -0.09, chassisPitch: -0.46, frontHip: 0.44, frontKnee: 0.06, rearHip: -0.5, rearKnee: 1.5, headPitch: -0.06, tailPitch: 0.12 },
  lie: { chassisY: -0.3, chassisPitch: -0.04, frontHip: -0.95, frontKnee: 0.2, rearHip: -1.05, rearKnee: 1.95, headPitch: 0.06, tailPitch: 0.4 },
  sniff: { chassisY: -0.03, chassisPitch: 0.09, frontHip: -0.12, frontKnee: 0.08, rearHip: 0.05, rearKnee: 0.04, headPitch: 0.8, tailPitch: -0.12 },
};
const frac = (x) => x - Math.floor(x);

/** DogRig.ts:254-271. Stance is linear in time; swing is eased at both ends. */
export function legCycle(p, duty, swing, kneeSwing) {
  if (p < duty) {
    const u = p / duty;
    return { hip: -swing + 2 * swing * u, knee: KNEE_STANCE * Math.sin(Math.PI * u) };
  }
  const v = (p - duty) / (1 - duty);
  const ease = 0.5 - 0.5 * Math.cos(Math.PI * v);
  return { hip: swing - 2 * swing * ease, knee: kneeSwing * Math.sin(Math.PI * v) };
}

/** DogRig.ts:338-345, the gait mix. */
export function gaitMix(speed) {
  const wGallop = smoothstep(4.6, 6.6, speed);
  const wWalk = (1 - smoothstep(1.1, 2.3, speed)) * (1 - wGallop);
  const wTrot = Math.max(0, 1 - wWalk - wGallop);
  const swing = GAITS.walk.swing * wWalk + GAITS.trot.swing * wTrot + GAITS.gallop.swing * wGallop;
  const duty = GAITS.walk.duty * wWalk + GAITS.trot.duty * wTrot + GAITS.gallop.duty * wGallop;
  const hz = Math.min(STRIDE_MAX_HZ, (speed * duty) / (2 * HIP_HEIGHT * Math.sin(swing)));
  return { wWalk, wTrot, wGallop, swing, duty, hz };
}

export class DogRig {
  constructor(parts) {
    this.parts = parts;
    this.rng = makeRng(Math.floor(rigSeeds() * 0xffffffff));
    this.stridePhase = this.rng();
    this.wagPhase = range(this.rng, 0, TAU);
    this.breathPhase = range(this.rng, 0, TAU);
    this.headYaw = 0; this.headPitch = 0; this.glanceTarget = 0;
    this.glanceTimer = range(this.rng, 1.2, 4);
    this.flick = 0; this.flickTimer = range(this.rng, 1.5, 4.5);
    this.pose = { ...STAND }; this.settle = 0;
    this.shakeT = 0; this.barkT = 0; this.perk = 0; this.perkTarget = 0;
  }
  update(dt, speed = 0, drive) {
    const step = Math.min(Math.max(dt, 0), 0.05);
    const posture = drive?.posture ?? "stand";
    const mood = clamp(drive?.mood ?? 0.35, 0, 1);
    const g = gaitMix(speed);
    this.stridePhase = frac(this.stridePhase + g.hz * step);
    this.breathPhase += step * 1.9;
    const gait = smoothstep(GAIT_ON, GAIT_FULL, speed);
    this.wagPhase += step * (lerp(2.8, 9, mood) + gait * 3 + this.flick * 7);
    this.tickTimers(step, gait, drive);
    this.tickPosture(step, posture);
    this.apply({ speed, gait, swing: g.swing, duty: g.duty, wWalk: g.wWalk, wTrot: g.wTrot, wGallop: g.wGallop, mood, grade: drive?.grade ?? 0 });
    return g;
  }
  tickTimers(step, gait, drive) {
    this.flick = Math.max(0, this.flick - step * 1.7);
    this.shakeT = Math.max(0, this.shakeT - step);
    this.barkT = Math.max(0, this.barkT - step);
    this.perk += (this.perkTarget - this.perk) * (1 - Math.exp(-9 * step));
    this.glanceTimer -= step;
    if (this.glanceTimer <= 0) {
      this.glanceTarget = this.rng() < 0.45 ? 0 : range(this.rng, -HEAD_TURN, HEAD_TURN);
      this.glanceTimer = range(this.rng, 2.2, 5.5);
    }
    const wantYaw = drive?.lookYaw ?? lerp(this.glanceTarget, 0, gait);
    const wantPitch = drive?.lookPitch ?? 0;
    const k = 1 - Math.exp(-(drive?.lookYaw != null ? 5.5 : 3.2) * step);
    this.headYaw += (clamp(wantYaw, -HEAD_YAW_MAX, HEAD_YAW_MAX) - this.headYaw) * k;
    this.headPitch += (clamp(wantPitch, -HEAD_PITCH_MAX, HEAD_PITCH_MAX) - this.headPitch) * k;
    this.flickTimer -= step;
    if (this.flickTimer <= 0) { this.flick = 1; this.flickTimer = range(this.rng, 1.8, 4.8); }
  }
  tickPosture(step, posture) {
    const target = posture === "stand" ? STAND : POSTURES[posture];
    const rising = posture === "stand";
    const k = 1 - Math.exp(-(rising ? 6.5 : 3.4) * step);
    for (const key in STAND) this.pose[key] += (target[key] - this.pose[key]) * k;
    this.settle += ((rising ? 0 : 1) - this.settle) * k;
  }
  apply(s) {
    const { chassis, head, ears, legs, tailBase, tailTip } = this.parts;
    const stride = s.gait * (1 - this.settle);
    for (const leg of legs) {
      const key = leg.front ? (leg.left ? "lf" : "rf") : leg.left ? "lh" : "rh";
      const kneeSwing = leg.front ? KNEE_SWING_FRONT : KNEE_SWING_REAR;
      let hip = 0, knee = 0;
      if (s.wWalk > 0.001) { const c = legCycle(frac(this.stridePhase + FOOTFALL.walk[key]), s.duty, s.swing, kneeSwing); hip += c.hip * s.wWalk; knee += c.knee * s.wWalk; }
      if (s.wTrot > 0.001) { const c = legCycle(frac(this.stridePhase + FOOTFALL.trot[key]), s.duty, s.swing, kneeSwing); hip += c.hip * s.wTrot; knee += c.knee * s.wTrot; }
      if (s.wGallop > 0.001) { const c = legCycle(frac(this.stridePhase + FOOTFALL.gallop[key]), s.duty, s.swing, kneeSwing); hip += c.hip * s.wGallop; knee += c.knee * s.wGallop; }
      leg.hip.rotation.x = hip * stride + (leg.front ? this.pose.frontHip : this.pose.rearHip);
      leg.knee.rotation.x = knee * stride + (leg.front ? this.pose.frontKnee : this.pose.rearKnee);
    }
    const bob = stride * s.wTrot * BOB * Math.sin(TAU * 2 * this.stridePhase);
    const bound = stride * s.wGallop * BOUND * Math.sin(TAU * this.stridePhase + 0.9);
    const breath = (1 - s.gait) * BREATH * Math.sin(this.breathPhase);
    const barkEnv = this.envelope(this.barkT, BARK_TIME);
    chassis.position.y = bob + bound + breath + this.pose.chassisY + barkEnv * 0.03;
    chassis.rotation.x = s.grade + this.pose.chassisPitch + stride * s.wTrot * 0.02 * Math.sin(TAU * 2 * this.stridePhase + 0.9) + stride * s.wGallop * 0.11 * Math.sin(TAU * this.stridePhase + 1.2);
    chassis.rotation.z = stride * s.wTrot * ROLL * Math.sin(TAU * this.stridePhase);
    const shakeEnv = this.envelope(this.shakeT, SHAKE_TIME), shakeW = 26, shakeT = SHAKE_TIME - this.shakeT;
    if (shakeEnv > 0) chassis.rotation.z += shakeEnv * 0.17 * Math.sin(shakeW * shakeT - 0.7);
    head.rotation.y = this.headYaw;
    head.rotation.x = this.headPitch + this.pose.headPitch - HEAD_DIP * stride * Math.sin(TAU * 2 * this.stridePhase + 1.5) + (1 - s.gait) * 0.018 * Math.sin(this.breathPhase * 0.8) - barkEnv * 0.3;
    head.rotation.z = shakeEnv > 0 ? shakeEnv * 0.36 * Math.sin(shakeW * shakeT) : 0;
    const earPitch = -(0.62 * s.wGallop + 0.16 * s.wTrot) * stride + this.perk * 0.26 + barkEnv * 0.2 - this.settle * 0.05;
    const earFlap = shakeEnv > 0 ? shakeEnv * 0.34 * Math.sin(shakeW * shakeT + 1.4) : 0;
    for (const ear of ears) ear.rotation.x = earPitch + earFlap;
    const wag = clamp(lerp(0.16, 0.52, s.mood) + s.gait * 0.12 + this.flick * 0.3, 0, 0.9);
    tailBase.rotation.y = wag * Math.sin(this.wagPhase);
    tailBase.rotation.x = this.pose.tailPitch - 0.09 * (s.mood + this.flick * 0.5) - barkEnv * 0.1;
    tailTip.rotation.y = wag * 0.8 * Math.sin(this.wagPhase - 0.6);
    tailTip.rotation.z = wag * 0.35 * Math.sin(this.wagPhase - 1.1) + (shakeEnv > 0 ? shakeEnv * 0.3 * Math.sin(shakeW * shakeT - 1.4) : 0);
  }
  envelope(remaining, total) { return remaining <= 0 ? 0 : Math.sin(Math.PI * (1 - remaining / total)); }
}

/* ---------------- a small studio, after viewer.ts ---------------- */
export function studio(canvas, { radius = 0.8, shadow = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = shadow;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const key = new THREE.DirectionalLight(0xfff2dd, 2.5);
  key.position.set(radius * 3, radius * 4, radius * 3.5);
  key.castShadow = shadow;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -radius * 2, right: radius * 2, top: radius * 2, bottom: -radius * 2, near: 0.1, far: radius * 12 });
  key.shadow.bias = -0.0012;
  key.shadow.radius = 4;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbfd4ff, 0.7); fill.position.set(-radius * 3, radius * 1.5, radius * 2); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.4); rim.position.set(-radius * 1.5, radius * 2, -radius * 4); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0x9fb6d8, 0x3c3a34, 0.55));
  // a soft cast shadow on the paper, nothing else
  const floor = new THREE.Mesh(new THREE.CircleGeometry(radius * 4, 48).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.16 }));
  floor.receiveShadow = true;
  scene.add(floor);
  return { renderer, scene, key, floor };
}
