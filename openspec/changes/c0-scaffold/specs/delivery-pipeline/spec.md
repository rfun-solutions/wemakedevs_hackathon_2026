## ADDED Requirements

### Requirement: Required check names exist from the first run
CI SHALL report jobs named `lint-unit`, `e2e-mobile`, `a11y`, `build-image` and `feed-contract` on every pull request and merge-group run. Every workflow SHALL declare top-level `permissions: contents: read` and trigger on `pull_request` and `merge_group`.

#### Scenario: Names reported
- **WHEN** the C0 pull request runs CI
- **THEN** all five check names appear as passing

#### Scenario: Merge queue compatible
- **WHEN** a pull request enters the merge queue
- **THEN** each workflow runs for the `merge_group` event

#### Scenario: Stub is explicit
- **WHEN** `feed-contract` runs before change G merges
- **THEN** it passes and prints that G implements it

### Requirement: Project-aware review rules on the default branch
The repo SHALL contain `.gitar/review/external-calls.md`, `time-zones.md`, `accessibility.md`, `api-contract.md`, `inclusion.md` and `demo-data.md` on `main`. `inclusion.md` and `demo-data.md` SHALL each hold at least one testable baseline rule and SHALL state that change D owns their content. The baseline rules in `inclusion.md` and `accessibility.md` SHALL cite Access promise ids (P4 and P3).

#### Scenario: Rules present
- **WHEN** Gitar reviews the first feature pull request
- **THEN** the six rule files exist on the default branch

#### Scenario: Baseline inclusion rule
- **WHEN** a pull request adds a user-visible string without `t()` before D has filled `inclusion.md`
- **THEN** the baseline rule already covers it and names Promise P4

#### Scenario: API change without its web caller
- **WHEN** a pull request changes the response shape of a route in `api/src/routes/` and leaves the web code that reads it unchanged
- **THEN** rule AC-1 in `api-contract.md` covers it

### Requirement: Working agreement for agents
`AGENTS.md` SHALL open with the Rules of engagement from the initial commit, which C0 extends below and never rewrites, and SHALL state branch naming `feature/KC-<n>-<change>[-<part>]-pr<k>`, no force-push after Gitar pushes, noreply commit email, the line "Use the Radar MCP to check the cluster after every merge", and merge order C0, D, G, A, B, F, E, C, H.

#### Scenario: Agent starts a change
- **WHEN** an agent reads `AGENTS.md`
- **THEN** it can name its branch, its migration range and the marker it inserts under in each shared file

#### Scenario: After a merge
- **WHEN** an agent's pull request merges
- **THEN** `AGENTS.md` tells it to check the cluster through the Radar MCP and note anything odd in the PR

### Requirement: Shared-file rules for agents
`AGENTS.md` SHALL state that agents insert only under their own marker in shared registries, add one Under-the-hood entry file per change, never change dependencies or the lockfile (the orchestrator does), and leave the `images:` block of `deploy/kustomization.yaml` to the deploy bot, which changes only the `newTag:` line.

#### Scenario: Agent needs a new package
- **WHEN** an agent finds it needs a dependency that C0-base did not install
- **THEN** `AGENTS.md` tells it to ask the orchestrator instead of editing `package.json` or `package-lock.json`

### Requirement: AI disclosure
The repo SHALL contain an `AI-DISCLOSURE.md` stub naming Claude-assisted code, strings and review, to be completed before submission.

#### Scenario: Stub present
- **WHEN** a reviewer opens the repo root
- **THEN** `AI-DISCLOSURE.md` exists with placeholders for each change

### Requirement: Protected main with merge queue
The `main` ruleset SHALL require pull requests with 0 approvals, squash merge only, the five required checks, and a merge queue, and SHALL block force-push and deletion.

#### Scenario: Direct push rejected
- **WHEN** a human pushes directly to `main`
- **THEN** the push is rejected

### Requirement: Deploy bot pushes through the ruleset
The deploy workflow SHALL mint a GitHub App token, push the `deploy:` image-tag commit to `main`, skip runs triggered by `deploy:` commits, and serialise runs with `concurrency:`.

#### Scenario: Merge to deploy
- **WHEN** a pull request merges to `main`
- **THEN** one `deploy:` commit authored by the App lands within minutes and triggers no further build

#### Scenario: Racing runs
- **WHEN** two runs overlap
- **THEN** the second rebases before pushing and does not fail with non-fast-forward

### Requirement: Stale PR runs are cancelled
Every workflow triggered by `pull_request` SHALL set `concurrency` with group `${{ github.workflow }}-${{ github.ref }}` and `cancel-in-progress: true`.

#### Scenario: Second push to a PR
- **WHEN** an agent pushes again while the previous run of the same workflow on that PR is still going
- **THEN** the older run is cancelled and only the new one uses runner capacity
