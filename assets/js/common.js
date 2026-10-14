/* Shared chart helpers for the book (requires d3 v7). */
(function () {
  "use strict";
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const FAMILY_ORDER = ["Metals & alloys", "Technical ceramics", "Composites", "Polymers", "Natural materials", "Foams", "Elastomers"];
  const familyColor = (f) => css("--s" + (FAMILY_ORDER.indexOf(f) + 1)) || css("--muted");

  let tipEl = null;
  function tip() {
    if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "tip"; tipEl.setAttribute("role", "status"); document.body.appendChild(tipEl); }
    return tipEl;
  }
  function showTip(evt, html) {
    const t = tip(); t.innerHTML = html; t.style.opacity = 1;
    const pad = 14, w = t.offsetWidth, h = t.offsetHeight;
    let x = evt.clientX + pad, y = evt.clientY + pad;
    if (x + w > window.innerWidth - 8) x = evt.clientX - w - pad;
    if (y + h > window.innerHeight - 8) y = evt.clientY - h - pad;
    t.style.left = Math.max(8, x) + "px"; t.style.top = Math.max(8, y) + "px";
  }
  function hideTip() { if (tipEl) tipEl.style.opacity = 0; }

  /* Mount a chart that re-renders on resize and theme change. draw(svg, width) must clear & draw. */
  function mount(container, aspect, draw, opts = {}) {
    const el = typeof container === "string" ? document.querySelector(container) : container;
    const svg = d3.select(el).append("svg").attr("class", "chart").attr("role", "img");
    if (opts.label) svg.attr("aria-label", opts.label);
    let last = 0;
    function render(force) {
      const w = Math.max(280, Math.round(el.clientWidth));
      if (!force && w === last) return; last = w;
      const h = Math.round(typeof aspect === "function" ? aspect(w) : w * aspect);
      svg.attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h);
      svg.selectAll("*").remove();
      draw(svg, w, h);
    }
    const ro = new ResizeObserver(() => render(false)); ro.observe(el);
    window.addEventListener("themechange", () => render(true));
    if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => render(true));
    render(true);
    return { svg, redraw: () => render(true) };
  }

  const fmt = {
    sig: (v, n = 3) => (v === 0 ? "0" : Math.abs(v) >= 1e5 || Math.abs(v) < 1e-3 ? d3.format(`.${n - 1}e`)(v) : d3.format(`.${n}~r`)(v)),
    log125: (v) => { const k = Math.floor(Math.log10(v) + 1e-9), s = Math.round(v / Math.pow(10, k)); return [1, 2, 5].includes(s) && Math.abs(v - s * Math.pow(10, k)) < 1e-6 * v ? d3.format("~s")(v) : ""; },
    logTick: (v) => { const e = Math.log10(v); return Math.abs(e - Math.round(e)) < 1e-9 ? (Math.abs(e) <= 3 ? d3.format("~g")(v) : "10" + toSup(Math.round(e))) : ""; },
  };
  function toSup(n) { return String(n).replace(/-/g, "⁻").replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]); }

  function axes(g, x, y, w, h, m, xl, yl, opts = {}) {
    const xa = d3.axisBottom(x).ticks(opts.xticks || 6), ya = d3.axisLeft(y).ticks(opts.yticks || 6);
    if (opts.xlog) xa.tickFormat(fmt.logTick); if (opts.ylog) ya.tickFormat(fmt.logTick);
    if (opts.xfmt) xa.tickFormat(opts.xfmt); if (opts.yfmt) ya.tickFormat(opts.yfmt);
    g.append("g").attr("class", "grid").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(opts.xticks || 6).tickSize(-(h - m.t - m.b)).tickFormat(""));
    g.append("g").attr("class", "grid").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(opts.yticks || 6).tickSize(-(w - m.l - m.r)).tickFormat(""));
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.b})`).call(xa);
    g.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(ya);
    if (xl) g.append("text").attr("class", "axis-label").attr("x", w - m.r).attr("y", h - 6).attr("text-anchor", "end").text(xl);
    if (yl) g.append("text").attr("class", "axis-label").attr("transform", `translate(12,${m.t}) rotate(-90)`).attr("text-anchor", "end").text(yl);
  }

  function seg(container, options, value, onChange) {
    const el = typeof container === "string" ? document.querySelector(container) : container;
    el.classList.add("seg"); el.setAttribute("role", "group");
    el.innerHTML = options.map((o) => `<button type="button" data-v="${o.v}" aria-pressed="${o.v === value}">${o.label}</button>`).join("");
    el.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      el.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
      onChange(b.dataset.v);
    });
  }

  window.MATENV = Object.assign(window.MATENV || {}, { css, familyColor, FAMILY_ORDER, showTip, hideTip, mount, fmt, axes, seg, toSup });
})();
