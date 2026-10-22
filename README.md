# Dayton Defense & Intel Map

A 3D, evidence-graded open-source atlas of the **Wright-Patterson AFB / Dayton defense-intelligence corridor**: the institutions, contractors, money flows, contract vehicles and network relationships that make up the region, mapped from public sources only.

Scroll the story and the camera flies site by site down the corridor. Open the full map to orbit, pan and zoom across the region yourself. Click any pillar and its evidence card shows what is known, how well it is sourced, and where it came from.

**Live:** https://jakeperc.github.io/dayton-defense-intel-map/

> Every number and sentence on the page is rendered from the JSON in [`data/`](data/). Each organization carries an evidence grade: **[D]** documented in a primary source, **[I]** analytic inference, **[V]** reported but not yet independently confirmed. Claims that still need checking sit in the Watchlist, with the exact query that would settle them.

## What you get

| Path | What it is |
| --- | --- |
| `data/sites.json` | The 5 map sites and the 32 organizations at them. Each organization has a type, a grade, an evidence card (`rows`) and its `sources`. |
| `data/network.json` | The relationship graph: node positions and labelled edges between organizations. |
| `data/contracts.json` | Opportunity radar, award ledger, buying offices ("The Doors"), and the filter set used for the live USASpending pull. |
| `data/watchlist.json` | The verify-it-yourself queue: open, partial and resolved items, each with its query and finding. |
| `data/geography.json` | Map projection, reference cities (verified coordinates), interstate routings and camera presets. |
| `data/money.json` | The regional money-flow diagram. |
| `data/meta.json` | Title, dates (`data_refreshed` drives the "data refreshed" pill) and the public URL. |
| [`METHODOLOGY.md`](METHODOLOGY.md) | Evidence grading, scope, what is deliberately excluded, the map geometry and the known gaps. |
| [`UPDATING.md`](UPDATING.md) | How to change the data, check it, rebuild and publish. |
| [`CHANGELOG.md`](CHANGELOG.md) | Dated record of changes, corrections included. |

The same files are published beside the page (`/data/*.json`), so anyone can download the dataset without cloning the repo.

## Run it locally

You need [Node.js](https://nodejs.org/) 20.11 or newer (22 recommended; see `.nvmrc`).

```bash
git clone https://github.com/jakeperc/dayton-defense-intel-map.git
cd dayton-defense-intel-map
npm install          # once, or after package.json changes
npm run dev          # http://localhost:5173 — reloads as you edit data/ or src/
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server with live reload. |
| `npm run validate` | Checks every file in `data/`: required fields, allowed values, and that every id points at something real. Exits non-zero on any problem. |
| `npm run build` | Validates, then builds the site into `dist/`. |
| `npm run check` | Validate → build → check that everything `dist/` references exists. This is what CI runs. |
| `npm run preview` | Serves the built `dist/` locally, to see exactly what will be published. |
| `npm run build:single` | Builds one self-contained file, `dist-single/dayton-defense-intel-map.html` (~1 MB, fonts and three.js inlined). It opens by double-click with no server and no network. |

## How it is built

Plain HTML, CSS and JavaScript modules, bundled by [Vite](https://vitejs.dev/). No framework.

```
index.html               page markup (story copy, section shells)
data/*.json              all content (CC BY 4.0)
src/
  main.js                entry: fonts, styles, builds each section, then lazy-loads the 3D atlas
  lib/
    data.js              loads data/*.json and builds the shared lookups
    geo.js               the one projection used by the 3D scene and the locator map
    dom.js               colour tokens and small DOM helpers
    bus.js               late-bound map API (so "Open full map" works before three.js arrives)
  modules/
    atlas.js             three.js scene: terrain, pillars, cities, interstates, story camera,
                         explorer, picking, locator minimap, full-map mode
    inspector.js         the evidence card / site roster panel (bottom sheet on phones)
    story.js network.js money.js contracts.js watchlist.js deeplink.js fallback.js
  styles/01-…07-*.css    split by concern; imported in numeric order
scripts/
  validate-data.mjs      the data gate (runs before every build)
  check-dist.mjs         post-build sanity check
.github/workflows/
  ci.yml                 validate + build + check on every push and pull request
  pages.yml              same, then publish dist/ to GitHub Pages on pushes to main
```

The page renders every section from the data immediately; three.js (about 120 kB gzipped) is a separate chunk fetched after first paint. Browsers without WebGL2 get a plain grid in which every organization is still inspectable.

Links into the page: `?site=<site or organization id>` opens that card, and `?view=map` (optionally with `&site=…`) opens straight into the full map.

## Publishing

`pages.yml` publishes to GitHub Pages whenever `main` changes and the data validates. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. A push that fails validation or the build check leaves the live site as it was.

The build uses relative paths, so the same `dist/` also works from any folder on another host (for example `jakepercy.com/dayton-defense-intel-map/`). To build for a fixed path or a different canonical URL:

```bash
ATLAS_BASE=/dayton-defense-intel-map/ ATLAS_SITE_URL=https://jakepercy.com/dayton-defense-intel-map/ npm run build
```

## License and citation

Code is **MIT**. The data in `data/` is **CC BY 4.0**: use it for anything, with credit:

> Percy, J. *Dayton Defense & Intel Map*. https://github.com/jakeperc/dayton-defense-intel-map

Organization names are used for identification only; no affiliation or endorsement is implied. Bundled fonts are under the SIL Open Font License 1.1. See [LICENSE](LICENSE).

Corrections are welcome: open an issue with the claim, the source that contradicts it, and the date you checked.
