## ADDED Requirements

### Requirement: Mobile-first installable shell
The system SHALL serve a PWA shell from the same origin as the API that loads on a phone viewport, installs to the home screen, and renders an offline fallback when the network is unavailable.

#### Scenario: Shell loads on phone viewports
- **WHEN** the app is opened at an iPhone 15 or Pixel 7 viewport
- **THEN** the shell renders with no horizontal scroll and passes the axe check

#### Scenario: Offline navigation
- **WHEN** the device is offline and the user reopens the app after a first visit
- **THEN** the cached shell or offline fallback page is shown

### Requirement: Service worker never touches telemetry
The service worker SHALL NOT intercept, cache or delay requests to any host other than the app origin, and SHALL NOT cache `/api/*`.

#### Scenario: Dash0 ingest bypass
- **WHEN** the browser SDK sends a request to the Dash0 ingest host
- **THEN** the service worker does not call `respondWith` and the request goes straight to the network

#### Scenario: API responses not cached
- **WHEN** the page requests `/api/anything`
- **THEN** the response is not stored by the service worker

### Requirement: Anonymous device identity
The client SHALL generate a UUID once, persist it locally, and send it as `X-Device-Id` on every API call. The server SHALL reject `/api/*` requests with a missing or malformed id, except health routes.

#### Scenario: First visit
- **WHEN** a device calls the API for the first time
- **THEN** the client has created a UUID and the request carries `X-Device-Id`

#### Scenario: Missing header
- **WHEN** a request to `/api/ping` has no `X-Device-Id`
- **THEN** the server responds 400

#### Scenario: Route opts out
- **WHEN** a route declares `config: { deviceId: 'optional' }` and the request has no `X-Device-Id`
- **THEN** the request reaches the handler

#### Scenario: Storage blocked
- **WHEN** local storage throws
- **THEN** the client uses an in-memory id for the session and the app still works

### Requirement: Health endpoints
The system SHALL expose `/healthz` for liveness and `/readyz` for readiness, without requiring a device id.

#### Scenario: Ready
- **WHEN** the database answers and migrations are applied
- **THEN** `/readyz` returns 200

#### Scenario: Database down
- **WHEN** the database does not answer within 1 second
- **THEN** `/readyz` returns 503 while `/healthz` still returns 200

### Requirement: Server and browser telemetry
The system SHALL export traces, metrics and logs from the server directly to Dash0 over OTLP/HTTP, and browser telemetry using an ingest-only token. The full-access token SHALL NOT appear in any browser artifact.

#### Scenario: Trace joins across tiers
- **WHEN** the browser calls `/api/ping`
- **THEN** the server span is a child of the browser span via `traceparent`

#### Scenario: Token leak guard
- **WHEN** the web build output contains the server token variable name or value
- **THEN** the CI build fails

#### Scenario: Missing token
- **WHEN** no Dash0 token is configured
- **THEN** the service starts with telemetry disabled and logs a warning

### Requirement: LLM client
The system SHALL provide one server-side LLM client with Haiku 5.5 as default model, a per-call model override, a GenAI semantic-convention span per call, and a per-device rate limit.

#### Scenario: Traced call
- **WHEN** a feature calls the client
- **THEN** a span `kc.app.llm_complete` records model, input and output tokens, cost estimate and latency, and omits prompt text

#### Scenario: Rate limited
- **WHEN** one device exceeds its call budget
- **THEN** the client raises a rate-limit error that the API maps to HTTP 429

#### Scenario: One call shape for all features
- **WHEN** E or C calls `complete({ op, deviceId, system, messages, maxTokens, model?, rateLimit? })`
- **THEN** it receives `{ text, model, usage: { inputTokens, outputTokens, costUsd, latencyMs }, traceId }`, with cost from `pricing.ts` (`claude-haiku-5-5` $0.10 / $0.50 per million tokens in/out by default)

#### Scenario: No key
- **WHEN** `ANTHROPIC_API_KEY` is not set
- **THEN** `complete()` throws `LlmUnavailableError` with reason `no_key` without any network call

### Requirement: Marker-anchored registries
The system SHALL expose route, navigation, API-route and i18n registries that each change extends by inserting lines directly under its own pre-written marker comment (one per change id, in merge order) or by adding its own file, never by editing existing entries. The i18n loader SHALL merge every `<lang>/*.json` file by key, not by file name.

#### Scenario: Two changes register features
- **WHEN** two branches each insert a line under their own marker in `web/src/routes.ts` and both merge through the queue
- **THEN** git merges both without a conflict and both routes are registered

#### Scenario: Split agents own separate string files
- **WHEN** one agent adds `en/access.json` keys and another adds `en/access-cards.json` keys
- **THEN** `t()` resolves keys from both files, and a key defined in both files fails a unit test

### Requirement: Contract stubs and rate-limit helper
The system SHALL ship stubs of `api/src/lib/chaos.ts` (F's exports, always returning defaults), `web/src/lib/speech/index.ts` (resolving `{ supported: false }`) and `web/src/lib/capture/queue.ts` (`enqueueNote` rejects as not implemented, `getLastSaveMs` returns `null`), and a generic per-key token bucket in `api/src/lib/rateLimit.ts`.

#### Scenario: Consumer compiles before the producer merges
- **WHEN** F's Status screen imports `getLastSaveMs` before B has merged
- **THEN** it compiles and reads `null`

#### Scenario: Limit exceeded
- **WHEN** a key takes more tokens than `max` within `windowMs`
- **THEN** the helper returns `ok: false` with `retryAfterS` and other keys are unaffected

### Requirement: Database migrations
The system SHALL apply numbered SQL migrations in order at startup, once across replicas, and block readiness until they finish.

#### Scenario: Two replicas start together
- **WHEN** two replicas start on an empty database
- **THEN** each migration runs exactly once

#### Scenario: Lower version arrives late
- **WHEN** migration 200 is already applied and migration 100 arrives in a later deploy
- **THEN** the runner applies 100, because it applies every unrecorded version rather than only versions above the highest applied one

#### Scenario: Budget
- **WHEN** the manifests are applied
- **THEN** total CPU and memory requests are at most 2 CPU and 4 GiB and the Postgres `Cluster` requests 250m and 512 Mi

### Requirement: Synthetic Kay hooks
The repo SHALL provide a Playwright project `kay` (iPhone 15 viewport, `es-ES` locale, reduced motion, tests in `web/e2e/kay/`, base URL from `KC_BASE_URL`), and the browser telemetry SHALL report service name `kc-web-kay` only when `localStorage['kc.probe']` is `kay`.

#### Scenario: Probe identity on a phone viewport
- **WHEN** the `kay` project loads the app with `kc.probe=kay` seeded
- **THEN** browser telemetry is sent with service name `kc-web-kay` using the ingest-only token

#### Scenario: Normal visitor
- **WHEN** a visitor has no `kc.probe` key, any other value, or blocked storage
- **THEN** the default browser service name is used

#### Scenario: No spec yet
- **WHEN** `e2e-mobile` runs before F adds the Kay spec
- **THEN** the `kay` project passes with zero tests

### Requirement: Route templates on server spans
Fastify OTel instrumentation SHALL emit `http.route` on every server span as the route template (for example `/api/agenda/:id`), never the raw path, so that Dash0 span metrics carry a per-route `dash0_operation_name` ("GET /api/agenda/:id"). The app SHALL also record the histogram `kc_app_http_server_duration` (unit `ms`, attribute `route` = the same template, plus `method` and `status_class`) from an `onResponse` hook and export it over OTLP, as the fallback source for per-route p95.

#### Scenario: Templated route on span
- **WHEN** a request is served for `/api/agenda/42` and the route is registered as `/api/agenda/:id`
- **THEN** the server span has `http.route` = `/api/agenda/:id` and its name is `GET /api/agenda/:id`

#### Scenario: Fallback histogram carries the route
- **WHEN** the same request completes
- **THEN** `kc_app_http_server_duration` records one sample with `route` = `/api/agenda/:id` and no raw id in any attribute

### Requirement: Under-the-hood registry
The web app SHALL provide an append-only registry of Under-the-hood entries in `web/src/under-the-hood/`, where each change adds exactly one file `entries/<change-id>.json` naming what its features do for Kay and which Gitar rule, Dash0 signal or Radar check backs them. A unit test SHALL validate every entry.

#### Scenario: Two changes add entries in parallel
- **WHEN** two branches each add their own `entries/<change-id>.json`
- **THEN** both merge without a conflict and `ENTRIES` lists both in merge order

#### Scenario: Invalid entry
- **WHEN** an entry's id differs from its file name or its `titleKey` has no ES string
- **THEN** the `lint-unit` check fails and names the file
