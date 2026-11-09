## 1. Data and service (PR 1)

- [ ] 1.1 `notesRepo.ts` against B's exact `notes` columns (design); test against B's migrations
- [ ] 1.2 Migrations 300 threads, 301 thread_notes, 302 llm_usage, 303 thread_actions; migration test
- [ ] 1.3 `threads/heuristic.ts` (EN/ES stopwords, Jaccard, deterministic, action-verb follow-ups and promise attachment) with unit tests
- [ ] 1.3a `threads/promisesRepo.ts` reading B's open promises (read-only); test against B's migrations
- [ ] 1.4 `threads/costGuard.ts` using C0's `estimateCostUsd()`, with advisory lock; unit tests for cap, parallel runs
- [ ] 1.5 `threads/llmThreader.ts`: C0 `complete()` called as in design, prompt with open promises, JSON schema validation (threads, follow-ups max 3, promise ids must be from the input), one retry, fallback reasons; unit tests with mocked client, including an unknown promise id being dropped
- [ ] 1.6 `threads/run.ts` orchestration in one transaction, idempotent; spans `kc.threads.*` and metrics
- [ ] 1.7 Routes: run, list, detail (with actions), rename, unlink, runs, `GET /api/threads/actions?open=1`, `PATCH /api/threads/:id/actions/:actionId` (400 for promise actions); register under the `// >> c-evening-threads` marker in `api/src/routes/index.ts`; integration tests incl. device isolation
- [ ] 1.8 `npm run seed:threads` (the one script line C adds to `api/package.json`; no dependency change): call B's `POST /api/capture/seed`, then run threading for each seeded day; test it yields 3+ threads, one spanning two days, and 2+ threads with actions including a seeded promise

## 2. UI (PR 2)

- [ ] 2.1 `/threads` route and nav entry (insert under the `// >> c-evening-threads` marker in `routes.ts`, `nav.ts`); list, detail, run button with `aria-live`
- [ ] 2.1a "Next steps" on each thread card and a Next steps tab (all open actions); native checkboxes, `aria-live` on tick; follow-ups via C's PATCH, promises via B's `PATCH /api/promises/:id`
- [ ] 2.2 Trace card with optional Dash0 link, inside a "How this works" `<details>` disclosure
- [ ] 2.3 EN and ES strings in `web/src/i18n/{en,es}/threads.json`; tokens only, no hard-coded colours
- [ ] 2.4 Playwright mobile tests (iPhone 15, Pixel 7): run flow, tick a follow-up and a promise, Next steps lists open actions only, offline state, ES; axe clean
- [ ] 2.5 Browser spans via the Dash0 web SDK for run click and view load

## 3. Deploy and demo (PR 3)

- [x] 3.1 `deploy/threads-cronjob.yaml` (suspended, `timeZone: America/Denver`, Secret `THREADS_CRON_TOKEN`), listed under the `# >> c-evening-threads` marker in `kustomization.yaml` `resources:`
- [ ] 3.2 Document env vars (`THREADS_MODEL`, `THREADS_DAILY_CAP_USD`, `DASH0_TRACE_URL_TEMPLATE`) in deploy config, inserted under the `# >> c-evening-threads` marker in `deploy/deployment.yaml` `env:` (after C0b merges)
- [ ] 3.3 Dash0 saved view / dashboard for `kc.threads.llm` tokens and cost; demo script notes
- [ ] 3.4 Manual check with a real key: one run traced in Dash0; cap forced to 0 shows fallback with heuristic actions
- [ ] 3.5 (C2 if C2 runs, otherwise C) Add your registry entry: `web/src/under-the-hood/entries/c-evening-threads.json` (threads that end in actions; tech: GenAI span `kc.threads.llm` with tokens and cost, daily cost cap, `kc_threads_runs_total{mode}`, Gitar `api-contract.md` AC-1) with `threads.hood.*` EN and ES

## Split option
Actions add about 40 min (1.3a, 1.5, 1.7, 2.1a). If a slot frees at about 14:30 (parallel-plan §4.2), or C is behind, a second agent (C2) takes group 2 (UI) against the API in design.md while the first finishes groups 1 and 3; C2 touches only `web/src/views/Threads*`, `threads.json` (including the `threads.hood.*` strings) and C's registry entry `entries/c-evening-threads.json` (task 3.5); while C2 runs, C edits none of these. C2 is optional and starts at about 14:30 in a freed slot.

## Ownership

Creates (C): `api/src/services/threads/*`, `api/src/routes/threads.ts`, `api/migrations/300-303*`, `api/src/seed/threads-demo.ts`, `deploy/threads-cronjob.yaml`, tests alongside. Creates (C2 if it runs, otherwise C): `web/src/views/Threads*`, `web/src/i18n/{en,es}/threads.json`, `web/src/under-the-hood/entries/c-evening-threads.json`. Inserts under its `>> c-evening-threads` marker only: `api/src/routes/index.ts`, `web/src/routes.ts`, `web/src/nav.ts`, `deploy/kustomization.yaml` (`resources:`), `deploy/deployment.yaml` (`env:` `THREADS_MODEL`, `THREADS_DAILY_CAP_USD`, `DASH0_TRACE_URL_TEMPLATE` only). Edits: the `seed:threads` script line in `api/package.json` (no dependency change).
