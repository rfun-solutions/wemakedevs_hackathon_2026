## Context

Greenfield repo `wemakedevs_hackathon_2026`, deployed to a team namespace with a 2 CPU / 4 GiB request budget, a public URL via Service `app:80`, Argo CD GitOps, and CNPG already installed. Merge order and interfaces come from the shared proposal brief. Live tests: T2 (SDK direct to Dash0 works), T3 (Dash0 operator collectors denied, so SDK direct), T6 and T6b (merge queue and App bypass push work in an organisation repo).

## Goals / Non-Goals

**Goals:** three agents (C0a, C0w, C0b) finish by about 12:35; no wave 1 agent touches `package-lock.json`; every shared seam is either a file of its own or a pre-written marker each change inserts under.

**Non-Goals:** features, tokens, feed-contract logic (see proposal).

## Decisions

### D1. Stack (DECIDED by the user 2026-11-08: Fastify + Preact + `pg`)
| Layer | Choice | Alternative considered | Why |
|---|---|---|---|
| API | Fastify 5, TypeScript | Hono | Mature OTel and pino support (T2 ran on Fastify); plugin per route file fits the registry |
| Front end | Vite + Preact + TypeScript, `preact-iso` router | React | Small bundle on phones; same JSX |
| DB | `pg` with plain numbered SQL in `api/migrations/` | Drizzle, Kysely | No codegen, no lockfile churn; migration ranges per change keep numbers from colliding |
| Tests | Vitest (unit), Playwright (iPhone 15 and Pixel 7 projects), `@axe-core/playwright` | Jest | Vite-native |
| Workspaces | npm workspaces `api/`, `web/`; root `package.json` scripts `lint`, `test`, `build` | pnpm | Starter Dockerfile already uses npm |

C0 pre-installs the known dependency set (Fastify, `pg`, pino, OTel SDK and auto-instrumentations, `@anthropic-ai/sdk`, Vite, Preact, `preact-iso`, `@dash0/sdk-web`, Vitest, Playwright, axe, `eslint-plugin-jsx-a11y`, `ajv` for G, `idb-keyval` and `fake-indexeddb` for B, `@huggingface/transformers` for E) so the lockfile is stable. The full list is parallel-plan §3: `api` runtime `fastify@5`, `@fastify/static`, `@fastify/otel`, `pg`, `pino`, the `@opentelemetry/*` set (api, api-logs, sdk-node, sdk-metrics, sdk-logs, resources, semantic-conventions, the three OTLP/HTTP exporters, auto-instrumentations-node, instrumentation-pino), `@anthropic-ai/sdk`, `ajv` (+ `ajv-formats` if needed); `api` dev `@types/pg`, `@types/node`; `web` runtime `preact`, `preact-iso`, `@dash0/sdk-web`, `idb-keyval`, `@huggingface/transformers` (lazy worker chunk only); `web` dev `@preact/preset-vite`, `fake-indexeddb`, `happy-dom`, `@testing-library/preact`; root dev `typescript`, `vite`, `vitest`, `@playwright/test`, `@axe-core/playwright`, `eslint`, `typescript-eslint`, `eslint-plugin-jsx-a11y`, `prettier`. C0a verifies each version at install. Deliberately not added: i18next, luxon, `@fastify/rate-limit` (C0's helper replaces it) and a UUID library. Non-npm tools (`k6`, `percli`, `dash0`, `kubectl`/`kustomize`, `gh`, Playwright browsers) never go into `package.json`. The Dockerfile installs the runtime with `npm ci --omit=dev -w api`.

**Dependency rule.** C0a is the only dependency owner, and all of it lands in PR "C0-base". No other agent changes `dependencies`, `devDependencies` or `package-lock.json`. A new dependency is a request to the orchestrator, who lands a 2-minute `build: [KC-1] add <pkg>` PR from `main`; requesters then run `git merge origin/main && npm ci`. Taking `main`'s lockfile and re-running `npm install` is the accident procedure only.

### D2. Single service, one image
`api` serves `/api/*` and `web/dist` as static files with SPA fallback. Dockerfile becomes multi-stage: build `web`, build `api`, copy into a `node:22-alpine` runtime, user 1000, port 8080. Service `app` stays 80 to 8080.

### D3. Interfaces provided (names from the brief)
- **Device id:** `web/src/lib/device.ts` `getDeviceId()` creates a UUID in `localStorage` (in-memory fallback if storage throws) and `web/src/lib/api.ts` adds `X-Device-Id` to every call. Server plugin `api/src/plugins/device.ts` validates the header (UUID v4 format), decorates `request.deviceId`, and rejects `/api/*` calls lacking it with 400 (health routes exempt). A route may opt out with `config: { deviceId: 'optional' }` (used by C's cron-token run). `GET /api/ping` (returns 204) is C0's and is the single RTT probe; F consumes it and does not re-register it. The id is stored only as an opaque string; no accounts, no personal data.
- **Telemetry:** `api/src/telemetry.ts` is loaded first (`node --import`). NodeSDK, OTLP/HTTP direct to `https://ingress.us-west-2.aws.dash0.com`, `metricReaders: [...]` (plural; singular is silently ignored, T2), `BatchLogRecordProcessor({ exporter, ... })` options object, pino bridge. Token from Secret `DASH0_TOKEN` (env). Span names `kc.<domain>.<op>`, metrics `kc_<domain>_<name>`. Domains: `app` (C0), `access` (D), `pipeline` (G), `agenda` / `schedule` (A), `capture` (B), `status` / `chaos` (F), `captions` / `translate` (E), `threads` (C), `hood` (H). Resource attributes: `service.name=kubecompanion`, `service.version=APP_VERSION`. If the token is absent the SDK is disabled and the service still starts.
- **Browser telemetry:** `web/src/telemetry.ts` initialises `@dash0/sdk-web` with the ingest-only token injected at build as `VITE_DASH0_INGEST_TOKEN` and the endpoint pointing at the ingress host directly. `propagateTraceHeadersCorsURLs` includes the same origin so `traceparent` joins front-end to back-end (T2 server side verified; browser side verified during C0 acceptance). The full-access token never enters the web build; a CI grep guard fails the build if the server token's env name appears in `web/dist`.
- **LLM client:** `api/src/services/llm/client.ts` exports `complete()` with exactly the signature below; E (`/api/translate`) and C (threads) call it the same way. Default model `claude-haiku-5-5`; per-call override (for example `claude-sonnet-5-5`). Each call is wrapped in a span `kc.app.llm_complete` carrying GenAI semantic-convention attributes (`gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, latency, plus `kc.llm.cost_usd_estimate` from a small price table in `pricing.ts`). Token-bucket limiter keyed by `${deviceId}:${op}` (default 20 calls per 10 min, env-tunable, per-call `rateLimit` override); exceeding it throws `RateLimitedError`, mapped to HTTP 429. A missing key, a 20 s timeout or an API error throws `LlmUnavailableError`. Key from Secret `ANTHROPIC_API_KEY`. Prompt and completion text are not placed on spans. Metrics: `kc_app_llm_calls_total`, `kc_app_llm_tokens_total`, `kc_app_llm_rate_limited_total`. Tests mock the SDK.

  ```ts
  // api/src/services/llm/client.ts — the only LLM entry point; E and C call it identically
  export interface CompleteRequest {
    op: string;                 // e.g. 'translate.text' (E), 'threads.group' (C); span attr + limiter bucket
    deviceId: string;           // request.deviceId
    system?: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
    maxTokens: number;
    model?: string;             // default process.env.LLM_MODEL ?? 'claude-haiku-5-5'
    rateLimit?: { max: number; windowMs: number }; // default 20 per 600_000 ms, bucket `${deviceId}:${op}`
  }
  export interface CompleteResult {
    text: string;
    model: string;
    usage: { inputTokens: number; outputTokens: number; costUsd: number; latencyMs: number };
    traceId: string;
  }
  export function complete(req: CompleteRequest): Promise<CompleteResult>;
  export class RateLimitedError extends Error { retryAfterS: number }            // route maps to 429
  export class LlmUnavailableError extends Error { reason: 'no_key' | 'upstream' } // no key, timeout (20 s) or API error

  // api/src/services/llm/pricing.ts — USD per million tokens, verified on claude.com/pricing 2026-11-08
  export const PRICES = {
    'claude-haiku-5-5':  { inPerMTok: 0.10, outPerMTok: 0.50 },
    'claude-sonnet-5-5': { inPerMTok: 2,    outPerMTok: 10 },
  };
  export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number;
  ```
- **Registries (insert under your marker):** `web/src/routes.ts`, `web/src/nav.ts`, `api/src/routes/index.ts`, and `web/src/i18n/<lang>/<file>.json` (C0 creates `en/app.json` and `es/app.json` with the `app.*` shell keys; the loader `web/src/i18n/index.ts` is a minimal glob import exporting `t(key, params?)`, which D replaces keeping that signature). The loader and the key validator merge every `<lang>/*.json` by key, never by file name, so a split agent can own its own file (`access-cards.json`, `translate.json`, `status-health.json`, `status-agent0.json`); a key defined in two files fails a unit test. Key prefixes use the telemetry domain: `app`, `access`, `pipeline`, `schedule`, `capture`, `status`, `captions`, `translate`, `threads`, `hood`. Each registry file begins with a comment stating the marker rule.
- **Registry markers.** A scratch merge test showed that two branches each appending a line at the end of the same list conflict in git, while branches that insert under different pre-written anchor comments merge cleanly. So C0 pre-writes one marker comment per change id, in merge order (`// >> d-access-kit` in TS, `# >> d-access-kit` in YAML, `<!-- >> h-under-the-hood -->` in Markdown), and each change inserts lines directly under its own marker only. Split agents get their own marker. Markers per file:

  | File | Markers (in this order) | Written by |
  |---|---|---|
  | `web/src/routes.ts`, `web/src/nav.ts` | `d-access-kit`, `d-access-kit-cards`, `a-schedule-agenda`, `b-capture`, `f-observability-product`, `e-captions-translation`, `c-evening-threads`, `h-under-the-hood` | C0w |
  | `api/src/routes/index.ts` | `a-schedule-agenda`, `b-capture`, `f-observability-product`, `f-observability-product-health`, `f-observability-product-kay`, `e-captions-translation`, `e-captions-translation-translate`, `c-evening-threads` | C0a |
  | `deploy/kustomization.yaml` `resources:` | `c0-scaffold`, `a-schedule-agenda`, `f-observability-product`, `c-evening-threads` | C0b |
  | `deploy/deployment.yaml` `env:` | `f-observability-product`, `c-evening-threads` | C0b |
  | `deploy/deployment.yaml` `volumes:` and `volumeMounts:` | `f-observability-product`, `f-observability-product-health` | C0b |
  | README links list | one per change id in merge order (H uses `h-under-the-hood`) | C0b |

  Markers inside a change's own files (for example the Status screen mounts, F1's for F2, or the Captions screen mount, E1's for E2) are written by that file's owner.
- **Health:** `GET /healthz` is liveness (always 200 once listening). `GET /readyz` is readiness: 200 only when `SELECT 1` succeeds within 1 s and migrations have run; else 503. Neither requires `X-Device-Id`.
- **Contract stubs.** C0 ships three stubs so no two changes create the same file (an add/add conflict in wave 1):
  - `api/src/lib/chaos.ts` (C0a): exactly F's exports (`ChaosFlags`, `DEFAULT_CHAOS`, `getChaos(key)` always returning `DEFAULT_CHAOS`, never throwing; signature in f-observability-product design). A imports it; F replaces the file.
  - `web/src/lib/speech/index.ts` (C0w): `startDictation(onText)` and `startCaptions(onSegment)`, both resolving `{ supported: false, stop() {} }` with B's and E's shared `SpeechSession` type. B's button uses it; E replaces the file.
  - `web/src/lib/capture/queue.ts` (C0w): `enqueueNote(input): Promise<{ client_id: string }>` rejects with `Error('not implemented')` and `getLastSaveMs(): number | null` returns `null` (types from b-capture design). F and E compile against it; B replaces it.
- **Rate-limit helper.** `api/src/lib/rateLimit.ts` (C0a) exports a generic in-memory token bucket so no change adds `@fastify/rate-limit`: `createRateLimiter({ max, windowMs }): { take(key: string): { ok: true } | { ok: false; retryAfterS: number } }`. The LLM client's limiter uses it, and so do F (`POST /api/status/rtt`, `POST /api/status/kay-checks`) and E (`POST /api/captions/sli`), keyed by `${deviceId}:${op}` or similar. Per replica, not global.
- **Service-worker shell:** `web/public/sw.js` (hand-written, no Workbox): precache the app shell on install, cache-first for hashed assets, network-first for navigations with offline fallback page, and `/api/*` never cached. The fetch handler returns early (no `respondWith`) for any request whose host is not same-origin, and explicitly for `*.dash0.com`, so telemetry is never queued, cached or delayed. A pure function `shouldHandle(url)` is unit tested. Registration lives in `web/src/sw-register.ts`. Web manifest and icons included.

### D3b. Under-the-hood registry (append-only, one file per change)
Every feature shows the sponsor tech behind it. C0 creates the registry; each change adds exactly one file, so parallel branches never touch the same line. H builds the in-app screen and the public page from it.
```ts
// web/src/under-the-hood/types.ts
export type Sponsor = 'gitar' | 'dash0' | 'radar';
export interface TechRef {
  sponsor: Sponsor;
  kind: 'rule' | 'check' | 'query' | 'trace' | 'dashboard' | 'investigation' | 'workflow';
  label: string;          // technical name, shown as code, not translated: "inclusion.md IN-2", "kc_capture_saved_ms p95"
  ref?: string;           // repo path (H links it to github.com/rfun-solutions/wemakedevs_hackathon_2026/blob/main/<ref>) or a public URL
  live?: `promise:${'P1'|'P2'|'P3'|'P4'|'P5'}` | 'release' | `route:${string}`; // H fills from F's /api/status/health or /api/status/release
}
export interface UnderTheHoodEntry {
  id: string;             // the change id, equal to the file name: 'b-capture'
  order: number;          // merge order 1..9 (C0 1, D 2, G 3, A 4, B 5, F 6, E 7, C 8, H 9)
  titleKey: string;       // i18n key in the change's own domain file, e.g. 'capture.hood.title'
  whatKey: string;        // one plain sentence: what it does for Kay
  promises: string[];     // Access promise ids this feature serves, may be empty
  tech: TechRef[];        // 1..6 items
}
```
- `web/src/under-the-hood/registry.ts` exports `ENTRIES: UnderTheHoodEntry[]` from `import.meta.glob('./entries/*.json', { eager: true })`, sorted by `order`. Its header comment states the rule: add one file `entries/<change-id>.json`, never edit another change's file.
- `validate.ts` checks the schema; a Vitest test fails on an invalid entry, a duplicate id, an id that differs from the file name, or a `*Key` missing from `en/` or `es/`.
- The same JSON files are the data source for H's static page (`scripts/build-how-it-works.mjs` resolves `*Key` from `web/src/i18n/en/*.json`).

### D3a. Synthetic Kay hooks (X1)
- `playwright.config.ts` gains a project `kay`: device iPhone 15, `locale: 'es-ES'`, `reducedMotion: 'reduce'`, `testDir: 'web/e2e/kay'`, `baseURL: process.env.KC_BASE_URL ?? <local webServer URL>`. In CI it runs inside the `e2e-mobile` job against the local server; F's probe runs it against the public URL. The local `webServer` and `baseURL` use `process.env.PORT` so parallel agents never share a port. H uses its own `playwright.pages.config.ts` for the static page.
- **Vitest.** One config with projects `api` (environment `node`) and `web` (environment `happy-dom`, with `@testing-library/preact`). C0w owns `playwright.config.ts` and the Vitest config; no other change edits them, and `vite.config.ts` changes (for example E's worker) need orchestrator approval. With no spec yet (before F merges) the project passes with zero tests (`--pass-with-no-tests`).
- `web/src/telemetry.ts` reads `localStorage['kc.probe']` inside try/catch; only the value `kay` is honoured and sets the browser SDK service name to `kc-web-kay`. Any other value, or storage that throws, keeps the default name. The token and endpoint are unchanged.

### D4. Data
Migration runner `api/src/db/migrate.ts` applies `api/migrations/NNN_*.sql` in numeric order inside a transaction per file, recording `schema_migrations(version, applied_at)`. It applies every version not yet recorded, not only versions above the highest applied one, because ranges merge out of order (A's 100 may arrive after B's 200 is applied); a unit test covers that case. Runs at startup before `/readyz` goes green; advisory lock guards two replicas. C0 owns 000 to 099 and ships `000_init.sql` (schema_migrations bootstrap plus `devices(device_id, first_seen_at)` upserted by the device plugin). Ranges: A 100, B 200, C 300, E 400, F 500, D none.

### D5. Database manifest and budget
`deploy/postgres.yaml`: CNPG `Cluster` `db`, 1 instance, 2 Gi storage, requests 250m / 512 Mi, limits 500m / 768 Mi (based on `examples/postgres/cluster.yaml`). App Deployment is edited to 2 replicas at 100m / 192 Mi requests, limits 500m / 384 Mi; env `DATABASE_URI` from Secret `db-app` key `uri`, `ANTHROPIC_API_KEY`, `DASH0_TOKEN` from Secret `kc-secrets` (created by hand, never in git). Request total about 0.45 CPU / 0.9 GiB, leaving room for F, G and the optional collector. Listed under C0's own marker in `resources:` of `deploy/kustomization.yaml`. C0b pre-creates the `images:` block with one `newTag:` line, which only the deploy bot edits (G design decision 6).

### D6. CI
One workflow file per check, `.github/workflows/<check>.yml` (`lint-unit.yml`, `e2e-mobile.yml`, `a11y.yml`, `build-image.yml`, `feed-contract.yml`), with workflow `name:` equal to the check name, each with top-level `permissions: contents: read` and triggers `pull_request` plus `merge_group`, using current action majors. Every workflow with a `pull_request` trigger sets `concurrency: { group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true }`, so a new push cancels its own stale run (CI capacity is the build-day ceiling). G's `ci-traces` listens only to `merge_group` and push-to-`main` runs unless the orchestrator accepts doubling the job count. Job names equal the required check names so the ruleset can bind them.
- `lint-unit`: real (eslint with `eslint-plugin-jsx-a11y` recommended rules on `.tsx`, which works with Preact JSX; tsc; Vitest).
- `e2e-mobile`: real minimal (one smoke spec on iPhone 15 and Pixel 7 projects: shell loads, `/healthz`).
- `a11y`: real minimal (axe on the shell page).
- `build-image`: builds the Docker image without pushing (push stays on the deploy workflow).
- `feed-contract`: stub that exits 0 with a clear "implemented by G" message.
`deploy.yaml` (workflow name `deploy`, from the starter) is changed to: mint a token with `actions/create-github-app-token@v3.3.0` (secret `DEPLOY_BOT_PRIVATE_KEY`, variable `DEPLOY_BOT_APP_ID`), check out and push `deploy:` commits as the App, skip when the head commit message starts with `deploy:`, and use `concurrency:` with `git pull --rebase` before push (race seen in T6b). Top-level permissions are narrowed to `contents: read` plus job-level `packages: write`. C0 ships it so the kickoff loop (task 6.5) works; G takes ownership after C0 merges and hardens it. There is no separate `release.yml`.

### D7. Gitar rules and agent docs
`.gitar/review/external-calls.md` (outbound calls need timeout, span and error handling; no secrets in browser code), `time-zones.md` (venue time zone America/Denver explicit, never `new Date()` local math), `accessibility.md` (opens with rule "A11Y-1 (Promise P3) Every control works at 200% text and in high contrast"; WCAG 2.2 AA, 24 px targets, no `div` buttons, live regions), `api-contract.md` (Gitar idea 2, rule AC-1: "A PR that changes the path, method, request body or response shape of a route in `api/src/routes/*.ts` updates every web caller of that route (search `web/src` for the path) and its TypeScript types in the same PR, and updates the route's tests. A field is never removed from a response in the same PR that stops sending it to the web."). G1 adds two files that C0 creates and D fills: `inclusion.md` (baseline rule: "(Promise P4) Every user-visible string goes through `t()` and has an EN and an ES key") and `demo-data.md` (baseline rule: "Fixtures, seeds and telemetry attributes carry no speaker names, emails, handles or attendee data"). Each starts with a one-line scope header and the note "Content owned by change D". C0 does not create `hot-paths.md` (G4, generated) or `budget.md` (G3 budget break, the prepared repo-evidence PR; the on-stage Gitar fix is G5); G creates both. `AGENTS.md` starts in the initial commit (gate G-INIT) with the "Rules of engagement" (c0-scaffold tasks.md, under task 5.4); C0b extends the file below them and never rewrites them. The extension carries the 07 section 7.2 agreement: branches `feature/KC-<n>-<change>[-<part>]-pr<k>`, commits `feat: [KC-<n>] ...`, label `gitar-managed`, never force-push after Gitar pushes, `git pull --rebase` first, insert under your own marker in shared registries, no dependency or lockfile changes outside the orchestrator (accident: `git checkout origin/main -- package-lock.json && npm ci`), the `images:` block of `deploy/kustomization.yaml` is bot-owned (only the `newTag:` line changes) while `resources:` entries go under each change's marker, commit email is a GitHub noreply address (CI traces export author emails), telemetry names follow `kc.<domain>.<op>` / `kc_<domain>_<name>`, every change adds exactly one Under-the-hood entry file, "Use the Radar MCP to check the cluster after every merge (Argo sync status, `get_changes`, warning events) and note anything odd in the PR", merge order C0, D, G, A, B, F, E, C, H. The starter's own `AGENTS.md` Radar guidance is kept below the working agreement.

## Telemetry
- Per-route p95 (T9 addendum, 2026-11-08): Dash0 PromQL has no `http_route` label; it exposes `dash0_operation_name` ("GET /api/agenda/:id") on `dash0_spans_duration_seconds_*`. So Fastify must set `http.route` to the route template. Fallback if that label ever misbehaves: app histogram `kc_app_http_server_duration{route}` over OTLP. F and G query the span metric first (verified query in `research/08-live-tests/T9-promql.md`).
- Spans: `kc.app.migrate`, `kc.app.readyz`, `kc.app.llm_complete`; browser web SDK auto page and fetch spans.
- Metrics: `kc_app_migrations_applied`, `kc_app_llm_*` (above).
- SLO candidate: `/readyz` success ratio (F may adopt).

## Risks / Trade-offs
- **Merge queue and App bypass** are verified on this repo, `rfun-solutions/wemakedevs_hackathon_2026` (organisation, public; T6, T6b). There is no personal-repo fallback. All workflows keep `merge_group` triggers.
- **Browser ingest token is public by design.** Mitigation: ingest-only, dataset-limited, revoked Nov 13.
- **Model ids and prices** were verified on claude.com/pricing on 2026-11-08: `claude-haiku-5-5` $0.10 / $0.50 and `claude-sonnet-5-5` $2 / $10 per million tokens in/out. The model id is an env default (`LLM_MODEL`), not hard-coded in call sites.

## Decisions recorded (user, 2026-11-08 evening)
1. Fastify + Preact + `pg` (D1): approved.
2. C0 runs as two agents, C0a and C0b (tasks.md "Split"): approved. Superseded by parallel-plan R9 (2026-11-08): group 1 merges alone as "C0-base", and a third agent C0w takes group 3.
