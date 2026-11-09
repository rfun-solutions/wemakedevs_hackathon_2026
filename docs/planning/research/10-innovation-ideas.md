# 10 Innovation ideas: beyond the sponsors' baseline

Round 1, written 2026-11-08 by the idea generator. The orchestrator counter-questions in Round 2.

## 0. Ground rules this round obeys

**Baseline everyone will copy** (research 01 §1): Gitar = time-zone review rule, API/frontend contract rule, break CI on purpose. Dash0 = chaos button + Agent0, crowd-map metrics, "My agenda slow after keynote", OpenLIT-traced assistant. Radar = talk picker, hallway matchmaker, crowd map. Our current proposals (C0, D, G, A, B, F, E, C) already use most of this baseline (time-zone rule, feed-contract break, Agent0 to PR to Gitar to queue to Argo, GenAI spans, Status screen). Every idea below has to add something **neither the baseline nor the current proposals** have.

**Verified facts leaned on** (research 08): Gitar reviews in about 1 min and pushes a code fix in about 2.5 min (T1); it fixes code and tests but **reverts** chaos config that sits in the PR diff; its review is a COMMENTED review, not a check; it cites `.gitar/review/*.md` rule text verbatim; it never touched workflows. Dash0: NodeSDK traces, logs and metrics arrive (T2); browser SDK RUM arrives with CORS fine and `traceparent` joins browser to server (T2); the query API on us-west-2 returns spans; the operator's collectors are refused on the event cluster, a 100m/256Mi collector Deployment is admitted (T3). GitHub: org merge queue works, custom App bypass push to protected main works, repo must be public (T6, T6b).

**Unverified capabilities flagged with (UNVERIFIED)**: Dash0 custom attributes on web events; Dash0 SLO private beta; Dash0 notification webhooks; Agent0 `runTask`/`waitForTask` called with a bearer token from a server (and its latency and credit cost); Radar hosted MCP called from a script rather than from Claude Code; Gitar fixing Kubernetes manifests (research 02 inference); Gitar rules (`.gitar/rules/`, check type) on the trial plan; Perses dashboard apply via the `dash0` CLI.

**Budget reality**: 2 CPU / 4 GiB requests for app + Postgres + optional collector. Build window 6.5 h with about 7 agents, so the real ceiling for extras is maybe 8 to 10 agent-hours on top of the eight changes. The ideas are priced so the orchestrator can pick.

Judging criteria quoted from research 01 §5.

---

## 1. Gitar (Never Merge Broken)

### G1. Inclusion rules: Gitar as the accessibility and language reviewer
- **Pitch:** the review rules encode inclusion, not just code hygiene, and Gitar cites them on every feature PR.
- **Built:** extend `.gitar/review/` with `inclusion.md` (every user-visible string goes through `t()`; every new key exists in EN and ES; dynamic text has an ARIA live region; no `div` buttons; 24 px targets; strings aim at plain language, short sentences, no idiom) and `demo-data.md` (fixtures carry no speaker names, emails or handles; rule 4). Includes `@../AI-DISCLOSURE.md` so Claude-assisted translations stay disclosed.
- **Novel vs baseline:** baseline rules are about time zones and API contracts. Nobody will ship review rules whose subject is a Deaf, ESL first-time attendee. T1 verified Gitar quotes rule text in findings, so the judges will literally read "The repo rule says every string needs an ES key" on our PRs.
- **Criterion:** "Project-aware setup, with review instructions and repository rules that reflect how your team actually works." Also Conferences for Everyone.
- **Kay beat:** the "Can you repeat that?" card almost shipped English-only. Gitar's finding on the D PR is the receipt.
- **Effort / change:** 0.5 to 1 agent-hour; C0 (rules) and D (first PR that trips them).
- **Deps:** verified: `.gitar/review/*.md` is read and cited (T1). Unverified: nothing.
- **Risk:** rules too vague produce noise findings. Keep each rule testable in one sentence.

### G2. Trust page: Gitar's review verdicts surfaced to the attendee
- **Pitch:** the app shows "every feature you are using passed an accessibility review" with the real PR list.
- **Built:** a CI step (in `build-image`) calls the GitHub API for merged PRs, pulls `gitar-bot[bot]` review comments, extracts which `.gitar/review` rules were cited and whether CI was fixed by Gitar, and bakes `web/public/trust.json`. An About/Trust screen in the PWA (D tokens, EN and ES) lists the last 10 PRs: title, "reviewed by Gitar", rules cited, "CI fixed automatically" badge. Links out to the public PR.
- **Novel vs baseline:** Gitar is dev tooling in every other entry; here the review trail is a user-facing feature and an honesty mechanism (AI disclosure made concrete). It also doubles as the judges' "features landed through PRs it reviewed" evidence inside the demo itself.
- **Criterion:** "Gitar is part of how you built, with features landing through PRs it reviewed, not one PR at the end."
- **Kay beat:** Kay taps "Why should I trust this app?" and sees the review that caught the missing Spanish string.
- **Effort / change:** 1.5 agent-hours; attaches to F (Status screen gets a Trust tab) with a small CI step in G's workflow.
- **Deps:** verified: review comments are public on a public repo (T1 PR links are public; T6b says the repo must be public anyway). Unverified: none. GitHub API rate limits are fine at build time.
- **Risk:** reads as gimmick if the list is short. Mitigation: we will have 15 to 25 PRs by 16:00; the page gets richer all day.

### G3. Budget breaks: Gitar fixes a deploy that the 4 GiB quota rejects
- **Pitch:** the cluster's own ResourceQuota becomes a CI failure Gitar diagnoses and fixes.
- **Built:** `build-image` gains a `kubectl apply --dry-run=server -k deploy/` step against the vcluster (kubeconfig from Secret `default/kubeconfig` stored as an Actions secret; token lasts 24 h, so refresh at kickoff). A PR that adds the collector Deployment or raises replicas trips `exceeded quota: team-quota` server-side. Gitar reads the log and edits `deploy/*.yaml` requests.
- **Novel vs baseline:** the baseline break is a unit test or a mocked API. This one is a real, external, organizer-imposed constraint that lives outside the PR diff, exactly the design T1 said works (revert is not an answer because main already exceeds budget with the new component). It also connects Gitar to Radar (R2 uses `get_rightsizing` to pick the numbers).
- **Criterion:** "Using CI failure diagnosis and auto-apply to fix real problems."
- **Kay beat:** indirect. "We nearly lost captions on the Pending pod" is a team beat, not Kay's.
- **Effort / change:** 1 to 1.5 agent-hours; G (deploy workflow) plus a one-line manifest change in C0 or F.
- **Deps:** verified: Gitar fixes code and test files in-PR (T1), dry-run quota errors are deterministic. (UNVERIFIED) Gitar editing Kubernetes YAML; research 02 lists it as an inference. (UNVERIFIED) event vcluster API reachable from GitHub-hosted runners (server `https://<team>.vc.cnh.radarhq.io`, likely public).
- **Risk:** Gitar's "fix" is to drop replicas to 1 or delete the component. Both are valid fixes, so the demo still reads honestly; write the rule "never remove the collector, lower requests instead" in `.gitar/review/budget.md` to steer.

### G4. Rules that learn from production: telemetry writes review rules
- **Pitch:** Dash0 tells Gitar which routes are hot, and Gitar reviews changes to those routes more strictly.
- **Built:** a scheduled workflow (`rules-from-prod`, hourly plus `workflow_dispatch`) queries Dash0 PromQL (`http_server_request_duration_seconds` p95 by route, from the verified API host) and rewrites `.gitar/review/hot-paths.md`: "Routes with p95 over 300 ms in the last hour: /api/agenda. Changes to these handlers must keep DB calls out of loops and must add or update a load-test assertion." Committed to main through the deploy-bot App (T6b path, `rules:` commit prefix, skipped by CI).
- **Novel vs baseline:** closes the loop between observability and review. Nobody in the baseline list uses telemetry as an input to code review, and it is a story Sonar's staff will recognise as their own roadmap pitch.
- **Criterion:** "Project-aware setup, with review instructions and repository rules that reflect how your team actually works" plus the Dash0 criterion "Using Agent0 or the MCP server to find and fix something real during the day."
- **Kay beat:** when the "My agenda" slowdown happens at 15:45, the next PR touching the agenda handler gets a Gitar finding that quotes a rule written by production data.
- **Effort / change:** 1.5 agent-hours; new small change or fold into G (it owns workflows and the deploy bot). Needs the Dash0 full-access token as an Actions secret (server-side only, consistent with the brief).
- **Deps:** verified: Dash0 query API on us-west-2 (T2), deploy-bot push to protected main (T6b), Gitar reads rules from the default branch (T1 note). (UNVERIFIED) whether Gitar re-reads rules immediately after the commit; T1 saw rules take effect on the next PR.
- **Risk:** a bot writing to main alarms judges. Mitigation: the file is under `.gitar/review/` only, the commit is signed by the bot identity, and the Trust page (G2) shows it.

### G5. Gitar fixes an accessibility regression, not a bug
- **Pitch:** the `a11y` required check (axe) goes red and Gitar's auto-apply fixes the contrast token.
- **Built:** nothing new beyond C0's `a11y` job; stage one real regression (a card colour at 3.9:1) on a PR during wave 2. Add to `.gitar/review/accessibility.md`: "Fix the token in `tokens.css`, never relax the axe rule or add an exclusion."
- **Novel vs baseline:** every other team's Gitar CI fix will be a failing unit test. An AI fixing WCAG failures with a rule that forbids weakening the test is an inclusion story told through Gitar.
- **Criterion:** "Using CI failure diagnosis and auto-apply to fix real problems" and "How well your project makes conferences easier."
- **Kay beat:** Kay's full-screen "I'm deaf, please type" card in bright hallway light was the one that failed contrast.
- **Effort / change:** 0.5 agent-hour of staging; D owns the token, C0 owns the check.
- **Deps:** verified: Gitar fixes test failures and follows rule text (T1). (UNVERIFIED) that Gitar's fix is the colour, not the test. The rule is the steering.
- **Risk:** axe output may not name the token; make the e2e test print the computed colour and the token name in the failure message so Gitar's log read is easy.

---

## 2. Dash0 (Stop Flying Blind)

### D1. Accessibility as an observability signal
- **Pitch:** display modes, languages, caption engine and TTS use become anonymous telemetry; "who we are serving" is a dashboard.
- **Built:** D's access kit emits `kc_access_mode_active{mode=large_type|high_contrast|reduced_motion|hyperlegible, lang=es}` as a gauge via a server ping (`POST /api/access/state`, debounced, keyed by device UUID, opt-in toggle in settings with plain-language wording). E emits `kc_captions_engine{engine=whisper|webspeech}` and time-to-first-segment. Perses panel "Access modes in use", and a check rule: "caption time-to-first-segment p95 > 4 s for 5 min".
- **Novel vs baseline:** the baseline instruments latency and errors. This instruments inclusion: the first time an observability vendor's dashboard shows how many attendees needed large type. It also gives Agent0 a new kind of question ("did caption latency get worse for Spanish users after the 15:50 deploy?").
- **Criterion:** "Depth of instrumentation across your app, including traces, logs, metrics and real-user monitoring" and "Observability that's part of the product experience."
- **Kay beat:** Kay switches on large type and Spanish; the dashboard ticks; later Agent0 explains that caption latency rose for Whisper-on-WASM phones, so E flips the engine order.
- **Effort / change:** 1 to 1.5 agent-hours across D (emit), E (emit), F (panel + check rule).
- **Deps:** verified: server metrics arrive (T2). (UNVERIFIED) custom attributes on web-SDK events, so the server ping is the safe path. Privacy: aggregated, anonymous, opt-in, no PII (brief hard rule).
- **Risk:** judges may read it as tracking disabled users. Mitigation: the opt-in copy and a "why we measure this" line in the Trust page; everything is on-device unless the toggle is on.

### D2. Captions SLO that drives the product
- **Pitch:** the caption pipeline has a user-facing SLO, and when it burns, the app changes behaviour.
- **Built:** E records per-chunk `kc_captions_segment_ms` (client timer, reported through the same-origin API so it lands server-side), SLI "segments under 4 s". F defines the SLO (if the private beta is enabled by Dash0 staff at kickoff) or a check rule as fallback. The in-app Status says in plain language "Captions keeping up" or "Captions lagging, switching to the browser engine", and E's engine order actually switches on a client-side SLI breach (the client does not need Dash0 to act; Dash0 is where the team sees it).
- **Novel vs baseline:** the baseline "bonus point for an SLO" is a health chart. Here the SLO is about an accessibility promise and the product reacts to it.
- **Criterion:** "Bonus point if you can create a dashboard or an SLO that shows how healthy your app is" and "Observability that's part of the product experience, not bolted on at the end."
- **Kay beat:** in a loud room Whisper falls behind; Kay sees "lagging, switching" rather than silently losing a sentence.
- **Effort / change:** 1.5 agent-hours; E (SLI + switch) and F (SLO or check rule, Status copy).
- **Deps:** verified: metrics ingest (T2). (UNVERIFIED) SLO private beta availability; fallback is a check rule, still within the criterion's "dashboard or SLO".
- **Risk:** Whisper on iPhone is itself unverified (ticket 01). If Whisper fails, the SLO still exists for the browser engine, which T4 showed stops at about 33 s, so the SLI will be genuinely interesting.

### D3. Agent0 explains the outage to Kay, in Kay's language
- **Pitch:** the "Is it the Wi-Fi or us?" line on the Status screen is written by Agent0 and translated for Kay.
- **Built:** server endpoint `GET /api/status/explain` (cached 60 s, one call per minute at most) that calls Dash0 MCP `runTask` with a fixed prompt ("In one sentence for a non-technical attendee: is the KubeCompanion app healthy right now, and if not, what is slow?") then `waitForTask`, pipes the sentence through C0's LLM client for translation into the device language, and returns it. Fallback: a rule-based sentence from a PromQL query via the Dash0 API. Everything traced with GenAI spans (so Agent0's own call shows up in Dash0).
- **Novel vs baseline:** the baseline uses Agent0 in the demo for engineers. Here Agent0 output is a product feature for an ESL attendee, and the AI SRE is itself traced in the product's telemetry.
- **Criterion:** "Using Agent0 or the MCP server to find and fix something real during the day, and showing it in your demo" and "Observability that's part of the product experience."
- **Kay beat:** during the 15:45 agenda slowdown Kay's phone reads, in Spanish, "The agenda is slow for everyone right now (about 2 s), not your Wi-Fi. Notes still save."
- **Effort / change:** 2 agent-hours; F.
- **Deps:** verified: Dash0 API with bearer token from a server (T2). (UNVERIFIED) `runTask`/`waitForTask` over MCP with a bearer token from a non-interactive server, their latency (likely tens of seconds, hence caching) and credit burn. Admin-level token stays server-side only.
- **Risk:** latency or credit cost makes it unusable live. Mitigation: the fallback sentence is identical in shape; the cached Agent0 sentence is shown with a "from Agent0, 40 s ago" label when it exists.

### D4. Session recap from Kay's own trace
- **Pitch:** a caption session is one long trace; at the end Kay gets a recap built from it.
- **Built:** E starts a root span per caption session (browser), each chunk's transcribe, translate and "highlight to note" spans join it through `traceparent` (verified join). At "Stop", the server queries Dash0 spans for that trace id and returns a recap: minutes captioned, segments, average translate latency, highlights saved, with deep links to the notes. C's threads view shows the same recap on the evening thread.
- **Novel vs baseline:** the baseline traces an LLM assistant for the engineer's benefit. Here the trace is the data model of a user-facing recap; observability literally is the feature.
- **Criterion:** "Observability that's part of the product experience, not bolted on at the end" and "Depth of instrumentation."
- **Kay beat:** "You captioned 38 minutes, saved 3 lines, translation averaged 1.1 s." Kay screenshots it.
- **Effort / change:** 2 agent-hours; E (session span) and F or C (recap endpoint).
- **Deps:** verified: browser to server trace join and server spans queryable by trace id (T2). Caveat from T2: browser spans themselves were not in the span store, so the recap is built from server spans plus client timings sent as span attributes.
- **Risk:** Dash0 ingest delay (seconds to a minute) means the recap may be partial right at "Stop". Mitigation: the client keeps its own counts; Dash0 enriches when available.

### D5. LLM cost alert that actuates the product
- **Pitch:** a Dash0 check rule on LLM spend flips the app from Claude to the deterministic heuristic.
- **Built:** C's `llm_usage` becomes a counter `kc_llm_cost_usd_total{feature=threads|translate}`. F adds a check rule "cost > 80% of daily cap". Dash0 notification webhook to `POST /api/chaos/llm-degrade` (signed secret) sets a runtime flag; C and E read the flag and fall back. Status screen says "AI features paused to stay within budget".
- **Novel vs baseline:** the baseline (OpenLIT tracing) shows cost. This makes the alert a control signal, with the product degrading gracefully and telling the user.
- **Criterion:** "Observability that's part of the product experience" and "find and fix something real during the day."
- **Kay beat:** threads still group Kay's notes, labelled "grouped by keywords tonight" instead of silently being worse.
- **Effort / change:** 1 agent-hour; C (counter) and F (rule + webhook endpoint).
- **Deps:** verified: metrics arrive. (UNVERIFIED) Dash0 notification channels to a custom webhook URL and their payload. Fallback: the app's own cap (already in C) does the flip, and the check rule just alerts.
- **Risk:** webhook unavailable. Then it is a check rule plus an in-app cap, still honest.

---

## 3. Radar (stretch)

### R1. Canary judged by an accessibility SLI
- **Pitch:** Argo Rollouts promotes a release only if capture latency and caption SLI stay healthy, and Radar shows the verdict.
- **Built:** switch `deploy/` to a Rollout with a 20 percent canary step and an AnalysisTemplate querying the in-cluster Prometheus (scrapes pods annotated `prometheus.io/scrape`) for `kc_capture_saved_ms` p95 and `kc_captions_segment_ms` p95 (the app exposes `/metrics` in Prometheus format in addition to OTLP export). A bad release (F's chaos flag in the canary image) auto-aborts; Radar's rollout view and an AI investigation "why did the canary abort" are the story.
- **Novel vs baseline:** the baseline Radar ideas are attendee apps that happen to run on Kubernetes. This makes the cluster's release process answer an accessibility question, and the starter's own `canary` example is used for something the organizers did not suggest.
- **Criterion:** "Use Radar's AI investigations to investigate a real issue or question about your running app. Show what you learned and what you did with the findings."
- **Kay beat:** the release that would have slowed captions never reached Kay's phone.
- **Effort / change:** 2 agent-hours; new change J (the map already reserves J for a canary, conditional on wave 2 merging by 15:00).
- **Deps:** verified: Argo Rollouts and Prometheus present (research 03). (UNVERIFIED) Prometheus exporter alongside NodeSDK OTLP (standard; `metricReaders` accepts both).
- **Risk:** time. If wave 2 slips, this is the first stretch to drop.

### R2. Budget right-sizing through Radar MCP, landed as a reviewed PR
- **Pitch:** Radar tells us where the 4 GiB go, the agent writes the PR, Gitar reviews it.
- **Built:** at about 13:00 the orchestrator asks Radar MCP (`get_rightsizing`, `get_cost`, `top_resources`) in Claude Code, writes `deploy/` request changes as a PR with the evidence pasted into the description, Gitar reviews against `.gitar/review/budget.md` (G3). Before and after screenshots of Radar's Checks are kept for the demo.
- **Novel vs baseline:** uses Radar's MCP to change how we ship, not to build a UI feature; pairs with G3 so the Radar finding and the Gitar review are one visible chain.
- **Criterion:** "Use Radar's UI and MCP throughout building and operating your project. Show how Radar helped you ship, troubleshoot, or improve your app."
- **Kay beat:** none directly; the room we free is what lets Postgres and the collector coexist.
- **Effort / change:** 0.5 agent-hour of orchestrator time; no new change.
- **Deps:** verified: hosted Radar MCP tool list (research 03). (UNVERIFIED) right-sizing data quality on a vcluster an hour after creation.
- **Risk:** low. Even an all-clear is a screenshot.

### R3. Two AI SREs, one incident
- **Pitch:** Agent0 explains the agenda slowdown from telemetry; Radar's investigation explains it from the cluster; the demo shows where they agree.
- **Built:** during the 15:45 load test, run both: Agent0 in Dash0 ("why is /api/agenda slow") and a Radar investigation on the `app` Deployment. Capture both verdicts; the runbook includes a two-column slide. If Radar finds CPU throttling at the 500m limit while Agent0 finds the N+1, that is the point: two vantage points, and the fix PR (F's runbook) cites both.
- **Novel vs baseline:** nobody will put two sponsors' AI SREs side by side on the same incident. It is a judge-pleasing honesty move: we show their strengths without pretending one tool does everything.
- **Criterion:** Radar "investigate a real issue or question about your running app"; Dash0 "find and fix something real during the day, and showing it in your demo."
- **Kay beat:** this is the engineering half of D3's Kay-facing sentence.
- **Effort / change:** 0.5 to 1 agent-hour of demo time; F runbook.
- **Deps:** verified: hosted Radar investigations on the event cluster (research 03), Agent0 chat on the trial. Nothing unverified beyond availability of credits.
- **Risk:** the investigation takes minutes live. Mitigation: run it at 15:45, share it, and show the shared link at 17:30.

### R4. Release notes with a Radar all-clear, shown in the app
- **Pitch:** every wave's merge gets a shared Radar investigation link, and the Trust page shows "verified in the cluster".
- **Built:** after each wave merges, the orchestrator runs a Radar investigation ("anything wrong after the deploy of <sha>?"), marks it Shared, and pastes the link into the merge PR and into `trust.json` (G2). The Trust page shows a "cluster all-clear" badge per release.
- **Novel vs baseline:** Radar's investigation becomes part of the release record and the attendee-visible trust story, not a one-off demo screenshot.
- **Criterion:** "Use Radar's AI investigations... Show what you learned and what you did with the findings" and "Run your project on Kubernetes with Radar connected."
- **Kay beat:** indirect through G2.
- **Effort / change:** 0.5 agent-hour; rides on G2.
- **Deps:** verified: investigations can be marked Shared (research 03).
- **Risk:** investigation allowance (100 per month in own org; organizer allowance on the event org unknown). Three to four investigations all day is safe.

### R5. Radar change timeline as deploy markers in Dash0 (optional)
- **Pitch:** Radar's `get_changes` feeds deploy events into Dash0 so Agent0 can correlate "slow since 15:50" with "deploy at 15:49".
- **Built:** a tiny script run by the orchestrator (or the deploy workflow) emits a log record `deployment.sha=... deployment.at=...` to Dash0 OTLP when a `deploy:` commit lands; Perses panel overlays markers.
- **Novel vs baseline:** cross-sponsor correlation; cheap.
- **Criterion:** Dash0 "Depth of instrumentation"; Radar "Show how Radar helped you ship."
- **Kay beat:** none.
- **Effort / change:** 0.5 agent-hour; G (deploy workflow emits the event; does not need Radar MCP at all, so the Radar half is optional).
- **Deps:** verified: OTLP log ingest (T2, T3). (UNVERIFIED) Radar MCP from a script; avoid by emitting from the workflow.
- **Risk:** negligible.

---

## 4. Cross-cutting

### X1. Synthetic Kay: an accessibility persona as a continuous probe
- **Pitch:** a Playwright "Kay" (Spanish, large type, reduced motion, captions on, iPhone viewport) walks the app every five minutes against the public URL, and its RUM, synthetic check and a11y assertions feed all three sponsors.
- **Built:** one Playwright script shared by C0's `e2e-mobile`/`a11y` jobs and a scheduled workflow that runs it against `https://<team>.cnh.radarhq.io` with RUM on (service name `kc-web-kay`). Dash0: synthetic check as code on the URL plus the Kay RUM segment; check rule when Kay's capture p95 or axe violation count rises. Gitar: the same script is the `a11y` required check, so a regression blocks merge and Gitar fixes it (G5). Radar: the probe is visible real traffic on the cluster after each deploy.
- **Novel vs baseline:** accessibility becomes a continuous observability signal with a named persona, not a one-off audit. It is the thread that ties Conferences for Everyone to every sponsor's criteria.
- **Criterion:** Dash0 "real-user monitoring if you have a frontend" and "dashboard or SLO"; Gitar "Project-aware setup"; Radar "Show how Radar helped you ship."
- **Kay beat:** the demo opens with the dashboard showing Synthetic Kay's day, then the real Kay's phone.
- **Effort / change:** 2 agent-hours; F (synthetic check, rule, panel) with C0's Playwright config extended.
- **Deps:** verified: RUM from a real browser arrives (T2), synthetic checks as code (docs), merge queue requires `merge_group` trigger on CI (T6). (UNVERIFIED) Playwright's Chromium sending RUM through the Dash0 web SDK the same way Chrome did; very likely.
- **Risk:** scheduled Actions minutes and a public URL that only exists after the first deploy. Start the schedule after 13:00.

### X2. Inclusion scorecard: Conferences for Everyone, measured
- **Pitch:** one Perses dashboard where every panel is an inclusion number.
- **Built:** panels: access modes in use (D1), caption SLI (D2), translation p95 and cost (C0 GenAI spans), axe violations per CI run (from `ci-traces` attributes, G), Gitar inclusion-rule findings per PR (from G2's `trust.json` pushed as a metric), Synthetic Kay uptime (X1). Dashboard JSON lands through a Gitar-reviewed PR.
- **Novel vs baseline:** the baseline dashboards show rooms filling up. This one shows whether the conference app is actually serving the people Merge Forward represents, and it is built from three sponsors' data.
- **Criterion:** Dash0 "Bonus point if you can create a dashboard"; Gitar "features landing through PRs it reviewed"; Conferences for Everyone.
- **Kay beat:** the closing slide.
- **Effort / change:** 1.5 agent-hours; F. Depends on D1 and X1 existing, so it is a wave 2 item.
- **Deps:** verified: metrics ingest. (UNVERIFIED) `dash0` CLI dashboard apply; fallback is importing the JSON in the UI.
- **Risk:** panel sprawl. Cap at six panels.

### X3. The relay, closed by the cluster and spoken to Kay
- **Pitch:** Agent0 finds, Gitar reviews, the queue merges, Argo deploys, Radar confirms, and Kay's phone says "fixed 2 minutes ago" in Spanish.
- **Built:** F's runbook already covers Agent0 to PR to Gitar to merge queue to Argo. Add two steps: a shared Radar investigation on the new ReplicaSet (R4) and the Status screen's explanation line (D3, or its rule-based fallback) flipping to "Fixed, 2 min ago". Time the whole chain with Dash0's CI trace (G) and show the trace as the finale: one trace from alert to Kay.
- **Novel vs baseline:** the baseline has Agent0 in the demo. Four AI or automation agents handing off, with the attendee as the last hop and the CI trace as the proof, is the innovation the user asked for.
- **Criterion:** all three "find and fix something real", "auto-apply to fix real problems", "investigate a real issue", plus "makes conferences easier."
- **Kay beat:** the story's climax.
- **Effort / change:** 1 agent-hour of runbook and glue on top of F, D3 and R4.
- **Deps:** verified: every hop except Agent0 `runTask` from a server (D3, has a fallback) and Agent0 opening a PR on a public repo (research 03 says Agent0 proposes PRs with a GitHub connection; not tested).
- **Risk:** Agent0 may not open the PR in time. Mitigation: the orchestrator opens it from Agent0's findings; the Trust page still shows the chain.

---

## 5. Honest picks for Round 2

Under a 6.5 h window the realistic add-on budget is about 8 to 10 agent-hours. If the orchestrator wants a shortlist to interrogate:

1. **G1 inclusion rules** (0.5 to 1 h): nearly free, uniquely ours, verified mechanism.
2. **X1 Synthetic Kay** (2 h): ties all three sponsors to accessibility with verified pieces.
3. **D1 access telemetry** (1 to 1.5 h): new kind of signal; feeds X2.
4. **D3 Agent0 explains to Kay** (2 h): the boldest user-facing use of a sponsor agent; has a verified fallback.
5. **G2 Trust page** (1.5 h): turns the whole process into a feature; R4 rides on it for free.
6. **R3 two AI SREs** (0.5 to 1 h): demo-time only, high judge appeal.
7. **G3 budget break** (1 to 1.5 h): only if G finishes its own break early; depends on an unverified Gitar behaviour.

Drop first if time is short: R1 canary, D4 trace recap, G4 rules-from-prod (great story, two moving parts).

---

# Round 2: answers to the coordinator's counter-questions (2026-11-08, evening)

## 1. D1 accessibility as telemetry: KILLED for tomorrow
Making it defensible needs all of: opt-in default off, server-side counters with no device id, no `lang` dimension (low counts identify people), room dimension only once a bucket has 5 or more devices, and a "what we share" screen showing the literal payload. That is a 1.5 to 2 h item with a privacy review we cannot do under pressure, and a single misread by a Merge Forward judge costs more than the panel earns. The honest reframe is an opt-in "organizer demand signal" (how many people in a room wanted captions) and that is a post-hackathon feature. Nothing else depends on it; X2 (scorecard) goes with it.

## 2. D3 Agent0 explains to Kay: DEMOTED to conditional bonus
What Kay gains over an honest status line is only the cause clause ("slow for everyone, notes still save"), and a PromQL-driven template can say that too. The real value is the judges' "Agent0 output inside the product" moment. Cached design, if kept: the server's 30 s PromQL poll (see 3) detects a breach, fires `runTask` once, stores the sentence with a timestamp; the Status screen shows "Agent0, 40 s ago: ..." translated by Haiku. Cost 1 h on F, only if tonight's test shows a result under about 20 s and modest credit use.

**Tonight's test (T7, 15 min):** with the full-access token, hit the Dash0 MCP server non-interactively (Streamable HTTP, JSON-RPC): `POST https://api.us-west-2.aws.dash0.com/mcp` with `Authorization: Bearer $DASH0_TOKEN`, `Accept: application/json, text/event-stream`, body `{"jsonrpc":"2.0","id":1,"method":"tools/list"}`. Confirm `runTask` and `waitForTask` appear and record their input schemas. Then `tools/call` `runTask` with `{"task":"In one plain sentence for a non-technical reader: is service kc-t2-app healthy in the last hour?"}` (the T2 service still has data), take the task id, call `waitForTask`, and time wall clock from `runTask` to the final text. Note credits before and after in the Dash0 UI. If the server rejects the bearer (OAuth only), test the same two calls from Claude Code with the `dash0` MCP added and time them; the server path then needs a different auth approach and D3 is dropped.

## 3. D2 captions adapt from polled PromQL: YES, and it beats D3
Two layers, both verified mechanisms. Client: each caption chunk's time-to-text is measured locally; three slow chunks in a row flip the engine (Whisper to browser speech or vice versa) at once and the Captions screen says so in a live region. Server: every 30 s it queries the verified us-west-2 API (`histogram_quantile(0.9, kc_captions_segment_ms_bucket)` by engine and device class) and publishes `/api/status/health`; the Status screen uses it for "lagging for everyone, not your phone" and new sessions start on the engine that is currently faster. No SLO beta, no webhook. Stronger than D3 because every piece is verified, it changes Kay's experience, and it still reads as "observability is part of the product". 1.5 h on E (SLI, switch, copy) and F (poll, health endpoint, check rule for the dashboard). The check rule stays as the alert for the team.

## 4. G4 rules from production: KEPT as the Gitar headline, separate from G1
G1 is static inclusion rules (0.5 h, cheap, ours). G4 is the loop: a `rules-from-prod` workflow (`workflow_dispatch` plus hourly) runs the same PromQL the status poll uses, p95 per route over the last hour, and writes `.gitar/review/hot-paths.md` with a header "Generated from Dash0 at 15:52; /api/agenda p95 2.1 s" and one testable rule per hot route ("changes to the agenda handler must keep database calls out of loops and must update the load-test assertion"). It also adds a rule when the caption SLI from D2 breaches ("changes to `web/src/lib/speech/` must keep chunk length at or under 5 s"). Committed to main as `rules: ...` by the deploy-bot App (T6b path), skipped by CI.

**Two-minute stage version:** the job has already run after the 15:45 slowdown, so `hot-paths.md` is on main. Three minutes before the slot, open the prepared PR that adds a per-session query inside the agenda loop. On stage: show the rule file header (10 s), show Gitar's review quoting it (verified in T1 that it quotes rule text within about 1 min), say the sentence "production wrote this rule an hour ago" (20 s). Safety: if Gitar is slow, the PR from the dress rehearsal is the fallback tab. 1.5 h, attaches to G (owns workflows and the deploy bot).

## 5. G2 Trust page: CUT as a feature, kept as one line
Agreed, Kay does not care about code review. "What changed today in your language" is nicer but is release notes for someone on their first day at a conference, which is not a need Kay has. Replace with one footer line on the Status screen: "Last release 15:52, Gitar-reviewed, Radar all-clear" with two links (15 min inside F). G1 plus G5 cover the inclusion-rule story properly.

## 6. G3 budget break: test tonight, decide after
**T8 (20 min) on an org test repo.** First check Gitar is installed on the org at all (T1 ran on the personal `rfun` account); if not, installing it is itself a tonight item. Then push to main in one commit: `deploy/app.yaml` (Deployment, requests 500m/1Gi, 2 replicas), `scripts/check-budget.mjs` that sums requests across `deploy/*.yaml` and exits 1 with the real quota wording (`exceeded quota: team-quota, requested: requests.memory=1Gi, used: 3.5Gi, limited: 4Gi`), a `budget` job in `ci.yml`, and `.gitar/review/budget.md` ("When the budget check fails, lower requests or replicas in deploy/*.yaml. Never delete a component and never edit scripts/check-budget.mjs or the limits"). Open a PR adding `deploy/collector.yaml` with a 1Gi request so the sum exceeds 4Gi, comment `gitar auto-apply:on`, label `gitar-managed`, wait 3 min. Pass: Gitar edits YAML requests or replicas and CI is green. Partial: it deletes the collector. Fail: it edits the script or the rule, or does nothing. Only a pass keeps G3, and then it replaces G5 as the Gitar CI-fix beat (same budget) because it ties to Radar R2.

## 7. X1 Synthetic Kay: runs on the laptop, not the cluster or a 5-min cron
Chromium never goes in the cluster. Run the Playwright Kay script in a laptop loop (`while true; do npx playwright test kay.spec.ts; sleep 300; done`, or launchd) against the public URL with RUM on as service `kc-web-kay`; the laptop is at the venue anyway. Add a Dash0 synthetic HTTP check as code on the URL for plain uptime, and an Actions cron every 15 min as the fallback when the laptop is busy demoing. Wording: "accessibility smoke every 5 minutes", never "accessibility uptime"; the axe gate on every PR is the guarantee, the probe is the between-deploys signal. Cost 1 h because the spec file is the same one `e2e-mobile`/`a11y` already run (persona settings via localStorage seed). Attaches to F (synthetic check, panel) with C0's Playwright config. Note: running Playwright locally is browser automation; the user must run the loop or grant it explicitly.

## 8. Final set, 6 agent-hours or less on top of the eight changes

| Headline, one per sponsor (each under 60 s in Kay's story) | Change | Hours |
|---|---|---|
| **Gitar: G4 rules from production.** The 15:45 slowdown wrote a review rule; the next PR touching the agenda got Gitar quoting production data. | G | 1.5 |
| **Dash0: D2 adaptive captions.** Kay's captions lag; the screen says so and switches engine; Status says "everyone, not you"; the Dash0 panel shows the SLI by engine. | E + F | 1.5 |
| **Radar: R3 two AI SREs, one incident.** Agent0 and Radar investigate the same slowdown from telemetry and cluster sides; the fix PR cites both; the Status footer carries the Radar all-clear link (R4). | F runbook | 0.75 |
| Supporting: G1 inclusion rules | C0 + D | 0.5 |
| Supporting: G5 staged a11y regression fixed by Gitar (or G3 if T8 passes) | D + C0 (or G) | 0.5 |
| Supporting: X1 Synthetic Kay on the laptop plus Dash0 synthetic check | F + C0 | 1.0 |
| **Total** | | **5.75** |

Conditional, outside the 6 h: D3 cached Agent0 sentence (1 h on F) only if T7 shows under about 20 s. Killed: D1, X2, G2 as a feature, D4, D5, R1, R5. R2 stays as 30 min of orchestrator time (no build).

## Tonight's live tests
- **T7** Dash0 MCP `runTask`/`waitForTask` with a bearer token, non-interactive; latency and credits (decides D3).
- **T8** Gitar editing Kubernetes YAML on pipeline-test-repo under a budget rule (decides G3 vs G5). Includes checking Gitar is installed on the `rfun-solutions` org.
- **T9** (10 min) PromQL through the us-west-2 API: `histogram_quantile(0.95, sum by (le, http_route) (rate(http_server_request_duration_seconds_bucket[5m])))` against the T2 data; confirm the endpoint, label names and the response shape. D2 and G4 both depend on this query.
- **T10** (15 min, on pipeline-test-repo) the deploy-bot pushes a `rules: add .gitar/review/hot-paths.md` commit to main, then a new PR touching the named file gets a Gitar finding that quotes it. This is G4 end to end.
- **T11** (needs the user's explicit go-ahead, browser automation) Playwright Chromium loading the T2 page sends RUM that arrives as `dash0_web_*` metrics. Decides whether X1's RUM segment is real or just the synthetic check.
