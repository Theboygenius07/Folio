/* Small helpers the figures share. */
export const Study = window.Study;
export const SVGNS = "http://www.w3.org/2000/svg";

/** Make an SVG element with attributes. */
export function s(tag, attrs = {}, parent) {
  const el = document.createElementNS(SVGNS, tag);
  for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) el.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(el);
  return el;
}
export function txt(parent, x, y, str, attrs = {}) {
  // .ann sets its size in CSS, which beats a presentation attribute, so a size given here goes inline
  if (attrs["font-size"] !== undefined) attrs = { ...attrs, style: `${attrs.style ? attrs.style + "; " : ""}font-size: ${attrs["font-size"]}px` };
  const t = s("text", { x, y, ...attrs }, parent);
  t.textContent = str;
  return t;
}

/** Sizes an SVG's viewBox to its rendered pixels, so 12px text stays 12px on a phone.
    Calls draw(w, h) whenever the width changes. */
export function fitSvg(svg, heightFor, draw) {
  let lastW = 0;
  const run = () => {
    const w = Math.round(svg.parentElement.clientWidth > 0 ? svg.getBoundingClientRect().width : 0) || 600;
    if (Math.abs(w - lastW) < 1) return;
    lastW = w;
    const h = Math.round(heightFor(w));
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);
    svg.style.height = h + "px";
    draw(w, h);
  };
  const ro = new ResizeObserver(run);
  ro.observe(svg.parentElement);
  run();
  return { redraw: () => { lastW = 0; run(); } };
}

/** Text tabs: one selected at a time. */
export function tabs(root, attr, onPick) {
  const btns = [...root.querySelectorAll(`[${attr}]`)];
  const pick = (v, fire = true) => {
    btns.forEach((b) => b.setAttribute(b.getAttribute("role") === "tab" ? "aria-selected" : "aria-pressed", String(b.getAttribute(attr) === v)));
    if (fire) onPick(v);
  };
  btns.forEach((b) => b.addEventListener("click", () => pick(b.getAttribute(attr))));
  // arrow keys move along a tablist, the way tabs do
  const list = btns[0] && btns[0].parentElement;
  if (list && list.getAttribute("role") === "tablist") {
    list.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const i = btns.indexOf(document.activeElement);
      if (i < 0) return;
      const j = (i + (e.key === "ArrowRight" ? 1 : -1) + btns.length) % btns.length;
      btns[j].focus(); btns[j].click(); e.preventDefault();
    });
  }
  return pick;
}

export const readout = (root) => {
  const map = {};
  root.querySelectorAll("[data-r]").forEach((b) => { map[b.dataset.r] = b; });
  return (k, v) => { const b = map[k]; if (b && b.textContent !== v) b.textContent = v; };
};

export const css = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();
export const deg = (r) => (r * 180) / Math.PI;
export const num = (n, d = 1) => {
  const v = Math.abs(n) < 0.5 * 10 ** -d ? 0 : n;
  return v.toFixed(d).replace("-", "−");
};
export const comma = (n) => Math.round(n).toLocaleString("en-GB");

/** Drag on an element, with pointer capture. */
export function drag(el, on) {
  let active = false;
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    active = true; el.setPointerCapture(e.pointerId);
    on.start && on.start(e);
  });
  el.addEventListener("pointermove", (e) => { if (active) on.move && on.move(e); });
  const end = (e) => { if (!active) return; active = false; on.end && on.end(e); };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}
