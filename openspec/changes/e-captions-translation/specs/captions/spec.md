## ADDED Requirements

### Requirement: Speech module
The web app SHALL provide `web/src/lib/speech/` exposing `startDictation(onText)` and `startCaptions(onSegment)`, replacing C0's stub. Each SHALL return a stop function.

#### Scenario: Dictation on a phone
- **WHEN** Kay taps the dictation button in the note field on a 390 px viewport
- **THEN** speech is transcribed and `onText` is called with the text, and the stub is no longer used

#### Scenario: Engine fallback on desktop Chromium
- **WHEN** Whisper cannot load or the capability check fails on desktop Chromium
- **THEN** the browser speech API is used, the screen states which engine is active, and `kc_captions_engine_fallback_total` increments

#### Scenario: No engine available
- **WHEN** no engine is available on the platform
- **THEN** the screen explains this in plain language, offers the typed-caption mode and the keyboard-only note field

#### Scenario: iOS never loads Whisper
- **WHEN** Kay opens Captions in iOS Safari
- **THEN** no Whisper option is shown, no worker is created, no model download is requested, and the speech API engine is used

#### Scenario: Home Screen PWA on iOS
- **WHEN** the app runs standalone on iOS and Kay opens Captions
- **THEN** the speech API engine is used exactly as in Safari (Home Screen PWA uses the speech API like Safari (verified 2026-11-08)), with no Safari notice, button or copy-link fallback, and Whisper is never loaded

#### Scenario: Recognition restarts after it ends
- **WHEN** the speech engine fires `onend` while captions are on
- **THEN** recognition restarts after a short backoff, `kc_captions_restart_total` increments, captions continue, and no restart happens after Kay turns captions off

#### Scenario: Mic permission asked early
- **WHEN** Kay taps "Turn on captions" for the first time
- **THEN** a plain-language line explains the microphone prompt, the permission is requested before recognition starts, and latency to first word is measured from `audiostart`

### Requirement: Consent before model download
The app SHALL NOT download the Whisper model until Kay agrees in a dialog that states the size (about 117 MB) and warns about venue Wi-Fi.

#### Scenario: Consent dialog
- **WHEN** Kay first starts captions with Whisper selected
- **THEN** a dialog shows the size, "Download now" and "Use browser speech instead", and no model request is made until "Download now" is pressed

#### Scenario: Cancel download
- **WHEN** Kay cancels during download
- **THEN** the download aborts and the browser speech engine is offered

### Requirement: Near-live captions in an ARIA live region
Captions SHALL be produced from about 5 s audio chunks and rendered in an ARIA live region (`role="log"`, `aria-live="polite"`) at large type that follows D's display modes.

#### Scenario: Caption appears
- **WHEN** a 5 s chunk is decoded
- **THEN** its text is appended as a line, announced by the live region, and `kc_captions_lag_ms` is recorded

#### Scenario: Axe and targets
- **WHEN** the Captions screen is checked at 390 px
- **THEN** axe reports no violations and every control is at least 24 px

### Requirement: Highlight a caption line to create a note
Kay SHALL be able to select a caption line with a button on that line and create a note via `POST /api/notes`.

#### Scenario: Save a line
- **WHEN** Kay presses "Save as note" on a caption line
- **THEN** a note with that text is created with `X-Device-Id`, a confirmation is announced, and the offline queue from B is used if the network is down

### Requirement: Platform-aware engine order
The engine order SHALL be a function of the detected platform: iOS/WebKit uses the browser speech API only; desktop Chromium uses Whisper first with the speech API as fallback; other browsers use the speech API if available, otherwise the typed-caption mode.

#### Scenario: Order per platform
- **WHEN** the platform is `ios`, `desktop-chromium` or `other`
- **THEN** `ENGINE_ORDER` is `['webspeech']`, `['whisper','webspeech']` or `['webspeech']` (or `[]` without `SpeechRecognition`) respectively, and the unit tests for all three pass with user-agent fixtures

### Requirement: Local caption SLI switches engine
The captions session SHALL measure each chunk's lag on the device and, after 3 consecutive chunks slower than 4000 ms, SHALL switch once to the next capable engine and announce the switch in the ARIA live region in plain language.

#### Scenario: Whisper falls behind on a phone
- **WHEN** the device takes over 4 s for three caption chunks in a row on Whisper (desktop Chromium)
- **THEN** the session switches to the browser speech engine and the live region says captions were falling behind and which engine is now used

#### Scenario: Slow on iOS with one engine
- **WHEN** Kay's iPhone takes over 4 s for three caption chunks in a row on the speech API
- **THEN** no switch happens and the live region says captions are falling behind on this phone

#### Scenario: One slow chunk
- **WHEN** two chunks are slow and the third is fast
- **THEN** no switch happens

#### Scenario: No alternative engine
- **WHEN** the streak is reached and no other engine passes the capability check
- **THEN** the screen says captions are falling behind on this phone and keeps the current engine

#### Scenario: No flapping
- **WHEN** a session has already switched once
- **THEN** it does not switch automatically again

### Requirement: Caption timings reported for the shared SLI
The client SHALL batch chunk lags to `POST /api/captions/sli`, and the server SHALL record histogram `kc_captions_segment_ms` with only `engine` and `device_class` labels.

#### Scenario: Report
- **WHEN** a batch of 5 samples for Whisper on iOS arrives
- **THEN** the server records 5 observations with `engine=whisper` and `device_class=ios`, returns 204 and emits `kc.captions.sli_report`

#### Scenario: Flush on page hide
- **WHEN** the page fires `pagehide` with unsent samples
- **THEN** the client sends them with `fetch` and `keepalive: true` carrying `X-Device-Id`, so the device plugin accepts the report (never `navigator.sendBeacon`, which cannot set the header)

#### Scenario: Privacy
- **WHEN** the histogram is exported
- **THEN** no label or attribute contains a device id, caption text or language

#### Scenario: Invalid report
- **WHEN** a body has an unknown engine, more than 20 samples or a sample outside 0 to 120000 ms
- **THEN** the server returns 400 and records nothing

### Requirement: Shared health picks the starting engine
At session start the client SHALL read F's `GET /api/status/health` for its platform, try `captions.fasterEngine` first when it is non-null and capable on that platform, and show "slow for everyone, not your phone" when `captions.lagging` is true.

#### Scenario: Everyone is slow
- **WHEN** the health response says captions are lagging
- **THEN** the Captions screen tells Kay, in their language, that captions are slow for everyone right now, not their phone

#### Scenario: Everyone is slow on iOS
- **WHEN** the health response says captions are lagging and the platform is iOS (where `fasterEngine` is `null`)
- **THEN** the same "slow for everyone, not your phone" message is shown and no engine switch is attempted

#### Scenario: Health unavailable
- **WHEN** the endpoint returns 404, errors, times out after 1.5 s or reports `source: 'unavailable'`
- **THEN** `ENGINE_ORDER` applies and no message is shown
