# Research 02: Gitar, external-dependency CI failures, deploy pipeline
Collected 2026-11-08. Information only, no decisions. Items marked (UNVERIFIED) come from general knowledge or secondhand sources, not a primary doc.

## 1. Gitar

### What it does
AI PR review plus CI failure analysis/fix. Inline review comments plus a "dashboard" summary comment (bot: `gitar-bot`). On CI failure it reads logs, posts a root cause, and can push a fix commit (auto-apply) or on request (`Gitar fix CI`). Fixes are new commits; never force-push. Language-agnostic. Ephemeral environments, says it doesn't retain code or train on it.
Sources: https://docs.gitar.ai/quickstart , https://www.sonarsource.com/resources/library/get-started-with-gitar/ , https://docs.gitar.ai/llms.txt (full docs index)

### GitHub App install (about 5 min)
1. Sign in at https://app.gitar.ai/sign-up with GitHub.
2. "Connect Your Code" -> GitHub -> add Gitar GitHub App to the org/account; grant all or selected repos.
3. Optional: Jira/Linear/Slack (skippable).
4. Open a PR, or "Start Review"/"Try Gitar on Your Open PRs" on the dashboard. `gitar-bot` comments within a few minutes.
- Needs permission to install a GitHub App on the org AND Gitar org-admin role. A personal account/own org avoids approval waits.
- App permissions: Code/issues/PRs read+write; Actions/checks/commit statuses/**workflows** read+write. Source: https://docs.gitar.ai/connecting-code/github
- Skip a PR: label `gitar-skip`. Address it by "Gitar ...", `@gitar`, `@gitar-bot`.

### Pricing / trial
- 14-day free Pro trial for eligible new orgs, no card. After trial the org drops to Free, which LACKS code reviews and PR commands. (https://docs.gitar.ai/resources/faq)
- Plans: Core and Pro (50 users each), Enterprise (unlimited), Open Source (free for vetted public repos, Pro feature set). Prices at gitar.ai/pricing (not in docs). https://docs.gitar.ai/account-billing/plans
- Pro-only: auto-apply, auto-approve, merge blocking, advanced CI analysis, custom checks/automations (rules), Slack/Linear/Jira.
- Enterprise-only: custom MCP integrations, functional validation, cross-repo/PR analysis, agentic security, BYO model.
- Usage budget: when exhausted, automatic re-reviews after pushes pause; new PRs and `Gitar review` comments still work on paid plans.
- Secondhand (UNVERIFIED, Sonar course page): `.gitar/review/` files available on all plans; repository rules need Pro/Enterprise (Pro one source says 5 custom rules per org).

### Custom review rules: `.gitar/review/*.md`
Plain markdown, no frontmatter, no schema. One or more files, split by topic. Official example (https://docs.gitar.ai/configuration/repository-config):
```markdown
# Logging Gotchas

- Use `info!` for logging that requires operational visibility
- Leave `debug!` for local debugging only
- Our telemetry only renders logs with severity `info` or higher
```
Includes: `@../rust_best_practices.md` (relative to the file) or `@shared/common_rules.md` (falls back to repo root); recursive; must stay inside repo; each on its own line.
Other `.gitar/` contents: `rules/*.md` (YAML frontmatter: title, description, slug, when, actions, type=check|automation; natural-language), `skills/<name>/SKILL.md`, `instructions/`, `config/{apply,approve,merge,risk}.md`, `cross-repo.md`. Also reads AGENTS.md, CLAUDE.md, .cursorrules, `.claude/rules/*` (one level deep only).
Rules doc: https://docs.gitar.ai/features/rules ; community rules repo: https://github.com/gitarcode/rules ; Sonar course: https://www.sonarsource.com/learn/course/gitar/68cc3fd9-cf59-4ddd-98a6-5ceedafcd68d/customizing-gitar-repository-rules-and-review-instructions
Judging tip: track says "custom rules in .gitar/review/", so ship at least one review file (files in `.gitar/review/` verbatim path). Review instructions that match the app's real gotchas (e.g. "all outbound HTTP calls must have timeout + retry", "never hardcode schedule source URLs") would show well.

### CI failure diagnosis and auto-apply
https://docs.gitar.ai/features/ci-failure-analysis
- Analysis comment names files/lines. Dedupes identical failures across jobs; ignores events for outdated commits.
- Failure types listed: build errors, test failures, lint/format, flaky tests (race/timing).
- Auto-apply per PR: comment `gitar auto-apply:on` / `gitar auto-apply:off`, or label `gitar-managed`. Pro. Saving org criteria alone enables nothing.
- Multi-iteration: pushes fix, watches rerun, tries again; stops after 3 consecutive Gitar commits.
- Recovery: if a Gitar fix breaks previously passing CI it can follow up even with auto-apply off (since Oct 16 2026).
- Unfixable after several attempts: posts summary of what it tried; you can steer with a comment ("Gitar fix CI, keep the timeout unchanged").
- Auto-apply for REVIEW findings is limited by criteria (`.gitar/config/apply.md`, read from default branch; max 8 findings per run); CI fixes and explicit `gitar fix` are independent of criteria. https://docs.gitar.ai/features/code-review/auto-apply
- "Retry unrelated CI failures": Settings -> Configuration -> Behavior toggle; reruns on GitHub Actions etc.; never retries related/uncertain failures; won't retry same run repeatedly.
- Sonar page claims fixes are validated against CI before commit and CI triage labels code-introduced / flaky / infrastructure noise; the Gitar docs themselves do NOT describe a formal classifier (conflict between the two sources).

### CI systems
Native (uses code-host credential): GitHub Actions, GitLab, Bitbucket, Azure DevOps. Needs separate Gitar credential for logs: Jenkins, CircleCI, Concourse, Woodpecker, Buildkite, TeamCity, Harness, Bitrise. AWS CodeCommit preview. For GitHub Actions, no extra setup.

### MCP / CLI / API
- No Gitar MCP server or CLI documented anywhere in docs or FAQ. Gitar is an MCP CLIENT only (custom MCP servers: Enterprise; https only, public host, no localhost). https://docs.gitar.ai/integrations/custom-integrations
- Commands: `gitar unblock`, `auto-apply:on|off`, `auto-merge:on|off`, `display:verbose|compact`. https://docs.gitar.ai/commands
- REST API (on request / Enterprise-ish): https://docs.gitar.ai/api-reference/overview
- Skills (`.gitar/skills/<name>/SKILL.md`) can ship scripts; callable from rules or PR comments (no custom MCP needed on Pro?). Not confirmed which plan. (open question)

### Limits / unknowns
Numeric rule limits not published; full-review allowances "still being measured." Docs don't say whether Gitar edits `.github/workflows/*` (it holds the `workflows` write permission, so technically capable; UNVERIFIED behavior). Fork-PR handling, rate limits, private network/self-hosted runners: not covered.

## 2. External-dependency CI failure demo

### How Gitar treats non-code failures (what docs say)
- Docs do NOT say how infra/external failures (outage, rate limit, expired token) are handled. FAQ and how-it-works both explicitly silent.
- Documented: "unrelated" failures can be auto-retried (when retry toggle on); "related or uncertain" are analyzed/fixed, not retried. Unfixable => summary after several attempts.
- Reasonable expectation (inference, UNVERIFIED): Gitar can fix the CODE side of an external failure (add timeout/retry/backoff, pin a version, fix a changed schema field mapping, point to a fallback/mirror, update a stale fixture) but cannot rotate a secret, restore a third-party service, or change repo/org secrets or registry settings. It also cannot run shell or tests itself (auto-apply doc says fixer cannot run commands; validation is by your CI rerun).
- Test this empirically in the demo repo before the event slot if allowed; the hackathon rule limits coding to after kickoff, so test during the event.

### Reproducible-on-demand break scenarios
| Scenario | How to trigger | Gitar-fixable? (inference) |
|---|---|---|
| Upstream schema drift (Sessionize/Sched JSON field renamed or removed) | Point step at a fixture server/branch with changed JSON, or env flag swaps `schedule-v1.json` for `schedule-v2.json` | Likely yes: code/mapper/test change |
| Contract/validation step fails on external feed (JSON Schema check of talks) | Same toggle | Yes: update schema/mapper, or loosen with justification |
| Third-party rate limit (HTTP 429) | Local mock returning 429 after N calls; or hammer a real API | Partly: add retry/backoff/cache; can't raise quota |
| Expired/revoked token (401/403) | Use a deliberately invalid secret via repo variable toggle | No for the secret itself; may improve error message/fail-fast or add token-check step |
| Flaky dependency (random 503) | Mock endpoint failing with probability p, or `?fail=0.5` param | Yes: retry/timeouts; also fits "retry unrelated failures" |
| Container registry pull failure / Docker Hub rate limit (toomanyrequests) | Base image from docker.io anonymous, or reference a nonexistent tag | Yes for code side: switch base image to mirror/GHCR/pinned digest; no for registry outage |
| Image tag/digest no longer exists | Pin a deleted/nonexistent tag | Yes: change tag |
| Package registry/dependency yank or breaking minor bump (npm/PyPI) | Unpinned dep + a version you control (publish a bad version to a scratch package), or lockfile edit | Yes: pin/revert |
| Network/DNS timeout to external URL | Point at blackhole address (e.g. 10.255.255.1) with a short timeout | Partly: timeout/retry/fallback |
| TLS cert expiry | `badssl.com` expired host as target | Partly |
| Kubernetes manifest drift vs cluster API (deprecated apiVersion, kubeconform/kubectl --dry-run fails) | Use a removed apiVersion | Yes: manifest edit |
| Missing/renamed secret or env var | Remove var in a workflow | Workflow edit possible but needs `workflows` perms to push; uncertain |

### "Break it" switch ideas
- Repo variable / `workflow_dispatch` boolean input (`chaos: none|schema|429|auth|flaky|registry`) read by a step that sets env for a mock external service.
- A tiny "fake upstream" container (WireMock/Mockoon/json-server or 30-line Express) started as a GitHub Actions service container; mode controlled by env or by a `chaos.json` file in repo (PR that flips it = a PR Gitar can review/diagnose).
- Fixture branch/PR: PR modifies `fixtures/sessionize.json` (schema drift). PRs make Gitar's review + CI diagnosis visible in one flow, matching the track must-haves.
- Chaos endpoint on the app itself (hackathon organizers list "instrumented schedule app with a chaos button" as an example; ties to Dash0 track).
- Commit-message trigger or PR label (`chaos:429`) read through `github.event`.
- Caveat: "break" must be reproducible without depending on a live third party staying cooperative at the demo venue (Wi-Fi). Prefer mocked upstream + one real call as a smoke step.
- Real data sources to mention: Sessionize has public JSON endpoints (`https://sessionize.com/api/v2/<id>/view/All`) (UNVERIFIED); Sched has an API requiring an API key (UNVERIFIED); KubeCon schedule is on sched.com (UNVERIFIED which). Check data-use rule 4.

## 3. Deploy pipeline options (GitHub Actions -> Kubernetes)

### Push vs pull
| Option | Cluster reachability | Pros | Cons |
|---|---|---|---|
| Push: Actions runs `kubectl apply`/`helm upgrade` using kubeconfig secret | Needs API server reachable from GitHub-hosted runner (public cluster) | Simplest, shortest demo, deploy step is in CI (Gitar can see and diagnose it) | Not possible for cluster behind NAT without tunnel/runner |
| Push via self-hosted runner (actions-runner on laptop/in cluster, or Actions Runner Controller) | Runner makes outbound-only connection to GitHub | Works behind NAT; kubectl against kind on laptop | Maintenance; runner on laptop must stay up; security with public repos (don't run fork PRs on self-hosted) |
| Push via Tailscale (tailscale/github-action; ephemeral tagged node joins tailnet) | Private cluster reachable on tailnet | No runner to maintain; doc'd by Tailscale | Needs tailnet ACL for `tag:ci`, kube API exposure/proxy; setup time. Source: https://tailscale.com/kb/1276/github-action , https://tailscale.com/docs/solutions/connect-github-cicd-workflows-to-private-infrastructure-without-public-exposure |
| Tunnel (inlets etc.) | Exposes private API server | Works anywhere | Extra tool. https://inlets.dev/blog/2021/12/06/private-deploy-from-github-actions.html |
| Pull GitOps: Argo CD or Flux in cluster watches git/registry | Outbound only; works behind NAT | No inbound access; drift correction; CI just builds image and bumps tag/manifest in git | More moving parts; deploy failures show in Argo, not in GH Actions logs (Gitar can't see) |
| Hybrid: Actions builds+tests+pushes GHCR image and commits tag bump; Argo/Flux deploys | Outbound only | Common pattern; keeps CI failures (what Gitar fixes) in Actions and deploy in cluster | Two systems to explain |
Sources: https://wellarchitected.github.com/library/architecture/recommendations/deploying-actions-runner-controller/ , https://learn.microsoft.com/en-gb/azure/architecture/guide/aks/aks-cicd-github-actions-and-gitops , https://oneuptime.com/blog/post/2026-02-26-argocd-github-actions-integration/view
Rule of thumb from sources: one cluster, few deploys -> Actions alone is enough; Argo shines at 3+ clusters/drift.

### Cluster targets
- kind/k3d on laptop: only reachable via self-hosted runner/Tailscale/Argo pull (no inbound). Fine for demo; also CI can spin an ephemeral kind cluster inside the runner with `helm/kind-action` to deploy-and-smoke-test per PR (no external reachability needed, fully self-contained, and failures show in Actions logs for Gitar).
- Cloud cluster (public API endpoint): push with kubeconfig/OIDC works from hosted runners.
- Radar event cluster (join.cnh.radarhq.io, code at kickoff): Radar track requires app runs on K8s with Radar connected. Unknown whether event cluster allows external pushes; check the `skyhook-io/cnh-starter` repo (open question).

### Registry
GHCR: `ghcr.io/<owner>/<image>`, login with `docker/login-action` using `GITHUB_TOKEN` and `permissions: packages: write`. Package visibility defaults private; set public or use imagePullSecret for pulls from cluster (open item to verify). Docker Hub anonymous pulls are rate-limited (useful for a failure scenario).

### CI observability with Dash0
- Official: `dash0hq/otel-cicd-action@v4` (fork of inception-health/otel-export-trace-action) exports workflow run as an OTel trace (CICD semconv) to Dash0. Inputs: `otlpEndpoint` (grpc://, http(s)://), `otlpHeaders` (e.g. `Authorization=Bearer ...,Dash0-Dataset=...`), `otelServiceName`, `githubToken`, `runId`, `extraAttributes`. Typically run in a separate workflow on `workflow_run: completed` with `runId: ${{ github.event.workflow_run.id }}`; permissions `contents: read, actions: read`. Output `traceId`.
  Docs: https://www.dash0.com/docs/dash0/miscellaneous/manage-as-code/manage-cicd-observability-as-code , https://dash0.com/hub/integrations/int_github/overview , https://www.dash0.com/blog/enhancing-github-actions-observability-with-opentelemetry-tracing , https://dash0.com/guides/github-actions-observability-opentelemetry-tracing
- Caveats: export runs after the workflow finishes (consumes runner minutes); exports commit messages and author emails unredacted (rule 4: no private data; use a throwaway author email/noreply); traces don't appear on the PR page.
- Alternatives: paper2/github-actions-opentelemetry, OTel Collector githubreceiver, SigNoz guide https://signoz.io/docs/cicd/github/github-actions-traces/ .
- Tie-in idea: failed pipeline trace in Dash0 + Gitar diagnosis of the same failure; also Argo CD/Flux metrics to Dash0. Dash0 Operator for the cluster side (README links).
- Separate Gitar-hosted-view note: a `workflow_run` exporter workflow is itself a CI job that could fail and be diagnosed.

## 4. GitHub Actions versions (verified via `gh api releases/latest` on 2026-11-08)
| Action | Latest | Major tag |
|---|---|---|
| actions/checkout | v7.0.1 (2026-07-20) | @v7 |
| actions/setup-node | v7.1.0 (2026-10-08) | @v7 |
| actions/setup-python | v7.1.0 | @v7 |
| actions/setup-go | v7.0.0 | @v7 |
| actions/cache | v6.1.0 | @v6 |
| actions/upload-artifact | v7.0.2 | @v7 |
| actions/download-artifact | v8.0.2 | @v8 |
| docker/build-push-action | v7.4.0 | @v7 |
| docker/setup-buildx-action | v4.4.1 | @v4 |
| docker/login-action | v4.8.0 (2026-11-05) | @v4 |
| docker/metadata-action | v6.2.0 | @v6 |
| azure/setup-kubectl | v5.2.0 | @v5 |
| azure/setup-helm | v5.0.1 | @v5 |
| helm/kind-action | v1.15.2 (2026-11-04) | @v1 |
| dash0hq/otel-cicd-action | v4 (per Dash0 docs; not checked via API) | @v4 |
Tools: Argo CD v3.6.1, Flux v2.10.0, Helm v4.3.1, Actions runner v2.338.2.
Reminder (project CLAUDE.md): every workflow needs a top-level `permissions:` block (default `contents: read`) after `name`, before `on`. Not checked: tailscale/github-action version.

## Open questions
1. Does Gitar's Pro trial gate `.gitar/review/` and rules the same way as the Sonar page says? Confirm in app Settings after signup.
2. Will Gitar edit `.github/workflows/*` to fix a CI failure? Test live.
3. How does Gitar behave on a pure external failure (429, 401, registry down)? Not documented; test with the mock upstream.
4. Is a track-level judge expecting Sonar (SonarQube/Cloud) integration too ("Never Merge Broken", Sonar)? Not in the must-haves; ask at kickoff.
5. Can the event Radar cluster accept pushes, or is GitOps-only? Check cnh-starter.
6. Is the demo laptop on venue Wi-Fi able to reach the Actions-hosted runners/GHCR reliably? Pre-pull images.
7. Public repo + GHCR package visibility for pulls from the cluster.
8. Plan for Gitar's usage budget and 3-consecutive-commit cap during live demo; have a retry path (`Gitar fix CI`).
9. Which schedule source (Sessionize vs sched.com) and its terms of use for rule 4.
