## Why

Kay (they/them) is hard of hearing, speaks English as a second language, and is at their first KubeCon. Talks are fast and jargon-heavy, and the room mic is the only way in. Kay needs near-live captions on the phone, a way to keep a line worth remembering, and a translation into their own language. This is the access layer on top of the core problem (`openspec/config.yaml` `context`): Deaf, hard-of-hearing and ESL attendees lose access at the talk-room door, and captions plus translation carry it into the hallway. A caption line worth keeping becomes a note in B, so it joins the threads and actions everyone gets. E delivers Access promises P1 ("Captions reach your screen within 4 seconds, or we switch and tell you") and P5 ("Translation is available, or we tell you plainly that it is not"). This scores on Conferences for Everyone (Deaf/HoH and ESL support) and gives Dash0 a traced server path (the translate proxy).

When captions fall behind in a loud room, Kay should not silently lose a sentence. Adaptive captions (D2, client half) measure each chunk on the phone and switch engine after 3 slow chunks, saying so on screen. Chunk timings also go to the server, so F can tell Kay "slow for everyone, not your phone" and start new sessions on the engine that is faster right now.

Judging criteria scored (quoted from research/01 §5):
- Stop Flying Blind: "Observability that's part of the product experience, not bolted on at the end." (the caption SLI changes what Kay's phone does)
- Stop Flying Blind: "Depth of instrumentation across your app, including traces, logs, metrics and real-user monitoring if you have a frontend."
- Stop Flying Blind and Never Merge Broken: "How well your project makes conferences easier."
- Conferences for Everyone has no listed criteria (research/01 §5); Deaf/HoH and ESL support is its core.

Desktop Chrome test T4 showed the browser speech API skips whole sentences and stopped after about 33 s. In-browser Whisper (whisper-tiny, WebGPU) worked best: about 117 MB in 6.1 s, and 4 s from stop to text for 50 s of audio. The Chrome Translator also worked, but only on desktop.

iPhone test (user, 2026-11-08, wayfinder ticket 01): on iPhone Safari the browser speech API in continuous mode works decently well (good accuracy over about a minute, minor errors). In-browser Whisper crashes the page on iOS (likely the per-tab memory limit). The Home Screen PWA (iOS 18.7, standalone) was also tested and the speech API works there too: first word came 7.6 s after audio started, after about 27 s on the first mic-permission prompt, and the session ended after about 12 s with no auto-restart. **The engine order is therefore FINAL and per platform.**

## What Changes

- Add the speech module `web/src/lib/speech/` with `startDictation(onText)` and `startCaptions(onSegment)`. It replaces B's `startDictation` stub.
- Engine order per platform (`ENGINE_ORDER`): iOS/WebKit uses the browser speech API only (Whisper is never loaded or downloaded on iOS and its option is hidden); desktop Chromium uses transformers.js whisper-tiny in a Web Worker (WebGPU with WASM fallback, ~5 s chunks) first, with the speech API as fallback; other browsers use the speech API if available, otherwise a typed-caption mode.
- The Home Screen PWA uses the speech API like Safari (verified 2026-11-08). No Safari notice or handoff is needed.
- Robustness (from the PWA result): auto-restart recognition on `onend` while captions are on, with a small backoff, counted in `kc_captions_restart_total`; mic permission is requested early on an explicit "Turn on captions" tap with plain-language copy; latency to first word is measured from `audiostart`, not `start()`.
- Lazy model load behind a consent dialog that states the size (~117 MB) and warns about venue Wi-Fi. Nothing downloads before consent.
- Add a Captions screen: large type, ARIA live region, and a control to start and stop.
- Highlight a caption line to create a note through B's `POST /api/notes`.
- Translation: Chrome Translator where present; otherwise `POST /api/translate`, which uses C0's LLM client (Haiku 5.5). It is rate-limited (DECIDED by the user 2026-11-08: 15 calls per minute per device, plus a global daily cap `TRANSLATE_DAILY_CAP`, default 2000 calls per replica per Denver day, as a backstop for an open endpoint on a public URL), traced and excluded from the load test. When capped or failing, the line keeps its original text and a plain message says translation is unavailable (rule IN-12, Promise P5).
- Adaptive captions (D2 client): a local SLI counts slow chunks (over 4 s from chunk end to text); after 3 in a row the session switches to the next capable engine once and announces it in the live region (only where the platform has a second engine: desktop Chromium; on iOS there is one engine, so no switch). Chunk timings are batched to `POST /api/captions/sli`, which records the server histogram `kc_captions_segment_ms{engine,device_class}` that F polls and G4 reads. At session start the client asks F's `GET /api/status/health` which engine is faster for everyone right now, and shows "slow for everyone, not your phone" when the shared SLI is breached (this message also applies on iOS).
- Add one Under-the-hood entry `web/src/under-the-hood/entries/e-captions-translation.json`.
- iOS path (decided): speech API only, typed-caption mode as the last resort, Home Screen PWA treated like Safari (see design.md and tasks group 5). The engine-switch demo beat runs on desktop Chrome on the presenter laptop.

## Impact

- Depends on B (notes API, dictation button) and D (tokens, i18n, display modes).
- Consumes F's `GET /api/status/health` (optional at runtime; F merges first) and provides the server histogram `kc_captions_segment_ms` that F's poller and G's `rules-from-prod` read. New route `POST /api/captions/sli`.
- New migration range 400-499 is reserved but unused (captions are not stored on the server).
- Inserts lines under its own markers (`e-captions-translation`, and `e-captions-translation-translate` for the translation agent) in the shared route, nav and API route registries, and adds its own i18n files (`captions.json`, `translate.json`).

## Out of scope

- Speaker labels, diarisation, or storing transcripts on the server.
- Cloud STT through a WebSocket proxy (kept as a post-hackathon option).
- Replacing the conference's official captioning.
- Translating the whole UI (D owns UI i18n).
- Load testing translate.
