## Why

Kay (hard of hearing, English as a second language, first KubeCon) cannot improvise a day across 600 sessions in two buildings. The Sessionize feed has naive local times and 37 room paths, and a missed time-zone or building change costs Kay a whole session. This change gives Kay a trustworthy personal agenda that warns about the Salt Palace to Hyatt walk and shows heuristic access tags. It is supporting value, not the headline: the core problem is remembering and acting on conversations (B and C; `openspec/config.yaml` `context`), and a note can carry the agenda session it came from.

It scores on:
- Gitar: the venue time-zone rule (`America/Denver` explicit, never parse naive times as UTC).
- Dash0: "My agenda" is the endpoint for the backup slow-down story (Route B in the deep plan).
- Conferences for Everyone: mobility hint and access tags.

## What Changes

- Sessionize ingestion: a startup job plus a CronJob-callable entry point fetch the feed, map it to the `sessions` table (migrations 100-199) and keep the venue zone `America/Denver` as an explicit column.
- `GET /api/sessions` (filter by day, room, track) and a mobile-first Schedule screen.
- `GET/POST/DELETE /api/agenda` keyed by `X-Device-Id`, and a "My agenda" screen.
- Building-change warning for back-to-back sessions across buildings, with a walking buffer.
- Access tags derived from public categories and titles, labelled as heuristic.
- Agenda endpoint honours F's `kc-chaos` flag (latency, error, and an N+1 mode) and is fully traced and measured.
- One Under-the-hood entry `web/src/under-the-hood/entries/a-schedule-agenda.json`.
- Fixture of 60 sessions (titles, times, rooms, tracks only; no speakers) for tests and demo.

## Impact

- New capabilities: `schedule-feed`, `agenda`.
- Depends on C0 (scaffold, telemetry, device id, registries) and D (tokens, i18n).
- F reads feed freshness from `feed_runs`. G's `feed-contract` job validates the same feed shape.
- A wraps G's `api/src/services/sessionize/` baseline (G merges first) in its own `api/src/services/schedule/derive.ts`, never edits G's files, and creates no second fetcher or mapper.
- A imports C0's stub of `api/src/lib/chaos.ts` (F's exported signature) and never creates or edits it; F replaces it.
- No personal data: the speakers array is dropped at ingestion.
