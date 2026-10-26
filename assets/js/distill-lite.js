/* distill-lite: a small, dependency-light renderer for Distill-style markup.
   Supports <d-front-matter>, <d-title>, <d-byline>, <d-article>, <d-math>, <d-cite>,
   <d-footnote>, <d-appendix>, <d-bibliography> (BibTeX), <d-footnote-list>, <d-citation-list>,
   plus the book helpers <d-site-header>, <d-toc>, <d-chapter-nav>, <d-site-footer>.
   The markup is compatible with distill.pub/template.v2.js, which can be swapped in. */
(function () {
  "use strict";
  const ROOT = (document.currentScript && document.currentScript.dataset.root) || ".";
  const BOOK = [
    { slug: "ch1-ashby-maps", n: 1, title: "Ashby's Maps", sub: "Charts, value functions and the eco-cost axis" },
    { slug: "ch2-latent-maps", n: 2, title: "Ashby's Maps, Renewed", sub: "Selecting materials in a learned latent space" },
    { slug: "ch3-ecolizer", n: 3, title: "Mapping the Ecolizer", sub: "Eco-indicators, eco-indices and a masked VAE" },
    { slug: "ch4-tosm", n: 4, title: "Brackets, Metals and Carbon", sub: "The TOSM benchmark of 1 516 bracket–alloy pairs" },
    { slug: "ch5-natural-fibres", n: 5, title: "Natural Fibre Composites", sub: "Ashby charts for plant fibres and their composites" },
    { slug: "ch6-eco-audit", n: 6, title: "A Simple Eco Audit", sub: "Energy and CO₂ over five life phases" },
    { slug: "backup-a-small-model", n: "A", backup: true, title: "A Model That Read the Book", sub: "Backup: fine-tuning a free small LLM on Chapters 1–4" },
  ];
  window.MATENV_BOOK = BOOK;

  /* ---------- theme ---------- */
  function getStored() { try { return localStorage.getItem("matenv-theme"); } catch (e) { return null; } }
  function setStored(v) { try { localStorage.setItem("matenv-theme", v); } catch (e) {} }
  const stored = getStored();
  if (stored === "dark" || stored === "light") document.documentElement.setAttribute("data-theme", stored);
  function isDark() {
    const t = document.documentElement.getAttribute("data-theme");
    if (t) return t === "dark";
    return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- header / footer ---------- */
  const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="3" fill="none" stroke="var(--ink)" stroke-width="1.6"/><path d="M5 27 L27 5" stroke="var(--hi)" stroke-width="2"/><circle cx="10" cy="18" r="3" fill="var(--s1)"/><circle cx="20" cy="9" r="3" fill="var(--accent)"/><circle cx="21" cy="21" r="2.4" fill="var(--s2)"/></svg>`;
  function header(el) {
    const here = el.getAttribute("current") || "";
    el.outerHTML = `<header class="site-head"><div class="wrap">
      <a class="brand" href="${ROOT}/index.html">${LOGO}<span>Materials &amp; the Environment</span></a>
      <nav class="site-nav" aria-label="Site">
        <a href="${ROOT}/index.html#book" ${here === "book" ? 'aria-current="page"' : ""}>Book</a>
        ${BOOK.filter((c) => !c.backup).map((c) => `<a class="ch" href="${ROOT}/book/${c.slug}.html" ${here === c.slug ? 'aria-current="page"' : ""}>Ch.${c.n}</a>`).join("")}
        <a class="ch" href="${ROOT}/index.html#backup" ${BOOK.some((c) => c.backup && c.slug === here) ? 'aria-current="page"' : ""}>Backup</a>
        <a href="${ROOT}/index.html#lab">Lab</a>
        <a href="https://github.com/MaterialsandtheEnvironment">GitHub</a>
        <button class="theme-btn" id="theme-toggle" type="button" aria-label="Toggle colour theme">${isDark() ? "Light" : "Dark"}</button>
      </nav></div></header>`;
    document.getElementById("theme-toggle").addEventListener("click", (e) => {
      const next = isDark() ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next); setStored(next);
      e.currentTarget.textContent = next === "dark" ? "Light" : "Dark";
      window.dispatchEvent(new Event("themechange"));
    });
  }
  function footer(el) {
    el.outerHTML = `<footer class="site-foot"><span>Materials &amp; the Environment · ISAE-SUPAERO, Université de Toulouse</span>
      <span>Text and figures CC-BY 4.0 · Code MIT · <a href="https://github.com/MaterialsandtheEnvironment">github.com/MaterialsandtheEnvironment</a></span></footer>`;
  }

  /* ---------- front matter + byline ---------- */
  function frontMatter() {
    const fm = document.querySelector("d-front-matter script");
    if (!fm) return null;
    try { return JSON.parse(fm.textContent); } catch (e) { console.warn("front-matter", e); return null; }
  }
  function byline(fm) {
    const el = document.querySelector("d-byline");
    if (!el || !fm) return;
    const authors = fm.authors || [];
    const n = Math.max(1, authors.length);
    const cells = authors.map((a, i) => `<p class="author" style="grid-column:1;grid-row:${i + 2}">${a.authorURL ? `<a href="${esc(a.authorURL)}">${esc(a.author)}</a>` : esc(a.author)}${a.role ? ` <span style="color:var(--muted)">· ${esc(a.role)}</span>` : ""}</p>
      <p class="affil" style="grid-column:2;grid-row:${i + 2}">${(a.affiliations || []).map((f) => (f.url ? `<a href="${esc(f.url)}">${esc(f.name)}</a>` : esc(f.name))).join(", ")}</p>`).join("");
    el.innerHTML = `<div class="byline">
      <h3 style="grid-column:1;grid-row:1">Authors</h3><h3 style="grid-column:2;grid-row:1">Affiliations</h3><h3 style="grid-column:3;grid-row:1">Published</h3>
      ${cells}
      <p class="affil" style="grid-column:3;grid-row:2 / span ${n}">${esc(fm.published || "")}${fm.source ? `<br><a href="${esc(fm.source)}">Original article</a>` : ""}${fm.code ? `<br><a href="${esc(fm.code)}">Code &amp; data</a>` : ""}</p>
    </div>`;
    if (fm.title && !document.title) document.title = fm.title;
  }

  /* ---------- BibTeX ---------- */
  function parseBib(src) {
    const out = {};
    const re = /@(\w+)\s*\{\s*([^,\s]+)\s*,/g;
    let m;
    while ((m = re.exec(src))) {
      let i = re.lastIndex, depth = 1, start = i;
      while (i < src.length && depth > 0) { if (src[i] === "{") depth++; else if (src[i] === "}") depth--; i++; }
      const body = src.slice(start, i - 1);
      const entry = { type: m[1].toLowerCase(), key: m[2] };
      const fre = /(\w+)\s*=\s*/g; let f;
      while ((f = fre.exec(body))) {
        let j = fre.lastIndex, val = "";
        if (body[j] === "{") { let d = 1; j++; const s = j; while (j < body.length && d > 0) { if (body[j] === "{") d++; else if (body[j] === "}") d--; j++; } val = body.slice(s, j - 1); }
        else if (body[j] === '"') { const s = ++j; while (j < body.length && body[j] !== '"') j++; val = body.slice(s, j); j++; }
        else { const s = j; while (j < body.length && body[j] !== ",") j++; val = body.slice(s, j).trim(); }
        entry[f[1].toLowerCase()] = val.replace(/[{}]/g, "").replace(/\\&/g, "&").replace(/--/g, "–").replace(/\s+/g, " ").trim();
        fre.lastIndex = j;
      }
      out[entry.key] = entry;
      re.lastIndex = i;
    }
    return out;
  }
  function fmtAuthors(a) {
    if (!a) return "";
    const list = a.split(/\s+and\s+/).map((s) => { const p = s.split(","); return p.length > 1 ? `${p[1].trim()} ${p[0].trim()}` : s.trim(); });
    return list.length > 3 ? `${list.slice(0, 3).join(", ")} et al.` : list.join(", ");
  }
  function fmtRef(e) {
    const venue = e.journal || e.booktitle || e.publisher || e.howpublished || "";
    const link = e.doi ? `https://doi.org/${e.doi}` : e.url || "";
    return `${esc(fmtAuthors(e.author))}${e.year ? ` (${esc(e.year)})` : ""}. <b>${esc(e.title || "")}</b>. ${venue ? `<i>${esc(venue)}</i>${e.volume ? `, ${esc(e.volume)}` : ""}${e.pages ? (/[–-]/.test(e.pages) ? `, pp. ${esc(e.pages)}` : `, ${esc(e.pages)}`) : ""}.` : ""} ${link ? `<a href="${esc(link)}">${esc(e.doi ? "doi:" + e.doi : link.replace(/^https?:\/\//, ""))}</a>` : ""}`;
  }

  /* ---------- hover boxes ---------- */
  let box = null;
  function showBox(target, html) {
    hideBox();
    box = document.createElement("div"); box.className = "hover-box"; box.innerHTML = html; document.body.appendChild(box);
    const r = target.getBoundingClientRect();
    const w = Math.min(380, window.innerWidth - 32);
    box.style.maxWidth = w + "px";
    let left = r.left + window.scrollX - 20; left = Math.max(16, Math.min(left, window.scrollX + window.innerWidth - w - 16));
    box.style.left = left + "px"; box.style.top = r.bottom + window.scrollY + 8 + "px";
  }
  function hideBox() { if (box) { box.remove(); box = null; } }
  document.addEventListener("click", (e) => { if (!e.target.closest(".cite-ref,.fn-ref,.hover-box")) hideBox(); });
  function bindHover(el, html) {
    el.tabIndex = 0;
    el.addEventListener("mouseenter", () => showBox(el, html));
    el.addEventListener("mouseleave", () => setTimeout(() => { if (box && !box.matches(":hover")) hideBox(); }, 250));
    el.addEventListener("focus", () => showBox(el, html));
    el.addEventListener("blur", hideBox);
    el.addEventListener("click", (e) => { e.preventDefault(); showBox(el, html); });
  }

  function citations() {
    const bibEl = document.querySelector("d-bibliography script");
    const bib = bibEl ? parseBib(bibEl.textContent) : {};
    const order = [];
    document.querySelectorAll("d-cite").forEach((c) => {
      const keys = (c.getAttribute("key") || "").split(",").map((k) => k.trim()).filter(Boolean);
      const nums = keys.map((k) => { if (!order.includes(k)) order.push(k); return order.indexOf(k) + 1; });
      const a = document.createElement("a"); a.className = "cite-ref"; a.href = "#references"; a.textContent = nums.join(",");
      c.replaceWith(a);
      bindHover(a, keys.map((k) => (bib[k] ? fmtRef(bib[k]) : `Missing reference: ${esc(k)}`)).join("<hr style='border:0;border-top:1px solid var(--rule)'>"));
    });
    const list = document.querySelector("d-citation-list");
    if (list) {
      if (!order.length) { list.remove(); return; }
      list.outerHTML = `<h3 id="references">References</h3><ol>${order.map((k) => `<li>${bib[k] ? fmtRef(bib[k]) : esc(k)}</li>`).join("")}</ol>`;
    }
  }
  function footnotes() {
    const notes = [];
    document.querySelectorAll("d-footnote").forEach((f) => {
      notes.push(f.innerHTML);
      const n = notes.length;
      const a = document.createElement("a"); a.className = "fn-ref"; a.href = "#fn-" + n; a.id = "fnref-" + n; a.textContent = n;
      f.replaceWith(a); bindHover(a, notes[n - 1]);
    });
    const list = document.querySelector("d-footnote-list");
    if (list) {
      if (!notes.length) { list.remove(); return; }
      list.outerHTML = `<h3>Footnotes</h3><ol>${notes.map((t, i) => `<li id="fn-${i + 1}">${t} <a href="#fnref-${i + 1}" aria-label="Back to text">↩</a></li>`).join("")}</ol>`;
    }
  }
  function math() {
    if (!window.katex) return;
    document.querySelectorAll("d-math").forEach((el) => {
      try { katex.render(el.textContent, el, { displayMode: el.hasAttribute("block"), throwOnError: false }); } catch (e) { console.warn(e); }
    });
  }
  function toc() {
    const el = document.querySelector("d-toc");
    if (!el) return;
    const hs = [...document.querySelectorAll("d-article h2")];
    hs.forEach((h, i) => { if (!h.id) h.id = "s" + (i + 1); });
    el.outerHTML = `<nav class="toc" aria-label="Contents"><b>In this chapter</b><ol>${hs.map((h) => `<li><a href="#${h.id}">${esc(h.textContent.replace(/^\s*[\d.]+\s*/, ""))}</a></li>`).join("")}</ol></nav>`;
  }
  function chapterNav() {
    document.querySelectorAll("d-chapter-nav").forEach((el) => {
      const cur = BOOK.find((c) => c.slug === el.getAttribute("current"));
      const list = BOOK.filter((c) => !!c.backup === !!(cur && cur.backup));
      const i = list.indexOf(cur);
      const prev = list[i - 1], next = list[i + 1];
      const word = (c) => (c.backup ? "Backup chapter " : "Chapter ") + c.n;
      el.outerHTML = `<nav class="chapter-nav" aria-label="Chapters">
        ${prev ? `<a href="${prev.slug}.html"><small>← ${word(prev)}</small>${esc(prev.title)}</a>` : `<a href="${ROOT}/index.html#book"><small>← Contents</small>The book</a>`}
        ${next ? `<a class="next" href="${next.slug}.html"><small>${word(next)} →</small>${esc(next.title)}</a>` : `<a class="next" href="${ROOT}/index.html#book"><small>Contents →</small>Back to the book</a>`}
      </nav>`;
    });
  }
  function citeThis(fm) {
    const el = document.querySelector("d-cite-this");
    if (!el || !fm) return;
    const authors = (fm.authors || []).map((a) => a.author).join(" and ");
    const key = (fm.citeKey || "matenv" + (fm.chapter || ""));
    el.outerHTML = `<h3>Citation</h3><div><p>${esc((fm.authors || []).map((a) => a.author).join(", "))}, "${esc(fm.title)}", <i>Materials &amp; the Environment: an interactive book</i>, ${typeof fm.chapter === "string" ? "backup chapter" : "chapter"} ${esc(fm.chapter)}, ${esc((fm.published || "").slice(-4))}.</p>
      <pre>@incollection{${esc(key)},
  author    = {${esc(authors)}},
  title     = {${esc(fm.title)}},
  booktitle = {Materials \\& the Environment: an interactive book},
  chapter   = {${esc(fm.chapter)}},
  year      = {${esc((fm.published || "").slice(-4))}},
  url       = {https://materialsandtheenvironment.github.io/book/${esc(fm.slug || "")}.html}
}</pre></div>`;
  }

  function run() {
    document.querySelectorAll("d-site-header").forEach(header);
    document.querySelectorAll("d-site-footer").forEach(footer);
    const fm = frontMatter();
    byline(fm); toc(); citations(); footnotes(); chapterNav(); citeThis(fm); math();
    document.documentElement.classList.add("distill-ready");
    window.dispatchEvent(new Event("distill-ready"));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
  window.MATENV = Object.assign(window.MATENV || {}, { isDark });
})();
