## ADDED Requirements

### Requirement: Capture latency span and metric
Each save SHALL emit browser span `kc.capture.save` measured from tap to local durable write, and the server SHALL record histogram `kc_capture_saved_ms` from the client-reported value. Server handlers SHALL emit `kc.capture.notes_create`.

#### Scenario: Metric recorded on sync
- **WHEN** a note syncs with header `X-Capture-Saved-Ms: 120`
- **THEN** `kc_capture_saved_ms` records 120 and the span carries `kc.source`

#### Scenario: Offline save still measured
- **WHEN** a note is saved offline and synced later
- **THEN** the recorded value is the local save time, not the sync delay

### Requirement: Capture SLO candidate and RUM
The change SHALL define the SLO candidate "capture p95 `kc_capture_saved_ms` < 500 ms" for F to alert on, and SHALL send RUM event `kc.capture.saved` with `saved_ms`, `queued` and `online` using only the ingest-only browser token.

#### Scenario: RUM event on save
- **WHEN** Kay saves a note
- **THEN** one `kc.capture.saved` RUM event is sent with no note text in its attributes

#### Scenario: p95 under budget in test
- **WHEN** 50 local saves run in the Playwright mobile test
- **THEN** p95 of measured `saved_ms` is below 500
