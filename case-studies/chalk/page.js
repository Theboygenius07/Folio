/*
 * chalk, the case study. Plain JS, no build step.
 *
 * 1. The crayon hand, ported from chalk's updates/crayon.tsx: the same seeded rng, hatch and shape, so every
 *    drawing here is the one chalk draws: flat colour, white streaks clipped inside, grain over the lot.
 * 2. The reader: the chapter rail on wide screens, the garlands drawing in as they're reached, the films.
 * 3. Five live figures, each running chalk's own mechanics with its real constants.
 */
(() => {
  "use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ================================================================ the crayon hand */

  const INK = {
    paper: "#FFFCF6", ink: "#16181F", cobalt: "#1F43D9", gold: "#F5B21E", goldDeep: "#DE8B0A", pink: "#E86FA0",
    pinkDeep: "#C94F84", jade: "#1F8C6E", buddy: "#29A383", red: "#E4492A", blue: "#3A7FDB", sky: "#6E9BE6",
    cloud: "#AFC9F0", green: "#2E8B57", grey: "#B9B4A8", brown: "#8A6A3E",
  };

  const rng = (seed) => { let s = (seed % 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const f = (n) => n.toFixed(1);

  /** White diagonal streaks across a box, as crayon leaves when it is laid down in strokes. */
  function hatch(x0, y0, x1, y1, seed, step = 24, angle = -0.55) {
    const rnd = rng(seed);
    let d = "";
    const h = y1 - y0, dx = h * Math.tan(angle);
    for (let x = x0 - Math.abs(dx); x < x1 + Math.abs(dx); x += step * (0.6 + rnd() * 0.9)) {
      const a = 0.15 + rnd() * 0.25, b = 0.55 + rnd() * 0.4;
      d += `M${f(x + dx * a)} ${f(y0 + h * a)} L${f(x + dx * b)} ${f(y0 + h * b)} `;
    }
    return d;
  }

  /** A flat crayon shape: colour, streaks clipped inside, grain over the lot. `grain: false` leaves the grain off. */
  function shape(id, d, fill, box, seed = 1, step = 22, op = 0.4, w = 5, grain = true, streaks = true) {
    const lines = streaks
      ? `<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="${fill}"/><g clip-path="url(#${id})"><path d="${hatch(box[0], box[1], box[2], box[3], seed, step)}" stroke="#FFFFFF" stroke-opacity="${op}" stroke-width="${w}" stroke-linecap="round" fill="none"/></g>`
      : `<path d="${d}" fill="${fill}"/>`;
    return `<g${grain ? ' class="u-ink"' : ""}>${lines}</g>`;
  }

  /** A crayon line. `draws`: it draws itself in when its drawing is reached. */
  const stroke = (d, colour, width = 8, dash, draws = false) =>
    `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ""} class="${draws ? "u-ink u-line" : "u-ink"}"${draws ? ' pathLength="1"' : ""}/>`;

  /**
   * A crayon line whose grain is laid over a whole box. The grain's region is sized from what it covers, so a
   * nearly flat line (a timeline, a guess drawn level) would get a region with no height and vanish; an empty
   * rectangle the size of the figure gives it room.
   */
  const lineIn = (d, colour, width, box, dash, draws = false) =>
    `<g class="u-ink"><rect x="${box[0]}" y="${box[1]}" width="${box[2] - box[0]}" height="${box[3] - box[1]}" fill="none"/>` +
    `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ""}${draws ? ' class="u-line" pathLength="1"' : ""}/></g>`;

  /* ---------- the shapes ---------- */
  function flower(cx, cy, r) {
    let d = "";
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5, x = cx + Math.cos(a) * r * 0.5, y = cy + Math.sin(a) * r * 0.5, p = r * 0.52;
      d += `M${f(x - p)} ${f(y)} a${f(p)} ${f(p)} 0 1 0 ${f(p * 2)} 0 a${f(p)} ${f(p)} 0 1 0 ${f(-p * 2)} 0 Z `;
    }
    return d;
  }
  function daisy(cx, cy, r, petals = 10) {
    let d = "";
    for (let i = 0; i < petals; i++) {
      const a = (i * 2 * Math.PI) / petals, x = cx + Math.cos(a) * r * 0.62, y = cy + Math.sin(a) * r * 0.62;
      const rx = r * 0.42, ry = r * 0.17, c = Math.cos(a), s = Math.sin(a), deg = f((a * 180) / Math.PI);
      d += `M${f(x - c * rx)} ${f(y - s * rx)} A${f(rx)} ${f(ry)} ${deg} 1 1 ${f(x + c * rx)} ${f(y + s * rx)} A${f(rx)} ${f(ry)} ${deg} 1 1 ${f(x - c * rx)} ${f(y - s * rx)} Z `;
    }
    return d;
  }
  function star(cx, cy, r) {
    let d = "";
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
      d += `${i ? "L" : "M"}${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr)}`;
    }
    return `${d}Z`;
  }
  const circle = (cx, cy, r) => `M${f(cx - r)} ${f(cy)} a${f(r)} ${f(r)} 0 1 0 ${f(r * 2)} 0 a${f(r)} ${f(r)} 0 1 0 ${f(-r * 2)} 0 Z`;
  /** A rounded box whose corners aren't quite equal: drawn, not machined. */
  function blob(x, y, w, h, r, wob = 0) {
    const a = r + wob, b = r - wob;
    return `M${f(x + a)} ${f(y)} H${f(x + w - b)} Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + b)} V${f(y + h - a)} Q${f(x + w)} ${f(y + h)} ${f(x + w - a)} ${f(y + h)} H${f(x + b)} Q${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - b)} V${f(y + a)} Q${f(x)} ${f(y)} ${f(x + a)} ${f(y)} Z`;
  }
  const heart = (cx, cy, s) =>
    `M${f(cx)} ${f(cy + s * 0.62)} C${f(cx - s * 0.98)} ${f(cy + s * 0.02)} ${f(cx - s * 0.8)} ${f(cy - s * 0.72)} ${f(cx - s * 0.3)} ${f(cy - s * 0.62)} C${f(cx - s * 0.1)} ${f(cy - s * 0.58)} ${f(cx - s * 0.02)} ${f(cy - s * 0.42)} ${f(cx)} ${f(cy - s * 0.3)} C${f(cx + s * 0.02)} ${f(cy - s * 0.42)} ${f(cx + s * 0.1)} ${f(cy - s * 0.58)} ${f(cx + s * 0.3)} ${f(cy - s * 0.62)} C${f(cx + s * 0.8)} ${f(cy - s * 0.72)} ${f(cx + s * 0.98)} ${f(cy + s * 0.02)} ${f(cx)} ${f(cy + s * 0.62)} Z`;
  /** A leafy blue sprig, rounded at its foot (the carousel's first slide, beside the big pink flower). */
  const sprig = (x, y, s) =>
    `M${f(x)} ${f(y)} C${f(x - s * 0.34)} ${f(y - s * 0.36)} ${f(x - s * 0.44)} ${f(y - s * 0.78)} ${f(x - s * 0.16)} ${f(y - s * 0.9)} ` +
    `C${f(x - s * 0.02)} ${f(y - s * 0.96)} ${f(x + s * 0.12)} ${f(y - s * 0.78)} ${f(x + s * 0.18)} ${f(y - s * 0.62)} ` +
    `C${f(x + s * 0.2)} ${f(y - s * 0.92)} ${f(x + s * 0.34)} ${f(y - s * 1.2)} ${f(x + s * 0.54)} ${f(y - s * 1.12)} ` +
    `C${f(x + s * 0.74)} ${f(y - s * 1.04)} ${f(x + s * 0.62)} ${f(y - s * 0.7)} ${f(x + s * 0.56)} ${f(y - s * 0.46)} ` +
    `C${f(x + s * 0.72)} ${f(y - s * 0.6)} ${f(x + s * 0.96)} ${f(y - s * 0.62)} ${f(x + s * 1.02)} ${f(y - s * 0.44)} ` +
    `C${f(x + s * 1.1)} ${f(y - s * 0.2)} ${f(x + s * 0.8)} ${f(y + s * 0.02)} ${f(x + s * 0.5)} ${f(y + s * 0.08)} ` +
    `C${f(x + s * 0.3)} ${f(y + s * 0.12)} ${f(x + s * 0.1)} ${f(y + s * 0.1)} ${f(x)} ${f(y)} Z`;

  /** chalk's nib, the cursor with a face, in its own 22 x 26 artwork. */
  const NIB_D = "M3 2 L3 19 Q3 20.5 4.4 19.6 L8 16.6 L11 23.4 Q11.6 24.8 12.9 24.2 L14.6 23.4 Q15.9 22.8 15.3 21.5 L12.2 15 L16.4 14.6 Q18 14.4 16.9 13.2 L4.9 1.4 Q3 -0.4 3 2 Z";
  /** The nib's path moved to (x, y) and scaled by s: every command in it is absolute, so its numbers are x, y pairs. */
  function nibPath(x, y, s) {
    let i = 0;
    return NIB_D.replace(/-?\d+(\.\d+)?/g, (m) => f((i++ % 2 === 0 ? x : y) + parseFloat(m) * s));
  }

  /** chalk's buddy: the green rounded square with a face. It bobs, and every few seconds it blinks. */
  function buddy(id, x, y, s, seed = 5) {
    return `<g class="u-bob">${shape(id, blob(x, y, s, s * 0.82, s * 0.3, s * 0.04), INK.buddy, [x, y, x + s, y + s], seed, s * 0.16)}` +
      `<g class="u-blink"><circle cx="${f(x + s * 0.36)}" cy="${f(y + s * 0.34)}" r="${f(s * 0.065)}" fill="#fff"/><circle cx="${f(x + s * 0.64)}" cy="${f(y + s * 0.34)}" r="${f(s * 0.065)}" fill="#fff"/></g>` +
      `<path d="M${f(x + s * 0.33)} ${f(y + s * 0.5)} Q${f(x + s * 0.5)} ${f(y + s * 0.66)} ${f(x + s * 0.67)} ${f(y + s * 0.5)}" stroke="#fff" stroke-width="${f(s * 0.06)}" stroke-linecap="round" fill="none"/></g>`;
  }

  /* ---------- one drawing per chapter (240 x 196) ---------- */
  const LONDRINA = "'Londrina Solid', sans-serif";
  function crayon(id, colour, angle, seed) {
    return `<g transform="rotate(${angle} 120 186)">` +
      shape(`${id}t`, "M107 66 L115 38 Q120 28 125 38 L133 66 Z", colour, [107, 28, 133, 66], seed, 8) +
      shape(`${id}b`, blob(104, 62, 32, 116, 6, 1), colour, [104, 62, 136, 178], seed + 1, 12) +
      `<path d="${blob(104, 100, 32, 50, 3)}" fill="#FFFDF8" fill-opacity=".92"/>` +
      `<path d="M111 113 H129 M111 137 H129" stroke="${colour}" stroke-width="3.5" stroke-linecap="round"/></g>`;
  }
  const ART = {
    laptop: (k) =>
      shape(`${k}l`, blob(46, 18, 148, 100, 12, 2), INK.buddy, [46, 18, 194, 118], 35) +
      `<g class="u-blink"><circle cx="104" cy="58" r="7" fill="#fff"/><circle cx="136" cy="58" r="7" fill="#fff"/></g>` +
      `<path d="M100 78 Q120 94 140 78" stroke="#fff" stroke-width="6" stroke-linecap="round" fill="none"/>` +
      `<path d="M30 122 H210 L198 134 H42 Z" fill="${INK.grey}" class="u-ink"/>` +
      [[88, "⌘"], [136, "⌥"]].map(([x, glyph], i) =>
        shape(`${k}k${i}`, blob(x - 18, 146, 36, 36, 8), INK.gold, [x - 18, 146, x + 18, 182], 50 + i, 10) +
        `<text x="${x}" y="172" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="20" fill="${INK.ink}">${glyph}</text>`).join(""),
    nib: (k) => {
      const s = 4, nx = 118, ny = 88;
      return stroke(blob(24, 24, 120, 86, 18), INK.buddy, 5) +
        shape(`${k}b`, blob(36, 36, 96, 62, 12, 2), INK.gold, [36, 36, 132, 98], 101, 14) +
        `<path d="M64 84 V70 M84 84 V56 M104 84 V64" stroke="#fff" stroke-width="8" stroke-linecap="round" fill="none"/>` +
        shape(`${k}n`, nibPath(nx, ny, s), INK.buddy, [nx, ny, nx + 22 * s, ny + 26 * s], 102, 12) +
        `<g class="u-blink"><circle cx="${f(nx + 5.3 * s)}" cy="${f(ny + 7.6 * s)}" r="4" fill="#fff"/><circle cx="${f(nx + 8.9 * s)}" cy="${f(ny + 7.6 * s)}" r="4" fill="#fff"/></g>` +
        `<path d="M${f(nx + 5.2 * s)} ${f(ny + 11 * s)} Q${f(nx + 7.1 * s)} ${f(ny + 12.7 * s)} ${f(nx + 9 * s)} ${f(ny + 11 * s)}" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none"/>` +
        shape(`${k}s1`, star(204, 40, 16), INK.pink, [188, 24, 220, 56], 103, 10) +
        shape(`${k}s2`, star(44, 154, 12), INK.blue, [32, 142, 56, 166], 104, 8);
    },
    board: (k) =>
      stroke("M84 128 L64 182 M156 128 L176 182", INK.brown, 7) +
      shape(`${k}b`, blob(46, 22, 148, 110, 10, 2), INK.gold, [46, 22, 194, 132], 17) +
      `<path d="${blob(58, 33, 124, 88, 6)}" fill="#FFFDF8"/>` +
      stroke("M70 104 L98 82 L118 92 L146 56 L170 64", INK.red, 6) +
      shape(`${k}c`, circle(146, 56, 7), INK.jade, [139, 49, 153, 63], 2, 6),
    pencil: (k) =>
      stroke("M24 150 C70 60, 110 40, 150 92 S196 160, 222 126", INK.ink, 4, "2 12") +
      `<g transform="rotate(-38 140 90)">` +
      shape(`${k}p`, "M70 78 H178 L204 90 L178 102 H70 Z", INK.pink, [70, 78, 204, 102], 12, 12) +
      `<path d="M178 78 L204 90 L178 102 Z" fill="#F2D2A5"/><path d="M196 86.3 L204 90 L196 93.7 Z" fill="${INK.ink}"/>` +
      shape(`${k}e`, blob(56, 78, 18, 24, 4), INK.gold, [56, 78, 74, 102], 5, 8) + `</g>` +
      shape(`${k}s`, star(40, 54, 14), INK.blue, [26, 40, 54, 68], 14, 9),
    calendar: (k) =>
      shape(`${k}c`, blob(56, 30, 128, 140, 12, 2), INK.jade, [56, 30, 184, 170], 27) +
      `<path d="${blob(56, 30, 128, 30, 12)}" fill="#16705A"/>` +
      `<circle cx="88" cy="30" r="6" fill="${INK.ink}"/><circle cx="152" cy="30" r="6" fill="${INK.ink}"/>` +
      `<text x="120" y="148" text-anchor="middle" font-family="${LONDRINA}" font-weight="900" font-size="96" fill="#fff" filter="url(#u-crayon-text)">7</text>` +
      shape(`${k}s`, star(200, 150, 16), INK.gold, [184, 134, 216, 166], 9, 10),
    cards: (k) =>
      `<g transform="rotate(-8 100 110)">${shape(`${k}a`, blob(40, 70, 130, 88, 10, 2), INK.gold, [40, 70, 170, 158], 22)}</g>` +
      `<g transform="rotate(5 120 104)">${shape(`${k}b`, blob(56, 58, 136, 92, 10, 2), INK.blue, [56, 58, 192, 150], 23)}` +
      `<path d="M76 84 H166 M76 104 H172 M76 124 H140" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-opacity=".9"/></g>` +
      shape(`${k}q`, `${circle(194, 48, 28)} M176 66 L170 86 L192 72 Z`, INK.pink, [166, 20, 222, 86], 24, 12) +
      `<text x="194" y="60" text-anchor="middle" font-family="${LONDRINA}" font-weight="900" font-size="34" fill="#fff">?</text>`,
    phone: (k) =>
      shape(`${k}p`, blob(78, 14, 84, 168, 16, 2), INK.red, [78, 14, 162, 182], 33, 18) +
      `<path d="${blob(88, 30, 64, 128, 8)}" fill="#FFFDF8"/>` +
      `<path d="M110 76 L136 94 L110 112 Z" fill="${INK.red}"/>` +
      `<path d="M98 136 H142" stroke="${INK.grey}" stroke-width="5" stroke-linecap="round"/>` +
      shape(`${k}s1`, star(46, 60, 16), INK.gold, [30, 44, 62, 76], 6, 10) +
      shape(`${k}s2`, star(196, 130, 12), INK.pink, [184, 118, 208, 142], 7, 8),
    crayons: (k) =>
      lineIn("M22 184 C62 168 96 194 128 180 S192 170 220 186", INK.green, 5, [10, 150, 230, 196]) +
      crayon(`${k}c1`, INK.cobalt, -26, 111) + crayon(`${k}c3`, INK.gold, 26, 115) + crayon(`${k}c2`, INK.red, 0, 113) +
      shape(`${k}s1`, star(34, 56, 15), INK.pink, [19, 41, 49, 71], 117, 10) +
      shape(`${k}s2`, star(208, 128, 11), INK.jade, [197, 117, 219, 139], 118, 8),
  };

  /* ---------- the garland's own things ---------- */
  const pop = (at, inner) => `<g class="u-pop" style="--at:${at}"><g>${inner}</g></g>`;
  const Bloom = (id, x, y, r, colour, seed, at) => pop(at,
    shape(`${id}p`, flower(x, y, r), colour, [x - r, y - r, x + r, y + r], seed, r * 0.3) +
    shape(`${id}c`, circle(x, y, r * 0.17), INK.gold, [x - r * 0.2, y - r * 0.2, x + r * 0.2, y + r * 0.2], seed + 1, 6));
  const Daisy = (id, x, y, r, seed, at, colour = INK.gold) => pop(at,
    shape(`${id}p`, daisy(x, y, r, 12), colour, [x - r, y - r, x + r, y + r], seed, 10) +
    shape(`${id}c`, circle(x, y, r * 0.28), colour === INK.gold ? INK.red : INK.gold, [x - r * 0.3, y - r * 0.3, x + r * 0.3, y + r * 0.3], seed + 1, 6));
  const Star = (id, x, y, r, colour, seed, at) => pop(at, shape(id, star(x, y, r), colour, [x - r, y - r, x + r, y + r], seed, r * 0.6));

  /** The carousel's green line across the page, with a flower, a daisy and a star on it: a wide drawing, and a narrow one for phones. */
  function garland(k, flip, flowerColour) {
    const wide = `<svg class="u-garland u-wide" viewBox="0 0 1200 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">` +
      stroke(flip ? "M-20 80 C220 104 420 52 620 78 S980 110 1220 68" : "M-20 72 C200 46 400 110 620 82 S960 50 1220 88", INK.green, 7, null, true) +
      (flip
        ? Star(`${k}s`, 170, 42, 18, INK.blue, 62, 0) + Daisy(`${k}d`, 600, 78, 28, 63, 1) + Bloom(`${k}f`, 930, 82, 54, flowerColour, 61, 2)
        : Bloom(`${k}f`, 120, 70, 54, flowerColour, 61, 0) + Daisy(`${k}d`, 360, 96, 28, 63, 1) + Star(`${k}s`, 940, 44, 18, INK.gold, 62, 2)) +
      `</svg>`;
    const narrow = `<svg class="u-garland u-narrow" viewBox="0 0 400 130" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">` +
      stroke(flip ? "M-20 70 C80 90 160 50 240 68 S340 90 420 62" : "M-20 62 C80 42 160 90 240 72 S340 46 420 76", INK.green, 5, null, true) +
      Bloom(`${k}nf`, flip ? 340 : 60, flip ? 64 : 60, 38, flowerColour, 64, flip ? 2 : 0) +
      Daisy(`${k}nd`, flip ? 150 : 250, flip ? 64 : 76, 18, 65, 1) +
      Star(`${k}ns`, flip ? 44 : 352, 30, 12, flip ? INK.blue : INK.gold, 66, flip ? 0 : 2) +
      `</svg>`;
    return wide + narrow;
  }

  /** The hero's drawing: the garland under the title, big flowers at both ends, stars over it. */
  function heroArt() {
    return `<svg class="u-hero-art u-wide" viewBox="0 0 1440 320" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">` +
      stroke("M-30 226 C180 182 360 262 560 226 S900 188 1080 222 S1340 248 1470 208", INK.green, 8, null, true) +
      Bloom("hf1", 158, 166, 138, INK.pink, 71, 0) +
      pop(1, shape("hf2", sprig(56, 296, 140), INK.blue, [30, 120, 220, 312], 72, 18)) +
      Daisy("hf3", 330, 238, 44, 73, 2) +
      Star("hs1", 470, 84, 22, INK.gold, 76, 3) +
      Star("hs2", 1000, 76, 20, INK.pink, 77, 4) +
      Daisy("hf5", 1090, 222, 34, 75, 5, INK.blue) +
      Bloom("hf4", 1250, 204, 90, INK.red, 74, 6) +
      Star("hs3", 1384, 80, 16, INK.blue, 78, 7) +
      `</svg>` +
      `<svg class="u-hero-art u-narrow" viewBox="0 0 400 220" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">` +
      stroke("M-20 156 C60 130 130 178 210 156 S330 132 420 152", INK.green, 5, null, true) +
      Bloom("hn1", 60, 112, 68, INK.pink, 81, 0) +
      pop(1, shape("hn2", sprig(24, 208, 70), INK.blue, [10, 118, 110, 216], 82, 12)) +
      Daisy("hn3", 154, 166, 24, 83, 2) +
      Star("hn5", 234, 52, 14, INK.gold, 85, 3) +
      Star("hn6", 292, 36, 10, INK.blue, 86, 4) +
      Bloom("hn4", 344, 142, 54, INK.red, 84, 5) +
      `</svg>`;
  }

  /* ---------- lay the drawings on the page ---------- */
  const FLOWERS = [INK.pink, INK.blue, INK.red, INK.gold, INK.sky];
  const hero = document.querySelector("[data-hero-art]");
  if (hero) hero.outerHTML = heroArt();
  document.querySelectorAll("[data-art]").forEach((el, i) => { const draw = ART[el.dataset.art]; if (draw) el.innerHTML = draw(`a${i}`); });
  document.querySelectorAll("[data-garland]").forEach((el) => {
    el.outerHTML = garland(el.dataset.garland, el.dataset.flip === "1", INK[el.dataset.flower] || INK.pink);
  });
  document.querySelectorAll("[data-mark]").forEach((el) => {
    const i = Number(el.dataset.mark), c = FLOWERS[i % FLOWERS.length];
    el.innerHTML = i % 2 === 0
      ? shape(`rb${i}`, star(20, 20, 17), c, [3, 3, 37, 37], 80 + i, 8)
      : shape(`rb${i}`, flower(20, 20, 17), c, [2, 2, 38, 38], 80 + i, 8) + `<path d="${circle(20, 20, 4)}" fill="${INK.gold}"/>`;
  });
  const endBuddy = document.querySelector("[data-buddy]");
  if (endBuddy) endBuddy.innerHTML = buddy("eb", 20, 20, 160, 9);

  /* ================================================================ the reader */

  /** Each drawing arrives as it's reached: a garland draws its line and pops its flowers on. Once only. */
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -12% 0px" });
    document.querySelectorAll(".u-garland, .u-hero-art, .u-ch-art").forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll(".u-garland, .u-hero-art, .u-ch-art").forEach((el) => el.classList.add("is-in"));
  }

  /** The rail marks the chapter you're in, and steps away before the rest and the end. */
  const railLinks = [...document.querySelectorAll("[data-rail]")];
  const ids = railLinks.map((a) => a.dataset.rail);
  const markRail = () => {
    const line = window.innerHeight * 0.4;
    let here = null;
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= line) here = id;
    }
    railLinks.forEach((a) => a.classList.toggle("is-here", a.dataset.rail === here));
    const after = document.querySelector(".u-rest") || document.querySelector(".u-end");
    const done = !!after && after.getBoundingClientRect().top < window.innerHeight * 0.55;
    document.documentElement.classList.toggle("u-reading", here !== null && !done);
  };
  let railFrame = 0;
  const onScroll = () => { if (!railFrame) railFrame = requestAnimationFrame(() => { railFrame = 0; markRail(); }); };
  markRail();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  /** A film plays, silent and looping, only while it's on screen. Asked for less motion, it waits for a press. */
  document.querySelectorAll(".u-clip video").forEach((v) => {
    v.muted = true;
    if (reduce || !("IntersectionObserver" in window)) { v.controls = true; return; }
    const io = new IntersectionObserver(([e]) => {
      if (e && e.isIntersecting) { const p = v.play(); if (p && p.catch) p.catch(() => { v.controls = true; }); } else v.pause();
    }, { threshold: 0.2 });
    io.observe(v);
  });

  /** A figure's chart redraws at a phone's width with its own, narrower drawing. */
  function watchWidth(el, at, cb) {
    let narrow = null;
    const check = () => { const n = el.getBoundingClientRect().width < at; if (n !== narrow) { narrow = n; cb(n); } };
    if ("ResizeObserver" in window) new ResizeObserver(check).observe(el); else window.addEventListener("resize", check);
    check();
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const minus = (v) => String(v).replace("-", "−");

  /* ================================================================ 2. pointing */
  (function pointing() {
    const fig = document.getElementById("fig-point");
    if (!fig) return;
    const win = fig.querySelector(".pt-win"), nib = fig.querySelector(".pt-nib"), mark = fig.querySelector(".pt-mark");
    const ring = mark.querySelector("rect"), tag = mark.querySelector(".pt-tag"), set = fig.querySelector(".pt-set");
    const what = fig.querySelector(".pt-what"), stat = fig.querySelector(".pt-stat");
    nib.innerHTML = `<svg viewBox="0 0 22 26"><path d="${NIB_D}" fill="${INK.buddy}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/><circle cx="5.3" cy="7.6" r="1.05" fill="#fff"/><circle cx="8.9" cy="7.6" r="1.05" fill="#fff"/><path d="M5.5 10.9 Q7.1 12.3 8.7 10.9" stroke="#fff" stroke-width="1.1" stroke-linecap="round" fill="none"/></svg>`;
    const NW = 30, NH = (30 * 26) / 22;
    let target = "Chart", runs = 0, timer = 0;

    const box = (el) => { const a = el.getBoundingClientRect(), b = win.getBoundingClientRect(); return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height }; };
    const named = () => [...win.querySelectorAll("[data-name]")].filter((el) => el.getClientRects().length > 0);
    const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    const putNib = (x, y, ms) => {
      nib.style.transitionDuration = `${reduce ? 0 : ms}ms`;
      nib.style.transform = `translate(${f(x - (NW * 3) / 22)}px, ${f(y - (NH * 1.4) / 26)}px)`;
    };
    const home = () => putNib(win.clientWidth - 58, win.clientHeight - 44, 0);
    const clear = () => {
      clearTimeout(timer);
      mark.classList.remove("is-on", "is-miss");
      win.querySelectorAll(".is-hot, .is-want").forEach((el) => el.classList.remove("is-hot", "is-want"));
    };
    /** The ring sits clear of the control, never reaching the one beside it: half the gap between buttons, at most chalk's 6px. */
    const pad = () => Math.min(6, Math.floor((parseFloat(getComputedStyle(set).columnGap) || 0) / 2) - 1);
    function showMark(r, label, miss, round = 10) {
      const p = round < 10 ? 0 : pad(), x = r.x - p, y = r.y - p, w = r.w + p * 2, h = r.h + p * 2;
      Object.assign(mark.style, { left: `${f(x)}px`, top: `${f(y)}px`, width: `${f(w)}px`, height: `${f(h)}px` });
      ring.setAttribute("x", 1.5); ring.setAttribute("y", 1.5);
      ring.setAttribute("width", f(w - 3)); ring.setAttribute("height", f(h - 3)); ring.setAttribute("rx", round);
      tag.textContent = label;
      mark.classList.toggle("is-miss", miss);
      // The tag rides above the ring in the title bar, kept clear of the traffic lights and inside the window.
      const tw = tag.offsetWidth, W = win.clientWidth;
      let left = x - 1.5;
      if (left < 82) left = 82;
      if (left + tw > W - 10) left = W - 10 - tw;
      mark.style.setProperty("--tag-x", `${f(left - x)}px`);
      mark.style.setProperty("--tag-y", `${f(8 - y)}px`);
      void mark.offsetWidth;
      mark.classList.add("is-on");
    }
    function run(mode) {
      clear();
      runs++;
      let tEl = win.querySelector(`.pt-tool[data-name="${target}"]`);
      // A phone's toolbar has no room for Comment: point at Chart instead.
      if (!tEl.getClientRects().length) { target = "Chart"; tEl = win.querySelector('.pt-tool[data-name="Chart"]'); fig.querySelectorAll("[data-pick]").forEach((o) => o.setAttribute("aria-checked", String(o.dataset.pick === target))); }
      const T = box(tEl), cx = T.x + T.w / 2, cy = T.y + T.h / 2;
      const wait = reduce ? 0 : 860;
      if (mode === "name") {
        // The answer names the button; code reads that button's own box and the nib goes onto it.
        putNib(T.x + T.w * 0.62, T.y + T.h + 1, 850);
        timer = setTimeout(() => { tEl.classList.add("is-hot"); showMark(T, target, false); }, wait);
        what.textContent = `chalk named “${target}”. Code read that button’s real box, ${Math.round(T.w)} × ${Math.round(T.h)} px at (${Math.round(T.x)}, ${Math.round(T.y)}), and the nib went onto it.`;
        stat.className = "pt-stat is-name";
        return;
      }
      // A guess from a picture of the screen: close, and not on it.
      const r = rng(runs * 97 + target.charCodeAt(0) * 13 + target.length);
      const dir = r() < 0.5 ? -1 : 1, off = T.w * (0.78 + r() * 0.5);
      let x = cx + dir * off;
      if (x < 14 || x > win.clientWidth - 14) x = cx - dir * off;
      const y = cy + (r() - 0.5) * T.h * 0.7;
      const hit = named().find((el) => el !== tEl && inside(box(el), x, y));
      const dist = Math.round(Math.hypot(x - cx, y - cy));
      putNib(x, y, 850);
      timer = setTimeout(() => {
        if (hit) showMark(box(hit), `Clicked ${hit.dataset.name}`, true);
        else showMark({ x: x - 5, y: y - 5, w: 10, h: 10 }, "Clicked nothing", true, 5);
        tEl.classList.add("is-want");
      }, wait);
      what.textContent = `chalk guessed a point from a picture of the screen, ${dist} px from the middle of ${target}. It landed on ${hit ? hit.dataset.name : "nothing at all"}.`;
      stat.className = "pt-stat is-guess";
    }

    fig.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => {
      target = b.dataset.pick;
      fig.querySelectorAll("[data-pick]").forEach((o) => o.setAttribute("aria-checked", String(o === b)));
      clear();
      home();
      stat.className = "pt-stat";
      what.textContent = `Now point at ${target}.`;
    }));
    fig.querySelectorAll("[data-run]").forEach((b) => b.addEventListener("click", () => run(b.dataset.run)));
    let lastW = 0;
    const settle = () => { if (win.clientWidth !== lastW) { lastW = win.clientWidth; clear(); home(); } };
    if ("ResizeObserver" in window) new ResizeObserver(settle).observe(win); else window.addEventListener("resize", settle);
    settle();
  })();

  /* ================================================================ 3. the answer first */
  (function answerFirst() {
    const fig = document.getElementById("fig-loan");
    if (!fig) return;
    const head = fig.querySelector(".ln-head"), svg = fig.querySelector(".ln-chart"), work = fig.querySelector(".ln-work");
    const AMOUNT = 200000;
    let rate = 5, years = 25, narrow = false;
    const gbp0 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0, minimumFractionDigits: 0 });
    const gbp2 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 2, minimumFractionDigits: 2 });
    const money = (v, pennies = false) => (pennies ? gbp2 : gbp0).format(v);
    const pct = (v) => `${v < 10 ? +v.toFixed(2) : v.toFixed(1)}%`;
    const monthsLabel = (m) => { const y = Math.floor(m / 12), r = m % 12; return [y ? `${y} year${y === 1 ? "" : "s"}` : "", r ? `${r} month${r === 1 ? "" : "s"}` : ""].filter(Boolean).join(" ") || "0 months"; };
    const dec = (v) => String(+v.toFixed(7));

    // chalk's loan engine: the annuity payment, then month by month, interest on what is still owed.
    const pmt = (P, r, n) => (n <= 0 ? P : r === 0 ? P / n : (P * r) / (1 - Math.pow(1 + r, -n)));
    function schedule() {
      const r = rate / 100 / 12, n = Math.round(years * 12), payment = pmt(AMOUNT, r, n), rows = [];
      let bal = AMOUNT;
      for (let k = 1; k <= n && bal > 0.005; k++) {
        const interest = bal * r, principal = Math.max(0, Math.min(payment - interest, bal)), closing = bal - principal;
        rows.push({ k, opening: bal, interest, principal, closing: closing < 0.005 ? 0 : closing });
        bal = closing;
      }
      const totalInterest = rows.reduce((s, q) => s + q.interest, 0);
      return { r, n, rows, payment, months: rows.length, totalInterest, totalPaid: AMOUNT + totalInterest };
    }
    const crossover = (rows) => { const q = rows.find((x) => x.principal > x.interest); return q ? q.k : null; };
    function axis(max) {
      const m = Math.max(max, 1e-9), p = Math.pow(10, Math.floor(Math.log10(m))), q = m / p;
      const step = (q <= 1.5 ? 0.25 : q <= 3 ? 0.5 : q <= 6 ? 1 : 2) * p, top = Math.ceil(m / step) * step;
      return { top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
    }
    const compact = (v) => (v >= 1e4 ? `£${Math.round(v / 1e3)}k` : v >= 1e3 ? `£${+(v / 1e3).toFixed(1)}k` : `£${Math.round(v)}`);

    function draw() {
      const s = schedule(), cross = crossover(s.rows), cy = cross ? Math.ceil(cross / 12) : null;
      head.innerHTML = `You pay <b class="ln-big">${money(s.payment, s.payment < 1000)}</b> a month for ${monthsLabel(s.months)}.` +
        `<span class="ln-sub">${s.totalInterest > 0.5 ? `${money(s.totalInterest)} of what you pay is interest: ${Math.round((s.totalInterest / AMOUNT) * 100)}% on top of what you borrowed.` : "At no interest, every pound you pay comes off the debt."}</span>`;

      // The one picture: what is still owed, year by year.
      const W = narrow ? 340 : 780, H = narrow ? 230 : 270, L = 50, R = 14, T = 16, B = 30;
      const ax = axis(AMOUNT), X = (t) => L + ((W - L - R) * t) / years, Y = (v) => T + (H - T - B) * (1 - v / ax.top);
      const pts = [[0, AMOUNT]];
      for (let y = 1; y <= years; y++) { const row = s.rows[Math.min(y * 12, s.rows.length) - 1]; pts.push([y, row ? row.closing : 0]); }
      let g = "";
      for (const t of ax.ticks) g += `<line x1="${L}" x2="${W - R}" y1="${f(Y(t))}" y2="${f(Y(t))}" stroke="${t === 0 ? "#C9C0AC" : "#F0EADD"}" stroke-width="${t === 0 ? 1.5 : 1}"/><text x="${L - 8}" y="${f(Y(t) + 4)}" text-anchor="end">${t === 0 ? "£0" : compact(t)}</text>`;
      const area = `M${f(X(0))} ${f(Y(0))} ` + pts.map(([t, v]) => `L${f(X(t))} ${f(Y(v))}`).join(" ") + ` L${f(X(years))} ${f(Y(0))} Z`;
      g += shape("ln-area", area, INK.jade, [L, T, W - R, H - B], 41, narrow ? 16 : 22, 0.34, narrow ? 4 : 5);
      g += `<text x="${L + 10}" y="${H - B - 12}" style="fill:#fff;font-weight:700">still owed</text>`;
      const step = years > 20 ? 5 : years > 8 ? 2 : 1;
      const ticks = [];
      for (let t = 0; t <= years; t += step) ticks.push(t);
      if (ticks[ticks.length - 1] !== years) ticks.push(years);
      // "30 years" is wide: the tick before it steps aside rather than run into it.
      while (ticks.length > 2 && X(years) - X(ticks[ticks.length - 2]) < 66) ticks.splice(ticks.length - 2, 1);
      ticks.forEach((t) => { const last = t === years; g += `<text x="${f(X(t))}" y="${H - 8}" text-anchor="${last ? "end" : t === 0 ? "start" : "middle"}">${last ? `${t} years` : t}</text>`; });
      if (cross) {
        const t = cross / 12, row = s.rows[cross - 1], x = X(t), y = Y(row.opening);
        g += `<line x1="${f(x)}" x2="${f(x)}" y1="${f(y + 10)}" y2="${H - B}" stroke="#0B4A39" stroke-opacity=".75" stroke-width="2" stroke-dasharray="3 5" stroke-linecap="round"/>`;
        g += shape("ln-star", star(x, y, 11), INK.gold, [x - 11, y - 11, x + 11, y + 11], 43, 6);
        const say = narrow ? [`★ From year ${cy}, more of each`, "payment clears the debt."] : [`★ From year ${cy}, more of each payment clears the debt than pays interest.`];
        say.forEach((line, i) => { g += `<text class="ln-say" x="${W - R}" y="${T + 6 + i * 17}" text-anchor="end">${line}</text>`; });
      }
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svg.innerHTML = g;

      // See the working: the formula, the numbers put in, the totals.
      const first = s.rows[0];
      work.innerHTML = (s.r === 0
        ? `<p class="ln-f"><span class="ln-eq">M = P ÷ n</span>P = ${money(AMOUNT)}, what you borrow<br>n = ${years} × 12 = ${s.n} payments<br>M = ${AMOUNT.toLocaleString("en-GB")} ÷ ${s.n} = <b>${money(s.payment, true)}</b></p>`
        : `<p class="ln-f"><span class="ln-eq">M = P × r ÷ (1 − (1 + r)<sup>−n</sup>)</span>P = ${money(AMOUNT)}, what you borrow<br>r = ${pct(rate)} ÷ 12 = ${dec(s.r)} a month<br>n = ${years} × 12 = ${s.n} payments<br>M = ${AMOUNT.toLocaleString("en-GB")} × ${dec(s.r)} ÷ (1 − ${dec(1 + s.r)}<sup>−${s.n}</sup>) = <b>${money(s.payment, true)}</b></p>`) +
        `<p>Over ${monthsLabel(s.months)} you pay back ${money(s.totalPaid)}: the ${money(AMOUNT)} you borrowed and ${money(s.totalInterest)} of interest.</p>` +
        (first && s.r > 0 ? `<p>Interest is charged each month on what is still owed, so the first payment is ${money(first.interest, true)} of interest and only ${money(first.principal, true)} off the debt.${cross ? ` The split tips in month ${cross}, in year ${cy}.` : ""}</p>` : "");
    }

    fig.querySelectorAll("input[data-k]").forEach((input) => {
      input.addEventListener("input", () => {
        const v = Number(input.value);
        if (input.dataset.k === "rate") { rate = Math.round(v * 100) / 100; fig.querySelector('[data-show="rate"]').textContent = pct(rate); }
        else { years = v; fig.querySelector('[data-show="years"]').textContent = `${v} year${v === 1 ? "" : "s"}`; }
        draw();
      });
    });
    watchWidth(fig.querySelector(".ln-chart-box"), 560, (n) => { narrow = n; draw(); });
  })();

  /* ================================================================ 4. guess first */
  (function guessFirst() {
    const fig = document.getElementById("fig-sketch");
    if (!fig) return;
    const svg = fig.querySelector(".sk-svg"), runBtn = fig.querySelector('[data-sk="run"]'), clearBtn = fig.querySelector('[data-sk="clear"]');
    const out = fig.querySelector(".sk-out"), say = fig.querySelector(".sk-say");
    // chalk's sketch block: the same axes, the same function and the same feature check (tangle-engine checkSketch).
    // Its own drawing at a phone's width, so the axis words stay readable there.
    let W = 560, H = 310, L = 54, R = 540, T = 30, B = 272, shown = false;
    const ax = { x0: 0, x1: 3.5, y0: -20, y1: 20 };
    const fn = (t) => 15 - 9.81 * t;
    const X = (x) => L + ((R - L) * (x - ax.x0)) / (ax.x1 - ax.x0), Y = (y) => B - ((B - T) * (y - ax.y0)) / (ax.y1 - ax.y0);
    const ux = (sx) => ax.x0 + ((sx - L) / (R - L)) * (ax.x1 - ax.x0), uy = (sy) => ax.y0 + ((B - sy) / (B - T)) * (ax.y1 - ax.y0);
    const ticks = (lo, hi) => { const step = Math.pow(10, Math.floor(Math.log10((hi - lo) / 2))); const s = (hi - lo) / step > 8 ? step * 2 : step; const o = []; for (let v = Math.ceil(lo / s) * s; v <= hi + 1e-9; v += s) o.push(+v.toFixed(6)); return o; };
    const nice = (v) => +v.toPrecision(3);

    let inkG, truthG, empty;
    function axes() {
    let base = "";
    for (const v of ticks(ax.y0, ax.y1)) base += `<line x1="${L}" x2="${R}" y1="${f(Y(v))}" y2="${f(Y(v))}" stroke="${v === 0 ? "#B9B1A0" : "#EFE9DC"}" stroke-width="${v === 0 ? 1.6 : 1}"/><text x="${L - 8}" y="${f(Y(v) + 4)}" text-anchor="end">${minus(v)}</text>`;
    for (const v of ticks(ax.x0, ax.x1)) base += `<line x1="${f(X(v))}" x2="${f(X(v))}" y1="${T}" y2="${B}" stroke="${v === 0 ? "#B9B1A0" : "#EFE9DC"}" stroke-width="${v === 0 ? 1.6 : 1}"/><text x="${f(X(v))}" y="${B + 18}" text-anchor="middle">${v}</text>`;
    base += `<text x="${R}" y="${H - 4}" text-anchor="end">time, s →</text><text x="${L}" y="16">↑ velocity, m/s</text>`;
    svg.innerHTML = `<rect x="${L}" y="${T}" width="${R - L}" height="${B - T}" fill="transparent"/>${base}<g class="sk-ink"></g><g class="sk-truth"></g><text class="sk-empty" x="${(L + R) / 2}" y="${(T + B) / 2 - 24}" text-anchor="middle">press and drag to draw your guess</text>`;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    inkG = svg.querySelector(".sk-ink"); truthG = svg.querySelector(".sk-truth"); empty = svg.querySelector(".sk-empty");
    }

    let pts = [], drawing = false;
    const at = (e) => { const m = svg.getScreenCTM().inverse(); const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m); return { x: ux(q.x), y: uy(q.y) }; };
    const paint = () => {
      inkG.innerHTML = pts.length > 1 ? lineIn(pts.map((q, i) => `${i ? "L" : "M"}${f(X(q.x))} ${f(Y(q.y))}`).join(" "), INK.pink, 5, [0, 0, W, H]) : "";
      empty.style.display = pts.length ? "none" : "";
      runBtn.disabled = pts.length < 6;
    };
    const reset = () => { truthG.innerHTML = ""; truthG.classList.remove("is-in"); out.hidden = true; shown = false; };
    svg.addEventListener("pointerdown", (e) => { if (e.button > 0) return; svg.setPointerCapture(e.pointerId); drawing = true; pts = [at(e)]; reset(); paint(); });
    svg.addEventListener("pointermove", (e) => { if (!drawing) return; pts.push(at(e)); paint(); });
    const stop = () => { drawing = false; };
    svg.addEventListener("pointerup", stop);
    svg.addEventListener("pointercancel", stop);
    clearBtn.addEventListener("click", () => { pts = []; reset(); paint(); });

    /** The sketch checked against the true curve, feature by feature, a tenth of each axis allowed (chalk's checkSketch). */
    function check() {
      const p = pts.filter((q) => q.x >= ax.x0 && q.x <= ax.x1).sort((a, b) => a.x - b.x);
      if (p.length < 6) return null;
      const tx = (ax.x1 - ax.x0) * 0.1, ty = (ax.y1 - ax.y0) * 0.1, bins = [];
      for (let b = 0; b < 30; b++) {
        const lo = ax.x0 + ((ax.x1 - ax.x0) * b) / 30, hi = lo + (ax.x1 - ax.x0) / 30, inn = p.filter((q) => q.x >= lo && q.x < hi);
        if (inn.length) bins.push({ x: (lo + hi) / 2, y: inn.reduce((s, q) => s + q.y, 0) / inn.length });
      }
      if (bins.length < 6) return null;
      const truth = bins.map((b) => fn(b.x)), feats = [];
      feats.push({ id: "start", ok: Math.abs(bins[0].y - truth[0]) <= ty * 1.2 });
      let agree = 0, steps = 0;
      for (let i = 1; i < bins.length; i++) { const dt = truth[i] - truth[i - 1], ds = bins[i].y - bins[i - 1].y; if (Math.abs(dt) < ty * 0.02) continue; steps++; if (Math.sign(dt) === Math.sign(ds)) agree++; }
      feats.push({ id: "trend", ok: steps === 0 || agree / steps >= 0.7 });
      const zeros = (ys) => ys.flatMap((y, i) => (i && Math.sign(y) !== Math.sign(ys[i - 1]) && y !== 0 ? [bins[i - 1].x + ((bins[i].x - bins[i - 1].x) * ys[i - 1]) / (ys[i - 1] - y)] : []));
      const tz = zeros(truth), sz = zeros(bins.map((b) => b.y));
      if (tz.length) feats.push({ id: "zero", ok: tz.every((z) => sz.some((s) => Math.abs(s - z) <= tx)) });
      feats.push({ id: "end", ok: Math.abs(bins[bins.length - 1].y - truth[truth.length - 1]) <= ty * 1.2 });
      const off = bins.reduce((s, b, i) => s + Math.abs(b.y - truth[i]), 0) / bins.length;
      return { feats, off, sz, start: bins[0].y, end: bins[bins.length - 1].y };
    }

    const tz = 15 / 9.81;
    /** The real line, over the guess. It draws itself in when run; a redraw at a new width just appears. */
    function truth(animate) {
      const line = Array.from({ length: 61 }, (_, i) => (ax.x1 * i) / 60).map((x, i) => `${i ? "L" : "M"}${f(X(x))} ${f(Y(fn(x)))}`).join(" ");
      truthG.classList.remove("is-in");
      truthG.innerHTML = lineIn(line, INK.cobalt, 5, [0, 0, W, H], null, true) +
        shape("sk-top", circle(X(tz), Y(0), 6), INK.gold, [X(tz) - 6, Y(0) - 6, X(tz) + 6, Y(0) + 6], 9, 5) +
        `<text x="${f(X(tz) + 12)}" y="${f(Y(0) - 10)}" class="sk-top">the top, ${nice(tz)} s</text>`;
      shown = true;
      if (!animate) { truthG.classList.add("is-in"); return; }
      void truthG.getBoundingClientRect();
      requestAnimationFrame(() => truthG.classList.add("is-in"));
    }
    runBtn.addEventListener("click", () => {
      truth(true);
      const c = check();
      out.hidden = false;
      if (!c) { say.innerHTML = "<b>Not yet.</b> Draw a longer line, across most of the graph."; return; }
      const good = c.feats.filter((x) => x.ok).length, miss = c.feats.find((x) => !x.ok);
      const off = `${c.off < 1 ? c.off.toFixed(1) : Math.round(c.off * 10) / 10} m/s`;
      const why = {
        start: `the real one starts at 15, the speed it was thrown at, and yours started at ${minus(+c.start.toFixed(1))}`,
        trend: "the real one falls the whole way, because gravity never stops pulling",
        zero: `the real one crosses zero at ${nice(tz)} s, the top of the throw${c.sz.length ? `, and yours at ${+c.sz[0].toFixed(2)} s` : ", and yours never did"}`,
        end: `the real one ends at ${minus(nice(fn(ax.x1)))}, falling faster than it was thrown, and yours ended at ${minus(+c.end.toFixed(1))}`,
      };
      say.innerHTML = `<b>${good} of ${c.feats.length}.</b> ` + (miss
        ? `Your line was ${off} from the real one on average, but ${why[miss.id]}.`
        : `That’s the shape: your line stayed ${off} from the real one on average, through zero at the top.`);
    });
    watchWidth(svg, 480, (narrow) => {
      [W, H, L, R, T, B] = narrow ? [340, 250, 40, 330, 28, 212] : [560, 310, 54, 540, 30, 272];
      svg.classList.toggle("is-narrow", narrow);
      axes();
      paint();
      if (shown) truth(false);
    });
  })();

  /* ================================================================ 5. a week later */
  (function weekLater() {
    const fig = document.getElementById("fig-review");
    if (!fig) return;
    const svg = fig.querySelector(".rv-svg"), say = fig.querySelector(".rv-say");
    const right = fig.querySelector('[data-rv="1"]'), wrong = fig.querySelector('[data-rv="0"]');
    // chalk's own rules (lib/learning/rules.ts): days until it comes back after 1, 2, 3, 4, 5 or more right answers
    // in a row; the day after a miss; the week-later check; missed twice and it is a mistake you keep making.
    const GAPS = [1, 3, 7, 21, 60], CHECK_AFTER_DAYS = 7, KEEPS_MISSING = 2, MAX = 12;
    let results = [], narrow = false, fresh = -1;
    const streak = () => { let n = 0; for (let i = results.length - 1; i >= 0 && results[i].ok; i--) n++; return n; };
    const misses = () => results.filter((r) => !r.ok).length;
    const dueAt = () => { const last = results[results.length - 1]; if (!last) return 1; if (!last.ok) return last.at + 1; return last.at + GAPS[Math.min(streak(), GAPS.length) - 1]; };
    const keepsMissing = () => misses() >= KEEPS_MISSING && streak() < 2;
    const days = (n) => `${n} day${n === 1 ? "" : "s"}`;

    function draw() {
      const W = narrow ? 340 : 780, H = 144, L = 22, R = W - 22, A = 100;
      const next = dueAt(), D = Math.max(100, next * 1.12);
      // Days on a log scale, so a run of answers a day apart stays readable beside a 60-day gap.
      const X = (d) => L + ((R - L) * Math.log1p(d)) / Math.log1p(D);
      let g = lineIn(`M${L} ${A} L${R} ${A}`, "#D9D0BC", 4, [0, A - 30, W, A + 30]);
      const marks = [[0, "learned"], [1, "1 day"], [CHECK_AFTER_DAYS, "1 week"], [30, "1 month"], [90, "3 months"], [180, "6 months"], [365, "1 year"], [730, "2 years"]]
        .filter(([d]) => d <= D && !(narrow && d === 1));
      // A label is written only where it clears the one before it, measured by its own width.
      let lastEnd = -99;
      const dotR = narrow ? 4.5 : 6.5;
      for (const [d, label] of marks) {
        const x = X(d);
        if (d === CHECK_AFTER_DAYS) g += shape("rv-check", star(x, A, 9), INK.gold, [x - 9, A - 9, x + 9, A + 9], 31, 6);
        else g += `<line x1="${f(x)}" x2="${f(x)}" y1="${A - 6}" y2="${A + 6}" stroke="#C9C0AC" stroke-width="2" stroke-linecap="round"/>`;
        const tw = label.length * 6.4, start = d === 0 ? x : x - tw / 2;
        if (start > lastEnd + 14) { g += `<text x="${f(x)}" y="${A + 30}" text-anchor="${d === 0 ? "start" : "middle"}">${label}</text>`; lastEnd = start + tw; }
      }
      // Each answer, and the hop to the next time it is asked.
      let from = 0;
      results.forEach((r, i) => {
        const x0 = X(from), x1 = X(r.at), h = Math.min(74, 16 + (x1 - x0) * 0.5);
        g += lineIn(`M${f(x0)} ${A} Q${f((x0 + x1) / 2)} ${f(A - h)} ${f(x1)} ${A}`, r.ok ? INK.jade : INK.red, 3.5, [0, 0, W, H]);
        from = r.at;
      });
      // The hop still to come, dashed, with its gap said over it.
      const x0 = X(from), x1 = X(next), h = Math.min(74, 16 + (x1 - x0) * 0.5), gap = next - from;
      g += `<path d="M${f(x0)} ${A} Q${f((x0 + x1) / 2)} ${f(A - h)} ${f(x1)} ${A}" fill="none" stroke="${INK.ink}" stroke-opacity=".55" stroke-width="2.5" stroke-dasharray="2 7" stroke-linecap="round"/>`;
      const last = results[results.length - 1], lx = Math.min(Math.max((x0 + x1) / 2, L + 30), R - 30);
      g += `<text class="rv-gap${last && !last.ok ? " is-miss" : ""}" x="${f(lx)}" y="${f(A - h / 2 - 12)}" text-anchor="middle">+${days(gap)}</text>`;
      g += `<circle cx="${f(x1)}" cy="${A}" r="${dotR + 0.5}" fill="${INK.paper}" stroke="${INK.ink}" stroke-width="2.5" stroke-dasharray="3 3"/>`;
      g += shape("rv-0", circle(X(0), A, dotR), INK.ink, [X(0) - 7, A - 7, X(0) + 7, A + 7], 3, 5);
      results.forEach((r, i) => {
        const x = X(r.at);
        const dot = shape(`rv-d${i}`, circle(x, A, dotR), r.ok ? INK.jade : INK.red, [x - 7, A - 7, x + 7, A + 7], 40 + i, 5);
        g += i === fresh && !reduce ? `<g class="cr-new">${dot}</g>` : dot;
      });
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svg.innerHTML = g;

      const s = streak();
      if (!last) say.textContent = `Learned on day 0, so it comes back tomorrow, on day ${next}.`;
      else if (last.ok) say.textContent = `Right ${s === 1 ? "once" : `${s} times`} in a row, so it comes back in ${days(gap)}, on day ${next}.`;
      else say.textContent = `Missed, so it comes back tomorrow, on day ${next}.` + (keepsMissing() ? ` That’s ${misses()} misses: it’s a mistake you keep making, so it comes first.` : "");
      if (results.length >= MAX) say.textContent += " That’s 12 answers. Start again to try another run.";
      right.disabled = wrong.disabled = results.length >= MAX;
    }
    const answer = (ok) => { if (results.length >= MAX) return; results.push({ at: dueAt(), ok }); fresh = results.length - 1; draw(); fresh = -1; };
    right.addEventListener("click", () => answer(true));
    wrong.addEventListener("click", () => answer(false));
    fig.querySelector('[data-rv="reset"]').addEventListener("click", () => { results = []; draw(); });
    watchWidth(fig.querySelector(".rv-box"), 560, (n) => { narrow = n; draw(); });
  })();

  /* ================================================================ 8. the crayon hand */
  (function crayonHand() {
    const fig = document.getElementById("fig-crayon");
    if (!fig) return;
    // How it's made: the same flower, three times over.
    const steps = fig.querySelectorAll("[data-step]");
    const fx = 60, fy = 60, fr = 50;
    const centre = (id, grain, streaks) => shape(id, circle(fx, fy, fr * 0.17), INK.gold, [fx - fr * 0.2, fy - fr * 0.2, fx + fr * 0.2, fy + fr * 0.2], 92, 6, 0.4, 5, grain, streaks);
    if (steps[0]) steps[0].innerHTML = shape("st1", flower(fx, fy, fr), INK.pink, [10, 10, 110, 110], 91, fr * 0.3, 0.4, 5, false, false) + centre("st1c", false, false);
    if (steps[1]) steps[1].innerHTML = shape("st2", flower(fx, fy, fr), INK.pink, [10, 10, 110, 110], 91, fr * 0.3, 0.4, 5, false, true) + centre("st2c", false, true);
    if (steps[2]) steps[2].innerHTML = shape("st3", flower(fx, fy, fr), INK.pink, [10, 10, 110, 110], 91, fr * 0.3) + centre("st3c", true, true);

    const pad = fig.querySelector(".cr-pad"), padBox = fig.querySelector(".cr-pad-box"), boil = fig.querySelector('[data-cr="boil"]');
    const COLOURS = [INK.pink, INK.blue, INK.red, INK.gold, INK.jade, INK.cobalt, INK.sky];
    let kind = "star", count = 0, colourAt = 0, w = 0, h = 0;
    let laid = [
      { kind: "flower", nx: 0.17, ny: 0.44, r: 62, colour: INK.pink },
      { kind: "star", nx: 0.37, ny: 0.26, r: 32, colour: INK.gold },
      { kind: "heart", nx: 0.52, ny: 0.6, r: 46, colour: INK.red },
      { kind: "daisy", nx: 0.72, ny: 0.34, r: 42, colour: INK.gold },
      { kind: "star", nx: 0.88, ny: 0.66, r: 26, colour: INK.cobalt },
      { kind: "flower", nx: 0.35, ny: 0.74, r: 24, colour: INK.sky },
    ].map((s) => ({ ...s, id: ++count, seed: 200 + count * 7, turn: 0 }));
    const scale = () => Math.max(0.62, Math.min(1, w / 760));
    function draw(s, fresh) {
      const x = s.nx * w, y = s.ny * h, r = s.r * scale(), id = `cr${s.id}`, b = [x - r, y - r, x + r, y + r];
      let d;
      if (s.kind === "flower") d = shape(`${id}p`, flower(x, y, r), s.colour, b, s.seed, r * 0.3) + shape(`${id}c`, circle(x, y, r * 0.17), s.colour === INK.gold ? INK.red : INK.gold, [x - r * 0.2, y - r * 0.2, x + r * 0.2, y + r * 0.2], s.seed + 1, 6);
      else if (s.kind === "daisy") d = shape(`${id}p`, daisy(x, y, r, 12), s.colour, b, s.seed, 10) + shape(`${id}c`, circle(x, y, r * 0.28), s.colour === INK.gold ? INK.red : INK.gold, [x - r * 0.3, y - r * 0.3, x + r * 0.3, y + r * 0.3], s.seed + 1, 6);
      else if (s.kind === "heart") d = shape(id, heart(x, y, r * 1.15), s.colour, b, s.seed, r * 0.32);
      else d = shape(id, star(x, y, r), s.colour, b, s.seed, r * 0.6);
      const inner = s.turn ? `<g transform="rotate(${f(s.turn)} ${f(x)} ${f(y)})">${d}</g>` : `<g>${d}</g>`;
      return fresh && !reduce ? `<g class="cr-new">${inner}</g>` : inner;
    }
    function render() {
      const rect = pad.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width)); h = Math.max(1, Math.round(rect.height));
      pad.setAttribute("viewBox", `0 0 ${w} ${h}`);
      pad.innerHTML = laid.map((s) => draw(s, false)).join("");
    }
    pad.addEventListener("click", (e) => {
      const rect = pad.getBoundingClientRect();
      const r = rng(count * 31 + 7);
      const s = {
        kind, nx: (e.clientX - rect.left) / rect.width, ny: (e.clientY - rect.top) / rect.height,
        r: 28 + r() * 24, colour: COLOURS[colourAt++ % COLOURS.length], id: ++count, seed: 300 + count * 7,
        turn: kind === "star" || kind === "heart" ? (r() - 0.5) * 36 : 0,
      };
      laid.push(s);
      padBox.classList.add("is-used");
      if (laid.length > 48) { laid.shift(); render(); }
      pad.insertAdjacentHTML("beforeend", draw(s, true));
    });
    fig.querySelectorAll("[data-shape]").forEach((b) => b.addEventListener("click", () => {
      kind = b.dataset.shape;
      fig.querySelectorAll("[data-shape]").forEach((o) => o.setAttribute("aria-checked", String(o === b)));
    }));
    if (reduce) { boil.setAttribute("aria-pressed", "false"); fig.classList.add("is-still"); }
    boil.addEventListener("click", () => {
      const on = boil.getAttribute("aria-pressed") !== "true";
      boil.setAttribute("aria-pressed", String(on));
      fig.classList.toggle("is-still", !on);
    });
    fig.querySelector('[data-cr="clear"]').addEventListener("click", () => { laid = []; padBox.classList.remove("is-used"); render(); });
    let lastW = 0;
    const settle = () => { const nw = Math.round(pad.getBoundingClientRect().width); if (nw !== lastW) { lastW = nw; render(); } };
    if ("ResizeObserver" in window) new ResizeObserver(settle).observe(pad); else window.addEventListener("resize", settle);
    settle();
  })();
})();
