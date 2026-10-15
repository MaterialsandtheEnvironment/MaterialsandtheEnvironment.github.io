/* Chapter 5 figures: LLMs for material selection (Grandi et al. 2024), computed from the released data. */
(function () {
  "use strict";
  const { css, showTip, hideTip, mount, fmt, seg } = window.MATENV;
  const L = window.LLMSEL;
  const D = L.designs, C = L.criteria, M = L.materials;
  const idx = (d, c, m) => (d * 4 + c) * 9 + m;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const MODELS = ["GPT-4", "Mixtral", "MechGPT"];
  const MCOL = { "GPT-4": "--s1", Mixtral: "--s2", MechGPT: "--s3" };
  const MSHAPE = { "GPT-4": d3.symbolCircle, Mixtral: d3.symbolTriangle, MechGPT: d3.symbolSquare };
  const mcol = (m) => css(MCOL[m]);
  const EXPS = [
    { id: "zero-shot", label: "Zero-shot" }, { id: "few-shot", label: "Few-shot" },
    { id: "parallel", label: "Parallel" }, { id: "chain-of-thought", label: "Chain-of-thought" },
  ];
  const TEMPS = [0, 0.2, 0.4, 0.6, 0.8, 1];
  const ans = (model, exp) => {
    if (exp.startsWith("temperature-") && model === "MechGPT" && exp === "temperature-0") exp = "temperature-0.1";
    return L.answers[`${model}|${exp}`];
  };
  const symPath = (m, size) => d3.symbol().type(MSHAPE[m]).size(size)();
  const legendModels = (extra = "") => MODELS.map((m) => `<span><svg width="12" height="12" viewBox="-6 -6 12 12"><path d="${symPath(m, 60)}" fill="${mcol(m)}"/></svg>${m}</span>`).join("") + extra;

  /* ---------- expert statistics per cell from histograms ---------- */
  const STAT = L.hist.map((h) => {
    const n = d3.sum(h); const mean = d3.sum(h, (c, v) => c * v) / n;
    const varS = d3.sum(h, (c, v) => c * (v - mean) ** 2) / (n - 1);
    const q = (p) => { const t = p * (n - 1); let acc = 0; const vals = []; // quantile with linear interpolation (pandas default)
      const at = (k) => { let a = 0; for (let v = 0; v <= 10; v++) { a += h[v]; if (k < a) return v; } return 10; };
      const lo = Math.floor(t), hi = Math.ceil(t); return at(lo) + (at(hi) - at(lo)) * (t - lo); };
    const min = h.findIndex((c) => c > 0), max = 10 - h.slice().reverse().findIndex((c) => c > 0);
    return { h, n, mean, sd: Math.sqrt(varS), q1: q(0.25), med: q(0.5), q3: q(0.75), min, max };
  });
  const mae = (cell, y) => d3.sum(STAT[cell].h, (c, v) => c * Math.abs(v - y)) / STAT[cell].n;
  const zsc = (cell, y) => (y - STAT[cell].mean) / STAT[cell].sd;
  function metrics(model, exp) {
    const a = ans(model, exp); let z = 0, e = 0;
    a.forEach((y, i) => { z += zsc(i, y); e += mae(i, y); });
    return { z: z / a.length, mae: e / a.length };
  }

  /* ---------- 5.1 chips ---------- */
  document.getElementById("flow-d").innerHTML = D.map((d) => `<span class="chip d">${cap(d)}</span>`).join("");
  document.getElementById("flow-c").innerHTML = C.map((c) => `<span class="chip c">${cap(c)}</span>`).join("");
  document.getElementById("flow-m").innerHTML = M.map((m) => `<span class="chip">${cap(m)}</span>`).join("");

  /* ---------- 5.2 prompts ---------- */
  const opt = (arr) => arr.map((v, i) => `<option value="${i}">${cap(v)}</option>`).join("");
  const prD = document.getElementById("pr-d"), prC = document.getElementById("pr-c"), prM = document.getElementById("pr-m");
  prD.innerHTML = opt(D); prC.innerHTML = opt(C); prM.innerHTML = opt(M); prD.value = 1; prC.value = 0; prM.value = 2;
  let strat = "zero-shot";
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const slot = (s) => `<span class="slot">${esc(s)}</span>`;
  const FEW = `- Example 1
You are tasked with designing the grip of a bicycle frame which should be impact resistant.
How well do you think each of the provided materials would perform in this application? (Use a scale of 0-10 where 0 is 'unsatisfactory', 5 is 'acceptable', and 10 is 'excellent').
Steel: 6  Aluminium: 5  Titanium: 4  Glass: 2  Wood: 8
Thermoplastic: 9  Elastomer: 9  Thermoset: 6  Composite: 7
- Example 2
You are tasked with designing a medical implant which should be durable.
How well do you think each of the provided materials would perform in this application? (...)
Steel: 7  Aluminium: 2  Titanium: 9  Glass: 5  Wood: 0
Thermoplastic: 8  Elastomer: 8  Thermoset: 7  Composite: 7`;
  const SCALE = "Answer on a scale of 1-10, where 0 is 'unsatisfactory', 5 is 'acceptable', and 10 is 'excellent', with just the number and no other words.";
  function renderPrompt() {
    const d = D[+prD.value], c = C[+prC.value], m = M[+prM.value];
    const pre = `<span class="head">Preamble</span>You are a material science and design engineer expert.\nYou are tasked with designing a ${slot(d)}. The design should be ${slot(c)}.\n\n`;
    let body = "", note = "";
    if (strat === "zero-shot") { body = `<span class="head">Zero-shot</span>How well do you think ${slot(m)} would perform in this application? ${SCALE}`; note = "One question per material, worded like the survey. 144 prompts."; }
    if (strat === "few-shot") { body = `<span class="head">Few-shot</span>Below are two examples of how materials would perform from 1-10 given a design and a criterion:\n${slot(FEW)}\nHow well do you think ${slot(m)} would perform in this application? ${SCALE}`; note = "Two worked examples that are not in the survey are added before the question. They did not improve agreement on average."; }
    if (strat === "parallel") { body = `<span class="head">Parallel</span>For each of the following materials, how well do you think they would perform in this application? Answer on a scale of 1-10, where 0 is 'unsatisfactory', 5 is 'acceptable', and 10 is 'excellent', just with the integers separated by commas, and no other words or explanation. Be concise and answer for all 9 materials.\nMaterials:\n${slot(M.join(", "))}\nAnswers:`; note = "All nine materials in one prompt: 16 prompts instead of 144, faster, and the best average MAE. The answers need more post-processing because models do not always follow the format."; }
    if (strat === "chain-of-thought") { body = `<span class="head">Step 1</span>How well do you think ${slot(m)} would perform in this application?\n\n<span class="head">Step 2</span>How well do you think ${slot(m)} would perform in this application? Below is some reasoning that you can follow:\n${slot("{reasoning from step 1}")}\n${SCALE}`; note = "The model first writes its reasoning, which is then fed back before asking for the score. Slowest by far, and the worst agreement for GPT-4 and Mixtral."; }
    document.getElementById("pr-text").innerHTML = pre + body;
    const cell = idx(+prD.value, +prC.value, +prM.value), s = STAT[cell];
    const answersHere = MODELS.map((mo) => `<li><svg width="10" height="10" viewBox="-6 -6 12 12" style="margin-right:6px"><path d="${symPath(mo, 70)}" fill="${mcol(mo)}"/></svg>${mo}: <b class="num">${ans(mo, strat)[cell]}</b></li>`).join("");
    document.getElementById("pr-note").innerHTML = `<p style="margin:0 0 10px">${note}</p>
      <div>For this question, experts gave a median of <b class="num">${s.med}</b> (mean ${s.mean.toFixed(1)}, n = ${s.n}). The models answered:</div><ul style="list-style:none;padding:0;margin:6px 0">${answersHere}</ul>`;
  }
  seg("#pr-strat", EXPS.map((e) => ({ v: e.id, label: e.label })), strat, (v) => { strat = v; renderPrompt(); });
  [prD, prC, prM].forEach((e) => e.addEventListener("change", renderPrompt));
  renderPrompt();

  /* ---------- 5.3 explorer ---------- */
  const exD = document.getElementById("ex-d"), exC = document.getElementById("ex-c"), exE = document.getElementById("ex-e");
  exD.innerHTML = opt(D); exC.innerHTML = opt(C); exE.innerHTML = EXPS.map((e) => `<option value="${e.id}">${e.label}</option>`).join("");
  exD.value = 0; exC.value = 0;
  let sortMode = "list";
  seg("#ex-sort", [{ v: "list", label: "Survey order" }, { v: "median", label: "Sort by expert median" }], sortMode, (v) => { sortMode = v; explore.redraw(); });
  function legendEx() { document.getElementById("explore-legend").innerHTML = `<span><i style="background:var(--rule);border-radius:2px;width:14px"></i>Experts, middle 50%</span><span><i style="background:var(--ink);border-radius:1px;width:3px"></i>Expert median</span>` + legendModels(); }
  legendEx(); window.addEventListener("themechange", legendEx);
  const explore = mount("#explore-chart", (w) => (w < 520 ? 420 : 400), (svg, w, h) => {
    const d = +exD.value, c = +exC.value, exp = exE.value;
    let order = M.map((_, i) => i);
    if (sortMode === "median") order.sort((a, b) => STAT[idx(d, c, b)].med - STAT[idx(d, c, a)].med || STAT[idx(d, c, b)].mean - STAT[idx(d, c, a)].mean);
    const m = { t: 10, r: 18, b: 34, l: 100 };
    const x = d3.scaleLinear().domain([0, 10]).range([m.l, w - m.r]);
    const y = d3.scaleBand().domain(order).range([m.t, h - m.b]).padding(0.18);
    svg.append("g").attr("class", "grid").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(10).tickSize(-(h - m.t - m.b)).tickFormat(""));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(10));
    svg.append("text").attr("class", "axis-label").attr("x", w - m.r).attr("y", h - 4).attr("text-anchor", "end").text("Score (0 unsatisfactory · 5 acceptable · 10 excellent)");
    const maxC = d3.max(order, (k) => d3.max(STAT[idx(d, c, k)].h));
    const r = d3.scaleSqrt().domain([0, maxC]).range([0, Math.min(9, y.bandwidth() / 3)]);
    order.forEach((k) => {
      const cell = idx(d, c, k), s = STAT[cell], yc = y(k) + y.bandwidth() / 2;
      const g = svg.append("g");
      g.append("text").attr("x", m.l - 10).attr("y", yc + 4).attr("text-anchor", "end").style("fill", css("--ink")).style("font-size", "11.5px").text(cap(M[k]));
      g.append("line").attr("x1", x(s.min)).attr("x2", x(s.max)).attr("y1", yc).attr("y2", yc).attr("stroke", css("--muted")).attr("stroke-width", 1);
      g.append("rect").attr("x", x(s.q1)).attr("width", Math.max(2, x(s.q3) - x(s.q1))).attr("y", yc - y.bandwidth() * 0.32).attr("height", y.bandwidth() * 0.64).attr("rx", 3).attr("fill", css("--rule")).attr("fill-opacity", 0.9);
      s.h.forEach((cnt, v) => { if (cnt) g.append("circle").attr("cx", x(v)).attr("cy", yc).attr("r", r(cnt)).attr("fill", css("--muted")).attr("fill-opacity", 0.45); });
      g.append("line").attr("x1", x(s.med)).attr("x2", x(s.med)).attr("y1", yc - y.bandwidth() * 0.36).attr("y2", yc + y.bandwidth() * 0.36).attr("stroke", css("--ink")).attr("stroke-width", 2.5);
      g.append("rect").attr("x", m.l).attr("width", w - m.l - m.r).attr("y", y(k)).attr("height", y.bandwidth()).attr("fill", "transparent")
        .on("mousemove", (e) => showTip(e, `<b>${cap(M[k])}</b> · ${D[d]}, ${C[c]}<br><span class="mono">experts: median ${s.med}, mean ${s.mean.toFixed(2)}, sd ${s.sd.toFixed(2)}, n ${s.n}<br>${MODELS.map((mo) => `${mo}: ${ans(mo, exp)[cell]}  (z ${zsc(cell, ans(mo, exp)[cell]).toFixed(2)})`).join("<br>")}</span>`))
        .on("mouseleave", hideTip);
      MODELS.forEach((mo, j) => {
        const v = ans(mo, exp)[cell];
        g.append("path").attr("transform", `translate(${x(v)},${yc + (j - 1) * Math.min(8, y.bandwidth() * 0.22)})`).attr("d", symPath(mo, 80)).attr("fill", mcol(mo)).attr("stroke", css("--paper")).attr("stroke-width", 1.5).style("pointer-events", "none");
      });
    });
  }, { label: "Expert and model scores for one design scenario" });
  function exploreReadout() {
    const d = +exD.value, c = +exC.value, exp = exE.value;
    const rows = MODELS.map((mo) => { let z = 0, e = 0; M.forEach((_, k) => { const cell = idx(d, c, k), v = ans(mo, exp)[cell]; z += zsc(cell, v); e += mae(cell, v); }); return { mo, z: z / 9, e: e / 9 }; });
    const best = d3.least(rows, (r) => r.e);
    const eTop = M.map((_, k) => k).sort((a, b) => STAT[idx(d, c, b)].mean - STAT[idx(d, c, a)].mean).slice(0, 3).map((k) => cap(M[k]));
    document.getElementById("explore-readout").innerHTML = `<div style="margin-bottom:6px"><b>${cap(D[d])}</b>, ${C[c]} · ${EXPS.find((e) => e.id === exp).label}</div>
      <div class="table-wrap" style="margin:0"><table><thead><tr><th>Model</th><th class="n">mean z</th><th class="n">MAE</th></tr></thead><tbody>
      ${rows.map((r) => `<tr class="${r === best ? "win" : ""}"><td><svg width="10" height="10" viewBox="-6 -6 12 12" style="margin-right:6px"><path d="${symPath(r.mo, 70)}" fill="${mcol(r.mo)}"/></svg>${r.mo}</td><td class="n">${r.z >= 0 ? "+" : ""}${r.z.toFixed(2)}</td><td class="n">${r.e.toFixed(2)}</td></tr>`).join("")}
      </tbody></table></div>
      <p style="margin:10px 0 0">Experts' top three here: <b>${eTop.join(", ")}</b>. Highlighted: the model closest to experts in this scenario.</p>`;
  }
  [exD, exC, exE].forEach((e) => e.addEventListener("change", () => { explore.redraw(); exploreReadout(); }));
  exploreReadout();

  /* ---------- 5.4 tables ---------- */
  let metric = "z";
  const ALL = {}; MODELS.forEach((mo) => EXPS.forEach((e) => { ALL[`${mo}|${e.id}`] = metrics(mo, e.id); }));
  function renderTable() {
    const val = (mo, e) => ALL[`${mo}|${e}`][metric === "z" ? "z" : "mae"];
    const score = (v) => (metric === "z" ? Math.abs(v) : v);
    const allVals = []; MODELS.forEach((mo) => EXPS.forEach((e) => allVals.push(score(val(mo, e.id)))));
    const sc = d3.scaleLinear().domain(d3.extent(allVals)).range([0.42, 0.04]);
    const cell = (v) => `<td class="n" style="background:color-mix(in srgb, var(--accent) ${Math.round(sc(score(v)) * 100)}%, transparent)">${v >= 0 && metric === "z" ? "" : ""}${v.toFixed(3)}</td>`;
    const rowMean = (e) => d3.mean(MODELS, (mo) => val(mo, e));
    document.getElementById("tb").innerHTML = `<thead><tr><th>Prompt</th>${MODELS.map((m) => `<th class="n">${m}</th>`).join("")}<th class="n">Mean</th></tr></thead><tbody>
      ${EXPS.map((e) => `<tr><td>${e.label}</td>${MODELS.map((mo) => cell(val(mo, e.id))).join("")}<td class="n"><b>${rowMean(e.id).toFixed(3)}</b></td></tr>`).join("")}
      <tr><td><b>Mean</b></td>${MODELS.map((mo) => `<td class="n"><b>${d3.mean(EXPS, (e) => val(mo, e.id)).toFixed(3)}</b></td>`).join("")}<td></td></tr></tbody>`;
  }
  seg("#tb-metric", [{ v: "z", label: "Mean z-score" }, { v: "mae", label: "Mean absolute error" }], metric, (v) => { metric = v; renderTable(); });
  renderTable();

  /* ---------- 5.5 largest errors ---------- */
  const erM = document.getElementById("er-model"), erE = document.getElementById("er-exp");
  erM.innerHTML = MODELS.map((m) => `<option>${m}</option>`).join(""); erE.innerHTML = EXPS.map((e) => `<option value="${e.id}">${e.label}</option>`).join("");
  function renderErrors() {
    const a = ans(erM.value, erE.value);
    const rows = a.map((v, i) => ({ i, d: D[Math.floor(i / 36)], c: C[Math.floor(i / 9) % 4], m: M[i % 9], err: v - STAT[i].mean, v, mu: STAT[i].mean }));
    const pos = rows.slice().sort((p, q) => q.err - p.err).slice(0, 3), neg = rows.slice().sort((p, q) => p.err - q.err).slice(0, 3);
    const t = (title, rs) => `<thead><tr><th>${title}</th><th>Criterion</th><th>Material</th><th class="n">Model</th><th class="n">Expert mean</th><th class="n">Error</th></tr></thead><tbody>${rs.map((r) => `<tr><td>${cap(r.d)}</td><td>${r.c}</td><td>${r.m}</td><td class="n">${r.v}</td><td class="n">${r.mu.toFixed(2)}</td><td class="n" style="color:${r.err > 0 ? "var(--bad)" : "var(--accent-ink)"}">${r.err > 0 ? "+" : ""}${r.err.toFixed(2)}</td></tr>`).join("")}</tbody>`;
    document.getElementById("er-pos").innerHTML = t("Over-scored", pos);
    document.getElementById("er-neg").innerHTML = t("Under-scored", neg);
  }
  [erM, erE].forEach((e) => e.addEventListener("change", renderErrors)); renderErrors();

  /* ---------- 5.6 variation ---------- */
  const vaE = document.getElementById("va-exp");
  vaE.innerHTML = EXPS.map((e) => `<option value="${e.id}">${e.label}</option>`).join("");
  function legendVar() { document.getElementById("var-legend").innerHTML = `<span><i style="background:var(--muted);border-radius:2px"></i>Experts</span>` + legendModels(); }
  legendVar(); window.addEventListener("themechange", legendVar);
  function expertSdByMaterial(k) { // pooled over the 16 scenarios
    let n = 0, s = 0, s2 = 0; for (let d = 0; d < 4; d++) for (let c = 0; c < 4; c++) { STAT[idx(d, c, k)].h.forEach((cnt, v) => { n += cnt; s += cnt * v; s2 += cnt * v * v; }); }
    const mean = s / n; return Math.sqrt((s2 - n * mean * mean) / (n - 1));
  }
  const EXP_SD = M.map((_, k) => expertSdByMaterial(k));
  const varChart = mount("#var-chart", (w) => (w < 520 ? 360 : 300), (svg, w, h) => {
    const exp = vaE.value;
    const series = ["Experts"].concat(MODELS);
    const sd = (s, k) => (s === "Experts" ? EXP_SD[k] : d3.deviation(d3.range(16).map((j) => ans(s, exp)[j * 9 + k])) || 0);
    const m = { t: 10, r: 10, b: 54, l: 40 };
    const x0 = d3.scaleBand().domain(d3.range(9)).range([m.l, w - m.r]).paddingInner(0.22);
    const x1 = d3.scaleBand().domain(series).range([0, x0.bandwidth()]).padding(0.08);
    const y = d3.scaleLinear().domain([0, 4.5]).range([h - m.b, m.t]);
    svg.append("g").attr("class", "grid").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(w - m.l - m.r)).tickFormat(""));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5));
    svg.append("text").attr("class", "axis-label").attr("x", m.l + 4).attr("y", m.t + 10).text("Standard deviation across scenarios (points)");
    d3.range(9).forEach((k) => {
      series.forEach((s) => {
        const v = sd(s, k);
        svg.append("rect").attr("x", x0(k) + x1(s)).attr("width", x1.bandwidth()).attr("y", y(v)).attr("height", Math.max(0.5, y(0) - y(v))).attr("rx", 2)
          .attr("fill", s === "Experts" ? css("--muted") : mcol(s))
          .on("mousemove", (e) => showTip(e, `<b>${cap(M[k])}</b> · ${s}<br><span class="mono">sd = ${v.toFixed(2)}${s === "Experts" ? "" : `<br>scores: ${d3.range(16).map((j) => ans(s, exp)[j * 9 + k]).join(" ")}`}</span>`)).on("mouseleave", hideTip);
      });
      svg.append("text").attr("x", x0(k) + x0.bandwidth() / 2).attr("y", h - m.b + 14).attr("text-anchor", w < 520 ? "end" : "middle")
        .attr("transform", w < 520 ? `rotate(-40 ${x0(k) + x0.bandwidth() / 2} ${h - m.b + 14})` : null).style("fill", css("--ink")).style("font-size", "10.5px").text(cap(M[k]));
    });
  }, { label: "Variation of scores across scenarios by material" });
  vaE.addEventListener("change", () => varChart.redraw());

  /* ---------- 5.7 temperature ---------- */
  let tMetric = "z";
  seg("#tp-metric", [{ v: "z", label: "Mean z-score" }, { v: "mae", label: "MAE" }], tMetric, (v) => { tMetric = v; temp.redraw(); });
  const TT = {}; MODELS.forEach((mo) => { TT[mo] = TEMPS.map((t) => { const tt = mo === "MechGPT" && t === 0 ? 0.1 : t; const r = metrics(mo, `temperature-${tt}`); return { t: tt, ...r }; }); });
  const temp = mount("#temp-chart", () => 260, (svg, w, h) => {
    const m = { t: 12, r: 70, b: 36, l: 48 };
    const key = tMetric === "z" ? "z" : "mae";
    const vals = MODELS.flatMap((mo) => TT[mo].map((p) => p[key]));
    const x = d3.scaleLinear().domain([0, 1]).range([m.l, w - m.r]);
    const y = d3.scaleLinear().domain([d3.min(vals) - 0.05, d3.max(vals) + 0.05]).range([h - m.b, m.t]).nice();
    svg.append("g").attr("class", "grid").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(w - m.l - m.r)).tickFormat(""));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(5));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5));
    svg.append("text").attr("class", "axis-label").attr("x", w - m.r).attr("y", h - 4).attr("text-anchor", "end").text("Temperature");
    svg.append("text").attr("class", "axis-label").attr("x", m.l + 4).attr("y", m.t + 10).text(tMetric === "z" ? "Mean z-score" : "Mean absolute error");
    MODELS.forEach((mo) => {
      const pts = TT[mo];
      svg.append("path").attr("fill", "none").attr("stroke", mcol(mo)).attr("stroke-width", 2).attr("d", d3.line().x((p) => x(p.t)).y((p) => y(p[key]))(pts));
      pts.forEach((p) => svg.append("path").attr("transform", `translate(${x(p.t)},${y(p[key])})`).attr("d", symPath(mo, 50)).attr("fill", mcol(mo)).attr("stroke", css("--paper"))
        .on("mousemove", (e) => showTip(e, `<b>${mo}</b> · T = ${p.t}<br><span class="mono">z ${p.z.toFixed(3)} · MAE ${p.mae.toFixed(3)}</span>`)).on("mouseleave", hideTip));
      const last = pts[pts.length - 1];
      svg.append("text").attr("x", x(1) + 8).attr("y", y(last[key]) + 4).style("font-size", "10.5px").style("fill", css("--ink")).text(mo);
    });
  }, { label: "Effect of temperature" });

  window.addEventListener("themechange", () => { renderTable(); renderPrompt(); exploreReadout(); renderErrors(); });
})();
