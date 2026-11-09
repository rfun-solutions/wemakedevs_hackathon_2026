## ADDED Requirements

### Requirement: Mobile schedule browsing
The app SHALL present sessions in a mobile-first list that attendee can filter by day, room and track, with times shown in the venue time zone.

#### Scenario: Kay filters on a phone
- **WHEN** Kay opens the Schedule screen at a 390 px wide viewport and picks a day and a track
- **THEN** only matching sessions are listed, each with start and end time in `America/Denver`, building, room and access tags
- **AND** every filter control has a 24 px or larger target and a text label

#### Scenario: Service sessions hidden
- **WHEN** the list loads with default filters
- **THEN** sessions flagged `is_service` (for example "Coat + Bag Check") are not shown

#### Scenario: Strings localised
- **WHEN** the UI language is ES
- **THEN** all schedule labels render from `schedule.json` ES strings

### Requirement: Venue time zone is explicit
The system SHALL store and return session times with the IANA zone `America/Denver`, converting the feed's naive local strings as wall time in that zone and never as UTC.

#### Scenario: Naive time converted
- **WHEN** the feed contains `startsAt` "2026-11-10T09:00:00"
- **THEN** the stored instant is 2026-11-10T16:00:00Z, `venue_tz` is `America/Denver`, and the API returns the ISO string with offset -07:00

#### Scenario: Viewer in another zone
- **WHEN** the browser runs in a non-Mountain zone
- **THEN** the UI still displays venue-local times, labelled with the zone abbreviation

### Requirement: Sessionize ingestion
The system SHALL ingest the Sessionize schedule feed into the `sessions` table at startup and on a CronJob schedule, dropping speaker data, and SHALL record each run in `feed_runs`.

#### Scenario: Successful ingest
- **WHEN** `runIngest()` runs against the fixture feed
- **THEN** sessions are upserted idempotently, rooms are split into building, level and room, and `feed_runs` has status `ok` with the session count
- **AND** no speaker field is stored

#### Scenario: Drifted feed
- **WHEN** the feed lacks `startsAt` (renamed `starts_at`)
- **THEN** no rows are written, the old data stays, and `feed_runs` has status `error` with a message

#### Scenario: Irregular room names
- **WHEN** a room is `Salt Palace | 200 South Entrance (South)` or `Room TBD`
- **THEN** building and room are mapped without throwing, and level is null

### Requirement: Access tags are heuristic
The system SHALL derive access tags from public categories and title keywords and SHALL label them as estimated.

#### Scenario: Novice session tagged
- **WHEN** a session has the Audience Level category "Novice"
- **THEN** it carries `novice-friendly` and the UI shows the tag with an "Estimated" qualifier

### Requirement: Schedule observability
The ingest and list paths SHALL emit spans and metrics.

#### Scenario: Ingest traced
- **WHEN** an ingest run completes
- **THEN** a `kc.schedule.ingest` span exists with the session count, and `kc_schedule_ingest_runs_total` increments, and `kc_schedule_feed_age_seconds` resets
