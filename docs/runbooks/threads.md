# Evening threads: operations and demo notes

Owner: c-evening-threads. Credentialing-free; the end user is Kay, a conference attendee.

## Secret for the nightly job (user runs this once, never commit a token)

The CronJob `threads-nightly` and the app both read `THREADS_CRON_TOKEN` from the shared Secret `kc-secrets`.
The Secret is created out of band and is never committed. Add this key when creating `kc-secrets`; if it already exists,
add the key without replacing its other credentials. Until the key exists the cron path answers 401 and the app is unaffected.

```sh
kubectl -n team-kubecompanion2026 patch secret kc-secrets --type=merge \
  -p "{\"stringData\":{\"THREADS_CRON_TOKEN\":\"$(openssl rand -hex 32)\"}}"
```

After updating the Secret, restart `deployment/app` with Radar's `manage_workload` tool so its environment picks up the key.

## Run the nightly job by hand

The CronJob is suspended (`suspend: true`, 02:00 `America/Denver` when enabled) so the demo is deterministic.

Use Radar's `manage_cronjob` tool to run `threads-nightly` now, then inspect the Job with `get_workload_logs`.
To enable the recurring schedule, change `suspend` to `false` in `deploy/threads-cronjob.yaml` and push the change;
Argo CD will sync it. Do not patch the live CronJob.

## Settings

| Env | Default | Meaning |
| --- | --- | --- |
| `THREADS_MODEL` | `claude-haiku-5-5` | `claude-sonnet-5-5` is the stronger, 20x costlier option |
| `THREADS_DAILY_CAP_USD` | `0.05` | per device per Denver day; `0` forces the basic (heuristic) grouping |

`ANTHROPIC_API_KEY` comes from `kc-secrets` (optional). With no key, threads fall back to basic grouping and the
app says so ("Grouped without AI: AI is not set up.").

## Dash0 views for the demo

Spans (traces explorer, service `kubecompanion`):

- `kc.threads.llm`: one per model call. Attributes `gen_ai.request.model`, `gen_ai.usage.input_tokens`,
  `gen_ai.usage.output_tokens`, `kc.threads.cost_usd`. Group by `gen_ai.request.model` to show tokens and cost per call.
- `kc.threads.run`: attributes `kc.threads.mode` (`llm` or `heuristic`), `kc.threads.reason` (`no_key`, `cap`, `error`), `kc.threads.notes_in`.
- No note text is ever placed on a span.

Metrics (PromQL):

```promql
sum by (mode, reason) (increase(kc_threads_runs_total[1h]))
sum(increase(kc_threads_llm_cost_usd_total[1d]))
sum by (direction) (increase(kc_threads_llm_tokens_total[1h]))
histogram_quantile(0.95, sum by (le) (rate(kc_threads_run_duration_seconds_bucket[1h])))
```

SLO candidate: 95% of `POST /api/threads/run` under 8 s over 1 h.

## Demo script

1. Seed (rehearsal and demo only, flag never in git): `kubectl set env deployment/app KC_DEMO_SEED=1`, then
   `SEED_BASE_URL=<app url> npm run seed:threads -w api` after `npm run build -w api`. Unset the flag afterwards:
   `kubectl set env deployment/app KC_DEMO_SEED-`.
2. Open Threads as the demo device, tap "Build threads now": threads with next steps appear; tick one.
3. In Dash0, open the `kc.threads.llm` span for that run and show the tokens and cost.
4. Set `THREADS_DAILY_CAP_USD=0`, run again on new notes: the status line reads "Grouped without AI: today's AI limit was reached" and the heuristic still produces next steps.
