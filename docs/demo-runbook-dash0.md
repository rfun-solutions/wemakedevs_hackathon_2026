# Demo runbook: Dash0 (Agent0 to Gitar to merge queue to Argo)

Audience: the person on stage and the orchestrator. Goal: show Agent0 finding something real, the fix landing through a Gitar-reviewed PR and the merge queue, and Argo deploying it, with the Status screen recovering.

## Secrets (C0 Secret list)
Set by the user; never committed. `DASH0_TOKEN` (server, query and apply), `ANTHROPIC_API_KEY`, `KC_PROBE_TOKEN` (Synthetic Kay posts P3 and P4 to `POST /api/status/kay-checks`; endpoint is 404 and the lights say "Not measured right now" when unset). `DASH0_TOKEN` is NOT stored in GitHub; `observability.yml` is lint-only.

## Route 1: organic (preferred)
1. Open Dash0 Agent0 and ask: "Which route in kubecompanion has the worst p95 or error rate in the last 2 hours, and why?"
2. If Agent0 finds a real defect (slow query, N+1, error spike), ask it for a fix and open the PR. Do not stage anything.
3. Continue at "Merge path" below.

## Route 2: backup chaos at 15:45
Use only when route 1 finds nothing. Say on stage that it is a rehearsed slowdown.

1. Set the flag (app-level only; the cluster is untouched):
   `kubectl -n team-kubecompanion2026 patch configmap kc-chaos --type merge -p '{"data":{"flags.json":"{\"agenda\":{\"latencyMs\":800,\"errorRate\":0,\"naive\":false}}"}}'`
   Variant for the N+1 path: set `"naive":true` and `latencyMs` 0. The reader re-reads within 10 s. Argo may revert the ConfigMap on sync; patch again if so.
2. Run the bounded load from a laptop (50 virtual users, 60 s, agenda and sessions only; the script refuses translate, llm and thread paths):
   `k6 run -e BASE_URL=https://kubecompanion2026.cnh.radarhq.io scripts/load/agenda.js`
   Ask the orchestrator before running it against the public URL.
3. Watch Status: server p95 goes over the 500 ms SLO and the verdict says "We are slow right now, not your Wi-Fi"; the chaos-active flag is on.
4. Ask Agent0: "Why is GET /api/agenda slow since 15:45?" For `naive` it should point to N+1 `pg.query` spans under `kc.agenda.get`; for latency it should point to `kc.chaos.apply` spans.
5. Continue at "Merge path". The fix for the chaos variant is the one-line reset in step 7 plus any real code fix Agent0 proposes; do not pretend the chaos was an organic bug.

## Merge path
1. Agent0 (or a human with its finding) opens a PR; label `gitar-managed`.
2. Gitar reviews and may push a commit. Run `git pull --rebase` before the next local commit.
3. Merge queue merges (orchestrator arms auto-merge; nobody runs `gh pr merge`).
4. Argo CD syncs the new image tag; confirm with the Radar MCP (sync status, `get_changes`, warning events).
5. Verify recovery: Status p95 back under 500 ms, Dash0 dashboard `KubeCompanion service health` agenda p95 falling.
6. For the two-AI-SRE angle and the release footer, follow `docs/demo-runbook-ai-sres.md`.

## Reset steps
7. Clear chaos: `kubectl -n team-kubecompanion2026 patch configmap kc-chaos --type merge -p '{"data":{"flags.json":"{}"}}'`; confirm Status shows chaos inactive within 10 s.
8. Confirm no k6 process is still running. Stop and remove any local `kc-pg-*` containers.
9. Re-run the Synthetic Kay loop only if the user starts it (it is browser automation).

## Observability as code
`observability/*.yaml` is linted on every PR (percli) by `observability.yml`. The orchestrator applies the dashboard, check rule `KubeCompanionCaptureSlow` and synthetic check `kubecompanion-healthz` from the laptop with the `dash0` CLI (flags to confirm with `dash0 --help`). Confirm all three appear in Dash0 afterwards.
