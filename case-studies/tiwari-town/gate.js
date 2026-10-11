/* Fig. 10: the door under the tower.

     world/vistas/TechTower.ts            the gate, with window.open and with a hidden link
     config.ts:5,15                                 DESTINATION_URL, destinationConfigured() */
import { Study, s, txt, fitSvg, tabs } from "./util.js";

const CODE = {
  before: [
    ["interact(): boolean {", "", 0],
    ["  if (!this.near) return false;", "near", 1],
    ["  const opened = window.open(DESTINATION_URL, '_blank', 'noopener,noreferrer');", "open", 2],
    ["  if (!opened) window.location.href = DESTINATION_URL;", "away", 3],
    ["  return true;", "done", 4],
    ["}", "", 0],
  ],
  after: [
    ["interact(): boolean {", "", 0],
    ["  if (!this.near) return false;", "near", 1],
    ["  if (!destinationConfigured()) return false;", "conf", 2],
    ["", "", 0],
    ["  const a = document.createElement('a');", "make", 3],
    ["  a.href = DESTINATION_URL;", "make", 3],
    ["  a.target = '_blank';", "make", 3],
    ["  a.rel = 'noopener noreferrer';", "make", 3],
    ["  a.style.display = 'none';", "make", 3],
    ["  document.body.appendChild(a);", "make", 3],
    ["  a.click();", "open", 4],
    ["  a.remove();", "done", 5],
    ["  return true;", "done", 5],
    ["}", "", 0],
  ],
};
/* what each step does to the tabs */
const STEPS = {
  before: [
    { tab2: false, away: false, say: "She's within 9 m of the door. E." },
    { tab2: false, away: false, say: "She's within 9 m of the door. E." },
    { tab2: true, away: false, say: "The showcase opens in a new tab. window.open returns null: noopener means no handle, by design." },
    { tab2: true, away: true, bad: true, say: "null was read as a blocked popup, so the fallback sends this tab to the showcase too. The world is gone." },
    { tab2: true, away: true, say: "The goodbye plays over a world she has just lost." },
  ],
  after: [
    { tab2: false, away: false, say: "She's within 9 m of the door. E." },
    { tab2: false, away: false, say: "She's within 9 m of the door. E." },
    { tab2: false, away: false, say: "The destination is checked before anything opens." },
    { tab2: false, away: false, say: "A hidden link, with the same target and the same noopener." },
    { tab2: true, away: false, say: "Clicked in code: the showcase opens in a new tab. Nothing comes back to misread." },
    { tab2: true, away: false, say: "The world tab keeps its address and its world. She can come back to it." },
  ],
};

export function mountGate(fig) {
  const pre = fig.querySelector(".gt-code");
  const svg = fig.querySelector(".gt-tabs");
  const press = fig.querySelector(".gt-press");
  const tintInk = getComputedStyle(document.body).getPropertyValue("--tint-ink").trim() || "#2a6db0";
  const ink = "#1d1b18", ink2 = "#67625a", ink3 = "#9a958b", rule = "#e0dbd0", bad = "#b8432f";
  let ver = "before", step = 0, timer = null;

  function renderCode() {
    pre.innerHTML = CODE[ver].map(([t, , k]) => `<span data-k="${k}"${t.trim().startsWith("interact") || t === "}" ? ' class="c"' : ""}>${esc(t) || " "}</span>`).join("");
  }
  const esc = (t) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  function paintCode() {
    const st = STEPS[ver][step];
    pre.querySelectorAll("span").forEach((sp) => {
      const k = +sp.dataset.k;
      sp.classList.toggle("is-on", step > 0 && k === step && !(st.bad && k === step));
      sp.classList.toggle("is-bad", step > 0 && k === step && !!st.bad);
    });
  }

  let V = null;
  fitSvg(svg, (w) => (w < 400 ? 340 : 390), (w, h) => {
    svg.textContent = "";
    const winH = (h - 66) / 2;
    const mk = (y, label) => {
      const g = s("g", { transform: `translate(0 ${y})` }, svg);
      s("rect", { x: 0.75, y: 0.75, width: w - 1.5, height: winH, rx: 6, fill: "#fbfaf6", stroke: rule, "stroke-width": 1.5 }, g);
      s("line", { x1: 0, x2: w, y1: 28, y2: 28, stroke: rule }, g);
      const tabLab = txt(g, 12, 18, label, { fill: ink, "font-size": 12, "font-weight": 600, style: "font-family: var(--font)" });
      const url = txt(g, w - 12, 18, "", { "text-anchor": "end", fill: ink2, "font-size": 11.5, style: "font-family: var(--mono)" });
      const body = s("g", {}, g);
      return { g, url, body, tabLab };
    };
    const t1 = mk(0, "Tab 1");
    const t2 = mk(winH + 14, "Tab 2");
    const say = txt(svg, 0, h - 30, "", { fill: ink, "font-size": 13, style: "font-family: var(--font)" });
    const say2 = txt(svg, 0, h - 12, "", { fill: ink, "font-size": 13, style: "font-family: var(--font)" });
    V = { w, h, winH, t1, t2, say, say2 };
    paintTabs();
  });

  function world(g, w, hh) {
    // the Tech Tower, as she sees it when she arrives: the live site's own capture
    s("image", { href: "media/tiwari-town/pin-tech.webp", x: 1.5, y: 29, width: w - 3, height: hh - 30, preserveAspectRatio: "xMidYMid slice" }, g);
  }
  function showcase(g, w, hh, note) {
    s("rect", { x: 1.5, y: 29, width: w - 3, height: hh - 30.5, fill: "#3f5140", rx: 0 }, g);
    txt(g, w / 2, 29 + (hh - 30) / 2 + 4, note, { "text-anchor": "middle", fill: "#e8efe6", "font-size": 12.5, style: "font-family: var(--font)" });
  }
  function paintTabs() {
    if (!V) return;
    const st = STEPS[ver][step];
    const { w, winH, t1, t2, say, say2 } = V;
    t1.body.textContent = ""; t2.body.textContent = "";
    if (st.away) { t1.url.textContent = "saleena-3dshowcase.vercel.app"; t1.url.setAttribute("fill", bad); showcase(t1.body, w, winH, "the world was here"); }
    else { t1.url.textContent = "tiwari-nine.vercel.app"; t1.url.setAttribute("fill", ink2); world(t1.body, w, winH); }
    t2.g.setAttribute("opacity", st.tab2 ? 1 : 0.28);
    if (st.tab2) { t2.url.textContent = "saleena-3dshowcase.vercel.app"; showcase(t2.body, w, winH, "the next present"); }
    else { t2.url.textContent = ""; txt(t2.body, w / 2, 29 + (winH - 30) / 2 + 4, "no second tab yet", { "text-anchor": "middle", fill: ink3, "font-size": 12, style: "font-family: var(--font)" }); }
    // the line under the windows, wrapped to two lines by hand
    const words = (step === 0 ? "Press E at the door to run it." : st.say).split(" ");
    const max = Math.floor(w / 7.2);
    let a = "", b = "";
    for (const wd of words) { if ((a + " " + wd).trim().length <= max && !b) a = (a + " " + wd).trim(); else b = (b + " " + wd).trim(); }
    say.textContent = a; say2.textContent = b;
    say.setAttribute("fill", st.bad ? bad : ink); say2.setAttribute("fill", st.bad ? bad : ink);
  }

  function setStep(i) { step = i; paintCode(); paintTabs(); }
  function run() {
    clearTimeout(timer);
    const n = STEPS[ver].length;
    if (Study.reduce) { setStep(n - 1); return; }
    let i = 1;
    setStep(i);
    const next = () => { i++; if (i < n) { setStep(i); timer = setTimeout(next, 1500); } };
    timer = setTimeout(next, 1100);
  }
  press.addEventListener("click", run);
  fig.addEventListener("keydown", (e) => { if ((e.key === "e" || e.key === "E") && fig.contains(document.activeElement)) { run(); e.preventDefault(); } });
  tabs(fig.querySelector('[aria-label="Which version"]'), "data-ver", (v) => { clearTimeout(timer); ver = v; renderCode(); setStep(0); });

  renderCode(); setStep(0);
  return { start() {}, stop() { clearTimeout(timer); } };
}
