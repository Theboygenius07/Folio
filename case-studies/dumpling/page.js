/* Dumpling's figures. Fig. 2 runs Dumpling's own matching:
   - alike(cos) = clamp((cos - 0.35) / 0.55)                      heard/src/lib/triage.ts:45
   - step: same step 1, next step 0.6, same script 0.3, else 0    triage.ts:30-37
   - first pass = 0.7 * alike + 0.3 * step; under 0.3, never compared  triage.ts:70-75
   - the read's number is held in its verdict's band             src/lib/ai.ts:187-188
   - score = 0.4 * first pass + 0.6 * read; a tester's "same" lifts it to 0.9, "different" caps it at 0.4  triage.ts:90-92
   - the words: linkLabel                                         src/app/ui.tsx:125-134
   - where it ends up: folds at "same" and 0.68 (SAME), waits in "you decide" from 0.45 (MAYBE)  triage.ts:11-12, 131-136 */
(function () {
  "use strict";
  var SAME = 0.68, MAYBE = 0.45;
  var BAND = { same: [0.6, 1], related: [0.25, 0.6], unsure: [0.35, 0.65], different: [0, 0.3] };
  var TONE = { good: "#4cb782", info: "#ea6a32", warn: "#f2994a", ghost: "#6d717a", ink: "#eeeff1" };
  var clamp = function (x, lo, hi) { return Math.max(lo === undefined ? 0 : lo, Math.min(hi === undefined ? 1 : hi, x)); };

  var fig = document.getElementById("match");
  if (fig) {
    var q = function (s) { return fig.querySelector(s); };
    var cosIn = q("[data-cos]"), pIn = q("[data-p]");
    var state = { step: 1, verdict: "same", tester: "" };
    fig.querySelectorAll("[data-pick]").forEach(function (ul) {
      var key = ul.dataset.pick;
      ul.querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () {
          ul.querySelectorAll("button").forEach(function (o) { o.setAttribute("aria-pressed", String(o === b)); });
          state[key] = key === "step" ? parseFloat(b.dataset.v) : b.dataset.v;
          run();
        });
      });
    });
    cosIn.addEventListener("input", run);
    pIn.addEventListener("input", run);

    function label(verdict, score, testerSaid) {
      if (testerSaid) return { text: "Tester confirmed it’s the same", tone: "good" };
      if (verdict === "same" && score >= 0.85) return { text: "Very likely the same", tone: "good" };
      if (verdict === "same" && score >= SAME) return { text: "Likely the same", tone: "good" };
      if (verdict === "related") return { text: "Related, probably not the same", tone: "info" };
      if (verdict === "different") return { text: "Probably different", tone: "ghost" };
      return { text: "Not sure: your call", tone: "warn" };
    }

    function run() {
      var cos = cosIn.value / 100, raw = pIn.value / 100;
      var testerSaid = state.tester === "same", testerDiffers = state.tester === "different";
      var alike = clamp((cos - 0.35) / 0.55);
      var pre = 0.7 * alike + 0.3 * state.step;
      var band = BAND[state.verdict], p = clamp(raw, band[0], band[1]);
      var compared = pre >= 0.3 || testerSaid;
      var score = compared ? 0.4 * pre + 0.6 * p : pre;
      if (testerSaid) score = Math.max(score, 0.9);
      if (testerDiffers) score = Math.min(score, 0.4);
      var verdict = testerDiffers ? "different" : testerSaid && state.verdict !== "different" ? "same" : state.verdict;
      var dropped = !compared || (verdict === "different" && score < MAYBE && !testerSaid && !testerDiffers);
      var l = dropped ? { text: "No link", tone: "ghost" } : label(verdict, score, testerSaid);

      q("[data-cos-out]").textContent = cos.toFixed(2);
      q("[data-p-out]").textContent = Math.round(raw * 100) + "%";
      q("[data-step-b]").textContent = state.step === 1 ? "3" : state.step === 0.6 ? "4" : state.step === 0.3 ? "9" : "2";
      q("[data-label]").textContent = l.text;
      q("[data-label]").style.color = TONE[l.tone];
      var m = q("[data-meter]"); m.style.width = Math.round(score * 100) + "%"; m.style.backgroundColor = TONE[l.tone] === TONE.ink ? TONE.info : TONE[l.tone];
      q("[data-pct]").textContent = Math.round(score * 100) + "%";

      var fate;
      if (!compared) fate = "<b>Never compared.</b> The first pass is under 0.3, so they&rsquo;re too far apart to check.";
      else if (testerDiffers) fate = "<b>Kept apart.</b> The tester said theirs is different.";
      else if (testerSaid || (verdict === "same" && score >= SAME)) fate = "<b>Folds into the bug.</b> Still a proposal until the manager acts.";
      else if (score >= MAYBE && !dropped) fate = "<b>Might be the same problem.</b> It waits outside the group for the manager to decide.";
      else fate = "<b>Kept apart.</b> Too unlike to suggest.";
      q("[data-fate]").innerHTML = fate;

      q('[data-r="alike"]').textContent = alike.toFixed(2);
      q('[data-r="step"]').textContent = state.step.toFixed(1);
      q('[data-r="pre"]').textContent = pre.toFixed(2);
      q('[data-r="p"]').textContent = compared ? p.toFixed(2) : "none";
      q('[data-r="band"]').textContent = compared ? "held in " + band[0].toFixed(2) + " to " + band[1].toFixed(2) : "";
      q('[data-r="score"]').textContent = score.toFixed(2);
    }
    run();
  }

  // Fig. 3: the draft ticket
  var tk = document.getElementById("ticket");
  if (tk) {
    var sev = tk.querySelectorAll("[data-sev]"), over = tk.querySelector("[data-over]"), create = tk.querySelector("[data-create]"), foot = tk.querySelector("[data-foot]");
    var SAY = { blocker: "Nobody can pay, so testing stops here.", major: "Payments can’t be completed on the first try.", minor: "Payments work, with a problem.", cosmetic: "Looks wrong, works." };
    sev.forEach(function (b) {
      b.addEventListener("click", function () {
        if (create.disabled) return;
        sev.forEach(function (o) { o.setAttribute("aria-checked", String(o === b)); });
        tk.querySelector("[data-say]").textContent = SAY[b.dataset.sev];
        over.hidden = b.dataset.sev === "major";
      });
    });
    create.addEventListener("click", function () {
      if (create.disabled) {
        return;
      }
      create.disabled = true;
      create.textContent = "Ticket created";
      foot.innerHTML = 'All 3 testers were told and credited. <button type="button" class="link-btn" data-again style="color:inherit;font-size:inherit">Start again</button>';
      foot.querySelector("[data-again]").addEventListener("click", function () {
        create.disabled = false; create.textContent = "Create ticket";
        foot.textContent = "All 3 testers are told and credited.";
        sev.forEach(function (o) { o.setAttribute("aria-checked", String(o.dataset.sev === "major")); });
        tk.querySelector("[data-say]").textContent = SAY.major; over.hidden = true;
      });
    });
  }
})();
