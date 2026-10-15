/* Chapter 5, Figure 5.8: ask a small open model running in the reader's browser (Transformers.js).
   Nothing is downloaded until the reader clicks. Weights come from the Hugging Face Hub and are cached by the browser. */
const TJS = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js";
const MODELS = {
  smol: { id: "HuggingFaceTB/SmolLM2-360M-Instruct", label: "SmolLM2 360M", mb: { webgpu: 273, wasm: 365 } },
  // The 4-bit WebGPU build of Qwen2.5 0.5B returned garbled text in testing, so it always runs the 8-bit CPU build.
  qwen: { id: "onnx-community/Qwen2.5-0.5B-Instruct", label: "Qwen2.5 0.5B", mb: { webgpu: 512, wasm: 512 }, cpuOnly: true },
};
const $ = (id) => document.getElementById(id);
const H = () => window.CH5;
const { css, mount, showTip, hideTip } = window.MATENV;

let hasWebGPU = false, device = "wasm", dtype = "q8";
async function detectDevice() {
  try { const a = navigator.gpu && (await navigator.gpu.requestAdapter()); hasWebGPU = !!a; } catch (e) { hasWebGPU = false; }
  device = hasWebGPU ? "webgpu" : "wasm"; dtype = hasWebGPU ? "q4f16" : "q8";
}
let tf = null, gen = null, loadedKey = null, runDevice = null, busy = false, stopFlag = false;
let last = null; // { d, c, scores[9], raw[9], model }
let survey = null; // { scores[144], model }

function status(html) { $("ll-status").innerHTML = html; }
function setBusy(b) { busy = b; ["ll-ask", "ll-all", "ll-model", "ll-d", "ll-c"].forEach((k) => ($(k).disabled = b)); $("ll-stop").hidden = !b; }

function buildPrompt(design, criterion, material) {
  return [
    { role: "system", content: "You are a material science and design engineer expert." },
    { role: "user", content: `You are tasked with designing a ${design}. The design should be ${criterion}.\nHow well do you think ${material} would perform in this application? Answer on a scale of 0-10, where 0 is 'unsatisfactory', 5 is 'acceptable', and 10 is 'excellent', with just the number and no other words.` },
  ];
}
function parseScore(text) {
  const m = String(text).match(/\d+(\.\d+)?/);
  if (!m) return null;
  return Math.max(0, Math.min(10, Math.round(parseFloat(m[0]))));
}

async function ensureModel() {
  const key = $("ll-model").value, spec = MODELS[key];
  if (gen && loadedKey === key) return;
  if (!tf) { status("Loading the Transformers.js library…"); tf = await import(TJS); }
  const files = {};
  status(`Downloading <b>${spec.label}</b> (about ${spec.mb[device]} MB, only the first time)…`);
  const dev = spec.cpuOnly ? "wasm" : device, dt = spec.cpuOnly ? "q8" : dtype;
  gen = null; loadedKey = null;
  const opts = {
    device: dev, dtype: dt,
    progress_callback: (p) => {
      if (p.status === "progress" && p.total) {
        files[p.file] = [p.loaded, p.total];
        const lo = Object.values(files).reduce((a, f) => a + f[0], 0), to = Object.values(files).reduce((a, f) => a + f[1], 0);
        status(`Downloading <b>${spec.label}</b>: <span class="num">${Math.round(lo / 1e6)} / ${Math.round(to / 1e6)} MB</span>`);
        $("ll-bar").style.width = Math.round((100 * lo) / to) + "%";
      }
    },
  };
  try { gen = await tf.pipeline("text-generation", spec.id, opts); }
  catch (e) {
    if (dev !== "webgpu") throw e;
    console.warn("WebGPU failed, falling back to WebAssembly", e);
    device = "wasm"; dtype = "q8"; hasWebGPU = false;
    status("WebGPU did not work here; switching to the CPU version…");
    gen = await tf.pipeline("text-generation", spec.id, Object.assign(opts, { device, dtype }));
  }
  loadedKey = key; runDevice = opts.device;
  $("ll-bar").style.width = "100%";
}

// The paper's prompt, sent through the model's own chat template. Small models tend to answer in sentences,
// so the assistant turn is started with "Score (0-10): " and only three tokens are generated.
async function askOne(design, criterion, material) {
  const text = gen.tokenizer.apply_chat_template(buildPrompt(design, criterion, material), { tokenize: false, add_generation_prompt: true }) + "Score (0-10): ";
  const out = await gen(text, { max_new_tokens: 3, do_sample: false, return_full_text: false });
  const t = String(out[0].generated_text);
  return { text: t, score: parseScore(t) };
}

async function runScenario() {
  if (busy) return;
  const h = H(); const d = +$("ll-d").value, c = +$("ll-c").value;
  setBusy(true); stopFlag = false;
  try {
    await ensureModel();
    const scores = [], raw = [];
    for (let k = 0; k < 9; k++) {
      if (stopFlag) break;
      status(`Asking about <b>${h.M[k]}</b> (${k + 1}/9)…`);
      const r = await askOne(h.D[d], h.C[c], h.M[k]);
      scores.push(r.score); raw.push(r.text);
      last = { d, c, scores: scores.slice(), raw: raw.slice(), model: MODELS[loadedKey].label };
      chart.redraw(); readout();
    }
    status(stopFlag ? "Stopped." : `Done. ${MODELS[loadedKey].label} on ${runDevice === "webgpu" ? "your graphics card (WebGPU)" : "your CPU (WebAssembly)"}.`);
  } catch (e) {
    console.error(e);
    status(`<span class="warn">Could not run the model: ${String(e.message || e).slice(0, 200)}</span>`);
  } finally { setBusy(false); }
}

async function runSurvey() {
  if (busy) return;
  const h = H();
  setBusy(true); stopFlag = false;
  try {
    await ensureModel();
    const scores = new Array(144).fill(null); const t0 = performance.now();
    for (let i = 0; i < 144 && !stopFlag; i++) {
      const d = Math.floor(i / 36), c = Math.floor(i / 9) % 4, k = i % 9;
      const r = await askOne(h.D[d], h.C[c], h.M[k]);
      scores[i] = r.score;
      if (i % 3 === 2 || i === 143) {
        const el = (performance.now() - t0) / 1000, eta = (el / (i + 1)) * (143 - i);
        status(`Full survey: <span class="num">${i + 1}/144</span> questions · about ${Math.ceil(eta)} s left`);
        survey = { scores: scores.slice(), model: MODELS[loadedKey].label, done: i + 1 };
        readout();
      }
    }
    status(stopFlag ? "Stopped. Partial results are shown." : `Full survey done with ${MODELS[loadedKey].label}.`);
  } catch (e) {
    console.error(e);
    status(`<span class="warn">Could not run the model: ${String(e.message || e).slice(0, 200)}</span>`);
  } finally { setBusy(false); }
}

function readout() {
  const h = H(); let html = "";
  if (last) {
    const ok = last.scores.map((v, k) => ({ v, cell: h.idx(last.d, last.c, k) })).filter((r) => r.v !== null);
    const z = ok.length ? ok.reduce((a, r) => a + h.zsc(r.cell, r.v), 0) / ok.length : NaN;
    const e = ok.length ? ok.reduce((a, r) => a + h.mae(r.cell, r.v), 0) / ok.length : NaN;
    let gpt = 0, gptE = 0; for (let k = 0; k < 9; k++) { const cell = h.idx(last.d, last.c, k), v = h.ans("GPT-4", "zero-shot")[cell]; gpt += h.zsc(cell, v); gptE += h.mae(cell, v); }
    const bad = last.scores.filter((v) => v === null).length;
    html += `<div style="margin-bottom:6px"><b>${h.cap(h.D[last.d])}</b>, ${h.C[last.c]}</div>
      <div class="table-wrap" style="margin:0"><table><thead><tr><th>Model</th><th class="n">mean z</th><th class="n">MAE</th></tr></thead><tbody>
      <tr class="win"><td>${last.model} (yours)</td><td class="n">${isNaN(z) ? "–" : (z >= 0 ? "+" : "") + z.toFixed(2)}</td><td class="n">${isNaN(e) ? "–" : e.toFixed(2)}</td></tr>
      <tr><td>GPT-4, zero-shot (paper)</td><td class="n">${(gpt / 9 >= 0 ? "+" : "") + (gpt / 9).toFixed(2)}</td><td class="n">${(gptE / 9).toFixed(2)}</td></tr></tbody></table></div>
      ${bad ? `<div class="warn" style="margin-top:6px">${bad} answer(s) contained no number and were skipped.</div>` : ""}`;
  }
  if (survey) {
    const ok = survey.scores.map((v, i) => ({ v, i })).filter((r) => r.v !== null);
    const z = ok.reduce((a, r) => a + h.zsc(r.i, r.v), 0) / Math.max(1, ok.length), e = ok.reduce((a, r) => a + h.mae(r.i, r.v), 0) / Math.max(1, ok.length);
    const ref = h.MODELS.map((m) => { const r = h.metrics(m, "zero-shot"); return `<tr><td>${m} (paper)</td><td class="n">${r.z >= 0 ? "+" : ""}${r.z.toFixed(3)}</td><td class="n">${r.mae.toFixed(3)}</td></tr>`; }).join("");
    html += `<div style="margin:14px 0 6px"><b>Full survey</b>, zero-shot, ${survey.done}/144 questions</div>
      <div class="table-wrap" style="margin:0"><table><thead><tr><th>Model</th><th class="n">mean z</th><th class="n">MAE</th></tr></thead><tbody>
      <tr class="win"><td>${survey.model} (yours)</td><td class="n">${(z >= 0 ? "+" : "") + z.toFixed(3)}</td><td class="n">${e.toFixed(3)}</td></tr>${ref}</tbody></table></div>`;
  }
  $("ll-readout").innerHTML = html || `<p style="margin:0">Pick a scenario and press <b>Ask</b>. The first run downloads the model; later runs start at once.</p>
    <p>Device detected: <b>${hasWebGPU ? "WebGPU available, the model runs on your graphics card" : "no WebGPU, the model runs on your CPU (slower)"}</b>.</p>`;
}

/* ---------- UI ---------- */
function init() {
  const h = H(); if (!h) return;
  $("ll-model").innerHTML = Object.entries(MODELS).map(([k, m]) => `<option value="${k}">${m.label} · ~${m.mb[device]} MB${m.cpuOnly || device === "wasm" ? " · CPU" : " · GPU"}</option>`).join("");
  $("ll-d").innerHTML = h.D.map((v, i) => `<option value="${i}">${h.cap(v)}</option>`).join("");
  $("ll-c").innerHTML = h.C.map((v, i) => `<option value="${i}">${h.cap(v)}</option>`).join("");
  $("ll-d").value = 3; $("ll-c").value = 0;
  $("ll-ask").addEventListener("click", runScenario);
  $("ll-all").addEventListener("click", runSurvey);
  $("ll-stop").addEventListener("click", () => { stopFlag = true; });
  ["ll-d", "ll-c"].forEach((k) => $(k).addEventListener("change", () => chart.redraw()));
  readout();
}

const chart = mount("#ll-chart", (w) => (w < 520 ? 360 : 330), (svg, w, hgt) => {
  const h = H(); if (!h) return;
  const d = last ? last.d : +$("ll-d").value, c = last ? last.c : +$("ll-c").value;
  const m = { t: 8, r: 16, b: 34, l: 100 };
  const x = d3.scaleLinear().domain([0, 10]).range([m.l, w - m.r]);
  const y = d3.scaleBand().domain(d3.range(9)).range([m.t, hgt - m.b]).padding(0.2);
  svg.append("g").attr("class", "grid").attr("transform", `translate(0,${hgt - m.b})`).call(d3.axisBottom(x).ticks(10).tickSize(-(hgt - m.t - m.b)).tickFormat(""));
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${hgt - m.b})`).call(d3.axisBottom(x).ticks(10));
  svg.append("text").attr("class", "axis-label").attr("x", w - m.r).attr("y", hgt - 4).attr("text-anchor", "end").text("Score (0–10)");
  for (let k = 0; k < 9; k++) {
    const cell = h.idx(d, c, k), s = h.STAT[cell], yc = y(k) + y.bandwidth() / 2;
    svg.append("text").attr("x", m.l - 10).attr("y", yc + 4).attr("text-anchor", "end").style("fill", css("--ink")).style("font-size", "11.5px").text(h.cap(h.M[k]));
    svg.append("line").attr("x1", x(s.min)).attr("x2", x(s.max)).attr("y1", yc).attr("y2", yc).attr("stroke", css("--muted"));
    svg.append("rect").attr("x", x(s.q1)).attr("width", Math.max(2, x(s.q3) - x(s.q1))).attr("y", yc - y.bandwidth() * 0.32).attr("height", y.bandwidth() * 0.64).attr("rx", 3).attr("fill", css("--rule"));
    svg.append("line").attr("x1", x(s.med)).attr("x2", x(s.med)).attr("y1", yc - y.bandwidth() * 0.36).attr("y2", yc + y.bandwidth() * 0.36).attr("stroke", css("--ink")).attr("stroke-width", 2.5);
    const g4 = h.ans("GPT-4", "zero-shot")[cell];
    svg.append("path").attr("transform", `translate(${x(g4)},${yc - 5})`).attr("d", h.symPath("GPT-4", 55)).attr("fill", h.mcol("GPT-4")).attr("fill-opacity", 0.55);
    if (last && last.scores[k] !== undefined && last.scores[k] !== null) {
      svg.append("path").attr("transform", `translate(${x(last.scores[k])},${yc + 5})`).attr("d", d3.symbol().type(d3.symbolStar).size(130)()).attr("fill", css("--hi")).attr("stroke", css("--paper"))
        .on("mousemove", (e) => showTip(e, `<b>${h.cap(h.M[k])}</b><br>Raw answer: <span class="mono">${String(last.raw[k]).replace(/</g, "&lt;").slice(0, 60)}</span><br>Expert median ${s.med}`)).on("mouseleave", hideTip);
    }
  }
}, { label: "Small in-browser model compared with experts" });

detectDevice().then(init);
window.addEventListener("themechange", readout);
