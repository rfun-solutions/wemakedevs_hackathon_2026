# T2: Dash0 SDK direct + browser monitoring (local only), run 2026-11-08

Code: `live-tests/t2-app/` (Fastify, Node 24 locally; `run.sh` loads `.env` in the shell only). No tunnel, nothing public.

## Findings
- **Region: us-west-2 (AWS).** OTLP ingest `https://ingress.us-west-2.aws.dash0.com` (HTTP, `/v1/traces|logs|metrics`) accepts the token; the other four regions return 401. Query API `https://api.us-west-2.aws.dash0.com` returns the data (the us-east-1 API host answers 200 but returns empty results, so use the us-west-2 host).
- **Token permissions: not ingest-only.** `GET /api/auth-tokens` shows the token is the "Auto-generated auth token" with `actions: ["*"]`, datasets unrestricted. Treat it as admin: server-side only. **To-do: create an ingest-only, dataset-limited client token for the browser SDK.**
- **npm name: `@dash0/sdk-web`** (0.30.0, current). `@dash0hq/sdk-web` (0.6.1) is deprecated ("replaced by @dash0/sdk-web").
- **Traces arrive.** http, dns, undici spans. Server span for a request carrying `traceparent` joined the caller's trace (parentSpanId = the caller's span id). So front-end to back-end join works same-origin as long as the browser sends `traceparent` (browser side not exercised, see below). Fastify/pino-specific instrumentation did not show as separate scopes; http spans are enough.
- **Logs arrive** via the pino instrumentation to the OTel logs SDK, with trace/span ids attached (`request completed`, error log from /api/boom). Also still printed to stdout.
- **Metrics arrive** (`http_server_request_duration_seconds_*`, `http_client_*`, `nodejs_eventloop_*`, etc.).
- **Gotchas with current SDK versions (sdk-node 0.301 / sdk-logs 3.1):** `new BatchLogRecordProcessor({ exporter, scheduledDelayMillis })` (options object, old positional form throws "reading 'export'"); NodeSDK option is `metricReaders: [...]` (singular `metricReader` silently ignored, no metrics). Using `--experimental-loader=@opentelemetry/instrumentation/hook.mjs` for ESM; deprecated warning, use `register()` in a real build.
- **Browser flow, local design:** page served by same Fastify at `localhost:3000`; SDK `endpoint.url` points at same-origin `/dash0-proxy` (server adds the real token, browser sends a dummy). Bundle checked: no token string. Proxy forwards OTLP to Dash0 (200). This is only for local testing; in production the browser should talk to the ingress host with the ingest-only token.
- **Not verified:** the browser actually sending RUM events and `traceparent` (no browser automation allowed). To-do for the user: open http://localhost:3000, click the button, then check the website/web events in the Dash0 UI.
- **Service worker:** per plan, it should bypass the ingest host (and `/dash0-proxy`) and never cache API writes; the Dash0 docs page does not mention service workers (untested).
- **iPhone check: not done.** Needs the app on a public HTTPS URL; tomorrow that is the event cluster.
- Agent0 "Live Insights": not tested.

---

# T2 BROWSER PART (run 2026-11-08, afternoon)

Built the web bundle with **DASH0_INGEST_ONLY** injected via esbuild `--define` and the endpoint pointed straight at `https://ingress.us-west-2.aws.dash0.com` (no proxy). Server on `localhost:3000` with the full-access token only server-side. Driven with Claude in Chrome (own tab; another agent was using the shared tab group and navigated the first tab away, so use a dedicated tab).

- **Bundle check:** grep of `public/app.js` for the full-access DASH0_TOKEN: 0 matches. The ingest-only token appears once (expected, public by design). The ingest-only token is accepted by the OTLP ingress (curl test span arrived).
- **Direct browser to ingress works, CORS OK:** Chrome made `POST https://ingress.us-west-2.aws.dash0.com/v1/logs` and `/v1/traces`, all 200. SDK uses fetch (my fetch wrapper did not see it, so it uses an early captured reference; use `performance.getEntriesByType('resource')` to observe).
- **RUM events arrive:** Dash0 metrics `dash0_web_events_total{service_name="kc-t2-web"}` = 23, `dash0_web_page_views_total` = 4, `dash0_web_requests_total{url_path="/api/hello"}` = 7. Page views, web events and browser requests are populated after a few clicks plus reloads.
- **Trace join works:** the browser sends `traceparent` on same-origin `/api/hello` (server saw `00-<traceId>-<spanId>-01`), and the server span in Dash0 carries that browser trace id (flags 769 = remote parent). So browser to server correlation holds with no CORS or propagator config.
- **Not confirmed via API:** the browser spans themselves do not appear in `POST /api/spans` (kc-t2-web returned nothing; `/api/traces/{id}` returned 404), and `parentSpanId` on the server span came back empty. Website monitoring data is evidently stored in the web-events path (the `dash0_web_*` metrics), not the span store. I did not open the Dash0 UI trace view: the final check (is the browser span shown as parent in the trace view) is on the user's to-do list.
- Gotchas: `read_network_requests` only sees calls after tracking starts; the SDK flushes in batches (seen within ~10 s plus on navigation).
