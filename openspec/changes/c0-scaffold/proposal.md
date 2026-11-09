## Why

**Problem statement (decided 2026-11-08 evening; also in `openspec/config.yaml` `context`).** At a conference you have more conversations and ideas per hour than you can remember ("I forget every conversation I had an hour ago"). KubeCompanion lets anyone capture a note, a person or a promise in seconds, and lets AI organise the week into threads that end in actions to take later. On top of that, Deaf, hard-of-hearing and ESL attendees lose access at the talk-room door, so captions, communication cards and translation carry into the hallway. Every access feature is reviewed for inclusion before it ships (Gitar), measured live (Dash0) and kept healthy on the cluster (Radar), and the five Access promises P1-P5 (content owned by D) say so in Kay's words. C0 writes this statement into the README.

Seven other changes build in parallel on 2026-11-09 and merge in order. They only fit together if one agent first lays the shared base: a deployable service, the cross-change interfaces (device id, telemetry, LLM client, registries), CI with all required check names, review rules, and the merge and deploy plumbing.

Kay (hard of hearing, English as a second language, first KubeCon) never sees C0 directly. What Kay feels is that the PWA opens on venue Wi-Fi, installs to the home screen, and works offline. C0 supplies the service-worker shell and the same-origin telemetry that make that measurable.

Tracks scored:
- **Dash0:** instrumentation exists from the first commit (server NodeSDK, browser web SDK, GenAI spans), not bolted on later.
- **Gitar:** project-aware review rules (`.gitar/review/*`) and `AGENTS.md` are on `main` before the first feature PR.
- **Conferences for Everyone:** the axe `a11y` check is a required gate from day one, and two inclusion rule files (`inclusion.md`, `demo-data.md`) exist for D to fill (G1). Baseline rules already cite the Access promise ids (P3, P4).
- **Gitar idea 2 (API-to-frontend contract):** `api-contract.md` makes Gitar check that a PR changing an API route's shape updates its web callers in the same PR. Wave 1 runs A, B and F in parallel, so it fires for real.
- **Radar:** `AGENTS.md` tells every agent to check the cluster with the Radar MCP after every merge.
- **Every feature shows its tech:** the append-only Under-the-hood registry lets each change add one entry, from which H builds the in-app screen and the public `docs/how-it-works/` page.
- **Synthetic Kay hooks (X1):** a Playwright `kay` project and a browser service-name override (`kc-web-kay`) so F's accessibility smoke test is separable in Dash0.

Judging criteria scored (quoted from research/01 §5):
- Never Merge Broken: "Project-aware setup, with review instructions and repository rules that reflect how your team actually works."
- Never Merge Broken: "Gitar is part of how you built, with features landing through PRs it reviewed, not one PR at the end."
- Stop Flying Blind: "Depth of instrumentation across your app, including traces, logs, metrics and real-user monitoring if you have a frontend."
- Stop Flying Blind: "Observability that's part of the product experience, not bolted on at the end."
- Conferences for Everyone has no listed criteria (research/01 §5); every track's "How well your project makes conferences easier." applies.

## What Changes

- Bring in a clean copy of `cnh-starter` (no `.git`, no template placeholders left, `setup.sh` run for the team) and restructure it as npm workspaces `api/` and `web/`. One Node 22 service serves `/api` and the built PWA.
- Fix the stack (details and alternatives in design.md, for user review): Fastify, Vite + Preact + TypeScript, `pg` with numbered SQL migrations.
- Provide the C0-owned interfaces: device identity, telemetry bootstrap, LLM client, registries with one pre-written marker per change (each change inserts under its own marker), `/healthz` and `/readyz`, and a service-worker shell that never intercepts the Dash0 ingest host.
- Ship contract stubs other changes build against (`api/src/lib/chaos.ts`, `web/src/lib/speech/index.ts`, `web/src/lib/capture/queue.ts`) and a generic rate-limit helper `api/src/lib/rateLimit.ts`, plus the Vitest (api: node, web: happy-dom) and Playwright (`PORT`-aware) config.
- Run as three agents: C0a (group 1 as its own first PR "C0-base", then the API), C0w (web) and C0b (delivery).
- Add a CloudNativePG `Cluster` manifest sized inside the 2 CPU / 4 GiB budget.
- Add CI stubs for the five required checks: `lint-unit`, `e2e-mobile`, `a11y`, `build-image`, `feed-contract`, each `pull_request` workflow with `concurrency` and `cancel-in-progress: true`.
- Add six Gitar review rule files (`external-calls.md`, `time-zones.md`, `accessibility.md`, `api-contract.md`, plus `inclusion.md` and `demo-data.md` created with a baseline rule each; D writes their full content), `AGENTS.md` (working agreement, including "use the Radar MCP to check the cluster after every merge"), an `AI-DISCLOSURE.md` stub and a README that opens with the problem statement.
- Add the Under-the-hood registry: `web/src/under-the-hood/types.ts` (entry schema), `registry.ts` (glob of `entries/*.json`, one file per change, so appends never conflict) and C0's own entry `entries/c0-scaffold.json`.
- Rework the starter deploy workflow to push the `deploy:` commit through a GitHub App token.
- Add a Playwright `kay` project (iPhone 15, `es-ES`, reduced motion, `baseURL` from `KC_BASE_URL`, test dir `web/e2e/kay/`) and a browser telemetry service-name override for the probe (F writes the spec).
- Document the kickoff steps C0 owns: ruleset with merge queue, and deploy-bot App wiring.

## Capabilities

### New Capabilities
- `app-foundation`: the service, its runtime interfaces, telemetry, LLM client, registries, shell and database.
- `delivery-pipeline`: CI check names, review rules, working agreement, merge ruleset and deploy bot.

### Modified Capabilities
None (greenfield repo).

## Impact

- Creates the whole repo skeleton; every later change inserts under its own marker in the shared registries.
- Dependencies: none upstream. The Impeccable design-token application is a **dependency on D** (D owns `web/src/styles/tokens.css`); C0 ships a neutral placeholder file that D overwrites.
- Needs from the user before kickoff: Anthropic API key, Dash0 full-access token (server) and ingest-only token (browser), deploy-bot App id and private key.
- Repo: `rfun-solutions/wemakedevs_hackathon_2026`, an organisation repo, public. The merge queue and the GitHub App ruleset bypass were verified on it (research/08-live-tests T6, T6b).

## Out of scope

- Any feature UI, schedule, notes, captions, i18n strings beyond the loader (D, A, B, E).
- Real `feed-contract` logic (G), chaos flags (F), design tokens (D), speech module (E).
- Dash0 operator (T3: collectors not admitted) and an OTel collector Deployment (optional later; SDK-direct is the default).
- Argo Rollouts canary (J).
