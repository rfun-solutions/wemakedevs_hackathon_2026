# 07 · Deep plan: scope options, architecture, demo stories, live tests

_Written 2026-11-08 by the deep-planner session from research 01–06, the resources vault and the running doc. Everything here is an **option for the user**, not a decision. Nothing below is code or UI design (rule 1). Items marked UNVERIFIED carry forward from the research files._

Fixed inputs (decided by the user): Gitar + Dash0 primary, Radar stretch with a ready plan, Conferences for Everyone (CfE) woven through, runtime = Radar event vcluster (2 CPU / 4 GiB requests, no hostPath/privileged, Argo CD), OpenSpec propose today / apply tomorrow, Impeccable mobile-first, every integration live-tested first, scope sized by parallel agents.

**Revision 2 (later on 2026-11-08), after the user answered section 6:** scope = Lean + Core together (C0, A, B, D, G, F, then E, C; about 7 agents; H, I, J not planned). Stack = one Node 22 service + CloudNativePG. Demo = one character (Kay) plus a backup video; the 15:45 staging hour stays. LLM = the user's Claude API key, Haiku 5.5 default, Sonnet 5.5 where needed. Transcription test on iPhone + desktop Chrome only. **Branch protection ON** (reverses the suggestion in 2.6): every change on its own branch, merged only by PR with required CI checks and Gitar review. Target repo `github.com/rfun/wemakedevs_hackathon_2026`, empty until kickoff. New sections 7–9 cover merging under protection, the deploy bot, and the step-one checklist. Earlier sections are left as written, with notes where a decision superseded them.

Build window: kickoff 10:00, cluster available ~10:30–11:00, **submission 17:30**. Realistic coding wall-clock: 11:00–16:45 (5¾ h) plus 45 min for staging the stories, README and submission.

---

## 0. The one thing that shapes everything: the merge graph

Parallel agents only help if their changes do not collide. The repo therefore needs a **scaffold change that merges first** and defines ownership boundaries, after which every other change lives in its own folder and touches shared files only through append-only registries.

```
                      ┌──────────────┐
                      │ C0 Scaffold  │  one agent, 11:00–12:00, merges first
                      └──────┬───────┘
      ┌────────┬─────────┬───┴────┬─────────┬──────────┐
      ▼        ▼         ▼        ▼         ▼          ▼
   A Sched   B Capture  D Access  G Pipeline  F Observe   (wave 1, parallel)
      │        │         │  kit     + CI break   surface
      │        ├────┐    │
      ▼        ▼    ▼    ▼
   H Quiet   C Threads  E Captions                       (wave 2, parallel)
   map        (LLM)     + translation
                                   └──► J Radar canary + investigation (last, stretch)
```

Ownership rule proposed for every change: `web/src/features/<change>/`, `api/src/routes/<change>.ts`, `api/src/services/<change>/`, `openspec/changes/<change>/`. Shared files (`web/src/routes.ts`, `web/src/nav.ts`, `web/src/i18n/<lang>/<change>.json`, `deploy/kustomization.yaml`) are **append-only registries**, one line per feature, so Git merges cleanly. i18n keys namespaced by change. D (access kit) owns the global tokens and CSS, so it merges **before** A and B to avoid restyling churn.

Wave 1 PRs are all independent of each other. Wave 2 depends on wave 1 as drawn. Each PR is Gitar-reviewed; this alone satisfies "features landing through PRs it reviewed, not one PR at the end".

---

## 1. Scope options

### 1.1 Catalogue of changes (units of agent work)

| Id | Change | What it delivers (mobile-first PWA) | Depends on | Tracks / judging criteria it scores |
|---|---|---|---|---|
| **C0** | Scaffold | Repo from `cnh-starter` template; single Node 22 service (API + static PWA); Dockerfile; kustomize; CI = lint, unit, **mobile Playwright** (iPhone + Pixel viewports), axe a11y check; `.gitar/review/*.md` (3 files: external-calls, time-zones, accessibility); OTel Node SDK bootstrap + pino log bridge; RUM init; service worker shell; `/healthz` `/readyz`; Impeccable design tokens applied after the user picks a direction | – | Gitar (project-aware rules, first reviewed PR), Dash0 (instrumentation from hour one, "not bolted on"), CfE (a11y gate in CI) |
| **A** | Schedule + agenda | Sessionize feed → cached in DB by a CronJob/startup job; sessions list by day/room/track; "My agenda"; venue time zone handled explicitly (Gitar rule); **building-change warning** (Salt Palace ↔ Hyatt back-to-back, walking buffer); access tags heuristics (Novice track, demo-heavy) | C0 | Gitar (organizers' idea 1: time-zone rule), Dash0 (the "My agenda" slow-down story needs this endpoint), CfE (mobility hint, access tags), "conferences easier" |
| **B** | Capture | Notes, people met, promises; voice dictation into the note field (Web Speech with keyboard fallback); **offline queue** in IndexedDB + background sync; capture-latency span and metric (`capture.saved_ms`) | C0 | Dash0 (SLO candidate: capture p95 < 500 ms; RUM on the capture flow), CfE (voice as alternative to typing, offline on venue Wi-Fi) |
| **D** | Access kit | Communication cards ("I'm deaf, please type", "slower please") with full-screen show-to-person mode and optional text-to-speech; display modes (large type slider, Atkinson Hyperlegible, high contrast, reduced motion); UI i18n with EN + ES + PT-BR + one RTL (AR) smoke; pronoun/communication-preference badge (local only); WCAG 2.2 AA pass (target size 24 px, focus order, live regions) | C0 | CfE (the bulk of it), all tracks ("conferences easier") |
| **E** | Captions + translation | Live captions from the room (Web Speech where available, cloud STT via a WebSocket proxy where not); highlight-to-note from the caption stream; translation of captions (Chrome Translator API on desktop, LLM proxy fallback on phones); captions rendered in an ARIA live region | B, D | CfE (Deaf/HoH, ESL), Dash0 (the proxy is a traced server path; optional GenAI/OpenLIT spans) |
| **C** | Evening threads | Groups the day's notes into threads that carry across days; LLM call traced with GenAI semantic conventions (organizers' Dash0 idea 4) or a heuristic grouping when no key | B | Dash0 (LLM call tracing: tokens, cost, latency), "conferences easier" |
| **F** | Observability as product | In-app **Status** screen: "saved in 180 ms", feed freshness, "Is it the Wi-Fi or us?" (client RTT vs server SLO); Perses dashboard as code applied in CI via `dash0` CLI; check rule for capture latency; synthetic check on the public URL; chaos switch = **app-level** latency/error flag in a ConfigMap (never cluster-level) | A, B (for meaningful data) | Dash0 (observability part of the product; bonus dashboard/SLO), Gitar (dashboard JSON lands through reviewed PRs) |
| **G** | Pipeline + CI break | `schedule-feed-contract` CI job: validates the upstream feed against a JSON schema and runs mapper tests; mock upstream as a service container controlled by `chaos.json`; CI traces to Dash0 with `otel-cicd-action` on `workflow_run`; GHCR build + Argo sync via the starter | C0 | Gitar (CI failure diagnosis + auto-apply), Dash0 (CI traces), Radar (ship through Argo/MCP) |
| **H** | Quiet & sensory map | Static list: quiet rooms 260A/260B, prayer room, nursing room, child care; sessions-by-room; user-reported crowd level (calm/busy/loud) with no accounts, rate-limited | A | CfE (neurodivergent, sensory, caregivers), Dash0 (check-ins as metrics = organizers' idea 2), Radar (idea 3 crowd map) |
| **I** | Hallway icebreakers | Conversation starters from the user's own notes ("ask about X from session Y"); opt-out-of-small-talk scripts | B, C | CfE (introverts, first-timers, speech diversity) |
| **J** | Radar canary + investigation | Argo Rollouts canary for one real release; Radar AI investigation "anything regressed after release X?"; Checks before/after screenshots; Radar MCP used to sync and read logs through the day | everything deployed | Radar (all four criteria) |

### 1.2 The three bundles

| | **Lean** | **Core** (recommended target) | **Ambitious** |
|---|---|---|---|
| Changes | C0, D, A, B, G, F-minimal (Status screen + chaos flag, no dashboard-as-code) | Lean + E, C, F-full, J-planned | Core + H, I, J-built |
| Agents after scaffold | 4 in wave 1 (A, B, D, G) + 1 for F | 5 in wave 1 (A, B, D, G, F) + 2 in wave 2 (E, C) | 5 + 4 (E, C, H, I) + J |
| Gitar | ≥ 6 reviewed PRs, 3 rule files, 1 staged CI break with auto-apply | ≥ 9 PRs; also Gitar reviews the PR Agent0 opens | ≥ 12 PRs |
| Dash0 | Traces + logs + metrics + RUM; Agent0 finds one real issue; Status screen | + LLM tracing, Perses dashboard, check rule, synthetic, SLO if beta enabled | + crowd metrics |
| Radar | Deployed on the event cluster via Argo; MCP used to ship (free, comes with the runtime) | Plan ready; investigation run if time allows at 16:00 | Canary + investigation built in |
| CfE | Access kit, dictation, offline, mobility hint | + captions, translation | + quiet map, icebreakers |
| Demo beats available | 0, 1, 2, 3a (cards), 4, 5, 7 | + 3b (captions), 6 (threads) | all |
| Main risk | Looks thin against teams with a bigger surface; still beats most on depth per track | Captions on iOS are the single riskiest item; cloud fallback must pass today's live test | Wave 2 lands after 15:30 and starves the story-staging window |

**Decided (rev 2): Lean + Core together, Ambitious not planned.** The original reasoning follows. **Why Core is the recommended target.** It covers every judging criterion of both primary tracks, gives CfE two headline moments (cards and captions), and keeps wave 2 to two changes so the 16:00–16:45 story-staging window survives. Ambitious items H and I are cheap to add **only if** wave 1 lands by 13:30; make them an explicit go/no-go at lunch.

### 1.3 Proposed event-day timeline (Core)

| Time | What | Who |
|---|---|---|
| 10:00–10:30 | Kickoff + Radar talk. Ask: demo length/format, submission mechanism, SLO beta, egress from vcluster | user |
| 10:30–11:00 | Join code → team cluster; repo from template; Gitar app on repo; Dash0 secrets in cluster; Impeccable produces 2–3 directions | user + 1 agent |
| 11:00–12:00 | **C0 Scaffold** (one agent). User picks the design direction in parallel. First Gitar-reviewed PR | 1 agent |
| 12:00–14:00 | **Wave 1**: A, B, D, G, F in parallel; D merges first (tokens), then G (pipeline), then A/B, then F | 5 agents |
| 14:00–14:30 | Lunch + panel. Go/no-go on H and I | user |
| 14:30–15:45 | **Wave 2**: E, C (and H, I if go) | 2–4 agents |
| 15:45–16:45 | **Story staging**: load test → Agent0 investigation → PR → Gitar review → merge → Argo deploy; staged Sessionize schema-drift PR → Gitar auto-apply; Radar investigation "all clear after release"; dashboard screenshots | user + 1 agent |
| 16:45–17:30 | README, setup instructions, AI-assistant disclosure, backup video of beats 4 and 5, submit | user + 1 agent |

Gitar and Agent0 both take minutes per round and auto-apply caps at 3 consecutive Gitar commits, so the story-staging hour is **not compressible**; cut wave 2 before cutting it.

---

## 2. Architecture on the event cluster

### 2.1 Stack options

| Option | Shape | For | Against |
|---|---|---|---|
| **S1 (recommended)** Single Node 22 service | Fastify or Hono API + Vite PWA (Preact/React) served as static files from the same container | One image, matches the starter's Dockerfile and deploy workflow; Dash0 operator auto-instruments Node if it ever runs; OTel Node auto-instrumentation is mature; same-origin RUM → backend trace propagation needs no CORS/propagator config | Frontend and API agents share one `package.json` (mitigate: workspaces `web/` and `api/`) |
| S2 Two services (web + api) | Separate Deployments, Service `app` fronts web, web proxies `/api` | Cleaner ownership for parallel agents; a real service graph in Dash0/Radar topology | Two images, two Argo-tracked workloads, cross-origin RUM propagation, double the requests |
| S3 Next.js / SvelteKit full-stack | Server routes + UI in one framework | Fast UI iteration | Server-side instrumentation is framework-specific and noisier; SSR costs memory |

### 2.2 Data store options

| Option | Fits 4 GiB? | For | Against |
|---|---|---|---|
| **DB1 (recommended)** CloudNativePG, 1 instance, 1 PVC 2 Gi | ~250m / 512 Mi req | Operator pre-installed, starter ships the example (`db-rw:5432`); real DB spans make the N+1 story honest; Radar topology shows the dependency | Startup time on a new cluster; one more thing in the quota |
| DB2 SQLite on a PVC | ~0 | Zero extra pods | Forces 1 replica + `Recreate` strategy; no canary; weaker telemetry story |
| DB3 In-memory + IndexedDB only | 0 | Simplest | Nothing "real" for Agent0 to investigate; notes die on restart (OOM story then becomes data loss) |

### 2.3 Telemetry paths to Dash0 (the Dash0-operator question)

Default plan is **T1**. T3 is tried once today on the k3d mirror; if it is admitted and stays under ~1.5 GiB requests, it is an upgrade, not a dependency.

| Path | How | Pros | Cons / unknowns |
|---|---|---|---|
| **T1 SDK direct** | `@opentelemetry/sdk-node` + auto-instrumentations (http, fastify/hono, pg, pino, undici) → OTLP/HTTP (4318, TLS) straight to the Dash0 ingress endpoint; `Authorization: Bearer` + `Dash0-Dataset` from a Secret via `secretKeyRef`; logs via the OTel logs SDK/pino bridge, still also printed to stdout for `kubectl logs`/Radar; metrics via OTLP + `/metrics` annotated for the vcluster Prometheus (Radar sees them too) | No cluster components; nothing to be refused; traces, logs and metrics all correlated | Needs egress 443 from the vcluster (confirm at kickoff; research 03 Q6); no k8s-level metrics (pod CPU/mem come from Prometheus/Radar instead); resource attributes (`k8s.pod.name` etc.) set from the Downward API by hand |
| **T2 Collector Deployment** | One `otel/opentelemetry-collector-contrib` Deployment (100m / 256 Mi), receivers OTLP + prometheus (scrape app `/metrics`), processors k8sattributes, batch, exporter otlphttp → Dash0; app exports to `collector:4318` | Single egress point, token lives in one Secret, k8s attributes enriched automatically, can also scrape kube-state-like endpoints if any are reachable | One more pod in quota; `k8sattributes` needs RBAC (cluster-admin is available); still no node/kubelet metrics (no host access) |
| **T3 Dash0 operator** | Helm install per vault; try values that disable the DaemonSet filelog/hostPath collector (inspect `helm show values dash0-operator/dash0-operator` for a DaemonSet/filelog toggle — UNVERIFIED that one exists) | Auto-instrumentation, k8s metrics, `PersesDashboard`, `PrometheusRule`, `Dash0SyntheticCheck` CRDs → dashboards and checks as GitOps code via Argo | 1.3–1.5 GiB requests; DaemonSet almost certainly Pending (hostPort 40317/40318, hostPath); webhooks in a vcluster UNVERIFIED |

Without the operator, "as code" still works: a CI job runs the `dash0` CLI to apply the Perses dashboard and synthetic check files that live in the repo (so they arrive through Gitar-reviewed PRs). Check rules: CLI/API support UNVERIFIED; fall back to creating the one rule in the UI and exporting it.

### 2.4 Where browser monitoring fits

- `@dash0/sdk-web` (verify name vs `@dash0hq/sdk-web` in today's test) initialised first thing in the PWA entry, `serviceName: kubecompanion-web`, ingest-only **client token** injected at build (public by design), `sessionSamplingRate: 1` for the demo.
- Same-origin `/api/*` calls carry `traceparent` automatically → one trace from tap to SQL.
- The service worker must **bypass** the Dash0 ingest host and never cache `/api/*` writes; it caches the schedule JSON, the app shell and the note queue.
- Web vitals + JS errors are the only signal for the iOS-specific failures (SpeechRecognition quirks), which is also a candidate "real issue" (see 3.2).
- Synthetic check from Dash0 against `https://<team>.cnh.radarhq.io/healthz` covers "is it up" from outside the venue Wi-Fi.
- CI traces (`otel-cicd-action`) arrive as a separate service `kubecompanion-ci`; use a `noreply` author email on commits (rule 4: the action exports author emails unredacted).

### 2.5 Budget (requests; limits are 2× budget and not the constraint)

| Workload | Replicas | CPU req | Mem req | PVC |
|---|---|---|---|---|
| app (S1) | 2 | 2 × 100m | 2 × 192 Mi | – |
| CNPG Postgres | 1 | 250m | 512 Mi | 1 × 2 Gi |
| OTel collector (T2, optional) | 1 | 100m | 256 Mi | – |
| schedule-sync CronJob (transient) | 1 | 50m | 64 Mi | – |
| Argo Rollouts canary (J, transient) | +1 app | 100m | 192 Mi | – |
| **Subtotal** | | **~0.75 CPU** | **~1.4 GiB** | 1 of 4 |
| Dash0 operator (T3, only if admitted) | | ~0.6 CPU | ~1.3–1.5 GiB | – |
| **Total with operator** | | **~1.35 CPU** | **~2.9 GiB** | fits in 2 CPU / 4 GiB |

Pre-installed platform components (Argo CD, Prometheus, CNPG operator, Radar) are presumably outside the team quota (starter does not say; UNVERIFIED). Watch for `exceeded quota: team-quota` after the first sync; that event is itself a real Radar investigation candidate.

### 2.6 Deploy flow and the Gitar/Argo interplay

Starter flow: PR → merge to `main` → Action builds to GHCR (public package) → Action commits `deploy:` SHA to `deploy/kustomization.yaml` with `[skip ci]` → Argo CD syncs (trigger via Radar MCP `manage_gitops` or auto-sync). Implications:

- Every merge produces a bot commit on `main`; PR branches need rebase before merge. ~~Recommend: no branch protection, squash-merge~~ **Superseded (rev 2): the user chose branch protection ON. See section 7 for the merge plan and section 8 for how the bot commit gets past protection.** Gitar auto-apply stays on per PR via the `gitar-managed` label.
- Gitar's fix commits and the deploy bot's commits never touch the same files (`deploy/kustomization.yaml` is bot-only), so no conflicts expected.
- Argo auto-sync means the Agent0 fix reaches production in minutes during the demo; keep manual sync for the canary (J).

---

## 3. Real-issue stories for the demo

### 3.1 Gitar: an external system breaks CI, Gitar diagnoses and auto-applies

The Sonar track's own idea 3 is "breaking your CI on purpose and letting auto-apply fix it live", so a staged break is sanctioned **for this track**. The honest framing: it is a rehearsal of an upstream change that does happen (Sessionize and Sched have both changed shapes between years).

Story: `schedule-feed-contract` job validates the upstream feed and runs mapper tests. Upstream is a mock service container in CI (`mock-upstream`) whose fixture is chosen by `chaos.json`; a nightly job also runs the contract against the **real** Sessionize feed as a smoke step (not on the demo path, so Wi-Fi cannot break the demo).

| Variant | PR that triggers it | Expected Gitar fix | Confidence (test today) |
|---|---|---|---|
| **V1 schema drift (primary)** | `chaos.json: "fixture": "sessionize-v2"` where `startsAt`→`starts_at`, `rooms[].name` split into `building`/`level`/`room` | Update mapper + JSON schema + fixture-based tests; Gitar's review should also cite the `.gitar/review/external-calls.md` rule | High: pure code change |
| V2 rate limit 429 after N calls | `chaos.json: "mode": "429"` | Add retry with backoff + cache the last good feed | Medium: Gitar may classify as flaky and retry instead of fixing |
| V3 expired TLS (`expired.badssl.com`) or DNS blackhole with 3 s timeout | `chaos.json: "upstream": "https://expired.badssl.com"` | Fail fast with a clear error + fallback to the cached feed | Medium: Gitar may say "infrastructure, not fixable" (also a fine demo line) |
| V4 Docker Hub pull rate limit (base image `node:22` anonymous) | Organic; may happen during the day | Switch to `ghcr.io`/pinned digest | Opportunistic; screenshot it if it happens |

**T1 result (2026-11-08, `a throwaway test repo`, details in `research/08-live-tests/T1-gitar.md`):** Gitar fixed V1 and V2 in code within 2.5 min of PR open, cited the `.gitar/review/` rules, never touched workflows, and passed CI on the first rerun. On V3 it **reverted `chaos.json`** instead of fixing code, because the chaos lived in the PR diff. So V1 is the demo; if V3 is wanted, the break must live **outside the PR** (a repo variable, a fixture on `main`, or a real external host named in config on `main`) so that reverting the PR is not a valid answer and Gitar must add fail-fast + cached-feed fallback.

Make the review rules do work: `.gitar/review/external-calls.md` ("every outbound call has a timeout, bounded retry, and a fixture-backed contract test; never parse upstream JSON without the schema"), `time-zones.md` (organizers' idea 1), `accessibility.md` ("every interactive element has an accessible name; no `div` buttons; targets ≥ 24 px"). Gitar reading these on the first PRs is "project-aware setup".

Fallbacks during the demo: comment `Gitar fix CI, keep the timeout unchanged` if auto-apply stalls; keep a pre-recorded run of V1 from the morning; note the 3-consecutive-commit cap and usage budget.

### 3.2 Dash0: Agent0 finds and fixes a real issue

Two routes, run both and keep whichever is more real:

**Route A, organic first.** After the first deploy (~12:30) and again after wave 1 (~14:00), run Agent0 "Live Insights" on `kubecompanion-api` and `kubecompanion-web` and ask "what is wrong or slow right now?". Things that are likely to be genuinely broken on a first deploy of this app: iOS Safari JS errors around `webkitSpeechRecognition`/`continuous` (RUM-only, exactly the signal the judging asks for), a service worker caching `/api` responses, missing DB index on `notes(user_day)`, uncaught 404s from the schedule CronJob. Whatever Agent0 finds, fix it through a PR it proposes (GitHub connector) → **Gitar reviews Agent0's PR** → merge → Argo deploys → Dash0 shows the error rate drop. This is the strongest cross-track moment in the whole demo.

**Route B, the keynote rush (backup, organizers' Dash0 idea 3 verbatim).** "My agenda" fetches speakers per session (N+1 against Postgres) behind a feature flag `agenda.naive=true` that is on by default in the first release. At 15:45 the user runs a small load generator (`hey`/`k6` from the laptop, 50 virtual attendees for 60 s = "everyone opened the app after the keynote"). Traces show one request fanning into 40 sequential `pg.query` spans; RUM shows p95 LCP on `/agenda` climbing. Agent0 is asked "why did /agenda slow down at 15:45?" → it reads traces, reads the code, proposes a single-query fix or flag flip → PR → Gitar → Argo → p95 drops. Honest disclosure in the demo: "this is the bug we would have shipped; the flag let us schedule the rush".

Also show the product surface: the Status screen tells **attendees** "saved in 180 ms · feed 4 min old · your Wi-Fi is slow, not us" while the dashboard tells the team the same thing. SLO: ask Dash0 at kickoff to enable the beta; otherwise a check rule on `capture.saved_ms p95 < 500 ms` stands in.

### 3.3 Radar (stretch): an investigation that doesn't break things on purpose

The starter says "don't break things on purpose; an all-clear after a release counts". Reconciliation:

1. **Chaos stays app-level and Dash0-scoped.** The chaos flag changes behaviour inside the app process (latency/error injection, naive query path). It never kills pods, fills memory to OOM, or touches cluster objects. Radar is never asked to investigate something the team broke on purpose.
2. **Radar investigates real events and releases.** Candidates that will occur anyway: `exceeded quota: team-quota` on the first sync with the collector or Postgres; `app-code` ConfigMap noise (don't investigate; starter says so); a readiness-probe flap on the first CNPG connection; the first canary release.
3. **The canary (J).** Ship the Agent0/Gitar fix (or the captions change) as an Argo Rollouts canary with the starter's example; run the AI investigation "did release X regress anything? compare error rate and latency to the previous version" → all-clear or a finding → promote. Screenshots of Checks "before" (first hour) and "after" (16:30).
4. Radar MCP is used all day for `manage_gitops` sync, `get_workload_logs`, `get_changes` after each merge; that satisfies "UI and MCP throughout building". Mark the investigation **Shared** so judges can open it.

---

## 4. Demo storyline

### 4.1 The character

Working name **Kay** (gender-neutral; they/them in the script). First KubeCon, solo, came for the eBPF talks. Kay is hard of hearing and English is their second language. Two supporting characters avoid stacking every barrier onto one person and give the hallway beats a second face: **Mo**, a maintainer Kay promises to follow up with, and **Lin**, a volunteer at the Merge Forward table. The cartoon style is set once in a character sheet (front, side, three expressions) and reused as the reference image for every panel; speech bubbles are HTML overlays so the text stays crisp and translatable.

Decided (rev 2): one character, Kay. Mo and Lin appear at most as unnamed silhouettes in a panel, never as characters. Art style: several options go to the user before any scene is drawn.

### 4.2 Beats (each 20–40 s; pick by demo length)

| # | Kay's struggle | Panel | Feature that solves it | Tracks |
|---|---|---|---|---|
| 0 | 600 sessions, 37 rooms, two buildings, a wall of noise at the Salt Palace entrance | Kay squinting at a printed grid | Cold open, the problem | – |
| 1 | Picks two back-to-back talks that turn out to be in different buildings | Kay running across the skybridge | Agenda with building-change warning (A) | CfE, "easier" |
| 2 | Great idea mid-talk, Wi-Fi dead, phone keyboard too slow | Kay whispering into the phone | Voice capture, offline queue, "saved in 180 ms" (B, F) | Dash0 product surface, CfE |
| 3a | Booth conversation Kay can't hear | Kay holds up the phone: "I'm deaf, please type" | Communication card, show-to-person mode (D) | CfE |
| 3b | Q&A without a mic | Captions scrolling on the phone, Kay highlights a line → note | Live captions + highlight-to-note (E) | CfE, Dash0 |
| 4 | After the keynote everyone opens their agenda; Kay's spinner spins | Split panel: Kay waiting / Dash0 trace waterfall | Agent0 finds the cause, opens PR, Gitar reviews, Argo deploys, Radar says all clear (3.2, 3.3) | Dash0, Gitar, Radar |
| 5 | Overnight the schedule feed changed shape; morning deploy is red | Panel: red CI badge on Kay's laptop at breakfast | Gitar diagnoses + auto-applies (3.1) | Gitar |
| 6 | Evening: twelve notes, no idea what they add up to | Kay on the hotel bed, notes turning into threads | Threads across days; icebreakers for tomorrow (C, I) | "easier", CfE |
| 7 | Close | Dashboard + Status screen side by side | "Built today by N agents, every PR Gitar-reviewed, AI use disclosed" | all |

### 4.3 Fitting an unknown demo length

| Length | Beats | Notes |
|---|---|---|
| 2 min | 0, 4, 5, 3a, 7 | The two track stories plus one CfE moment |
| 3–4 min | 0, 1, 2, 3a, 4, 5, 7 | Default; Lean bundle covers it |
| 5–6 min | all | Core/Ambitious |
| Video-only | all, pre-recorded | Record beats 4 and 5 live in the afternoon as the backup for Wi-Fi failure on stage |

Beats are self-contained panels, so the deck is assembled by dropping panels. Slides: Marp (Markdown, PDF export, fast) or a Claude artifact deck; speaker notes carry the disclosure (rule 5) and the architecture explanation (rule 6).

---

## 5. Live-test plan for today (Sun Nov 8)

Throwaway repos only (allowed by the user's reading of rule 1). Nothing from these repos goes into the submission. Suggested names: `kc-livetest-gitar`, `kc-livetest-dash0`, `kc-livetest-stt` (the user confirms the names; to-do already in the running doc). Results go to `research/08-live-test-results.md` and the vault.

Start the two slow ones first; they are mostly waiting.

| # | Test | Setup | Measure | Decides |
|---|---|---|---|---|
| **T1** Gitar on external failures (start first, ~90 min of waiting) | Tiny Node repo, Action with `mock-upstream` service container + `chaos.json`; install Gitar app, Pro trial, label `gitar-managed`; open three PRs: V1 schema drift, V2 429, V3 expired TLS | Time to first comment; does it diagnose correctly; does auto-apply push; does the fix pass; does it ever edit `.github/workflows/*`; does it hit the 3-commit cap; does it classify V2/V3 as flaky/infra | Which variant is the demo (3.1); wording of the review rules; whether to show "Gitar says infra, not fixable" as a feature |
| **T2** Dash0 SDK direct + RUM | Tiny Fastify/Hono app with `sdk-node`, auto-instrumentations, pino bridge, OTLP/HTTP to the Dash0 endpoint; one static page with `@dash0/sdk-web` served from the same origin; open on iPhone Safari and (if available) Android Chrome | Traces, logs, metrics visible; front→back trace joined; correct npm package name; RUM beacon from iOS Safari and from a Home-Screen PWA; Agent0 "Live Insights" produces anything on a trivial app | T1 vs T2 path (2.3); RUM config; whether service-worker bypass is needed |
| **T3** Dash0 operator on a mirror cluster (start second) | `cnh-starter/scripts/local-cluster.sh kctest --pull`; apply a `ValidatingAdmissionPolicy` denying `hostPath`, `hostPort`, `hostNetwork`, `privileged` to emulate the host; `helm show values` for a DaemonSet/filelog toggle; install operator; then install a plain collector Deployment as the alternative | Which pods Pending and why; requests footprint from `kubectl top`/`describe`; whether webhooks work in vcluster-like setup; collector Deployment footprint | T3 feasibility (2.3); budget table |
| **T4** Transcription on phones (needs the user's iPhone; Android is a gap) | One static test page with four buttons: Web Speech API; OpenAI realtime transcription via a tiny WS proxy (needs an OpenAI key today; the hackathon's $50 credit arrives tomorrow); Deepgram Nova-3 streaming via proxy (free credits on sign-up, UNVERIFIED amount); transformers.js `whisper-tiny` (multilingual) with WebGPU/WASM | Works at all; latency to first word; continuous mode stability over 3 min; behaviour in Home-Screen PWA (Web Speech is known not to work there); mic permission UX; model download time for Whisper on venue-like bandwidth | E's primary and fallback paths; whether E is in Core at all |
| **T5** Feed contract snapshot (10 min) | Fetch the Sessionize JSON, write a JSON schema of the fields we use, record `rooms` naming for the building heuristic | Field list; size after trimming (1.9 MB raw) | A's data model; V1 fixture design |

Not testable today: egress from the vcluster to Dash0 (ask at kickoff), Radar MCP against the team cluster (join code needed), SLO beta.

Gaps the user should fill: an Android phone for T4; an OpenAI or Deepgram key for T4 cloud paths; the Dash0 and Gitar accounts (already on the to-do list).

---

## 6. Open questions this plan raised (answered in rev 2; kept for the record)

1. Which bundle? → **Lean + Core; no H, I, J.**
2. Stack S1 and DB1? → **Yes.**
3. One protagonist or a cast? → **Kay alone.**
4. LLM key? → **The user's Claude API key, Haiku 5.5 default, Sonnet 5.5 where needed; keep the LLM out of the load test.**
5. Backup video? → **Yes.**
6. Branch protection off? → **No: protection ON, PR-only merges with required checks and Gitar review.** Sections 7–8 below.
7. Android device? → **No; iPhone plus desktop Chrome.**

Still open after rev 2 and T1 (also in the running doc): strict or non-strict protection (P2, P2-lite or P3), and the bot path (O2 App, O2b PAT, O3 deploy branch, or O6 move to an org). T1 closed the rest: no merge queue and no Actions-app bypass on a personal repo; approvals 0; Gitar is not a status check. See `research/08-live-tests/T1-gitar.md`.

---

## 7. Merging about 7 agents under branch protection (options)

Protection is on `main` only. Agent branches are unprotected, so Gitar's auto-apply commits and the agent's own pushes to a PR branch are unaffected. The cost of protection is paid at merge time, and it depends on one setting more than any other: **"Require branches to be up to date before merging"** (strict status checks).

### 7.1 Protection profiles (revised after T1)

**What T1 settled on a personal (user-owned) repo:** there is **no merge queue** (ruleset `merge_queue` returns 422; it is organization-only), so the earlier P1 is gone unless the repo moves into an org (section 8, O6). Gitar's review is a PR review in state `COMMENTED`: **not a status check and not an approval**, so **required approvals must be 0 and CI is the gate**. Classic protection and rulesets both work with required checks `lint-unit` + `schedule-feed-contract` (names must exist first). Gitar does **not** re-review after a rebase force-push, so rebasing is free of Gitar budget. Admin pushes to `main` bypass protection ("Bypassed rule violations"), the Actions app cannot.

| Profile | Settings | Cost per merge with 5 PRs open | Fit |
|---|---|---|---|
| **P2 Strict, no queue** | Ruleset or classic on `main`: require PR, required checks, **"require branches up to date" on**, approvals 0, squash only, block force-push and deletion | The moment `main` moves every open PR shows `BEHIND` (observed in T1). Each needs "Update branch" (merge commit from `main`, no force-push) or a rebase, then a CI rerun (~5–8 min). With ~9 `main` commits (8 merges + C0) and 3–5 PRs open, expect 25–35 updates over the day. Enable **auto-merge** on each PR so the agent updates the branch and walks away; GitHub merges when green. Deploy-bot commits on `main` (section 8) double the churn unless O3 moves them off `main` | The "real team" rule set, exactly as GitHub ships it for small teams without a queue. Costs 2–3 agent-hours; serial tail ~8 min per merge |
| **P3 PR-only, strict off** | Same, with "up to date" **off** | Clean state observed in T1; update only on a real conflict; CI ran on the PR head as pushed | Cheapest PR-only flow. Risk: two individually green PRs can conflict semantically without a combined run; `main` CI after merge plus Argo deploy and the Radar timeline catch it within minutes |
| P2-lite (hybrid) | Strict **on**, but agents only update a branch when it is next in the merge priority (7.2 rule 7); others stay `BEHIND` until their turn | One update per PR instead of one per `main` commit: ~8 updates instead of ~30 | Needs the agents to follow the priority order, which is already in the working agreement |

**Approvals.** 0 required (T1: Gitar's "Approved" text in its dashboard comment did not unblock a PR that required 1 approval). The human gate is the merge button, or auto-merge armed by the user after reading Gitar's review. Gitar's auto-approve and merge-blocking Pro features were not visible in T1; if they appear as a status check later, add it as a required check.

**Required-check names must exist before they can be required.** A required check that no workflow reports leaves every PR stuck on "Expected". So C0's workflow defines all final job names on day one (`lint-unit`, `e2e-mobile`, `a11y`, `build-image`, `feed-contract`), some as stubs that G later fills in. Add them to the ruleset as soon as C0's first run reports them.

### 7.2 Working agreement for the agents (goes into `AGENTS.md`/`CLAUDE.md` of the repo)

1. One change = one GitHub issue = one branch `feature/KC-<issue>-<change>` (the user's global convention; commit `feat: [KC-<issue>] …`). Issues KC-1…KC-8 are created at kickoff (section 9).
2. Branch from `origin/main` at start; push early so Gitar starts reviewing; label `gitar-managed` on creation.
3. Never force-push a branch after Gitar has pushed to it. After Gitar or a rebase, `git pull --rebase` first.
4. Before asking to merge: `git fetch && git rebase origin/main`, run the unit tests locally, push. Under P1 the queue does the final rebase; under P2 repeat whenever "out of date" appears.
5. Conflict rules: registry files are append-only (keep both sides); `package-lock.json` conflicts are never hand-merged, take `origin/main`'s lockfile and rerun `npm install`; `deploy/kustomization.yaml` is bot-owned for the image tag, so agents add manifests as new files under `deploy/` and only append to the `resources:` list.
6. Dependencies: C0 pre-installs the known set (OTel SDK + auto-instrumentations, pino, fastify/hono, vite, preact/react, i18n lib, Playwright, axe-core, pg) so wave 1 rarely touches the lockfile.
7. Merge priority when several are green: C0 → D → G → A → B → F → E → C. Under P1 the queue order is whatever order they are added; add them in that priority.

### 7.3 Gitar under protection: what T1 showed

- **No re-review after a rebase force-push** (observed over 2.5 min). Gitar does re-review after its **own** pushes (dashboard updated ~1 min later). So rebasing costs no Gitar budget; the budget meter itself was not visible.
- Gitar's commits are ordinary co-authored commits on the PR branch, never force-pushed; protection on `main` does not affect them. Agents `git pull` before pushing again.
- Gitar posts its review about 1 min after PR open, before CI finishes, and a fix about 2.5 min after open. Plan the staged break (3.1) with that cadence: open the PR, talk for two minutes, show the fix.
- Gitar never edited `.github/workflows/*` and never hit the 3-commit cap (max 2 per PR).
- Gitar reads `.gitar/review/*` from the **default branch**; in T1 the default was briefly another branch and the footer said "No rules evaluated" (that refers to `.gitar/rules`, a different folder). Make `main` the default branch before the first PR and put the review files on `main` with C0.
- Under protection the drift PR stays red until Gitar's fix turns CI green, and only then can it merge. That is the track's promise made visible.

### 7.4 Time budget impact (no queue available)

P2 strict: ~8 min of agent time per open PR per `main` commit; 2–3 agent-hours over the day, about the cost of one wave-2 change; auto-merge removes the babysitting but not the CI minutes. P2-lite: ~1 hour. P3: near zero. The deploy bot's `main` commits count as `main` movement for invalidation, so under P2 the O3 deploy branch (section 8) halves the churn.

---

## 8. The deploy bot's `deploy:` commit under protection (options)

The `cnh-starter` workflow builds the image on push to `main`, pushes it to GHCR, then commits the new image SHA into `deploy/kustomization.yaml` on `main` with `[skip ci]` (how it authenticates is UNVERIFIED: read `.github/workflows/deploy.yaml` at kickoff; T1's equivalent used `GITHUB_TOKEN`).

**T1 settled:** a workflow pushing with `GITHUB_TOKEN` to protected `main` is **rejected** under both classic protection and a ruleset (`GH006`). The GitHub Actions app **cannot** be a ruleset bypass actor on a personal repo (422, "must be part of the ruleset source or owner organization"), so the former O1 is gone. The **admin role** as bypass actor works (tested). A custom GitHub App owned by the same account as a bypass actor was **not tested**.

| Option | How | For | Against / unknowns |
|---|---|---|---|
| **O2 GitHub App acting as admin** | Create a GitHub App "kc-deploy-bot" under the `rfun` account, install it on the repo with contents: write; in the workflow mint a token with `actions/create-github-app-token` (pin latest major; version UNVERIFIED) and push as the app. Two ways past protection: (i) add the App as a **bypass actor** in the ruleset (UNVERIFIED on a personal repo; the error text suggests an App owned by the repo owner qualifies, test it first thing or today in the throwaway), or (ii) if (i) fails, fall back to O2b | Commits show as `kc-deploy-bot[bot]`, scoped to one repo, revocable; real-team shape | 10–15 min setup, two repo secrets (app id, private key); (i) is unverified |
| O2b Admin PAT | Fine-grained PAT of the user (contents: write, this repo), repo secret; the push bypasses via the admin role, which T1 confirmed | Verified path, 3 min | Bot commits appear as the user; the gate has a human-shaped hole; the PAT lives in a repo secret for a public repo (fine, secrets are not exposed to fork PRs, but revoke on Nov 13) |
| **O3 Deploy branch** | Argo CD Application `targetRevision: deploy`; workflow on push to `main`: build + push image, check out `deploy`, fast-forward to `main`, set the tag, push with `GITHUB_TOKEN` (branch `deploy` unprotected). Variant: manifests stay on `main`, only an `image.yaml` kustomize patch lives on `deploy` | **No bypass of any kind**; `main` receives no bot commits, so P2 churn halves; `deploy` is a clean release log that Radar's timeline and `get_changes` map one-to-one to deploys; `GITHUB_TOKEN` pushes to an unprotected branch are what T1 showed working | Two branches to explain; `deploy` must never get hand edits; one-line change to the starter's Argo application (C0-time); the starter's `setup.sh`/workflow may assume `main` (read first) |
| **O6 Move the repo into a GitHub org** | Create a free org, transfer `rfun/wemakedevs_hackathon_2026` into it (or create it there). Unlocks the **merge queue** and the **Actions-app bypass**, so the former P1 and O1 both come back | The flow the user wanted in the first place, at full fidelity; no custom app, no PAT | 15–30 min; Gitar must be installed on the org (its Pro trial is per org: a new org may get its own 14-day trial, or may not be "eligible"; UNVERIFIED); GHCR namespace and image path change (starter `setup.sh` may hardcode the owner); the user already chose the personal repo, so this reverses a decision |
| O4 Bot opens a PR for the tag bump | `peter-evans/create-pull-request` + auto-merge; Gitar reviews the bump | Purest "everything through PRs"; needs no bypass | +6–10 min per deploy, Gitar noise, loop guard needed (ignore `deploy/**`). Too slow for the day |
| O5 No git write-back | Floating tag + rollout restart via Radar MCP | Nothing to bypass | Not GitOps; Radar loses the commit link. Not recommended |

**Coherent combinations to choose from:**

| Combination | What you get | Setup cost | Residual risk |
|---|---|---|---|
| **P3 + O3** | PR-only merges, CI-gated, no bypass anywhere, GitOps via `deploy` branch | Smallest: one Argo line + a 10-line workflow change | Semantic conflicts between green PRs caught post-merge |
| **P2 + O3 + auto-merge** | Strict up-to-date plus the above; bot never touches `main` | Same + agents update branches | 2–3 agent-hours of updates |
| P2 or P3 + O2 | Starter workflow unchanged; bot commits on `main` | 15 min, one UNVERIFIED step (App as bypass actor) | Fallback to O2b if (i) fails; under P2 the bot commits double the churn |
| O6 + merge queue + Actions bypass | The original plan at full fidelity | 15–30 min + Gitar reinstall/trial risk | Reverses the repo decision; must be done tonight, not at kickoff |

`[skip ci]`: with O2/O2b the bot commit on `main` still carries `[skip ci]`. With O3 the bot pushes only to `deploy`, which has no workflow triggers, so no loop guard is needed.

---

## 9. Step-one kickoff checklist for `rfun/wemakedevs_hackathon_2026` (options, ~10:30–11:15)

The repo is empty until kickoff and already has the Gitar app installed. Order matters: protection and the bot path must be settled before the first merge.

1. **Bring the starter in (5 min).** The template button cannot target an existing repo. Either `git clone skyhook-io/cnh-starter`, drop its `.git`, copy into the repo (clean history), or `git remote add starter …` and `git merge --allow-unrelated-histories` (keeps attribution; noisier log). Run `./scripts/setup.sh <team>` after the team cluster exists (what it edits is UNVERIFIED: read it first). This first commit lands on `main` **before** protection is switched on.
2. **Bring the planning in (5 min).** `docs/planning/`: research 01–07, `resources-vault.md`, `ideas.md`, a Markdown export of the running doc; `openspec/` with today's proposals; `AGENTS.md`/`CLAUDE.md` for the agents (section 7.2 rules, ownership folders, registry files, commit format); `AI-DISCLOSURE.md` started (rule 5). **Strip before committing:** personal notes, speaker bios, anything from `a throwaway test repo`, tokens, the user's email in examples (rule 4).
3. **Issues KC-1…KC-8 (3 min).** One per change in merge-priority order (C0, D, G, A, B, F, E, C), each with its OpenSpec change name; branch names derive from them.
4. **Protection (5 min).** Create the `main` ruleset per the chosen profile (7.1): require PR, approvals 0, required checks, squash only, block force-push/deletion, strict on or off. Make `main` the default branch first (Gitar reads rules from it). Enable auto-merge on the repo. Required checks are added after C0's first run reports their names.
5. **Deploy bot path (0–15 min).** O3: create the `deploy` branch and edit the Argo application's `targetRevision` (C0 can carry that edit). O2: create and install the App, add the two secrets, add it as bypass actor (fall back to O2b PAT if refused). O6 must have happened tonight.
6. **Cluster (10 min, parallel).** Join code → `join.cnh.radarhq.io` → status page → kubeconfig from Radar UI → `kubectl get ns`. Create Secrets in the team namespace: Dash0 auth token + dataset, Anthropic API key. Make the GHCR package public after the first push. Radar MCP `/mcp` → authenticate → pick the "Cloud Native Hackathon" org; Dash0 MCP sign-in.
7. **Gitar check (2 min).** Pro trial active, `gitar-managed` label exists, Gitar reads `AGENTS.md` and `.gitar/review/*` (they arrive with C0).
8. **First PR = C0** (one agent, 11:00). While it runs: Impeccable design directions for the user; screenshot Radar "Checks" as the before picture; ask Dash0 staff about the SLO beta.
9. **Prove the loop once before wave 1:** merge C0 → image build → bot commit lands (per section 8) → Argo sync via Radar MCP → `https://<team>.cnh.radarhq.io` serves the shell → RUM beacon and a server trace appear in Dash0 → required checks now have names → add them to the ruleset. Only then start the five wave-1 agents.

Things that must **not** be in the repo at any point: private or personal data, credentials, the live-test repo's history, the user's real notes from the conference.

---

## Sources
All facts come from `research/01`–`06`, `resources-vault.md`, the `cnh-starter` findings in `research/03`, and the running doc "KubeCompanion: What & Why" as of its rev 11 on 2026-11-08. No new web fetches were made for this file; items marked UNVERIFIED keep that status from the source files.
