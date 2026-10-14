/* Chapter 1 figures: live Ashby chart, value-function explorer, eco-Ashby chart. */
(function () {
  "use strict";
  const { css, familyColor, FAMILY_ORDER, showTip, hideTip, mount, fmt, axes, seg } = window.MATENV;
  const M = window.MAT22;
  const star = d3.symbol().type(d3.symbolStar);

  /* ================= Figure 1.1 ================= */
  // Each pair: x(), y(), labels, and indices M = y^a / x (maximise; better = above line of slope 1/a)
  const PAIRS = {
    Erho: { label: "Stiffness – density", x: (m) => m.rho, y: (m) => m.E, xl: "Density ρ (kg/m³)", yl: "Young's modulus E (GPa)",
      cases: [{ id: "tie", label: "Tie  E/ρ", a: 1, tex: "E/ρ" }, { id: "beam", label: "Beam  E½/ρ", a: 0.5, tex: "E^½/ρ" }, { id: "panel", label: "Panel  E⅓/ρ", a: 1 / 3, tex: "E^⅓/ρ" }] },
    Srho: { label: "Strength – density", x: (m) => m.rho, y: (m) => m.sigma, xl: "Density ρ (kg/m³)", yl: "Strength σ (MPa)",
      cases: [{ id: "tie", label: "Tie  σ/ρ", a: 1, tex: "σ/ρ" }, { id: "beam", label: "Beam  σ⅔/ρ", a: 2 / 3, tex: "σ^⅔/ρ" }, { id: "panel", label: "Panel  σ½/ρ", a: 0.5, tex: "σ^½/ρ" }] },
    Ecost: { label: "Stiffness – cost per volume", x: (m) => m.Cm * m.rho, y: (m) => m.E, xl: "Cost per volume Cₘρ (£/m³)", yl: "Young's modulus E (GPa)",
      cases: [{ id: "tie", label: "Tie  E/Cₘρ", a: 1, tex: "E/Cₘρ" }, { id: "beam", label: "Beam  E½/Cₘρ", a: 0.5, tex: "E^½/Cₘρ" }, { id: "panel", label: "Panel  E⅓/Cₘρ", a: 1 / 3, tex: "E^⅓/Cₘρ" }] },
    Scost: { label: "Strength – cost per volume", x: (m) => m.Cm * m.rho, y: (m) => m.sigma, xl: "Cost per volume Cₘρ (£/m³)", yl: "Strength σ (MPa)",
      cases: [{ id: "tie", label: "Tie  σ/Cₘρ", a: 1, tex: "σ/Cₘρ" }, { id: "beam", label: "Beam  σ⅔/Cₘρ", a: 2 / 3, tex: "σ^⅔/Cₘρ" }, { id: "panel", label: "Panel  σ½/Cₘρ", a: 0.5, tex: "σ^½/Cₘρ" }] },
    spring: { label: "Strength – stiffness", x: (m) => m.E, y: (m) => m.sigma, xl: "Young's modulus E (GPa)", yl: "Strength σ (MPa)",
      cases: [{ id: "spring", label: "Spring  σ²/E", a: 2, tex: "σ²/E" }, { id: "hinge", label: "Elastic hinge  σ/E", a: 1, tex: "σ/E" }] },
  };
  const state = { pair: "Erho", caseId: "panel", c: null };
  const sel = document.getElementById("pair-select");
  sel.innerHTML = Object.entries(PAIRS).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join("");
  sel.value = state.pair;

  function curCase() { const p = PAIRS[state.pair]; return p.cases.find((c) => c.id === state.caseId) || p.cases[0]; }
  function idx(m) { const p = PAIRS[state.pair], c = curCase(); return Math.pow(p.y(m), c.a) / p.x(m); }
  function defaultC() { // median log M
    const v = M.map((m) => Math.log10(idx(m))).sort(d3.ascending); return d3.quantile(v, 0.6);
  }
  function buildSeg() {
    const p = PAIRS[state.pair];
    if (!p.cases.find((c) => c.id === state.caseId)) state.caseId = p.cases[p.cases.length - 1].id;
    seg("#case-seg", p.cases.map((c) => ({ v: c.id, label: c.label })), state.caseId, (v) => { state.caseId = v; state.c = defaultC(); chart.redraw(); });
  }
  sel.addEventListener("change", () => { state.pair = sel.value; buildSeg(); state.c = defaultC(); chart.redraw(); });
  document.getElementById("guide-reset").addEventListener("click", () => { state.c = defaultC(); chart.redraw(); });
  buildSeg(); state.c = defaultC();

  document.getElementById("ashby-legend").innerHTML = FAMILY_ORDER.map((f) => `<span><i style="background:${familyColor(f)}"></i>${f}</span>`).join("");
  window.addEventListener("themechange", () => {
    document.getElementById("ashby-legend").innerHTML = FAMILY_ORDER.map((f) => `<span><i style="background:${familyColor(f)}"></i>${f}</span>`).join("");
  });

  const chart = mount("#ashby-chart", (w) => Math.min(520, w * 0.78), (svg, w, h) => {
    const p = PAIRS[state.pair], c = curCase();
    const m = { t: 14, r: 14, b: 38, l: 50 };
    const xs = M.map(p.x), ys = M.map(p.y);
    const x = d3.scaleLog().domain([d3.min(xs) / 2.5, d3.max(xs) * 2.5]).range([m.l, w - m.r]).nice();
    const y = d3.scaleLog().domain([d3.min(ys) / 3, d3.max(ys) * 3]).range([h - m.b, m.t]).nice();
    axes(svg, x, y, w, h, m, p.xl, p.yl, { xlog: true, ylog: true, xticks: 8, yticks: 8 });
    svg.append("clipPath").attr("id", "clip-ashby").append("rect").attr("x", m.l).attr("y", m.t).attr("width", w - m.l - m.r).attr("height", h - m.t - m.b);
    const plot = svg.append("g").attr("clip-path", "url(#clip-ashby)");
    // family envelopes
    const byFam = d3.group(M, (d) => d.family);
    for (const [f, ms] of byFam) {
      const pts = ms.map((d) => [x(p.x(d)), y(p.y(d))]);
      const hull = pts.length >= 3 ? d3.polygonHull(pts) : null;
      const col = familyColor(f);
      if (hull) plot.append("path").attr("d", "M" + hull.join("L") + "Z").attr("fill", col).attr("fill-opacity", 0.1).attr("stroke", col).attr("stroke-opacity", 0.45).attr("stroke-width", 14).attr("stroke-linejoin", "round");
      else plot.append("line").attr("x1", pts[0][0]).attr("y1", pts[0][1]).attr("x2", pts[pts.length - 1][0]).attr("y2", pts[pts.length - 1][1]).attr("stroke", col).attr("stroke-opacity", 0.18).attr("stroke-width", 16).attr("stroke-linecap", "round");
    }
    // guideline: log y = (1/a)(log x + C)   where C = log M
    const lineY = (xv) => Math.pow(Math.pow(10, state.c) * xv, 1 / c.a);
    const [x0, x1] = x.domain();
    const gl = plot.append("g");
    const drawLine = () => {
      gl.selectAll("*").remove();
      const pts = d3.range(0, 101).map((i) => { const xv = x0 * Math.pow(x1 / x0, i / 100); return [x(xv), y(lineY(xv))]; });
      gl.append("path").attr("class", "guide").attr("fill", "none").attr("d", d3.line()(pts));
      gl.append("path").attr("class", "guide-hit").attr("fill", "none").attr("d", d3.line()(pts))
        .call(d3.drag().on("drag", (e) => {
          // invert pointer into new C: keep x under pointer, set y to pointer
          const xv = x.invert(e.x), yv = y.invert(e.y);
          state.c = Math.log10(Math.pow(yv, c.a) / xv); drawLine(); updatePoints(); readout();
        }));
      const lx = x.invert(w - m.r - 70); const ly = y(lineY(lx));
      if (ly > m.t + 10 && ly < h - m.b - 4) gl.append("text").attr("class", "lbl").attr("x", w - m.r - 70).attr("y", ly - 8).attr("text-anchor", "end").attr("fill", css("--hi")).style("fill", css("--hi")).text(`slope ${fmtSlope(1 / c.a)} · ${c.tex} = const`);
    };
    const ptsG = svg.append("g");
    const nodes = ptsG.selectAll("g").data(M).join("g").attr("transform", (d) => `translate(${x(p.x(d))},${y(p.y(d))})`)
      .on("mousemove", (e, d) => showTip(e, `<b>${d.name}</b><br><span class="mono">${d.family}<br>${p.xl.split(" (")[0]}: ${fmt.sig(p.x(d))}<br>${p.yl.split(" (")[0]}: ${fmt.sig(p.y(d))}<br>${c.tex} = ${fmt.sig(idx(d))}</span>`))
      .on("mouseleave", hideTip);
    nodes.append("circle").attr("r", 9).attr("fill", "transparent");
    nodes.append("circle").attr("class", "dot").attr("r", 4.5).attr("fill", (d) => familyColor(d.family)).attr("stroke", css("--paper")).attr("stroke-width", 1.5);
    nodes.append("path").attr("class", "star").attr("d", star.size(220)()).attr("fill", css("--hi")).attr("stroke", css("--paper")).attr("stroke-width", 1.2).attr("opacity", 0);
    const labels = nodes.append("text").attr("class", "lbl").attr("x", 7).attr("y", 3.5).text((d) => d.name).style("font-size", w < 520 ? "9px" : "10.5px");
    function updatePoints() {
      const best = d3.greatest(M, idx);
      nodes.classed("dim", (d) => p.y(d) < lineY(p.x(d)));
      nodes.select(".star").attr("opacity", (d) => (d === best ? 1 : 0));
      nodes.select(".dot").attr("opacity", (d) => (d === best ? 0 : 1));
      labels.attr("display", (d) => (w < 520 && p.y(d) < lineY(p.x(d)) ? "none" : null));
    }
    drawLine(); updatePoints(); readout();
  }, { label: "Interactive Ashby material-selection chart" });

  function fmtSlope(s) { const r = { 1: "1", 2: "2", 3: "3", 0.5: "1/2", 1.5: "3/2" }; const k = Math.round(s * 100) / 100; return r[k] || d3.format(".2~f")(s); }
  function readout() {
    const c = curCase(), p = PAIRS[state.pair];
    const lineY = (xv) => Math.pow(Math.pow(10, state.c) * xv, 1 / c.a);
    const ranked = M.slice().sort((a, b) => idx(b) - idx(a));
    const surv = ranked.filter((d) => p.y(d) >= lineY(p.x(d))).length;
    document.getElementById("ashby-readout").innerHTML = `
      <div>Index <b>${c.tex}</b> (maximise)</div>
      <div style="margin:6px 0"><span class="big">${surv}</span> of 22 materials above the line</div>
      <div>Top five by index</div>
      <ol>${ranked.slice(0, 5).map((d, i) => `<li class="${i === 0 ? "top" : ""}">${d.name} <span class="mono" style="color:var(--muted)">${fmt.sig(idx(d) / idx(ranked[0]), 2)}×</span></li>`).join("")}</ol>
      <div style="color:var(--muted)">Values relative to the best.</div>`;
  }

  /* ================= Figure 1.2 ================= */
  const W6 = [
    { name: "Cast iron, nodular", short: "Cast iron", rho: 7.3, E: 175, Cm: 0.25 },
    { name: "Low-alloy steel (4340)", short: "4340 steel", rho: 7.85, E: 210, Cm: 0.45 },
    { name: "Al 6061-T6", short: "Al 6061", rho: 2.85, E: 70, Cm: 0.95 },
    { name: "Al-6061-20%SiC, PM", short: "Al-SiC", rho: 2.77, E: 102, Cm: 25 },
    { name: "Ti-6-4, B265 grade 5", short: "Ti-6-4", rho: 4.43, E: 115, Cm: 20 },
    { name: "Beryllium, SR-200", short: "Beryllium", rho: 1.84, E: 305, Cm: 250 },
  ].map((d, i) => Object.assign(d, { i, P1: d.rho / Math.cbrt(d.E), P2: d.Cm * d.rho / Math.cbrt(d.E) }));
  const dominated = (d) => W6.some((o) => o !== d && o.P1 <= d.P1 && o.P2 <= d.P2 && (o.P1 < d.P1 || o.P2 < d.P2));
  const matColor = (i) => css("--s" + (i + 1));
  const alphaEl = document.getElementById("alpha"), alphaOut = document.getElementById("alpha-out");
  const getA = () => Math.pow(10, +alphaEl.value);
  const fmtGBP = (a) => "£" + (a < 10 ? d3.format(".2f")(a) : d3.format(",.0f")(a)) + "/kg";
  const pres = document.getElementById("alpha-presets");
  pres.innerHTML = [["Car", 1], ["Aircraft", 300], ["Spacecraft", 1000]].map(([l, v]) => `<button class="btn" type="button" data-v="${v}">${l} £${v}</button>`).join(" ");
  pres.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; alphaEl.value = Math.log10(+b.dataset.v); updateValue(); });

  const valueChart = mount("#value-chart", (w) => Math.min(380, w * 0.7), (svg, w, h) => {
    const a = getA();
    const m = { t: 12, r: 16, b: 38, l: 56 };
    const x = d3.scaleLog().domain([0.25, 2]).range([m.l, w - m.r]);
    const y = d3.scaleLog().domain([0.05, 400]).range([h - m.b, m.t]);
    axes(svg, x, y, w, h, m, "Mass index P₁ = ρ/E^⅓", "Cost index P₂ = Cₘ·P₁", { xlog: false, ylog: true, xfmt: d3.format(".2~f"), xticks: 6 });
    const best = d3.least(W6, (d) => a * d.P1 + d.P2);
    const V = a * best.P1 + best.P2;
    // contour V = a P1 + P2 → P2 = V − a P1
    const pts = d3.range(0, 201).map((i) => { const p1 = 0.25 + (1.75 * i) / 200; return [p1, V - a * p1]; }).filter((p) => p[1] > 0.05 && p[1] < 400);
    svg.append("path").attr("d", d3.line().x((p) => x(p[0])).y((p) => y(p[1]))(pts)).attr("fill", "none").attr("stroke", css("--hi")).attr("stroke-width", 2).attr("stroke-dasharray", "5 4");
    // front
    const front = W6.filter((d) => !dominated(d)).sort((p, q) => p.P1 - q.P1);
    svg.append("path").attr("d", d3.line().x((d) => x(d.P1)).y((d) => y(d.P2))(front)).attr("fill", "none").attr("stroke", css("--muted")).attr("stroke-width", 1.2);
    const g = svg.append("g").selectAll("g").data(W6).join("g").attr("transform", (d) => `translate(${x(d.P1)},${y(d.P2)})`)
      .on("mousemove", (e, d) => showTip(e, `<b>${d.name}</b><br><span class="mono">P₁ = ${d.P1.toFixed(3)}<br>P₂ = ${d.P2.toFixed(3)}<br>V = ${(a * d.P1 + d.P2).toFixed(2)}</span>${dominated(d) ? "<br>dominated" : ""}`))
      .on("mouseleave", hideTip);
    g.append("circle").attr("r", 12).attr("fill", "transparent");
    g.append("circle").attr("r", (d) => (d === best ? 7 : 5)).attr("fill", (d) => (dominated(d) ? css("--paper") : matColor(d.i))).attr("stroke", (d) => (d === best ? css("--hi") : matColor(d.i))).attr("stroke-width", (d) => (d === best ? 3 : 2));
    g.append("text").attr("class", "lbl").attr("x", 9).attr("y", 4).text((d) => d.short);
  }, { label: "Mass index versus cost index for six panel materials" });

  const sweep = mount("#sweep-chart", () => 74, (svg, w, h) => {
    const m = { t: 18, r: 16, b: 26, l: 56 };
    const x = d3.scaleLog().domain([0.1, 1000]).range([m.l, w - m.r]);
    const N = 400, segs = [];
    for (let i = 0; i <= N; i++) {
      const a = 0.1 * Math.pow(1e4, i / N); const b = d3.least(W6, (d) => a * d.P1 + d.P2);
      if (!segs.length || segs[segs.length - 1].b !== b) segs.push({ b, a0: a, a1: a }); else segs[segs.length - 1].a1 = a;
    }
    for (let i = 0; i < segs.length - 1; i++) segs[i].a1 = segs[i + 1].a0;
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(5).tickFormat((v) => (Number.isInteger(Math.log10(v)) ? "£" + d3.format("~g")(v) : "")));
    svg.append("text").attr("class", "axis-label").attr("x", m.l - 6).attr("y", m.t + 13).attr("text-anchor", "end").text("Winner");
    segs.forEach((s, i) => {
      const x0 = x(s.a0) + (i ? 1 : 0), x1 = x(s.a1) - 1;
      svg.append("rect").attr("x", x0).attr("y", m.t).attr("width", Math.max(1, x1 - x0)).attr("height", 18).attr("rx", 3).attr("fill", matColor(s.b.i)).attr("fill-opacity", 0.85);
      if (x1 - x0 > 60) svg.append("text").attr("x", (x0 + x1) / 2).attr("y", m.t + 13).attr("text-anchor", "middle").style("fill", css("--paper")).style("font-weight", 600).text(s.b.short);
      if (i && (i === 1 || x(s.a0) - x(segs[i - 1].a0) > 40)) svg.append("text").attr("x", x(s.a0)).attr("y", m.t - 4).attr("text-anchor", i === segs.length - 1 && i > 1 && x(s.a0) - x(segs[i - 1].a0) < 60 ? "start" : "middle").style("font-family", "var(--f-mono)").style("font-size", "9.5px").text("£" + d3.format(".2~r")(s.a0));
    });
    const a = getA();
    svg.append("line").attr("x1", x(a)).attr("x2", x(a)).attr("y1", m.t - 2).attr("y2", m.t + 20).attr("stroke", css("--ink")).attr("stroke-width", 2);
  }, { label: "Winning material across exchange constants" });

  function updateValue() {
    const a = getA(); alphaOut.textContent = fmtGBP(a);
    const ranked = W6.slice().sort((p, q) => a * p.P1 + p.P2 - (a * q.P1 + q.P2));
    document.getElementById("value-table").innerHTML = `<thead><tr><th>#</th><th>Material</th><th class="n">Cₘ £/kg</th><th class="n">V</th></tr></thead><tbody>${ranked
      .map((d, i) => `<tr class="${i === 0 ? "win" : ""}"><td class="n">${i + 1}</td><td><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${matColor(d.i)};margin-right:6px"></i>${d.name}</td><td class="n">${d.Cm}</td><td class="n">${(a * d.P1 + d.P2).toFixed(2)}</td></tr>`).join("")}</tbody>`;
    valueChart.redraw(); sweep.redraw();
  }
  alphaEl.addEventListener("input", updateValue);
  window.addEventListener("themechange", updateValue);
  updateValue();

  /* ================= Figure 1.3 ================= */
  const ECO = [
    { name: "Structural wood", rho: 500, E: 10, sy: 40, eco: 0.05 },
    { name: "Concrete", rho: 2400, E: 30, sy: 30, eco: 0.02 },
    { name: "Mild steel", rho: 7850, E: 210, sy: 250, eco: 0.4 },
    { name: "Aluminium alloy", rho: 2700, E: 70, sy: 100, eco: 1.0 },
    { name: "PET plastic", rho: 1350, E: 2.8, sy: 55, eco: 0.6 },
    { name: "GFRP composite", rho: 1800, E: 20, sy: 200, eco: 1.5 },
  ].map((d, i) => Object.assign(d, { i, ecoV: d.eco * d.rho }));
  const ecoState = { mode: "E", c: null };
  const ECOMODES = {
    E: { x: (d) => d.E, xl: "Young's modulus E (GPa)", p: 0.5, idx: (d) => d.ecoV / Math.sqrt(d.E), name: "I_E = eco-cost_V / E^½" },
    S: { x: (d) => d.sy, xl: "Yield strength σy (MPa)", p: 2 / 3, idx: (d) => d.ecoV / Math.pow(d.sy, 2 / 3), name: "I_σ,bend = eco-cost_V / σy^⅔" },
  };
  const ecoDefault = () => d3.quantile(ECO.map((d) => Math.log10(ECOMODES[ecoState.mode].idx(d))).sort(d3.ascending), 0.5);
  ecoState.c = ecoDefault();
  seg("#eco-seg", [{ v: "E", label: "Stiff beam  (vs E)" }, { v: "S", label: "Strong beam  (vs σy)" }], "E", (v) => { ecoState.mode = v; ecoState.c = ecoDefault(); ecoChart.redraw(); ecoBars.redraw(); });

  const ecoChart = mount("#eco-chart", (w) => Math.min(380, w * 0.75), (svg, w, h) => {
    const md = ECOMODES[ecoState.mode];
    const m = { t: 12, r: 14, b: 38, l: 56 };
    const x = d3.scaleLog().domain(ecoState.mode === "E" ? [1, 1000] : [10, 1000]).range([m.l, w - m.r]);
    const y = d3.scaleLog().domain([10, 10000]).range([h - m.b, m.t]);
    axes(svg, x, y, w, h, m, md.xl, "Eco-cost per volume (€/m³)", { xlog: true, ylog: true });
    // line: ecoV = I * x^p ; I = 10^c ; points below/right are better (lower index)
    const ly = (xv) => Math.pow(10, ecoState.c) * Math.pow(xv, md.p);
    const g = svg.append("g");
    const pts = svg.append("g");
    function draw() {
      g.selectAll("*").remove();
      const [x0, x1] = x.domain();
      const path = d3.range(0, 61).map((i) => { const xv = x0 * Math.pow(x1 / x0, i / 60); return [x(xv), y(ly(xv))]; }).filter((p) => p[1] >= m.t - 30 && p[1] <= h - m.b + 30);
      g.append("clipPath").attr("id", "clip-eco").append("rect").attr("x", m.l).attr("y", m.t).attr("width", w - m.l - m.r).attr("height", h - m.t - m.b);
      const gg = g.append("g").attr("clip-path", "url(#clip-eco)");
      gg.append("path").attr("class", "guide").attr("fill", "none").attr("d", d3.line()(path));
      gg.append("path").attr("class", "guide-hit").attr("fill", "none").attr("d", d3.line()(path)).call(d3.drag().on("drag", (e) => {
        ecoState.c = Math.log10(y.invert(e.y) / Math.pow(x.invert(e.x), md.p)); draw(); dots();
      }));
      g.append("text").attr("class", "lbl").attr("x", w - m.r - 4).attr("y", m.t + 12).attr("text-anchor", "end").style("fill", css("--hi")).text(`slope ${ecoState.mode === "E" ? "1/2" : "2/3"}`);
    }
    function dots() {
      pts.selectAll("*").remove();
      const best = d3.least(ECO, md.idx);
      const n = pts.selectAll("g").data(ECO).join("g").attr("transform", (d) => `translate(${x(md.x(d))},${y(d.ecoV)})`)
        .classed("dim", (d) => d.ecoV > ly(md.x(d)))
        .on("mousemove", (e, d) => showTip(e, `<b>${d.name}</b><br><span class="mono">eco-cost ${d.eco} €/kg · ρ ${d.rho} kg/m³<br>eco-cost_V ${fmt.sig(d.ecoV)} €/m³<br>index ${md.idx(d).toFixed(1)}</span>`))
        .on("mouseleave", hideTip);
      n.append("circle").attr("r", 11).attr("fill", "transparent");
      n.append("circle").attr("r", 5.5).attr("fill", (d) => matColor(d.i)).attr("stroke", (d) => (d === best ? css("--hi") : css("--paper"))).attr("stroke-width", (d) => (d === best ? 3 : 1.5));
      n.append("text").attr("class", "lbl").attr("x", 8).attr("y", 4).text((d) => d.name);
    }
    draw(); dots();
  }, { label: "Eco-Ashby chart" });

  const ecoBars = mount("#eco-bars", (w) => Math.min(260, w * 0.7), (svg, w, h) => {
    const md = ECOMODES[ecoState.mode];
    const data = ECO.slice().sort((a, b) => md.idx(a) - md.idx(b));
    const m = { t: 22, r: 44, b: 26, l: 112 };
    const x = d3.scaleLog().domain([1, 1000]).range([m.l, w - m.r]);
    const y = d3.scaleBand().domain(data.map((d) => d.name)).range([m.t, h - m.b]).padding(0.28);
    svg.append("text").attr("x", m.l).attr("y", 12).attr("class", "axis-label").text(md.name + "  (lower is better)");
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(3).tickFormat(fmt.logTick));
    svg.append("g").selectAll("rect").data(data).join("rect").attr("x", m.l).attr("y", (d) => y(d.name)).attr("height", y.bandwidth()).attr("width", (d) => Math.max(2, x(md.idx(d)) - m.l)).attr("rx", 3).attr("fill", (d) => matColor(d.i));
    svg.append("g").selectAll("text").data(data).join("text").attr("x", m.l - 6).attr("y", (d) => y(d.name) + y.bandwidth() / 2 + 4).attr("text-anchor", "end").text((d) => d.name);
    svg.append("g").selectAll("text").data(data).join("text").attr("class", "mono").attr("x", (d) => x(md.idx(d)) + 4).attr("y", (d) => y(d.name) + y.bandwidth() / 2 + 4).style("font-family", "var(--f-mono)").style("font-size", "10px").text((d) => md.idx(d).toFixed(1));
  }, { label: "Materials ranked by eco-index" });
})();
