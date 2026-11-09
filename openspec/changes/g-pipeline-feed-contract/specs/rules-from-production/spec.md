## ADDED Requirements

### Requirement: Production telemetry writes a Gitar rule file
A workflow `rules-from-prod` SHALL run hourly and on `workflow_dispatch`, query the Dash0 PromQL API on us-west-2 for p95 latency per route (label `dash0_operation_name`, route template from C0) and caption lag p95 per engine, and write `.gitar/review/hot-paths.md`.

#### Scenario: Agenda is hot after the slowdown
- **WHEN** `/api/agenda` p95 over the query window is 2.1 s and every other route is under 300 ms
- **THEN** the file header states the generation time in America/Denver and UTC, the window, the region and the measured numbers, and the Rules list holds exactly one route rule, for `/api/agenda`, plus the caption rule

#### Scenario: No hot routes
- **WHEN** no route is over 300 ms
- **THEN** the Rules list says no route is over the limit and still contains the caption rule

#### Scenario: Caption SLI breached
- **WHEN** any engine's caption lag p95 is over 4000 ms
- **THEN** the caption rule is marked over limit and names `web/src/lib/speech/` with the 5 s chunk limit

#### Scenario: Query fails
- **WHEN** the Dash0 API returns an error, times out or returns no series
- **THEN** the workflow writes nothing, commits nothing and logs why

### Requirement: Each generated rule is testable in one sentence
Every rule in `hot-paths.md` SHALL be one sentence that names one route or one folder, its limit, one measurable constraint, and the live Dash0 p95 with the HH:MM it was measured, because Gitar quotes rule sentences and not the file header (T10).

#### Scenario: Rule text
- **WHEN** a reviewer reads rule HP-1
- **THEN** the single sentence names `/api/agenda`, the 300 ms limit, the constraint "keep database queries out of loops" and "production p95 is 2.1 s as of 15:52"

#### Scenario: Gitar quotes the number
- **WHEN** Gitar cites HP-1 in a finding on a PR touching the agenda handler
- **THEN** the quoted rule text contains the production p95 figure without relying on the header

### Requirement: Bot commit to protected main
The workflow SHALL commit only `.gitar/review/hot-paths.md`, through the deploy-bot GitHub App, with a message starting `rules:`, and only when the hot-route set or caption-breach state changed or `force` is true. The `deploy` workflow SHALL skip `rules:` commits.

#### Scenario: Unchanged result
- **WHEN** an hourly run finds the same hot routes and breach state as the file on `main`
- **THEN** no commit is made

#### Scenario: Changed result
- **WHEN** a run finds a new hot route
- **THEN** the bot pushes one `rules:` commit to protected `main` and no image build or deploy commit follows

#### Scenario: Path guard
- **WHEN** the script is asked to write any other path
- **THEN** it exits non-zero without writing

### Requirement: Token boundary
The workflow SHALL read the Dash0 token only from the GitHub Actions secret `DASH0_TOKEN` and SHALL declare top-level `permissions: contents: read`.

#### Scenario: Logs
- **WHEN** the workflow runs
- **THEN** the token never appears in logs or in the committed file

### Requirement: Generated rules cite Access promises
The generator SHALL put the Access promise id in the rule sentence for rules that protect one: CAP-1 SHALL read `CAP-1 (Promise P1)`, and an HP rule for `/api/notes` SHALL read `HP-n (Promise P2)`.

#### Scenario: Notes route is hot
- **WHEN** production p95 for `POST /api/notes` is over 300 ms
- **THEN** its HP rule sentence contains `(Promise P2)`, the limit, the live p95 and the HH:MM

#### Scenario: Other route
- **WHEN** `/api/agenda` is hot
- **THEN** its HP rule carries no promise id
