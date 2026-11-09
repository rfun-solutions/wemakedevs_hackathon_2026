## 1. PR 1: data and API
- [x] 1.1 Migrations `api/migrations/200_notes.sql`, `201_people.sql`, `202_promises.sql` with indexes and unique `(device_id, client_id)`
- [x] 1.2 Routes `api/src/routes/notes.ts`, `people.ts`, `promises.ts` with schema validation; register under the `// >> b-capture` marker in `api/src/routes/index.ts`
- [x] 1.3 Spans `kc.capture.notes_create`, histograms `kc_capture_saved_ms` and `kc_capture_notes_create_ms` (SLO comment block)
- [x] 1.4 `POST /api/capture/seed` behind `KC_DEMO_SEED=1`, with `seed-data.ts` and `DEMO_DEVICE_ID` (see design). It is the single seeding path, which C's `npm run seed:threads` also calls. Test idempotence and the 404 when the flag is off
- [x] 1.5 Unit/integration tests: create, idempotent replay, isolation, 400s, `caption` source

## 2. PR 2: capture UI and queue
- [ ] 2.2 Replace C0's stub `web/src/lib/capture/queue.ts` with the real queue (IndexedDB, backoff, flush triggers), keeping the exports `enqueueNote` and `getLastSaveMs` and their types exactly; unit tests using fake-indexeddb. (Former task 2.1, the speech stub, is dropped: C0 ships it and E replaces it.)
- [ ] 2.3 Service worker Background Sync handler `kc-capture-flush` with feature detection
- [ ] 2.4 Capture screen, notes list, quick-add person and promise; native elements, tokens only, live region
- [ ] 2.5 EN and ES strings `web/src/i18n/{en,es}/capture.json`; insert route and nav lines under the `// >> b-capture` marker in `routes.ts` and `nav.ts`
- [ ] 2.6 Browser span `kc.capture.save`, `X-Capture-Saved-Ms` header, RUM event `kc.capture.saved`
- [ ] 2.7 Playwright (iPhone 15 and Pixel 7): type-save, offline-save-then-reconnect, dictation-unsupported, 50-save p95 < 500 ms
- [ ] 2.8 axe check on capture screen
- [ ] 2.9 (Added 2026-11-09, user: Field Notes parity) "From this session": add optional `session_id` query filter to `GET /api/notes` (update the contract in design.md, integration test for filtered and unfiltered lists); the capture screen reads `?session=<id>` and sends it as `session_id` via `enqueueNote({ body, source, session_id })`; the notes list gets a "From this session" filter (using `GET /api/notes?session_id=`) and shows the session id label when present; tests for the query param, the filter and notes without a session; EN and ES strings in your `capture.json`

## 3. PR 3: polish
- [ ] 3.1 "Needs attention" state with Delete and Retry; verify no duplicates after lost response
- [ ] 3.2 Add your registry entry: `web/src/under-the-hood/entries/b-capture.json` (capture in seconds, offline queue, promises; tech: span `kc.capture.save`, `kc_capture_saved_ms` p95 with `live: promise:P2`, Gitar rule IN-11, `api-contract.md` AC-1) with `capture.hood.*` EN and ES
- [ ] 3.3 Write `docs/demo-seeding.md`: `KC_DEMO_SEED=1` is set only for rehearsal and the demo, with the set and unset commands and a check that the endpoint returns 404 afterwards
- [ ] 3.4 Run `openspec validate b-capture --strict` and lint-unit, e2e-mobile, a11y locally

## Ownership
Creates: `api/migrations/200-202*`, `api/src/routes/{notes,people,promises}.ts`, `api/src/services/capture/`, `web/src/lib/capture/` (replaces C0's `queue.ts` stub), `web/src/screens/capture/`, `web/src/i18n/{en,es}/capture.json`, `api/src/services/capture/seed.ts` and `seed-data.ts`, `web/src/under-the-hood/entries/b-capture.json`, `docs/demo-seeding.md`, tests. Inserts under its `>> b-capture` marker only: `api/src/routes/index.ts`, `web/src/routes.ts`, `web/src/nav.ts`. Edits: the Background Sync handler in C0's `web/public/sw.js` (B is its only editor after C0). Uses but never creates or edits C0's speech stub `web/src/lib/speech/index.ts` (E replaces it).

## Out of scope
Real dictation or captions (E), grouping notes into threads (C), dashboards and alert rules (F), accounts, note search, export, attachments, speech/translation, schedule linking beyond optional `session_id`.
