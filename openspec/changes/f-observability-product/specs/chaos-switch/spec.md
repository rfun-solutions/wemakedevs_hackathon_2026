## ADDED Requirements

### Requirement: App-level chaos via ConfigMap
The API SHALL read ConfigMap `kc-chaos` (data key `flags.json`) at runtime and inject per-route latency and error rate for route keys starting with `/api/`. It SHALL NOT alter anything at cluster level.

#### Scenario: Latency on My agenda
- **WHEN** `kc-chaos` sets `agenda.latencyMs` to 800
- **THEN** within 10 s requests to that route take at least 800 ms, a `kc.chaos.apply` span records it, and the Status screen shows the chaos-active flag

#### Scenario: Default off
- **WHEN** the ConfigMap is empty or missing
- **THEN** no request is altered

#### Scenario: Protected routes
- **WHEN** chaos is set for any route
- **THEN** `/healthz`, `/readyz`, `/api/status`, `/api/ping` and LLM routes are never altered

### Requirement: Single chaos reader and the agenda key
F SHALL provide the only chaos reader, `api/src/lib/chaos.ts`, exporting `ChaosFlags`, `DEFAULT_CHAOS` and `getChaos(key)` with the same signature as C0's stub, which it replaces. `flags.json` SHALL support the named key `agenda` with fields `latencyMs` (number, ms), `errorRate` (0 to 1) and `naive` (boolean, the N+1 query mode). Only A's `GET /api/agenda` handler applies the `agenda` key; the generic route hook SHALL NOT apply it.

#### Scenario: Agenda naive mode
- **WHEN** `flags.json` is `{"agenda":{"latencyMs":0,"errorRate":0,"naive":true}}`
- **THEN** within 10 s `getChaos('agenda').naive` is true, `GET /api/agenda` issues one query per agenda item, and the generic hook adds no latency

#### Scenario: Bad or missing file
- **WHEN** the mounted file is missing or is not valid JSON
- **THEN** `getChaos` returns `DEFAULT_CHAOS` and does not throw

### Requirement: Backup demo load
A laptop-run load script SHALL drive 50 virtual users for 60 s at agenda and sessions routes only.

#### Scenario: LLM guard
- **WHEN** the script is given a path containing `llm`, `translate` or `thread`
- **THEN** it exits with an error before sending traffic

### Requirement: Demo runbook
A runbook SHALL describe the Agent0 to PR to Gitar to merge queue to Argo flow, with organic route first and chaos route as backup.

#### Scenario: Backup at 15:45
- **WHEN** no organic issue is found
- **THEN** the runbook steps set `kc-chaos`, run the load, ask Agent0 why "My agenda" slowed, and verify p95 recovery after Argo deploys the fix

### Requirement: Unstaged Radar investigation
`docs/demo-runbook-ai-sres.md` SHALL start with an unstaged Radar AI investigation of the first real cluster event of the day, acted on through a reviewed PR and marked Shared, and SHALL describe the after-every-merge Radar MCP check routine.

#### Scenario: Real event
- **WHEN** the first Argo sync reports `exceeded quota`, or a pod restarts, during the build
- **THEN** the event is investigated in Radar as it happens, the finding and the fix PR are recorded in the runbook table, and the investigation is marked Shared

#### Scenario: Nothing real happens
- **WHEN** no real event has occurred by 15:30
- **THEN** the runbook says so and the R3 slowdown investigation is not relabelled as organic

### Requirement: Two AI SREs runbook
`docs/demo-runbook-ai-sres.md` SHALL describe running Agent0 in Dash0 and a Radar AI investigation side by side on the 15:45 slowdown, recording both verdicts, sharing the Radar investigation, citing both in the fix PR, and running a post-deploy Radar check whose all-clear feeds the release footer.

#### Scenario: Same incident, two views
- **WHEN** the 15:45 slowdown starts
- **THEN** both investigations are started within the same minute and their verdicts are recorded in a two-column table

#### Scenario: After the fix
- **WHEN** the fix is deployed and the Radar check is all-clear
- **THEN** `scripts/release-note.mjs --apply` writes the release record and the Status footer shows the shared link
