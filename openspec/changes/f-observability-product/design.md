## Interfaces consumed
- C0 telemetry (`api/src/telemetry.ts`), span/metric naming `kc.<domain>.<op>` / `kc_<domain>_<name>` (F's domains: `status`, `chaos`); browser `@dash0/sdk-web` with ingest-only token.
- B: capture span `kc.capture.save` and histogram `kc_capture_saved_ms`. A: `GET /api/agenda`, the `agenda` chaos key it reads via `getChaos`, and table `feed_runs` (F reads `max(finished_at)` where `status = 'ok'`). B: `getLastSaveMs()` from `web/src/lib/capture/queue.ts` for "Saved in N ms". C0: `GET /api/ping` (204), the RTT probe. G: owns CI-only `chaos.json`, separate from `kc-chaos`.
- D tokens and `t('status.<key>')`; shared registries take lines only under F's markers (`f-observability-product` for F1, `f-observability-product-health` for F2, `f-observability-product-kay` for F3). Strings: F1 `status.json` and `status-agent0.json`, F2 `status-health.json` (the loader merges by key). C0's `api/src/lib/rateLimit.ts` provides the per-device limits (`POST /api/status/rtt`, `POST /api/status/kay-checks`).

## Interfaces provided
- `GET /api/status` returns `{ server_ms_p95, feed_synced_at, feed_age_s, slo_ms, chaos_active }`. F does not register `/api/ping`; it uses C0's.
- ConfigMap `kc-chaos`, data key `flags.json`, mounted at `/etc/kc-chaos/flags.json` (env `CHAOS_FILE`) and re-read at most every 5 s (mtime check). Format: `{ "<key>": { "latencyMs": 0, "errorRate": 0, "naive": false } }`. Keys starting with `/api/` are route keys, which F's generic Fastify `onRequest` hook applies (latency and error only). Any other key is a named flag read by its owning handler. The only named flag is `agenda`, which A's `GET /api/agenda` handler reads: `latencyMs` (ms), `errorRate` (0..1) and `naive` (true selects the N+1 query path). The generic hook ignores named keys, so effects are never applied twice. Chaos never applies to `/healthz`, `/readyz`, `/api/status` and every `/api/status/*` route, `/api/ping`, `/api/translate` or `/api/threads/*`. Default `{}` (no effect). The backup demo uses `{"agenda":{"latencyMs":800,"errorRate":0,"naive":false}}` or `naive: true`.
- Reader `api/src/lib/chaos.ts` is the only chaos reader. C0 ships a stub with these exports (A imports it); F replaces the file and adds `isChaosActive(): boolean` and `chaosPlugin` (the route-key hook, registered by one line under the `f-observability-product` marker in `api/src/routes/index.ts`):

  ```ts
  // api/src/lib/chaos.ts — the one chaos reader. C0 ships a stub with exactly these exports
  // (getChaos always returns DEFAULT_CHAOS); F replaces the file.
  export type ChaosFlags = { latencyMs: number; errorRate: number; naive: boolean };
  export const DEFAULT_CHAOS: ChaosFlags; // { latencyMs: 0, errorRate: 0, naive: false }
  export function getChaos(key: string): ChaosFlags; // missing file, key or bad JSON -> DEFAULT_CHAOS; never throws
  ```

## Decisions
- "Wi-Fi or us" rule: client measures median RTT of 3 `/api/ping` calls (`performance.now`). If RTT > 400 ms and server p95 <= SLO: "Your connection looks slow, not us". If server p95 > SLO: "We are slow right now, not your Wi-Fi". Else "All good". Offline: "You are offline; your notes are queued".
- Server p95 comes from an in-process rolling window (last 200 captures) fed by an F-owned `onResponse` hook on `POST /api/notes` (no change to B's code), not a Dash0 query, so the screen works without Dash0 credentials.
- Dash0 as code: `observability/dashboard.perses.yaml` (PersesDashboard), `observability/check-rule.yaml` (PrometheusRule, `histogram_quantile(0.95, kc_capture_saved_ms_bucket) > 500` for 5m), `observability/synthetic.yaml` (HTTP GET public URL, expects 200 and body `ok` at `/healthz`). CI applies with `dash0` CLI using Secret-backed `DASH0_TOKEN` stored as a GitHub secret; PRs run `percli lint` only; apply happens on push to main. Operator CRDs are not used.
- SLO: `observability/slo.json` applied via API only when a probe call shows the beta is enabled; otherwise the check rule stands in.
- Collector: skipped unless SDK-direct export drops data under the 50-user load; then add `deploy/otel-collector.yaml` (contrib 0.141.0, 100m/256Mi, limits 500m/512Mi, token from Secret).
- Load script: `scripts/load/agenda.js` (k6), 50 VUs for 60 s against `GET /api/agenda` and `/api/sessions` only, with base URL argument; a guard refuses any path containing `llm`, `translate` or `thread`.

## Innovation set (F2)

### Service health poller (D2 server half)
- `api/src/services/health/promql.ts`: `queryPromQL(expr, { timeoutMs = 5000 })` against the Dash0 query API on us-west-2 with `DASH0_TOKEN` from `kc-secrets` (server only). Same host, path and label names as G's `scripts/rules-from-prod.mjs` `CONFIG` (path verified in T9; route label is `dash0_operation_name`, not `http_route`; fallback `kc_app_http_server_duration{route}` per G design decision 8). Span `kc.status.promql_query`.
- `api/src/services/health/poller.ts`: every 30 s, per replica, runs three queries:
  - the two from G's shared query contract (G design decision 8) with window `5m`;
  - the sample count `sum by (engine) (increase(kc_captions_segment_ms_count[5m]))`.
  It holds the last `HealthSnapshot` in memory. It exports `onHealthTransition(cb)` (from F2's PR 4, initially a no-op registry) and calls subscribers on a healthy-to-breached change; F1's `agent0.ts` subscribes, so F1 never edits `poller.ts`. If the token is absent or the last success is older than 120 s, it returns `source: 'unavailable'`. Metric `kc_status_health_poll_total{result=ok|error}`.
- `GET /api/status/health?deviceClass=ios|android|desktop` (optional param; selects which engines count for `captions.fasterEngine`; `api/src/routes/status-health.ts`, device id optional, chaos-exempt, `Cache-Control: max-age=15`):
  ```ts
  type HealthSnapshot = {
    source: 'dash0' | 'unavailable';
    polledAt: string | null;                       // ISO 8601
    routes: { route: string; p95Ms: number; slow: boolean }[];   // slow = p95 > 300 ms; health routes excluded
    captions: {
      p95MsByEngine: { whisper?: number; webspeech?: number };
      fasterEngine: 'whisper' | 'webspeech' | null; // per platform (request `?deviceClass=ios|android|desktop`): null unless >= 2 engines are available on that platform and each has >= 20 samples in 5 m; always null on ios
      lagging: boolean;                             // p95 of fasterEngine (or the only engine with data) > 4000 ms
    };
    promises: Record<'P1'|'P2'|'P3'|'P4'|'P5', { state: 'ok' | 'degraded' | 'unknown'; value?: number }>;
  };
  ```
  E consumes `captions`; the Status screen consumes all of it; H reads `promises` and `routes`.

### Promise lights (decided 2026-11-08 evening)
D owns the promise words (`ACCESS-PROMISES.md`, `PROMISES` in `web/src/features/access/promises.ts`); F owns the lights. The poller computes one state per promise each 30 s; `unknown` whenever there is no data, so a light is never green without a measurement:
| Promise | Source (window) | ok when |
|---|---|---|
| P1 captions | caption query from G's contract (5m), 20-sample minimum | faster engine p95 <= 4000 ms |
| P2 notes | route query, `POST /api/notes` (5m) | p95 <= 500 ms |
| P3 large type and contrast | `sum by (result) (increase(kc_status_kay_checks_total{promise="P3"}[30m]))` | at least one `pass` and no `fail` |
| P4 your language | same, `promise="P4"` | at least one `pass` and no `fail` |
| P5 translation | `sum(rate(dash0_spans_total{service_name="kubecompanion", dash0_operation_name="POST /api/translate", otel_span_status_code="ERROR"}[15m])) / sum(rate(dash0_spans_total{...same, no status filter}[15m]))` (label names UNVERIFIED, as T9; fallback: the route p95 query only tells "has traffic") | error share <= 5% |
- `POST /api/status/kay-checks` (`api/src/routes/status-kay.ts`, F3): body `{ checks: { promise: 'P3'|'P4', result: 'pass'|'fail' }[] }`, header `X-Probe-Token` equal to env `KC_PROBE_TOKEN` (Secret `kc-secrets`, optional key; endpoint 404 when unset, so P3 and P4 stay `unknown`). Increments `kc_status_kay_checks_total{promise,result}`; device id optional; chaos-exempt; 10/min limit. Synthetic Kay calls it at the end of a run: P3 from the axe results at 200% type and high contrast, P4 from an assertion that no `en` fallback string appears in the `es-ES` walk (the spec loads `web/src/i18n/{en,es}/*.json` and fails if any visible text equals an EN value whose ES value differs).
- `PromiseLights.tsx` (mounted on Status above the `ReleaseFooter`, one-line edit): heading "What we promise you", five rows of D's `t(promise.titleKey)` with a light that is icon plus text, never colour alone ("Working", "Slower than promised", "Not measured right now"). Polite live region announces only a change of state. The `ReleaseFooter` (Radar all-clear) sits directly under it as the line that backs the promises. No PR lists, no review talk, no links to GitHub (gimmick risk, research/12).
- Team-facing: `observability/dashboard-kay.perses.yaml` gains a "Promises" row with the same five expressions.
- The Status `HealthBanner` uses `t('status.health.*')` templates in EN and ES, filled from the snapshot. No LLM is involved and the wording is plain (D rule IN-6). Examples: "The agenda is slow for everyone right now (about 2 s), not your Wi-Fi. Your notes still save." and "Captions are slow for everyone right now, not your phone." It is a polite live region and is hidden when `source` is `unavailable` or nothing is slow. This is separate from the "Wi-Fi or us" verdict, which stays on the in-process window.
- Team-facing: `observability/check-rule-captions.yaml` (caption lag p95 > 4000 ms for 5 m) and `observability/dashboard-kay.perses.yaml`, with three panels: caption lag p95 by engine, route p95 for the hot routes, and Synthetic Kay page loads and errors (`service_name="kc-web-kay"`). `observability.yml` applies every file in `observability/`, so there is no edit to F1's files.

### Release footer and two AI SREs (R3, R4)
- Runtime ConfigMap `kc-release`, data key `release.json`: `{ releasedAt, sha, prUrl, gitarReviewed, radarUrl }`. It is NOT in `deploy/kustomization.yaml`, so Argo CD neither creates nor reverts it. It is mounted `optional: true` at `/etc/kc-release` (edit to `deploy/deployment.yaml`: volume and mount only).
- `scripts/release-note.mjs <sha> <radar-shared-url>`:
  - finds the merged PR through `gh api repos/{repo}/commits/<sha>/pulls`;
  - sets `gitarReviewed` when a review by `gitar-bot[bot]` exists (T1 login);
  - prints the ConfigMap YAML, and with `--apply` pipes it to `kubectl apply`.
  The orchestrator runs it after a Radar all-clear.
- `GET /api/status/release` returns the JSON, or 204 when the file is absent. Re-read on mtime, at most every 5 s.
- `ReleaseFooter` renders "Last release 15:52, Gitar-reviewed, Radar all-clear". The time uses `Intl` with `America/Denver`. Links have descriptive text ("Pull request for this release", "Radar investigation"). A missing field drops its clause, and the footer is hidden on 204.
- `docs/demo-runbook-ai-sres.md` (R3; written by F1, task 5.5, so it exists at 15:45 even if F2 slips): at the 15:45 slowdown, ask Agent0 in Dash0 "Why is /api/agenda slow since 15:45?" and, at the same minute, start a Radar AI investigation on Deployment `app` with "Why is the app slow since 15:45?". Record both verdicts in a two-column table (telemetry view and cluster view, with where they agree and differ). Mark the Radar investigation Shared. The fix PR description links both. After the fix deploys, run a Radar investigation "Anything wrong after the deploy of <sha>?", and on all-clear run `release-note.mjs --apply`. At 17:30 show the shared links. Budget is 3 to 4 investigations all day.
- **Unstaged Radar investigation (decided 2026-11-08 evening).** The runbook's first section is not staged: the first real cluster event of the day (likely `exceeded quota` on the first Argo sync, a CNPG readiness flap or a CrashLoop after a merge, research/07 §3.3) is investigated in Radar as it happens, the finding is acted on through a normal Gitar-reviewed PR, and the investigation is marked Shared. The runbook records event, time, Radar's verdict, what we did and the PR link in a table, so the demo can say "Radar found this, we did that". If nothing real happens by 15:30, the R3 slowdown investigation stands alone and the runbook says so; it never relabels a staged event as organic.
- **After every merge** (the `AGENTS.md` line C0 writes): the runbook's routine is Radar MCP `manage_gitops` sync status, `get_changes` since the last deploy, warning events and pod restarts in the namespace; anything odd becomes a note in the PR and, if real, the organic investigation above.

### Synthetic Kay (X1)
- `web/e2e/kay/kay.spec.ts` runs under C0's `kay` project. It seeds `kc.probe=kay`, Spanish, large type and reduced motion through D's `PREFS_STORAGE_KEYS`, then walks five steps:
  1. shell;
  2. Cards, opening "I'm deaf, please type" and closing it;
  3. save one note through the UI as the demo device;
  4. Status;
  5. Captions, if the route exists: consent is declined, so no model download.
  It runs axe on each page. It has no LLM routes and no PII.
- Where it runs:
  - the laptop loop `scripts/kay-loop.sh` (`KC_BASE_URL`, every 300 s). The user starts it, because it is browser automation;
  - `.github/workflows/kay-probe.yml`, every 15 min plus `workflow_dispatch`, top-level `permissions: contents: read`, against the public URL. It is not a required check, so it has no `pull_request` trigger. Enable it after the first deploy (about 13:00).
- `observability/synthetic-kay.yaml`: a Dash0 synthetic HTTP check named `kay-accessibility-smoke` on `https://<team>.cnh.radarhq.io/`, which expects 200 and an `<html lang=` attribute in the body.
- Wording everywhere (files, panels, runbooks, strings) is "accessibility smoke test". The word "uptime" is not used for Kay. The axe gate on every PR is the guarantee; the probe is the signal between deploys.

### D3: Agent0 explains to Kay (in scope, decided by the user 2026-11-08; cached)
- T7 (2026-11-08) verified it: bearer token accepted, `runTask` takes params `message` and `dataset` ("default"), replies over SSE, and already returns the final answer (no `waitForTask` needed); answers took 32-42 s and were correct. So it runs asynchronously and the app only ever shows the cached result.
- Cached design: when the poller sees a healthy-to-breached transition, it fires `runTask` once (at most once per 10 min) with the fixed prompt "In one plain sentence for a non-technical attendee: is the KubeCompanion app healthy right now, and if not, what is slow?", asynchronously with a 60 s timeout (no `waitForTask`), and stores `{ text, at }`. Check Agent0 credit use in the Dash0 UI after rehearsal. It never runs on a user request.
- Ownership: group 7 belongs to F1 in its own files (`api/src/services/health/agent0.ts`, `api/src/routes/status-explain.ts`, `web/src/screens/status/Agent0Line.tsx`, `status-agent0.json`). `agent0.ts` subscribes to F2's `onHealthTransition`; the `Agent0Line` mount is one line under F1's marker on the Status screen. Unit tests mock the MCP; no live Agent0 call runs in CI or local tests.
- `GET /api/status/explain?lang=xx` (in `api/src/routes/status-explain.ts`) returns `{ text, lang, at, source: 'agent0' | 'template' }`. Non-EN text is translated once per language through C0's `complete()` (op `status.agent0_translate`, Haiku) and cached until the next Agent0 sentence. On any failure it falls back to the health template sentence.
- The Status line reads "Agent0, N s ago: ..." with an "AI-generated" label (AI disclosure). Span `kc.status.agent0_task`, which shows Agent0's own call in Dash0.

## Telemetry
Spans: `kc.status.read`, `kc.chaos.apply` (attributes route, latency_ms, injected_error). Metrics: `kc_status_rtt_ms` (client-reported via `POST /api/status/rtt`, rate-limited), `kc_chaos_injected_total`. SLO candidate: capture p95 < 500 ms. Innovation set adds spans `kc.status.promql_query`, `kc.status.kay_checks`, `kc.status.agent0_task` and metrics `kc_status_health_poll_total{result}`, `kc_status_kay_checks_total{promise,result}`; it consumes E's `kc_captions_segment_ms` and the span metrics of `POST /api/notes` and `POST /api/translate`.

## Risks
Dash0 CLI auth flags may differ; verify with `dash0 --help` first. Agent0 may find a different organic bug; the runbook covers both routes.
