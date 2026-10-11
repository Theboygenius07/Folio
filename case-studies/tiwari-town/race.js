/* Fig. 8: racing a friend, live.

     net/RaceProtocol.ts:597-616, 687    note 7 (ready is a pre-arm handshake), LOBBY_MS = 10 000
     worker/src/race.ts:369-478          onArm, onReady (everyone ready?), fireStart (startAt = now + LOBBY_MS)
     gameplay/BoatRace.ts:84-111         COUNTDOWN 6, SHARED_COUNTDOWN 10, READY_TIMEOUT 15
     gameplay/BoatRace.ts:201-226        the fleet's names and start grid
     world/vistas/KielOffshore.ts:69-120 START, CHECKPOINTS, the 660 m course

   The handshake is rebuilt as a small state machine with those numbers; messages take
   280 ms a hop, inside the 211 to 336 ms median the protocol notes measured. The boats
   only follow the gates on a smooth path. They are not the game's physics. */
import { makeRng, WORLD_SEED } from "./world.js";
import { Study, s, txt, fitSvg, tabs, readout } from "./util.js";

const LOBBY_MS = 10_000, READY_TIMEOUT = 15, HOP = 0.28, SPEEDUP = 4;
const START = { r: 88, halfS: 18 };
const CHECKPOINTS = [
  { r: 178, s: -46, width: 62, label: "Gate 1" },
  { r: 298, s: 34, width: 66, label: "Gate 2" },
  { r: 424, s: -30, width: 70, label: "Gate 3" },
  { r: 548, s: 46, width: 74, label: "Gate 4" },
  { r: 660, s: 0, width: 90, label: "Finish" },
];
const KIEL_PIER = { rootR: 36, headR: 69, halfWidth: 1.85, headHalfWidth: 3.3, headFrom: 63.5 };
const FLEET = [
  { name: "Seeadler", c: "#e4553f", at: { r: 92, s: -11 } }, { name: "Nordwind", c: "#2f7fbf", at: { r: 92, s: 0 } },
  { name: "Möwe", c: "#3f9c6a", at: { r: 92, s: 11 } }, { name: "Fördeblick", c: "#f0b429", at: { r: 83, s: -5.5 } },
  { name: "Sturmvogel", c: "#d8477f", at: { r: 83, s: 5.5 } },
];

export function mountRace(fig) {
  const seqSvg = fig.querySelector(".rc-seq");
  const courseSvg = fig.querySelector(".rc-course");
  const btnHer = fig.querySelector('[data-act="her"]');
  const btnFriend = fig.querySelector('[data-act="friend"]');
  const btnReset = fig.querySelector('[data-act="reset"]');
  const rd = readout(fig);
  const tint = getComputedStyle(document.body).getPropertyValue("--tint").trim() || "#4a9fe0";
  const tintInk = getComputedStyle(document.body).getPropertyValue("--tint-ink").trim() || "#2a6db0";
  const ink = "#1d1b18", ink2 = "#67625a", ink3 = "#9a958b", rule = "#e0dbd0";

  let mode = "ready";
  let T, room, her, friend, log, flights, boats, raceT, results;
  let SQ = null, CS = null;
  const R0 = 30, R1 = 690, S0 = -100, S1 = 100;

  /* ---------------- the room and the two clients ---------------- */
  function reset() {
    T = 0; raceT = -1; results = [];
    room = { phase: "open", startAt: null, ready: { her: false, friend: false }, entered: { her: false, friend: false } };
    her = { picked: false, state: "choosing", waitUntil: null, startAt: null, armed: false };
    friend = { picked: false, state: "choosing", waitUntil: null, startAt: null, armed: false };
    log = []; flights = [];
    boats = makeBoats();
    btnHer.disabled = false; btnFriend.disabled = false;
    drawSeq(); drawCourse(); paintReadout();
  }
  const who = (k) => (k === "her" ? her : friend);
  const otherKey = (k) => (k === "her" ? "friend" : "her");

  /** a message in flight: it lands HOP seconds later, then does its job */
  function send(from, to, label, onArrive) {
    const m = { from, to, label, t0: T, t1: T + HOP, onArrive, row: null };
    flights.push(m);
    addRow(m);
  }
  function note(lane, text) { addRow({ note: text, lane, t0: T }); }
  function addRow(item) {
    // the relay's fan-out shares a row with its twin
    const last = log[log.length - 1];
    if (item.from === "relay" && last && last.from === "relay" && last.label === item.label && Math.abs(last.t0 - item.t0) < 1e-6) { last.twin = item; item.row = last.row; return; }
    item.row = (log.length ? log[log.length - 1].row : -1) + 1;
    log.push(item);
  }

  function pick(k) {
    const c = who(k);
    if (c.picked) return;
    c.picked = true;
    (k === "her" ? btnHer : btnFriend).disabled = true;
    if (room.phase === "racing") { c.state = "racing, late"; boats[k].go = raceT; return; }
    if (mode === "arm") {
      // start on pick: picking a boat called a start, unconditionally (RaceProtocol.ts note 7)
      c.state = room.phase === "countdown" ? "in the countdown" : "armed";
      send(k, "relay", "arm", () => relayArm());
      return;
    }
    // wait for everyone: picking a boat says ready, and waits for the others (BoatRace.ts:97-111)
    if (room.phase === "countdown") { c.state = "in the countdown"; return; }
    c.state = "ready";
    send(k, "relay", "ready {on: true}", () => relayReady(k));
    // only spent when someone else is already on the water, which here they always are
    c.waitUntil = T + READY_TIMEOUT;
  }
  /* worker/src/race.ts:382-397 */
  function relayArm() {
    if (room.phase !== "open") { note("relay", "already counting: resends start"); return; }
    fireStart("arm: go now, ready or not");
  }
  /* worker/src/race.ts:411-441 */
  function relayReady(k) {
    room.ready[k] = true;
    send("relay", "her", "peers", null); send("relay", "friend", "peers", null);
    if (room.phase !== "open") return;
    const everyoneReady = room.ready.her && room.ready.friend;
    if (everyoneReady) fireStart("everyone ready: start");
    else note("relay", `waiting on ${k === "her" ? "her friend" : "her"}`);
  }
  /* worker/src/race.ts:449-478 */
  function fireStart(why) {
    room.phase = "countdown";
    room.startAt = T + LOBBY_MS / 1000;
    room.entered = { her: true, friend: true };
    room.ready = { her: false, friend: false }; // readiness is spent the moment it is used
    note("relay", why);
    for (const k of ["her", "friend"]) send("relay", k, "start {startAt}", () => {
      const c = who(k);
      c.startAt = room.startAt; c.waitUntil = null;
      c.state = c.picked ? "in the countdown" : "counting, still choosing";
    });
  }

  function tick(dt) {
    T += dt;
    // deliver what has landed
    for (const m of flights) if (!m.done && T >= m.t1) { m.done = true; m.onArrive && m.onArrive(); }
    // a friend who never readies up: give up waiting and call the start (BoatRace.ts:97-111)
    for (const k of ["her", "friend"]) {
      const c = who(k);
      if (c.waitUntil !== null && T >= c.waitUntil && room.phase === "open") {
        c.waitUntil = null; c.state = "armed";
        send(k, "relay", "arm (gave up waiting)", () => relayArm());
      }
    }
    // the gun, on the server's clock, for everyone at once
    if (room.phase === "countdown" && T >= room.startAt) {
      room.phase = "racing"; raceT = 0;
      note("relay", "the gun");
      for (const k of ["her", "friend"]) {
        const c = who(k);
        c.state = c.picked ? "racing" : "entered, still choosing";
        if (c.picked) boats[k].go = 0;
      }
      boats.fleet.forEach((b) => (b.go = 0));
    }
    if (raceT >= 0) {
      raceT += dt * SPEEDUP;
      for (const b of allBoats()) {
        if (b.go === null || b.go === undefined || b.done) continue;
        b.d = Math.max(0, (raceT - b.go) * b.v);
        if (b.d >= b.len) { b.d = b.len; b.done = true; results.push(b); if (b.key) who(b.key).state = `finished ${ordinal(results.length)}`; }
      }
    }
  }
  const ordinal = (n) => n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");

  /* ---------------- boats on a smooth line through the gates ---------------- */
  function makeBoats() {
    const rng = makeRng(WORLD_SEED ^ 0x7a00);
    const mk = (at, v, c, name, key) => {
      const pts = [at, { r: START.r + 6, s: at.s * 0.6 }, ...CHECKPOINTS.map((g) => ({ r: g.r, s: g.s + (rng() - 0.5) * g.width * 0.5 }))];
      const path = sample(pts);
      return { key, name, c, path, len: path[path.length - 1].d, d: 0, v, go: null, done: false };
    };
    return {
      her: mk({ r: 74, s: -4 }, 15.2, tintInk, "Her", "her"),
      friend: mk({ r: 74, s: 4 }, 15.0, tint, "Friend", "friend"),
      fleet: FLEET.map((f) => mk(f.at, 13.4 + rng() * 1.6, f.c, f.name, null)),
    };
  }
  const allBoats = () => [boats.her, boats.friend, ...boats.fleet];
  /* Catmull-Rom through the points, sampled by distance */
  function sample(pts) {
    const out = [];
    let d = 0, prev = null;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let k = 0; k < 24; k++) {
        const t = k / 24, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, e) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - e) * t2 + (-a + 3 * b - 3 * c + e) * t3);
        const p = { r: f(p0.r, p1.r, p2.r, p3.r), s: f(p0.s, p1.s, p2.s, p3.s) };
        if (prev) d += Math.hypot(p.r - prev.r, p.s - prev.s);
        p.d = d; out.push(p); prev = p;
      }
    }
    const last = pts[pts.length - 1];
    d += Math.hypot(last.r - prev.r, last.s - prev.s);
    out.push({ ...last, d });
    return out;
  }
  function posAt(b) {
    const P = b.path;
    let lo = 0, hi = P.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (P[mid].d < b.d) lo = mid; else hi = mid; }
    const a = P[lo], c = P[hi], k = c.d > a.d ? (b.d - a.d) / (c.d - a.d) : 0;
    return { r: a.r + (c.r - a.r) * k, s: a.s + (c.s - a.s) * k, h: Math.atan2(c.s - a.s, c.r - a.r) };
  }

  reset();

  /* ---------------- the sequence diagram ---------------- */
  fitSvg(seqSvg, (w) => (w < 560 ? 350 : 330), (w, h) => {
    seqSvg.textContent = "";
    const narrow = w < 560;
    const lanes = { her: w * (narrow ? 0.13 : 0.1), relay: w * 0.5, friend: w * (narrow ? 0.87 : 0.9) };
    const names = { her: "Her", relay: narrow ? "The relay" : "The relay, a Durable Object", friend: narrow ? "Her friend" : "Her friend" };
    for (const k of ["her", "relay", "friend"]) {
      txt(seqSvg, lanes[k], 14, names[k], { "text-anchor": "middle", fill: ink, "font-size": 13, "font-weight": 600, style: "font-family: var(--font)" });
      s("line", { x1: lanes[k], x2: lanes[k], y1: 58, y2: h - 4, stroke: k === "relay" ? ink3 : rule, "stroke-width": k === "relay" ? 1.5 : 1, "stroke-dasharray": "3 4" }, seqSvg);
    }
    const st = {};
    for (const k of ["her", "relay", "friend"]) st[k] = [
      txt(seqSvg, lanes[k], 33, "", { "text-anchor": "middle", fill: tintInk, "font-size": narrow ? 11 : 12, "font-weight": 600, style: "font-family: var(--mono)" }),
      txt(seqSvg, lanes[k], 48, "", { "text-anchor": "middle", fill: ink2, "font-size": narrow ? 11 : 12, style: "font-family: var(--mono)" }),
    ];
    const rows = s("g", {}, seqSvg);
    SQ = { w, h, lanes, st, rows, narrow, rowH: 29, top: 80 };
    drawSeq();
  });
  /** [what this client is doing, its clock] */
  function laneState(c) {
    if (c.waitUntil !== null && room.phase === "open") return ["ready, waiting", `gives up in ${Math.max(0, c.waitUntil - T).toFixed(1)} s`];
    if (c.startAt !== null && room.phase === "countdown") return [c.picked ? "in the countdown" : "still choosing", `gun in ${Math.max(0, c.startAt - T).toFixed(1)} s`];
    return [c.state, ""];
  }
  function roomState() { return room.phase === "countdown" ? ["countdown", `gun in ${Math.max(0, room.startAt - T).toFixed(1)} s`] : [room.phase, ""]; }
  function drawSeq() {
    if (!SQ || !room) return;
    const { lanes, st, rows, rowH, top, h, narrow } = SQ;
    const put = (pair, v) => { if (pair[0].textContent !== v[0]) pair[0].textContent = v[0]; if (pair[1].textContent !== v[1]) pair[1].textContent = v[1]; };
    put(st.her, laneState(her)); put(st.friend, laneState(friend)); put(st.relay, roomState());
    rows.textContent = "";
    const maxRows = Math.floor((h - top) / rowH);
    const lastRow = log.length ? log[log.length - 1].row : 0;
    const first = Math.max(0, lastRow - maxRows + 1);
    if (!log.length) {
      txt(rows, lanes.relay, top + 18, "Both are connected. Pick a boat on either side.", { "text-anchor": "middle", class: "ann", "font-size": 12 });
    }
    for (const item of log) {
      if (item.row < first) continue;
      const y = top + (item.row - first) * rowH;
      if (item.note) {
        txt(rows, lanes[item.lane], y + 4, item.note, { "text-anchor": "middle", fill: ink2, "font-size": narrow ? 11 : 12, style: "font-family: var(--mono)", "paint-order": "stroke", stroke: "#f3f1ea", "stroke-width": 5 });
        continue;
      }
      for (const m of item.twin ? [item, item.twin] : [item]) {
        const x0 = lanes[m.from], x1 = lanes[m.to];
        const k = Math.min(1, Math.max(0, (T - m.t0) / (m.t1 - m.t0)));
        const xe = x0 + (x1 - x0) * k, dir = Math.sign(x1 - x0);
        s("line", { x1: x0, x2: xe, y1: y, y2: y, stroke: m.from === "relay" ? ink2 : tintInk, "stroke-width": 1.5 }, rows);
        s("path", { d: `M${xe} ${y} l${-dir * 7} -4 l0 8 z`, fill: m.from === "relay" ? ink2 : tintInk }, rows);
        if (!item.twin || m === item) {
          const lx = item.twin ? lanes.relay + (lanes.friend - lanes.relay) / 2 : (x0 + x1) / 2;
          txt(rows, lx, y - 6, m.label, { "text-anchor": "middle", fill: ink, "font-size": narrow ? 11 : 12, style: "font-family: var(--mono)" });
          if (item.twin) txt(rows, lanes.relay - (lanes.friend - lanes.relay) / 2, y - 6, m.label, { "text-anchor": "middle", fill: ink, "font-size": narrow ? 11 : 12, style: "font-family: var(--mono)" });
        }
      }
    }
  }

  /* ---------------- the course ---------------- */
  fitSvg(courseSvg, (w) => Math.round(Math.max(150, ((S1 - S0) / (R1 - R0)) * w + (w < 560 ? 76 : 52))), (w, h) => {
    courseSvg.textContent = "";
    const pad = 20, ph = h - (w < 560 ? 76 : 52) - 6;
    const X = (r) => ((r - R0) / (R1 - R0)) * w;
    const Y = (sv) => pad + ((S1 - sv) / (S1 - S0)) * ph;
    // the jetty
    s("rect", { x: X(KIEL_PIER.rootR), y: Y(KIEL_PIER.halfWidth), width: X(KIEL_PIER.headFrom) - X(KIEL_PIER.rootR), height: Y(-KIEL_PIER.halfWidth) - Y(KIEL_PIER.halfWidth), fill: "#c9b48f" }, courseSvg);
    s("rect", { x: X(KIEL_PIER.headFrom), y: Y(KIEL_PIER.headHalfWidth), width: X(KIEL_PIER.headR) - X(KIEL_PIER.headFrom), height: Y(-KIEL_PIER.headHalfWidth) - Y(KIEL_PIER.headHalfWidth), fill: "#c9b48f" }, courseSvg);
    txt(courseSvg, X(KIEL_PIER.rootR), Y(0) + 22, "the jetty", { class: "ann", "font-size": 11 });
    // the line the boats aim along
    let d = `M${X(START.r)} ${Y(0)}`;
    for (const g of CHECKPOINTS) d += ` L${X(g.r)} ${Y(g.s)}`;
    s("path", { d, fill: "none", stroke: rule, "stroke-width": 1.5, "stroke-dasharray": "5 5" }, courseSvg);
    // the start line, and the five gates you drive through
    s("line", { x1: X(START.r), x2: X(START.r), y1: Y(START.halfS), y2: Y(-START.halfS), stroke: ink, "stroke-width": 2 }, courseSvg);
    txt(courseSvg, X(START.r) + 4, Y(START.halfS) - 6, "start, 36 m", { class: "ann", "font-size": 11 });
    for (const g of CHECKPOINTS) {
      const y0 = Y(g.s + g.width / 2), y1 = Y(g.s - g.width / 2);
      s("line", { x1: X(g.r), x2: X(g.r), y1: y0, y2: y1, stroke: ink3, "stroke-width": 1, "stroke-dasharray": "2 3" }, courseSvg);
      for (const yy of [y0, y1]) s("rect", { x: X(g.r) - 3, y: yy - 3, width: 6, height: 6, fill: ink }, courseSvg);
      const above = g.s >= 0;
      txt(courseSvg, X(g.r), above ? y0 - 8 : y1 + 16, w < 560 ? g.label.replace("Gate ", "") : `${g.label}, ${g.width} m`, { "text-anchor": g.label === "Finish" ? "end" : "middle", class: "ann", "font-size": 11 });
    }
    const boatG = s("g", {}, courseSvg);
    const marks = allBoats().map((b) => {
      const g = s("g", {}, boatG);
      s("path", { d: "M7 0 L-5 -4 L-5 4 Z", fill: b.c, stroke: "#f3f1ea", "stroke-width": 1 }, g);
      return { b, g };
    });
    // a key, under the water
    const narrow = w < 560, ky = narrow ? h - 26 : h - 6;
    let kx = 0;
    for (const [c, label] of [[tintInk, "her"], [tint, "her friend"], ["#e4553f", narrow ? "the other 5" : "the 5 boats already in the harbour"]]) {
      s("path", { d: `M${kx + 10} ${ky - 4} L${kx} ${ky - 8} L${kx} ${ky} Z`, fill: c }, courseSvg);
      txt(courseSvg, kx + 15, ky, label, { class: "ann", "font-size": 11.5 });
      kx += 15 + label.length * 6.4 + 16;
    }
    const res = txt(courseSvg, w, h - 6, "", { "text-anchor": "end", class: "ann", "font-size": 11.5, fill: ink });
    CS = { X, Y, marks, res, w };
    drawCourse();
  });
  function drawCourse() {
    if (!CS || !boats) return;
    const { X, Y, marks, res } = CS;
    marks.forEach((m) => {
      if (m.b !== boats.her && m.b !== boats.friend && !boats.fleet.includes(m.b)) return;
    });
    // boats change on reset; rebind by index
    const list = allBoats();
    marks.forEach((m, i) => {
      const b = list[i];
      m.b = b;
      const p = posAt(b);
      m.g.setAttribute("transform", `translate(${X(p.r).toFixed(1)} ${Y(p.s).toFixed(1)}) rotate(${(-p.h * 180) / Math.PI})`);
    });
    if (results.length) {
      const pos = (k) => results.findIndex((b) => b.key === k) + 1;
      const hp = pos("her"), fp = pos("friend");
      res.textContent = raceT >= 0 ? `race time ×4: ${(raceT / 1).toFixed(0)} s${hp ? `   her: ${ordinal(hp)}` : ""}${fp ? `   friend: ${ordinal(fp)}` : ""}` : "";
    } else res.textContent = raceT >= 0 ? `racing, ${raceT.toFixed(0)} s on the water` : "";
  }

  function paintReadout() {
    rd("phase", room.phase);
    rd("her", laneState(her).filter(Boolean).join(", "));
    rd("friend", laneState(friend).filter(Boolean).join(", "));
    rd("gun", room.startAt === null ? "not set" : room.phase === "countdown" ? `in ${Math.max(0, room.startAt - T).toFixed(1)} s` : "fired");
  }

  /* ---------------- the loop: only while something is happening ---------------- */
  let stop = null, visible = false;
  const busy = () => flights.some((m) => !m.done) || room.phase === "countdown" || her.waitUntil !== null || friend.waitUntil !== null || (raceT >= 0 && allBoats().some((b) => !b.done && b.go !== null && b.go !== undefined)) || (raceT >= 0 && raceT < 2);
  const loop = (t, dt) => {
    tick(dt);
    drawSeq(); drawCourse(); paintReadout();
    if (!busy()) { stop = null; return false; }
  };
  const wake = () => { if (visible && !stop) stop = Study.raf(loop); };

  btnHer.addEventListener("click", () => { pick("her"); wake(); drawSeq(); });
  btnFriend.addEventListener("click", () => { pick("friend"); wake(); drawSeq(); });
  btnReset.addEventListener("click", () => { reset(); });
  tabs(fig.querySelector('[aria-label="Which version of the start"]'), "data-mode", (v) => { mode = v; reset(); });

  reset();
  return {
    start() { visible = true; wake(); },
    stop() { visible = false; stop && stop(); stop = null; },
  };
}
