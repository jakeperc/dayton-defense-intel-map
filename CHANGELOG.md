# Changelog

Dated record of changes to the atlas. Corrections to published content are in **bold**, with what was wrong, what replaced it, and the source. Each correction is also recorded in the Watchlist finding that caught it (`data/watchlist.json`).

## 1.0.0 — 2026-10-22

- First public release as a repository. Content is unchanged from the October 2026 edition and now lives in `data/*.json` (CC BY 4.0), published beside the page for download. The page is built with Vite from ES modules; three.js is loaded after first paint; fonts are self-hosted. Adds the data validator (`npm run validate`), a post-build check, CI, GitHub Pages deployment, a single-file offline build (`npm run build:single`), and schema.org Dataset metadata.
- Renamed from "The Corridor Atlas" to Dayton Defense & Intel Map, so the name says what the map covers. The repository and the site address use the new name.
- Fix: on high-density screens (phones, Retina displays) the 3D canvas was drawn at its pixel size instead of the window size, so only part of the scene was visible and labels and taps did not line up with the pillars. The canvas is now sized to the window.
- Counts typed in the page text (total organizations, reference cities, firms in the Beavercreek ring) are now filled from the data.

## 2026-10

- Contract data refreshed (AMAC reset timeline, $125M facility IDIQ). Rebuilt as a 3D atlas with a scroll-driven story.
- Added a verified reference layer: 18 cities (city halls / municipal centers, place lookup Oct 2026) and four illustrative interstate routings, a locator minimap with compass and position readout, and a full-screen explore mode with presets, layer toggles and keyboard controls.

## 2026-07

- Verification pass: five Watchlist claims worked against primary sources.
  - **Correction: Macaulay-Brown (MacB) lineage.** The atlas said MacB had been acquired by KBR. MacB was acquired by Alion Science and Technology (a Veritas Capital portfolio company) in August 2018; Alion was acquired by Huntington Ingalls Industries for $1.65B, closing 19 August 2021, into HII's Technical Solutions division. KBR was never in that chain. KBR Wyle's place as a NASIC A&AS IDIQ awardee is unaffected. Sources: HII 8-K and FY2021 10-K; Veritas Capital. (`vq-kbr`)
  - **Correction: 655th ISR Wing lay-down.** The atlas placed the 71st Intelligence Squadron at Wright-Patterson, as a 2018 fact sheet implied. The 71st IS is at Fort Meade, Maryland, from where it supports NASIC's Geospatial & Signatures Intelligence Group. The 14th IS and 64th IS are confirmed at WPAFB, and the 655th ISR Group now lists seven squadrons, not three. Source: 445aw.afrc.af.mil. (`vq-655`)
  - Confirmed: 123rd Air Control Squadron active at Blue Ash ANGS under the 178th Wing (`vq-blueash`); AFRL Information Directorate at the Rome Research Site, NY, not WPAFB (`vq-rome`); Altamira Technologies at 2850 Presidential Dr, Fairborn (`vq-alt`).
- First compilation: sites and organizations mapped, coordinates verified by place lookup, every claim graded.
