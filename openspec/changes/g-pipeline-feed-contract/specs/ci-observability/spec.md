## ADDED Requirements

### Requirement: CI traces to Dash0
A `workflow_run` workflow SHALL export each completed run of the five check workflows and the `deploy` workflow to Dash0 with `dash0hq/otel-cicd-action@v4`, using only the ingest-only token from a Secret.

#### Scenario: Red then green run is visible
- **WHEN** a `feed-contract` failure and its fix both complete
- **THEN** both runs appear as traces with job and step spans in Dash0

### Requirement: Author email mitigation
Commit author emails exported in CI traces SHALL be GitHub noreply addresses.

#### Scenario: Trace check
- **WHEN** the first CI trace is inspected in Dash0
- **THEN** no author email other than `*@users.noreply.github.com` is present, otherwise the workflow is disabled and the finding recorded

### Requirement: Stage runbook
The repo SHALL contain `docs/runbooks/feed-break.md` with trigger, expected timeline, nudge, fallback and reset steps.

#### Scenario: Live break
- **WHEN** the presenter follows the runbook
- **THEN** the break is triggered by one `gh variable set` plus opening a prepared PR, and a reset step restores `FEED_FIXTURE=sessionize-v1` and `FEED_MODE=ok`
