"""Build data/nfc.js: the data of Chapter 5 (natural fibre composites).

Source: D.U. Shah, "Natural fibre composites: Comprehensive Ashby-type materials selection charts",
Materials & Design 62 (2014) 21-31, doi:10.1016/j.matdes.2014.05.002, Supplementary Tables 1-4.
Tables are transcribed as published (Table 2 repeats three rows across a page break; they are kept once).

Composite cost and embodied energy are not tabulated in the paper. Following its footnote, they are
estimated per kg of composite from the weight fractions of fibre and matrix:
  reinforcement cost / energy by reinforcement form = mid-range of Supplementary Table 3,
  matrix cost = mid-range of the paper's text (thermoplastics 0.5-2 GBP/kg, thermosets 1-5 GBP/kg,
  epoxy at the upper end), matrix embodied energy = typical values (Ashby 2012), see MATRIX below.
"""
import json, os

R = lambda a, b=None: [a, a if b is None else b]

# Supplementary Table 1: fibres. rho g/cm3, E GPa, Esp GPa/(g/cm3), s MPa, ssp, strain %, cost GBP/kg, EE MJ/kg
FIBRES = [
    ("Flax", "Bast", R(1.45, 1.55), R(28, 100), R(19, 65), R(343, 1035), R(237, 668), R(2.7, 3.2), R(0.6, 2.1), R(9, 15)),
    ("Hemp", "Bast", R(1.45, 1.55), R(32, 60), R(22, 39), R(310, 900), R(214, 581), R(1.3, 2.1), R(0.5, 1.5), R(7, 14)),
    ("Jute", "Bast", R(1.35, 1.45), R(25, 55), R(19, 38), R(393, 773), R(291, 533), R(1.4, 3.1), R(0.1, 0.3), R(4, 8)),
    ("Sisal", "Leaf", R(1.40, 1.45), R(9, 28), R(6, 19), R(347, 700), R(248, 483), R(2.0, 2.9), R(0.6, 0.9), R(7, 14)),
    ("Pineapple", "Leaf", R(1.44, 1.56), R(6, 42), R(4, 27), R(170, 727), R(118, 466), R(0.8, 1.6), R(0.3, 0.6), R(1, 3)),
    ("Banana", "Leaf", R(1.30, 1.35), R(8, 32), R(6, 24), R(503, 790), R(387, 585), R(10, 12), R(0.6, 0.8), R(1, 3)),
    ("Cotton", "Seed", R(1.50, 1.60), R(5, 13), R(8, 12), R(287, 597), R(191, 373), R(6.0, 8.0), R(1.4, 4.0), R(40, 55)),
    ("Coir", "Seed", R(1.10, 1.20), R(6, 12), R(5, 12), R(131, 175), R(119, 146), R(15, 30), R(0.1, 0.3), R(1, 3)),
    ("Oil palm", "Seed", R(0.70, 1.55), R(4, 12), R(4, 12), R(248), R(160, 354), R(25), R(0.2, 0.4), R(1, 3)),
    ("Bamboo", "Other", R(0.60, 1.10), R(11, 30), R(18, 27), R(140, 230), R(210, 233), R(1.3), R(0.2, 0.4), R(3, 5)),
    ("Wood pulp", "Other", R(1.30, 1.50), R(40), R(26, 31), R(1000), R(667, 769), R(4.4), R(0.5, 0.6), R(2, 8)),
    ("E-glass", "Synthetic", R(2.55), R(78.5), R(31), R(1956), R(767), R(2.5), R(1.0, 2.3), R(30, 50)),
]
fibres = [dict(name=n, group=g, rho=a, E=b, Esp=c, s=d, ssp=e, strain=f, cost=h, ee=i) for n, g, a, b, c, d, e, f, h, i in FIBRES]

# Supplementary Table 3: reinforcement forms
FORMS = {
    "Pellets": dict(fibre="SF", length="<1 mm", eta_l=[0.0, 0.3], eta_o=[0.20, 0.37], eta=[0.0, 0.11], cost=[0.5, 1.5], ee=[5, 15]),
    "Nonwoven": dict(fibre="SF", length="3-30 mm", eta_l=[0.5, 0.9], eta_o=[0.38, 0.40], eta=[0.19, 0.36], cost=[1, 2], ee=[30, 40]),
    "Multiaxial": dict(fibre="LF", length=">30 mm", eta_l=[1.0, 1.0], eta_o=[0.25, 0.50], eta=[0.25, 0.5], cost=[10, 50], ee=[54, 146]),
    "Unidirectional": dict(fibre="LF", length=">30 mm", eta_l=[1.0, 1.0], eta_o=[1.0, 1.0], eta=[1.0, 1.0], cost=[10, 40], ee=[54, 146]),
}

# matrices: neat properties from Supplementary Table 2; cost / energy as described in the docstring
MATRIX = {
    "PP": dict(type="Thermoplastic", rho=0.91, E=[0.7, 1.7], Esp=[0.8, 1.9], s=[20, 35], ssp=[22, 39], cost=1.25, ee=95),
    "UP": dict(type="Thermoset", rho=1.2, E=[1.4, 4.7], Esp=[1.2, 3.9], s=[12, 75], ssp=[10, 63], cost=2.5, ee=85),
    "VE": dict(type="Thermoset", rho=1.15, E=None, Esp=None, s=None, ssp=None, cost=3.5, ee=100),
    "Epoxy": dict(type="Thermoset", rho=1.2, E=[3.1, 3.7], Esp=[2.7, 3.2], s=[60, 75], ssp=[50, 63], cost=4.0, ee=130),
}

# Supplementary Table 2 (process, form, layup, composite, fibre content, unit, E, Esp, s, ssp, ref)
T2 = [
    ("Injection moulding", "Pellets", "", "Flax/PP", 30, "wt", 1.7, 1.6, 27, 26, 43),
    ("Injection moulding", "Pellets", "", "Hemp/PP", 30, "wt", 1.5, 1.5, 30, 29, 44),
    ("Injection moulding", "Pellets", "", "Flax/PP + 5 wt% MAPP", 30, "wt", 2.1, 2.0, 38, 36, 43),
    ("Compression moulding", "Nonwoven", "", "Flax/PP", 40, "v", 8.8, 8.0, 57, 52, 45),
    ("Compression moulding", "Nonwoven", "", "Jute/PP", 30, "v", 3.7, 3.6, 27, 26, 5),
    ("Compression moulding", "Nonwoven", "", "Flax/PP + 3.5 wt% MAPP", 40, "v", 8.6, 7.8, 68, 62, 45),
    ("Compression moulding", "Nonwoven", "", "Flax/UP", 21, "wt", 11.0, 8.7, 80, 63, 46),
    ("Compression moulding", "Nonwoven", "", "Hemp/UP", 47, "wt", 5.6, 4.3, 36, 28, 47),
    ("Compression moulding", "Nonwoven", "", "Hemp/UP, 5% NaOH", 46, "wt", 7.5, 5.8, 46, 35, 47),
    ("Vacuum infusion", "Nonwoven", "", "Flax/UP", 30, "v", 6.3, 5.2, 61, 50, 48),
    ("Vacuum infusion", "Nonwoven", "", "Jute/UP", 30, "v", 8.0, 6.3, 50, 39, 48),
    ("Vacuum infusion", "Nonwoven", "", "Flax/epoxy, 1% NaOH", 22, "v", 9.2, 6.5, 60, 42, 49),
    ("Compression moulding", "Unidirectional", "", "Flax/PP", 43, "v", 26.9, 23.6, 251, 220, 50),
    ("Compression moulding", "Unidirectional", "", "Hemp/PP", 42, "v", 21.1, 18.2, 215, 185, 51),
    ("Compression moulding", "Unidirectional", "", "Hemp/PP + 0.2 wt% MAPP", 40, "v", 20.1, 17.5, 208, 181, 51),
    ("Hand lay-up", "Unidirectional", "", "Flax/UP", 19, "v", 6.5, 5.2, 150, 120, 52),
    ("Hand lay-up", "Unidirectional", "", "Flax/UP", 28, "v", 14.0, 10.8, 140, 108, 53),
    ("Compression moulding", "Unidirectional", "", "Flax/UP", 58, "v", 29.9, 23.0, 304, 233, 54),
    ("Compression moulding", "Unidirectional", "", "Jute/UP", 56, "v", 35.0, 28.2, 248, 200, 55),
    ("Compression moulding", "Unidirectional", "", "Jute/epoxy, 26% NaOH", 40, "v", 24.0, 18.8, 220, 172, 56),
    ("Vacuum infusion", "Unidirectional", "", "Flax/epoxy", 31, "v", 23.4, 18.0, 277, 212, 57),
    ("Vacuum infusion", "Unidirectional", "", "Jute/UP", 35, "v", 15.0, 12.1, 186, 150, 57),
    ("RTM", "Unidirectional", "", "Flax/epoxy", 42, "v", 35.0, 28.2, 280, 226, 58),
    ("RTM", "Unidirectional", "", "Flax/VE", 37, "v", 24.0, 16.9, 248, 175, 53),
    ("Prepregging", "Unidirectional", "", "Flax/epoxy", 42, "v", 39.9, 31.3, 378, 296, 59),
    ("Prepregging", "Unidirectional", "", "Flax/epoxy", 48, "v", 32.0, 24.7, 268, 207, 60),
    ("Compression moulding", "Multiaxial", "stitched [0, 90]", "Flax/epoxy [0, 90]", 44, "v", 14.3, 11.2, 170, 133, 61),
    ("Compression moulding", "Multiaxial", "stitched [±45]", "Flax/epoxy [±45]", 44, "v", 6.5, 5.1, 79, 62, 61),
    ("RTM", "Multiaxial", "plain weave", "Flax/VE [0, 90]", 33, "v", 7.3, 4.8, 81, 54, 53),
    ("RTM", "Multiaxial", "plain weave", "Flax/VE [0, 90]", 35, "v", 8.6, 5.7, 89, 59, 53),
    ("RTM", "Multiaxial", "plain weave", "Jute/VE [0, 90]", 41, "v", 10.0, 6.7, 111, 74, 53),
    ("Prepregging", "Multiaxial", "2x2 twill", "Flax/epoxy [0, 90]", 45, "v", 11.2, 8.2, 94, 69, 62),
    ("Prepregging", "Multiaxial", "2x2 twill", "Flax/epoxy [0, 90]", 36, "v", 10.0, 7.5, 104, 78, 62),
    ("Prepregging", "Multiaxial", "2x2 twill", "Flax/epoxy [0, 90]", 37, "v", 11.2, 8.5, 77, 59, 63),
    ("Prepregging", "Multiaxial", "2x2 twill", "Flax/epoxy [0, 90]", 54, "v", 9.3, 6.8, 78, 57, 63),
]
FRHO = {"Flax": 1.5, "Hemp": 1.5, "Jute": 1.4}
mid = lambda r: (r[0] + r[1]) / 2

composites = []
for proc, form, lay, name, fc, unit, E, Esp, s, ssp, ref in T2:
    fib = name.split("/")[0]
    mat = {"pp": "PP", "up": "UP", "ve": "VE", "epoxy": "Epoxy"}[name.split("/")[1].split()[0].rstrip(",").lower()]
    m = MATRIX[mat]
    rho = E / Esp
    rf = FRHO[fib]
    if unit == "wt":
        wf = fc / 100
        vf = wf * rho / rf
    else:
        vf = fc / 100
        wf = vf * rf / rho
    wf = min(wf, 0.95)
    F = FORMS[form]
    cost = wf * mid(F["cost"]) + (1 - wf) * m["cost"]
    ee = wf * mid(F["ee"]) + (1 - wf) * m["ee"]
    composites.append(dict(name=name, fibre=fib, matrix=mat, mtype=m["type"], form=form, layup=lay, process=proc,
                           fc=fc, unit=unit, vf=round(vf, 3), wf=round(wf, 3), rho=round(rho, 3), E=E, Esp=Esp, s=s, ssp=ssp,
                           cost=round(cost, 2), ee=round(ee, 1), ref=ref))

# Supplementary Table 4: fatigue (process, form, composite, fibre content, UTS MPa, specific, fatigue 1e6 MPa, specific, ref)
T4 = [
    ("Compression moulding", "Nonwoven", "Hemp/UP", "56 wt", 46, 35, 19, 15, 67),
    ("Compression moulding", "Nonwoven", "Hemp/UP", "44 wt", 53, 41, 23, 18, 68),
    ("Compression moulding", "Unidirectional", "Sisal/epoxy", "72 v", 330, 246, 125, 93, 69),
    ("Compression moulding", "Unidirectional", "Sisal/UP", "68 v", 223, 167, 101, 76, 69),
    ("Compression moulding", "Unidirectional", "Flax/epoxy", "43 v", 318, 243, 115, 88, 30),
    ("Vacuum infusion", "Unidirectional", "Flax/UP", "28 v", 143, 112, 59, 46, 29),
    ("Vacuum infusion", "Unidirectional", "Flax/UP", "27 v", 236, 183, 115, 89, 29),
    ("Vacuum infusion", "Unidirectional", "Jute/UP", "32 v", 175, 143, 85, 69, 29),
    ("Vacuum infusion", "Unidirectional", "Hemp/UP", "36 v", 171, 131, 83, 64, 29),
    ("Compression moulding", "Multiaxial", "Flax/epoxy [0, 90]", "44 v", 170, 133, 70, 55, 61),
    ("Compression moulding", "Multiaxial", "Flax/epoxy [±45]", "44 v", 79, 62, 46, 36, 61),
    ("RTM", "Multiaxial", "Hemp/epoxy [0, 90]", "36 v", 113, 91, 45, 36, 70),
    ("RTM", "Multiaxial", "Hemp/epoxy [±45]", "36 v", 66, 53, 38, 31, 70),
    ("Prepregging", "Unidirectional", "Flax/epoxy", "-", 304, None, 152, None, 71),
    ("Prepregging", "Multiaxial", "Flax/epoxy [±45]", "-", 68, None, 41, None, 71),
]
fatigue = [dict(process=a, form=b, name=c, fc=d, uts=e, uts_sp=f, fat=g, fat_sp=h, ref=i) for a, b, c, d, e, f, g, h, i in T4]

out = dict(source="Shah DU (2014) Materials & Design 62:21-31, doi:10.1016/j.matdes.2014.05.002, Supplementary Tables 1-4",
           fibres=fibres, forms=FORMS, matrices=MATRIX, composites=composites, fatigue=fatigue)
here = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(here, "..", "data", "nfc.js"), "w") as f:
    f.write("/* Chapter 5 data, generated by tools/nfc_data.py from Shah (2014), Supplementary Tables 1-4. */\n")
    f.write("window.NFC = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
print(len(fibres), "fibres,", len(composites), "composites,", len(fatigue), "fatigue rows")
for c in composites:
    print(f"{c['name']:28s} {c['matrix']:5s} {c['form']:14s} vf={c['vf']:.2f} wf={c['wf']:.2f} rho={c['rho']:.2f} cost={c['cost']:6.2f} ee={c['ee']:6.1f}")
