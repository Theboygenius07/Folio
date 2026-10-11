/* Fig. 7: Relay's compiler, live. The parsing is parse.js (a line-for-line port of
   lib/gateway/parseCurl.ts, parseOpenApi.ts and index.ts). This file only draws: the
   pasted text with each meaningful part underlined, the spec it becomes, the Zod schema
   compile.ts would build from it, and a line between whichever pair you point at. */
import { S, $, $$, tabs, wirePath, relRect } from "./util.js";
import { parseInput, zodLine } from "./parse.js";

const PRESETS = {
  paystack: `curl https://api.paystack.co/transaction/initialize \\
  -H "Authorization: Bearer YOUR_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -X POST \\
  -d '{ "email": "customer@email.com", "amount": "20000" }'`,
  airtable: `curl -X POST https://api.airtable.com/v0/appXXXXXXXXXXXXXX/Stock \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  --data '{
    "records": [{ "fields": { "Item": "Tote bag", "Sold": 1 } }],
    "typecast": true
  }'`,
  notion: `curl -X POST https://api.notion.com/v1/databases/DATABASE_ID/query \\
  -H "Authorization: Bearer YOUR_SECRET" \\
  -H "Notion-Version: 2022-06-28" \\
  -H "Content-Type: application/json" \\
  --data '{ "page_size": 10 }'`,
  basic: `curl "https://api.example.com/v1/things?status=open&limit=20" \\
  -u YOUR_KEY: \\
  -d "name=Tote&qty=3"`,
  openapi: `{
  "openapi": "3.0.0",
  "info": { "title": "Stock" },
  "servers": [{ "url": "https://api.example.com" }],
  "components": { "securitySchemes": {
    "key": { "type": "apiKey", "in": "header", "name": "X-API-Key" }
  } },
  "paths": {
    "/items/{id}": { "get": { "operationId": "getItem",
      "parameters": [{ "name": "id", "in": "path", "schema": { "type": "string" } }] } },
    "/items": { "post": { "operationId": "createItem",
      "requestBody": { "content": { "application/json": { "schema": {
        "type": "object", "required": ["name"],
        "properties": { "name": { "type": "string" }, "qty": { "type": "integer" } }
      } } } } } }
  }
}`,
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const J = (v) => esc(JSON.stringify(v));

export function initCompiler(fig) {
  const wrap = $(".fc-wrap", fig), ta = $(".fc-ta", fig), mirror = $(".fc-mirror", fig);
  const tool = $(".fc-tool", fig), wire = $(".fc-wire path", fig), wsvg = $(".fc-wire", fig), sum = $("[data-fc-sum]", fig);
  let res = null, active = null, fields = [], hovering = false, cycleT = 0;

  /* ---- left: the text, with the parts that mattered underlined ---- */
  const drawMirror = (text, src) => {
    const cuts = new Set([0, text.length]);
    const spans = [];
    for (const id in src) for (const [a, b] of src[id]) { if (b > a) { cuts.add(a); cuts.add(b); spans.push([a, b, id]); } }
    const pts = [...cuts].sort((x, y) => x - y);
    let h = "";
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const ids = [...new Set(spans.filter(([s, e]) => s <= a && e >= b).map((x) => x[2]))];
      const chunk = esc(text.slice(a, b));
      h += ids.length ? `<span class="t" data-ids="${ids.join(" ")}">${chunk}</span>` : chunk;
    }
    mirror.innerHTML = h + "​\n"; // keeps a trailing newline the same height as the textarea's
  };

  /* ---- right: what Relay makes ---- */
  const line = (html, f, cls = "") => f ? `<button type="button" class="fc-line ${cls}" data-f="${f}">${html}</button>` : `<span class="fc-line ${cls}">${html}</span>`;
  const K = (k) => `<span class="k">"${k}"</span>`;
  const paramLine = (p, f, last) => line(`{ ${K("name")}: ${J(p.name)}, ${K("location")}: ${J(p.location)}, ${K("type")}: ${J(p.type)}, ${K("required")}: ${p.required} }${last ? "" : ","}`, f, "hang");

  const drawTool = () => {
    if (res.error) {
      tool.innerHTML = `<p class="fc-err"><b>parseInput throws</b>${esc(res.error)}</p>`;
      sum.textContent = "the original's own error message";
      return;
    }
    const { spec } = res;
    let h = "";
    if (res.kind === "curl") {
      const op = spec.operations[0];
      h += line("{");
      h += line(`  ${K("name")}: <span class="s">${J(op.name)}</span>,`, "name");
      h += line(`  ${K("method")}: ${J(op.method)},`, "method");
      h += line(`  ${K("baseUrl")}: ${J(spec.baseUrl)},`, "baseUrl");
      h += line(`  ${K("path")}: ${J(op.path)},`, "path");
      h += line(`  ${K("auth")}: ${J(spec.auth)},`, res.src.auth ? "auth" : null);
      if (res.authValue !== undefined) h += line(`  ${K("authValue")}: ${J(res.authValue)},`, "authValue");
      h += line(`  ${K("params")}: [`);
      op.params.forEach((p, i) => { h += paramLine(p, "p:" + p.name, i === op.params.length - 1); });
      h += line("  ]");
      h += line("}");
      h += `<p class="fc-sub">compile.ts turns it into a schema</p>`;
      if (!op.params.length) h += line("{ }  no inputs");
      op.params.forEach((p) => { h += line(`${esc(p.name)}: ${zodLine(p)}${p.nested ? "  <span class=\"k\">// nested, sent as a JSON string</span>" : ""}`, "p:" + p.name); });
      sum.innerHTML = `parseInput → <b>curl</b> · <b>${op.params.length}</b> input${op.params.length === 1 ? "" : "s"} · auth <b>${spec.auth.type}</b>`;
    } else {
      h += line(`${K("baseUrl")}: ${J(spec.baseUrl)}`);
      h += line(`${K("auth")}: ${J(spec.auth)}`);
      spec.operations.forEach((op) => {
        h += line(`{ ${K("name")}: <span class="s">${J(op.name)}</span>, ${K("method")}: ${J(op.method)}, ${K("path")}: ${J(op.path)},`);
        h += line(`  ${K("params")}: [`);
        op.params.forEach((p, i) => { h += paramLine(p, null, i === op.params.length - 1); });
        h += line("  ] }");
      });
      sum.innerHTML = `parseInput → <b>OpenAPI JSON</b> · <b>${spec.operations.length}</b> operations · first auth scheme only`;
    }
    tool.innerHTML = h;
  };

  /* ---- the pair you point at ---- */
  const setActive = (id) => {
    active = id;
    $$(".t", mirror).forEach((s) => s.classList.toggle("is-on", !!id && s.dataset.ids.split(" ").includes(id)));
    $$(".fc-line[data-f]", tool).forEach((l) => l.classList.toggle("is-on", l.dataset.f === id));
    drawWire();
  };
  const drawWire = () => {
    const box = wrap.getBoundingClientRect();
    wsvg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
    $$("circle", wsvg).forEach((c) => c.remove());
    const a = active && $$(".t.is-on", mirror)[0], b = active && $(`.fc-line.is-on`, tool);
    if (!a || !b) { wire.setAttribute("d", ""); return; }
    const ra = relRect(a, wrap), rb = relRect(b, wrap), re = relRect($(".fc-editor", fig), wrap);
    if (rb.left < re.right) { wire.setAttribute("d", ""); return; } // stacked: the highlights say it
    const y1 = ra.top + ra.height / 2;
    const p = wirePath({ left: re.right - 1, right: re.right, top: y1 - 14, bottom: y1 + 14, width: 1, height: 28 }, { ...rb, left: rb.left - 4 });
    wire.setAttribute("d", p.d);
    for (const [x, y] of [[p.x1, p.y1], [p.x2, p.y2]]) {
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("r", 3);
      wsvg.appendChild(c);
    }
  };

  const run = () => {
    const text = ta.value;
    try { res = parseInput(text); } catch (e) { res = { error: e.message, src: {} }; }
    drawMirror(text, res.src || {});
    drawTool();
    fields = res.error ? [] : $$(".fc-line[data-f]", tool).map((l) => l.dataset.f).filter((f, i, a) => a.indexOf(f) === i);
    if (active && !fields.includes(active)) active = null;
    setActive(active);
  };

  const ui = tabs($("[role=tablist]", fig), (b) => { ta.value = PRESETS[b.dataset.p]; active = null; run(); });
  ta.value = PRESETS.paystack;
  ta.addEventListener("input", () => { ui.btns.forEach((b) => b.setAttribute("aria-selected", "false")); run(); });

  // pointing: the output lines are buttons; the text needs a look under the textarea
  tool.addEventListener("pointerover", (e) => { const l = e.target.closest(".fc-line[data-f]"); if (l) { hovering = true; setActive(l.dataset.f); } });
  tool.addEventListener("pointerleave", () => { hovering = false; });
  tool.addEventListener("focusin", (e) => { const l = e.target.closest(".fc-line[data-f]"); if (l) { hovering = true; setActive(l.dataset.f); } });
  tool.addEventListener("focusout", () => { hovering = false; });
  tool.addEventListener("click", (e) => { const l = e.target.closest(".fc-line[data-f]"); if (l) { hovering = true; setActive(l.dataset.f); } });
  const peek = (e) => {
    ta.style.pointerEvents = "none";
    const el = document.elementFromPoint(e.clientX, e.clientY);
    ta.style.pointerEvents = "";
    const s = el && el.closest && el.closest(".fc-mirror .t");
    if (s) { hovering = true; const ids = s.dataset.ids.split(" "); setActive(ids.includes(active) ? active : ids[ids.length - 1]); }
  };
  ta.addEventListener("pointermove", peek);
  ta.addEventListener("pointerdown", peek);
  ta.addEventListener("pointerleave", () => { hovering = false; });
  ta.addEventListener("focus", () => { hovering = true; });
  ta.addEventListener("blur", () => { hovering = false; });

  // when nobody is pointing, walk through the pairs so the mapping is visible on its own
  let visible = false;
  const loop = (t, dt) => {
    if (!visible) return false;
    if (hovering || !fields.length) { cycleT = 0; return; }
    cycleT += dt;
    if (cycleT > 1.7 || !active) {
      cycleT = 0;
      setActive(fields[(fields.indexOf(active) + 1) % fields.length]);
    }
  };

  run();
  let built = false;
  S().onVisible(fig, () => {
    if (!built) { built = true; new ResizeObserver(drawWire).observe(wrap); }
    visible = true;
    if (!S().reduce) S().raf(loop); else if (!active && fields.length) setActive(fields[0]);
  }, () => { visible = false; });
}
