## Context
One agent, ~2 h. Consumes C0: `X-Device-Id`, `api/src/telemetry.ts`, registries, `pg` migrations. Consumes D: `tokens.css`, `t()`. Provides notes data to C and E.

## Interfaces provided
`POST /api/notes` body `{ client_id: uuid, body: string (1..4000), source: 'typed'|'dictated'|'caption', session_id?: string, person_ids?: uuid[], created_at?: ISO }` returns `201 { id, client_id, created_at }`. It is idempotent on `(device_id, client_id)`: a repeat returns `200` with the existing row. This makes queue replay safe. E sends `source: 'caption'`.
Other routes: `GET /api/notes?limit&before&session_id`, `DELETE /api/notes/:id`, `POST/GET /api/people` (`{client_id, name, context?, note_id?}`), `POST/GET /api/promises` (`{client_id, text, person_id?, due?, done}`), `PATCH /api/promises/:id` (toggle done). All scoped by `X-Device-Id`; missing header is 400. Seeding has one path, `POST /api/capture/seed`. It is enabled only when `KC_DEMO_SEED=1` and returns 404 otherwise. DECIDED (user, 2026-11-08): the flag is set on the public deployment only for the rehearsal and the demo window, then unset (`kubectl set env deployment/app KC_DEMO_SEED-`); it is never in git. It inserts the fixed fictional data in `api/src/services/capture/seed-data.ts` for the reserved demo device `DEMO_DEVICE_ID = '00000000-0000-4000-8000-00000000ca1e'`, a valid UUID v4 exported from `api/src/services/capture/seed.ts`. It is idempotent through fixed `client_id`s on `(device_id, client_id)`. It sets `created_at` server-side across three Denver days (2026-11-10 to 2026-11-12) so C can thread across days. The data covers at least 12 notes on 3 or more topics (for example service mesh, OpenTelemetry and accessibility), 4 people and 3 promises. C's `npm run seed:threads` calls this endpoint; no other change inserts seed rows.

Client exports in `web/src/lib/capture/queue.ts` (C0 ships a typed stub with these exports, so F and E compile before B merges; B replaces it): `enqueueNote({ body, source, session_id? }): Promise<{ client_id }>` generates the `client_id`, writes to IndexedDB, posts and replays. `getLastSaveMs(): number | null` returns the latest tap-to-durable time. E's "Save as note" calls `enqueueNote({ body, source: 'caption' })`, and F's Status screen reads `getLastSaveMs()`.

## Interfaces consumed
- `startDictation(onText)` from `web/src/lib/speech/index.ts`. The shared signature (E owns it) is `startDictation(onText: (text: string) => void): Promise<SpeechSession>` with `SpeechSession = { supported: boolean; engine?: 'whisper' | 'webspeech'; stop(): void }`. C0's stub resolves `{ supported: false, stop() {} }` and calls nothing; E replaces the file and keeps the signature. B never creates or edits the file. UI hides the button state to "Dictation not available" via aria-live text.

## Data (migration 200-299)
- `notes(id uuid pk, device_id text, client_id uuid, body text, source text, session_id text null, created_at timestamptz, unique(device_id, client_id))`
- `people(id uuid pk, device_id, client_id, name, context, note_id null, created_at)`
- `promises(id uuid pk, device_id, client_id, text, person_id null, due date null, done bool, created_at)`
- Index `(device_id, created_at desc)` on each. No personal data; names are fictional.

## Offline queue
`web/src/lib/capture/queue.ts` over IndexedDB (`idb-keyval` or small hand wrapper). Save flow: write to the queue first (optimistic UI shows the item as "Saved on this phone"), then attempt POST. On 2xx remove and mark "Synced"; on network error or 5xx keep and retry with backoff. Flush triggers: `online` event, `visibilitychange` to visible, app start, and Background Sync tag `kc-capture-flush` in the service worker where `SyncManager` exists. iOS Safari has no Background Sync, so the other triggers are the real path there. 4xx (other than 429) drops the item into a "Needs attention" state, never silently lost.

## Telemetry
- Browser: span `kc.capture.save` from tap to local-queue-write acknowledged (UI "saved"), and a child `kc.capture.sync` for the network leg. RUM via `@dash0/sdk-web`: custom event `kc.capture.saved` with `saved_ms`, `queued` and `online` attributes.
- Server: span `kc.capture.notes_create` (attrs `kc.source`, `kc.idempotent_replay`), metric histogram `kc_capture_saved_ms` (ms, buckets 25,50,100,250,500,1000,2500) recorded from the client-reported `saved_ms` header `X-Capture-Saved-Ms` on sync, and a server-side handler-latency histogram `kc_capture_notes_create_ms`.
- SLO candidate: capture p95 `kc_capture_saved_ms` < 500 ms over 5 min. F owns the check rule and dashboard; B documents the definition only as a code comment block in the metric file; there are no extra docs.
- Decision: "saved" means durable on the phone (queue write), so the SLO holds on bad Wi-Fi and the network leg is reported separately.

## Risks
- iOS Home Screen PWA: no Web Speech, so dictation may be unavailable; keyboard path is always complete.
- Clock skew: `created_at` from the client is accepted but clamped to server now.
