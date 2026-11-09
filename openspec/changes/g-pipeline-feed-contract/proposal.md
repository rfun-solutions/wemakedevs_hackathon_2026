## Why
Kay's first-morning schedule must not silently break when Sessionize changes its feed shape overnight. For the Gitar track, a red pipeline caused by an external system, diagnosed and fixed by Gitar, is the staged story (beat 5: "overnight the schedule feed changed shape; morning deploy is red"). T1 showed Gitar fixes schema drift and 429 in code, but reverts a chaos flag that lives in the PR diff. So the break must live outside the PR, where reverting is not an answer. For the Dash0 track, CI runs become traces next to the app's telemetry.

G also closes the loop from production to review (G4): the 15:45 "My agenda" slowdown writes a Gitar rule, and the next PR touching the agenda gets a Gitar finding that quotes a rule production wrote. DECIDED by the user (2026-11-08 evening): the **accessibility regression (G5) is the on-stage Gitar fix**, because it protects Kay (Promise P3) and is the point of the product. The budget break (G3, proven in live test T8: Gitar lowered a YAML memory request in 51 s and CI went green at about 68 s) is a **prepared repo-evidence PR**: G runs it once during the day, it stays in the repo as a reviewed and fixed PR, and the demo shows it only as a link or tab.

Judging criteria scored (quoted from research/01 §5):
- Never Merge Broken: "Using CI failure diagnosis and auto-apply to fix real problems." (feed break; G5 accessibility regression on stage; G3 budget break as repo evidence)
- Never Merge Broken: "Project-aware setup, with review instructions and repository rules that reflect how your team actually works." (G4 rules from production)
- Never Merge Broken: "Gitar is part of how you built, with features landing through PRs it reviewed, not one PR at the end."
- Stop Flying Blind: "Depth of instrumentation across your app, including traces, logs, metrics and real-user monitoring if you have a frontend." (CI traces)

## What Changes
- New required CI job `feed-contract`: validates the Sessionize feed against a JSON schema and runs mapper tests against a mock upstream service container.
- Mock upstream selects its response from repo variables `FEED_FIXTURE` (default `sessionize-v1`; demo break `sessionize-v2`) and `FEED_MODE` (default `ok`; backup `429`). Both fixtures are already on `main`, so a PR that does not touch them still goes red.
- Baseline `fetchFeed` and mapper with a timeout but deliberately no retry and v1-only shape, so both breaks need a real code fix. G creates `api/src/services/sessionize/{schema.json,fetchFeed.ts,mapper.ts}` with the exports in design.md decision 3. A merges after G, wraps `mapFeed` in its own `schedule/derive.ts` without editing these files, and creates no duplicates.
- `ci-traces` workflow: `dash0hq/otel-cicd-action@v4` on `workflow_run`, with author-email mitigation.
- Deploy workflow: G takes over C0's `.github/workflows/deploy.yaml` (workflow name `deploy`): GHCR image build on push to `main`, then the deploy-bot GitHub App pushes the `deploy:` tag commit, with `concurrency` and a skip rule for `deploy:` commits. G verifies it end to end and fixes gaps. There is no separate `release.yml`.
- Stage runbook for the live break, timed to Gitar's ~1 min review and ~2.5 min fix.
- **G4 rules from production:** workflow `rules-from-prod` (hourly plus `workflow_dispatch`) queries the Dash0 PromQL API (us-west-2) for p95 per route and caption lag p95 per engine, and writes `.gitar/review/hot-paths.md`: a header with the generation time and the numbers, one testable rule per hot route, and one caption-SLI rule. Each rule sentence carries the live Dash0 number itself ("...; production p95 is 2.1 s as of 15:52"), because T10 showed Gitar quotes rule sentences, not the file header. The deploy-bot App commits it to protected `main` as `rules: ...`; the deploy workflow skips `rules:` commits.
- Stage runbook `docs/runbooks/hot-paths.md`: the file is already on `main` from the post-15:45 run; the prepared agenda PR is opened about 3 minutes before the slot.
- G3 budget break, a prepared repo-evidence PR (T8 PASSED). A `budget` check dry-runs the 2 CPU / 4 GiB quota against `deploy/`; a prepared PR over-requests and Gitar fixes the YAML requests. G opens it once during the day (after rehearsal, before 16:30), so the reviewed, fixed and closed PR is evidence in the repo; it is not run live on stage. Runbook `docs/runbooks/budget-break.md`.
- Stage runbook `docs/runbooks/a11y-regression.md` for G5, THE on-stage Gitar fix: D's prepared contrast-regression PR turns `a11y` red (Promise P3 broken) and Gitar fixes the token, under a rule that forbids weakening the test. If Gitar is slow on stage, the fallback is the dress-rehearsal G5 PR tab, then the G3 evidence PR.
- G4's generator cites Access promise ids in rule sentences: CAP-1 names Promise P1, and an HP rule for `/api/notes` names Promise P2.
- One Under-the-hood entry `web/src/under-the-hood/entries/g-pipeline-feed-contract.json`.

## Impact
- Specs added: `feed-contract-ci`, `release-pipeline`, `ci-observability`, `rules-from-production`, `gitar-stage-runbooks`.
- New GitHub Actions secret use: `DASH0_TOKEN` (full-access, server-side only; the same secret F's `observability.yml` uses) for the PromQL query. Never in a browser artifact.
- Consumes E's server histogram `kc_captions_segment_ms` and C0's `http_server_request_duration_seconds` (the query returns nothing until they exist; the script handles empty results).
- Depends on C0 (workflow stubs, `.gitar/review/external-calls.md`, `deploy/`). Replaces the C0 `feed-contract` stub.
- A extends the baseline mapper G creates (G merges first).
- Required check names unchanged: `feed-contract`.

## Out of scope
- Cluster-level or app-level chaos (F owns `kc-chaos`).
- Expired TLS or DNS breaks (backup only if time allows; not specified).
- Grafana/Perses dashboards for CI, Argo CD configuration, merge queue and ruleset setup (kickoff checklist).
- Real Sessionize speaker data: fixtures contain none.
