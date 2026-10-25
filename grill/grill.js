/* ============================================================
   Grill hero
   A camera drops from the sky onto Seyi. When it lands on his
   mouth, each silver cap is a project: 13 teeth, plus the gap
   between the front two for "Your project".

   Projects are read from the work grid (#projects), so the grid
   stays the single source of truth: reorder the cards and the
   teeth follow. Tooth outlines are in close-up pixels
   (grill-closeup, 3840x2160).

   Debug: ?p=0..1 freezes the camera at that point of the drop.
   ============================================================ */
(() => {
  const root = document.querySelector(".grill");
  if (!root) return;

  const stage = root.querySelector(".grill__stage");
  const canvas = root.querySelector(".grill__canvas");
  const ctx = canvas.getContext("2d");
  const sprites = root.querySelector(".grill__sprites");
  const teethSvg = root.querySelector(".grill__teeth");
  const cap = root.querySelector(".grill__cap");
  const capNum = cap.querySelector(".grill__cap-num");
  const capMeta = cap.querySelector(".grill__cap-meta");
  const capTitle = cap.querySelector(".grill__cap-title");
  const index = root.querySelector(".grill__index");
  const skip = root.querySelector(".grill__skip");
  const hint = root.querySelector(".grill__hint");
  const SVGNS = "http://www.w3.org/2000/svg";

  /* ---------- Scene data (world = cropped 4K frame, in px) ---------- */
  const WORLD = { w: 2708, h: 4224 };                        // the shadow layer covers the whole world
  const PERSON = { x: 40, y: -227, w: 2900, h: 3866 };       // transparent cut-out, drawn into the world
  const FEET = { x: 2051, y: 3313 };                         // shadow is anchored here
  const FIGURE = { x0: 102, y0: 173, x1: 2689, y1: 3960 };  // person + shadow
  const GRILL = { x0: 1678, y0: 1275, x1: 2036, y1: 1447 };  // the teeth
  const CLOSE = { x: 1440, y: 1141, w: 768, h: 432, px: 3840 }; // close-up rect, 5x
  const K = CLOSE.px / CLOSE.w;                              // close-up px per world px

  // tooth outlines in close-up px, in project order (centre outward, top row first)
  // tooth outlines in close-up px, in project order (centre outward, top row first)
  const TEETH = [
    [[2185,967],[2182,993],[2177,1018],[2170,1046],[2163,1077],[2152,1115],[2127,1147],[2092,1161],[2053,1157],[2017,1147],[1984,1135],[1950,1121],[1921,1100],[1904,1067],[1900,1030],[1905,997],[1910,967],[1916,940],[1924,914],[1935,888],[1947,860],[1963,831],[1987,807],[2017,786],[2053,776],[2092,771],[2132,776],[2167,797],[2185,835],[2189,876],[2188,912],[2187,940]], // U4
    [[2485,1029],[2482,1054],[2477,1078],[2473,1107],[2467,1140],[2455,1176],[2429,1205],[2394,1218],[2356,1219],[2319,1215],[2281,1208],[2247,1192],[2224,1160],[2218,1120],[2226,1082],[2231,1054],[2235,1029],[2239,1005],[2244,983],[2250,957],[2257,929],[2266,894],[2284,853],[2315,823],[2356,820],[2396,831],[2430,851],[2457,877],[2474,911],[2484,943],[2490,974],[2490,1002]], // U5
    [[1938,888],[1935,912],[1931,936],[1923,961],[1914,988],[1900,1015],[1877,1037],[1846,1046],[1814,1045],[1784,1039],[1755,1030],[1726,1019],[1698,1003],[1677,979],[1667,948],[1667,917],[1674,888],[1684,861],[1696,839],[1708,816],[1721,795],[1738,773],[1759,754],[1784,738],[1814,727],[1847,723],[1879,729],[1910,744],[1934,767],[1945,799],[1944,834],[1941,862]], // U3
    [[2619,1096],[2618,1111],[2615,1126],[2614,1145],[2613,1167],[2605,1190],[2589,1208],[2566,1217],[2542,1219],[2518,1217],[2494,1212],[2470,1205],[2454,1184],[2450,1158],[2453,1132],[2456,1113],[2458,1096],[2460,1079],[2463,1064],[2466,1045],[2472,1026],[2483,1007],[2500,995],[2519,980],[2542,967],[2569,959],[2598,962],[2617,984],[2623,1015],[2621,1044],[2619,1064],[2620,1080]], // U6
    [[1695,824],[1693,848],[1688,872],[1684,899],[1675,925],[1656,947],[1629,959],[1602,964],[1574,964],[1546,961],[1520,955],[1493,946],[1469,928],[1451,906],[1440,879],[1436,852],[1439,824],[1445,798],[1454,775],[1466,752],[1480,731],[1498,710],[1521,697],[1546,688],[1574,685],[1602,684],[1631,685],[1661,694],[1683,714],[1695,743],[1698,773],[1696,800]], // U2
    [[2807,1122],[2806,1142],[2804,1162],[2803,1187],[2798,1215],[2784,1239],[2760,1254],[2734,1262],[2706,1265],[2677,1266],[2648,1261],[2621,1249],[2603,1224],[2597,1195],[2599,1167],[2600,1143],[2601,1122],[2602,1101],[2604,1080],[2606,1055],[2616,1032],[2632,1013],[2653,994],[2676,976],[2706,965],[2737,965],[2766,976],[2789,997],[2803,1025],[2811,1052],[2811,1078],[2809,1101]], // U7
    [[2171,1277],[2160,1300],[2147,1320],[2133,1338],[2119,1354],[2104,1371],[2087,1387],[2067,1405],[2041,1419],[2012,1425],[1983,1418],[1960,1398],[1946,1372],[1937,1347],[1930,1322],[1927,1300],[1927,1277],[1930,1254],[1934,1233],[1939,1208],[1945,1180],[1961,1157],[1988,1148],[2016,1150],[2041,1154],[2066,1157],[2089,1162],[2113,1171],[2137,1181],[2161,1196],[2179,1220],[2181,1249]], // L5
    [[2403,1347],[2398,1371],[2388,1392],[2376,1413],[2363,1432],[2348,1451],[2329,1471],[2307,1490],[2278,1502],[2247,1503],[2219,1492],[2195,1471],[2180,1446],[2169,1421],[2164,1394],[2162,1371],[2161,1347],[2162,1324],[2165,1301],[2168,1274],[2178,1247],[2195,1223],[2222,1211],[2250,1208],[2278,1213],[2304,1218],[2329,1223],[2359,1228],[2387,1239],[2405,1262],[2410,1293],[2407,1321]], // L6
    [[1930,1198],[1922,1221],[1914,1240],[1905,1261],[1894,1281],[1880,1301],[1861,1318],[1839,1335],[1811,1345],[1781,1348],[1753,1340],[1730,1319],[1719,1291],[1714,1263],[1712,1239],[1709,1219],[1707,1198],[1706,1177],[1707,1155],[1709,1129],[1714,1101],[1729,1076],[1755,1064],[1785,1064],[1811,1070],[1836,1074],[1860,1081],[1884,1089],[1908,1102],[1928,1121],[1938,1146],[1939,1173]], // L4
    [[2608,1376],[2608,1400],[2598,1422],[2579,1437],[2559,1448],[2547,1465],[2532,1482],[2513,1498],[2488,1523],[2456,1537],[2428,1523],[2409,1494],[2398,1466],[2390,1442],[2385,1419],[2384,1397],[2385,1376],[2386,1355],[2389,1335],[2391,1311],[2397,1284],[2410,1259],[2432,1242],[2461,1238],[2488,1241],[2515,1245],[2540,1251],[2566,1260],[2589,1275],[2606,1298],[2610,1326],[2609,1352]], // L7
    [[1709,1128],[1695,1151],[1684,1172],[1673,1193],[1661,1212],[1645,1231],[1624,1244],[1602,1255],[1576,1262],[1548,1268],[1518,1269],[1485,1266],[1456,1248],[1442,1218],[1442,1183],[1448,1153],[1455,1128],[1462,1105],[1470,1084],[1478,1062],[1488,1039],[1502,1016],[1523,997],[1548,988],[1576,986],[1604,989],[1630,996],[1658,1006],[1686,1018],[1711,1037],[1726,1066],[1722,1098]], // L3
    [[2741,1368],[2733,1383],[2725,1396],[2719,1408],[2710,1418],[2699,1428],[2687,1435],[2675,1443],[2660,1448],[2643,1452],[2625,1455],[2605,1450],[2594,1434],[2592,1414],[2592,1396],[2591,1382],[2591,1368],[2591,1354],[2594,1341],[2595,1325],[2601,1309],[2612,1296],[2628,1293],[2645,1293],[2660,1293],[2675,1294],[2690,1296],[2706,1298],[2723,1306],[2736,1317],[2745,1333],[2748,1351]], // L8
    [[1474,996],[1474,1018],[1461,1034],[1442,1046],[1427,1054],[1413,1064],[1399,1070],[1385,1076],[1369,1083],[1350,1089],[1329,1095],[1301,1097],[1277,1088],[1264,1067],[1265,1039],[1276,1015],[1283,996],[1289,980],[1292,965],[1296,948],[1302,930],[1312,912],[1328,896],[1350,901],[1369,912],[1385,916],[1404,912],[1428,909],[1452,913],[1471,928],[1478,952],[1477,975]], // L2
  ];
  const GAP = [[2181,832],[2227,832],[2229,1180],[2186,1162]]; // the space between U4 and U5

  /* ---------- Projects, straight from the work grid ---------- */
  const projects = [...document.querySelectorAll("#projects .project")].map((li) => {
    const a = li.querySelector(".project__card");
    return {
      title: (li.querySelector(".project__title")?.textContent || "").trim(),
      type: (li.querySelector(".project__type")?.textContent || "").trim(),
      year: (li.querySelector(".project__year")?.textContent || "").trim(),
      href: a?.getAttribute("href") || "#",
      external: a?.target === "_blank",
      tint: li.style.getPropertyValue("--tint").trim() || "#15140f", // the card's own colour
    };
  });
  const toothProjects = projects.slice(0, TEETH.length);
  const gapProject = projects[TEETH.length] || null; // the "Your project" card
  // which project teeth are solid silver caps in the close-up (the rest are open-face: a silver bezel round a white tooth)
  /* ---------- Settings ---------- */
  const params = new URLSearchParams(location.search);
  const forced = params.has("p") ? Math.min(1, Math.max(0, parseFloat(params.get("p")) || 0)) : null;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const DROP = [0.05, 0.82];          // share of the section's scroll spent falling
  const LAND = 0.985;                 // eased progress at which the teeth go live
  if (reduce) root.classList.add("is-still");

  /* ---------- Images ----------
     Everything is decoded before it is drawn, so scrolling never waits on a decode, and each
     layer keeps a few sizes so a frame never samples a far bigger image than it shows. */
  const A = "grill/assets/";
  const loadImg = (url) => new Promise((res) => {
    const i = new Image(); i.decoding = "async";
    i.onload = () => (i.decode ? i.decode() : Promise.resolve()).then(() => res(i), () => res(i));
    i.onerror = () => res(null); i.src = url;
  });
  // a list of { w, src } from small to large: the source plus halved copies down to minW
  // (an <img> drawn into a canvas is decoded lazily at its first draw, mid-scroll; an ImageBitmap is decoded up front)
  const bitmap = async (src) => {
    if (!src || !("createImageBitmap" in window) || src instanceof HTMLCanvasElement) return src;
    try { return await createImageBitmap(src); } catch { return src; }
  };
  const tiers = async (src, minW) => {
    const list = [{ w: src.width || src.naturalWidth, src: await bitmap(src) }];
    if (!("createImageBitmap" in window)) return list;
    let w = list[0].w;
    const h = src.height || src.naturalHeight;
    while (w / 2 >= minW) {
      w = Math.round(w / 2);
      try { list.unshift({ w, src: await createImageBitmap(src, { resizeWidth: w, resizeHeight: Math.round((h * w) / list[list.length - 1].w), resizeQuality: "high" }) }); }
      catch { break; }
    }
    return list;
  };
  const pick = (list, pxPerWorld, worldW) => {
    if (!list) return null;
    for (const t of list) if (t.w / worldW >= pxPerWorld * 0.9) return t.src;
    return list[list.length - 1].src;
  };
  const img = { shadow: null, person: null, close: null };
  // the first draw of each image uploads it to the GPU (20-40 ms); do that while idle, one per idle moment, not mid-scroll
  const idle = () => new Promise((r) => ("requestIdleCallback" in window ? requestIdleCallback(r, { timeout: 600 }) : setTimeout(r, 60)));
  const warm = async (list) => {
    for (const t of list || []) {
      await idle();
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(t.src, 0, 0, 2, 2); dirty = true; // a 2 px draw, repainted over next frame
    }
  };

  // the close-up files already carry the stickers (baked by grill/stickers/source/bake.html)
  const useClose = async (base) => {
    const cv = await bitmap(base);
    img.close = await tiers(cv, 400);
    paintTeeth(cv); dirty = true; warm(img.close);
  };

  (async () => {
    const [shadow, person] = await Promise.all([loadImg(A + "shadow.webp"), loadImg(A + "person-half.webp")]);
    img.shadow = await bitmap(shadow); img.person = await tiers(person, 300);
    root.classList.add("is-ready"); dirty = true; warm(img.person);
    // heavier layers once the first frame is up
    await new Promise((r) => ("requestIdleCallback" in window ? requestIdleCallback(r, { timeout: 1200 }) : setTimeout(r, 300)));
    const half = await loadImg(A + "closeup-half.webp"); if (half) await useClose(half);
    const pFull = await loadImg(A + "person-full.webp"); if (pFull) { img.person = await tiers(pFull, 300); dirty = true; warm(img.person); }
    const full = await loadImg(A + "closeup-full.webp"); if (full) await useClose(full);
  })();

  /* ---------- Teeth (SVG links over the close-up) ---------- */
  const ptsAttr = (pts) => pts.map((p) => p.join(",")).join(" ");
  const centroid = (pts) => pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
  const bounds = (pts) => {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  };

  const teeth = [];
  const addTooth = (pts, project, index, isGap) => {
    if (!project) return;
    const num = isGap ? "" : String(index + 1).padStart(2, "0");
    const a = document.createElementNS(SVGNS, "a");
    a.setAttribute("href", project.href);
    a.setAttribute("class", "grill__tooth" + (isGap ? " grill__tooth--gap" : ""));
    if (project.external) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); }
    const meta = [project.type, project.year].filter(Boolean).join(", ");
    a.setAttribute("aria-label", isGap ? `${project.title}. The gap is open: email me` : `${num} ${project.title}${meta ? ", " + meta : ""}`);
    const poly = document.createElementNS(SVGNS, "polygon");
    poly.setAttribute("points", ptsAttr(pts));
    a.appendChild(poly);
    teethSvg.appendChild(a);

    // the tooth as its own layer (a small canvas painted once from the close-up), so it can lift toward you
    let el = null, cv = null, box = null;
    if (!isGap) {
      const c0 = centroid(pts);
      const grown = pts.map(([x, y]) => [c0[0] + (x - c0[0]) * 1.01, c0[1] + (y - c0[1]) * 1.01]);
      box = { ...bounds(grown), pts: grown };
      el = document.createElement("div");
      el.className = "grill__t3d";
      Object.assign(el.style, { left: `${box.x / K}px`, top: `${box.y / K}px`, width: `${box.w / K}px`, height: `${box.h / K}px` });
      cv = document.createElement("canvas"); cv.className = "grill__t3d-face";
      el.appendChild(cv); sprites.appendChild(el);
    }
    const c = centroid(pts);
    const t = { a, project, num, isGap, el, cv, box, world: { x: CLOSE.x + c[0] / K, y: CLOSE.y + c[1] / K } };
    teeth.push(t);
    return t;
  };
  TEETH.forEach((pts, i) => addTooth(pts, toothProjects[i], i, false));
  function paintTeeth(src) {
    const sc = src.width / CLOSE.px;
    teeth.forEach((t) => {
      if (!t.cv) return;
      const { x, y, w, h, pts } = t.box;
      t.cv.width = Math.round(w * sc); t.cv.height = Math.round(h * sc);
      const c = t.cv.getContext("2d");
      c.beginPath(); pts.forEach(([px, py], j) => c[j ? "lineTo" : "moveTo"]((px - x) * sc, (py - y) * sc)); c.closePath(); c.clip();
      c.drawImage(src, x * sc, y * sc, w * sc, h * sc, 0, 0, w * sc, h * sc);
    });
  }
  addTooth(GAP, gapProject, TEETH.length, true);

  /* ---------- Caption (bottom left) and the tooth index (bottom right) ---------- */
  const setCard = (state, t) => {
    cap.dataset.state = state;
    let num = "", meta = "", title = "", href = null, ext = false;
    if (state === "intro") { meta = "Seyi Ogundipe"; title = "Design engineer"; }
    else if (state === "pick") { meta = "Selected work"; title = "Pick a tooth"; }
    else if (t) {
      num = t.num;
      meta = t.isGap ? "The gap" : [t.project.type, t.project.year].filter(Boolean).join(", ");
      title = t.project.title; href = t.project.href; ext = t.project.external;
    }
    capNum.textContent = num; capMeta.textContent = meta;
    if (capTitle.textContent !== title) capTitle.textContent = title;
    // the title is the link while a project is picked (a second way in, and the way in on a phone)
    if (href) { capTitle.setAttribute("href", href); ext ? capTitle.setAttribute("target", "_blank") : capTitle.removeAttribute("target"); }
    else { capTitle.removeAttribute("href"); capTitle.removeAttribute("target"); }
    index.querySelectorAll("button").forEach((b) => b.classList.toggle("is-on", !!t && b._tooth === t));
  };
  // the index: one number per tooth (and + for the gap); pointing at a number lifts its tooth
  teeth.forEach((t) => {
    const li = document.createElement("li"), b = document.createElement("button");
    b.type = "button"; b.tabIndex = -1; b.textContent = t.isGap ? "+" : t.num; b._tooth = t;
    b.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse" && landed && !diving) activate(t); });
    b.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && !diving) activate(null); });
    b.addEventListener("click", () => { if (!landed) return; if ((lastInput === "touch" || lastInput === "pen") && active !== t) activate(t); else go(t); });
    li.appendChild(b); index.appendChild(li);
  });

  let active = null;
  const activate = (t) => {
    if (active === t) return;
    if (active) { active.a.classList.remove("is-active"); active.el?.classList.remove("is-up"); active.el?.style.removeProperty("--rx"); active.el?.style.removeProperty("--ry"); }
    active = t;
    if (t) {
      t.a.classList.add("is-active");
      t.el?.classList.add("is-up");
      setCard("project", t);
    } else {
      setCard(landed ? "pick" : "intro");
    }
  };

  /* ---------- Interaction ---------- */
  let diving = false;
  let lastInput = "mouse"; // what the last click came from: mouse, touch, pen or keyboard
  addEventListener("pointerdown", (e) => { lastInput = e.pointerType; }, true);
  addEventListener("keydown", () => { lastInput = "keyboard"; }, true);
  const go = (t) => {
    if (t.project.external) window.open(t.project.href, "_blank", "noopener");
    else if (t.project.href.startsWith("mailto:") || reduce) location.href = t.project.href;
    else dive(t);
  };
  teeth.forEach((t) => {
    // while diving the camera moves the teeth under a still mouse; keep the clicked tooth selected
    t.a.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse" && !diving) activate(t); });
    t.a.addEventListener("pointermove", (e) => {
      if (t.el && active === t && !diving) {
        const r = t.el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        t.el.style.setProperty("--ry", `${(Math.max(-1, Math.min(1, dx)) * 14).toFixed(2)}deg`);
        t.el.style.setProperty("--rx", `${(-Math.max(-1, Math.min(1, dy)) * 14).toFixed(2)}deg`);
      }
    });
    t.a.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && !diving) activate(null); });
    t.a.addEventListener("focus", () => {
      if (!t.a.matches(":focus-visible")) return; // taps focus too; only keyboard focus selects
      if (!landed && forced === null) jumpToLanding();
      activate(t);
    });
    t.a.addEventListener("blur", () => { if (active === t && lastInput === "keyboard") activate(null); });
    t.a.addEventListener("click", (e) => {
      // touch: the first tap picks the tooth, the second opens it
      if ((lastInput === "touch" || lastInput === "pen") && active !== t) { e.preventDefault(); activate(t); return; }
      // internal pages get the dive; external links and email keep the link's own behaviour
      if (!t.project.external && !t.project.href.startsWith("mailto:") && !reduce) { e.preventDefault(); dive(t); }
    });
  });
  capTitle.addEventListener("click", (e) => {
    if (!active) return;
    if (!active.project.external && !active.project.href.startsWith("mailto:") && !reduce) { e.preventDefault(); dive(active); }
  });
  // tapping empty space on a phone clears the selection
  stage.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" && !e.target.closest(".grill__tooth, .grill__cap, .grill__index")) activate(null);
  });

  /* ---------- Scroll → progress ---------- */
  let target = 0, current = 0, landed = false, dirty = true;
  // the drop plays over a fixed distance (2.4 screens, 2 on a phone); the section is taller than that,
  // so once the grill has landed it holds there and the rest of the page only comes if you keep scrolling
  const sectionRange = () => {
    const r = root.getBoundingClientRect();
    const top = r.top + scrollY, screen = stage.clientHeight;
    // (measured against the frame, not innerHeight: on a phone innerHeight changes with the address bar)
    return { top, len: Math.max(1, Math.min(root.offsetHeight - screen, screen * (screen && stage.clientWidth < 700 ? 2 : 2.4))) };
  };
  const readScroll = () => {
    if (forced !== null) { target = forced; return; }
    if (reduce) { target = 1; return; }
    const { top, len } = sectionRange();
    target = Math.min(1, Math.max(0, (scrollY - top) / len));
    const holding = scrollY > top + len - 2 && scrollY < top + root.offsetHeight - stage.clientHeight;
    root.classList.toggle("is-holding", holding);
    const cue = holding ? "Keep scrolling" : "Scroll";
    if (hint && hint.textContent !== cue) hint.textContent = cue;
  };
  const jumpToLanding = () => {
    const { top, len } = sectionRange();
    window.scrollTo({ top: top + len * (DROP[1] + 0.03), behavior: "instant" });
    readScroll(); current = target; dirty = true;
  };
  skip?.addEventListener("click", (e) => { e.preventDefault(); jumpToLanding(); teeth[0]?.a.focus({ preventScroll: true }); });

  /* ---------- Camera ---------- */
  let W = 0, H = 0, dpr = 1, cam0 = null, cam1 = null;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const resize = () => {
    W = stage.clientWidth; H = stage.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const fw = FIGURE.x1 - FIGURE.x0, fh = FIGURE.y1 - FIGURE.y0;
    const gw = GRILL.x1 - GRILL.x0, gh = GRILL.y1 - GRILL.y0;
    const narrow = W < 700;
    // on phones the box spans the bottom, so frame everything in the space between the nav and the box
    const top = narrow ? 56 : 0;
    const bottom = narrow ? cap.offsetTop - 16 : H;
    const midY = (top + bottom) / 2, room = bottom - top;
    // from the sky: the whole figure and its shadow, small, with room around it
    const s0 = Math.min((room * (narrow ? 0.84 : 0.66)) / fh, (W * 0.8) / fw);
    cam0 = { s: s0, x: (FIGURE.x0 + FIGURE.x1) / 2, y: (FIGURE.y0 + FIGURE.y1) / 2 - (midY - H / 2) / s0, r: -7 };
    // landed: the grill fills most of the width
    const s1 = Math.min((W * (narrow ? 0.8 : 0.6)) / gw, (room * 0.46) / gh);
    cam1 = { s: s1, x: (GRILL.x0 + GRILL.x1) / 2, y: (GRILL.y0 + GRILL.y1) / 2 + 12 - (midY - H / 2) / s1, r: 0 };
    dirty = true;
  };
  const camera = (p) => {
    const e = ease(Math.min(1, Math.max(0, (p - DROP[0]) / (DROP[1] - DROP[0]))));
    const s = cam0.s * Math.pow(cam1.s / cam0.s, e);
    // the mouth glides to the centre at a steady rate while the zoom grows
    const k = (cam0.s / s) * (1 - e);
    return { e, s, x: cam1.x - (cam1.x - cam0.x) * k, y: cam1.y - (cam1.y - cam0.y) * k, r: cam0.r * (1 - e) };
  };

  /* ---------- Dive into a tooth, then go ---------- */
  let diveFrom = null, diveTo = null, diveT0 = 0, diveHref = null;
  const dive = (t) => {
    if (diving) return;
    activate(t); diving = true;
    diveFrom = camera(current);
    diveTo = { s: diveFrom.s * 4, x: t.world.x, y: t.world.y, r: 0 };
    diveT0 = performance.now(); diveHref = t.project.href;
    root.classList.add("is-diving");
  };
  addEventListener("pageshow", (e) => { if (e.persisted) { diving = false; root.classList.remove("is-diving"); dirty = true; } });

  /* ---------- Draw ---------- */
  const draw = (cam) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!img.person) return;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    const rad = (cam.r * Math.PI) / 180;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(W / 2, H / 2); ctx.rotate(rad); ctx.scale(cam.s, cam.s); ctx.translate(-cam.x, -cam.y);

    // the ground is further from the camera than he is, so his shadow grows a little slower
    if (img.shadow) {
      const g = 1 - 0.1 * (cam.e ?? 1);
      ctx.save(); ctx.translate(FEET.x, FEET.y); ctx.scale(g, g); ctx.translate(-FEET.x, -FEET.y);
      ctx.drawImage(img.shadow, 0, 0, WORLD.w, WORLD.h); ctx.restore();
    }
    const density = cam.s * dpr; // device px per world px
    ctx.drawImage(pick(img.person, density, PERSON.w), PERSON.x, PERSON.y, PERSON.w, PERSON.h);

    // sharper close-up of the mouth takes over once the cut-out would be stretched
    const close = pick(img.close, density, CLOSE.w);
    if (close && density > 0.75) {
      ctx.globalAlpha = Math.min(1, (density - 0.75) / 0.5);
      ctx.drawImage(close, CLOSE.x, CLOSE.y, CLOSE.w, CLOSE.h);
      ctx.globalAlpha = 1;
    }

    // keep the SVG teeth glued to the same camera
    const tf = `translate(${W / 2}px, ${H / 2}px) rotate(${cam.r}deg) scale(${cam.s}) translate(${CLOSE.x - cam.x}px, ${CLOSE.y - cam.y}px)`;
    teethSvg.style.transform = tf; sprites.style.transform = tf;
  };

  /* ---------- Loop ---------- */
  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min(64, now - last) / 16.67; last = now;
    let cam;
    if (diving) {
      const u = Math.min(1, (now - diveT0) / 520);
      const v = u * u * u;
      cam = {
        e: 1,
        s: diveFrom.s * Math.pow(diveTo.s / diveFrom.s, v),
        x: diveFrom.x + (diveTo.x - diveFrom.x) * Math.min(1, u * 1.6),
        y: diveFrom.y + (diveTo.y - diveFrom.y) * Math.min(1, u * 1.6),
        r: 0,
      };
      draw(cam);
      if (u >= 1 && diveHref) { const h = diveHref; diveHref = null; location.href = h; }
    } else {
      const k = forced !== null || reduce ? 1 : 1 - Math.pow(1 - 0.16, dt);
      const next = current + (target - current) * k;
      if (Math.abs(next - current) > 1e-5 || dirty) {
        current = Math.abs(target - next) < 1e-4 ? target : next;
        cam = camera(current);
        draw(cam);
        dirty = false;
        const isLanded = cam.e >= LAND;
        if (isLanded !== landed) {
          landed = isLanded;
          root.classList.toggle("is-landed", landed);
          if (!active) setCard(landed ? "pick" : "intro");
          if (!landed) activate(null);
        }
        root.classList.toggle("is-moving", current > 0.02);
        root.classList.toggle("is-close", cam.e > 0.6);
        root.classList.toggle("is-mid", cam.e > 0.18 && cam.e <= 0.6);   // mid-fall the caption would straddle paper and photo: let it go
      }
    }
    requestAnimationFrame(tick);
  };

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => document.documentElement.classList.toggle("grill-in-view", e.isIntersecting)).observe(root);
  }

  setCard("intro");
  resize(); readScroll(); current = target;
  // debug: ?p=1&tooth=3 shows tooth 03 picked (for screenshots)
  if (forced !== null && params.has("tooth")) {
    const t = teeth[(parseInt(params.get("tooth"), 10) || 1) - 1];
    if (t) setTimeout(() => activate(t), 50);
  }
  addEventListener("resize", () => { resize(); readScroll(); });
  addEventListener("scroll", readScroll, { passive: true });
  requestAnimationFrame(tick);
})();
