/* Cohort case study: the live figures.

   Everything here is ported from trycohort.xyz, the static site in
   /Users/user/Downloads/Cohort (index.html, css/main.css, js/main.js).
   The constants are the site's own and each block cites file:line.

   The site tweens with GSAP 3.12.5. Here a small tween with GSAP's own ease
   formulas stands in (GSAP's power3 is a quartic, power2 a cubic), so the
   curves the figures plot are exactly the ones the site runs, and the page
   makes no network calls. canvas-confetti 1.9.0 is ported the same way. */

const Study = window.Study;
const R = Study.reduce;
const DPR = Math.min(2, window.devicePixelRatio || 1);
const html = document.documentElement;
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now = () => performance.now();
const num = (v, d = 1) => {
  const s = Number(v).toFixed(d);
  return s.startsWith('-') && Number(s) !== 0 ? '−' + s.slice(1) : s.replace('-', '');
};
const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, parent, text) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (text != null) n.textContent = text;
  if (parent) parent.appendChild(n);
  return n;
};
/* size an SVG's viewBox to its real width, so 11px text stays 11px on a phone */
const fit = (s, h, max = Infinity) => {
  const w = Math.max(240, Math.min(max, Math.round(s.parentElement.clientWidth || s.clientWidth || 300)));
  s.setAttribute('viewBox', `0 0 ${w} ${h}`);
  s.setAttribute('width', w);
  s.setAttribute('height', h);
  s.replaceChildren();
  return w;
};
const onResize = (fn) => { let t = 0; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(fn, 120); }); };

/* ---------- easing: GSAP 3's formulas ---------- */
const Ease = {
  none: (p) => p,
  'power1.out': (p) => 1 - (1 - p) ** 2,
  'power2.in': (p) => p ** 3,
  'power2.out': (p) => 1 - (1 - p) ** 3,
  'power2.inOut': (p) => (p < 0.5 ? (2 * p) ** 3 / 2 : 1 - (2 * (1 - p)) ** 3 / 2),
  'power3.in': (p) => p ** 4,
  'power3.out': (p) => 1 - (1 - p) ** 4,
  'power3.inOut': (p) => (p < 0.5 ? (2 * p) ** 4 / 2 : 1 - (2 * (1 - p)) ** 4 / 2),
};
const backOut = (s) => (p) => (p ? (p - 1) * (p - 1) * ((s + 1) * (p - 1) + s) + 1 : 0);
const elasticOut = (a = 1, per = 0.5) => {
  const s = (per / (2 * Math.PI)) * (Math.asin(1 / a) || 0);
  return (p) => (p === 0 || p === 1 ? p : a * 2 ** (-10 * p) * Math.sin(((p - s) * 2 * Math.PI) / per) + 1);
};

/* one tween: update(easedProgress, rawProgress) every frame for dur seconds */
function tween({ dur, delay = 0, ease = Ease.none, update, done }) {
  let dead = false;
  const start = now() + delay * 1000;
  Study.raf(() => {
    if (dead) return false;
    const t = now();
    if (t < start) return;
    const p = dur > 0 ? clamp((t - start) / (dur * 1000), 0, 1) : 1;
    update(ease(p), p);
    if (p >= 1) { dead = true; done && done(); return false; }
  });
  return { kill() { dead = true; } };
}

/* gsap.to on transform and opacity, with overwrite: a new tween takes over from wherever the old one was */
const ST = new WeakMap();
const state = (n) => {
  let s = ST.get(n);
  if (!s) { s = { x: 0, y: 0, r: 0, s: 1, o: 1, tw: null }; ST.set(n, s); }
  return s;
};
const paint = (n) => {
  const s = state(n);
  n.style.transform = `translate3d(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px, 0) rotate(${s.r.toFixed(2)}deg) scale(${s.s.toFixed(4)})`;
  n.style.opacity = String(clamp(s.o, 0, 1));
};
const put = (n, props) => { Object.assign(state(n), props); paint(n); };
function to(n, props, { dur = 0.5, delay = 0, ease = Ease['power2.out'], done } = {}) {
  const s = state(n);
  if (s.tw) s.tw.kill();
  let from = null;
  s.tw = tween({
    dur: R ? 0 : dur, delay: R ? 0 : delay, ease,
    update(e) {
      if (!from) { from = {}; for (const k in props) from[k] = s[k]; }
      for (const k in props) s[k] = from[k] + (props[k] - from[k]) * e;
      paint(n);
    },
    done,
  });
  return s.tw;
}
/* gsap.quickTo: every set() restarts a tween from the current value to the new target */
function quick(dur, ease, v0 = 0) {
  let from = v0, target = v0, t0 = -1e9;
  const api = {
    get() { const p = clamp((now() - t0) / (dur * 1000), 0, 1); return from + (target - from) * ease(p); },
    set(v) { from = api.get(); target = v; t0 = now(); },
    snap(v) { from = target = v; t0 = -1e9; },
    get done() { return now() - t0 >= dur * 1000; },
  };
  return api;
}
/* a node's centre in another node's coordinates, plus its viewport centre */
const rel = (node, layer) => {
  const a = node.getBoundingClientRect(), b = layer.getBoundingClientRect();
  return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2, w: a.width, h: a.height, vx: a.left + a.width / 2, vy: a.top + a.height / 2, top: a.top - b.top, left: a.left - b.left };
};
const lastPointer = { type: 'mouse', t: 0 };
addEventListener('pointerdown', (e) => { lastPointer.type = e.pointerType; lastPointer.t = now(); }, true);
const mouseClick = () => lastPointer.type === 'mouse' && now() - lastPointer.t < 800;

/* ============================================================
   SOUND. main.js:23-162 and 2270-2274. Each sound is written as a
   score, the exact calls the site makes, so Fig. 9 can draw it.
   Nothing plays until the reader has clicked something.
   ============================================================ */
const T = (f, start, dur, vol, type = 'sine') => ({ kind: 'tone', f, start, dur, vol, type });
const switchScore = (on) => {
  const out = [
    { kind: 'snap', start: 0, dur: 0.028, f: 1900, q: 0.6, vol: on ? 0.85 : 0.7 },
    { kind: 'thud', start: 0.004, dur: 0.05, f: on ? 95 : 75, vol: 0.18 },
  ];
  if (on) out.push({ kind: 'hum', start: 0.02, peak: 0.05, end: 0.22, dur: 0.2, f: 120, vol: 0.032 });
  return out;
};
const SCORES = {
  hover: () => [T(900, 0, 0.04, 0.028)],
  pop: () => [T(780, 0, 0.09, 0.09), T(1020, 0.06, 0.08, 0.06)],
  tick: () => [T(680, 0, 0.07, 0.07), T(500, 0.05, 0.07, 0.05)],
  party: () => [[523, 0], [659, 0.08], [784, 0.16], [1047, 0.25]].map(([f, s]) => T(f, s, 0.22, 0.09)),
  heaven: () => {
    const out = [];
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => {
      out.push(T(f, i * 0.08, 1.2, 0.045));
      out.push(T(f * 2, i * 0.08 + 0.03, 0.9, 0.016));
    });
    out.push(T(1567.98, 0.42, 1.1, 0.02));
    return out;
  },
  key: () => [
    { kind: 'click', start: 0, dur: 0.022 + Math.random() * 0.012, f: 2400 + Math.random() * 1400, q: 0.7, vol: 0.16, rate: 0.9 + Math.random() * 0.5 },
    T(95 + Math.random() * 45, 0, 0.05, 0.05),
  ],
  on: () => switchScore(true),
  off: () => switchScore(false),
  joined: () => [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.32], [1319, 0.46]].map(([f, s]) => T(f, s, 0.55, 0.06)),
};
const Sound = {
  ctx: null,
  on: true,
  unlock() {
    if (!this.on) return false;
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return true;
  },
  /* gesture: called from the reader's own click, so it may start the audio */
  play(name, gesture = false) {
    const score = SCORES[name]();
    if (gesture) this.unlock();
    const ok = this.on && this.ctx && (gesture || this.ctx.state === 'running');
    if (ok) { try { this.perform(score); } catch (e) { /* audio is decoration */ } }
    return score;
  },
  _noise: null,
  perform(score) {
    const ctx = this.ctx, t0 = ctx.currentTime, sr = ctx.sampleRate;
    const out = ctx.destination;
    score.forEach((ev) => {
      const t = t0 + ev.start;
      if (ev.kind === 'tone') { // main.js:35-46
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(out);
        o.type = ev.type; o.frequency.value = ev.f;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(ev.vol, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + ev.dur);
        o.start(t); o.stop(t + ev.dur + 0.01);
      } else if (ev.kind === 'click') { // main.js:124-146
        if (!this._noise) {
          const len = Math.floor(sr * 0.05);
          this._noise = ctx.createBuffer(1, len, sr);
          const d = this._noise.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        }
        const src = ctx.createBufferSource(); src.buffer = this._noise; src.playbackRate.value = ev.rate;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ev.f; bp.Q.value = ev.q;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(ev.vol, t + 0.001); g.gain.exponentialRampToValueAtTime(0.0004, t + ev.dur);
        src.connect(bp); bp.connect(g); g.connect(out); src.start(t); src.stop(t + ev.dur + 0.01);
      } else if (ev.kind === 'snap') { // main.js:62-79
        const len = Math.floor(sr * 0.028);
        const b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.07));
        const src = ctx.createBufferSource(); src.buffer = b;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ev.f; bp.Q.value = ev.q;
        const g = ctx.createGain(); g.gain.setValueAtTime(ev.vol, t);
        src.connect(bp); bp.connect(g); g.connect(out); src.start(t); src.stop(t + 0.03);
      } else if (ev.kind === 'thud') { // main.js:82-95
        const len = Math.floor(sr * 0.05);
        const b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.sin((2 * Math.PI * ev.f * i) / sr) * Math.exp(-i / (len * 0.2));
        const src = ctx.createBufferSource(); src.buffer = b;
        const g = ctx.createGain(); g.gain.setValueAtTime(ev.vol, t);
        src.connect(g); g.connect(out); src.start(t); src.stop(t + 0.056);
      } else if (ev.kind === 'hum') { // main.js:97-108
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = ev.f;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(ev.vol, t0 + ev.peak);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + ev.end);
        o.connect(g); g.connect(out); o.start(t); o.stop(t0 + ev.end + 0.01);
      }
    });
  },
};
function initSoundToggles() {
  const btns = $$('[data-sound]');
  const sync = () => btns.forEach((b) => { b.setAttribute('aria-pressed', String(Sound.on)); b.textContent = Sound.on ? 'Sound on' : 'Sound off'; });
  btns.forEach((b) => b.addEventListener('click', () => { Sound.on = !Sound.on; if (Sound.on) Sound.unlock(); else if (Sound.ctx) Sound.ctx.suspend().catch(() => {}); sync(); }));
  sync();
}

/* ============================================================
   TIME OF DAY. main.js:1073-1198. This page starts at "day" and
   doesn't remember a choice; the site keeps it in localStorage.
   ============================================================ */
const VIBES = ['morning', 'day', 'evening', 'night'];
const VIBE_BG = { morning: '#E0C0A0', day: '#EDE8DC', evening: '#1C0A02', night: '#090909' }; // main.js:1137
const VIBE_FG = { morning: '#2A1508', day: '#1A1A14', evening: '#F0C87A', night: '#F0EDE8' }; // main.css:59-160
const vibeFromHour = (h) => (h >= 5 && h < 10 ? 'morning' : h >= 10 && h < 17 ? 'day' : h >= 17 && h < 21 ? 'evening' : 'night'); // main.js:1092-1097
const vibe = () => html.dataset.vibe || 'day';
function setVibe(v) {
  if (!VIBES.includes(v)) return;
  html.dataset.vibe = v;
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', VIBE_BG[v]);
  document.dispatchEvent(new CustomEvent('cohort:vibe', { detail: v }));
}
const nextVibe = () => setVibe(VIBES[(VIBES.indexOf(vibe()) + 1) % VIBES.length]); // main.js:1152-1155

/* ============================================================
   CONFETTI. A small port of canvas-confetti 1.9.0's particle step,
   which the site loads from jsDelivr. Same options, same physics.
   ============================================================ */
const Confetti = (() => {
  let cv = null, ctx = null, parts = [], running = false;
  const hex = (c) => { const h = c.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  const size = () => { if (!cv) return; cv.width = innerWidth * DPR; cv.height = innerHeight * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); };
  function fire(o) {
    if (R) return;
    if (!cv) {
      cv = document.createElement('canvas');
      cv.className = 'confetti-cv';
      cv.setAttribute('aria-hidden', 'true');
      document.body.appendChild(cv);
      ctx = cv.getContext('2d');
      size();
      addEventListener('resize', size);
    }
    const { particleCount = 50, angle = 90, spread = 45, startVelocity = 45, decay = 0.9, gravity = 1, drift = 0, ticks = 200, origin = { x: 0.5, y: 0.5 }, colors = ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff'], scalar = 1 } = o;
    const rad = (angle * Math.PI) / 180, rs = (spread * Math.PI) / 180;
    for (let i = 0; i < particleCount; i++) {
      parts.push({
        x: origin.x * innerWidth, y: origin.y * innerHeight,
        wobble: Math.random() * 10, wobbleSpeed: Math.min(0.11, Math.random() * 0.1 + 0.05),
        velocity: startVelocity * 0.5 + Math.random() * startVelocity,
        angle2D: -rad + (0.5 * rs - Math.random() * rs),
        tiltAngle: (Math.random() * (0.75 - 0.25) + 0.25) * Math.PI,
        color: hex(colors[i % colors.length]), shape: Math.random() < 0.5 ? 'square' : 'circle',
        tick: 0, totalTicks: ticks, decay, drift, gravity: gravity * 3, scalar, ovalScalar: 0.6,
        random: Math.random() + 2, tiltSin: 0, tiltCos: 0, wobbleX: 0, wobbleY: 0,
      });
    }
    if (running) return;
    running = true;
    let acc = 0;
    Study.raf((t, dt) => {
      acc += dt;
      let steps = 0;
      while (acc >= 1 / 60 && steps < 4) { acc -= 1 / 60; steps++; parts = parts.filter(stepOne); }
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts.forEach(drawOne);
      if (!parts.length) { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); return false; }
    });
  }
  function stepOne(f) {
    f.x += Math.cos(f.angle2D) * f.velocity + f.drift;
    f.y += Math.sin(f.angle2D) * f.velocity + f.gravity;
    f.velocity *= f.decay;
    f.wobble += f.wobbleSpeed;
    f.wobbleX = f.x + 10 * f.scalar * Math.cos(f.wobble);
    f.wobbleY = f.y + 10 * f.scalar * Math.sin(f.wobble);
    f.tiltAngle += 0.1;
    f.tiltSin = Math.sin(f.tiltAngle);
    f.tiltCos = Math.cos(f.tiltAngle);
    f.random = Math.random() + 2;
    f.tick++;
    return f.tick < f.totalTicks;
  }
  function drawOne(f) {
    const progress = f.tick / f.totalTicks;
    const x1 = f.x + f.random * f.tiltCos, y1 = f.y + f.random * f.tiltSin;
    const x2 = f.wobbleX + f.random * f.tiltCos, y2 = f.wobbleY + f.random * f.tiltSin;
    ctx.fillStyle = `rgba(${f.color[0]}, ${f.color[1]}, ${f.color[2]}, ${1 - progress})`;
    ctx.beginPath();
    if (f.shape === 'circle') {
      ctx.ellipse(f.x, f.y, Math.abs(x2 - x1) * f.ovalScalar, Math.abs(y2 - y1) * f.ovalScalar, (Math.PI / 10) * f.wobble, 0, 2 * Math.PI);
    } else {
      ctx.moveTo(Math.floor(f.x), Math.floor(f.y));
      ctx.lineTo(Math.floor(f.wobbleX), Math.floor(y1));
      ctx.lineTo(Math.floor(x2), Math.floor(y2));
      ctx.lineTo(Math.floor(x1), Math.floor(f.wobbleY));
    }
    ctx.closePath();
    ctx.fill();
  }
  return { fire };
})();
const RAINBOW = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF6BFF', '#FFB347', '#C084FC']; // main.js:205
const atNode = (n) => { const r = n.getBoundingClientRect(); return { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight }; };

/* ============================================================
   FIG. 1: THE BURN. main.js:1987-2150 (shader) and 2152-2171 (tilt).
   Two additions, both off by default: uEdge (the site hard-codes
   0.055) and uNoise, which draws the noise field instead of the phone.
   ============================================================ */
const VS = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 1.0 - (aPos.y * 0.5 + 0.5));
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;
const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uTex;
uniform float uProg;
uniform float uEdge;
uniform float uNoise;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) { v += a * noise(p); p *= 2.1; a *= 0.48; }
  return v;
}
void main() {
  vec4 color = texture2D(uTex, vUv);
  float bias = vUv.y * 0.30;
  float n = fbm(vUv * 4.4 + vec2(0.5, 1.3)) - bias;
  float prog = clamp(uProg, -0.35, 1.2);
  float edge = uEdge;
  if (uNoise > 0.5) {
    if (color.a < 0.01) discard;
    float g = clamp(0.12 + n * 0.85, 0.0, 1.0);
    vec3 c = n > prog ? vec3(g) : vec3(g) * 0.42;
    if (n <= prog && n > prog - edge) {
      float t = (prog - n) / edge;
      c = mix(vec3(1.00, 0.90, 0.55), vec3(0.92, 0.30, 0.04), smoothstep(0.0, 1.0, t));
    }
    gl_FragColor = vec4(c, color.a);
    return;
  }
  if (n > prog) {
    discard;
  } else if (n > prog - edge) {
    float t = (prog - n) / edge;
    vec3 ember = mix(vec3(1.00, 0.90, 0.55), vec3(0.92, 0.30, 0.04), smoothstep(0.0, 1.0, t));
    float glow = smoothstep(0.0, 0.45, t) * (1.0 - smoothstep(0.45, 1.0, t));
    gl_FragColor = mix(color, vec4(ember, 1.0), glow * 0.78);
    gl_FragColor.a = color.a;
  } else {
    gl_FragColor = color;
  }
}`;

function initBurn() {
  const fig = $('#burn');
  if (!fig) return;
  const stage = $('.burn-stage', fig), cv = $('.burn-gl', fig), still = $('.burn-still', fig);
  const progIn = $('[data-burn-prog]', fig), edgeIn = $('[data-burn-edge]', fig);
  const progOut = $('[data-burn-prog-out]', fig), edgeOut = $('[data-burn-edge-out]', fig);
  const noiseBtn = $('[data-burn-noise]', fig), replayBtn = $('[data-burn-replay]', fig);
  const rd = (k) => $(`[data-burn-r="${k}"]`, fig);
  const P0 = -0.35, P1 = 1.15; // main.js:2108, 2137
  let prog = P0, target = P1, edge = 0.055, noise = false, auto = false, looping = false, visible = false, started = false;
  let gl = null, U = {};

  const ui = () => {
    progIn.value = String(Math.round(((prog - P0) / (P1 - P0)) * 1000));
    progOut.textContent = num(prog, 2);
    rd('prog').textContent = num(prog, 2);
    edgeOut.textContent = edge.toFixed(3);
    rd('edge').textContent = edge.toFixed(3);
  };
  const fail = () => {
    gl = null;
    cv.hidden = true;
    still.hidden = false;
    [progIn, edgeIn, noiseBtn, replayBtn].forEach((n) => { n.disabled = true; });
    rd('prog').textContent = '1.15 (no WebGL here, so this is a still)';
  };
  const size = () => {
    const w = cv.getBoundingClientRect().width;
    if (!w) return;
    const W = Math.round(w * DPR), H = Math.round(((w * 1687) / 1400) * DPR);
    if (W !== cv.width || H !== cv.height) { cv.width = W; cv.height = H; }
  };
  const draw = () => {
    if (!gl) return;
    gl.viewport(0, 0, cv.width, cv.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(U.prog, prog);
    gl.uniform1f(U.edge, edge);
    gl.uniform1f(U.noise, noise ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  function setup(img) {
    try {
      gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: false }) || cv.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false });
    } catch (e) { gl = null; }
    if (!gl) return fail();
    const mk = (type, src) => { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); return sh; };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return fail();
    gl.useProgram(p);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(p, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.uniform1i(gl.getUniformLocation(p, 'uTex'), 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    U = { prog: gl.getUniformLocation(p, 'uProg'), edge: gl.getUniformLocation(p, 'uEdge'), noise: gl.getUniformLocation(p, 'uNoise') };
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fail(); });
    size();
  }
  /* main.js:2121-2132: close 1.6% of the gap every frame. Here one 0.016 step per 60th of a second. */
  function loop() {
    if (looping) return;
    looping = true;
    Study.raf((t, dt) => {
      if (!auto || !visible) { looping = false; return false; }
      const d = target - prog;
      if (Math.abs(d) > 0.0004) prog += d * (1 - (1 - 0.016) ** (dt * 60));
      else { prog = target; auto = false; }
      ui();
      draw();
    });
  }
  const play = () => { prog = P0; target = P1; auto = true; ui(); draw(); loop(); };

  Study.onVisible(fig, () => {
    visible = true;
    if (!started) {
      started = true;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        setup(img);
        if (!gl) return;
        if (R) { prog = P1; ui(); draw(); } else play();
      };
      img.onerror = fail;
      img.src = 'media/cohort/phone.webp';
    } else if (auto) loop();
  }, () => { visible = false; }, '0px');

  progIn.addEventListener('input', () => { auto = false; prog = P0 + (progIn.value / 1000) * (P1 - P0); ui(); draw(); });
  edgeIn.addEventListener('input', () => { edge = Math.max(0.001, edgeIn.value / 1000); ui(); draw(); });
  noiseBtn.addEventListener('click', () => {
    noise = !noise;
    noiseBtn.setAttribute('aria-pressed', String(noise));
    noiseBtn.textContent = noise ? 'Show the phone' : 'Show the noise';
    draw();
  });
  replayBtn.addEventListener('click', play);
  onResize(() => { size(); draw(); });

  /* main.js:2159-2170: rotateY dx × 9, rotateX −dy × 5, quickTo 1.1s power3.out, perspective 900px */
  const rx = quick(1.1, Ease['power3.out']), ry = quick(1.1, Ease['power3.out']);
  let tilting = false;
  const tiltLoop = () => {
    if (tilting) return;
    tilting = true;
    Study.raf(() => {
      const a = rx.get(), b = ry.get();
      const tf = `rotateX(${a.toFixed(3)}deg) rotateY(${b.toFixed(3)}deg)`;
      cv.style.transform = tf;
      still.style.transform = tf;
      rd('rx').textContent = num(a, 1) + '°';
      rd('ry').textContent = num(b, 1) + '°';
      if (rx.done && ry.done) { tilting = false; return false; }
    });
  };
  if (!R) {
    stage.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const b = stage.getBoundingClientRect();
      const dx = ((e.clientX - b.left) / b.width - 0.5) * 2, dy = ((e.clientY - b.top) / b.height - 0.5) * 2;
      ry.set(dx * 9);
      rx.set(-dy * 5);
      tiltLoop();
    });
    stage.addEventListener('pointerleave', () => { rx.set(0); ry.set(0); tiltLoop(); });
  }
  ui();
}

/* ============================================================
   FIG. 2: TEN CHAPTERS. The brief's chapters
   (Cohort/cohort-website-build-brief.md, section 7) against the
   four paragraphs in Cohort/index.html:180-260.
   ============================================================ */
function initChapters() {
  const s = $('.chapters-scrolly');
  if (!s) return;
  const fig = $('.ch-fig', s);
  const steps = $$('.step', s);
  const FATE = [
    'kept, as the first sentence',
    'half kept',
    'folded into one chip',
    'kept as 2 words',
    'kept, nearly word for word',
    'kept as one clause',
    'kept as a ticker and 2 chips',
    'cut',
    'kept as a chip',
    'kept, with a blank to fill',
  ];
  const marks = $$('.ch-index li', fig);
  const parts = $$('[data-ch]', fig);
  const apply = (i) => {
    const k = String(i + 1);
    parts.forEach((n) => {
      const on = n.dataset.ch.split(' ').includes(k);
      if (n.classList.contains('ch-x')) n.classList.toggle('show', on);
      else n.classList.toggle('lit', on);
    });
    marks.forEach((m, j) => { m.classList.toggle('is-on', j === i); m.classList.toggle('is-past', j < i); });
    $('[data-ch-name]', fig).textContent = steps[i] ? $('h3', steps[i]).textContent : '';
    $('[data-ch-fate]', fig).textContent = FATE[i] || '';
  };
  s.addEventListener('step', (e) => apply(e.detail.index));
  apply(Number(s.dataset.step || 0));
}

/* ============================================================
   FIG. 3: THE LAMP. main.js:1200-1394 (pendulum), 1458-1480 and
   1577-1589 (sparks), 1073-1198 (the four times of day).
   ============================================================ */
function initLamp() {
  const fig = $('#lamp-fig');
  if (!fig) return;
  const el = $('.lamp-svg', fig), cord = $('.lp-cord', fig), ball = $('.lp-ball', fig), ring = $('.lp-ring', fig), shade = $('.lp-shade', fig);
  const burstCv = $('.lamp-burst', fig), bctx = burstCv.getContext('2d');
  const plot = $('.swing-svg', fig);
  const rd = (k) => $(`[data-lamp-r="${k}"]`, fig);

  const VB = { w: 80, h: 160 }; // the site's viewBox is 80 × 190; the bottom 30 units are empty, so this one stops at 160
  const PIVOT = { x: 40, y: 59 };
  const L = 45, GRAV = 220, DAMP = 0.984, DT = 1 / 60, MAX_DOWN = 40, TRIG_DOWN = 26;
  const W0 = Math.sqrt(GRAV / L);
  let angle = 0, angVel = 0, pullY = 0, dragging = false, idleT = Math.random() * Math.PI * 2, hoverNear = false, lit = false;
  const N = 480; // 8 seconds of 60 steps
  const hist = new Float32Array(N);
  let head = 0, steps = 0, release = null, bursts = [], acc = 0, running = false, visible = false, swung = false;

  const ballSVG = (a, py) => ({ x: PIVOT.x + Math.sin(a) * L, y: PIVOT.y + Math.cos(a) * L + py });
  const toSVG = (e) => { const r = el.getBoundingClientRect(); return { x: (e.clientX - r.left) * (VB.w / r.width), y: (e.clientY - r.top) * (VB.h / r.height) }; };
  const ballInBurst = () => {
    const r = el.getBoundingClientRect(), c = burstCv.getBoundingClientRect(), b = ballSVG(angle, pullY);
    return { x: r.left - c.left + (b.x / VB.w) * r.width, y: r.top - c.top + (b.y / VB.h) * r.height };
  };
  const markRelease = () => { release = { k: steps, a0: Math.sqrt(angle * angle + (angVel / W0) ** 2) }; };

  function render() { // main.js:1252-1284
    const b = ballSVG(angle, pullY);
    const bowX = -angVel * 16, bowY = pullY * 0.45;
    const cx = PIVOT.x + Math.sin(angle * 0.5) * L * 0.5 + bowX;
    const cy = PIVOT.y + Math.cos(angle * 0.5) * L * 0.5 + bowY;
    cord.setAttribute('d', `M ${PIVOT.x} ${PIVOT.y} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`);
    ball.setAttribute('cx', b.x.toFixed(1));
    ball.setAttribute('cy', b.y.toFixed(1));
    ring.setAttribute('cx', b.x.toFixed(1));
    ring.setAttribute('cy', b.y.toFixed(1));
    const speed = Math.abs(angVel);
    ring.setAttribute('r', (9 + speed * 8).toFixed(1));
    ring.setAttribute('opacity', (Math.min(0.5, speed * 0.5) * (hoverNear ? 1 : 0)).toFixed(2));
    shade.setAttribute('transform', `rotate(${(angle * (180 / Math.PI) * 0.18).toFixed(2)}, ${PIVOT.x}, ${PIVOT.y})`);
  }
  function step() { // main.js:1286-1302
    if (!dragging) {
      angVel += -(GRAV / L) * Math.sin(angle) * DT;
      angVel *= DAMP;
      angle += angVel * DT;
      if (!R && Math.abs(angVel) < 0.006 && Math.abs(angle) < 0.015) {
        idleT += DT * 0.22;
        angle = Math.sin(idleT) * 0.032;
      }
      pullY *= 0.88;
      if (Math.abs(pullY) < 0.1) pullY = 0;
    }
    hist[head] = angle;
    head = (head + 1) % N;
    steps++;
    for (let i = bursts.length - 1; i >= 0; i--) { // main.js:1577-1589
      const p = bursts[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life -= p.decay;
      if (p.life <= 0) bursts.splice(i, 1);
    }
  }
  function burst(bx, by) { // main.js:1459-1480: the colours are the time of day being left
    const colors = {
      night: ['#ffffff', '#d0d8ff', '#a0b0ff'],
      morning: ['#FFE8A0', '#FFCA60', '#FFF0C0'],
      day: ['#FFF8D0', '#E8F0FF', '#ffffff'],
      evening: ['#FF9A3C', '#FF6010', '#FFB870'],
    };
    const pool = colors[vibe()] || colors.night;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 + Math.random() * 0.4;
      const s = Math.random() * 3.5 + 1.2;
      bursts.push({ x: bx, y: by, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.8, r: Math.random() * 2.2 + 0.7, life: 1, decay: 0.018 + Math.random() * 0.014, color: pool[Math.floor(Math.random() * pool.length)] });
    }
  }
  let burstDirty = false;
  function drawBursts() {
    if (!bursts.length && !burstDirty) return;
    const w = burstCv.clientWidth, h = burstCv.clientHeight;
    if (burstCv.width !== Math.round(w * DPR)) { burstCv.width = Math.round(w * DPR); burstCv.height = Math.round(h * DPR); }
    bctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    bctx.clearRect(0, 0, w, h);
    bursts.forEach((p) => {
      bctx.beginPath();
      bctx.arc(p.x, p.y, Math.max(0, p.r * p.life), 0, Math.PI * 2);
      bctx.fillStyle = p.color + Math.round(clamp(p.life, 0, 1) * 220).toString(16).padStart(2, '0');
      bctx.fill();
    });
    burstDirty = bursts.length > 0;
  }

  /* the plot: θ over the last 8 seconds, and the decay envelope since the last release */
  let PW = 560;
  const PH = 200, Y0 = 100, SC = 86 / 60; // ±60° fills the height
  let line, env, dot;
  const yOf = (rad) => Y0 - clamp((rad * 180) / Math.PI, -66, 66) * SC;
  function buildPlot() {
    PW = fit(plot, PH, 600);
    const g = svg('g', {}, plot);
    [-60, -30, 0, 30, 60].forEach((d) => {
      svg('line', { x1: 34, x2: PW - 8, y1: Y0 - d * SC, y2: Y0 - d * SC, class: d === 0 ? 'dg-axis' : 'dg-grid' }, g);
      svg('text', { x: 28, y: Y0 - d * SC + 4, 'text-anchor': 'end', class: 'dg-t' }, g, (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d) + '°');
    });
    [8, 6, 4, 2, 0].forEach((s) => {
      const x = 34 + ((8 - s) / 8) * (PW - 42);
      svg('text', { x, y: PH - 2, 'text-anchor': s === 0 ? 'end' : s === 8 ? 'start' : 'middle', class: 'dg-t' }, g, s === 0 ? 'now' : `−${s}s`);
    });
    env = svg('path', { class: 'swing-env' }, plot);
    line = svg('path', { class: 'swing-line' }, plot);
    dot = svg('circle', { class: 'swing-dot', r: 3.5 }, plot);
    svg('text', { x: PW - 8, y: 12, 'text-anchor': 'end', class: 'dg-t' }, plot, 'θ, the lamp’s angle');
  }
  function drawPlot() {
    const x0 = 34, xw = PW - 42;
    let d = '';
    for (let i = 0; i < N; i++) {
      const v = hist[(head + i) % N];
      d += (i ? 'L' : 'M') + (x0 + (i / (N - 1)) * xw).toFixed(1) + ' ' + yOf(v).toFixed(1);
    }
    line.setAttribute('d', d);
    dot.setAttribute('cx', x0 + xw);
    dot.setAttribute('cy', yOf(angle));
    let e = '';
    if (release && release.a0 > 0.035 && steps - release.k < N) {
      /* velocity damping of 0.984 a step shrinks the swing by √0.984 a step */
      let up = '', dn = '';
      for (let k = release.k; k <= steps; k += 4) {
        const i = N - 1 - (steps - k);
        const a = release.a0 * DAMP ** ((k - release.k) / 2);
        if (a < 0.01) break;
        const x = (x0 + (i / (N - 1)) * xw).toFixed(1);
        up += (up ? 'L' : 'M') + x + ' ' + yOf(a).toFixed(1);
        dn += (dn ? 'L' : 'M') + x + ' ' + yOf(-a).toFixed(1);
      }
      e = up + dn;
    }
    env.setAttribute('d', e);
  }
  const readouts = () => {
    rd('a').textContent = num((angle * 180) / Math.PI, 1) + '°';
    rd('v').textContent = num(angVel, 2);
    rd('p').textContent = num(pullY, 1);
    rd('bulb').textContent = lit ? 'on' : 'off';
  };
  function loop() {
    if (running) return;
    running = true;
    Study.raf((t, dt) => {
      if (!visible) { running = false; return false; }
      acc += dt;
      let n = 0;
      while (acc >= DT && n < 5) { step(); acc -= DT; n++; }
      render();
      drawPlot();
      drawBursts();
      readouts();
    });
  }

  function toggleLight() { // main.js:1313-1320
    lit = !lit;
    fig.classList.toggle('is-lit', lit);
    Sound.play(lit ? 'on' : 'off', true);
    angVel += (Math.random() - 0.5) * 0.6;
  }
  function bigPull() { // main.js:1358-1364
    const b = ballInBurst();
    burst(b.x, b.y);
    nextVibe();
    Sound.play('pop', true);
    angVel = (angle > 0 ? -1 : 1) * (1.5 + Math.random());
    markRelease();
  }

  el.addEventListener('pointerdown', (e) => { // main.js:1323-1374
    if (toSVG(e).y < PIVOT.y - 4) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    dragging = true;
    angVel = 0;
    let start = toSVG(e), dist = 0;
    const onMove = (ev) => {
      const p = toSVG(ev);
      dist += Math.hypot(p.x - start.x, p.y - start.y);
      start = p;
      const dx = p.x - PIVOT.x, dy = p.y - PIVOT.y;
      angle = clamp(Math.atan2(dx, Math.max(L * 0.1, dy)), -0.65, 0.65);
      pullY = clamp(dy - L, 0, MAX_DOWN);
      angVel = 0;
    };
    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      dragging = false;
      const released = pullY;
      pullY = 0;
      if (dist < 7) {
        toggleLight();
        angVel = -angle * 0.5 + (Math.random() - 0.5) * 0.3;
      } else if (released >= TRIG_DOWN) {
        bigPull();
        return;
      } else {
        angVel = -angle * 0.7 + (Math.random() - 0.5) * 0.4;
      }
      markRelease();
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  });
  el.addEventListener('pointermove', (e) => { // main.js:1377-1386
    if (e.pointerType !== 'mouse') return;
    const pt = toSVG(e), b = ballSVG(angle, pullY);
    hoverNear = Math.hypot(pt.x - b.x, pt.y - b.y) < 18;
    if (dragging || pt.y < PIVOT.y) return;
    angVel += ((pt.x - PIVOT.x) / VB.w) * 0.009;
  });
  el.addEventListener('pointerleave', () => { hoverNear = false; });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleLight(); markRelease(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); bigPull(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); angVel += e.key === 'ArrowLeft' ? -0.9 : 0.9; markRelease(); }
  });

  /* the 24 hours, split as main.js:1092-1097 splits them */
  const bar = $('.clock-bar', fig), labels = $('.clock-labels', fig);
  const SEG = [[0, 5, 'night'], [5, 10, 'morning'], [10, 17, 'day'], [17, 21, 'evening'], [21, 24, 'night']];
  const NAME = { morning: 'Morning', day: 'Day', evening: 'Evening', night: 'Night' };
  SEG.forEach(([a, b, v]) => {
    const s = document.createElement('span');
    s.dataset.v = v;
    s.style.flex = String(b - a);
    s.style.background = VIBE_BG[v];
    s.style.color = VIBE_FG[v];
    s.textContent = NAME[v];
    bar.appendChild(s);
  });
  const nowMark = document.createElement('i');
  nowMark.className = 'clock-now';
  bar.appendChild(nowMark);
  [0, 5, 10, 17, 21, 24].forEach((h) => {
    const li = document.createElement('li');
    li.style.left = (h / 24) * 100 + '%';
    li.textContent = String(h);
    labels.appendChild(li);
  });
  const clockLi = document.createElement('li');
  clockLi.innerHTML = 'your clock <b data-lamp-r="clock">--:--</b>';
  $('.lamp-readout', fig).appendChild(clockLi);
  const tick = () => {
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    nowMark.style.left = (h / 24) * 100 + '%';
    rd('clock').textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} → ${vibeFromHour(d.getHours())}`;
  };
  tick();
  setInterval(tick, 30000);
  const syncVibe = () => {
    const v = vibe();
    $$('[data-vibe]', fig).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.vibe === v)));
    $$('span[data-v]', bar).forEach((s) => s.classList.toggle('is-on', s.dataset.v === v));
  };
  $$('button[data-vibe]', fig).forEach((b) => b.addEventListener('click', () => setVibe(b.dataset.vibe)));
  $('[data-vibe-clock]', fig).addEventListener('click', () => setVibe(vibeFromHour(new Date().getHours())));
  document.addEventListener('cohort:vibe', syncVibe);
  syncVibe();

  buildPlot();
  onResize(buildPlot);
  render();
  drawPlot();
  readouts();
  Study.onVisible(fig, () => {
    visible = true;
    loop();
    if (!swung && !R) { swung = true; setTimeout(() => { angVel = 0.55; markRelease(); }, 1200); } // main.js:1393
  }, () => { visible = false; });
}

/* ============================================================
   SHARED EFFECTS. Ported from main.js; positions are worked out in
   the figure's own coordinates instead of the viewport's.
   ============================================================ */
/* main.js:271-408 (Apps) and 727-843 (people): a fan on an arc that turns with the pointer */
function makeFan({ chip, icons, layer, track = chip, radius = 120, angles = [-75, -45, -15, 15, 45, 75], size = 52, stagger = 0.055, ease = backOut(1.8), spin = true, swing = true, sound = true, onTurn, onOpen, onClose }) {
  let active = false, live = false, rot = 0, off = 0, timer = 0, armT = 0, isOpen = false;
  const pos = (a, c) => { const rad = ((a - 90) * Math.PI) / 180; return { x: c.x + Math.cos(rad) * radius - size / 2, y: c.y + Math.sin(rad) * radius - size / 2 }; };
  const mobileOff = (vx) => (swing && innerWidth < 768 ? (vx < innerWidth / 2 ? 90 : -90) : 0); // main.js:283-285
  function open(buzz) {
    active = false;
    rot = 0;
    isOpen = true;
    const c = rel(chip, layer);
    off = mobileOff(c.vx);
    const scatter = 0.5 + (icons.length - 1) * stagger + 0.1;
    icons.forEach((ic, i) => {
      put(ic, { x: c.x - size / 2, y: c.y - size / 2, o: 0, s: 0.3, r: spin ? (Math.random() - 0.5) * 20 : 0 });
      const a = angles[i] + off, p = pos(a, c);
      to(ic, spin ? { x: p.x, y: p.y, o: 1, s: 1, r: a * 0.13 } : { x: p.x, y: p.y, o: 1, s: 1 }, { dur: 0.5, delay: i * stagger, ease });
    });
    clearTimeout(armT);
    armT = setTimeout(() => { active = true; }, R ? 0 : scatter * 1000);
    if (buzz && navigator.vibrate) navigator.vibrate(14);
    if (sound) Sound.play('hover', !!buzz);
    onOpen && onOpen(c, off);
  }
  function move(clientX) {
    if (!active) return;
    const c = rel(chip, layer);
    const dx = clientX - c.vx;
    const chipW = chip.getBoundingClientRect().width;
    rot = clamp((dx / (chipW * 2.5)) * 60, -30, 30); // main.js:324
    icons.forEach((ic, i) => {
      const a = angles[i] + off + rot, p = pos(a, c);
      to(ic, spin ? { x: p.x, y: p.y, r: a * 0.13 } : { x: p.x, y: p.y }, { dur: 0.2, ease: Ease['power2.out'] });
    });
    onTurn && onTurn(dx, rot, c, off);
  }
  function close() {
    active = false;
    isOpen = false;
    clearTimeout(armT);
    const c = rel(chip, layer);
    icons.forEach((ic, i) => to(ic, { x: c.x - size / 2, y: c.y - size / 2, o: 0, s: 0.2 }, { dur: 0.28, delay: i * 0.03, ease: Ease['power2.in'] }));
    onClose && onClose();
  }
  track.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') open(false); });
  track.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || live) move(e.clientX); });
  track.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') close(); });
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    clearTimeout(timer);
    timer = setTimeout(() => { live = true; open(true); }, 500); // main.js:376-381
  });
  const end = () => { clearTimeout(timer); if (!live) return; live = false; close(); };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);
  track.addEventListener('contextmenu', (e) => { if (live) e.preventDefault(); });
  return { open, close, move, get isOpen() { return isOpen; }, get active() { return active; }, get rot() { return rot; } };
}

/* main.js:893-948: the sticky-note storm */
const STICKY_COLORS = ['#F2A0C2', '#7DC77F', '#7FA8E6', '#B488E2', '#F4D34E', '#F08A6E'];
const STICKY_NOTES = [
  'Essay due 11:59', 'Problem set 3', 'Lab report Fri', 'Read 40 pages',
  'Reply to prof', 'Group project!!', 'Midterm Monday', 'Submit by midnight',
  'Register for classes', 'Tuition due', 'Late penalty soon', 'Office hours full',
  'Quiz tomorrow', 'Draft due today', 'Peer review ×3', 'Scholarship app',
  'Internship deadline', 'Club dues', 'Library books due', 'RSVP by Friday',
  'Call home', 'Laundry!!', 'Renew housing', 'Sign the form',
];
const planStorm = () => {
  const N = innerWidth < 640 ? 20 : 44; // main.js:907
  return Array.from({ length: N }, (_, i) => ({
    text: STICKY_NOTES[Math.floor(Math.random() * STICKY_NOTES.length)],
    color: STICKY_COLORS[i % STICKY_COLORS.length],
    fx: Math.random(), fy: Math.random(), r: Math.random() * 40 - 20,
    pop: 0.32 + Math.random() * 0.22, delay: Math.random() * 0.9,
    spin: Math.random() * 120 - 60, fall: 0.9 + Math.random() * 0.7, fallDelay: Math.random() * 0.5,
  }));
};
function runStorm(layer, plan) {
  const W = layer.clientWidth, H = layer.clientHeight;
  const notes = plan.map((p) => {
    const n = document.createElement('div');
    n.className = 'sticky';
    n.textContent = p.text;
    n.style.background = p.color;
    layer.appendChild(n);
    put(n, { x: p.fx * Math.max(40, W - 150), y: p.fy * Math.max(40, H - 130), r: p.r, s: 0.5, o: 0 });
    to(n, { s: 1, o: 1 }, { dur: p.pop, delay: p.delay, ease: backOut(1.7) });
    return n;
  });
  setTimeout(() => {
    notes.forEach((n, i) => {
      const p = plan[i];
      to(n, { y: H + 280, r: state(n).r + p.spin, o: 0 }, { dur: p.fall, delay: p.fallDelay, ease: Ease['power2.in'], done: () => n.remove() });
    });
  }, R ? 600 : 1900);
}

/* main.js:951-970: an emoji burst, as a GSAP timeline */
function emojiBurst(layer, origin, emojis, count, o = {}) {
  const spreadX = o.spreadX || 220, up = o.up || 200, dur = o.dur || 1.0, size = o.size || 26;
  const pop = backOut(2), move = Ease['power2.out'], fade = Ease['power1.out'];
  for (let i = 0; i < count; i++) {
    const n = document.createElement('span');
    n.className = 'floatie';
    n.textContent = emojis[i % emojis.length];
    n.style.fontSize = size + Math.random() * 8 + 'px';
    layer.appendChild(n);
    const x0 = origin.x - size / 2, y0 = origin.y - size / 2;
    const x1 = origin.x + (Math.random() - 0.5) * spreadX, y1 = origin.y - up * (0.4 + Math.random() * 0.8), r1 = Math.random() * 60 - 30;
    put(n, { x: x0, y: y0, s: 0.4, o: 0 });
    const t0 = now() + i * 50;
    Study.raf(() => {
      const t = (now() - t0) / 1000;
      if (t < 0) return;
      const a = pop(clamp(t / 0.18, 0, 1)), m = move(clamp(t / dur, 0, 1)), f = clamp((t - (dur - 0.5)) / 0.45, 0, 1);
      put(n, { x: x0 + (x1 - x0) * m, y: y0 + (y1 - y0) * m, r: r1 * m, s: 0.4 + 0.6 * a, o: Math.min(1, a) * (1 - fade(f)) });
      if (t >= Math.max(dur, dur - 0.05)) { n.remove(); return false; }
    });
  }
}

/* main.js:972-1006: dates rain across the area */
function dateRain(layer) {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const randDate = () => {
    const r = Math.random();
    if (r < 0.45) return MONTHS[Math.floor(Math.random() * 12)] + ' ' + (1 + Math.floor(Math.random() * 28));
    if (r < 0.75) return DAYS[Math.floor(Math.random() * 7)] + ' ' + (8 + Math.floor(Math.random() * 10)) + ':00';
    return 'Week ' + (1 + Math.floor(Math.random() * 14));
  };
  const W = layer.clientWidth, H = layer.clientHeight;
  const N = innerWidth < 640 ? 12 : 22;
  const chips = [];
  for (let i = 0; i < N; i++) {
    const n = document.createElement('div');
    n.className = 'date-chip';
    n.textContent = randDate();
    layer.appendChild(n);
    chips.push(n);
    put(n, { x: Math.random() * Math.max(40, W - 120), y: Math.random() * Math.max(40, H - 60), r: Math.random() * 16 - 8, s: 0.6, o: 0 });
    to(n, { s: 1, o: 1 }, { dur: 0.3 + Math.random() * 0.2, delay: Math.random() * 0.8, ease: backOut(1.8) });
  }
  setTimeout(() => chips.forEach((n) => to(n, { y: state(n).y + 44, o: 0 }, { dur: 0.6 + Math.random() * 0.5, delay: Math.random() * 0.4, ease: Ease['power2.in'], done: () => n.remove() })), 1700);
}

/* main.js:634-725: the Cohort logo lifts out of its chip and follows the pointer */
function makeLift({ chip, logo, layer, onUpdate }) {
  const W = 160;
  const inl = $('.cohort-inline-logo', chip);
  let active = false, natW = 0, natM = 0, offX = 0, offY = 0, restScale = 0.1, aCx = 0, aVx = 0, aTop = 0, looping = false, dx = 0;
  const xq = quick(0.5, Ease['power3.out']), yq = quick(0.5, Ease['power3.out']), rq = quick(0.5, Ease['power3.out']);
  const look = { s: 0.1, o: 0 };
  let lookTw = null, widthTw = null;
  const measure = () => {
    if (active || (widthTw && !widthTw.done)) return;
    inl.style.width = '';
    inl.style.marginRight = '';
    const ir = inl.getBoundingClientRect(), cr = chip.getBoundingClientRect();
    natW = ir.width;
    natM = parseFloat(getComputedStyle(inl).marginRight) || 0;
    offX = ir.left + ir.width / 2 - cr.left;
    offY = ir.top + ir.height / 2 - cr.top;
    restScale = natW / W;
  };
  const paintLogo = () => {
    const x = xq.get(), y = yq.get(), r = rq.get();
    logo.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${r.toFixed(2)}deg) scale(${look.s.toFixed(4)})`;
    logo.style.opacity = String(look.o);
    onUpdate && onUpdate({ dx, x, r, w: parseFloat(inl.style.width || natW) || 0, active });
  };
  const run = () => {
    if (looping) return;
    looping = true;
    Study.raf(() => {
      paintLogo();
      if (!active && xq.done && yq.done && rq.done && (!lookTw || lookTw.done)) { looping = false; return false; }
    });
  };
  const tweenLook = (s, o, dur, ease) => {
    if (lookTw) lookTw.kill();
    const s0 = look.s, o0 = look.o;
    const tw = tween({ dur: R ? 0 : dur, ease, update(e) { look.s = s0 + (s - s0) * e; look.o = o0 + (o - o0) * e; }, done() { tw.done = true; } });
    lookTw = tw;
  };
  const tweenInline = (w, m, o, dur) => {
    if (widthTw) widthTw.kill();
    const w0 = inl.getBoundingClientRect().width, m0 = parseFloat(getComputedStyle(inl).marginRight) || 0, o0 = Number(inl.style.opacity || 1);
    const tw = tween({ dur: R ? 0 : dur, ease: Ease['power3.out'], update(e) { inl.style.width = w0 + (w - w0) * e + 'px'; inl.style.marginRight = m0 + (m - m0) * e + 'px'; inl.style.opacity = String(o0 + (o - o0) * e); }, done() { tw.done = true; } });
    widthTw = tw;
  };
  function enter(gesture) {
    if (!natW) measure();
    active = true;
    dx = 0;
    Sound.play('heaven', gesture);
    const cr = rel(chip, layer);
    aCx = cr.x;
    aVx = cr.vx;
    aTop = cr.top;
    xq.snap(cr.left + offX - W / 2);
    yq.snap(cr.top + offY - W / 2);
    rq.snap(0);
    look.s = restScale;
    tweenLook(1, 1, 0.6, Ease['power3.out']);
    xq.set(aCx - W / 2);
    yq.set(aTop - W - 18);
    rq.set(0);
    tweenInline(0, 0, 0, 0.5);
    run();
  }
  function move(clientX) {
    if (!active) return;
    dx = clientX - aVx;
    xq.set(aCx - W / 2 + clamp(dx * 0.42, -44, 44));
    yq.set(aTop - W - 18);
    rq.set(clamp(dx * 0.06, -8, 8));
    run();
  }
  function leave() {
    if (!active) return;
    active = false;
    const cr = rel(chip, layer);
    xq.set(cr.left + offX - W / 2);
    yq.set(cr.top + offY - W / 2);
    rq.set(0);
    tweenLook(restScale, 0, 0.45, Ease['power3.inOut']);
    tweenInline(natW, natM, 1, 0.45);
    run();
  }
  onResize(measure);
  document.fonts && document.fonts.ready.then(measure);
  return { enter, move, leave, measure, get active() { return active; } };
}

/* main.js:423-487: "messages" becomes a 70px/s ticker, with keystrokes */
function makeMarquee(pill, { onTick, onKey, onStop } = {}) {
  const track = $('.imsg-track', pill);
  const MSGS = [
    "i need friends in my year who are into gaming, find me some.",
    "where's my 111 class holding and how do i find haston hall for my 121 class?",
  ];
  const SEP = '  ·  ';
  const ONCE = MSGS.join(SEP) + SEP;
  const SPEED = 70;
  let on = false, half = 0, t0 = 0, typing = false, timer = 0, lastKey = 0;
  const lock = () => { if (on) return; pill.style.width = ''; pill.style.width = pill.offsetWidth + 'px'; };
  requestAnimationFrame(lock);
  document.fonts && document.fonts.ready.then(lock);
  onResize(lock);
  function typeLoop() {
    if (!typing) return;
    Sound.play('key');
    const gap = 55 + Math.random() * 90 + (Math.random() < 0.12 ? 240 : 0); // main.js:449
    const t = now();
    onKey && onKey(t, lastKey ? t - lastKey : 0);
    lastKey = t;
    timer = setTimeout(typeLoop, gap);
  }
  function start() {
    if (on) return;
    on = true;
    track.textContent = ONCE + ONCE;
    track.style.opacity = '1';
    track.style.transform = 'translateX(0px)';
    requestAnimationFrame(() => {
      half = track.scrollWidth / 2;
      t0 = now();
      Study.raf(() => {
        if (!on) return false;
        const x = R ? 0 : -((((now() - t0) / 1000) * SPEED) % half);
        track.style.transform = `translateX(${x.toFixed(2)}px)`;
        onTick && onTick(x, half, pill.getBoundingClientRect().width);
      });
    });
    typing = true;
    lastKey = 0;
    typeLoop();
  }
  function stop() {
    if (!on) return;
    typing = false;
    clearTimeout(timer);
    on = false;
    tween({ dur: R ? 0 : 0.25, ease: Ease['power2.in'], update(e) { track.style.opacity = String(1 - e); }, done() { track.style.transform = 'translateX(0px)'; track.style.opacity = '1'; track.textContent = 'messages'; onStop && onStop(); } });
  }
  pill.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') start(); });
  pill.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') stop(); });
  pill.addEventListener('click', () => {
    if (mouseClick()) return;
    Sound.unlock();
    on ? stop() : start();
  });
  return { start, stop, get on() { return on; }, get half() { return half; }, MSGS, SEP, SPEED };
}

/* ============================================================
   FIG. 4: THE CHIPS. main.js:215-269 (the height tween), 195-213,
   1008-1054 (the words inside), and the shared effects above.
   ============================================================ */
function makeTweenViz(s) {
  const H = 130;
  let W = 360, bars, curve, live, dotC, readH = 0, cfg = null;
  const rd = (k) => $(`[data-tw="${k}"]`, s.closest('figure'));
  function build() {
    W = fit(s, H, 380);
    bars = svg('g', {}, s);
    curve = svg('g', {}, s);
    if (cfg) draw(cfg);
  }
  function draw(c) {
    cfg = c;
    bars.replaceChildren();
    curve.replaceChildren();
    const { h0, h1, dur, ease } = c;
    const hm = Math.max(h0, h1, 1), base = H - 18, top = 18, sc = (base - top) / hm;
    /* one bar, the paragraph's height, travelling from the h0 line to the h1 line */
    svg('line', { x1: 8, x2: 112, y1: base, y2: base, class: 'dg-axis' }, bars);
    [['h0', h0], ['h1', h1]].forEach(([k, h]) => {
      svg('line', { x1: 8, x2: 82, y1: base - h * sc, y2: base - h * sc, class: 'tw-ghost' }, bars);
      svg('text', { x: 88, y: base - h * sc + 4, class: 'dg-t' }, bars, k);
    });
    live = svg('rect', { x: 26, y: base - h0 * sc, width: 38, height: h0 * sc, class: 'tw-live' }, bars);
    readH = svg('text', { x: 45, y: 12, 'text-anchor': 'middle', class: 'dg-t dg-t--ink' }, bars, Math.round(h0) + 'px');
    svg('text', { x: 45, y: H - 4, 'text-anchor': 'middle', class: 'dg-t' }, bars, 'height');
    const cx0 = 140, cx1 = W - 10, cy0 = base, cy1 = top + 4;
    svg('line', { x1: cx0, x2: cx1, y1: cy0, y2: cy0, class: 'dg-axis' }, curve);
    svg('line', { x1: cx0, x2: cx0, y1: cy0, y2: cy1 - 4, class: 'dg-axis' }, curve);
    const f = Ease[ease];
    let d = '';
    for (let i = 0; i <= 60; i++) { const p = i / 60; d += (i ? 'L' : 'M') + (cx0 + p * (cx1 - cx0)).toFixed(1) + ' ' + (cy0 - f(p) * (cy0 - cy1)).toFixed(1); }
    svg('path', { d, class: 'dg-ink' }, curve);
    svg('text', { x: cx0 + 6, y: cy1 + 2, class: 'dg-t' }, curve, ease);
    svg('text', { x: cx1, y: H - 4, 'text-anchor': 'end', class: 'dg-t' }, curve, dur.toFixed(3) + 's');
    svg('text', { x: cx0, y: H - 4, class: 'dg-t' }, curve, '0');
    dotC = svg('circle', { r: 4, cx: cx1, cy: cy1, class: 'dg-fill-tint' }, curve);
    c.geo = { cx0, cx1, cy0, cy1, base, sc, f };
    rd('h0').textContent = Math.round(h0) + 'px';
    rd('h1').textContent = Math.round(h1) + 'px';
    rd('d').textContent = num(h1 - h0, 0) + 'px';
    rd('dur').textContent = dur.toFixed(3) + 's';
    rd('ease').textContent = ease;
    progress(1, 1);
  }
  function progress(p, e) {
    if (!cfg || !cfg.geo) return;
    const { cx0, cx1, cy0, cy1, base, sc } = cfg.geo;
    const h = cfg.h0 + (cfg.h1 - cfg.h0) * e;
    dotC.setAttribute('cx', cx0 + p * (cx1 - cx0));
    dotC.setAttribute('cy', cy0 - e * (cy0 - cy1));
    live.setAttribute('y', base - h * sc);
    live.setAttribute('height', Math.max(0, h * sc));
    readH.textContent = Math.round(h) + 'px';
  }
  build();
  onResize(build);
  return { draw, progress };
}

function initChips() {
  const fig = $('#chips-fig');
  if (!fig) return;
  const layer = $('.fx-layer', fig), clip = $('.fx-clip', fig);
  const viz = makeTweenViz($('.tween-svg', fig));

  /* the height tween, main.js:217-269 */
  const tw = new WeakMap();
  $$('.chip[data-for]', fig).forEach((chip) => {
    const reveal = document.getElementById(chip.dataset.for);
    if (!reveal) return;
    chip.setAttribute('aria-expanded', 'false');
    chip.setAttribute('aria-controls', chip.dataset.for);
    chip.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && chip.dataset.for !== 'x-cohort') Sound.play('hover'); });
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const para = reveal.closest('p');
      const opening = !chip.classList.contains('open');
      (tw.get(reveal) || []).forEach((t) => t.kill());
      para.style.height = '';
      para.style.overflow = '';
      const h0 = para.offsetHeight;
      chip.classList.toggle('open', opening);
      chip.setAttribute('aria-expanded', String(opening));
      reveal.style.display = opening ? 'inline' : 'none';
      const h1 = para.offsetHeight;
      if (!opening) reveal.style.display = 'inline';
      const dur = Math.min(0.6, 0.32 + Math.abs(h1 - h0) / 1500);
      const easeName = opening ? 'power3.out' : 'power3.inOut';
      viz.draw({ h0, h1, dur, ease: easeName });
      viz.progress(0, 0);
      const list = [];
      if (h0 !== h1) {
        para.style.height = h0 + 'px';
        para.style.overflow = 'hidden';
        list.push(tween({
          dur: R ? 0 : dur, ease: Ease[easeName],
          update(e, p) { para.style.height = h0 + (h1 - h0) * e + 'px'; viz.progress(p, e); },
          done() { para.style.height = ''; para.style.overflow = ''; if (!opening) reveal.style.display = 'none'; },
        }));
      } else {
        viz.progress(1, 1);
        if (!opening) reveal.style.display = 'none';
      }
      const o0 = Number(getComputedStyle(reveal).opacity) || 0;
      if (opening) {
        reveal.style.opacity = '0';
        list.push(tween({ dur: R ? 0 : Math.max(0.3, dur * 0.85), ease: Ease['power2.out'], update(e) { reveal.style.opacity = String(e); } }));
        Sound.play('pop', true);
      } else {
        list.push(tween({ dur: R ? 0 : Math.max(0.2, dur * 0.7), ease: Ease['power2.in'], update(e) { reveal.style.opacity = String(o0 * (1 - e)); } }));
        Sound.play('tick', true);
      }
      tw.set(reveal, list);
    });
  });

  /* a starting picture: what opening "overwhelming" would do, measured the way the site measures it */
  const firstViz = () => {
    const chip = $('.chip[data-for="x-overwhelm"]', fig), reveal = $('#x-overwhelm', fig), para = reveal.closest('p');
    if (chip.classList.contains('open')) return;
    const h0 = para.offsetHeight;
    reveal.style.display = 'inline';
    const h1 = para.offsetHeight;
    reveal.style.display = '';
    viz.draw({ h0, h1, dur: Math.min(0.6, 0.32 + Math.abs(h1 - h0) / 1500), ease: 'power3.out' });
  };

  /* the words inside the reveals, main.js:875-1054. Like the site, these sit still for reduced motion. */
  let busy = false;
  const lock = (ms) => { busy = true; setTimeout(() => { busy = false; }, ms); };
  const centre = (n) => rel(n, clip);
  const FX = {
    deadlines: () => { lock(4200); runStorm(clip, planStorm()); return 'tick'; },
    mail: (n) => { lock(1500); emojiBurst(clip, centre(n), ['✉️', '📧', '📨'], 11, { spreadX: 280, up: 240 }); return 'tick'; },
    bubble: (n) => { lock(1500); emojiBurst(clip, centre(n), ['💬', '🗨️', '💭'], 7, { spreadX: 150, up: 150, size: 23 }); return 'pop'; },
    dates: () => { lock(3600); dateRain(clip); return 'tick'; },
  };
  const fire = (n, gesture) => {
    if (R || busy) return;
    const sound = FX[n.dataset.fx](n);
    Sound.play(sound, gesture);
  };
  $$('.sw[data-fx]', fig).forEach((n) => {
    n.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') fire(n, false); });
    n.addEventListener('click', () => { if (!mouseClick()) fire(n, true); });
    n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(n, true); } });
  });
  $$('.happy', fig).forEach((n) => { // main.js:1032-1053
    const set = n.dataset.happy === 'roommates' ? ['🏠', '🛋️', '🍕', '🎮', '😄', '✨'] : ['🎉', '🥳', '🤝', '🙌', '😄', '✨'];
    const party = (gesture) => {
      if (R || busy) return;
      lock(1700);
      emojiBurst(clip, centre(n), set, 9, { spreadX: 200, up: 175, size: 24 });
      Confetti.fire({ origin: atNode(n), particleCount: 50, spread: 70, startVelocity: 25, ticks: 170, gravity: 0.9, scalar: 0.9, colors: RAINBOW.slice(0, 6) });
      Sound.play('party', gesture);
    };
    n.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') party(false); });
    n.addEventListener('click', () => { if (!mouseClick()) party(true); });
    n.addEventListener('keydown', (e) => { if (e.key === 'Enter') party(true); });
  });
  const best = $('.best-word', fig); // main.js:195-213
  const burstBest = (gesture) => {
    Confetti.fire({ origin: atNode(best), particleCount: 70, spread: 65, startVelocity: 22, ticks: 220, colors: RAINBOW });
    Sound.play('party', gesture);
  };
  best.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') burstBest(false); });
  best.addEventListener('click', () => burstBest(true));

  makeFan({ chip: $('[data-apps]', fig), icons: $$('.fx-icons img', fig), layer });
  const avatars = $$('.fx-avatars img', fig);
  if (!R) $$('[data-people]', fig).forEach((chip) => makeFan({ chip, icons: avatars, layer, radius: 122, angles: [-50, 0, 50], size: 56, stagger: 0.06, ease: backOut(1.7), spin: false, sound: false }));
  $('[data-apps]', fig).addEventListener('click', (e) => e.stopPropagation());

  const coh = $('.cohort-chip', fig);
  const lift = makeLift({ chip: coh, logo: $('.fx-logo', fig), layer });
  coh.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') lift.enter(false); });
  coh.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') lift.move(e.clientX); });
  coh.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') lift.leave(); });

  makeMarquee($('[data-imsg]', fig));
  Study.onVisible(fig, () => { if (document.fonts) document.fonts.ready.then(firstViz); else firstViz(); }, null, '0px');
}

/* ============================================================
   FIG. 5: FOUR EFFECTS, taken apart.
   ============================================================ */
function initEffects() {
  const fig = $('#fx-fig');
  if (!fig) return;
  const tabs = $$('[role="tab"]', fig);
  const inits = { 'fxp-apps': appsPanel, 'fxp-dead': deadPanel, 'fxp-msg': msgPanel, 'fxp-coh': cohPanel };
  const done = {};
  const select = (t, focus) => {
    tabs.forEach((b) => {
      const on = b === t;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      const p = document.getElementById(b.getAttribute('aria-controls'));
      p.hidden = !on;
      if (on && !done[p.id]) { done[p.id] = true; inits[p.id](p); }
      if (on && p._redraw) p._redraw();
    });
    if (focus) t.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) { e.preventDefault(); select(tabs[(i + d + tabs.length) % tabs.length], true); }
    });
  });
  Study.onVisible(fig, () => { if (!done['fxp-apps']) { done['fxp-apps'] = true; appsPanel($('#fxp-apps', fig)); } }, null, '300px 0px');
}

function appsPanel(p) {
  const area = $('[data-fan]', p), chip = $('[data-fan-chip]', p), fanSvg = $('.fan-svg', p), cl = $('.clamp-svg', p);
  const icons = $$('.fan-icons img', p);
  const rd = (k) => $(`[data-fan-r="${k}"]`, p);
  const ANG = [-75, -45, -15, 15, 45, 75], RADIUS = 120;
  let dxNow = 0, rotNow = 0, open = false;
  const centre = () => rel(chip, area);
  function drawFan() {
    fanSvg.replaceChildren();
    const c = centre();
    const pt = (a, r) => { const rad = ((a - 90) * Math.PI) / 180; return [c.x + Math.cos(rad) * r, c.y + Math.sin(rad) * r]; };
    const arc = (a0, a1, r, cls) => {
      const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r);
      return svg('path', { d: `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`, class: cls }, fanSvg);
    };
    arc(-105, 105, RADIUS, 'dg-grid dg-dash');
    arc(-75 + rotNow, 75 + rotNow, RADIUS, 'dg-axis');
    ANG.forEach((a) => { const [x, y] = pt(a + rotNow, RADIUS); svg('line', { x1: c.x, y1: c.y, x2: x, y2: y, class: 'dg-grid' }, fanSvg); });
    if (Math.abs(rotNow) > 0.5) arc(Math.min(0, rotNow), Math.max(0, rotNow), 42, 'dg-tint');
    const [lx, ly] = pt(0, 42);
    svg('line', { x1: c.x, y1: c.y, x2: lx, y2: ly, class: 'dg-axis dg-dash' }, fanSvg);
    const [tx, ty] = pt(-105, RADIUS);
    svg('text', { x: tx, y: ty + 20, class: 'dg-t' }, fanSvg, '−30° reach');
    const [ux, uy] = pt(105, RADIUS);
    svg('text', { x: ux, y: uy + 20, 'text-anchor': 'end', class: 'dg-t' }, fanSvg, '+30° reach');
    const [rx, ry] = pt(ANG[5] + rotNow, RADIUS / 2);
    svg('text', { x: rx + 8, y: ry, class: 'dg-t' }, fanSvg, '120px');
  }
  let CW = 320;
  const CH = 200;
  function drawClamp() {
    CW = fit(cl, CH, 360);
    const x0 = 34, x1 = CW - 8, y0 = 16, y1 = CH - 26, D = 220, A = 36;
    const X = (dx) => x0 + ((clamp(dx, -D, D) + D) / (2 * D)) * (x1 - x0);
    const Y = (a) => y0 + ((A - a) / (2 * A)) * (y1 - y0);
    const chipW = chip.getBoundingClientRect().width || 70;
    svg('rect', { x: X(-chipW / 2), y: y0, width: X(chipW / 2) - X(-chipW / 2), height: y1 - y0, class: 'dg-band' }, cl);
    svg('text', { x: X(0), y: y1 + 18, 'text-anchor': 'middle', class: 'dg-t' }, cl, 'on the word');
    [-30, 0, 30].forEach((a) => {
      svg('line', { x1: x0, x2: x1, y1: Y(a), y2: Y(a), class: a ? 'dg-grid' : 'dg-axis' }, cl);
      svg('text', { x: x0 - 6, y: Y(a) + 4, 'text-anchor': 'end', class: 'dg-t' }, cl, (a > 0 ? '+' : a < 0 ? '−' : '') + Math.abs(a) + '°');
    });
    svg('line', { x1: X(0), x2: X(0), y1: y0, y2: y1, class: 'dg-grid' }, cl);
    let d = '';
    for (let i = 0; i <= 80; i++) { const dx = -D + (i / 80) * 2 * D, a = clamp((dx / (chipW * 2.5)) * 60, -30, 30); d += (i ? 'L' : 'M') + X(dx).toFixed(1) + ' ' + Y(a).toFixed(1); }
    svg('path', { d, class: 'dg-ink' }, cl);
    svg('text', { x: x1, y: y1 + 18, 'text-anchor': 'end', class: 'dg-t' }, cl, `dx ±${D}px`);
    svg('text', { x: x1, y: Y(30) + 16, 'text-anchor': 'end', class: 'dg-t' }, cl, `clamped from ${Math.round(chipW * 1.25)}px`);
    cl._dot = svg('circle', { r: 4.5, cx: X(dxNow), cy: Y(rotNow), class: 'dg-fill-tint' }, cl);
    cl._X = X;
    cl._Y = Y;
  }
  const report = (dx, rot) => {
    dxNow = dx;
    rotNow = rot;
    rd('dx').textContent = num(dx, 0) + 'px';
    rd('rot').textContent = num(rot, 1) + '°';
    if (cl._dot) { cl._dot.setAttribute('cx', cl._X(dx)); cl._dot.setAttribute('cy', cl._Y(rot)); }
    drawFan();
  };
  const fan = makeFan({ chip, icons, layer: area, track: area, swing: false, onTurn: report, onOpen: () => { open = true; report(0, 0); }, onClose: () => { open = false; report(0, 0); } });
  chip.addEventListener('click', () => { if (mouseClick()) return; fan.isOpen ? fan.close() : fan.open(true); });
  chip.addEventListener('keydown', (e) => {
    if (!fan.isOpen || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    const c = rel(chip, area);
    fan.move(c.vx + dxNow + (e.key === 'ArrowLeft' ? -20 : 20));
  });
  p._redraw = () => { drawClamp(); drawFan(); };
  onResize(() => { if (!p.hidden) p._redraw(); });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(p._redraw);
}

function deadPanel(p) {
  const area = $('[data-storm]', p), word = $('[data-storm-word]', p), layer = $('.storm-layer', p), g = $('.gantt-svg', p);
  const rd = (k) => $(`[data-storm-r="${k}"]`, p);
  let plan = planStorm(), t0 = 0, busy = false, head = null, GW = 900, X = null;
  function draw() {
    const rowH = plan.length > 30 ? 5 : 9;
    const H = 30 + plan.length * rowH + 26;
    GW = fit(g, H, 980);
    const x0 = 40, x1 = GW - 10, TMAX = 4.2;
    X = (t) => x0 + (t / TMAX) * (x1 - x0);
    for (let s = 0; s <= 4; s++) {
      svg('line', { x1: X(s), x2: X(s), y1: 22, y2: H - 22, class: 'dg-grid' }, g);
      svg('text', { x: X(s), y: H - 6, 'text-anchor': 'middle', class: 'dg-t' }, g, s + 's');
    }
    svg('line', { x1: X(1.9), x2: X(1.9), y1: 10, y2: H - 22, class: 'dg-tint dg-dash' }, g);
    svg('text', { x: X(1.9) + 5, y: 14, class: 'dg-t dg-t--tint' }, g, 'hold ends at 1.9s');
    svg('text', { x: 0, y: 30 + rowH, class: 'dg-t' }, g, 'note 1');
    svg('text', { x: 0, y: 30 + plan.length * rowH, class: 'dg-t' }, g, String(plan.length));
    plan.forEach((n, i) => {
      const y = 26 + i * rowH, h = rowH - 1.5;
      svg('rect', { x: X(n.delay), y, width: X(n.delay + n.pop) - X(n.delay), height: h, fill: n.color }, g);
      svg('line', { x1: X(n.delay + n.pop), x2: X(1.9 + n.fallDelay), y1: y + h / 2, y2: y + h / 2, class: 'dg-grid' }, g);
      svg('rect', { x: X(1.9 + n.fallDelay), y, width: X(1.9 + n.fallDelay + n.fall) - X(1.9 + n.fallDelay), height: h, fill: n.color, opacity: 0.45 }, g);
    });
    head = svg('line', { x1: X(0), x2: X(0), y1: 22, y2: H - 22, class: 'dg-ink', opacity: 0 }, g);
    rd('n').textContent = String(plan.length);
  }
  function go(gesture) {
    if (busy) return;
    busy = true;
    setTimeout(() => { busy = false; }, 4200); // main.js:905
    plan = planStorm();
    draw();
    runStorm(layer, plan);
    Sound.play('tick', gesture);
    t0 = now();
    Study.raf(() => {
      const t = (now() - t0) / 1000;
      head.setAttribute('x1', X(Math.min(t, 4.2)));
      head.setAttribute('x2', X(Math.min(t, 4.2)));
      head.setAttribute('opacity', 1);
      rd('t').textContent = Math.min(t, 4.2).toFixed(2) + 's';
      if (t >= 4.2) { head.setAttribute('opacity', 0); return false; }
    });
  }
  word.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') go(false); });
  word.addEventListener('click', () => go(true));
  word.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(true); } });
  p._redraw = draw;
  onResize(() => { if (!p.hidden) draw(); });
  draw();
}

function msgPanel(p) {
  const pill = $('[data-imsg2]', p), tape = $('.tape-svg', p);
  const rd = (k) => $(`[data-msg-r="${k}"]`, p);
  const keys = [];
  let TW = 900, geo = null;
  const H = 128;
  const mq = makeMarquee(pill, {
    onTick(x, half, pw) { place(x, half, pw); rd('x').textContent = num(x, 0) + 'px'; },
    onKey(t, gap) { keys.push({ t, gap }); while (keys.length && t - keys[0].t > 3000) keys.shift(); rd('gap').textContent = Math.round(gap) + 'ms'; drawKeys(); },
    onStop() { place(0, geo ? geo.half : 0, pill.getBoundingClientRect().width); rd('x').textContent = '0px'; },
  });
  /* the track's real widths, measured in the pill's own font */
  function widths() {
    const tr = $('.imsg-track', pill), cs = getComputedStyle(tr);
    const c = document.createElement('canvas').getContext('2d');
    c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const sep = c.measureText(' · ').width; // white-space: nowrap folds the two spaces either side of the dot
    const a = c.measureText(mq.MSGS[0]).width, b = c.measureText(mq.MSGS[1]).width;
    return { a, b, sep, half: a + b + 2 * sep };
  }
  function draw() {
    TW = fit(tape, H, 980);
    const w = widths(), half = mq.half || w.half, k = half / w.half;
    const x0 = 10, x1 = TW - 10, sc = (x1 - x0) / (2 * half);
    geo = { x0, sc, half };
    const segs = [];
    for (let rep = 0; rep < 2; rep++) {
      const base = rep * half;
      segs.push([base, w.a * k, mq.MSGS[0], rep], [base + w.a * k + w.sep * k, w.b * k, mq.MSGS[1], rep]);
    }
    segs.forEach(([s0, len, text, rep]) => {
      const x = x0 + s0 * sc, wd = len * sc;
      svg('rect', { x, y: 26, width: wd, height: 18, class: rep ? 'dg-grid' : 'dg-axis', fill: 'none' }, tape);
      const maxChars = Math.floor(wd / 7.2) - 1;
      if (maxChars > 6) svg('text', { x: x + 5, y: 39, class: rep ? 'dg-t' : 'dg-t dg-t--ink' }, tape, text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text);
    });
    svg('line', { x1: x0 + half * sc, x2: x0 + half * sc, y1: 14, y2: 52, class: 'dg-tint dg-dash' }, tape);
    svg('text', { x: x0 + half * sc + 5, y: 14, class: 'dg-t dg-t--tint' }, tape, `jumps back here: ${Math.round(half)}px`);
    svg('text', { x: x0, y: 14, class: 'dg-t' }, tape, 'the track, to scale');
    geo.win = svg('rect', { x: x0, y: 22, width: 10, height: 26, class: 'dg-tint', fill: 'none' }, tape);
    svg('text', { x: x0, y: 74, class: 'dg-t' }, tape, 'keystrokes, last 3s');
    svg('line', { x1: x0, x2: x1, y1: 110, y2: 110, class: 'dg-axis' }, tape);
    svg('text', { x: x1, y: H - 2, 'text-anchor': 'end', class: 'dg-t' }, tape, 'now');
    svg('text', { x: x0, y: H - 2, class: 'dg-t' }, tape, '−3s');
    geo.keys = svg('g', {}, tape);
    geo.kx = (t) => x1 - ((now() - t) / 3000) * (x1 - x0);
    rd('lap').textContent = Math.round(half) + 'px';
    rd('lt').textContent = (half / mq.SPEED).toFixed(1) + 's';
    place(0, half, pill.getBoundingClientRect().width);
    drawKeys();
  }
  function place(x, half, pw) {
    if (!geo || !geo.win) return;
    if (half && Math.abs(half - geo.half) > 1) { draw(); return; }
    geo.win.setAttribute('x', geo.x0 + -x * geo.sc);
    geo.win.setAttribute('width', Math.max(4, pw * geo.sc));
    if (keys.length) drawKeys();
  }
  function drawKeys() {
    if (!geo || !geo.keys) return;
    geo.keys.replaceChildren();
    keys.forEach((k) => {
      const x = geo.kx(k.t);
      const long = k.gap >= 295;
      svg('line', { x1: x, x2: x, y1: long ? 84 : 94, y2: 110, class: long ? 'dg-tint' : 'dg-ink' }, geo.keys);
    });
  }
  p._redraw = draw;
  onResize(() => { if (!p.hidden) draw(); });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(draw);
}

function cohPanel(p) {
  const area = $('.coh-area', p), chip = $('[data-coh]', p), roll = $('.roll-svg', p);
  const rd = (k) => $(`[data-coh-r="${k}"]`, p);
  const lift = makeLift({
    chip, logo: $('.coh-fly', p), layer: area,
    onUpdate({ dx, r, w }) { rd('x').textContent = num(clamp(dx * 0.42, -44, 44), 0) + 'px'; rd('r').textContent = num(r, 1) + '°'; rd('w').textContent = w.toFixed(1) + 'px'; },
  });
  const score = SCORES.heaven();
  const draw = () => drawRoll(roll, score, 1.6);
  chip.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { lift.enter(false); playhead(roll); } });
  chip.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') lift.move(e.clientX); });
  chip.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') lift.leave(); });
  chip.addEventListener('click', () => {
    if (mouseClick()) { if (!lift.active) { lift.enter(true); playhead(roll); } return; }
    if (lift.active) lift.leave();
    else { lift.enter(true); playhead(roll); }
  });
  p._redraw = () => { draw(); lift.measure(); };
  onResize(() => { if (!p.hidden) draw(); });
  draw();
}

/* a piano roll: time across, pitch up a log scale, each note as wide as its envelope */
function drawRoll(s, score, tmax) {
  const H = 210;
  const W = fit(s, H, 980);
  const x0 = 54, x1 = W - 12, y0 = 12, y1 = H - 26;
  const FMIN = 50, FMAX = 5000;
  const end = Math.max(...score.map((e) => e.start + e.dur));
  const nice = [0.1, 0.2, 0.3, 0.6, 1, 1.6, 2];
  const TM = tmax || nice.find((n) => n >= end * 1.08) || 2;
  const X = (t) => x0 + (t / TM) * (x1 - x0);
  const Y = (f) => y1 - (Math.log(clamp(f, FMIN, FMAX) / FMIN) / Math.log(FMAX / FMIN)) * (y1 - y0);
  [100, 250, 500, 1000, 2000, 4000].forEach((f) => {
    svg('line', { x1: x0, x2: x1, y1: Y(f), y2: Y(f), class: 'dg-grid' }, s);
    svg('text', { x: x0 - 6, y: Y(f) + 4, 'text-anchor': 'end', class: 'dg-t' }, s, f >= 1000 ? f / 1000 + 'kHz' : f + 'Hz');
  });
  const steps = TM <= 0.2 ? [0, TM / 2, TM] : TM <= 0.6 ? [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6].filter((t) => t <= TM + 1e-9) : [0, 0.4, 0.8, 1.2, 1.6, 2].filter((t) => t <= TM + 1e-9);
  steps.forEach((t) => svg('text', { x: X(t), y: H - 6, 'text-anchor': 'middle', class: 'dg-t' }, s, (t < 1 ? Math.round(t * 1000) + 'ms' : t + 's')));
  svg('line', { x1: x0, x2: x1, y1: y1, y2: y1, class: 'dg-axis' }, s);
  const thick = (v) => 1.2 + (v / 0.1) * 13;
  const names = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  const note = (f) => { const m = Math.round(12 * Math.log2(f / 440) + 69); return names[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); };
  score.forEach((ev) => {
    const yc = Y(ev.f);
    if (ev.kind === 'click' || ev.kind === 'snap') {
      const top = Y(ev.f * 1.6), bot = Y(ev.f / 1.6);
      svg('rect', { x: X(ev.start), y: top, width: Math.max(2, X(ev.start + ev.dur) - X(ev.start)), height: bot - top, class: 'dg-fill-ink', opacity: 0.32 }, s);
      svg('text', { x: X(ev.start + ev.dur) + 5, y: yc + 4, class: 'dg-t' }, s, `noise ~${(ev.f / 1000).toFixed(1)}kHz`);
      return;
    }
    const pts = [], n = 24;
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * ev.dur;
      let a;
      if (ev.kind === 'hum') a = t < ev.peak - ev.start ? (t / (ev.peak - ev.start)) * ev.vol : ev.vol * (0.0001 / ev.vol) ** ((t - (ev.peak - ev.start)) / (ev.end - ev.peak));
      else if (ev.kind === 'thud') a = ev.vol * 0.4 * Math.exp(-t / (ev.dur * 0.2));
      else a = t < 0.008 ? (t / 0.008) * ev.vol : ev.vol * (0.0001 / ev.vol) ** ((t - 0.008) / Math.max(0.001, ev.dur - 0.008));
      pts.push([X(ev.start + t), thick(a) / 2]);
    }
    const d = 'M' + pts.map(([x, h]) => `${x.toFixed(1)} ${(yc - h).toFixed(1)}`).join('L') + 'L' + pts.reverse().map(([x, h]) => `${x.toFixed(1)} ${(yc + h).toFixed(1)}`).join('L') + 'Z';
    svg('path', { d, class: ev.kind === 'tone' ? 'dg-fill-tint' : 'dg-fill-ink', opacity: ev.kind === 'tone' ? 0.85 : 0.55 }, s);
  });
  const tones = score.filter((e) => e.kind === 'tone' && e.vol >= 0.02);
  if (tones.length <= 6) tones.forEach((ev) => svg('text', { x: X(ev.start), y: Y(ev.f) - 10, class: 'dg-t dg-t--ink' }, s, note(ev.f)));
  s._head = svg('line', { x1: x0, x2: x0, y1: y0, y2: y1, class: 'dg-ink', opacity: 0 }, s);
  s._X = X;
  s._TM = TM;
  s._end = end;
}
function playhead(s) {
  if (!s._head) return;
  const t0 = now();
  Study.raf(() => {
    const t = (now() - t0) / 1000;
    const x = s._X(Math.min(t, s._TM));
    s._head.setAttribute('x1', x);
    s._head.setAttribute('x2', x);
    s._head.setAttribute('opacity', 1);
    if (t >= Math.min(s._TM, s._end + 0.05)) { s._head.setAttribute('opacity', 0); return false; }
  });
}

/* ============================================================
   FIG. 6: THE NOISE, on the CPU. The same hash, noise and fbm as the
   shader (main.js:2026-2039), and the same threshold (2041-2067).
   ============================================================ */
const fract = (x) => x - Math.floor(x);
const hash = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
const vnoise = (x, y) => {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  const ab = a + (b - a) * fx, cd = c + (d - c) * fx;
  return ab + (cd - ab) * fy;
};
const fbm = (x, y) => { let v = 0, a = 0.5; for (let i = 0; i < 6; i++) { v += a * vnoise(x, y); x *= 2.1; y *= 2.1; a *= 0.48; } return v; };
const nField = (u, v) => fbm(u * 4.4 + 0.5, v * 4.4 + 1.3) - v * 0.3;

function initNoise() {
  const fig = $('#noise-fig');
  if (!fig) return;
  const cv = $('.noise-cv', fig), sv = $('.xsec-svg', fig);
  const progIn = $('[data-nz-prog]', fig), progOut = $('[data-nz-prog-out]', fig), playBtn = $('[data-nz-play]', fig);
  const rd = (k) => $(`[data-nz-r="${k}"]`, fig);
  const GW = 200, GH = 241, EDGE = 0.055;
  let field = null, pix = null, img = null, ctx = null, row = 0.62, prog = 0.4, built = false, playing = false, tSec = 0;
  function build() {
    const im = new Image();
    im.onload = () => {
      const oc = document.createElement('canvas');
      oc.width = GW; oc.height = GH;
      const o = oc.getContext('2d');
      o.drawImage(im, 0, 0, GW, GH);
      pix = o.getImageData(0, 0, GW, GH).data;
      field = new Float32Array(GW * GH);
      for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) field[j * GW + i] = nField((i + 0.5) / GW, (j + 0.5) / GH);
      cv.width = GW; cv.height = GH;
      ctx = cv.getContext('2d');
      img = ctx.createImageData(GW, GH);
      built = true;
      render();
    };
    im.src = 'media/cohort/phone.webp';
  }
  function render() {
    if (!built) return;
    const d = img.data;
    for (let k = 0; k < GW * GH; k++) {
      const a = pix[k * 4 + 3], n = field[k], o = k * 4;
      if (a < 8) { d[o + 3] = 0; continue; }
      if (n > prog) { // discarded: shown here as the noise itself
        const g = Math.round(clamp(40 + n * 180, 0, 255));
        d[o] = g; d[o + 1] = g; d[o + 2] = g; d[o + 3] = 120;
      } else if (n > prog - EDGE) {
        const t = (prog - n) / EDGE, sm = t * t * (3 - 2 * t);
        d[o] = 255 * (1 + (0.92 - 1) * sm); d[o + 1] = 255 * (0.9 + (0.3 - 0.9) * sm); d[o + 2] = 255 * (0.55 + (0.04 - 0.55) * sm); d[o + 3] = 255;
      } else {
        d[o] = pix[o]; d[o + 1] = pix[o + 1]; d[o + 2] = pix[o + 2]; d[o + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);
    const y = Math.round(row * (GH - 1)) + 0.5;
    ctx.strokeStyle = '#1C34F5';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(GW, y); ctx.stroke();
    plot();
  }
  let SW = 520;
  const SH = 290;
  function plot() {
    SW = fit(sv, SH, 580);
    const x0 = 44, x1 = SW - 10, y0 = 16, y1 = SH - 30, NMIN = -0.45, NMAX = 1.2;
    const X = (u) => x0 + u * (x1 - x0), Y = (n) => y1 - ((clamp(n, NMIN, NMAX) - NMIN) / (NMAX - NMIN)) * (y1 - y0);
    [-0.25, 0, 0.25, 0.5, 0.75, 1].forEach((n) => {
      svg('line', { x1: x0, x2: x1, y1: Y(n), y2: Y(n), class: n === 0 ? 'dg-axis' : 'dg-grid' }, sv);
      svg('text', { x: x0 - 6, y: Y(n) + 4, 'text-anchor': 'end', class: 'dg-t' }, sv, num(n, 2));
    });
    svg('rect', { x: x0, y: Y(prog), width: x1 - x0, height: Math.max(0, Y(prog - EDGE) - Y(prog)), class: 'xs-band' }, sv);
    svg('line', { x1: x0, x2: x1, y1: Y(prog), y2: Y(prog), class: 'dg-tint' }, sv);
    svg('text', { x: x1, y: Y(prog) - 6, 'text-anchor': 'end', class: 'dg-t dg-t--tint' }, sv, `prog ${num(prog, 2)}: above it, discard`);
    svg('text', { x: x1, y: Math.min(y1 - 4, Y(prog - EDGE) + 14), 'text-anchor': 'end', class: 'dg-t' }, sv, 'below it, drawn');
    svg('text', { x: x0 + 4, y: Math.min(y1 - 4, Y(prog - EDGE) + 14), class: 'dg-t' }, sv, 'ember band 0.055');
    svg('text', { x: x0, y: SH - 8, class: 'dg-t' }, sv, 'left edge');
    svg('text', { x: x1, y: SH - 8, 'text-anchor': 'end', class: 'dg-t' }, sv, 'right edge');
    svg('text', { x: (x0 + x1) / 2, y: SH - 8, 'text-anchor': 'middle', class: 'dg-t' }, sv, `n along row ${row.toFixed(2)}`);
    /* the curve, in three kinds: thrown away, in the band, drawn */
    const S = 260;
    let cur = null, d = '';
    const flush = () => { if (d) svg('path', { d, class: cur === 'h' ? 'xs-hidden' : cur === 'b' ? 'xs-ember' : 'dg-ink' }, sv); d = ''; };
    let drawn = 0, opaque = 0, prev = null;
    for (let i = 0; i <= S; i++) {
      const u = i / S, n = nField(u, row);
      const kind = n > prog ? 'h' : n > prog - EDGE ? 'b' : 'd';
      const pt = X(u).toFixed(1) + ' ' + Y(n).toFixed(1);
      if (kind !== cur) { flush(); cur = kind; d = prev ? 'M' + prev + 'L' + pt : 'M' + pt; } else d += 'L' + pt;
      prev = pt;
    }
    flush();
    const j = Math.round(row * (GH - 1));
    for (let i = 0; i < GW; i++) {
      const k = j * GW + i;
      if (pix && pix[k * 4 + 3] >= 8) { opaque++; if (field[k] <= prog) drawn++; }
    }
    rd('v').textContent = row.toFixed(2);
    rd('b').textContent = num(-row * 0.3, 3);
    rd('p').textContent = num(prog, 2);
    rd('d').textContent = opaque ? Math.round((drawn / opaque) * 100) + '%' : '0%';
    progOut.textContent = num(prog, 2);
    progIn.value = String(Math.round(prog * 1000));
    cv.setAttribute('aria-valuenow', String(Math.round(row * 100)));
  }
  const setRow = (e) => { const r = cv.getBoundingClientRect(); row = clamp((e.clientY - r.top) / r.height, 0, 1); render(); };
  cv.addEventListener('pointerdown', (e) => {
    setRow(e);
    if (e.pointerType !== 'mouse') return;
    cv.setPointerCapture(e.pointerId);
    const mv = (ev) => setRow(ev);
    const up = () => { cv.removeEventListener('pointermove', mv); cv.removeEventListener('pointerup', up); };
    cv.addEventListener('pointermove', mv);
    cv.addEventListener('pointerup', up);
  });
  cv.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowUp' ? -0.02 : e.key === 'ArrowDown' ? 0.02 : 0;
    if (!d) return;
    e.preventDefault();
    row = clamp(row + d, 0, 1);
    render();
  });
  progIn.addEventListener('input', () => { playing = false; prog = progIn.value / 1000; render(); });
  playBtn.addEventListener('click', () => { // main.js:2121-2139, played on request
    prog = -0.35;
    tSec = 0;
    playing = true;
    Study.raf((t, dt) => {
      if (!playing) return false;
      tSec += dt;
      const d = 1.15 - prog;
      if (Math.abs(d) > 0.0004) prog += d * (1 - (1 - 0.016) ** (dt * 60));
      else { prog = 1.15; playing = false; }
      rd('t').textContent = tSec.toFixed(2) + 's';
      render();
      if (!playing) return false;
    });
  });
  onResize(() => { if (built) plot(); });
  Study.onVisible(fig, () => { if (!field) { field = 1; build(); } }, null, '400px 0px');
}

/* ============================================================
   FIG. 7: HIDDEN THINGS. main.js:164-193 (greeting), 489-563
   (counter), 565-615 (campus), 2173-2197 (magnet), 2199-2332 (form).
   ============================================================ */
function initEggs() {
  const fig = $('#eggs-fig');
  if (!fig) return;
  const rd = (k) => $(`[data-egg-r="${k}"]`, fig);

  /* greeting */
  const GREETINGS = ['Hello', '¡Hola!', 'Bonjour', 'Ciao', 'Hallo', 'Olá', 'Привет', 'مرحبا', 'こんにちは', '안녕하세요', 'नमस्ते', 'नमस्कार', 'Merhaba', '你好', 'Sawubona', 'Salut'];
  const greet = $('[data-greet]', fig);
  let gi = 0, visible = false;
  const cycle = (silent) => {
    if (!silent) Sound.play('tick', true);
    gi = (gi + 1) % GREETINGS.length;
    rd('g').textContent = `${gi + 1} of ${GREETINGS.length}`;
    if (R) { greet.textContent = GREETINGS[gi]; return; }
    to(greet, { o: 0, y: -6 }, { dur: 0.14, ease: Ease['power2.in'], done() { greet.textContent = GREETINGS[gi]; put(greet, { o: 0, y: 6 }); to(greet, { o: 1, y: 0 }, { dur: 0.2, ease: Ease['power2.out'] }); } });
  };
  greet.addEventListener('click', () => cycle(false));
  setInterval(() => { if (visible && !R && !document.hidden) cycle(true); }, 5000);

  /* the counter */
  const counter = $('[data-flip]', fig);
  const TARGETS = [2, 0, 0, 0, '+'], CYCLES = 2, DURATIONS = [1.65, 1.2, 2.05, 1.85, 0];
  const digits = $$('.flip-digit', counter);
  digits.forEach((d, i) => {
    const target = TARGETS[i];
    if (typeof target === 'string') { d.textContent = target; return; }
    const strip = document.createElement('span');
    strip.className = 'flip-strip';
    for (let c = 0; c < CYCLES; c++) for (let n = 0; n <= 9; n++) { const s = document.createElement('span'); s.textContent = n; strip.appendChild(s); }
    for (let n = 0; n <= target; n++) { const s = document.createElement('span'); s.textContent = n; strip.appendChild(s); }
    d.appendChild(strip);
  });
  const strips = digits.map((d) => $('.flip-strip', d));
  let busy = false, odoT0 = -1;
  function runTicker() {
    if (busy) return;
    busy = true;
    const first = $('.flip-strip span', counter);
    const TILE = first ? first.getBoundingClientRect().height : 20;
    strips.forEach((s) => { if (s) put(s, { y: 0, o: 1 }); });
    setTimeout(() => {
      strips.forEach((s, i) => { if (s) to(s, { y: -(s.children.length - 1) * TILE }, { dur: DURATIONS[i], ease: Ease['power3.out'] }); });
      odoT0 = now();
      odoLoop();
      setTimeout(() => { busy = false; }, (Math.max(...DURATIONS) + 0.4) * 1000);
    }, 50);
  }
  counter.addEventListener('click', runTicker); // main.js:554, no sound
  const io = new IntersectionObserver(([e]) => { if (!e.isIntersecting) return; io.disconnect(); runTicker(); }, { threshold: 0.5 });
  io.observe(counter);

  /* the counter's timing, drawn */
  const odo = $('.odo-svg', fig);
  let OW = 720, dots = [];
  const OH = 5 * 32 + 34;
  function drawOdo() {
    OW = fit(odo, OH, 720);
    const x0 = 128, x1 = OW - 46, TM = 2.1;
    const X = (t) => x0 + (t / TM) * (x1 - x0);
    [0, 0.5, 1, 1.5, 2].forEach((t) => {
      svg('line', { x1: X(t), x2: X(t), y1: 8, y2: OH - 22, class: 'dg-grid' }, odo);
      svg('text', { x: X(t), y: OH - 6, 'text-anchor': 'middle', class: 'dg-t' }, odo, t + 's');
    });
    dots = [];
    TARGETS.forEach((tg, i) => {
      const yb = 8 + (i + 1) * 32 - 6, yt = yb - 22;
      const tiles = typeof tg === 'string' ? 0 : CYCLES * 10 + tg + 1;
      svg('text', { x: 0, y: yb - 6, class: 'dg-t dg-t--ink' }, odo, typeof tg === 'string' ? `'+'  static` : `${tg}  ${tiles} tiles`);
      if (!DURATIONS[i]) return;
      svg('line', { x1: X(0), x2: X(DURATIONS[i]), y1: yb, y2: yb, class: 'dg-axis' }, odo);
      let d = '';
      for (let k = 0; k <= 40; k++) { const p = k / 40; d += (k ? 'L' : 'M') + X(p * DURATIONS[i]).toFixed(1) + ' ' + (yb - Ease['power3.out'](p) * (yb - yt)).toFixed(1); }
      svg('path', { d, class: 'dg-ink' }, odo);
      svg('text', { x: X(DURATIONS[i]) + 5, y: yt + 4, class: 'dg-t' }, odo, DURATIONS[i] + 's');
      dots[i] = { c: svg('circle', { r: 3.5, cx: X(DURATIONS[i]), cy: yt, class: 'dg-fill-tint' }, odo), X, yb, yt };
    });
    svg('text', { x: 0, y: 4, class: 'dg-t' }, odo, 'digit  strip');
  }
  function odoLoop() {
    Study.raf(() => {
      const t = (now() - odoT0) / 1000;
      dots.forEach((d, i) => {
        if (!d) return;
        const p = clamp(t / DURATIONS[i], 0, 1);
        d.c.setAttribute('cx', d.X(p * DURATIONS[i]));
        d.c.setAttribute('cy', d.yb - Ease['power3.out'](p) * (d.yb - d.yt));
      });
      if (t > 2.1) return false;
    });
  }
  drawOdo();
  onResize(drawOdo);

  /* the campus field */
  const input = $('.campus-in', fig), wrap = input.closest('.campus-wrap'), wink = $('.campus-wink', wrap);
  const FOUNDER_CAMPUSES = [
    { match: ['georgia tech', 'gatech', 'gt', 'georgia institute of technology'], name: 'Saleena', img: 'cohort/saleena.webp', note: 'saleena built this here 🐝' },
    { match: ['liverpool', 'uni of liverpool', 'university of liverpool', 'uol'], name: 'Seyi', img: 'cohort/seyi.webp', note: 'seyi built this here ⚽' },
  ];
  let winking = false;
  input.addEventListener('input', () => {
    const w = Math.max(14, input.value.length + 1);
    input.style.width = w + 'ch';
    rd('w').textContent = w + 'ch';
    const v = input.value.trim().toLowerCase();
    const hit = FOUNDER_CAMPUSES.find((c) => c.match.includes(v));
    if (hit) {
      if (!winking) { Sound.play('pop', true); wink.innerHTML = `<img src="${hit.img}" alt="" width="28" height="28"><span>${hit.note}</span>`; }
      wrap.classList.add('wink');
      winking = true;
    } else { wrap.classList.remove('wink'); winking = false; }
  });

  /* the button: magnet, then the join */
  const form = $('.egg-form', fig), email = $('.email-in', fig), btn = $('.submit-btn', fig), label = $('.btn-label', btn), status = $('.egg-status', fig);
  const mx = quick(0.45, Ease['power3.out']), my = quick(0.45, Ease['power3.out']);
  const look = { s: 1 };
  let magLoop = false;
  const paintBtn = () => {
    const x = mx.get(), y = my.get();
    btn.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${look.s.toFixed(4)})`;
    rd('m').textContent = `${num(x, 1)}, ${num(y, 1)}`;
  };
  const runMag = () => {
    if (magLoop) return;
    magLoop = true;
    Study.raf(() => { paintBtn(); if (mx.done && my.done) { magLoop = false; return false; } });
  };
  if (!R) {
    btn.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = btn.getBoundingClientRect();
      mx.set((e.clientX - (r.left + r.width / 2)) * 0.38);
      my.set((e.clientY - (r.top + r.height / 2)) * 0.38);
      runMag();
    });
    btn.addEventListener('pointerleave', () => { mx.set(0); my.set(0); runMag(); });
  }
  const PALETTE = { // main.js:2281-2286
    night: ['#ffffff', '#d0d8ff', '#1C34F5', '#a0b0ff'],
    morning: ['#FFE8A0', '#FFCA60', '#FF9A3C', '#fff3d0'],
    day: ['#FFF8D0', '#1C34F5', '#ffffff', '#d0e8ff'],
    evening: ['#FF9A3C', '#FF6010', '#FFB870', '#FFE0A0'],
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { // main.js:2220
      email.setAttribute('aria-invalid', 'true');
      const s = state(email);
      if (!R) tween({ dur: 0.38, ease: Ease['power2.inOut'], update(k, p) { const ks = [0, -7, 7, -5, 5, -2, 2, 0]; const f = p * (ks.length - 1), i = Math.floor(f), fr = f - i; s.x = ks[i] + ((ks[i + 1] ?? 0) - ks[i]) * fr; email.style.transform = `translateX(${s.x}px)`; } });
      Sound.play('tick', true);
      status.textContent = 'Use a valid university email address.';
      return;
    }
    email.removeAttribute('aria-invalid');
    Sound.unlock();
    btn.disabled = true;
    label.textContent = 'Joining…';
    status.textContent = '';
    setTimeout(() => {
      btn.classList.add('done');
      status.textContent = 'Nothing was sent from here. On the real page, you’d be on the list now.';
      Sound.play('joined', true);
      const r = btn.getBoundingClientRect();
      const ox = (r.left + r.width / 2) / innerWidth, oy = (r.top + r.height / 2) / innerHeight;
      const colors = PALETTE[vibe()] || PALETTE.night;
      Confetti.fire({ origin: { x: ox, y: oy }, particleCount: 55, spread: 60, startVelocity: 28, ticks: 260, colors });
      setTimeout(() => Confetti.fire({ origin: { x: ox, y: oy - 0.04 }, particleCount: 35, spread: 110, startVelocity: 18, ticks: 220, colors, gravity: 0.75 }), 120);
      if (!R) {
        tween({ dur: 0.18, ease: Ease['power2.out'], update(k) { look.s = 0.96 + 0.08 * k; paintBtn(); }, done() { tween({ dur: 0.28, ease: elasticOut(1, 0.5), update(k) { look.s = 1.04 - 0.04 * k; paintBtn(); } }); } });
      }
      setTimeout(() => { btn.classList.remove('done'); btn.disabled = false; label.textContent = 'Get early access'; }, 3600);
    }, 450);
  });

  Study.onVisible(fig, () => { visible = true; }, () => { visible = false; }, '0px');
}

/* ============================================================
   FIG. 8: THE SKY. main.js:1396-1713. The site picks the layer from
   the time of day; here the reader picks it, and the stars are drawn
   in the page's ink so they show on a light page too.
   ============================================================ */
function initSky() {
  const fig = $('#sky-fig');
  if (!fig) return;
  const cv = $('.sky-cv', fig), line = $('.sky-line', fig);
  const nightBtn = $('[data-sky-night]', fig), shootBtn = $('[data-sky-shoot]', fig);
  const rd = (k) => $(`[data-sky-r="${k}"]`, fig);
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, stars = [], trail = [], floaters = [], shootStar = null, shootTimer = 0, running = false, visible = false, playing = !R, acc = 0, ts = 0;
  let layer = 'stars', sk = 0, launches = [], sets = [], ink = [240, 237, 232], traceInk = '#8E897C';
  const randomShootDelay = () => 15000 + Math.random() * 20000; // main.js:1412
  const readInk = () => {
    const cs = getComputedStyle(fig);
    const hex = (cs.getPropertyValue('--ink') || '#1A1A14').trim().replace('#', '');
    ink = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    traceInk = cs.getPropertyValue('--ink-3').trim() || traceInk;
  };
  const rgba = (a) => `rgba(${ink[0]},${ink[1]},${ink[2]},${a})`;
  function size() {
    const r = cv.getBoundingClientRect();
    W = r.width; H = r.height;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    stars = Array.from({ length: 72 }, () => ({ // main.js:1420-1429
      x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.1 + 0.3,
      phase: Math.random() * Math.PI * 2, speed: Math.random() * 0.018 + 0.004, base: Math.random() * 0.45 + 0.18,
    }));
  }
  const newFloater = (isEmber, randY) => ({ // main.js:1435-1447
    x: Math.random() * W, y: randY ? Math.random() * H : H + 10,
    r: isEmber ? Math.random() * 1.9 + 0.9 : Math.random() * 1.4 + 0.4,
    vx: (Math.random() - 0.5) * 0.35, vy: -(Math.random() * 0.45 + 0.12),
    life: randY ? Math.random() : 1, maxL: Math.random() * 220 + 120, flick: Math.random() * Math.PI * 2, isEmber,
    path: [], k: 0,
  });
  function initLayer() { // main.js:1450-1456
    floaters = layer === 'embers' ? Array.from({ length: 8 }, () => newFloater(true, true)) : layer === 'dust' ? Array.from({ length: 11 }, () => newFloater(false, true)) : [];
    shootTimer = randomShootDelay();
    shootStar = null;
    trail = [];
    sets = layer === 'stars' ? [sk] : [];
    launches = [];
    shootBtn.hidden = layer !== 'stars';
    $$('[data-layer]', fig).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layer === layer)));
    rd('layer').textContent = layer;
    rd('n').textContent = layer === 'stars' ? '72' : String(floaters.length);
    drawLine();
  }
  function drawStars() {
    stars.forEach((s) => {
      const op = s.base + Math.sin(ts * s.speed + s.phase) * 0.18;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = rgba(Math.max(0, op)); ctx.fill();
    });
  }
  function stepTrail() {
    for (let i = trail.length - 1; i >= 0; i--) { const p = trail[i]; p.life -= p.decay; p.x += p.vx; p.y += p.vy; if (p.life <= 0) trail.splice(i, 1); }
  }
  function drawTrail() {
    trail.forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0, p.r * p.life), 0, Math.PI * 2); ctx.fillStyle = rgba(p.life * 0.65); ctx.fill(); });
  }
  function stepShooting(dtMs) { // main.js:1509-1534
    shootTimer -= dtMs;
    if (shootTimer <= 0 && !shootStar) {
      shootStar = { x: Math.random() * W * 0.6, y: Math.random() * H * 0.4, vx: 5 + Math.random() * 4, vy: 2 + Math.random() * 2, life: 1 };
      shootTimer = randomShootDelay();
      launches.push(sk);
      sets.push(sk);
      if (launches.length > 12) launches.shift();
      if (sets.length > 12) sets.shift();
    }
    if (!shootStar) return;
    shootStar.x += shootStar.vx; shootStar.y += shootStar.vy; shootStar.life -= 0.022;
    if (shootStar.life <= 0 || shootStar.x > W + 50) shootStar = null;
  }
  function drawShooting() {
    const s = shootStar;
    if (!s) return;
    const grad = ctx.createLinearGradient(s.x - s.vx * 8, s.y - s.vy * 8, s.x, s.y);
    grad.addColorStop(0, rgba(0));
    grad.addColorStop(1, rgba(s.life * 0.9));
    ctx.strokeStyle = grad; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(s.x - s.vx * 14, s.y - s.vy * 14); ctx.lineTo(s.x, s.y); ctx.stroke();
  }
  function stepFloaters() { // main.js:1536-1575
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.life -= 1 / f.maxL;
      f.x += f.vx + Math.sin(ts * 0.0008 + f.flick) * 0.15;
      f.y += f.vy;
      f.flick += 0.04;
      if (++f.k % 3 === 0) { f.path.push(f.x, f.y); if (f.path.length > 160) f.path.splice(0, 2); }
      if (f.life <= 0 || f.y < -10) floaters[i] = newFloater(f.isEmber, false);
    }
  }
  function drawFloaters() {
    /* not on the site: each particle's last 4 seconds of path, so the drift and the wobble can be seen */
    ctx.lineWidth = 1;
    ctx.strokeStyle = traceInk;
    ctx.globalAlpha = 0.5;
    floaters.forEach((f) => {
      if (f.path.length < 4) return;
      ctx.beginPath();
      ctx.moveTo(f.path[0], f.path[1]);
      for (let i = 2; i < f.path.length; i += 2) ctx.lineTo(f.path[i], f.path[i + 1]);
      ctx.lineTo(f.x, f.y);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    floaters.forEach((f) => {
      const op = Math.min(1, (1 - f.life) * 6) * Math.min(1, f.life * 5) * (f.isEmber ? 0.7 : 0.45);
      if (f.isEmber) {
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 2.5);
        g.addColorStop(0, `rgba(255,180,60,${op})`); g.addColorStop(1, 'rgba(255,80,10,0)');
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 2.5, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fillStyle = `rgba(255,220,140,${op * 0.9})`; ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = vibe() === 'morning' ? `rgba(200,140,60,${op})` : `rgba(180,180,160,${op})`;
        ctx.fill();
      }
    });
  }
  function frame() {
    ctx.clearRect(0, 0, W, H);
    if (layer === 'stars') { drawStars(); drawTrail(); drawShooting(); } else drawFloaters();
  }
  function loop() {
    if (running) return;
    running = true;
    let lastLine = 0;
    Study.raf((t, dt) => {
      if (!visible || !playing) { running = false; frame(); return false; }
      acc += dt;
      let n = 0;
      while (acc >= 1 / 60 && n < 4) {
        acc -= 1 / 60; n++;
        ts += 1000 / 60;
        if (layer === 'stars') { sk += 1 / 60; stepTrail(); stepShooting(1000 / 60); } else stepFloaters();
      }
      frame();
      if (t - lastLine > 100) { lastLine = t; drawLine(); }
    });
  }
  /* the schedule: a rolling window, 50 seconds back and 40 ahead */
  function drawLine() {
    const LH = 64;
    const LW = fit(line, LH, 1120);
    if (layer !== 'stars') {
      svg('text', { x: LW / 2, y: 30, 'text-anchor': 'middle', class: 'dg-t' }, line, 'Shooting stars only come with the stars.');
      rd('next').textContent = 'none';
      return;
    }
    const x0 = 8, x1 = LW - 8, A = sk - 50, B = sk + 40;
    const X = (t) => x0 + ((t - A) / (B - A)) * (x1 - x0);
    svg('line', { x1: x0, x2: x1, y1: 40, y2: 40, class: 'dg-axis' }, line);
    sets.forEach((s) => {
      const a = Math.max(A, s + 15), b = Math.min(B, s + 35);
      if (b <= a) return;
      svg('rect', { x: X(a), y: 30, width: X(b) - X(a), height: 20, class: 'dg-band' }, line);
      if (s + 15 >= A) svg('line', { x1: X(s + 15), x2: X(s + 15), y1: 30, y2: 50, class: 'dg-grid' }, line);
      if (s + 35 <= B) svg('line', { x1: X(s + 35), x2: X(s + 35), y1: 30, y2: 50, class: 'dg-grid' }, line);
    });
    launches.forEach((l) => { if (l >= A) svg('line', { x1: X(l), x2: X(l), y1: 22, y2: 50, class: 'dg-ink' }, line); });
    const nextAt = sk + shootTimer / 1000;
    svg('circle', { cx: X(nextAt), cy: 40, r: 4, class: 'dg-fill-tint' }, line);
    svg('text', { x: X(nextAt), y: 16, 'text-anchor': 'middle', class: 'dg-t dg-t--tint' }, line, 'next');
    svg('line', { x1: X(sk), x2: X(sk), y1: 26, y2: 54, class: 'dg-tint' }, line);
    svg('text', { x: X(sk), y: LH - 1, 'text-anchor': 'middle', class: 'dg-t dg-t--ink' }, line, 'now');
    svg('text', { x: x0, y: LH - 1, class: 'dg-t' }, line, '−50s');
    svg('text', { x: x1, y: LH - 1, 'text-anchor': 'end', class: 'dg-t' }, line, '+40s');
    rd('next').textContent = `in ${(shootTimer / 1000).toFixed(1)}s`;
  }
  cv.addEventListener('pointermove', (e) => { // main.js:1683-1697
    if (layer !== 'stars' || !playing) return;
    const r = cv.getBoundingClientRect();
    if (Math.random() < 0.28) trail.push({ x: e.clientX - r.left + (Math.random() - 0.5) * 5, y: e.clientY - r.top + (Math.random() - 0.5) * 5, r: Math.random() * 1.8 + 0.5, life: 1, decay: 0.032 + Math.random() * 0.02, vx: (Math.random() - 0.5) * 0.4, vy: -Math.random() * 0.5 - 0.1 });
  });
  $$('[data-layer]', fig).forEach((b) => b.addEventListener('click', () => { layer = b.dataset.layer; if (W) { initLayer(); frame(); } }));
  nightBtn.addEventListener('click', () => setVibe('night'));
  shootBtn.addEventListener('click', () => { shootTimer = 0; if (!playing) { playing = true; loop(); } });
  if (R) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'link-btn'; b.textContent = 'Play';
    b.addEventListener('click', () => { playing = !playing; b.textContent = playing ? 'Pause' : 'Play'; if (playing) loop(); });
    $('.ctl', fig).prepend(b);
  }
  const syncNight = () => { nightBtn.hidden = vibe() === 'night'; readInk(); if (W) frame(); };
  document.addEventListener('cohort:vibe', syncNight);
  syncNight();
  onResize(() => { size(); initLayer(); frame(); });
  Study.onVisible(fig, () => {
    visible = true;
    if (!W) { size(); initLayer(); }
    frame();
    loop();
  }, () => { visible = false; });
}

/* ============================================================
   FIG. 9: THE SOUND KIT.
   ============================================================ */
function initSoundKit() {
  const fig = $('#sound-fig');
  if (!fig) return;
  const s = $('.sound-svg', fig), say = $('.sound-say', fig);
  const SAY = {
    hover: '<b>hover.</b> 1 sine tone at 900 hertz, 40 milliseconds long. Pointing at a chip.',
    tick: '<b>tick.</b> 680 hertz, then 500 hertz 50 milliseconds later. Closing a chip, changing the greeting, a mistyped email.',
    pop: '<b>pop.</b> 780 hertz, then 1,020 hertz 60 milliseconds later. Opening a chip, the campus wink, a pull on the lamp.',
    party: '<b>party.</b> C E G C, 80 milliseconds apart. "best years", friends and roommates.',
    heaven: '<b>Cohort.</b> C E G C E with a quiet octave over each note, then a high G at 0.42 seconds.',
    key: '<b>key.</b> A click of noise filtered somewhere between 2,400 and 3,800 hertz, over a low thock. Different every time.',
    on: '<b>light on.</b> A 28 millisecond crack of noise at 1,900 hertz, a 95 hertz thud, and a 120 hertz hum.',
    off: '<b>light off.</b> The same crack a little quieter, a 75 hertz thud, and no hum.',
    joined: '<b>joined.</b> C E G C E, rising over half a second, after you join.',
  };
  let last = 'heaven', score = SCORES.heaven();
  const draw = () => drawRoll(s, score);
  $$('[data-snd]', fig).forEach((b) => b.addEventListener('click', () => {
    last = b.dataset.snd;
    score = Sound.play(last, true);
    $$('[data-snd]', fig).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    say.innerHTML = SAY[last];
    draw();
    playhead(s);
  }));
  $$('[data-snd]', fig).forEach((x) => x.setAttribute('aria-pressed', 'false'));
  onResize(draw);
  Study.onVisible(fig, draw, null, '300px 0px');
}

/* ---------- go ---------- */
[initSoundToggles, initBurn, initChapters, initLamp, initChips, initEffects, initNoise, initEggs, initSky, initSoundKit].forEach((fn) => {
  try { fn(); } catch (e) { console.warn('cohort figure failed:', fn.name, e); }
});
