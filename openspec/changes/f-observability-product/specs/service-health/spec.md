## ADDED Requirements

### Requirement: Shared health from polled PromQL
The server SHALL query the Dash0 PromQL API every 30 s for route p95 (grouped by label `dash0_operation_name`, the route template emitted by C0) and caption lag p95 by engine, using the full-access token only on the server, and SHALL publish the result at `GET /api/status/health`.

#### Scenario: Agenda slow for everyone
- **WHEN** the last poll found `/api/agenda` p95 at 2.1 s
- **THEN** `GET /api/status/health` lists `/api/agenda` with `slow: true` and `p95Ms` about 2100

#### Scenario: Faster caption engine
- **WHEN** the platform has both engines, both have at least 20 samples in 5 minutes and webspeech p95 is lower
- **THEN** `captions.fasterEngine` is `webspeech`

#### Scenario: One engine on the platform
- **WHEN** the request is for `deviceClass=ios` (only the speech API runs there)
- **THEN** `captions.fasterEngine` is `null` and `captions.lagging` is still computed from that engine's p95

#### Scenario: Not enough data
- **WHEN** an engine has fewer than 20 samples
- **THEN** `captions.fasterEngine` is `null`

#### Scenario: No token or stale data
- **WHEN** the token is absent or the last successful poll is older than 120 s
- **THEN** the response has `source: 'unavailable'` and the endpoint still returns 200

### Requirement: Everyone-not-you messaging
The Status screen SHALL show a plain-language, translated health banner in an ARIA live region when a route is slow or captions are lagging for everyone.

#### Scenario: Kay on venue Wi-Fi during the slowdown
- **WHEN** Kay opens Status in Spanish on a phone while `/api/agenda` is slow
- **THEN** the banner says in Spanish that the agenda is slow for everyone right now, not their Wi-Fi, and that notes still save

#### Scenario: All healthy
- **WHEN** nothing is slow or the source is unavailable
- **THEN** no banner is shown

#### Scenario: Accessible
- **WHEN** axe runs on Status with the banner visible at iPhone 15 and Pixel 7 viewports
- **THEN** there are no violations

### Requirement: Team alert and dashboard for captions
The repo SHALL hold a caption-lag check rule (p95 over 4000 ms for 5 minutes) and a dashboard showing caption lag by engine, hot-route p95 and Synthetic Kay, as code under `observability/`.

#### Scenario: Applied on merge
- **WHEN** the files reach `main`
- **THEN** the existing `observability` workflow applies them

### Requirement: Cached Agent0 explanation
The service SHALL ask Agent0 for a plain-language explanation once per breach (at most every 10 minutes), asynchronously, never per user request, because Agent0 answers take 32-42 s (live test T7). The Status screen SHALL show the cached sentence labelled "Agent0, N s ago" and as AI-generated, translated to the device language.

#### Scenario: No explanation yet
- **WHEN** a breach has started but Agent0 has not answered yet
- **THEN** the template banner is shown and no request waits on Agent0

#### Scenario: Cached sentence
- **WHEN** a breach starts and Agent0 returns a sentence
- **THEN** later Status reads show that sentence with its age, without new Agent0 calls

#### Scenario: Agent0 fails
- **WHEN** `runTask` fails or exceeds its 60 s timeout
- **THEN** `GET /api/status/explain` returns the template sentence with `source: 'template'`
