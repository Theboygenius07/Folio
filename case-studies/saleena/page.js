/* Saleena case study: the live figures.
   Each one is ported from the live site's own components, with the site's own
   timings, sizes and colours. */

const S = window.Study || { reduce: matchMedia("(prefers-reduced-motion: reduce)").matches, hover: matchMedia("(hover: hover)").matches, onVisible: (el, a) => a && a(), raf: (fn) => { const f = (t) => { if (fn(t, 1 / 60) !== false) requestAnimationFrame(f); }; requestAnimationFrame(f); } };
const REDUCE = S.reduce;
const NS = "http://www.w3.org/2000/svg";
const DPR = Math.min(2, window.devicePixelRatio || 1); // nothing here draws to a canvas, but keep the cap for any raster work
void DPR;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const svgEl = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const minus = (s) => String(s).replace("-", "−");
const fmt = (v, d = 1) => minus((Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d));

/* GSAP, pinned, loaded only when a figure that needs it comes near the screen */
let gsapP;
const loadGsap = () => gsapP || (gsapP = new Promise((res, rej) => {
  if (window.gsap) return res(window.gsap);
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js";
  s.onload = () => res(window.gsap);
  s.onerror = rej;
  document.head.appendChild(s);
}));

/* CSS `ease` is cubic-bezier(0.25, 0.1, 0.25, 1). y for a given x, by bisection. */
const bez = (p1, p2) => (t) => 3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t;
const bx = bez(0.25, 0.25), by = bez(0.1, 1);
const cssEase = (x) => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let lo = 0, hi = 1, t = x;
  for (let i = 0; i < 24; i++) { t = (lo + hi) / 2; if (bx(t) < x) lo = t; else hi = t; }
  return by(t);
};
/* GSAP power3.out is a quartic: 1 - (1 - p)^4 */
const power3Out = (p) => 1 - Math.pow(1 - clamp(p, 0, 1), 4);

/* keep an SVG sized to its box in real pixels, so text never stretches */
const sized = (svg, h, draw) => {
  let w = 0;
  const go = () => {
    const nw = Math.round(svg.getBoundingClientRect().width);
    if (!nw || nw === w) return;
    w = nw;
    const H = typeof h === "function" ? h(w) : h;
    svg.setAttribute("viewBox", `0 0 ${w} ${H}`);
    svg.setAttribute("height", H);
    draw(w, H);
  };
  new ResizeObserver(go).observe(svg); // fires once on observe, after the figure's code has run
};

/* ======================================================================
   The reveal. Two flags, as on the site: hovered and closed;
   the card shows when hovered && !closed, and the spin pauses while hovered.
   The mouse drives them by hovering; here touch and keyboard drive them too.
   ====================================================================== */
const reveals = new Set();
function makeReveal(item, { onChange } = {}) {
  const thing = $(".sl-thing", item), pill = $(".sl-pill", item);
  const r = { item, hovered: false, closed: false, ptype: "mouse", changedAt: 0, open: false };
  const render = () => {
    const open = r.hovered && !r.closed;
    if (open !== r.open) { r.open = open; r.changedAt = performance.now(); }
    item.classList.toggle("is-hover", r.hovered);
    item.classList.toggle("is-open", open);
    thing.setAttribute("aria-expanded", String(open));
    onChange && onChange(r);
  };
  r.set = (hovered, closed = false) => { r.hovered = hovered; r.closed = closed; render(); };
  r.closeOthers = () => reveals.forEach((o) => { if (o !== r && o.hovered && o.ptype !== "mouse") o.set(false); });
  thing.addEventListener("pointerdown", (e) => { r.ptype = e.pointerType; });
  item.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { r.ptype = "mouse"; r.set(true); } });
  item.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") r.set(false); });
  thing.addEventListener("click", (e) => {
    if (r.ptype === "mouse" && e.detail > 0) return; // a mouse already opened it by hovering
    if (e.detail === 0) r.ptype = "key";
    const open = r.hovered && !r.closed;
    if (!open) r.closeOthers();
    r.set(!open);
  });
  // the pill closes the card
  pill.addEventListener("click", (e) => {
    e.stopPropagation();
    const byMouse = r.ptype === "mouse" && e.detail > 0;
    r.set(byMouse ? r.hovered : false, true);
    if (!byMouse) thing.focus();
  });
  item.addEventListener("keydown", (e) => { if (e.key === "Escape" && r.open) { r.set(false); thing.focus(); } });
  reveals.add(r);
  render();
  return r;
}
// a tap anywhere else puts a tapped card away
document.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse" || (e.target.closest && e.target.closest("[data-keep]"))) return;
  reveals.forEach((r) => { if (r.hovered && r.ptype !== "mouse" && !r.item.contains(e.target)) r.set(false); });
});

/* angle of a CSS rotation animation, read from the animation itself */
const angleOf = (img) => {
  const a = img.getAnimations ? img.getAnimations()[0] : null;
  if (!a || a.currentTime == null) return 0;
  return ((a.currentTime % 8000) / 8000) * 360;
};

/* ======================================================================
   Fig. 1: the field
   ====================================================================== */
(function hero() {
  const fig = $(".sl-hero");
  if (!fig) return;
  const field = $(".sl-field", fig);
  const items = $$(".sl-item", field);
  const record = $(".sl-item--record img", field);
  const out = { angle: $("[data-r=angle]", fig), state: $("[data-r=state]", fig), open: $("[data-r=open]", fig) };
  const play = $(".sl-play", fig);
  const names = { postcard: "postcard", calendar: "calendar", flag: "flag", record: "record", racket: "racket", cutlery: "spoon and fork", croissant: "croissant", drink: "drink" };

  const update = () => {
    const open = items.filter((i) => i.classList.contains("is-open"));
    out.open.textContent = open.length ? `the ${names[open[0].dataset.key]}` : "none";
  };
  const rs = items.map((it) => makeReveal(it, { onChange: update }));
  void rs;

  // keep each card inside the field: the original centres it on the drawing (left 50%)
  const place = () => {
    const fr = field.getBoundingClientRect();
    items.forEach((it) => {
      const card = $(".sl-card", it);
      it.style.setProperty("--dx", "0px");
      const ir = it.getBoundingClientRect();
      const cw = card.offsetWidth, cx = ir.left + ir.width / 2;
      const l = cx - cw / 2, rr = cx + cw / 2;
      const dx = l < fr.left ? fr.left - l : rr > fr.right ? fr.right - rr : 0;
      it.style.setProperty("--dx", `${dx.toFixed(1)}px`);
    });
  };
  new ResizeObserver(place).observe(field);
  document.fonts && document.fonts.ready.then(place);

  // which drawings turn: on the page, the record
  const setMode = (mode) => {
    fig.dataset.mode = mode;
    $$(".tabs button", fig).forEach((b) => b.setAttribute("aria-selected", String(b.dataset.mode === mode)));
    items.forEach((it) => {
      const img = $(".sl-thing img", it);
      const spin = mode === "all" || it.dataset.key === "record";
      if (spin && !img.classList.contains("is-spin")) {
        img.classList.add("is-spin");
        // they all start together, so they turn in step
        const a = img.getAnimations()[0], ra = record.getAnimations()[0];
        if (a && ra && ra.currentTime != null) a.currentTime = ra.currentTime;
      } else if (!spin) img.classList.remove("is-spin");
    });
  };
  $$(".tabs button", fig).forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  setMode("published");

  let still = REDUCE;
  fig.classList.toggle("is-still", still);
  if (REDUCE) {
    play.hidden = false;
    play.addEventListener("click", () => {
      still = !still;
      fig.classList.toggle("is-still", still);
      play.textContent = still ? "Play the spin" : "Stop the spin";
    });
  }

  let on = false;
  fig.classList.add("is-idle");
  S.onVisible(fig, () => {
    on = true;
    fig.classList.remove("is-idle");
    S.raf(() => {
      const a = angleOf(record);
      out.angle.textContent = `${Math.round(a)}°`;
      const rec = items.find((i) => i.dataset.key === "record");
      out.state.textContent = still ? "still" : rec.classList.contains("is-hover") ? "paused while you're on it" : "turning";
      return on;
    });
  }, () => { on = false; fig.classList.add("is-idle"); });
})();

/* ======================================================================
   Fig. 3: the language map. Block positions measured on the live page at
   the recording's width; the recording's timeline matched to scroll
   positions frame by frame.
   ====================================================================== */
(function map() {
  const fig = $(".sl-map");
  if (!fig) return;
  const PAGE_H = 13213, VIEW_H = 955, MAX_Y = PAGE_H - VIEW_H; // 12,258
  // [top, height, language, kind]; "hidden" are the reveal cards' captions
  const BLOCKS = [
    [317, 85, "DE", "headline"], [442, 168, "NP", "line"], [665, 26, "EN", "button"],
    [1094, 77, "EN", "heading"], [1191, 126, "EN", "paragraph"],
    [2612, 69, "EN", "hidden"], [2695, 46, "EN", "hidden"], [3308, 46, "EN", "hidden"], [3685, 46, "EN", "hidden"],
    [3941, 46, "EN", "hidden"], [4294, 23, "EN", "hidden"], [4772, 46, "EN", "hidden"], [5136, 46, "EN", "hidden"],
    [5708, 30, "EN", "line"], [6139, 120, "EN", "heading"], [6360, 540, "EN", "paragraph"],
    [7080, 150, "EN", "heading"], [7248, 42, "EN", "line"], [9431, 151, "EN", "heading"],
    [10957, 172, "DE", "line"], [11497, 360, "EN", "line"], [12420, 120, "EN", "heading"], [12610, 60, "DE", "paragraph"],
  ];
  // [centre y, d = drawing | p = photograph, r = opens a card]
  const PICS = [[196,"p"],[253,"d"],[421,"d"],[526,"d"],[619,"d"],[870,"d"],[954,"d"],[2016,"p"],[2500,"dr"],[2470,"pr"],[3115,"dr"],[3542,"dr"],[3569,"dr"],[3780,"dr"],[4144,"dr"],[4587,"dr"],[4955,"dr"],[5233,"d"],[5447,"d"],[6349,"p"],[7425,"d"],[7657,"p"],[7728,"p"],[8012,"p"],[8340,"p"],[8364,"p"],[8878,"p"],[9008,"p"],[9341,"d"],[9524,"d"],[9573,"d"],[10057,"p"],[9758,"d"],[10406,"d"],[10432,"d"],[10921,"d"],[11870,"d"],[12299,"d"],[12308,"d"],[12980,"d"],[13126,"d"],[13138,"d"]];
  // recording time (s) → scroll top (px), from matching each quarter second of saleena.mp4 to the page
  const T2Y = [[0,0],[2.5,21],[2.75,218],[3,324],[3.25,500],[3.5,755],[3.75,814],[4,1011],[4.25,1128],[4.5,1276],[5,1441],[5.25,1628],[5.5,1872],[5.75,1925],[6,2101],[6.25,2229],[7.5,2229],[7.75,2564],[8,2606],[8.25,2675],[8.5,2888],[8.75,2888],[9,3096],[9.25,3681],[9.5,3830],[9.75,4239],[10,4404],[10.25,4744],[10.5,5069],[10.75,5133],[11,5388],[11.25,5489],[11.5,5723],[11.75,6074],[12,6154],[12.25,6510],[12.5,6760],[12.75,6920],[13,7218],[15.25,7228],[15.5,7351],[15.75,7994],[16,8223],[16.25,8531],[16.5,8803],[16.75,8872],[17,9329],[17.25,9462],[17.75,9499],[18,9287],[18.5,9170],[18.75,9414],[19,9552],[19.25,9824],[19.5,10127],[19.75,10201],[20,10526],[20.25,10616],[20.5,11106],[20.75,11318],[21,11462],[21.25,11925],[21.5,12068],[22,12249],[23.2,12249]];
  const yAt = (t) => {
    for (let i = 1; i < T2Y.length; i++) {
      const [t1, y1] = T2Y[i];
      if (t <= t1) { const [t0, y0] = T2Y[i - 1]; return y0 + (y1 - y0) * ((t - t0) / (t1 - t0 || 1)); }
    }
    return T2Y[T2Y.length - 1][1];
  };
  const tAt = (y) => {
    for (let i = 1; i < T2Y.length; i++) {
      const [t0, y0] = T2Y[i - 1], [t1, y1] = T2Y[i];
      if (y1 >= y && y1 > y0) return t0 + (t1 - t0) * clamp((y - y0) / (y1 - y0), 0, 1);
      if (y1 >= y && y1 === y0) return t0;
    }
    return 22;
  };
  const LANG = { DE: "German", NP: "Nepali", EN: "English" };
  const onScreen = (y) => {
    const s = new Set(BLOCKS.filter((b) => b[3] !== "hidden" && b[0] < y + VIEW_H && b[0] + b[1] > y).map((b) => b[2]));
    const l = ["DE", "NP", "EN"].filter((k) => s.has(k)).map((k) => LANG[k]);
    return l.length ? l.join(" · ") : "pictures only";
  };

  const svg = $(".sl-map-svg", fig);
  const frame = $(".sl-map-frame", fig);
  const playBtn = $(".sl-map-play", fig);
  const out = { y: $("[data-m=y]", fig), lang: $("[data-m=lang]", fig), t: $("[data-m=t]", fig) };
  // it opens at 10 s, the stretch of drawings, matching the still in the HTML
  let geo = null, win = null, cur = 4404, dragging = false;

  sized(svg, (w) => (w < 560 ? 150 : 160), (W, H) => {
    svg.textContent = "";
    const narrow = W < 560;
    const L = narrow ? 58 : 74, R = 6, top = 34, lane = 24;
    const x0 = L, pw = W - L - R;
    const X = (y) => x0 + (y / PAGE_H) * pw;
    const lanes = ["DE", "NP", "EN", "pic"];
    const names = { DE: "German", NP: "Nepali", EN: "English", pic: "Pictures" };
    const laneY = (k) => top + lanes.indexOf(k) * lane + lane / 2;
    lanes.forEach((k) => {
      svgEl("line", { x1: x0, x2: x0 + pw, y1: laneY(k), y2: laneY(k), class: "ax" }, svg);
      svgEl("text", { x: 0, y: laneY(k) + 4, class: "lane" }, svg).textContent = names[k];
    });
    BLOCKS.forEach(([y, h, lang, kind]) => {
      const w = Math.max(2.5, (h / PAGE_H) * pw);
      svgEl("rect", { x: X(y), y: laneY(lang) - 6, width: w, height: 12, class: kind === "hidden" ? "bar-hidden" : `bar-${lang}` }, svg);
    });
    PICS.forEach(([y, t]) => {
      const cx = X(y), cy = laneY("pic");
      if (t[0] === "p") svgEl("rect", { x: cx - 3, y: cy - 3, width: 6, height: 6, class: "pic-photo" }, svg);
      else svgEl("circle", { cx, cy, r: 3, class: "pic-draw" }, svg);
      if (t[1] === "r") svgEl("circle", { cx, cy, r: 6, class: "pic-ring" }, svg);
    });
    // the one line of her page reproduced here is the public headline
    const hl = svgEl("text", { x: X(317), y: 16, class: "hl-de", lang: "de" }, svg);
    hl.textContent = "Für die süßeste Frau, die ich kenne.";
    svgEl("line", { x1: X(317) + 1, x2: X(317) + 1, y1: 21, y2: laneY("DE") - 7, class: "ax-ink" }, svg);
    if (!narrow) {
      const g1 = svgEl("text", { x: X(10957), y: 16, class: "ann", "text-anchor": "end" }, svg);
      g1.textContent = "German again";
      svgEl("line", { x1: X(10957) + 1, x2: X(10957) + 1, y1: 21, y2: laneY("DE") - 7, class: "ax-ink" }, svg);
      svgEl("line", { x1: X(12610) + 1, x2: X(10957) + 1, y1: 21, y2: 21, class: "ax-ink" }, svg);
      svgEl("line", { x1: X(12610) + 1, x2: X(12610) + 1, y1: 21, y2: laneY("DE") - 7, class: "ax-ink" }, svg);
    }
    const axY = top + lanes.length * lane + 8;
    const ticks = narrow ? [0, 6000, 12000] : [0, 2000, 4000, 6000, 8000, 10000, 12000];
    ticks.forEach((v) => {
      svgEl("line", { x1: X(v), x2: X(v), y1: axY - 4, y2: axY, class: "ax-ink" }, svg);
      svgEl("text", { x: X(v), y: axY + 13, class: "tick", "text-anchor": v === 0 ? "start" : "middle" }, svg).textContent = v === 0 ? "0 px" : v.toLocaleString("en-GB");
    });
    svgEl("text", { x: x0 + pw, y: axY + 13, class: "tick", "text-anchor": "end" }, svg).textContent = narrow ? "" : "13,213";
    win = svgEl("rect", { x: X(0), y: top - 3, width: (VIEW_H / PAGE_H) * pw, height: lanes.length * lane + 6, class: "win" }, svg);
    geo = { X, x0, pw };
    show(cur);
  });

  const show = (y) => {
    cur = y;
    if (win && geo) win.setAttribute("x", geo.X(y));
    out.y.textContent = Math.round(y).toLocaleString("en-GB");
    const l = onScreen(y);
    out.lang.textContent = l;
    svg.setAttribute("aria-valuenow", String(Math.round(y)));
    svg.setAttribute("aria-valuetext", `${Math.round(y).toLocaleString("en-GB")} pixels down, ${l} on screen`);
  };
  const showT = (t) => { out.t.textContent = `0:${t.toFixed(1).padStart(4, "0")}`; };

  // The recording, as 93 still frames, one every 0.25 s (ffmpeg fps=4 from saleena.mp4).
  // Stills scrub instantly and never stall on a seek.
  const FPS = 4, NF = 93, DUR = 23.2;
  const url = (i) => `saleena/rec/${String(i).padStart(3, "0")}.webp`;
  let shown = 40, loaded = false, t = 10, playing = false;
  const preload = () => {
    if (loaded) return;
    loaded = true;
    let next = 0;
    const one = () => { if (next >= NF) return; const im = new Image(); im.onload = im.onerror = one; im.src = url(next++); };
    for (let k = 0; k < 4; k++) one();
  };
  const showFrame = (tt) => {
    const i = clamp(Math.round(tt * FPS), 0, NF - 1);
    if (i !== shown) { shown = i; frame.src = url(i); }
  };
  const seekY = (y) => {
    y = clamp(y, 0, MAX_Y);
    show(y);
    t = tAt(y);
    showT(t);
    showFrame(t);
  };
  const yFromEvent = (e) => {
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * parseFloat(svg.getAttribute("viewBox").split(" ")[2]);
    return ((x - geo.x0) / geo.pw) * PAGE_H - VIEW_H / 2;
  };
  const setBtn = () => { playBtn.textContent = playing ? "Pause" : "Play"; };
  let held = false; // the reader stopped it, so scrolling back doesn't restart it
  const stopPlay = () => { playing = false; setBtn(); };
  svg.addEventListener("pointerdown", (e) => {
    if (!geo) return;
    dragging = true; held = true; svg.setPointerCapture(e.pointerId);
    stopPlay();
    seekY(yFromEvent(e));
  });
  svg.addEventListener("pointermove", (e) => { if (dragging) seekY(yFromEvent(e)); });
  const end = () => { dragging = false; };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  svg.addEventListener("keydown", (e) => {
    const step = { ArrowRight: 250, ArrowDown: 250, ArrowLeft: -250, ArrowUp: -250, PageDown: VIEW_H, PageUp: -VIEW_H }[e.key];
    const go = (y) => { e.preventDefault(); held = true; stopPlay(); seekY(y); };
    if (step != null) go(cur + step);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(MAX_Y);
  });

  let on = false;
  const loop = () => S.raf((now, dt) => {
    if (playing && !dragging) {
      t += dt;
      if (t > DUR) t = 0;
      show(yAt(t)); showT(t); showFrame(t);
    }
    return on;
  });
  playBtn.addEventListener("click", () => {
    preload();
    playing = !playing;
    held = !playing;
    if (playing && t >= DUR - 0.3) t = 0;
    setBtn();
  });
  S.onVisible(fig, () => {
    on = true;
    preload();
    if (!REDUCE && !held) playing = true;
    setBtn();
    loop();
  }, () => { on = false; playing = false; setBtn(); });
  setBtn();
})();

/* ======================================================================
   Fig. 4: one reveal, taken apart
   ====================================================================== */
(function anatomy() {
  const fig = $(".sl-anat");
  if (!fig) return;
  const item = $(".sl-item", fig);
  const img = $(".sl-thing img", item);
  const card = $(".sl-card", item);
  img.classList.add("is-spin");
  let dur = 220;
  let flip = null; // {at, open}
  const openBtn = $(".sl-anat-open", fig);
  const r = makeReveal(item, { onChange: (st) => {
    flip = { at: st.changedAt, open: st.open };
    openBtn.textContent = st.open ? "Close the card" : "Open the card";
  } });
  openBtn.addEventListener("click", () => { r.ptype = "key"; r.set(!r.open); });
  $$("[data-slow]", fig).forEach((b) => b.addEventListener("click", () => {
    dur = 220 * +b.dataset.slow;
    item.style.setProperty("--sl-dur", `${dur}ms`);
    $$("[data-slow]", fig).forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
    $("[data-a=dur]", fig).textContent = `${dur.toLocaleString("en-GB")} ms`;
  }));
  const out = { angle: $("[data-a=angle]", fig), op: $("[data-a=op]", fig), ty: $("[data-a=ty]", fig) };

  /* the spin plot: angle over the last 12 seconds */
  const spinSvg = $(".sl-plot-spin", fig);
  let sp = null;
  const SPAN = 12;
  sized(spinSvg, 150, (W, H) => {
    spinSvg.textContent = "";
    const L = 40, R = 52, T = 26, B = 22, pw = W - L - R, ph = H - T - B;
    svgEl("text", { x: 0, y: 13, class: "ttl" }, spinSvg).textContent = "The spin: rotate 0° → 360°, 8 s, linear";
    [0, 180, 360].forEach((v) => {
      const y = T + ph - (v / 360) * ph;
      svgEl("line", { x1: L, x2: L + pw, y1: y, y2: y, class: "ax" }, spinSvg);
      svgEl("text", { x: L - 6, y: y + 4, class: "tick", "text-anchor": "end" }, spinSvg).textContent = `${v}°`;
    });
    svgEl("text", { x: L, y: H - 4, class: "tick" }, spinSvg).textContent = `−${SPAN} s`;
    svgEl("text", { x: L + pw, y: H - 4, class: "tick", "text-anchor": "end" }, spinSvg).textContent = "now";
    const path = svgEl("path", { class: "live-line", d: "" }, spinSvg);
    const dot = svgEl("circle", { r: 4, class: "dot", cx: L + pw, cy: T + ph }, spinSvg);
    const val = svgEl("text", { x: L + pw + 8, y: T + ph + 4, class: "val" }, spinSvg);
    sp = { L, T, pw, ph, path, dot, val };
  });
  const buf = [];

  /* the card plot: 220 ms on the standard ease, opening solid, closing dashed */
  const cardSvg = $(".sl-plot-card", fig);
  let cp = null;
  sized(cardSvg, 198, (W, H) => {
    cardSvg.textContent = "";
    const L = 40, R = 52, T = 26, B = 44, pw = W - L - R, ph = H - T - B;
    svgEl("text", { x: 0, y: 13, class: "ttl" }, cardSvg).textContent = "The card: opacity and lift share one ease curve";
    svgEl("line", { x1: L, x2: L + pw, y1: T + ph, y2: T + ph, class: "ax" }, cardSvg);
    svgEl("line", { x1: L, x2: L + pw, y1: T, y2: T, class: "ax" }, cardSvg);
    svgEl("text", { x: L - 6, y: T + 4, class: "tick", "text-anchor": "end" }, cardSvg).textContent = "1";
    svgEl("text", { x: L - 6, y: T + ph + 4, class: "tick", "text-anchor": "end" }, cardSvg).textContent = "0";
    svgEl("text", { x: L, y: T + ph + 16, class: "tick" }, cardSvg).textContent = "0 ms";
    const tEnd = svgEl("text", { x: L + pw, y: T + ph + 16, class: "tick", "text-anchor": "end" }, cardSvg);
    const curve = (f) => { let d = ""; for (let i = 0; i <= 60; i++) { const p = i / 60; d += `${i ? "L" : "M"}${(L + p * pw).toFixed(1)} ${(T + ph - f(p) * ph).toFixed(1)}`; } return d; };
    svgEl("path", { d: curve((p) => cssEase(p)), class: "curve" }, cardSvg);           // opacity, opening
    svgEl("path", { d: curve((p) => 1 - cssEase(p)), class: "curve-2" }, cardSvg);     // opacity, closing
    svgEl("text", { x: L + pw + 12, y: T + 4, class: "tick" }, cardSvg).textContent = "open";
    svgEl("text", { x: L + pw + 12, y: T + ph + 4, class: "tick" }, cardSvg).textContent = "closed";
    // label each curve just off it, at 62% of the way through
    const e62 = cssEase(0.62);
    svgEl("text", { x: L + pw * 0.62 + 4, y: T + ph - e62 * ph + 18, class: "ann" }, cardSvg).textContent = "opening";
    svgEl("text", { x: L + pw * 0.62 + 4, y: T + ph - (1 - e62) * ph - 8, class: "ann" }, cardSvg).textContent = "closing";
    // lift as an ink ring, opacity as the pink dot inside it: they share the curve, so they sit together
    const dTy = svgEl("circle", { r: 7.5, class: "ring-ink", cx: L, cy: T + ph }, cardSvg);
    const dOp = svgEl("circle", { r: 4, class: "dot", cx: L, cy: T + ph }, cardSvg);
    const lg = svgEl("g", { transform: `translate(${L + 4} ${H - 6})` }, cardSvg);
    svgEl("circle", { r: 4, cx: 4, cy: 0, class: "dot" }, lg);
    svgEl("text", { x: 13, y: 4, class: "tick" }, lg).textContent = "opacity";
    svgEl("circle", { r: 6, cx: 82, cy: 0, class: "ring-ink" }, lg);
    svgEl("text", { x: 93, y: 4, class: "tick" }, lg).textContent = "lift, 8 → 0 px";
    cp = { L, T, pw, ph, dOp, dTy, tEnd };
  });

  let on = false;
  if (REDUCE) {
    fig.classList.add("is-still");
    const pb = $(".sl-anat-play", fig);
    pb.hidden = false;
    pb.addEventListener("click", () => {
      const st = fig.classList.toggle("is-still");
      pb.textContent = st ? "Play the spin" : "Stop the spin";
    });
  }
  fig.classList.add("is-idle");
  S.onVisible(fig, () => {
    on = true;
    fig.classList.remove("is-idle");
    S.raf(() => {
      const now = performance.now() / 1000;
      const a = angleOf(img);
      buf.push([now, a]);
      while (buf.length && buf[0][0] < now - SPAN) buf.shift();
      out.angle.textContent = `${Math.round(a)}°`;
      if (sp) {
        let d = "", prev = null;
        for (const [t, ang] of buf) {
          const x = sp.L + sp.pw * (1 - (now - t) / SPAN), y = sp.T + sp.ph - (ang / 360) * sp.ph;
          d += `${!prev || ang < prev - 180 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
          prev = ang;
        }
        sp.path.setAttribute("d", d);
        const y = sp.T + sp.ph - (a / 360) * sp.ph;
        sp.dot.setAttribute("cy", y.toFixed(1));
        sp.val.setAttribute("y", (y + 4).toFixed(1));
        sp.val.textContent = `${Math.round(a)}°`;
      }
      // the card's real computed values, as the browser runs the transition
      const cs = getComputedStyle(card);
      const op = parseFloat(cs.opacity);
      const ty = cs.transform && cs.transform !== "none" ? new DOMMatrixReadOnly(cs.transform).m42 : 0;
      out.op.textContent = op.toFixed(2);
      out.ty.textContent = `${ty.toFixed(1)} px`;
      if (cp) {
        cp.tEnd.textContent = `${dur.toLocaleString("en-GB")} ms`;
        const p = flip ? clamp((performance.now() - flip.at) / dur, 0, 1) : 1;
        const x = cp.L + p * cp.pw;
        cp.dOp.setAttribute("cx", x.toFixed(1));
        cp.dOp.setAttribute("cy", (cp.T + cp.ph - op * cp.ph).toFixed(1));
        cp.dTy.setAttribute("cx", x.toFixed(1));
        cp.dTy.setAttribute("cy", (cp.T + cp.ph - (1 - ty / 8) * cp.ph).toFixed(1));
      }
      return on;
    });
  }, () => { on = false; fig.classList.add("is-idle"); });
})();

/* ======================================================================
   Fig. 5: the phone note. Messages, timing and type are the site's.
   ====================================================================== */
(function gate() {
  const fig = $(".sl-gate");
  if (!fig) return;
  // the 3 messages, as on the site
  const LANGS = [
    { code: "EN", flag: "🇬🇧", text: "This little corner of the internet was made for a bigger screen. Please open it on a laptop or desktop for the full experience." },
    { code: "DE", flag: "🇩🇪", text: "Diese kleine Ecke des Internets wurde für einen größeren Bildschirm gemacht. Bitte öffne sie auf einem Laptop oder Desktop, um das volle Erlebnis zu genießen." },
    { code: "NP", flag: "🇳🇵", text: "इन्टरनेटको यो सानो कुनो ठूलो स्क्रिनको लागि बनाइएको हो। पूर्ण अनुभवका लागि कृपया यसलाई ल्यापटप वा डेस्कटपमा खोल्नुहोस्।" },
  ];
  const DUR = 0.7, STAGGER = 0.025, Y0 = 28; // duration .7, stagger .025, yOffset 28, ease power3.out
  const MAXW = Math.max(...LANGS.map((l) => l.text.split(" ").length));
  const wrap = $(".sl-phone-wrap", fig), phone = $(".sl-phone", fig);
  const words = $(".sl-words", fig), btn = $(".sl-lang", fig);
  const svg = $(".sl-plot-gate", fig);
  const out = { code: $("[data-g=code]", fig), n: $("[data-g=n]", fig), total: $("[data-g=total]", fig), t: $("[data-g=t]", fig) };
  let idx = 0, inner = [], tween = null, ts = 1, clock = 0, running = false, gsap = null;

  // scale the 390 x 844 phone to fit
  const fit = () => {
    const canvas = $(".sl-gate-canvas", fig);
    const cw = canvas.getBoundingClientRect().width;
    const oneCol = getComputedStyle(canvas).gridTemplateColumns.split(" ").length < 2;
    const availW = oneCol ? cw : Math.min(420, cw * 0.46);
    const s = Math.min(1, availW / 390, (window.innerHeight * 0.84) / 844, oneCol ? 0.86 : 1);
    phone.style.setProperty("--s", s.toFixed(4));
    wrap.style.width = `${Math.floor(390 * s)}px`;
    wrap.style.height = `${Math.floor(844 * s)}px`;
  };
  new ResizeObserver(fit).observe($(".sl-gate-canvas", fig));
  window.addEventListener("resize", fit);

  // split on spaces; each word in an overflow-hidden span
  const build = () => {
    const L = LANGS[idx];
    words.lang = { EN: "en", DE: "de", NP: "ne" }[L.code];
    words.innerHTML = "";
    inner = L.text.split(" ").filter(Boolean).map((w) => {
      const o = document.createElement("span"), i = document.createElement("span");
      i.textContent = w;
      o.appendChild(i); words.appendChild(o);
      return i;
    });
    $(".sl-flag", btn).textContent = L.flag;
    $(".sl-code", btn).textContent = L.code;
    btn.setAttribute("aria-label", `Language: ${L.code}. Change language`);
    const n = inner.length;
    out.code.textContent = L.code;
    out.n.textContent = String(n);
    out.total.textContent = `${(DUR + STAGGER * (n - 1)).toFixed(3)} s`;
    drawStatic();
  };

  // set every word 28 px down and clear, then bring them up with the stagger
  const animate = () => {
    if (!gsap) return;
    gsap.killTweensOf(inner);
    gsap.set(inner, { y: Y0, opacity: 0 });
    tween = gsap.to(inner, { y: 0, opacity: 1, duration: DUR, stagger: STAGGER, ease: "power3.out", clearProps: "transform,opacity" });
    tween.timeScale(ts);
    clock = 0; running = true;
    S.raf((t, dt) => {
      clock += dt * ts;
      drawLive();
      if (clock > DUR + STAGGER * (inner.length - 1) + 0.05) { running = false; drawLive(); return false; }
      return true;
    });
  };

  // the pill steps to the next language
  btn.addEventListener("click", () => {
    idx = (idx + 1) % LANGS.length;
    build();
    if (!REDUCE) animate(); else { clock = 99; drawLive(); }
  });
  $(".sl-gate-replay", fig).addEventListener("click", () => {
    loadGsap().then((g) => { gsap = g; animate(); }).catch(() => {});
  });
  $$("[data-ts]", fig).forEach((b) => b.addEventListener("click", () => {
    ts = +b.dataset.ts;
    if (tween) tween.timeScale(ts);
    $$("[data-ts]", fig).forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
  }));
  if (REDUCE) { $(".sl-gate-replay", fig).textContent = "Play"; clock = 99; }

  /* the timing diagram */
  let G = null;
  sized(svg, () => 150 + 22 + MAXW * 11 + 30, (W, H) => {
    svg.textContent = "";
    const L = W < 420 ? 78 : 92, R = 12;
    const pw = W - L - R;
    // the curve: one word's offset over its 0.7 s
    const cT = 22, cH = 104;
    svgEl("text", { x: 0, y: 12, class: "ttl" }, svg).textContent = "One word: y 28 → 0 px, power3.out, 0.7 s";
    svgEl("line", { x1: L, x2: L + pw, y1: cT + cH, y2: cT + cH, class: "ax" }, svg);
    svgEl("line", { x1: L, x2: L + pw, y1: cT, y2: cT, class: "ax" }, svg);
    svgEl("text", { x: L - 8, y: cT + cH + 4, class: "tick", "text-anchor": "end" }, svg).textContent = "28 px";
    svgEl("text", { x: L - 8, y: cT + 4, class: "tick", "text-anchor": "end" }, svg).textContent = "0";
    let d = "";
    for (let i = 0; i <= 70; i++) { const p = i / 70; d += `${i ? "L" : "M"}${(L + p * pw).toFixed(1)} ${(cT + cH - power3Out(p) * cH).toFixed(1)}`; }
    svgEl("path", { d, class: "curve" }, svg);
    svgEl("text", { x: L, y: cT + cH + 16, class: "tick" }, svg).textContent = "0 s";
    svgEl("text", { x: L + pw, y: cT + cH + 16, class: "tick", "text-anchor": "end" }, svg).textContent = "0.7 s";
    const dots = svgEl("g", {}, svg);
    // the bars: each word's start and its 0.7 s
    const gT = cT + cH + 46;
    svgEl("text", { x: 0, y: gT - 12, class: "ttl" }, svg).textContent = "Every word: starts 0.025 s after the last";
    const maxT = DUR + STAGGER * (MAXW - 1);
    const X = (t) => L + (t / maxT) * pw;
    const axY = gT + MAXW * 11 + 6;
    [0, 0.25, 0.5, 0.75, 1, 1.25].forEach((v) => {
      if (v > maxT) return;
      svgEl("line", { x1: X(v), x2: X(v), y1: gT - 4, y2: axY, class: "ax" }, svg);
      svgEl("text", { x: X(v), y: axY + 13, class: "tick", "text-anchor": v === 0 ? "start" : "middle" }, svg).textContent = `${v} s`;
    });
    const rows = svgEl("g", {}, svg);
    const head = svgEl("line", { x1: X(0), x2: X(0), y1: gT - 6, y2: axY, class: "live-line" }, svg);
    G = { L, pw, cT, cH, gT, X, rows, dots, head, rowEls: [] };
    drawStatic();
  });

  function drawStatic() {
    if (!G) return;
    G.rows.textContent = "";
    G.dots.textContent = "";
    G.rowEls = inner.map((w, i) => {
      const y = G.gT + i * 11;
      const lab = svgEl("text", { x: G.L - 8, y: y + 8, class: "word", "text-anchor": "end" }, G.rows);
      lab.textContent = w.textContent.length > 12 ? w.textContent.slice(0, 11) + "…" : w.textContent;
      const x0 = G.X(i * STAGGER), x1 = G.X(i * STAGGER + DUR);
      svgEl("rect", { x: x0, y: y + 1, width: x1 - x0, height: 8, class: "bar-bg" }, G.rows);
      const fill = svgEl("rect", { x: x0, y: y + 1, width: 0, height: 8, class: "bar-fill" }, G.rows);
      const dot = svgEl("circle", { r: 3, class: "dot", cx: G.L, cy: G.cT + G.cH, opacity: 0 }, G.dots);
      return { fill, dot, x0, x1 };
    });
    drawLive();
  }
  function drawLive() {
    if (!G) return;
    const n = inner.length;
    const t = running ? clock : (clock === 0 ? 0 : 99);
    out.t.textContent = `${Math.min(t, DUR + STAGGER * (n - 1)).toFixed(3)} s`;
    G.head.setAttribute("x1", G.X(Math.min(t, DUR + STAGGER * (MAXW - 1))));
    G.head.setAttribute("x2", G.X(Math.min(t, DUR + STAGGER * (MAXW - 1))));
    G.rowEls.forEach((r, i) => {
      const p = clamp((t - i * STAGGER) / DUR, 0, 1);
      r.fill.setAttribute("width", ((r.x1 - r.x0) * p).toFixed(1));
      // the word's real offset, read back from GSAP while it runs
      const y = running && gsap ? +gsap.getProperty(inner[i], "y") : (p >= 1 || !running ? 0 : Y0);
      const inFlight = running && p > 0 && p < 1;
      r.dot.setAttribute("opacity", inFlight ? 1 : 0);
      r.dot.setAttribute("cx", (G.L + p * G.pw).toFixed(1));
      r.dot.setAttribute("cy", (G.cT + G.cH - (1 - y / Y0) * G.cH).toFixed(1));
    });
  }

  build();
  fig.classList.add("is-idle");
  if (REDUCE) fig.classList.add("is-still");
  let mounted = false;
  S.onVisible(fig, () => {
    fig.classList.remove("is-idle");
    fit();
    loadGsap().then((g) => {
      gsap = g;
      if (!mounted && !REDUCE) { mounted = true; animate(); } // it plays once on arrival
    }).catch(() => {});
  }, () => { fig.classList.add("is-idle"); });
})();

/* ======================================================================
   Fig. 6: the image effect, ported. The numbers are the page's where it sets
   them (tilt 14, perspective 1200, zoom 1.04, duration 0.3, glare off) and the
   component's own for the modes the page doesn't use.
   ====================================================================== */
(function effect() {
  const fig = $(".sl-fx");
  if (!fig) return;
  const P = {
    perspective: 1200, duration: 0.3, hoverZoom: 1.04, tiltAmount: 14, depthAmount: 80, skewAmount: 10,
    flipDirection: "Y", distortAmount: 45, distortFrequency: 0.03, floatDistance: 18, glareOpacity: 0.4,
    showGlare: false,
  };
  const A = $(".sl-fx-obj", fig), j = $(".sl-fx-img", fig), M = $(".sl-fx-glare", fig);
  const N = $("#sl-fx-distort feTurbulence"), ee = $("#sl-fx-distort feDisplacementMap");
  const readout = $(".sl-fx-read", fig);
  const glareBtn = $(".sl-fx-glare-t", fig), sweepBtn = $(".sl-fx-sweep", fig);
  let effect = "Tilt", gsap = null, inside = false, last = { x: 0.5, y: 0.5 };

  const reset = () => {
    if (!gsap) return;
    const f = P.duration, u = P.perspective;
    gsap.to(j, { rotateX: 0, rotateY: 0, rotateZ: 0, x: 0, y: 0, z: 0, skewX: 0, skewY: 0, scale: 1, duration: f, ease: "power3.out", transformPerspective: u, transformOrigin: "center center" });
    gsap.to(M, { opacity: 0, x: 0, y: 0, duration: f, ease: "power3.out" });
    gsap.to(ee, { attr: { scale: 0 }, duration: f, ease: "power3.out" });
    gsap.to(N, { attr: { baseFrequency: 0.003 }, duration: f, ease: "power3.out" });
  };
  const move = (n, r) => { // n and r are fractions of the box
    if (!gsap) return;
    last = { x: n, y: r };
    const t = A.getBoundingClientRect();
    const a = (r - 0.5) * -2, o = (n - 0.5) * 2, s = (n - 0.5) * 2, c = (r - 0.5) * 2;
    const i = effect, v = P.tiltAmount, g = P.hoverZoom, u = P.perspective;
    if (P.showGlare && i !== "Distort") gsap.to(M, { opacity: P.glareOpacity, x: s * 24, y: c * 24, duration: 0.25, ease: "power2.out" });
    if (i === "Tilt") gsap.to(j, { rotateX: a * v, rotateY: o * v, scale: g, duration: 0.25, ease: "power2.out", transformPerspective: u, transformOrigin: "center center" });
    if (i === "Depth") gsap.to(j, { rotateX: a * v * 0.7, rotateY: o * v * 0.7, z: P.depthAmount, scale: g, duration: 0.3, ease: "power2.out", transformPerspective: u, transformOrigin: "center center" });
    if (i === "Skew") gsap.to(j, { rotateY: v * 0.4 * o, skewX: s * P.skewAmount, skewY: P.skewAmount * 0.35 * c, scale: g, duration: 0.25, ease: "power2.out", transformPerspective: u, transformOrigin: "center center" });
    if (i === "Float") gsap.to(j, { x: s * P.floatDistance, y: c * P.floatDistance, rotateX: v * 0.35 * a, rotateY: v * 0.35 * o, scale: g, duration: 0.3, ease: "power2.out", transformPerspective: u, transformOrigin: "center center" });
  };
  const enter = () => {
    if (!gsap) return;
    inside = true;
    const i = effect, g = P.hoverZoom, f = P.duration, u = P.perspective;
    if (i === "Flip") gsap.to(j, { rotateY: P.flipDirection === "Y" ? 180 : 0, rotateX: P.flipDirection === "X" ? 180 : 0, scale: g, duration: f, ease: "power3.out", transformPerspective: u, transformOrigin: "center center" });
    if (i === "Distort") { gsap.to(j, { scale: g, duration: f, ease: "power3.out" }); gsap.to(ee, { attr: { scale: P.distortAmount }, duration: f, ease: "power3.out" }); gsap.to(N, { attr: { baseFrequency: P.distortFrequency }, duration: f, ease: "power3.out" }); }
    if (P.showGlare && i !== "Distort") gsap.to(M, { opacity: P.glareOpacity, duration: 0.25, ease: "power2.out" });
  };
  const leave = () => { inside = false; reset(); };

  const frac = (e) => { const t = A.getBoundingClientRect(); return [clamp((e.clientX - t.left) / t.width, 0, 1), clamp((e.clientY - t.top) / t.height, 0, 1)]; };
  let pressed = false;
  A.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { enter(); move(...frac(e)); } });
  A.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" || pressed) move(...frac(e)); });
  A.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") leave(); });
  A.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") { pressed = true; A.setPointerCapture(e.pointerId); enter(); move(...frac(e)); } });
  const up = (e) => { if (e.pointerType !== "mouse" && pressed) { pressed = false; leave(); } };
  A.addEventListener("pointerup", up);
  A.addEventListener("pointercancel", up);
  A.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-0.08, 0], ArrowRight: [0.08, 0], ArrowUp: [0, -0.08], ArrowDown: [0, 0.08] }[e.key];
    if (d) { e.preventDefault(); if (!inside) enter(); move(clamp(last.x + d[0], 0, 1), clamp(last.y + d[1], 0, 1)); }
    else if (e.key === "Escape") { last = { x: 0.5, y: 0.5 }; leave(); }
  });
  A.addEventListener("blur", () => { if (inside && !pressed) leave(); });

  // switching modes settles the image before the new one starts
  const setEffect = (fx) => {
    effect = fx;
    fig.dataset.fx = fx;
    $$("[role=tab]", fig).forEach((b) => b.setAttribute("aria-selected", String(b.dataset.fx === fx)));
    glareBtn.hidden = fx === "Distort";
    reset();
    if (inside) { enter(); move(last.x, last.y); }
  };
  $$("[role=tab]", fig).forEach((b) => b.addEventListener("click", () => setEffect(b.dataset.fx)));
  glareBtn.addEventListener("click", () => {
    P.showGlare = !P.showGlare;
    glareBtn.setAttribute("aria-pressed", String(P.showGlare));
    glareBtn.textContent = P.showGlare ? "Glare: on" : "Glare: off";
    if (!P.showGlare && gsap) gsap.to(M, { opacity: 0, duration: P.duration, ease: "power3.out" });
  });

  // a scripted pass of the pointer: the same handlers, driven by a figure of eight
  sweepBtn.addEventListener("click", () => {
    if (!gsap) return;
    enter();
    const t0 = performance.now();
    S.raf(() => {
      const p = (performance.now() - t0) / 2600;
      if (p >= 1) { leave(); return false; }
      const a = p * Math.PI * 2;
      move(0.5 + 0.42 * Math.sin(a), 0.5 + 0.38 * Math.sin(a * 2));
      return true;
    });
  });


  /* readouts: the live values from GSAP */
  const gp = (el, p) => +gsap.getProperty(el, p);
  const li = (k, v) => `<li>${k} <b>${v}</b></li>`;
  const read = () => {
    if (!gsap) return;
    let h = "";
    const deg = (p) => `${fmt(gp(j, p))}°`;
    if (effect === "Tilt") h = li("rotateX", deg("rotationX")) + li("rotateY", deg("rotationY")) + li("scale", fmt(gp(j, "scale"), 3)) + li("perspective", "1200px");
    if (effect === "Depth") h = li("rotateX", deg("rotationX")) + li("rotateY", deg("rotationY")) + li("z", `${fmt(gp(j, "z"))}px`) + li("scale", fmt(gp(j, "scale"), 3));
    if (effect === "Skew") h = li("rotateY", deg("rotationY")) + li("skewX", deg("skewX")) + li("skewY", deg("skewY")) + li("scale", fmt(gp(j, "scale"), 3));
    if (effect === "Flip") h = li("rotateY", deg("rotationY")) + li("scale", fmt(gp(j, "scale"), 3)) + li("back", "hidden, so the far side is empty");
    if (effect === "Float") h = li("x", `${fmt(gp(j, "x"))}px`) + li("y", `${fmt(gp(j, "y"))}px`) + li("rotateX", deg("rotationX")) + li("rotateY", deg("rotationY"));
    if (effect === "Distort") h = li("displacement", fmt(+ee.getAttribute("scale"))) + li("baseFrequency", (+N.getAttribute("baseFrequency")).toFixed(4)) + li("noise", "fractal, 2 octaves");
    if (P.showGlare && effect !== "Distort") h += li("glare", fmt(gp(M, "opacity"), 2));
    if (readout.innerHTML !== h) readout.innerHTML = h;
  };

  let on = false;
  S.onVisible(fig, () => {
    on = true;
    loadGsap().then((g) => {
      if (!gsap) { gsap = g; gsap.set(j, { transformPerspective: P.perspective, transformOrigin: "center center" }); }
      S.raf(() => { read(); return on; });
    }).catch(() => {});
  }, () => { on = false; if (inside) leave(); });
})();
