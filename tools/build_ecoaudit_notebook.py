"""Builds notebooks/eco_audit.ipynb (the model code from notebooks/ecoaudit.py is inlined so the notebook is standalone)."""
import json, os
root = os.path.join(os.path.dirname(__file__), "..")
model_src = open(os.path.join(root, "notebooks", "ecoaudit.py")).read()
cells = []
def md(s): cells.append({"cell_type": "markdown", "metadata": {}, "source": s.strip("\n")})
def code(s): cells.append({"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [], "source": s.strip("\n")})

md("""
# A simplified eco audit

*Materials & the Environment, companion notebook to Chapter 6.*

An **eco audit** is a fast, approximate estimate of the **energy** and **CO₂** a product demands over its life, split into five phases:

| Phase | What is counted | Formula used here |
|---|---|---|
| Material | making the materials from ore or feedstock | mass × embodied energy (MJ/kg) |
| Manufacture | the primary shaping process | mass × process energy (MJ/kg) |
| Transport | factory to point of sale | product mass × distance × energy per tonne·km |
| Use | energy the product uses, or the fuel it costs a vehicle to carry it | power × time ÷ conversion efficiency, or added mass × distance × energy per tonne·km |
| Disposal | collecting and processing it at end of life | mass × disposal energy (MJ/kg) |

The method follows the CES EduPack Eco Audit Tool (Ashby, Coulter, Ball and Bream, 2012). Its point is simple: **one phase usually dominates, often with 60% or more of the total**, and that phase is where redesign pays. Because the differences between phases are so large, approximate data are good enough to find it.

The data used here are rounded teaching values, chosen to reproduce the white-paper case studies within about 10%. For real decisions use Granta EduPack or a full LCA database.
""")

code("""
import json, os, copy, urllib.request
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.patches import Patch

URL = "https://raw.githubusercontent.com/MaterialsandtheEnvironment/MaterialsandtheEnvironment.github.io/main/data/ecoaudit.json"
LOCAL = "../data/ecoaudit.json"
DATA = json.load(open(LOCAL)) if os.path.exists(LOCAL) else json.load(urllib.request.urlopen(URL))
PRODUCTS = {p["id"]: p for p in DATA["products"]}
print(len(DATA["materials"]), "materials,", len(DATA["processes"]), "processes,", len(DATA["transport"]), "transport modes,", len(PRODUCTS), "example products")
""")

md("""
## 1 · The data

Each material has an embodied energy and CO₂ footprint per kilogram for virgin production, the fraction of recycled material in current supply, and the (much lower) values for recycled material. A few rows:
""")
code("""
mat = pd.DataFrame(DATA["materials"]).T[["family", "ee", "co2", "rf", "ee_rec"]]
mat.columns = ["family", "MJ/kg (virgin)", "kg CO2/kg", "recycled fraction", "MJ/kg (recycled)"]
mat.loc[["PET", "Polypropylene (PP)", "Low alloy steel", "Cast aluminium alloy", "Copper", "Stainless steel", "Cardboard", "Concrete"]]
""")
code("""
pd.DataFrame({"Transport (per tonne·km)": {k: f"{v['ee']} MJ, {v['co2']} kg CO2" for k, v in DATA["transport"].items()}})
""")

md("""
## 2 · The model

About 60 lines of Python. Use energy is the only subtle part: a kettle delivers 2 kW of heat, but producing 1 MJ of electricity takes about 3 MJ of primary (fossil) energy, so the delivered energy is divided by an **efficiency factor** (0.33 for electric heating, 0.28 for an electric motor). Products that ride in a vehicle cost fuel in proportion to their mass: about 2 MJ per tonne·km in a family car.
""")
code(model_src)

code("""
COLORS = {"Material": "#2a78d6", "Manufacture": "#eb6834", "Transport": "#1baf7a", "Use": "#eda100", "Disposal": "#8a8f8c"}

def show(product, title=None):
    r = audit(product, DATA)
    fig, axes = plt.subplots(1, 2, figsize=(10, 3.6))
    for ax, key, eol, unit in [(axes[0], "energy", r["eol_energy"], "MJ"), (axes[1], "co2", r["eol_co2"], "kg CO$_2$")]:
        vals = r[key]; names = list(vals)
        ax.bar(names, [vals[n] for n in names], color=[COLORS[n] for n in names])
        if eol:
            ax.bar(["EoL potential"], [eol], color="white", edgecolor="#555", hatch="///")
        ax.axhline(0, color="#555", lw=0.8); ax.set_ylabel(unit); ax.tick_params(axis="x", rotation=30)
        ax.set_title(("Energy" if key == "energy" else "CO$_2$") + f" — total {r['total_' + key]:,.0f} {unit.replace('$_2$', '2').replace('kg CO', 'kg CO')}")
        ax.spines[["top", "right"]].set_visible(False)
    fig.suptitle(title or product["name"]); fig.tight_layout(); plt.show()
    tab = pd.DataFrame({"Energy (MJ)": r["energy"], "Energy (%)": {k: 100 * v / r["total_energy"] for k, v in r["energy"].items()},
                        "CO2 (kg)": r["co2"], "CO2 (%)": {k: 100 * v / r["total_co2"] for k, v in r["co2"].items()}})
    tab.loc["Total"] = tab.sum()
    ph, share = dominant(r)
    print(f"Dominant phase: {ph} ({share:.0%} of the energy). Strategy: {STRATEGIES[ph]}")
    return tab.round(1)
""")

md("""
## 3 · Case study: bottled water

100 one-litre PET bottles (40 g each) with PP caps (1 g), molded and filled in the French Alps, trucked 550 km to London in a 14 t truck, then refrigerated for two days (0.12 kW for 100 bottles). The 100 kg of water travels too, as dead weight.
""")
code("""
bottle = PRODUCTS["bottle"]
pd.DataFrame(bottle["bom"])
""")
code("""
show(bottle)
""")
md("""
**Check against the white paper (Table 2):** material 344 MJ, manufacture 36 MJ, transport 48 MJ, use 74 MJ. The model gives 346, 28, 50 and 74 MJ. Manufacture is lower because the white paper's own Table 1 gives 6.8 MJ/kg for polymer molding, which yields 28 MJ; its Table 2 and appendix report were produced with other database versions.

The **material** of the bottle dominates. Transporting 100 kg of water 550 km, which feels extravagant, is only about 10% of the energy.

**Exercise (Granta EduPack Exercise 21):** give the PET 35% recycled content. How much does the first-life energy drop?
""")
code("""
recycled = copy.deepcopy(bottle)
recycled["bom"][0]["recycled"] = 35
r0, r1 = audit(bottle, DATA), audit(recycled, DATA)
print(f"First-life energy: {r0['total_energy']:.0f} MJ -> {r1['total_energy']:.0f} MJ ({100*(r1['total_energy']/r0['total_energy']-1):+.0f}%)")
""")
md("""
EduPack reports −11% with its database; this model gives −13%. Differences below 20% are not significant in an eco audit; the conclusion is the same.

### A new example: a reusable steel bottle

One stainless-steel bottle (300 g, PP cap), shipped from Asia, refilled 100 times from the tap and washed each time (1.2 kW for 2.5 minutes). Same service as the 100 PET bottles above.
""")
code("""
reuse = PRODUCTS["reusable"]
show(reuse)
""")
code("""
a, b = audit(bottle, DATA), audit(reuse, DATA)
print(f"100 PET bottles: {a['total_energy']:.0f} MJ, {a['total_co2']:.1f} kg CO2")
print(f"1 steel bottle, 100 uses: {b['total_energy']:.0f} MJ, {b['total_co2']:.1f} kg CO2  ->  {a['total_energy']/b['total_energy']:.0f}x less energy")
# how many uses before the steel bottle pays back its material?
per_use_pet = a["total_energy"] / 100
fixed_steel = b["energy"]["Material"] + b["energy"]["Manufacture"] + b["energy"]["Transport"]
per_use_steel = b["energy"]["Use"] / 100
print(f"Break-even after about {fixed_steel / (per_use_pet - per_use_steel):.0f} uses")
""")

md("""
## 4 · Case study: electric kettle

A 2 kW, 1.7 L kettle made in South-East Asia, air-freighted 11 000 km to Europe, then trucked 250 km. It boils 1 L in 3 minutes, three times a day, for three years.
""")
code("""
kettle = PRODUCTS["kettle"]
show(kettle)
""")
md("""
White paper (Table 4): material 107 MJ, manufacture 6.9, transport 115, use 3 583 MJ (94%). Use dominates so strongly that only thermal efficiency matters. What about sea freight instead of air?
""")
code("""
sea = copy.deepcopy(kettle)
sea["transport"][0] = {"name": "SE Asia to Europe", "type": "Sea freight", "km": 17000}
for p in (kettle, sea):
    r = audit(p, DATA); print(f"{p['transport'][0]['type']:>12}: transport {r['energy']['Transport']:6.1f} MJ = {100*r['energy']['Transport']/r['total_energy']:.1f}% of the life energy")
better = copy.deepcopy(kettle); better["static"]["kW"] *= 0.8   # e.g. a double wall that saves 20% of the heating energy
print(f"A 20% more efficient kettle saves {audit(kettle, DATA)['total_energy'] - audit(better, DATA)['total_energy']:.0f} MJ, "
      f"more than {audit(kettle, DATA)['energy']['Material']:.0f} MJ for all its materials.")
""")

md("""
## 5 · Case study: family car — material against use

An 1 800 kg car driven 25 000 km a year for 10 years. Only the materials and the fuel are counted.
""")
code("""
car = PRODUCTS["car"]
r = audit(car, DATA)
print(f"Material: {r['energy']['Material']/1000:.0f} GJ, use: {r['energy']['Use']/1000:.0f} GJ  "
      f"(white paper: 162 and 884 GJ) -> use is {r['energy']['Use']/r['total_energy']:.0%} of the total")
pd.DataFrame(r["components"]).set_index("name")[["material", "mass", "Material E"]].sort_values("Material E", ascending=False).round(0)
""")
md("""
Aluminium is a quarter of the mass and well over half of the material energy.

## 6 · Substitution: steel or aluminium bumper?

A 14 kg steel bumper or a 10 kg aluminium one. Aluminium costs far more energy to make but saves fuel on every kilometre. Where is the break-even?
""")
code("""
import numpy as np
km = np.linspace(0, 300_000, 301)
fuel = DATA["mobile"]["Family car, gasoline"]["ee"]          # MJ per tonne·km
def life_energy(material, mass, recycled):
    m = DATA["materials"][material]; f = m["rf"] if recycled else 0
    return mass * ((1 - f) * m["ee"] + f * m["ee_rec"]) + mass / 1000 * km * fuel
fig, ax = plt.subplots(figsize=(7, 3.8))
for rec, ls in [(False, "-"), (True, "--")]:
    st, al = life_energy("Low alloy steel", 14, rec), life_energy("Cast aluminium alloy", 10, rec)
    ax.plot(km / 1000, st / 1000, ls, color="#2a78d6", label=f"steel, {'typical recycled' if rec else 'virgin'}")
    ax.plot(km / 1000, al / 1000, ls, color="#eb6834", label=f"aluminium, {'typical recycled' if rec else 'virgin'}")
    i = np.argmax(al < st); print(f"{'Recycled' if rec else 'Virgin'} material: break-even at {km[i]:,.0f} km")
ax.set_xlabel("distance driven (1 000 km)"); ax.set_ylabel("life energy (GJ)"); ax.legend(frameon=False); ax.spines[["top", "right"]].set_visible(False)
plt.show()
""")
md("""
White paper: about 200 000 km with virgin metal, under 100 000 km with the recycled content in current supply. The model gives about 199 000 and 91 000 km. Recycled aluminium needs a tenth of the energy of primary aluminium, which moves the break-even within an ordinary car's life.

## 7 · Case study: a space heater that rides in a van

A 7 kg LPG heater (9.3 kW) used 2 hours a day, 20 days a year, and carried 420 km a week in a light goods vehicle, for 3 years. It uses energy in two ways: the gas it burns (static mode), and the extra fuel the van burns to carry it (mobile mode).
""")
code("""
heater = PRODUCTS["heater"]
r = audit(heater, DATA)
print(f"Static (LPG): {r['use']['static E']:.0f} MJ, mobile (being carried): {r['use']['mobile E']:.0f} MJ  "
      f"-> {r['use']['static E']/r['energy']['Use']:.0%} / {r['use']['mobile E']/r['energy']['Use']:.0%}  (white paper: 87% / 13%)")
show(heater)
""")

md("""
## 8 · Audit your own product

Copy this template, fill in the bill of materials and run it. Material, process, transport and use-mode names must match the keys of `DATA` (listed below). As in EduPack, it is enough to enter the components that make up about 95% of the mass, plus a "residual components" row using polycarbonate and polymer molding as a mid-range proxy.
""")
code("""
mine = {
    "name": "My product", "life": 5,
    "bom": [
        {"name": "Frame", "material": "Wrought aluminium alloy", "process": "Metal deformation (forging, rolling)", "mass": 1.6, "eol": "Recycle", "recycled": "typical"},
        {"name": "Seat and grips", "material": "Polyurethane (PU)", "process": "Polymer molding", "mass": 0.4, "eol": "Landfill", "recycled": "virgin"},
        {"name": "Residual components", "material": "Polycarbonate (PC)", "process": "Polymer molding", "mass": 0.2, "eol": "Landfill", "recycled": "virgin"},
    ],
    "transport": [{"name": "Factory to shop", "type": "Sea freight", "km": 18000}, {"name": "Delivery", "type": "Light goods vehicle", "km": 80}],
    "static": None,
    "mobile": None,
}
show(mine)
""")
code("""
print("Materials:", ", ".join(DATA["materials"]))
print("Processes:", ", ".join(DATA["processes"]))
print("Transport:", ", ".join(DATA["transport"]))
print("Static use:", ", ".join(DATA["static"]))
print("Mobile use:", ", ".join(DATA["mobile"]))
""")

md("""
## 9 · What to remember

1. One phase usually dominates. Find it first; refine the data only if two phases are close.
2. Products that use energy (kettle, car, heater) are dominated by **use**: the target is efficiency or mass, not the embodied energy of the materials.
3. Products that do not (packaging, furniture, the bottle) are dominated by **material**: use less, use lower-energy materials, use recycled content.
4. Material substitution is a trade-off between phases; compute the break-even rather than guessing.
5. Differences under about 20% are not significant with data of this precision.

**Reference:** M. F. Ashby, P. Coulter, N. Ball, C. Bream, *The CES EduPack Eco Audit Tool — A White Paper*, Granta Design, 2012; M. F. Ashby, *Materials and the Environment: Eco-informed Material Choice*, 2nd ed., Butterworth-Heinemann, 2012.
""")

nb = {"cells": cells, "metadata": {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"}, "language_info": {"name": "python"}}, "nbformat": 4, "nbformat_minor": 5}
for i, c in enumerate(nb["cells"]):
    c["id"] = f"c{i:02d}"
    c["source"] = [l + "\n" for l in c["source"].split("\n")]; c["source"][-1] = c["source"][-1].rstrip("\n")
json.dump(nb, open(os.path.join(root, "notebooks", "eco_audit.ipynb"), "w"), indent=1, ensure_ascii=False)
print("written")
