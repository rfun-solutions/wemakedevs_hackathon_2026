## ADDED Requirements

### Requirement: GHCR image build
On push to `main`, the `deploy` workflow (C0's `.github/workflows/deploy.yaml`, owned by G after C0 merges) SHALL build and push the image to GHCR tagged with the commit SHA.

#### Scenario: Merge produces an image
- **WHEN** a PR is merged to `main`
- **THEN** `ghcr.io/<owner>/<repo>:<sha>` exists and the workflow has top-level `permissions: contents: read` with `packages: write` only on the image job

### Requirement: Deploy bot commit
The `deploy` job SHALL push a `deploy: <sha>` commit updating the image tag in `deploy/kustomization.yaml` to protected `main` using a GitHub App token, changing only the `newTag:` line.

#### Scenario: Bot push bypasses protection
- **WHEN** the image job succeeds
- **THEN** the commit is authored by `<app-slug>[bot]` and lands on `main`

#### Scenario: Markers survive
- **WHEN** the bot writes a `deploy:` commit
- **THEN** its diff is exactly the `newTag:` line, and the per-change marker comments and order in `resources:` are unchanged

#### Scenario: No loop
- **WHEN** the pushed commit message starts with `deploy:`
- **THEN** the deploy workflow run skips all jobs

#### Scenario: Concurrent merges serialise
- **WHEN** two merges to `main` occur within seconds
- **THEN** deploy jobs run one at a time under `concurrency` and neither push is rejected non-fast-forward
