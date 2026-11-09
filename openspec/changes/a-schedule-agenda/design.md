## Context

Feed schema (research T5): `sessions[]` with naive `startsAt/endsAt`, `roomId`, `categoryItems`; `rooms[]` with `" | "` paths; `categories[]`. Service sessions are not flagged, so filter by title/room. G's mock upstream may drift the shape (`starts_at`); the mapper must fail loudly, not silently.

## Interfaces consumed

- C0: `X-Device-Id`, `api/src/telemetry.ts`, route registry `api/src/routes/index.ts`, `web/src/routes.ts`, `web/src/nav.ts` (A inserts under its `>> a-schedule-agenda` marker), `web/src/i18n/<lang>/schedule.json`, migrations 100-199.
- D: `web/src/styles/tokens.css`, `t('schedule.<key>')`. No hard-coded colours or sizes.
- F: ConfigMap `kc-chaos`, read through `getChaos('agenda')` from `api/src/lib/chaos.ts`. F owns both the ConfigMap and the real reader. C0 ships a stub with exactly F's exported signature, which always returns `DEFAULT_CHAOS`; A only imports it, and F replaces the file. A keeps the key `agenda`: `{ latencyMs, errorRate, naive }`.

  ```ts
  // api/src/lib/chaos.ts — the one chaos reader. C0 ships a stub with exactly these exports
  // (getChaos always returns DEFAULT_CHAOS); F replaces the file.
  export type ChaosFlags = { latencyMs: number; errorRate: number; naive: boolean };
  export const DEFAULT_CHAOS: ChaosFlags; // { latencyMs: 0, errorRate: 0, naive: false }
  export function getChaos(key: string): ChaosFlags; // missing file, key or bad JSON -> DEFAULT_CHAOS; never throws
  ```
- G: `api/src/services/sessionize/` (`fetchFeed`, `mapFeed`, `MappedSession`, `schema.json`), created by G, which merges first. A never edits G's files: `api/src/services/schedule/derive.ts` wraps `mapFeed` and adds the derived fields, and `schedule/ingest.ts` calls `fetchFeed` and `derive.ts`. This keeps the Gitar on-stage feed fix diff in `mapper.ts` free of A's code. A creates no second schema, mapper or fetcher. A adds no retry and no v2 handling, because those are the Gitar demo fixes. Tests reuse G's fixture `feed-contract/fixtures/sessionize-v1.json` (60 sessions).

## Interfaces provided

- Table `sessions`, `GET /api/sessions`, `GET/POST/DELETE /api/agenda`, table `feed_runs` (last success time, row count, status) for F's freshness display.

## Data

- `sessions(id text pk, title, description, starts_at timestamptz, ends_at timestamptz, venue_tz text default 'America/Denver', building, level, room, room_raw, track, audience_level, is_service bool, access_tags text[], updated_at)`.
- `agenda_items(device_id uuid, session_id, added_at, pk(device_id, session_id))`.
- `feed_runs(id, started_at, finished_at, status, session_count, error)`.
- Conversion: parse the naive string as wall time in `America/Denver` using `Intl` plus a small helper (no new dependency), store as UTC `timestamptz`. API returns ISO with offset plus `venue_tz`. Test across the DST boundary (2026-11-01 is already past; test the helper against both MST and MDT dates so it is not hard-wired to an offset).
- Room mapping: building = first segment; level = second segment only if it starts with "Level"; room = remainder. Handles 1-, 2- and 5-6-part names.
- Service sessions (Registration, Coat + Bag Check, etc.) flagged `is_service` by title/room pattern and hidden from the default list.

## Ingestion

`api/src/services/schedule/ingest.ts` exports `runIngest()`. It runs once at startup (non-blocking, after DB ready) and via `node dist/jobs/ingest.js` for a Kubernetes CronJob (every 30 min, `deploy/cronjob-ingest.yaml`). Upsert in one transaction; a failed validation leaves old rows and records `feed_runs.status='error'`. `FEED_URL` env var, default the Sessionize URL; tests use the fixture. The fetch goes through G's `fetchFeed` (timeout 10 s, deliberately no retry until the demo fix adds it), as `.gitar/review/external-calls.md` requires. No PII is logged.

## Building-change warning

Pure function `buildingWarnings(items)`: for consecutive agenda items on the same day where buildings differ and neither is empty/unknown, gap = next.start - prev.end. Walking buffer constant `WALK_MINUTES = 10` (assumption, configurable via env; no machine-readable venue map exists). Warning level: `tight` if gap < buffer, `ok` otherwise (still informational). Off-site, "Room TBD" and the Hyatt lobby are treated as unknown building (no warning). Returned inline on `GET /api/agenda` as `warnings[]`.

## Access tags (heuristic, labelled as such)

Derived from public categories and title/description keywords: `novice-friendly` (Audience Level contains Novice/Beginner), `demo-heavy` (keywords demo, hands-on, workshop, live), `qa-heavy` (panel, fireside, AMA, Q&A), `jargon-light` (novice level), `captions-unknown` (always; honest default). The UI shows "Estimated" next to the tags.

## Chaos and N+1 (Dash0 demo)

`GET /api/agenda` reads flag `agenda` from `kc-chaos` via `getChaos('agenda')`: `{ "latencyMs": 0, "errorRate": 0, "naive": false }`. When `naive=true` the handler fetches each agenda item's session with a separate query (N+1) instead of one join, producing many `pg.query` child spans. Default is off so normal operation is the single-join path; the fix is flipping the flag or removing the naive branch. Never cluster-level chaos.

## Telemetry

- Spans: `kc.schedule.ingest` (attrs: feed.sessions, feed.status), `kc.schedule.sessions_list`, `kc.agenda.get` (attrs: agenda.items, agenda.naive, db.queries), `kc.agenda.add`, `kc.agenda.warnings`.
- Metrics: `kc_agenda_request_ms` (histogram), `kc_agenda_db_queries` (histogram per request), `kc_schedule_ingest_runs_total{status}`, `kc_schedule_feed_age_seconds` (gauge), `kc_agenda_items` (gauge/updown).
- SLO candidate: `kc_agenda_request_ms` p95 < 400 ms.

## Risks

- Real feed shape could drift: mapper validates required fields and records an error rather than writing partial data.
- 10-minute walk is an assumption: documented in the UI ("about 10 min between buildings, estimated").
