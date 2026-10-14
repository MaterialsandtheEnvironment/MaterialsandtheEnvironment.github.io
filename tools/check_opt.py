import json, sys, numpy as np
src = open(sys.argv[1]).read(); d = json.loads(src[src.index("{"):src.rindex("}") + 1]); W = {k: np.array(v) for k, v in d['dec'].items()}
lo, hi = np.array(d['lo']), np.array(d['hi'])
Z = np.array([m['z'] for m in d['materials']]); zmin, zmax = Z.min(0), Z.max(0)
lam = float(sys.argv[2]) if len(sys.argv) > 2 else 1e-3
MU = float(sys.argv[3]) if len(sys.argv) > 3 else 0
def dec(z):
    h = np.maximum(0, z @ W['W1'] + W['b1']); o = 1 / (1 + np.exp(-(h @ W['W2'] + W['b2'])))
    return o * (hi - lo) + lo
def f(z, a):
    lE, lr = dec(z[None])[0]; return -(a * (lE + 9) - lr) + lam * (z @ z) + MU * ((Z - z) ** 2).sum(1).min()
for a, nm in [(1, 'bar'), (.5, 'beam'), (1/3, 'panel')]:
    best = None
    for sx in np.linspace(zmin[0], zmax[0], 7):
        for sy in np.linspace(zmin[1], zmax[1], 5):
            z = np.array([sx, sy]); m = np.zeros(2); v = np.zeros(2)
            for t in range(1, 601):
                gg = np.array([(f(z + e, a) - f(z - e, a)) / 2e-4 for e in np.eye(2) * 1e-4])
                m = .9 * m + .1 * gg; v = .999 * v + .001 * gg ** 2
                z = np.clip(z - 0.05 * (m / (1 - .9 ** t)) / (np.sqrt(v / (1 - .999 ** t)) + 1e-8), zmin, zmax)
            val = f(z, a)
            if best is None or val < best[0]: best = (val, z)
    z = best[1]; lE, lr = dec(z[None])[0]; k = np.argmin(((Z - z) ** 2).sum(1))
    print(nm, 'E=%.3g GPa rho=%.0f' % (10 ** lE, 10 ** lr), d['materials'][k]['name'])
