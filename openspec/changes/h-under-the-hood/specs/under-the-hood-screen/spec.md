## ADDED Requirements

### Requirement: Under the hood screen on mobile
The app SHALL provide a screen at `/under-the-hood`, reached from a secondary nav item, that lists every registry entry in merge order with what the feature does (through `t()`), the Access promises it serves, and its Gitar, Dash0 and Radar references. It SHALL use D's tokens, have targets of at least 24 px and be axe-clean.

#### Scenario: Read on a phone
- **WHEN** Kay opens How it works on a 390 px viewport
- **THEN** each feature shows a plain sentence and up to three lists headed Gitar, Dash0 and Radar, with no horizontal scroll at 200% text

#### Scenario: Spanish
- **WHEN** the UI language is ES
- **THEN** titles, sentences and headings are Spanish, and technical labels stay as code marked `lang="en"`

#### Scenario: New entry after merge
- **WHEN** a change merged after H has added its entry file
- **THEN** the screen shows it without any edit to H's files

### Requirement: Live values on the screen
Where an entry's reference has a `live` key, the screen SHALL show the current value from F's `GET /api/status/health` or `GET /api/status/release`, refreshed every 30 s while visible, and SHALL show "No live data right now" when the value is missing.

#### Scenario: Promise light
- **WHEN** an entry references `promise:P2` and the snapshot says P2 is `ok`
- **THEN** the reference shows "Working" with an icon, in the same words as the Status screen

#### Scenario: Route p95
- **WHEN** an entry references `route:GET /api/agenda` and the snapshot has its p95
- **THEN** the reference shows the p95 and the HH:MM it was measured, in America/Denver time

#### Scenario: Endpoint missing or offline
- **WHEN** the health call returns 404, fails, times out or the device is offline
- **THEN** every live value says "No live data right now" and nothing is guessed

### Requirement: Checkable references
Each repo-path reference SHALL link to the file on `main` in the public repo. A Dash0 query or trace SHALL be shown by name and expression with "Dash0 sign-in needed" rather than as a link.

#### Scenario: Gitar rule link
- **WHEN** a reference is `.gitar/review/inclusion.md` labelled IN-2
- **THEN** it links to that file on github.com with descriptive link text
