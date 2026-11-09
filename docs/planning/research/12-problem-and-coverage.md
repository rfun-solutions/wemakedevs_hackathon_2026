# 12 Problem statement, "more than assistants", coverage matrix

Written 2026-11-08 (evening) by the product-strategy agent. Options and a recommendation only: nothing here is decided until the user agrees. Inputs: research 01 (ideas and criteria, verbatim), 04 §1.2 (what KubeCon already offers), 07 §1 and §3–4, 08 (live tests T1–T10), 10 (Round 2 final set), the wayfinder map, and the Why / What Changes sections of the eight proposals (C0, D, G, A, B, F, E, C). Proposals and the running doc were not edited.

Live-test facts this document relies on:
- **T1 (Gitar):** reviews in about 1 minute. Fixes code in about 2.5 minutes. Quotes `.gitar/review` rule text. Reverts chaos that sits in the PR diff.
- **T2 (Dash0):** traces, logs, metrics and RUM arrive on us-west-2, and the query API works.
- **T3 (Dash0 operator):** refused on the event cluster. A small collector Deployment is admitted.
- **T4 (captions on desktop Chrome):** browser speech skipped sentences and stopped after about 33 s. Whisper worked.
- **T8 (Gitar and YAML):** PASS. Gitar fixed a quota overrun by lowering a YAML request.
- **T10 (rules from production):** PASS. Gitar quotes the rule *sentences* but not the generated header.
- **T7 (Agent0 called from a server), T9, T11:** no result file in research/08. Treat them as unverified.

---

## 1. The problem statement

### 1.1 Candidates

**P1. The access gap outside the talk room.**
> Deaf, hard-of-hearing and non-native-English attendees lose the conversations that matter most at KubeCon (hallways, booths, Q&A without a mic) and the names and promises that come out of them, because the conference's access support stops at the breakout-room door.

Evidence: KubeCon NA 2026 offers Wordly captions with instructions posted *in each breakout room*, plus quiet rooms and pronoun stickers. It offers no ASL interpretation, and nothing for hallways or socials, which the CNCF DHH tips call "unusable" (research 04 §1.1–1.2).

**P2. Access tools that fail silently.**
> For an attendee who depends on captions, cards and translation, a tool that silently fails is worse than no tool, and today nobody checks that these tools still work for that person, on their phone, on venue Wi-Fi, after this morning's deploy.

Evidence: in T4 the browser's own speech engine skipped whole sentences and died after about 33 s with no warning. Research 04 notes that auto captions are "not considered equivalent" by DHH attendees, and that schedule apps and maps are often inaccessible. Wordly has no visible health signal for the attendee.

**P3. The first-timer's overloaded day.**
> A first-time attendee cannot turn 600 sessions in two buildings, with naive local times, into a day they can actually walk and remember.

Evidence: the Sessionize feed has 600 sessions, 37 room paths, naive times and two buildings, Salt Palace and Hyatt (proposal A, T5).

### 1.2 Recommendation: P1 as the *who and where*, P2 as the *promise*

One sentence for the README, the slide and the 10-second pitch:

> **KubeCompanion gives Deaf, hard-of-hearing and non-native-English attendees the access KubeCon stops providing at the talk-room door (captions, communication cards, translation and quick capture in the hallway), and it keeps that access trustworthy: every access feature is reviewed for inclusion before it ships, measured while Kay uses it, and kept healthy on the cluster.**

Why this one:
- **P1 alone** is a feature list. Wordly, a notes app or a phrasebook app each cover part of it, and the sponsors stay decorative.
- **P2 alone** is abstract: "reliability" without a person.
- **P1 + P2 together** make the guarantee part of the product. The three sponsors are *how* the guarantee is kept:
  - Gitar: reviewed before it ships.
  - Dash0: measured while Kay uses it.
  - Radar: kept healthy on the cluster.
- **P3 (the schedule)** stays as supporting value, not the headline. Every team will build a schedule app (research 10 §0, "baseline everyone will copy").

Say it out loud as a contrast: "Wordly works in the room. KubeCompanion works in the hallway, and it tells you when it isn't working."

### 1.3 The removal test (honest version)

Question asked of each sponsor: *if it were removed, does the product get worse for Kay, or only for us?*

| Removed | What Kay loses | Kay or us? | How to make it more clearly Kay's loss |
|---|---|---|---|
| **Gitar** | Kay would see the problems it currently prevents:<br>• an English-only "Can you repeat that?" card (G1)<br>• a card that fails contrast in bright hallway light (G5)<br>• a schedule with times off by 7 hours (time-zone rule)<br>• an agenda slowed by an N+1 query that production already flagged (G4)<br><br>Axe in CI catches contrast and missing names, but it cannot check "every key exists in ES", "plain language" or "no speaker data in fixtures". | **Mostly Kay, indirectly.** Kay never sees Gitar, so the loss is real but invisible. | Write Kay's guarantees as one file of **Access promises** (§2, move 1). Gitar enforces it, the app shows it and Dash0 measures it. Gitar then becomes the enforcement of a promise Kay can read. |
| **Dash0** | The fleet-wide half of D2 would be gone:<br>• Kay no longer hears "captions are lagging for everyone, not your phone"<br>• new caption sessions no longer start on the engine that is faster right now<br>• the Status screen's "Wi-Fi or us?" becomes a guess<br>• G4 has no production numbers to write rules from<br><br>The client-side switch after 3 slow chunks would still work without Dash0. | **Kay, directly** (the fleet-wide view), plus us. This passes the test. | Make D2's server half visible on the Captions screen itself, not only on Status. Tie promise lights to the same PromQL poll (§2, Dash0). |
| **Radar** | Today, nothing visible: at most a footer link ("Radar all-clear"). | **Us only.** This fails the test. | Be honest: Radar is the operator's tool. The most credible Kay-facing version is that "fixed" is only claimed after the cluster confirms it (§2, Radar), and even that is a weak link. Do not force more. |

Verdict:
- The recommended statement makes **Dash0** necessary.
- It makes **Gitar** necessary once the promises file exists.
- It leaves **Radar** as an honest operator role, which matches its stretch status in CLAUDE.md.

Do not claim in the pitch that Radar changes Kay's experience. Claim that "the cluster confirms every fix before Kay is told it is fixed".

---

## 2. "More than assistants": role by sponsor

The map for every sponsor below:
- **Assistant role:** it helps us build.
- **Product role:** its capability *is* part of what Kay gets.
- **Push further:** credible within 6.5 h, parallel agents and the 4 GiB cluster.
- **Gimmick flag:** looks clever, does nothing for Kay.

### Move 1 (cross-sponsor, recommended): Access promises, one file and three enforcers

A file `ACCESS-PROMISES.md` holds 4 to 6 promises, each written for Kay *and* testable. Examples:
1. "Every card and screen is in your language (EN and ES)."
2. "Captions reach your screen within 3 s, or we switch engines and tell you."
3. "A note saves in under 0.5 s, or we tell you whether it's your Wi-Fi or us."
4. "Every screen works with large text and high contrast."
5. "We never store a speaker's name or your contacts on our servers."

Each enforcer uses the same file:
- **Gitar:** `inclusion.md`, `accessibility.md` and `hot-paths.md` cite the promise numbers ("Promise 1: every new key needs an ES entry"). Findings then read as "this PR breaks Promise 1".
  - Put the sentence in the rule files themselves. The include syntax (`@../`) is unverified.
- **Dash0:** promises 2 and 3 are the SLIs that already exist (caption lag per engine from D2, and the capture p95 `kc_capture_saved_ms` from B/F). Each becomes a light on the Status screen, fed by the 30 s PromQL poll F already plans.
- **Radar:** the footer "last release confirmed healthy in the cluster" (R4) becomes the line under the promises.

Kay sees a short, plain "What we promise you" block with live green or amber per promise. This is not the cut G2 Trust page. It shows no PR list and no review talk, only Kay's guarantees and their live state.

- **Cost:** about 45 min, split between D (copy, rendering, EN/ES) and F (lights from `/api/status/health`).
- **Gimmick risk:** low if the block stays short and plain. High if it grows into badges and links to GitHub.

### Gitar

| | |
|---|---|
| **Assistant role (now)** | Reviews every feature PR and cites `time-zones.md` and `external-calls.md`. Fixes the Sessionize schema drift kept outside the PR (G). |
| **Product role (in the plan)** | **G1:** the inclusion rules make the review process protect Kay. The English-only card is caught on D's PR.<br>**G5:** a contrast regression is fixed by Gitar under "fix the token, never weaken the test".<br>**G4:** production writes review rules, so Kay's real slowness becomes a review constraint. T10 PASS. |
| **Push further** | 1. **The promise numbers in the rules** (move 1). Gitar's findings speak Kay's language.<br>2. **Fix a T10 gap now: put the production number inside the rule sentence**, for example "Promise 3: /api/agenda p95 was 2.1 s at 15:52; changes must not call the database inside a loop". T10 showed Gitar quotes the rule sentences but never the generated header. The G proposal currently puts the numbers in the header, so on stage the "production wrote this" line would not appear in Gitar's output.<br>3. **G3 is now eligible.** T8 passed, and G's own proposal says G3 replaces G5 "if T8 passes". Recommend **keeping G5 as the Kay beat** (it protects disabled users, the point of this document) and running G3 only as a Radar tie-in if time allows. This is a user decision (open question below). |
| **Gimmick flag** | A "Gitar-reviewed" badge on Kay's screens. Showing PR lists to Kay (the G2 cut stands). |

### Dash0

| | |
|---|---|
| **Assistant role (now)** | Instrumentation from the first commit (C0). Agent0 finds the agenda N+1 query (F, Route A organic or Route B at 15:45). Perses dashboard and check rule as code. |
| **Product role (in the plan)** | **D2 adaptive captions:** the caption SLI per engine changes what Kay gets (the engine switch plus "everyone, not you").<br>**F Status screen:** "saved in 180 ms" and "Wi-Fi or us?".<br>**C:** the daily cost cap flips threading to the heuristic. |
| **Push further** | 1. **Promise lights** from the same poll (move 1, no new query).<br>2. **Show the fleet-wide caption line on the Captions screen itself**, in the live region, not only on Status. That is where Kay is looking, and it makes "observability is part of the product" visible in the CfE beat.<br>3. **D3, the Agent0 sentence translated for Kay:** keep it conditional. No T7 result is recorded, so treat it as unverified and out of the plan unless T7 is run and is under about 20 s. |
| **Gimmick flag** | **C's "trace summary in the UI with a Dash0 deep-link"** is for judges, not Kay. Put it behind a "How this works" disclosure on the Threads screen, or in the demo only. Do not put it in Kay's main flow.<br>D1 (accessibility telemetry) stays killed for privacy. |

### Radar

| | |
|---|---|
| **Assistant role (now)** | Ships through Argo CD and Radar MCP (`manage_gitops`, `get_changes`, logs). One all-clear investigation (stretch). |
| **Product role (credible)** | Only one, and it is thin: **"fixed" is never claimed to Kay until the cluster confirms it.** After the Agent0 fix deploys, the operator runs Radar's investigation ("did release X regress anything?"), marks it Shared, and sets the Status footer from "fix rolling out" to "fixed 15:58, confirmed healthy". Set it by hand through a ConfigMap value; Radar MCP from a script is unverified. This is X3 without the unverified hops. |
| **Push further (dev-side, honest)** | **R3, two AI SREs:** Agent0 and Radar investigate the same agenda slowdown, so judges see where they agree. Demo time only, about 0.75 h.<br>**G3 + R2:** the quota overrun is diagnosed by Radar and fixed by Gitar in YAML (T8 PASS). It ties two sponsors, but it is operator value only.<br>**Investigate an organic event:** prefer one that will happen anyway, such as `exceeded quota` on the first sync or a CNPG readiness flap (research 07 §3.3), over a staged one. That satisfies "investigate a real issue". |
| **Gimmick flag** | Any Radar status widget, cluster map or pod count shown to Kay. Kay has no use for it. |

### The top three moves

1. **Access promises** (move 1). This is what makes Gitar necessary in the removal test and turns the problem statement into a visible artifact.
2. **D2 moved onto the Captions screen, plus promise lights.** Dash0 telemetry changes Kay's captions at the moment Kay needs them.
3. **G4 with the number in the rule sentence.** Production data reaches Gitar's review text verbatim (fixes the T10 gap), and the rule names the promise it protects.

---

## 3. Coverage matrix

Strength: **S** strong, **P** partial, **N** none. "Cheapest cover" is filled in only where the strength is P or N.

### 3.1 Never Merge Broken (Gitar)

| Row | Covered by | Strength | Cheapest cover if not strong |
|---|---|---|---|
| Idea 1: schedule builder, every feature through a Gitar PR, time-zone rule | A + `time-zones.md` (C0), 8 changes all via PRs | S | – |
| Idea 2: rule that checks the frontend still matches when the API changes | Nothing direct. G's `feed-contract` is an upstream contract, not API-to-frontend. | N | 15 min in C0: `.gitar/review/api-contract.md`, "a PR that changes `api/src/routes/*` must update `web/src/api/*` types in the same PR". Wave 1 runs A, B and F in parallel, so it will fire for real. |
| Idea 3: break CI on purpose, auto-apply fixes it live | G feed drift (beat 5), plus G5 or G3 | S | – |
| Criterion: Gitar part of how you built, not one PR at the end | All 8 changes land as Gitar-reviewed PRs; G1's D PR 0 lands first | S | – |
| Criterion: project-aware review instructions and repository rules | C0's 5 rule files, G1 inclusion, G4 rules from production, `AGENTS.md`, merge-queue ruleset | S | Add the promise numbers (move 1) |
| Criterion: CI failure diagnosis and auto-apply on real problems | G feed drift (external, outside the PR), G5 a11y token, G3 eligible (T8) | S | – |
| Criterion: conferences easier | G1 and G5 protect Kay's cards | S | – |

### 3.2 Stop Flying Blind (Dash0)

| Row | Covered by | Strength | Cheapest cover if not strong |
|---|---|---|---|
| Idea 1: self-diagnosing multi-service app, chaos button, Agent0 finds the cause | One Node service plus Postgres and browser (C0); `kc-chaos` ConfigMap (F); Agent0 Route A or B | P (not multi-service; no button) | Do not split services: it costs budget and adds nothing for Kay. Describe it honestly as "browser, API, Postgres and CI traced end to end". A chaos *button* is optional: a hidden admin toggle that patches the ConfigMap, 20 min. Skip unless asked. |
| Idea 2: live crowd map, check-ins as metrics, dashboard | Nothing (H is out of scope) | N | H-lite: calm/busy/loud per room, anonymous counter, one panel, about 1 h, with the same privacy care as D1. Skip (see §4). |
| Idea 3: "My agenda" slowed after the keynote, Agent0 explains | F Route B at 15:45 (50-user load, N+1 query); A's handler | S | – |
| Idea 4: attendee AI assistant traced with OpenLIT (every LLM call, token, cost) | C threads and E translate, with GenAI spans, tokens, cost and the daily cap | P to S (GenAI semantic conventions, not the OpenLIT SDK) | Say "OpenLIT-compatible GenAI semantic conventions". Adopting the OpenLIT SDK itself is unverified for our Node setup. Not worth the risk. |
| Criterion: depth of instrumentation (traces, logs, metrics, RUM) | C0 NodeSDK, pino logs, web SDK RUM (T2); CI traces (G); X1 Synthetic Kay | S | – |
| Criterion: Agent0 or MCP finds and fixes something real during the day | F Route A (organic) first, Route B as backup; Agent0's PR goes through Gitar | S if Route A finds something real, P if only Route B (staged) | Run Route A at both planned times (about 12:30 and 14:00). Use Dash0 MCP in Claude Code during the build and note each use for the demo. |
| Criterion: observability part of the product, not bolted on | F Status screen, D2 adaptive captions, C's cost cap, promise lights | S | Move D2's line onto the Captions screen (move 2) |
| Bonus: dashboard or SLO showing app health | Perses dashboard as code, check rule, synthetic check; SLO only if the beta is enabled | S | Ask about the SLO beta at kickoff (already on the timeline) |
| Criterion: conferences easier | D2, Status screen | S | – |

### 3.3 Radar / AI SRE

| Row | Covered by | Strength | Cheapest cover if not strong |
|---|---|---|---|
| Idea 1: talk picker that reads your GitHub, builds your schedule, reshuffles when a room fills | A agenda (manual picks, building warning). No GitHub, no reshuffle. | N to P | Reshuffling needs crowd data (H). Reading GitHub adds a login, and the plan has no accounts. Skip. |
| Idea 2: hallway-track matchmaker | Nothing | N | Skip: it needs personal data from other attendees (rule 4, privacy). |
| Idea 3: live crowd map (packed rooms, shortest coffee line) | Nothing | N | Same as Dash0 idea 2 (H-lite). Skip. |
| Criterion: run on Kubernetes with Radar connected | Event cluster, Argo deploy (C0, G) | S | – |
| Criterion: Radar UI and MCP used throughout building and operating | MCP sync, logs and `get_changes` after each merge (07 §3.3) | P (planned, stretch) | Zero build cost. Make "every merge synced and checked through Radar MCP" a line in `AGENTS.md` so every agent does it. Take before and after screenshots of Checks. |
| Criterion: Radar AI investigation of a real issue, show what you learned and did | One all-clear (stretch); R3; organic quota or CNPG events | P | Investigate the first real event (quota on first sync, or a probe flap) and act on it through a PR. R3 at 15:45. Mark it Shared. |
| Criterion: conferences easier | Only through uptime and the "confirmed fixed" footer | P | Use the "fixed only after the cluster confirms" line (§2). Do not push further. |

### 3.4 Find the Right Talk (Elasticsearch)

| Row | Covered by | Strength | Cheapest cover if not strong |
|---|---|---|---|
| Idea 1: semantic talk search ("eBPF and security") | Nothing (A has filters by day, room and track) | N | Elasticsearch would need its own memory on a 4 GiB cluster already planned to the limit (G3/T8 shows how tight it is). Running it on the laptop with start-local makes it not part of the deployed app. |
| Idea 2: matchmaker with vectors | Nothing | N | Skip (privacy, as for Radar idea 2) |
| Idea 3: RAG assistant over every talk abstract | Nothing (C uses Claude only on Kay's own notes) | N | Skip |
| Criterion: Elasticsearch is the core data layer | Nothing (Postgres) | N | Cannot be met partially: "core data layer" rules out adding it on the side. |
| Criterion: smart search (keyword, semantic, vector, hybrid) | Nothing | N | – |
| Criterion: conferences easier | n/a | N | – |

### 3.5 Conferences for Everyone (Merge Forward)

No criteria are published, so the rows are Merge Forward's seven sub-groups (research 04 §1.3, "a ready checklist of audiences") plus ESL.

| Row | Covered by | Strength | Cheapest cover if not strong |
|---|---|---|---|
| Deaf and Hard of Hearing | D cards and show-to-person; E captions and highlight-to-note; B dictation | S | – |
| Non-native English (not a sub-group, but Kay) | D i18n (EN/ES, PT-BR, AR RTL smoke); E translation; plain-language rule (G1) | S | – |
| Blind and Visually Impaired | D large type, high contrast, Atkinson font; WCAG 2.2 AA; axe gate; TTS on cards | P (low vision yes; screen-reader flow not tested) | 20 min: one VoiceOver pass on the capture and cards flows, recorded as a check in the a11y runbook. Add "every image has alt text" to `accessibility.md`. |
| Stuttering and Speech Diversity | D cards let Kay communicate without speaking; text-first capture | P to S | 5 min in D: add a preset card, "I stutter, please give me time". It costs almost nothing and names the group. |
| Neurodiversity | Reduced motion, "quiet please" badge, building-change warning lowers rushing | P | 20 min in D: a **static** list of calm places (quiet rooms 260A and 260B at Salt Palace L2, prayer room at Hyatt L5, nursing room, child care), taken from the public KubeCon page. No telemetry, so no privacy issue. |
| Women in Cloud Native | Nothing specific (the Women + Non-Binary Quiet Room 260B fits in the static list) | P after the static list | Covered by the 20-min list above |
| Friends of Dorothy (LGBTQ+) | Pronoun and communication-preference badge, stored only on the device | P | – (enough) |
| Deep Roots | Nothing | N | Skip: no credible feature in scope |
| All tracks: conferences easier | Whole product | S | – |
| Best overall | No criteria published | – | The problem statement (§1.2) is the answer |

---

## 4. Gaps

### Worth closing (cheap and high value), about 2 agent-hours in total

1. **The G4 number goes into the rule sentence, not the header.** 0 min of build: a wording change in G's generator. Without it, the stage line "production wrote this rule" is not visible in Gitar's output (T10).
2. **Access promises file and Status block** (move 1), about 45 min, D + F. It makes Gitar pass the removal test and gives the problem statement a visible artifact.
3. **D2's fleet-wide line on the Captions screen**, about 15 min in E. The strongest Dash0-as-product moment, placed where Kay is looking.
4. **Gitar idea 2, the API-to-frontend contract rule**, about 15 min in C0. It closes an organizer idea and will fire for real during wave 1.
5. **Static calm-places list and stutter card**, about 25 min in D. They add the Neurodiversity, Women in Cloud Native and Stuttering sub-groups at no privacy cost.
6. **Radar: an organic investigation plus "MCP after every merge" in `AGENTS.md`**, 0 build hours. It lifts two Radar criteria from P towards S.

### Consciously skip

- **The Elasticsearch track.** "Core data layer" cannot be met partially, and the 4 GiB cluster has no room for it. Already out of scope (map).
- **Matchmaker** (Radar idea 2, Elasticsearch idea 2). It needs other attendees' personal data, against rule 4 and the brief's privacy rule, and Merge Forward judges would notice.
- **Crowd map and talk-picker reshuffle** (Dash0 idea 2, Radar ideas 1 and 3). They need crowd telemetry with the same privacy review that killed D1. Revisit only if wave 1 merges by 13:30, matching the existing go/no-go.
- **Splitting into microservices** for Dash0 idea 1. It costs budget and adds nothing for Kay. Describe the honest end-to-end trace instead.
- **The OpenLIT SDK.** GenAI semantic conventions already give the same picture; the SDK is untested.
- **D3, the Agent0 sentence shown to Kay.** Leave it out unless T7 is actually run and passes (no result is recorded).
- **Any Radar or Gitar widget in Kay's UI** beyond the promise block and the footer: gimmick.

### Open questions for the user

1. Adopt the recommended problem statement (§1.2) as the README and slide headline?
2. G5 vs G3: T8 passed, and G's proposal says G3 then replaces G5. Recommendation: keep G5 (the accessibility beat), with G3 optional. Please confirm.
3. Add the Access promises block (move 1)? It overlaps in spirit with the cut G2, but it shows no review content.
4. Run T7 tonight, or drop D3 for good?
