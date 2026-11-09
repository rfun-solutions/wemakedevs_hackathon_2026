## Why

C is the other half of the core problem (decided 2026-11-08 evening, `openspec/config.yaml` `context`): at a conference you have more conversations and ideas per hour than you can remember, so capture alone leaves a pile. Every attendee, not only Kay, ends the day with a dozen scattered notes and no idea what they add up to, or what they said they would do. Evening threading lets AI organise the week into threads that carry across days, so Tuesday's note about service mesh joins Monday's, and **every thread ends in actions**: follow-ups the notes imply ("send Ana the OTel demo link") and the promises Kay captured in B. A "Next steps" list gathers the open actions from all threads, so Kay can act on the week later, at home, in one place.

For Kay (they/them, hard of hearing, English as a second language, first KubeCon) this replaces the conversations they could not fully hear with a written list of what to do next. It scores on "conferences easier" (Conferences for Everyone) and on Dash0: the LLM call is an attendee AI feature traced so every call, token and cost is visible (organizers' idea 4), and the product shows that trace itself ("observability part of the product").

## What Changes

- Add a threading service that groups one device's notes for a day into threads and attaches them to existing open threads from earlier days.
- Each thread ends in actions: the LLM proposes up to 3 follow-ups per thread from its notes and attaches the device's open promises (read-only from B's `promises` table); the heuristic attaches promises by keyword overlap and turns notes with an action verb (EN/ES list) into follow-ups. Table `thread_actions` (migration 303). Kay ticks follow-ups done in C; promise actions toggle through B's `PATCH /api/promises/:id`.
- Add a "Next steps" list (`GET /api/threads/actions?open=1`) of every open action across threads, newest thread first.
- Use C0's `complete()` exactly as E does (default `claude-haiku-5-5`; `claude-sonnet-5-5` via `THREADS_MODEL` only if quality needs it). Fall back to a deterministic keyword/time heuristic when there is no `ANTHROPIC_API_KEY`, the daily budget is spent, or the call fails.
- Add tables `threads`, `thread_notes`, `llm_usage`, `thread_actions` (migrations 300-399; 300-303 used).
- Add `POST /api/threads/run`, `GET /api/threads`, `GET /api/threads/:id`, and an optional nightly CronJob manifest calling the run endpoint.
- Add a Threads view in the PWA (EN and ES) with a Next steps tab.
- Trace every threading LLM call with GenAI semantic conventions (model, tokens in/out, cost estimate, latency), and show the last runs' trace summary behind a "How this works" disclosure on the Threads view (not in Kay's main flow), with a Dash0 deep-link for the demo.
- Add one Under-the-hood entry `web/src/under-the-hood/entries/c-evening-threads.json`.
- Add a per-device daily cost cap (`THREADS_DAILY_CAP_USD`, default 0.05).
- Demo seeding: `npm run seed:threads` calls B's `POST /api/capture/seed` (the single seeding path), then runs threading. C inserts no notes itself.

## Impact

- Depends on C0 (LLM client, telemetry, registries) and B (`notes` and `promises` tables read-only, `POST /api/notes`, `PATCH /api/promises/:id`).
- Inserts only under its `>> c-evening-threads` marker in shared registries; owns migrations 300-399.
- Secrets: `ANTHROPIC_API_KEY` (existing, from C0), plus one optional key `THREADS_CRON_TOKEN` in `kc-secrets`, needed only if the suspended CronJob is enabled.
- Request budget: CronJob 50m CPU / 64Mi; no new always-on pods.

## Out of scope

- Embeddings or Elasticsearch search over notes.
- Icebreakers (I) and the quiet map (H).
- Editing or merging threads by hand beyond rename and unlink; editing action text; reminders or notifications for actions; sending anything on Kay's behalf.
- Translating thread titles (E owns translation; titles are generated in the device's UI language only).
- Cluster-level chaos; load-test coverage of the LLM path.
- Real attendee data of any kind.
