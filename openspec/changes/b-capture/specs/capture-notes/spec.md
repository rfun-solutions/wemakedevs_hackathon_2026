## ADDED Requirements

### Requirement: Keyboard-first mobile capture
The app SHALL provide a capture screen on a 390 px viewport with a focused multiline note field, a Save button, a dictation button, and quick-add for a person met and a promise. All controls SHALL be native elements, at least 24 px, labelled via `t('capture.*')` in EN and ES, and use D's tokens.

#### Scenario: Save a typed note on a phone
- **WHEN** Kay types a note and taps Save on an iPhone 15 viewport
- **THEN** the note appears in the list as saved, the field clears and refocuses, and an ARIA live region announces "Saved"

#### Scenario: Axe-clean screen
- **WHEN** the capture screen is scanned by axe
- **THEN** there are no violations

### Requirement: Dictation button with stubbed speech module
The note field SHALL offer a dictation button that calls `startDictation(onText)` from `web/src/lib/speech/` and appends returned text to the field. If the module reports unsupported, the UI SHALL say so in a live region and typing SHALL keep working.

#### Scenario: Dictation unsupported
- **WHEN** `startDictation` resolves `{ supported: false }`
- **THEN** the message "Dictation not available" is announced and the field stays editable

#### Scenario: Dictation text appended
- **WHEN** `startDictation` emits "met a maintainer"
- **THEN** the text is appended to the field and `source` is `dictated` on save

### Requirement: Notes, people and promises API
The API SHALL provide `POST /api/notes`, `GET /api/notes`, `DELETE /api/notes/:id`, `POST/GET /api/people`, `POST/GET /api/promises`, `PATCH /api/promises/:id`, all scoped by `X-Device-Id`. `POST /api/notes` SHALL be idempotent on `(device_id, client_id)` and accept `source` of `typed`, `dictated` or `caption`.

#### Scenario: Create note
- **WHEN** a client posts `{client_id, body, source: "caption"}` with `X-Device-Id`
- **THEN** the response is 201 with `id`, `client_id`, `created_at`

#### Scenario: Idempotent replay
- **WHEN** the same `client_id` is posted twice by one device
- **THEN** the second response is 200 and only one row exists

#### Scenario: Device isolation and validation
- **WHEN** device A lists notes, or a post has an empty body or no `X-Device-Id`
- **THEN** device A sees only its own notes, and the invalid post returns 400

### Requirement: Fictional seed data
The system SHALL provide seed data for Kay containing only fictional notes, people and promises.

#### Scenario: Seed demo device
- **WHEN** the seed endpoint runs for the demo device with the demo flag on
- **THEN** at least 12 notes across three Denver days and 3 topics, 4 people and 3 promises exist for `DEMO_DEVICE_ID`, and none match a real attendee

#### Scenario: Seed is the single path and idempotent
- **WHEN** `POST /api/capture/seed` runs twice, or C's `npm run seed:threads` calls it
- **THEN** no duplicate rows exist, and with `KC_DEMO_SEED` unset the endpoint returns 404
