## ADDED Requirements

### Requirement: Status screen on mobile
The app SHALL provide a Status screen reachable from the nav, usable at 375 px width with targets of at least 24 px, using design tokens and `t('status.*')` strings in EN and ES.

#### Scenario: Kay checks a save
- **WHEN** Kay saves a note and opens Status
- **THEN** the screen shows "Saved in N ms" with the latest measured client-to-confirmation time, in an ARIA live region

#### Scenario: Feed freshness
- **WHEN** the schedule feed was last synced 4 minutes ago
- **THEN** Status shows "Schedule updated 4 min ago"

#### Scenario: Accessible
- **WHEN** axe runs on the Status screen at iPhone 15 and Pixel 7 viewports
- **THEN** there are no violations

### Requirement: Wi-Fi or us verdict
The screen SHALL compare client RTT with the server p95 and the SLO threshold and state a plain-language verdict.

#### Scenario: Slow connection
- **WHEN** median client RTT exceeds 400 ms and server p95 is within the SLO
- **THEN** the verdict says the connection looks slow, not the app

#### Scenario: Slow server
- **WHEN** server p95 exceeds the SLO
- **THEN** the verdict says the app is slow right now, not the user's Wi-Fi

#### Scenario: Offline
- **WHEN** the device is offline
- **THEN** the verdict says notes are queued and no network call is attempted

### Requirement: Status API
The API SHALL expose `GET /api/status` and SHALL use C0's `GET /api/ping` as the RTT probe. Both, and every `/api/status/*` route, SHALL be exempt from chaos injection.

#### Scenario: Status payload
- **WHEN** a client calls `GET /api/status`
- **THEN** it receives server p95, SLO threshold, feed sync time and chaos-active flag, and a `kc.status.read` span is emitted

### Requirement: Promise lights
The Status screen SHALL show a "What we promise you" block listing D's five Access promises P1-P5 in Kay's language, each with a live light computed by the server from Dash0 data and shown as an icon plus text. A promise with no data SHALL show "Not measured right now", never green. The release footer SHALL sit directly under the block.

#### Scenario: Lights on a phone
- **WHEN** Kay opens Status on a 390 px viewport with the UI in ES and every promise has data within its limit
- **THEN** five rows show D's Spanish promise text with "Working" and an icon each, and axe reports no violations

#### Scenario: Captions slower than promised
- **WHEN** the faster caption engine's p95 over 5 minutes is above 4000 ms
- **THEN** the P1 row says "Slower than promised" and the change is announced once in a polite live region

#### Scenario: No measurement
- **WHEN** Synthetic Kay has reported nothing in 30 minutes or the Dash0 poll is unavailable
- **THEN** the affected rows say "Not measured right now" and none of them is green

#### Scenario: No review talk
- **WHEN** the block renders
- **THEN** it shows no pull-request list and no links to GitHub

### Requirement: Release footer
The Status screen SHALL show a footer line "Last release HH:MM, Gitar-reviewed, Radar all-clear" built from `GET /api/status/release`, with descriptive links to the release PR and the shared Radar investigation, time in America/Denver, and EN and ES strings.

#### Scenario: Full release record on a phone
- **WHEN** Kay opens Status at 390 px and the release record has a time, a Gitar review and a Radar link
- **THEN** the footer shows all three clauses and a link to the shared Radar investigation, each link at least 24 px tall

#### Scenario: Partial record
- **WHEN** the record has no Radar link or no Gitar review
- **THEN** the missing clause is left out rather than claimed

#### Scenario: No record
- **WHEN** `GET /api/status/release` returns 204
- **THEN** no footer is shown
