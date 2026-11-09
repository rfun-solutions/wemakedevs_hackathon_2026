## 1. Design and screen (PR 1)
- [ ] 1.1 Run the Impeccable skill for the How it works page and screen (inputs: D's picked direction in `tokens.css`, mobile first, "teachers, not magicians" tone from research/11); produce one direction with a small preview; the user glances at it, no blocking wait
- [ ] 1.2 `web/src/screens/under-the-hood/live.ts` `resolveLive()` exactly as design decision 1; unit tests: promise ok, degraded, unknown; route present and absent; release full, partial and 204; health 404, error, timeout, `unavailable`
- [ ] 1.3 `UnderTheHood.tsx` and its parts (design decision 3): sections in merge order from `ENTRIES`, promise chips from D's `PROMISES`, Gitar/Dash0/Radar lists, repo links (design decision 2), 30 s refresh only while visible; insert its route and one secondary nav line under the `// >> h-under-the-hood` marker
- [ ] 1.4 `web/src/i18n/{en,es}/hood.json` (headings, states, "Dash0 sign-in needed", "No live data right now"), plain language (IN-6); event `kc.hood.viewed`
- [ ] 1.5 Playwright mobile (iPhone 15, Pixel 7) in `web/e2e/hood/`: entries render, ES strings, live values from a stubbed snapshot, offline shows "No live data right now", 200% text has no horizontal scroll; axe clean

## 2. Static page and Pages (PR 2)
- [ ] 2.1 `scripts/build-how-it-works.mjs` exactly as design decision 5; Vitest with fixture entries: clean build, invalid entry, missing EN key, promises included, no write outside the output folder; append `.pages-build/` to `.gitignore`
- [ ] 2.2 `docs/how-it-works/{index.html,style.css,app.js}` from the Impeccable direction: features, "Our promises to Kay", "See it live" link, print and dark-mode styles; no framework
- [ ] 2.3 Playwright plus axe on the built page (served from `.pages-build/` with a static server) at 390 px and 1280 px, and at 200% zoom, using H's own `playwright.pages.config.ts` (never edit C0's `playwright.config.ts`)
- [ ] 2.4 `.github/workflows/pages.yml` exactly as design decision 6 (top-level `permissions: contents: read`; deploy job `pages: write`, `id-token: write`; current action majors)
- [ ] 2.5 Kickoff item (admin): set Pages source to "GitHub Actions"; dispatch `pages` once and check the published URL lists every merged entry; put the URL in the README's links (one line under the `<!-- >> h-under-the-hood -->` marker) and in the demo notes
- [ ] 2.6 Add your registry entry: `web/src/under-the-hood/entries/h-under-the-hood.json` (the screen and page; tech: `pages` workflow, the registry validator in `lint-unit`) with `hood.hood.*` EN and ES

## Ownership
Creates: `web/src/screens/under-the-hood/` (`UnderTheHood.tsx`, `live.ts`, parts, tests), `web/src/i18n/{en,es}/hood.json`, `web/e2e/hood/`, `web/src/under-the-hood/entries/h-under-the-hood.json`, `docs/how-it-works/{index.html,style.css,app.js}`, `scripts/build-how-it-works.mjs` and its tests, `.github/workflows/pages.yml`, `playwright.pages.config.ts`.
Inserts under its `>> h-under-the-hood` marker only: `web/src/routes.ts`, `web/src/nav.ts`, the README links list (one line). Appends one line to `.gitignore`.
Never edits: C0's registry files (beyond its marker lines), C0's `playwright.config.ts`, any other change's entry file, F's routes or components, D's tokens or promises.
No API route, no migration (no range needed), no secret.

## Out of scope
See proposal.md: editing other entries, widgets in Kay's main flow, live data on the static page, embedded Dash0 dashboards.
