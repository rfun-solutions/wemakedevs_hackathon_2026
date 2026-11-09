# Cross-change review of the 8 KubeCompanion proposals (2026-11-08)

Result: `openspec validate --all --strict` passes 8 of 8. Nothing is committed.

## Shared decisions applied to all changes
- **Telemetry:** spans are `kc.<domain>.<op>` and metrics are `kc_<domain>_<name>`. The domains are:
  - `app` (C0)
  - `access` (D)
  - `pipeline` (G)
  - `agenda` and `schedule` (A)
  - `capture` (B)
  - `status` and `chaos` (F)
  - `captions` and `translate` (E)
  - `threads` (C)

  The brief's interface table line is updated to match.
- **i18n files:** files and key prefixes use the same domains: `app.json`, `access.json`, `schedule.json`, `capture.json`, `status.json`, `captions.json` and `threads.json`. `c0.json`, `shell.json` and `b.json` are gone.
- **Chaos reader:** there is one reader, `api/src/lib/chaos.ts`, with the exports `ChaosFlags`, `DEFAULT_CHAOS` and `getChaos(key)`. A ships a stub and F replaces it.
  - The ConfigMap `kc-chaos` has one data key, `flags.json`.
  - Keys that start with `/api/` are route keys. F's generic hook applies them.
  - `agenda` (`latencyMs`, `errorRate`, `naive`) is a named key that only A's handler applies, so the effect is never doubled.
- **LLM client:** C0 defines the exact `complete()` request and result shape, plus `RateLimitedError`, `LlmUnavailableError{reason}` and `pricing.ts`.
  - `claude-haiku-5-5` costs $0.10 / $0.50 and `claude-sonnet-5-5` costs $2 / $10 per million tokens in/out, verified 2026-11-08.
  - The limiter bucket is `deviceId:op`, and each call can override the rate limit.
- **Seeding:** there is one path, B's `POST /api/capture/seed`. It is gated by `KC_DEMO_SEED=1` and uses `DEMO_DEVICE_ID = 00000000-0000-4000-8000-00000000ca1e`, a valid UUID v4. C's `npm run seed:threads` calls it.

## Changes per proposal
- **C0**
  - **Repo facts:** stated that the repo is `rfun-solutions/wemakedevs_hackathon_2026` (organisation, public), with the queue and App bypass verified in T6 and T6b. Removed the personal-repo fallback and its open question.
  - **LLM client:** wrote the full `complete()` signature and the price table, and replaced the "unverified" note with the verified prices.
  - **Device id:** added a per-route device-id opt-out (needed by C's cron route). `/api/ping` returns 204 and is the only RTT probe.
  - **Dependencies and lint:** added `eslint-plugin-jsx-a11y` to lint and to the preinstalled deps, together with `ajv`, `idb-keyval`, `fake-indexeddb` and `@huggingface/transformers`.
  - **Workflows:** one workflow file per check (`<check>.yml`), with the workflow name equal to the check name.
  - **`AGENTS.md`:** only the `images:` block of `deploy/kustomization.yaml` is bot-owned, and `resources:` stays append-only (before this, it conflicted with A, C and F appending). Added the noreply commit email and the telemetry naming rule.
  - **Other:** the offline page is in EN and ES, and `THREADS_CRON_TOKEN` is listed as an optional secret. Renamed `kc.c0.*` / `kc.llm.*` to `kc.app.*`. Proposed a C0a/C0b split.
- **D**
  - D uses its own `t()` with no i18next, and no name-pronunciation recording.
  - Lint now belongs to C0; D only tightens rules.
  - PT-BR and AR translations of C0's `app.*` strings go in `{pt-BR,ar}/app.json`.
  - D's `index.ts` replaces C0's loader and keeps the same signature.
  - Proposed a split for group 4.
- **G**
  - Defined the exact sessionize exports and the A boundary, including no retry and no v2 handling from A.
  - The 60-session v1 fixture is shared with A.
  - Switched the tests from `node --test` to Vitest.
  - Edits `feed-contract.yml`, not `ci.yml`, which does not exist.
  - **Deploy workflow:** G now takes over C0's `deploy.yaml` instead of writing a duplicate `release.yml`, because both would have pushed `deploy:` commits.
  - `ci-traces` now names the real workflows.
- **A**
  - Ships only a chaos stub.
  - Extends G's mapper and creates no duplicate fixture or fetcher. Removed its own retry, because it would have masked the 429 break.
  - Uses `Intl` only, not luxon.
  - The ConfigMap end-to-end check moved to F.
  - Renamed `kc.a.*` / `kc_a_*`. Proposed a UI split.
- **B**
  - Renamed `kc_b_*` to `kc_capture_*` and `b.json` to `capture.json`.
  - Seeding is specified in full.
  - New exports `enqueueNote()` (used by E) and `getLastSaveMs()` (used by F).
  - The speech stub signature now matches E's: `Promise<SpeechSession>`. Before this, B's stub returned `{supported}` while E's returned `Stop`.
- **F**
  - Provides the single chaos reader, with the `agenda` key documented in its spec.
  - Edits `deployment.yaml` only for the volume.
  - No longer registers `/api/ping` again; Fastify would have thrown on the duplicate route.
  - The p95 window is fed by F's own `onResponse` hook on `POST /api/notes`, which was an unspecified source.
- **E**
  - Calls `complete()` as specified.
  - The rate limit goes from 10/min to 15/min. The old "stricter than default" wording was wrong, and 10/min is below the rate of one 5 s caption chunk.
  - Uses B's `enqueueNote`, and no longer edits F's load script.
  - Added the missing `.openspec.yaml`. Renamed `kc.e.*`. Proposed a split for translation.
- **C**
  - Uses B's exact note columns.
  - Seeding goes through B's endpoint. Before this, C inserted notes directly with `demo-kay-0000`, which is not a UUID and which C0 would reject.
  - Uses C0's `complete()` and `estimateCostUsd()`, so `llmAdapter.ts` and the second price table are gone.
  - The cron route opts out of the device id.
  - Migrations are 300-302. The proposal now admits the new secret `THREADS_CRON_TOKEN`.

## Merge order and dependencies
C0 → D → G → A → B → F → E → C, which is unchanged.
- Hard dependencies:
  - A needs G (sessionize).
  - F needs A, because it replaces A's chaos stub and reads `feed_runs`.
  - F also needs B (`getLastSaveMs`).
  - E needs B (`enqueueNote`, the speech stub), D (`<ShowToPerson>`) and C0 (LLM).
  - C needs B (notes, seed) and C0 (LLM).
- E and C can be built in parallel.
- Migrations do not clash: C0 000, A 100-102, B 200-202, C 300-302. E and F use none.

## Remaining risks
- C0 is still the critical path at about 2.5 h or more. Use the split if it is behind by 12:30.
- Several changes edit `deploy/deployment.yaml`: C0, then F (volume), then C (env). Merges are serial, so rebases should be clean.
- Web folders are inconsistent: `pages/`, `screens/`, `features/` and `views/`. It is cosmetic and causes no collision.
- The `device_id` column type is mixed: `uuid` in A and `text` in B. Both work because the value is a validated UUID.
- F's in-app p95 measures the server time for `POST /api/notes`, while the SLO uses the client-side `kc_capture_saved_ms`. The labels must say which is which.
- A's CronJob has no resource requests in its spec, so check the quota after A merges.
- E's engine order is still pending the iPhone test (map.md).

## Decisions needed from the user
1. **Stack (C0 D1):** Fastify, Vite + Preact and `pg` with SQL migrations. *Recommend: approve as written.*
2. **Run C0 as two agents (C0a/C0b)?** *Recommend: yes. Wave 1 waits on C0.*
3. **Server translate limit of 15 calls per minute per device.** The cost is small on Haiku, but it is an open endpoint on a public URL. *Recommend: accept, with a global daily cap env as a backstop.*
4. **`KC_DEMO_SEED=1` on the public deployment.** Anyone could reseed the demo device. *Recommend: turn it on only during rehearsal and the demo, then unset it.*

## Innovation integration (2026-11-08/09)
Accepted set from research/10 Round 2, folded into existing changes. `openspec validate --all --strict`: 8 of 8 pass. Nothing committed. Reconciled interfaces above are unchanged.

- **G4 rules from production (G).** `rules-from-prod.yml` plus `scripts/rules-from-prod.mjs` writes `.gitar/review/hot-paths.md`. Per T10, every rule sentence carries the live p95 and HH:MM, because Gitar quotes rule sentences, not the header. The bot commits `rules:`, `deploy.yaml` skips `rules:`, and the concurrency group is separate from `deploy-main`. The two PromQL expressions are a shared contract (G design 8) that F reuses. Runbook `docs/runbooks/hot-paths.md`.
- **G3 budget break (G), now PRIMARY.** T8 passed. `budget.md` says to lower only the request the PR raised. The staged PR raises Postgres to 4Gi. The narration does not claim Gitar read the rule ("No rules evaluated").
- **G5 (D + G runbook), second or backup.** D's unopened branch `bugfix/KC-<n>-card-contrast`; failure messages name the token.
- **G1 (C0 + D).** C0 creates `inclusion.md` and `demo-data.md` with a baseline rule each. D writes IN-1..9 and DD-1..4 in a rules-only PR 0 before its PR 1.
- **D2.** The E client has a local SLI (3 chunks over 4 s, switch once) and `POST /api/captions/sli` records `kc_captions_segment_ms{engine,device_class}`. F has a 30 s poller and `GET /api/status/health` (`HealthSnapshot`), with a plain-language EN/ES banner.
- **R3/R4 (F).** `docs/demo-runbook-ai-sres.md`; footer from the runtime ConfigMap `kc-release`, which is not in kustomize, so Argo never reverts it.
- **X1 (C0 + F).** C0 adds the `kay` Playwright project and the `kc.probe=kay` service override (`kc-web-kay`). F adds the spec, the laptop loop (the user starts it), a 15-min cron and `synthetic-kay.yaml`. It is called an "accessibility smoke test".
- **D3 (F, optional).** Gated on T7 under about 20 s; cached once per breach.
- **Sizing.** F is now F1 (groups 1-3) and F2 (4-6). G's split is G1 (1-3, 6) and G2 (4-5). E's split is now recommended: E2 does translation.
- **Ownership.** No file is created by two changes. C0 creates the rule files and D only edits their content. G creates `hot-paths.md` and `budget.md`.
- **Open item.** The PromQL path and label names are still UNVERIFIED (T9). T11 decides whether Kay RUM is real.

## User decisions Nov 8 evening
Applied to all changes. `openspec validate --all --strict`: 9 of 9 pass. Nothing committed. The running doc was not edited (the orchestrator updates it).

- **Problem statement, widened.** It now lives in `openspec/config.yaml` `context`, which OpenSpec 1.15 injects into artifacts, and in C0's proposal. C0 writes it into the README. The core problem: "more conversations and ideas per hour than you can remember", so capture takes seconds and AI organises the week into threads that end in actions. This is for everyone. On top of that, access carries past the talk-room door and is reviewed, measured and kept healthy. B and C's Why sections are rewritten as the two halves of the core problem.
- **C ends in actions.** Each thread carries actions: LLM follow-ups (at most 3) plus B's open promises (read-only). The heuristic path attaches promises by keyword overlap and makes follow-ups from notes that contain an EN/ES action verb. New:
  - migration `303_thread_actions`
  - `GET /api/threads/actions?open=1` and the "Next steps" tab
  - `PATCH` for follow-ups (promises toggle through B's `PATCH`)
  - the trace card moved behind a "How this works" disclosure
  - an optional C2 split for the UI
- **Access promises P1-P5:**
  - P1: captions within 4 s
  - P2: a note saves in under 0.5 s or waits offline
  - P3: 200% text and high contrast
  - P4: EN and ES
  - P5: translation available or a plain message

  Ownership:
  - D owns the words: `ACCESS-PROMISES.md`, `PROMISES` in `web/src/features/access/promises.ts` and the `access.promise.*` strings. D's PR 0 puts promise ids into the rule sentences, with new rules IN-10 to IN-12 and A11Y-2.
  - C0's baseline rules cite them: A11Y-1 (P3) and the inclusion baseline (P4).
  - G's generator writes `CAP-1 (Promise P1)` and `(Promise P2)` on a hot `/api/notes` rule.
  - F owns the lights: `HealthSnapshot.promises`, `PromiseLights.tsx` above the Radar all-clear footer, never green without data. P3 and P4 come from Synthetic Kay through the token-gated `POST /api/status/kay-checks`, which records `kc_status_kay_checks_total`. The P5 label names are UNVERIFIED.
- **Gaps closed:**
  - C0 `.gitar/review/api-contract.md` AC-1 (Gitar idea 2).
  - D adds a stutter card and a static calm-places list (260A, 260B, the Hyatt L5 prayer room, and nursing and child care as "ask at registration").
  - C0 adds the `AGENTS.md` line "Radar MCP after every merge".
  - F's runbook opens with an unstaged Radar investigation (task 5.6).
- **Under the hood.** C0 creates the registry `web/src/under-the-hood/` with one `entries/<change-id>.json` per change, so it is conflict-free. Every change has an "add your registry entry" task, and G gains `pipeline.json` for its strings. The new change **`h-under-the-hood`** (wave 2, merge order 9) builds the screen and the static `docs/how-it-works/` page, published by a `pages` workflow and designed with Impeccable. It is a new change rather than part of F because F is already F1, F2 and an optional F3, and H only reads F's endpoints, so it runs in parallel with E and C.
- **Marked decided:**
  - the stack (Fastify, Preact and `pg`)
  - C0 as C0a and C0b
  - translate at 15/min per device plus `TRANSLATE_DAILY_CAP` (2000 per replica per Denver day, 503 `daily_cap`)
  - `KC_DEMO_SEED` set only during rehearsal and the demo (`docs/demo-seeding.md`)
- **Gitar on stage.** G5 (accessibility regression, P3) is the on-stage fix. G3 is run once before 16:30 as a repo-evidence PR, then closed unmerged. D pushes a second `-rehearsal` branch so the stage branch stays broken.
- **Sizing risk.** F2 and D's group 4 each grew by about 25 to 30 min. F3 is optional; without it, P3 and P4 show "Not measured right now".
