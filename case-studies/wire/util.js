/* Small helpers shared by the Wire figures. */

export const S = () => window.Study;

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const NS = "http://www.w3.org/2000/svg";
export function svgEl(tag, attrs = {}, parent) {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) el.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(el);
  return el;
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const fmt = (n) => n.toLocaleString("en-NG");
export const naira = (n) => "₦" + n.toLocaleString("en-NG"); // dashboard/page.tsx:15-17

/* Redbrick-style text tabs: click, or arrow keys between them. onPick(button, index). */
export function tabs(group, onPick, attr = "aria-selected") {
  const btns = [...group.querySelectorAll("button")];
  const pick = (b, focus) => {
    btns.forEach((x) => {
      x.setAttribute(attr, String(x === b));
      if (group.getAttribute("role") === "tablist") x.tabIndex = x === b ? 0 : -1;
    });
    if (focus) b.focus();
    onPick(b, btns.indexOf(b));
  };
  btns.forEach((b) => {
    b.addEventListener("click", () => pick(b));
    if (group.getAttribute("role") === "tablist") {
      b.tabIndex = b.getAttribute(attr) === "true" ? 0 : -1;
      b.addEventListener("keydown", (e) => {
        const i = btns.indexOf(b);
        if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); pick(btns[(i + 1) % btns.length], true); }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); pick(btns[(i - 1 + btns.length) % btns.length], true); }
        if (e.key === "Home") { e.preventDefault(); pick(btns[0], true); }
        if (e.key === "End") { e.preventDefault(); pick(btns[btns.length - 1], true); }
      });
    }
  });
  return { btns, pick: (i) => pick(btns[i]) };
}

/* A curve between two boxes (DOMRects relative to the same origin): left-to-right when
   the target sits beside the source, top-to-bottom when it sits under it. */
export function wirePath(a, b) {
  const acx = a.left + a.width / 2, bcx = b.left + b.width / 2;
  const sideways = b.left >= a.right - 4 || a.left >= b.right - 4;
  if (sideways) {
    const fwd = bcx >= acx;
    const x1 = fwd ? a.right : a.left, x2 = fwd ? b.left : b.right;
    const y1 = a.top + Math.min(a.height / 2, 14), y2 = b.top + Math.min(b.height / 2, 14);
    const c = Math.max(24, Math.abs(x2 - x1) * 0.5);
    return { d: `M${x1},${y1} C${x1 + (fwd ? c : -c)},${y1} ${x2 - (fwd ? c : -c)},${y2} ${x2},${y2}`, x1, y1, x2, y2 };
  }
  const down = b.top >= a.top;
  const x1 = acx, x2 = bcx;
  const y1 = down ? a.bottom : a.top, y2 = down ? b.top : b.bottom;
  const c = Math.max(18, Math.abs(y2 - y1) * 0.5);
  return { d: `M${x1},${y1} C${x1},${y1 + (down ? c : -c)} ${x2},${y2 - (down ? c : -c)} ${x2},${y2}`, x1, y1, x2, y2 };
}

export function relRect(el, origin) {
  const r = el.getBoundingClientRect(), o = origin.getBoundingClientRect();
  return { left: r.left - o.left, top: r.top - o.top, right: r.right - o.left, bottom: r.bottom - o.top, width: r.width, height: r.height };
}

/* cubic-bezier(x1, y1, x2, y2) evaluated at time x, for plotting CSS easing */
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) { const e = sx(t) - x; if (Math.abs(e) < 1e-5) break; const d = dx(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
    t = clamp(t, 0, 1);
    return sy(t);
  };
}

/* show a "Play" button for readers who asked for less motion; resolve when pressed */
export function playGate(btn, onPlay) {
  if (!btn) return;
  btn.hidden = false;
  btn.addEventListener("click", () => { btn.hidden = true; onPlay(); }, { once: true });
}
