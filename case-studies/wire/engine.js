/* Fig. 2: the engine, drawn from the imports.
   Sources:    lib/paystack/tools.ts, lib/whatsapp/agent.ts:52-99, lib/gateway/parseCurl.ts, parseOpenApi.ts
   Compiler:   lib/gateway/compile.ts:88-99 (compileSpec)
   Shape:      lib/gateway/types.ts:43-48 (GatewayTool)
   Consumers:  lib/openai/agent.ts:28 (runAgent), lib/mcp/server.ts:9 (createMcpServer)
   Surfaces:   lib/flow/create.ts:98, lib/whatsapp/agent.ts:101, lib/openai/sellerAction.ts:19,
               app/api/chat/route.ts:46, app/api/mcp/route.ts + app/api/gateway/[id]/mcp */
import { S, $, $$, svgEl, tabs, wirePath, relRect } from "./util.js";

// [from, to, start column, columns spanned] for the moving marker
const EDGES = [
  ["paystack", "shape", 0, 2], ["wa", "shape", 0, 2],
  ["curl", "compile", 0, 1], ["openapi", "compile", 0, 1], ["compile", "shape", 1, 1],
  ["shape", "agent", 2, 1], ["shape", "mcp", 2, 1],
  ["agent", "flow", 3, 1], ["agent", "whatsapp", 3, 1], ["agent", "connect", 3, 1], ["agent", "playground", 3, 1],
  ["mcp", "relay", 3, 1],
];

const PATHS = {
  flow: { nodes: ["paystack", "shape", "agent", "flow"],
    say: "Flow runs the loop with the 6 Paystack tools for up to 6 turns. Its last message has to be JSON in one of 4 shapes, and that JSON becomes the page." },
  whatsapp: { nodes: ["paystack", "wa", "shape", "agent", "whatsapp"],
    say: "WhatsApp runs the same loop with create_flow, edit_flow and Paystack's initiate_refund. create_flow calls Flow's pipeline inside it. The reply goes back as plain text." },
  connect: { nodes: ["curl", "openapi", "compile", "shape", "agent", "connect"],
    say: "Connect compiles the seller's own API, then runs the loop for 4 turns after each sale. The prompt allows it to do nothing if no tool fits." },
  playground: { nodes: ["paystack", "curl", "openapi", "compile", "shape", "agent", "playground"],
    say: "The playground runs the Paystack preset or a compiled API for up to 6 turns, streamed as server-sent events: reasoning, tool_call, tool_result, then done or error." },
  relay: { nodes: ["paystack", "curl", "openapi", "compile", "shape", "mcp", "relay"],
    say: "Relay registers the tools on an MCP server. Any MCP client calls the handlers directly: the Paystack preset at /api/mcp, a compiled API at /api/gateway/[id]/mcp." },
};

export function initEngine(fig) {
  const map = $(".fe-map", fig);
  const svg = $(".fe-wires", fig);
  const say = $("[data-fe-say]", fig);
  const node = Object.fromEntries($$(".fe-node", fig).map((n) => [n.dataset.n, n]));
  let current = "flow", wires = [], markers = [];

  let rail = false;
  const draw = () => {
    svg.innerHTML = "";
    const box = map.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
    // stacked (narrow screens): one rail through the lit nodes, top to bottom
    rail = getComputedStyle(map).gridTemplateColumns.split(" ").length < 2;
    if (rail) {
      wires = [{ a: "rail", b: "rail", d: 0, s: 4, el: svgEl("path", { class: "is-on" }, svg), len: 0, live: true }];
      markers = [svgEl("circle", { r: 3.5, cx: -20, cy: -20, opacity: 0 }, svg)];
      paint();
      return;
    }
    wires = EDGES.map(([a, b, d, s]) => {
      const p = wirePath(relRect(node[a], map), relRect(node[b], map));
      const el = svgEl("path", { d: p.d }, svg);
      return { a, b, d, s, el, len: 0 };
    });
    wires.forEach((w) => { w.len = w.el.getTotalLength(); });
    markers = wires.map(() => svgEl("circle", { r: 3.5, cx: -20, cy: -20, opacity: 0 }, svg));
    paint();
  };

  const paint = () => {
    const P = PATHS[current];
    const on = new Set(P.nodes);
    const skip = new Set(P.skip || []);
    for (const k in node) {
      node[k].classList.toggle("is-on", on.has(k));
      node[k].classList.toggle("is-off", !on.has(k) && k !== "shape");
    }
    node.shape.classList.remove("is-off");
    if (!rail) wires.forEach((w) => {
      const live = on.has(w.a) && on.has(w.b) && !skip.has(`${w.a}>${w.b}`);
      w.live = live;
      w.el.classList.toggle("is-on", live);
      w.el.classList.toggle("is-off", !live);
    });
    if (rail && wires[0]) {
      const order = Object.keys(node).filter((k) => on.has(k) || k === "shape").filter((k) => k !== "compile" || on.has("compile"));
      const pts = order.flatMap((k) => {
        const r = relRect(node[k], map);
        return k === "shape" ? [[r.left + 3.5, r.top + 1], [r.left + 3.5, r.bottom - 1]] : [[r.left + 3.5, r.top + 14.5]];
      }).sort((p, q) => p[1] - q[1]);
      const w = wires[0];
      w.el.setAttribute("d", pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" "));
      w.len = w.el.getTotalLength();
    }
    say.textContent = P.say;
    if (S().reduce || !running) markers.forEach((m) => m.setAttribute("opacity", 0));
  };

  const ui = tabs($("[role=tablist]", fig), (b) => { current = b.dataset.path; paint(); });
  $$(".fe-out", fig).forEach((n) => {
    n.addEventListener("pointerenter", () => ui.pick(ui.btns.findIndex((b) => b.dataset.path === n.dataset.n)));
    n.addEventListener("click", () => ui.pick(ui.btns.findIndex((b) => b.dataset.path === n.dataset.n)));
  });

  // A marker runs along the lit path, column by column, so it reads left to right.
  let running = false, T = 0;
  const STEP = 0.55; // seconds per column
  const loop = (t, dt) => {
    if (!running) return false;
    T = (T + dt / STEP) % 5;
    wires.forEach((w, i) => {
      const m = markers[i];
      const p = (T - w.d) / w.s;
      if (!w.live || p < 0 || p > 1) { m.setAttribute("opacity", 0); return; }
      const pt = w.el.getPointAtLength(p * w.len);
      m.setAttribute("cx", pt.x.toFixed(1)); m.setAttribute("cy", pt.y.toFixed(1)); m.setAttribute("opacity", 1);
    });
  };

  let built = false;
  S().onVisible(fig, () => {
    if (!built) { built = true; draw(); new ResizeObserver(draw).observe(map); }
    if (S().reduce) return;
    running = true; S().raf(loop);
  }, () => { running = false; });
}
