// Generate the MatEnv question set from the book's exact tools.
// usage: node training/make_dataset.cjs [n_train=2400] [n_test=240]
// Writes training/matenv_train.jsonl, training/matenv_test.jsonl (chat format for SFT) and data/matenv_test.js (for the in-page benchmark).
const fs = require("fs"), path = require("path");
const T = require("./load_kb.cjs")();
const N_TRAIN = +process.argv[2] || 2400, N_TEST = +process.argv[3] || 240;

let seed = 20261015; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const sample = (a, k) => { const c = a.slice(); for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return c.slice(0, k); };
const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => v[k]);

/* ---- natural names for slots ---- */
const MATNAMES = {
  "Natural rubber": ["natural rubber", "rubber"], "Polyurethane": ["polyurethane", "PU"], "Al/SiC composite": ["Al/SiC composite", "aluminium–SiC composite"],
  "CFRP epoxy": ["CFRP", "carbon-fibre composite", "carbon fibre epoxy"], "GFRP epoxy": ["GFRP", "glass-fibre composite"], "Flexible polymer foam": ["flexible foam", "flexible polymer foam"],
  "Rigid polymer foam": ["rigid foam", "rigid polymer foam"], "Al-alloys": ["aluminium alloys", "aluminium", "aluminum"], "Nickel": ["nickel"], "Stainless steel": ["stainless steel", "steel"],
  "Titanium alloys": ["titanium", "titanium alloys"], "Epoxies": ["epoxy", "epoxies"], "Phenolics": ["phenolics", "phenolic resin"], "Polyamides": ["nylon", "polyamides"],
  "Polycarbonate": ["polycarbonate", "PC"], "Hardwood oak": ["oak", "hardwood oak"], "Plywood": ["plywood"], "Softwood pine": ["pine", "softwood pine"],
  "Alumina": ["alumina"], "Silicon carbide": ["silicon carbide", "SiC"], "Silicon nitride": ["silicon nitride"], "Zirconia": ["zirconia"],
};
const SHAPES = { tie: ["tie", "tie rod", "rod in tension", "cable"], beam: ["beam", "shaft", "beam in bending"], panel: ["panel", "plate", "flat panel in bending"] };
const PROP = { stiffness: { adj: ["stiff", "rigid"], need: ["stiffness", "a deflection limit", "a stiffness requirement"] }, strength: { adj: ["strong"], need: ["strength", "a strength limit", "not yielding"] } };
const GOAL = { mass: ["lightest", "lowest-mass", "minimum-weight"], cost: ["cheapest", "lowest-cost", "most economical"] };
const ALLOYS = { aluminium: ["aluminium", "Al-2024", "aluminum"], steel: ["steel", "stainless steel", "AISI 304"], "beryllium copper": ["beryllium copper", "BeCu"] };
const OUTS = { mass: ["mass", "weight"], co2: ["lifetime CO2", "carbon footprint", "CO2"], displacement: ["displacement", "deflection"], stress: ["peak stress", "von Mises stress"], water: ["water use"], energy: ["production energy"], cost: ["material cost", "cost"] };
const FAMS = { "Ferrous metals": ["ferrous metals", "steels and irons"], "Non-ferrous metals": ["non-ferrous metals"], "Precious & critical metals": ["precious metals", "precious and critical metals"], "Thermoplastics": ["thermoplastics"], "Composites & thermosets": ["composites", "thermosets"], "Elastomers": ["elastomers"], "Wood & panels": ["wood", "wood and panels"], "Paper & board": ["paper", "cardboard", "paper and board"], "Glass & ceramics": ["glass", "ceramics"], "Minerals & cement": ["cement", "minerals", "concrete and minerals"], "Insulation": ["insulation materials"], "Recycled plastics": ["recycled plastics"], "Bio-based plastics": ["bio-based plastics", "bioplastics"], "Chemicals & glues": ["glues", "chemicals"] };

/* ---- templates: [text, makeArgs] per tool. The last ~25% of each list is held out for the test set. ---- */
const G = {
  rank_materials: {
    t: [
      "Which material makes the {goal} {padj} {shape}?",
      "What is the best material for the {goal} {shape} designed for {pneed}?",
      "I need a {padj} {shape} that is as {goalAdj} as possible. Which material should I use?",
      "Rank the materials for the {goal} {padj} {shape}.",
      "Give me the top materials for a {shape} limited by {pneed}, minimising {goalNoun}.",
      "For a {shape} sized by {pneed}, which material minimises {goalNoun}?",
      "Among {cands}, which is best for the {goal} {padj} {shape}?",
      "Compare {cands} for a {padj} {shape} with minimum {goalNoun}.",
      "Choose between {cands} for the {goal} {padj} {shape}.",
      "Which is better for a {padj} {shape} if {goalNoun} matters most: {cands}?",
      "Ashby chart question: {goal} {padj} {shape}, which material wins?",
      "Out of {cands}, what would you pick for a {shape} that must be {padj} and {goalAdj}?",
    ],
    gen: (ti) => {
      const prop = pick(["stiffness", "strength"]), shape = pick(Object.keys(SHAPES)), goal = rnd() < 0.7 ? "mass" : "cost";
      const withC = /\{cands\}/.test(G.rank_materials.t[ti]);
      const cands = withC ? sample(Object.keys(MATNAMES), 2 + Math.floor(rnd() * 3)) : null;
      const v = { padj: pick(PROP[prop].adj), pneed: pick(PROP[prop].need), shape: pick(SHAPES[shape]), goal: pick(GOAL[goal]), goalAdj: goal === "mass" ? pick(["light", "lightweight"]) : pick(["cheap", "inexpensive"]), goalNoun: goal === "mass" ? pick(["mass", "weight"]) : pick(["cost", "material cost"]),
        cands: cands ? listText(cands.map((c) => pick(MATNAMES[c]))) : "" };
      const args = { property: prop, shape, goal }; if (cands) args.candidates = cands;
      return { v, args };
    },
  },
  value_function: {
    t: ["Using the value function with an exchange constant of £{a}/kg, which panel material wins?",
      "If saving a kilogram is worth £{a}, what is the best stiff panel material?",
      "Exchange constant α1 = {a} £/kg: rank the panel materials by value.",
      "For a {sector} where mass is worth £{a} per kg, which material gives the lowest V?",
      "Which of Ashby's six panel materials is best at £{a} per kilogram saved?",
      "What material minimises V = α1 P1 + P2 when α1 is {a} £/kg?"],
    gen: () => { const a = pick([0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 150, 200, 300, 500, 1000]); return { v: { a, sector: a < 5 ? pick(["family car", "consumer product"]) : a < 400 ? pick(["civil aircraft", "airliner"]) : pick(["satellite", "space vehicle"]) }, args: { alpha: a } }; },
  },
  eco_rank: {
    t: ["Which material has the lowest eco-cost for a {padj} beam?", "Rank the eco-materials for a beam limited by {pneed}.",
      "Using eco-costs, what is the greenest choice for a {padj} beam?", "On the eco-Ashby chart, which material wins for a {padj} beam?",
      "Lowest eco-cost per unit of {pnoun} for a beam?", "Which is the most eco-efficient material for a {padj} beam: wood, concrete, steel, aluminium, PET or GFRP?"],
    gen: () => { const p = pick(["stiffness", "strength"]); return { v: { padj: pick(PROP[p].adj), pneed: pick(PROP[p].need), pnoun: p }, args: { property: p } }; },
  },
  ecolizer_rank: {
    t: ["Which Ecolizer material family has the lowest eco-indicator per unit of stiffness for a {shape}?",
      "Per unit of stiffness, which family is greenest for a {shape} according to the Ecolizer?",
      "Rank Ecolizer families for a stiff {shape}.", "Using Ecolizer eco-indicators, what family should a {shape} be made of to minimise impact?",
      "Lowest production impact for a stiff {shape}, by family?"],
    gen: () => { const s = pick(Object.keys(SHAPES)); return { v: { shape: pick(SHAPES[s]) }, args: { shape: s } }; },
  },
  ecolizer_family: {
    t: ["What is the production eco-indicator of {fam} in the Ecolizer?", "How much impact do {fam} have per kilogram?",
      "Give the Ecolizer statistics for {fam}.", "What is the median mPt/kg for {fam}?", "How large is the production impact of {fam}?"],
    gen: () => { const f = pick(Object.keys(FAMS)); return { v: { fam: pick(FAMS[f]) }, args: { family: f } }; },
  },
  energy_compare: {
    t: ["A {m} kg aluminium part with {r}% recycled content uses {k} kWh on the {g} grid over its life. Which dominates, production or use?",
      "Compare production and electricity impact: {m} kg aluminium, {r}% recycled, {k} kWh, {g} electricity.",
      "What is the total eco-indicator for {m} kg of aluminium ({r}% recycled) plus {k} kWh of {g} electricity?",
      "Is production or use-phase electricity bigger for a {m} kg aluminium product using {k} kWh in {gc}, with {r}% recycled aluminium?"],
    gen: () => { const g = pick(["CH", "GR"]); return { v: { m: pick([0.5, 1, 2, 3, 5, 10]), r: pick([0, 25, 50, 75, 100]), k: pick([0, 10, 20, 50, 100, 200, 500]), g: g === "CH" ? pick(["Swiss", "CH"]) : pick(["Greek", "GR"]), gc: g === "CH" ? "Switzerland" : "Greece" }, args: null, post: (v) => ({ mass_kg: v.m, recycled_pct: v.r, kwh: v.k, grid: g }) }; },
  },
  tosm_admissible: {
    t: ["How many TOSM brackets pass at a safety factor of {sf}?", "At SF = {sf}, how many bracket runs are admissible?",
      "How many brackets are admissible in {alloy} at a safety factor of {sf}?", "Count the jet-engine brackets that do not yield in {alloy} with SF {sf}.",
      "With a safety factor of {sf}, how many of the 1516 runs satisfy the stress constraint?", "Does any {alloy} bracket pass at SF {sf}? How many?"],
    gen: (ti) => { const sf = pick([1, 1.1, 1.25, 1.5, 2]); const withA = /\{alloy\}/.test(G.tosm_admissible.t[ti]); const al = withA ? pick(["titanium", "aluminium", "steel", "beryllium copper"]) : null;
      const args = { sf }; if (al) args.alloy = al; return { v: { sf, alloy: al ? pick(ALLOYS[al] || ["titanium", "Ti-6Al-4V"]) : "" }, args }; },
  },
  tosm_best: {
    t: ["Which admissible bracket has the lowest {obj} at a safety factor of {sf}?", "Best bracket for minimum {obj} with SF = {sf}?",
      "Find the {objAdj} bracket that passes the stress check at SF {sf}.", "Which bracket and alloy minimise {obj} while staying below yield divided by {sf}?",
      "In the TOSM benchmark, what is the lowest-{obj} admissible design at SF {sf}?"],
    gen: () => { const obj = pick(["co2", "mass", "stress", "displacement", "co2", "mass"]); const sf = pick([1, 1.1, 1.25, 1.5]);
      return { v: { obj: pick(OUTS[obj]), objAdj: { co2: "lowest-carbon", mass: "lightest", stress: "least stressed", displacement: "stiffest" }[obj], sf }, args: { sf, objective: obj } }; },
  },
  alloy_compare: {
    t: ["How does the {out} of a bracket change if it is made in {alloy} instead of titanium?", "{alloy} vs titanium: what happens to {out}?",
      "By how much does switching from Ti-6Al-4V to {alloy} change the {out}?", "Median change in {out} when a TOSM bracket is made in {alloy}?",
      "If I swap titanium for {alloy}, what is the effect on {out}?"],
    gen: () => { const al = pick(Object.keys(ALLOYS)), out = pick(Object.keys(OUTS)); return { v: { alloy: pick(ALLOYS[al]), out: pick(OUTS[out]) }, args: { alloy: al, output: out } }; },
  },
  none: {
    t: ["What is the capital of France?", "Write me a poem about steel.", "Who won the 2018 World Cup?", "How do I bake bread?",
      "What is the melting point of chocolate?", "Translate 'hello' into Spanish.", "What time is it in Tokyo?", "Recommend a good laptop."],
    gen: () => ({ v: {}, args: {} }),
  },
};
function listText(a) { return a.length === 2 ? `${a[0]} or ${a[1]}` : a.slice(0, -1).join(", ") + " or " + a[a.length - 1]; }

const WEIGHT = { rank_materials: 0.3, value_function: 0.08, eco_rank: 0.06, ecolizer_rank: 0.07, ecolizer_family: 0.08, energy_compare: 0.09, tosm_admissible: 0.1, tosm_best: 0.1, alloy_compare: 0.1, none: 0.02 };
function make(split, n) {
  const rows = [], seen = new Set();
  const tools = Object.keys(G);
  let guard = 0;
  while (rows.length < n && guard++ < n * 50) {
    let r = rnd(), tool = tools[0]; for (const k of tools) { r -= WEIGHT[k]; if (r <= 0) { tool = k; break; } }
    const t = G[tool].t, cut = Math.max(1, Math.round(t.length * 0.75));
    const ti = split === "train" ? Math.floor(rnd() * cut) : cut + Math.floor(rnd() * (t.length - cut)); // held-out templates for test
    const g = G[tool].gen(ti);
    const args = g.post ? g.post(g.v) : g.args;
    const q = fill(t[ti], g.v).replace(/\s+/g, " ").trim();
    if (seen.has(q)) continue; seen.add(q);
    const call = { tool, args };
    const res = T.call(call);
    if (res.error) continue;
    rows.push({ split, tool, template: ti, question: q[0].toUpperCase() + q.slice(1), call, answer: res.text, key: String(res.data && res.data.best) });
  }
  return rows;
}
const train = make("train", N_TRAIN), test = make("test", N_TEST);
const trainQ = new Set(train.map((r) => r.question)); const testClean = test.filter((r) => !trainQ.has(r.question));

const out = path.join(__dirname);
const chat = (r, mode) => JSON.stringify({ messages: [
  { role: "system", content: mode === "tool" ? T.SYSTEM_TOOLS : T.SYSTEM_DIRECT },
  { role: "user", content: r.question },
  { role: "assistant", content: mode === "tool" ? JSON.stringify(r.call) : r.answer }] });
fs.writeFileSync(path.join(out, "matenv_train.jsonl"), train.flatMap((r) => [chat(r, "tool"), chat(r, "direct")]).join("\n") + "\n");
fs.writeFileSync(path.join(out, "matenv_test.jsonl"), testClean.flatMap((r) => [chat(r, "tool"), chat(r, "direct")]).join("\n") + "\n");
fs.writeFileSync(path.join(out, "matenv_questions.jsonl"), train.concat(testClean).map((r) => JSON.stringify(r)).join("\n") + "\n");
const slim = (r) => ({ q: r.question, tool: r.tool, call: r.call, answer: r.answer, key: r.key });
const tally = (rs) => rs.reduce((a, r) => ((a[r.tool] = (a[r.tool] || 0) + 1), a), {});
let s2 = 7; const pick2 = (a) => a[(s2 = (s2 * 48271) % 2147483647) % a.length];
const trainSamples = []; const seenT = new Set(); while (trainSamples.length < 40) { const r = pick2(train); if (!seenT.has(r.question)) { seenT.add(r.question); trainSamples.push(slim(r)); } }
fs.writeFileSync(path.join(out, "..", "data", "matenv_dataset.js"), "window.MATENV_DATA = " + JSON.stringify({ counts: { train: tally(train), test: tally(testClean) }, nTrain: train.length, nTest: testClean.length, trainSamples, test: testClean.map(slim) }) + ";\n");
const count = (rs) => Object.entries(rs.reduce((a, r) => ((a[r.tool] = (a[r.tool] || 0) + 1), a), {})).map((x) => x.join(":")).join(" ");
console.log("train", train.length, count(train)); console.log("test", testClean.length, count(testClean));
console.log(train.slice(0, 3).map((r) => r.question + " -> " + JSON.stringify(r.call) + " | " + r.answer).join("\n"));
