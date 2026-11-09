## Why

The user decided on 2026-11-08 evening that every feature shows its tech. Judges, and Kelsey Hightower in particular, reward "this part is real" over "powered by" logo walls (research/11 §3). So each claim has to point at something checkable: the Gitar rule that reviews it, the Dash0 query that measures it, the Radar check that backs it. Kay never needs this screen to use the app. It sits outside the main flow and answers "how do I know this works?" for a curious attendee, a judge or the team.

The problem statement (`openspec/config.yaml` `context`) promises that every access feature is reviewed for inclusion, measured live and kept healthy on the cluster. H makes that promise inspectable in two places:
- an in-app **Under the hood** screen with live data where it exists (promise lights, route p95, the Radar all-clear);
- a static **How it works** page in the public repo, published with GitHub Pages, that judges can read without the app.

**Why a new change and not part of F.** F already runs as two agents plus an optional third, and its scope is Dash0 depth. H only reads C0's registry and F's existing endpoints (`GET /api/status/health`, `GET /api/status/release`) and touches no file of F's. As its own wave 2 change it builds in parallel with E and C, and F's agents stay on observability. The registry itself is C0's, so every change can add its entry in parallel without waiting for H.

Judging criteria scored (quoted from research/01 §5):
- Never Merge Broken: "Gitar is part of how you built, with features landing through PRs it reviewed, not one PR at the end." (each feature links the rule that reviews it)
- Stop Flying Blind: "Observability that's part of the product experience, not bolted on at the end." (live promise lights and p95 per feature)
- Radar / AI SRE: "Use Radar's UI and MCP throughout building and operating your project. Show how Radar helped you ship, troubleshoot, or improve your app." (the all-clear and the shared investigation per release)
- Every track: "How well your project makes conferences easier."

## What Changes

- In-app screen `/under-the-hood` ("How it works"), built from C0's registry `ENTRIES`: per feature, what it does for Kay (`t()`), the promises it serves, and its sponsor tech grouped as Gitar, Dash0 and Radar, each with a repo link and, where the entry says `live`, the live value from F's endpoints.
- Static page `docs/how-it-works/` (hand-written HTML, CSS and a small script, no framework), designed with the Impeccable skill on D's tokens, published by a GitHub Pages workflow that builds `features.json` from the same registry entries and EN strings.
- `scripts/build-how-it-works.mjs` (Node 22, no dependencies) and `.github/workflows/pages.yml`.
- One Under-the-hood entry of its own, `web/src/under-the-hood/entries/h-under-the-hood.json`.

## Capabilities

### New Capabilities
- `under-the-hood-screen`: the in-app screen with live values.
- `how-it-works-page`: the static public page and its Pages workflow.

### Modified Capabilities
None.

## Impact

- Wave 2, merge order 9 (after C). Depends on C0 (registry, routes, nav, i18n loader) and F (health and release endpoints, optional at runtime); uses D's tokens and `t()`.
- No API route, no migration, no secret. Telemetry domain `hood`: browser event `kc.hood.viewed` only.
- Repo setting: GitHub Pages source "GitHub Actions" (admin, one click at kickoff or when H merges).

## Out of scope

- Editing any other change's entry; entries are written by their own change.
- A Dash0 or Radar widget in Kay's main flow; PR lists; badges.
- Live data on the static page (it is another origin and F's endpoints send no CORS headers); the page links to the app for live values.
- Embedding Dash0 dashboards (they need a Dash0 login).
