/* Saleena Tiwari case study: wires each live figure. Every figure is built the
   first time it comes near the screen and paused when it leaves (Study.onVisible).
   The maths they share lives in rig.js, ported from the showcase's source. */
const Study = window.Study;

function lazy(el, load, margin) {
  if (!el) return;
  let api = null, loading = null, want = false;
  Study.onVisible(el, () => {
    want = true;
    if (api) return api.start();
    if (!loading) loading = load().then((a) => { api = a; if (want) api.start(); }).catch((e) => console.error(e));
  }, () => { want = false; api && api.stop(); }, margin);
}

lazy(document.getElementById("stair"), () => import("./stair.js").then((m) => m.mountStair(document.getElementById("stair"))), "300px 0px");
lazy(document.getElementById("fails"), () => import("./fails.js").then((m) => m.mountFails(document.getElementById("fails"))));
lazy(document.getElementById("oneScrolly"), () => import("./plots.js").then((m) => m.mountOne(document.getElementById("oneScrolly"))));
lazy(document.getElementById("moveFig"), () => import("./plots.js").then((m) => m.mountMove(document.getElementById("moveFig"))));
lazy(document.getElementById("camFig"), () => import("./plots.js").then((m) => m.mountCam(document.getElementById("camFig"))));
lazy(document.getElementById("lightFig"), () => import("./light.js").then((m) => m.mountLight(document.getElementById("lightFig"))));
lazy(document.getElementById("flexFig"), () => import("./flex.js").then((m) => m.mountFlex(document.getElementById("flexFig"))));
lazy(document.getElementById("mediaFig"), () => import("./media.js").then((m) => m.mountMedia(document.getElementById("mediaFig"))));

