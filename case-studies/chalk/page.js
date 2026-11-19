/*
 * chalk, the case study. Plain JS, no build step.
 *
 * 1. The crayon hand, ported from chalk's own: the same seeded rng, hatch and shape, so every
 *    drawing here is the one chalk draws: flat colour, white streaks clipped inside, grain over the lot.
 * 2. The reader: the chapter rail on wide screens, the garlands drawing in as they're reached, the films.
 * 3. 5 live figures, each running chalk's own mechanics with its real constants.
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
  function gear(cx, cy, R, r, teeth) {
    let d = "";
    const step = (Math.PI * 2) / teeth;
    for (let i = 0; i < teeth; i++) {
      const a = i * step;
      for (const [ang, rad] of [[a - step * 0.25, r], [a - step * 0.16, R], [a + step * 0.16, R], [a + step * 0.25, r]]) d += `${d ? "L" : "M"}${f(cx + Math.cos(ang) * rad)} ${f(cy + Math.sin(ang) * rad)}`;
    }
    return `${d}Z`;
  }
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
    gear: (k) =>
      shape(`${k}g`, gear(104, 100, 68, 54, 11), INK.gold, [36, 32, 172, 168], 9) +
      `<path d="${circle(104, 100, 20)}" fill="${INK.paper}"/>` +
      shape(`${k}g2`, gear(182, 52, 32, 25, 8), INK.blue, [150, 20, 214, 84], 13, 14) +
      `<path d="${circle(182, 52, 9)}" fill="${INK.paper}"/>` +
      shape(`${k}s`, star(196, 146, 17), INK.red, [179, 129, 213, 163], 3, 10),
    // A navy slate with two lines of working: one ticked in jade, one crossed out in red.
    slate: (k) =>
      shape(`${k}b`, blob(30, 26, 176, 134, 14, 2), "#22344E", [30, 26, 206, 160], 121, 20, 0.16) +
      `<path d="M52 66 H136 M52 116 H122" stroke="#B6DFE6" stroke-width="7" stroke-linecap="round"/>` +
      stroke("M150 64 L162 76 L186 50", INK.buddy, 9) +
      stroke("M140 106 L162 128 M162 106 L140 128", INK.red, 8) +
      shape(`${k}s`, star(206, 166, 15), INK.gold, [191, 151, 221, 181], 122, 10) +
      shape(`${k}s2`, star(30, 168, 10), INK.pink, [20, 158, 40, 178], 123, 7),
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
  document.querySelectorAll("[data-mark]").forEach((el, n) => {
    const i = Number(el.dataset.mark), c = FLOWERS[i % FLOWERS.length];
    el.innerHTML = i % 2 === 0
      ? shape(`rb${n}`, star(20, 20, 17), c, [3, 3, 37, 37], 80 + i, 8)
      : shape(`rb${n}`, flower(20, 20, 17), c, [2, 2, 38, 38], 80 + i, 8) + `<path d="${circle(20, 20, 4)}" fill="${INK.gold}"/>`;
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

  /**
   * What the model wrote, shown as the structure it really is: names and values, no coordinates. A key that just
   * changed is marked for a moment, so moving a slider shows how little of the board the model ever wrote.
   */
  function codeHTML(pairs, changed = new Set()) {
    const val = (v) => (typeof v === "number" ? `<span class="c-n">${+v.toFixed(2)}</span>`
      : typeof v === "string" ? `<span class="c-s">"${esc(v)}"</span>`
      : Array.isArray(v) ? `[${v.map(val).join(", ")}]`
      : `{ ${Object.entries(v).map(([k, x]) => `<span class="c-k">"${esc(k)}"</span>: ${val(x)}`).join(", ")} }`);
    return `{\n${pairs.map(([k, v], i) => `  <span class="c-line${changed.has(k) ? " is-new" : ""}"><span class="c-k">"${k}"</span>: ${val(v)}${i < pairs.length - 1 ? "," : ""}</span>`).join("\n")}\n}`;
  }

  /* ================================================================ 5. pointing */
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
        what.textContent = `The model picked “${target}” from the list of controls. Its real bounds, ${Math.round(T.w)} × ${Math.round(T.h)} px at (${Math.round(T.x)}, ${Math.round(T.y)}), came from the app, and chalk drew the pointer on them.`;
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
      what.textContent = `Asked for a pixel position instead, it gave one ${dist} px from the middle of ${target}. That lands on ${hit ? hit.dataset.name : "nothing at all"}.`;
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

  /* ================================================================ 1. the model describes, code computes */
  (function answerFirst() {
    const fig = document.getElementById("fig-loan");
    if (!fig) return;
    const head = fig.querySelector(".ln-head"), svg = fig.querySelector(".ln-chart"), work = fig.querySelector(".ln-work");
    const codeEl = fig.querySelector("[data-ln-code]"), inEl = fig.querySelector("[data-ln-in]"), gotEl = fig.querySelector("[data-ln-got]"), outEl = fig.querySelector("[data-ln-out]");
    const int = (v) => Math.round(v).toLocaleString("en-GB");
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

    function draw(changed) {
      const s = schedule(), cross = crossover(s.rows), cy = cross ? Math.ceil(cross / 12) : null;

      // Both sides: the 4 values the model wrote, and what chalk worked out from them.
      codeEl.innerHTML = codeHTML([["amount", AMOUNT], ["rate", rate], ["years", years], ["view", "schedule"]], changed);
      inEl.textContent = "4 values.";
      const row = (q) => `<tr><td>${q.k}</td><td>${money(q.interest, true)}</td><td>${money(q.principal, true)}</td><td>${money(q.closing)}</td></tr>`;
      const last = s.rows[s.rows.length - 1];
      gotEl.innerHTML =
        `<div><dt>Each month</dt><dd>${money(s.payment, true)}</dd></div>` +
        `<div><dt>Paid back</dt><dd>${money(s.totalPaid)}</dd></div>` +
        `<div class="ln-got-wide"><dt>The schedule, month by month</dt><dd><table class="ln-mini"><thead><tr><th>Month</th><th>Interest</th><th>Repaid</th><th>Owed</th></tr></thead><tbody>` +
        row(s.rows[0]) + (s.rows.length > 3 ? row(s.rows[1]) + `<tr class="ln-gap"><td>⋮</td><td></td><td></td><td></td></tr>` : s.rows.length === 3 ? row(s.rows[1]) : "") + (s.rows.length > 1 ? row(last) : "") +
        `</tbody></table></dd></div>` +
        `<div><dt>Repaying overtakes interest</dt><dd>${cross ? `month ${cross}, year ${cy}` : s.r === 0 ? "from the start" : "never"}</dd></div>` +
        `<div><dt>Interest in all</dt><dd>${money(s.totalInterest)}</dd></div>`;
      outEl.textContent = `${int(s.rows.length)} rows of 4: ${int(s.rows.length * 4)} numbers in the schedule alone.`;

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
        (first && s.r > 0 ? `<p>Interest is charged each month on what is still owed, so the first payment is ${money(first.interest, true)} of interest and only ${money(first.principal, true)} off the debt.${cross ? ` The split tips in month ${cross}, in year ${cy}.` : ""}</p>` : "");
    }

    fig.querySelectorAll("input[data-k]").forEach((input) => {
      input.addEventListener("input", () => {
        const v = Number(input.value);
        if (input.dataset.k === "rate") { rate = Math.round(v * 100) / 100; fig.querySelector('[data-show="rate"]').textContent = pct(rate); }
        else { years = v; fig.querySelector('[data-show="years"]').textContent = `${v} year${v === 1 ? "" : "s"}`; }
        draw(new Set([input.dataset.k]));
      });
    });
    watchWidth(fig.querySelector(".ln-chart-box"), 560, (n) => { narrow = n; draw(); });
  })();

  /* ================================================================ the triangle, solved as chalk solves it */
  const RAD = Math.PI / 180;
  /** chalk's number formats: to 2 places, whole when it is; an angle whole or to 1 place. */
  const fmt = (n) => { const r = Math.round(n * 100) / 100; return Math.abs(r - Math.round(r)) < 1e-9 ? String(Math.round(r)) : r.toFixed(2).replace(/0$/, ""); };
  const deg = (n) => { const r = Math.round(n * 10) / 10; return `${Math.abs(r - Math.round(r)) < 1e-9 ? Math.round(r) : r.toFixed(1)}°`; };
  /** Two sides and the angle between them (SAS at B): the third side by the cosine rule, then the angles by it turned round. */
  function solveSAS(AB, BC, B) {
    const sq = AB * AB + BC * BC - 2 * AB * BC * Math.cos(B * RAD), AC = Math.sqrt(sq);
    const A = Math.acos(Math.max(-1, Math.min(1, (AC * AC + AB * AB - BC * BC) / (2 * AC * AB)))) / RAD;
    const C = 180 - A - B;
    const area = 0.5 * AC * AB * Math.sin(A * RAD);
    const exact = Math.abs(sq - Math.round(sq)) < 1e-9 ? Math.round(sq) : sq;
    const perfect = Number.isInteger(exact) && Number.isInteger(Math.sqrt(exact));
    return { AB, BC, AC, A, B, C, sq, perfect, area, perimeter: AB + BC + AC };
  }

  /* ================================================================ 3. the drawn board */
  (function drawnBoard() {
    const fig = document.getElementById("fig-drawn");
    if (!fig) return;
    const svg = fig.querySelector(".db-svg"), say = fig.querySelector(".db-say"), codeEl = fig.querySelector("[data-db-code]");
    const factsEl = fig.querySelector("[data-db-facts]"), dotsEl = fig.querySelector(".db-dots"), playBtn = fig.querySelector("[data-db-play]");
    // chalk's drawn board on its navy panel, in its colours for a dark board, never black or white: jade lines and
    // labels, the working in blue, what is asked and its answer in marigold, construction in peri.
    const C = { ink: "#5ACDBE", label: "#8EE3D1", write: "#B6DFE6", accent: "#F8A81B", soft: "#A9ABEE" };
    const STEPS = ["AB", "BC", "angle B", "AC, dashed", "the working", "the answer"];
    const WORD_MS = 330;
    let AB = 5, BC = 7, B = 60, narrow = false, shown = 5, run = 0, items = [], nibG = null, rest = { x: 0, y: 0 }, t = solveSAS(5, 7, 60);

    const sentences = () => [
      `Start with the side we know: AB is ${fmt(AB)}.`,
      `From B, the side BC runs ${fmt(BC)} to C.`,
      `The angle between them, at B, is ${deg(B)}.`,
      "We want AC, the side that closes the triangle.",
      "Two sides and the angle between them: that’s the cosine rule.",
      t.perfect ? `So AC is the square root of ${fmt(t.sq)}: exactly ${fmt(t.AC)}.` : `So AC is the square root of ${fmt(t.sq)}, about ${fmt(t.AC)}.`,
    ];

    dotsEl.innerHTML = STEPS.map((s, i) => `<button type="button" aria-label="Step ${i + 1}: ${s}" data-step-dot="${i}"></button>`).join("");
    const dots = [...dotsEl.querySelectorAll("button")];

    function render() {
      t = solveSAS(AB, BC, B);
      const W = narrow ? 320 : 800, H = narrow ? 420 : 320;
      const box = narrow ? [16, 22, 304, 236] : [30, 26, 440, 296];
      const fs = narrow ? 14 : 16, ws = narrow ? 13.5 : 16;
      // A at the origin, B along the x-axis, C above, scaled into the figure's room.
      const P = [{ x: 0, y: 0 }, { x: AB, y: 0 }, { x: t.AC * Math.cos(t.A * RAD), y: t.AC * Math.sin(t.A * RAD) }];
      const minX = Math.min(...P.map((p) => p.x)), maxX = Math.max(...P.map((p) => p.x)), minY = 0, maxY = Math.max(...P.map((p) => p.y));
      const k = Math.min((box[2] - box[0]) / (maxX - minX), (box[3] - box[1]) / (maxY - minY)) * 0.8;
      const ox = (box[0] + box[2]) / 2 - ((minX + maxX) / 2) * k, oy = (box[1] + box[3]) / 2 + ((minY + maxY) / 2) * k;
      const S = P.map((p) => ({ x: ox + p.x * k, y: oy - p.y * k }));
      const [pA, pB, pC] = S;
      const cen = { x: (pA.x + pB.x + pC.x) / 3, y: (pA.y + pB.y + pC.y) / 3 };
      const unit = (v) => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };
      const out = (p, d) => { const u = unit({ x: p.x - cen.x, y: p.y - cen.y }); return { x: p.x + u.x * d, y: p.y + u.y * d }; };
      const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
      // The angle at B: an arc between BA and BC, and its marigold wash.
      const uA = unit({ x: pA.x - pB.x, y: pA.y - pB.y }), uC = unit({ x: pC.x - pB.x, y: pC.y - pB.y });
      const r = Math.max(16, Math.min(34, Math.min(Math.hypot(pA.x - pB.x, pA.y - pB.y), Math.hypot(pC.x - pB.x, pC.y - pB.y)) * 0.22));
      const a0 = { x: pB.x + uA.x * r, y: pB.y + uA.y * r }, a1 = { x: pB.x + uC.x * r, y: pB.y + uC.y * r };
      const sweep = uA.x * uC.y - uA.y * uC.x > 0 ? 1 : 0;
      const arcD = `M${f(a0.x)} ${f(a0.y)} A${f(r)} ${f(r)} 0 0 ${sweep} ${f(a1.x)} ${f(a1.y)}`;
      const bis = unit({ x: uA.x + uC.x, y: uA.y + uC.y });
      // The working, beside the figure (under it on a phone).
      const wx = narrow ? 16 : 478, wy = narrow ? [282, 310, 338, 382] : [100, 136, 172, 228];
      const work = [
        { s: 4, text: "AC² = AB² + BC² − 2·AB·BC·cos B", c: C.write },
        { s: 4, text: `= ${fmt(AB)}² + ${fmt(BC)}² − 2·${fmt(AB)}·${fmt(BC)}·cos ${deg(B)}`, c: C.write },
        { s: 4, text: `= ${fmt(t.sq)}`, c: C.write },
        { s: 5, text: `AC = √${fmt(t.sq)} ${t.perfect ? "=" : "≈"} ${fmt(t.AC)}`, c: C.accent, bold: true },
      ];
      const lab = (s, p, text, colour, size = fs, weight = 600, cls = "") => `<text class="db-lb ${cls}" data-s="${s}" x="${f(p.x)}" y="${f(p.y)}" dy=".35em" text-anchor="middle" fill="${colour}" font-size="${size}" font-weight="${weight}">${text}</text>`;
      const line = (s, p, q, colour, w, dash) => `<line class="db-st" data-s="${s}" data-x1="${f(p.x)}" data-y1="${f(p.y)}" data-x2="${f(q.x)}" data-y2="${f(q.y)}" x1="${f(p.x)}" y1="${f(p.y)}" x2="${f(q.x)}" y2="${f(q.y)}" stroke="${colour}" stroke-width="${w}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
      let g = "";
      g += `<path class="db-lb" data-s="2" d="M${f(pB.x)} ${f(pB.y)} L${f(a0.x)} ${f(a0.y)} A${f(r)} ${f(r)} 0 0 ${sweep} ${f(a1.x)} ${f(a1.y)} Z" fill="${C.accent}" fill-opacity=".22"/>`;
      g += line(0, pA, pB, C.ink, 3.4);
      g += line(1, pB, pC, C.ink, 3.4);
      g += `<path class="db-st db-arc" data-s="2" d="${arcD}" fill="none" stroke="${C.ink}" stroke-width="2.6" stroke-linecap="round"/>`;
      g += line(3, pC, pA, C.soft, 2.4, "7 7");
      g += line(5, pC, pA, C.accent, 3.6);
      // Every label finds a place clear of the sides, of the labels already placed and of the working.
      const segs = [[pA, pB], [pB, pC], [pC, pA]];
      const placed = work.map((w, i) => ({ x: wx - 4, y: wy[i] - ws, w: w.text.length * ws * 0.56 + 8, h: ws + 8 }));
      const boxAt = (c, w, h) => ({ x: c.x - w / 2, y: c.y - h / 2, w, h });
      const meets = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      const crossed = (b) => segs.some(([p, q]) => { for (let i = 0; i <= 48; i++) { const x = p.x + ((q.x - p.x) * i) / 48, y = p.y + ((q.y - p.y) * i) / 48; if (x > b.x - 3 && x < b.x + b.w + 3 && y > b.y - 3 && y < b.y + b.h + 3) return true; } return false; });
      const inside = (b) => b.x >= 2 && b.y >= 2 && b.x + b.w <= W - 2 && b.y + b.h <= H - 2;
      const place = (cands, text, size) => {
        const w = text.length * size * 0.6 + 4, h = size + 4;
        const pick = cands.find((c) => { const b = boxAt(c, w, h); return inside(b) && !crossed(b) && !placed.some((o) => meets(o, { x: b.x - 3, y: b.y - 3, w: b.w + 6, h: b.h + 6 })); }) ?? cands[0];
        placed.push(boxAt(pick, w, h));
        return pick;
      };
      const rot = (u, a) => ({ x: u.x * Math.cos(a) - u.y * Math.sin(a), y: u.x * Math.sin(a) + u.y * Math.cos(a) });
      const nameAt = (P) => { const u = unit({ x: P.x - cen.x, y: P.y - cen.y }); const c = []; for (const d of [18, 24, 32]) for (const a of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) { const v = rot(u, a); c.push({ x: P.x + v.x * d, y: P.y + v.y * d }); } return c; };
      /** Along the side's outward normal (away from the corner opposite), then slid along the side. */
      const sideAt = (p, q, opp, text, size) => {
        const m = mid(p, q), dir = unit({ x: q.x - p.x, y: q.y - p.y });
        let n = { x: -dir.y, y: dir.x };
        if (n.x * (opp.x - m.x) + n.y * (opp.y - m.y) > 0) n = { x: -n.x, y: -n.y };
        const w = text.length * size * 0.6, base = 8 + Math.abs(n.x) * (w / 2) + Math.abs(n.y) * (size / 2), len = Math.hypot(q.x - p.x, q.y - p.y), c = [];
        for (const d of [base, base + 8, base + 16]) for (const t of [0, 0.15, -0.15, 0.3, -0.3]) c.push({ x: m.x + n.x * d + dir.x * len * t, y: m.y + n.y * d + dir.y * len * t });
        return c;
      };
      /** Inside the angle along its bisector, further out until it fits between the sides; else outside the corner. */
      const angleAt = (text, size) => { const c = []; for (let d = r + 16; d <= r + 140; d += 8) c.push({ x: pB.x + bis.x * d, y: pB.y + bis.y * d }); for (let d = 18; d <= 60; d += 8) for (const a of [0, 0.7, -0.7]) { const v = rot({ x: -bis.x, y: -bis.y }, a); c.push({ x: pB.x + v.x * d, y: pB.y + v.y * d }); } return c; };
      const acText = `${t.perfect ? "" : "≈ "}${fmt(t.AC)}`;
      const nA = place(nameAt(pA), "A", fs + 2), nB = place(nameAt(pB), "B", fs + 2), nC = place(nameAt(pC), "C", fs + 2);
      const lAB = place(sideAt(pA, pB, pC, fmt(AB), fs), fmt(AB), fs), lBC = place(sideAt(pB, pC, pA, fmt(BC), fs), fmt(BC), fs);
      const lAC = place(sideAt(pC, pA, pB, acText, fs), acText, fs), lB = place(angleAt(deg(B), fs - 1), deg(B), fs - 1);
      g += lab(0, nA, "A", C.label, fs + 2, 700) + lab(0, nB, "B", C.label, fs + 2, 700) + lab(1, nC, "C", C.label, fs + 2, 700);
      g += lab(0, lAB, fmt(AB), C.label) + lab(1, lBC, fmt(BC), C.label) + lab(2, lB, deg(B), C.label, fs - 1);
      g += lab(3, lAC, "?", C.accent, fs + 2, 700, "db-ask") + lab(5, lAC, acText, C.accent, fs, 700);
      work.forEach((w, i) => {
        g += `<clipPath id="db-w${i}"><rect class="db-wclip" x="${wx - 2}" y="${wy[i] - ws - 6}" width="0" height="${ws + 14}"/></clipPath>`;
        g += `<text class="db-wr" data-s="${w.s}" data-w="${i}" x="${wx}" y="${wy[i]}" fill="${w.c}" font-size="${w.bold ? ws + 1 : ws}" font-weight="${w.bold ? 700 : 500}" clip-path="url(#db-w${i})">${w.text}</text>`;
      });
      const nibS = narrow ? 1.05 : 1.2;
      rest = { x: W - 34, y: H - 40 };
      g += `<g class="db-nib"><g transform="scale(${nibS})"><g transform="translate(-3 -2)"><path d="${NIB_D}" fill="${INK.buddy}" stroke="#FFFFFF" stroke-width="1.4" stroke-linejoin="round"/><circle cx="5.3" cy="7.6" r="1.05" fill="#fff"/><circle cx="8.9" cy="7.6" r="1.05" fill="#fff"/><path d="M5.5 10.9 Q7.1 12.3 8.7 10.9" stroke="#fff" stroke-width="1.1" stroke-linecap="round" fill="none"/></g></g></g>`;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svg.innerHTML = g;
      nibG = svg.querySelector(".db-nib");
      // Everything that draws, in the order a pen would draw it.
      items = [...svg.querySelectorAll(".db-st, .db-wr")].map((el) => {
        const it = { el, s: Number(el.dataset.s) };
        if (el.tagName === "line") { it.kind = "line"; it.p = [Number(el.dataset.x1), Number(el.dataset.y1), Number(el.dataset.x2), Number(el.dataset.y2)]; it.len = Math.hypot(it.p[2] - it.p[0], it.p[3] - it.p[1]); }
        else if (el.tagName === "path") { it.kind = "path"; it.len = el.getTotalLength(); }
        else { it.kind = "write"; it.clip = svg.querySelector(`#db-w${el.dataset.w} rect`); it.len = el.getComputedTextLength() + 4; it.x = Number(el.getAttribute("x")); it.y = Number(el.getAttribute("y")); }
        return it;
      });
      factsEl.innerHTML = `<b>What chalk worked out:</b> AC ${t.perfect ? "=" : "≈"} ${fmt(t.AC)} · angle A ≈ ${deg(t.A)} · angle C ≈ ${deg(t.C)} · area ≈ ${fmt(t.area)} · perimeter ≈ ${fmt(t.perimeter)}`;
    }
    let nibAt = { x: 0, y: 0 };
    const putNib = (x, y) => { nibAt = { x, y }; if (nibG) nibG.setAttribute("transform", `translate(${f(x)} ${f(y)})`); };
    /** Draw one item to `p` of the way: a line grows from its start, an arc unrolls, a line of working is written left to right. */
    function drawItem(it, p) {
      if (it.kind === "line") {
        const [x1, y1, x2, y2] = it.p, x = x1 + (x2 - x1) * p, y = y1 + (y2 - y1) * p;
        it.el.setAttribute("x2", f(x)); it.el.setAttribute("y2", f(y)); it.el.style.opacity = p > 0 ? 1 : 0;
        return { x, y };
      }
      if (it.kind === "path") {
        it.el.style.strokeDasharray = `${it.len}`; it.el.style.strokeDashoffset = `${it.len * (1 - p)}`; it.el.style.opacity = p > 0 ? 1 : 0;
        const q = it.el.getPointAtLength(it.len * p);
        return { x: q.x, y: q.y };
      }
      it.clip.setAttribute("width", f(it.len * p + 2)); it.el.style.opacity = 1;
      return { x: it.x + it.len * p, y: it.y - 4 };
    }
    /** The board as it is after step `k`: everything up to it drawn, nothing after. */
    function show(k) {
      shown = k;
      items.forEach((it) => drawItem(it, it.s <= k ? 1 : 0));
      svg.querySelectorAll(".db-lb").forEach((el) => { el.style.opacity = Number(el.dataset.s) <= k ? 1 : 0; });
      // The answer replaces the "?" it was asked as.
      const ask = svg.querySelector(".db-ask");
      if (ask && k >= 5) ask.style.opacity = 0;
      if (k >= 0) setSay(k, Infinity); else say.textContent = "";
      dots.forEach((d, i) => { d.toggleAttribute("data-on", i === k); d.toggleAttribute("data-past", i < k); });
      putNib(rest.x, rest.y);
    }
    function setSay(k, lit) {
      const words = sentences()[k].split(" ");
      say.innerHTML = words.map((w, i) => `<span${i < lit ? ' class="is-lit"' : ""}>${esc(w)}</span>`).join(" ");
    }
    const tick = (dur, fn, token) => new Promise((done) => {
      const t0 = performance.now();
      const frame = (now) => {
        if (token !== run) return done(false);
        const p = Math.min(1, (now - t0) / dur);
        fn(p);
        if (p < 1) requestAnimationFrame(frame); else done(true);
      };
      requestAnimationFrame(frame);
    });
    /** Play: each step's sentence is said word by word while its strokes are drawn, the nib travelling along them. */
    async function play() {
      if (reduce) { show(5); return; }
      const token = ++run;
      show(-1);
      for (let k = 0; k <= 5; k++) {
        if (token !== run) return;
        dots.forEach((d, i) => { d.toggleAttribute("data-on", i === k); d.toggleAttribute("data-past", i < k); });
        setSay(k, 0);
        const spans = [...say.querySelectorAll("span")];
        const talk = tick(spans.length * WORD_MS, (p) => { const n = Math.ceil(p * spans.length); spans.forEach((s, i) => s.classList.toggle("is-lit", i < n)); }, token);
        await tick(160, () => {}, token);
        for (const it of items.filter((x) => x.s === k)) {
          const dur = it.kind === "write" ? Math.max(500, it.len * 5.5) : Math.max(420, it.len * 3.2);
          if (!(await tick(dur, (p) => { const at = drawItem(it, p); putNib(at.x, at.y); }, token))) return;
        }
        svg.querySelectorAll(`.db-lb[data-s="${k}"]`).forEach((el) => { el.style.opacity = 1; });
        if (k === 5) { const ask = svg.querySelector(".db-ask"); if (ask) ask.style.opacity = 0; }
        await talk;
        if (!(await tick(420, () => {}, token))) return;
      }
      if (token === run) { shown = 5; const from = nibAt; tick(600, (p) => putNib(from.x + (rest.x - from.x) * p, from.y + (rest.y - from.y) * p), token); }
    }
    playBtn.addEventListener("click", () => { playBtn.textContent = "Play again"; play(); });
    dots.forEach((d, i) => d.addEventListener("click", () => { run++; show(i); }));
    const code = (changed) => { codeEl.innerHTML = codeHTML([["figure", "triangle"], ["sides", { AB, BC }], ["angles", { B }], ["find", ["AC"]]], changed); };
    fig.querySelectorAll("input[data-db]").forEach((input) => input.addEventListener("input", () => {
      const v = Number(input.value), key = input.dataset.db;
      if (key === "ab") AB = v; else if (key === "bc") BC = v; else B = v;
      fig.querySelector(`[data-db-show="${key}"]`).textContent = key === "b" ? deg(v) : fmt(v);
      code(new Set([key === "b" ? "angles" : "sides"]));
      run++;
      render();
      show(5);
    }));
    code();
    watchWidth(svg, 560, (n) => { narrow = n; run++; render(); show(5); });
    // It plays once by itself the first time it is seen; Play draws it again.
    if (!reduce && "IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); playBtn.textContent = "Play again"; play(); } }, { threshold: 0.55 });
      io.observe(svg);
    }
  })();

  /* ================================================================ 4. every line is checked */
  (function lineCheck() {
    const fig = document.getElementById("fig-check");
    if (!fig) return;
    const input = fig.querySelector("[data-ck-input]"), out = fig.querySelector("[data-ck-verdict]"), linesEl = fig.querySelector("[data-ck-lines]");
    // The same triangle, solved: AB 5, BC 7, angle B 60°.
    const T = solveSAS(5, 7, 60);
    const scope = { AB: T.AB, BA: T.AB, BC: T.BC, CB: T.BC, AC: T.AC, CA: T.AC, A: T.A, B: T.B, C: T.C, area: T.area, perimeter: T.perimeter };
    const ANGLES = new Set(["A", "B", "C"]);
    fig.querySelector("[data-ck-values]").innerHTML = [`AB = 5`, `BC = 7`, `AC ≈ ${+T.AC.toFixed(3)}`, `A ≈ ${deg(T.A)}`, `B = 60°`, `C ≈ ${deg(T.C)}`, `area ≈ ${+T.area.toFixed(3)}`].map((v) => `<span>${v}</span>`).join("");

    /* A small reader for a line of working: numbers, + − × · ÷ / ^ ² ³, √ and sqrt, sin cos tan (in degrees), ½,
       brackets, and the figure's names. Each value knows whether it is an angle, as chalk's check does. */
    class Unknown extends Error { constructor(name) { super(name); this.name_ = name; } }
    function read(src) {
      const toks = [];
      for (let i = 0; i < src.length;) {
        const ch = src[i], rest = src.slice(i);
        const num = /^(\d+(\.\d+)?|\.\d+)/.exec(rest), name = /^[A-Za-z]+/.exec(rest);
        if (/\s/.test(ch)) { i++; continue; }
        if (num) { toks.push({ t: "num", v: parseFloat(num[0]) }); i += num[0].length; continue; }
        if (name) { toks.push({ t: "name", v: name[0] }); i += name[0].length; continue; }
        const one = { "½": ["num", 0.5], "¼": ["num", 0.25], "¾": ["num", 0.75], "π": ["num", Math.PI], "²": ["pow", 2], "³": ["pow", 3], "°": ["deg"], "+": ["+"], "-": ["-"], "−": ["-"], "–": ["-"], "*": ["*"], "×": ["*"], "·": ["*"], "⋅": ["*"], "/": ["/"], "÷": ["/"], "^": ["^"], "√": ["sqrt"], "(": ["("], ")": [")"] }[ch];
        if (!one) throw new Error("unreadable");
        toks.push(one.length > 1 ? { t: one[0], v: one[1] } : { t: one[0] });
        i++;
      }
      let k = 0;
      const peek = () => toks[k], next = () => toks[k++];
      const FUN = { sin: Math.sin, cos: Math.cos, tan: Math.tan };
      const starts = (q) => q && (q.t === "num" || q.t === "name" || q.t === "(" || q.t === "sqrt");
      function expr() {
        let a = term();
        while (peek() && (peek().t === "+" || peek().t === "-")) { const op = next().t, b = term(); a = { v: op === "+" ? a.v + b.v : a.v - b.v, angle: a.angle && b.angle }; }
        return a;
      }
      function term() {
        let a = unary();
        for (;;) {
          const q = peek();
          if (q && (q.t === "*" || q.t === "/")) { next(); const b = unary(); a = q.t === "*" ? { v: a.v * b.v, angle: a.angle !== b.angle } : { v: a.v / b.v, angle: a.angle && !b.angle }; }
          else if (starts(q)) { const b = unary(); a = { v: a.v * b.v, angle: a.angle !== b.angle }; }
          else return a;
        }
      }
      function unary() { const q = peek(); if (q && (q.t === "-" || q.t === "+")) { next(); const a = unary(); return { v: q.t === "-" ? -a.v : a.v, angle: a.angle }; } return power(); }
      function power() { const a = postfix(); if (peek() && peek().t === "^") { next(); const b = unary(); return { v: Math.pow(a.v, b.v), angle: false }; } return a; }
      function postfix() {
        let a = atom();
        for (;;) {
          const q = peek();
          if (q && q.t === "deg") { next(); a = { v: a.v, angle: true }; }
          else if (q && q.t === "pow") { next(); a = { v: Math.pow(a.v, q.v), angle: false }; }
          else return a;
        }
      }
      const group = () => { const a = expr(); if (!peek() || next().t !== ")") throw new Error("bracket"); return a; };
      function atom() {
        const q = next();
        if (!q) throw new Error("end");
        if (q.t === "num") return { v: q.v, angle: false };
        if (q.t === "(") return group();
        const fn = q.t === "sqrt" ? "sqrt" : q.t === "name" && (q.v === "sqrt" || FUN[q.v]) ? q.v : null;
        if (fn) {
          let arg;
          if (peek() && peek().t === "(") { next(); arg = group(); }
          else { arg = atom(); if (peek() && peek().t === "deg") { next(); arg = { v: arg.v, angle: true }; } }
          return fn === "sqrt" ? { v: Math.sqrt(arg.v), angle: false } : { v: FUN[fn](arg.v * RAD), angle: false };
        }
        if (q.t === "name") {
          if (!(q.v in scope)) throw new Unknown(q.v);
          return { v: scope[q.v], angle: ANGLES.has(q.v) };
        }
        throw new Error("unexpected");
      }
      const r = expr();
      if (k < toks.length) throw new Error("left over");
      return Number.isFinite(r.v) ? r : null;
    }
    /** chalk's rule: every side of each "=" or "≈" must agree with the first, within 1.5% or 0.01. */
    const close = (a, b) => Math.abs(a - b) <= Math.max(0.01, 0.015 * Math.max(Math.abs(a), Math.abs(b)));
    const n5 = (v) => String(+v.toPrecision(5)).replace("-", "−");
    function check(text) {
      let checked = 0, unknown = null, agreed = [];
      for (const claim of text.split(/⇒|;|,(?![^(]*\))/)) {
        const sides = claim.split(/≈|=|≃/).map((s) => s.trim()).filter(Boolean);
        if (sides.length < 2) continue;
        const nums = [];
        for (const s of sides) {
          try { const r = read(s); if (r) nums.push({ s, r }); } catch (e) { if (e instanceof Unknown && !unknown) unknown = e.name_; }
        }
        for (let i = 1; i < nums.length; i++) {
          const a = nums[0].r, b = nums[i].r;
          checked++;
          const same = close(a.v, b.v) || (a.angle !== b.angle && close(a.angle ? a.v * RAD : a.v, b.angle ? b.v * RAD : b.v));
          if (!same) return { verdict: "wrong", why: `${nums[0].s} comes to ${n5(a.v)} but ${nums[i].s} comes to ${n5(b.v)}` };
          agreed.push([nums[0], nums[i], !close(a.v, b.v)]);
        }
      }
      return checked ? { verdict: "right", agreed } : { verdict: "unchecked", unknown };
    }
    function show() {
      const text = input.value.trim();
      linesEl.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.line === text)));
      if (!text) { out.innerHTML = `<p class="ck-say">Type a line with an “=” or “≈” in it.</p>`; return; }
      const r = check(text);
      if (r.verdict === "right") {
        const [x, y, rad] = r.agreed[0], same = n5(x.r.v) === n5(y.r.v);
        const ang = x.r.angle ? x : y, plainSide = x.r.angle ? y : x;
        const said = rad ? `${esc(ang.s)} is ${n5(ang.r.v)}°, and ${esc(plainSide.s)} is the same angle in radians, ${n5(plainSide.r.v)}.`
          : same ? `Both sides come to ${n5(x.r.v)}${x.r.angle ? "°" : ""}.` : `${esc(x.s)} comes to ${n5(x.r.v)} and ${esc(y.s)} to ${n5(y.r.v)}: within 1.5%, so they agree.`;
        out.innerHTML = `<span class="ck-tag is-right">Right</span><p class="ck-say">${said} It can go on the board.</p>`;
      } else if (r.verdict === "wrong") {
        out.innerHTML = `<span class="ck-tag is-wrong">Wrong</span><p class="ck-say">${esc(r.why)}. This line is never written.</p>`;
      } else {
        out.innerHTML = `<span class="ck-tag">Unchecked</span><p class="ck-say">${r.unknown ? `The figure has no “${esc(r.unknown)}”, so` : "Nothing here can be set against the figure, so"} the line is left alone: unchecked, not failed.</p>`;
      }
    }
    const LINES = ["AC² = 5² + 7² − 2·5·7·cos 60°", "AC ≈ 6.24", "AC = 6.5", "B = 60°", "area = ½·5·7·sin 60°", "h = AC·sin A"];
    linesEl.innerHTML = LINES.map((l) => `<button type="button" data-line="${esc(l)}" aria-pressed="false">${esc(l)}</button>`).join("");
    linesEl.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { input.value = b.dataset.line; show(); }));
    fig.querySelectorAll("[data-key]").forEach((b) => b.addEventListener("click", () => {
      const s = input.selectionStart ?? input.value.length, e = input.selectionEnd ?? s;
      input.value = input.value.slice(0, s) + b.dataset.key + input.value.slice(e);
      input.focus();
      input.setSelectionRange(s + b.dataset.key.length, s + b.dataset.key.length);
      show();
    }));
    input.addEventListener("input", show);
    show();
  })();

  /* ================================================================ 6. the crayon hand */
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
