/* The work page: filters (a project can sit under more than one), and each tile's video plays while you hover it. */
(function () {
  "use strict";
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;
  var items = Array.prototype.slice.call(document.querySelectorAll("#grid > li"));
  var buttons = Array.prototype.slice.call(document.querySelectorAll(".filters button"));

  function show(b) {
      buttons.forEach(function (o) { o.setAttribute("aria-pressed", String(o === b)); });
      var f = b.dataset.f;
      items.forEach(function (li) {
        li.hidden = !(f === "all" || (" " + li.dataset.cat + " ").indexOf(" " + f + " ") > -1);
        // the wide first tile only spans the row when everything is showing
        if (li.classList.contains("is-wide") || li.dataset.wide) { li.dataset.wide = "1"; li.classList.toggle("is-wide", f === "all"); }
      });
      return f;
  }
  buttons.forEach(function (b) {
    b.addEventListener("click", function () {
      var f = show(b);
      // the filter goes in the address, so /work?f=ai can be sent as a link
      try { var u = new URL(location.href); if (f === "all") u.searchParams.delete("f"); else u.searchParams.set("f", f); history.replaceState(null, "", u); } catch (e) {}
    });
  });
  // open on the filter a link asks for: /work?f=ai (or /work#ai)
  var want = "";
  try { want = (new URLSearchParams(location.search).get("f") || location.hash.slice(1)).toLowerCase(); } catch (e) {}
  var start = want && buttons.filter(function (b) { return b.dataset.f === want; })[0];
  if (start) show(start);

  if (fine && !reduce) {
    document.querySelectorAll(".tile").forEach(function (t) {
      var v = t.querySelector("video");
      if (!v) return;
      t.addEventListener("mouseenter", function () {
        if (!v.src) v.src = v.dataset.src;
        var p = v.play(); if (p && p.catch) p.catch(function () {});
        t.classList.add("is-playing");
      });
      t.addEventListener("mouseleave", function () { v.pause(); t.classList.remove("is-playing"); });
    });
  }
})();
