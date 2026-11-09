# Wayfinder map: KubeCompanion hackathon plan
Label: wayfinder:map · Tracker: local markdown · Charted 2026-11-08

## Destination
Eight checked OpenSpec change proposals, uncommitted in the clone's `openspec/changes/`, plus the kickoff runbook, ready for `/opsx:apply` at 11:00 on 2026-11-09:
- C0 scaffold
- D access kit
- G pipeline + CI break
- A schedule
- B capture
- F observability as product
- E captions
- C evening threads

## Notes
- Every session reads `2026/hackathon/CLAUDE.md` and the running doc "KubeCompanion: What & Why" first.
- Sources: research 01–07, live tests in `research/08-live-tests/`, `resources-vault.md`.
- Shared conventions for proposals: `proposal-brief.md` in this folder.
- Skills: OpenSpec (`/opsx:propose`, `openspec validate --strict`); Impeccable for design (tomorrow).
- Standing preferences: mobile-first; no commits in the target repo before kickoff.

## Decisions so far
- Destination: the 8 proposals above plus the runbook (user, Nov 8)
- Tracker: local markdown here; real issues KC-1..KC-8 are created after kickoff
- Captions (E): Whisper in the browser on ~5 s chunks, browser speech API as fallback; final after the iPhone test ([01-iphone-transcription-test](issues/01-iphone-transcription-test.md)); see the iPhone line below
- Voice in capture (B): one shared speech module owned by E; B ships keyboard-first with a simple dictation button
- Phone translation: server endpoint calling Claude Haiku 5.5, rate-limited and traced, kept out of the load test
- UI languages (D): EN and ES full; PT-BR and AR (RTL) at smoke-test level; Claude-assisted strings, disclosed
- Accounts and data: no logins; anonymous device ID; notes in Postgres; IndexedDB offline queue; seeded fictional demo data only
- Schedule fixture: titles, times, rooms and tracks; no speaker names or bios in the repo
- Demo breaks: Gitar = schema drift kept outside the PR; Dash0 = organic bug first, backup app-level chaos on "My agenda" under a 50-user load at 15:45; nothing at the cluster level
- Radar (stretch): minimum is a before-screenshot plus one all-clear investigation; J canary only if wave 2 has merged by 15:00; J spec optional, written last
- Design checkpoint: Impeccable shows 2–3 directions at ~11:05, the user picks within 15 min, D owns tokens and merges first
- Agent models: Sonnet 5.5 builds, Opus orchestrates and reviews; wave 1 = 5 agents, wave 2 = 2–3
- iPhone test (user, Nov 8): iOS uses Web Speech only (Whisper crashes the tab, never loaded on iOS); desktop Chromium Whisper first then Web Speech; Home Screen PWA shows "Live captions need Safari"; E stays in Core
- Proposals: 8 parallel agents today, validated `--strict`, then reviewed for overlap

## Not yet specified
- Stack details (Fastify vs Hono, Preact vs React, SQL library): recommended in the brief; the C0 proposal fixes them; the user reviews

## Out of scope
- Elasticsearch track; H quiet map; I icebreakers (Ambitious bundle, not chosen)
