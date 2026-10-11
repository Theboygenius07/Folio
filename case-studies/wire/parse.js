/* Relay's compiler front end, ported for the browser.

   parseCurl     lib/gateway/parseCurl.ts:9-168
   parseOpenApi  lib/gateway/parseOpenApi.ts:9-149
   parseInput    lib/gateway/index.ts:11-25
   zodLine       lib/gateway/compile.ts:9-14

   The logic, its order and its error messages are the originals'. Two changes:
   1. Buffer.from(user).toString("base64") (parseCurl.ts:121) becomes btoa, since there
      is no Buffer in a browser.
   2. Every token remembers where it sat in the text you pasted, and parseCurl returns a
      `src` list saying which characters produced which field. That's what the figure
      highlights. It changes nothing about the result. */

const CONT = /\\\s*\n/g; // parseCurl.ts:38

/* parseCurl.ts:9-17, plus positions. The continuation-stripped text is tokenized with the
   same regex; `map` takes each stripped index back to the original text. */
function tokenize(input) {
  let clean = "", map = [], last = 0, m;
  CONT.lastIndex = 0;
  while ((m = CONT.exec(input)) !== null) {
    for (let i = last; i < m.index; i++) { clean += input[i]; map.push(i); }
    clean += " "; map.push(m.index);
    last = m.index + m[0].length;
  }
  for (let i = last; i < input.length; i++) { clean += input[i]; map.push(i); }
  map.push(input.length);

  const tokens = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  while ((m = re.exec(clean)) !== null) {
    const text = m[1] ?? m[2] ?? m[3];
    const quoted = m[3] === undefined;
    const s = map[m.index], e = map[m.index + m[0].length - 1] + 1;
    tokens.push({ text, s, e, cs: quoted ? s + 1 : s, ce: quoted ? e - 1 : e });
  }
  return tokens;
}

function sanitizeSegment(s) { // parseCurl.ts:19-21
  return s.replace(/[{}]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}
function inferJsonType(value) { // parseCurl.ts:23-27
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "string";
}
const isNested = (v) => Array.isArray(v) || (typeof v === "object" && v !== null); // parseCurl.ts:30

/* find `needle` inside a token's content and return its absolute range */
function within(tok, needle, from = 0) {
  const i = tok.text.indexOf(needle, from);
  return i < 0 ? null : [tok.cs + i, tok.cs + i + needle.length];
}

export function parseCurl(input) {
  const tokens = tokenize(input);
  const src = {};                 // field id -> [[start, end], ...] in the original text
  const add = (id, ...ranges) => { (src[id] ||= []).push(...ranges.filter(Boolean)); };

  let method, url, data, basicUser;
  let methodTok = null, urlTok = null, dataTok = null, userTok = null;
  const headers = {}, headerTok = {};

  for (let i = 0; i < tokens.length; i++) { // parseCurl.ts:47-65
    const t = tokens[i].text;
    if (t === "curl") continue;
    if (t === "-X" || t === "--request") {
      methodTok = [tokens[i], tokens[i + 1]];
      method = tokens[++i]?.text.toUpperCase();
    } else if (t === "-H" || t === "--header") {
      const tok = tokens[i + 1];
      const header = tokens[++i]?.text ?? "";
      const idx = header.indexOf(":");
      if (idx > -1) {
        const key = header.slice(0, idx).trim();
        headers[key] = header.slice(idx + 1).trim();
        headerTok[key] = [tokens[i - 1], tok];
      }
    } else if (t === "-d" || t === "--data" || t === "--data-raw" || t === "--data-binary" || t === "--data-urlencode") {
      dataTok = [tokens[i], tokens[i + 1]];
      data = tokens[++i]?.text;
    } else if (t === "-u" || t === "--user") {
      userTok = [tokens[i], tokens[i + 1]];
      basicUser = tokens[++i]?.text;
    } else if (t === "--url") {
      urlTok = tokens[i + 1];
      url = tokens[++i]?.text;
    } else if (!t.startsWith("-") && !url) {
      urlTok = tokens[i];
      url = t;
    }
  }

  if (!url) throw new Error("Couldn't find a URL in that curl command.");
  let implied = false;
  if (!method) { method = data ? "POST" : "GET"; implied = true; } // parseCurl.ts:68

  let parsedUrl;
  try { parsedUrl = new URL(url); } catch { throw new Error(`"${url}" isn't a valid URL.`); }

  const params = [];
  const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
  const name = `${method.toLowerCase()}_${pathSegments.map(sanitizeSegment).filter(Boolean).join("_") || "root"}`; // parseCurl.ts:80

  // where things came from
  const tokRange = (t) => t && [t.s, t.e];
  const methodSrc = methodTok ? methodTok.filter(Boolean).map(tokRange) : implied && dataTok ? [tokRange(dataTok[0])] : [];
  const pathRange = urlTok && parsedUrl.pathname !== "/" ? within(urlTok, parsedUrl.pathname.replace(/%7B/gi, "{").replace(/%7D/gi, "}")) || within(urlTok, decodeURI(parsedUrl.pathname)) : null;
  add("method", ...methodSrc);
  add("name", ...methodSrc, pathRange);
  const hostAt = url.toLowerCase().indexOf(parsedUrl.host);
  add("baseUrl", (urlTok && hostAt > -1 && within(urlTok, url.slice(0, hostAt + parsedUrl.host.length))) || tokRange(urlTok));
  add("path", pathRange);

  for (const [key, value] of parsedUrl.searchParams.entries()) { // parseCurl.ts:82-90
    params.push({ name: key, location: "query", type: "string", required: false, description: `From the example curl command (was "${value}")` });
    add("p:" + key, urlTok && within(urlTok, key + "=", url.indexOf("?")));
  }

  let auth = { type: "none" };
  let authValue;
  for (const [key, value] of Object.entries(headers)) { // parseCurl.ts:95-117
    if (key.toLowerCase() === "content-type") continue;
    if (key.toLowerCase() === "authorization") {
      if (/^bearer\s+/i.test(value)) { auth = { type: "bearer" }; authValue = value.replace(/^bearer\s+/i, ""); }
      else if (/^basic\s+/i.test(value)) { auth = { type: "basic" }; authValue = value.replace(/^basic\s+/i, ""); }
      else { auth = { type: "apiKey", headerName: "Authorization" }; authValue = value; }
      add("auth", ...headerTok[key].filter(Boolean).map(tokRange));
      add("authValue", headerTok[key][1] && within(headerTok[key][1], authValue));
      continue;
    }
    params.push({ name: key, location: "header", type: "string", required: true, description: `From the example curl command (was "${value}")` });
    add("p:" + key, ...headerTok[key].filter(Boolean).map(tokRange));
  }

  if (basicUser) { // parseCurl.ts:119-122
    auth = { type: "basic" };
    authValue = btoa(unescape(encodeURIComponent(basicUser)));
    src.auth = []; src.authValue = [];
    add("auth", ...userTok.filter(Boolean).map(tokRange));
    add("authValue", userTok[1] && [userTok[1].cs, userTok[1].ce]);
  }

  if (data) { // parseCurl.ts:124-149
    try {
      const json = JSON.parse(data);
      if (json && typeof json === "object" && !Array.isArray(json)) {
        for (const [key, value] of Object.entries(json)) {
          params.push({
            name: key, location: "body", type: inferJsonType(value), required: true,
            description: isNested(value) // parseCurl.ts:29-35, verbatim
              ? `From the example curl command's JSON body — this is a nested array/object; pass it as a JSON-encoded string, e.g. "${JSON.stringify(value).slice(0, 200)}"`
              : "From the example curl command's JSON body",
            nested: isNested(value),
          });
          add("p:" + key, dataTok[1] && within(dataTok[1], `"${key}"`));
        }
      }
    } catch {
      for (const [key, value] of new URLSearchParams(data).entries()) {
        params.push({ name: key, location: "body", type: "string", required: true, description: `From the example curl command's form body (was "${value}")` });
        add("p:" + key, dataTok[1] && within(dataTok[1], key + "="));
      }
    }
  }

  const operation = { name, method, path: parsedUrl.pathname || "/", params };
  return { kind: "curl", spec: { sourceLabel: `curl: ${parsedUrl.hostname}`, baseUrl: parsedUrl.origin, auth, operations: [operation] }, authValue, src };
}

/* ---------- parseOpenApi.ts ---------- */
const METHODS = ["get", "post", "put", "patch", "delete"];
function resolveRef(doc, ref) {
  const match = /^#\/components\/schemas\/(.+)$/.exec(ref);
  if (!match) return {};
  return doc.components?.schemas?.[match[1]] ?? {};
}
function schemaTypeToParamType(type) {
  if (type === "integer" || type === "number") return "number";
  if (type === "boolean") return "boolean";
  return "string";
}
const sanitizeName = (s) => s.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
function resolveAuth(doc) {
  const schemes = doc.components?.securitySchemes;
  if (!schemes) return { type: "none" };
  const first = Object.values(schemes)[0];
  if (!first) return { type: "none" };
  if (first.type === "http" && first.scheme === "bearer") return { type: "bearer" };
  if (first.type === "http" && first.scheme === "basic") return { type: "basic" };
  if (first.type === "apiKey" && first.in === "header" && first.name) return { type: "apiKey", headerName: first.name };
  return { type: "none" };
}

export function parseOpenApi(input) {
  let doc;
  try { doc = JSON.parse(input); } catch { throw new Error("That's not valid JSON — paste the OpenAPI spec as JSON, not YAML."); }
  const paths = doc.paths;
  if (!paths || typeof paths !== "object") throw new Error('This doesn\'t look like an OpenAPI spec — no top-level "paths" object.');
  const baseUrl = doc.servers?.[0]?.url;
  if (!baseUrl) throw new Error('OpenAPI spec has no "servers[0].url" — add one so Wire knows where to send requests.');
  const auth = resolveAuth(doc);
  const operations = [];
  for (const [path, methods] of Object.entries(paths)) {
    for (const method of METHODS) {
      const op = methods[method];
      if (!op) continue;
      const params = [];
      for (const p of op.parameters ?? []) {
        if (p.in !== "path" && p.in !== "query" && p.in !== "header") continue;
        params.push({ name: p.name, location: p.in, type: schemaTypeToParamType(p.schema?.type), required: p.in === "path" ? true : Boolean(p.required), description: p.description ?? p.name });
      }
      let bodySchema = op.requestBody?.content?.["application/json"]?.schema;
      if (bodySchema?.$ref) bodySchema = resolveRef(doc, bodySchema.$ref);
      if (bodySchema?.properties) {
        const required = new Set(bodySchema.required ?? []);
        for (const [propName, propSchema] of Object.entries(bodySchema.properties)) {
          params.push({ name: propName, location: "body", type: schemaTypeToParamType(propSchema.type), required: required.has(propName), description: propName });
        }
      }
      const name = op.operationId ? sanitizeName(op.operationId) : `${method}_${sanitizeName(path)}`;
      operations.push({ name, description: op.summary || op.description || `${method.toUpperCase()} ${path}`, method: method.toUpperCase(), path, params });
    }
  }
  if (operations.length === 0) throw new Error('No operations found under "paths" in this OpenAPI spec.');
  return { sourceLabel: doc.info?.title ?? "OpenAPI spec", baseUrl, auth, operations };
}

/* ---------- index.ts: one box, no toggle ---------- */
export function parseInput(input) {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Paste an OpenAPI spec (JSON) or a curl command first.");
  if (/^curl\s/i.test(trimmed)) {
    // parseCurl gets the trimmed text; shift its ranges back onto what was pasted
    const lead = input.length - input.trimStart().length;
    const r = parseCurl(trimmed);
    for (const k in r.src) r.src[k] = r.src[k].map(([a, b]) => [a + lead, b + lead]);
    return r;
  }
  try { JSON.parse(trimmed); } catch { throw new Error('Input isn\'t a curl command (must start with "curl") or valid JSON OpenAPI spec.'); }
  return { kind: "openapi", spec: parseOpenApi(trimmed), src: {} };
}

/* compile.ts:9-14, as the line of Zod it builds */
export const zodLine = (p) => `z.${p.type}()${p.required ? "" : ".optional()"}`;
