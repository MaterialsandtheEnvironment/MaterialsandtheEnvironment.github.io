"""Build the Virtual Prof's knowledge base: data/prof_index.js (for the browser) and data/prof_index.json.

Passages come from:
  1. the text of Chapters 1-6 (paragraphs, lists, equations, figure captions and the appendix), cut at section
     boundaries into chunks of about 160 words, each with its chapter, section, anchor URL and figure numbers;
  2. "fact cards" generated from the book's data files (materials of Chapter 1, fibres and composites of
     Chapter 5, eco-audit materials and products of Chapter 6), so the prof can quote exact numbers.
Run: python3 tools/build_prof_index.py
"""
import json, os, re
from bs4 import BeautifulSoup

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
CHAPTERS = [
    ("ch1-ashby-maps", 1), ("ch2-latent-maps", 2), ("ch3-ecolizer", 3),
    ("ch4-tosm", 4), ("ch5-natural-fibres", 5), ("ch6-eco-audit", 6),
]
MAXW = 170

def clean(t):
    t = re.sub(r"\s+", " ", t).strip()
    return t.replace(" ,", ",").replace(" .", ".")

def chunk(words, size=MAXW):
    out, cur = [], []
    for para in words:
        n = len(para.split())
        if cur and sum(len(p.split()) for p in cur) + n > size:
            out.append(" ".join(cur)); cur = []
        cur.append(para)
    if cur: out.append(" ".join(cur))
    return out

docs = []
for slug, n in CHAPTERS:
    soup = BeautifulSoup(open(os.path.join(ROOT, "book", slug + ".html"), encoding="utf-8").read(), "html.parser")
    fm = json.loads(soup.find("d-front-matter").find("script").string)
    title = fm["title"]
    lead = soup.find("d-title").find("p")
    art = soup.find("d-article")
    for tag in art.find_all(["script", "style", "d-toc", "d-chapter-nav"]): tag.decompose()
    for m in art.find_all("d-math"): m.replace_with(" $" + m.get_text() + "$ ")
    for c in art.find_all("d-cite"): c.decompose()
    for fn in art.find_all("d-footnote"): fn.replace_with(" (" + fn.get_text(" ") + ") ")
    sections, cur = [], {"id": "", "title": "Introduction", "paras": [clean(lead.get_text(" "))] if lead else []}
    for el in art.children:
        if getattr(el, "name", None) is None: continue
        if el.name == "h2":
            sections.append(cur)
            sec = el.find("span", class_="sec")
            num = sec.get_text() if sec else ""
            if sec: sec.decompose()
            cur = {"id": el.get("id", ""), "num": num, "title": clean(el.get_text(" ")), "paras": []}
            continue
        # figures: keep caption text with its number; ignore interactive controls
        if el.name in ("figure", "div") and el.find("figcaption"):
            cap = el.find("figcaption")
            cur["paras"].append(clean(cap.get_text(" ")))
            continue
        if el.name in ("p", "ul", "ol", "d-math", "blockquote", "h3") or (el.name == "div" and "table-wrap" in (el.get("class") or [])):
            txt = clean(el.get_text(" "))
            if el.name == "h3": txt = txt + ":"
            if txt: cur["paras"].append(txt)
    sections.append(cur)
    app = soup.find("d-appendix")
    if app:
        for t in app.find_all(["d-footnote-list", "d-citation-list", "d-cite-this"]): t.decompose()
        txt = clean(app.get_text(" "))
        if txt: sections.append({"id": "", "num": "A", "title": "About the data", "paras": [txt]})
    for s in sections:
        if not s["paras"]: continue
        for k, body in enumerate(chunk(s["paras"])):
            figs = sorted(set(re.findall(r"Figure (\d+\.\d+)", body)))
            docs.append({
                "id": f"{n}.{s.get('num') or 0}.{k}", "kind": "text", "ch": n, "chTitle": title,
                "sec": s.get("num", ""), "secTitle": s["title"],
                "url": f"book/{slug}.html" + (f"#{s['id']}" if s["id"] else ""),
                "figs": figs, "text": body,
            })

# ---------------- fact cards from data
def fact(ch, slug, sec, title, text, anchor=""):
    docs.append({"id": f"{ch}.data.{len(docs)}", "kind": "data", "ch": ch, "chTitle": dict((c[1], c[0]) for c in CHAPTERS)[ch],
                 "sec": "", "secTitle": sec, "url": f"book/{slug}.html" + (f"#{anchor}" if anchor else ""), "figs": [], "text": f"{title}. {text}"})

TITLES = {1: "Ashby's Maps", 2: "Ashby's Maps, Renewed", 3: "Mapping the Ecolizer", 4: "Brackets, Metals and Carbon",
          5: "Natural Fibre Composites", 6: "A Simple Eco Audit"}

m22src = open(os.path.join(ROOT, "data", "materials22.js")).read()
for o in re.findall(r"\{[^{}]*\}", m22src.split("=", 1)[1]):
    m = json.loads(re.sub(r"(\w+):", r'"\1":', o))
    rho, E = m["rho"], m["E"]
    fact(1, "ch1-ashby-maps", "Data: the 22 materials", f"{m['name']} ({m['family']})",
         f"Density {rho} kg/m3, Young's modulus {E:g} GPa, strength about {m['sigma']} MPa, price about {m['Cm']} GBP/kg. "
         f"Light-panel index E^(1/3)/rho = {E ** (1/3) / rho * 1000:.2f} (GPa^(1/3) per t/m3); specific stiffness E/rho = {E / rho * 1000:.1f} GPa per t/m3.")

nfc = json.load(open(os.path.join(ROOT, "data", "nfc.json")))
for f in nfc["fibres"]:
    r = lambda a: f"{a[0]:g}" if a[0] == a[1] else f"{a[0]:g}-{a[1]:g}"
    fact(5, "ch5-natural-fibres", "Data: plant fibres (Shah 2014, Table S1)", f"{f['name']} fibre ({f['group']})",
         f"Density {r(f['rho'])} g/cm3, tensile modulus {r(f['E'])} GPa, tensile strength {r(f['s'])} MPa, specific modulus {r(f['Esp'])} GPa per g/cm3, "
         f"failure strain {r(f['strain'])}%, cost {r(f['cost'])} GBP/kg, embodied energy {r(f['ee'])} MJ/kg.", "fibres")
for c in nfc["composites"]:
    fact(5, "ch5-natural-fibres", "Data: plant fibre composites (Shah 2014, Table S2)", f"{c['name']}, {c['form'].lower()}, {c['process'].lower()}",
         f"{c['matrix']} matrix ({'thermoset' if c['matrix'] != 'PP' else 'thermoplastic'}), fibre content {c['fc']} {'vol' if c['unit'] == 'v' else 'wt'}%, "
         f"modulus {c['E']} GPa, strength {c['s']} MPa, density {c['rho']:.2f} g/cm3, specific modulus {c['Esp']}, specific strength {c['ssp']}; "
         f"estimated cost {c['cost']:.1f} GBP/kg and embodied energy {c['ee']:.0f} MJ/kg.", "charts")
for k, f in nfc["forms"].items():
    fact(5, "ch5-natural-fibres", "Data: reinforcement forms (Shah 2014, Table S3)", f"Reinforcement form: {k}",
         f"Fibre length {f['length']}, efficiency factor eta_l*eta_o {f['eta'][0]}-{f['eta'][1]}, reinforcement cost {f['cost'][0]}-{f['cost'][1]} GBP/kg, embodied energy {f['ee'][0]}-{f['ee'][1]} MJ/kg.", "forms")

eco = json.load(open(os.path.join(ROOT, "data", "ecoaudit.json")))
for name, m in eco["materials"].items():
    if not m["ee"]: continue
    fact(6, "ch6-eco-audit", "Data: eco audit materials", f"{name} ({m['family']}), eco data",
         f"Embodied energy {m['ee']} MJ/kg and {m['co2']} kg CO2/kg (virgin); recycled production {m['ee_rec']} MJ/kg and {m['co2_rec']} kg CO2/kg; "
         f"typical recycled content {round(m['rf'] * 100)}%.", "data")
for p in eco["products"]:
    bom = ", ".join(f"{c['name']} ({c['material']}, {c['mass']} kg)" for c in p["bom"])
    tr = "; ".join(f"{s['name']}: {s['type']} {s['km']} km" for s in p.get("transport") or []) or "none"
    use = []
    if p.get("static"): s = p["static"]; use.append(f"static {s['mode']} {s['kW']} kW x {s['hours_per_day']} h/day x {s['days_per_year']} days/yr")
    if p.get("mobile"): s = p["mobile"]; use.append(f"mobile {s['mode']} {s['km_per_day']} km/day x {s['days_per_year']} days/yr")
    fact(6, "ch6-eco-audit", "Data: eco audit example products", f"Example product: {p['name']}",
         f"Life {p['life']} years. Bill of materials: {bom}. Transport: {tr}. Use: {'; '.join(use) or 'none'}. {p.get('story') or ''}", "calculator")

for d in docs:
    d["chTitle"] = TITLES[d["ch"]]

with open(os.path.join(ROOT, "data", "prof_index.json"), "w") as f:
    json.dump({"version": 1, "docs": docs}, f, ensure_ascii=False, indent=0)
with open(os.path.join(ROOT, "data", "prof_index.js"), "w") as f:
    f.write("/* Virtual Prof knowledge base, generated by tools/build_prof_index.py from Chapters 1-6 and their data. */\n")
    f.write("window.PROF_INDEX = " + json.dumps({"version": 1, "docs": docs}, ensure_ascii=False, separators=(",", ":")) + ";\n")
txt = [d for d in docs if d["kind"] == "text"]
print(len(txt), "text passages,", len(docs) - len(txt), "data cards,", sum(len(d["text"].split()) for d in docs), "words")
for d in txt[:3]: print(d["id"], d["secTitle"], "|", d["text"][:120])
