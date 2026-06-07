/* ============================================================
   CASE STUDY — shared interactions
   Reading-progress bar · scroll reveals · magnetic CTAs · live clock
   Self-contained so it never collides with the portfolio's script.js.
   ============================================================ */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── Scroll reveals ── */
  const revealEls = document.querySelectorAll("[data-reveal]");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
    );
    revealEls.forEach((el) => io.observe(el));
  }

  /* ── Magnetic hover (desktop, pointer:fine) ── */
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  if (finePointer && !reduceMotion) {
    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${x * 0.2}px, ${y * 0.25}px)`;
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "";
      });
    });
  }

  /* ── Stagger reveals ── */
  const staggerEls = document.querySelectorAll("[data-stagger]");
  if (!reduceMotion && "IntersectionObserver" in window) {
    const staggerIo = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            Array.from(entry.target.children).forEach((child, i) => {
              setTimeout(() => child.classList.add("in"), i * 85);
            });
            staggerIo.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -5% 0px", threshold: 0.08 }
    );
    staggerEls.forEach((el) => staggerIo.observe(el));
  } else {
    staggerEls.forEach((el) =>
      Array.from(el.children).forEach((c) => c.classList.add("in"))
    );
  }

  /* ── Stat counters (data-count on .cs-stat__n) ── */
  const statNums = document.querySelectorAll(".cs-stat__n[data-count]");
  if (statNums.length && !reduceMotion && "IntersectionObserver" in window) {
    const countIo = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const target = +el.dataset.count;
          const duration = 1400;
          const start = performance.now();
          const tick = (now) => {
            const t = Math.min((now - start) / duration, 1);
            const v = Math.round((1 - Math.pow(1 - t, 3)) * target);
            if (el.firstChild && el.firstChild.nodeType === 3) {
              el.firstChild.textContent = v.toLocaleString();
            }
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          countIo.unobserve(el);
        });
      },
      { threshold: 0.5 }
    );
    statNums.forEach((el) => countIo.observe(el));
  }

  /* ── Video play buttons ── */
  document.querySelectorAll(".cs-video").forEach((wrap) => {
    const video = wrap.querySelector("video");
    const btn = wrap.querySelector(".cs-video__play");
    if (!btn || !video) return;
    btn.addEventListener("click", () => { video.play(); btn.hidden = true; });
    video.addEventListener("pause", () => { btn.hidden = false; });
    video.addEventListener("ended", () => { btn.hidden = false; });
  });

  /* ── Footer local clock ── */
  const clock = document.getElementById("cs-clock");
  if (clock) {
    const tick = () => {
      clock.textContent = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    };
    tick();
    setInterval(tick, 1000);
  }
})();
