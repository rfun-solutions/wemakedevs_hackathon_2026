# 04. Accessibility, inclusion and feature options ("Conferences for Everyone")

_Information only, no decisions. Compiled 2026-11-08. Hours are my rough one-developer, one-day-hackathon estimates (not sourced). Items marked UNVERIFIED came from a single search snippet or aggregator._

## 1. Pain points and what exists today

### 1.1 Pain points by group
| Group | Pain points at tech conferences | Source |
|---|---|---|
| Deaf / HoH | Few or no accommodations; social events and hallways unusable; Q&A questions unheard without mic; uncaptioned videos/demos; captions only cover talks, and some signing members prefer interpreters over captions; auto captions not considered equivalent to human captioners; want slides and speaker notes ahead of time | CNCF DHH tips, PyGotham playbook, Arizona/GaTech guides |
| Blind / low vision | Slides and demos not described, inaccessible schedule apps, maps, PDFs; want slides in advance (also helps captioners/interpreters) | CNCF DHH page (slides ahead), SIGACCESS guide; Merge Forward has a Blind and Visually Impaired sub-group |
| Neurodivergent / sensory overload | Crowds, noise, receptions, unstructured networking, schedule overload. Search found little hard data; treat as general knowledge to validate with the Merge Forward Neurodiversity sub-group | gap in search |
| Non-native English | Fast speech, idioms, jargon; need captions/translation; gap in search | CNCF offers Wordly in 60+ languages |
| Stuttering / speech diversity | Q&A and networking pressure; Merge Forward has a Stuttering and Speech Diversity sub-group | ocgroups page |
| Mobility | Distance between venues (Salt Palace + Hyatt Regency are separate buildings), elevator locations, seating | KubeCon NA inclusion page |
| Caregivers | Need childcare, nursing room | KubeCon NA inclusion page |
| Introverts / first-timers | Hallway track, knowing whom to talk to, need a break space | quiet rooms exist |
| Dietary / religious | Prayer room exists; dietary info not mentioned on the page I fetched | gap |

### 1.2 What KubeCon NA 2026 (Salt Lake City, Nov 9-12) already offers
From the official inclusion and accessibility page (fetched 2026-11-08):
- Captioning in 60+ languages through **Wordly**, instructions posted in each breakout room (2025 Atlanta transparency report says Wordly ran on attendees' own phones; secondary snippet).
- Quiet rooms: All-Attendee Quiet Room (Salt Palace L2, 260A), Women + Non-Binary Quiet Room (260B); Prayer Room (Hyatt Regency L5).
- **Pronoun stickers** (not pins) at registration; communication stickers appeared in 2025 report (snippet).
- Code of Conduct; reports to eventconduct@cncf.io or (408) 686-9393.
- Mobility: wheelchair/scooter rental via Mobility City; reserved seating in each session; staff help find elevators.
- Private nursing room; complimentary onsite child care.
- Registration scholarships and travel funding.
- **Not mentioned:** ASL/sign interpretation, dietary info, sensory guidance, quiet-hours/crowd info.

### 1.3 Merge Forward (ocgroups.dev/cncf/group/merge-forward)
- CNCF Open Community Groups umbrella of 7 diversity-focused groups, 318 members. Mission: build supportive networks and safe spaces for people from diverse backgrounds and allies; mentoring; educate others to support potential contributors. Highlights representation of underrepresented groups and maintainer burnout.
- Founders Catherine Paganini and Emily Fox; co-leads Catherine Paganini, Stephane Este-Gracias, Beatriz Rodgers; core contributor Ahlem Jaouadi; ambassadors Julia Furst Morgado, Eddie Wassef, Kasper Nissen, Abdel Sghiouar.
- Sub-groups: Blind and Visually Impaired; Deaf and Hard of Hearing; Stuttering and Speech Diversity; Women in Cloud Native; Deep Roots; Friends of Dorothy; Neurodiversity.
- Monthly meetings first Tuesday; DHH WG next meets 2026-11-24 11:00 EST; Slack #merge-forward; GitHub github.com/merge-forward; YouTube playlist.
- Implication for judging: the seven sub-groups are a ready checklist of audiences.

## 2. Feature catalogue (pain point -> feature, effort, dependencies)

| # | Feature | Serves | Effort (h) | Dependencies / notes |
|---|---|---|---|---|
| 1 | **UI i18n** (i18next or Paraglide, JSON catalogs, language switcher, RTL via `dir`, Intl dates/times in venue tz) | non-native | 2-3 for plumbing + 3 languages (ES, PT-BR, JA/ZH, AR for RTL check); machine-translated strings need native review | No external service. Pairs with Translator API for notes |
| 2 | **Live captions of what the user speaks/hears via Web Speech API** | deaf/HoH, ESL | 2-3 | See matrix below; mic hears the room, quality varies; cannot be sold as replacing Wordly |
| 3 | **Live captions via cloud STT streaming** (WebSocket proxy from backend) | deaf/HoH, ESL | 4-6 | API key kept server-side; cost table below |
| 4 | **On-device Whisper in browser** (transformers.js, whisper-tiny/base multilingual, WebGPU with WASM fallback) | privacy, offline, low bandwidth | 5-8 (chunking, VAD, worker); 40-600 MB model download | Heavy on phones; iOS WebGPU reports conflict, test on device |
| 5 | **Live translation of captions** (Chrome Translator + Language Detector) | ESL | 2-3 | Chrome desktop only (138+; Edge 148); not mobile, not Safari/Firefox, not in Web Workers; `create()` needs user gesture; on-demand language pack download; `translateStreaming()` exists. Needs cloud fallback for phones (below) |
| 6 | **Translation fallback via cloud** (LLM or Cloud Translation) | ESL on phones | 2-3 | Server-side proxy; LLM translation via Claude/OpenAI is simplest |
| 7 | **Text-to-speech** (SpeechSynthesis API, built in; reads notes/summaries aloud) | blind/low vision, dyslexia, speech diversity | 1-2 | Voice availability varies by OS/language |
| 8 | **Type-to-speak AAC card** ("I'm deaf, please type", "Slower please", "Can you repeat?") plus large-text full-screen "show to person" mode, optional TTS speaker | deaf/HoH, stuttering/speech diversity, ESL | 2-4 | Pure frontend. Strong demo moment, low risk |
| 9 | **Conversation starters / hallway-track icebreakers** (curated plus LLM suggestions from the user's own notes, e.g. "ask about X you saw in session Y") | introverts, first-timers, neurodivergent | 2-3 | Optional LLM call; include "opt out of small talk" scripts and graceful exit lines |
| 10 | **Sign language resources** (quick links, fingerspelled/ASL glossary for cloud native terms, "request interpreter" reminder, link to CNCF DHH WG) | deaf/HoH | 1-2 (curated links) ; video/avatars out of scope | Content quality needs DHH community review; interpreters not listed on NA page |
| 11 | **Quiet-room, crowd and sensory map** (static venue list: 260A, 260B, Hyatt prayer room; user-reported crowd level "calm/busy/loud" per room, no accounts) | sensory, neurodivergent, mobility | 3-5 (static map + sessions-by-room); 3 more for crowd reporting backend | Public data from NA page. Crowd reports need a DB and abuse controls; demo with simulated data |
| 12 | **Mobility-aware routing hints** (flag back-to-back sessions in different buildings: Salt Palace vs Hyatt, with walking-time buffer) | mobility | 1-2 | Uses `rooms` field from schedule JSON (rooms named "Salt Palace / Level / Room" or "Hyatt Regency / ...") |
| 13 | **Plain-language talk summaries** (LLM, short sentences, define jargon, reading level target, "explain like I'm new") | ESL, neurodivergent, first-timers | 2-4 | LLM key; summarise session description from public schedule only (not YouTube transcripts) |
| 14 | **Screen-reader-first and WCAG 2.2 AA** (semantic HTML, labels, focus order, live regions for captions, target size 24px min (SC 2.5.8), focus not obscured (2.4.11), reduced motion, contrast 4.5:1) | blind/low vision, motor | 3-4 baseline + 1-2 audit | axe-core / Lighthouse CI; test VoiceOver iOS. Cheapest high credibility item: document an a11y statement |
| 15 | **Dyslexia-friendly and display modes** (OpenDyslexic or Atkinson Hyperlegible, spacing, line height, high contrast, dark, large-type slider, reduce motion) | dyslexia, low vision | 1-2 | Font license check; Atkinson Hyperlegible is free (Braille Institute) |
| 16 | **Low-bandwidth / offline PWA** (service worker, cache schedule JSON + notes in IndexedDB, queue syncs, no heavy bundles, small payload) | everyone on crowded venue Wi-Fi | 3-4 | Workbox or manual SW; iOS PWA caveat: Web Speech is not available in Home Screen web apps (caniuse note). Schedule JSON is 1.9 MB raw, compress or trim fields |
| 17 | **Voice capture as alternative to typing** (dictation into note field) | motor, dyslexia, fast capture | 1-2 | Same STT stack as 2/3 |
| 18 | **Pronoun and communication preference "badge" screen** (user-configured card: pronouns, "I prefer text", "quiet please", name pronunciation recording stored locally) | many | 1-2 | Local only, aligns with rule 4 |
| 19 | **Dietary/faith finder** (static filters to nearby info; no verified public data found) | dietary/religious | 1-2 if static | Data gap: venue food lists not located |
| 20 | **Access tags on sessions** (has captions, slides available, demo-heavy, Q&A heavy, jargon-level from `Cloud Native Novice` category) | many | 2-3 | Derived from public categories; speaker-sourced access info does not exist, so label as heuristic |

### Rough combos by size (information only)
- Smallest credible a11y layer: #1 (partial), #7, #8, #14, #15 = about 9-13 h.
- Plus captions: add #2 and #5 (desktop) = +4-6 h; add #16 = +3-4 h.
- Everything above #14-#16 is cheap per hour; #3, #4, #11 backends are the risky ones.

## 3. Technology facts

### 3.1 Web Speech API (SpeechRecognition) support
- Chromium (Chrome, Edge, Opera): supported, `processLocally` (on-device) in newer versions (Edge 139+, Opera 123+). Default Chrome mode streams audio to Google.
- **iOS Safari: partial** (14.5+ per caniuse, `webkitSpeechRecognition`), prompts user, sends audio to Apple; **not available in SafariViewController or Home Screen web apps** (caniuse note). `processLocally` unsupported.
- **Firefox: not supported** (practically). 
- Net: usable on Chrome/Edge/Safari, with continuous mode flaky on iOS (Apple forum threads of issues in 17.1). Needs feature detection and a cloud STT fallback.

### 3.2 Chrome built-in AI
- Translator API and Language Detector API stable from Chrome 138; Edge 148 listed; **desktop only, not mobile, not Safari/Firefox**, not in workers. Language packs download on demand; every pair reports `downloadable` until created (privacy). Third-party claim of 22 GB disk and 4 GB VRAM for some built-in models is UNVERIFIED for these two APIs.

### 3.3 Whisper in browser
- transformers.js ONNX Whisper: tiny (39M params, ~120 MB+ download), base, small up to ~590 MB; 99 languages for multilingual variants (`whisper-tiny.en` is English only). WebGPU about 5-15x realtime (aggregator estimates); WASM fallback is slower. iOS WebGPU claims conflict (iOS 26 "full support" vs "still catching up"), so verify on the actual phone.

### 3.4 Cloud STT / translation costs (aggregator figures, verify before relying)
| Service | Price | Note |
|---|---|---|
| OpenAI gpt-4o-mini-transcribe | about $0.003/min | UNVERIFIED; one source says retiring 2027-02-26; no separate realtime rate found |
| OpenAI gpt-4o-transcribe / whisper-1 | about $0.006/min | aggregator |
| OpenAI realtime transcription model (gpt-realtime-whisper, naming varies) | about $0.017/min | single-source, UNVERIFIED |
| Deepgram Nova-3 streaming | $0.0048/min mono, $0.0058/min multilingual (promo listed on deepgram.com/pricing); regular reported $0.0077/$0.0092 | diarization about +$0.002/min |
| Google Cloud STT v2, Cloud Translation, Azure Speech Translation | not retrieved | gap, search needed |
- The user's $50 OpenAI credit at $0.003-$0.017/min is roughly 49-280 hours of transcription, ample for a one-day demo (my arithmetic; check actual credit terms with the hackathon).
- Whether OpenAI Realtime supports transcription-only sessions with streaming deltas is not verified here; check the OpenAI docs at kickoff.

## 4. Public data for a rule-4-safe demo
- **Sessionize JSON works now**: `https://kubecon-cloudnativecon-north-america-2026.sessionize.com/api/schedule` returned HTTP 200, `application/json`, 1.9 MB with keys `sessions` (600 entries, includes service sessions like Registration/Coat check), `speakers` (712), `questions`, `categories` (5 groups, e.g. "All Sessions" with tracks like AI Inference + Agentic, Cloud Native Novice), `rooms` (37, named "Salt Palace | Level 1 | Hall DE", "Hyatt Regency | Level 4 | ..."). Session fields include id, title, description, startsAt, endsAt, roomId, speakers, categoryItems, `liveUrl`, `recordingUrl` (null now), status. Co-located Monday uses a separate Sessionize site (per reference file). No API key needed. Speaker objects include names and bios, which are public conference data, but consider omitting bios and photos in the repo to stay well inside rule 4. A `/api/schedule/grid` path returned 404; only `/api/schedule` confirmed.
- **Sched**: official API requires an organizer-provided `api_key` per site, 30 calls/min cap, User-Agent required. KubeCon 2026 appears to use Sessionize, and `kccncna2026.sched.com` redirected to sched.com (not a live schedule). Prior years' Sched sites (e.g. kccncna2024) have public pages and third-party scrapers exist; scraping is a grey area.
- **YouTube recordings/transcripts**: CNCF publishes KubeCon sessions on its YouTube channel. Licensing: one aggregator says CNCF channel uses CC-BY (UNVERIFIED, per video setting); no statement on transcript reuse found. Safer for demo: link to videos, do not copy transcripts into the repo; or generate transcripts on the fly from your own audio. Check each video's license field.
- **Venue maps**: Salt Palace and Hyatt Regency maps on the event site (/attend/venue-travel/) and Google Maps link in README; no machine-readable indoor map found. Room names from the schedule JSON plus the NA page's quiet-room locations are enough for a text/list "map". Copying official floor plan images has unverified reuse rights.
- **Wi-Fi details**: not found on pages fetched (reference file notes this gap).
- **Demo notes data**: use synthetic notes only (rule 4).

## 5. Open questions to resolve (not decided)
1. Is the target "attendee-side tools" (companion app) or "support for organizers' captions" (display Wordly)? Wordly is a vendor; no public API found.
2. Which languages to ship (need native reviewers; Merge Forward has no stated language list).
3. Whether to reach out to Merge Forward / DHH WG on CNCF Slack (#merge-forward) at the event for feedback, and whether accessible-use claims need community validation before the pitch.
4. Ask organizers (rule 8 aside) if API/translation usage is expected to be disclosed under rule 5.

## Sources
- Merge Forward: https://ocgroups.dev/cncf/group/merge-forward
- KubeCon NA inclusion and accessibility: https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/attend/inclusion-accessibility/
- KubeCon NA 2025 transparency report (PDF, text not extractable; snippet only): https://www.cncf.io/wp-content/uploads/2025/12/KCNA25_TransparencyReport.pdf
- KubeCon EU 2026 transparency report: https://www.cncf.io/wp-content/uploads/2026/04/KCEU26-Transparency-Report.pdf
- CNCF DHH tips for conferences: https://contribute.cncf.io/accessibility/deaf-and-hard-of-hearing/tips-when-attending-or-speaking-at-a-conference/
- CNCF DHH conference best practices: https://contribute.cncf.io/accessibility/deaf-and-hard-of-hearing/conference-best-practices
- Kubernetes blog DHH WG spotlight: https://kubernetes.io/blog/2024/09/30/cncf-deaf-and-hard-of-hearing-working-group-spotlight/
- PyGotham ASL/captioning playbook: https://emptysqua.re/blog/pygotham-2019-asl-live-captioning-playbook/
- SIGACCESS accessible conference guide: https://www.sigaccess.org/welcome-to-sigaccess/resources/accessible-conference-guide-version-1-0/
- Speech recognition on caniuse: https://caniuse.com/speech-recognition ; processLocally: https://caniuse.com/mdn-api_speechrecognition_processlocally ; MDN: https://developer.mozilla.org/docs/Web/API/SpeechRecognition/processLocally
- Chrome Translator API: https://developer.chrome.com/docs/ai/translator-api ; built-in AI: https://developer.chrome.com/docs/ai/built-in-apis
- Whisper in browser overview: https://offlinetts.com/blog/browser-speech-recognition-whisper-comparison/
- OpenAI transcription pricing aggregator: https://costgoat.com/pricing/openai-transcription ; Deepgram: https://deepgram.com/pricing
- Sched API: https://sched.com/api
- Sessionize endpoint (fetched with curl 2026-11-08): https://kubecon-cloudnativecon-north-america-2026.sessionize.com/api/schedule
- Local: (local path), README.md
