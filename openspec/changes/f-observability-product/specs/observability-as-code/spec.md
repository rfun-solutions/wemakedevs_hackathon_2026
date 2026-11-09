## ADDED Requirements

### Requirement: Dashboard, check rule and synthetic check as code
The repo SHALL hold a Perses dashboard, a capture-latency check rule and a synthetic check for the public URL under `observability/`, applied in CI with the `dash0` CLI.

#### Scenario: Reviewed PR
- **WHEN** a PR changes a file under `observability/`
- **THEN** CI lints the files and does not apply them, and Gitar reviews the change

#### Scenario: Apply on merge
- **WHEN** the change reaches main
- **THEN** CI applies the dashboard, check rule and synthetic check, and the job fails visibly on error

#### Scenario: Synthetic check
- **WHEN** the synthetic check runs
- **THEN** it requests `https://<team>.cnh.radarhq.io/healthz` and expects HTTP 200

### Requirement: Secrets and workflow hygiene
Workflows SHALL declare top-level `permissions: contents: read`, trigger on `pull_request` and `merge_group`, and never expose the full-access token to the browser.

#### Scenario: Token boundary
- **WHEN** the web bundle is built
- **THEN** a grep for the full-access token finds zero matches

### Requirement: Optional SLO
An SLO for capture p95 under 500 ms SHALL be created only if the Dash0 beta is enabled for the org.

#### Scenario: Beta not enabled
- **WHEN** the SLO API call is refused
- **THEN** the task is recorded as skipped and the check rule remains the alert
