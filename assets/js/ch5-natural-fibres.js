/* Chapter 5: natural fibre composites, charts redrawn from Shah (2014) Supplementary Tables 1-4 (data/nfc.js). */
(function () {
  "use strict";
  const { css, showTip, hideTip, mount, seg, fmt, familyColor } = window.MATENV;
  const D = window.NFC;
  const C = D.composites;
  const GCOL = { Bast: "--s1", Leaf: "--s8", Seed: "--s3", Other: "--s4", Synthetic: "--ink-2" };
  const FORMS = ["Pellets", "Nonwoven", "Multiaxial", "Unidirectional"];
  const FCOL = { Pellets: "--s5", Nonwoven: "--s3", Multiaxial: "--s2", Unidirectional: "--s1" };
  const FLAB = { Pellets: "Short fibre pellets (IM)", Nonwoven: "Short fibre nonwovens", Multiaxial: "Long fibre multiaxials", Unidirectional: "Long fibre unidirectionals" };
  const fcol = (f) => css(FCOL[f]);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const g3 = d3.format(".3~g");
  const isTS = (c) => c.mtype === "Thermoset";

  const BASES = [
    { v: "abs", label: "Absolute" }, { v: "rho", label: "Per density" },
    { v: "cost", label: "Per cost" }, { v: "ee", label: "Per energy" },
  ];
  const AX = {
    abs: ["Tensile modulus E (GPa)", "Tensile strength σ (MPa)"],
    rho: ["E/ρ (GPa per g/cm³)", "σ/ρ (MPa per g/cm³)"],
    cost: ["E/(C·ρ) (GPa per £/kg·g/cm³)", "σ/(C·ρ) (MPa per £/kg·g/cm³)"],
    ee: ["E/(H·ρ) (GPa per MJ/kg·g/cm³)", "σ/(H·ρ) (MPa per MJ/kg·g/cm³)"],
  };

  /* log-log frame */
  function frame(svg, w, h, xd, yd, labels, m = { t: 12, r: 14, b: 40, l: 56 }) {
    const pad = (d) => [d[0] / 1.6, d[1] * 1.6];
    const x = d3.scaleLog().domain(pad(xd)).range([m.l, w - m.r]);
    const y = d3.scaleLog().domain(pad(yd)).range([h - m.b, m.t]);
    const span = (s) => Math.log10(s.domain()[1] / s.domain()[0]);
    const tf = (s) => (v) => { const e = Math.log10(v), k = Math.round(e); if (Math.abs(e - k) < 1e-9) return d3.format("~g")(v); return span(s) < 2.2 && [2, 5].includes(Math.round(v / 10 ** Math.floor(e))) ? d3.format("~g")(v) : ""; };
    svg.append("g").attr("class", "grid").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(6).tickSize(-(h - m.t - m.b)).tickFormat(""));
    svg.append("g").attr("class", "grid").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickSize(-(w - m.l - m.r)).tickFormat(""));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(6, "~g").tickFormat(tf(x)));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6, "~g").tickFormat(tf(y)));
    svg.append("text").attr("class", "axis-label").attr("x", w - m.r).attr("y", h - 6).attr("text-anchor", "end").text(labels[0]);
    svg.append("text").attr("class", "axis-label").attr("transform", `translate(12,${m.t}) rotate(-90)`).attr("text-anchor", "end").text(labels[1]);
    return { x, y, m };
  }
  /* smooth balloon around a set of pixel points */
  function balloon(pts, r) {
    const ring = [];
    pts.forEach(([px, py]) => { for (let k = 0; k < 12; k++) { const a = (k / 12) * 2 * Math.PI; ring.push([px + r * Math.cos(a), py + r * Math.sin(a)]); } });
    const hull = d3.polygonHull(ring);
    return d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5))(hull);
  }

  /* ---------- 5.1 fibres ---------- */
  let FB = "abs";
  function fibreRange(f, b) {
    const div = (a, d) => [a[0] / d[1], a[1] / d[0]];
    if (b === "abs") return [f.E, f.s];
    if (b === "rho") return [f.Esp, f.ssp];
    if (b === "cost") return [div(f.Esp, f.cost), div(f.ssp, f.cost)];
    return [div(f.Esp, f.ee), div(f.ssp, f.ee)];
  }
  const fib = mount("#fib-chart", (w) => Math.max(280, Math.min(440, w * 0.72)), (svg, w, h) => {
    const R = D.fibres.map((f) => ({ f, r: fibreRange(f, FB) }));
    const { x, y } = frame(svg, w, h, d3.extent(R.flatMap((d) => d.r[0])), d3.extent(R.flatMap((d) => d.r[1])), AX[FB]);
    const order = [...R].sort((a, b) => (b.r[0][1] / b.r[0][0]) * (b.r[1][1] / b.r[1][0]) - (a.r[0][1] / a.r[0][0]) * (a.r[1][1] / a.r[1][0]));
    order.forEach(({ f, r }) => {
      const x0 = x(r[0][0]), x1 = x(r[0][1]), y0 = y(r[1][1]), y1 = y(r[1][0]);
      const rx = Math.max(6, (x1 - x0) / 2), ry = Math.max(6, (y1 - y0) / 2), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const col = css(GCOL[f.group]);
      svg.append("ellipse").attr("cx", cx).attr("cy", cy).attr("rx", rx).attr("ry", ry).attr("fill", col).attr("fill-opacity", f.group === "Synthetic" ? 0.12 : 0.22).attr("stroke", col).attr("stroke-width", 1.4)
        .attr("stroke-dasharray", f.group === "Synthetic" ? "4 3" : null)
        .on("mousemove", (ev) => showTip(ev, `<b>${f.name}</b> · ${f.group === "Synthetic" ? "synthetic" : f.group.toLowerCase() + " fibre"}<br><span class="mono">E ${f.E.join("–")} GPa · σ ${f.s.join("–")} MPa<br>ρ ${f.rho.join("–")} g/cm³ · £${f.cost.join("–")}/kg · ${f.ee.join("–")} MJ/kg</span>`)).on("mouseleave", hideTip);
      svg.append("text").attr("class", "lbl").attr("x", cx).attr("y", cy + 4).attr("text-anchor", "middle").style("pointer-events", "none").text(f.name);
    });
    fibReadout();
  }, { label: "Plant fibre selection chart" });
  seg("#fib-basis", BASES, FB, (v) => { FB = v; fib.redraw(); });
  document.getElementById("fib-legend").innerHTML = Object.entries(GCOL).map(([g, c]) => `<span><i style="background:var(${c})"></i>${g === "Synthetic" ? "E-glass" : g + " fibres"}</span>`).join("");
  function fibReadout() {
    const gm = (r) => Math.sqrt(r[0] * r[1]);
    const score = (f) => { const r = fibreRange(f, FB); return gm(r[0]) * gm(r[1]); };
    const rank = [...D.fibres].sort((a, b) => score(b) - score(a));
    const gl = rank.findIndex((f) => f.name === "E-glass") + 1;
    const txt = { abs: "Absolute properties: E-glass is far ahead; bast fibres lead the plant fibres.", rho: "Per unit density, glass keeps its lead in strength, but flax and hemp match its specific stiffness (31 GPa per g/cm³).", cost: "Per unit cost, cheap jute and wood pulp lead; cotton trails.", ee: "Per unit embodied energy, by-product fibres lead and E-glass drops near the bottom." }[FB];
    document.getElementById("fib-readout").innerHTML = `<div>${txt}</div><div style="margin-top:8px">Ranked by the product of the two mid-range values:</div><ol>${rank.slice(0, 5).map((f, i) => `<li class="${i ? "" : "top"}">${f.name}</li>`).join("")}</ol><div>E-glass: <b>${gl}</b> of ${rank.length}</div>`;
  }

  /* ---------- table 5.1 forms ---------- */
  document.getElementById("form-cards").innerHTML = FORMS.map((k) => { const f = D.forms[k];
    const r = (a, u = "") => (a[0] === a[1] ? `${a[0]}${u}` : `${a[0]}–${a[1]}${u}`);
    return `<div class="nf-form" style="--c:var(${FCOL[k]})"><b>${k}</b>${FLAB[k]}
      <div class="k"><span>Fibre length</span><span>${f.length}</span></div>
      <div class="k"><span>η<sub>l</sub> · η<sub>o</sub></span><span>${r(f.eta)}</span></div>
      <div class="k"><span>Cost</span><span>${r(f.cost)} £/kg</span></div>
      <div class="k"><span>Energy</span><span>${r(f.ee)} MJ/kg</span></div></div>`; }).join("");

  /* ---------- 5.2 rule of mixtures ---------- */
  const romF = document.getElementById("rom-fibre"), romE = document.getElementById("rom-ef"), romM = document.getElementById("rom-mat"), romG = document.getElementById("rom-glass");
  let RB = "abs";
  const FIB = Object.fromEntries(D.fibres.map((f) => [f.name, f]));
  const mid = (a) => (a[0] + a[1]) / 2;
  function romSet() { const f = FIB[romF.value]; romE.min = f.E[0]; romE.max = f.E[1]; romE.value = Math.round(mid(f.E)); }
  const rom = (Ef, rf, eta, vf, m) => { const Em = mid(m.E || [3, 3]); const E = eta * vf * Ef + (1 - vf) * Em, rho = vf * rf + (1 - vf) * m.rho; return RB === "abs" ? E : E / rho; };
  const romChart = mount("#rom-chart", (w) => Math.max(260, Math.min(400, w * 0.66)), (svg, w, h) => {
    const Ef = +romE.value, f = FIB[romF.value], rf = mid(f.rho), M = D.matrices[romM.value];
    document.getElementById("rom-ef-out").textContent = Ef + " GPa";
    const m = { t: 12, r: 14, b: 40, l: 50 };
    const x = d3.scaleLinear().domain([0, 0.7]).range([m.l, w - m.r]);
    const g = FIB["E-glass"];
    const ymax = Math.max(d3.max(C, (c) => (RB === "abs" ? c.E : c.Esp)), rom(RB === "abs" ? 78.5 : 78.5, 2.55, 1, 0.7, M) * (romG.checked ? 1 : 0), rom(f.E[1], rf, 1, 0.7, M) * 0.8);
    const y = d3.scaleLinear().domain([0, ymax * 1.05]).range([h - m.b, m.t]).nice();
    window.MATENV.axes(svg, x, y, w, h, m, "Fibre volume fraction vf", RB === "abs" ? "Composite modulus E (GPa)" : "Specific modulus E/ρ (GPa per g/cm³)", { xfmt: d3.format(".0%") });
    const vs = d3.range(0, 0.701, 0.01);
    FORMS.forEach((k) => {
      const [lo, hi] = D.forms[k].eta, col = fcol(k);
      svg.append("path").attr("d", d3.area().x((v) => x(v)).y0((v) => y(rom(Ef, rf, lo, v, M))).y1((v) => y(rom(Ef, rf, Math.max(hi, lo + 0.01), v, M)))(vs)).attr("fill", col).attr("fill-opacity", 0.18).attr("stroke", col).attr("stroke-opacity", 0.6);
      if (romG.checked) svg.append("path").attr("d", d3.line().x((v) => x(v)).y((v) => y(rom(g.E[0], g.rho[0], mid(D.forms[k].eta), v, M)))(vs)).attr("fill", "none").attr("stroke", col).attr("stroke-width", 1.6).attr("stroke-dasharray", "5 4");
    });
    C.forEach((c) => {
      const on = c.fibre === romF.value, col = fcol(c.form);
      svg.append("circle").attr("cx", x(c.vf)).attr("cy", y(RB === "abs" ? c.E : c.Esp)).attr("r", on ? 5 : 3.5).attr("fill", isTS(c) ? col : css("--paper")).attr("stroke", col).attr("stroke-width", 1.6).attr("opacity", on ? 1 : 0.35)
        .on("mousemove", (ev) => showTip(ev, tipC(c))).on("mouseleave", hideTip);
    });
    const v = 0.4, ud = rom(Ef, rf, 1, v, M), gud = rom(78.5, 2.55, 1, v, M), nw = rom(Ef, rf, mid(D.forms.Nonwoven.eta), v, M);
    const u = RB === "abs" ? "GPa" : "GPa/(g/cm³)";
    document.getElementById("rom-readout").innerHTML = `<div>At v<sub>f</sub> = 40% in ${romM.selectedOptions[0].text.split(" (")[0].toLowerCase()}</div>
      <div class="big">${romF.value} UD ${g3(ud)} ${u}</div>
      <div style="margin-top:4px">E-glass UD: <b class="num">${g3(gud)}</b> ${u} · ${romF.value} nonwoven: <b class="num">${g3(nw)}</b> ${u}</div>
      <div style="margin-top:8px">${RB === "abs" ? `Glass is ${d3.format(".1f")(gud / ud)}× stiffer in absolute terms.` : `Per unit density the ratio falls to ${d3.format(".2f")(gud / ud)}×.`} Aligning the same fibres multiplies the modulus by ${d3.format(".1f")(ud / nw)} over a nonwoven.</div>`;
  }, { label: "Rule of mixtures against measured composites" });
  romF.onchange = () => { romSet(); romChart.redraw(); };
  romE.oninput = romM.onchange = romG.onchange = () => romChart.redraw();
  seg("#rom-basis", [{ v: "abs", label: "E" }, { v: "rho", label: "E/ρ" }], RB, (v) => { RB = v; romChart.redraw(); });
  romSet(); romChart.redraw();
  document.getElementById("rom-legend").innerHTML = FORMS.map((k) => `<span><i style="background:var(${FCOL[k]});border-radius:2px;opacity:.6"></i>${k}</span>`).join("") + `<span><i style="background:var(--ink-2)"></i>Thermoset (filled)</span><span><i style="border:1.6px solid var(--ink-2);background:none"></i>Thermoplastic</span><span><i style="border-top:2px dashed var(--ink-2);border-radius:0;height:0;width:16px"></i>E-glass, mid η</span>`;

  function tipC(c) {
    return `<b>${esc(c.name)}</b><br>${c.form}${c.layup ? " (" + c.layup + ")" : ""}, ${c.process.toLowerCase()}<br><span class="mono">${c.fc} ${c.unit === "v" ? "vol" : "wt"}% · E ${c.E} GPa · σ ${c.s} MPa · ρ ${c.rho.toFixed(2)}<br>est. £${c.cost.toFixed(1)}/kg · ${c.ee.toFixed(0)} MJ/kg · ref. [${c.ref}] in Shah (2014)</span>`;
  }

  /* ---------- 5.3 PFRP chart ---------- */
  let PB = "abs";
  const val = (c, b) => (b === "abs" ? [c.E, c.s] : b === "rho" ? [c.Esp, c.ssp] : b === "cost" ? [c.Esp / c.cost, c.ssp / c.cost] : [c.Esp / c.ee, c.ssp / c.ee]);
  const MATS = Object.entries(D.matrices).filter(([, m]) => m.E).map(([k, m]) => ({ name: k, m, abs: [mid(m.E), mid(m.s)], rho: [mid(m.Esp), mid(m.ssp)], cost: [mid(m.Esp) / m.cost, mid(m.ssp) / m.cost], ee: [mid(m.Esp) / m.ee, mid(m.ssp) / m.ee] }));
  const IDX = [
    ["E/ρ — stiff tie, minimum mass", (c) => c.Esp],
    ["E^1/3/ρ — stiff panel, minimum mass", (c) => Math.cbrt(c.E) / c.rho],
    ["σ/ρ — strong tie, minimum mass", (c) => c.ssp],
    ["σ^1/2/ρ — strong panel, minimum mass", (c) => Math.sqrt(c.s) / c.rho],
    ["E/(Cρ) — stiff tie, minimum cost", (c) => c.Esp / c.cost],
    ["E^1/3/(Cρ) — stiff panel, minimum cost", (c) => Math.cbrt(c.E) / c.rho / c.cost],
    ["σ/(Cρ) — strong tie, minimum cost", (c) => c.ssp / c.cost],
    ["E/(Hρ) — stiff tie, minimum energy", (c) => c.Esp / c.ee],
    ["E^1/3/(Hρ) — stiff panel, minimum energy", (c) => Math.cbrt(c.E) / c.rho / c.ee],
    ["σ/(Hρ) — strong tie, minimum energy", (c) => c.ssp / c.ee],
  ];
  const rankSel = document.getElementById("pf-rank");
  rankSel.innerHTML = IDX.map(([l], i) => `<option value="${i}">${l}</option>`).join("");
  rankSel.value = "5";
  const top5 = () => { const f = IDX[+rankSel.value][1]; return [...C].map((c, i) => ({ c, i, v: f(c) })).sort((a, b) => b.v - a.v).slice(0, 5); };
  const pf = mount("#pf-chart", (w) => Math.max(280, Math.min(460, w * 0.74)), (svg, w, h) => {
    const P = C.map((c) => val(c, PB)), Mv = MATS.map((m) => m[PB]);
    const all = [...P, ...Mv];
    const { x, y } = frame(svg, w, h, d3.extent(all, (d) => d[0]), d3.extent(all, (d) => d[1]), AX[PB]);
    FORMS.forEach((k) => {
      const pts = C.map((c, i) => [c, P[i]]).filter(([c]) => c.form === k).map(([, p]) => [x(p[0]), y(p[1])]);
      svg.append("path").attr("d", balloon(pts, 14)).attr("fill", fcol(k)).attr("fill-opacity", 0.13).attr("stroke", fcol(k)).attr("stroke-opacity", 0.7);
    });
    MATS.forEach((m) => {
      const px = x(m[PB][0]), py = y(m[PB][1]);
      svg.append("path").attr("d", d3.symbol().type(d3.symbolCross).size(70)()).attr("transform", `translate(${px},${py}) rotate(45)`).attr("fill", css("--muted"))
        .on("mousemove", (ev) => showTip(ev, `<b>Neat ${m.name}</b><br><span class="mono">E ${m.m.E.join("–")} GPa · σ ${m.m.s.join("–")} MPa</span>`)).on("mouseleave", hideTip);
      svg.append("text").attr("class", "lbl").attr("x", px + 7).attr("y", py + 3).style("fill", css("--muted")).text(m.name);
    });
    const T = top5(), topSet = new Map(T.map((t, j) => [t.i, j + 1]));
    C.forEach((c, i) => {
      const col = fcol(c.form), r = topSet.has(i);
      svg.append("circle").attr("cx", x(P[i][0])).attr("cy", y(P[i][1])).attr("r", r ? 6 : 4.2).attr("fill", isTS(c) ? col : css("--paper")).attr("stroke", r ? css("--hi") : col).attr("stroke-width", r ? 2.4 : 1.6)
        .on("mousemove", (ev) => showTip(ev, tipC(c))).on("mouseleave", hideTip);
      if (r) svg.append("text").attr("class", "lbl").attr("x", x(P[i][0]) + 8).attr("y", y(P[i][1]) - 6).style("font-weight", 600).style("fill", css("--hi")).text(topSet.get(i));
    });
    FORMS.forEach((k) => {
      const ps = C.map((c, i) => [c, P[i]]).filter(([c]) => c.form === k).map(([, p]) => p);
      const cx = d3.max(ps, (p) => x(p[0])), cy = d3.min(ps, (p) => y(p[1]));
      svg.append("text").attr("class", "lbl").attr("x", Math.min(cx + 12, w - 16)).attr("y", Math.max(cy - 10, 14)).attr("text-anchor", cx + 12 > w - 90 ? "end" : "start").style("fill", fcol(k)).style("font-weight", 600).text(k);
    });
    pfReadout(T);
  }, { label: "Plant fibre composite selection chart" });
  function pfReadout(T) {
    document.getElementById("pf-readout").innerHTML = `<div>Top five for <b>${IDX[+rankSel.value][0].split(" — ")[0]}</b> (${IDX[+rankSel.value][0].split(" — ")[1]})</div>
      <ol class="nf-rank">${T.map((t, j) => `<li class="${j ? "" : "top"}"><span class="sw" style="background:var(${FCOL[t.c.form]})"></span>${esc(t.c.name)}, ${t.c.form.toLowerCase()}, ${t.c.process === "RTM" ? "RTM" : t.c.process.toLowerCase()} <span class="num" style="color:var(--muted)">${g3(t.v)}</span></li>`).join("")}</ol>
      <div style="margin-top:6px">${({ Pellets: "Short-fibre pellets", Nonwoven: "Nonwoven mats", Multiaxial: "Multiaxial fabrics", Unidirectional: "Unidirectional yarns" })[T[0].c.form]} win this index.</div>`;
  }
  seg("#pf-basis", BASES, PB, (v) => { PB = v; pf.redraw(); });
  rankSel.onchange = () => pf.redraw();
  document.getElementById("pf-legend").innerHTML = FORMS.map((k) => `<span><i style="background:var(${FCOL[k]})"></i>${FLAB[k]}</span>`).join("") + `<span><i style="border:1.6px solid var(--ink-2);background:none"></i>open = thermoplastic</span><span><i style="background:var(--muted);border-radius:0;transform:rotate(45deg);width:8px;height:8px"></i>neat matrix</span>`;

  /* ---------- 5.4 among engineering materials ---------- */
  let OB = "rho";
  const ot = mount("#ot-chart", (w) => Math.max(300, Math.min(480, w * 0.62)), (svg, w, h) => {
    const M22 = window.MAT22.filter((m) => m.E / (m.rho / 1000) > 0.5).map((m) => { const r = m.rho / 1000; return { m, p: OB === "abs" ? [m.E, m.sigma] : [m.E / r, m.sigma / r] }; });
    const P = C.map((c) => (OB === "abs" ? [c.E, c.s] : [c.Esp, c.ssp]));
    const all = [...M22.map((d) => d.p), ...P];
    const { x, y } = frame(svg, w, h, d3.extent(all, (d) => d[0]), d3.extent(all, (d) => d[1]), AX[OB]);
    FORMS.forEach((k) => {
      const pts = C.map((c, i) => [c, P[i]]).filter(([c]) => c.form === k).map(([, p]) => [x(p[0]), y(p[1])]);
      svg.append("path").attr("d", balloon(pts, 10)).attr("fill", fcol(k)).attr("fill-opacity", 0.28).attr("stroke", fcol(k));
    });
    M22.forEach(({ m, p }) => {
      const col = familyColor(m.family), px = x(p[0]), py = y(p[1]);
      svg.append("circle").attr("cx", px).attr("cy", py).attr("r", 4.5).attr("fill", css("--paper")).attr("stroke", col).attr("stroke-width", 2)
        .on("mousemove", (ev) => showTip(ev, `<b>${m.name}</b> · ${m.family}<br><span class="mono">E ${g3(m.E)} GPa · σ ≈ ${m.sigma} MPa · ρ ${m.rho} kg/m³</span>`)).on("mouseleave", hideTip);
      svg.append("text").attr("class", "lbl").attr("x", px + 7).attr("y", py + 3).style("font-size", "10px").text(m.name);
    });
  }, { label: "Plant fibre composites among engineering materials" });
  seg("#ot-basis", [{ v: "abs", label: "Absolute" }, { v: "rho", label: "Per density" }], OB, (v) => { OB = v; ot.redraw(); });
  const fams = [...new Set(window.MAT22.filter((m) => m.E / (m.rho / 1000) > 0.5).map((m) => m.family))];
  document.getElementById("ot-legend").innerHTML = FORMS.map((k) => `<span><i style="background:var(${FCOL[k]});border-radius:2px"></i>PFRP ${k.toLowerCase()}</span>`).join("") + fams.map((f) => `<span><i style="border:2px solid ${familyColor(f)};background:none"></i>${f}</span>`).join("");

  /* ---------- 5.5 fatigue ---------- */
  const F = D.fatigue;
  const k = d3.sum(F, (f) => f.fat * f.uts) / d3.sum(F, (f) => f.uts * f.uts);
  const fat = mount("#fat-chart", (w) => Math.max(240, Math.min(340, w * 0.6)), (svg, w, h) => {
    const m = { t: 12, r: 14, b: 40, l: 50 };
    const x = d3.scaleLinear().domain([0, 400]).range([m.l, w - m.r]);
    const y = d3.scaleLinear().domain([0, 170]).range([h - m.b, m.t]);
    window.MATENV.axes(svg, x, y, w, h, m, "Tensile strength (MPa)", "Fatigue strength at 10⁶ cycles (MPa)");
    svg.append("line").attr("x1", x(0)).attr("y1", y(0)).attr("x2", x(390)).attr("y2", y(390 * k)).attr("stroke", css("--hi")).attr("stroke-width", 2).attr("stroke-dasharray", "6 4");
    svg.append("text").attr("class", "lbl").attr("x", x(390)).attr("y", y(390 * k * 0.6)).attr("text-anchor", "end").style("fill", css("--hi")).text(`σ₆ ≈ ${k.toFixed(2)} σ_UTS`);
    F.forEach((f) => {
      const col = fcol(f.form);
      svg.append("circle").attr("cx", x(f.uts)).attr("cy", y(f.fat)).attr("r", 5).attr("fill", col).attr("stroke", css("--paper")).attr("stroke-width", 1)
        .on("mousemove", (ev) => showTip(ev, `<b>${esc(f.name)}</b> ${f.fc !== "-" ? "· " + f.fc.replace(" v", " vol%").replace(" wt", " wt%") : ""}<br>${f.form}, ${f.process.toLowerCase()}<br><span class="mono">UTS ${f.uts} MPa · 10⁶ cycles ${f.fat} MPa (${d3.format(".0%")(f.fat / f.uts)})</span>`)).on("mouseleave", hideTip);
    });
  }, { label: "Fatigue strength against tensile strength" });
  const ratios = F.map((f) => f.fat / f.uts);
  document.getElementById("fat-readout").innerHTML = `<div>Fatigue ratio at 10⁶ cycles</div><div class="big">${d3.format(".0%")(k)} of UTS</div>
    <div style="margin-top:4px">Range ${d3.format(".0%")(d3.min(ratios))}–${d3.format(".0%")(d3.max(ratios))} over ${F.length} composites.</div>
    <div style="margin-top:8px">Stronger composites keep roughly the same fraction, so a first fatigue screen can use static strength. The ±45° laminates sit highest relative to their low static strength, at 50–60%.</div>`;
  document.getElementById("fat-legend").innerHTML = ["Nonwoven", "Multiaxial", "Unidirectional"].map((k2) => `<span><i style="background:var(${FCOL[k2]})"></i>${k2}</span>`).join("");
  void fmt; void fat;
})();
