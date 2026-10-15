/* MatEnv tools: exact calculators built from the data and rules of Chapters 1–4.
   One source of truth for the browser (window.MATENV_TOOLS) and for the Node dataset generator (module.exports).
   Every tool takes a plain-object argument and returns { text, data }. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else root.MATENV_TOOLS = factory({ MAT22: root.MAT22, TOSM: root.TOSM });
})(typeof self !== "undefined" ? self : this, function (src) {
  "use strict";
  const MAT22 = src.MAT22, TOSM = src.TOSM;

  /* ---- Chapter 1 tables ---- */
  const PANEL6 = [ // Ashby (2000) stiffness-limited panel example; rho Mg/m3, E GPa, Cm GBP/kg
    { name: "Cast iron, nodular", rho: 7.3, E: 175, Cm: 0.25 }, { name: "Low-alloy steel (4340)", rho: 7.85, E: 210, Cm: 0.45 },
    { name: "Al 6061-T6", rho: 2.85, E: 70, Cm: 0.95 }, { name: "Al-6061-20%SiC", rho: 2.77, E: 102, Cm: 25 },
    { name: "Ti-6-4", rho: 4.43, E: 115, Cm: 20 }, { name: "Beryllium SR-200", rho: 1.84, E: 305, Cm: 250 },
  ];
  const ECO6 = [ // illustrative eco-costs (EUR/kg)
    { name: "Structural wood", rho: 500, E: 10, sy: 40, eco: 0.05 }, { name: "Concrete", rho: 2400, E: 30, sy: 30, eco: 0.02 },
    { name: "Mild steel", rho: 7850, E: 210, sy: 250, eco: 0.4 }, { name: "Aluminium alloy", rho: 2700, E: 70, sy: 100, eco: 1.0 },
    { name: "PET plastic", rho: 1350, E: 2.8, sy: 55, eco: 0.6 }, { name: "GFRP composite", rho: 1800, E: 20, sy: 200, eco: 1.5 },
  ];
  /* ---- Chapter 3 tables (Ecolizer 2.0 family statistics, mPt/kg; rho/E representative) ---- */
  const FAM = [
    { f: "Ferrous metals", n: 9, med: 231, lo: 61, hi: 1105, rho: 7850, E: 205 },
    { f: "Non-ferrous metals", n: 15, med: 646, lo: 45, hi: 3768, rho: 4500, E: 90 },
    { f: "Precious & critical metals", n: 7, med: 1.2e6, lo: 63042, hi: 9.6e6, rho: 15000, E: 150, precious: true },
    { f: "Thermoplastics", n: 24, med: 396, lo: 220, hi: 16929, rho: 1100, E: 2.5 },
    { f: "Composites & thermosets", n: 14, med: 552, lo: 264, hi: 1249, rho: 1700, E: 20 },
    { f: "Elastomers", n: 6, med: 400, lo: 230, hi: 599, rho: 1100, E: 0.01 },
    { f: "Bio-based plastics", n: 2, med: 294, lo: 275, hi: 312, rho: 1250, E: 3.5 },
    { f: "Recycled plastics", n: 6, med: 78, lo: 62, hi: 95 },
    { f: "Wood & panels", n: 17, med: 224, lo: 59, hi: 558, rho: 600, E: 10 },
    { f: "Paper & board", n: 14, med: 232, lo: 76, hi: 347, rho: 750, E: 4 },
    { f: "Glass & ceramics", n: 9, med: 82, lo: 17, hi: 124, rho: 2500, E: 70 },
    { f: "Minerals & cement", n: 26, med: 9.2, lo: 0.3, hi: 195, rho: 2300, E: 25 },
    { f: "Insulation", n: 6, med: 253, lo: 50, hi: 530, rho: 60, E: 0.005 },
    { f: "Chemicals & glues", n: 38, med: 194, lo: 0.001, hi: 5306 },
  ];
  const ENERGY = { prim: 1045, sec: 45, CH: 3, GR: 113 };

  const sig = (v, n = 3) => { if (v === 0) return "0"; const a = Math.abs(v); if (a >= 1e6) return +(v / 1e6).toPrecision(2) + " million"; if (a < 1e-3) return v.toExponential(n - 1); return String(+v.toPrecision(n)); };
  const pct = (v) => (v >= 0 ? "+" : "") + Math.round(v * 100) + "%";
  const lc = (s) => String(s || "").toLowerCase().trim();
  const fail = (msg) => ({ text: "I can't answer that: " + msg, data: null, error: msg });

  /* ---- Tool 1: Ashby ranking (Chapter 1, 22 materials) ---- */
  const EXP = { stiffness: { tie: 1, beam: 1 / 2, panel: 1 / 3 }, strength: { tie: 1, beam: 2 / 3, panel: 1 / 2 } };
  const IDXTXT = { stiffness: { tie: "E/ρ", beam: "E^1/2/ρ", panel: "E^1/3/ρ" }, strength: { tie: "σ/ρ", beam: "σ^2/3/ρ", panel: "σ^1/2/ρ" } };
  function findMat(name) { const n = lc(name); return MAT22.find((m) => lc(m.name) === n) || MAT22.find((m) => lc(m.name).includes(n) || n.includes(lc(m.name))); }
  function rank_materials(a) {
    const prop = lc(a.property), shape = lc(a.shape), goal = lc(a.goal || "mass"), top = Math.max(1, Math.min(10, a.top || 3));
    if (!EXP[prop] || EXP[prop][shape] === undefined) return fail("property must be stiffness or strength and shape tie, beam or panel");
    let set = MAT22;
    if (Array.isArray(a.candidates) && a.candidates.length) { set = a.candidates.map(findMat).filter(Boolean); if (set.length < 2) return fail("I need at least two known materials"); }
    const ex = EXP[prop][shape], P = (m) => (prop === "stiffness" ? m.E : m.sigma);
    const idx = (m) => Math.pow(P(m), ex) / (m.rho * (goal === "cost" ? m.Cm : 1));
    const r = set.slice().sort((x, y) => idx(y) - idx(x)).slice(0, top);
    const label = `${goal === "cost" ? "cheapest" : "lightest"} ${prop === "stiffness" ? "stiff" : "strong"} ${shape}`;
    const formula = IDXTXT[prop][shape] + (goal === "cost" ? " per £ (÷Cm)" : "");
    return { text: `For the ${label}, maximise ${formula}. Best: ${r.map((m, i) => `${i + 1}. ${m.name}`).join(", ")}.`, data: { best: r[0].name, ranking: r.map((m) => m.name), index: formula } };
  }

  /* ---- Tool 2: value function (Chapter 1) ---- */
  function value_function(a) {
    const al = +a.alpha; if (!(al > 0)) return fail("alpha (GBP per kg saved) must be positive");
    const V = (m) => { const P1 = m.rho / Math.cbrt(m.E); return al * P1 + m.Cm * P1; };
    const r = PANEL6.slice().sort((x, y) => V(x) - V(y));
    return { text: `With α₁ = £${sig(al)}/kg, the stiff panel with the lowest value V = α₁P₁ + P₂ is ${r[0].name} (V = ${V(r[0]).toFixed(2)}), then ${r[1].name} (${V(r[1]).toFixed(2)}).`, data: { best: r[0].name, ranking: r.map((m) => m.name), V: r.map(V) } };
  }

  /* ---- Tool 3: eco-Ashby ranking (Chapter 1) ---- */
  function eco_rank(a) {
    const prop = lc(a.property || "stiffness");
    if (prop !== "stiffness" && prop !== "strength") return fail("property must be stiffness or strength");
    const I = (m) => (m.eco * m.rho) / (prop === "stiffness" ? Math.sqrt(m.E) : Math.pow(m.sy, 2 / 3));
    const r = ECO6.slice().sort((x, y) => I(x) - I(y));
    return { text: `Lowest eco-cost for a ${prop === "stiffness" ? "stiff" : "strong"} beam (${prop === "stiffness" ? "eco-cost·ρ/E^1/2" : "eco-cost·ρ/σy^2/3"}): 1. ${r[0].name} (${I(r[0]).toFixed(1)}), 2. ${r[1].name} (${I(r[1]).toFixed(1)}); worst is ${r[5].name} (${I(r[5]).toFixed(1)}).`, data: { best: r[0].name, ranking: r.map((m) => m.name) } };
  }

  /* ---- Tool 4: Ecolizer family eco-index (Chapter 3) ---- */
  function ecolizer_rank(a) {
    const shape = lc(a.shape || "beam"); const ex = { tie: 1, beam: 0.5, panel: 1 / 3 }[shape];
    if (ex === undefined) return fail("shape must be tie, beam or panel");
    const set = FAM.filter((f) => f.rho && (a.include_precious || !f.precious));
    const I = (f) => (f.med * f.rho) / Math.pow(f.E, ex);
    const r = set.slice().sort((x, y) => I(x) - I(y));
    return { text: `Per unit of stiffness for a ${shape}, the lowest production eco-index family is ${r[0].f}, then ${r[1].f} (${sig(I(r[1]) / I(r[0]), 2)}× higher) and ${r[2].f} (${sig(I(r[2]) / I(r[0]), 2)}×).`, data: { best: r[0].f, ranking: r.map((f) => f.f) } };
  }
  function ecolizer_family(a) {
    const n = lc(a.family); const f = FAM.find((x) => lc(x.f) === n) || FAM.find((x) => lc(x.f).includes(n) || n.includes(lc(x.f).split(" ")[0]));
    if (!f) return fail("unknown Ecolizer family");
    return { text: `${f.f}: ${f.n} entries, median production indicator ${sig(f.med)} mPt/kg, range ${sig(f.lo)}–${sig(f.hi)} mPt/kg.`, data: { best: f.f, median: f.med } };
  }

  /* ---- Tool 5: production route vs electricity (Chapter 3) ---- */
  function energy_compare(a) {
    const m = +a.mass_kg, r = Math.max(0, Math.min(100, +a.recycled_pct || 0)) / 100, k = +a.kwh || 0, g = String(a.grid || "GR").toUpperCase();
    if (!(m > 0) || !ENERGY[g]) return fail("need mass_kg > 0 and grid CH or GR");
    const prod = m * (r * ENERGY.sec + (1 - r) * ENERGY.prim), use = k * ENERGY[g];
    const dom = use > prod ? "use-phase electricity" : "production";
    return { text: `${sig(m)} kg of aluminium with ${Math.round(r * 100)}% recycled content: production ${Math.round(prod)} mPt; ${sig(k)} kWh on the ${g === "CH" ? "Swiss" : "Greek"} grid: ${Math.round(use)} mPt. Total ${Math.round(prod + use)} mPt, dominated by ${dom}.`, data: { best: dom, production: prod, use } };
  }

  /* ---- Tools 6–8: TOSM brackets (Chapter 4) ---- */
  const ALLOY = { ti: "Ti", titanium: "Ti", "ti-6al-4v": "Ti", al: "Al", aluminium: "Al", aluminum: "Al", "al-2024": "Al", ss: "SS", steel: "SS", "stainless steel": "SS", "aisi 304": "SS", becu: "BeCu", "beryllium copper": "BeCu", "becu c17000": "BeCu" };
  const MAT = TOSM ? Object.fromEntries(TOSM.materials.map((m) => [m.id, m])) : {};
  const RUNS = TOSM ? TOSM.brackets.flatMap((b) => ["Ti", "Al", "SS", "BeCu"].map((id) => ({ b: b.id, id, mass: b[id][0], vm: b[id][1], disp: b[id][2] }))) : [];
  const OUT = { co2: (r) => r.mass * (TOSM.useFactor + MAT[r.id].co2 / 1000), mass: (r) => r.mass, stress: (r) => r.vm, displacement: (r) => r.disp, water: (r) => r.mass * MAT[r.id].water, energy: (r) => r.mass * MAT[r.id].energy, cost: (r) => r.mass * MAT[r.id].cost };
  const UNIT = { co2: "t CO₂", mass: "kg", stress: "MPa", displacement: "mm", water: "L", energy: "MJ", cost: "$" };
  function tosm_admissible(a) {
    const sf = +a.sf || 1.25; if (sf < 1 || sf > 3) return fail("safety factor between 1 and 3");
    const ids = a.alloy ? [ALLOY[lc(a.alloy)]] : ["Ti", "Al", "SS", "BeCu"]; if (!ids[0]) return fail("unknown alloy");
    const c = ids.map((id) => [id, RUNS.filter((r) => r.id === id && r.vm <= MAT[id].yield / sf).length]);
    const tot = c.reduce((s, x) => s + x[1], 0);
    return { text: a.alloy ? `At SF = ${sf}, ${c[0][1]} of 379 brackets are admissible in ${MAT[c[0][0]].name}.` : `At SF = ${sf}, ${tot} of 1516 runs are admissible: ${c.map(([id, n]) => `${MAT[id].name} ${n}`).join(", ")}.`, data: { best: tot, counts: Object.fromEntries(c) } };
  }
  function tosm_best(a) {
    const sf = +a.sf || 1.25, obj = lc(a.objective || "co2"); if (!OUT[obj]) return fail("objective must be co2, mass, stress, displacement, water, energy or cost");
    const ids = a.alloy ? [ALLOY[lc(a.alloy)]] : ["Ti", "Al", "SS", "BeCu"]; if (!ids[0]) return fail("unknown alloy");
    const ok = RUNS.filter((r) => ids.includes(r.id) && r.vm <= MAT[r.id].yield / sf);
    if (!ok.length) return { text: `No bracket is admissible at SF = ${sf}${a.alloy ? " in " + MAT[ids[0]].name : ""}.`, data: { best: "none" } };
    const b = ok.reduce((x, y) => (OUT[obj](y) < OUT[obj](x) ? y : x));
    return { text: `Lowest ${obj} admissible bracket at SF = ${sf}: bracket ${b.b} in ${MAT[b.id].name}, ${sig(OUT[obj](b))} ${UNIT[obj]} (peak stress ${b.vm} MPa, mass ${b.mass.toFixed(3)} kg).`, data: { best: `${b.b}|${b.id}`, bracket: b.b, alloy: b.id } };
  }
  function alloy_compare(a) {
    const id = ALLOY[lc(a.alloy)], out = lc(a.output || "mass"); if (!id || id === "Ti") return fail("alloy must be aluminium, steel or beryllium copper");
    if (!OUT[out]) return fail("unknown output");
    const byB = {}; RUNS.forEach((r) => { (byB[r.b] = byB[r.b] || {})[r.id] = r; });
    const v = Object.values(byB).map((g) => OUT[out](g[id]) / OUT[out](g.Ti) - 1).sort((x, y) => x - y);
    const med = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
    return { text: `Making the same bracket in ${MAT[id].name} instead of Ti-6Al-4V changes its ${out} by ${pct(med)} (median over 379 brackets).`, data: { best: Math.round(med * 100), median: med } };
  }

  const TOOLS = {
    rank_materials: { fn: rank_materials, ch: 1, sig: "rank_materials(property: stiffness|strength, shape: tie|beam|panel, goal: mass|cost, candidates?: [names])" },
    value_function: { fn: value_function, ch: 1, sig: "value_function(alpha: GBP per kg saved)" },
    eco_rank: { fn: eco_rank, ch: 1, sig: "eco_rank(property: stiffness|strength)" },
    ecolizer_rank: { fn: ecolizer_rank, ch: 3, sig: "ecolizer_rank(shape: tie|beam|panel, include_precious?: bool)" },
    ecolizer_family: { fn: ecolizer_family, ch: 3, sig: "ecolizer_family(family)" },
    energy_compare: { fn: energy_compare, ch: 3, sig: "energy_compare(mass_kg, recycled_pct, kwh, grid: CH|GR)" },
    tosm_admissible: { fn: tosm_admissible, ch: 4, sig: "tosm_admissible(sf, alloy?)" },
    tosm_best: { fn: tosm_best, ch: 4, sig: "tosm_best(sf, objective: co2|mass|stress|displacement|water|energy|cost, alloy?)" },
    alloy_compare: { fn: alloy_compare, ch: 4, sig: "alloy_compare(alloy: aluminium|steel|beryllium copper, output: mass|co2|displacement|stress|water|energy|cost)" },
  };
  function call(obj) {
    if (obj && obj.tool === "none") return { text: "That question is outside what the book's data and tools cover.", data: { best: "none" } };
    if (!obj || !TOOLS[obj.tool]) return fail("unknown tool " + (obj && obj.tool));
    try { return TOOLS[obj.tool].fn(obj.args || {}); } catch (e) { return fail(String(e.message || e)); }
  }
  // Robust parsing of a model's tool call: the first {...} block that parses as JSON.
  function parseCall(text) {
    const s = String(text); let depth = 0, start = -1;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === "{") { if (!depth) start = i; depth++; }
      else if (s[i] === "}" && depth) { depth--; if (!depth) { try { return JSON.parse(s.slice(start, i + 1)); } catch (e) { start = -1; } } }
    }
    return null;
  }
  const SYSTEM_TOOLS = "You are MatEnv, a materials-selection assistant for the book Materials & the Environment. Reply with one JSON tool call and nothing else. Tools: " + Object.values(TOOLS).map((t) => t.sig).join("; ") + "; none() if the question is outside the book.";
  const SYSTEM_DIRECT = "You are MatEnv, a materials-selection assistant for the book Materials & the Environment. Answer in one or two sentences.";
  return { TOOLS, call, parseCall, SYSTEM_TOOLS, SYSTEM_DIRECT, MAT22, PANEL6, ECO6, FAM, ENERGY, MAT };
});
