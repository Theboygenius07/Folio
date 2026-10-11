/* Fig. 1: Wire's home page, live. app/page.tsx puts a RepelDotGrid behind the page
   (app/page.tsx:29) and another inside each product card (app/page.tsx:56). Same here:
   one field for the paper, one per card, each listening to its own element. */
import { repelGrid, track } from "./dots.js";
import { S, $, $$, playGate } from "./util.js";

export function initHero(fig) {
  const field = $(".w-hero-field", fig);
  const page = repelGrid($(".w-hero-canvas", fig), { fade: 110 });
  const cards = $$(".w-card", fig).map((el) => ({ el, g: repelGrid($("canvas", el)) }));
  const all = [page, ...cards.map((c) => c.g)];
  const out = $("[data-hero-off]", fig);

  const layout = () => {
    const r = field.getBoundingClientRect();
    page.layout(r.width, r.height);
    cards.forEach((c) => { const b = c.el.getBoundingClientRect(); c.g.layout(b.width, b.height); });
  };

  track(field, (p) => page.setMouse(p), () => page.setMouse(null));
  cards.forEach((c) => track(c.el, (p) => c.g.setMouse(p), () => c.g.setMouse(null)));

  // RepelDotGrid.tsx:55 turns the repel off for reduced motion. Play turns it back on.
  if (S().reduce) {
    all.forEach((g) => g.setEnabled(false));
    playGate($("[data-hero-play]", fig), () => all.forEach((g) => g.setEnabled(true)));
  }

  let running = false, built = false, last = "";
  const loop = (t, dt) => {
    if (!running) return false;
    let off = 0;
    for (const g of all) { g.draw(dt); off = Math.max(off, g.maxOff); }
    const s = off.toFixed(1) + "px";
    if (s !== last) { out.textContent = s; last = s; }
  };
  S().onVisible(fig, () => {
    if (!built) { built = true; layout(); new ResizeObserver(() => layout()).observe(field); }
    running = true; S().raf(loop);
  }, () => { running = false; });
}
