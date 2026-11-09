## ADDED Requirements

### Requirement: Static How it works page
The repo SHALL contain a static page in `docs/how-it-works/` that renders every registry entry and the five Access promises from a generated `features.json`, designed with the Impeccable skill on D's token values, readable on a phone and axe-clean.

#### Scenario: Judge on a phone
- **WHEN** a judge opens the published page on a 390 px viewport
- **THEN** each feature shows what it does and its Gitar, Dash0 and Radar references with repo links, and the promises section lists P1-P5 with their rules and signals

#### Scenario: Accessible page
- **WHEN** axe runs on the built page at mobile and desktop widths
- **THEN** there are no violations, and the page reflows at 200% zoom

#### Scenario: Live values
- **WHEN** a reader wants live numbers
- **THEN** the page links to the app's `/under-the-hood` screen and does not show stale numbers as live

### Requirement: Builder from the registry
`scripts/build-how-it-works.mjs` SHALL build `features.json` from `web/src/under-the-hood/entries/*.json`, the EN strings and D's `PROMISES`, and SHALL fail naming the file when an entry is invalid or a key is missing. Generated output SHALL NOT be committed.

#### Scenario: Missing string
- **WHEN** an entry's `whatKey` has no EN string
- **THEN** the builder exits 1 and names the entry file and the key

#### Scenario: Clean build
- **WHEN** all entries are valid
- **THEN** the output folder holds `features.json`, the page files and a copy of `tokens.css`, and `git status` shows no generated file

### Requirement: Published with GitHub Pages
A `pages` workflow SHALL publish the built page on pushes to `main` that touch entries, EN strings, the page or the builder, with top-level `permissions: contents: read` and `pages: write` and `id-token: write` only on the deploy job.

#### Scenario: New entry published
- **WHEN** a change's entry file merges to `main`
- **THEN** the workflow runs and the published page lists that feature

#### Scenario: Not a merge gate
- **WHEN** a pull request runs CI
- **THEN** `pages` is not a required check and pushes no commit
