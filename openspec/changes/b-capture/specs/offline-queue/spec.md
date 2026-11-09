## ADDED Requirements

### Requirement: Offline-first save
Capture SHALL write every note, person and promise to an IndexedDB queue before any network call, and show it as "Saved on this phone" until synced.

#### Scenario: Save while offline
- **WHEN** the device is offline (Playwright offline mode) and Kay saves a note
- **THEN** the note shows as saved on the phone and nothing is lost on reload

#### Scenario: Replay on reconnect
- **WHEN** the device goes back online
- **THEN** queued items POST in order, each marks "Synced", and the queue empties

### Requirement: Safe retry
The queue SHALL retry network errors, 5xx and 429 with backoff, flush on `online`, foreground and app start, and use Background Sync tag `kc-capture-flush` where supported. Items rejected with other 4xx SHALL be kept in a visible "Needs attention" state.

#### Scenario: No duplicates
- **WHEN** a POST succeeds server-side but the response is lost, then retried
- **THEN** exactly one note exists

#### Scenario: Background Sync unavailable
- **WHEN** `SyncManager` is absent (iOS Safari)
- **THEN** items still flush on `online` and app foreground

#### Scenario: Rejected item
- **WHEN** the server returns 400 for an item
- **THEN** it is listed as needing attention with a Delete action and not dropped silently
