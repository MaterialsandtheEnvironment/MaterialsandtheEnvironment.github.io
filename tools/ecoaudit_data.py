"""Builds data/ecoaudit.json and data/ecoaudit.js: the data of the simplified eco audit (Chapter 6 + notebook).

Values are rounded, typical figures in the spirit of Ashby, "Materials and the Environment" (2nd ed., 2012) and
the CES EduPack Eco Audit white paper (Ashby, Coulter, Ball, Bream, 2012). Where the white paper gives a number
(PET, PP, polymer molding, 14 t truck, electric-to-mechanical factor, bumper energies) it is used as is; the other
values were chosen so that the white-paper case studies are reproduced within about 10%. They are teaching data:
use Granta EduPack or a full LCA database for real decisions.
"""
import json, os

# name: [embodied energy MJ/kg, CO2 kg/kg, recycle fraction in current supply, recycled EE MJ/kg, recycled CO2 kg/kg, family]
MATERIALS = {
    "PET":                      [84, 2.3, 0.21, 36, 0.95, "Polymers"],
    "Polypropylene (PP)":       [95, 2.7, 0.06, 40, 1.4, "Polymers"],
    "Polyethylene (PE)":        [80, 2.1, 0.09, 38, 1.0, "Polymers"],
    "PVC":                      [60, 2.4, 0.08, 30, 1.2, "Polymers"],
    "Polycarbonate (PC)":       [110, 3.8, 0.01, 50, 2.0, "Polymers"],
    "Polyurethane (PU)":        [90, 3.5, 0.03, 45, 1.8, "Polymers"],
    "Polyester (thermoset)":    [85, 3.5, 0.0, 85, 3.5, "Polymers"],
    "Phenolic":                 [90, 3.0, 0.0, 90, 3.0, "Polymers"],
    "Rigid polymer foam":       [100, 3.8, 0.0, 100, 3.8, "Polymers"],
    "Natural rubber (NR)":      [65, 1.6, 0.0, 65, 1.6, "Elastomers"],
    "Butyl rubber":             [110, 4.0, 0.0, 110, 4.0, "Elastomers"],
    "Polyester fibre (textile)": [85, 3.0, 0.05, 40, 1.4, "Polymers"],
    "Low carbon steel":         [26, 1.9, 0.42, 9.0, 0.6, "Metals"],
    "Low alloy steel":          [32, 2.3, 0.42, 9.3, 0.6, "Metals"],
    "Stainless steel":          [81, 5.1, 0.36, 18, 1.2, "Metals"],
    "Cast iron":                [17, 1.3, 0.69, 7.0, 0.4, "Metals"],
    "Iron":                     [20, 1.5, 0.42, 7.0, 0.4, "Metals"],
    "Cast aluminium alloy":     [209, 12.0, 0.55, 21.7, 1.7, "Metals"],
    "Wrought aluminium alloy":  [200, 12.0, 0.42, 22, 1.7, "Metals"],
    "Copper":                   [65, 4.2, 0.42, 14, 0.9, "Metals"],
    "Brass":                    [70, 4.0, 0.42, 14, 0.9, "Metals"],
    "Nickel-chromium alloy":    [140, 8.5, 0.30, 30, 2.0, "Metals"],
    "Titanium alloy":           [650, 44, 0.22, 90, 6.0, "Metals"],
    "CFRP":                     [270, 21, 0.0, 270, 21, "Composites"],
    "GFRP":                     [110, 7.5, 0.0, 110, 7.5, "Composites"],
    "Borosilicate glass":       [25, 1.4, 0.20, 12, 0.7, "Ceramics & glass"],
    "Soda-lime glass":          [11, 0.75, 0.25, 7, 0.45, "Ceramics & glass"],
    "Concrete":                 [1.2, 0.14, 0.10, 0.8, 0.10, "Ceramics & glass"],
    "Cardboard":                [28, 1.1, 0.70, 18, 0.7, "Natural"],
    "Softwood":                 [10, 0.6, 0.0, 10, 0.6, "Natural"],
    "Water (dead weight)":      [0, 0, 0, 0, 0, "Other"],
}
# name: [MJ/kg, kg CO2/kg]
PROCESSES = {
    "Polymer molding": [6.8, 0.53],
    "Polymer extrusion": [5.9, 0.46],
    "Metal casting": [11.0, 0.84],
    "Metal deformation (forging, rolling)": [2.5, 0.19],
    "Machining (light)": [1.0, 0.08],
    "Glass molding": [8.0, 0.6],
    "Construction (assembly, cutting)": [0.0, 0.0],
    "None": [0.0, 0.0],
}
# MJ and kg CO2 per tonne.km
TRANSPORT = {
    "Sea freight": [0.13, 0.010], "River barge": [0.36, 0.026], "Rail freight": [0.25, 0.019],
    "32 tonne truck": [0.46, 0.033], "24 tonne truck": [0.71, 0.051], "14 tonne truck": [0.87, 0.062],
    "Light goods vehicle": [1.5, 0.11], "Air freight": [8.3, 0.59],
}
# static use: efficiency factor relative to primary (oil) energy, and kg CO2 per MJ of primary energy
STATIC = {
    "Electric to thermal": [0.33, 0.050], "Electric to mechanical": [0.28, 0.050],
    "Electric to light / electronics": [0.30, 0.050], "Fossil fuel to thermal (enclosed)": [0.90, 0.065],
    "Fossil fuel to mechanical": [0.35, 0.071],
}
# mobile use: the product adds mass to a vehicle; MJ and kg CO2 per tonne.km of added mass
MOBILE = {
    "Family car, gasoline": [2.06, 0.146], "Family car, diesel": [1.90, 0.136],
    "Light goods vehicle, diesel": [1.40, 0.100], "Bus, diesel": [0.75, 0.054],
}
# end of life: [disposal MJ/kg, disposal kg CO2/kg]; "recycle" also earns an EoL potential = -(EE_virgin - EE_recycled)
EOL = {"Landfill": [0.2, 0.014], "Recycle": [0.7, 0.049], "None": [0.0, 0.0]}

def comp(name, material, process, mass, eol="Landfill", recycled="virgin"):
    return {"name": name, "material": material, "process": process, "mass": mass, "eol": eol, "recycled": recycled}

PRODUCTS = [
    {"id": "bottle", "name": "Bottled water, 100 × 1 L PET bottles", "life": 1,
     "bom": [comp("Bottles (100)", "PET", "Polymer molding", 4.0, "Recycle"),
             comp("Caps (100)", "Polypropylene (PP)", "Polymer molding", 0.1),
             comp("Water, 100 L (dead weight)", "Water (dead weight)", "None", 100, "None")],
     "transport": [{"name": "Filling plant to shop", "type": "14 tonne truck", "km": 550}],
     "static": {"mode": "Electric to mechanical", "kW": 0.12, "hours_per_day": 24, "days_per_year": 2},
     "mobile": None,
     "reference": {"source": "White paper, Table 2", "energy": {"Material": 344, "Manufacture": 36, "Transport": 48, "Use": 74},
                   "co2": {"Material": 9.6, "Manufacture": 3.2, "Transport": 3.4, "Use": 3.7}},
     "story": "Polymer production dominates; transport of 100 kg of water over 550 km is only about 10%."},
    {"id": "reusable", "name": "Reusable steel bottle, 100 refills from the tap", "life": 1,
     "bom": [comp("Bottle", "Stainless steel", "Metal deformation (forging, rolling)", 0.30, "Recycle"),
             comp("Cap", "Polypropylene (PP)", "Polymer molding", 0.02)],
     "transport": [{"name": "Asia to Europe", "type": "Sea freight", "km": 10000},
                   {"name": "Distribution", "type": "32 tonne truck", "km": 500}],
     "static": {"mode": "Electric to thermal", "kW": 1.2, "hours_per_day": 0.042, "days_per_year": 100},
     "mobile": None,
     "reference": None,
     "story": "One steel bottle washed 100 times against 100 PET bottles: a new example, not from the white paper."},
    {"id": "kettle", "name": "Electric jug kettle, 2 kW", "life": 3,
     "bom": [comp("Kettle body", "Polypropylene (PP)", "Polymer molding", 0.86),
             comp("Heating element", "Nickel-chromium alloy", "Metal deformation (forging, rolling)", 0.026),
             comp("Element casing", "Stainless steel", "Metal deformation (forging, rolling)", 0.09),
             comp("Cable sheath, 1 m", "Natural rubber (NR)", "Polymer molding", 0.06),
             comp("Cable core, 1 m", "Copper", "Metal deformation (forging, rolling)", 0.015),
             comp("Plug body", "Phenolic", "Polymer molding", 0.037),
             comp("Plug pins", "Brass", "Metal deformation (forging, rolling)", 0.03),
             comp("Packaging, padding", "Rigid polymer foam", "Polymer molding", 0.015),
             comp("Packaging, box", "Cardboard", "Construction (assembly, cutting)", 0.125)],
     "transport": [{"name": "SE Asia to Europe", "type": "Air freight", "km": 11000},
                   {"name": "Distribution", "type": "24 tonne truck", "km": 250}],
     "static": {"mode": "Electric to thermal", "kW": 2.0, "hours_per_day": 0.15, "days_per_year": 365},
     "mobile": None,
     "reference": {"source": "White paper, Table 4", "energy": {"Material": 107, "Manufacture": 6.9, "Transport": 115, "Use": 3583}},
     "story": "Use dominates (about 94%): boiling water is the target, not the plastic or the air freight."},
    {"id": "car", "name": "Family car, 1 800 kg, 250 000 km", "life": 10,
     "bom": [comp("Steel", "Low alloy steel", "None", 850), comp("Aluminium", "Cast aluminium alloy", "None", 438),
             comp("Thermoplastics (PVC)", "PVC", "None", 74), comp("Thermoplastics (PU)", "Polyurethane (PU)", "None", 74),
             comp("Thermosets", "Polyester (thermoset)", "None", 93), comp("Elastomers", "Butyl rubber", "None", 40),
             comp("Glass", "Borosilicate glass", "None", 40), comp("Other metals", "Copper", "None", 61),
             comp("Textiles", "Polyester fibre (textile)", "None", 47)],
     "transport": [],
     "static": None,
     "mobile": {"mode": "Family car, gasoline", "km_per_day": 68.5, "days_per_year": 365, "mass_kg": 1800},
     "reference": {"source": "White paper, Figure 14", "energy": {"Material": 162000, "Use": 884000}},
     "story": "Only material and use are modelled: use is over 80% of the life energy."},
    {"id": "bumper_steel", "name": "Car bumper, steel (14 kg)", "life": 10,
     "bom": [comp("Bumper", "Low alloy steel", "None", 14)], "transport": [], "static": None,
     "mobile": {"mode": "Family car, gasoline", "km_per_day": 68.5, "days_per_year": 365},
     "reference": {"source": "White paper, Table 6 (virgin)", "energy": {"Material": 446, "Use": 7210}},
     "story": "Compare with the aluminium bumper."},
    {"id": "bumper_al", "name": "Car bumper, aluminium (10 kg)", "life": 10,
     "bom": [comp("Bumper", "Cast aluminium alloy", "None", 10)], "transport": [], "static": None,
     "mobile": {"mode": "Family car, gasoline", "km_per_day": 68.5, "days_per_year": 365},
     "reference": {"source": "White paper, Table 6 (virgin)", "energy": {"Material": 2088, "Use": 5150}},
     "story": "Lighter but more energy-intensive: which wins depends on distance and recycled content."},
    {"id": "heater", "name": "Portable LPG space heater, 9.3 kW", "life": 3,
     "bom": [comp("Heater casing", "Low carbon steel", "Metal deformation (forging, rolling)", 5.4),
             comp("Fan", "Low carbon steel", "Metal deformation (forging, rolling)", 0.25),
             comp("Heat shield", "Stainless steel", "Metal deformation (forging, rolling)", 0.4),
             comp("Motor rotor and stator", "Iron", "Metal deformation (forging, rolling)", 0.13),
             comp("Motor wiring", "Copper", "Metal deformation (forging, rolling)", 0.08),
             comp("Wire insulation", "Polyethylene (PE)", "Polymer molding", 0.08),
             comp("Hose, 2 m", "Natural rubber (NR)", "Polymer molding", 0.35),
             comp("Hose connector", "Brass", "Metal deformation (forging, rolling)", 0.09),
             comp("Other components (proxy)", "Polycarbonate (PC)", "Polymer molding", 0.22)],
     "transport": [{"name": "Korea to USA", "type": "Sea freight", "km": 10000},
                   {"name": "To point of sale", "type": "32 tonne truck", "km": 600}],
     "static": {"mode": "Fossil fuel to thermal (enclosed)", "kW": 9.3, "hours_per_day": 2, "days_per_year": 20},
     "mobile": {"mode": "Light goods vehicle, diesel", "km_per_day": 60, "days_per_year": 365},
     "reference": {"source": "White paper, Table 8", "energy": {"Use (static)": 4500, "Use (mobile)": 640}},
     "story": "Burning LPG dominates; carrying 7 kg around in a van adds about 13% of the use energy."},
]

data = {"note": __doc__.strip(), "materials": {k: dict(zip(["ee", "co2", "rf", "ee_rec", "co2_rec", "family"], v)) for k, v in MATERIALS.items()},
        "processes": {k: {"ee": v[0], "co2": v[1]} for k, v in PROCESSES.items()},
        "transport": {k: {"ee": v[0], "co2": v[1]} for k, v in TRANSPORT.items()},
        "static": {k: {"eff": v[0], "co2": v[1]} for k, v in STATIC.items()},
        "mobile": {k: {"ee": v[0], "co2": v[1]} for k, v in MOBILE.items()},
        "eol": {k: {"ee": v[0], "co2": v[1]} for k, v in EOL.items()},
        "products": PRODUCTS}
root = os.path.join(os.path.dirname(__file__), "..")
json.dump(data, open(os.path.join(root, "data", "ecoaudit.json"), "w"), indent=1, ensure_ascii=False)
open(os.path.join(root, "data", "ecoaudit.js"), "w").write("window.ECOAUDIT = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
print("materials", len(MATERIALS), "products", len(PRODUCTS))
