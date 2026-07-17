/* ============================================================
   Seyi Ogundipe — Portfolio interactions (vanilla JS)
   ============================================================ */

/* ── Sound — tiny synthesized UI cues, ported from Cohort's own Sound
   module so both sites share one sonic identity. No audio files: every
   sound is a couple of oscillators/noise bursts shaped with gain ramps.
   Lazily creates its AudioContext on first call (satisfies autoplay
   policies, since every call site is itself a user gesture handler). ── */
window.Sound = {
  ctx: null,

  init() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (_) { return; }
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  },

  tone(freq, start, dur, vol = 0.1, type = "sine") {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.connect(g); g.connect(this.ctx.destination);
    o.type = type; o.frequency.value = freq;
    const t = this.ctx.currentTime + start;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.01);
  },

  hover()  { this.init(); this.tone(900, 0, 0.04, 0.028); },
  pop()    { this.init(); this.tone(780, 0, 0.09, 0.09); this.tone(1020, 0.06, 0.08, 0.06); },
  tick()   { this.init(); this.tone(680, 0, 0.07, 0.07); this.tone(500, 0.05, 0.07, 0.05); },
  party()  { this.init(); [[523,0],[659,.08],[784,.16],[1047,.25]].forEach(([f,s]) => this.tone(f, s, .22, .09)); },

  switchLight(on) {
    this.init();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t   = ctx.currentTime;

    // the physical snap: broadband noise, near-instant exponential decay
    const snapLen = Math.floor(ctx.sampleRate * 0.028);
    const snapBuf = ctx.createBuffer(1, snapLen, ctx.sampleRate);
    const snapD   = snapBuf.getChannelData(0);
    for (let i = 0; i < snapLen; i++) {
      snapD[i] = (Math.random() * 2 - 1) * Math.exp(-i / (snapLen * 0.07));
    }
    const snap  = ctx.createBufferSource();
    snap.buffer = snapBuf;
    const bp    = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 1900; bp.Q.value = 0.6;
    const snapG = ctx.createGain();
    snapG.gain.setValueAtTime(on ? 0.85 : 0.7, t);
    snap.connect(bp); bp.connect(snapG); snapG.connect(ctx.destination);
    snap.start(t); snap.stop(t + 0.03);

    // low body thud: the switch housing resonating
    const thudLen = Math.floor(ctx.sampleRate * 0.05);
    const thudBuf = ctx.createBuffer(1, thudLen, ctx.sampleRate);
    const thudD   = thudBuf.getChannelData(0);
    for (let i = 0; i < thudLen; i++) {
      const env = Math.exp(-i / (thudLen * 0.2));
      thudD[i]  = Math.sin(2 * Math.PI * (on ? 95 : 75) * i / ctx.sampleRate) * env;
    }
    const thud  = ctx.createBufferSource();
    thud.buffer = thudBuf;
    const thudG = ctx.createGain();
    thudG.gain.setValueAtTime(0.18, t + 0.004);
    thud.connect(thudG); thudG.connect(ctx.destination);
    thud.start(t + 0.004); thud.stop(t + 0.06);

    if (on) {
      const osc  = ctx.createOscillator();
      const humG = ctx.createGain();
      osc.type = "sine"; osc.frequency.value = 120;
      humG.gain.setValueAtTime(0, t + 0.02);
      humG.gain.linearRampToValueAtTime(0.032, t + 0.05);
      humG.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(humG); humG.connect(ctx.destination);
      osc.start(t + 0.02); osc.stop(t + 0.23);
    }
  },
};

(() => {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  // `?still` renders all animated content immediately (handy for screenshots / print)
  const still = new URLSearchParams(location.search).has("still");
  if (still) document.body.classList.add("is-still");

  /* ---------------------------------------------------------
     1. Scroll reveal
  --------------------------------------------------------- */
  const reveals = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && !prefersReduced && !still) {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          const delay = Math.min(i * 0.06, 0.24);
          const g = window.gsap;
          e.target.classList.add("is-in");

          if (g && e.target.classList.contains("exp")) {
            // Exp items: reveal container instantly, stagger inner text
            g.set(e.target, { opacity: 1, y: 0 });
            const meta = e.target.querySelector(".exp__meta");
            const narr = e.target.querySelector(".exp__narrative");
            const els  = [meta, narr].filter(Boolean);
            g.fromTo(els,
              { opacity: 0, y: 12 },
              { opacity: 1, y: 0, duration: 0.8, stagger: 0.18, ease: "power2.out", delay }
            );
          } else if (g) {
            g.fromTo(e.target,
              { opacity: 0, y: 18 },
              { opacity: 1, y: 0, duration: 0.85, ease: "power2.out", delay }
            );
          } else {
            e.target.style.opacity = "1";
            e.target.style.transform = "none";
          }

          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("is-in"));
  }

  const projectsList = document.getElementById("projects");

  /* ---------------------------------------------------------
     2b. Glass cursor note — "Case study being developed" label
     that trails the pointer while hovering an individual project
     card. Tracking is bound per-card (not the shared list), so it
     can only ever be live while the pointer is actually over a
     card — never across the gaps or the section header.
  --------------------------------------------------------- */
  const cursorNote = document.getElementById("cursor-note");
  if (cursorNote && projectsList && canHover && !prefersReduced) {
    const cards = projectsList.querySelectorAll(".project");
    let noteTargetX = 0, noteTargetY = 0, noteCurX = 0, noteCurY = 0;
    let noteVisible = false, noteRaf = null;

    const noteLerp = (a, b, n) => a + (b - a) * n;

    const renderNote = () => {
      const prevX = noteCurX;
      noteCurX = noteLerp(noteCurX, noteTargetX, 0.13);
      noteCurY = noteLerp(noteCurY, noteTargetY, 0.13);
      // gentle velocity-based tilt — the same trick the old floating preview
      // used — is what makes the trail read as fluid instead of just laggy.
      const tilt = Math.max(-8, Math.min(8, (noteCurX - prevX) * 0.5));
      cursorNote.style.setProperty("--cnx", `${noteCurX}px`);
      cursorNote.style.setProperty("--cny", `${noteCurY}px`); // centered directly on the cursor
      cursorNote.style.setProperty("--cnr", `${tilt}deg`);
      noteRaf = requestAnimationFrame(renderNote);
    };
    const startNote = () => { if (!noteRaf) noteRaf = requestAnimationFrame(renderNote); };
    const stopNote = () => { if (noteRaf) { cancelAnimationFrame(noteRaf); noteRaf = null; } };

    cards.forEach((card) => {
      card.addEventListener("mouseenter", (e) => {
        noteVisible = true;
        // snap the start point to the entry position so it doesn't fly in
        // from wherever it last was over a different card.
        noteTargetX = noteCurX = e.clientX;
        noteTargetY = noteCurY = e.clientY;
        cursorNote.classList.add("is-visible");
        startNote();
      });
      card.addEventListener("mousemove", (e) => {
        noteTargetX = e.clientX; noteTargetY = e.clientY;
      });
      card.addEventListener("mouseleave", () => {
        noteVisible = false;
        cursorNote.classList.remove("is-visible");
        setTimeout(() => { if (!noteVisible) stopNote(); }, 300);
      });
    });
  }

  /* ---------------------------------------------------------
     3. Magnetic elements
  --------------------------------------------------------- */
  if (canHover && !prefersReduced) {
    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      const strength = 0.28;
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) * strength;
        const y = (e.clientY - (r.top + r.height / 2)) * strength;
        el.style.transform = `translate(${x}px, ${y}px)`;
      });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });
    });
  }

  /* ---------------------------------------------------------
     3b. Inline hero photo — 3D tilt + pop on hover
  --------------------------------------------------------- */
  if (canHover && !prefersReduced) {
    document.querySelectorAll("[data-tilt]").forEach((el) => {
      const maxTilt = 22;   // degrees
      const lift = 2.6 / 1.6; // base is 1.6em, hover pops to 2.6em
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;   // 0..1 across the image
        const py = (e.clientY - r.top) / r.height;
        const rotY = (px - 0.5) * maxTilt * 2;
        const rotX = (0.5 - py) * maxTilt * 2;
        el.style.transform =
          `perspective(400px) scale(${lift}) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
      });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });
    });
  }

  /* ---------------------------------------------------------
     4. Count-up stats
  --------------------------------------------------------- */
  const counters = document.querySelectorAll(".stat__num[data-count]");
  if (still) {
    counters.forEach((c) => { c.textContent = c.getAttribute("data-count"); });
  } else if ("IntersectionObserver" in window && !prefersReduced && counters.length) {
    const cio = new IntersectionObserver((entries, obs) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        const end = parseInt(el.getAttribute("data-count"), 10) || 0;
        const dur = 1100;
        const t0 = performance.now();
        const tick = (t) => {
          const p = Math.min((t - t0) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(end * eased);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        obs.unobserve(el);
      });
    }, { threshold: 0.6 });
    counters.forEach((c) => cio.observe(c));
  }

  /* ---------------------------------------------------------
     4b. Project cover fan animation
  --------------------------------------------------------- */
  if (canHover && !prefersReduced) {
    document.querySelectorAll(".project").forEach((card) => {
      const img   = card.querySelector(".project__cover img");
      const video = card.querySelector(".project__reel");
      if (!img) return;
      const g = window.gsap;
      if (!g) return;

      card.addEventListener("mouseenter", () => {
        // fan the still image
        g.killTweensOf(img);
        g.fromTo(img, { scale: 1, x: "-4%" }, { scale: 1.06, x: "4%", duration: 2.8, ease: "sine.inOut" });

        // lazy-load + play video over the still
        if (video) {
          g.killTweensOf(video);
          if (!video.src && video.dataset.src) video.src = video.dataset.src;
          const p = video.play();
          if (p) p.catch(() => {});
          g.to(video, { opacity: 1, duration: 0.5, ease: "power2.out" });
        }
      });

      card.addEventListener("mouseleave", () => {
        g.killTweensOf(img);
        g.to(img, { scale: 1, x: "0%", duration: 0.7, ease: "power2.out" });

        if (video) {
          g.killTweensOf(video);
          g.to(video, { opacity: 0, duration: 0.4, ease: "power2.in",
            onComplete: () => video.pause() });
        }
      });
    });
  }

  /* ---------------------------------------------------------
     5. Live clock (viewer's local time)
  --------------------------------------------------------- */
  const clock = document.getElementById("clock");
  if (clock) {
    const pad = (n) => String(n).padStart(2, "0");
    const tick = () => {
      const d = new Date();
      clock.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------------------------------------------------------
     6. Guard placeholder social links
  --------------------------------------------------------- */
  document.querySelectorAll('a[data-todo]').forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      console.info(`Add your ${a.dataset.todo} URL in index.html`);
    });
  });


  /* ---------------------------------------------------------
     Experience section interactions
  --------------------------------------------------------- */
  (function () {
    const noMotion = prefersReduced;

    /* ── Pill expand on hover — GSAP height-lock + fade ── */
    document.querySelectorAll(".exp__pill[data-for]").forEach((pill) => {
      const reveal = document.getElementById(pill.dataset.for);
      if (!reveal) return;
      const g = window.gsap;

      const doOpen = () => {
        if (pill.classList.contains("is-open")) return;
        const para = reveal.closest("p");
        if (g) { g.killTweensOf(reveal); if (para) g.killTweensOf(para); }

        const h0 = para ? para.offsetHeight : 0;
        pill.classList.add("is-open");
        pill.setAttribute("aria-expanded", "true");
        reveal.style.display = "inline";
        const h1 = para ? para.offsetHeight : 0;
        const dur = Math.min(0.55, 0.28 + Math.abs(h1 - h0) / 1500);

        if (g && para && h0 !== h1) {
          para.style.height = h0 + "px";
          para.style.overflow = "hidden";
          g.fromTo(para, { height: h0 }, {
            height: h1, duration: dur, ease: "power3.out",
            onComplete() { para.style.height = ""; para.style.overflow = ""; },
          });
        }
        if (g) g.fromTo(reveal, { opacity: 0 }, { opacity: 1, duration: 0.28, ease: "power2.out" });
        Sound.pop();
      };

      const doClose = () => {
        if (!pill.classList.contains("is-open")) return;
        const para = reveal.closest("p");
        if (g) { g.killTweensOf(reveal); if (para) g.killTweensOf(para); }

        const h0 = para ? para.offsetHeight : 0;
        pill.classList.remove("is-open");
        pill.setAttribute("aria-expanded", "false");
        reveal.style.display = "none";
        const h1 = para ? para.offsetHeight : 0;
        reveal.style.display = "inline";
        const dur = Math.min(0.45, 0.22 + Math.abs(h1 - h0) / 1500);

        if (g && para && h0 !== h1) {
          para.style.height = h0 + "px";
          para.style.overflow = "hidden";
          g.fromTo(para, { height: h0 }, {
            height: h1, duration: dur, ease: "power3.inOut",
            onComplete() { para.style.height = ""; para.style.overflow = ""; reveal.style.display = "none"; },
          });
          g.to(reveal, { opacity: 0, duration: 0.18, ease: "power2.in" });
        } else {
          if (g) g.to(reveal, { opacity: 0, duration: 0.18, ease: "power2.in", onComplete() { reveal.style.display = "none"; } });
          else reveal.style.display = "none";
        }
        Sound.tick();
      };

      pill.addEventListener("mouseenter", () => Sound.hover());

      pill.addEventListener("click", () => {
        pill.classList.contains("is-open") ? doClose() : doOpen();
      });

      pill.setAttribute("aria-expanded", "false");
      pill.setAttribute("aria-controls", pill.dataset.for);
    });

    /* ── "systems" word: sticky-note storm ── */
    const systemsEl = document.getElementById("word-systems");
    if (systemsEl && !noMotion) {
      const COLORS = ["#FDE68A", "#A7F3D0", "#BAE6FD", "#DDD6FE", "#FBCFE8", "#FED7AA", "#E9D5FF", "#BBF7D0", "#FCA5A5", "#6EE7B7"];
      const NOTES  = [
        { title: "Design system v1",      body: "All tokens live in Figma.\nComponents ship from Storybook.\nTeam adopted it week 2." },
        { title: "Component library",     body: "48 components.\nFully typed + documented.\nZero hand-wavy props." },
        { title: "Color system",          body: "Light & dark.\nSemantic naming only.\nNo hardcoded hex values." },
        { title: "Type scale",            body: "7 sizes, 3 weights.\nSerifed display headers.\nSans for body & UI." },
        { title: "Onboarding flow",       body: "8 screens, 3 paths.\nDrop-off cut by half.\nTook 2 sprints total." },
        { title: "Social canvas UX",      body: "Infinite scroll canvas.\nDrag-to-arrange posts.\nComposer in the drawer." },
        { title: "Messaging UX",          body: "Threads + reactions.\nRead receipts.\nTyping indicators." },
        { title: "Mobile-first!",         body: "iOS & Android feel.\nNative gestures.\nNo compromise on touch." },
        { title: "User research",         body: "12 interviews.\n4 core insights.\nReframed the whole flow." },
        { title: "Interaction map",       body: "32 states mapped.\n6 user journeys.\nNothing left guessed." },
        { title: "Grid system",           body: "12-col, 8px base.\nBreaks at 3 viewports.\nAlways feels intentional." },
        { title: "Motion library",        body: "Spring-based easings.\nShared animation tokens.\nConsistent across every screen." },
        { title: "Ship it! 🚀",           body: "v1 live in 8 weeks.\nFrom 0 → production.\nJust two people." },
        { title: "v0 → v1",               body: "Blank Figma file.\nTo shipped product.\nEvery screen by me." },
        { title: "Design ↔ Code",         body: "Figma as the source.\nReact as the output.\nOne doc for handoff." },
        { title: "API design",            body: "REST → GraphQL.\nTyped SDK for the team.\nDocs on day one." },
        { title: "Auth flow",             body: "Magic link + OAuth.\nSession tokens secured.\nLegal approved it." },
        { title: "Waitlist page",         body: "2,083 signups.\n3 university partners.\nBuilt in a weekend." },
        { title: "Deck ready ✓",          body: "12 slides.\nInvestor-ready.\nClosed the meeting." },
        { title: "Sprint 1 done",         body: "5 days, 12 tasks.\nAll shipped on time.\nNo scope creep." },
        { title: "Data model",            body: "PostgreSQL.\nNormalized schema.\nMigrations never broke." },
        { title: "Component tests",       body: "92% coverage.\nStorybook + Vitest.\nCI blocks on red." },
        { title: "Launch checklist",      body: "47 items.\nAll green ✓.\nShipped at midnight." },
        { title: "Retrospective",         body: "What worked: speed.\nWhat didn't: sleep.\nNext sprint: both." },
        { title: "Accessibility",         body: "WCAG AA compliant.\nKeyboard nav complete.\nScreen reader tested." },
        { title: "Dark mode",             body: "System-aware.\nCustom toggle.\nNo flash on load." },
        { title: "Analytics wired",       body: "Events mapped in Mixpanel.\nFunnels reviewed weekly.\nData drove every decision." },
        { title: "Performance",           body: "LCP under 1.2s.\nCLS score: zero.\nPassed Core Web Vitals." },
      ];
      let hovering = false;
      let spawnTimer = null;
      let activeEls = [];
      let noteIdx = 0;

      const spawnOne = () => {
        if (!hovering) return;
        if (activeEls.length >= (canHover ? 60 : 10)) return; // cap (lower on touch)
        const vw = innerWidth, vh = innerHeight;
        const note = NOTES[noteIdx % NOTES.length];
        noteIdx++;
        const el = document.createElement("div");
        el.className = "exp-sticky";
        el.innerHTML =
          `<div class="exp-sticky__title">${note.title}</div>` +
          `<div class="exp-sticky__body">${note.body.replace(/\n/g, "<br>")}</div>`;
        el.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
        const rot = Math.random() * 32 - 16;
        el.style.left = (Math.random() * (vw - 160)) + "px";
        el.style.top  = (Math.random() * (vh - 140)) + "px";
        el.dataset.rot = rot;
        document.body.appendChild(el);
        activeEls.push(el);

        const g = window.gsap;
        if (g) {
          g.set(el, { opacity: 0, scale: 0.3, rotation: rot });
          g.to(el, { opacity: 1, scale: 1, rotation: rot, duration: 0.38, ease: "back.out(1.9)" });
        }

        // speed up slightly as more notes accumulate
        const interval = Math.max(60, 160 - activeEls.length * 2);
        spawnTimer = setTimeout(spawnOne, interval);
      };

      const fallAll = () => {
        clearTimeout(spawnTimer);
        hovering = false;
        const g = window.gsap;
        const toFall = activeEls.splice(0);
        toFall.forEach((el) => {
          const rot     = parseFloat(el.dataset.rot);
          const spinDir = Math.random() > 0.5 ? 1 : -1;
          const dur     = 0.7 + Math.random() * 0.5;
          const delay   = Math.random() * 0.35;
          if (g) {
            g.to(el, {
              y: innerHeight * 1.5,
              rotation: rot + spinDir * (20 + Math.random() * 30),
              opacity: 0,
              duration: dur,
              delay,
              ease: "power2.in",
              onComplete: () => el.remove(),
            });
          } else {
            el.remove();
          }
        });
      };

      systemsEl.addEventListener("mouseenter", () => {
        if (hovering) return;
        hovering = true;
        noteIdx = Math.floor(Math.random() * NOTES.length);
        spawnOne();
      });
      systemsEl.addEventListener("mouseleave", fallAll);
    }

    /* ── Clark "study" click: burst of note emojis ── */
    const studyEl = document.getElementById("word-study");
    if (studyEl && !noMotion) {
      const EMOJIS = ["📝", "✏️", "📚", "🧠", "💡", "📖", "✦", "⭐", "🖊️", "📓"];
      studyEl.addEventListener("click", () => {
        const r  = studyEl.getBoundingClientRect();
        const ox = r.left + r.width / 2;
        const oy = r.top  + r.height / 2;
        for (let i = 0; i < 10; i++) {
          const el = document.createElement("span");
          el.textContent = EMOJIS[i % EMOJIS.length];
          el.style.cssText = [
            "position:fixed",
            `left:${ox}px`,
            `top:${oy}px`,
            "pointer-events:none",
            "z-index:9000",
            `font-size:${18 + Math.random() * 14}px`,
            "line-height:1",
          ].join(";");
          document.body.appendChild(el);
          const dx = (Math.random() - 0.5) * 220;
          const dy = -(70 + Math.random() * 140);
          el.animate([
            { opacity: 0, transform: "scale(0.3) translate(0,0)" },
            { opacity: 1, transform: `scale(1.1) translate(${dx * 0.35}px,${dy * 0.35}px)`, offset: 0.22 },
            { opacity: 0, transform: `scale(0.8) translate(${dx}px,${dy}px)` },
          ], {
            duration: 850 + Math.random() * 400,
            delay: i * 55,
            easing: "cubic-bezier(0.22,1,0.36,1)",
            fill: "forwards",
          }).onfinish = () => el.remove();
        }
      });
    }

    // stagger handled by GSAP in IO callback above
  })();

})();

/* ============================================================
   Hero polish + easter eggs (independent module)
   ============================================================ */
(() => {
  "use strict";

  const reduce  = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const still = new URLSearchParams(location.search).has("still");

  /* ---- tiny toast helper ---- */
  const toastEl = document.getElementById("toast");
  let toastTimer;
  const toast = (msg) => {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-show"), 2200);
  };

  /* ---- 1. Hero reveal trigger — GSAP ---- */
  const hero = document.querySelector(".hero");
  if (hero) {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        hero.classList.add("is-ready");
        const g = window.gsap;
        if (g && !reduce) {
          const wSpans = hero.querySelectorAll(".hero__bio .w");
          if (wSpans.length) {
            g.to(wSpans, {
              opacity: 1,
              duration: 0.45,
              stagger: 0.032,
              ease: "power2.out",
              delay: 0.08,
            });
          }
          const more = hero.querySelectorAll(".hero__more");
          if (more.length) {
            g.fromTo(more,
              { opacity: 0, y: 8 },
              { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: "power2.out", delay: 0.3 }
            );
          }
          const foot = hero.querySelector(".hero__foot");
          if (foot) {
            g.fromTo(foot,
              { opacity: 0, y: 10 },
              { opacity: 1, y: 0, duration: 0.7, ease: "power2.out", delay: 0.62 }
            );
          }
        } else if (!reduce) {
          // no-GSAP fallback
          hero.querySelectorAll(".hero__bio .w").forEach((el) => { el.style.opacity = "1"; });
          hero.querySelectorAll(".hero__more").forEach((el) => { el.style.opacity = "1"; });
          const foot = hero.querySelector(".hero__foot");
          if (foot) { foot.style.opacity = "1"; foot.style.transform = "none"; }
        }
      })
    );
  }

  /* ---- 1b. Pressable spring-back — project cards + hero CTA — GSAP ---- */
  const spring = (el) => {
    if (reduce) return;
    const g = window.gsap;
    if (!g) return;
    g.killTweensOf(el);
    g.fromTo(el,
      { y: 3, scale: 0.998 },
      { y: 0, scale: 1, duration: 0.55, ease: "elastic.out(1.1, 0.45)" }
    );
  };

  document.querySelectorAll(".project").forEach((card) => {
    card.addEventListener("pointerdown", () => {
      if (reduce) return;
      const g = window.gsap;
      if (g) { g.killTweensOf(card); g.to(card, { y: 3, scale: 0.998, duration: 0.12, ease: "power2.out" }); }
    });
    card.addEventListener("pointerup",    () => spring(card));
    card.addEventListener("pointerleave", () => {
      const g = window.gsap;
      if (g) { g.killTweensOf(card); g.to(card, { y: 0, scale: 1, duration: 0.25, ease: "power2.out" }); }
    });
  });

  const cta = document.querySelector(".hero__cta");
  if (cta) {
    cta.addEventListener("pointerdown", () => {
      const g = window.gsap;
      if (g && !reduce) { g.killTweensOf(cta); g.to(cta, { y: 2, duration: 0.1, ease: "power2.out" }); }
    });
    cta.addEventListener("pointerup", () => spring(cta));
  }

  /* ---- 2. Cursor spotlight + asterisk parallax ---- */
  if (hero && canHover && !reduce && !still) {
    const spot = hero.querySelector(".hero__spotlight");
    const asts = [...hero.querySelectorAll(".hero__ast")];
    let mx = innerWidth / 2, my = innerHeight * 0.4, cx = mx, cy = my, raf = null;

    const loop = () => {
      cx += (mx - cx) * 0.08;
      cy += (my - cy) * 0.08;
      if (spot) spot.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
      const dx = mx / innerWidth - 0.5;
      const dy = my / innerHeight - 0.5;
      asts.forEach((a) => {
        const d = parseFloat(a.dataset.depth) || 10;
        a.style.transform = `translate(${dx * d}px, ${dy * d}px)`;
      });
      raf = (Math.abs(mx - cx) > 0.4 || Math.abs(my - cy) > 0.4)
        ? requestAnimationFrame(loop)
        : null;
    };
    addEventListener("mousemove", (e) => {
      mx = e.clientX; my = e.clientY;
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
  }

  /* ---- 2b. "design" pill: paint-trail cursor (self-contained, no text reveal) ---- */
  if (hero && canHover && !reduce && !still) {
    const paintPill = hero.querySelector(".exp__pill--paint");
    if (paintPill) {
      const canvas = document.createElement("canvas");
      canvas.className = "paint-canvas";
      canvas.setAttribute("aria-hidden", "true");
      hero.insertBefore(canvas, hero.firstChild);
      const ctx = canvas.getContext("2d");

      const cursorEl = document.createElement("div");
      cursorEl.className = "paint-cursor";
      cursorEl.textContent = "🖌️";
      document.body.appendChild(cursorEl);

      let hue = 190, painting = false;
      let targetX = 0, targetY = 0;          // raw cursor position (page coords)
      let curX = null, curY = null;          // lerped "brush tip" position
      let lastX = null, lastY = null;        // last stamped point, in canvas-local coords
      let raf = null, fadeUntil = 0;

      const BRUSH_RADIUS = 78;
      const STAMP_SPACING = 7; // « brush radius = heavy overlap = one solid ribbon, not beads

      const resize = () => {
        const r = hero.getBoundingClientRect();
        canvas.width = r.width * devicePixelRatio;
        canvas.height = r.height * devicePixelRatio;
        canvas.style.width = r.width + "px";
        canvas.style.height = r.height + "px";
        ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      };
      resize();
      addEventListener("resize", resize);

      // Heavily-overlapping stamps along the path read as one continuous ribbon
      // at any brush size — a big stroke drawn as a couple of per-frame lines
      // (round or butt caps) instead reads as a beaded chain, because a frame's
      // travel distance is short relative to the brush width. Each stamp is a
      // soft radial gradient, not a hard-edged circle — hard edges piling up is
      // what read as "jagged" at the trail's outer boundary; a feathered edge
      // blends into the overlap seamlessly instead.
      const stampAt = (x, y) => {
        hue = (hue + 0.5) % 360;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, BRUSH_RADIUS);
        grad.addColorStop(0,   `hsla(${hue}, 85%, 64%, 0.42)`);
        grad.addColorStop(0.7, `hsla(${hue}, 85%, 64%, 0.30)`);
        grad.addColorStop(1,   `hsla(${hue}, 85%, 64%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, BRUSH_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      };

      // Erode existing alpha a little every frame — paint behind the cursor
      // dissolves like a comet tail instead of permanently caking the page the
      // longer you paint. Slow while actively painting (so the trail has real
      // length), faster once stopped (so it doesn't linger forever).
      const decay = (rate) => {
        const w = canvas.width / devicePixelRatio, h = canvas.height / devicePixelRatio;
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = `rgba(0,0,0,${rate})`;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = "source-over";
      };

      const tick = (now) => {
        if (curX == null) { curX = targetX; curY = targetY; }
        curX += (targetX - curX) * 0.35;
        curY += (targetY - curY) * 0.35;

        decay(painting ? 0.012 : 0.045);

        if (painting) {
          const r = hero.getBoundingClientRect();
          const x = curX - r.left, y = curY - r.top;
          if (lastX == null) { lastX = x; lastY = y; stampAt(x, y); }
          const dx = x - lastX, dy = y - lastY;
          const dist = Math.hypot(dx, dy);
          const steps = Math.max(1, Math.floor(dist / STAMP_SPACING));
          for (let i = 1; i <= steps; i++) {
            stampAt(lastX + (dx * i) / steps, lastY + (dy * i) / steps);
          }
          lastX = x; lastY = y;
        }

        const stillFading = !painting && now < fadeUntil;
        if (painting || stillFading) {
          raf = requestAnimationFrame(tick);
        } else {
          raf = null;
          canvas.classList.remove("is-active");
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      };

      const onMove = (e) => {
        targetX = e.clientX; targetY = e.clientY;
        cursorEl.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      };

      const startPainting = () => {
        painting = true;
        lastX = lastY = null;
        curX = curY = null;
        canvas.classList.add("is-active");
        document.body.classList.add("is-painting");
        if (!raf) raf = requestAnimationFrame(tick);
      };
      const stopPainting = () => {
        painting = false;
        document.body.classList.remove("is-painting");
        fadeUntil = performance.now() + 1600; // let the trail dissolve before it's cleared
      };

      addEventListener("mousemove", onMove, { passive: true });

      paintPill.addEventListener("mouseenter", () => Sound.hover());

      paintPill.addEventListener("click", () => {
        const opening = !paintPill.classList.contains("is-open");
        paintPill.classList.toggle("is-open", opening);
        paintPill.setAttribute("aria-expanded", opening ? "true" : "false");
        if (opening) { startPainting(); Sound.pop(); } else { stopPainting(); Sound.tick(); }
      });
    }
  }

  /* ---- 2c. Hero word split + scramble ---- */
  (function () {
    const heroP = document.querySelector(".hero__bio");
    if (!heroP) return;

    // Split top-level text nodes into per-word spans; leave child elements as units
    let idx = 0;
    function splitNode(parent) {
      const nodes = [...parent.childNodes];
      nodes.forEach((node) => {
        if (node.nodeType === 3) {
          const parts = node.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const s = document.createElement("span");
            s.className = "w";
            s.textContent = part;
            idx++;
            frag.appendChild(s);
          });
          parent.replaceChild(frag, node);
        } else if (node.nodeType === 1) {
          // skip the name+avatar block — it has its own fade-in
          if (!node.classList.contains("hero__name-inline")) {
            node.classList.add("w");
          }
          idx++;
        }
      });
    }
    splitNode(heroP);
  })();

  /* ---- 3. Click-to-swap emphasis words ---- */
  document.querySelectorAll(".hero__doc em[data-alt]").forEach((em) => {
    const words = [em.textContent, ...em.dataset.alt.split("|")];
    let i = 0;
    em.title = "tap to swap";
    em.addEventListener("click", () => {
      i = (i + 1) % words.length;
      if (reduce) { em.textContent = words[i]; return; }
      em.classList.remove("is-flip");
      void em.offsetWidth;
      em.classList.add("is-flip");
      setTimeout(() => { em.textContent = words[i]; }, 250);
      if (i === 0) toast("✸ back to the original");
    });
  });

  /* ---- 3b. Hero chip emoji pop ---- */
  const emojiPop = (el, emoji, count = 1) => {
    if (reduce) return;
    for (let n = 0; n < count; n++) {
      setTimeout(() => {
        const r = el.getBoundingClientRect();
        const e = document.createElement("span");
        const jitter = (Math.random() - .5) * 28;
        e.textContent = emoji;
        e.style.cssText = [
          "position:fixed",
          `left:${r.left + r.width / 2 + jitter}px`,
          `top:${r.top}px`,
          "pointer-events:none",
          "z-index:9999",
          "font-size:1.3rem",
          "line-height:1",
          "animation:chip-float .75s cubic-bezier(.22,1,.36,1) forwards",
        ].join(";");
        document.body.appendChild(e);
        setTimeout(() => e.remove(), 820);
      }, n * 90);
    }
  };

  /* ---- 3c. Hero pills: pop their emoji when opened ---- */
  document.querySelectorAll(".hero .exp__pill[data-emoji]").forEach((pill) => {
    pill.addEventListener("click", () => {
      if (pill.classList.contains("is-open")) emojiPop(pill, pill.dataset.emoji);
    });
  });

  /* ---- 5. Confetti burst ---- */
  const confetti = () => {
    if (reduce) return;
    Sound.party();
    const layer = document.createElement("div");
    layer.className = "confetti";
    document.body.appendChild(layer);
    const cx = innerWidth / 2, cy = innerHeight * 0.5;
    for (let n = 0; n < 30; n++) {
      const s = document.createElement("span");
      s.textContent = "✸";
      s.style.left = cx + "px";
      s.style.top = cy + "px";
      s.style.fontSize = (10 + Math.random() * 26) + "px";
      const ang = Math.random() * Math.PI * 2;
      const dist = 120 + Math.random() * 340;
      s.style.setProperty("--tx", Math.cos(ang) * dist + "px");
      s.style.setProperty("--ty", Math.sin(ang) * dist - 80 + "px");
      s.style.setProperty("--r", Math.random() * 720 - 360 + "deg");
      s.style.setProperty("--dur", 0.9 + Math.random() * 0.8 + "s");
      layer.appendChild(s);
    }
    setTimeout(() => layer.remove(), 2000);
  };

  /* ---- 6. Keyboard: Konami · G grid · L lights · type "seyi" ---- */
  const KONAMI = ["arrowup","arrowup","arrowdown","arrowdown","arrowleft","arrowright","arrowleft","arrowright","b","a"];
  let kIdx = 0, typed = "";

  addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    const key = e.key.toLowerCase();

    // Konami
    kIdx = key === KONAMI[kIdx] ? kIdx + 1 : (key === KONAMI[0] ? 1 : 0);
    if (kIdx === KONAMI.length) { kIdx = 0; confetti(); toast("✸ achievement unlocked"); }

    // single-key toggles
    if (key === "g") {
      const on = document.body.classList.toggle("grid-on");
      toast(on ? "✸ baseline grid on" : "grid off");
    }
    if (key === "l") {
      const off = document.body.classList.toggle("lights-off");
      toast(off ? "✸ lights off" : "lights on");
    }

    // type "seyi"
    typed = (typed + key).slice(-4);
    if (typed === "seyi") { confetti(); toast("✸ hi, that's me"); }

    // type "0to1" — pop every hidden pill in the hero at once
    if (typed === "0to1") {
      document.querySelectorAll(".hero .exp__pill:not(.is-open)").forEach((p) => p.click());
      toast("✸ zero to one");
    }
  });

/* ---- 8. Brand name: 5-click easter egg ---- */
  const brand = document.querySelector(".nav__brand");
  if (brand) {
    let clicks = 0, resetT;
    brand.addEventListener("click", () => {
      clicks++;
      clearTimeout(resetT);
      resetT = setTimeout(() => { clicks = 0; }, 1500);
      if (clicks >= 5) { clicks = 0; confetti(); toast("✸ hi, that's me"); }
    });
  }

  /* ---- 8. Email: hover → "Click to copy", click → copy to clipboard ---- */
  const emailEl = document.querySelector(".contact__email");
  if (emailEl) {
    const email = emailEl.textContent.trim();
    // lock width so text swap doesn't cause layout shift
    requestAnimationFrame(() => {
      emailEl.style.minWidth = emailEl.offsetWidth + "px";
    });

    let copied = false;

    emailEl.addEventListener("mouseenter", () => {
      if (!copied) emailEl.textContent = "Click to copy";
    });

    emailEl.addEventListener("mouseleave", () => {
      if (!copied) emailEl.textContent = email;
    });

    emailEl.addEventListener("click", (e) => {
      e.preventDefault();
      navigator.clipboard.writeText(email).then(() => {
        copied = true;
        emailEl.textContent = "Copied!";
        setTimeout(() => {
          copied = false;
          emailEl.textContent = email;
        }, 2000);
      });
    });
  }

  /* ---- 7b. Back to top ---- */
  const backToTop = document.querySelector(".footer__top");
  if (backToTop) {
    backToTop.addEventListener("click", (e) => {
      e.preventDefault();
      window.scrollTo(0, 0);
    });
  }

  /* ---- 8. Tab-away title ---- */
  const realTitle = document.title;
  document.addEventListener("visibilitychange", () => {
    document.title = document.hidden ? "✸ come back —" : realTitle;
  });

  /* ---- 9. Console calling card ---- */
  console.log(
    "%c✸ Seyi Ogundipe %c— Design Engineer",
    "font-size:15px;font-weight:600",
    "font-size:15px;color:#8b877b"
  );
  console.log(
    "%cYou opened the console. Of course you did.\n\nA few things are hidden around here:\n  · the Konami code ↑↑↓↓←→←→ b a\n  · press  G  for the baseline grid\n  · press  L  for lights-off\n  · type  \"seyi\"  anywhere\n  · type  \"0to1\"  anywhere to pop every pill in the hero\n  · click the italic words in the headline\n  · click the pills in the intro\n\nLike what you see?  founders@trycohort.xyz",
    "font-family:monospace;line-height:1.55;color:#15140f"
  );

  /* ---- WebGL frosted glass — work grid ---- */
  (function () {
    const canvas = document.getElementById("frost-gl");
    if (!canvas) return;
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) { canvas.style.display = "none"; return; }

    const VS = `
      attribute vec2 aPos;
      void main(){gl_Position=vec4(aPos,0.,1.);}
    `;
    const FS = `
      precision highp float;
      uniform vec2  uRes;
      uniform float uTime;
      uniform vec2  uMouse;
      uniform vec3  uTint;
      uniform float uBright;

      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.545);}
      float noise(vec2 p){
        vec2 i=floor(p),f=fract(p);
        f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);
      }
      float fbm(vec2 p){
        float v=0.,a=.5;
        for(int i=0;i<6;i++){v+=a*noise(p);p*=2.1;a*=.48;}
        return v;
      }

      void main(){
        vec2 uv=gl_FragCoord.xy/uRes;

        /* frost surface normals from FBM derivative */
        float e=2./min(uRes.x,uRes.y);
        float f0=fbm(uv*9.+uTime*.035);
        float fx=fbm((uv+vec2(e,0.))*9.+uTime*.035);
        float fy=fbm((uv+vec2(0.,e))*9.+uTime*.035);
        vec2 grad=vec2(fx-f0,fy-f0)/e;

        /* chromatic aberration via refraction */
        float str=0.011;
        vec2 uvR=uv+grad*str*1.04;
        vec2 uvG=uv+grad*str;
        vec2 uvB=uv+grad*str*.96;
        float bgY=.85+uv.y*.3;
        float r=uTint.r*bgY+fbm(uvR*5.)*.06;
        float g=uTint.g*bgY+fbm(uvG*5.)*.06;
        float b=uTint.b*bgY+fbm(uvB*5.)*.06;
        vec3 col=vec3(r,g,b);

        /* frost crystal layer */
        float frost =fbm(uv*20.-uTime*.012);
        float frost2=fbm(uv*42.+uTime*.009);
        col=mix(col,uTint+.14,( frost*.55+frost2*.45)*.16);

        /* subtle grid scored into the glass */
        float gx=smoothstep(.97,1.,fract(uv.x*10.))+smoothstep(.97,1.,fract(uv.y*10.));
        col-=gx*.04;

        /* mouse specular */
        vec2 toL=uMouse-uv;
        vec3 lDir=normalize(vec3(toL,.7));
        vec3 norm=normalize(vec3(grad*1.8,1.));
        float spec=pow(max(dot(reflect(-lDir,norm),vec3(0.,0.,1.)),0.),28.);
        float atten=smoothstep(.65,0.,length(toL));
        vec3 specCol=mix(vec3(.3,.5,1.),vec3(1.,.93,.8),uBright);
        col+=spec*atten*.38*specCol;

        /* top-edge sheen */
        float sheen=(1.-smoothstep(0.,.06,uv.y))*(.3+.7*cos(uv.x*PI));
        col+=sheen*.18*mix(vec3(.4,.55,1.),vec3(1.,.95,.82),uBright);

        /* edge frost build-up */
        float edge=1.-smoothstep(0.,.07,min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y)));
        col=mix(col,col*.85+.12,edge*.55);

        /* vignette */
        float vig=length((uv-.5)*vec2(1.,.6));
        col*=1.-.28*vig*vig;

        gl_FragColor=vec4(col,.9);
      }
    `;
    // Fix: PI is not a builtin — inject it
    const FS_FINAL = FS.replace("vec3(.4,.55,1.),vec3(1.,.95,.82),uBright);", "vec3(.4,.55,1.),vec3(1.,.95,.82),uBright);\n")
      .replace("precision highp float;", "precision highp float;\n#define PI 3.14159265359");

    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS_FINAL));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(prog)); return; }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");

    const uRes   = gl.getUniformLocation(prog, "uRes");
    const uTime  = gl.getUniformLocation(prog, "uTime");
    const uMouse = gl.getUniformLocation(prog, "uMouse");
    const uTint  = gl.getUniformLocation(prog, "uTint");
    const uBrightU = gl.getUniformLocation(prog, "uBright");

    function parseColor(css) {
      const tmp = document.createElement("canvas");
      tmp.width = tmp.height = 1;
      const ctx = tmp.getContext("2d");
      ctx.fillStyle = css; ctx.fillRect(0,0,1,1);
      const d = ctx.getImageData(0,0,1,1).data;
      return [d[0]/255, d[1]/255, d[2]/255];
    }

    let mx = 0.5, my = 0.5;
    const projects = document.querySelector(".projects");
    if (projects) projects.addEventListener("mousemove", (e) => {
      const r = projects.getBoundingClientRect();
      mx = (e.clientX - r.left) / r.width;
      my = 1 - (e.clientY - r.top) / r.height;
    }, { passive: true });

    let tint = [0.84, 0.80, 0.74], bright = 1.0;

    function syncVibe() {
      const style = getComputedStyle(document.documentElement);
      const gridBg = style.getPropertyValue("--grid-bg").trim();
      const paper  = style.getPropertyValue("--paper").trim();
      tint = parseColor(gridBg || paper);
      const dark = style.colorScheme === "dark" || document.documentElement.getAttribute("data-vibe") === "night" || document.documentElement.getAttribute("data-vibe") === "evening";
      bright = dark ? 0.0 : 1.0;
    }
    syncVibe();

    // Re-sync when vibe changes
    new MutationObserver(syncVibe).observe(document.documentElement, { attributes: true, attributeFilter: ["data-vibe"] });

    function resize() {
      const r = canvas.getBoundingClientRect();
      canvas.width  = r.width  * devicePixelRatio;
      canvas.height = r.height * devicePixelRatio;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    new ResizeObserver(resize).observe(canvas);

    let t0 = performance.now();
    function draw(now) {
      requestAnimationFrame(draw);
      const t = (now - t0) / 1000;
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, t);
      gl.uniform2f(uMouse, mx, my);
      gl.uniform3f(uTint, tint[0], tint[1], tint[2]);
      gl.uniform1f(uBrightU, bright);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    requestAnimationFrame(draw);
  })();
})();

/* ============================================================
   VIBE SWITCHER + PHYSICS LAMP — ported from the Cohort project.
   Top-right: live clock + "change the light" dropdown.
   Draggable SVG pendant: click = toggle light · big pull = next vibe.
   AUTO follows the viewer's clock (morning/day/evening/night).
   ============================================================ */
const Sound = window.Sound || { switchLight() {}, pop() {} };

/* ── vibe switcher ── */
(function () {
  const html    = document.documentElement;
  const btn     = document.getElementById("vibe-btn");
  const menu    = document.getElementById("vibe-menu");
  const clockEl = document.getElementById("vibe-clock");
  const labelEl = document.getElementById("vibe-label");
  if (!btn || !menu || !clockEl) return;

  const VIBES = {
    morning: { label: "GOOD MORNING" },
    day:     { label: "GOOD DAY" },
    evening: { label: "GOOD EVENING" },
    night:   { label: "GOOD NIGHT" },
  };
  const ORDER  = ["morning", "day", "evening", "night"];
  const BG_MAP = { morning: "#E0C0A0", day: "#EDE8DC", evening: "#1C0A02", night: "#090909" };

  // ?vibe= overrides the stored choice
  const qVibe = new URLSearchParams(location.search).get("vibe");
  const VALID = ["auto", ...ORDER];
  let stored = (qVibe && VALID.includes(qVibe))
    ? qVibe
    : (localStorage.getItem("cohort-vibe") || "auto");

  const vibeFromHour = (h) =>
    (h >= 5 && h < 10) ? "morning" :
    (h >= 10 && h < 17) ? "day" :
    (h >= 17 && h < 21) ? "evening" : "night";

  const resolvedVibe = () =>
    stored === "auto" ? vibeFromHour(new Date().getHours()) : stored;

  function updateClock() {
    const now = new Date();
    const h = now.getHours(), m = now.getMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    const str = `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
    clockEl.textContent = str;

  }

  function applyVibe(skipTransition) {
    const vibe = resolvedVibe();
    if (skipTransition) {
      html.style.setProperty("transition", "none", "important");
      document.body.style.setProperty("transition", "none", "important");
    }
    html.setAttribute("data-vibe", vibe);
    if (skipTransition) {
      requestAnimationFrame(() => {
        html.style.removeProperty("transition");
        document.body.style.removeProperty("transition");
      });
    }
    labelEl.textContent = VIBES[vibe]?.label ?? "";
    menu.querySelectorAll(".vibe-opt").forEach((o) =>
      o.setAttribute("aria-selected", o.dataset.vibe === stored ? "true" : "false")
    );
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute("content", BG_MAP[vibe] ?? "#090909");
  }

  function selectVibe(name) {
    stored = name;
    localStorage.setItem("cohort-vibe", name);
    applyVibe(false);
    closeMenu();
  }

  // exposed for the lamp module (big pull → next vibe)
  window.SiteVibe = {
    next() { selectVibe(ORDER[(ORDER.indexOf(resolvedVibe()) + 1) % ORDER.length]); },
    current: resolvedVibe,
  };

  function openMenu() {
    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    menu.style.animation = "none";
    requestAnimationFrame(() => { menu.style.animation = ""; });
  }
  function closeMenu() {
    menu.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  }

  btn.addEventListener("click", () => (menu.hidden ? openMenu() : closeMenu()));
  menu.querySelectorAll(".vibe-opt").forEach((opt) => {
    if (!opt.dataset.vibe) return;            // skip particles toggle
    opt.addEventListener("click", () => selectVibe(opt.dataset.vibe));
  });
  document.addEventListener("pointerdown", (e) => {
    const pToggle = document.getElementById("particles-toggle");
    if (!menu.hidden && !menu.contains(e.target) && e.target !== btn &&
        e.target !== pToggle && !pToggle?.contains(e.target)) closeMenu();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

  // particles toggle → show/hide the hero ambient layer
  const pToggle = document.getElementById("particles-toggle");
  if (pToggle) {
    let on = localStorage.getItem("site-particles") !== "off";
    const sync = () => {
      document.body.classList.toggle("no-ambient", !on);
      pToggle.setAttribute("aria-pressed", on ? "true" : "false");
      const st = pToggle.querySelector(".particles-opt-state");
      if (st) st.textContent = on ? "ON" : "OFF";
    };
    sync();
    pToggle.addEventListener("click", () => {
      on = !on;
      localStorage.setItem("site-particles", on ? "on" : "off");
      sync();
    });
  }

  applyVibe(true);
  updateClock();
  setInterval(updateClock, 60000);
  setInterval(() => { if (stored === "auto") applyVibe(false); }, 60000);
})();

/* ── physics lamp (pendulum SVG) ── */
(function () {
  const svg = document.getElementById("lamp-physics");
  if (!svg) return;
  const cordEl   = document.getElementById("lp-cord");
  const ballEl   = document.getElementById("lp-ball");
  const ballRing = document.getElementById("lp-ball-ring");
  const shadeGp  = document.getElementById("lp-shade-group");
  if (!cordEl || !ballEl) return;

  const VB = { w: 80, h: 190 };
  const PIVOT = { x: 40, y: 59 };
  const L = 45, GRAV = 220, DAMP = 0.984, DT = 1 / 60, MAX_DOWN = 40, TRIG_DOWN = 26;

  let angle = 0, angVel = 0, pullY = 0, dragging = false;
  let idleT = Math.random() * Math.PI * 2, hoverNear = false;

  const ballSVG = (a, py) => ({ x: PIVOT.x + Math.sin(a) * L, y: PIVOT.y + Math.cos(a) * L + py });
  const toSVG = (e) => {
    const r = svg.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (VB.w / r.width), y: (e.clientY - r.top) * (VB.h / r.height) };
  };
  const ballViewport = () => {
    const r = svg.getBoundingClientRect(), b = ballSVG(angle, pullY);
    return { x: r.left + (b.x / VB.w) * r.width, y: r.top + (b.y / VB.h) * r.height };
  };

  function render() {
    const b = ballSVG(angle, pullY);
    const ctrlX = PIVOT.x + Math.sin(angle * 0.5) * L * 0.5 + (-angVel * 16);
    const ctrlY = PIVOT.y + Math.cos(angle * 0.5) * L * 0.5 + (pullY * 0.45);
    cordEl.setAttribute("d",
      `M ${PIVOT.x} ${PIVOT.y} Q ${ctrlX.toFixed(1)} ${ctrlY.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`);
    ballEl.setAttribute("cx", b.x.toFixed(1));
    ballEl.setAttribute("cy", b.y.toFixed(1));
    if (ballRing) {
      ballRing.setAttribute("cx", b.x.toFixed(1));
      ballRing.setAttribute("cy", b.y.toFixed(1));
      const speed = Math.abs(angVel);
      ballRing.setAttribute("r", (9 + speed * 8).toFixed(1));
      ballRing.setAttribute("opacity", (Math.min(0.5, speed * 0.5) * (hoverNear ? 1 : 0)).toFixed(2));
    }
    shadeGp.setAttribute("transform",
      `rotate(${(angle * (180 / Math.PI) * 0.18).toFixed(2)}, ${PIVOT.x}, ${PIVOT.y})`);
  }

  function physics() {
    if (!dragging) {
      angVel += -(GRAV / L) * Math.sin(angle) * DT;
      angVel *= DAMP;
      angle  += angVel * DT;
      if (Math.abs(angVel) < 0.006 && Math.abs(angle) < 0.015) {
        idleT += DT * 0.22; angle = Math.sin(idleT) * 0.032;
      }
      pullY *= 0.88; if (Math.abs(pullY) < 0.1) pullY = 0;
    }
    render();
    requestAnimationFrame(physics);
  }

  const html = document.documentElement;
  if (localStorage.getItem("cohort-lamp") === "on") html.classList.add("lamp-on");

  function toggleLight() {
    const on = !html.classList.contains("lamp-on");
    html.classList.toggle("lamp-on", on);
    localStorage.setItem("cohort-lamp", on ? "on" : "off");
    Sound.switchLight(on);
    angVel += (Math.random() - 0.5) * 0.6;
  }

  svg.addEventListener("pointerdown", (e) => {
    if (toSVG(e).y < PIVOT.y - 4) return;
    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    dragging = true; angVel = 0;
    let startPt = toSVG(e), dragDist = 0;
    function onMove(ev) {
      const p = toSVG(ev);
      dragDist += Math.hypot(p.x - startPt.x, p.y - startPt.y);
      startPt = p;
      const dx = p.x - PIVOT.x, dy = p.y - PIVOT.y;
      angle = Math.max(-0.65, Math.min(0.65, Math.atan2(dx, Math.max(L * 0.1, dy))));
      pullY = Math.max(0, Math.min(MAX_DOWN, dy - L));
      angVel = 0;
    }
    function onUp() {
      svg.removeEventListener("pointermove", onMove);
      svg.removeEventListener("pointerup", onUp);
      svg.removeEventListener("pointercancel", onUp);
      dragging = false;
      const released = pullY; pullY = 0;
      if (dragDist < 7) {                       // click → toggle light
        toggleLight();
        angVel = -angle * 0.5 + (Math.random() - 0.5) * 0.3;
      } else if (released >= TRIG_DOWN) {        // big pull → next vibe
        if (window.SiteVibe) window.SiteVibe.next();
        Sound.pop();
        angVel = (angle > 0 ? -1 : 1) * (1.5 + Math.random());
      } else {                                   // small drag → just swing
        angVel = -angle * 0.7 + (Math.random() - 0.5) * 0.4;
      }
    }
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);
    svg.addEventListener("pointercancel", onUp);
  });

  svg.addEventListener("mousemove", (e) => {
    const pt = toSVG(e), b = ballSVG(angle, pullY);
    hoverNear = Math.hypot(pt.x - b.x, pt.y - b.y) < 18;
    if (dragging || pt.y < PIVOT.y) return;
    angVel += (pt.x - PIVOT.x) / VB.w * 0.009;     // gentle attraction
  });
  svg.addEventListener("mouseleave", () => { hoverNear = false; });

  physics();
  setTimeout(() => { angVel = 0.55; }, 1200);       // auto-swing on load
})();
