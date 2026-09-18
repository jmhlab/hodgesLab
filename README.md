# Hodges Group website

The website of the Hodges Research Group, Penn State Chemistry — **hodgeschemistry.com**.

It is a static site: a handful of page templates, plus plain text files that hold
everything that changes (news, people, papers). Edit a text file, save, and the
site rebuilds and publishes itself in about a minute. No server, no CMS, no cost.

---

## Updating content (this is the part everyone can do)

All content lives in `src/_data/`. Open the file on GitHub, click the pencil
icon, make the change, and click **Commit changes**. That's it.

| I want to… | Edit this file |
|---|---|
| Add a news item | `src/_data/news.yml` — add a block at the **top** |
| Add or update a group member | `src/_data/team.yml` |
| Move someone to alumni | `src/_data/team.yml` — cut their block, paste under `alumni:` |
| Add a paper | `src/_data/publications.yml` — add at the **top** with the next number |
| Add a patent | `src/_data/patents.yml` |
| Add an award or presentation | `src/_data/accomplishments.yml` |
| Change the research blurbs | `src/_data/research.yml` |
| Change instruments / furnaces | `src/_data/lab.yml` |
| Add gallery photos | drop the file in `src/assets/img/gallery/`, list it in `src/_data/gallery.yml` |
| Change the headline, stats, contact, nav | `src/_data/site.yml` |

Each file has a comment at the top showing the exact format. Copy an existing
block and change the words. Two rules keep YAML happy:

1. Indentation matters — use spaces, and match the block you copied.
2. If a title contains a colon (`:`), wrap the whole title in double quotes.

### Photos

- Team photos go in `src/assets/img/team/` and are referenced by filename in
  `team.yml` (`photo: ayat.jpg`). Square crops look best.
- Lab photos go in `src/assets/img/lab/`; gallery photos in `src/assets/img/gallery/`.
- Keep images under ~500 KB. Resize before uploading (1600 px on the long side is plenty).

If a referenced photo is missing, the site shows a neutral placeholder rather than
a broken image.

---

## Crystal structures

The rotating 3D structures are built from the group's own CIF files.

```
tools/cif/              the CIF files
tools/build_ballstick.py   CIF -> ball-and-stick JSON
tools/build_polyhedra.py   CIF -> coordination-polyhedra JSON
src/assets/structures/  the JSON the site loads
src/_data/structures.yml   which structure appears where, and how (view, projection, spin)
```

To add a structure (needs Python with `ase`, `numpy`, `scipy`):

```bash
pip install ase scipy
# ball and stick
python3 tools/build_ballstick.py            # edit the TARGET dict in the script for box size
# polyhedra around Hf, dropping water oxygens and Na
python3 tools/build_polyhedra.py MyCompound Hf 2x2x2 mycompound_poly --no-water --drop=Na
```

Move the resulting `.json` into `src/assets/structures/`, add an entry to
`src/_data/structures.yml`, and reference it from `research.yml` or `site.yml`.

---

## Running the site on your own computer (optional)

You only need this if you want to preview changes before committing.

```bash
npm install        # once
npm run serve      # then open http://localhost:8080
```

`npm run build` writes the finished site to `_site/`.

---

## How it's published

- Hosting: GitHub Pages (free). The workflow in `.github/workflows/deploy.yml`
  builds and publishes on every push to `main`.
- One-time setup: repository **Settings → Pages → Source: GitHub Actions**.
- Custom domain: add a file `src/CNAME` containing `www.hodgeschemistry.com`
  and point the domain's DNS at GitHub Pages (Settings → Pages shows the
  records). The build picks the file up automatically. Until then the site is
  live at `https://<username>.github.io/<repo>/`.

Built with [Eleventy](https://www.11ty.dev/) and [three.js](https://threejs.org/).
Type: Space Grotesk (headings), Archivo (body), IBM Plex Mono (labels) via Google Fonts.
