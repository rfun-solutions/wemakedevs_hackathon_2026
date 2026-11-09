# Proposal brief: shared conventions for all 8 OpenSpec changes

Every proposal agent reads this file first. The point is that 8 changes written in parallel fit together when parallel agents apply them tomorrow.

## Product
KubeCompanion is a mobile-first PWA for KubeCon attendees.
- **Demo character:** Kay (they/them), hard of hearing, English as a second language, at their first KubeCon.
- **Tracks:** Gitar and Dash0 are primary; Radar is a stretch; Conferences for Everyone runs throughout.
- **Build window:** 11:00–17:30 on 2026-11-09. Every change must be buildable by ONE agent in roughly 1.5–2.5 hours.

## Change ids, folders, order
| Merge order | Change name (folder under `openspec/changes/`) | Wave | Depends on |
|---|---|---|---|
| 1 | `c0-scaffold` | 0 | – |
| 2 | `d-access-kit` | 1 | C0 |
| 3 | `g-pipeline-feed-contract` | 1 | C0 |
| 4 | `a-schedule-agenda` | 1 | C0 |
| 5 | `b-capture` | 1 | C0 |
| 6 | `f-observability-product` | 1 | C0 (A and B for data) |
| 7 | `e-captions-translation` | 2 | B, D |
| 8 | `c-evening-threads` | 2 | B |

The catalogue of changes, with what each delivers, is in `research/07-deep-plan.md` §1.1. The decisions that override it are in `.scratch/kubecompanion/map.md` "Decisions so far" and in the running doc.

## Stack (recommended; C0 fixes it and the user reviews)
- **Service:** one Node 22 service (`api/`) serving the API under `/api` and the built PWA (`web/`) as static files. Fastify is recommended. Use npm workspaces `api/` and `web/`.
- **Front end:** Vite with Preact (small bundle for phones), TypeScript everywhere.
- **Database:** CloudNativePG Postgres (`db-rw:5432`, as in the cnh-starter example). Use `pg` with plain numbered SQL migrations in `api/migrations/`, with number ranges per change: C0 000–099, A 100–199, B 200–299, C 300–399, E 400–499, F 500–599, D none.
- **Deployment:** cnh-starter base (Dockerfile, kustomize `deploy/`, Argo CD). Service `app` on port 80 → container 8080. Budget is 2 CPU / 4 GiB of requests for everything.

## Cross-change interfaces (do not redefine; consume these)
| Interface | Owner | Contract |
|---|---|---|
| Device identity | C0 | The client generates a UUID and stores it in localStorage. Every API call sends `X-Device-Id`. No accounts |
| Telemetry | C0 | `api/src/telemetry.ts` (NodeSDK, OTLP/HTTP direct to Dash0 us-west-2, `metricReaders: [...]`, pino bridge). Span names `kc.<domain>.<op>`, metric names `kc_<domain>_<name>`. Domains: `app` (C0), `access` (D), `pipeline` (G), `agenda`/`schedule` (A), `capture` (B), `status`/`chaos` (F), `captions`/`translate` (E), `threads` (C). Browser uses `@dash0/sdk-web` with the ingest-only token injected at build, same origin |
| LLM client | C0 | `api/src/services/llm/client.ts`: a thin Anthropic SDK wrapper, Haiku 5.5 by default, model overridable per call. Every call gets a GenAI semantic-convention span (model, tokens in/out, cost estimate, latency). Rate-limited per device. Key from Secret `ANTHROPIC_API_KEY`. E and C consume it |
| Registries (one marker comment per change, pre-written by C0; insert only under your own marker, since plain append-only conflicts in git, verified in parallel-plan.md) | C0 creates | `web/src/routes.ts`, `web/src/nav.ts`, `api/src/routes/index.ts`, `web/src/i18n/<lang>/<change>.json` |
| Design tokens and global CSS | D | `web/src/styles/tokens.css`. Other changes use the tokens and never hard-code colours or sizes. Tokens come from the Impeccable direction the user picks at ~11:05 |
| i18n | D | `t('<change>.<key>')`. Each change adds EN and ES strings for its own keys |
| Speech module | E | `web/src/lib/speech/` exposing `startDictation(onText)` and `startCaptions(onSegment)`. B ships a keyboard-first note field with a dictation button calling a stub `startDictation` that E replaces |
| Notes data | B | Tables `notes`, `people`, `promises`, keyed by `device_id`. C reads notes; E creates notes from caption highlights through B's `POST /api/notes` |
| Schedule data | A | Table `sessions` (venue time zone stored explicitly, America/Denver). `GET /api/sessions` and `GET/POST /api/agenda` |
| Chaos flags | F | ConfigMap `kc-chaos` (app-level latency/error per route), read at runtime. Never cluster-level. G's CI-only `chaos.json` is separate |
| CI jobs (required check names) | C0 defines stubs; G implements `feed-contract` | `lint-unit`, `e2e-mobile` (Playwright iPhone 15 + Pixel 7 viewports), `a11y` (axe), `build-image`, `feed-contract`. Every workflow has top-level `permissions: contents: read` and triggers on `pull_request` and `merge_group` |
| Gitar review rules | C0 | `.gitar/review/external-calls.md`, `time-zones.md`, `accessibility.md` |
| Deploy bot | G (with C0) | A GitHub App via `actions/create-github-app-token@v3.3.0`, with secret `DEPLOY_BOT_PRIVATE_KEY` and variable `DEPLOY_BOT_APP_ID`. It pushes the `deploy:` image-tag commit to protected main and skips its own `deploy:` commits. Add `concurrency:` to avoid races (verified in T6b) |

## Every proposal must include
- `proposal.md`: Why (Kay's struggle plus the track or judging criterion it scores), What Changes, Impact.
- `design.md` when a choice needs explaining: interfaces consumed and provided (from the table above), data, and telemetry (spans, metrics, any SLO candidate).
- `specs/<capability>/spec.md`: requirements with scenarios (OpenSpec `#### Scenario:` format). Mobile scenarios come first.
- `tasks.md`: ordered, small, checkbox tasks. Each includes its tests:
  - unit tests
  - a Playwright mobile test for any UI
  - axe-clean UI
  - EN and ES strings
  - telemetry spans
  Tasks are grouped so the change can land as 1–3 Gitar-reviewed PRs.
- An **Ownership** section listing the files and folders this change creates or edits. It must only append to the shared registries.
- **Out of scope** for this change.

## Hard rules
- No personal data. Use seeded fictional demo data only. The schedule fixture keeps titles, times, rooms and tracks, with no speakers.
- Never put the full-access Dash0 token in the browser. Secrets come only from Kubernetes Secrets.
- Accessibility is required for every UI change: WCAG 2.2 AA, 24 px minimum targets, ARIA live regions for dynamic text, no `div` buttons.
- Do not commit or push. Proposals stay uncommitted in the working copy until after kickoff.
- Run `openspec validate <change-name> --strict` and fix until it passes.
