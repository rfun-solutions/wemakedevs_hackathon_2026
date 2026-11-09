## ADDED Requirements

### Requirement: Threads view on mobile
The PWA SHALL provide a `/threads` view, usable at 390 px width, listing the device's threads newest activity first, with a button to group the day's notes.

#### Scenario: Run from phone
- **WHEN** Kay taps "Group today's notes" on a 390 px viewport
- **THEN** a live region announces progress and result, and the new thread cards appear without page reload

#### Scenario: Accessible controls
- **WHEN** the view is audited with axe at mobile viewports
- **THEN** there are no violations, all targets are at least 24 px, and the run control is a `button` element

#### Scenario: Bilingual strings
- **WHEN** the UI language is ES
- **THEN** all `threads.*` strings render in Spanish

#### Scenario: Offline
- **WHEN** the device is offline
- **THEN** the cached thread list is shown and the run button is disabled with an explanatory message

### Requirement: Threads carry across days
The system SHALL attach a day's unthreaded notes to existing open threads (activity within 7 days) when related, and otherwise create new threads.

#### Scenario: Note joins an earlier thread
- **GIVEN** Monday's thread "Service mesh" and a Tuesday note about sidecar-less mesh
- **WHEN** a run is made for Tuesday
- **THEN** the note is linked to the Monday thread and its `last_day` is Tuesday

#### Scenario: Idempotent re-run
- **WHEN** a run is repeated with no new notes
- **THEN** no threads or links are created or duplicated

#### Scenario: Device isolation
- **WHEN** device A runs threading
- **THEN** only device A's notes are read and no other device's threads are returned

### Requirement: Threads end in actions
Every thread SHALL carry a list of actions Kay can take later: follow-ups derived from its notes and the device's captured promises that belong to it. Both the LLM and the heuristic path SHALL produce actions, and each action SHALL be markable as done.

#### Scenario: Act on a thread from a phone
- **WHEN** Kay opens the "Service mesh" thread on a 390 px viewport
- **THEN** it ends with "Next steps" listing at least one follow-up and the related promise as native checkboxes of at least 24 px, and ticking one announces it in a live region

#### Scenario: Promise attached
- **GIVEN** an open promise "Send Ana the OTel demo link" captured in B
- **WHEN** a run groups the day's OpenTelemetry notes
- **THEN** that promise appears as an action of the OpenTelemetry thread, and ticking it calls B's `PATCH /api/promises/:id`

#### Scenario: Heuristic actions
- **GIVEN** no `ANTHROPIC_API_KEY` and a note "Follow up with the Envoy team about ambient mode"
- **WHEN** a run is made
- **THEN** the note's thread has a follow-up action with that sentence and source `heuristic`

### Requirement: Next steps list
The Threads view SHALL offer a "Next steps" list of every open action across the device's threads, each with its thread title, served by `GET /api/threads/actions?open=1`.

#### Scenario: Later, at home
- **WHEN** Kay opens Next steps on the evening of day 3
- **THEN** open actions from all three days are listed, newest thread first, and done actions are not listed

#### Scenario: Offline
- **WHEN** the device is offline
- **THEN** the last loaded list is shown and ticking is disabled with an explanatory message

### Requirement: Run endpoint
The service SHALL expose `POST /api/threads/run` requiring `X-Device-Id`, returning the mode, threads and usage; and SHALL support a nightly CronJob using a token-authenticated all-devices variant.

#### Scenario: Missing device id
- **WHEN** the request lacks `X-Device-Id` and no valid cron token
- **THEN** the response is 400 or 401 and nothing is written

#### Scenario: Nightly CronJob
- **WHEN** the CronJob manifest is unsuspended and fires
- **THEN** it calls the run endpoint with the cron token and processes each device with new notes

### Requirement: Heuristic fallback
The system SHALL group notes with a deterministic keyword-based heuristic when there is no API key, the daily cap would be exceeded, or the LLM call or its output fails validation.

#### Scenario: No key
- **GIVEN** no `ANTHROPIC_API_KEY`
- **WHEN** a run is made
- **THEN** threads are created with source `heuristic` and the response has `mode: "heuristic"`, `reason: "no_key"`

#### Scenario: Deterministic
- **WHEN** the heuristic runs twice on the same input
- **THEN** the same groups and titles are produced

#### Scenario: Bad LLM output
- **WHEN** the model returns invalid JSON twice
- **THEN** the run completes via heuristic with `reason: "error"`

### Requirement: Per-device daily cost cap
The system SHALL record each LLM call's cost estimate in `llm_usage` and SHALL NOT make an LLM call when the device's day total plus the worst-case estimate would exceed `THREADS_DAILY_CAP_USD`.

#### Scenario: Cap reached
- **GIVEN** a device whose day total is at the cap
- **WHEN** it runs threading
- **THEN** no LLM call is made, the heuristic is used with `reason: "cap"`, and the UI says so

#### Scenario: Parallel runs
- **WHEN** two runs for one device start simultaneously
- **THEN** the combined recorded cost does not exceed the cap

### Requirement: Seeded demo data
The repo SHALL include `npm run seed:threads`, which creates fictional notes for B's demo device across three days only by calling B's `POST /api/capture/seed`, containing no real people or attendee data.

#### Scenario: Seed and run
- **WHEN** `npm run seed:threads` then a run are executed
- **THEN** at least three threads exist, at least one spanning two days, and at least two threads have actions including one seeded promise
