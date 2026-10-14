/* Chapter 3 figures: Ecolizer family ranges, family eco-index, energy vs route, mask, imputation. */
(function () {
  "use strict";
  const { css, showTip, hideTip, mount, fmt, axes, seg } = window.MATENV;
  // Source: "Mapping the Ecolizer", Table 1 (193 materials, 14 families). rho/E: representative handbook values (approximate).
  const FAM = [
    { f: "Ferrous metals", n: 9, med: 231, lo: 61, hi: 1105, rE: 7, rho: 7850, E: 205 },
    { f: "Non-ferrous metals", n: 15, med: 646, lo: 45, hi: 3768, rE: 12, rho: 4500, E: 90 },
    { f: "Precious & critical metals", n: 7, med: 1.2e6, lo: 63042, hi: 9.6e6, rE: 6, rho: 15000, E: 150, precious: true },
    { f: "Thermoplastics", n: 24, med: 396, lo: 220, hi: 16929, rE: 19, rho: 1100, E: 2.5 },
    { f: "Composites & thermosets", n: 14, med: 552, lo: 264, hi: 1249, rE: 13, rho: 1700, E: 20 },
    { f: "Elastomers", n: 6, med: 400, lo: 230, hi: 599, rE: 6, rho: 1100, E: 0.01 },
    { f: "Bio-based plastics", n: 2, med: 294, lo: 275, hi: 312, rE: 2, rho: 1250, E: 3.5 },
    { f: "Recycled plastics", n: 6, med: 78, lo: 62, hi: 95, rE: 0 },
    { f: "Wood & panels", n: 17, med: 224, lo: 59, hi: 558, rE: 17, rho: 600, E: 10 },
    { f: "Paper & board", n: 14, med: 232, lo: 76, hi: 347, rE: 9, rho: 750, E: 4 },
    { f: "Glass & ceramics", n: 9, med: 82, lo: 17, hi: 124, rE: 9, rho: 2500, E: 70 },
    { f: "Minerals & cement", n: 26, med: 9.2, lo: 0.3, hi: 195, rE: 12, rho: 2300, E: 25 },
    { f: "Insulation", n: 6, med: 253, lo: 50, hi: 530, rE: 6, rho: 60, E: 0.005 },
    { f: "Chemicals & glues", n: 38, med: 194, lo: 0.001, hi: 5306, rE: 0 },
  ];
  const fmtPt = (v) => (v >= 1e6 ? d3.format(".2~r")(v / 1e6) + " M" : v >= 1000 ? d3.format(",.0f")(v) : d3.format(".3~r")(v));

  /* ---------- 3.1 ---------- */
  const sortSel = document.getElementById("fam-sort"), precChk = document.getElementById("fam-precious");
  const famChart = mount("#fam-chart", () => (precChk.checked ? 14 : 13) * 26 + 50, (svg, w, h) => {
    const key = sortSel.value;
    const data = FAM.filter((d) => precChk.checked || !d.precious).slice()
      .sort((a, b) => (key === "median" ? b.med - a.med : key === "max" ? b.hi - a.hi : key === "span" ? b.hi / b.lo - a.hi / a.lo : b.n - a.n));
    const narrow = w < 560;
    const m = { t: 10, r: narrow ? 40 : 70, b: 34, l: narrow ? 128 : 186 };
    const x = d3.scaleLog().domain([precChk.checked ? 1e-3 : 1e-3, precChk.checked ? 2e7 : 3e4]).range([m.l, w - m.r]);
    const y = d3.scaleBand().domain(data.map((d) => d.f)).range([m.t, m.t + data.length * 26]).padding(0.35);
    const xa = d3.axisBottom(x).ticks(10).tickFormat(fmt.logTick);
    svg.append("g").attr("class", "grid").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(10).tickSize(-(h - m.t - m.b)).tickFormat(""));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.b})`).call(xa);
    svg.append("text").attr("class", "axis-label").attr("x", w - m.r).attr("y", h - 4).attr("text-anchor", "end").text("Production indicator (mPt/kg)");
    const g = svg.append("g").selectAll("g").data(data).join("g").attr("transform", (d) => `translate(0,${y(d.f)})`)
      .on("mousemove", (e, d) => showTip(e, `<b>${d.f}</b><br><span class="mono">${d.n} entries · ${d.rE} with ρ and E<br>median ${fmtPt(d.med)} mPt/kg<br>range ${fmtPt(d.lo)} – ${fmtPt(d.hi)}</span>`)).on("mouseleave", hideTip);
    g.append("rect").attr("x", m.l - 6).attr("y", -4).attr("width", w - m.l).attr("height", y.bandwidth() + 8).attr("fill", "transparent");
    g.append("rect").attr("x", (d) => x(d.lo)).attr("width", (d) => Math.max(3, x(d.hi) - x(d.lo))).attr("y", 2).attr("height", y.bandwidth() - 4).attr("rx", 4)
      .attr("fill", (d) => (d.precious ? css("--s2") : css("--s1"))).attr("fill-opacity", 0.35);
    g.append("circle").attr("cx", (d) => x(d.med)).attr("cy", y.bandwidth() / 2).attr("r", 5).attr("fill", (d) => (d.precious ? css("--s2") : css("--s1"))).attr("stroke", css("--paper")).attr("stroke-width", 2);
    g.append("text").attr("x", m.l - 10).attr("y", y.bandwidth() / 2 + 4).attr("text-anchor", "end").style("font-size", narrow ? "10px" : "11.5px").style("fill", css("--ink")).text((d) => d.f);
    g.append("text").attr("x", (d) => x(d.med)).attr("y", -1).attr("text-anchor", "middle").style("font-family", "var(--f-mono)").style("font-size", "9.5px").text((d) => fmtPt(d.med));
    g.append("text").attr("x", w - 4).attr("y", y.bandwidth() / 2 + 4).attr("text-anchor", "end").style("font-family", "var(--f-mono)").style("font-size", "10px").text((d) => (narrow ? `${d.rE}` : `${d.rE}/${d.n}`));
    svg.append("text").attr("x", w - 4).attr("y", m.t - 0).attr("text-anchor", "end").style("font-size", "9.5px").style("fill", css("--muted")).text(narrow ? "ρ,E" : "with ρ,E");
  }, { label: "Production indicator ranges by family" });
  sortSel.addEventListener("change", () => famChart.redraw());
  precChk.addEventListener("change", () => famChart.redraw());

  /* ---------- 3.2 ---------- */
  const CASES = { tie: { a: 1, label: "Tie  prod·ρ/E" }, beam: { a: 0.5, label: "Beam  prod·ρ/E½" }, panel: { a: 1 / 3, label: "Panel  prod·ρ/E⅓" } };
  let ecoCase = "beam";
  const ecoPrec = document.getElementById("eco-precious");
  seg("#eco-case", Object.entries(CASES).map(([k, c]) => ({ v: k, label: c.label })), ecoCase, (v) => { ecoCase = v; ecoChart.redraw(); });
  ecoPrec.addEventListener("change", () => ecoChart.redraw());
  const ecoChart = mount("#ecoindex-chart", (w) => (ecoPrec.checked ? 12 : 11) * 26 + 46, (svg, w, h) => {
    const a = CASES[ecoCase].a;
    const I = (d) => (d.med * d.rho) / Math.pow(d.E, a);
    const data = FAM.filter((d) => d.rE > 0 && (ecoPrec.checked || !d.precious)).sort((p, q) => I(p) - I(q));
    const best = I(data[0]);
    const narrow = w < 560;
    const m = { t: 8, r: 60, b: 34, l: narrow ? 128 : 186 };
    const x = d3.scaleLog().domain([1, d3.max(data, (d) => I(d) / best) * 2]).range([m.l, w - m.r]);
    const y = d3.scaleBand().domain(data.map((d) => d.f)).range([m.t, h - m.b]).padding(0.3);
    svg.append("g").attr("class", "grid").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(8).tickSize(-(h - m.t - m.b)).tickFormat(""));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(8).tickFormat((v) => (Number.isInteger(Math.log10(v)) ? fmt.logTick(v) + "×" : "")));
    svg.append("text").attr("class", "axis-label").attr("x", w - m.r).attr("y", h - 4).attr("text-anchor", "end").text("Eco-index relative to the best family (lower is better)");
    const g = svg.append("g").selectAll("g").data(data).join("g").attr("transform", (d) => `translate(0,${y(d.f)})`)
      .on("mousemove", (e, d) => showTip(e, `<b>${d.f}</b><br><span class="mono">median prod ${fmtPt(d.med)} mPt/kg<br>representative ρ ${d3.format(",")(d.rho)} kg/m³ · E ${d.E} GPa<br>I = ${fmt.sig(I(d))}</span>`)).on("mouseleave", hideTip);
    g.append("rect").attr("x", m.l).attr("height", y.bandwidth()).attr("width", (d) => Math.max(3, x(I(d) / best) - m.l + 3)).attr("rx", 3)
      .attr("fill", (d, i) => (i === 0 ? css("--hi") : d.precious ? css("--s2") : css("--s1"))).attr("fill-opacity", (d, i) => (i === 0 ? 1 : 0.75));
    g.append("text").attr("x", m.l - 10).attr("y", y.bandwidth() / 2 + 4).attr("text-anchor", "end").style("font-size", narrow ? "10px" : "11.5px").style("fill", css("--ink")).text((d) => d.f);
    g.append("text").attr("x", (d) => x(I(d) / best) + 7).attr("y", y.bandwidth() / 2 + 4).style("font-family", "var(--f-mono)").style("font-size", "10px").text((d) => (I(d) / best < 10 ? d3.format(".2~f")(I(d) / best) : d3.format(",.0f")(I(d) / best)) + "×");
  }, { label: "Eco-index by family" });

  /* ---------- 3.3 ---------- */
  const mEl = document.getElementById("en-mass"), rEl = document.getElementById("en-rec"), kEl = document.getElementById("en-kwh");
  const P = { prim: 1045, sec: 45, CH: 3, GR: 113 };
  const energyChart = mount("#energy-chart", () => 190, (svg, w, h) => {
    const mass = +mEl.value, rec = +rEl.value / 100, kwh = +kEl.value;
    const prod = mass * (rec * P.sec + (1 - rec) * P.prim);
    const rows = [{ k: "Swiss grid", use: kwh * P.CH }, { k: "Greek grid", use: kwh * P.GR }];
    const narrow = w < 520;
    const m = { t: 24, r: 20, b: 34, l: narrow ? 82 : 100 };
    const max = d3.max(rows, (r) => prod + r.use) * 1.08 || 1;
    const x = d3.scaleLinear().domain([0, max]).range([m.l, w - m.r]).nice();
    const y = d3.scaleBand().domain(rows.map((r) => r.k)).range([m.t, h - m.b]).padding(0.35);
    svg.append("g").attr("class", "grid").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(6).tickSize(-(h - m.t - m.b)).tickFormat(""));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("~s")));
    svg.append("text").attr("class", "axis-label").attr("x", w - m.r).attr("y", h - 4).attr("text-anchor", "end").text("Eco-indicator (mPt)");
    rows.forEach((r) => {
      const y0 = y(r.k), bh = y.bandwidth();
      svg.append("rect").attr("x", m.l).attr("y", y0).attr("width", Math.max(0, x(prod) - m.l - 1)).attr("height", bh).attr("rx", 3).attr("fill", css("--s1"));
      svg.append("rect").attr("x", x(prod) + 1).attr("y", y0).attr("width", Math.max(0, x(prod + r.use) - x(prod) - 1)).attr("height", bh).attr("rx", 3).attr("fill", css("--s2"));
      svg.append("text").attr("x", m.l - 8).attr("y", y0 + bh / 2 + 4).attr("text-anchor", "end").style("fill", css("--ink")).text(r.k);
      svg.append("text").attr("x", Math.min(x(prod + r.use) + 6, w - m.r - 40)).attr("y", y0 - 4).style("font-family", "var(--f-mono)").style("font-size", "10px").text(d3.format(",.0f")(prod + r.use) + " mPt");
    });
    const lg = svg.append("g").attr("transform", `translate(${m.l},10)`);
    [["Production", css("--s1")], ["Use-phase electricity", css("--s2")]].forEach(([t, c], i) => {
      lg.append("rect").attr("x", i * 130).attr("y", -8).attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", c);
      lg.append("text").attr("x", i * 130 + 15).attr("y", 1).style("font-size", "10.5px").text(t);
    });
  }, { label: "Production versus use-phase impact" });
  function upd() {
    const mass = +mEl.value, rec = +rEl.value / 100, kwh = +kEl.value;
    document.getElementById("en-mass-out").textContent = mass.toFixed(1) + " kg";
    document.getElementById("en-rec-out").textContent = Math.round(rec * 100) + "%";
    document.getElementById("en-kwh-out").textContent = kwh + " kWh";
    const prod = mass * (rec * P.sec + (1 - rec) * P.prim);
    const saving = mass * (P.prim - P.sec);
    document.getElementById("energy-readout").innerHTML = `Switching this part fully to secondary aluminium saves <b class="num">${d3.format(",.0f")(saving)} mPt</b>. That equals <b class="num">${d3.format(",.0f")(saving / P.GR)} kWh</b> of Greek electricity or <b class="num">${d3.format(",.0f")(saving / P.CH)} kWh</b> of Swiss electricity. On the Greek grid, use-phase electricity overtakes production above <b class="num">${d3.format(",.0f")(prod / P.GR)} kWh</b>.`;
    energyChart.redraw();
  }
  [mEl, rEl, kEl].forEach((e) => e.addEventListener("input", upd));
  window.addEventListener("themechange", upd);
  upd();

  /* ---------- 3.4 ---------- */
  const COLS = ["log prod", "log waste", "recycling gain", "log ρ", "log E"];
  const ROWS = [
    { name: "Aluminium, primary", fam: "Non-ferrous metals", m: [1, 1, 1, 1, 1] },
    { name: "PET, recycled granulate", fam: "Recycled plastics", m: [1, 1, 1, 0, 0] },
    { name: "Two-component glue", fam: "Chemicals & glues", m: [1, 1, 0, 0, 0] },
  ];
  mount("#mask-chart", (w) => (w < 520 ? 190 : 170), (svg, w, h) => {
    const narrow = w < 520;
    const m = { t: 40, l: narrow ? 120 : 170, r: 8 };
    const cw = (w - m.l - m.r) / COLS.length, ch = 30;
    const defs = svg.append("defs");
    const pat = defs.append("pattern").attr("id", "hatch").attr("patternUnits", "userSpaceOnUse").attr("width", 7).attr("height", 7).attr("patternTransform", "rotate(45)");
    pat.append("rect").attr("width", 7).attr("height", 7).attr("fill", css("--paper"));
    pat.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 7).attr("stroke", css("--muted")).attr("stroke-width", 1.5);
    COLS.forEach((c, j) => svg.append("text").attr("x", m.l + j * cw + cw / 2).attr("y", m.t - 10).attr("text-anchor", "middle").style("font-size", narrow ? "9px" : "10.5px").text(c));
    ROWS.forEach((r, i) => {
      const g = svg.append("g").attr("transform", `translate(0,${m.t + i * (ch + 10)})`)
        .on("mousemove", (e) => showTip(e, `<b>${r.name}</b><br>${r.fam}<br><span class="mono">mask = [${r.m.join(", ")}]</span><br>${r.m.includes(0) ? "The decoder fills " + COLS.filter((c, j) => !r.m[j]).join(" and ") + "." : "Complete row."}`)).on("mouseleave", hideTip);
      g.append("text").attr("x", m.l - 10).attr("y", ch / 2 + 4).attr("text-anchor", "end").style("fill", css("--ink")).style("font-size", narrow ? "10px" : "11.5px").text(r.name);
      r.m.forEach((k, j) => g.append("rect").attr("x", m.l + j * cw + 2).attr("y", 0).attr("width", cw - 4).attr("height", ch).attr("rx", 3)
        .attr("fill", k ? css("--accent") : "url(#hatch)").attr("fill-opacity", k ? 0.85 : 1).attr("stroke", k ? "none" : css("--rule")));
    });
  }, { label: "Masked input matrix" });

  /* ---------- 3.5 ---------- */
  const IMP = [
    { k: "Global mean", rho: 0.61, E: 1.39 },
    { k: "VAE, β = 0.5", rho: 0.5, E: 1.1 },
    { k: "VAE, β = 0.2", rho: 0.46, E: 1.03 },
    { k: "Same-family mean", rho: 0.27, E: 0.68 },
  ];
  let impKey = "rho";
  seg("#imp-seg", [{ v: "rho", label: "Density ρ" }, { v: "E", label: "Modulus E" }], impKey, (v) => { impKey = v; imp.redraw(); });
  const imp = mount("#impute-chart", () => 170, (svg, w, h) => {
    const m = { t: 6, r: 50, b: 34, l: 130 };
    const x = d3.scaleLinear().domain([0, 1.5]).range([m.l, w - m.r]);
    const y = d3.scaleBand().domain(IMP.map((d) => d.k)).range([m.t, h - m.b]).padding(0.3);
    svg.append("g").attr("class", "grid").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(5).tickSize(-(h - m.t - m.b)).tickFormat(""));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(5));
    svg.append("text").attr("class", "axis-label").attr("x", w - m.r).attr("y", h - 4).attr("text-anchor", "end").text("RMSE (decades, log₁₀)");
    const cols = [css("--muted"), css("--s1"), css("--s1"), css("--s3")];
    IMP.forEach((d, i) => {
      svg.append("rect").attr("x", m.l).attr("y", y(d.k)).attr("height", y.bandwidth()).attr("width", x(d[impKey]) - m.l).attr("rx", 3).attr("fill", cols[i]).attr("fill-opacity", i === 2 ? 0.6 : 0.9);
      svg.append("text").attr("x", m.l - 8).attr("y", y(d.k) + y.bandwidth() / 2 + 4).attr("text-anchor", "end").style("fill", css("--ink")).text(d.k);
      svg.append("text").attr("x", x(d[impKey]) + 6).attr("y", y(d.k) + y.bandwidth() / 2 + 4).style("font-family", "var(--f-mono)").style("font-size", "10px").text(d[impKey].toFixed(2));
    });
  }, { label: "Imputation error by method" });
})();
