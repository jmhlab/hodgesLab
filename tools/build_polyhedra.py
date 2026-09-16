"""Polyhedral export: coordination polyhedra around chosen centres, complete at the edges."""
import json, warnings, sys
import numpy as np
from ase.io import read
from ase.neighborlist import neighbor_list
from ase.data import covalent_radii, atomic_numbers
from scipy.spatial import ConvexHull

warnings.filterwarnings("ignore")

name = [a for a in sys.argv if not a.startswith("--")][1]                       # e.g. Ti-pharmacosiderite
centres = [a for a in sys.argv if not a.startswith("--")][2].split(",")         # e.g. Ti  or  Ti,Si
args = [a for a in sys.argv if not a.startswith("--")]
reps = [int(x) for x in args[3].split("x")] if len(args) > 3 else [2, 2, 2]
out_name = args[4] if len(args) > 4 else f"{name}_poly"

CATIONS_NO_BOND = {"K", "Cs", "Na", "Ba", "Rb"}
ANIONS = {"S", "Se", "Te", "O"}

atoms = read(f"{name}.cif")
cell = atoms.cell[:]
pad = [r + 2 for r in reps]                       # one extra cell each side
big = atoms.repeat(pad)
big.translate(-(cell[0] + cell[1] + cell[2]))     # shift so the wanted block starts at origin
syms = np.array(big.get_chemical_symbols())
pos = big.get_positions()
frac = np.linalg.solve(cell.T, pos.T).T           # fractional coords in the single cell basis

def bonded(sa, sb, dist):
    if sa in CATIONS_NO_BOND or sb in CATIONS_NO_BOND:
        return False
    if (sa in ANIONS) == (sb in ANIONS):
        return False
    rmax = (covalent_radii[atomic_numbers[sa]] + covalent_radii[atomic_numbers[sb]]) * 1.12
    return dist <= rmax

i, j, d = neighbor_list("ijd", big, cutoff=3.3)
nbrs = {}
for a, b, dist in zip(i, j, d):
    if bonded(syms[a], syms[b], dist):
        nbrs.setdefault(int(a), []).append(int(b))

inside = np.all((frac >= -1e-6) & (frac < np.array(reps) - 1e-6), axis=1)

drop_water = '--no-water' in sys.argv
drop_els = set(next((a.split('=')[1].split(',') for a in sys.argv if a.startswith('--drop=')), []))
keep = set(int(a) for a in np.where(inside)[0] if not (drop_water and syms[a] == 'O' and not nbrs.get(int(a))) and syms[a] not in drop_els)
polys = []
for a in np.where(inside)[0]:
    if syms[a] not in centres:
        continue
    vs = nbrs.get(int(a), [])
    if len(vs) < 4:
        continue
    pts = pos[vs]
    hull = ConvexHull(pts)
    polys.append({"el": syms[a], "center": int(a), "verts": vs, "faces": hull.simplices.tolist()})
    keep.update(vs)

keep = sorted(keep)
remap = {old: new for new, old in enumerate(keep)}
bonds = []
for a in keep:
    for b in nbrs.get(a, []):
        if b in remap and a < b:
            bonds.append([remap[a], remap[b]])
for p in polys:
    p["center"] = remap[p["center"]]
    p["verts"] = [remap[v] for v in p["verts"]]

kp = pos[keep]
centre = kp.mean(axis=0)
sc_cell = cell * np.array(reps)[:, None]
out = {
    "name": out_name,
    "formula": atoms.get_chemical_formula(empirical=True),
    "reps": reps,
    "cell": sc_cell.tolist(),
    "cellOrigin": (-centre).tolist(),
    "elements": syms[keep].tolist(),
    "positions": np.round(kp - centre, 3).tolist(),
    "bonds": bonds,
    "polyhedra": polys,
}
json.dump(out, open(f"{out_name}.json", "w"))
print(f"{out_name}: {len(keep)} atoms, {len(bonds)} bonds, {len(polys)} polyhedra ({', '.join(centres)})")
