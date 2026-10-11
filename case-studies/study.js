/* Case studies, v2: the behaviours every page shares, and a small API for
   the live figures each page builds on top.

     Study.reduce                      true when the reader asked for less motion
     Study.hover                       true on a device with a real pointer
     Study.onVisible(el, start, stop)  start() the first time and every time el comes
                                       near the screen, stop() when it leaves. Use it to
                                       build heavy figures late and pause them off screen.
     Study.raf(fn)                     one shared animation loop; fn(t, dt) runs each
                                       frame until it returns false. dt is in seconds.

   Declarative pieces, wired automatically:
     video[data-src]                   loads near the screen, plays only while on it
     .live[data-src]                   a poster until asked, then the real site in place
     .scrolly                          marks the step in view with .is-on, sets
                                       data-step on the .scrolly, fires "step" (detail.index)
     .reel[data-chapters]              chapter bars under a full-bleed video
     .toc                              shows mid-article, marks the section you're in
*/
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hover = matchMedia("(hover: hover)").matches;

  const onVisible = (el, start, stop, margin = "200px 0px") => {
    let on = false;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !on) { on = true; start && start(); }
      else if (!e.isIntersecting && on) { on = false; stop && stop(); }
    }, { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  };

  const loops = new Set();
  let last = 0, running = false;
  const tick = (t) => {
    const dt = Math.min(0.05, (t - (last || t)) / 1000);
    last = t;
    loops.forEach((fn) => { if (fn(t, dt) === false) loops.delete(fn); });
    if (loops.size) requestAnimationFrame(tick); else { running = false; last = 0; }
  };
  const raf = (fn) => { loops.add(fn); if (!running) { running = true; requestAnimationFrame(tick); } return () => loops.delete(fn); };

  window.Study = { reduce, hover, onVisible, raf };

  /* Videos load when they come near the screen and play only while they are on it.
     With reduced motion they wait for a press of play instead. */
  document.querySelectorAll("video[data-src]").forEach((v) => {
    onVisible(v, () => {
      if (!v.src) { v.src = v.dataset.src; if (reduce) v.controls = true; }
      if (!reduce) v.play().catch(() => {});
    }, () => v.pause(), "0px");
  });

  /* Live windows show a poster until asked, then load the real site in place. */
  document.querySelectorAll(".live").forEach((live) => {
    const go = live.querySelector(".live-go");
    const frame = live.querySelector(".live-frame");
    if (!go || !frame) return;
    go.addEventListener("click", () => {
      const f = document.createElement("iframe");
      f.src = live.dataset.src;
      f.title = live.dataset.title || "Live site";
      f.allow = "fullscreen; autoplay; xr-spatial-tracking";
      frame.appendChild(f);
      live.classList.add("is-on");
      f.focus();
    });
  });

  /* Scrollytelling: the step crossing the middle of the screen is the current one. */
  document.querySelectorAll(".scrolly").forEach((s) => {
    const steps = [...s.querySelectorAll(".step")];
    const set = (i) => {
      if (s.dataset.step === String(i)) return;
      s.dataset.step = String(i);
      steps.forEach((st, j) => st.classList.toggle("is-on", j === i));
      s.dispatchEvent(new CustomEvent("step", { detail: { index: i, step: steps[i] } }));
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) set(steps.indexOf(e.target)); });
    }, { rootMargin: "-45% 0px -50% 0px" });
    steps.forEach((st) => io.observe(st));
    set(0);
  });

  /* Reel chapters: data-chapters='[{"title":"…","at":0}, …]' on the .reel */
  document.querySelectorAll(".reel[data-chapters]").forEach((reel) => {
    const v = reel.querySelector("video");
    const list = reel.querySelector(".reel-chapters");
    let ch = [];
    try { ch = JSON.parse(reel.dataset.chapters); } catch (e) { return; }
    if (!v || !list || !ch.length) return;
    list.innerHTML = ch.map((c, i) => `<li><button type="button" data-i="${i}"><i><s></s></i><span>${c.title}</span></button></li>`).join("");
    const btns = [...list.querySelectorAll("button")];
    btns.forEach((b) => b.addEventListener("click", () => { v.currentTime = ch[+b.dataset.i].at + 0.01; v.play().catch(() => {}); }));
    v.addEventListener("timeupdate", () => {
      const t = v.currentTime, d = v.duration || 1;
      btns.forEach((b, i) => {
        const a = ch[i].at, z = i + 1 < ch.length ? ch[i + 1].at : d;
        const f = Math.max(0, Math.min(1, (t - a) / (z - a)));
        b.querySelector("s").style.setProperty("--f", f.toFixed(3));
        b.setAttribute("aria-current", String(t >= a && t < z));
      });
    });
  });

  /* Contents: appears once the article starts, and marks the section you are in. */
  const toc = document.querySelector(".toc");
  if (toc) {
    const links = [...toc.querySelectorAll("a[href^='#']")];
    const sections = links.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);
    const head = document.querySelector(".a-head");
    const tail = document.querySelector(".next") || document.querySelector("footer");
    let pastHead = false, atTail = false, blocked = false;
    const show = () => toc.classList.toggle("is-on", pastHead && !atTail && !blocked);

    /* The contents sit in the left margin, and wide figures reach into it. When one
       would pass under the list, the list steps aside until it has gone by. */
    const WIDE = ".stage, .fig, .pair, .trio, .live, .scrolly-fig, .reel, .wide, .ba, .process, .quote, [data-wide]";
    let queued = false;
    const check = () => {
      queued = false;
      if (getComputedStyle(toc).display === "none") return;
      const t = toc.getBoundingClientRect();
      const pad = 24;
      // queried each time: pages build some of their figures after this script runs
      const hit = [...document.querySelectorAll(WIDE)].some((el) => {
        const r = el.getBoundingClientRect();
        return r.left < t.right + pad && r.right > t.left - pad && r.top < t.bottom + pad && r.bottom > t.top - pad;
      });
      if (hit !== blocked) { blocked = hit; show(); }
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(check); } };
    addEventListener("scroll", queue, { passive: true });
    addEventListener("resize", queue);
    setInterval(queue, 500); // catches jumps that fire no scroll, and figures that grow in place
    queue();
    if (head) new IntersectionObserver(([e]) => { pastHead = !e.isIntersecting && e.boundingClientRect.top < 0; show(); }).observe(head);
    if (tail) new IntersectionObserver(([e]) => { atTail = e.isIntersecting; show(); }).observe(tail);
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.setAttribute("aria-current", String(a.getAttribute("href") === "#" + e.target.id)));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach((s) => spy.observe(s));
  }
})();
