/* The showcase's look, ported for the live figures: the light rig, the marble,
   the granite, the green environment, the cards' bowed geometry and their flex
   shader. Her model is NOT used here; an abstract turned column stands in.

   Source: sculpture-memories/web/src (three 0.169.0, same as here)
     materials.js:11-60    fbmCanvas + marbleTexture (veins)
     materials.js:67-92    greenEnvironment
     materials.js:103-152  marbleMaterial + fresnel rim with uRimBoost
     materials.js:154-162  graniteMaterial
     materials.js:192-210  CLOTH_FLEX_VERTEX (verbatim below)
     materials.js:268-276  the card's rounded-rect mask
     cards.js:196-219      clothGeometry (shipped bow)
     main.js:35-48, 62-104 renderer, fog and lights */
import * as THREE from "three";
import { K } from "./rig.js";

export const FOG_COLOR = 0x3f5140;      // main.js:62
export const FOG_COLOR_V1 = 0x3b4e3c; // first version, main.js
export const VOID = 0x3f5140;

export function makeRenderer(canvas, { alpha = true } = {}) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha, powerPreference: "high-performance" });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping; // main.js:38
  r.toneMappingExposure = 0.82;                // main.js:48
  r.setClearColor(0x000000, 0);
  return r;
}

/* main.js:73-104 */
export function addLights(scene) {
  scene.add(new THREE.HemisphereLight(0xb4c6bd, 0x0a140c, 0.10));
  const key = new THREE.DirectionalLight(0xfbfffc, 3.7); key.position.set(3.2, 4.2, 4.0); scene.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4b2, 0.07); fill.position.set(-4.2, 1.8, 2.6); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xdff0e4, 1.0); rim.position.set(-1.6, 3.8, -4.4); scene.add(rim);
}

/* materials.js:67-92: an equirect ramp, deep green below and pale above */
export function greenEnvironment(renderer, scene) {
  const size = 256;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0.00, "#9fb99a");
  g.addColorStop(0.45, "#5c7a58");
  g.addColorStop(0.62, "#31492e");
  g.addColorStop(1.00, "#101d10");
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const env = pmrem.fromEquirectangular(tex).texture;
  scene.environment = env;
  tex.dispose(); pmrem.dispose();
  return env;
}

/* materials.js:11-52, at 256px instead of 512 so it builds in a frame */
let veinCanvas = null;
function fbmCanvas(size = 256, octaves = 5) {
  if (veinCanvas) return veinCanvas;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(size, size);
  const hash = (x, y, s) => { const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); };
  const smooth = (t) => t * t * (3 - 2 * t);
  const noise = (x, y, s) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = smooth(xf), v = smooth(yf);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let amp = 0.5, freq = 4, sum = 0;
      for (let o = 0; o < octaves; o++) { sum += noise((x / size) * freq, (y / size) * freq, o) * amp; amp *= 0.5; freq *= 2.07; }
      const vein = Math.abs(Math.sin((x / size) * 3.1 + sum * 5.5));
      const v = 0.86 + 0.14 * Math.pow(vein, 0.6);
      const i = (y * size + x) * 4;
      img.data[i] = 255 * v; img.data[i + 1] = 255 * (v * 0.998); img.data[i + 2] = 255 * (v * 0.986); img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  veinCanvas = cv;
  return cv;
}

/* materials.js:106-152. rimBoost is a shared { value } the figure eases. */
export function marbleMaterial(rimBoost = { value: 1 }) {
  const map = new THREE.CanvasTexture(fbmCanvas());
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2.2, 2.2);
  map.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xe2ebea, map, roughness: 0.58, metalness: 0.0,
    clearcoat: 0.18, clearcoatRoughness: 0.55,
    sheen: 0.35, sheenColor: new THREE.Color(0xc8dccd), sheenRoughness: 0.8,
    envMapIntensity: 0.28,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRimBoost = rimBoost;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uRimBoost;")
      .replace("#include <dithering_fragment>", `#include <dithering_fragment>
        float fres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.6);
        gl_FragColor.rgb += vec3(0.070, 0.075, 0.075) * uRimBoost * fres;`);
  };
  return mat;
}

/* materials.js:154-162 */
export const graniteMaterial = () => new THREE.MeshStandardMaterial({ color: 0x2b302c, roughness: 0.97, metalness: 0, flatShading: true, envMapIntensity: 0.35 });

/* Abstract stand-in for her: a turned column, 2m tall, feet at y=0, about as
   wide as the code says she is (~0.35m). Not her shape, on purpose. */
export function columnGeometry() {
  const prof = [
    [0.00, 0.00], [0.15, 0.00], [0.16, 0.06], [0.14, 0.30], [0.15, 0.70], [0.175, 0.95],
    [0.15, 1.18], [0.18, 1.44], [0.16, 1.56], [0.07, 1.64], [0.065, 1.70], [0.105, 1.78],
    [0.11, 1.87], [0.085, 1.96], [0.03, 2.00], [0.00, 2.00],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const curve = new THREE.SplineCurve(prof);
  const pts = curve.getPoints(90);
  pts[0].set(0, 0); pts[pts.length - 1].set(0, 2.0);
  return new THREE.LatheGeometry(pts, 56);
}

/* A rock under her feet, wholly below y = 0 and about 1.75m across, as in the
   source (cards.js:45-49). Built here from a noised icosahedron, flat shaded. */
export function rockGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 3);
  const p = g.attributes.position, v = new THREE.Vector3();
  const h = (x, y, z) => { const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return n - Math.floor(n); };
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 0.5 * h(Math.round(v.x * 4), Math.round(v.y * 4), Math.round(v.z * 4)) + 0.5 * h(Math.round(v.x * 9), Math.round(v.y * 9), Math.round(v.z * 9));
    v.multiplyScalar(1 + (n - 0.5) * 0.22);
    v.x *= 0.92; v.z *= 0.82; v.y *= 0.66;
    if (v.y > 0.5) v.y = 0.5 + (v.y - 0.5) * 0.25; // a flattish top to stand on
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  g.translate(0, -0.56, 0);
  return g;
}

export function addFigure(scene, rimBoost) {
  const fig = new THREE.Mesh(columnGeometry(), marbleMaterial(rimBoost));
  const rock = new THREE.Mesh(rockGeometry(), graniteMaterial());
  scene.add(fig, rock);
  return { fig, rock };
}

/* cards.js:197-219: a plane bowed to hang on the spiral, with slack */
export function clothGeometry(w = K.W, h = K.H, radius = K.R_TIGHT) {
  const g = new THREE.PlaneGeometry(w, h, 28, 14);
  const p = g.attributes.position;
  const r = radius * K.BEND_SLACK;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const arc = -(r - Math.sqrt(Math.max(r * r - x * x, 0)));
    const belly = Math.cos((y / h) * Math.PI) * K.SAG;
    p.setZ(i, arc + belly);
  }
  g.computeVertexNormals();
  return g;
}
/* first version, cards.js: the card bent to the exact arc of the 1.8m helix */
export function clothGeometryV1(w = K.W, h = K.H, radius = 1.8) {
  const g = new THREE.PlaneGeometry(w, h, 24, 12);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, radius - Math.sqrt(Math.max(radius * radius - x * x, 0))); }
  g.computeVertexNormals();
  return g;
}

/* A blank card with its number, standing in for a memory. */
export function cardTexture(n, renderer) {
  const cv = document.createElement("canvas");
  cv.width = 512; cv.height = 288;
  const c = cv.getContext("2d");
  c.fillStyle = "#f1efe8"; c.fillRect(0, 0, 512, 288);
  c.strokeStyle = "rgba(29,27,24,0.5)"; c.lineWidth = 5; c.strokeRect(2.5, 2.5, 507, 283);
  c.strokeStyle = "rgba(29,27,24,0.16)"; c.lineWidth = 2; c.strokeRect(20, 20, 472, 248);
  c.fillStyle = "#1d1b18";
  c.font = '400 150px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';
  c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText(String(n), 256, 152);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  if (renderer) t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}

/* materials.js:192-210, verbatim */
export const CLOTH_FLEX_VERTEX = `
  uniform float uFlex;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float nx = uv.x - 0.5;
    float ny = uv.y - 0.5;
    // flexible card, not stiff signage: bows along the travel axis while
    // moving (velocity-signed), with a slight corner twist, and settles
    // flat when the scroll rests. Amplitudes kept small on purpose.
    p.z += uFlex * (nx * nx * 4.0 - 0.5) * 0.20;
    p.z += uFlex * nx * ny * 0.34;
    p.z += sin(uv.x * 6.2832 + uTime * 1.4 + uv.y * 2.2)
           * 0.014 * (0.25 + abs(uFlex));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

/* The card's fragment: its rounded-rect mask and world-green tint from
   materials.js:257-276. The photo treatment (desaturate, lift, contrast) is
   left out because these cards have no photo on them. */
export function cardMaterial(map, shared) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: true, side: THREE.DoubleSide,
    uniforms: {
      uMap: { value: map },
      uAlpha: { value: 1 },
      uTint: { value: new THREE.Color(0x9fb79a) },
      uTintAmt: { value: 0.13 },
      uRadius: { value: 0.045 },
      uAspect: { value: 16 / 9 },
      uFlex: shared.uFlex,
      uTime: shared.uTime,
    },
    vertexShader: CLOTH_FLEX_VERTEX,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform float uAlpha;
      uniform vec3 uTint;
      uniform float uTintAmt;
      uniform float uRadius;
      uniform float uAspect;
      varying vec2 vUv;
      void main() {
        vec4 tex = texture2D(uMap, vUv);
        float luma = dot(tex.rgb, vec3(0.2126, 0.7152, 0.0722));
        vec3 col = mix(tex.rgb, uTint * (0.35 + luma * 0.9), uTintAmt);
        vec2 pnt = (vUv - 0.5) * vec2(uAspect, 1.0);
        vec2 half_ = vec2(0.5 * uAspect, 0.5) - uRadius;
        vec2 q = abs(pnt) - half_;
        float sdf = length(max(q, 0.0)) - uRadius;
        float edge = 1.0 - smoothstep(-0.004, 0.0, sdf);
        gl_FragColor = vec4(col, edge * uAlpha);
        if (gl_FragColor.a < 0.004) discard;
        #include <colorspace_fragment>
      }
    `,
  });
}

export const capDpr = () => Math.min(window.devicePixelRatio || 1, 2);
