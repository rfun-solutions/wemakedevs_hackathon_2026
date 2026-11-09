# KubeCompanion

**A conference companion for everyone, built first for the attendees who usually get left out.**

At a conference you have more conversations and ideas per hour than you can remember ("I forget every conversation I had an hour ago"). KubeCompanion lets you capture a note, a person or a promise in seconds, and turns your week into threads that end in clear next steps.

For Deaf, hard-of-hearing and ESL attendees, access usually stops at the talk-room door. KubeCompanion carries captions, communication cards and translation into the hallway, the expo floor and the coffee line.

- **Try it on your phone:** https://kubecompanion2026.cnh.radarhq.io
- **How it works, feature by feature:** https://rfun-solutions.github.io/wemakedevs_hackathon_2026/

## Meet Kay

Kay is our design persona: a hard-of-hearing attendee whose first language is Spanish, at KubeCon for the week with a phone and patchy venue Wi-Fi. Every screen is designed and tested for Kay first: on a phone, at 200% text, in high contrast, in English and Spanish, and offline. Kay is a composite, not a real attendee.

## What Kay can do

| Feature | What it does |
|---|---|
| **Your agenda, in venue time** | Browse sessions by day, room and track, and build an agenda. Times show in Mountain time wherever your phone thinks it is, with a warning when a building change between sessions is tight. |
| **Live captions that adapt** | Captions pick the best speech engine for your phone, switch if they fall behind, and tell you when they do. Any caption line can be saved as a note, and one tap marks the time. |
| **Cards, badge and calm places** | Communication cards you show to people ("I'm hard of hearing, please face me"), a badge that never leaves your phone, and a list of quiet places at the venue. All of it works offline. |
| **Evening threads** | Your notes become topic threads that end in clear next steps, with AI when it is available and without it when it is not. |
| **Your language and display** | English and Spanish, larger text, high contrast and a system-font option, all in Settings. |
| **Status, explained plainly** | See whether the app is healthy right now. When something breaks, Dash0's Agent0 explains it in one plain sentence, labelled AI-generated. |
| **Under the hood** | A screen that lists every feature, what it does and the checks behind it, with live values where we measure them and never an invented number. |

<!-- >> c0-scaffold -->
<!-- >> d-access-kit -->
<!-- >> d-access-kit-cards -->
<!-- >> g-pipeline-feed-contract -->
<!-- >> a-schedule-agenda -->
<!-- >> b-capture -->
<!-- >> f-observability-product -->
<!-- >> e-captions-translation -->
<!-- >> c-evening-threads -->
<!-- >> h-under-the-hood -->

## Five promises we hold ourselves to

1. Captions reach your screen within 4 seconds, or we switch and tell you.
2. A note saves in under half a second, or waits safely on your phone and saves later.
3. Every button and screen works with text at 200% and in high contrast.
4. Every card and screen is in your language: English and Spanish.
5. Translation is available, or we tell you plainly that it is not.

Each promise has a live status light backed by a real measurement. A light is never green without data: with no samples it shows grey, "not measured right now". Details and the rules behind each promise: [ACCESS-PROMISES.md](ACCESS-PROMISES.md).

## How we keep those promises

- **Gitar** reviews every pull request against our inclusion and accessibility rules ([`.gitar/`](.gitar/)) and against hot-path rules generated from the app's own speed measurements ([`scripts/rules-from-prod.mjs`](scripts/rules-from-prod.mjs)). It can push fixes, and we keep only the ones that stay inside the change's own files.
- **Dash0** receives OpenTelemetry traces and metrics from every request and real-user monitoring from every phone. The promise lights read from it, and its Agent0 explains incidents to Kay in plain language.
- **Radar** runs and watches the cluster. Argo CD deploys every merge to `main`, and Radar confirms each rollout is healthy before we call it shipped. Radar's AI investigations are how we troubleshoot.
- **Required checks on every pull request and merge-queue run:** `lint-unit` (ESLint, Prettier, Vitest), `e2e-mobile` (Playwright on iPhone 15 and Pixel 7), `a11y` (axe), `build-image` (with a secret-leak guard) and `feed-contract` (the schedule feed must match its schema).

## Built with AI, checked with evidence

KubeCompanion is a solo entry built with AI agents: one orchestrator plus builder agents, each working on one [OpenSpec](openspec/changes/) change in its own git worktree. No pull request merges on an agent's word. Each builder writes what it built and how it verified it in a completion ledger. An independent verifier then re-runs the checks on the change merged with the latest `main`, and breaks the code on purpose to prove the tests catch it. Only then does a pull request enter the merge queue. What AI did and what the human did: [AI-DISCLOSURE.md](AI-DISCLOSURE.md).

## Architecture

- **Web:** a mobile-first Preact app (Vite) that works as an installable, offline-capable PWA. Notes queue on the phone and sync when the network returns.
- **API:** Fastify on Node.js, with Postgres (CloudNativePG) for schedules, notes and threads.
- **Delivery:** one container image built in GitHub Actions and published to GHCR. A deploy bot commits the new image tag, and Argo CD syncs it to the `kubecompanion2026` cluster.
- **Observability:** OpenTelemetry to Dash0, with dashboards, check rules and synthetic checks kept as code in [`observability/`](observability/).

## Run it locally

```bash
npm ci                 # install (workspaces: api, web)
npm run lint           # ESLint + Prettier check
npm test               # Vitest (api and web)
npm run build          # build api and web
npx playwright test    # mobile e2e (iPhone 15, Pixel 7) with axe
docker build -t kubecompanion .
kubectl kustomize deploy/   # render the Kubernetes manifests
```

## Repository map

| Path | What is there |
|---|---|
| `web/` | The phone app: screens, offline queue, captions, translations |
| `api/` | The Fastify API, database migrations, telemetry |
| `deploy/`, `argocd/` | Kubernetes manifests and the Argo CD application |
| `openspec/changes/` | The spec for every feature, written before its code |
| `observability/` | Dash0 dashboards, check rules and synthetic checks as code |
| `docs/runbooks/` | Runbooks for incidents and demo steps |
| `.gitar/` | Gitar review rules |

Built at the [Cloud Native Hackathon](https://www.wemakedevs.org/hackathons/cnh) (WeMakeDevs and Radar), starting from [skyhook-io/cnh-starter](https://github.com/skyhook-io/cnh-starter).
