## Why

B is half of the core problem (decided 2026-11-08 evening, `openspec/config.yaml` `context`): at a conference you have more conversations and ideas per hour than you can remember. "I forget every conversation I had an hour ago" is true for every attendee, not only Kay. So capture has to take seconds: a note, a person met, or a promise made ("I'll send you the repo"), typed or dictated, and saved even when venue Wi-Fi drops. Promises are the first half of "take actions later": they are kept with a done toggle, and C turns the week's notes into threads whose actions include these promises.

For Kay (they/them, hard of hearing, English as a second language, first KubeCon) it matters more: Kay cannot reliably catch names and promises in noisy hallways, so writing them down at once is the only record. B delivers Access promise P2: "A note saves in under half a second, or waits safely on your phone and saves later." Scores: Dash0 (SLO candidate capture p95 < 500 ms, RUM on the capture flow, custom span and metric), Conferences for Everyone (voice as an alternative to typing, offline on venue Wi-Fi).

## What Changes

- Add tables `notes`, `people`, `promises` (migrations 200-299), keyed by `device_id`.
- Add `POST/GET /api/notes`, `/api/people`, `/api/promises`. `POST /api/notes` is the contract E calls for caption highlights.
- Add a keyboard-first capture screen (mobile-first, D's tokens) with a dictation button calling `startDictation` from `web/src/lib/speech/`. C0 ships the speech stub and E replaces it; B never creates it. B replaces C0's `web/src/lib/capture/queue.ts` stub.
- Add an IndexedDB offline queue with replay on `online`, app foreground and Background Sync where supported.
- Add span `kc.capture.save`, metric `kc_capture_saved_ms`, SLO candidate (p95 < 500 ms) and RUM on the capture flow.
- Seed fictional demo data for Kay through `POST /api/capture/seed`, the single seeding path; C's `npm run seed:threads` calls it. DECIDED (user, 2026-11-08): `KC_DEMO_SEED=1` is set on the public deployment only during rehearsal and the demo, then unset.
- Add one Under-the-hood entry `web/src/under-the-hood/entries/b-capture.json`.

## Impact

- Affected specs: new `capture-notes`, `offline-queue`, `capture-telemetry`.
- Depends on C0 (scaffold, telemetry, device id, registries). Consumed by C (reads notes), E (creates notes), F (reads the metric).
- Out of scope: see design.md.
