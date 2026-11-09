# Resources vault

Quick-reference commands, links and limits for KubeCompanion. Full findings with sources: `research/01`–`06`.
Every agent adds new resources here (see `CLAUDE.md`). Last updated 2026-11-08.

## Radar (stretch track; event cluster is our runtime)
| What | Value |
|---|---|
| Event cluster sign-up | https://join.cnh.radarhq.io (join code at kickoff / Radar table; ~4 min; status at `join.cnh.radarhq.io/status/<team>`) |
| What you get | Own vcluster, cluster-admin. App at `https://<team>.cnh.radarhq.io`. Argo CD, Argo Rollouts, Prometheus, CloudNativePG pre-installed |
| Budget | 2 CPU / 4 GiB requests, 4 CPU / 8 GiB limits, 4 PVCs, 20 GiB. No privileged / hostPath / hostNetwork / hostPID |
| kubectl | kubeconfig in Secret `default/kubeconfig` key `config` (copy via Radar UI); server `https://<team>.vc.cnh.radarhq.io`; token valid 24 h |
| Secrets | Radar Cloud UI or kubectl in namespace; `secretKeyRef`; never in repo/image |
| Lifetime | Clusters and org access end Fri Nov 13 |
| Hosted MCP | `claude mcp add --scope user radar-cloud --transport http https://api.radarhq.io/mcp` → `/mcp` → Authenticate → pick org "Cloud Native Hackathon" |
| OSS Radar (fallback) | `brew install kubectl-radar` or `curl -fsSL https://get.radarhq.io \| sh && kubectl radar`; local MCP `http://localhost:9280/mcp` |
| Starter repo | https://github.com/skyhook-io/cnh-starter (README, AGENTS.md, `deploy/`, `.github/workflows/deploy.yaml`, `argocd/application-byo.yaml`) |
| Local mirror | `scripts/local-cluster.sh <team>` (k3d/kind/minikube, ~4 GB RAM); `--pull` pre-downloads ~500 MB |
| Bring your own cluster | Allowed, counts for judging: own free Radar org (3 clusters, 100 investigations/mo), cluster named `<team>`, drop `httproute.yaml`, use `application-byo.yaml`. Lose public URL + Prometheus |
| Track expectation | At least one AI investigation (an "all clear" after a release counts). Starter says don't break things on purpose |
| Docs | https://github.com/skyhook-io/radar · https://radarhq.io/docs/features/mcp |

## Dash0 (primary track)
| What | Value |
|---|---|
| Trial | 14 days, no card, Agent0 credits included. https://www.dash0.com/sign-up · https://www.dash0.com/pricing |
| **Our org (verified T2)** | Region **us-west-2**. Ingest `https://ingress.us-west-2.aws.dash0.com`, API `https://api.us-west-2.aws.dash0.com`, MCP `https://api.us-west-2.aws.dash0.com/mcp`. `.env` DASH0_TOKEN is **full-access (`*`)**: server-side only (the user OK'd using it there), never in a browser bundle. `.env` **DASH0_INGEST_ONLY** = ingest-only token for browser bundles (web SDK) |
| Web SDK package (verified T2) | `@dash0/sdk-web` 0.30.0 (`@dash0hq/sdk-web` is deprecated) |
| OTel gotchas (verified T2) | `BatchLogRecordProcessor` takes an options object; NodeSDK needs `metricReaders: [...]` (singular is silently ignored → no metrics) |
| Regions | us-east-1, us-west-2 (AWS), eu-west-1, eu-central-1 (AWS), europe-west4 (GCP). Endpoints under Settings > Endpoints |
| MCP | `claude mcp add --transport http --scope user dash0 https://api.us-east-1.aws.dash0.com/mcp` (adjust region) → `/mcp` → sign in. Tools: PromQL/SQL, log+span search, traces, SLOs, dashboards, Agent0 `runTask`/`waitForTask` (uses credits) |
| Agent0 | https://www.dash0.com/docs/dash0/ai/agent0 (can read code, propose PRs) |
| Operator | `helm repo add dash0-operator https://dash0hq.github.io/dash0-operator` then `helm install --wait -n dash0-system --create-namespace --set operator.dash0Export.enabled=true --set operator.dash0Export.endpoint=<OTLP gRPC> --set operator.dash0Export.apiEndpoint=<API> --set operator.dash0Export.token=<token> dash0-operator dash0-operator/dash0-operator`. Auto-instruments Node 16+, Java, .NET; Python/Ruby opt-in; Go manual |
| Operator risk | Collector DaemonSet uses host ports + hostPath; ~1.3–1.5 GiB requests. **Likely refused on event cluster (untested)**. Fallbacks: SDK exports directly to Dash0, or a collector Deployment |
| Operator on event-like cluster (verified T3) | **Not usable**: agent DaemonSet denied (3 hostPaths + hostPorts, no chart value removes them); metrics-collector Deployment fails quota (no `requests.cpu`); `disableHostPorts=true` doesn't help. Fallback verified: `otel-collector-contrib` Deployment 100m/256Mi, ~51 MiB under 800 spans + 100 logs, all in Dash0 |
| `local-cluster.sh` caveat (T3) | Merges into `~/.kube/config` and switches context. The user's default context is a company cluster, so always use a dedicated `KUBECONFIG` |
| Browser RUM | `npm install @dash0/sdk-web` (verify name vs `@dash0hq/sdk-web`); `init({ serviceName, endpoint: { url, authToken } })`. Client tokens public by design (per-site ingest-only token). https://www.dash0.com/docs/dash0/miscellaneous/tooling/web-sdk/overview |
| SLOs | **Private beta**, enabled per org by Dash0, API-only. Ask at kickoff. https://www.dash0.com/docs/dash0/monitoring/alerting/slos |
| Dashboards as code | Perses. https://www.dash0.com/docs/dash0/dashboards/manage-dashboards-as-code |
| Synthetics as code | CRD. https://www.dash0.com/docs/dash0/monitoring/synthetics/manage-synthetic-checks-as-code |
| CI traces | `dash0hq/otel-cicd-action@v4` on `workflow_run` (sends commit author emails unredacted) |

## Gitar (primary track) — see `research/02`
| What | Value |
|---|---|
| Install | GitHub App via app.gitar.ai; 14-day Pro trial (auto-apply is Pro-only) |
| Rules | `.gitar/review/*.md`, plain markdown, `@file` includes |
| Auto-apply | Per PR: comment `gitar auto-apply:on` or label `gitar-managed`; stops after 3 consecutive Gitar commits |
| Verified behaviour (T1, 2026-11-08) | Reviews in ~1 min, fix pushed ~2.5 min after PR open. Fixed schema drift (code) and 429 (retry/backoff); on expired TLS it just reverted `chaos.json`. Never edits `.github/workflows`. Review = PR review "COMMENTED": no status check, does NOT satisfy required approvals. No re-review after a rebase force-push |
| Gitar fixes K8s YAML (verified T8) | Budget break (4608Mi vs 4096Mi): review in 34 s, fix in 51 s (new collector request 1Gi → 512Mi), CI green at about 68 s. Didn't touch the script or rule. Footer "No rules evaluated", so rule use is unproven |
| Rules from production (verified T10) | Deploy-bot pushed `.gitar/review/hot-paths.md` to protected main in 8 s (workflow `rules-from-prod.yml` in pipeline-test-repo). Next PR: inline findings "Per the review rule ..." in about 60 s. Gitar quotes rule sentences, not headers, so numbers must go IN the rule text |
| Org setup (verified T6, rfun-solutions) | Merge queue works on a public free-org repo; CI must trigger on `merge_group`. Use `gh pr merge --auto` (the queue sets the method). Queue overhead about 45 s. GitHub App (actor_type Integration) accepted as ruleset bypass. github-actions app bypass: 422 (repo ruleset); org rulesets need GitHub Team. Test repo `an org test repo`, App `test-deploy-bot-app` (id <test-app-id>), ruleset `main-protection` |
| Deploy-bot App push (verified T6b) | `actions/create-github-app-token@v3.3.0`; secret `DEPLOY_BOT_PRIVATE_KEY` + var `DEPLOY_BOT_APP_ID`; push to protected main lands as `<app>[bot]` ("Bypassed rule violations"); GITHUB_TOKEN push still rejected (GH013). Skip runs whose message starts `deploy:`; add `concurrency:` or `git pull --rebase` (a dispatch raced a push once) |
| Private repo on Free plan (verified T6b) | **No enforcement at all**: rulesets/branch protection APIs return 403 "Upgrade to GitHub Pro or make this repository public"; direct pushes to main accepted; merge queue ignored (`--auto` merges at once). Actions still run. Rules come back intact when made public |
| GitHub limits on a personal repo (T1) | No merge queue (422). github-actions app cannot be a ruleset bypass actor (org-only). Admin-role bypass works. Bot commits to protected main are rejected |
| Docs | https://docs.gitar.ai/quickstart |

## Tooling
| What | Value |
|---|---|
| OpenSpec | Installed 1.15.0, latest 1.16.1 (`npm i -g @fission-ai/openspec@latest`). Commands `/opsx:propose`, `/opsx:apply`, `/opsx:archive`; `openspec validate --strict` |
| mattpocock/skills | Installed. `/research`, `/wayfinder` (then to-spec / to-tickets / implement) |
| Impeccable | Installed. Design skill for the app (mobile-first) |
| Image gen MCP | `shinpr/mcp-image` (Gemini or OpenAI, character consistency) — needs an API key |
| GitHub Actions (verified 2026-11-08) | checkout v7.0.1, setup-node v7.1.0, docker/build-push-action v7.4.0, setup-buildx v4.4.1, login-action v4.8.0, metadata-action v6.2.0, upload-artifact v7.0.2, cache v6.1.0, helm/kind-action v1.15.2 |
| Schedule data | Sessionize public JSON `/api/schedule` (no key; 600 sessions, 37 rooms). Leave speaker bios out of the repo |
