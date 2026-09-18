"""Export a structure as a fixed Cartesian window centred on a chosen atom, so two
phases can be compared in the same frame. Keeps per-atom occupancy for ghost rendering."""
import json, sys, warnings
import numpy as np
from ase.io import read
from ase.neighborlist import neighbor_list
from ase.data import covalent_radii, atomic_numbers

warnings.filterwarnings("ignore")
CATIONS_NO_BOND = {"K", "Cs", "Na", "Ba", "Rb"}
ANIONS = {"S", "Se", "Te", "O"}

def export(cif, out, reps, rot_deg, centre_el, half_xy, half_z, label, drop_edge_cations=True):
    atoms = read(cif)
    occ_map = atoms.info.get("occupancy", {})
    # per-site occupancy of the primitive atoms (ASE keeps first species' occupancy)
    base_occ = np.ones(len(atoms))
    for i in range(len(atoms)):
        o = occ_map.get(str(atoms.arrays["spacegroup_kinds"][i]) if "spacegroup_kinds" in atoms.arrays else str(i))
        if o:
            base_occ[i] = list(o.values())[0] if atoms[i].symbol not in o else o[atoms[i].symbol]
    sc = atoms.repeat(reps)
    occ = np.tile(base_occ, int(np.prod(reps)))
    pos = sc.get_positions()
    syms = np.array(sc.get_chemical_symbols())
    th = np.deg2rad(rot_deg)
    R = np.array([[np.cos(th), -np.sin(th), 0], [np.sin(th), np.cos(th), 0], [0, 0, 1]])
    pos = pos @ R.T
    # centre on the K column nearest the block centre
    ks = np.where(syms == centre_el)[0]
    c0 = pos.mean(axis=0)
    kc = ks[np.argmin(np.linalg.norm(pos[ks][:, :2] - c0[:2], axis=1))]
    pos = pos - np.array([pos[kc, 0], pos[kc, 1], 0])
    zc = pos[:, 2].mean()
    pos[:, 2] -= zc
    keep = (np.abs(pos[:, 0]) <= half_xy) & (np.abs(pos[:, 1]) <= half_xy) & (np.abs(pos[:, 2]) <= half_z)
    pos, syms, occ = pos[keep], syms[keep], occ[keep]
    # bonds on the cropped set (plain distance search)
    from scipy.spatial import cKDTree
    tree = cKDTree(pos)
    pairs = tree.query_pairs(3.3)
    bonds = []
    for a, b in pairs:
        sa, sb = syms[a], syms[b]
        if sa in CATIONS_NO_BOND or sb in CATIONS_NO_BOND: continue
        if (sa in ANIONS) == (sb in ANIONS): continue
        d = np.linalg.norm(pos[a] - pos[b])
        if d <= (covalent_radii[atomic_numbers[sa]] + covalent_radii[atomic_numbers[sb]]) * 1.12:
            bonds.append([int(a), int(b)])
    out_d = {"name": out, "formula": atoms.get_chemical_formula(empirical=True), "label": label,
             "cell": (atoms.cell[:] @ R.T).tolist(), "cellOrigin": [0, 0, 0],
             "elements": syms.tolist(), "positions": np.round(pos, 3).tolist(), "bonds": bonds,
             "occupancy": np.round(occ, 3).tolist()}
    json.dump(out_d, open(f"{out}.json", "w"))
    from collections import Counter
    print(out, len(syms), "atoms", len(bonds), "bonds; occupancy classes:", Counter(np.round(occ, 2)))

# RT: a=10.46, 3x3x5 block, no rotation; window ±10.0 Å (excludes K on the ±a edge)
export("KCu7Se4_RT.cif", "KCu7Se4_RT_win", (3, 3, 5), 0, "K", 10.0, 8.0, "293 K")
# 90 K: a=14.75 (=a_RT*sqrt2), rotated 45 deg so tunnel axes align; 3x3x3 block
export("KCu7Se4_90K.cif", "KCu7Se4_90K_win", (3, 3, 3), 45, "K", 10.0, 8.0, "90 K")
