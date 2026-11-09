# Build-day parallel-safety plan: KubeCompanion (2026-11-09)

Independent review. Sources read: all 9 `openspec/changes/*/{tasks,design}.md` (plus the C0, D and G proposals), `proposal-brief.md`, `proposal-review.md`, `map.md`, research/07 §0, §1.3, §7-9, T6 and T6b.
Evidence produced here: a scratch git test (below). Nothing in the repo or the running doc was edited.

**Verdict:**
- **Maximum safe concurrency is 8 Sonnet builders plus 1 Opus orchestrator.** It only applies after the six real conflicts in §1.3 are fixed.
- File ownership is not what sets that ceiling. CI capacity is (§4.3), and so is the orchestrator's attention.
- About 23 agent-hours of wave 1+2 work (including F group 7, now in scope) must fit between 12:20 and 15:40. That is about 7 concurrent on average, so 8 is necessary as well as sufficient. Use the cut list in §6 when anything slips.

---

## 0. Evidence from a scratch merge test (git 2.x, 3-way merge as in the queue)

| Case | Result |
|---|---|
| Two branches each "append one line" at the end of the same registry list (`routes.ts`) | **CONFLICT** |
| The same, but C0 pre-writes one anchor comment per change and each branch inserts under its own anchor | **CLEAN** |
| Agent 2 branches from agent 1's *unmerged* commit, then agent 1's branch is **squash**-merged and agent 2 merges | **CONFLICT** (add/add on `package.json`) |

Consequences:
- **"Append-only, one line per feature" is not collision-free in git.** Every pair of agents that both append to `web/src/routes.ts`, `web/src/nav.ts`, `api/src/routes/index.ts` or `deploy/kustomization.yaml` `resources:` will conflict. In the merge queue that ejects the second PR, which costs a re-run of about 6-9 min.
- **The C0a/C0b split as written** ("C0b branches from C0a's task 1.3 commit") hits case 3.

---

## 1. File-level conflict matrix

Agents:
- C0a: C0 group 1, then group 2
- C0w: C0 group 3 (new)
- C0b: C0 groups 4-5
- D0: Impeccable pre-work, outside the repo
- D1: D groups 0-3
- D2: D groups 4-5
- G: G groups 1-6. G2 (groups 4-5) is an optional split.
- A
- B
- F1: F groups 1-3
- F2: F groups 4-5
- F3: F group 6
- E1: E groups 1, 2, 6, 4
- E2: E group 3
- C: C groups 1 and 3
- C2: C group 2 (optional)
- H

### 1.1 Shared files and who touches them

| File / folder | Touched by | Class | Rule |
|---|---|---|---|
| `web/src/routes.ts` | C0w creates; D1, D2, A, B, F1, E1, C/C2, H append | **Real conflict** as written | Fix R1 (anchors) |
| `web/src/nav.ts` | same as above | **Real conflict** | R1 |
| `api/src/routes/index.ts` | C0a creates; A, B, F1 (routes + `chaosPlugin`), F2, F3, E1 (captions), E2 (translate), C append | **Real conflict** | R1 |
| `deploy/kustomization.yaml` `resources:` | C0b (postgres); A (cronjob-ingest), F1 (chaos-configmap), C (threads-cronjob) append | **Real conflict** (A and F1 both in wave 1) | R1 |
| `deploy/kustomization.yaml` `images:` | the deploy bot only (G's `deploy.yaml`) | Needs care | R6: the bot must edit only the `newTag:` line. Whether `kustomize edit` preserves comments and ordering is UNVERIFIED (kustomize is not installed here) |
| `deploy/deployment.yaml` | C0b edits; F1 (chaos volume), F2 (kc-release volume, after F1), C (env) | Needs sequencing | F2 after F1 PR2; C after C0b. Different hunks, so clean when serial. Add anchors for `env:` and `volumes:` (R1) |
| `package.json` (root, `api/`, `web/`) and `package-lock.json` | C0a only for deps. C adds a `seed:threads` script to `api/package.json` | Safe if the dependency rule holds (§3) | Any other dependency change goes through the orchestrator |
| `api/migrations/NNN_*` | C0 000, A 100-102, B 200-202, C 300-303 | Safe (one range per change) | Needs sequencing in the runner: A's 100 may arrive *after* B's 200 is applied. The C0a runner must apply every unapplied version, not only versions greater than the max (R7) |
| `api/src/lib/chaos.ts` | A creates the stub; F1 replaces it | **Real conflict** (add/add if F1 opens before A's PR2 merges) | R2: C0a ships the stub |
| `web/src/lib/speech/index.ts` | B creates the stub "only if absent"; E1 replaces it | Needs sequencing (wave 2) and is fragile | R2: C0w ships the stub |
| `web/src/lib/capture/queue.ts` (`getLastSaveMs`, `enqueueNote`) | B creates; F1 imports in wave 1, E1 imports | **Real conflict** in timing: F1 does not compile before B's PR2 | R2: C0w ships typed stubs and B replaces them |
| `api/src/services/sessionize/mapper.ts` | G creates; A "extends with derived fields"; Gitar's on-stage feed fix also edits it | **Real conflict** risk (A and G overlap in wave 1; it also muddies the G demo diff) | R3: A wraps it in its own `schedule/derive.ts` and never edits `mapper.ts` |
| `web/src/i18n/<lang>/access.json` | D1 (`access.promise.*`, display settings, 2.4) and D2 (`access.card.*`, calm, badge) | **Real conflict** between split agents | R4: D2 writes `access-cards.json`, which works because the loader globs `<lang>/*.json` |
| `web/src/i18n/<lang>/captions.json` | E1 and E2 (translate strings) | **Real conflict** between split agents | R4: E2 writes `translate.json` with keys `translate.*` |
| `web/src/i18n/<lang>/status.json` | F1, then F2 | Needs sequencing | F2 after F1 PR1, or `status-health.json` (R4) |
| `web/src/i18n/<lang>/threads.json` | C (`threads.hood.*` registry strings) and C2 | Real conflict if C2 runs | C2 writes the registry entry and hood strings; C does not |
| Other `web/src/i18n/*/<domain>.json` | one owner each | Safe | – |
| `web/src/under-the-hood/entries/<id>.json` | one file per change | Safe | The validator needs the `*Key` strings in the same PR |
| `web/src/styles/tokens.css` | C0w placeholder; D overwrites; the G5 stage branch edits it | Needs sequencing, and token names are a hidden interface | R5: token names are fixed in D's PR0 by about 12:50, and later only values change |
| `web/src/i18n/index.ts` | C0w creates; D1 replaces (same `t()` signature) | Safe if serial | – |
| `web/index.html`, app shell, `.eslintrc`/eslint config | D1 only after C0w | Safe | – |
| `web/public/sw.js` | C0w creates; B adds the Background Sync handler | Safe (single editor) | D must not touch it for calm places, because cache-first hashed assets cover it |
| `playwright.config.ts`, `vitest` config, `tsconfig*`, `vite.config.ts` | C0 | Hidden conflict: H 2.3 needs a static server, web unit tests need a DOM environment, and E's worker may need Vite worker config | R8: C0 configures these up front. H uses its own `playwright.pages.config.ts`. E edits `vite.config.ts` only with orchestrator approval |
| `.github/workflows/{lint-unit,e2e-mobile,a11y,build-image,feed-contract}.yml` | C0b creates; G edits `feed-contract.yml` | Safe (serial) | – |
| `.github/workflows/deploy.yaml` | C0b creates; G owns it after C0b merges | Needs sequencing | – |
| Other workflows: `ci-traces`, `rules-from-prod`, `budget` (G); `observability`, `kay-probe` (F); `pages` (H) | one file per owner | Safe | – |
| `.gitar/review/*` | C0b creates six files; D1 PR0 edits three; G creates `hot-paths.md` and `budget.md`; the bot rewrites `hot-paths.md` | Safe (one owner per file) | D PR0 after C0b. Gitar reads rules from `main` |
| `AGENTS.md` | C0b | Safe | The rules of engagement (§5) go in the initial commit, and C0b extends the file below them (R9) |
| `AI-DISCLOSURE.md`, `README.md` | C0b creates; H appends a link; **E 3.3 also "notes it in the README"** | Real conflict (E and H run in parallel in wave 2) | E puts its note in its PR description or `docs/`. H's one line goes under a README anchor. The orchestrator owns `AI-DISCLOSURE.md` |
| `.gitignore` | C0a; H appends one line | Safe | – |
| `openspec/changes/<id>/tasks.md` | split agents share one file | Safe | Tick only your own group's lines, in your own PR. The groups are separated by headings |
| `openspec/specs/` (archive) | nobody during the build | – | Never run `openspec archive`. Only the orchestrator does that, after 17:00 |
| `docs/runbooks/*` (G), `docs/demo-*` (B, F), `docs/accessibility.md` (D), `docs/how-it-works/` (H) | one owner each | Safe | – |
| `.scratch/kubecompanion/../RUNNING-LOG.md` (outside the repo) | all agents | Safe only if appended | Append with `>>`, never Edit/Write the whole file (§5.7) |

Runtime collisions that are not file collisions. Every agent must be isolated:
- Each agent gets its own `git worktree`. Never put two agents in one working copy.
- Each agent gets its own `PORT` and Vite port (8080+N and 5173+N).
- Each agent gets its own Postgres database (`kc_<agent>`) on the one local container.
- `DASH0_TOKEN` is **never** set locally, because local runs would pollute the demo dataset.
- `ANTHROPIC_API_KEY` is set locally only for C 3.4, with the orchestrator's OK.

### 1.2 Pair summary (after the fixes R1-R9, only these pairs still need ordering)

| Pair | Overlap | After fixes |
|---|---|---|
| C0a / C0w / C0b | root config | Group 1 merges alone as PR "C0-base". All three then branch from `main`, and their folders are disjoint |
| C0b → D1 PR0 | `.gitar/review/{inclusion,demo-data,accessibility}.md` | D PR0 after C0b |
| C0b → G | `feed-contract.yml`, `deploy.yaml` | G PR1 and PR2 after C0b |
| G → A | sessionize files (A imports them) | G PR1 before A PR1 |
| A ↔ F1 | `chaos.ts`, kustomization | Independent once C0 ships the stub. F1's 2.4 dry run needs A's PR2 on `main` |
| B ↔ F1, B ↔ E1 | `queue.ts` | Independent with C0's stub. B replaces it |
| F1 → F2 | Status screen mount, `status.json`, `deployment.yaml` | F2's UI and footer after F1 PR1 and PR2 merge. F2's server half can start earlier |
| E1 → E2 | Captions screen mount line | E2 adds the one mount line after E1 PR2 merges |
| B → C | B's tables and migrations | C's integration tests after B PR1 merges. C's pure code can start earlier |
| D2 → G5 runbook | D2 hands over the branch name | Runbook text only |
| All UI ↔ D | token names | D PR0 freezes the names (R5) |

### 1.3 Ownership edits needed (list only; the proposals were not edited)

- **R1 Anchors** (C0 tasks 2.1, 3.1, 4.1, 4.2, 5.4):
  - C0 pre-writes one marker comment per change id, in merge order: `// >> d-access-kit` and so on, or `# >> …` in YAML.
  - Markers go in `web/src/routes.ts`, `web/src/nav.ts`, `api/src/routes/index.ts`, `deploy/kustomization.yaml` `resources:`, `deploy/deployment.yaml` `env:` and `volumes:`/`volumeMounts:`, and the README links list.
  - Split agents get their own marker: `d-access-kit-cards`, `e-captions-translation-translate`, `f-observability-product-health`, `f-observability-product-kay`.
  - Agents insert lines directly under their own marker only.
  - Replace "append-only" in the brief, `AGENTS.md` and every Ownership section with "insert under your marker".
- **R2 Contract stubs in C0** (C0a 2.x, C0w 3.x): `api/src/lib/chaos.ts` (exact exports from F's design), `web/src/lib/speech/index.ts` (B's stub signature) and `web/src/lib/capture/queue.ts` (`enqueueNote` rejects with "not implemented" and `getLastSaveMs` returns `null`).
  - Then A task 2.4 becomes "import only".
  - B 2.1 is dropped, and B 2.2 becomes "replace C0's stub".
  - F 2.1 stays "replace".
  - E 1.5 stays.
- **R3** A 1.6 and A's Ownership: "extend `mapper.ts`" becomes "wrap `mapFeed` in `api/src/services/schedule/derive.ts`; never edit G's files". Update G design decision 3 to match.
- **R4** Split agents use their own i18n file. Prerequisite: C0 and D state that the loader and validator merge `<lang>/*.json` by key, not by file name.
  - D2 uses `access-cards.json`.
  - E2 uses `translate.json`.
  - F2 uses `status-health.json`.
  - C2 owns `threads.json` and the C registry entry.
- **R5** D task 1.2 moves into PR0: `tokens.css` with the **complete token name set**. Values are neutral, or the 11:20 pick if it is ready. D PR1 then changes values only. C0w's placeholder uses the same names (D0 hands them over by 11:30).
- **R6** G 2.1 and G design decision 6: replace `kustomize edit set image` with a single-line `newTag:` replacement (`sed` or `yq -i`), so markers and formatting survive. C0b pre-creates the `images:` block.
- **R7** C0 2.3: add a unit test showing that a lower version arriving after a higher one is applied.
- **R8** C0:
  - Configure Vitest projects (`api`: node, `web`: happy-dom).
  - Pre-install `happy-dom` and `@testing-library/preact`.
  - Make `playwright.config.ts` read `PORT`.
  - Export a generic `api/src/lib/rateLimit.ts` token bucket. F 1.2, F3 6.4a and E 6.3 all need per-device limits, and without it each would add `@fastify/rate-limit` to the lockfile.
  - Put `concurrency: { group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true }` on every `pull_request` workflow (§4.3).
- **R9** C0 split text and 5.4: group 1 merges as its own PR, "C0-base", before C0w and C0b branch. `AGENTS.md` is *extended*, not created, because the initial commit carries §5. Add a 3rd C0 agent (C0w = group 3).
- **R10** E 6.2: `navigator.sendBeacon` cannot send `X-Device-Id`, so C0's device plugin returns 400. Use `fetch(url, { keepalive: true, headers })` instead. The alternative is `deviceId: 'optional'` plus the id in the body, but that weakens the 6/min limit.
- **R11** F 5.5 (the AI-SRE runbook) moves to F1. It is docs, F1 already writes `demo-runbook-dash0.md`, and it is needed at 15:45 even if F2 slips.
- **R12** E 3.3: no README edit.
- **R13** G becomes one agent doing groups 1→2→3→4→5→6. G2 remains an optional rescue split if G is behind at 14:00.
- **R14** C0b 5.1: either `ci-traces` listens only to `merge_group` and `push`-to-`main` runs, or the orchestrator accepts that it doubles the job count (§4.3).
- **R15 F group 7 (D3, now IN SCOPE, decided by the user on 2026-11-08 evening).** As written, it goes to "whichever agent finishes first" and edits F2's files (`services/health/`, `status-health.ts`). If F1 picks it up while F2 is still working, that is a real conflict. The fix:
  - Group 7 belongs to **F1**, after its groups 1-3 (from about 14:20), in its own files: `services/health/agent0.ts`, a new `api/src/routes/status-explain.ts` (instead of adding `/api/status/explain` to `status-health.ts`), `web/src/screens/status/Agent0Line.tsx` and `status-agent0.json` strings.
  - F2's `poller.ts` exports a no-op `onHealthTransition(cb)` hook from PR4. F1's `agent0.ts` subscribes to it, so F1 never edits `poller.ts`.
  - The `Agent0Line` mount is one line, added under an F1 marker on the Status screen.
  - `runTask` takes 32-42 s (T7), so it is asynchronous with a 60 s timeout and only cached text is shown. Unit tests mock the MCP. No live Agent0 calls happen in CI or local tests, which saves credits.
  - F's tasks.md "Split" text still says "Group 7 is conditional and goes to whichever agent finishes first"; change it to name F1.

---

## 2. Interface readiness

| Interface | Producer (lands at) | Consumers | Contract before merge? | Start before merge? |
|---|---|---|---|---|
| Device id, `api()`, telemetry (`api/src/telemetry.ts`, `web/src/telemetry.ts`) | C0a, C0w (~12:20) | all | Yes (C0 D3) | No. Wave 1 starts at 12:20 on these |
| LLM `complete()`, `RateLimitedError`, `LlmUnavailableError`, `estimateCostUsd` | C0a (~12:20) | E2, C, F group 7 | Yes, exact TS in C0 D3 | Yes, mock in tests. It is real code by 12:20 anyway |
| Registries (routes, nav, api routes, i18n, under-the-hood) | C0a, C0w (~12:20) | all | Yes, plus markers after R1 | – |
| Rate-limit helper | C0a (R8) | F1, F3, E1 | Only after R8 | – |
| Chaos reader `getChaos` | **C0a stub (R2)**; F1 replaces at ~13:45 | A | Yes (A and F designs agree) | Yes with the stub. As written, F1 and A collide |
| `kc-chaos` ConfigMap | F1 PR2 | A (the handler reads the `agenda` key) | Yes | Yes |
| Sessionize `fetchFeed`, `mapFeed`, fixtures | G PR1 (~13:15) | A | Yes (G decision 3) | Partly. A builds `time.ts`, `rooms.ts`, `access-tags.ts`, migrations and API first, and `ingest.ts` after G PR1 |
| Speech `startDictation`/`startCaptions` | **C0w stub (R2)**; E1 replaces | B (button) | Yes (signatures agree after the review) | Yes |
| Notes queue `enqueueNote`, `getLastSaveMs` | **C0w stub (R2)**; B PR2 (~14:00) | E1, F1 | Yes (B design) | Yes with the stub. As written, F1 is blocked until about 14:00 |
| `POST /api/notes`, tables `notes`/`people`/`promises`, `PATCH /api/promises/:id`, `POST /api/capture/seed` | B PR1 (~13:30) | C (read-only SQL), E1, F1 hook, F3 | Yes (exact columns in C's design) | C's pure modules yes; C's repo tests after B PR1 |
| `feed_runs` | A PR1 | F1 `/api/status` | Yes | Yes. F must handle a missing table (`42P01`) and return `feed_synced_at: null`, and should test that |
| Design tokens (names) | **D PR0 (R5, ~12:50)** | all UI | Only after R5. Today the names are not specified anywhere | UI can start at 12:20 with names from the C0w placeholder only if C0w uses D0's list |
| `t()`, `announce()`, `PREFS_STORAGE_KEYS` | C0w `t()` (12:20); D1 PR1/PR2 (~13:30 / ~14:15) | all; F3 | Yes | `announce()`: consumers use an `aria-live` region until D PR1 |
| `PROMISES`, `ACCESS-PROMISES.md` | D PR0 (~12:50) | F2, H, the G generator (strings only) | Yes | Yes |
| `<ShowToPerson>` | D2 PR3 (~14:30) | E (named in the review, absent from E's tasks) | Yes | E does not block on it |
| `GET /api/status/health` (`HealthSnapshot`) | F2 PR4 (~15:00) | E1 `health.ts`, H | Yes (F design) | Yes. Both tolerate 404 by design |
| `GET /api/status/release` | F2 PR5 | H | Yes | Yes (204/404 tolerated) |
| PromQL shared query contract | G decision 8 | F2 | Yes | Yes. The labels are UNVERIFIED (T9) for P5 only |
| `kc_captions_segment_ms` | E1 (~15:00) | F2, G4 | Yes | Yes. Empty results are handled |
| Deploy bot / `deploy.yaml` | C0b (~12:35); G hardens it | everyone (deploys) | Verified in T6b | – |

---

## 3. Lockfile and dependency strategy

**Recommendation: C0a pre-installs every dependency in group 1 (PR "C0-base"). No other agent changes `dependencies`, `devDependencies` or `package-lock.json`. Any new dependency goes through a request to the orchestrator.**
- The orchestrator lands a 2-minute `build: [KC-1] add <pkg>` PR from `main` through the queue.
- Requesters then run `git merge origin/main && npm ci`.
- "Take main's lockfile and re-run `npm install`" is the *accident* procedure only.

Why:
- **npm workspaces have exactly one root lockfile.** "Per-workspace locks" means abandoning workspaces and changing the Dockerfile and CI. Even then, 4-5 agents share `api/` and would still collide.
- **The rebase-and-reinstall rule as the primary strategy fails in the queue.** Two dependency PRs in one merge group conflict textually. The second is ejected, costs a full CI re-run, and `npm install` at a different time can resolve different transitive versions, which makes the change non-reproducible.
- **The full set is knowable today from the proposals.** One owner means zero lockfile churn after 11:30.

Pre-install list, compiled from all 9 proposals. C0a verifies each version at install.

| Workspace | Runtime | Dev / test |
|---|---|---|
| `api` | `fastify@5`, `@fastify/static`, `@fastify/otel` (route templates for 2.5a), `pg`, `pino`, `@opentelemetry/{api,api-logs,sdk-node,sdk-metrics,sdk-logs,resources,semantic-conventions,exporter-trace-otlp-http,exporter-metrics-otlp-http,exporter-logs-otlp-http,auto-instrumentations-node,instrumentation-pino}`, `@anthropic-ai/sdk`, `ajv` (+ `ajv-formats` if the schema uses `date-time`) (G, at runtime in the mapper) | `@types/pg`, `@types/node` |
| `web` | `preact`, `preact-iso`, `@dash0/sdk-web`, `idb-keyval` (B), `@huggingface/transformers` (E, lazy worker chunk only) | `@preact/preset-vite`, `fake-indexeddb` (B), `happy-dom`, `@testing-library/preact` (R8) |
| root | – | `typescript`, `vite`, `vitest`, `@playwright/test`, `@axe-core/playwright`, `eslint`, `typescript-eslint`, `eslint-plugin-jsx-a11y`, `prettier` |

Notes:
- Non-npm tools are installed by their workflow or used locally, and never go into `package.json`:
  - `k6` (F)
  - `percli` and the `dash0` CLI (F)
  - `kubectl`/`kustomize` (G budget and deploy)
  - `gh`
  - Playwright **webkit** and chromium (iPhone 15 needs webkit), installed once on the laptop
- Deliberately not needed: i18next (D writes its own `t()`), luxon (A uses `Intl`), `@fastify/rate-limit` (C0's helper, R8), and a UUID library (`crypto.randomUUID`).
- Dockerfile: install the runtime with `npm ci --omit=dev -w api`, so transformers and Playwright never enter the image (memory budget).

---

## 4. The schedule

### 4.1 Gates

| Gate | Condition | Unblocks |
|---|---|---|
| G-INIT (10:50) | Initial commit on `main` (openspec/, `.claude/`, `.gitignore` excluding `.env*` and `*.pem`, `AGENTS.md` with §5). Ruleset ON: PR required, 0 approvals, squash, merge queue, no required checks yet, check timeout raised from 15 to **25 min**. App bypass, secrets, `gitar-managed` label, issues KC-1… | C0a |
| G-BASE (~11:28) | PR "C0-base" (group 1: starter, workspaces, **all dependencies**, Dockerfile) merged | C0w, C0b, C0a group 2 |
| G-IFACE (~12:20) | C0a (api) and C0w (web) merged; `npm ci && npm test && npm run build` green on `main` (the orchestrator runs it locally, because no CI exists yet) | **Wave 1 starts coding** |
| G-LOOP (~12:50) | C0b merged → five check names added to the ruleset → `deploy:` commit landed → Argo synced → URL serves the shell → a server trace and a browser beacon appear in Dash0 | **Wave 1 may merge** |
| G-RULES (~12:50) | D PR0 merged (rules, promises, token names) | **Any feature PR may be opened** (Gitar reads rules from `main` and does not re-review after a force-push, T1). Wave 1b starts |
| G-QUEUE (15:30) | Last feature enqueue | – |
| G-FREEZE (15:40) | Queue empty; no feature merges until 16:45 | Staging |
| G-LATE (16:45-17:10) | Green, reviewed wave-2 PRs not on the demo path only; docs/README | Submission 17:30 |

This deviates from 07 §9 ("only then start wave 1"). Wave 1 *starts* at G-IFACE but *merges* only after G-LOOP. Agents work in their own folders, so a C0 defect found by the loop costs them a `git merge origin/main`, not rework. The strict alternative delays wave 1 by about 30 min. **User's choice; I recommend the split gate.**

### 4.2 Waves and slots (hard cap of 8 builders)

| Wave | Start | Agents (count) | Concurrent builders |
|---|---|---|---|
| 0 | 11:00 | C0a, D0 (outside the repo) | 2 |
| 0 | 11:30 | + C0w, C0b (D0 ends about 11:45) | 3-4 |
| 1a | 12:20 | D1, G, A, B, F1 (C0b still finishing) | 6 |
| 1b | 12:50 | + E1, D2, C (C uses mocks until B PR1 at about 13:30) | **8 (cap)** |
| 2 (slot handoffs) | ~14:00 | D1's slot → F2 (UI after F1 PR1, already merged) | 8 |
| 2 | ~14:20 | A's slot → H (PR1 first); B's slot → E2 | 8 |
| 2 | ~14:20 | F1 continues in its own slot with group 7 (D3, in scope) until about 15:20 | 8 |
| 2 | ~14:30 | D2's slot → F3 (optional) or C2 (optional) or rescue, in that priority | 8 |
| — | 15:20-15:40 | Agents finish; no new starts after 14:45 | falling |

Why 8 and not more:
- After R1-R14, file overlaps are not the limit.
- **CI capacity is the limit.** On the GitHub Free plan the documented limit is 20 concurrent Linux jobs per org; this was not measured on our repo.
- Each push runs 5-6 required jobs, and `ci-traces` adds one more run per finished workflow. One PR costs roughly 4 runs (3 pushes + 1 merge group), or about 110 job-minutes. That gives a capacity of about 10 PRs per hour.
- 8 agents produce about 10-12 PRs per hour at the peak, which is right at the limit.
- A 9th agent would push merge-group checks past the 25-min timeout.
- Orchestrator attention is the second limit. One Opus orchestrator can poll 8 streams on a 10-min loop.

Why not fewer: the work is about 23 agent-hours (D 3, G 3, A 2, B 2, F 6 including group 7, E 3, C 2.5, H 2) in 3.3 hours.

### 4.3 Merge order through the queue

Order: priority as written in the brief, with real dependencies in bold. Overhead is CI plus about 45 s per group, with up to 5 per group (T6).

1. C0-base
2. C0a-api and C0w-web (same group)
3. **C0b**, then the user adds the required checks and the loop is proven
4. **D PR0**
5. **G PR1** (feed-contract)
6. D PR1 (token values, `t()`)
7. **A PR1** (after G PR1)
8. B PR1
9. F1 PR1
10. G PR2
11. A PR2
12. **F1 PR2** (after A PR2, for its dry run)
13. B PR2, D PR2, G PR3, E1 PR1, D2 PR3 (G5 branch pushed, never opened), C PR1 (**after B PR1**)
14. F2 PR4 (**after F1 PR1**), A PR3, B PR3
15. G PR4 (rules-from-prod), E1 PR2, then **E2** (mount line after E1 PR2)
16. F2 PR5 (**after F1 PR2**), C PR2, F3, H PR1, H PR2, C PR3

Never merged: D's `card-contrast` branches, G's prepared branches, the G3 evidence PR (closed).

### 4.4 The first 90 minutes

| Time | What happens | Builders |
|---|---|---|
| 10:30-10:50 | **User:** cluster join, `kc-secrets`, initial commit to `main`, ruleset, App secrets, issues, label. Orchestrator: worktrees `wt/<agent>`, per-agent DB and ports file | 0 |
| 11:00 | C0a starts (`feature/KC-1-c0-base`). D0 starts Impeccable in `.scratch/kubecompanion/design/` (no repo writes). Orchestrator starts its watch loop | 2 |
| 11:05 | D0 shows 2-3 directions. **User picks by 11:20** (default: neutral) | 2 |
| 11:05-11:25 | C0a does group 1: starter copy, workspaces, the full dependency set, Dockerfile, **markers (R1)** | 2 |
| 11:20 | D0 records the pick as token names and values, rule text IN-1..12, DD-1..4, A11Y-2 and promises (scratch only) | 2 |
| 11:25 | C0a opens C0-base and writes its ledger entry; the orchestrator verifies it and runs `gh pr merge --auto`. Orchestrator checks the dependency list against §3 | 2 |
| 11:28 | C0-base merged; orchestrator posts "BASE ON MAIN" | 2 |
| 11:30 | C0w (`…-c0-web`) and C0b (`…-c0-delivery`) branch from `main`. C0a starts group 2 on a new branch from `main`. D0 hands its token *names* to C0w | 4 |
| 11:45 | D0 done and ends | 3 |
| 12:10 | C0a opens the api PR | 3 |
| 12:15 | C0w opens the web PR. Both ledger-verified, then enqueued by the orchestrator (no required checks yet) | 3 |
| 12:20 | Both merged; orchestrator runs install, test and build on `main` → **G-IFACE**. D1, G, A, B, F1 start; branches push, but **no PRs yet** | 6 |
| 12:22 | C0b runs `git merge origin/main` and opens its PR; the workflows run for the first time | 6 |
| 12:30 | C0b CI green, enqueued | 6 |

From 12:30 to 12:50:
- About 12:33: C0b merges. **User** adds the five checks to the ruleset. The deploy run starts.
- About 12:36: D1 opens PR0 from D0's prepared text.
- About 12:42: the `deploy:` commit lands and Argo syncs.
- About 12:48: the URL serves the shell and a trace appears in Dash0, so **G-LOOP** passes. While the loop runs, watch whether a `deploy:` push resets an in-flight merge group (§6, risk Q).
- About 12:50: D PR0 merges, so **G-RULES** passes. E1, D2 and C start, and feature PRs may be opened.

### 4.5 Where the human is the bottleneck

| When | User action | Mitigation |
|---|---|---|
| 10:30-10:50 | Ruleset, App, secrets, cluster, initial commit | Pre-scripted `gh` commands; orchestrator types, user approves |
| 11:05-11:20 | Design pick | Hard deadline 11:20, neutral default; only values change later |
| 12:33 | Add required checks to the ruleset | One `gh api` call, pre-written |
| Every PR (about 30) | Approvals: 0 required | **The orchestrator** fact-checks the agent's COMPLETION-LEDGER.md entry (must be VERIFIED), reads Gitar's review and arms auto-merge. The user gates only C0-base, C0b, D PR1 (look), and any PR touching `deploy/`, workflows or secrets |
| About 13:00 | Make the GHCR package public; set Pages source (H 2.5); start `kay-loop.sh` (F3, if it runs) | Batch them into one interrupt |
| About 13:00 / 14:00 | iPhone test for E's engine order | Before 14:00 so E1 can switch in time |
| 14:00-14:30 | Lunch and panel: the go/no-go rule in §6 | – |
| 15:30-16:45 | `KC_DEMO_SEED` on and off, load test, Agent0 and Radar, G5 rehearsal, G3 evidence run | Runbooks from G and F; orchestrator drives |

### 4.6 Compact agent table

| Agent | Change: task groups | Wave | Start | Depends on | Files owned (beyond markers and own entry) | Model |
|---|---|---|---|---|---|---|
| ORCH | Merges, deps PRs, logs, running doc, `AI-DISCLOSURE.md`, archive | – | 10:30 | – | RUNNING-LOG sync, `AI-DISCLOSURE.md` | **Opus** |
| C0a | c0: 1, then 2 (2.1-2.6) + stubs `chaos.ts` + `rateLimit.ts` | 0 | 11:00 | G-INIT | root config, lockfile, Dockerfile, `api/**` foundation, `api/migrations/000*` | Sonnet |
| D0 | d: 1.1 (Impeccable), prep 0.0-0.2 text | 0 | 11:00 | – | scratch only | Sonnet |
| C0w | c0: 3 + stubs `speech/index.ts`, `capture/queue.ts` | 0 | 11:30 | G-BASE | `web/**` foundation, `playwright.config.ts`, `vitest` config, under-the-hood registry | Sonnet |
| C0b | c0: 4, 5 | 0 | 11:30 | G-BASE | `deploy/postgres.yaml`, `deploy/deployment.yaml`, five workflows, `deploy.yaml`, `.gitar/review/*` (6 files), `AGENTS.md` (extend), README | Sonnet |
| D1 | d: 0, 1, 2, 3 | 1a | 12:20 | C0b for PR0 | `web/src/styles/`, `i18n/index.ts`, `a11y/`, `prefs/`, `ACCESS-PROMISES.md`, `promises.ts`, rule content | Sonnet |
| G | g: 1, 2, 3, 4, 5, 6 (G2 = 4-5 only if behind at 14:00) | 1a | 12:20 | C0b | `feed-contract/`, `services/sessionize/`, its workflows, scripts, runbooks, `hot-paths.md`, `budget.md` | Sonnet |
| A | a: 1, 2, 3 | 1a | 12:20 | G PR1 for 1.6 | migrations 100-102, `services/schedule/*` incl. `derive.ts`, `routes/{sessions,agenda}.ts`, `jobs/`, cronjob, `pages/{Schedule,Agenda}` | Sonnet |
| B | b: 1, 2, 3 | 1a | 12:20 | – | migrations 200-202, `routes/{notes,people,promises}`, `services/capture/`, `lib/capture/` (replaces stub), `screens/capture/`, `sw.js` sync handler | Sonnet |
| F1 | f: 1, 2, 3 + 5.5 runbook (R11), then **7 (D3, in scope, R15)** from about 14:20 to 15:20 | 1a | 12:20 | A PR2 for 2.4; F2 PR4 (`onHealthTransition`) for 7.1 wiring | `routes/status.ts`, `lib/chaos.ts` (replace), `screens/status/`, `observability/` (F1 files), `scripts/load/`, `observability.yml`, chaos ConfigMap; group 7: `agent0.ts`, `routes/status-explain.ts`, `Agent0Line.tsx`, `status-agent0.json` | Sonnet |
| E1 | e: 1, 2, 6, 4 | 1b | 12:50 | G-RULES | `lib/speech/**` (replace), `pages/captions/**`, `routes/captions.ts`, `captions.json` | Sonnet |
| D2 | d: 4, 5 | 1b | 12:50 | D PR0 | `features/access/` (cards, badge, calm, ShowToPerson), `access-cards.json`, `web/e2e/access/`, G5 branches | Sonnet |
| C | c: 1, 3 (+2 if no C2) | 1b | 12:50 | B PR1 for repo tests | migrations 300-303, `services/threads/*`, `routes/threads.ts`, `seed/`, `threads-cronjob.yaml` | Sonnet |
| F2 | f: 4, 5 (minus 5.5) | 2 | ~14:00 | F1 PR1/PR2 | `status-health.ts`, `services/health/`, `HealthBanner`, `PromiseLights`, `ReleaseFooter`, `status-health.json`, F2 `observability/*`, `release-note.mjs` | Sonnet |
| H | h: 1, then 2 | 2 | ~14:20 | D PR1 | `screens/under-the-hood/`, `hood.json`, `web/e2e/hood/`, `docs/how-it-works/`, build script, `pages.yml`, `playwright.pages.config.ts` | Sonnet |
| E2 | e: 3 | 2 | ~14:20 | E1 PR2 for the mount | `routes/translate.ts`, `services/translate.ts`, `web/src/lib/translate/`, `translate.json` | Sonnet |
| F3 (opt) | f: 6 | 2 | ~14:30 (D2's slot) | D PR2, F1 PR1 | `web/e2e/kay/`, `kay-loop.sh`, `kay-probe.yml`, `synthetic-kay.yaml`, `status-kay.ts` | Sonnet |
| C2 (opt) | c: 2 | 2 | ~14:30 | C PR1 | `web/src/views/Threads*`, `threads.json`, C's registry entry | Sonnet |

---

## 5. Rules of engagement

Paste this section into `AGENTS.md` (the initial commit) and into every agent prompt.

0. **Completion ledger (hard gate, user decision 2026-11-09).**
   - When you believe a PR is done, append one entry to `COMPLETION-LEDGER.md (outside the repo; absolute path given in your agent prompt)` using the format at its top: what you built (claims tied to OpenSpec task ids), every file changed (`git diff --name-only origin/main...HEAD`), and how you verified it (exact commands, exit codes, key output lines, the CI run URL for that exact head sha), plus known gaps.
   - Then log `ledger-ready` in RUNNING-LOG.md and stop. **Never run `gh pr merge` yourself.** The orchestrator fact-checks the entry against the commit and arms auto-merge only on VERIFIED. PARTIAL or REFUTED comes back to you with the gaps.
   - Any new push needs a new entry; an old verdict does not carry over.

1. **Isolation.**
   - Work only in your own worktree: `git worktree add ../wt/<agent> -b <branch> origin/main`.
   - Use `PORT=$KC_PORT`, `VITE_PORT=$KC_VITE_PORT` and `DATABASE_URI=…/kc_<agent>` from the orchestrator's ports file.
   - Never set `DASH0_TOKEN` locally. Set `ANTHROPIC_API_KEY` locally only with the orchestrator's OK.
2. **Branch naming.**
   - Use `feature/KC-<issue>-<change-id>[-<part>]-pr<k>`, for example `feature/KC-5-d-access-kit-cards-pr3`.
   - Use `bugfix/` for staged breaks.
   - Use a new branch per PR, always from `origin/main`.
   - **Never branch from another agent's unmerged branch.** A squash merge turns that into an add/add conflict, as the scratch test in §0 shows.
   - Commit format: `feat: [KC-<n>] …`, using the GitHub noreply email.
3. **Rebase policy under the merge queue.**
   - Strict up-to-date is off, so do not update your branch unless one of these is true:
     - GitHub shows a conflict.
     - The queue ejected your PR.
     - You need code that is now on `main`.
   - To update, run `git fetch origin && git merge origin/main`, re-run your tests, push, append a new COMPLETION-LEDGER.md entry for the new head and log `ledger-ready`. The orchestrator re-verifies and re-arms auto-merge (no `--squash`; the queue sets the method).
   - **Never rebase a pushed branch and never force-push.** `git pull --rebase` is allowed only for local, unpushed commits on top of Gitar's commits.
4. **Gitar.**
   - Label each PR `gitar-managed`.
   - After Gitar pushes, run `git pull --rebase` before your next commit.
   - Reject, and report to the orchestrator, any Gitar commit that edits another change's files, weakens a test or a11y rule, or touches `.github/workflows/`.
5. **Shared files.**
   - Insert only under your own `>> <change-id>` marker.
   - Never edit outside the Ownership list of your change and task groups.
   - Never touch dependencies, `package-lock.json`, `tsconfig*`, `playwright.config.ts` or `vitest` config. Touch `vite.config.ts` only with orchestrator approval.
   - Lockfile accident: `git checkout origin/main -- package-lock.json && npm ci`.
   - Tick only your own lines in `tasks.md`.
   - Never run `openspec archive`.
6. **Before you open a PR.**
   - Run `npm run lint && npm test` and the Playwright specs of your change (iPhone 15 + Pixel 7, axe), plus `openspec validate <change> --strict`.
   - Push only when you are ready for review, because every push costs about 6 CI jobs.
   - Open PRs only after the orchestrator has posted **RULES LIVE**.
   - Do not enqueue until **LOOP PROVEN**.
7. **Claiming work.**
   - Your task groups are fixed in your prompt (§4.6). Claim them with a comment on your GitHub issue, `claimed: groups X`, and one log line.
   - Do not take another agent's tasks without the orchestrator's assignment.
8. **The running doc.**
   - Build-day agents do **not** write to the Claude Docs doc. The orchestrator is its only writer.
   - Log by appending (never Edit/Write the file): `printf -- '- %s [<agent>] [KC-n] <event>\n' "$(date +%H:%M)" >> RUNNING-LOG.md (outside the repo; absolute path given in your agent prompt)`
   - Log events: start, PR opened, merged, blocked, decision.
   - This needs the user's OK, because `2026/hackathon/CLAUDE.md` currently tells every agent to update the doc.
9. **Stop and ask the orchestrator; do not improvise** when any of these happens:
   - You need a file outside your ownership, or a new dependency.
   - An interface signature differs from the design.
   - `main` is red or the deploy is broken.
   - Your PR has been ejected twice.
   - The cluster shows quota or CrashLoop.
   - LLM cost appears.
   - You are 30 min past your time box.
   - Anything involves secrets, the ruleset, repo variables (`FEED_FIXTURE`/`FEED_MODE`), the `kc-chaos` ConfigMap or `KC_DEMO_SEED`.
10. **After every merge** (from C0's `AGENTS.md`): check with the Radar MCP (sync status, `get_changes`, warning events) and note anything odd in the PR.

---

## 6. Failure modes and the circuit-breaker

### The orchestrator's watch loop (every 10 min, one batched script)

The loop checks:
- `gh pr list` (age, checks, queue state)
- queued Actions jobs and median wait
- the last `deploy` run, and whether a `deploy:` commit followed it
- Argo sync and health via the Radar MCP
- warning events and quota
- tail of `RUNNING-LOG.md` (silence for more than 30 min means the agent is stuck)
- Gitar commit count per PR (cap 3)
- Anthropic spend

### Top collision risks and their fixes

1. **Registry appends** (R1). Without markers, about 20 queue ejections over the day.
2. **Cross-change files created twice:** chaos, queue and speech stubs, A editing `mapper.ts`, and split agents sharing one i18n file (R2-R4). Without fixes these are add/add conflicts within wave 1.
3. **Queue and main-branch churn:**
   - Branching from an unmerged sibling (R9).
   - `deploy:` and `rules:` bot pushes possibly resetting in-flight merge groups (risk Q, UNVERIFIED in T6/T6b). Test it during G-LOOP. If groups reset, enqueue right after a `deploy:` commit lands and batch up to 5. The fallback is the 07 O3 deploy branch.
   - Flipping `FEED_FIXTURE`/`FEED_MODE` turns every PR and merge group red. G flips them only after the orchestrator posts **QUEUE PAUSED** with an empty queue, and resets immediately.

### Trips

| Signal | Action |
|---|---|
| `main` deploy is broken, or Argo is Degraded after a merge | **QUEUE PAUSED**: nobody enqueues. The owner fixes forward within 15 min, otherwise the orchestrator reverts the PR |
| Two ejections from the same file within 30 min | Stop both agents; the orchestrator assigns the file to one owner. **Cap drops to 6** for 30 min |
| Actions queued for more than 10 min, or a merge group times out | No new agent starts. Agents push only at PR-ready. Restrict `ci-traces` to `main` (R14) |
| An agent 45 min behind its plan | Split it into a freed slot (A UI, C2, G2), or cut from the list below |
| Gitar at its 3-commit cap on a PR | The agent fixes by hand; no nudges |

### Wave-2 cut order (cut from the top)

1. F3 Synthetic Kay (the P3 and P4 lights show "Not measured right now")
2. H PR2 (static page and Pages)
3. C PR3 (cronjob, dashboard)
4. C2 "Next steps" tab polish
5. F2 PR5 (release footer)
6. E2 server translate
7. F group 7 (D3). The user chose to keep it, so cut it only with the user's OK. If cut, the Status screen falls back to the health-template sentence
8. H PR1

**Never cut:**
- D2 group 5 (the G5 on-stage branch, pushed by 14:30)
- G groups 4-5 (G4 dispatch at 15:47)
- F1 chaos, load test and runbook
- E1 core captions
- C PR1 with minimal UI
- B

### Lunch go/no-go at 14:00 (the user, in 2 minutes)

**GO** for the full wave 2 when all of these hold:
- G-LOOP is proven.
- These are on `main`: D PR0 and PR1, G PR1, A PR1 and PR2, B PR1 and PR2, F1 PR1.
- No PR has been in the queue or ejected for more than 20 min.
- The Actions wait is under 5 min.

Otherwise, **NO-GO**:
- Do not start H or F3.
- F2 does PR4 only.
- E2 starts only if B's slot frees before 14:30.
- Every freed slot goes to rescuing the never-cut items.

At **15:00**, re-check: anything not opened as a PR by 15:15 will not merge before the freeze and moves to the 16:45 window or is dropped.
