/* Fig. 3: Flow's prompt box and its timing.
   Port of components/customer/FlowCreator.tsx:9-61 (useTypewriterPlaceholder) and the
   textarea's Enter handling (FlowCreator.tsx:157-169). The original chains setTimeouts;
   here the same tick() runs off a virtual clock so the diagram's playhead can never
   drift from the text. Every delay is the original's: 35, 1800, 18, 400. */
import { S, $, svgEl, clamp, fmt, playGate } from "./util.js";

export const EXAMPLE_PROMPTS = [ // FlowCreator.tsx:9-15
  "Sell tickets to my Saturday event — VIP ₦10,000 (cap 20), Regular ₦4,000 (cap 100)",
  "Create a payment page for hackathon tickets, ₦5,000, cap 100",
  "Sell my ebook for ₦2,500",
  "Workshop seats at ₦7,500 each, 40 spots",
  "Pre-order my sneakers, ₦15,000, limited to 50 pairs",
];

const TYPE = 35, HOLD = 1800, DEL = 18, WAIT = 400;
const span = (n) => ({ type: (n - 1) * TYPE, hold: HOLD, del: (n - 1) * DEL, wait: WAIT, total: (n - 1) * (TYPE + DEL) + HOLD + WAIT });

export function initTypewriter(fig) {
  const ta = $(".ft-input", fig), go = $(".ft-go", fig), said = $(".ft-said", fig), svg = $(".ft-svg", fig);
  const R = { ex: $("[data-ft=ex]", fig), ch: $("[data-ft=ch]", fig), ph: $("[data-ft=ph]", fig), next: $("[data-ft=next]", fig) };
  const examples = EXAMPLE_PROMPTS;

  // ---- the port ----
  let clock = 0, nextAt = 0, firedAt = 0;
  let exampleIndex = 0, charIndex = 0, deleting = false, enabled = true;
  let cycleStart = null, cycleEx = 0;
  const setText = (t) => { ta.placeholder = t; };
  const schedule = (ms) => { nextAt = firedAt + ms; };
  function tick() { // FlowCreator.tsx:36-54, line for line
    const current = examples[exampleIndex];
    if (!deleting) {
      charIndex++;
      setText(current.slice(0, charIndex));
      schedule(charIndex === current.length ? 1800 : 35);
      if (charIndex === current.length) deleting = true;
      if (charIndex === 1) { cycleStart = firedAt; cycleEx = exampleIndex; }
    } else {
      charIndex--;
      setText(current.slice(0, charIndex));
      if (charIndex === 0) {
        deleting = false;
        exampleIndex = (exampleIndex + 1) % examples.length;
        schedule(400);
      } else {
        schedule(18);
      }
    }
  }
  const restart = (k = 0) => { // the effect re-running: FlowCreator.tsx:28-58
    exampleIndex = k; charIndex = 0; deleting = false; cycleStart = null; cycleEx = k;
    firedAt = clock; schedule(35); // timeoutId = setTimeout(tick, 35)
  };
  const advance = (ms) => {
    clock += ms;
    while (enabled && clock >= nextAt) { firedAt = nextAt; tick(); }
  };

  // ---- the box ----
  const create = () => { // FlowCreator.tsx:92-93
    if (!ta.value.trim()) return;
    said.textContent = "In Wire, this sends your sentence to /api/flow. The copy on this page stops here: it doesn't call the model.";
  };
  ta.addEventListener("input", () => {
    const has = ta.value.length > 0;
    go.disabled = !ta.value.trim();
    if (!ta.value) said.textContent = "";
    if (has && enabled) { enabled = false; } // useTypewriterPlaceholder(EXAMPLE_PROMPTS, !prompt)
    else if (!has && !enabled) { enabled = true; restart(0); }
    paint();
  });
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); create(); } });
  go.addEventListener("click", create);

  // ---- the diagram ----
  let W = 0, H = 226, parts = {};
  const BASE = 116, TOP = 26;
  const build = () => {
    W = Math.max(280, svg.getBoundingClientRect().width);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = "";
    parts.fill = svgEl("path", { class: "fill" }, svg);
    parts.segs = svgEl("g", {}, svg);
    svgEl("line", { class: "ax ax--ink", x1: 0, x2: W, y1: BASE, y2: BASE }, svg);
    parts.curve = svgEl("path", { class: "curve" }, svg);
    parts.top = svgEl("text", { class: "num", x: 0, y: 12 }, svg);
    parts.total = svgEl("text", { class: "num", x: W, y: 12, "text-anchor": "end" }, svg);
    parts.labels = svgEl("g", {}, svg);
    parts.head = svgEl("line", { class: "head", y1: TOP - 8, y2: BASE }, svg);
    parts.dot = svgEl("circle", { class: "dot", r: 4.5 }, svg);
    // the whole loop of 5, as small marks you can pick
    parts.loop = svgEl("g", {}, svg);
    const gap = 12, LY = 204, LH = 20;
    const tot = examples.reduce((s, e) => s + span(e.length).total, 0);
    const avail = W - gap * (examples.length - 1);
    let x = 0;
    parts.ex = examples.map((e, i) => {
      const sp = span(e.length), w = (sp.total / tot) * avail;
      const g = svgEl("g", { class: "ex", tabindex: 0, role: "button", "aria-label": `Jump to example ${i + 1}: ${e}` }, parts.loop);
      svgEl("rect", { x: x - 3, y: LY - LH - 16, width: w + 6, height: LH + 34, rx: 3 }, g);
      const X = (t) => x + (t / sp.total) * w;
      svgEl("path", { d: `M${X(0)},${LY - LH / e.length} L${X(sp.type)},${LY - LH} L${X(sp.type + HOLD)},${LY - LH} L${X(sp.type + HOLD + sp.del)},${LY} L${X(sp.total)},${LY}` }, g);
      svgEl("text", { class: "num", x, y: LY + 14 }, g).textContent = String(i + 1);
      const pick = () => { if (ta.value) { ta.value = ""; go.disabled = true; said.textContent = ""; enabled = true; } restart(i); if (!running) startClock(); paint(); };
      g.addEventListener("click", pick);
      g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pick(); } });
      const r = { g, x, w, sp };
      x += w + gap;
      return r;
    });
    parts.loopHead = svgEl("line", { class: "head", y1: LY - LH - 6, y2: LY + 2 }, svg);
    parts.drawn = -1;
    paint();
  };

  const shape = (k) => {
    const n = examples[k].length, sp = span(n);
    const X = (t) => (t / sp.total) * W;
    const Y = (c) => BASE - (c / n) * (BASE - TOP);
    const t1 = sp.type, t2 = t1 + HOLD, t3 = t2 + sp.del;
    const d = `M0,${Y(1)} L${X(t1)},${Y(n)} L${X(t2)},${Y(n)} L${X(t2)},${Y(n - 1)} L${X(t3)},${Y(0)} L${W},${Y(0)}`;
    parts.curve.setAttribute("d", d);
    parts.fill.setAttribute("d", `${d} L${W},${BASE} L0,${BASE} Z`);
    parts.segs.innerHTML = "";
    [t1, t2, t3].forEach((t) => svgEl("line", { class: "seg", x1: X(t), x2: X(t), y1: TOP - 6, y2: BASE + 6 }, parts.segs));
    parts.top.textContent = `${n} characters`;
    parts.total.textContent = `${fmt(sp.total)}ms`;
    // labels, centred on their segments, nudged apart where a segment is too thin
    parts.labels.innerHTML = "";
    const L = [
      ["type", `${n - 1} × 35ms`, 0, t1], ["hold", "1,800ms", t1, t2],
      ["delete", `${n - 1} × 18ms`, t2, t3], ["wait", "400ms", t3, sp.total],
    ].map(([a, b, s, e]) => ({ a, b, cx: X((s + e) / 2), w: Math.max(a.length, b.length) * 6.6 + 6 }));
    for (let i = 1; i < L.length; i++) { const min = L[i - 1].cx + (L[i - 1].w + L[i].w) / 2; if (L[i].cx < min) L[i].cx = min; }
    const last = L[L.length - 1]; if (last.cx + last.w / 2 > W) last.cx = W - last.w / 2;
    for (let i = L.length - 2; i >= 0; i--) { const max = L[i + 1].cx - (L[i + 1].w + L[i].w) / 2; if (L[i].cx > max) L[i].cx = max; }
    if (L[0].cx - L[0].w / 2 < 0) L[0].cx = L[0].w / 2;
    L.forEach((l) => {
      svgEl("text", { class: "lab lab--ink", x: l.cx, y: BASE + 22, "text-anchor": "middle" }, parts.labels).textContent = l.a;
      svgEl("text", { class: "num", x: l.cx, y: BASE + 38, "text-anchor": "middle" }, parts.labels).textContent = l.b;
    });
    parts.drawn = k;
  };

  let lastRead = "";
  function paint() {
    if (!W) return;
    const k = cycleStart === null ? exampleIndex : cycleEx;
    if (parts.drawn !== k) shape(k);
    const n = examples[k].length, sp = span(n);
    const el = cycleStart === null ? 0 : clamp(clock - cycleStart, 0, sp.total);
    const x = (el / sp.total) * W;
    const c = cycleStart === null ? 0 : charIndex;
    const y = BASE - (c / n) * (BASE - TOP);
    parts.head.setAttribute("x1", x); parts.head.setAttribute("x2", x);
    parts.dot.setAttribute("cx", x); parts.dot.setAttribute("cy", y);
    parts.ex.forEach((e, i) => e.g.classList.toggle("is-on", i === k));
    const e = parts.ex[k], lx = e.x + (el / sp.total) * e.w;
    parts.loopHead.setAttribute("x1", lx); parts.loopHead.setAttribute("x2", lx);
    // readout
    const len = examples[exampleIndex].length;
    const ph = !enabled ? "stopped, you're typing"
      : deleting && charIndex === len ? "holding"
      : deleting ? "deleting"
      : charIndex === 0 ? "waiting" : "typing";
    const read = `${k + 1}|${charIndex}/${len}|${ph}|${enabled ? Math.max(0, Math.round(nextAt - clock)) + "ms" : "none"}`;
    if (read !== lastRead) {
      lastRead = read;
      const [a, b, p, nx] = read.split("|");
      R.ex.textContent = `${a} of 5`; R.ch.textContent = b; R.ph.textContent = p; R.next.textContent = nx;
    }
  }

  let running = false, visible = false, built = false;
  const loop = (t, dt) => {
    if (!running || !visible) return false;
    advance(dt * 1000);
    paint();
  };
  const startClock = () => { running = true; if (visible) S().raf(loop); };

  // reduced motion: the first example sits fully typed until Play
  if (S().reduce) {
    setText(examples[0]); charIndex = examples[0].length; deleting = true; cycleStart = 0; cycleEx = 0;
    clock = span(examples[0].length).type + 1; firedAt = clock; nextAt = Infinity;
    playGate($("[data-ft-play]", fig), () => { restart(0); startClock(); });
  } else {
    restart(0);
    running = true;
  }

  S().onVisible(fig, () => {
    if (!built) { built = true; build(); new ResizeObserver(() => { const w = svg.getBoundingClientRect().width; if (Math.abs(w - W) > 1) build(); }).observe(svg); }
    visible = true;
    if (running) S().raf(loop);
  }, () => { visible = false; });
}
