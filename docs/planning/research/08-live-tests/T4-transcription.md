# T4: Transcription on phones

Status: page built and deployed, NOT yet run on devices. Results below are for the user to fill in.

- URL: https://rfun.github.io/throwaway-test-repo/
- Source: `gh-pages` branch of github.com/a throwaway test repo (public throwaway; main untouched)
- Verified: `curl` returns 200 for the page and `manifest.webmanifest`. No secrets on the page.
- Whisper model: `Xenova/whisper-tiny` (multilingual) via transformers.js 3.7.2 from jsDelivr; WebGPU if an adapter exists, else WASM.
- Stubs: OpenAI realtime and Deepgram Nova-3 buttons (needs key); translation falls back to "Claude Haiku proxy (tomorrow)" where Chrome Translator is missing. No API is called.
- Expected going in (from research 04): Web Speech fails in the iOS Home Screen PWA; Chrome Translator is desktop Chrome only; iOS WebGPU is uncertain.

## How to run
The on-page log panel records the user agent, latency to first word, and errors. Tap "Copy log" after each run and paste into the notes column or send to the agent.

### A. iPhone Safari (browser tab)
1. Open the URL. Confirm "Launch mode: normal browser tab". Log shows the user agent.
2. Web Speech: pick English, tap Start. Note the mic permission prompt (when, wording, whether it re-asks). Speak. Note latency to first word from the log.
3. Keep Web Speech running 3 minutes with continuous talking (read an article aloud). Watch for stops, auto-restarts (log shows `onend` and `auto-restart`), dropped text.
4. Whisper: tap Load model. Record download MB and seconds, and which backend loaded (webgpu or wasm). Record a 10 s clip, Stop, note stop-to-text latency and accuracy.
5. Translation: expect stub shown (no Chrome Translator on iOS).

### B. iPhone Home Screen PWA
1. In Safari: Share, Add to Home Screen. Launch from the icon. Confirm "Launch mode: HOME SCREEN PWA".
2. Repeat steps 2 to 4 above. Mic permission may prompt again. Record whether each path works at all.

### C. Desktop Chrome
1. Repeat A.2 to A.4. Then 3-min stability.
2. Translation: say or type a few sentences in a non-English language, tap "Detect and translate captions". Note language pack download and latency.
3. Optionally install as app (address bar install icon) and re-check.

## Results table (fill in)

| Path | iPhone Safari | iPhone Home Screen PWA | Desktop Chrome |
|---|---|---|---|
| Web Speech: works? | | | |
| Web Speech: latency to first word (ms) | | | |
| Web Speech: 3-min continuous stable? (restarts / dropped text) | | | |
| Web Speech: mic permission flow (prompts, re-asks) | | | |
| Whisper: loads? backend (webgpu/wasm) | | | |
| Whisper: download size and time (MB, s) | | | |
| Whisper: stop-to-text latency for 10 s clip (ms) | | | |
| Whisper: accuracy / usable? | | | |
| Whisper: mic permission flow | | | |
| Translation: Chrome Translator available? latency | n/a expected | n/a expected | |
| Captions readable, screen reader announces (VoiceOver) | | | |
| OpenAI realtime / Deepgram | needs key | needs key | needs key |
| User agent (from log) | | | |
| Notes / errors | | | |

## Decision to record afterwards
- Which path is primary on iPhone for the E track, and which is the fallback?
- Is live transcription in Core scope at all?
- Android remains untested (no device); Chromium path covered by desktop Chrome only.

## Desktop Chrome results (user, 2026-11-08)
Chrome 157 on macOS. WebGPU, SpeechRecognition, Translator and LanguageDetector were all available.

| Path | Result |
|---|---|
| Web Speech | First start() failed with `not-allowed` (mic permission); the second try worked. Latency to first word was 3,993 ms. The user says it **skips whole sentences**. It ended after about 33 s with no auto-restart logged |
| Whisper (whisper-tiny, WebGPU) | **Worked best (user).** About 116.7 MB downloaded in 6.1 s. Decoded 50.6 s of audio; stop-to-text 4,007 ms |
| Chrome Translator | en detected (1.00). Language pack download about 2 s. Translations done in 4,412 / 2,878 / 339 ms (the first ones include the pack download) |
| Page bug | Translate ran twice in parallel (duplicate detect/download logs), so the handler is probably double-bound |

iPhone Safari and the Home Screen PWA are still pending (the user will test "in other places").

## iPhone results (user, 2026-11-08)
| Path | Result |
|---|---|
| iPhone Safari (browser tab), Web Speech, continuous mode | **Works decently well.** Over about a minute of video audio, accuracy was good with minor errors ("OpenAI's Whisper" became "opening eyes whisper"). Final text white, interim text yellow; UI fine |
| iPhone Safari, in-browser Whisper (transformers.js whisper-tiny) | Model downloads, but pressing transcribe **crashes the page**: it reloads with no logs. Likely the iOS per-tab memory limit |
| iPhone Home Screen PWA | **Not tested.** Web Speech is documented as not working there |

Decisions: iOS uses Web Speech only; Whisper is never loaded on iOS. Desktop Chromium is Whisper first, Web Speech fallback. Other browsers use Web Speech if available, else typed captions. The Home Screen PWA shows "Live captions need Safari". E stays in Core.

## iPhone Home Screen PWA (user, 2026-11-08)
iOS 18.7, standalone mode. **Web Speech works** (`SpeechRecognition` true, captions appeared). WebGPU true; Translator and LanguageDetector false.

| Event | Time |
|---|---|
| `start()` | 3.58 s |
| `onstart` | 30.70 s (about 27 s on the mic-permission prompt) |
| `audiostart` | 30.71 s |
| first word | 38.35 s (about 7.6 s after audio started) |
| `onend` | 42.76 s, 0 restarts |

The session ended after about 12 s with no auto-restart. Decisions: the "Live captions need Safari" notice is dropped (the PWA uses the speech API like Safari); add auto-restart with backoff (`kc_captions_restart_total`), ask for mic permission early on an explicit tap, and measure latency from `audiostart`. `ENGINE_ORDER` is unchanged: iOS is speech API only, Whisper never loads on iOS.
