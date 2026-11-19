/* Seyi Ogundipe's site. Words that open, the page taking on each project's colours, the work playing while
   you look at it, and one small tribute per project, in that project's own language. */
(function () {
  "use strict";
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;
  var root = document.documentElement;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var once = function (el, fn, threshold) {
    if (!el || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); fn(); } }); }, { threshold: threshold || 0.5 });
    io.observe(el);
  };
  var rel = function (el, host) { var a = el.getBoundingClientRect(), b = host.getBoundingClientRect(); return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height }; };
  var interactive = function (t) { return t.closest && t.closest("a, button, .pill, input, textarea"); };
  var press = fine ? "click" : "tap";
  // phones tap, they don't click
  if (!fine) document.querySelectorAll(".hint").forEach(function (h) { h.innerHTML = h.innerHTML.replace("Click anywhere", "Tap anywhere").replace("click anywhere", "tap anywhere"); });

  /* ---------- words that open ---------- */
  var openers = {};
  document.querySelectorAll(".pill").forEach(function (pill) {
    pill.addEventListener("click", function () {
      var r = document.getElementById(pill.dataset.for);
      if (!r) return;
      var open = r.classList.toggle("is-open");
      pill.setAttribute("aria-expanded", String(open));
      if (openers[pill.dataset.for]) openers[pill.dataset.for](open);
      caption("[ opens a word ]", pill);
    });
  });

  /* ---------- each project brings its own colours ---------- */
  var sections = Array.prototype.slice.call(document.querySelectorAll(".sec[data-bg]"));
  var meta = document.createElement("meta"); meta.name = "theme-color"; document.head.appendChild(meta);
  function paint(sec) {
    root.style.setProperty("--bg", sec.dataset.bg);
    root.style.setProperty("--fg", sec.dataset.fg);
    root.style.setProperty("--muted", sec.dataset.muted);
    if (sec.dataset.accent) root.style.setProperty("--accent", sec.dataset.accent);
    meta.content = sec.dataset.bg;
  }
  if (sections.length) paint(sections[0]);
  if (sections.length && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) paint(e.target); }); }, { rootMargin: "-48% 0px -48% 0px" });
    sections.forEach(function (s) { io.observe(s); });
  }

  /* ---------- the work plays while it's on screen ---------- */
  var vids = Array.prototype.slice.call(document.querySelectorAll(".media video[data-src]"));
  if (!reduce && "IntersectionObserver" in window) {
    var vio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) { if (!v.src) v.src = v.dataset.src; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else if (!v.paused) v.pause();
      });
    }, { threshold: 0.35 });
    vids.forEach(function (v) { vio.observe(v); });
  }

  /* ---------- the rest: a peek at each cover ---------- */
  var peek = $("#peek");
  if (peek && fine) {
    document.querySelectorAll(".tag[data-img]").forEach(function (a) {
      a.addEventListener("mouseenter", function () { peek.src = a.dataset.img; peek.classList.add("is-on"); });
      a.addEventListener("mouseleave", function () { peek.classList.remove("is-on"); });
      a.addEventListener("mousemove", function (e) {
        var x = Math.min(e.clientX + 24, innerWidth - 316), y = Math.min(e.clientY + 24, innerHeight - 210);
        peek.style.transform = "translate(" + x + "px," + y + "px) rotate(-2deg)";
      });
    });
  }

  /* ================= tributes ================= */

  /* chalk's crayon hand, ported from chalk's crayon.tsx: flat colour, white streaks inside, grain over the lot */
  function rng(seed) { var s = (seed % 2147483646) + 1; return function () { return (s = (s * 16807) % 2147483647) / 2147483647; }; }
  function f(n) { return n.toFixed(1); }
  function hatch(x0, y0, x1, y1, seed, step) {
    var rnd = rng(seed), d = "", h = y1 - y0, dx = h * Math.tan(-0.55);
    for (var x = x0 - Math.abs(dx); x < x1 + Math.abs(dx); x += step * (0.6 + rnd() * 0.9)) {
      var a = 0.15 + rnd() * 0.25, b = 0.55 + rnd() * 0.4;
      d += "M" + f(x + dx * a) + " " + f(y0 + h * a) + " L" + f(x + dx * b) + " " + f(y0 + h * b) + " ";
    }
    return d;
  }
  var uid = 0;
  function shape(d, fill, box, seed, step) {
    var id = "ck" + (uid++);
    return '<g><clipPath id="' + id + '"><path d="' + d + '"/></clipPath><path d="' + d + '" fill="' + fill + '"/><g clip-path="url(#' + id + ')"><path d="' + hatch(box[0], box[1], box[2], box[3], seed, step) + '" stroke="#fff" stroke-opacity=".4" stroke-width="4" stroke-linecap="round" fill="none"/></g></g>';
  }
  function star(cx, cy, r) { var d = ""; for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; d += (i ? "L" : "M") + f(cx + Math.cos(a) * rr) + " " + f(cy + Math.sin(a) * rr); } return d + "Z"; }
  function circle(cx, cy, r) { return "M" + f(cx - r) + " " + f(cy) + " a" + f(r) + " " + f(r) + " 0 1 0 " + f(r * 2) + " 0 a" + f(r) + " " + f(r) + " 0 1 0 " + f(-r * 2) + " 0 Z"; }
  function flower(cx, cy, r) { var d = ""; for (var i = 0; i < 5; i++) { var a = -Math.PI / 2 + (i * 2 * Math.PI) / 5, x = cx + Math.cos(a) * r * 0.5, y = cy + Math.sin(a) * r * 0.5, p = r * 0.52; d += "M" + f(x - p) + " " + f(y) + " a" + f(p) + " " + f(p) + " 0 1 0 " + f(p * 2) + " 0 a" + f(p) + " " + f(p) + " 0 1 0 " + f(-p * 2) + " 0 Z "; } return d; }
  function heart(cx, cy, s) {
    return "M" + f(cx) + " " + f(cy + s * 0.62) + " C" + f(cx - s * 0.98) + " " + f(cy + s * 0.02) + " " + f(cx - s * 0.8) + " " + f(cy - s * 0.72) + " " + f(cx - s * 0.3) + " " + f(cy - s * 0.62) +
      " C" + f(cx - s * 0.1) + " " + f(cy - s * 0.58) + " " + f(cx - s * 0.02) + " " + f(cy - s * 0.42) + " " + f(cx) + " " + f(cy - s * 0.3) +
      " C" + f(cx + s * 0.02) + " " + f(cy - s * 0.42) + " " + f(cx + s * 0.1) + " " + f(cy - s * 0.58) + " " + f(cx + s * 0.3) + " " + f(cy - s * 0.62) +
      " C" + f(cx + s * 0.8) + " " + f(cy - s * 0.72) + " " + f(cx + s * 0.98) + " " + f(cy + s * 0.02) + " " + f(cx) + " " + f(cy + s * 0.62) + " Z";
  }
  var INKS = ["#E86FA0", "#F5B21E", "#3A7FDB", "#E4492A", "#1F8C6E", "#1F43D9"];

  /* ---------- chalk: its nib walks in, points, circles, then draws wherever you click ---------- */
  (function () {
    var sec = $("#chalk"), ink = $("#chalkInk"), nib = $("#cnib"), note = $("#cnibNote");
    if (!sec || !ink || !nib) return;
    var NS = "http://www.w3.org/2000/svg", pos = { x: -80, y: 160 }, follow = false, target = null, doodles = 0;
    function size() { ink.setAttribute("viewBox", "0 0 " + sec.clientWidth + " " + sec.clientHeight); }
    size();
    function to(x, y, ms) { nib.style.transitionDuration = (reduce ? 0 : ms) + "ms"; nib.style.transform = "translate(" + f(x) + "px," + f(y) + "px)"; pos = { x: x, y: y }; }
    function say(t) { note.textContent = t || ""; note.hidden = !t; }
    function stroke(d, colour, width) {
      var p = document.createElementNS(NS, "path");
      p.setAttribute("d", d); p.setAttribute("pathLength", "1"); p.setAttribute("class", "stroke");
      p.setAttribute("stroke", colour); p.setAttribute("stroke-width", width);
      ink.appendChild(p);
      requestAnimationFrame(function () { requestAnimationFrame(function () { p.classList.add("is-drawn"); }); });
      return p;
    }
    function loop(r) {
      // a pen circling a word: hugs it, starts just past where it ends, a touch of tilt
      var cx = r.x + r.w / 2, cy = r.y + r.h / 2, rx = r.w / 2 + 7, ry = r.h / 2 + 1.5, d = "", n = 44, rnd = rng(7), tilt = -0.012;
      for (var i = 0; i <= n; i++) {
        var t = -2.5 + (i / n) * (Math.PI * 2 + 0.26), w = 1 + (rnd() - 0.5) * 0.016;
        var x = Math.cos(t) * rx * w, y = Math.sin(t) * ry * w;
        d += (i ? "L" : "M") + f(cx + x * Math.cos(tilt) - y * Math.sin(tilt)) + " " + f(cy + x * Math.sin(tilt) + y * Math.cos(tilt));
      }
      return d;
    }
    function doodle(x, y) {
      var kind = doodles % 4, c = INKS[doodles % INKS.length], s = 22 + (doodles % 3) * 6, body;
      if (kind === 0) body = shape(star(x, y, s), c, [x - s, y - s, x + s, y + s], 11 + doodles, s * 0.6);
      else if (kind === 1) body = shape(flower(x, y, s), c, [x - s, y - s, x + s, y + s], 11 + doodles, s * 0.3) + shape(circle(x, y, s * 0.18), "#F5B21E", [x - 6, y - 6, x + 6, y + 6], 3, 5);
      else if (kind === 2) body = shape(heart(x, y, s * 1.2), c, [x - s, y - s, x + s, y + s], 11 + doodles, 8);
      else body = shape(circle(x, y, s * 0.8), c, [x - s, y - s, x + s, y + s], 11 + doodles, 7) + shape(circle(x, y, s * 0.3), "#FFFCF6", [x - 8, y - 8, x + 8, y + 8], 4, 5);
      var g = document.createElementNS(NS, "g");
      g.setAttribute("class", "doodle"); g.innerHTML = body;
      ink.appendChild(g);
      requestAnimationFrame(function () { requestAnimationFrame(function () { g.classList.add("is-in"); }); });
      doodles++;
      var all = ink.querySelectorAll(".doodle"); if (all.length > 28) all[0].remove();
    }
    async function tour() {
      var name = $(".name--chalk", sec), pill = $('[data-for="r-point"]', sec), work = $(".work", sec);
      var a = rel(name, sec);
      to(a.x + a.w + 8, a.y + a.h * 0.6, 1100); await sleep(reduce ? 0 : 1150);
      stroke("M" + f(a.x - 2) + " " + f(a.y + a.h + 8) + " Q" + f(a.x + a.w / 2) + " " + f(a.y + a.h + 15) + " " + f(a.x + a.w + 4) + " " + f(a.y + a.h + 5), "#1F8C6E", 5);
      say("hi, that's me"); await sleep(1500);
      var b = rel(pill, sec);
      to(b.x + b.w + 6, b.y + b.h * 0.7, 900); say(""); await sleep(reduce ? 0 : 950);
      stroke(loop(b), "#E4492A", 3.5);
      say("tap this one"); await sleep(1700);
      var c = rel(work, sec);
      to(c.x + c.w * 0.62, c.y + 34, 900); say(""); await sleep(reduce ? 0 : 950);
      say("this is me on a Mac, pointing"); await sleep(2200);
      say(""); follow = fine;
    }
    once(sec, tour, 0.45);
    if (fine && !reduce) {
      sec.addEventListener("pointermove", function (e) { if (!follow) return; var r = sec.getBoundingClientRect(); target = { x: e.clientX - r.left + 18, y: e.clientY - r.top + 14 }; });
      sec.addEventListener("pointerleave", function () { target = null; });
      (function tick() {
        if (follow && target) {
          var x = pos.x + (target.x - pos.x) * 0.12, y = pos.y + (target.y - pos.y) * 0.12;
          nib.style.transitionDuration = "0ms"; nib.style.transform = "translate(" + f(x) + "px," + f(y) + "px)"; pos = { x: x, y: y };
        }
        requestAnimationFrame(tick);
      })();
    }
    sec.addEventListener("click", function (e) {
      if (interactive(e.target)) return;
      var r = sec.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      var was = follow; follow = false;
      to(x + 6, y + 4, 220);
      setTimeout(function () { doodle(x, y); follow = was; }, reduce ? 0 : 200);
    });
    addEventListener("resize", function () { size(); ink.querySelectorAll(".stroke").forEach(function (p) { p.remove(); }); });
  })();

  /* ---------- Redbrick: a wall of empty slots; each click lays the next brick, bottom row first ---------- */
  (function () {
    var sec = $("#redbrick"), wall = $("#wall"), hint = $("#brickHint");
    if (!sec || !wall || !hint) return;
    var REDS = ["#D9734F", "#C9603F", "#E08560", "#BF5636", "#D46A48", "#CC6644"], ROWS = 6, BW = 46, BH = 20, GAP = 4;
    var slots = [], laid = 0;
    function build() {
      wall.innerHTML = ""; slots = []; laid = 0;
      var W = wall.clientWidth;
      for (var r = 0; r < ROWS; r++) {
        for (var x = (r % 2 ? -(BW + GAP) / 2 : 0); x < W; x += BW + GAP) {
          var s = document.createElement("i");
          s.className = "slot"; s.style.left = x + "px"; s.style.bottom = (r * (BH + GAP)) + "px";
          wall.appendChild(s); slots.push(s);
        }
      }
      setHint();
    }
    function setHint() {
      if (laid >= slots.length) {
        hint.innerHTML = 'That&rsquo;s a wall. <a href="https://redbrick.ink" target="_blank" rel="noopener">Walk the real ones ↗</a> · <button type="button" class="hint-btn" data-act="reset">Knock it down</button>';
      } else if (laid === 0) {
        hint.innerHTML = '<button type="button" class="hint-btn" data-act="lay">Lay a brick</button> or ' + press + ' anywhere here';
      } else {
        hint.innerHTML = '<button type="button" class="hint-btn" data-act="lay">Lay another</button> · ' + laid + " of " + slots.length;
      }
    }
    function lay() {
      if (laid >= slots.length) return;
      var s = slots[laid], b = document.createElement("i");
      b.className = "brick is-up"; b.style.left = s.style.left; b.style.bottom = s.style.bottom;
      b.style.setProperty("--c", REDS[(laid * 5 + Math.floor(laid / 7)) % REDS.length]);
      wall.appendChild(b);
      requestAnimationFrame(function () { requestAnimationFrame(function () { b.classList.remove("is-up"); }); });
      laid++; setHint();
    }
    function reset() {
      wall.querySelectorAll(".brick").forEach(function (b, k) { setTimeout(function () { b.classList.add("is-up"); }, reduce ? 0 : k * 4); });
      setTimeout(build, reduce ? 0 : 600);
    }
    hint.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("[data-act]");
      if (!a) return; e.stopPropagation();
      if (a.dataset.act === "lay") lay(); else reset();
    });
    sec.addEventListener("click", function (e) { if (interactive(e.target)) return; lay(); });
    build();
    var w0 = wall.clientWidth;
    addEventListener("resize", function () { if (wall.clientWidth !== w0) { w0 = wall.clientWidth; build(); } });
  })();

  /* ---------- Cohort: it texts you, in one clean thread ---------- */
  (function () {
    var thread = $("#thread");
    if (!thread) return;
    thread.innerHTML = '<div class="thread__head"><img src="assets/img/cohort-icon.png" alt="" /><b>Cohort</b><small>now</small></div><div class="thread__body"></div>';
    var body = $(".thread__body", thread);
    var MSGS = [
      ["them", "hey shay, your CS 204 lecture moved to 3pm in room B12 today. i've already updated your schedule."],
      ["me", "Oh clutch! Thanks!"],
      ["them", "no worries. btw, you haven't submitted your 204 assignment yet. need help with it?"]
    ];
    var playing = false;
    function bubble(who, text) { var b = document.createElement("div"); b.className = "bub bub--" + who; b.textContent = text; body.appendChild(b); return b; }
    async function play() {
      if (playing) return; playing = true; body.innerHTML = "";
      thread.classList.add("is-on");
      for (var i = 0; i < MSGS.length; i++) {
        var m = MSGS[i];
        if (!reduce) {
          if (m[0] === "them") { var t = document.createElement("div"); t.className = "bub bub--them bub--typing"; t.innerHTML = "<i></i><i></i><i></i>"; body.appendChild(t); await sleep(i ? 1100 : 900); t.remove(); }
          else await sleep(900);
        }
        bubble(m[0], m[1]);
        if (!reduce) await sleep(450);
      }
      playing = false;
    }
    once(thread.parentNode, play, 0.55);
    openers["r-msgs"] = function (open) { if (open) play(); };
  })();

  /* ---------- Subtitles: what you're doing, captioned ---------- */
  var cap = $("#caption"), capOn = false, idle, lastY = scrollY, lastCap = 0;
  function caption(text, from) {
    if (!cap || !capOn) return;
    if (from && !from.closest("#subtitles")) return;
    cap.textContent = text; cap.hidden = false; lastCap = Date.now();
    clearTimeout(idle); idle = setTimeout(function () { if (capOn) { cap.textContent = "[ silence ]"; } }, 5200);
  }
  (function () {
    var sec = $("#subtitles");
    if (!sec || !cap || !("IntersectionObserver" in window)) return;
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { capOn = true; caption("[ arrives at Subtitles ]"); }
        else { capOn = false; cap.hidden = true; clearTimeout(idle); }
      });
    }, { rootMargin: "-35% 0px -35% 0px" }).observe(sec);
    addEventListener("scroll", function () {
      if (!capOn) { lastY = scrollY; return; }
      if (Date.now() - lastCap > 1400) caption(scrollY > lastY ? "[ keeps scrolling ]" : "[ scrolls back up ]");
      lastY = scrollY;
    }, { passive: true });
    var media = $("#subMedia"), name = $(".name--subtitles");
    if (media) media.addEventListener("mouseenter", function () { caption("[ watches the video ]", media); });
    if (name) name.addEventListener("mouseenter", function () { caption("[ hovers over the name ]", name); });
    sec.addEventListener("click", function (e) { if (!interactive(e.target)) caption("[ taps the page ]", sec); });
  })();

  /* ---------- Clark: a streak, the way Clark kept one ---------- */
  (function () {
    var el = $("#streakText");
    if (!el) return;
    var n = 1;
    try {
      var today = new Date(), d = function (x) { return x.getFullYear() + "-" + (x.getMonth() + 1) + "-" + x.getDate(); };
      var y = new Date(today); y.setDate(today.getDate() - 1);
      var s = JSON.parse(localStorage.getItem("seyi-streak") || "null");
      if (s && s.last === d(today)) n = s.n;
      else if (s && s.last === d(y)) n = s.n + 1;
      localStorage.setItem("seyi-streak", JSON.stringify({ last: d(today), n: n }));
    } catch (e) { n = 1; }
    el.textContent = n + "-day streak" + (n === 1 ? ". Come back tomorrow." : ". Keep it going.");
  })();

  /* ================= the drawn hand: the name, the nav, the marks and the buttons ================= */
  var SVGNS = "http://www.w3.org/2000/svg", T0 = Date.now();
  // the crayon grains, on pages that don't carry them inline
  // the boil, as chalk draws it: the grain's seeds step through 4 frames every 0.6s, so a drawing redraws its line the
  // way a hand-drawn film does. Drawings only; words stay still. Asked for less motion, the grain holds still.
  var BOIL = reduce ? "" : ['<animate attributeName="seed" values="11;23;37;41" dur="0.6s" calcMode="discrete" repeatCount="indefinite"/>', '<animate attributeName="seed" values="5;9;14;18" dur="0.6s" calcMode="discrete" repeatCount="indefinite"/>'];
  function boil(filter) {
    if (!BOIL || !filter) return;
    var t = filter.querySelectorAll("feTurbulence");
    if (t[0]) t[0].insertAdjacentHTML("beforeend", BOIL[0]);
    if (t[1]) t[1].insertAdjacentHTML("beforeend", BOIL[1]);
  }
  boil(document.getElementById("cr-fill"));
  if (!document.getElementById("cr-mk")) {
    var defs = document.createElementNS(SVGNS, "svg");
    defs.setAttribute("width", "0"); defs.setAttribute("height", "0"); defs.setAttribute("aria-hidden", "true");
    defs.style.position = "absolute";
    defs.innerHTML = '<defs><filter id="cr-mk" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">' +
      '<feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="11" result="n"/>' +
      '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -3.2 0 0 0 2.75" result="m"/>' +
      '<feComposite in="SourceGraphic" in2="m" operator="in" result="t"/>' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="5" result="w"/>' +
      '<feDisplacementMap in="t" in2="w" scale="1.4" xChannelSelector="R" yChannelSelector="G"/></filter></defs>';
    document.body.appendChild(defs);
    boil(document.getElementById("cr-mk"));
  }
  function svgEl(w, h, cls, inner) { return '<svg class="' + cls + '" viewBox="0 0 ' + f(w) + " " + f(h) + '" aria-hidden="true" focusable="false">' + inner + "</svg>"; }
  function streaks(d, box, seed, step, cls, width) {
    var id = "cl" + (uid++);
    return '<clipPath id="' + id + '"><path d="' + d + '"/></clipPath><g clip-path="url(#' + id + ')"><path class="' + cls + '" stroke-width="' + width + '" d="' + hatch(box[0], box[1], box[2], box[3], seed, step) + '"/></g>';
  }
  // a pen's loop round a word: starts past its end, a touch of tilt, overshoots
  function ring(w, h, seed) {
    var cx = w / 2, cy = h / 2, rx = w / 2 - 3, ry = h / 2 - 3, d = "", n = 40, rnd = rng(seed || 7), tilt = -0.03;
    for (var i = 0; i <= n; i++) {
      var t = -2.6 + (i / n) * (Math.PI * 2 + 0.32), k = 1 + (rnd() - 0.5) * 0.03;
      var x = Math.cos(t) * rx * k, y = Math.sin(t) * ry * k;
      d += (i ? "L" : "M") + f(cx + x * Math.cos(tilt) - y * Math.sin(tilt)) + " " + f(cy + x * Math.sin(tilt) + y * Math.cos(tilt));
    }
    return d;
  }
  function wave(w, h) { var y = h / 2, q = (w - 4) / 4; return "M2 " + f(y + 1) + " Q" + f(2 + q / 2) + " " + f(y - 2.4) + " " + f(2 + q) + " " + f(y + .6) + " T" + f(2 + 2 * q) + " " + f(y + .6) + " T" + f(2 + 3 * q) + " " + f(y + .6) + " T" + f(w - 2) + " " + f(y); }
  function marks(el) {
    if (!el) return;
    el.querySelectorAll(".loop, .ul").forEach(function (x) { x.remove(); });
    var w = el.offsetWidth, h = el.offsetHeight;
    if (!w) return;
    el.insertAdjacentHTML("beforeend",
      svgEl(w + 26, h + 17, "loop", '<path class="ink-accent" pathLength="1" d="' + ring(w + 26, h + 17, w) + '"/>') +
      svgEl(w + 4, 8, "ul", '<path class="ink-accent" pathLength="1" d="' + wave(w + 4, 8) + '"/>'));
  }
  // the name: a crayon flower, and a swoosh under it
  var name = $(".top__name");
  if (name && !name.querySelector(".spark")) {
    var label = name.textContent.trim();
    name.innerHTML = svgEl(40, 40, "spark", '<g filter="url(#cr-mk)"><path class="fill-accent" d="' + flower(20, 20, 19) + '"/>' + streaks(flower(20, 20, 19), [0, 0, 40, 40], 9, 6.5, "mk__s", 2.6) + "</g>" +
      '<path fill="#FFFCF6" d="' + circle(20, 20, 3.9) + '"/>') + '<span class="top__label">' + label + "</span>";
    name.setAttribute("aria-label", label);
  }
  function swoosh() {
    if (!name) return;
    var old = name.querySelector(".swoosh"); if (old) old.remove();
    var t = name.querySelector(".top__label"), w = t ? t.offsetWidth + 6 : 120;
    name.insertAdjacentHTML("beforeend", svgEl(w, 11, "swoosh", '<path class="ink-accent" pathLength="1" d="M2 7.4 C' + f(w * .28) + " 3.2 " + f(w * .62) + " 9.6 " + f(w - 2) + ' 4.2"/>'));
    // redrawn after it has finished drawing in (fonts arriving late, a resize): it simply stays drawn
    if (Date.now() - T0 > 1300) { var sp = name.querySelector(".swoosh path"); sp.style.animation = "none"; sp.style.strokeDashoffset = "0"; }
  }
  // crayon marks: <span class="mk" data-mk="star" style="--mk:#hex">
  var MARK = {
    star: function () { return { d: star(20, 20, 19) }; },
    flower: function () { return { d: flower(20, 20, 19), c: circle(20, 20, 3.8) }; },
    daisy: function () { var d = ""; for (var i = 0; i < 12; i++) { var a = (i * 2 * Math.PI) / 12, x = 20 + Math.cos(a) * 11.8, y = 20 + Math.sin(a) * 11.8, rx = 8, ry = 3.3, c = Math.cos(a), sn = Math.sin(a), deg = f(a * 180 / Math.PI); d += "M" + f(x - c * rx) + " " + f(y - sn * rx) + " A" + rx + " " + ry + " " + deg + " 1 1 " + f(x + c * rx) + " " + f(y + sn * rx) + " A" + rx + " " + ry + " " + deg + " 1 1 " + f(x - c * rx) + " " + f(y - sn * rx) + " Z "; } return { d: d, c: circle(20, 20, 5.4) }; },
    heart: function () { return { d: heart(20, 21.5, 21) }; },
    blob: function () { return { d: "M11 5 H30 Q36 5 36 11.5 V28 Q36 35 29 35 H10.5 Q4.5 35 4.5 29 V12 Q4.5 5 11 5 Z" }; },
    ring: function () { return { d: circle(20, 20, 17), c: circle(20, 20, 6.5), hole: true }; },
    drop: function () { return { d: "M20 2.5 C24 10 31.5 16 31.5 24.5 A11.5 11.5 0 1 1 8.5 24.5 C8.5 16 16 10 20 2.5 Z" }; },
    cloud: function () { return { d: "M8.6 30 C3.5 30 2.8 21.8 8.4 21 C8.2 15.2 14.8 12.6 18.4 16.2 C20 9.4 30.6 9.2 31.4 17.2 C37.6 16.4 39.4 25 34.2 28.6 C33.4 30 32.6 30 31.6 30 Z" }; }
  };
  document.querySelectorAll(".mk[data-mk]").forEach(function (el, i) {
    var m = (MARK[el.dataset.mk] || MARK.star)(), seed = 30 + i * 7;
    var inner = '<g filter="url(#cr-mk)"><path class="mk__f" d="' + m.d + '"/>' + streaks(m.d, [0, 0, 40, 40], seed, 6.5, "mk__s", 2.6) + "</g>";
    if (m.c) inner += '<path class="' + (m.hole ? "mk__h" : "mk__c") + '" style="' + (m.hole ? "fill:var(--bg)" : (el.dataset.mkc ? "fill:" + el.dataset.mkc : "")) + '" d="' + m.c + '"/>';
    el.innerHTML = svgEl(40, 40, "", inner);
  });
  // buttons: wax streaks across, a drawn arrow
  function wax(b) {
    var old = b.querySelector(".btn__wax"); if (old) old.remove();
    var w = b.offsetWidth, h = b.offsetHeight; if (!w) return;
    b.insertAdjacentHTML("afterbegin", svgEl(w, h, "btn__wax", '<path d="' + hatch(0, 0, w, h, 17, 15) + '"/>'));
  }
  var btns = Array.prototype.slice.call(document.querySelectorAll(".btn"));
  btns.forEach(function (b) {
    var arrow = b.querySelector('[aria-hidden="true"]'); if (arrow) arrow.remove();
    b.innerHTML = '<span class="btn__t">' + b.innerHTML.trim() + "</span>" + svgEl(28, 16, "btn__arrow", '<path d="M2 8.7 C9 7.9 16 8.5 25.2 7.7 M19 2.4 C21.2 4.7 23.2 6.4 25.6 7.7 C23.3 9.1 21.4 11 19.3 13.7"/>');
  });
  var drawnTargets = Array.prototype.slice.call(document.querySelectorAll(".top__nav a, .filters button"));
  function drawAll() { drawnTargets.forEach(marks); swoosh(); btns.forEach(wax); }
  drawAll();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawAll);
  var rz; addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(drawAll, 150); });
})();
