## Context

One agent builds this in about 2.5 h after B and D merge. Test T4 (desktop Chrome 157 and iPhone Safari, 2026-11-08) gave the evidence for the engine order.

## Interfaces consumed

- B: `enqueueNote({ body, source: 'caption' })` from `web/src/lib/capture/queue.ts`, which posts `{client_id, body, source: 'caption'}` to `POST /api/notes` (idempotent on `(device_id, client_id)`, with `X-Device-Id`) and queues offline. Also the dictation button that calls `startDictation`.
- C0: `complete()` from `api/src/services/llm/client.ts`, with the exact signature in c0-scaffold design D3, called as `complete({ op: 'translate.text', deviceId, system, messages: [{ role: 'user', content }], maxTokens: 512, rateLimit: { max: 15, windowMs: 60_000 } })`, which returns `{ text, model, usage, traceId }`. The default model is `claude-haiku-5-5`. `RateLimitedError` maps to 429 and `LlmUnavailableError` to 503. Also `telemetry.ts`, the registries, device identity.
- D: `tokens.css`, `t('captions.*')`, display modes (large type).

## Interfaces provided

- `startDictation(onText: (text: string) => void): Promise<SpeechSession>` with `SpeechSession = { supported: boolean; engine?: 'whisper' | 'webspeech'; stop(): void }`, and `startCaptions(onSegment): Promise<SpeechSession>`. This is the same signature as C0's stub, which E replaces. Both resolve engine, consent and permissions; `stop()` ends the session. `onSegment({id, text, lang, final})`.
- `POST /api/translate` body `{text, source?, target}` returns `{text, source, target}`. Max 1,000 chars per call.

## Decisions

1. **Engine order is platform-aware** in `engine.ts` (`ENGINE_ORDER`, a function of a detected `platform`), FINAL after T4:
   - `ios` (any WebKit on iOS/iPadOS, including iPadOS reporting as Mac with touch): `['webspeech']`. Whisper is NEVER loaded on iOS: the Whisper option is hidden, the worker is not created and the model is not downloaded (T4: the page crashed and reloaded on transcribe, likely the iOS per-tab memory limit).
   - `desktop-chromium`: `['whisper','webspeech']`. Whisper is chosen at runtime only if the device passes a capability check (Worker, `AudioContext`, `getUserMedia`, model loads within 30 s); otherwise the next engine is used and the user sees which one is active.
   - `other` (Firefox, Android non-Chromium and so on): `['webspeech']` if `SpeechRecognition` exists, otherwise `[]`, which selects the typed-caption mode.
   Detection lives in `platform.ts` and is unit tested with user-agent fixtures. Standalone iOS (Home Screen PWA) uses the same `['webspeech']` order as Safari. The Home Screen PWA uses the speech API like Safari (verified 2026-11-08).
2. **Chunking**: a rolling ~5 s window from an `AudioWorklet` (fallback `ScriptProcessor`), resampled to 16 kHz mono, sent to the worker. Each chunk is decoded alone, so captions lag by about 5 s plus decode time. This is near-live, not word-by-word. The UI says so.
3. **Model**: `Xenova/whisper-tiny` (multilingual), cached by the browser cache after first consent. Consent state is kept in localStorage.
4. **Browser speech engine** is the only engine on iOS and the fallback on desktop Chromium. It skips sentences on desktop Chrome (T4) but worked decently on iPhone Safari, so the UI labels it "may miss words".
5. **Translation**: feature-detect `Translator` and `LanguageDetector` on the main thread (not in workers; `create()` needs a user gesture, so the Translate toggle is the gesture). Otherwise call the server. The T4 test page bound its translate handler twice; here one handler is bound once, and a unit test asserts one call per segment.
6. **Server translate** reuses C0's LLM client with a short system prompt. Caption text is untrusted: it is passed as a quoted user message, and the output is rendered as text, never HTML. The rate limit is passed per call as `rateLimit: { max: 15, windowMs: 60_000 }` (bucket `deviceId:translate.text`), enough for one segment every ~5 s. C0's default of 20 per 10 min would throttle live captions within 2 minutes. The route is listed in the load test's exclusion list. DECIDED (user, 2026-11-08): the 15/min per-device limit stands, plus a global daily cap: `api/src/services/translate.ts` keeps an in-memory counter per replica that resets at midnight America/Denver; above `TRANSLATE_DAILY_CAP` (env, default 2000) it returns 503 `{ reason: 'daily_cap' }` without calling the LLM and increments `kc_translate_capped_total`. With 2 replicas the effective cap is about twice the value; this is a cost backstop, not an exact quota. The client keeps the original line and shows `translate.unavailable` (IN-12, Promise P5). Translation strings live in E2's own `web/src/i18n/<lang>/translate.json` (keys `translate.*`), never in E1's `captions.json`.

7. **Adaptive captions, client half (D2).**
   - **Local SLI** in `web/src/lib/speech/sli.ts`: `SLOW_CHUNK_MS = 4000`, `SLOW_STREAK = 3`. Each chunk's lag (chunk end to text shown; for the browser engine, last interim result to final result) feeds a counter that resets on a fast chunk. On the third slow chunk in a row the session switches to the next engine in the platform's `ENGINE_ORDER` that passes the capability check (Whisper still needs consent). On iOS there is only one engine, so no switch happens and the message is "Captions are falling behind on this phone." The engine-switch beat is demoed on desktop Chrome on the presenter laptop. It switches at most once per session to avoid flapping; Kay can switch back by hand. The switch is announced politely: "Captions were falling behind, so we switched to {engine}." With no alternative: "Captions are falling behind on this phone." `kc_captions_engine_fallback_total{reason=slow}` increments.
   - **Report.** Lags are batched in memory and sent every 10 s, and on stop or `pagehide` via `fetch(url, { method: 'POST', keepalive: true, headers })` (not `navigator.sendBeacon`, which cannot send `X-Device-Id`, so C0's device plugin would answer 400; making the route `deviceId: 'optional'` with the id in the body would weaken the per-device limit), to `POST /api/captions/sli` with body `{ engine: 'whisper'|'webspeech', deviceClass: 'ios'|'android'|'desktop', samples: number[] }` (1 to 20 samples, each 0 to 120000 ms). The server route (`api/src/routes/captions.ts`) validates, applies a 6/min per-device limit (C0's `api/src/lib/rateLimit.ts`), and records the histogram `kc_captions_segment_ms` (buckets 500, 1000, 2000, 3000, 4000, 5000, 7500, 10000, 20000) with labels `engine` and `device_class` only. No device id, text or language goes into a label. Span `kc.captions.sli_report`. This server histogram is the PromQL source for F's poller and G4's caption rule (G design decision 8).
   - **Shared health.** `web/src/lib/speech/health.ts` calls F's `GET /api/status/health` with a 1.5 s timeout when a session starts. The request carries the platform (`?deviceClass=ios|android|desktop`). If `captions.fasterEngine` is non-null and that engine is in this platform's `ENGINE_ORDER` and capable, it is tried first; otherwise `ENGINE_ORDER` applies. On iOS `fasterEngine` is always `null` (one engine), but `captions.lagging` still works. If `captions.lagging` is true, the Captions screen shows "Captions are slow for everyone right now, not your phone." A 404, an error, a timeout or `source: 'unavailable'` means `ENGINE_ORDER` with no message. F merges before E, but E never assumes the endpoint exists.
   - **Strings** live in `captions.json` (`captions.sli.switched`, `captions.sli.slow_here`, `captions.sli.slow_everyone`), EN and ES, plain language (D's rule IN-6).

## iOS path (decided after T4, 2026-11-08)

1. iOS Safari tabs use the speech API only (`ENGINE_ORDER = ['webspeech']`). Whisper is never offered or loaded.
2. The Home Screen PWA uses the speech API like Safari (verified 2026-11-08) (iOS 18.7, standalone). No notice, no "Open in Safari" button, no copy-link fallback.
   - **Auto-restart.** The speech engine restarts recognition on `onend` while captions are on (the PWA session ended after about 12 s, desktop Chrome after about 33 s). Backoff 250 ms doubling to 4 s, reset after a result; stop after 5 consecutive restarts with no `audiostart` and show a plain message. Each restart increments `kc_captions_restart_total{engine}` and adds a span event `kc.captions.restart`.
   - **Early mic permission.** An explicit "Turn on captions" tap requests the mic first (`getUserMedia`, then stop the tracks) with copy such as "Captions need your microphone. Your phone will ask once. Tap Allow.", because the first prompt took about 27 s. The wait is not counted in latency.
   - **Latency** to first word is measured from `audiostart`, not `start()`.
   - **Tests** use a fake `SpeechRecognition` that fires `onstart`, `onaudiostart`, `onresult` and `onend` on demand.
3. Typed-caption mode (a text field feeding the same live region) is the last resort where no engine exists.
4. The demo runs live captions with the engine switch on desktop Chrome (presenter laptop); the iPhone demo shows speech-API captions, highlight-to-note and server translation.
5. Dictation (B) keeps working via the keyboard dictation of iOS.
E stays in Core.

## Telemetry

- Browser spans: `kc.captions.model_load` (bytes, ms, backend), `kc.captions.chunk_decode` (ms, audio s), `kc.captions.highlight_to_note`.
- Server spans: `kc.translate.request` (parent of the GenAI span), `kc.captions.sli_report`.
- Metrics: `kc_captions_lag_ms` (browser histogram, chunk end to text shown), `kc_captions_segment_ms{engine,device_class}` (server histogram from client reports; the PromQL source for D2 and G4; per-route HTTP p95 is not E's: it comes from `dash0_operation_name` span metrics, see G design decision 8), `kc_captions_engine_fallback_total`, `kc_translate_total{path=chrome|server}`.
- SLO candidate: caption lag p95 under 10 s.

## Risks

- Model download on venue Wi-Fi: consent plus size notice, cancel button, and fall back to the speech API.
- iOS Whisper crashes the tab (T4), so it is excluded by platform detection. A misdetected platform (for example a future iPad UA) could load Whisper: detection treats any touch Mac as iOS.
- Room audio quality varies; the UI never claims parity with human captioners.
