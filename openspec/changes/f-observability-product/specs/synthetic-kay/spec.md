## ADDED Requirements

### Requirement: Synthetic Kay accessibility smoke test
A Playwright persona probe SHALL walk the app as Kay (iPhone 15 viewport, Spanish, large type, reduced motion), run axe on each page, and send browser telemetry as service `kc-web-kay`. It SHALL be described as an accessibility smoke test, never as uptime.

#### Scenario: Kay's walk on a phone viewport
- **WHEN** the probe runs against the public URL
- **THEN** it visits the shell, Cards, a note save and Status (and Captions if present, with consent declined), and fails on any axe violation

#### Scenario: Runs in CI too
- **WHEN** `e2e-mobile` runs on a pull request
- **THEN** the same spec runs against the local server

#### Scenario: Wording
- **WHEN** any F file, panel or runbook names the probe
- **THEN** it says "accessibility smoke test" and does not call it uptime

### Requirement: Synthetic Kay reports promise checks
At the end of each run the probe SHALL report a pass or fail for Promise P3 (axe clean at 200% type and high contrast) and Promise P4 (no English fallback in the Spanish walk) to `POST /api/status/kay-checks`, which SHALL require `X-Probe-Token` and record `kc_status_kay_checks_total{promise,result}`.

#### Scenario: Probe passes
- **WHEN** a run finds no axe violation and no English fallback
- **THEN** it posts `pass` for P3 and P4 and the counter increases for both

#### Scenario: Wrong or missing token
- **WHEN** a request has no valid `X-Probe-Token`, or `KC_PROBE_TOKEN` is unset
- **THEN** the endpoint returns 401 or 404 and records nothing

### Requirement: Probe schedules
The probe SHALL run from the laptop every 5 minutes through `scripts/kay-loop.sh`, started by the user, and from a GitHub Actions cron every 15 minutes as a fallback.

#### Scenario: Laptop busy demoing
- **WHEN** the laptop loop is stopped
- **THEN** the `kay-probe` workflow still runs every 15 minutes with top-level `permissions: contents: read`

#### Scenario: Agent does not start browser automation
- **WHEN** the build agent finishes the task
- **THEN** it has written the loop script and has not run it

### Requirement: Synthetic check as code
The repo SHALL hold a Dash0 synthetic HTTP check `kay-accessibility-smoke` on the public URL's `/` that expects 200 and an `<html lang=` attribute.

#### Scenario: Applied
- **WHEN** the file reaches `main`
- **THEN** the check appears in Dash0
