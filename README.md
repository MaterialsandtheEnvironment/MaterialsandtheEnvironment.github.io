# Materials & the Environment

Website and interactive book of the **Materials & the Environment** organisation (ISAE-SUPAERO, Université de Toulouse).
Published with GitHub Pages at <https://materialsandtheenvironment.github.io/>.

The book has six Distill-style chapters with live D3 figures:

| # | Chapter | Built from |
|---|---------|------------|
| 1 | [Ashby's Maps](book/ch1-ashby-maps.html): charts, value functions, eco-cost axis | [mid2supaero.github.io/ashby-maps](https://mid2supaero.github.io/ashby-maps/) |
| 2 | [Ashby's Maps, Renewed](book/ch2-latent-maps.html): selection in a VAE latent space | [mid2supaero.github.io/ashby-maps-renewed](https://mid2supaero.github.io/ashby-maps-renewed/) |
| 3 | [Mapping the Ecolizer](book/ch3-ecolizer.html): eco-indicators and a masked VAE | [mid2supaero.github.io/ecolizer-vae](https://mid2supaero.github.io/ecolizer-vae/) |
| 4 | [Brackets, Metals and Carbon](book/ch4-tosm.html): the TOSM benchmark | [mid2supaero.github.io/tosm](https://mid2supaero.github.io/tosm/) |
| 5 | [Natural Fibre Composites](book/ch5-natural-fibres.html): Ashby charts for plant fibres and PFRPs | Shah (2014), *Materials & Design* 62:21–31, [doi:10.1016/j.matdes.2014.05.002](https://doi.org/10.1016/j.matdes.2014.05.002) |
| 6 | [A Simple Eco Audit](book/ch6-eco-audit.html): energy and CO₂ over five life phases, calculator and case studies | CES EduPack Eco Audit white paper (Ashby et al., 2012); `notebooks/` |

Backup chapter A, [A Model That Read the Book](book/backup-a-small-model.html) (a small LLM fine-tuned on Chapters 1–4, built from `training/`), is kept outside the main sequence; `book/ch5-small-model.html` redirects to it.

## Deploy

1. Create the repository `MaterialsandtheEnvironment/MaterialsandtheEnvironment.github.io` (this name gives the root URL).
2. Push the contents of this folder to `main`.
3. In *Settings → Pages*, choose *Deploy from a branch*, `main`, `/ (root)`.

No build step is needed: the site is static HTML, CSS and JS. `.nojekyll` disables Jekyll processing.

To preview locally: `python3 -m http.server` in this folder, then open <http://localhost:8000>.

## Structure

```
index.html                 home page: hero, table of contents, lab, repositories
book/ch1-…ch4-….html       chapters (Distill markup)
assets/css/distill-lite.css   article grid, typography, light/dark tokens
assets/js/distill-lite.js     renders <d-front-matter>, <d-byline>, <d-cite>, <d-footnote>, <d-math>, <d-appendix>, TOC, chapter nav
assets/js/common.js        shared chart helpers (D3)
assets/js/ch1.js … ch4.js, ch5-natural-fibres.js, ch6-ecoaudit.js, ch5-matenv.js (backup A)  the interactive figures of each chapter
assets/vendor/             D3 7.8.5 and KaTeX 0.16.9 (vendored, no CDN needed)
data/materials22.js        22 CES/Granta materials (ρ, E) + approximate σ and price
data/vae.js                trained decoder weights for chapter 2
data/tosm.js               1 516 TOSM runs (mass, peak stress, peak displacement) + alloy table
data/nfc.js, nfc.json      chapter 5 fibre, composite and fatigue tables (Shah 2014, Supplementary Tables 1–4)
data/matenv_dataset.js     backup chapter A question set (counts, samples, 240 held-out questions)
data/matenv_results.js     backup chapter A benchmark results
assets/js/matenv-tools.js  the nine exact tools from Chapters 1–4 (browser + Node)
data/ecoaudit.js/.json      chapter 6 eco-audit teaching data (31 materials, 7 products)
notebooks/                 natural_fibre_composites.ipynb (Ch. 5), eco_audit.ipynb and ecoaudit.py (Ch. 6); Jupyter or Colab
training/                  question generator, generated JSONL, Colab fine-tuning notebook
tools/                     scripts that regenerate data/vae.js, data/tosm.js, data/nfc.js, data/ecoaudit.* and the notebook
```

### Distill markup

Chapters use the tags of the [Distill template](https://github.com/distillpub/template) (`d-front-matter`, `d-title`, `d-byline`, `d-article`, `d-math`, `d-cite`, `d-footnote`, `d-appendix`, `d-bibliography` with BibTeX). `distill-lite.js` renders them without any external dependency, so pages work offline and inside sandboxed viewers. To use the official renderer instead, replace the `distill-lite.js` script tag with `<script src="https://distill.pub/template.v2.js"></script>`; the book helpers (`d-site-header`, `d-toc`, `d-chapter-nav`, `d-cite-this`) would then need to stay on `distill-lite.js`.

### Adding a chapter

Copy a chapter file, edit its front matter, add an entry to `BOOK` at the top of `assets/js/distill-lite.js`, and add a card to `index.html`.

## Regenerating data

```bash
# Chapter 2: re-train the VAE (needs numpy + autograd)
python3 tools/train_vae.py 3 data/vae.js
python3 tools/check_opt.py data/vae.js 1e-3 3     # multi-start check: bar, beam, panel
# Chapter 4: from the TOSM repository files
python3 tools/export_tosm.py FinalResults.xlsx Materials.xlsx data/tosm.js
# Backup chapter A: regenerate the question set, then run training/finetune_matenv.ipynb on Colab (T4)
node training/make_dataset.cjs
python3 training/build_notebook.py   # rebuilds the notebook from its source
```

## Licence

Text and figures CC-BY 4.0; code MIT. The Ecolizer 2.0 is © OVAM and is reproduced for teaching. SimJEB bracket data are MIT-licensed.
