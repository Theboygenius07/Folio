/* Fig. 7: the focus card's motion, drawn.
   The card is the one in focus.js (Subtitles/views/freeform.js:255-310): it opens over
   0.7 s on expo.inOut, rests tipped back 5 degrees, tilts toward the pointer by
   5 - dy*10 and dx*9 over 0.4 s on power2.out, and swings back on elastic.out(1, 0.55)
   over 0.8 s when the pointer leaves. Here each curve is drawn with the live value on it. */
import { WEEKS } from "./data.js";
import { cloudinaryUrl, tween, ease, curvePath, fmt, clamp } from "./util.js";
import { CARD } from "./focus.js";

export function initCardFig(fig) {
  const area = fig.querySelector(".cf-area");
  const card = fig.querySelector(".cf-card");
  const img = card.querySelector("img");
  const out = fig.querySelector("[data-cf-readout]");
  const plots = {
    open: fig.querySelector("[data-cf-plot='open']"),
    back: fig.querySelector("[data-cf-plot='back']"),
  };
  const photo = WEEKS.find((p) => p.week === 30);
  img.src = cloudinaryUrl(photo.url, 760);
  img.alt = `Week 30, with its subtitle burned in: ${photo.subtitle}`;

  // the two curves
  const elastic = ease["elastic.out(1, 0.55)"];
  let eMax = 1, eMin = 0;
  for (let i = 0; i <= 200; i++) { const v = elastic(i / 200); eMax = Math.max(eMax, v); eMin = Math.min(eMin, v); }
  const PW = 240, PH = 120;
  const setup = (svg, f, yMin, yMax) => {
    svg.setAttribute("viewBox", `-2 -8 ${PW + 4} ${PH + 16}`);
    svg.querySelector(".cf-curve").setAttribute("d", curvePath(f, PW, PH, { yMin, yMax }));
    const y1 = PH - ((1 - yMin) / (yMax - yMin)) * PH, y0 = PH - ((0 - yMin) / (yMax - yMin)) * PH;
    svg.querySelector(".cf-one").setAttribute("y1", y1); svg.querySelector(".cf-one").setAttribute("y2", y1);
    svg.querySelector(".cf-zero").setAttribute("y1", y0); svg.querySelector(".cf-zero").setAttribute("y2", y0);
    return { svg, f, yMin, yMax, dot: svg.querySelector(".cf-dot"), head: svg.querySelector(".cf-head") };
  };
  const P = {
    open: setup(plots.open, ease["expo.inOut"], 0, 1),
    back: setup(plots.back, elastic, Math.min(0, eMin) - 0.05, eMax + 0.05),
  };
  const mark = (pl, p) => {
    const v = pl.f(p);
    const x = p * PW, y = PH - ((v - pl.yMin) / (pl.yMax - pl.yMin)) * PH;
    pl.dot.setAttribute("cx", x.toFixed(1)); pl.dot.setAttribute("cy", y.toFixed(1));
    pl.head.setAttribute("x1", x.toFixed(1)); pl.head.setAttribute("x2", x.toFixed(1));
    pl.svg.classList.toggle("is-run", p > 0 && p < 1);
  };
  mark(P.open, 1); mark(P.back, 1);

  // card state
  const s = { left: 0, top: 0, width: 0, height: 0, r: CARD.R1, rx: CARD.REST_X, ry: 0 };
  let final = null;
  function layout() {
    const w = area.clientWidth, h = area.clientHeight;
    let W = Math.round(w * CARD.W), H = Math.round(W * 9 / 16);
    if (H > h * CARD.H) { H = Math.round(h * CARD.H); W = Math.round(H * 16 / 9); }
    final = { left: Math.round((w - W) / 2), top: Math.round((h - H) / 2), width: W, height: H };
    Object.assign(s, final);
    paint();
  }
  function paint() {
    card.style.left = s.left + "px"; card.style.top = s.top + "px";
    card.style.width = s.width + "px"; card.style.height = s.height + "px";
    card.style.borderRadius = s.r + "px";
    card.style.transform = `perspective(${CARD.PERSP}px) rotateX(${s.rx}deg) rotateY(${s.ry}deg)`;
    out.innerHTML = `<li>rotateX <b>${fmt(s.rx, 1)}°</b></li><li>rotateY <b>${fmt(s.ry, 1)}°</b></li><li>perspective <b>1100px</b></li><li>corners <b>${fmt(s.r, 0)}px</b></li>`;
  }

  let stopTilt = () => {};
  const tiltTo = (rx, ry, dur, e, onUpdate) => {
    stopTilt();
    stopTilt = tween(s, { rx, ry }, { duration: dur, ease: e, onUpdate: (p) => { paint(); onUpdate && onUpdate(p); }, instant: Study.reduce ? undefined : false });
  };
  let opening = false;
  const onMove = (e) => {
    if (opening) return;
    const r = card.getBoundingClientRect();
    const dx = clamp(((e.clientX - r.left) / r.width - 0.5) * 2, -1, 1);
    const dy = clamp(((e.clientY - r.top) / r.height - 0.5) * 2, -1, 1);
    tiltTo(CARD.REST_X - dy * CARD.TILT_X, dx * CARD.TILT_Y, 0.4, "power2.out");
  };
  const onLeave = () => {
    if (opening) return;
    tiltTo(CARD.REST_X, 0, 0.8, "elastic.out(1, 0.55)", (p) => mark(P.back, p));
  };
  card.addEventListener("pointermove", onMove);
  card.addEventListener("pointerleave", onLeave);
  card.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") onLeave(); });
  card.style.touchAction = "none";

  // keyboard: arrows tilt, Escape lets go
  card.addEventListener("keydown", (e) => {
    const k = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
    if (k) { e.preventDefault(); tiltTo(CARD.REST_X - k[0] * CARD.TILT_X, k[1] * CARD.TILT_Y, 0.4, "power2.out"); setTimeout(onLeave, 500); }
  });

  // replay the open: from a 16:9 thumbnail at the left edge to the card
  function replay() {
    if (!final) return;
    opening = true;
    stopTilt();
    const tw = Math.round(final.width * 0.22);
    Object.assign(s, { left: 8, top: area.clientHeight - Math.round(tw * 9 / 16) - 8, width: tw, height: Math.round(tw * 9 / 16), r: CARD.R0, rx: 0, ry: 0 });
    paint();
    tween(s, { ...final, r: CARD.R1, rx: CARD.REST_X }, {
      duration: CARD.OPEN, ease: "expo.inOut", instant: false,
      onUpdate: (p) => { paint(); mark(P.open, p); },
      onDone: () => { opening = false; mark(P.open, 1); },
    });
  }
  fig.querySelector("[data-cf-replay]").addEventListener("click", replay);
  fig.querySelector("[data-cf-shake]").addEventListener("click", () => {
    if (opening) return;
    Object.assign(s, { rx: CARD.REST_X - CARD.TILT_X, ry: CARD.TILT_Y });
    paint();
    setTimeout(() => tiltTo(CARD.REST_X, 0, 0.8, "elastic.out(1, 0.55)", (p) => mark(P.back, p)), 60);
  });

  new ResizeObserver(() => { if (!opening) layout(); }).observe(area);
  layout();
}
