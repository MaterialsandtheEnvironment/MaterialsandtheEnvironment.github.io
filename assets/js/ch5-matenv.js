/* Backup chapter A: tools playground, dataset browser, in-browser model (Transformers.js), benchmark. */
const TJS = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js";
const MODELS = {
  finetuned: { id: "MaterialsandtheEnvironment/matenv-smollm2-360m", label: "MatEnv fine-tuned (360M)" },
  base: { id: "HuggingFaceTB/SmolLM2-360M-Instruct", label: "SmolLM2-360M base" },
};
const { css, mount, showTip, hideTip, seg } = window.MATENV;
const TOOLS = window.MATENV_TOOLS, DATA = window.MATENV_DATA, RESULTS = window.MATENV_RESULTS || {};
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/* ---------- scoring (same rules as the training notebook) ---------- */
const norm = (o) => { if (!o || typeof o !== "object") return null; const a = Object.assign({}, o.args || {}); if (Array.isArray(a.candidates)) a.candidates = a.candidates.slice().sort(); return (o.tool || "") + "|" + JSON.stringify(Object.keys(a).sort().map((k) => [k, a[k]])); };
const keyOk = (tool, key, t) => { const l = String(t).toLowerCase(); if (tool === "none") return /outside|cannot|can't|not able|unable/.test(l); if (tool === "tosm_best") return String(t).includes(key.split("|")[0]); if (tool === "tosm_admissible" || tool === "alloy_compare") return String(t).includes(key.replace("-", "")); return l.includes(key.toLowerCase()); };

/* ---------- Figure A.2: tools ---------- */
const EXAMPLES = {
  rank_materials: { property: "stiffness", shape: "panel", goal: "mass" }, value_function: { alpha: 0.5 }, eco_rank: { property: "stiffness" },
  ecolizer_rank: { shape: "beam" }, ecolizer_family: { family: "Wood & panels" }, energy_compare: { mass_kg: 2, recycled_pct: 0, kwh: 50, grid: "GR" },
  tosm_admissible: { sf: 1.25 }, tosm_best: { sf: 1.25, objective: "co2" }, alloy_compare: { alloy: "aluminium", output: "displacement" },
};
const WHAT = {
  rank_materials: "Ranks the 22 materials (or a subset) by an Ashby index for a tie, beam or panel, minimising mass or cost.",
  value_function: "Ranks Ashby's six panel materials by V = α₁P₁ + P₂ for a given exchange constant.",
  eco_rank: "Ranks six materials by eco-cost per unit of stiffness or strength for a beam.",
  ecolizer_rank: "Ranks Ecolizer families by production eco-index per unit of stiffness.",
  ecolizer_family: "Returns the Ecolizer production statistics of one family.",
  energy_compare: "Compares aluminium production (primary vs recycled) with Swiss or Greek electricity use.",
  tosm_admissible: "Counts TOSM bracket runs below yield / safety factor, overall or for one alloy.",
  tosm_best: "Finds the admissible bracket and alloy that minimise CO₂, mass, stress or displacement.",
  alloy_compare: "Median change of an output when a titanium bracket is made in another alloy.",
};
$("tl-tool").innerHTML = Object.keys(TOOLS.TOOLS).map((k) => `<option value="${k}">${k}</option>`).join("");
$("tool-table").innerHTML = Object.entries(TOOLS.TOOLS).map(([k, t]) => `<tr><td><code>${k}</code></td><td class="n">${t.ch}</td><td>${WHAT[k]}</td></tr>`).join("");
function loadExample() { $("tl-args").value = JSON.stringify(EXAMPLES[$("tl-tool").value], null, 1); runTool(); }
function runTool() {
  let args; try { args = JSON.parse($("tl-args").value || "{}"); } catch (e) { $("tl-out").textContent = "The arguments are not valid JSON: " + e.message; return; }
  const r = TOOLS.call({ tool: $("tl-tool").value, args });
  $("tl-out").textContent = r.text;
}
$("tl-tool").addEventListener("change", loadExample); $("tl-run").addEventListener("click", runTool);
loadExample();

/* ---------- Figure A.3: dataset ---------- */
const TOOL_ORDER = Object.keys(DATA.counts.train).sort((a, b) => DATA.counts.train[b] - DATA.counts.train[a]);
mount("#data-chart", () => TOOL_ORDER.length * 26 + 44, (svg, w, h) => {
  const m = { t: 8, r: 46, b: 30, l: 118 };
  const x = d3.scaleLinear().domain([0, d3.max(TOOL_ORDER, (k) => DATA.counts.train[k])]).range([m.l, w - m.r]).nice();
  const y = d3.scaleBand().domain(TOOL_ORDER).range([m.t, h - m.b]).padding(0.25);
  svg.append("g").attr("class", "grid").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(5).tickSize(-(h - m.t - m.b)).tickFormat(""));
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(5));
  TOOL_ORDER.forEach((k) => {
    const tr = DATA.counts.train[k] || 0, te = DATA.counts.test[k] || 0, yy = y(k), bh = y.bandwidth();
    svg.append("rect").attr("x", m.l).attr("y", yy).attr("width", Math.max(1, x(tr) - m.l)).attr("height", bh * 0.62).attr("rx", 2).attr("fill", css("--s1"))
      .on("mousemove", (e) => showTip(e, `<b>${k}</b><br><span class="mono">train ${tr} · test ${te}</span>`)).on("mouseleave", hideTip);
    svg.append("rect").attr("x", m.l).attr("y", yy + bh * 0.66).attr("width", Math.max(1, x(te) - m.l)).attr("height", bh * 0.34).attr("rx", 2).attr("fill", css("--s2"));
    svg.append("text").attr("x", m.l - 8).attr("y", yy + bh / 2 + 4).attr("text-anchor", "end").style("font-family", "var(--f-mono)").style("font-size", "10.5px").style("fill", css("--ink")).text(k);
    svg.append("text").attr("x", x(tr) + 5).attr("y", yy + bh * 0.45).style("font-family", "var(--f-mono)").style("font-size", "9.5px").text(tr);
  });
  const lg = svg.append("g").attr("transform", `translate(${w - m.r - 120},${h - m.b - 34})`);
  [["train", css("--s1")], ["test (held-out templates)", css("--s2")]].forEach(([t, c], i) => { lg.append("rect").attr("y", i * 14).attr("width", 10).attr("height", 8).attr("fill", c); lg.append("text").attr("x", 14).attr("y", i * 14 + 8).style("font-size", "10px").text(t); });
}, { label: "Questions per tool" });
let dsSplit = "test", dsI = 0;
seg("#ds-split", [{ v: "test", label: "Test" }, { v: "train", label: "Train" }], dsSplit, (v) => { dsSplit = v; dsI = 0; showExample(); });
function showExample() {
  const arr = dsSplit === "test" ? DATA.test : DATA.trainSamples; const r = arr[dsI % arr.length];
  $("ds-example").innerHTML = `<span class="tag">Question</span><pre class="code">${esc(r.q)}</pre>
    <span class="tag">Target 1 · tool call</span><pre class="code">${esc(JSON.stringify(r.call))}</pre>
    <span class="tag">Target 2 · direct answer</span><pre class="code">${esc(r.answer)}</pre>`;
}
$("ds-next").addEventListener("click", () => { dsI = (dsI + 7) % 997; showExample(); });
showExample();

/* ---------- model loading ---------- */
let tf = null, gen = null, loaded = null, busy = false, device = "wasm", dtype = "q8";
const available = { base: true, finetuned: null };
async function detect() { try { const a = navigator.gpu && (await navigator.gpu.requestAdapter()); if (a) { device = "webgpu"; dtype = "q4f16"; } } catch (e) {} }
async function checkFinetuned() {
  try { const r = await fetch(`https://huggingface.co/api/models/${MODELS.finetuned.id}`); available.finetuned = r.ok; } catch (e) { available.finetuned = false; }
  fillModelSelects();
}
function fillModelSelects() {
  const opt = (k) => `<option value="${k}" ${k === "finetuned" && available.finetuned === false ? "disabled" : ""}>${MODELS[k].label}${k === "finetuned" && available.finetuned === false ? " (not published yet)" : ""}</option>`;
  for (const id of ["as-model", "bm-model"]) { const el = $(id), v = el.value; el.innerHTML = opt("finetuned") + opt("base"); el.value = v && !(v === "finetuned" && !available.finetuned) ? v : available.finetuned ? "finetuned" : "base"; }
}
async function ensure(key, statusEl, barEl) {
  if (gen && loaded === key) return;
  if (!tf) { statusEl.textContent = "Loading Transformers.js…"; tf = await import(TJS); }
  const files = {};
  const opts = { device, dtype, progress_callback: (p) => { if (p.status === "progress" && p.total) { files[p.file] = [p.loaded, p.total]; const lo = Object.values(files).reduce((a, f) => a + f[0], 0), to = Object.values(files).reduce((a, f) => a + f[1], 0); statusEl.textContent = `Downloading ${MODELS[key].label}: ${Math.round(lo / 1e6)} / ${Math.round(to / 1e6)} MB (first time only)`; if (barEl) barEl.style.width = Math.round((100 * lo) / to) + "%"; } } };
  gen = null; loaded = null;
  try { gen = await tf.pipeline("text-generation", MODELS[key].id, opts); }
  catch (e) {
    if (device !== "webgpu") throw e;
    statusEl.textContent = "WebGPU failed here; switching to the CPU build…"; device = "wasm"; dtype = "q8";
    gen = await tf.pipeline("text-generation", MODELS[key].id, Object.assign(opts, { device, dtype }));
  }
  loaded = key; if (barEl) barEl.style.width = "100%";
}
async function generate(question, mode) {
  const sys = mode === "tool" ? TOOLS.SYSTEM_TOOLS : TOOLS.SYSTEM_DIRECT;
  const text = gen.tokenizer.apply_chat_template([{ role: "system", content: sys }, { role: "user", content: question }], { tokenize: false, add_generation_prompt: true });
  const out = await gen(text, { max_new_tokens: mode === "tool" ? 96 : 72, do_sample: false, return_full_text: false });
  return String(out[0].generated_text).trim();
}

/* ---------- Figure A.4: ask ---------- */
let askMode = "tool", picked = null;
seg("#as-mode", [{ v: "tool", label: "With tools" }, { v: "direct", label: "Direct" }], askMode, (v) => { askMode = v; });
const chipQs = [0, 1, 4, 11, 20, 24].map((i) => DATA.test[i]).filter(Boolean);
$("as-chips").innerHTML = chipQs.map((r, i) => `<button class="chip" type="button" data-i="${i}">${esc(r.q)}</button>`).join("");
$("as-chips").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; picked = chipQs[+b.dataset.i]; $("as-q").value = picked.q; });
$("as-q").addEventListener("input", () => { picked = null; });
$("as-q").addEventListener("keydown", (e) => { if (e.key === "Enter") ask(); });
$("as-go").addEventListener("click", ask);
async function ask() {
  if (busy) return; const q = $("as-q").value.trim(); if (!q) return;
  const key = $("as-model").value; busy = true; $("as-go").disabled = true;
  try {
    await ensure(key, $("as-status"), $("as-bar"));
    $("as-status").textContent = "Thinking…"; const t0 = performance.now();
    const raw = await generate(q, askMode);
    $("as-raw").textContent = raw || "(empty)";
    let final, tag = "Answer";
    if (askMode === "tool") {
      const call = TOOLS.parseCall(raw);
      if (!call) { final = "The model did not produce a valid tool call."; tag = "Tool result"; }
      else { final = TOOLS.call(call).text; tag = `Tool result · ${call.tool}`; }
    } else final = raw;
    if (picked && picked.q === q) final += `\n\nExpected: ${picked.answer}`;
    $("as-final").textContent = final; $("as-final-tag").textContent = tag;
    $("as-status").textContent = `Done in ${((performance.now() - t0) / 1000).toFixed(1)} s on ${device === "webgpu" ? "your graphics card" : "your CPU"}.`;
  } catch (e) { console.error(e); $("as-status").innerHTML = `<span class="warn">Could not run the model: ${esc(String(e.message || e).slice(0, 200))}</span>`; }
  finally { busy = false; $("as-go").disabled = false; }
}

/* ---------- Figure A.5: results + benchmark ---------- */
function drawResults() {
  resChart.redraw();
  const ft = RESULTS.finetuned;
  $("res-note").innerHTML = ft
    ? `<p style="margin:0">On the 240 held-out questions, fine-tuning lifts tool-call accuracy from <b class="num">${Math.round(RESULTS.base.tool * 100)}%</b> to <b class="num">${Math.round(ft.tool * 100)}%</b>, and direct answers from <b class="num">${Math.round(RESULTS.base.direct * 100)}%</b> to <b class="num">${Math.round(ft.direct * 100)}%</b>.</p>`
    : `<p style="margin:0">The base model scores <b class="num">${Math.round(RESULTS.base.tool * 100)}%</b> in tool mode, because it never produces a usable JSON call, and <b class="num">${Math.round(RESULTS.base.direct * 100)}%</b> in direct mode. The fine-tuned model's bars appear here once it has been trained and published; you can also measure it yourself below.</p>`;
}
const resChart = mount("#res-chart", () => 200, (svg, w, h) => {
  const m = { t: 10, r: 14, b: 30, l: 130 };
  const groups = [["base", "Base model"], ["finetuned", "Fine-tuned"]];
  const y0 = d3.scaleBand().domain(groups.map((g) => g[0])).range([m.t, h - m.b]).padding(0.25);
  const y1 = d3.scaleBand().domain(["tool", "direct"]).range([0, y0.bandwidth()]).padding(0.12);
  const x = d3.scaleLinear().domain([0, 1]).range([m.l, w - m.r]);
  svg.append("g").attr("class", "grid").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(5).tickSize(-(h - m.t - m.b)).tickFormat(""));
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - m.b})`).call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(".0%")));
  groups.forEach(([k, label]) => {
    const r = RESULTS[k];
    svg.append("text").attr("x", m.l - 10).attr("y", y0(k) + y0.bandwidth() / 2 + 4).attr("text-anchor", "end").style("fill", css("--ink")).style("font-size", "11.5px").text(label);
    [["tool", "with tools", css("--s1")], ["direct", "direct", css("--s2")]].forEach(([mode, ml, c]) => {
      const yy = y0(k) + y1(mode);
      if (!r) { svg.append("text").attr("x", m.l + 6).attr("y", yy + y1.bandwidth() / 2 + 4).style("font-size", "10.5px").style("fill", css("--muted")).text(`${ml}: not trained yet`); return; }
      svg.append("rect").attr("x", m.l).attr("y", yy).attr("width", Math.max(2, x(r[mode]) - m.l)).attr("height", y1.bandwidth()).attr("rx", 3).attr("fill", c);
      svg.append("text").attr("x", Math.max(x(r[mode]), m.l + 2) + 6).attr("y", yy + y1.bandwidth() / 2 + 4).style("font-family", "var(--f-mono)").style("font-size", "10px").text(`${ml} ${Math.round(r[mode] * 100)}%`);
    });
  });
}, { label: "Held-out accuracy" });
drawResults();

let stop = false;
$("bm-stop").addEventListener("click", () => { stop = true; });
$("bm-go").addEventListener("click", async () => {
  if (busy) return; busy = true; stop = false; $("bm-go").disabled = true; $("bm-stop").hidden = false;
  const key = $("bm-model").value, n = +$("bm-n").value, items = DATA.test.slice(0, n);
  const per = {}; let tOk = 0, dOk = 0, done = 0; const t0 = performance.now();
  try {
    await ensure(key, $("bm-status"));
    for (const r of items) {
      if (stop) break;
      const tOut = await generate(r.q, "tool"), dOut = await generate(r.q, "direct");
      const a = norm(TOOLS.parseCall(tOut)) === norm(r.call), b = keyOk(r.tool, r.key, dOut);
      tOk += a; dOk += b; done++;
      const p = (per[r.tool] = per[r.tool] || { n: 0, t: 0, d: 0 }); p.n++; p.t += a; p.d += b;
      const eta = ((performance.now() - t0) / done) * (items.length - done) / 1000;
      $("bm-status").innerHTML = `${MODELS[key].label}: <b class="num">${done}/${items.length}</b> · tools <b class="num">${Math.round((100 * tOk) / done)}%</b> · direct <b class="num">${Math.round((100 * dOk) / done)}%</b> · about ${Math.ceil(eta)} s left`;
      $("bm-table").innerHTML = `<thead><tr><th>Tool</th><th class="n">Questions</th><th class="n">With tools</th><th class="n">Direct</th></tr></thead><tbody>${Object.entries(per).sort((x, y) => y[1].n - x[1].n).map(([k, v]) => `<tr><td><code>${k}</code></td><td class="n">${v.n}</td><td class="n">${Math.round((100 * v.t) / v.n)}%</td><td class="n">${Math.round((100 * v.d) / v.n)}%</td></tr>`).join("")}</tbody>`;
    }
    $("bm-status").innerHTML += stop ? " · stopped" : " · done";
  } catch (e) { console.error(e); $("bm-status").innerHTML = `<span class="warn">Could not run the model: ${esc(String(e.message || e).slice(0, 200))}</span>`; }
  finally { busy = false; $("bm-go").disabled = false; $("bm-stop").hidden = true; }
});

fillModelSelects();
detect().then(checkFinetuned);
window.addEventListener("themechange", drawResults);
