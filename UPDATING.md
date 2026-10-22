# Updating the atlas

Almost every update is an edit to a JSON file in `data/`, followed by `npm run validate`. The page, the counts, the map labels and the published downloads all follow the data, so there is nothing to rebuild by hand.

- [The loop](#the-loop)
- [Recipes](#recipes)
- [Prose that is typed, not computed](#prose-that-is-typed-not-computed)
- [Publishing with Git](#publishing-with-git)
- [First-time setup](#first-time-setup)

## The loop

```bash
npm run dev        # leave running; the page reloads on every save
# … edit data/*.json …
npm run validate   # fix anything it lists
npm run check      # full build + check, the same thing CI runs
```

Then record the change in `CHANGELOG.md` (one dated line; corrections in **bold**), bump `data_refreshed` in `data/meta.json` if the content changed, and commit (see [Publishing with Git](#publishing-with-git)).

**JSON tips.** Strings use double quotes. No trailing comma after the last item in a list or object. Text fields may contain `<b>…</b>`. Every file has a `"$comment"` at the top explaining its fields. If `npm run validate` says a file "could not be read as JSON", the message includes the line and column.

## Recipes

### Change an organization's evidence card

`data/sites.json` → find the organization by `id` → edit `dossier.rows` (each row is `{ "label": …, "text": … }`), `dossier.sources` and `dossier.grade`:

| grade | meaning |
| --- | --- |
| `D` | Documented in a primary source or credible press account, cited in `sources`. |
| `I` | Analytic inference: a reasoned conclusion, not a direct citation. |
| `V` | Reported but not independently confirmed. Should have a Watchlist item (`"verify": "vq-…"`). |

### Add an organization

1. In `data/sites.json`, add an object to the right site's `members` list, with a unique `id` (lower case, no spaces), `name`, `sub` (the small caps line), `type` (`anchor`, `intel`, `eng`, `guard`, `reserve` or `network`) and a `dossier`.
2. Optional: to show it in the relationship graph, add `"<id>": [x, y]` to `positions` in `data/network.json` (the graph is 900 × 660) and any `edges`.
3. `npm run validate`. Counts on the page, the pillar for the site and the "N ORGS" labels update by themselves.

### Add a site (a new place on the map)

Add an object to `sites` in `data/sites.json` with `id`, `label` (as shown on the map, upper case), `lat`, `lon` (verified, decimal degrees) and `members`. The validator rejects coordinates that fall off the terrain. Optionally add a camera preset to `presets` in `data/geography.json` using the same `id`, and a fly-to distance in `SITE_DIST` at the top of `src/modules/atlas.js`.

### Resolve a Watchlist item

In `data/watchlist.json`: set `status` to `verified` (or `partial`), write the `finding` (what the source says, with dates; if it overturns something on the page, say so plainly), then fix the affected content in `sites.json`. Set `dossier.grade` on each organization in `targets` to `D` if the finding documents it. (The "Mark verified" button on the page only changes that visitor's session.) Add a **bold** CHANGELOG line for any correction.

### Refresh the contract data

`data/contracts.json`: `radar` (each card's `status` is `compete`, `active`, `recurring` or `track`; a cell with `"kind": "outlook"` renders green), `ledger` (awards), `doors` (buying offices; links must be `https://`). Move `usaspending_filters.time_period` forward when the fiscal year turns (1 October) so the live pull covers the current window.

### Cities, interstates and camera presets

`data/geography.json`. Cities need verified `lat`/`lon` and `tier` (1 = always labelled, 2 = labelled when zoomed in). Interstates are drawn as smooth curves through the cities named in `via`; `label_segment` picks which stretch carries the shield. Presets are the chips above the map: `region`, `dayton` or any site id.

### The scroll story

The story text lives in `index.html` (the `.beat` blocks). The camera position for each beat is `STORY_BEATS` at the top of `src/modules/atlas.js`, one entry per beat in the same order. The validator fails the build if the two counts differ.

## Prose that is typed, not computed

Counts that come straight from the data are filled in automatically (`data-count="…"` in `index.html`: total organizations, cities, and the Beavercreek ring's "Twenty firms"). Everything else in the story and section intros is ordinary text and has to be updated by hand when the facts move. Search `index.html` for these when refreshing:

- headline figures: `$19.4B`, `103,200 jobs`, `38,000`, `$16B`, `~4,100 analysts`, `$866M`;
- dates: "Compiled Jul 2026; data refreshed Oct 2026" (Method), "Content as of Oct 2026" (footer), and the Method card's changelog list;
- "Four national primes' Dayton footprints remain [V]" (Method → Known gaps) — tracks `vq-primes`;
- the footer's **Key sources** list.

## Publishing with Git

Git keeps the history of every change; GitHub holds the shared copy and publishes the site. The everyday cycle, run from the `dayton-defense-intel-map` folder:

```bash
git pull                           # 1. get any changes made elsewhere (e.g. on github.com)
# … edit, npm run validate …
git status                         # 2. see which files changed
git add data/sites.json CHANGELOG.md     # 3. stage the files to include (or `git add .` for all)
git commit -m "Refresh NASIC card with Oct 2026 budget figure"   # 4. save a snapshot locally
git push                           # 5. send it to GitHub
```

The push to `main` starts the **pages** workflow (watch it under the repo's **Actions** tab). If the data validates and the build checks out, the live site updates a minute or two later. If it fails, the site stays as it was and the Actions log names the problem; fix it, commit, push again.

Useful when something looks off:

```bash
git diff                     # what changed, before you commit
git log --oneline -10        # recent commits
git restore data/sites.json  # throw away uncommitted edits to one file
```

To try a larger change without touching the live site, work on a branch: `git switch -c new-sites`, commit and `git push -u origin new-sites`, then open a pull request on GitHub. CI checks it; merging it into `main` publishes it.

## First-time setup

1. **Create the repository.** On github.com: **New repository** → name `dayton-defense-intel-map` → Public → leave "Add a README", ".gitignore" and "license" **unticked** (they are already here) → **Create repository**.
2. **Push this folder.** In a terminal opened in the `dayton-defense-intel-map` folder:

   ```bash
   npm install                  # creates node_modules/ (ignored by git) and checks the lockfile
   npm run check                # make sure it builds before the first push
   git init
   git add .
   git commit -m "Dayton Defense & Intel Map: initial public release"
   git branch -M main
   git remote add origin https://github.com/jakeperc/dayton-defense-intel-map.git
   git push -u origin main
   ```

3. **Turn on Pages.** Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**. Then **Actions → pages → Run workflow** (or push any commit). The site appears at `https://jakeperc.github.io/dayton-defense-intel-map/`.
4. **Link it from jakepercy.com.** If the portfolio is a GitHub Pages site with a custom domain, project sites inherit it, and the atlas is also served at `https://jakepercy.com/dayton-defense-intel-map/`. In that case set `site_url` in `data/meta.json` to that address so the page's canonical link and dataset metadata point there.
