## Why

Kay (they/them, hard of hearing, English as a second language, first KubeCon) is on venue Wi-Fi and cannot tell whether a slow or failed save is their connection or the app. Telling Kay plainly ("saved in 180 ms", "your Wi-Fi is slow, not us") builds trust. The same signal serves the team. This scores the Dash0 track (observability is part of the product, with dashboard, check rule, synthetic check and optional SLO as code) and the Gitar track (dashboard JSON lands through reviewed PRs). It also supplies the Dash0 demo: Agent0 finds the cause, opens a PR, Gitar reviews it, the merge queue merges it, Argo deploys it.

F makes the product's access guarantee visible (problem statement in `openspec/config.yaml` `context`): every access feature is measured live. Decided by the user on 2026-11-08 evening, F owns the **promise lights**: a short "What we promise you" block on Status shows D's five Access promises (P1-P5) with a live green, amber or grey light each, fed by the same 30 s Dash0 PromQL poll, with the Radar all-clear footer as the line underneath. F also runs one **unstaged Radar investigation of a real event** and writes the runbook for "check the cluster with the Radar MCP after every merge".

Innovation set added on 2026-11-08:
- **D2 server half:** the server polls Dash0 PromQL every 30 s and publishes `/api/status/health`, so Kay reads, in their language, "the agenda is slow for everyone right now, not your Wi-Fi" and new caption sessions start on the engine that is faster right now.
- **R3 + R4:** a runbook puts Agent0 and Radar's AI investigation side by side on the 15:45 slowdown, and a Status footer line says "Last release HH:MM, Gitar-reviewed, Radar all-clear" with a link to the shared investigation.
- **X1 Synthetic Kay:** an accessibility smoke test that walks the app as Kay every 5 minutes from the laptop (RUM as `kc-web-kay`), a Dash0 synthetic check as code, and a 15-minute Actions cron fallback.
- **D3 (in scope, decided 2026-11-08):** a cached Agent0 sentence on the Status screen, translated. T7: answers take 32-42 s, so it is async and cached, never live.

Judging criteria scored (quoted from research/01 §5):
- Stop Flying Blind: "Observability that's part of the product experience, not bolted on at the end."
- Stop Flying Blind: "Using Agent0 or the MCP server to find and fix something real during the day, and showing it in your demo."
- Stop Flying Blind: "Bonus point if you can create a dashboard or an SLO that shows how healthy your app is."
- Stop Flying Blind: "Depth of instrumentation across your app, including traces, logs, metrics and real-user monitoring if you have a frontend." (Synthetic Kay RUM)
- Radar / AI SRE: "Use Radar's AI investigations to investigate a real issue or question about your running app. Show what you learned and what you did with the findings." (R3)
- Radar / AI SRE: "Use Radar's UI and MCP throughout building and operating your project. Show how Radar helped you ship, troubleshoot, or improve your app." (R4 all-clear)
- Never Merge Broken: "Gitar is part of how you built, with features landing through PRs it reviewed, not one PR at the end." (dashboard JSON and the footer's "Gitar-reviewed")
- Every track: "How well your project makes conferences easier."

## What Changes

- In-app Status screen: last "saved in N ms", feed freshness, and "Is it the Wi-Fi or us?" (client RTT vs server p95 against the SLO).
- Perses dashboard as code, applied in CI with the `dash0` CLI.
- Check rule on capture latency and a synthetic check on `https://<team>.cnh.radarhq.io`, both as code.
- Optional SLO (capture p95 < 500 ms) only if Dash0 enables the private beta.
- App-level chaos switch: ConfigMap `kc-chaos` with per-route latency/error and the named `agenda` key (latencyMs, errorRate, naive) that A's handler reads, all read at runtime by F's single reader `api/src/lib/chaos.ts`, which replaces A's stub. Backup demo: "My agenda" slow under a 50-user load at 15:45 (laptop load script, never hitting LLM endpoints).
- Demo runbook for the Agent0 to PR to Gitar to merge queue to Argo flow.
- Service health (D2 server): 30 s PromQL poller and `GET /api/status/health`; plain-language EN/ES health banner on Status; a caption-lag check rule and a "Kay's view" dashboard.
- Promise lights: `HealthSnapshot.promises` (P1 caption lag, P2 `POST /api/notes` p95, P3 and P4 Synthetic Kay checks, P5 translate success ratio) and `web/src/screens/status/PromiseLights.tsx` rendering D's `PROMISES` text with a light each; never green without data. Synthetic Kay reports its P3/P4 checks to `POST /api/status/kay-checks` (token-gated), which records `kc_status_kay_checks_total{promise,result}` so Dash0 holds the signal.
- Radar: one unstaged investigation of the first real cluster event (for example quota exceeded on first sync or a CNPG readiness flap), acted on through a PR and marked Shared, plus the after-every-merge Radar MCP check routine, both in `docs/demo-runbook-ai-sres.md`.
- Release footer (R4): `GET /api/status/release` from a runtime ConfigMap `kc-release` written by `scripts/release-note.mjs`; runbook `docs/demo-runbook-ai-sres.md` for the two AI SREs (R3).
- Synthetic Kay (X1): `web/e2e/kay/kay.spec.ts`, laptop loop `scripts/kay-loop.sh`, `.github/workflows/kay-probe.yml` cron every 15 min, and `observability/synthetic-kay.yaml`. Always called an "accessibility smoke test", never uptime.
- D3 cached Agent0 explanation (`GET /api/status/explain`), in scope; async and cached because T7 measured 32-42 s per answer.
- Telemetry stays SDK-direct (operator refused, T3). A 100m/256Mi collector Deployment is added only if needed.

## Impact

- Size: F is now two agents plus an optional third (F1 groups 1-3; F2 groups 4-5 with the promise lights; F3, optional, group 6 Synthetic Kay with the kay-checks route); see tasks.md. One Under-the-hood entry `web/src/under-the-hood/entries/f-observability-product.json`. Specs added: `service-health`, `synthetic-kay`.

- New (innovation set): `api/src/routes/status-health.ts`, `api/src/routes/status-explain.ts` (D3, F1), `api/src/services/health/`, `observability/{check-rule-captions,synthetic-kay,dashboard-kay.perses}.yaml`, `web/e2e/kay/kay.spec.ts`, `scripts/{kay-loop.sh,release-note.mjs}`, `.github/workflows/kay-probe.yml`, `docs/demo-runbook-ai-sres.md`. Edits `deploy/deployment.yaml` again for the optional `kc-release` volume.
- New: `api/src/routes/status.ts`, `api/src/lib/chaos.ts` (replaces C0's stub), `web/src/screens/status/`, `deploy/chaos-configmap.yaml`, `observability/`, `scripts/load/`, `docs/demo-runbook-dash0.md`, workflow `.github/workflows/observability.yml`, migration range 500-599 (none expected).
- Consumes C0 telemetry, A `GET /api/agenda`, B capture span/metric. Inserts only under its own markers in shared registries.

## Out of scope

Radar canary; cluster-level chaos; Dash0 operator install; browser-side full-access token; LLM-endpoint load; new design tokens (D owns them).
