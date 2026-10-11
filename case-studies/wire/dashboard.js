/* Fig. 5: the seller's dashboard, rebuilt from app/dashboard/[slug]/page.tsx.
   What's ported: the poll (page.tsx:56-61, once on load and then every 3000ms), the
   numbers (page.tsx:133-134 and 197-214), the bar's transition (page.tsx:220, Tailwind
   transition-all duration-500, so cubic-bezier(0.4, 0, 0.2, 1) over 500ms), the empty
   line (page.tsx:228-233), the connected-system line (page.tsx:235-241), the side card
   (page.tsx:253-335) and the RepelDotGrid behind it all (page.tsx:154).
   What's simulated: the sales. They arrive at random, and the record only reaches the
   page when the next poll asks for it, exactly as it would over the network. */
import { S, $, $$, svgEl, tabs, clamp, naira, bezier, playGate } from "./util.js";
import { repelGrid, track } from "./dots.js";

const POLL = 3000;
const ease = bezier(0.4, 0, 0.2, 1);
const FREQUENCY_LABEL = { daily: "day", weekly: "week", monthly: "month" }; // page.tsx:23
const formatDate = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); // page.tsx:19-21
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");

const KINDS = {
  one: () => ({ title: "Hackathon tickets", priceNaira: 5000, ticketCap: 100 }),
  tiers: () => ({ title: "Saturday event", tiers: [{ name: "VIP", priceNaira: 10000, cap: 20, sold: 0 }, { name: "Regular", priceNaira: 4000, cap: 100, sold: 0 }], ticketCap: 120 }),
  sub: () => ({ title: "Book club membership", priceNaira: 3000, ticketCap: 100, recurring: { frequency: "monthly" } }),
};

export function initDashboard(fig) {
  const board = $(".fd-board", fig);
  const F = (k) => $(`[data-fd=${k}]`, fig);
  const fill = F("fill"), side = F("side"), sell = $("[data-fd-sell]", fig);
  const pollSvg = $(".fd-poll-svg", fig), easeSvg = $(".fd-ease-svg", fig);
  F("created").textContent = `Created ${formatDate(new Date())}`; // the simulation creates it today

  let kind = "one", truth, shown, slug, apiKey;
  let clock = 0, nextPoll = 0, polls = [], sales = [], pollN = 0, saleAcc = 0;
  let pct = 0, prevPct = 0, tStart = -1;

  const fresh = () => {
    truth = { ...KINDS[kind](), ticketsSold: 0, revenueNaira: 0 };
    if (truth.tiers) truth.tiers = truth.tiers.map((t) => ({ ...t }));
    shown = JSON.parse(JSON.stringify(truth));
    slug = hex(4); apiKey = `flow_${hex(24)}`; // lib/flow/create.ts:64-66, lib/store/flow.ts:80-82
    clock = 0; nextPoll = 0; polls = []; sales = []; pollN = 0; saleAcc = 0;
    pct = prevPct = 0; tStart = -1;
    fill.style.transition = "none"; fill.style.width = "0%"; void fill.offsetWidth; fill.style.transition = "";
    render(true);
  };

  const room = () => truth.tiers ? truth.tiers.some((t) => t.sold < t.cap) : truth.ticketsSold < truth.ticketCap;
  const makeSale = () => {
    if (!room()) return false;
    let price = truth.priceNaira, tier = -1;
    if (truth.tiers) {
      const open = truth.tiers.map((t, i) => [t, i]).filter(([t]) => t.sold < t.cap);
      const pick = open.length > 1 && Math.random() < 0.25 ? open[0] : open[open.length - 1];
      tier = pick[1]; price = pick[0].priceNaira; truth.tiers[tier].sold++;
    }
    truth.ticketsSold++; truth.revenueNaira += price;
    sales.push({ t: clock, at: -1 });
    return true;
  };

  // page.tsx:40-51 and 56-61: fetch the record, then every 3s
  const poll = () => {
    pollN++;
    polls.push(clock);
    sales.forEach((s) => { if (s.at < 0 && s.t <= clock) s.at = clock; });
    shown = JSON.parse(JSON.stringify(truth));
    render(false);
  };

  function render(initial) {
    const r = shown;
    // page.tsx:133 counts subscriberCount for a subscription; this simulation keeps both in ticketsSold
    const primaryCount = r.ticketsSold;
    const p = r.ticketCap > 0 ? Math.min(100, (primaryCount / r.ticketCap) * 100) : 0; // page.tsx:134
    F("title").textContent = r.title;
    F("sold").textContent = `${primaryCount}/${r.ticketCap}`;
    F("soldlabel").textContent = r.recurring ? "subscribers" : "sold";
    F("rev").textContent = naira(r.revenueNaira);
    F("pct").textContent = `${Math.round(p)}%`;
    F("cap").textContent = r.ticketCap;
    const empty = F("empty");
    empty.hidden = primaryCount !== 0;
    empty.textContent = r.recurring ? "No subscribers yet — share the checkout link to get started." : "No sales yet — share the checkout link to get started.";
    F("action").hidden = primaryCount === 0;
    if (p !== pct || initial) {
      prevPct = pct; pct = p;
      fill.style.width = `${p}%`;
      if (!initial) tStart = performance.now();
    }
    side.innerHTML = sideCard(r);
    sell.disabled = !room();
    sell.textContent = room() ? "Sell one" : "Sold out";
  }

  const sideCard = (r) => {
    let top;
    if (r.tiers) top = `<div><span class="fd-k">TIERS</span><ul class="fd-tiers">${r.tiers.map((t) => `<li><span>${t.name}</span><span>${naira(t.priceNaira)} · ${t.sold}/${t.cap}</span></li>`).join("")}</ul></div>`;
    else if (r.recurring) top = `<div><span class="fd-k">SUBSCRIPTION</span><p class="fd-price">${naira(r.priceNaira)}</p><p class="fd-per">per ${FREQUENCY_LABEL[r.recurring.frequency]}</p><p class="fd-subs">${r.ticketsSold} active subscriber${r.ticketsSold === 1 ? "" : "s"}</p></div>`;
    else top = `<div><span class="fd-k">PRODUCT</span><p class="fd-price">${naira(r.priceNaira)}</p><p class="fd-per">per ticket</p></div>`;
    return `${top}<div class="fd-co"><p class="fd-co-k">API key — call this Flow from your own app</p><div class="fd-co-row"><code>${apiKey}</code><span>Copy</span></div><p class="fd-co-k" style="margin-top:8px"><code style="background:none;padding:0">GET /api/flow/${slug}</code></p></div>`;
  };

  // ---- instruments ----
  let PW = 0;
  const PH = 120, BASE = 84, SY = 44, WIN = 30;
  const buildPoll = () => {
    PW = Math.max(260, pollSvg.getBoundingClientRect().width);
    pollSvg.setAttribute("viewBox", `0 0 ${PW} ${PH}`);
  };
  const drawPoll = () => {
    if (!PW) return;
    const X = (t) => PW - ((clock / 1000 - t / 1000) / WIN) * PW;
    let h = "";
    h += `<line class="ax ax--ink" x1="0" x2="${PW}" y1="${BASE}" y2="${BASE}"/>`;
    h += `<line class="ax" x1="0" x2="${PW}" y1="${SY}" y2="${SY}"/>`;
    h += `<text class="lab" x="0" y="${SY - 12}">a sale happens</text><text class="lab" x="0" y="${BASE - 12}">the page polls</text>`;
    for (let s = 0; s <= WIN; s += 10) {
      const x = PW - (s / WIN) * PW;
      h += `<text class="num" x="${x}" y="${PH - 4}" text-anchor="${s === 0 ? "end" : s === WIN ? "start" : "middle"}">${s === 0 ? "now" : `−${s}s`}</text>`;
    }
    for (const s of sales) {
      const x = X(s.t); if (x < -10) continue;
      if (s.at >= 0) h += `<line class="link" x1="${x}" y1="${SY + 5}" x2="${X(s.at)}" y2="${BASE - 4}"/>`;
      h += `<circle class="sale${s.at >= 0 ? " is-in" : ""}" cx="${x}" cy="${SY}" r="4.5"/>`;
    }
    for (const p of polls) {
      const x = X(p); if (x < -10) continue;
      h += `<rect class="poll" x="${x - 3}" y="${BASE - 3}" width="6" height="6"/>`;
    }
    pollSvg.innerHTML = h;
  };
  const E = { x0: 22, x1: 150, y0: 100, y1: 14 };
  const ex = (p) => E.x0 + p * (E.x1 - E.x0), ey = (v) => E.y0 - v * (E.y0 - E.y1);
  let dotEl;
  const buildEase = () => {
    let d = "";
    for (let i = 0; i <= 40; i++) { const p = i / 40; d += `${i ? "L" : "M"}${ex(p).toFixed(1)},${ey(ease(p)).toFixed(1)}`; }
    easeSvg.innerHTML = `<line class="ax ax--ink" x1="${E.x0}" x2="${E.x1}" y1="${E.y0}" y2="${E.y0}"/><line class="ax" x1="${E.x0}" x2="${E.x0}" y1="${E.y0}" y2="${E.y1}"/>
      <line class="ax" x1="${E.x0}" x2="${E.x1}" y1="${E.y1}" y2="${E.y1}"/>
      <path class="curve" d="${d}"/>
      <text class="num" x="${E.x0}" y="${E.y0 + 14}">0</text><text class="num" x="${E.x1}" y="${E.y0 + 14}" text-anchor="end">500ms</text>
      <text class="num" x="${E.x0 - 6}" y="${E.y0 + 3}" text-anchor="end">old</text><text class="num" x="${E.x0 - 6}" y="${E.y1 + 3}" text-anchor="end">new</text>
      <circle class="dot" r="4.5" cx="${ex(1)}" cy="${ey(1)}"/>`;
    dotEl = $("circle", easeSvg);
  };
  const drawEase = () => {
    const p = tStart < 0 ? 1 : clamp((performance.now() - tStart) / 500, 0, 1);
    dotEl.setAttribute("cx", ex(p).toFixed(1)); dotEl.setAttribute("cy", ey(ease(p)).toFixed(1));
  };

  let lastRead = "";
  const readout = () => {
    const nx = Math.max(0, (nextPoll - clock) / 1000).toFixed(1) + "s";
    const bar = `${Math.round(prevPct)}% → ${Math.round(pct)}%`;
    const s = `${pollN}|${nx}|${bar}`;
    if (s === lastRead) return;
    lastRead = s;
    F("n").textContent = pollN; F("next").textContent = nx; F("bar").textContent = bar;
  };

  // ---- the dots behind ----
  const dots = repelGrid($(".fd-canvas", fig), { fade: 70 });
  track(board, (p) => { const c = $(".fd-canvas", fig).getBoundingClientRect(), b = board.getBoundingClientRect(); dots.setMouse({ x: p.x + b.left - c.left, y: p.y + b.top - c.top }); }, () => dots.setMouse(null));
  if (S().reduce) dots.setEnabled(false);
  const layoutDots = () => { const c = $(".fd-canvas", fig).getBoundingClientRect(); dots.layout(c.width, c.height); };

  // ---- the loop ----
  let playing = !S().reduce, visible = false, built = false;
  const loop = (t, dt) => {
    if (!visible) return false;
    if (playing) {
      clock += dt * 1000;
      // sales: about one every 2.5 seconds while there's room
      saleAcc += dt;
      while (saleAcc >= 0.25) { saleAcc -= 0.25; if (Math.random() < 0.1) makeSale(); }
      while (clock >= nextPoll) { poll(); nextPoll += POLL; }
      sales = sales.filter((s) => clock - s.t < (WIN + 4) * 1000);
      polls = polls.filter((p) => clock - p < (WIN + 4) * 1000);
    }
    drawPoll(); drawEase(); readout();
    dots.draw(dt);
  };

  tabs($("[role=tablist]", fig), (b) => { kind = b.dataset.kind; fresh(); if (!playing) { poll(); nextPoll = POLL; } });
  sell.addEventListener("click", () => { if (!playing) { playing = true; } makeSale(); drawPoll(); });
  if (S().reduce) playGate($("[data-fd-play]", fig), () => { playing = true; dots.setEnabled(true); });

  fresh();
  S().onVisible(fig, () => {
    if (!built) {
      built = true; buildPoll(); buildEase(); layoutDots();
      new ResizeObserver(() => { buildPoll(); layoutDots(); }).observe(board);
      if (!playing) { poll(); nextPoll = POLL; drawPoll(); readout(); }
    }
    visible = true; S().raf(loop);
  }, () => { visible = false; });
}
