## Context

C0 creates the append-only registry `web/src/under-the-hood/` (types, `registry.ts`, `validate.ts`, design D3b in c0-scaffold). Every change adds exactly one `entries/<change-id>.json` in its own PR, so entries land in parallel and H never edits them. H turns the entries into two views. One agent, about 2 h.

## Interfaces consumed

- C0: `ENTRIES: UnderTheHoodEntry[]` and the types `UnderTheHoodEntry`, `TechRef` from `web/src/under-the-hood/`; `web/src/routes.ts`, `web/src/nav.ts`; `api()` with `X-Device-Id`; browser telemetry.
- D: `tokens.css`, `t()`, `announce()`, `PROMISES` from `web/src/features/access/promises.ts`.
- F: `GET /api/status/health` (`HealthSnapshot`, including `promises` and `routes`) and `GET /api/status/release` (204 when absent). Both are optional at runtime: a 404, an error or `source: 'unavailable'` means no live value, never a guessed one.

## Interfaces provided

None to other changes. The screen and page only read.

## Decisions

1. **Live value resolver.** A pure function `resolveLive(ref, snapshot, release)` in `web/src/screens/under-the-hood/live.ts`:
   - `promise:Pn` gives the light state from `snapshot.promises[Pn]`, shown with the same words as F ("Working", "Slower than promised", "Not measured right now");
   - `route:<METHOD> <path>` gives the p95 from `snapshot.routes`, as "p95 180 ms, measured 15:52" in America/Denver;
   - `release` gives "Last release 15:52, Gitar-reviewed, Radar all-clear" from the release record, dropping missing clauses like F's footer.
   No data gives "No live data right now". The screen fetches once on open and every 30 s while visible, and stops when hidden.
2. **Links.** A `ref` that is a repo path links to `https://github.com/rfun-solutions/wemakedevs_hackathon_2026/blob/main/<ref>` (the repo is public). A Dash0 trace or query is shown as its name and expression in `<code lang="en">`, with the note "Dash0 sign-in needed" instead of a link that judges cannot open. A Radar shared investigation URL is linked when present.
3. **Screen layout.** Mobile first, D's tokens only. One section per entry in merge order: title, one plain sentence, promise chips (D's text, not colour alone), then three short lists headed Gitar, Dash0 and Radar (a list is omitted when empty). The technical labels are code, not translated, and carry `lang="en"`. Reached from a secondary nav item "How it works", not from the main capture flow.
4. **Static page.** `docs/how-it-works/index.html`, `style.css` and `app.js` are hand-written (no framework, no build step for the page itself). `app.js` fetches `features.json` and renders the same structure as the screen, plus a "Our promises to Kay" section (P1-P5 with their rules and signals) and a "See it live" link to the app's `/under-the-hood`. The design comes from the Impeccable skill (task 1.1), using the colour and type values of D's `tokens.css`, which the build copies next to the page so there is one source. It must pass axe, work at 200% zoom and in dark mode, and read well printed.
5. **Builder.** `scripts/build-how-it-works.mjs <outDir>` (Node 22, run with `--experimental-strip-types` so it can import D's `promises.ts`, which has no imports): reads `web/src/under-the-hood/entries/*.json`, validates them with the same rules as C0's `validate.ts`, resolves every `*Key` from `web/src/i18n/en/*.json`, adds the promises, and writes `<outDir>/features.json` plus copies of `docs/how-it-works/*` and `web/src/styles/tokens.css`. It exits 1 naming the file on any invalid entry or missing key. Output goes to `.pages-build/` (one line appended to `.gitignore`); nothing generated is committed.
6. **Pages workflow.** `.github/workflows/pages.yml`, workflow name `pages`, on `push` to `main` (paths `web/src/under-the-hood/entries/**`, `web/src/i18n/en/**`, `docs/how-it-works/**`, `web/src/features/access/promises.ts`, `scripts/build-how-it-works.mjs`) and `workflow_dispatch`. Top-level `permissions: contents: read`; the deploy job adds `pages: write` and `id-token: write` only. It uses the current majors of `actions/checkout`, `actions/setup-node`, `actions/configure-pages`, `actions/upload-pages-artifact` and `actions/deploy-pages` (check them at build time). `concurrency: pages`. It is not a required check and pushes no commit, so the deploy bot and `deploy.yaml` are unaffected.

## Telemetry

Browser event `kc.hood.viewed` with no attributes, and the web SDK's fetch spans for the two status calls. No server code, no metric, no SLO candidate.

## Risks

- Entries that merge after H (E, C) appear automatically on the screen and, after the next push to `main`, on the page; nothing to redo.
- A missing or late F endpoint shows "No live data right now", which is honest.
- Gimmick risk (research/12): kept low by keeping the screen out of the main flow and showing checkable references rather than badges.
