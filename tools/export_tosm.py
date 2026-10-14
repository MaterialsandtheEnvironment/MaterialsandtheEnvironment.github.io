"""Convert TOSM FinalResults.xlsx + Materials.xlsx (github.com/mid2SUPAERO/TOSM) to data/tosm.js."""
import json, sys
import pandas as pd

fr, mt, out = (sys.argv[1:4] + ["FinalResults.xlsx", "Materials.xlsx", "data/tosm.js"][len(sys.argv) - 1:])[:3]
d = pd.read_excel(fr, "FR"); m = pd.read_excel(mt)
key = {"Ti-6Al-4V": "Ti", "Al-2024": "Al", "AISI 304": "SS", "BeCu C17000": "BeCu"}
order = ["Ti", "Al", "SS", "BeCu"]
mats = sorted([dict(id=key[r.Material], name=r.Material, cls=r.Class, E=r["E [MPa]"] / 1000, rho=round(r["Density [t/mm^3]"] * 1e12),
                    nu=r["Poisson [-]"], cost=r["Cost [$/kg]"], co2=r["CO2 [kg/kg]"], energy=r["Energy [J/kg]"] / 1e6,
                    water=r["Water [L/kg]"], **{"yield": r["Yield_Str [MPa]"]}) for _, r in m.iterrows()], key=lambda x: order.index(x["id"]))
rows = {}
for _, r in d.iterrows():
    rows.setdefault(int(r.Name), {})[key[r.Material]] = [round(r["Mass [kg]"], 5), float(r["Max VM [MPa]"]), float(r["Max Disp [mm]"])]
data = {"source": "mid2SUPAERO/TOSM FinalResults.xlsx and Materials.xlsx", "useFactor": 98.8, "materials": mats,
        "fields": ["mass_kg", "vm_MPa", "disp_mm"], "brackets": [{"id": k, **v} for k, v in sorted(rows.items())]}
open(out, "w").write("window.TOSM = " + json.dumps(data, separators=(",", ":")) + ";\n")
