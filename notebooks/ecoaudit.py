"""A simplified eco audit (energy and CO2 over the life of a product), after the CES EduPack Eco Audit Tool.

    audit(product, data) -> dict with energy (MJ) and CO2 (kg) per life phase, per component, and the end-of-life potential.

A product is a dict: life (years); bom = list of components {name, material, process, mass (kg), eol, recycled};
transport = list of stages {name, type, km}; static = {mode, kW, hours_per_day, days_per_year} or None;
mobile = {mode, km_per_day, days_per_year[, mass_kg]} or None. `recycled` is "virgin", "typical"
(recycle fraction in current supply) or a percentage 0-100.
"""
PHASES = ["Material", "Manufacture", "Transport", "Use", "Disposal"]

def recycled_fraction(comp, mat):
    r = comp.get("recycled", "virgin")
    if r == "virgin": return 0.0
    if r == "typical": return mat["rf"]
    return max(0.0, min(1.0, float(r) / 100))

def audit(product, data):
    M, P, T, S, MO, EOL = (data[k] for k in ["materials", "processes", "transport", "static", "mobile", "eol"])
    life = product["life"]
    E = dict.fromkeys(PHASES, 0.0); C = dict.fromkeys(PHASES, 0.0)
    comps = []
    total_mass = sum(c["mass"] for c in product["bom"])
    eolE = eolC = 0.0
    for c in product["bom"]:
        m = M[c["material"]]; f = recycled_fraction(c, m)
        ee = (1 - f) * m["ee"] + f * m["ee_rec"]; co2 = (1 - f) * m["co2"] + f * m["co2_rec"]
        p = P.get(c.get("process", "None"), P["None"])
        d = EOL.get(c.get("eol", "Landfill"), EOL["None"])
        row = {"name": c["name"], "material": c["material"], "mass": c["mass"], "recycled_%": round(100 * f),
               "Material E": c["mass"] * ee, "Material C": c["mass"] * co2,
               "Manufacture E": c["mass"] * p["ee"], "Manufacture C": c["mass"] * p["co2"],
               "Disposal E": c["mass"] * d["ee"], "Disposal C": c["mass"] * d["co2"]}
        for k in ["Material", "Manufacture", "Disposal"]:
            E[k] += row[k + " E"]; C[k] += row[k + " C"]
        if c.get("eol") == "Recycle":   # credit for the material that recycling can return to the next life
            eolE -= c["mass"] * (m["ee"] - m["ee_rec"]); eolC -= c["mass"] * (m["co2"] - m["co2_rec"])
        comps.append(row)
    for s in product.get("transport") or []:
        t = T[s["type"]]; tkm = total_mass / 1000 * s["km"]
        E["Transport"] += tkm * t["ee"]; C["Transport"] += tkm * t["co2"]
    use = {"static E": 0.0, "static C": 0.0, "mobile E": 0.0, "mobile C": 0.0}
    st = product.get("static")
    if st:
        s = S[st["mode"]]; delivered_MJ = st["kW"] * st["hours_per_day"] * st["days_per_year"] * life * 3.6
        primary = delivered_MJ / s["eff"]
        use["static E"] = primary; use["static C"] = primary * s["co2"]
    mo = product.get("mobile")
    if mo:
        v = MO[mo["mode"]]; mass_t = mo.get("mass_kg", total_mass) / 1000
        tkm = mass_t * mo["km_per_day"] * mo["days_per_year"] * life
        use["mobile E"] = tkm * v["ee"]; use["mobile C"] = tkm * v["co2"]
    E["Use"] = use["static E"] + use["mobile E"]; C["Use"] = use["static C"] + use["mobile C"]
    return {"energy": E, "co2": C, "total_energy": sum(E.values()), "total_co2": sum(C.values()),
            "eol_energy": eolE, "eol_co2": eolC, "components": comps, "use": use, "mass": total_mass}

def dominant(result, key="energy"):
    d = result[key]; tot = sum(d.values()); ph = max(d, key=d.get)
    return ph, d[ph] / tot if tot else 0.0

STRATEGIES = {
    "Material": "Use less material (lighter design), choose materials with lower embodied energy, use recycled content.",
    "Manufacture": "Choose less energy-intensive processes, reduce scrap and process steps.",
    "Transport": "Shorten distances, switch to a more efficient mode (sea, rail, large truck instead of air or small van).",
    "Use": "If it moves: cut mass. If it heats or cools: improve thermal efficiency. If it is electro-mechanical: cut losses.",
    "Disposal": "Design for disassembly and recycling; this phase is rarely dominant.",
}
