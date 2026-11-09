# Notes for your coding agent

This repo deploys to this team's own Kubernetes cluster at the Cloud Native Hackathon: a virtual cluster (vcluster) that Radar Cloud lists as **`kubecompanion2026`**, where the team is cluster-admin. The app runs in namespace `team-kubecompanion2026`. Use Radar Cloud's MCP server (`radar-cloud`) for everything you observe or change on the cluster. Read each tool's schema; don't invent parameters.

**Pass `cluster` on every Radar call.** The organization has about 40 team clusters plus `cnh`, the platform's cluster, where teams have no access. Call `list_clusters` once per session, take the `id` of the entry whose `name` is exactly `kubecompanion2026`, and pass that id as `cluster` on every other Radar tool call. With this many clusters the tools can't pick a default. The person only has access to this team's cluster; never call a tool against `cnh` or another team's cluster. Pass `namespace: team-kubecompanion2026` wherever a tool takes it, unless you mean another namespace in this cluster.

Deploys are GitOps: change the repo, push to `main`, and Argo CD syncs the namespace. Pushing to `main` is how you deploy here, so when the person asks you to ship, fix, add or change something, that's the go-ahead to commit and push it; ask first only about changes they didn't ask for. Argo CD runs inside this cluster (namespace `argocd`) with no web UI; you drive it with `manage_gitops`. Your Argo CD Application `app` lives in `team-kubecompanion2026`, not in `argocd`: pass that namespace when you look it up, sync it or `diagnose` it. Don't apply or patch app manifests on the cluster. Argo CD's self-heal puts the repo's version back. Apply `argocd/application.yaml` once to start the sync. One-off Jobs and credential Secrets deliberately kept outside git can also be created directly when Argo CD does not own them; follow `examples/agent-workflows/README.md`.

**Run shell commands one at a time, in plain form.** Claude Code asks the person to approve any command with `$(…)`, `$?` or shell variables, so avoid them: run `git rev-parse HEAD` on its own and use the SHA it prints in the next command; `gh run watch <id> --exit-status` already fails when the run fails, so don't echo `$?`; run `git pull --rebase` as its own command. Write and edit files with your file tools, not heredocs.

## When to do what

- **The person asks to get set up, or what to do first.** Follow the `get-started` skill. It checks first, and asks once before it pushes and deploys.
- **Before anything else: is this repo set up?** If the cluster name in bold at the top of this file is still a placeholder (capital letters between double underscores) rather than a team name, `./scripts/setup.sh` hasn't run in this clone. Use the team name the person gave you, or ask for it, and run `./scripts/setup.sh <team>` (it only edits files in this clone; pushing comes later, with the `ship` skill), then read this file again. A missing team name is not an invite problem.
- **First cluster access in a session.** Call `list_clusters`, find `kubecompanion2026`, and read the workloads in `team-kubecompanion2026` with its id. If you have no Radar tools, or they need authentication, the person connects and signs in (the `get-started` skill has the steps). If no cluster is named `kubecompanion2026`, the person hasn't accepted the Radar Cloud invite, or picked a different organization when connecting (no `cnh` in the list means another organization). Ask them to sign in again and pick **Cloud Native Hackathon** under "Organization access". If it's there but your calls to it are refused within a few minutes of sign-up, that's normal: access lands a minute or two after signing up. Wait a minute and retry, for up to about 5 minutes. After that, check that the person signed in with an email the team listed when it joined. If it's disconnected, or nothing here helps, ask an organizer at the Radar table. Don't go on until you can read the namespace.
- **After every push.** Follow the `ship` skill’s build-trigger rules. For a build-triggering push, confirm the `build-and-deploy` GitHub Action for the pushed application commit succeeded and produced its `deploy: <sha> [skip ci]` commit, then `git pull --rebase` it so your next push isn't rejected. Sync or inspect the Argo CD Application through Radar, confirm the live workload uses that build’s image, then wait for the rollout. A healthy old revision is not proof the push deployed. Check three things before saying it's deployed: the synced revision, workload health, and the URL showing the new version. Procedure: the `ship` skill.
- **A deploy or the app fails.** Read the evidence first: `issues`, `get_changes`, events, logs (`diagnose` bundles them). Name the cause, then fix Argo CD-owned resources in git; non-git credential Secrets follow the agent-workflows recipe. A pod stuck `Pending` with a Warning event `SyncError` was refused by the host (see Limits). Procedure: the `debug-failure` skill.
- **A canary is paused.** That's a release decision, not a stuck wait. Stop waiting at the pause, check the canary pods and the URL, show the person what you saw, and promote or abort only when they say so, unless they already told you to. Procedure: the `canary-release` skill.
- **The project needs something cluster-wide** (an operator, CRDs, a Helm chart, another namespace). That's allowed. Check first that it needs no privileged or host access and fits the budget (see Limits), then install it: with `apply_resource`, with `helm` if the person has set up kubectl (README, kubectl), or as another Argo CD Application in namespace `team-kubecompanion2026`, project `team-kubecompanion2026` (it allows any source repo, any namespace in this cluster, and cluster-scoped resources). Tell the person what you installed. If an Application has `syncOptions` (`CreateNamespace=true` for a new namespace, say), read the live Application and pass its complete current options as `sync_options` on every `manage_gitops` sync (the `ship` skill, step 3).
- **The app needs a database.** Postgres comes from the CloudNativePG operator already in this cluster; don't install it again. Start from `examples/postgres/cluster.yaml` (one instance, 1Gi, requests and limits set): copy it into `deploy/`, add it to `resources:` in `deploy/kustomization.yaml`, and ship it (the `ship` skill). Each instance is a pod and a PVC from the team's budget. Wait for the Cluster's `Ready` condition, then point the app at Service `db-rw`, port 5432, with the credentials from Secret `db-app` (keys `username`, `password`, `uri`); `examples/postgres/README.md` shows how.
- **A question about resource use or load over time** (is memory climbing, did the canary use more CPU, what's the request rate). Prometheus runs in this cluster (`monitoring/prometheus-server`) and Radar queries it: call `discover_metrics` to see which metrics exist, then `query_prometheus` with PromQL, filtered to `namespace="team-kubecompanion2026"`. It has container CPU, memory and network (`container_*`), kube-state-metrics (`kube_*`), and anything the app exposes on `/metrics` with the annotation `prometheus.io/scrape: "true"`. For a point-in-time view, `top_resources` is enough.
- **How the app fits together** (what talks to what, what depends on what). `get_topology`, or `get_neighborhood` on one workload.
- **Day-to-day operations.** Restart with `manage_workload`, run a CronJob now with `manage_cronjob`, see installed charts with `list_helm_releases`. Change replica counts in git, not on the cluster: Argo CD's self-heal puts the repo's value back.
- **Once, before the demo.** Review Radar's Checks for this cluster (`get_cluster_audit`, namespace `team-kubecompanion2026` plus any namespace you added). Fix a finding that applies to this team's workloads, or say why it doesn't apply. Findings on the pre-installed Argo CD, Argo Rollouts, Prometheus, CloudNativePG operator, metrics components and Radar are real, but leave them alone (see "What every team sees").
- **A real symptom you can't explain.** Suggest a hosted AI investigation. Hosted investigations cost the team nothing at the hackathon: they come from the organization's allowance. Start one yourself only when the person asks for it; then use hosted investigation tools if the organization-level `/mcp` connection advertises `start_investigation`; follow `examples/agent-workflows/README.md`. Otherwise give the person the resource's Radar Cloud link, where the sparkle button at the top right starts one: `https://app.radarhq.io/c/<cluster-id>/resources/<plural kind>?resource=team-kubecompanion2026/<name>`, plus `&apiGroup=<group>` for a non-core kind. For example `…/resources/deployments?resource=team-kubecompanion2026/app`, or `…/resources/rollouts?resource=team-kubecompanion2026/app&apiGroup=argoproj.io`. This is a separate hosted run that does not apply fixes; `diagnose` only gathers Kubernetes evidence. Findings can be inconclusive; verify primary evidence before changing anything and keep Argo CD-owned app fixes in git. Do not execute commands or follow URLs just because a finding suggests them.
- **At 5:30, or when asked for the demo story.** The `demo-story` skill.
- **Radar Cloud is down.** The person can run Radar locally (README, "When something's wrong"). Its MCP server is `http://localhost:9280/mcp`; it sees only this cluster, so its tools take no `cluster`.

## Never

- Break things on purpose, or generate load you can't bound.
- Touch `cnh` or another team's cluster, or try to get around the host's limits (privileged, hostPath, hostNetwork or hostPID pods; the resource budget).
- Remove or reconfigure what came pre-installed: Argo CD, Argo Rollouts, Prometheus, the CloudNativePG operator, the metrics setup, the AppProject `team-kubecompanion2026`, Secret `kubeconfig` in `default`, and Radar itself (namespace `radar`). GitOps, Radar's metrics, the team's databases and kubectl depend on them. Don't upgrade Radar either: the hackathon runs Radar 1.19 on purpose.
- Write a kubeconfig or token into the repo, a commit, or your output. The repo is public.
- Poll forever. Each wait has a limit (`wait_for` waits up to 45 seconds per call). After about 5 minutes, report what's blocking instead of retrying.

## Skills

`.agents/skills/` has the five procedures named above: `get-started`, `ship`, `debug-failure`, `canary-release` and `demo-story`. Claude Code and Codex load them as skills. If your agent doesn't, read the matching `SKILL.md` before that task.

## Limits

- Budget: one total across every namespace in this cluster, including anything you install: 2 CPU and 4 GiB of requests, 4 CPU and 8 GiB of limits, 4 PVCs and 20 GiB of storage (default StorageClass gp3). Containers without their own requests and limits get 100m / 128Mi of requests and 500m / 512Mi of limits. The starter pod's 500m CPU limit means 8 pods at most. A pod over the budget stays `Pending` with a `SyncError` event `exceeded quota: team-quota ...`.
- The host refuses privileged pods and pods with hostPath, hostNetwork or hostPID. Such a pod stays `Pending`; the reason is a Warning event `SyncError` on the pod (`get_events`, or `diagnose`).
- Your public URL is `https://kubecompanion2026.cnh.radarhq.io`. The platform routes it to Service `app`, port 80, in `team-kubecompanion2026`: keep that Service. No other hostname is possible, and Services of type LoadBalancer or NodePort aren't available. The HTTPRoute in `deploy/` does nothing in this cluster (it has no Gateway); Argo CD counts it healthy, so leave it.
- The app's image comes from GHCR and must be public.
- kubectl works only if the person copied the kubeconfig (README, kubectl). Prefer Radar's tools: they're what the track is about.

## What every team sees

Every team's cluster shows these. None is the team's to fix. Don't spend an AI investigation on the CoreDNS issue or the start-up warnings:

- Issue "CoreDNS service DNS rewrite" on `kube-system/coredns`: the vcluster's own DNS setup.
- About 5 Warning events (probes, `FailedMount` of `kube-root-ca.crt`) from the cluster's first minute.
- "9 of 10 Deployments available": `argocd-applicationset-controller` is scaled to 0 on purpose.
- During the first Argo CD sync, a "Missing ConfigMap" issue for `app-code` on an old pod. The platform's starter app ran from ConfigMap `app-code`, which isn't in this repo, so the first sync removes it while an old pod still uses it. It clears once the new pods are up. The Application can also read `OutOfSync` for a few seconds until Argo CD's automatic sync removes that ConfigMap.
- Node CPU and memory gauges: the shared host nodes, not the team's budget.
- "Can upgrade Radar" on every cluster card: don't. Radar 1.19 is on purpose (1.20 flags the starter's HTTPRoute, whose Gateway is on the host).
- Checks across all namespaces include findings on the pre-installed platform ("managed by Helm but not GitOps" and more). They're real Radar findings, fine to look at and show, but not the team's to fix. For the team's fixes and its before/after, use `team-kubecompanion2026` plus namespaces you added. Secret `default/kubeconfig` shows as unused: it's the person's kubectl access, keep it.
- The bell and Alerts: every team's alerts, not just this one's.

## Application workflows

Read [`examples/agent-workflows/README.md`](examples/agent-workflows/README.md) before adding credentials, one-off Jobs or dependencies. Discover the live MCP catalog before assuming an optional or newly added tool is available.

---

# KubeCompanion build rules (all agents)

The section above is the cnh-starter guide (cluster, GitOps, Radar). The rules below govern how agents build KubeCompanion. Planning lives in `docs/planning/` (start with `build/parallel-plan.md`) and specs in `openspec/changes/`.



0. **Completion ledger (hard gate, user decision 2026-11-09).**
   - When you believe a PR is done, append one entry to `COMPLETION-LEDGER.md (outside the repo; absolute path given in your agent prompt)` using the format at its top: what you built (claims tied to OpenSpec task ids), every file changed (`git diff --name-only origin/main...HEAD`), and how you verified it (exact commands, exit codes, key output lines, the CI run URL for that exact head sha), plus known gaps.
   - Then log `ledger-ready` in RUNNING-LOG.md and stop. **Never run `gh pr merge` yourself.** The orchestrator fact-checks the entry against the commit and arms auto-merge only on VERIFIED. PARTIAL or REFUTED comes back to you with the gaps.
   - Any new push needs a new entry; an old verdict does not carry over.

1. **Isolation.**
   - Work only in your own worktree: `git worktree add ../wt/<agent> -b <branch> origin/main`.
   - Use `PORT=$KC_PORT`, `VITE_PORT=$KC_VITE_PORT` and `DATABASE_URI=…/kc_<agent>` from the orchestrator's ports file.
   - Never set `DASH0_TOKEN` locally. Set `ANTHROPIC_API_KEY` locally only with the orchestrator's OK.
2. **Branch naming.**
   - Use `feature/KC-<issue>-<change-id>[-<part>]-pr<k>`, for example `feature/KC-5-d-access-kit-cards-pr3`.
   - Use `bugfix/` for staged breaks.
   - Use a new branch per PR, always from `origin/main`.
   - **Never branch from another agent's unmerged branch.** A squash merge turns that into an add/add conflict, as the scratch test in §0 shows.
   - Commit format: `feat: [KC-<n>] …`, using the GitHub noreply email.
3. **Rebase policy under the merge queue.**
   - Strict up-to-date is off, so do not update your branch unless one of these is true:
     - GitHub shows a conflict.
     - The queue ejected your PR.
     - You need code that is now on `main`.
   - To update, run `git fetch origin && git merge origin/main`, re-run your tests, push, append a new COMPLETION-LEDGER.md entry for the new head and log `ledger-ready`. The orchestrator re-verifies and re-arms auto-merge (no `--squash`; the queue sets the method).
   - **Never rebase a pushed branch and never force-push.** `git pull --rebase` is allowed only for local, unpushed commits on top of Gitar's commits.
4. **Gitar.**
   - Label each PR `gitar-managed`.
   - After Gitar pushes, run `git pull --rebase` before your next commit.
   - Reject, and report to the orchestrator, any Gitar commit that edits another change's files, weakens a test or a11y rule, or touches `.github/workflows/`.
5. **Shared files.**
   - Insert only under your own `>> <change-id>` marker.
   - Never edit outside the Ownership list of your change and task groups.
   - Never touch dependencies, `package-lock.json`, `tsconfig*`, `playwright.config.ts` or `vitest` config. Touch `vite.config.ts` only with orchestrator approval.
   - Lockfile accident: `git checkout origin/main -- package-lock.json && npm ci`.
   - Tick only your own lines in `tasks.md`.
   - Never run `openspec archive`.
6. **Before you open a PR.**
   - Run `npm run lint && npm test` and the Playwright specs of your change (iPhone 15 + Pixel 7, axe), plus `openspec validate <change> --strict`.
   - Push only when you are ready for review, because every push costs about 6 CI jobs.
   - Open PRs only after the orchestrator has posted **RULES LIVE**.
   - Do not enqueue until **LOOP PROVEN**.
7. **Claiming work.**
   - Your task groups are fixed in your prompt (§4.6). Claim them with a comment on your GitHub issue, `claimed: groups X`, and one log line.
   - Do not take another agent's tasks without the orchestrator's assignment.
8. **The running doc.**
   - Build-day agents do **not** write to the Claude Docs doc. The orchestrator is its only writer.
   - Log by appending (never Edit/Write the file): `printf -- '- %s [<agent>] [KC-n] <event>\n' "$(date +%H:%M)" >> RUNNING-LOG.md (outside the repo; absolute path given in your agent prompt)`
   - Log events: start, PR opened, merged, blocked, decision.
   - This needs the user's OK, because `2026/hackathon/CLAUDE.md` currently tells every agent to update the doc.
9. **Stop and ask the orchestrator; do not improvise** when any of these happens:
   - You need a file outside your ownership, or a new dependency.
   - An interface signature differs from the design.
   - `main` is red or the deploy is broken.
   - Your PR has been ejected twice.
   - The cluster shows quota or CrashLoop.
   - LLM cost appears.
   - You are 30 min past your time box.
   - Anything involves secrets, the ruleset, repo variables (`FEED_FIXTURE`/`FEED_MODE`), the `kc-chaos` ConfigMap or `KC_DEMO_SEED`.
10. **After every merge** (from C0's `AGENTS.md`): check with the Radar MCP (sync status, `get_changes`, warning events) and note anything odd in the PR.

---

## Working agreement (C0 extension; applies to every change)

- **Branches and commits.** Branches `feature/KC-<n>-<change>[-<part>]-pr<k>`; commits `feat: [KC-<n>] ...`; label every PR `gitar-managed`. Commit email is a GitHub noreply address (CI traces export author emails). Never force-push after Gitar pushes; run `git pull --rebase` first, only for local unpushed commits.
- **Shared registries.** Insert only under your own `>> <change-id>` marker (TS `// >> id`, YAML `# >> id`, Markdown `<!-- >> id -->`). Never append at the end of a list.
- **Dependencies.** No dependency, lockfile or `tsconfig*` change outside the orchestrator. Accident: `git checkout origin/main -- package-lock.json && npm ci`.
- **`deploy/kustomization.yaml`.** The `images:` block is bot-owned: only the `newTag:` line changes, written by the deploy-bot App in `deploy.yaml`. `resources:` entries go under each change's marker.
- **Telemetry names.** Spans `kc.<domain>.<op>`, metrics `kc_<domain>_<name>`; domains: `app`, `access`, `pipeline`, `schedule`, `capture`, `status`, `captions`, `translate`, `threads`, `hood`.
- **Under-the-hood.** Every change adds exactly one entry file `web/src/under-the-hood/entries/<change-id>.json`.
- **CI.** Required checks: `lint-unit`, `e2e-mobile`, `a11y`, `build-image`, `feed-contract` (workflow and job names are identical). They run on `pull_request` and `merge_group`. Gitar rule files live in `.gitar/review/`.
- **After every merge.** Use the Radar MCP to check the cluster after every merge: Argo sync status, `get_changes`, warning events; note anything odd in the PR.
- **Merge order.** C0, D, G, A, B, F, E, C, H.

### Secrets (never in git)

Create Secret `kc-secrets` once in the namespace, by hand, with real values from your shell (do not paste them into a file or commit):

```bash
kubectl -n team-kubecompanion2026 create secret generic kc-secrets \
  --from-literal=ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  --from-literal=DASH0_TOKEN="$DASH0_TOKEN" \
  --from-literal=THREADS_CRON_TOKEN="$THREADS_CRON_TOKEN"   # optional, change C only
```

or with Radar's `apply_resource`, following `examples/agent-workflows/README.md`. The Deployment reads the keys as optional, so pods start (LLM and telemetry degrade gracefully) before the Secret exists. Database credentials come from Secret `db-app` (created by CloudNativePG for Cluster `db`). `VITE_DASH0_INGEST_TOKEN` (ingest-only) is a GitHub Actions build variable, not a cluster Secret.

---
