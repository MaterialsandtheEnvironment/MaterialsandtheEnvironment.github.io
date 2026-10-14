/* Chapter 4 figures, computed from the TOSM result files. */
(function () {
  "use strict";
  const { css, showTip, hideTip, mount, fmt, axes, seg } = window.MATENV;
  const T = window.TOSM;
  const MAT = Object.fromEntries(T.materials.map((m) => [m.id, m]));
  const IDS = ["Ti", "Al", "SS", "BeCu"];
  const COLOR = { Ti: "--s1", Al: "--s2", SS: "--s3", BeCu: "--s7" };
  const SHAPE = { Ti: d3.symbolCircle, Al: d3.symbolTriangle, SS: d3.symbolSquare, BeCu: d3.symbolDiamond };
  const col = (id) => css(COLOR[id]);
  let USE = T.useFactor;

  // flatten runs
  const RUNS = [];
  T.brackets.forEach((b) => IDS.forEach((id) => {
    const [mass, vm, disp] = b[id]; const m = MAT[id];
    RUNS.push({ b: b.id, id, mass, vm, disp, u: vm / m.yield });
  }));
  const co2 = (r) => r.mass * (USE + MAT[r.id].co2 / 1000);
  const OUT = {
    mass: { label: "Mass (kg)", get: (r) => r.mass },
    co2: { label: "Lifetime CO₂ (t)", get: co2 },
    energy: { label: "Production energy (MJ)", get: (r) => r.mass * MAT[r.id].energy },
    water: { label: "Water (L)", get: (r) => r.mass * MAT[r.id].water },
    cost: { label: "Material cost ($)", get: (r) => r.mass * MAT[r.id].cost },
    vm: { label: "Peak von Mises stress (MPa)", get: (r) => r.vm },
    disp: { label: "Peak displacement (mm)", get: (r) => r.disp },
  };
  const legendHTML = () => IDS.map((id) => `<span><svg width="12" height="12" viewBox="-6 -6 12 12"><path d="${d3.symbol().type(SHAPE[id]).size(60)()}" fill="${col(id)}"/></svg>${MAT[id].name}</span>`).join("");

  /* ---------- table ---------- */
  document.getElementById("mat-table").innerHTML = IDS.map((id) => { const m = MAT[id];
    return `<tr><td><svg width="12" height="12" viewBox="-6 -6 12 12" style="margin-right:6px"><path d="${d3.symbol().type(SHAPE[id]).size(60)()}" fill="${col(id)}"/></svg>${m.name}</td><td class="n">${d3.format(",")(m.rho)}</td><td class="n">${m.E}</td><td class="n">${d3.format(".0f")(m.yield)}</td><td class="n">${m.co2}</td><td class="n">${m.energy}</td><td class="n">${m.water}</td><td class="n">${m.cost}</td></tr>`; }).join("");

  /* ---------- 4.1 split ---------- */
  const ufEl = document.getElementById("uf");
  const medMass = Object.fromEntries(IDS.map((id) => [id, d3.median(RUNS.filter((r) => r.id === id), (r) => r.mass)]));
  const split = mount("#split-chart", () => 170, (svg, w, h) => {
    const m = { t: 8, r: 70, b: 34, l: 104 };
    const rows = IDS.map((id) => ({ id, prod: medMass[id] * MAT[id].co2 / 1000, use: medMass[id] * USE }));
    const x = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.prod + r.use) * 1.05]).range([m.l, w - m.r]).nice();
    const y = d3.scaleBand().domain(IDS).range([m.t, h - m.b]).padding(0.3);
    svg.append("g").attr("class", "grid").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(6).tickSize(-(h - m.t - m.b)).tickFormat(""));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(6).tickFormat((v) => (USE ? d3.format("~g")(v) : d3.format("~g")(v * 1000))));
    svg.append("text").attr("class", "axis-label").attr("x", w - m.r).attr("y", h - 4).attr("text-anchor", "end").text(USE ? "CO₂ (t), median-mass bracket" : "Production CO₂ (kg), median-mass bracket");
    rows.forEach((r) => {
      svg.append("rect").attr("x", m.l).attr("y", y(r.id)).attr("height", y.bandwidth()).attr("width", Math.max(1, x(r.prod) - m.l)).attr("rx", 2).attr("fill", css("--hi"));
      svg.append("rect").attr("x", x(r.prod) + (USE ? 1 : 0)).attr("y", y(r.id)).attr("height", y.bandwidth()).attr("width", Math.max(0, x(r.prod + r.use) - x(r.prod) - 1)).attr("rx", 2).attr("fill", col(r.id));
      svg.append("text").attr("x", m.l - 8).attr("y", y(r.id) + y.bandwidth() / 2 + 4).attr("text-anchor", "end").style("fill", css("--ink")).text(MAT[r.id].name);
      svg.append("text").attr("x", x(r.prod + r.use) + 6).attr("y", y(r.id) + y.bandwidth() / 2 + 4).style("font-family", "var(--f-mono)").style("font-size", "10px")
        .text(USE ? d3.format(".1f")(r.prod + r.use) + " t" : d3.format(".1f")(r.prod * 1000) + " kg");
    });
  }, { label: "CO2 split between production and use phase" });
  function updSplit() {
    USE = +ufEl.value; document.getElementById("uf-out").textContent = USE.toFixed(1) + " t/kg";
    const ti = MAT.Ti, share = (ti.co2 / 1000) / (ti.co2 / 1000 + USE);
    document.getElementById("split-readout").innerHTML = USE
      ? `Production is <b class="num">${d3.format(".3~%")(share)}</b> of titanium's lifetime CO₂ (ochre sliver, barely visible). Aluminium's lower production footprint per kg matters far less than its lower density.`
      : `With no use phase, steel and beryllium copper have the lowest production CO₂ per bracket despite being heaviest: their footprint per kilogram is four times lower than titanium's.`;
    split.redraw(); pareto.redraw(); paretoReadout();
  }
  ufEl.addEventListener("input", updSplit);
  document.getElementById("uf-reset").addEventListener("click", () => { ufEl.value = 98.8; updSplit(); });

  /* ---------- 4.2 delta ---------- */
  const DELTA_KEYS = ["mass", "co2", "energy", "water", "cost", "disp", "vm"];
  const byB = d3.group(RUNS, (r) => r.b);
  function medianDelta(id, k) {
    const g = OUT[k].get; const v = [];
    byB.forEach((rs) => { const ti = rs.find((r) => r.id === "Ti"), o = rs.find((r) => r.id === id); if (g(ti) > 0) v.push(g(o) / g(ti) - 1); });
    return d3.median(v);
  }
  const savedUse = USE; USE = T.useFactor;
  const DELTA = DELTA_KEYS.map((k) => ({ k, label: OUT[k].label.replace(/ \(.*\)/, ""), v: Object.fromEntries(["Al", "SS", "BeCu"].map((id) => [id, medianDelta(id, k)])) }));
  USE = savedUse;
  function deltaLegend() { document.getElementById("delta-legend").innerHTML = ["Al", "SS", "BeCu"].map((id) => `<span><svg width="12" height="12" viewBox="-6 -6 12 12"><path d="${d3.symbol().type(SHAPE[id]).size(60)()}" fill="${col(id)}"/></svg>${MAT[id].name}</span>`).join("") + `<span style="color:var(--muted)">0% = Ti-6Al-4V</span>`; }
  deltaLegend(); window.addEventListener("themechange", deltaLegend);
  mount("#delta-chart", () => DELTA.length * 34 + 44, (svg, w, h) => {
    const narrow = w < 520;
    const m = { t: 8, r: 20, b: 34, l: narrow ? 110 : 170 };
    const x = d3.scaleLinear().domain([-1, 2]).range([m.l, w - m.r]);
    const y = d3.scaleBand().domain(DELTA.map((d) => d.k)).range([m.t, h - m.b]).padding(0.2);
    svg.append("g").attr("class", "grid").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(6).tickSize(-(h - m.t - m.b)).tickFormat(""));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(6).tickFormat((v) => (v > 0 ? "+" : "") + d3.format(".0%")(v)));
    svg.append("line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", m.t).attr("y2", h - m.b).attr("stroke", css("--ink-2")).attr("stroke-width", 1.2);
    svg.append("text").attr("class", "axis-label").attr("x", w - m.r).attr("y", h - 4).attr("text-anchor", "end").text("Median change vs the same bracket in titanium");
    DELTA.forEach((d) => {
      const yc = y(d.k) + y.bandwidth() / 2;
      svg.append("text").attr("x", m.l - 10).attr("y", yc + 4).attr("text-anchor", "end").style("fill", css("--ink")).text(d.label);
      const vs = Object.values(d.v);
      svg.append("line").attr("x1", x(d3.min(vs.concat(0)))).attr("x2", x(d3.max(vs.concat(0)))).attr("y1", yc).attr("y2", yc).attr("stroke", css("--rule")).attr("stroke-width", 2);
      ["Al", "SS", "BeCu"].forEach((id, i) => {
        svg.append("path").attr("transform", `translate(${x(d.v[id])},${yc})`).attr("d", d3.symbol().type(SHAPE[id]).size(90)()).attr("fill", col(id)).attr("stroke", css("--paper")).attr("stroke-width", 1.5)
          .on("mousemove", (e) => showTip(e, `<b>${MAT[id].name}</b> · ${d.label}<br><span class="mono">${(d.v[id] > 0 ? "+" : "") + d3.format(".1%")(d.v[id])} vs Ti-6Al-4V</span>`)).on("mouseleave", hideTip);
      });
      if (d.k === "mass" || d.k === "disp") {
        ["Al"].forEach((id) => svg.append("text").attr("x", x(d.v[id])).attr("y", yc - 9).attr("text-anchor", "middle").style("font-family", "var(--f-mono)").style("font-size", "9.5px").text((d.v[id] > 0 ? "+" : "") + d3.format(".0%")(d.v[id])));
      }
    });
  }, { label: "Change of each output relative to titanium" });

  /* ---------- 4.3 CDF ---------- */
  const sfEl = document.getElementById("sf");
  const cdf = mount("#cdf-chart", (w) => Math.min(340, w * 0.62), (svg, w, h) => {
    const sf = +sfEl.value;
    const m = { t: 12, r: 14, b: 38, l: 46 };
    const x = d3.scaleLog().domain([0.1, 200]).range([m.l, w - m.r]);
    const y = d3.scaleLinear().domain([0, 1]).range([h - m.b, m.t]);
    axes(svg, x, y, w, h, m, "Utilisation σ/σy (log)", "Share of brackets", { xfmt: (v) => (fmt.log125(v) ? d3.format("~g")(v) : ""), yfmt: d3.format(".0%"), xticks: 10 });
    svg.append("rect").attr("x", m.l).attr("y", m.t).attr("width", x(1 / sf) - m.l).attr("height", h - m.t - m.b).attr("fill", css("--good")).attr("fill-opacity", 0.07);
    svg.append("clipPath").attr("id", "clip-cdf").append("rect").attr("x", m.l).attr("y", m.t - 2).attr("width", w - m.l - m.r).attr("height", h - m.t - m.b + 4);
    const cg = svg.append("g").attr("clip-path", "url(#clip-cdf)");
    IDS.forEach((id) => {
      const u = RUNS.filter((r) => r.id === id).map((r) => r.u).sort(d3.ascending);
      const pts = [[0.1, 0]].concat(u.flatMap((v, i) => [[v, i / u.length], [v, (i + 1) / u.length]])).concat([[200, 1]]);
      cg.append("path").attr("fill", "none").attr("stroke", col(id)).attr("stroke-width", 2).attr("d", d3.line().x((p) => x(Math.min(p[0], 400))).y((p) => y(p[1]))(pts));
      const med = d3.median(u);
      svg.append("path").attr("transform", `translate(${x(med)},${y(0.5)})`).attr("d", d3.symbol().type(SHAPE[id]).size(70)()).attr("fill", col(id)).attr("stroke", css("--paper"));
    });
    svg.append("line").attr("x1", x(1 / sf)).attr("x2", x(1 / sf)).attr("y1", m.t).attr("y2", h - m.b).attr("stroke", css("--hi")).attr("stroke-width", 2);
    svg.append("text").attr("x", x(1 / sf) + 5).attr("y", m.t + 12).style("fill", css("--hi")).style("font-size", "10.5px").text(`1/SF = ${(1 / sf).toFixed(2)}`);
    svg.append("text").attr("x", m.l + 6).attr("y", y(0.5) - 8).style("font-size", "10px").style("fill", css("--muted")).text("markers: medians");
  }, { label: "Cumulative utilisation by alloy" });
  function updCdf() {
    const sf = +sfEl.value; document.getElementById("sf-out").textContent = sf.toFixed(2);
    const pass = IDS.map((id) => ({ id, n: RUNS.filter((r) => r.id === id && r.u <= 1 / sf).length, med: d3.median(RUNS.filter((r) => r.id === id), (r) => r.u) }));
    const tot = d3.sum(pass, (p) => p.n);
    document.getElementById("cdf-readout").innerHTML = `<div><span class="big">${tot}</span> of 1 516 runs admissible at SF = ${sf.toFixed(2)}</div>
      <div class="table-wrap" style="margin:8px 0 0"><table><thead><tr><th>Alloy</th><th class="n">Pass</th><th class="n" style="text-transform:none;letter-spacing:0">Median σ/σy</th></tr></thead><tbody>
      ${pass.map((p) => `<tr><td><svg width="12" height="12" viewBox="-6 -6 12 12" style="margin-right:6px"><path d="${d3.symbol().type(SHAPE[p.id]).size(60)()}" fill="${col(p.id)}"/></svg>${MAT[p.id].name}</td><td class="n">${p.n}</td><td class="n">${p.med.toFixed(2)}</td></tr>`).join("")}</tbody></table></div>`;
    cdf.redraw();
  }
  sfEl.addEventListener("input", updCdf); window.addEventListener("themechange", updCdf); updCdf();

  /* ---------- 4.4 Pareto ---------- */
  const px = document.getElementById("px"), py = document.getElementById("py"), psf = document.getElementById("psf");
  const opts = Object.entries(OUT).map(([k, o]) => `<option value="${k}">${o.label}</option>`).join("");
  px.innerHTML = opts; py.innerHTML = opts; px.value = "co2"; py.value = "vm";
  let cons = "correct", selB = null;
  seg("#pcons", [{ v: "correct", label: "σ ≤ σy/SF (correct)" }, { v: "bug", label: "Notebook (inverted)" }], cons, (v) => { cons = v; pareto.redraw(); paretoReadout(); });
  const feasible = (r) => { const lim = MAT[r.id].yield / +psf.value; return cons === "correct" ? r.vm <= lim : r.vm >= lim; };
  function front() {
    const fx = OUT[px.value].get, fy = OUT[py.value].get;
    const F = RUNS.filter(feasible).map((r) => ({ r, x: fx(r), y: fy(r) })).sort((a, b) => a.x - b.x || a.y - b.y);
    const out = []; let best = Infinity;
    F.forEach((p) => { if (p.y < best) { out.push(p); best = p.y; } });
    return { F, out };
  }
  function pLegend() { document.getElementById("pareto-legend").innerHTML = legendHTML() + `<span style="color:var(--muted)">grey: not admissible</span><span><i style="background:var(--hi);border-radius:1px"></i>Pareto front</span>`; }
  pLegend(); window.addEventListener("themechange", pLegend);
  const pareto = mount("#pareto-chart", (w) => Math.min(460, w * 0.78), (svg, w, h) => {
    const fx = OUT[px.value].get, fy = OUT[py.value].get;
    const m = { t: 12, r: 14, b: 38, l: 56 };
    const xs = RUNS.map(fx).filter((v) => v > 0), ys = RUNS.map(fy).filter((v) => v > 0);
    const x = d3.scaleLog().domain([d3.min(xs) / 1.2, d3.max(xs) * 1.2]).range([m.l, w - m.r]);
    const y = d3.scaleLog().domain([d3.min(ys) / 1.2, d3.max(ys) * 1.2]).range([h - m.b, m.t]);
    axes(svg, x, y, w, h, m, OUT[px.value].label, OUT[py.value].label, { xfmt: fmt.log125, yfmt: fmt.log125, xticks: 8, yticks: 8 });
    const { out } = front(); const onFront = new Set(out.map((p) => p.r));
    const g = svg.append("g");
    const sorted = RUNS.slice().sort((a, b) => feasible(a) - feasible(b));
    g.selectAll("path").data(sorted.filter((r) => fx(r) > 0 && fy(r) > 0)).join("path")
      .attr("transform", (r) => `translate(${x(fx(r))},${y(fy(r))})`)
      .attr("d", (r) => d3.symbol().type(SHAPE[r.id]).size(onFront.has(r) ? 90 : 26)())
      .attr("fill", (r) => (feasible(r) ? col(r.id) : css("--rule")))
      .attr("fill-opacity", (r) => (feasible(r) ? 0.9 : 0.8))
      .attr("stroke", (r) => (onFront.has(r) ? css("--hi") : "none")).attr("stroke-width", 1.5)
      .style("cursor", "pointer")
      .on("mousemove", (e, r) => showTip(e, `<b>Bracket ${r.b}</b> · ${MAT[r.id].name}<br><span class="mono">mass ${r.mass.toFixed(3)} kg · σ ${r.vm} MPa (${r.u.toFixed(2)} σy)<br>disp ${r.disp} mm · CO₂ ${co2(r).toFixed(1)} t</span>${feasible(r) ? "" : "<br>not admissible"}`))
      .on("mouseleave", hideTip)
      .on("click", (e, r) => { selB = selB === r.b ? null : r.b; pareto.redraw(); paretoReadout(); });
    if (out.length > 1) {
      const stepPts = []; out.forEach((p, i) => { if (i) stepPts.push([p.x, out[i - 1].y]); stepPts.push([p.x, p.y]); });
      svg.append("path").attr("fill", "none").attr("stroke", css("--hi")).attr("stroke-width", 1.6).attr("d", d3.line().x((p) => x(p[0])).y((p) => y(p[1]))(stepPts)).style("pointer-events", "none");
    }
    if (selB !== null) {
      const rs = IDS.map((id) => RUNS.find((r) => r.b === selB && r.id === id)).filter((r) => fx(r) > 0 && fy(r) > 0);
      svg.append("path").attr("fill", "none").attr("stroke", css("--ink")).attr("stroke-width", 1.2).attr("stroke-dasharray", "3 3").attr("d", d3.line().x((r) => x(fx(r))).y((r) => y(fy(r)))(rs)).style("pointer-events", "none");
      rs.forEach((r) => svg.append("path").attr("transform", `translate(${x(fx(r))},${y(fy(r))})`).attr("d", d3.symbol().type(SHAPE[r.id]).size(110)()).attr("fill", col(r.id)).attr("stroke", css("--ink")).attr("stroke-width", 1.5).style("pointer-events", "none"));
      svg.append("text").attr("class", "lbl").attr("x", x(fx(rs[0])) + 8).attr("y", y(fy(rs[0])) - 8).text(`Bracket ${selB}`);
    }
  }, { label: "Pareto explorer of bracket-alloy runs" });
  function paretoReadout() {
    const { F, out } = front();
    const fx = OUT[px.value], fy = OUT[py.value];
    const short = (o) => o.label.replace(/ \(.*\)/, "");
    const unit = (o) => (o.label.match(/\((.*)\)/) || [, ""])[1];
    document.getElementById("pareto-readout").innerHTML = `<div><span class="big">${F.length}</span> admissible runs · <span class="big">${out.length}</span> on the front</div>
      ${cons === "bug" ? `<div class="warn" style="margin-top:4px">Inverted constraint: only over-stressed runs count as feasible.</div>` : ""}
      <div class="table-wrap" style="margin:8px 0 0;max-height:300px;overflow-y:auto"><table><thead><tr><th>Bracket</th><th>Alloy</th><th class="n">${short(fx)}</th><th class="n">${short(fy)}</th></tr></thead><tbody>
      ${out.slice(0, 40).map((p) => `<tr${p.r.b === selB ? ' class="win"' : ""}><td class="n">${p.r.b}</td><td>${MAT[p.r.id].name}</td><td class="n">${fmt.sig(p.x)} ${unit(fx)}</td><td class="n">${fmt.sig(p.y)} ${unit(fy)}</td></tr>`).join("")}</tbody></table></div>
      ${out.length > 40 ? `<div style="color:var(--muted)">First 40 of ${out.length} shown.</div>` : ""}`;
  }
  [px, py].forEach((e) => e.addEventListener("change", () => { pareto.redraw(); paretoReadout(); }));
  psf.addEventListener("input", () => { document.getElementById("psf-out").textContent = (+psf.value).toFixed(2); pareto.redraw(); paretoReadout(); });
  updSplit();
})();
