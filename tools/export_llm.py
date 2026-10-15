"""Build data/llm.js for chapter 5 from github.com/grndnl/llm_material_selection_jcise.

usage: python3 export_llm.py <repo_dir_with data/survey_responses.csv and generation/answers/> data/llm.js
Reproduces data/remap_data.py (experts only, kitchen-grip/lightweight downsampled to 800, random_state=2)
and the z-score / mean-distance definitions of evaluation/z-score.py and evaluation/mean_distance.py.
"""
import json, os, sys
import numpy as np, pandas as pd

src, out = sys.argv[1], sys.argv[2]
DESIGNS = ["kitchen utensil grip", "spacecraft component", "underwater component", "safety helmet"]
CRITERIA = ["lightweight", "heat resistant", "corrosion resistant", "high strength"]
MATS = ["Steel", "Aluminium", "Titanium", "Glass", "Wood", "Thermoplastic", "Elastomer", "Thermoset", "Composite"]

df = pd.read_csv(os.path.join(src, "data/survey_responses.csv"))
n_all = len(df)
df = df[df["material_familiarity"] == "Yes"]
rows = []
for q in range(1, 17):
    for m in MATS:
        for _, r in df.iterrows():
            rows.append({"design": DESIGNS[(q - 1) // 4], "criteria": CRITERIA[(q - 1) % 4], "material": m.lower(), "response": r[f"Q{q}_{m}"]})
mp = pd.DataFrame(rows)
f = mp[(mp.design == DESIGNS[0]) & (mp.criteria == CRITERIA[0])]
mp = pd.concat([mp[~((mp.design == DESIGNS[0]) & (mp.criteria == CRITERIA[0]))], f.sample(n=800, random_state=2)]).dropna()

# histogram per (design, criteria, material): 11 bins, scores 0..10
# histogram per cell, cell index = (design*4 + criterion)*9 + material, 11 bins for scores 0..10
hist = []
for d in DESIGNS:
    for c in CRITERIA:
        for m in MATS:
            g = mp[(mp.design == d) & (mp.criteria == c) & (mp.material == m.lower())]
            hist.append(np.bincount(g.response.astype(int).clip(0, 10), minlength=11).tolist())
stats = mp.groupby(["design", "criteria", "material"])["response"].agg(["mean", "std"]).reset_index()

MODELS = {"gpt-4-0125-preview": "GPT-4", "mixtral": "Mixtral", "melm": "MechGPT"}
EXPS = ["zero-shot", "few-shot", "parallel", "chain-of-thought", "temperature-0", "temperature-0.2", "temperature-0.4", "temperature-0.6", "temperature-0.8", "temperature-1"]
answers, check = {}, []
for mk, mn in MODELS.items():
    for e in EXPS:
        ee = "temperature-0.1" if (mk == "melm" and e == "temperature-0") else e
        a = pd.read_csv(os.path.join(src, f"generation/answers/{ee}_{mk}.csv"))
        try:
            a["response"] = a["response"].str.extract(r"(\d+)").astype(int)
        except Exception:
            pass
        a["response"] = a["response"].apply(lambda x: min(10, max(0, x)))
        lut = {(r.design, r.criteria, r.material): int(r.response) for r in a.itertuples()}
        answers[f"{mn}|{ee}"] = [lut[(d, c, m.lower())] for d in DESIGNS for c in CRITERIA for m in MATS]
        mg = a.merge(stats, on=["design", "criteria", "material"], how="left")
        z = ((mg.response - mg["mean"]) / mg["std"]).mean()
        mae = np.mean([np.abs(mp[(mp.design == r.design) & (mp.criteria == r.criteria) & (mp.material == r.material)].response - r.response).mean() for r in a.itertuples()])
        check.append((mn, ee, round(z, 3), round(mae, 3)))
for c in check: print(*c)

data = {"source": "github.com/grndnl/llm_material_selection_jcise (survey + generation/answers)", "respondents": int(n_all), "experts": int(len(df)),
        "n": int(len(mp)), "designs": DESIGNS, "criteria": CRITERIA, "materials": [m.lower() for m in MATS], "hist": hist, "answers": answers}
open(out, "w").write("window.LLMSEL = " + json.dumps(data, separators=(",", ":")) + ";\n")
