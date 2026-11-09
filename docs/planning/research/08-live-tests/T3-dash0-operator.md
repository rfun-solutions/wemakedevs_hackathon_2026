# T3: Dash0 operator vs event-cluster restrictions: NOT RUN (2026-11-08)

Skipped by instruction (no new software). Blockers found:
- Docker is running, Docker Desktop VM has 7.65 GiB, 12 CPUs (enough for the ~4 GB mirror).
- None of `kind`, `k3d`, `minikube` is installed, so `cnh-starter/scripts/local-cluster.sh` cannot build the mirror cluster.
- The current kubectl context is a real CHG EKS cluster (`common-nonprod`); nothing was run against it.

To-do for the user: approve installing `k3d` (e.g. `brew install k3d`) or `kind`, then re-run T3 (ValidatingAdmissionPolicy denying hostPath/hostPort/hostNetwork/privileged, 2 CPU / 4 GiB quota, Dash0 operator helm install, then the 100m/256Mi collector fallback).
Operator install values to use: region us-west-2: API `https://api.us-west-2.aws.dash0.com`, OTLP gRPC endpoint from Settings > Endpoints (the ingress host is `ingress.us-west-2.aws.dash0.com`; gRPC port 4317, to confirm).

---

# T3 RESULTS (run 2026-11-08, afternoon)

Setup: k3d v5.9.0 cluster `t3` (k3s v1.33.6, same image as `cnh-starter`), dedicated kubeconfig (`live-tests/k3d.kubeconfig`, never the default; default context `common-nonprod` untouched). `cnh-starter/scripts/local-cluster.sh` was NOT used: it merges into `~/.kube/config`, switches the current context and needs a Radar Cloud step; I created the cluster directly with `--kubeconfig-update-default=false`. Cluster deleted afterwards. Manifests: `live-tests/t3/`.

Event mimic: ValidatingAdmissionPolicy (cluster-wide, Deny) on pods for hostNetwork, hostPID, hostPath, hostPort, privileged (verified it denies a hostNetwork pod). ResourceQuota 2 CPU / 4 GiB requests (plus 4 / 8 limits, my addition) in `team-t3`, and the same requests quota in `dash0-system` (the real budget spans namespaces). Operator 0.159.0, `dash0Export` via `secretRef` (token from a Secret works).

## Operator verdict: the telemetry collectors are NOT admitted; fall back to the collector Deployment
| Install | Result |
|---|---|
| Default (`dash0Export` enabled, secretRef) | Helm succeeds. Controller (`operator-controller`, 1 pod) runs. **Agent DaemonSet denied**: `ValidatingAdmissionPolicy ... denied request: hostPath volumes are denied`. Its pod needs 3 hostPath volumes (`/var/log/pods`, `/var/lib/docker/containers`, `/` for hostfs) plus hostPorts 40317/40318. **Cluster-metrics-collector Deployment** (no host access) is also not created: `failed quota: must specify requests.cpu for: configuration-reloader,opentelemetry-collector` (the chart sets memory requests only, no CPU requests). Needs a LimitRange default or the event's quota setup to supply CPU; unknown there. |
| `operator.collectors.disableHostPorts=true` | Fixes hostPort only. DaemonSet still denied on hostPath. No chart value removes the hostPath mounts. |
| `operator.telemetryCollectionEnabled=false` | Only the controller runs (50m CPU / 128 Mi requests), no collectors. Usable only for as-code CRDs (`Dash0View`, `Dash0SyntheticCheck`, `PersesDashboard` sync, check rules): untested beyond install, and no telemetry flows. |

Only the first violation is reported per pod (hostPath), so hostPort/privileged are not separately confirmed from the operator. Operator footprint: controller about 50m / 128Mi; the collectors add ~500Mi each memory request (DaemonSet 500Mi + reloader/sync containers; metrics collector 500Mi+12Mi).

## Fallback verified: otel-collector-contrib Deployment
`otel/opentelemetry-collector-contrib:0.141.0`, 100m / 256Mi requests (limits 500m / 512Mi), OTLP in (4317/4318), `otlphttp` exporter to `https://ingress.us-west-2.aws.dash0.com`, `Authorization: Bearer ${env:DASH0_TOKEN}` from a Secret. Admitted by both policy and quota. Test load: telemetrygen (not a real app) service `kc-t3-gen`: 200 traces (800 spans), 100 logs, metrics, over gRPC to the collector.
- **Arrived in Dash0** (API, us-west-2): 800 spans and 100 logs for `kc-t3-gen`. Operator's own logs also showed up (`operator-manager`, self-monitoring).
- **Collector memory**: idle ~31 MiB, ~51 MiB working set under that load (3 to 5 mCPU). 256Mi request is ample; `memory_limiter` set at 200 MiB.
- Quota gotcha: with a limits quota every container (including jobs) must set limits, else `must specify limits.cpu`. Check whether the real quota covers limits.

Recommendation: plan T2 (collector Deployment) or T1 (SDK direct); do not count on the operator's collectors. Cost of the collector is about 0.1 CPU / 256Mi of budget.
