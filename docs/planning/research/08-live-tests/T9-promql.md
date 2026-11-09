# T9: PromQL via the us-west-2 API (2026-11-08)

- **Endpoint:** `GET https://api.us-west-2.aws.dash0.com/api/prometheus/api/v1/query?query=...` with `Authorization: Bearer $DASH0_TOKEN` (standard Prometheus HTTP API; also `/api/v1/label/<name>/values`). Traffic: ~140 requests to `/api/hello` and a few `/api/boom` via t2-app.
- **Response shape (standard Prometheus):** `{"status":"success","data":{"resultType":"vector","result":[{"metric":{<labels>},"value":[<unix ts>, "<value as string>"]}]}}`. Seconds, values are strings.
- **Query latency:** 0.28 s, 0.40 s, 0.44 s (3 runs, HTTP 200).
- **Exact query tried (the planned one, scoped to the service):**
  `histogram_quantile(0.95, sum by (le, http_route) (rate(http_server_request_duration_seconds_bucket{service_name="kc-t2-api"}[5m])))` -> result `[{"metric":{},"value":[..,"0.0967"]}]` i.e. p95 = ~97 ms, **but with an empty label set: there is no `http_route` label** on this metric. `GET /api/prometheus/api/v1/label/http_route/values` returns `[]`.
- **Labels on `http_server_request_duration_seconds_*` for kc-t2-api:** `http_request_method`, `http_response_status_code`, `error_type`, `network_protocol_version`, `url_scheme`, `service_name`, `service_version`, `job`, `instance`, `otel_scope_name` plus `dash0_*`/`host_*`/`process_*`. No `http_route`, no `url_path`. `sum by (http_response_status_code)` works: 200 p95 = 0.097 s, 500 p95 = 0.0048 s.
- **Consequence for D2/G4:** per-route p95 needs the app to emit `http.route`. The raw http instrumentation (no Fastify route instrumentation) does not. Options: add `@fastify/otel` / set route in a hook, or use span data (`getSpans`/`sql`) for per-route. A demo app must be checked for this label before relying on the query.
- Service name in Dash0 is `kc-t2-api` (not `kc-t2`).

## Addendum (2026-11-08): per-route p95 that works today

`http_route` is absent, but Dash0 derives span metrics with the label **`dash0_operation_name`** (the same value the trace UI shows, e.g. `GET /api/hello`). Verified live for `kc-t2-api` (`/label/dash0_operation_name/values` returned `GET`, `GET /`, `GET /api/boom`, `GET /api/hello`, `POST`, `Unknown operation`).

- Metric: `dash0_spans_duration_seconds_bucket` (also `_count`, `_sum`). Labels on it are `service_name`, `dash0_operation_name`, `le` plus resource labels; there is no `span_kind` label, so filter client spans out by the operation-name regex.
- **Working query (per route p95):**
  `histogram_quantile(0.95, sum by (le, dash0_operation_name) (rate(dash0_spans_duration_seconds_bucket{service_name="kc-t2-api", dash0_operation_name=~"(GET|POST|PUT|PATCH|DELETE) /.+"}[5m])))`
  Live result (1h window): `GET /api/hello` 0.0977 s, `GET /api/boom` 0.0015 s (`GET /` is excluded by the regex).
- Caveat: the bare operation names `GET` and `POST` appear when a span has no route/path. Fastify must set `http.route` (route template) so the span name becomes `GET /api/agenda/:id`, not a raw path with ids (cardinality). C0 now requires this.
- Fallback if this ever fails: app-emitted histogram `kc_app_http_server_duration` with a `route` label via OTLP (specified in C0).
