## ADDED Requirements

### Requirement: Feed contract job
The `feed-contract` job SHALL validate the feed served by the mock upstream against the JSON schema and run mapper and fetch tests, on `pull_request` and `merge_group`, with top-level `permissions: contents: read`.

#### Scenario: Healthy feed passes
- **WHEN** `FEED_FIXTURE` is unset or `sessionize-v1` and `FEED_MODE` is `ok`
- **THEN** schema validation and all tests pass and the job is green

#### Scenario: Schema drift fails the job without a PR change
- **WHEN** the repo variable `FEED_FIXTURE` is `sessionize-v2` and the PR touches neither fixtures nor schema
- **THEN** `feed-contract` fails at schema validation naming the unexpected `starts_at` and room fields

#### Scenario: Reverting the PR is not a fix
- **WHEN** the PR is reverted or closed while `FEED_FIXTURE` stays `sessionize-v2`
- **THEN** a new PR still fails `feed-contract` until the schema and mapper accept v2

### Requirement: Rate-limit backup break
The mock upstream SHALL return 429 with `Retry-After` for the first two requests when `FEED_MODE` is `429`.

#### Scenario: Baseline fails on 429
- **WHEN** `FEED_MODE` is `429` and `fetchFeed` has no retry
- **THEN** the fetch test fails with the 429 status in the message

#### Scenario: Retry fix passes
- **WHEN** `fetchFeed` retries with bounded backoff honouring `Retry-After`
- **THEN** the third request succeeds and the job is green

### Requirement: Sessionize baseline module
G SHALL create `api/src/services/sessionize/` containing `schema.json`, `fetchFeed.ts` exporting `fetchFeed`, and `mapper.ts` exporting `mapFeed` and `MappedSession`. The baseline SHALL be v1-only, with a timeout and no retry. A SHALL consume these files without editing them (it wraps `mapFeed` in its own `api/src/services/schedule/derive.ts`) and SHALL NOT create parallel copies.

#### Scenario: A builds on the baseline
- **WHEN** A's ingest runs after G has merged
- **THEN** it calls `fetchFeed` and `mapFeed` from `api/src/services/sessionize/`, and no other Sessionize schema, mapper or fetcher exists in the repo

### Requirement: Fictional fixtures only
Fixtures SHALL contain titles, times, rooms and tracks only, with no speaker names, bios, photos or links.

#### Scenario: Fixture lint
- **WHEN** a fixture contains a non-empty `speakers` name field
- **THEN** the unit test `fixtures-no-pii` fails
