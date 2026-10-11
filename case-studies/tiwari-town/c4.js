/* Fig. 7: Connect 4 in the garden.

     gameplay/ConnectFourGame.ts:15-178   the rules: column-major grid, row 0 at the bottom
     gameplay/ConnectFourAI.ts:57-398     negamax, alpha-beta, iterative deepening, a time budget
     gameplay/ConnectFour.ts:97-101,444   the board's colours, and the seed its opponent rolls from

   Ported whole. The only addition is that bestMove also hands back each root move's score,
   so the figure can draw what the engine thinks of each column. */
import { makeRng, WORLD_SEED } from "./world.js";
import { Study, s, txt, tabs, readout, comma } from "./util.js";

/* ---------------- ConnectFourGame.ts ---------------- */
const COLS = 7, ROWS = 6;
const other = (side) => (side === 1 ? 2 : 1);
function landingRow(g, col) {
  if (col < 0 || col >= COLS) return -1;
  for (let r = 0; r < ROWS; r++) if (g[col * ROWS + r] === 0) return r;
  return -1;
}
const GDIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
function winningLine(g, col, row, side) {
  for (const [dc, dr] of GDIRS) {
    const run = [{ col, row }];
    for (const sign of [1, -1]) {
      let c = col + dc * sign, r = row + dr * sign;
      while (c >= 0 && c < COLS && r >= 0 && r < ROWS && g[c * ROWS + r] === side) {
        if (sign > 0) run.push({ col: c, row: r }); else run.unshift({ col: c, row: r });
        c += dc * sign; r += dr * sign;
      }
    }
    if (run.length >= 4) return run;
  }
  return null;
}
class ConnectFourGame {
  constructor() { this.reset(); }
  get turn() { return this.side; }
  get isDraw() { return this.won === null && this.placed >= COLS * ROWS; }
  get isOver() { return this.won !== null || this.isDraw; }
  cell(col, row) { return this.cells[col * ROWS + row]; }
  legalColumns() { const out = []; if (this.isOver) return out; for (let c = 0; c < COLS; c++) if (landingRow(this.cells, c) >= 0) out.push(c); return out; }
  snapshot() { return this.cells.slice(); }
  drop(col) {
    if (this.isOver) return null;
    const row = landingRow(this.cells, col);
    if (row < 0) return null;
    const side = this.side;
    this.cells[col * ROWS + row] = side; this.placed++;
    const line = winningLine(this.cells, col, row, side);
    if (line) { this.won = side; this.run = line; } else this.side = other(side);
    return { col, row, side, winner: this.won, line, draw: this.isDraw };
  }
  reset() { this.cells = new Int8Array(COLS * ROWS); this.placed = 0; this.side = 1; this.won = null; this.run = null; }
}

/* ---------------- ConnectFourAI.ts ---------------- */
const LEVELS = {
  easy: { maxDepth: 2, budgetMs: 12, slip: 0.35 },
  medium: { maxDepth: 6, budgetMs: 45, slip: 0.12 },
  hard: { maxDepth: 11, budgetMs: 150, slip: 0.02 },
  ruthless: { maxDepth: 20, budgetMs: 420, slip: 0 },
};
const WIN_SCORE = 1_000_000;
const cells = new Int8Array(COLS * ROWS), heights = new Int8Array(COLS);
let placed = 0;
const idx = (col, row) => col * ROWS + row;
const DIRS = [[1, 0], [1, 1], [1, -1]];
function wins(col, row, side) {
  if (row >= 3 && cells[idx(col, row - 1)] === side && cells[idx(col, row - 2)] === side && cells[idx(col, row - 3)] === side) return true;
  for (const [dc, dr] of DIRS) {
    let run = 1;
    for (const sign of [1, -1]) {
      let c = col + dc * sign, r = row + dr * sign;
      while (c >= 0 && c < COLS && r >= 0 && r < ROWS && cells[idx(c, r)] === side) {
        run++; if (run >= 4) return true;
        c += dc * sign; r += dr * sign;
      }
    }
  }
  return false;
}
const WINDOWS = (() => {
  const out = [];
  const push = (a) => out.push(Int8Array.from(a));
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    if (c + 3 < COLS) push([idx(c, r), idx(c + 1, r), idx(c + 2, r), idx(c + 3, r)]);
    if (r + 3 < ROWS) push([idx(c, r), idx(c, r + 1), idx(c, r + 2), idx(c, r + 3)]);
    if (c + 3 < COLS && r + 3 < ROWS) push([idx(c, r), idx(c + 1, r + 1), idx(c + 2, r + 2), idx(c + 3, r + 3)]);
    if (c + 3 < COLS && r - 3 >= 0) push([idx(c, r), idx(c + 1, r - 1), idx(c + 2, r - 2), idx(c + 3, r - 3)]);
  }
  return out;
})();
const RUN_VALUE = [0, 1, 12, 90, WIN_SCORE];
const CENTRE_BONUS = 6;
function evaluate(side) {
  const foe = other(side);
  let score = 0;
  for (const w of WINDOWS) {
    let mine = 0, theirs = 0;
    for (let i = 0; i < 4; i++) { const v = cells[w[i]]; if (v === side) mine++; else if (v === foe) theirs++; }
    if (mine > 0 && theirs > 0) continue;
    if (mine > 0) score += RUN_VALUE[mine]; else if (theirs > 0) score -= RUN_VALUE[theirs];
  }
  const mid = (COLS - 1) / 2;
  for (let r = 0; r < ROWS; r++) { const v = cells[idx(mid, r)]; if (v === side) score += CENTRE_BONUS; else if (v === foe) score -= CENTRE_BONUS; }
  return score;
}
const BASE_ORDER = [3, 2, 4, 1, 5, 0, 6];
let deadline = 0, nodes = 0, aborted = false;
function search(depth, alpha, beta, side) {
  if ((++nodes & 1023) === 0 && performance.now() > deadline) { aborted = true; return 0; }
  const foe = other(side);
  let best = -Infinity, any = false;
  for (const col of BASE_ORDER) {
    const row = heights[col];
    if (row >= ROWS) continue;
    any = true;
    cells[idx(col, row)] = side; heights[col]++; placed++;
    let score;
    if (wins(col, row, side)) score = WIN_SCORE - placed;
    else if (placed === COLS * ROWS) score = 0;
    else if (depth <= 1) score = evaluate(side);
    else score = -search(depth - 1, -beta, -alpha, foe);
    cells[idx(col, row)] = 0; heights[col]--; placed--;
    if (aborted) return 0;
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return any ? best : 0;
}
function load(game) {
  const grid = game.snapshot();
  cells.set(grid); placed = 0;
  for (let c = 0; c < COLS; c++) { let h = 0; while (h < ROWS && grid[idx(c, h)] !== 0) h++; heights[c] = h; placed += h; }
}
function mustBlock(game, me) {
  const foe = other(me);
  load(game);
  for (const col of game.legalColumns()) {
    const row = heights[col];
    cells[idx(col, row)] = foe;
    const threat = wins(col, row, foe);
    cells[idx(col, row)] = 0;
    if (threat) return true;
  }
  return false;
}
function bestMove(game, me, rng, difficulty = "hard") {
  const level = LEVELS[difficulty];
  const legal = game.legalColumns();
  if (legal.length === 0) return { col: -1, depth: 0, nodes: 0, score: 0, scores: new Map() };
  if (legal.length === 1) return { col: legal[0], depth: 0, nodes: 0, score: 0, scores: new Map() };
  load(game);
  nodes = 0; aborted = false;
  deadline = performance.now() + level.budgetMs;
  let chosen = legal[0], chosenScore = 0, reached = 0, lastScores = new Map();
  let order = BASE_ORDER.filter((c) => legal.includes(c));
  for (let depth = 1; depth <= level.maxDepth; depth++) {
    const scores = new Map();
    let alpha = -Infinity, bestCol = order[0];
    for (const col of order) {
      const row = heights[col];
      cells[idx(col, row)] = me; heights[col]++; placed++;
      let score;
      if (wins(col, row, me)) score = WIN_SCORE - placed;
      else if (placed === COLS * ROWS) score = 0;
      else score = -search(depth, -Infinity, Infinity, other(me)); // full window at the root, ConnectFourAI.ts:322-333
      cells[idx(col, row)] = 0; heights[col]--; placed--;
      if (aborted) break;
      scores.set(col, score);
      if (score > alpha) { alpha = score; bestCol = col; }
    }
    if (aborted) break;
    reached = depth; chosenScore = alpha; lastScores = scores;
    const top = [...scores.entries()].filter(([, sc]) => sc === alpha).map(([c]) => c);
    chosen = top.length > 1 ? top[Math.floor(rng() * top.length)] : bestCol;
    order = [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
    if (Math.abs(alpha) > WIN_SCORE - 100) break;
  }
  let slipped = false;
  if (level.slip > 0 && rng() < level.slip && Math.abs(chosenScore) < WIN_SCORE - 100) {
    const alternatives = legal.filter((c) => c !== chosen);
    if (alternatives.length > 0 && !mustBlock(game, me)) { chosen = alternatives[Math.floor(rng() * alternatives.length)]; slipped = true; }
  }
  return { col: chosen, depth: reached, nodes, score: chosenScore, scores: lastScores, slipped };
}

/* ---------------- the board, floating on the paper ---------------- */
const COLOURS = { frame: "#2c58bd", stand: "#8a6a45", red: "#d23b30", yellow: "#f0c02e" }; // ConnectFour.ts:97-101
const X0 = 20, CELL = 68, Y0 = 178, W = COLS * CELL, H = ROWS * CELL; // board 476 by 408
const GHOST_Y = 146;
const cx = (c) => X0 + c * CELL + CELL / 2;
const cy = (r) => Y0 + (ROWS - 1 - r) * CELL + CELL / 2;
const R = 26;

export function mountC4(fig) {
  const svg = fig.querySelector(".c4-board");
  const status = fig.querySelector(".c4-status");
  const rd = readout(fig);
  svg.setAttribute("viewBox", `0 0 ${X0 * 2 + W} ${Y0 + H + 64}`);

  const defs = s("defs", {}, svg);
  const mask = s("mask", { id: "c4holes" }, defs);
  s("rect", { x: 0, y: 0, width: X0 * 2 + W, height: Y0 + H + 64, fill: "#fff" }, mask);
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) s("circle", { cx: cx(c), cy: cy(r), r: R + 1, fill: "#000" }, mask);

  // a soft cast shadow on the paper, then the stand, the discs, the face
  s("ellipse", { cx: X0 + W / 2, cy: Y0 + H + 52, rx: W * 0.55, ry: 9, fill: "rgba(29,27,24,0.12)" }, svg);
  for (const x of [X0 + 18, X0 + W - 18]) s("rect", { x: x - 9, y: Y0 + H - 20, width: 18, height: 72, rx: 3, fill: COLOURS.stand }, svg);
  const bars = s("g", {}, svg);
  const ghost = s("circle", { cx: cx(3), cy: GHOST_Y, r: R, fill: COLOURS.red, opacity: 0.9 }, svg);
  const discs = s("g", {}, svg);
  s("rect", { x: X0, y: Y0, width: W, height: H, rx: 14, fill: COLOURS.frame, mask: "url(#c4holes)" }, svg);
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) s("circle", { cx: cx(c), cy: cy(r), r: R + 1, fill: "none", stroke: "rgba(10,20,60,0.35)", "stroke-width": 2 }, svg);
  const winG = s("g", {}, svg);
  txt(svg, X0, 16, "The engine's score for each column", { class: "ann", fill: "#67625a", "font-size": 16 });
  const hit = s("rect", { x: X0, y: 0, width: W, height: Y0 + H, fill: "transparent" }, svg);

  const game = new ConnectFourGame();
  const rng = makeRng(WORLD_SEED ^ 0x4c4f4e34);
  let level = "hard", cursor = 3, busy = false, moves = [], thinking = null;

  function drawBars(scores) {
    bars.textContent = "";
    if (!scores || !scores.size) return;
    const base = 74, span = 28;
    for (const [c, sc] of scores) {
      const mag = Math.sign(sc) * Math.min(1, Math.log10(1 + Math.abs(sc)) / 6);
      const h = Math.max(1.5, Math.abs(mag) * span);
      s("rect", { x: cx(c) - 15, y: mag >= 0 ? base - h : base, width: 30, height: h, fill: mag >= 0 ? COLOURS.yellow : "#9a958b" }, bars);
      const lab = Math.abs(sc) > WIN_SCORE - 100 ? (sc > 0 ? "wins" : "loses") : (sc > 0 ? "+" : sc < 0 ? "−" : "") + comma(Math.abs(sc));
      txt(bars, cx(c), mag >= 0 ? base - h - 5 : base + h + 15, lab, { "text-anchor": "middle", class: "ann", "font-size": 16 });
    }
    s("line", { x1: X0, x2: X0 + W, y1: base, y2: base, stroke: "#e0dbd0" }, bars);
  }
  function placeGhost() {
    ghost.setAttribute("cx", cx(cursor));
    const mine = !busy && !game.isOver && game.turn === 1 && landingRow(game.cells, cursor) >= 0;
    ghost.setAttribute("opacity", mine ? 0.9 : 0);
  }
  function addDisc(col, row, side, animate, done) {
    const d = s("circle", { cx: cx(col), cy: cy(row), r: R, fill: side === 1 ? COLOURS.red : COLOURS.yellow }, discs);
    if (!animate || Study.reduce) { done && done(); return; }
    const y0 = GHOST_Y, y1 = cy(row), dist = y1 - y0;
    const T = Math.sqrt(dist / 2600); // falls under a constant pull
    let t = 0;
    d.setAttribute("cy", y0);
    Study.raf((now, dt) => {
      t += dt;
      const k = Math.min(1, t / T);
      d.setAttribute("cy", y0 + dist * k * k);
      if (k >= 1) { done && done(); return false; }
    });
  }
  function drawWin() {
    winG.textContent = "";
    if (!game.run) return;
    const a = game.run[0], b = game.run[game.run.length - 1];
    s("line", { x1: cx(a.col), y1: cy(a.row), x2: cx(b.col), y2: cy(b.row), stroke: "#fdfcf9", "stroke-width": 6, "stroke-linecap": "round", opacity: 0.9 }, winG);
    for (const p of game.run) s("circle", { cx: cx(p.col), cy: cy(p.row), r: R - 3, fill: "none", stroke: "#fdfcf9", "stroke-width": 3 }, winG);
  }
  function updateMatch() {
    const json = JSON.stringify(moves);
    rd("list", json.length > 60 ? "[…," + json.slice(-40).replace(/^[^,]*,/, "") : json);
    rd("bytes", String(json.length));
  }
  function setStatus() {
    if (game.won === 1) status.textContent = "Four. You win.";
    else if (game.won === 2) status.textContent = "Four in a row for the board.";
    else if (game.isDraw) status.textContent = "A draw. The board is full.";
    else status.textContent = busy ? "The board is thinking…" : "Your move. You're red.";
  }

  function play(col) {
    if (busy || game.isOver || game.turn !== 1) return;
    const res = game.drop(col);
    if (!res) return;
    moves.push(col);
    busy = true; placeGhost(); setStatus(); updateMatch();
    addDisc(res.col, res.row, 1, true, () => {
      if (game.isOver) { busy = false; drawWin(); setStatus(); placeGhost(); return; }
      status.textContent = "The board is thinking…";
      thinking = setTimeout(() => {
        const t0 = performance.now();
        const mv = bestMove(game, 2, rng, level);
        const ms = performance.now() - t0;
        rd("depth", String(mv.depth));
        rd("nodes", comma(mv.nodes));
        rd("score", Math.abs(mv.score) > WIN_SCORE - 100 ? (mv.score > 0 ? "forced win" : "forced loss") : (mv.score > 0 ? "+" : mv.score < 0 ? "−" : "") + comma(Math.abs(mv.score)));
        rd("ms", `${Math.round(ms)} ms${mv.slipped ? ", slipped" : ""}`);
        drawBars(mv.scores);
        const r2 = game.drop(mv.col);
        moves.push(mv.col); updateMatch();
        addDisc(r2.col, r2.row, 2, true, () => { busy = false; drawWin(); setStatus(); placeGhost(); });
      }, Study.reduce ? 0 : 120);
    });
  }
  function newGame() {
    clearTimeout(thinking);
    game.reset(); moves = []; busy = false;
    discs.textContent = ""; winG.textContent = ""; bars.textContent = "";
    ["depth", "nodes", "score"].forEach((k) => rd(k, "0")); rd("ms", "0 ms");
    updateMatch(); setStatus(); placeGhost();
  }

  const colAt = (e) => {
    const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const q = p.matrixTransform(svg.getScreenCTM().inverse());
    return Math.max(0, Math.min(COLS - 1, Math.floor((q.x - X0) / CELL)));
  };
  hit.addEventListener("pointermove", (e) => { cursor = colAt(e); placeGhost(); });
  hit.addEventListener("click", (e) => { cursor = colAt(e); play(cursor); });
  svg.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { cursor = Math.max(0, cursor - 1); placeGhost(); e.preventDefault(); }
    else if (e.key === "ArrowRight") { cursor = Math.min(COLS - 1, cursor + 1); placeGhost(); e.preventDefault(); }
    else if (e.key === " " || e.key === "Enter") { play(cursor); e.preventDefault(); }
  });
  tabs(fig.querySelector('[aria-label="Opponent"]'), "data-level", (v) => { level = v; });
  fig.querySelector(".c4-new").addEventListener("click", newGame);

  newGame();
  return { start() {}, stop() {} };
}
