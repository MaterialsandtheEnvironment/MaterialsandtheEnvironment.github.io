/* Virtual Prof: retrieval over Chapters 1-6 (BM25, in the browser) + an optional small LLM (Transformers.js)
   that writes an answer grounded on the retrieved passages. Used by the floating widget on every page
   (prof-widget.js) and by the full page (book/backup-a-virtual-prof.html). */
const TJS = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js";
const ROOT = new URL("../../", import.meta.url);
export const ORG = "MaterialsandtheEnvironment";
/* Each model is looked up first in the MaterialsandtheEnvironment Hugging Face organisation (published with
   tools/publish_virtual_prof.py); if it is not there yet, the public ONNX build it was copied from is used. */
export const MODELS = {
  fast: { id: `${ORG}/virtual-prof-qwen3-0.6b`, fallback: "onnx-community/Qwen3-0.6B-ONNX", label: "Fast · Qwen3 0.6B", size: "≈ 0.6 GB" },
  better: { id: `${ORG}/virtual-prof-qwen3-1.7b`, fallback: "onnx-community/Qwen3-1.7B-ONNX", label: "Better · Qwen3 1.7B (desktop GPU)", size: "≈ 1.4 GB" },
};
const CH_SLUG = { 1: "ch1-ashby-maps", 2: "ch2-latent-maps", 3: "ch3-ecolizer", 4: "ch4-tosm", 5: "ch5-natural-fibres", 6: "ch6-eco-audit" };
export const url = (rel) => new URL(rel, ROOT).href;

/* ---------------- knowledge base ---------------- */
let INDEX = null;
export function loadIndex() {
  if (INDEX) return Promise.resolve(INDEX);
  if (window.PROF_INDEX) return Promise.resolve((INDEX = build(window.PROF_INDEX)));
  return new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = url("data/prof_index.js");
    s.onload = () => res((INDEX = build(window.PROF_INDEX))); s.onerror = rej; document.head.appendChild(s);
  });
}

const STOP = new Set("a an the of to in on for and or is are was were be been it its this that these those with as by at from what which who whom how why when where can could should would do does did i you we they he she my your our their me us them about into than then there here not no yes if so but also any all more most less least very just only per vs versus between why give tell explain show please".split(" "));
const SYN = {
  co2: ["carbon", "emission", "footprint"], carbon: ["co2"], emission: ["co2"], footprint: ["co2", "eco"],
  stiff: ["modulus", "stiffness"], stiffness: ["modulus", "stiff"], modulus: ["stiffness", "young"], rigid: ["stiffness", "modulus"],
  strong: ["strength"], strength: ["strong", "yield"], light: ["mass", "density", "lightweight"], lightweight: ["mass", "light"], weight: ["mass"],
  heavy: ["density", "mass"], density: ["mass"], cheap: ["cost", "price"], cost: ["price", "cheap"], price: ["cost"],
  energy: ["embodied"], embodied: ["energy"], green: ["eco", "environment"], eco: ["environment", "ecological"], environment: ["eco"], environmental: ["eco"],
  lca: ["life", "cycle", "audit"], audit: ["eco", "phase"], recycle: ["recycled", "recycling"], recycled: ["recycle", "recycling"], recycling: ["recycle", "recycled"],
  wood: ["timber", "softwood", "hardwood", "plywood"], timber: ["wood"], natural: ["plant", "bio"], plant: ["natural", "fibre"], fiber: ["fibre"], fibers: ["fibre"],
  vae: ["autoencoder", "latent"], autoencoder: ["vae"], latent: ["vae"], bracket: ["tosm"], topology: ["optimisation", "tosm"], optimization: ["optimisation"],
  aluminum: ["aluminium"], titanium: ["ti"], chart: ["ashby", "map"], map: ["chart", "ashby"], panel: ["plate"], plate: ["panel"], beam: ["bending"],
  ecolizer: ["indicator", "index"], fatigue: ["cycles", "endurance"], glass: ["gfrp"], flax: ["bast"], hemp: ["bast"], jute: ["bast"],
};
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function stem(w) {
  if (w.length <= 4) return w;
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.endsWith("isation") || w.endsWith("ization")) return w.slice(0, -7) + "is";
  for (const suf of ["ings", "ing", "edly", "ed", "ers", "er", "es", "s", "ly"]) if (w.endsWith(suf) && w.length - suf.length >= 4) return w.slice(0, -suf.length);
  return w;
}
export function tokens(s) {
  return norm(s).replace(/fibre/g, "fiber").replace(/fiber/g, "fibre").split(/[^a-z0-9.]+/).map((w) => w.replace(/^\.+|\.+$/g, "")).filter((w) => w && !STOP.has(w)).map(stem);
}
function build(raw) {
  const docs = raw.docs.map((d) => {
    const head = `${d.chTitle} ${d.secTitle}`;
    const toks = tokens(d.text + " " + head + " " + head);
    const tf = new Map(); toks.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));
    return { ...d, len: toks.length, tf };
  });
  const df = new Map(); docs.forEach((d) => d.tf.forEach((_, t) => df.set(t, (df.get(t) || 0) + 1)));
  const avg = docs.reduce((a, d) => a + d.len, 0) / docs.length;
  return { docs, df, avg, N: docs.length };
}
function expand(q) {
  const base = tokens(q), out = new Map();
  base.forEach((t) => out.set(t, 1));
  base.forEach((t) => (SYN[t] || []).forEach((s) => tokens(s).forEach((x) => { if (!out.has(x)) out.set(x, 0.4); })));
  return out;
}
/** BM25 search. opts: {k, chapter (boost), dataOnly, textOnly} */
export function search(q, opts = {}) {
  const I = INDEX; if (!I) return [];
  const qt = expand(q), k1 = 1.2, b = 0.75;
  const hits = [];
  for (const d of I.docs) {
    if (opts.textOnly && d.kind !== "text") continue;
    let s = 0;
    qt.forEach((w, t) => {
      const f = d.tf.get(t); if (!f) return;
      const idf = Math.log(1 + (I.N - I.df.get(t) + 0.5) / (I.df.get(t) + 0.5));
      s += w * idf * (f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / I.avg));
    });
    if (!s) continue;
    if (opts.chapter && d.ch === opts.chapter) s *= 1.25;
    if (d.kind === "data") s *= 0.85;
    hits.push({ d, s });
  }
  hits.sort((a, b2) => b2.s - a.s);
  // keep at most 2 data cards in the top results so text explanations come first
  const out = []; let nData = 0;
  for (const h of hits) { if (h.d.kind === "data") { if (nData >= 3) continue; nData++; } out.push(h); if (out.length >= (opts.k || 5)) break; }
  return out;
}
export const cite = (d) => `Ch. ${d.ch}${d.sec ? " §" + d.sec : ""}${d.figs && d.figs.length ? " · Fig. " + d.figs.join(", ") : ""}`;

/* ---------------- language model ---------------- */
let tf = null, gen = null, loadedKey = null, device = null, dtype = null;
const resolved = {};
async function detect() {
  if (device) return;
  device = "wasm"; dtype = "q4";
  try { const a = navigator.gpu && (await navigator.gpu.requestAdapter()); if (a) { device = "webgpu"; dtype = "q4f16"; } } catch (e) {}
}
export async function resolveModel(key) {
  if (resolved[key]) return resolved[key];
  const m = MODELS[key];
  try { const r = await fetch(`https://huggingface.co/api/models/${m.id}`); if (r.ok) return (resolved[key] = m.id); } catch (e) {}
  return (resolved[key] = m.fallback);
}
export const modelLoaded = () => loadedKey;
export const runtime = () => device;
export async function ensureModel(key, onProgress) {
  if (gen && loadedKey === key) return;
  await detect();
  if (!tf) { onProgress && onProgress({ text: "Loading the language runtime…" }); tf = await import(TJS); }
  const id = await resolveModel(key);
  const files = {};
  const progress_callback = (p) => {
    if (p.status === "progress" && p.total) {
      files[p.file] = [p.loaded, p.total];
      const lo = Object.values(files).reduce((a, f) => a + f[0], 0), to = Object.values(files).reduce((a, f) => a + f[1], 0);
      onProgress && onProgress({ text: `Downloading ${MODELS[key].label} from Hugging Face: ${Math.round(lo / 1e6)} / ${Math.round(to / 1e6)} MB (first time only)`, frac: lo / to });
    }
  };
  gen = null; loadedKey = null;
  const tries = device === "webgpu" ? [["webgpu", "q4f16"], ["wasm", "q4"], ["wasm", "q8"]] : [["wasm", "q4"], ["wasm", "q8"]];
  let err;
  for (const [dv, dt] of tries) {
    try { gen = await tf.pipeline("text-generation", id, { device: dv, dtype: dt, progress_callback }); device = dv; dtype = dt; break; }
    catch (e) { err = e; onProgress && onProgress({ text: `Retrying with another build (${dv}, ${dt})…` }); }
  }
  if (!gen) throw err;
  loadedKey = key;
  onProgress && onProgress({ text: `Ready: ${MODELS[key].label} on ${device === "webgpu" ? "your graphics card" : "your CPU"}.`, frac: 1 });
}

const SYSTEM = `You are the Virtual Prof of "Materials & the Environment", an open interactive book on eco-informed materials selection (Ashby charts, eco-indicators, natural fibre composites, topology optimisation, eco audit).
Answer the student's question using ONLY the numbered course notes provided. Be clear, friendly and concise (2 to 6 sentences), like a good professor in office hours.
Cite the notes you use with their numbers in square brackets, e.g. [1] or [2][3]. Quote numbers exactly as they appear in the notes.
If the notes do not contain the answer, say so honestly and suggest which chapter to read; never invent data.`;

/** Generate an answer grounded on hits; onToken(textSoFar) streams. Returns final text. */
export async function generate(question, hits, onToken, history = []) {
  const notes = hits.map((h, i) => `[${i + 1}] (${cite(h.d)}, "${h.d.secTitle}") ${h.d.text}`).join("\n\n");
  const msgs = [{ role: "system", content: SYSTEM }];
  history.slice(-2).forEach((m) => msgs.push(m));
  msgs.push({ role: "user", content: `Course notes:\n${notes}\n\nStudent question: ${question}` });
  const text = gen.tokenizer.apply_chat_template(msgs, { tokenize: false, add_generation_prompt: true, enable_thinking: false });
  let acc = "";
  const streamer = new tf.TextStreamer(gen.tokenizer, { skip_prompt: true, skip_special_tokens: true, callback_function: (t) => { acc += t; onToken && onToken(clean(acc)); } });
  const out = await gen(text, { max_new_tokens: 320, do_sample: false, repetition_penalty: 1.1, return_full_text: false, streamer });
  return clean(String(out[0].generated_text || acc));
}
const clean = (t) => t.replace(/<think>[\s\S]*?(<\/think>|$)/g, "").trim();

/* ---------------- tiny formatter ---------------- */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const GREEK = { alpha: "α", beta: "β", gamma: "γ", delta: "δ", Delta: "Δ", eta: "η", theta: "θ", lambda: "λ", mu: "μ", nu: "ν", rho: "ρ", sigma: "σ", tau: "τ", phi: "φ", varepsilon: "ε", epsilon: "ε", cdot: "·", times: "×", le: "≤", ge: "≥", leq: "≤", geq: "≥", approx: "≈", infty: "∞", pm: "±", to: "→", quad: " ", qquad: " " };
/** Turn simple TeX ($\alpha_1 = E^{1/3}/\rho$) into readable text. */
export function plainMath(t) {
  return String(t).replace(/\$([^$]{1,200})\$/g, (m, x) => x
    .replace(/\\(?:mathrm|text|textrm|mathit|operatorname)\{([^{}]*)\}/g, "$1")
    .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)")
    .replace(/\\([A-Za-z]+)/g, (mm, w) => GREEK[w] ?? "")
    .replace(/\\[,;:! ]/g, " ").replace(/[{}]/g, "").replace(/\s+/g, " ").trim());
}
export function format(text, hits) {
  let h = esc(plainMath(text)).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\$([^$]{1,60})\$/g, "<i>$1</i>");
  h = h.replace(/\[(\d)\]/g, (m, n) => { const d = hits[+n - 1]; return d ? `<a class="prof-ref" href="${url(d.d.url)}" title="${esc(cite(d.d) + " · " + d.d.secTitle)}">${n}</a>` : m; });
  const lines = h.split(/\n+/); let html = "", inList = false;
  for (const l of lines) {
    const m = l.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
    if (m) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${m[1]}</li>`; }
    else { if (inList) { html += "</ul>"; inList = false; } if (l.trim()) html += `<p>${l}</p>`; }
  }
  return html + (inList ? "</ul>" : "");
}
export function snippet(text, q, n = 46) {
  const qs = new Set(tokens(q)); const w = plainMath(text).split(/\s+/);
  let best = 0, bi = 0;
  for (let i = 0; i < w.length; i++) { let s = 0; for (let j = i; j < Math.min(w.length, i + n); j++) if (qs.has(stem(norm(w[j]).replace(/[^a-z0-9]/g, "")))) s++; if (s > best) { best = s; bi = i; } }
  const start = Math.max(0, bi - 4), part = w.slice(start, start + n).map((x) => (qs.has(stem(norm(x).replace(/[^a-z0-9]/g, ""))) ? `<mark>${esc(x)}</mark>` : esc(x))).join(" ");
  return (start > 0 ? "… " : "") + part + (start + n < w.length ? " …" : "");
}

/* ---------------- chat UI ---------------- */
const pref = { get(k, d) { try { const v = localStorage.getItem("prof-" + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem("prof-" + k, JSON.stringify(v)); } catch (e) {} } };
const SUGGEST = {
  0: ["Why is wood good for a light, stiff panel?", "What is an eco audit?", "Can flax replace glass fibre?"],
  1: ["What does the guideline on an Ashby chart mean?", "What is an exchange constant?", "Which material is best for a light stiff panel?"],
  2: ["What is a variational autoencoder used for here?", "How do you search the latent space?", "What are the limits of the latent map?"],
  3: ["What is the Ecolizer?", "Which material family has the lowest eco-index per unit stiffness?", "What does imputation reveal?"],
  4: ["Why does the use phase dominate a bracket's CO2?", "Why are most brackets over-stressed?", "What was the constraint sign bug?"],
  5: ["Can flax replace glass fibre?", "Why do nonwoven composites win on cost?", "What is the fatigue strength of plant fibre composites?"],
  6: ["Which life phase dominates for a kettle?", "When does an aluminium bumper pay back?", "What is the end-of-life potential?"],
};

/** Mount a chat in el. opts: {chapter, compact} */
export function mountChat(el, opts = {}) {
  const ch = opts.chapter || 0;
  el.classList.add("prof-chat"); if (opts.compact) el.classList.add("compact");
  el.innerHTML = `
    <div class="prof-log" role="log" aria-live="polite"></div>
    <div class="prof-suggest"></div>
    <form class="prof-form"><input class="prof-in" type="text" placeholder="Ask about Chapters 1–6…" aria-label="Your question" autocomplete="off"><button class="btn prof-send" type="submit">Ask</button></form>
    <div class="prof-settings">
      <label class="prof-ai"><input type="checkbox" class="prof-ai-on"> AI explanations</label>
      <select class="prof-model" aria-label="Model">${Object.entries(MODELS).map(([k, m]) => `<option value="${k}">${m.label} (${m.size})</option>`).join("")}</select>
      <span class="prof-status"></span>
    </div>
    <div class="prof-bar"><div></div></div>`;
  const $ = (s) => el.querySelector(s);
  const log = $(".prof-log"), input = $(".prof-in"), aiOn = $(".prof-ai-on"), modelSel = $(".prof-model"), status = $(".prof-status"), bar = $(".prof-bar > div");
  aiOn.checked = pref.get("ai", false); modelSel.value = pref.get("model", "fast");
  const syncAi = () => { modelSel.disabled = !aiOn.checked; status.textContent = aiOn.checked ? (modelLoaded() === modelSel.value ? "Model ready." : `Downloads ${MODELS[modelSel.value].size} once, then runs on your device.`) : "Search only: answers quote the book."; };
  aiOn.onchange = () => { pref.set("ai", aiOn.checked); syncAi(); };
  modelSel.onchange = () => { pref.set("model", modelSel.value); syncAi(); };
  syncAi();
  $(".prof-suggest").innerHTML = (SUGGEST[ch] || SUGGEST[0]).map((q) => `<button type="button" class="chip">${esc(q)}</button>`).join("");
  $(".prof-suggest").onclick = (e) => { const b = e.target.closest("button"); if (b) { input.value = b.textContent; ask(); } };
  const history = [];
  let busy = false;
  const quotes = (hits, q) => `<p>Here is what the book says:</p>` + hits.slice(0, 3).map((h, i) => `<blockquote class="prof-quote"><a href="${url(h.d.url)}"><b>${i + 1}</b> ${esc(cite(h.d))} · ${esc(h.d.secTitle)}</a><div>${snippet(h.d.text, q)}</div></blockquote>`).join("");
  const add = (cls, html) => { const d = document.createElement("div"); d.className = "prof-msg " + cls; d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
  add("prof-bot", `<p>Hello, I am the <b>Virtual Prof</b>. Ask me anything covered in Chapters 1–6${ch ? `; I will look first in <b>Chapter ${ch}</b>` : ""}. I answer from the book and show you where to read more.</p>`);
  $(".prof-form").onsubmit = (e) => { e.preventDefault(); ask(); };

  async function ask() {
    const q = input.value.trim(); if (!q || busy) return;
    let lastHits = null;
    busy = true; input.value = ""; $(".prof-send").disabled = true; $(".prof-suggest").hidden = true;
    add("prof-user", `<p>${esc(q)}</p>`);
    const msg = add("prof-bot", `<p class="prof-wait">Looking in the book…</p>`);
    try {
      await loadIndex();
      const prev = history.length ? history[history.length - 2].content : "";
      let hits = search(q, { chapter: ch, k: 5 });
      if (q.split(/\s+/).length < 6 && prev) { const h2 = search(q + " " + prev, { chapter: ch, k: 5 }); if (!hits.length || (h2[0] && h2[0].s > hits[0].s)) hits = h2; }
      if (!hits.length || hits[0].s < 4) { msg.innerHTML = `<p>I could not find this in Chapters 1–6. Try other words (for example a material, a property or a chapter topic), or browse the <a href="${url("index.html#book")}">table of contents</a>.</p>`; return; }
      lastHits = hits;
      const sources = `<div class="prof-src"><span>Read more</span>${hits.slice(0, 4).map((h, i) => `<a href="${url(h.d.url)}"><b>${i + 1}</b> ${esc(cite(h.d))} · ${esc(h.d.secTitle)}</a>`).join("")}</div>`;
      if (aiOn.checked) {
        const key = modelSel.value;
        if (modelLoaded() !== key) {
          msg.innerHTML = `<p class="prof-wait">Preparing the model (first time only)…</p>`;
          await ensureModel(key, (p) => { status.textContent = p.text; if (p.frac != null) bar.style.width = Math.round(p.frac * 100) + "%"; });
        }
        msg.innerHTML = `<p class="prof-wait">Thinking…</p>`;
        const top = hits.slice(0, 4);
        const ans = await generate(q, top, (t) => { msg.innerHTML = format(t, top) + `<span class="prof-caret"></span>`; log.scrollTop = log.scrollHeight; }, history);
        msg.innerHTML = format(ans, top) + sources.replace("<span>Read more</span>", "<span>Read more · AI answers can be wrong: check the cited passages</span>");
        history.push({ role: "user", content: q }, { role: "assistant", content: ans });
      } else {
        msg.innerHTML = quotes(hits, q) + `<p class="prof-tip">Turn on <b>AI explanations</b> below for a written answer based on these passages.</p>`;
        history.push({ role: "user", content: q }, { role: "assistant", content: hits.slice(0, 3).map((h) => h.d.secTitle).join("; ") });
      }
    } catch (e) {
      console.error(e);
      lastHits = lastHits || [];
      msg.innerHTML = `<p class="warn">The language model could not run on this device (${esc(String(e.message || e).slice(0, 120))}). Here is what the book says instead.</p>` + (lastHits.length ? quotes(lastHits, q) : "");
    } finally { busy = false; $(".prof-send").disabled = false; log.scrollTop = log.scrollHeight; syncAi(); }
  }
  return { ask: (q) => { input.value = q; ask(); }, focus: () => input.focus() };
}
export { CH_SLUG };
