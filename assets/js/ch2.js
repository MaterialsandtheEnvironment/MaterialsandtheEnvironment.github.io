/* Chapter 2 figures: architecture, training loss, live latent-space optimiser. */
(function () {
  "use strict";
  const { css, familyColor, FAMILY_ORDER, showTip, hideTip, mount, fmt, axes, seg } = window.MATENV;
  const V = window.VAE, MATS = V.materials;
  const W1 = V.dec.W1, b1 = V.dec.b1, W2 = V.dec.W2, b2 = V.dec.b2, H = b1.length;
  const lo = V.lo, hi = V.hi;
  const Z = MATS.map((m) => m.z);
  const zmin = [d3.min(Z, (z) => z[0]), d3.min(Z, (z) => z[1])], zmax = [d3.max(Z, (z) => z[0]), d3.max(Z, (z) => z[1])];

  // decoder: z -> [log10 E(GPa), log10 rho]
  const h = new Float64Array(H);
  function decode(z0, z1) {
    for (let j = 0; j < H; j++) { const v = z0 * W1[0][j] + z1 * W1[1][j] + b1[j]; h[j] = v > 0 ? v : 0; }
    const out = [0, 0];
    for (let k = 0; k < 2; k++) { let s = b2[k]; for (let j = 0; j < H; j++) s += h[j] * W2[j][k]; out[k] = (1 / (1 + Math.exp(-s))) * (hi[k] - lo[k]) + lo[k]; }
    return out;
  }
  const CASES = { bar: { a: 1, label: "Bar  E/ρ", tex: "E/ρ" }, beam: { a: 0.5, label: "Beam  E½/ρ", tex: "E^½/ρ" }, panel: { a: 1 / 3, label: "Panel  E⅓/ρ", tex: "E^⅓/ρ" } };
  const st = { caseId: "bar", field: "index", mu: 3, runs: [], best: null, anim: null };
  const LAM = 1e-3;
  const logM = (o, a) => a * (o[0] + 9) - o[1]; // E in Pa
  const nearest = (z) => { let bi = 0, bd = Infinity; Z.forEach((q, i) => { const d = (q[0] - z[0]) ** 2 + (q[1] - z[1]) ** 2; if (d < bd) { bd = d; bi = i; } }); return { i: bi, d2: bd }; };
  function f(z) { const a = CASES[st.caseId].a; return -logM(decode(z[0], z[1]), a) + LAM * (z[0] * z[0] + z[1] * z[1]) + st.mu * nearest(z).d2; }
  function optimise(z0) {
    let z = z0.slice(), m = [0, 0], v = [0, 0]; const path = [z.slice()]; const e = 1e-4;
    let prev = Infinity;
    for (let t = 1; t <= 600; t++) {
      const g = [0, 1].map((k) => { const zp = z.slice(), zm = z.slice(); zp[k] += e; zm[k] -= e; return (f(zp) - f(zm)) / (2 * e); });
      for (let k = 0; k < 2; k++) {
        m[k] = 0.9 * m[k] + 0.1 * g[k]; v[k] = 0.999 * v[k] + 0.001 * g[k] * g[k];
        z[k] -= (0.05 * (m[k] / (1 - 0.9 ** t))) / (Math.sqrt(v[k] / (1 - 0.999 ** t)) + 1e-8);
        z[k] = Math.min(zmax[k], Math.max(zmin[k], z[k]));
      }
      if (t % 4 === 0) path.push(z.slice());
      const fv = f(z); if (Math.abs(prev - fv) < 1e-7 && t > 60) break; prev = fv;
    }
    path.push(z.slice());
    return { path, z, f: f(z) };
  }
  const exactWinner = () => { const a = CASES[st.caseId].a; return d3.greatest(MATS, (m) => logM([Math.log10(m.E), Math.log10(m.rho)], a)); };

  /* ---------- tables ---------- */
  document.getElementById("err-E").textContent = (V.recon.E_mean * 100).toFixed(1) + "% (max " + (V.recon.E_max * 100).toFixed(1) + "%)";
  document.getElementById("err-rho").textContent = (V.recon.rho_mean * 100).toFixed(1) + "% (max " + (V.recon.rho_max * 100).toFixed(1) + "%)";
  document.getElementById("data-table").innerHTML = MATS.map((m) => `<tr><td>${m.family}</td><td>${m.name}</td><td class="n">${d3.format(",")(m.rho)}</td><td class="n">${m.E}</td><td class="n">${fmt.sig(m.Erec)}</td><td class="n">${d3.format(",.0f")(m.rhorec)}</td></tr>`).join("");
  const EXT = [
    ["Beam, strength-limited", "σy^⅔/ρ", "CFRP epoxy (composites)", 1], ["Column / strut, buckling", "√E/ρ", "Softwood pine (natural)", 1],
    ["Flywheel", "σy/ρ", "CFRP epoxy (composites)", 1], ["Minimum cost (stiffness)", "E/(ρCₘ)", "Softwood pine (natural)", 1],
    ["Minimum cost (strength)", "√E/(ρCₘ)", "Softwood pine (natural)", 1], ["Panel, stiffness-limited", "E^⅓/ρ", "Softwood pine (natural)", 1],
    ["Panel, strength-limited", "σy^½/ρ", "CFRP epoxy (composites)", 1], ["Pressure vessel, yield", "σy/ρ", "CFRP epoxy (composites)", 1],
    ["Shaft, torsional stiffness", "√G/ρ", "Softwood pine (natural)", 1], ["Shaft, torsional strength", "τy^⅔/ρ", "CFRP epoxy (composites)", 1],
    ["Spring, minimum volume", "σy²/E", "Natural rubber (elastomers)", 1], ["Spring, minimum mass", "σy²/(ρE)", "Natural rubber (elastomers)", 1],
    ["Thermal distortion", "k/α", "Silicon carbide (ceramics)", 1], ["Thermal shock", "σy/(Eα)", "Natural rubber (elastomers)", 0],
    ["Thermal shock, with conductivity", "σy·k/(Eα)", "Al/SiC composite (composites)", 0], ["Tie, strength-limited", "σy/ρ", "CFRP epoxy (composites)", 1],
  ];
  document.getElementById("ext-table").innerHTML = EXT.map((r) => `<tr><td>${r[0]}</td><td class="mono">${r[1]}</td><td>${r[2]}</td><td>${r[3] ? '<span class="pill ok">✓ Yes</span>' : '<span class="pill no">✕ No</span>'}</td></tr>`).join("");

  /* ---------- Figure 2.1 ---------- */
  mount("#arch", (w) => Math.min(250, w * 0.5), (svg, w, hgt) => {
    const cols = [{ n: 2, lab: "x̃  (log E, log ρ)" }, { n: 9, lab: "250 ReLU" }, { n: 2, lab: "μ, log σ²", z: 1 }, { n: 9, lab: "250 ReLU" }, { n: 2, lab: "x̂  decoded" }];
    const xs = cols.map((_, i) => 30 + (i * (w - 60)) / (cols.length - 1));
    const ys = (n, i) => hgt / 2 - 10 + (i - (n - 1) / 2) * Math.min(18, (hgt - 70) / n);
    for (let c = 0; c < cols.length - 1; c++)
      for (let i = 0; i < cols[c].n; i++) for (let j = 0; j < cols[c + 1].n; j++)
        svg.append("line").attr("x1", xs[c]).attr("y1", ys(cols[c].n, i)).attr("x2", xs[c + 1]).attr("y2", ys(cols[c + 1].n, j)).attr("stroke", css("--rule")).attr("stroke-width", 0.8);
    cols.forEach((c, k) => {
      for (let i = 0; i < c.n; i++) svg.append("circle").attr("cx", xs[k]).attr("cy", ys(c.n, i)).attr("r", c.n > 2 ? 4.5 : 7).attr("fill", c.z ? css("--hi") : k === 0 || k === 4 ? css("--accent") : css("--paper")).attr("stroke", c.z ? css("--hi") : css("--accent")).attr("stroke-width", 1.5);
      svg.append("text").attr("x", xs[k]).attr("y", hgt - 14).attr("text-anchor", k === 0 ? "start" : k === 4 ? "end" : "middle").style("font-size", "10.5px").text(c.lab);
    });
    svg.append("text").attr("x", (xs[0] + xs[2]) / 2).attr("y", 14).attr("text-anchor", "middle").attr("class", "axis-label").text("Encoder q(z | x)");
    svg.append("text").attr("x", (xs[2] + xs[4]) / 2).attr("y", 14).attr("text-anchor", "middle").attr("class", "axis-label").text("Decoder D(z)");
    svg.append("text").attr("x", xs[2]).attr("y", ys(2, 1) + 22).attr("text-anchor", "middle").style("font-size", "10px").style("fill", css("--hi")).text("z ∈ ℝ²");
  }, { label: "VAE architecture" });
  mount("#loss-chart", (w) => Math.min(250, w * 0.6), (svg, w, hgt) => {
    const m = { t: 14, r: 12, b: 34, l: 50 };
    const L = V.loss;
    const x = d3.scaleLinear().domain([0, 10000]).range([m.l, w - m.r]);
    const y = d3.scaleLog().domain([d3.min(L, (d) => Math.min(d[2], Math.max(d[3] * 4.5e-5, 1e-6))) * 0.8, d3.max(L, (d) => d[1]) * 1.2]).range([hgt - m.b, m.t]);
    axes(svg, x, y, w, hgt, m, "Adam iteration", "Loss", { ylog: true, xticks: 5, yticks: 4, xfmt: d3.format("~s") });
    const series = [{ k: 1, n: "Total", c: css("--ink") }, { k: 2, n: "Reconstruction", c: css("--s1"), dash: "4 3" }, { k: 3, n: "β·KL", c: css("--s2"), scale: 4.5e-5 }];
    const used = [];
    series.forEach((s) => {
      svg.append("path").attr("fill", "none").attr("stroke", s.c).attr("stroke-width", 2).attr("stroke-dasharray", s.dash || null)
        .attr("d", d3.line().x((d) => x(d[0])).y((d) => y(Math.max(1e-6, d[s.k] * (s.scale || 1))))(L));
      const last = L[L.length - 1];
      let ty = y(Math.max(1e-6, last[s.k] * (s.scale || 1))) - 5;
      used.forEach((u) => { if (Math.abs(u - ty) < 12) ty = u + (ty >= u ? 12 : -12); }); used.push(ty);
      svg.append("text").attr("x", w - m.r).attr("y", ty).attr("text-anchor", "end").style("font-size", "10px").text(s.n);
    });
  }, { label: "Training loss curves" });

  /* ---------- Figure 2.2 ---------- */
  seg("#lat-case", Object.entries(CASES).map(([k, c]) => ({ v: k, label: c.label })), st.caseId, (v) => { st.caseId = v; st.runs = []; st.best = null; redrawAll(); });
  const fieldSel = document.getElementById("lat-field");
  fieldSel.addEventListener("change", () => { st.field = fieldSel.value; latent.redraw(); });
  const muEl = document.getElementById("lat-mu"), muOut = document.getElementById("lat-mu-out");
  muEl.addEventListener("input", () => { st.mu = +muEl.value; muOut.textContent = st.mu.toFixed(1); });
  muEl.addEventListener("change", () => { st.runs = []; st.best = null; redrawAll(); });
  document.getElementById("lat-clear").addEventListener("click", () => { cancel(); st.runs = []; st.best = null; redrawAll(); });
  document.getElementById("lat-multi").addEventListener("click", () => {
    cancel(); st.runs = [];
    for (let i = 0; i < 7; i++) for (let j = 0; j < 5; j++) st.runs.push(optimise([zmin[0] + (i * (zmax[0] - zmin[0])) / 6, zmin[1] + (j * (zmax[1] - zmin[1])) / 4]));
    st.best = d3.least(st.runs, (r) => r.f); animate();
  });
  function legend() { document.getElementById("latent-legend").innerHTML = FAMILY_ORDER.map((f) => `<span><i style="background:${familyColor(f)}"></i>${f}</span>`).join("") + `<span><i style="background:var(--hi);border-radius:1px"></i>gradient walk</span>`; }
  legend(); window.addEventListener("themechange", legend);

  let prog = 1;
  function cancel() { if (st.anim) cancelAnimationFrame(st.anim); st.anim = null; prog = 1; }
  function animate() {
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { prog = 1; redrawAll(); return; }
    const t0 = performance.now();
    const step = (t) => { prog = Math.min(1, (t - t0) / 1400); redrawAll(); if (prog < 1) st.anim = requestAnimationFrame(step); else st.anim = null; };
    st.anim = requestAnimationFrame(step);
  }
  const partial = (p) => p.slice(0, Math.max(1, Math.ceil(p.length * prog)));

  let lx, ly; // latent scales for click
  const pad = 0.15;
  const latent = mount("#latent-chart", (w) => Math.min(480, w * 0.86), (svg, w, hgt) => {
    const m = { t: 10, r: 10, b: 34, l: 40 };
    lx = d3.scaleLinear().domain([zmin[0] - pad, zmax[0] + pad]).range([m.l, w - m.r]);
    ly = d3.scaleLinear().domain([zmin[1] - pad, zmax[1] + pad]).range([hgt - m.b, m.t]);
    // background field
    if (st.field !== "none") {
      const N = 46, cw = (w - m.l - m.r) / N, ch = (hgt - m.t - m.b) / N; const vals = [];
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const z0 = lx.invert(m.l + (i + 0.5) * cw), z1 = ly.invert(m.t + (j + 0.5) * ch); const o = decode(z0, z1);
        vals.push({ i, j, v: st.field === "E" ? o[0] : st.field === "rho" ? o[1] : logM(o, CASES[st.caseId].a) });
      }
      const ext = d3.extent(vals, (d) => d.v);
      const dark = window.MATENV.isDark();
      const col = d3.scaleSequential(dark ? (t) => d3.interpolateRgb("#16221f", "#3c8a77")(t) : (t) => d3.interpolateRgb("#f4f7f4", "#7fb9aa")(t)).domain(ext);
      svg.append("g").selectAll("rect").data(vals).join("rect").attr("x", (d) => m.l + d.i * cw).attr("y", (d) => m.t + d.j * ch).attr("width", cw + 0.6).attr("height", ch + 0.6).attr("fill", (d) => col(d.v));
      // observed box
      svg.append("rect").attr("x", lx(zmin[0])).attr("y", ly(zmax[1])).attr("width", lx(zmax[0]) - lx(zmin[0])).attr("height", ly(zmin[1]) - ly(zmax[1])).attr("fill", "none").attr("stroke", css("--muted")).attr("stroke-dasharray", "3 3");
      svg.append("text").attr("x", w - m.r - 4).attr("y", hgt - m.b - 6).attr("text-anchor", "end").style("font-size", "10px").text(`${{ index: "log " + CASES[st.caseId].tex, E: "log₁₀ E", rho: "log₁₀ ρ" }[st.field]}: ${ext[0].toFixed(1)} → ${ext[1].toFixed(1)}`);
    }
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${hgt - m.b})`).call(d3.axisBottom(lx).ticks(5));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(ly).ticks(5));
    svg.append("text").attr("class", "axis-label").attr("x", w - m.r).attr("y", hgt - 4).attr("text-anchor", "end").text("z₁");
    svg.append("text").attr("class", "axis-label").attr("x", 6).attr("y", m.t + 8).text("z₂");
    // click target
    svg.append("rect").attr("x", m.l).attr("y", m.t).attr("width", w - m.l - m.r).attr("height", hgt - m.t - m.b).attr("fill", "transparent").style("cursor", "crosshair")
      .on("click", (e) => { const [px, py] = d3.pointer(e); cancel(); const r = optimise([lx.invert(px), ly.invert(py)]); st.runs = [r]; st.best = r; animate(); });
    // walks
    const gw = svg.append("g").style("pointer-events", "none");
    st.runs.forEach((r) => {
      const p = partial(r.path);
      gw.append("path").attr("d", d3.line().x((d) => lx(d[0])).y((d) => ly(d[1]))(p)).attr("fill", "none").attr("stroke", css("--hi")).attr("stroke-width", r === st.best ? 2.2 : 1.1).attr("stroke-opacity", r === st.best ? 1 : 0.55);
      gw.append("circle").attr("cx", lx(r.path[0][0])).attr("cy", ly(r.path[0][1])).attr("r", 2.5).attr("fill", css("--hi"));
    });
    // materials
    const g = svg.append("g").selectAll("g").data(MATS).join("g").attr("transform", (d) => `translate(${lx(d.z[0])},${ly(d.z[1])})`)
      .on("mousemove", (e, d) => showTip(e, `<b>${d.name}</b><br><span class="mono">${d.family}<br>z = (${d.z[0].toFixed(2)}, ${d.z[1].toFixed(2)})<br>E ${d.E} GPa · ρ ${d.rho} kg/m³</span>`)).on("mouseleave", hideTip);
    g.append("circle").attr("r", 5).attr("fill", (d) => familyColor(d.family)).attr("stroke", css("--paper")).attr("stroke-width", 1.5);
    if (w > 420) g.append("text").attr("class", "lbl").attr("x", 7).attr("y", 3.5).style("font-size", "9.5px").text((d) => d.name);
    if (st.best && prog >= 1) {
      const z = st.best.z;
      svg.append("path").attr("transform", `translate(${lx(z[0])},${ly(z[1])})`).attr("d", d3.symbol().type(d3.symbolStar).size(240)()).attr("fill", css("--hi")).attr("stroke", css("--paper")).style("pointer-events", "none");
    }
  }, { label: "Latent space of the material VAE" });

  const ashby = mount("#latent-ashby", (w) => Math.min(480, w * 0.86), (svg, w, hgt) => {
    const m = { t: 10, r: 12, b: 34, l: 50 };
    const x = d3.scaleLog().domain([30, 15000]).range([m.l, w - m.r]);
    const y = d3.scaleLog().domain([5e-4, 2000]).range([hgt - m.b, m.t]);
    axes(svg, x, y, w, hgt, m, "Density ρ (kg/m³)", "Young's modulus E (GPa)", { xlog: true, ylog: true });
    svg.append("clipPath").attr("id", "clip-la").append("rect").attr("x", m.l).attr("y", m.t).attr("width", w - m.l - m.r).attr("height", hgt - m.t - m.b);
    const plot = svg.append("g").attr("clip-path", "url(#clip-la)");
    const a = CASES[st.caseId].a;
    if (st.best && prog >= 1) {
      const o = decode(st.best.z[0], st.best.z[1]); const C = logM(o, a); // log10(E_Pa^a / rho)
      // E_GPa = 10^((C + log rho)/a - 9)
      const pts = d3.range(0, 61).map((i) => { const r = 30 * Math.pow(500, i / 60); return [x(r), y(Math.pow(10, (C + Math.log10(r)) / a - 9))]; });
      plot.append("path").attr("class", "guide").attr("fill", "none").attr("d", d3.line()(pts));
    }
    const g = plot.append("g").selectAll("g").data(MATS).join("g").attr("transform", (d) => `translate(${x(d.rho)},${y(d.E)})`)
      .on("mousemove", (e, d) => showTip(e, `<b>${d.name}</b><br><span class="mono">E ${d.E} GPa · ρ ${d.rho} kg/m³</span>`)).on("mouseleave", hideTip);
    g.append("circle").attr("r", 4.5).attr("fill", (d) => familyColor(d.family)).attr("stroke", css("--paper")).attr("stroke-width", 1.5);
    st.runs.forEach((r) => {
      const p = partial(r.path).map((z) => decode(z[0], z[1]));
      plot.append("path").attr("d", d3.line().x((o) => x(10 ** o[1])).y((o) => y(10 ** o[0]))(p)).attr("fill", "none").attr("stroke", css("--hi")).attr("stroke-width", r === st.best ? 2.2 : 1).attr("stroke-opacity", r === st.best ? 1 : 0.5);
    });
    if (st.best && prog >= 1) {
      const o = decode(st.best.z[0], st.best.z[1]);
      plot.append("path").attr("transform", `translate(${x(10 ** o[1])},${y(10 ** o[0])})`).attr("d", d3.symbol().type(d3.symbolStar).size(240)()).attr("fill", css("--hi")).attr("stroke", css("--paper"));
    }
    if (w > 380) g.filter((d) => ["Silicon carbide", "Softwood pine", "CFRP epoxy", "Rigid polymer foam", "Natural rubber", "Stainless steel", "Silicon nitride"].includes(d.name))
      .append("text").attr("class", "lbl").attr("x", 7).attr("y", 3.5).style("font-size", "9.5px").text((d) => d.name);
  }, { label: "Decoded walk on a stiffness–density chart" });

  function readout() {
    const el = document.getElementById("latent-readout");
    const c = CASES[st.caseId], ex = exactWinner();
    if (!st.best) { el.innerHTML = `Index <b>${c.tex}</b>. Exact winner on the chart: <b>${ex.name}</b>. Click the latent map or run the multi-start search.`; return; }
    if (prog < 1) { el.innerHTML = `Walking…`; return; }
    const o = decode(st.best.z[0], st.best.z[1]); const nn = nearest(st.best.z); const near = MATS[nn.i];
    const far = Math.sqrt(nn.d2) > 0.3;
    el.innerHTML = `<span class="big">E ≈ ${fmt.sig(10 ** o[0])} GPa · ρ ≈ ${d3.format(",.0f")(10 ** o[1])} kg/m³</span>
      &nbsp; nearest real material <b>${near.name}</b> · exact chart winner <b>${ex.name}</b>
      ${near === ex ? '<span class="pill ok">✓ match</span>' : '<span class="pill no">✕ mismatch</span>'}
      ${st.runs.length > 1 ? ` · ${st.runs.length} starts, best of ${st.runs.length}` : ""}
      ${far ? `<div class="warn">The optimum is ${Math.sqrt(nn.d2).toFixed(2)} latent units from the nearest material: the decoder is extrapolating. Raise μ.</div>` : ""}`;
  }
  function redrawAll() { latent.redraw(); ashby.redraw(); readout(); }
  // initial state: a single walk from the centre of the plane, so the figure opens with something to read
  st.runs = [optimise([(zmin[0] + zmax[0]) / 2, (zmin[1] + zmax[1]) / 2])]; st.best = st.runs[0];
  redrawAll();
})();
