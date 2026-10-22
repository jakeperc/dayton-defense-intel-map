# Methodology

## What this is

An open-source mapping of the Wright-Patterson AFB / Dayton defense-intelligence ecosystem — institutions, contractors, money flows, contract vehicles and the network layer between them — built with ICD-203-style evidence discipline. Compiled July 2026; data refreshed October 2026 (`data/meta.json` carries the exact dates).

## Evidence grading

Every organization card (`data/sites.json → dossier.grade`), radar card and ledger row carries one grade:

| Grade | Meaning |
| --- | --- |
| **[D] Documented** | Stated in a primary source (official fact sheet, contract announcement, government database, filing) or a credible press account. The source is cited on the card. |
| **[I] Analytic inference** | A reasoned conclusion drawn from documented facts, not a direct citation. Labelled as inference wherever it appears. |
| **[V] Verify** | Widely reported but not independently confirmed. Each [V] item has an entry in the Watchlist (`data/watchlist.json`) with the exact query that would settle it. |

A grade moves to [D] only when the confirming source is recorded in the Watchlist finding and the card's `sources`.

## Zero-fabrication rule

No organization, contract or program on the map is invented. Where a detail is properly non-public (for example, classified NASIC mission specifics), the card says so rather than speculating. When a published claim turns out to be wrong, the correction is made in the data, recorded in the Watchlist finding that caught it, and listed in bold in [CHANGELOG.md](CHANGELOG.md); it is not quietly deleted.

## Scope and OPSEC

Publicly released information only: official fact sheets, press releases, contract announcements, government databases and organization websites.

Deliberately excluded: personnel names, building-level operational detail, unit manning beyond published figures, and mission specifics past the public organizational structure. Aggregating open sources can itself create sensitivity; these exclusions are a choice, not an oversight.

## Components

Air National Guard (ANG) and Air Force Reserve (AFRC) units render as dashed pillars and rings. They are part-time components, distinct from full-time institutions, with different chains of command and accession paths.

## Geometry

- **Sites** — coordinates verified by live place lookup, July 2026.
- **Reference cities** — city halls / municipal centers, verified by place lookup, October 2026.
- **Projection** — equirectangular, with longitude scaled by cos(39.6°), so one map unit is the same distance east–west and north–south (`data/geography.json → projection`). Relative positions are true: Wright-Patterson and the Beavercreek ring really are about two road-miles apart, and the map does not spread them for legibility.
- **Terrain** — stylized; it carries no elevation data.
- **Interstates** — illustrative smooth routings drawn through verified city points, not traced highway geometry.
- **Brass arcs** — relationship links between sites, not roads.

## Money

The regional decomposition (`data/money.json`) is schematic: ribbon widths show structure, not exact proportions. Most WPAFB dollars flow to national primes performing locally; DoD award data carries a reporting lag of roughly 90 days on USASpending; classified actions appear in no public source.

## Live data

The Contracts section can query the public USASpending API from the visitor's browser (`data/contracts.json → usaspending_filters`: DoD awards, place of performance Dayton / Beavercreek / Fairborn / WPAFB). Those results are shown as returned and are not graded or stored. If the API is unreachable, the curated snapshot stands.

## Known gaps

- Classified contract actions are invisible to every public source used here.
- DoD award data lags about 90 days on USASpending.
- Four national primes' Dayton footprints remain [V] pending a USASpending pull (`vq-primes`).
- OTA consortium fees and current rosters are not published centrally (`vq-ota`).
- No DoD-specific crypto-analytics award has been found in open sources (`vq-crypto`); absence of a record is not evidence of absence.

## Schema

Each file in `data/` starts with a `"$comment"` describing its fields. `scripts/validate-data.mjs` is the executable version of the schema: required fields, allowed values (types, grades, statuses, colours), coordinates on the terrain, and referential integrity between files (Watchlist targets, network nodes and edges, interstate waypoints, presets, the story camera). It runs before every build, locally and in CI, and nothing is published unless it passes.
