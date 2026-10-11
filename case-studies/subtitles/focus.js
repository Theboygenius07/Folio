/* The focus card: a photo lifts out of its place into a card.
   Ported from Subtitles/views/freeform.js:208-355 (globe.js:101-229 is the same card).
   Rebuilt to open inside its figure instead of over the whole window, on a paper veil
   instead of rgba(0,0,0,0.65). The numbers are the site's: 90% wide, 16:9, at most
   80% tall, 0.7 s expo.inOut out, 0.55 s expo.inOut back, corners 3 to 22 px,
   rotateX 5 at rest, tilt 5 - dy*10 and dx*9, perspective 1100 px, elastic.out(1, 0.55). */
import { tween, formatSubtitle, cloudinaryUrl, clamp } from "./util.js";

export const CARD = { W: 0.9, H: 0.8, OPEN: 0.7, CLOSE: 0.55, R0: 3, R1: 22, REST_X: 5, TILT_X: 10, TILT_Y: 9, PERSP: 1100 };

const open = new WeakMap();

export function openFocus({ host, photo, fromRect, getRect, onOpen, onClose }) {
  if (open.get(host)) return open.get(host);
  const hw = host.clientWidth, hh = host.clientHeight;

  const veil = document.createElement("div");
  veil.className = "fc-veil";
  veil.setAttribute("data-overlay", "");
  const card = document.createElement("div");
  card.className = "fc-card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-label", `Week ${photo.week}`);
  const img = document.createElement("img");
  img.alt = `Week ${photo.week}, with its subtitle burned in: ${photo.subtitle.replace(/\n/g, " ")}`;
  img.src = cloudinaryUrl(photo.url, Math.min(1600, Math.round(hw * 0.9)));
  img.draggable = false;
  card.appendChild(img);

  const cap = document.createElement("div");
  cap.className = "fc-cap";
  const wk = document.createElement("p");
  wk.className = "fc-week";
  wk.textContent = `Week ${photo.week}`;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "link-btn fc-close";
  close.textContent = "Close";
  const top = document.createElement("div");
  top.className = "fc-cap-top";
  top.append(wk, close);
  cap.append(top, formatSubtitle(photo.subtitle));

  veil.append(card, cap);
  host.appendChild(veil);

  // Final size: 90% of the width at 16:9, but no taller than 80% of the height
  // (freeform.js:217-219). Here the caption below takes its share of the height first.
  const capH = cap.offsetHeight + 14;
  const roomH = Math.max(120, hh * 0.92 - capH);
  let W = Math.round(hw * CARD.W), H = Math.round(W * 9 / 16);
  const maxH = Math.min(hh * CARD.H, roomH);
  if (H > maxH) { H = Math.round(maxH); W = Math.round(H * 16 / 9); }
  const L = Math.round((hw - W) / 2);
  const T = Math.round(Math.max(8, (hh - H - capH) / 2));
  cap.style.left = L + "px";
  cap.style.width = W + "px";
  cap.style.top = T + H + 14 + "px";

  const s = { left: fromRect.left, top: fromRect.top, width: fromRect.width, height: fromRect.height, r: CARD.R0, rx: 0, ry: 0, veil: 0, cap: 0, shadow: 0 };
  const paint = () => {
    card.style.left = s.left + "px";
    card.style.top = s.top + "px";
    card.style.width = s.width + "px";
    card.style.height = s.height + "px";
    card.style.borderRadius = s.r + "px";
    card.style.transform = `perspective(${CARD.PERSP}px) rotateX(${s.rx}deg) rotateY(${s.ry}deg)`;
    card.style.setProperty("--shadow", s.shadow.toFixed(3));
    veil.style.setProperty("--veil", s.veil.toFixed(3));
    cap.style.opacity = s.cap.toFixed(3);
  };
  paint();

  let tiltStop = () => {};
  const tilt = (rx, ry, duration, e) => {
    tiltStop();
    tiltStop = tween(s, { rx, ry }, { duration, ease: e, onUpdate: () => { paint(); api.onTilt && api.onTilt(s.rx, s.ry); } });
  };

  tween(s, { veil: 1 }, { duration: 0.55, ease: "power2.out", onUpdate: paint });
  tween(s, { left: L, top: T, width: W, height: H, r: CARD.R1, rx: CARD.REST_X, shadow: 1 }, { duration: CARD.OPEN, ease: "expo.inOut", onUpdate: paint });
  tween(s, { cap: 1 }, { duration: 0.2, ease: "linear", onUpdate: paint, instant: Study.reduce });

  // Pointer tilt (freeform.js:287-310). Hand tilt mixes in half and half (freeform.js:288-289).
  let pdx = 0, pdy = 0, hdx = 0, hdy = 0, handOn = false;
  const applyTilt = (fast) => {
    const dx = handOn ? pdx * 0.5 + hdx * 0.5 : pdx;
    const dy = handOn ? pdy * 0.5 + hdy * 0.5 : pdy;
    tilt(CARD.REST_X - dy * CARD.TILT_X, dx * CARD.TILT_Y, fast ? 0.12 : 0.4, "power2.out");
  };
  const onMove = (e) => {
    const r = card.getBoundingClientRect();
    pdx = clamp(((e.clientX - r.left) / r.width - 0.5) * 2, -1, 1);
    pdy = clamp(((e.clientY - r.top) / r.height - 0.5) * 2, -1, 1);
    if (!Study.reduce) applyTilt(false);
  };
  const onLeave = () => {
    pdx = 0; pdy = 0;
    if (!handOn && !Study.reduce) tilt(CARD.REST_X, 0, 0.8, "elastic.out(1, 0.55)");
  };
  card.addEventListener("pointermove", onMove);
  card.addEventListener("pointerleave", onLeave);
  const onHand = ({ detail }) => {
    handOn = !!detail.active;
    if (detail.active && !Study.reduce) {
      hdx = clamp((detail.rawX - 0.5) * 2.5, -1, 1);
      hdy = clamp((detail.rawY - 0.5) * 2.5, -1, 1);
      applyTilt(true);
    }
  };
  document.addEventListener("hand:move", onHand);
  // A held pinch anywhere closes it (freeform.js:323-324)
  const onHold = (e) => { e.preventDefault(); doClose(); };
  document.addEventListener("hand:hold", onHold);

  let closed = false;
  function doClose() {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("hand:move", onHand);
    document.removeEventListener("hand:hold", onHold);
    tiltStop();
    const d = (getRect && getRect()) || fromRect;
    s.cap = 0; paint();
    tween(s, { veil: 0 }, { duration: 0.45, ease: "power2.in", onUpdate: paint });
    tween(s, { left: d.left, top: d.top, width: d.width, height: d.height, r: CARD.R0, rx: 0, ry: 0, shadow: 0 }, {
      duration: CARD.CLOSE, ease: "expo.inOut", onUpdate: paint,
      onDone: () => { veil.remove(); open.delete(host); onClose && onClose(); },
    });
  }
  const onKey = (e) => { if (e.key === "Escape") doClose(); };
  document.addEventListener("keydown", onKey);
  veil.addEventListener("click", (e) => { if (e.target === veil) doClose(); });
  close.addEventListener("click", doClose);
  requestAnimationFrame(() => close.focus({ preventScroll: true }));

  const api = { close: doClose, card, veil, state: s, onTilt: null };
  open.set(host, api);
  onOpen && onOpen(api);
  return api;
}

export const isOpen = (host) => !!open.get(host);
