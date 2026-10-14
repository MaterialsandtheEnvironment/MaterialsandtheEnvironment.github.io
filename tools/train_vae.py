"""Train the small Ashby VAE of chapter 2 and export weights for the browser.

Setup mirrors 'Ashby's Maps, Renewed': 22 CES/Granta materials, log10(E), log10(rho),
min-max normalised; encoder/decoder with one 250-unit ReLU layer; 2-D Gaussian latent;
beta = 4.5e-5; 10 000 Adam steps at lr 2e-3.
"""
import json, sys
import autograd.numpy as np
from autograd import grad
import numpy as onp

MATS = [
 ("Elastomers","Natural rubber",950,0.00165),("Elastomers","Polyurethane",1200,0.01625),
 ("Composites","Al/SiC composite",2780,90.5),("Composites","CFRP epoxy",1565,54.9),
 ("Composites","GFRP epoxy",1860,21.4),("Foams","Flexible polymer foam",54,0.002),
 ("Foams","Rigid polymer foam",320,0.34),("Metals & alloys","Al-alloys",2755,72),
 ("Metals & alloys","Nickel",8890,205),("Metals & alloys","Stainless steel",7740,200),
 ("Metals & alloys","Titanium alloys",4610,115),("Polymers","Epoxies",1270,2.41),
 ("Polymers","Phenolics",1280,3.795),("Polymers","Polyamides",1135,1.49),
 ("Polymers","Polycarbonate",1200,2.38),("Natural materials","Hardwood oak",940,22.9),
 ("Natural materials","Plywood",750,6.5),("Natural materials","Softwood pine",520,9.35),
 ("Technical ceramics","Alumina",3700,330),("Technical ceramics","Silicon carbide",3100,400),
 ("Technical ceramics","Silicon nitride",3195,310),("Technical ceramics","Zirconia",5400,200),
]
X = onp.array([[onp.log10(e), onp.log10(r)] for _,_,r,e in MATS])
lo, hi = X.min(0), X.max(0)
Xn = (X - lo) / (hi - lo)

H, L, BETA = 250, 2, 4.5e-5
rs = onp.random.RandomState(int(sys.argv[1]) if len(sys.argv) > 1 else 0)
def init(i, o): return [rs.randn(i, o) * onp.sqrt(2.0 / i), onp.zeros(o)]
P = init(2, H) + init(H, 2 * L) + init(L, H) + init(H, 2)

def enc(p, x):
    h = np.maximum(0, x @ p[0] + p[1]); o = h @ p[2] + p[3]
    return o[:, :L], o[:, L:]
def dec(p, z):
    h = np.maximum(0, z @ p[4] + p[5]); return 1 / (1 + np.exp(-(h @ p[6] + p[7])))

def loss(p, x, eps):
    mu, lv = enc(p, x); z = mu + np.exp(0.5 * lv) * eps
    rec = np.sum((dec(p, z) - x) ** 2)
    kl = -0.5 * np.sum(1 + lv - mu ** 2 - np.exp(lv))
    return rec + BETA * kl, rec, kl

g = grad(lambda p, x, e: loss(p, x, e)[0])
m = [onp.zeros_like(a) for a in P]; v = [onp.zeros_like(a) for a in P]
lr, b1, b2 = 2e-3, 0.9, 0.999
hist = []
for t in range(1, 10001):
    eps = rs.randn(len(Xn), L)
    gs = g(P, Xn, eps)
    for i in range(len(P)):
        m[i] = b1 * m[i] + (1 - b1) * gs[i]; v[i] = b2 * v[i] + (1 - b2) * gs[i] ** 2
        P[i] = P[i] - lr * (m[i] / (1 - b1 ** t)) / (onp.sqrt(v[i] / (1 - b2 ** t)) + 1e-8)
    if t % 100 == 0 or t == 1:
        tot, rec, kl = loss(P, Xn, eps); hist.append([t, float(tot), float(rec), float(kl)])

mu, _ = enc(P, Xn)
rec = dec(P, mu) * (hi - lo) + lo
errE = onp.abs(10 ** rec[:, 0] - 10 ** X[:, 0]) / 10 ** X[:, 0]
errR = onp.abs(10 ** rec[:, 1] - 10 ** X[:, 1]) / 10 ** X[:, 1]
print("mean err E %.1f%% max %.1f%% | rho %.1f%% max %.1f%%" % (100*errE.mean(), 100*errE.max(), 100*errR.mean(), 100*errR.max()))

r = lambda a: onp.round(onp.asarray(a, dtype=float), 5).tolist()
out = {
  "note": "Weights of a small VAE re-trained for this book following the published recipe; numbers differ slightly from the original notebook.",
  "lo": r(lo), "hi": r(hi), "order": ["log10E_GPa", "log10rho_kgm3"],
  "dec": {"W1": r(P[4]), "b1": r(P[5]), "W2": r(P[6]), "b2": r(P[7])},
  "materials": [{"family": f, "name": n, "rho": rho, "E": e, "z": r(mu[i]),
                  "Erec": float(10 ** rec[i, 0]), "rhorec": float(10 ** rec[i, 1])}
                 for i, (f, n, rho, e) in enumerate(MATS)],
  "loss": hist,
  "recon": {"E_mean": float(errE.mean()), "E_max": float(errE.max()), "rho_mean": float(errR.mean()), "rho_max": float(errR.max())},
}
open(sys.argv[2] if len(sys.argv) > 2 else "data/vae.js", "w").write("window.VAE = " + json.dumps(out, separators=(",", ":")) + ";\n")
