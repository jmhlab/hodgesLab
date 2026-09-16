"""Expand CIFs into supercell JSON for the three.js viewer."""
import json, glob, warnings, sys
import numpy as np
from ase.io import read
from ase.neighborlist import neighbor_list
from ase.data import covalent_radii, atomic_numbers

warnings.filterwarnings("ignore")

CATIONS_NO_BOND = {"K", "Cs", "Na", "Ba", "Rb"}
ANIONS = {"S", "Se", "Te", "O"}

# target box edge (Angstrom) per axis; structures repeat until they fill it
TARGET = {
    "Ba27Hf26Te78": (14, 14, 48),   # slab of the long axis
    "Cs2Hf3S6O": (18, 20, 15),
    "Cs3Fe4S2.5Te3.5": (17, 16, 19),
    "HfSSe_room_temp": (18, 18, 18),
    "KCu7Se4_RT": (21, 21, 16),
    "Ti-pharmacosiderite": (16, 16, 16),
}

def build(name):
    atoms = read(f"{name}.cif")
    occ = atoms.info.get("occupancy", {})
    cellpar = atoms.cell.cellpar()
    reps = [max(1, int(round(TARGET[name][i] / cellpar[i]))) for i in range(3)]
    sc = atoms.repeat(reps)
    # crop the long-axis slab for the big one
    if name == "Ba27Hf26Te78":
        z = sc.get_positions()[:, 2]
        keep = (z >= 0) & (z <= 48)
        sc = sc[keep]
    syms = sc.get_chemical_symbols()
    pos = sc.get_positions()
    # bonds: metal-anion only, scaled covalent radii
    i, j, d = neighbor_list("ijd", sc, cutoff=3.3)
    bonds = []
    for a, b, dist in zip(i, j, d):
        if a >= b:
            continue
        sa, sb = syms[a], syms[b]
        if sa in CATIONS_NO_BOND or sb in CATIONS_NO_BOND:
            continue
        if (sa in ANIONS) == (sb in ANIONS):
            continue
        rmax = (covalent_radii[atomic_numbers[sa]] + covalent_radii[atomic_numbers[sb]]) * 1.12
        if dist <= rmax:
            bonds.append([int(a), int(b)])
    center = pos.mean(axis=0)
    pos = pos - center
    out = {
        "name": name,
        "formula": atoms.get_chemical_formula(empirical=True),
        "reps": reps,
        "cell": (sc.cell[:] if name != "Ba27Hf26Te78" else np.array([atoms.cell[0], atoms.cell[1], [0,0,48.0]])).tolist(),
        "cellOrigin": (-center).tolist(),
        "elements": syms,
        "positions": np.round(pos, 3).tolist(),
        "bonds": bonds,
    }
    with open(f"{name}.json", "w") as f:
        json.dump(out, f)
    print(f"{name}: {len(syms)} atoms, {len(bonds)} bonds, reps {reps}")

for n in TARGET:
    build(n)
