/* Fig. 9: the frame treatments from tools/prep_media.py, rebuilt on a made-up
   test image (never one of hers). Every memory becomes a 1440 x 1080 frame
   (docs/MEDIA.md): a centre crop was tried and rejected; what shipped scales
   the picture to fit whole and fills the rest with a blurred, darkened cover
   of itself. The card shader then samples a 16:9 window from the middle of
   that 4:3 frame (materials.js:244-246). */
const FW = 1440, FH = 1080;
const SHAPES = {
  portrait: { w: 1080, h: 1440, label: "1080 × 1440" },
  landscape: { w: 1440, h: 1080, label: "1440 × 1080" },
  video: { w: 1920, h: 1080, label: "1920 × 1080" },
};
const INK = "#1d1b18";

/* The test image: flat shapes only. A and B sit on its top and bottom edges so
   you can see what a treatment keeps. */
function testImage(shape) {
  const { w, h } = SHAPES[shape];
  const s = 0.25; // draw at quarter size; plenty for the figure
  const cv = document.createElement("canvas");
  cv.width = Math.round(w * s); cv.height = Math.round(h * s);
  const c = cv.getContext("2d"), W = cv.width, H = cv.height;
  c.fillStyle = "#c9d3c4"; c.fillRect(0, 0, W, H);            // sky
  c.fillStyle = "#7a9c6f"; c.fillRect(0, H * 0.72, W, H * 0.28); // ground
  c.fillStyle = "#e0b04f"; c.beginPath(); c.arc(W * 0.22, H * 0.2, Math.min(W, H) * 0.09, 0, Math.PI * 2); c.fill(); // sun
  c.fillStyle = "#3f5140";                                       // a column, the subject
  const cw = Math.min(W, H) * 0.16;
  c.beginPath(); c.roundRect(W / 2 - cw / 2, H * 0.24, cw, H * 0.6, [cw / 2, cw / 2, 0, 0]); c.fill();
  c.fillStyle = "#2b302c"; c.fillRect(W / 2 - cw, H * 0.82, cw * 2, H * 0.06);
  // stripes on the right, so a crop shows where it cut
  c.fillStyle = "#f3f1ea";
  for (let i = 0; i < 6; i++) c.fillRect(W * 0.78, H * (0.3 + i * 0.07), W * 0.14, H * 0.025);
  // edge markers
  const tag = (txt, y) => {
    const fs = Math.round(Math.min(W, H) * 0.075);
    c.fillStyle = INK; c.fillRect(W / 2 - fs * 0.75, y, fs * 1.5, fs * 1.3);
    c.fillStyle = "#f3f1ea"; c.font = `600 ${fs}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif`;
    c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(txt, W / 2, y + fs * 0.68);
  };
  const fs = Math.round(Math.min(W, H) * 0.075);
  tag("A", 0); tag("B", H - fs * 1.3);
  c.strokeStyle = INK; c.lineWidth = 2; c.strokeRect(1, 1, W - 2, H - 2);
  return cv;
}

export function mountMedia(fig) {
  const srcC = fig.querySelector(".md-srcc"), outC = fig.querySelector(".md-outc");
  const read = fig.querySelector(".md-read");
  const srcLabel = fig.querySelector(".md-src .md-l");
  const fitTabs = [...fig.querySelectorAll("[data-fit]")];
  const shapeBtns = [...fig.querySelectorAll("[data-shape]")];
  const winBtn = fig.querySelector("[data-win]");
  let fit = "blur", shape = "portrait", win = false;

  function draw() {
    const img = testImage(shape);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // source, at its own shape
    const sw = srcC.clientWidth || 200;
    const sh = sw * (SHAPES[shape].h / SHAPES[shape].w);
    srcC.style.height = sh + "px";
    srcC.width = Math.round(sw * dpr); srcC.height = Math.round(sh * dpr);
    const sc = srcC.getContext("2d");
    sc.setTransform(dpr, 0, 0, dpr, 0, 0);
    sc.drawImage(img, 0, 0, sw, sh);
    srcLabel.textContent = "Source, " + SHAPES[shape].label;

    // the frame
    const ow = outC.clientWidth || 480, oh = ow * FH / FW;
    outC.style.height = oh + "px";
    outC.width = Math.round(ow * dpr); outC.height = Math.round(oh * dpr);
    const c = outC.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, ow, oh);
    const { w, h } = SHAPES[shape];
    const k = ow / FW; // frame px -> canvas px
    const cover = Math.max(FW / w, FH / h), contain = Math.min(FW / w, FH / h);
    const place = (scale) => { const dw = w * scale * k, dh = h * scale * k; return [(ow - dw) / 2, (oh - dh) / 2, dw, dh]; };
    let kept;
    if (fit === "crop") {
      c.drawImage(img, ...place(cover));
      kept = (FW * FH) / (w * cover * h * cover);
    } else {
      // blurred, darkened cover underneath: shrink hard, then stretch back up
      const tiny = document.createElement("canvas");
      tiny.width = 24; tiny.height = Math.max(2, Math.round(24 * h / w));
      const tc = tiny.getContext("2d");
      tc.imageSmoothingQuality = "high";
      tc.drawImage(img, 0, 0, tiny.width, tiny.height);
      c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";
      c.drawImage(tiny, ...place(cover));
      c.fillStyle = "rgba(10,14,10,0.38)"; c.fillRect(0, 0, ow, oh);
      c.drawImage(img, ...place(contain));
      kept = 1;
    }
    // the 16:9 window the card samples: full width, the middle 75% of height
    const cardH = oh * (9 / 16) / (3 / 4);
    const shownH = fit === "crop" ? (FH * 0.75) / (h * cover) : Math.min(1, (FH * 0.75) / (h * contain));
    const shownW = fit === "crop" ? FW / (w * cover) : Math.min(1, FW / (w * contain));
    if (win) {
      c.fillStyle = "rgba(243,241,234,0.62)";
      c.fillRect(0, 0, ow, (oh - cardH) / 2); c.fillRect(0, (oh + cardH) / 2, ow, (oh - cardH) / 2);
      c.setLineDash([5, 4]); c.strokeStyle = INK; c.lineWidth = 1.5;
      c.strokeRect(1, (oh - cardH) / 2, ow - 2, cardH); c.setLineDash([]);
    }
    c.strokeStyle = "rgba(29,27,24,0.35)"; c.lineWidth = 1; c.strokeRect(0.5, 0.5, ow - 1, oh - 1);
    read.innerHTML = `<li>scale <b>${(fit === "crop" ? cover : contain).toFixed(3)}</b></li><li>picture kept <b>${Math.round(kept * 100)}%</b></li><li>on the card <b>${Math.round(shownW * 100)}% wide</b></li><li><b>${Math.round(shownH * 100)}% tall</b></li>`;
    outC.setAttribute("aria-label", `The ${SHAPES[shape].label} test image in the 1440 by 1080 frame, ${fit === "crop" ? "centre cropped" : "fit whole over a blurred fill"}. ${Math.round(kept * 100)}% of the picture is kept.`);
  }

  fitTabs.forEach((b) => b.addEventListener("click", () => { fit = b.dataset.fit; fitTabs.forEach((x) => x.setAttribute("aria-selected", String(x === b))); draw(); }));
  shapeBtns.forEach((b) => b.addEventListener("click", () => { shape = b.dataset.shape; shapeBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b))); draw(); }));
  winBtn.addEventListener("click", () => { win = !win; winBtn.setAttribute("aria-pressed", String(win)); draw(); });
  let lastW = 0;
  new ResizeObserver(() => { const w = outC.parentElement.clientWidth; if (w !== lastW) { lastW = w; draw(); } }).observe(outC.parentElement);
  draw();
  return { start() {}, stop() {} };
}
