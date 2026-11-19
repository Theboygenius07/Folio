/* The site's crayon hand, shared by every page: the name drawn as "Seyi" (with a flower for the dot of the i), and a
   small illustration for each project where a page points to it next. Drawn the way chalk draws: flat colour, white
   streaks clipped inside where the wax skips, and a grain that boils at 4 frames every 0.6s. Asked for less motion,
   the grain holds still. Everything is seeded, so a drawing comes out the same every time. */
(() => {
  "use strict";
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const f = (n) => n.toFixed(1);
  const rng = (seed) => { let s = (seed % 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const hatch = (x0, y0, x1, y1, seed, step) => {
    const rnd = rng(seed), h = y1 - y0, dx = h * Math.tan(-0.55); let d = "";
    for (let x = x0 - Math.abs(dx); x < x1 + Math.abs(dx); x += step * (0.6 + rnd() * 0.9)) {
      const a = 0.15 + rnd() * 0.25, b = 0.55 + rnd() * 0.4;
      d += `M${f(x + dx * a)} ${f(y0 + h * a)} L${f(x + dx * b)} ${f(y0 + h * b)} `;
    }
    return d;
  };
  const circle = (cx, cy, r) => `M${f(cx - r)} ${f(cy)} a${f(r)} ${f(r)} 0 1 0 ${f(r * 2)} 0 a${f(r)} ${f(r)} 0 1 0 ${f(-r * 2)} 0 Z`;
  const flower = (cx, cy, r) => { let d = ""; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5, x = cx + Math.cos(a) * r * 0.5, y = cy + Math.sin(a) * r * 0.5, p = r * 0.52; d += `M${f(x - p)} ${f(y)} a${f(p)} ${f(p)} 0 1 0 ${f(p * 2)} 0 a${f(p)} ${f(p)} 0 1 0 ${f(-p * 2)} 0 Z `; } return d; };
  const star = (cx, cy, r) => { let d = ""; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; d += `${i ? "L" : "M"}${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr)}`; } return d + "Z"; };
  const blob = (x, y, w, h, r, wob = 0) => { const a = r + wob, b = r - wob; return `M${f(x + a)} ${f(y)} H${f(x + w - b)} Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + b)} V${f(y + h - a)} Q${f(x + w)} ${f(y + h)} ${f(x + w - a)} ${f(y + h)} H${f(x + b)} Q${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - b)} V${f(y + a)} Q${f(x)} ${f(y)} ${f(x + a)} ${f(y)} Z`; };
  const heart = (cx, cy, s) => `M${f(cx)} ${f(cy + s * 0.62)} C${f(cx - s * 0.98)} ${f(cy + s * 0.02)} ${f(cx - s * 0.8)} ${f(cy - s * 0.72)} ${f(cx - s * 0.3)} ${f(cy - s * 0.62)} C${f(cx - s * 0.1)} ${f(cy - s * 0.58)} ${f(cx - s * 0.02)} ${f(cy - s * 0.42)} ${f(cx)} ${f(cy - s * 0.3)} C${f(cx + s * 0.02)} ${f(cy - s * 0.42)} ${f(cx + s * 0.1)} ${f(cy - s * 0.58)} ${f(cx + s * 0.3)} ${f(cy - s * 0.62)} C${f(cx + s * 0.8)} ${f(cy - s * 0.72)} ${f(cx + s * 0.98)} ${f(cy + s * 0.02)} ${f(cx)} ${f(cy + s * 0.62)} Z`;

  // the grain, once per page, boiling unless less motion is asked for
  const BOIL = calm ? ["", ""] : ['<animate attributeName="seed" values="11;23;37;41" dur="0.6s" calcMode="discrete" repeatCount="indefinite"/>', '<animate attributeName="seed" values="5;9;14;18" dur="0.6s" calcMode="discrete" repeatCount="indefinite"/>'];
  document.body.insertAdjacentHTML("beforeend", `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
    <filter id="cy-grain" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" result="n">${BOIL[0]}</feTurbulence><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -3.2 0 0 0 2.75" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in" result="t"/><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="5" result="w">${BOIL[1]}</feTurbulence><feDisplacementMap in="t" in2="w" scale="2.2" xChannelSelector="R" yChannelSelector="G"/></filter>
    <filter id="cy-word" x="-4%" y="-12%" width="108%" height="124%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" seed="3" result="n"></feTurbulence><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -4 0 0 0 3.6" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in" result="t"/><feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="7" result="w"></feTurbulence><feDisplacementMap in="t" in2="w" scale="1.6" xChannelSelector="R" yChannelSelector="G"/></filter>
  </defs></svg>`);

  // the name's look, here so every page draws it the same; colours come from whichever page it's on
  document.head.insertAdjacentHTML("beforeend", `<style>
    .seyi { display: block; height: 40px; width: auto; overflow: visible; }
    .seyi-t { font: 900 36px "Londrina Solid", "Shantell Sans", sans-serif; letter-spacing: 0.01em; }
    .seyi-ink { fill: var(--sy-ink, var(--fg, var(--ink, var(--u-ink, #1d1b18)))); transition: fill .8s; }
    .seyi-petal { fill: #E4492A; }
    .seyi-heart { fill: #F5B21E; }
    .seyi-word { transform-box: fill-box; transform-origin: 40% 70%; transform: rotate(-3deg); transition: transform .5s cubic-bezier(.34, 1.56, .64, 1); }
    .seyi-flower { transform-box: view-box; transition: transform .6s cubic-bezier(.34, 1.56, .64, 1); }
    a:hover .seyi-word, a:focus-visible .seyi-word { transform: rotate(-6deg) scale(1.05); }
    a:hover .seyi-flower, a:focus-visible .seyi-flower { transform: rotate(72deg) scale(1.2); }
    @media (max-width: 560px) { .seyi { height: 35px; } }
    @media (prefers-reduced-motion: reduce) { .seyi-word, .seyi-flower { transition: none; } }
  </style>`);

  let uid = 0;
  // one crayon shape: flat colour, white streaks clipped inside, grain over the lot
  const shape = (d, fill, seed, step = 9, w = 3.4) => {
    const id = "cy" + uid++;
    return `<g filter="url(#cy-grain)"><clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="${fill}"/><g clip-path="url(#${id})"><path d="${hatch(0, 0, 160, 160, seed, step)}" fill="none" stroke="#fff" stroke-opacity=".42" stroke-width="${w}" stroke-linecap="round"/></g></g>`;
  };
  const line = (d, colour, w = 5) => `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" filter="url(#cy-grain)"/>`;

  /* ---------- one drawing per project (160 × 160) ---------- */
  const ART = {
    // chalk's green buddy
    chalk: () => shape(blob(22, 36, 116, 96, 30, 4), "#29A383", 3, 12) +
      `<circle cx="62" cy="76" r="7.5" fill="#fff"/><circle cx="98" cy="76" r="7.5" fill="#fff"/>` +
      line("M60 98 Q80 116 100 98", "#fff", 7) + shape(star(136, 30, 13), "#F5B21E", 8, 7),
    // Cohort: a message, typing
    cohort: () => shape(blob(18, 30, 124, 88, 30, 3) + "M44 110 L30 144 L76 114 Z", "#1C34F5", 5, 12) +
      `<circle cx="54" cy="74" r="7.5" fill="#fff"/><circle cx="80" cy="74" r="7.5" fill="#fff" opacity=".8"/><circle cx="106" cy="74" r="7.5" fill="#fff" opacity=".6"/>`,
    // Wire: a sentence becomes money
    wire: () => shape("M94 12 L42 92 H76 L60 150 L122 62 H88 Z", "#C8DB1A", 7, 10) + shape(circle(126, 124, 20), "#F5B21E", 9, 7) +
      `<text x="126" y="132" text-anchor="middle" font-family="Shantell Sans, sans-serif" font-weight="800" font-size="22" fill="#5c6400">₦</text>`,
    // KULTURE*: a boarding pass
    kulture: () => shape("M24 44 H136 Q144 44 144 52 V70 A10 10 0 0 0 144 90 V108 Q144 116 136 116 H24 Q16 116 16 108 V90 A10 10 0 0 0 16 70 V52 Q16 44 24 44 Z", "#E6CF8B", 11, 11) +
      line("M110 52 V108", "#B59C52", 3).replace('stroke-linecap="round"', 'stroke-linecap="round" stroke-dasharray="3 7"') + shape(star(62, 80, 20), "#C01920", 12, 8),
    // Subtitles: a caption on the screen
    subtitles: () => shape(blob(12, 44, 136, 72, 14, 2), "#111111", 13, 14) + shape(blob(30, 62, 100, 12, 6), "#F5E400", 14, 6) + shape(blob(30, 84, 66, 12, 6), "#F5E400", 15, 6),
    // Clark: a streak's flame
    clark: () => shape("M80 14 C98 44 130 62 126 104 C123 134 103 150 80 150 C57 150 36 134 34 106 C32 80 50 68 58 50 C64 68 70 76 78 78 C84 58 87 38 80 14 Z", "#FF5B1F", 17, 11) +
      shape("M80 90 C90 104 102 112 100 126 C99 138 91 144 80 144 C69 144 60 138 60 126 C60 112 72 104 80 90 Z", "#FFD23F", 18, 7),
    // Tiwari Town: a boat at the jetty
    "tiwari-town": () => line("M80 28 V112", "#8A6A3E", 5) + shape("M86 30 L86 104 L132 104 Z", "#4A9FE0", 19, 8) + shape("M74 44 L74 104 L34 104 Z", "#F5B21E", 20, 8) +
      shape("M22 110 H138 L120 134 H40 Z", "#8A6A3E", 21, 9) + line("M10 146 Q30 136 50 146 T90 146 T130 146 T160 146", "#4A9FE0", 5),
    // Saleena Tiwari: a flower on a plinth, in her green
    "saleena-tiwari": () => shape(blob(48, 104, 64, 44, 6, 1), "#B9B4A8", 23, 9) + shape(blob(40, 96, 80, 14, 5), "#D4CFC2", 24, 7) +
      line("M80 96 V70", "#5E7F54", 5) + shape(flower(80, 56, 34), "#7A9C6F", 25, 8) + `<path d="${circle(80, 56, 6.5)}" fill="#F5B21E"/>` + shape(star(130, 30, 11), "#F5B21E", 26, 6),
    // Seyi's Park: a tree to hop round
    "seyis-park": () => shape(blob(72, 92, 16, 56, 5), "#8A6A3E", 27, 7) + shape(circle(80, 64, 40) + circle(50, 82, 26) + circle(110, 82, 26), "#3A8F3A", 28, 11) +
      shape(circle(98, 50, 7), "#E4492A", 29, 5) + shape(circle(60, 66, 6), "#E4492A", 30, 5),
    // Saleena: a gift of a heart
    saleena: () => shape(heart(78, 86, 70), "#E07BA0", 31, 11) + shape(star(132, 34, 13), "#F5B21E", 32, 7) + shape(star(30, 40, 9), "#4B63FF", 33, 6),
    // Raise: a network that grows
    raise: () => shape(blob(26, 98, 26, 48, 6), "#4B63FF", 34, 8) + shape(blob(66, 72, 26, 74, 6), "#4B63FF", 35, 8) + shape(blob(106, 42, 26, 104, 6), "#4B63FF", 36, 8) +
      shape(star(119, 22, 13), "#F5B21E", 37, 7),
  };

  document.querySelectorAll("[data-art]").forEach((el) => {
    const draw = ART[el.dataset.art];
    if (draw) el.innerHTML = `<svg viewBox="0 0 160 160" aria-hidden="true" focusable="false">${draw()}</svg>`;
  });

  /* ---------- the name, drawn: "Seyi" in crayon lettering ----------
     One colour, the bold lettering chalk's headlines use, with its grain; a slight tilt; and the dot of the i a red
     crayon flower. */
  const FS = 36, BASE = 38;
  const marks = [...document.querySelectorAll("[data-seyi]")];
  marks.forEach((el) => {
    el.setAttribute("aria-label", "Seyi Ogundipe");
    el.innerHTML = `<svg class="seyi" viewBox="0 0 84 48" aria-hidden="true" focusable="false"><g class="seyi-word">` +
      `<g class="seyi-ink" filter="url(#cy-word)"><text class="seyi-t" x="3" y="${BASE}">Seyi</text></g><g class="seyi-dot"></g></g></svg>`;
  });
  const measure = document.createElement("canvas").getContext("2d");
  const fit = () => marks.forEach((el) => {
    const svg = el.querySelector(".seyi");
    if (!svg) return;
    measure.font = `900 ${FS}px "Londrina Solid", "Shantell Sans", sans-serif`;
    const before = measure.measureText("Sey").width, all = measure.measureText("Seyi").width;
    const i = measure.measureText("i");
    // the i's ink, left to right, and the top of its dot
    const left = 3 + before - (i.actualBoundingBoxLeft || 0), right = 3 + before + (i.actualBoundingBoxRight || FS * 0.19);
    const dotTop = BASE - (i.actualBoundingBoxAscent || FS * 0.73);
    const cx = (left + right) / 2, dot = right - left, cy = dotTop + dot / 2, r = Math.max(FS * 0.2, dot * 0.98);
    svg.setAttribute("viewBox", `0 0 ${f(Math.max(3 + all, cx + r) + 6)} 48`);
    el.querySelector(".seyi-dot").innerHTML = `<g class="seyi-flower" style="transform-origin:${f(cx)}px ${f(cy)}px">` +
      `<g filter="url(#cy-grain)"><path class="seyi-petal" d="${flower(cx, cy, r)}"/></g><path class="seyi-heart" d="${circle(cx, cy, r * 0.26)}"/></g>`;
  });
  fit();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(fit, 150); });
})();
