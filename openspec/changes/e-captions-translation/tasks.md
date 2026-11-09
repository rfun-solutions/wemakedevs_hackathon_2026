## 1. Speech module and engines (PR 1)
- [x] 1.1 Create `web/src/lib/speech/` with `types.ts`, `engine.ts` (`ENGINE_ORDER`, capability check), `index.ts` (`startDictation`, `startCaptions`); unit tests for both orders and fallback
- [x] 1.2 Whisper worker (`whisper.worker.ts`, transformers.js whisper-tiny, WebGPU then WASM), 16 kHz chunker (~5 s), unit test for chunking with a fixture; any `vite.config.ts` change for the worker needs the orchestrator's approval first
- [x] 1.3 Browser speech engine wrapper with restart on end; unit test with a mock
- [x] 1.4 Consent dialog (size, Wi-Fi warning, cancel, localStorage consent); Playwright mobile test; axe clean; EN and ES strings
- [ ] 1.5 Replace C0's speech stub `web/src/lib/speech/index.ts` (same signature); test B's dictation button end to end
- [ ] 1.6 Spans `kc.captions.model_load`, `kc.captions.chunk_decode`; metrics `kc_captions_lag_ms`, `kc_captions_engine_fallback_total`

## 2. Captions screen (PR 2)
- [x] 2.1 Captions route (insert under the `// >> e-captions-translation` marker in `web/src/routes.ts`, `web/src/nav.ts`): start/stop, engine label, large type from D tokens, ARIA live region; pre-write a `{/* >> e-captions-translation-translate */}` marker on the Captions screen where E2 mounts the Translate toggle (one line)
- [ ] 2.2 "Save as note" per line via B's `enqueueNote({ body, source: 'caption' })` (posts to `POST /api/notes`, offline-queued); span `kc.captions.highlight_to_note`
- [ ] 2.3 Playwright (iPhone 15 and Pixel 7 viewports) with a fake audio source; axe; 24 px targets; EN and ES strings
- [ ] 2.4 (Added 2026-11-09, user: Field Notes parity) "Insert time mark" on the captions screen: one tap adds a marker line with the venue time (HH:MM:SS, America/Denver) to the live transcript and saves a note `[mark HH:MM:SS] <last caption line>` via `enqueueNote({ body, source: 'caption' })`; works offline (queued); unit test for the mark text, Playwright test with the fake audio source; EN and ES strings (`captions.mark.*`); 24 px target, announced in the live region

## 3. Translation (PR 2 or 3)
- [ ] 3.1 Client translator in `web/src/lib/translate/`: detect Chrome `Translator`, bind a single handler, user-gesture create; unit test one call per segment. After E1's PR 2 merges, mount the Translate toggle with one line under the `e-captions-translation-translate` marker on the Captions screen
- [ ] 3.2 `api/src/routes/translate.ts` (register under the `// >> e-captions-translation-translate` marker in `api/src/routes/index.ts`): validation, C0 `complete()` called exactly as design (15/min `rateLimit`), global daily cap `TRANSLATE_DAILY_CAP` (default 2000 per replica, Denver-day reset, 503 `daily_cap`, `kc_translate_capped_total`), `kc.translate.request` span, `kc_translate_total`; unit tests for 200, 400, 429, cap reached, cap reset at Denver midnight, and injection text; the client keeps the original line and shows `translate.unavailable` on 503
- [ ] 3.3 Confirm F's load-script guard already refuses `/api/translate` (no edit to F's file); note it in the PR description (no README edit)
- [ ] 3.4 Playwright test of the server path with a stubbed route; EN and ES strings in `web/src/i18n/{en,es}/translate.json` (keys `translate.*`; E2's own file, never `captions.json`)

## 6. Adaptive captions (D2 client half; PR 1 or a small PR 4)
- [x] 6.1 `web/src/lib/speech/sli.ts`: lag measurement per engine, slow streak of 3 at 4000 ms, one switch per session, `kc_captions_engine_fallback_total{reason=slow}`; unit tests: 2 slow then fast (no switch), 3 slow (switch), no alternative (message only), no second switch
- [x] 6.2 Batching reporter (10 s, and on stop and `pagehide` via `fetch(url, { method: 'POST', keepalive: true, headers })` so `X-Device-Id` is sent; `navigator.sendBeacon` cannot set headers and C0's device plugin would return 400; max 20 samples); unit tests with fake timers, including that the flush request carries `X-Device-Id` and `keepalive: true`
- [x] 6.3 `api/src/routes/captions.ts` `POST /api/captions/sli` (register under the `// >> e-captions-translation` marker in `api/src/routes/index.ts`): validation, 6/min per-device limit via C0's `api/src/lib/rateLimit.ts` (no new dependency), histogram `kc_captions_segment_ms{engine,device_class}`, span `kc.captions.sli_report`; unit tests for 204, 400 (bad engine, too many samples, out of range), 429, and no device id on the metric
- [x] 6.4 `web/src/lib/speech/health.ts`: start-engine pick from F's `/api/status/health` with 1.5 s timeout; unit tests for faster engine capable, not capable, 404, timeout, `unavailable`
- [ ] 6.5 Captions screen messages in the live region (`captions.sli.*`), EN and ES, plain language; Playwright (iPhone 15, Pixel 7) with a fake slow engine showing the switch message and with a stubbed health response showing "slow for everyone"; axe clean

## 4. Wrap-up
- [x] 4.0 Add your registry entry: `web/src/under-the-hood/entries/e-captions-translation.json` (captions, highlight-to-note, translation, adaptive engine switch; tech: `kc_captions_segment_ms` with `live: promise:P1`, `POST /api/translate` with `live: promise:P5`, GenAI span, Gitar rules IN-10 and IN-12, G's CAP-1) with `captions.hood.*` EN and ES (E1 writes it; E2 adds nothing)
- [ ] 4.1 Run the full E test set and `openspec validate e-captions-translation --strict`
- [x] 4.2 Record the T4 results (desktop Chrome and iPhone Safari) in the `ENGINE_ORDER` comment

## 5. iOS path (decided after T4, 2026-11-08)
- [x] 5.1 `platform.ts` detection (ios incl. iPadOS touch Mac, desktop-chromium, other, standalone) and platform-aware `ENGINE_ORDER`; hide the Whisper option and never create the worker or download the model on iOS; unit tests with user-agent fixtures, including a test that iOS never calls the model loader
- [x] 5.2 The Home Screen PWA uses the speech API like Safari (verified 2026-11-08): standalone iOS uses the same engine path as Safari; no notice, button or copy-link. Unit test on detection that standalone iOS yields `['webspeech']`
- [x] 5.5 Auto-restart on `onend` while captions are on (backoff 250 ms to 4 s, give up after 5 empty restarts), `kc_captions_restart_total{engine}` plus span event `kc.captions.restart`; unit tests with a fake `SpeechRecognition` (restart, backoff, no restart after stop, give-up, counter)
- [x] 5.6 Early mic permission on an explicit "Turn on captions" tap with plain-language EN and ES copy (`captions.mic.*`); unit test that permission is requested before `start()` and that denial shows a plain message
- [x] 5.7 Measure latency to first word from `audiostart`, not `start()`; unit test with the fake `SpeechRecognition` (delayed `onaudiostart`)
- [x] 5.3 Typed-caption mode (text field feeding the same live region) for platforms with no engine; Playwright test
- [ ] 5.4 Demo script: live captions with the engine switch on desktop Chrome (presenter laptop); the iPhone shows speech-API captions

## Split (two agents from the start; parallel-plan §4.6)
E is large (worker, chunker, consent, captions, adaptive captions and translation):
- **E1** (from 12:50) does groups 1, 2, 6 and 4. It owns `captions.json` and the `e-captions-translation` markers.
- **E2** (from about 14:20) does group 3 (translation). It touches only `api/src/routes/translate.ts`, `api/src/services/translate.ts`, `web/src/lib/translate/`, `web/src/i18n/{en,es}/translate.json`, and one line under each `e-captions-translation-translate` marker (`api/src/routes/index.ts`, and the Captions screen mount after E1's PR 2 merges).

## Ownership
Creates: E1: `web/src/lib/speech/**` (including `sli.ts` and `health.ts`), `web/src/under-the-hood/entries/e-captions-translation.json`, `web/src/pages/captions/**`, `web/src/i18n/{en,es}/captions.json`, `api/src/routes/captions.ts` (`POST /api/captions/sli`). E2: `api/src/routes/translate.ts`, `api/src/services/translate.ts`, `web/src/lib/translate/`, `web/src/i18n/{en,es}/translate.json`. Matching tests. Consumes but never edits F's `GET /api/status/health`, C0's `rateLimit.ts` and `complete()`.
Inserts under its own markers only: `web/src/routes.ts`, `web/src/nav.ts` (`e-captions-translation`), `api/src/routes/index.ts` (`e-captions-translation` for E1, `e-captions-translation-translate` for E2). Replaces: C0's speech stub `web/src/lib/speech/index.ts` (same signature). No README edit; `vite.config.ts` only with orchestrator approval.
Migrations: range 400-499 reserved, none used.
