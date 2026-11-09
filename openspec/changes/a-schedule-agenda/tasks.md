## 1. Data and ingest (PR 1)
- [x] 1.1 Migrations `api/migrations/100_sessions.sql`, `101_agenda_items.sql`, `102_feed_runs.sql`
- [x] 1.2 Reuse G's fixture `feed-contract/fixtures/sessionize-v1.json` (60 sessions; no speakers); add no second copy
- [x] 1.3 `time.ts`: naive Denver wall time to UTC; unit tests incl. MST and MDT dates
- [x] 1.4 `rooms.ts` mapper (building/level/room, irregular names) with unit tests
- [x] 1.5 `access-tags.ts` heuristics with unit tests
- [x] 1.6 `api/src/services/schedule/derive.ts` wraps G's `mapFeed` and adds the derived fields (building, level and room via `rooms.ts`, UTC instants via `time.ts`, access tags); never edit G's `api/src/services/sessionize/*` files (Gitar's on-stage feed fix edits `mapper.ts`). `ingest.ts` `runIngest()` calls G's `fetchFeed`, then `derive.ts` (no retry, no v2), with validation, transactional upsert, `feed_runs`; drift test; span `kc.schedule.ingest`; metrics `kc_schedule_ingest_runs_total`, `kc_schedule_feed_age_seconds`
- [x] 1.7 Startup hook, `jobs/ingest.ts` entry and `deploy/cronjob-ingest.yaml` (every 30 min; no secrets needed), listed under the `# >> a-schedule-agenda` marker in `deploy/kustomization.yaml` `resources:`

## 2. API (PR 2)
- [x] 2.1 `GET /api/sessions` (day, room, track filters, `is_service` hidden) with span `kc.schedule.sessions_list` and tests
- [x] 2.2 `GET/POST/DELETE /api/agenda` keyed by `X-Device-Id`; 400 when missing; integration tests
- [x] 2.3 `buildingWarnings()` pure function, `WALK_MINUTES` env, unit tests for tight, ok, unknown
- [x] 2.4 Import `getChaos` from C0's stub `api/src/lib/chaos.ts` (import only; C0 ships it, F replaces it; do not create or edit the file); handler applies the `agenda` flags (latencyMs, errorRate, naive); naive N+1 branch; tests mock `getChaos`
- [x] 2.5 Spans `kc.agenda.get/add`; metrics `kc_agenda_request_ms`, `kc_agenda_db_queries`, `kc_agenda_items`
- [x] 2.6 Register routes under the `// >> a-schedule-agenda` marker in `api/src/routes/index.ts`

## 3. UI (PR 3)
- [ ] 3.1 `web/src/pages/Schedule.tsx` (day tabs, room and track selects, list, add button) using D tokens only
- [ ] 3.2 `web/src/pages/Agenda.tsx` with day groups and building-change warnings (icon + text)
- [ ] 3.3 Insert route and nav lines under the `// >> a-schedule-agenda` marker in `web/src/routes.ts` and `web/src/nav.ts`
- [ ] 3.4 EN and ES strings `web/src/i18n/{en,es}/schedule.json`; ARIA live region for add/remove
- [ ] 3.5 Playwright mobile tests (iPhone 15 and Pixel 7): filter, add, warning shown
- [ ] 3.6 axe check on both screens; verify 24 px targets
- [ ] 3.7 Confirm locally, with `getChaos` mocked, that naive mode yields N+1 `pg.query` spans under `kc.agenda.get`. The end-to-end ConfigMap check is F's task 2.4
- [ ] 3.8 Add your registry entry: `web/src/under-the-hood/entries/a-schedule-agenda.json` (agenda in venue time, building-change warning; tech: Gitar `time-zones.md`, `feed-contract` check, span `kc.agenda.get` with `live: route:GET /api/agenda`, the Agent0 N+1 story) with `schedule.hood.*` EN and ES
- [ ] 3.9 (Added 2026-11-09, user: Field Notes parity) "Jump to now" on `Schedule.tsx` and `Agenda.tsx`: a button that scrolls to and focuses the session in progress, or the next one, in venue time (America/Denver), with a visible "Now" marker; pure function `currentOrNextSession(items, now)` in `api`-free web code with unit tests (during a talk, between talks, after the last talk, empty day); Playwright check on iPhone 15; EN and ES strings in your `schedule.json`. Each agenda item also gets a "Take a note" link to B's capture route with `?session=<session id>` (path read from `web/src/routes.ts`; do not edit B's files)

## Split option (proposed by cross-change review)
If A is behind at about 13:30, a second agent takes group 3 (UI) against the API contract in design.md, while the first finishes groups 1-2.

## Ownership
Creates: `api/migrations/100-102_*.sql`, `api/src/services/schedule/*` (including `derive.ts`, which wraps G's `mapFeed`), `api/src/routes/{sessions,agenda}.ts`, `api/src/jobs/ingest.ts`, `deploy/cronjob-ingest.yaml`, `web/src/pages/{Schedule,Agenda}.tsx`, `web/src/i18n/{en,es}/schedule.json`, `web/src/under-the-hood/entries/a-schedule-agenda.json`.
Imports only (never edits): C0's stub `api/src/lib/chaos.ts` (F replaces it) and G's `api/src/services/sessionize/*`.
Inserts under its `>> a-schedule-agenda` marker only: `api/src/routes/index.ts`, `web/src/routes.ts`, `web/src/nav.ts`, `deploy/kustomization.yaml` (`resources:`, one line).

## Out of scope
- Speaker names, bios or photos; recordings and live URLs.
- Quiet/sensory map (H), notes (B), captions (E), threads (C).
- The `kc-chaos` ConfigMap itself and the Status screen (F); the CI feed-contract job (G).
- Indoor routing or real walking-time data; push notifications for agenda changes.
