## Ownership
Creates: `.github/workflows/ci-traces.yml`, `.github/workflows/rules-from-prod.yml`, `scripts/rules-from-prod.mjs` and its tests, `.gitar/review/hot-paths.md` (initial generated file; afterwards only the bot rewrites it), `feed-contract/` (mock upstream, fixtures v1 (60 sessions, shared with A's tests) and v2, scripts), `api/src/services/sessionize/{schema.json,mapper.ts,fetchFeed.ts}` and tests, `docs/runbooks/feed-break.md`, `docs/runbooks/hot-paths.md`, `docs/runbooks/a11y-regression.md`, `web/src/under-the-hood/entries/g-pipeline-feed-contract.json`, and for G3 (prepared repo-evidence PR) `scripts/check-budget.mjs` and tests, `.github/workflows/budget.yml`, `.gitar/review/budget.md`, `docs/runbooks/budget-break.md`. Edits: `.github/workflows/feed-contract.yml` (replaces C0's stub) and `.github/workflows/deploy.yaml` (C0's, owned by G after C0 merges). Edits `deploy/kustomization.yaml` `images:` only via the bot, and the bot rewrites only the `newTag:` line (C0b pre-creates the block). Never edited by A: `api/src/services/sessionize/*` (A wraps `mapFeed` in its own `schedule/derive.ts`). Appends nothing to shared registries. Also creates `web/src/i18n/{en,es}/pipeline.json` (hood strings only). Does not create or edit D's prepared contrast branch or any other `web/` file.

## 1. PR 1: feed contract job (check `feed-contract`)
- [x] 1.1 Create fixtures `feed-contract/fixtures/sessionize-v1.json` (60 sessions; A's tests reuse it) and `sessionize-v2.json` (titles, times, rooms, tracks; no speakers) and unit test `fixtures-no-pii`
- [x] 1.2 Write the mock upstream (Node http, no deps) honouring `FIXTURE` and `MODE` (`ok`, `429` with `Retry-After: 1` for first 2 requests); unit tests for each mode
- [x] 1.3 Write `schema.json`, `mapper.ts` (v1 only, naive local time plus `America/Denver`), `fetchFeed.ts` (timeout, no retry) with the exports in design decision 3; Vitest tests against v1
- [x] 1.4 Replace C0's stub in `.github/workflows/feed-contract.yml` (job `feed-contract`): start mock, pass `vars.FEED_FIXTURE || 'sessionize-v1'` and `vars.FEED_MODE || 'ok'`, Ajv validation step, Vitest mapper and fetch tests; triggers `pull_request` and `merge_group`
- [x] 1.5 Verify locally with each variant: v2 and 429 fail, defaults pass

## 2. PR 2: release and deploy bot
- [x] 2.1 Take over C0's `deploy.yaml` and verify or fix: skip head commits starting `deploy:` or `rules:` (G4 bot commits need no image), image job to GHCR (packages: write on job only), deploy job with App token, a single-line `newTag:` replacement in `deploy/kustomization.yaml` (`sed` or `yq -i`, not `kustomize edit set image`, so the per-change markers and formatting survive; test that the diff of a `deploy:` commit is exactly one line), `deploy: <sha>` commit, `concurrency`, `pull --rebase`
- [x] 2.2 Confirm secrets and variables exist (`DEPLOY_BOT_PRIVATE_KEY`, `DEPLOY_BOT_APP_ID`) and App is a ruleset bypass actor; record result in PR
- [ ] 2.3 Merge a trivial change and check image, bot commit, skipped follow-up run

## 3. PR 3: CI traces and runbook
- [ ] 3.1 `ci-traces.yml` on `workflow_run`, `actions: read`, ingest token Secret; export only runs whose triggering event is `merge_group` or a push to `main` (a PR-triggered export would double the job count; changing that needs the orchestrator's OK); confirm C0's `AGENTS.md` has the noreply `user.email` line
- [ ] 3.2 Inspect first trace in Dash0 for author emails; disable or keep per spec; note result
- [ ] 3.3 Write `docs/runbooks/feed-break.md`:
  - T-10 min: prepared harmless PR from branch `bugfix/KC-0-docs-typo` with label `gitar-managed` and auto-apply on, NOT yet opened
  - T0: `gh variable set FEED_FIXTURE --body sessionize-v2`, then open the PR (so the clock starts at PR open)
  - T+1 min: Gitar review appears; narrate "overnight the feed changed shape"
  - T+2.5 min: Gitar fix commit; CI turns green; show Dash0 trace
  - Nudge at T+4: comment `Gitar fix CI, keep fixtures unchanged`
  - Backup: `FEED_MODE=429`, same flow; last fallback: pre-recorded run
  - Reset: `gh variable set FEED_FIXTURE --body sessionize-v1; gh variable set FEED_MODE --body ok`; rerun main CI; caveat: 3-commit cap
- [ ] 3.4 Dry-run the runbook once end to end; record times

## 4. PR 4: rules from production (G4)
- [x] 4.1 `scripts/rules-from-prod.mjs` (Node 22, no deps): `CONFIG` (API host, query path, label names (`dash0_operation_name`; fallback `route` on `kc_app_http_server_duration`), thresholds 300 ms and 4000 ms, excluded routes), `queryPromQL(expr)` with 10 s timeout, and the shared query contract in design decision 8. Vitest with a mocked fetch: success, 401, timeout, empty result (exit 0, no write)
- [x] 4.2 Pure `renderHotPaths(result, now)` with the exact format in design decision 8: header for humans; one HP rule per hot route (at most 5) and CAP-1 always, and EVERY rule sentence contains its limit, the live Dash0 p95 and the HH:MM (America/Denver), because Gitar quotes rule sentences, not the header (T10). CAP-1 reads `CAP-1 (Promise P1)` and an HP rule for `/api/notes` reads `(Promise P2)` (`CONFIG.promiseByRoute`). Vitest snapshot tests: two hot routes; none; caption breach; route over the cap of 5; a test that each rule line contains a `p95 is <n> s as of HH:MM` clause; a test that CAP-1 and a hot `/api/notes` rule carry their promise id
- [x] 4.3 `shouldCommit(prev, next, force)` compares hot-route set and breach state only; unit tests. The script refuses to write any path other than `.gitar/review/hot-paths.md`; unit test
- [x] 4.4 `.github/workflows/rules-from-prod.yml`: `schedule` hourly plus `workflow_dispatch` (`window`, `force`); top-level `permissions: contents: read`; `concurrency` group `rules-from-prod`; App token via `actions/create-github-app-token@v3.3.0`; commit `rules: update hot-paths from Dash0 (HH:MM)`; `git pull --rebase` and one retry
- [ ] 4.5 Confirm GitHub Actions secret `DASH0_TOKEN` exists (full-access, server-side only; F's `observability.yml` reuses it); record result in PR
- [ ] 4.6 Commit an initial `.gitar/review/hot-paths.md` generated from the fixture (header says "Generated from fixture, not production"); dispatch once on `main` after the first deploy and check the bot commit lands and `deploy` skips it

## 5. Stage runbooks (PR 4)
- [x] 5.1 `docs/runbooks/hot-paths.md` (G4 stage version):
  - Rehearsal: prepare branch `feature/KC-<n>-agenda-session-counts` that adds one query per session inside the agenda handler loop; label `gitar-managed`; NOT opened. Never merged
  - 15:47, after F's 15:45 load: `gh workflow run rules-from-prod -f window=15m -f force=true`; check the `rules:` commit is on `main` and the header shows `/api/agenda`
  - T-3 min before the slot: open the prepared PR (Gitar reviews in about 1 min)
  - On stage: show the HP-1 line in the rule file (10 s), show Gitar's inline finding opening `Per the review rule "...` and quoting HP-1 with the production p95 in it (30 s; T10: about 60 s after PR open), say "production wrote this rule an hour ago" (20 s)
  - Fallback: the dress-rehearsal PR tab. Reset: close the PR; next hourly run rewrites the file
- [x] 5.2 `docs/runbooks/a11y-regression.md` (G5; THE on-stage Gitar fix, decided 2026-11-08): T-10 min D's branch `bugfix/KC-<n>-card-contrast` ready with label `gitar-managed` and auto-apply on; T0 open PR; T+1 min `a11y` red with the token name and computed colours in the log; T+2.5 min Gitar's fix commit edits `tokens.css` only; CI green; narrate the rule that forbids weakening the test. If Gitar edits the test or adds an exclusion, reject the commit on stage and say so. Nudge at T+4: `Gitar fix CI, keep the axe rules unchanged`. Fallback order: the dress-rehearsal G5 PR tab, then the G3 evidence PR link. Narrate it as "this PR broke Promise P3". Reset: close the PR, delete nothing on `main`
- [ ] 5.3 Dry-run both runbooks once (G5 on D's `-rehearsal` branch; that PR becomes the fallback tab and the stage branch stays unopened); record times. Make sure `feed-break.md` and `hot-paths.md` do not call G3 the stage beat
- [x] 5.4 Add your registry entry: `web/src/under-the-hood/entries/g-pipeline-feed-contract.json` (schedule survives a feed change; tech: `feed-contract` check, `rules-from-prod` with HP-1 and CAP-1, CI traces in Dash0, G5 PR, G3 evidence PR) with its `pipeline.hood.*` strings in a new `web/src/i18n/{en,es}/pipeline.json` (G's only i18n file)

## 6. G3 budget break: prepared repo-evidence PR (DECIDED by the user 2026-11-08; T8 PASSED 2026-11-09)
T8 (research/08-live-tests/T8-gitar-yaml.md): Gitar lowered a YAML memory request (1Gi to 512Mi) in 51 s, CI green at about 68 s, and it never touched the script or the rule. G5 is the on-stage Gitar fix; G3 runs once during the day and stays in the repo as evidence.
- [ ] 6.1 `scripts/check-budget.mjs` per design decision 10 (render, sum, quota wording, optional server dry-run when `KUBECONFIG_B64` is set); Vitest for sums with replicas, CNPG `instances`, under and over budget
- [ ] 6.2 `.github/workflows/budget.yml` (check `budget`; `pull_request` + `merge_group`; top-level `permissions: contents: read`); add `budget` to the ruleset's required checks only after it passes on `main`
- [ ] 6.3 `.gitar/review/budget.md` with the rule text in design decision 10 (including "lower the request that this PR raised or added; do not change any other component"), merged before the staged PR
- [ ] 6.4 Prepare branch `bugfix/KC-<n>-db-load-test-memory` raising `deploy/postgres.yaml` memory requests to 4Gi; NOT opened
- [ ] 6.5 `docs/runbooks/budget-break.md` (evidence run, not a stage beat): run once after rehearsal and before 16:30. Label `gitar-managed` via the issues API (T8: `gh pr edit` errored on a GraphQL deprecation), comment `gitar auto-apply:on`, open PR; T+35 s review; T+50 s fix commit lowering the Postgres request; T+70 s `budget` green. Reject if it deletes a component, changes another component or edits the script. Then close the PR unmerged (the over-request must never reach `main`) and record its URL in the runbook and G's registry entry. In the demo, say only that Gitar fixed the YAML and left the check alone; do not claim Gitar read `budget.md` (footer says "No rules evaluated")

## Split option
G runs as **one agent** doing groups 1 → 2 → 3 → 4 → 5 → 6 in order, from 12:20 (parallel-plan R13). G2 is only an optional rescue split: if G is behind at 14:00, the orchestrator assigns a second agent (G2) to groups 4 and 5 in parallel: they touch only `scripts/rules-from-prod.mjs`, `.github/workflows/rules-from-prod.yml`, `.gitar/review/hot-paths.md` and `docs/runbooks/{hot-paths,a11y-regression}.md`. The `rules:` skip in `deploy.yaml` stays in G1's task 2.1 so the two agents never edit the same file. With G2, G still does group 6 (G3, the evidence PR) after group 3.
