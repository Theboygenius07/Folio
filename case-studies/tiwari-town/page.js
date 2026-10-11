/* Tiwari Town case study: wires each live figure. Every figure is built the first
   time it comes near the screen and paused when it leaves (Study.onVisible). The
   numbers they share live in world.js, ported from the game's source. */
const Study = window.Study;

// remember how the reader last moved, so focus rings only show for the keyboard
const root = document.documentElement;
addEventListener("pointerdown", () => { root.dataset.input = "mouse"; }, true);
addEventListener("keydown", (e) => { if (e.key === "Tab" || e.key.startsWith("Arrow")) root.dataset.input = "kbd"; }, true);

function lazy(id, load, margin) {
  const el = document.getElementById(id);
  if (!el) return;
  let api = null, loading = null, want = false;
  Study.onVisible(el, () => {
    want = true;
    if (api) return api.start();
    if (!loading) loading = load(el).then((a) => { api = a; if (want) api.start(); }).catch((e) => console.error(e));
  }, () => { want = false; api && api.stop(); }, margin);
}

lazy("mapFig", (el) => import("./map.js").then((m) => m.mountMap(el)), "400px 0px");
lazy("dogBuild", (el) => import("./dog-build.js").then((m) => m.mountDogBuild(el)), "300px 0px");
lazy("dogGait", (el) => import("./dog-gait.js").then((m) => m.mountDogGait(el)), "300px 0px");
lazy("lightFig", (el) => import("./light.js").then((m) => m.mountLight(el)));
lazy("voiceFig", (el) => import("./voice.js").then((m) => m.mountVoice(el)));
lazy("c4Fig", (el) => import("./c4.js").then((m) => m.mountC4(el)));
lazy("raceFig", (el) => import("./race.js").then((m) => m.mountRace(el)));
lazy("moveFig", (el) => import("./move.js").then((m) => m.mountMove(el)));
lazy("gateFig", (el) => import("./gate.js").then((m) => m.mountGate(el)));
