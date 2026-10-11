/* Fig. 4: Flow's 4 shapes, as a walkthrough of lib/flow/create.ts. Nothing here calls a
   model. Each sentence is placed in the lane the system prompt's own rules point to
   (create.ts:19-52), and each lane lists exactly what that branch of the prompt calls and
   returns. The split is withPayoutSplit (create.ts:68-82), added after the model chooses. */
import { S, $, $$, svgEl, tabs, relRect } from "./util.js";
import { EXAMPLE_PROMPTS as EX } from "./typewriter.js";

const SENTENCES = [
  { s: EX[0], src: "Example 1 of 5 in FlowCreator.tsx.", lane: "tiers",
    tiers: [["VIP", 10000, 20], ["Regular", 4000, 100]] },
  { s: EX[1], src: "Example 2 of 5 in FlowCreator.tsx.", lane: "one", price: 5000, cap: 100 },
  { s: EX[2], src: "Example 3 of 5. No cap given, so the prompt's default applies.", lane: "one", price: 2500, cap: 100, capDefault: true },
  { s: EX[3], src: "Example 4 of 5 in FlowCreator.tsx.", lane: "one", price: 7500, cap: 40 },
  { s: EX[4], src: "Example 5 of 5 in FlowCreator.tsx.", lane: "one", price: 15000, cap: 50 },
  { s: "Monthly membership for my book club, ₦3,000 a month", src: "My sentence, using a word the prompt listens for: monthly.", lane: "rec", price: 3000, cap: 100, capDefault: true, freq: "monthly" },
  { s: "Sell tickets to my Saturday event", src: "Example 1 with its prices taken out.", lane: "info", msg: "What's the price per ticket?" },
];

const LANES = [
  { id: "one", name: "ONE price", note: "a single one-time price" },
  { id: "tiers", name: "MULTIPLE tiers", note: "several named price levels" },
  { id: "rec", name: "RECURRING", note: "subscription, monthly, every week" },
  { id: "info", name: "NEEDS INFO", note: "no price, or no clear frequency" },
];

const k = (s) => `<em>"${s}"</em>`;
const v = (s) => `<i>${s}</i>`;
const q = (s) => v(`"${s}"`);

function calls(lane) {
  if (lane === "one") return `
    <p class="fs-call"><code>create_reserved_account</code><span>optional, adds a bank transfer; if it fails, carry on</span></p>
    <p class="fs-call"><code>create_invoice</code><span>required, expires in 30 days</span></p>`;
  if (lane === "tiers") return `<p class="fs-none">No tools. Each tier's payment link is made later, when a buyer picks that tier.</p>`;
  if (lane === "rec") return `
    <p class="fs-call"><code>create_invoice</code><span>the first payment, expires in 7 days</span></p>
    <p class="fs-none">No reserved account: recurring billing only works off a card.</p>`;
  return `<p class="fs-none">No tools. Don't guess.</p>`;
}

function code(lane, payout) {
  if (lane === "info") return `<p class="fs-none">Nothing to split.</p>`;
  const where = lane === "tiers" ? "joins each tier's invoice at purchase" : lane === "rec" ? "spliced onto create_invoice" : "spliced onto both calls";
  if (!payout) return `<div class="fs-split"><p class="fs-none">No payout account: the tools pass through unchanged, and sales land in the platform's account.</p></div>`;
  return `<div class="fs-split"><p class="fs-none">withPayoutSplit, ${where}</p><pre>incomeSplitConfig: [{
  subAccountCode,
  splitPercentage: 100
}]</pre></div>`;
}

function result(lane, s) {
  if (lane === "one") {
    const sel = s && s.lane === "one" ? s : { price: 5000, cap: 100 };
    return `<pre class="fs-json">{ ${k("title")}: ${v("‹the model's short title›")},
  ${k("priceNaira")}: ${v(sel.price)}, ${k("ticketCap")}: ${v(sel.cap)},
  ${k("accountReference")}: ${v("‹slug›")},
  ${k("accountNumber")}, ${k("bankName")}, ${k("checkoutUrl")}: ${v("‹from Paystack, or null›")} }</pre>${s ? get() : ""}`;
  }
  if (lane === "tiers") {
    const t = s && s.lane === "tiers" ? s.tiers : [["VIP", 10000, 20], ["Regular", 4000, 100]];
    const cap = t.reduce((a, x) => a + x[2], 0);
    return `<pre class="fs-json">{ ${k("title")}: ${v("‹the model's short title›")},
  ${k("tiers")}: [${t.map(([n, p, c]) => `
    { ${k("name")}: ${q(n)}, ${k("priceNaira")}: ${v(p)}, ${k("cap")}: ${v(c)} }`).join(",")} ] }</pre>
    <p class="fs-none">Saved with a total cap of ${cap}, the tiers' caps added up.</p>${s ? get() : ""}`;
  }
  if (lane === "rec") {
    const sel = s && s.lane === "rec" ? s : { price: 3000, cap: 100, freq: "monthly" };
    return `<pre class="fs-json">{ ${k("title")}: ${v("‹the model's short title›")},
  ${k("priceNaira")}: ${v(sel.price)}, ${k("ticketCap")}: ${v(sel.cap)},
  ${k("frequency")}: ${q(sel.freq)},
  ${k("accountReference")}: ${v("‹slug›")}, ${k("checkoutUrl")}: ${v("‹from Paystack›")} }</pre>${s ? get() : ""}`;
  }
  const msg = s && s.lane === "info" ? s.msg : "What's the price per ticket?";
  return `<pre class="fs-json">{ ${k("needsInfo")}: ${v("true")},
  ${k("message")}: ${q(msg)} }</pre>
    <p class="fs-none">The question shows under the box, for the seller to answer.</p>`;
}

const get = () => `<div class="fs-get"><img src="wire/qr-flow.svg" width="64" height="64" alt="A QR code" /><p><code>/checkout/{slug}</code>, its QR code and <code>/dashboard/{slug}</code>. This QR was made with Wire's own settings and scans to Flow's page.</p></div>`;

export function initShapes(fig) {
  const quote = $("[data-fs-quote]", fig), src = $("[data-fs-src]", fig);
  const lanesEl = $("[data-fs-lanes]", fig), map = $(".fs-map", fig), svg = $(".fs-wires", fig);
  let cur = 0, payout = true;

  lanesEl.innerHTML = LANES.map((l) => `
    <div class="fs-lane" data-lane="${l.id}">
      <div class="fs-cell fs-mode"><b>${l.name}</b><span>${l.note}</span></div>
      <div class="fs-cell fs-calls"></div>
      <div class="fs-cell fs-code"></div>
      <div class="fs-cell fs-out"></div>
    </div>`).join("");
  const lanes = $$(".fs-lane", lanesEl);

  // short arrows across the gaps of the lit lane, left to right (only when the lane is a row)
  const wires = () => {
    svg.innerHTML = "";
    const box = map.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
    const lane = lanes.find((l) => l.classList.contains("is-on"));
    if (!lane) return;
    const cells = $$(".fs-cell", lane).map((c) => relRect(c, map));
    if (cells.length < 2 || cells[1].left < cells[0].right) return;
    const y = cells[0].top + 10;
    for (let i = 0; i < cells.length - 1; i++) {
      const x1 = cells[i].right + 8, x2 = cells[i + 1].left - 8;
      if (x2 - x1 < 10) continue;
      svgEl("path", { d: `M${x1},${y} L${x2},${y} M${x2 - 5},${y - 4} L${x2},${y} L${x2 - 5},${y + 4}` }, svg);
    }
  };

  const paint = () => {
    const s = SENTENCES[cur];
    quote.textContent = `“${s.s}”`;
    src.textContent = s.src;
    lanes.forEach((el) => {
      const id = el.dataset.lane, on = id === s.lane;
      el.classList.toggle("is-on", on);
      el.classList.toggle("is-off", !on);
      $(".fs-calls", el).innerHTML = calls(id);
      $(".fs-code", el).innerHTML = code(id, payout);
      $(".fs-out", el).innerHTML = result(id, on ? s : null);
    });
    requestAnimationFrame(wires);
  };

  tabs($("[role=tablist]", fig), (b) => { cur = +b.dataset.s; paint(); });
  tabs($("[data-payout]", fig).parentElement, (b) => { payout = b.dataset.payout === "1"; paint(); }, "aria-pressed");
  paint();
  let built = false;
  S().onVisible(fig, () => { if (!built) { built = true; new ResizeObserver(() => wires()).observe(map); } wires(); });
}
