/* Chapter 6: a simplified eco audit, computed in the browser from data/ecoaudit.js (same model as notebooks/ecoaudit.py). */
(function () {
  "use strict";
  const { css, showTip, hideTip, mount, seg } = window.MATENV;
  const D = window.ECOAUDIT;
  const PHASES = ["Material", "Manufacture", "Transport", "Use", "Disposal"];
  const PCOL = { Material: "--s1", Manufacture: "--s2", Transport: "--s3", Use: "--s4", Disposal: "--muted" };
  const pcol = (p) => css(PCOL[p]);
  const STRATEGIES = {
    Material: "Use less material (lighter design), choose materials with lower embodied energy, use recycled content.",
    Manufacture: "Choose less energy-intensive processes, reduce scrap and process steps.",
    Transport: "Shorten distances, switch to a more efficient mode (sea, rail, large truck instead of air or small van).",
    Use: "If it moves: cut mass. If it heats or cools: improve thermal efficiency. If it is electro-mechanical: cut losses.",
    Disposal: "Design for disassembly and recycling; this phase is rarely dominant.",
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const PRODUCTS = Object.fromEntries(D.products.map((p) => [p.id, p]));
  const f0 = d3.format(",.0f"), f1 = d3.format(",.1f"), pct = d3.format(".0%");
  const num = (v) => (Math.abs(v) >= 100 ? f0(v) : Math.abs(v) >= 1 ? f1(v) : d3.format(".2~f")(v));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- model (port of notebooks/ecoaudit.py) ---------- */
  function recycledFraction(c, m) {
    const r = c.recycled ?? "virgin";
    if (r === "virgin") return 0; if (r === "typical") return m.rf;
    return Math.max(0, Math.min(1, +r / 100 || 0));
  }
  function audit(p) {
    const E = Object.fromEntries(PHASES.map((k) => [k, 0])), C = Object.fromEntries(PHASES.map((k) => [k, 0]));
    const life = +p.life || 0;
    const mass = d3.sum(p.bom, (c) => +c.mass || 0);
    let eolE = 0, eolC = 0; const comps = [];
    p.bom.forEach((c) => {
      const m = D.materials[c.material], f = recycledFraction(c, m), mk = +c.mass || 0;
      const ee = (1 - f) * m.ee + f * m.ee_rec, co2 = (1 - f) * m.co2 + f * m.co2_rec;
      const pr = D.processes[c.process] || D.processes.None, d = D.eol[c.eol] || D.eol.None;
      const row = { name: c.name, mE: mk * ee, mC: mk * co2, pE: mk * pr.ee, pC: mk * pr.co2, dE: mk * d.ee, dC: mk * d.co2 };
      E.Material += row.mE; C.Material += row.mC; E.Manufacture += row.pE; C.Manufacture += row.pC; E.Disposal += row.dE; C.Disposal += row.dC;
      if (c.eol === "Recycle") { eolE -= mk * (m.ee - m.ee_rec); eolC -= mk * (m.co2 - m.co2_rec); }
      comps.push(row);
    });
    (p.transport || []).forEach((s) => { const t = D.transport[s.type]; const tkm = mass / 1000 * (+s.km || 0); E.Transport += tkm * t.ee; C.Transport += tkm * t.co2; });
    const use = { sE: 0, sC: 0, mE: 0, mC: 0 };
    if (p.static) {
      const s = D.static[p.static.mode];
      const prim = (+p.static.kW || 0) * (+p.static.hours_per_day || 0) * (+p.static.days_per_year || 0) * life * 3.6 / s.eff;
      use.sE = prim; use.sC = prim * s.co2;
    }
    if (p.mobile) {
      const v = D.mobile[p.mobile.mode];
      const mt = (p.mobile.mass_kg != null ? +p.mobile.mass_kg : mass) / 1000;
      const tkm = mt * (+p.mobile.km_per_day || 0) * (+p.mobile.days_per_year || 0) * life;
      use.mE = tkm * v.ee; use.mC = tkm * v.co2;
    }
    E.Use = use.sE + use.mE; C.Use = use.sC + use.mC;
    return { energy: E, co2: C, total_energy: d3.sum(PHASES, (k) => E[k]), total_co2: d3.sum(PHASES, (k) => C[k]), eol_energy: eolE, eol_co2: eolC, comps, use, mass };
  }
  window.ECOAUDIT_MODEL = { audit };
  const dominant = (r, key) => { const d = r[key]; const tot = d3.sum(PHASES, (k) => d[k]); const ph = PHASES.reduce((a, b) => (d[b] > d[a] ? b : a)); return [ph, tot ? d[ph] / tot : 0]; };

  function hatch(svg, id, color) {
    const p = svg.append("defs").append("pattern").attr("id", id).attr("patternUnits", "userSpaceOnUse").attr("width", 6).attr("height", 6).attr("patternTransform", "rotate(45)");
    p.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 6).attr("stroke", color).attr("stroke-width", 1.4);
  }

  /* ---------- 6.1 phase cards ---------- */
  const CARDS = [
    ["Material", "Mass × embodied energy and CO₂ of each material, virgin or recycled.", "m, material, recycled %"],
    ["Manufacture", "Mass × energy of the primary shaping process (molding, casting, rolling).", "m, process"],
    ["Transport", "Product mass × distance × energy per tonne-km of the mode.", "km, mode"],
    ["Use", "Static: power × time ÷ efficiency. Mobile: mass carried × distance.", "kW, h, days · km/day"],
    ["Disposal", "Mass × energy of collection and landfill or recycling.", "m, route"],
  ];
  document.getElementById("phase-cards").innerHTML = CARDS.map(([p, t, i]) => `<div class="ea-phase" style="--c:var(${PCOL[p]})"><b>${p}</b>${t}<span class="in">${i}</span></div>`).join("");

  /* ---------- 6.2 materials table ---------- */
  const fams = ["All", ...new Set(Object.values(D.materials).map((m) => m.family))];
  const famSel = document.getElementById("mat-fam"), sortSel = document.getElementById("mat-sort");
  famSel.innerHTML = fams.map((f) => `<option>${f}</option>`).join("");
  const maxEE = d3.max(Object.values(D.materials), (m) => m.ee);
  function matTable() {
    let rows = Object.entries(D.materials).filter(([, m]) => famSel.value === "All" || m.family === famSel.value);
    const k = sortSel.value;
    rows.sort((a, b) => (k === "name" ? a[0].localeCompare(b[0]) : b[1][k] - a[1][k]));
    const fc = css("--s1");
    document.getElementById("mat-table").innerHTML = rows.map(([n, m]) => {
      const w1 = (m.ee / maxEE) * 100, w2 = (m.ee_rec / maxEE) * 100;
      return `<tr><td>${esc(n)}</td><td>${m.family}</td><td class="n">${num(m.ee)}</td><td class="n">${num(m.co2)}</td><td class="n">${m.ee ? num(m.ee_rec) : "–"}</td><td class="n">${m.ee ? pct(m.rf) : "–"}</td>
        <td><svg width="100%" height="12" preserveAspectRatio="none" viewBox="0 0 100 12" aria-hidden="true"><rect x="0" y="1" height="10" width="${w1}" fill="${fc}" rx="1"/><rect x="0" y="3.5" height="5" width="${w2}" fill="${css("--paper")}" opacity=".7"/></svg></td></tr>`;
    }).join("");
  }
  famSel.onchange = sortSel.onchange = matTable; matTable();

  /* ---------- 6.3 calculator ---------- */
  const presetSel = document.getElementById("preset");
  presetSel.innerHTML = D.products.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("") + `<option value="__blank">Your own product (blank)</option>`;
  const BLANK = { id: "__blank", name: "Your product", life: 5, story: "Start from one component and add the rest.", bom: [{ name: "Frame", material: "Wrought aluminium alloy", process: "Metal deformation (forging, rolling)", mass: 2, eol: "Recycle", recycled: "virgin" }], transport: [{ name: "Factory to shop", type: "32 tonne truck", km: 800 }], static: null, mobile: null };
  let P = clone(PRODUCTS.bottle), METRIC = "energy";
  const opts = (obj, sel) => Object.keys(obj).map((k) => `<option ${k === sel ? "selected" : ""}>${esc(k)}</option>`).join("");
  const recVal = (r) => (r === "virgin" ? 0 : r === "typical" ? "typical" : +r);

  function renderBOM() {
    document.getElementById("bom").innerHTML = P.bom.map((c, i) => `<tr data-i="${i}">
      <td><input data-k="name" value="${esc(c.name)}" aria-label="Component name"></td>
      <td><select data-k="material" aria-label="Material">${opts(D.materials, c.material)}</select></td>
      <td><input data-k="recycled" type="number" min="0" max="100" step="5" value="${c.recycled === "typical" ? Math.round(D.materials[c.material].rf * 100) : recVal(c.recycled)}" aria-label="Recycled content %"></td>
      <td><select data-k="process" aria-label="Process">${opts(D.processes, c.process)}</select></td>
      <td><input data-k="mass" type="number" min="0" step="any" value="${c.mass}" aria-label="Mass kg"></td>
      <td><select data-k="eol" aria-label="End of life">${opts(D.eol, c.eol)}</select></td>
      <td class="x"><button class="ea-x" type="button" data-del="${i}" aria-label="Remove component">×</button></td></tr>`).join("");
  }
  function renderTransport() {
    document.getElementById("transport").innerHTML = (P.transport || []).map((s, i) => `<tr data-i="${i}">
      <td><input data-k="name" value="${esc(s.name)}" aria-label="Stage name"></td>
      <td><select data-k="type" aria-label="Transport mode">${opts(D.transport, s.type)}</select></td>
      <td><input data-k="km" type="number" min="0" step="any" value="${s.km}" aria-label="Distance km"></td>
      <td class="x"><button class="ea-x" type="button" data-del="${i}" aria-label="Remove stage">×</button></td></tr>`).join("")
      || `<tr><td colspan="4" style="color:var(--muted)">No transport stage.</td></tr>`;
  }
  function renderUse() {
    const s = P.static, m = P.mobile;
    document.getElementById("use").innerHTML = `
      <label>Static mode <select data-u="static.mode"><option value="">None</option>${opts(D.static, s && s.mode)}</select></label>
      <label>Power (kW) <input type="number" min="0" step="any" data-u="static.kW" value="${s ? s.kW : 0}" ${s ? "" : "disabled"}></label>
      <label>Hours per day <input type="number" min="0" step="any" data-u="static.hours_per_day" value="${s ? s.hours_per_day : 0}" ${s ? "" : "disabled"}></label>
      <label>Days per year <input type="number" min="0" step="any" data-u="static.days_per_year" value="${s ? s.days_per_year : 0}" ${s ? "" : "disabled"}></label>
      <label>Mobile mode <select data-u="mobile.mode"><option value="">None</option>${opts(D.mobile, m && m.mode)}</select></label>
      <label>Distance (km/day) <input type="number" min="0" step="any" data-u="mobile.km_per_day" value="${m ? m.km_per_day : 0}" ${m ? "" : "disabled"}></label>
      <label>Days per year <input type="number" min="0" step="any" data-u="mobile.days_per_year" value="${m ? m.days_per_year : 0}" ${m ? "" : "disabled"}></label>
      <label>Mass carried (kg) <input type="number" min="0" step="any" data-u="mobile.mass_kg" placeholder="product mass" value="${m && m.mass_kg != null ? m.mass_kg : ""}" ${m ? "" : "disabled"}></label>`;
  }
  function renderAll() {
    document.getElementById("life").value = P.life;
    document.getElementById("story").innerHTML = P.story ? esc(P.story) : "";
    renderBOM(); renderTransport(); renderUse(); calc.redraw(); readout();
  }
  function load(id) { P = clone(id === "__blank" ? BLANK : PRODUCTS[id]); renderAll(); }

  document.getElementById("bom").addEventListener("input", (e) => {
    const tr = e.target.closest("tr"), k = e.target.dataset.k; if (!tr || !k) return;
    const c = P.bom[+tr.dataset.i];
    if (k === "mass") c.mass = Math.max(0, +e.target.value || 0);
    else if (k === "recycled") c.recycled = String(Math.max(0, Math.min(100, +e.target.value || 0)));
    else c[k] = e.target.value;
    update();
  });
  document.getElementById("bom").addEventListener("click", (e) => { const b = e.target.closest("[data-del]"); if (!b) return; P.bom.splice(+b.dataset.del, 1); if (!P.bom.length) P.bom.push(clone(BLANK.bom[0])); renderBOM(); update(); });
  document.getElementById("transport").addEventListener("input", (e) => {
    const tr = e.target.closest("tr"), k = e.target.dataset.k; if (!tr || !k) return;
    const s = P.transport[+tr.dataset.i]; s[k] = k === "km" ? Math.max(0, +e.target.value || 0) : e.target.value; update();
  });
  document.getElementById("transport").addEventListener("click", (e) => { const b = e.target.closest("[data-del]"); if (!b) return; P.transport.splice(+b.dataset.del, 1); renderTransport(); update(); });
  document.getElementById("add-comp").onclick = () => { P.bom.push({ name: "New component", material: "Polypropylene (PP)", process: "Polymer molding", mass: 0.1, eol: "Landfill", recycled: "virgin" }); renderBOM(); update(); };
  document.getElementById("add-tr").onclick = () => { (P.transport = P.transport || []).push({ name: "New stage", type: "32 tonne truck", km: 100 }); renderTransport(); update(); };
  document.getElementById("use").addEventListener("input", onUse);
  document.getElementById("use").addEventListener("change", onUse);
  function onUse(e) {
    const u = e.target.dataset.u; if (!u) return;
    const [grp, k] = u.split(".");
    if (k === "mode") {
      if (!e.target.value) P[grp] = null;
      else if (!P[grp]) P[grp] = grp === "static" ? { mode: e.target.value, kW: 1, hours_per_day: 1, days_per_year: 365 } : { mode: e.target.value, km_per_day: 30, days_per_year: 365 };
      else P[grp].mode = e.target.value;
      if (e.type === "change") renderUse();
    } else if (P[grp]) {
      if (k === "mass_kg" && e.target.value === "") delete P[grp].mass_kg; else P[grp][k] = Math.max(0, +e.target.value || 0);
    }
    update();
  }
  document.getElementById("life").addEventListener("input", (e) => { P.life = Math.max(0, +e.target.value || 0); update(); });
  presetSel.onchange = () => load(presetSel.value);
  document.getElementById("reset").onclick = () => load(presetSel.value);
  seg("#metric", [{ v: "energy", label: "Energy" }, { v: "co2", label: "CO₂" }], METRIC, (v) => { METRIC = v; update(); });

  function update() { calc.redraw(); readout(); }

  function phaseBars(svg, w, h, r, key, opts = {}) {
    const unit = key === "energy" ? "MJ" : "kg CO₂";
    const eol = key === "energy" ? r.eol_energy : r.eol_co2;
    const cats = [...PHASES, "EoL potential"];
    const vals = [...PHASES.map((p) => r[key][p]), eol];
    const m = { t: 14, r: 10, b: 40, l: 58 };
    const lo = Math.min(0, d3.min(vals), opts.ghost ? d3.min(opts.ghost) : 0), hi = Math.max(d3.max(vals), opts.ghost ? d3.max(opts.ghost) : 0, 1e-9);
    const x = d3.scaleBand().domain(cats).range([m.l, w - m.r]).padding(0.22);
    const y = d3.scaleLinear().domain([lo, hi * 1.08]).range([h - m.b, m.t]).nice();
    hatch(svg, "h-" + key + (opts.id || ""), css("--muted"));
    svg.append("g").attr("class", "grid").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(w - m.l - m.r)).tickFormat(""));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("~s")));
    svg.append("line").attr("x1", m.l).attr("x2", w - m.r).attr("y1", y(0)).attr("y2", y(0)).attr("stroke", css("--ink-2"));
    svg.append("text").attr("class", "axis-label").attr("transform", `translate(12,${m.t}) rotate(-90)`).attr("text-anchor", "end").text(unit);
    const tot = d3.sum(PHASES, (p) => r[key][p]);
    cats.forEach((c, i) => {
      const v = vals[i], isE = i === 5;
      if (opts.ghost) svg.append("rect").attr("x", x(c) - 3).attr("width", x.bandwidth() + 6).attr("y", y(Math.max(0, opts.ghost[i]))).attr("height", Math.abs(y(opts.ghost[i]) - y(0))).attr("fill", "none").attr("stroke", css("--ink-2")).attr("stroke-dasharray", "3 2");
      const rect = svg.append("rect").attr("x", x(c)).attr("width", x.bandwidth()).attr("y", y(Math.max(0, v))).attr("height", Math.max(v ? 1 : 0, Math.abs(y(v) - y(0)))).attr("rx", 2)
        .attr("fill", isE ? `url(#h-${key}${opts.id || ""})` : pcol(c)).attr("stroke", isE ? css("--muted") : "none");
      rect.on("mousemove", (ev) => showTip(ev, `<b>${c}</b><br><span class="mono">${num(v)} ${unit}</span>${isE ? "<br>Not part of the first life" : `<br>${pct(tot ? v / tot : 0)} of the total`}`)).on("mouseleave", hideTip);
      if (!isE && tot && v / tot >= 0.01) svg.append("text").attr("class", "lbl").attr("x", x(c) + x.bandwidth() / 2).attr("y", y(v) - 4).attr("text-anchor", "middle").style("font-size", "10px").style("font-family", "var(--f-mono)").style("fill", css("--ink-2")).text(pct(v / tot));
      const lab = c === "EoL potential" ? "EoL pot." : c === "Manufacture" ? "Manuf." : c;
      svg.append("text").attr("x", x(c) + x.bandwidth() / 2).attr("y", h - m.b + 16).attr("text-anchor", "middle").style("font-size", w < 420 ? "9.5px" : "11px").style("fill", css("--ink-2")).text(lab);
    });
  }
  const calc = mount("#calc-chart", (w) => Math.max(230, Math.min(320, w * 0.6)), (svg, w, h) => phaseBars(svg, w, h, audit(P), METRIC), { label: "Energy or CO2 per life phase" });
  document.getElementById("calc-legend").innerHTML = PHASES.map((p) => `<span><i style="background:var(${PCOL[p]});border-radius:2px"></i>${p}</span>`).join("") + `<span><i style="background:repeating-linear-gradient(45deg,var(--muted) 0 1.5px,transparent 1.5px 4px);border:1px solid var(--muted);border-radius:2px"></i>EoL potential</span>`;

  function readout() {
    const r = audit(P);
    const [ph, sh] = dominant(r, METRIC);
    const unit = METRIC === "energy" ? "MJ" : "kg CO₂";
    const tot = METRIC === "energy" ? r.total_energy : r.total_co2, eol = METRIC === "energy" ? r.eol_energy : r.eol_co2;
    const key = METRIC === "energy" ? "E" : "C";
    const top = r.comps.map((c) => ({ n: c.name, v: c["m" + key] })).sort((a, b) => b.v - a.v).slice(0, 3).filter((c) => c.v > 0);
    const totTxt = unit === "MJ" && tot >= 1e4 ? `${f0(tot / 1000)} GJ` : `${num(tot)} ${unit}`;
    let html = `<div>First-life total</div><div class="big">${totTxt}</div>
      <div style="margin-top:4px">Mass ${num(r.mass)} kg · life ${P.life} yr${eol ? ` · EoL potential <span class="ea-good num">${num(eol)} ${unit}</span>` : ""}</div>
      <div class="ea-strat"><b>${ph}</b> dominates with <b>${pct(sh)}</b>. ${STRATEGIES[ph]}</div>`;
    if (ph === "Use" && r.use.sE && r.use.mE) {
      const s = key === "E" ? r.use.sE : r.use.sC, mo = key === "E" ? r.use.mE : r.use.mC;
      html += `<div style="margin-top:8px">Use: static ${pct(s / (s + mo))}, mobile ${pct(mo / (s + mo))}.</div>`;
    }
    if (top.length) html += `<div style="margin-top:8px">Largest material contributions</div><ol>${top.map((c, i) => `<li class="${i ? "" : "top"}">${esc(c.n)}: <span class="num">${num(c.v)} ${unit}</span></li>`).join("")}</ol>`;
    document.getElementById("calc-readout").innerHTML = html;
  }
  renderAll();

  /* ---------- 6.4 recycled PET ---------- */
  const recEl = document.getElementById("rec"), recEol = document.getElementById("rec-eol");
  const bottleAt = (pctRec, eol) => { const b = clone(PRODUCTS.bottle); b.bom[0].recycled = String(pctRec); b.bom[0].eol = eol; return audit(b); };
  const recChart = mount("#rec-chart", (w) => Math.max(220, Math.min(290, w * 0.55)), (svg, w, h) => {
    const r0 = bottleAt(0, recEol.value), r = bottleAt(+recEl.value, recEol.value);
    phaseBars(svg, w, h, r, "energy", { id: "rec", ghost: [...PHASES.map((p) => r0.energy[p]), r0.eol_energy] });
  }, { label: "Bottle energy with recycled PET" });
  function recUpd() {
    document.getElementById("rec-out").textContent = recEl.value + "%";
    const r0 = bottleAt(0, recEol.value), r = bottleAt(+recEl.value, recEol.value);
    const d = r.total_energy / r0.total_energy - 1;
    document.getElementById("rec-readout").innerHTML = `<div>First-life energy, 100 bottles</div><div class="big">${f0(r0.total_energy)} → ${f0(r.total_energy)} MJ</div>
      <div style="margin-top:4px">Change <b class="num ea-good">${d3.format("+.1%")(d)}</b>${+recEl.value === 35 ? " (EduPack Exercise 21: −11%)" : ""}</div>
      <div style="margin-top:8px">EoL potential: <span class="num">${f0(r.eol_energy)} MJ</span>. ${recEol.value === "Recycle" ? "It does not depend on recycled content: recycling at end of life credits the next life, recycled content the present one. Counting both would count the same recycling twice." : "Landfilled bottles return nothing to the next life."}</div>`;
    recChart.redraw();
  }
  recEl.oninput = recEol.onchange = recUpd; recUpd();

  /* ---------- 6.5 reuse ---------- */
  const washEl = document.getElementById("wash");
  const reuseChart = mount("#reuse-chart", (w) => Math.max(220, Math.min(300, w * 0.55)), (svg, w, h) => {
    const k = +washEl.value;
    const pet = audit(PRODUCTS.bottle).total_energy / 100;
    const st = clone(PRODUCTS.reusable); const fixed = (() => { const s = clone(st); s.static = null; return audit(s).total_energy; })();
    const perUse = (st.static.kW * k) * st.static.hours_per_day * 3.6 / D.static[st.static.mode].eff;
    const N = 60, m = { t: 12, r: 14, b: 36, l: 50 };
    const x = d3.scaleLinear().domain([0, N]).range([m.l, w - m.r]);
    const y = d3.scaleLinear().domain([0, Math.max(pet * N, fixed + perUse * N) * 1.05]).range([h - m.b, m.t]).nice();
    window.MATENV.axes(svg, x, y, w, h, m, "Number of fills (1 L)", "Cumulative energy (MJ)");
    const line = d3.line().x((d) => x(d[0])).y((d) => y(d[1]));
    const ns = d3.range(0, N + 1);
    svg.append("path").attr("d", line(ns.map((n) => [n, n * pet]))).attr("fill", "none").attr("stroke", css("--s2")).attr("stroke-width", 2.2);
    svg.append("path").attr("d", line(ns.map((n) => [n, fixed + n * perUse]))).attr("fill", "none").attr("stroke", css("--s1")).attr("stroke-width", 2.2);
    const be = fixed / (pet - perUse);
    if (be > 0 && be < N) {
      svg.append("circle").attr("cx", x(be)).attr("cy", y(be * pet)).attr("r", 4.5).attr("fill", css("--hi"));
      svg.append("text").attr("class", "lbl").attr("x", x(be) + 8).attr("y", y(be * pet) + 14).style("font-size", "11px").style("fill", css("--ink")).text(`break-even ≈ ${Math.ceil(be)} fills`);
    }
    reuseRead(pet, fixed, perUse, be);
  }, { label: "Cumulative energy of PET bottles versus a reusable bottle" });
  function reuseRead(pet, fixed, perUse, be) {
    const n = 100, a = n * pet, b = fixed + n * perUse;
    document.getElementById("reuse-readout").innerHTML = `<div>After 100 fills</div><div class="big">${f0(a)} vs ${f0(b)} MJ</div>
      <div style="margin-top:4px">The reusable bottle uses <b>${d3.format(".1f")(a / b)}×</b> less energy. Making it costs ${f0(fixed)} MJ, as much as ${Math.round(fixed / pet)} PET bottles of water; each wash costs ${d3.format(".2f")(perUse)} MJ against ${d3.format(".1f")(pet)} MJ per bottled litre.</div>
      <div style="margin-top:8px">Break-even after <b>${Math.ceil(be)}</b> fills.</div>`;
  }
  washEl.onchange = () => reuseChart.redraw();
  document.getElementById("reuse-legend").innerHTML = `<span><i style="background:var(--s2)"></i>Single-use PET bottles</span><span><i style="background:var(--s1)"></i>Reusable stainless-steel bottle</span>`;

  /* ---------- 6.6 bumper ---------- */
  let BREC = "virgin";
  const vehSel = document.getElementById("bump-veh");
  vehSel.innerHTML = opts(D.mobile, "Family car, gasoline");
  const bump = mount("#bump-chart", (w) => Math.max(230, Math.min(320, w * 0.58)), (svg, w, h) => {
    const st = D.materials["Low alloy steel"], al = D.materials["Cast aluminium alloy"], e = D.mobile[vehSel.value].ee;
    const ms = 14, ma = 10, Hal = BREC === "virgin" ? al.ee : al.ee_rec;
    const Es = (x) => ms * st.ee + ms / 1000 * x * e, Ea = (x) => ma * Hal + ma / 1000 * x * e;
    const X = 300000, m = { t: 12, r: 14, b: 36, l: 54 };
    const x = d3.scaleLinear().domain([0, X]).range([m.l, w - m.r]);
    const y = d3.scaleLinear().domain([0, Math.max(Es(X), Ea(X)) * 1.04]).range([h - m.b, m.t]).nice();
    svg.append("rect").attr("x", x(150000)).attr("width", x(250000) - x(150000)).attr("y", m.t).attr("height", h - m.b - m.t).attr("fill", css("--hi-wash"));
    window.MATENV.axes(svg, x, y, w, h, m, "Distance driven (km)", "Life energy (MJ)", { xfmt: d3.format("~s"), yfmt: d3.format("~s") });
    [[Es, "--s7", "Steel, 14 kg"], [Ea, "--s2", "Aluminium, 10 kg"]].forEach(([f, c]) => svg.append("line").attr("x1", x(0)).attr("x2", x(X)).attr("y1", y(f(0))).attr("y2", y(f(X))).attr("stroke", css(c)).attr("stroke-width", 2.2));
    const be = (ma * Hal - ms * st.ee) / ((ms - ma) / 1000 * e);
    if (be > 0 && be < X) {
      svg.append("circle").attr("cx", x(be)).attr("cy", y(Es(be))).attr("r", 4.5).attr("fill", css("--hi"));
      svg.append("text").attr("class", "lbl").attr("x", x(be) + (be > X * 0.7 ? -8 : 8)).attr("y", y(Es(be)) - 8).attr("text-anchor", be > X * 0.7 ? "end" : "start").style("font-size", "11px").style("fill", css("--ink")).text(`${d3.format(",.0f")(Math.round(be / 1000) * 1000)} km`);
    }
    const lifeKm = 250000, d = Es(lifeKm) - Ea(lifeKm);
    document.getElementById("bump-readout").innerHTML = `<div>Break-even distance</div><div class="big">${be > 0 ? d3.format(",")(Math.round(be / 1000) * 1000) + " km" : "immediate"}</div>
      <div style="margin-top:4px">Aluminium bumper (${BREC === "virgin" ? "virgin" : "recycled"}): ${f0(ma * Hal)} MJ to make vs ${f0(ms * st.ee)} MJ for steel.</div>
      <div style="margin-top:8px">Over 250 000 km aluminium ${d > 0 ? `saves <b class="ea-good">${f0(d)} MJ</b>` : `costs <b class="ea-bad">${f0(-d)} MJ</b> more`}. White paper: ~200 000 km virgin, under 100 000 km recycled.</div>`;
  }, { label: "Bumper break-even distance" });
  seg("#bump-rec", [{ v: "virgin", label: "Virgin Al" }, { v: "recycled", label: "Recycled Al" }], BREC, (v) => { BREC = v; bump.redraw(); });
  vehSel.onchange = () => bump.redraw();
  document.getElementById("bump-legend").innerHTML = `<span><i style="background:var(--s7)"></i>Steel bumper, 14 kg</span><span><i style="background:var(--s2)"></i>Aluminium bumper, 10 kg</span><span><i style="background:var(--hi-wash);border:1px solid var(--hi);border-radius:2px"></i>Typical car life</span>`;

  /* ---------- 6.7 checks ---------- */
  const rows = [];
  D.products.filter((p) => p.reference).forEach((p) => {
    const r = audit(p);
    Object.entries(p.reference.energy).forEach(([k, v]) => {
      const mine = k === "Use (static)" ? r.use.sE : k === "Use (mobile)" ? r.use.mE : r.energy[k];
      rows.push([p.name, k + " energy (MJ)", v, mine]);
    });
    if (p.reference.co2) Object.entries(p.reference.co2).forEach(([k, v]) => rows.push([p.name, k + " CO₂ (kg)", v, r.co2[k]]));
  });
  const b35 = bottleAt(35, "Recycle"), b0 = bottleAt(0, "Recycle");
  rows.push(["PET bottle, 35% recycled (Ex. 21)", "First-life energy change (%)", -11, 100 * (b35.total_energy / b0.total_energy - 1)]);
  rows.push(["PET bottle", "EoL potential (MJ)", -194, b0.eol_energy]);
  document.getElementById("check-table").innerHTML = rows.map(([p, k, a, b]) => {
    const dd = a ? b / a - 1 : 0, bad = Math.abs(dd) > 0.15;
    return `<tr><td>${esc(p)}</td><td>${k}</td><td class="n">${num(a)}</td><td class="n">${num(b)}</td><td class="n ${bad ? "ea-bad" : ""}">${k.includes("(%)") ? d3.format("+.1f")(b - a) + " pts" : d3.format("+.0%")(dd)}</td></tr>`;
  }).join("");

  /* ---------- strategy table ---------- */
  const EX = { Material: "PET bottle (69%), reusable bottle making", Manufacture: "Never dominant here", Transport: "Air-freighted kettle (3%)", Use: "Kettle (94%), car (86%), heater (95%)", Disposal: "Never dominant here" };
  document.getElementById("strat-table").innerHTML = PHASES.map((p) => `<tr><td><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(${PCOL[p]});margin-right:6px"></span>${p}</td><td>${STRATEGIES[p]}</td><td>${EX[p]}</td></tr>`).join("");

  window.addEventListener("themechange", () => matTable());
})();
