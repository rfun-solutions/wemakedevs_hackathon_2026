## ADDED Requirements

### Requirement: Hot-paths stage runbook
`docs/runbooks/hot-paths.md` SHALL describe a two-minute stage beat in which the rule file is already on `main` and a prepared agenda PR is opened about 3 minutes before the slot.

#### Scenario: Stage beat
- **WHEN** the presenter follows the runbook after the 15:45 slowdown
- **THEN** `hot-paths.md` on `main` names `/api/agenda`, the prepared PR is opened at T-3 min, and Gitar's review on it quotes rule HP-1

#### Scenario: Gitar slow
- **WHEN** no Gitar review has appeared at slot time
- **THEN** the runbook switches to the dress-rehearsal PR tab

### Requirement: Accessibility regression runbook
The accessibility regression (G5) SHALL be the on-stage Gitar fix. `docs/runbooks/a11y-regression.md` SHALL describe opening D's prepared contrast-regression PR, the expected red `a11y` check naming the token (Promise P3), and Gitar's fix to `tokens.css`, and SHALL tell the presenter to reject any fix that weakens the test.

#### Scenario: Gitar fixes the token
- **WHEN** the prepared PR turns `a11y` red
- **THEN** Gitar's fix commit changes only the token and CI turns green

#### Scenario: Gitar slow on stage
- **WHEN** no Gitar fix commit has appeared 4 minutes after the PR opened
- **THEN** the runbook switches to the dress-rehearsal G5 PR tab, then to the G3 evidence PR

#### Scenario: Gitar weakens the test
- **WHEN** Gitar's commit edits an axe rule, adds an exclusion or changes a threshold
- **THEN** the runbook says to revert that commit on stage and state why

### Requirement: Budget break as a prepared evidence PR
The budget break (G3, proven in live test T8) SHALL be built and run once during the day as a prepared PR whose Gitar fix stays in the repo as evidence; it SHALL NOT be run live on stage. A `budget` check SHALL fail with the quota wording when requests in `deploy/` exceed 2 CPU or 4 GiB, and `.gitar/review/budget.md` SHALL tell Gitar to lower only the request the PR raised or added, and SHALL forbid deleting a component or editing the check.

#### Scenario: Gitar lowers the raised request
- **WHEN** the prepared PR turns `budget` red
- **THEN** Gitar's fix commit lowers the Postgres memory request, changes no other component and no script, and `budget` turns green

#### Scenario: Evidence ready before the demo
- **WHEN** the demo starts
- **THEN** the G3 PR has Gitar's fix commit and a green `budget` run, and the runbooks link it without opening a new one on stage

#### Scenario: Over budget
- **WHEN** a PR raises `deploy/postgres.yaml` memory requests to 4Gi
- **THEN** `budget` fails with a line starting `exceeded quota: team-quota`
