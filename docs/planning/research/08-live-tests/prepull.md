# Docker pre-pull (2026-11-08)

Source of versions: `cnh-starter/Dockerfile` is `FROM node:22-alpine`; `scripts/local-cluster.sh` has `K3S_IMAGE=rancher/k3s:v1.33.6-k3s1`. cnh-starter has no CNPG reference, so postgres uses the CNPG operand image major 18 (assumption, not verified against the event cluster; pull 17 too if needed). local-cluster.sh was NOT run.

| Image | Tag | Size on disk |
|---|---|---|
| node | 22-alpine | 164 MB |
| otel/opentelemetry-collector-contrib | latest | 380 MB |
| ghcr.io/cloudnative-pg/postgresql | 18 | 744 MB |
| grafana/k6 | latest | 70.6 MB |
| rancher/k3s | v1.33.6-k3s1 | 231 MB |
| mcr.microsoft.com/playwright | v1.65.0-noble | 2.53 GB |

All pulls succeeded. (Playwright image matches installed playwright 1.65.0.) Not pulled: the other k3s inner images and Argo/Radar images that local-cluster.sh lists.
