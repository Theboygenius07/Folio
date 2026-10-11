/* Wire case study: wires up the live figures. Each one builds the first time it comes
   near the screen and pauses when it leaves (Study.onVisible), and each one is a port of
   the file named at the top of its module, with the original constants.

   Fig. 1  hero.js        app/page.tsx + RepelDotGrid.tsx
   Fig. 2  engine.js      lib/gateway/types.ts, compile.ts, lib/openai/agent.ts, lib/mcp/server.ts
   Fig. 3  typewriter.js  components/customer/FlowCreator.tsx
   Fig. 4  shapes.js      lib/flow/create.ts
   Fig. 5  dashboard.js   app/dashboard/[slug]/page.tsx
   Fig. 7  compiler.js    lib/gateway/parseCurl.ts, parseOpenApi.ts, index.ts (via parse.js)
   Fig. 8  dotsfig.js     HeroParticles.tsx + RepelDotGrid.tsx (via dots.js) */
import { initHero } from "./hero.js";
import { initEngine } from "./engine.js";
import { initTypewriter } from "./typewriter.js";
import { initShapes } from "./shapes.js";
import { initDashboard } from "./dashboard.js";
import { initCompiler } from "./compiler.js";
import { initDots } from "./dotsfig.js";

const ready = () => new Promise((res) => {
  if (window.Study) return res();
  document.addEventListener("DOMContentLoaded", () => res(), { once: true });
});

await ready();

const run = (name, fn, ...args) => {
  if (!args[0]) return;
  try { fn(...args); } catch (e) { console.error(`wire: ${name} failed`, e); }
};
const q = (s) => document.querySelector(s);
run("hero", initHero, q("#hero"));
run("engine", initEngine, q("#fe"));
run("typewriter", initTypewriter, q("#ft"));
run("shapes", initShapes, q("#fs"));
run("dashboard", initDashboard, q("#fd"));
run("compiler", initCompiler, q("#fc"));
run("dots", initDots, q("#fg"));

