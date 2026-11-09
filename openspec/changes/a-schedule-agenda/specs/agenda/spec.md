## ADDED Requirements

### Requirement: My agenda on mobile
The app SHALL let an attendee add and remove sessions to a personal agenda keyed by the device id, with no account, and view it grouped by day.

#### Scenario: Add from a phone
- **WHEN** Kay taps "Add to my agenda" on a session at a 390 px viewport
- **THEN** `POST /api/agenda` is sent with `X-Device-Id`, the button state changes to "Added" announced via an ARIA live region, and the session appears on My agenda

#### Scenario: Agenda persists per device
- **WHEN** the same device id calls `GET /api/agenda` later
- **THEN** it receives its items ordered by start time, and a different device id receives none of them

#### Scenario: Missing device id
- **WHEN** a request has no `X-Device-Id`
- **THEN** the API responds 400

### Requirement: Building-change warning
The system SHALL warn when two consecutive agenda sessions on the same day are in different known buildings (Salt Palace, Hyatt Regency) and the gap is shorter than the walking buffer.

#### Scenario: Tight transfer
- **WHEN** a Salt Palace session ends 09:50 and the next Hyatt Regency session starts 09:55 and the buffer is 10 minutes
- **THEN** the agenda shows a `tight` warning "Building change: about 10 min walk, you have 5 min"

#### Scenario: Enough time
- **WHEN** the gap is 10 minutes or more
- **THEN** the warning has level `ok` and reads as an informational building-change note

#### Scenario: Unknown building
- **WHEN** either session is in "Room TBD" or "Off-Site Location"
- **THEN** no warning is produced

#### Scenario: Warning accessible
- **WHEN** a warning renders
- **THEN** it uses text and an icon, not colour alone, and is inside the agenda list item it concerns

### Requirement: Agenda chaos flag
The `GET /api/agenda` handler SHALL read the `agenda` key of the `kc-chaos` ConfigMap at runtime through `getChaos('agenda')` from `api/src/lib/chaos.ts` (F's reader; C0 ships a same-signature stub that A imports) and apply injected latency, errors or the N+1 naive mode, and SHALL default to the single-query path.

#### Scenario: Flag off
- **WHEN** no flag is set
- **THEN** the handler runs one joined query and `kc_agenda_db_queries` records 1

#### Scenario: Naive mode on
- **WHEN** `naive` is true and the agenda has 40 items
- **THEN** the handler issues 40 sequential per-item queries, each a child `pg.query` span under `kc.agenda.get`, and the response body is identical to the non-naive one

#### Scenario: Latency injected
- **WHEN** `latencyMs` is 800
- **THEN** the request takes at least 800 ms and `kc_agenda_request_ms` reflects it

#### Scenario: Config missing
- **WHEN** the ConfigMap is absent or malformed
- **THEN** the flag is treated as off and a warning is logged once

### Requirement: Agenda observability
Agenda endpoints SHALL emit spans `kc.agenda.get` and `kc.agenda.add` and the metrics `kc_agenda_request_ms` and `kc_agenda_db_queries`.

#### Scenario: Request traced
- **WHEN** `GET /api/agenda` completes
- **THEN** the span carries `agenda.items`, `agenda.naive` and `db.queries`
