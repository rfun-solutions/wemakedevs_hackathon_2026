# KubeCompanion: What & Why

Nov 8, 2026 · @Rohit Khattar

KubeCompanion is a phone-first KubeCon companion built solo at the WeMakeDevs Cloud Native Hackathon on Mon Nov 9, 2026; this doc is the single running record of what we are building and why, kept current by every agent on the project.

## What we're building

A mobile-first web app (installable PWA) that gets Kay, a hard-of-hearing first-timer whose second language is English, through KubeCon week. Scope is set: the Lean + Core bundles, 8 OpenSpec changes, plus the accepted innovation set. Specs live in `wemakedevs_hackathon_2026/openspec/changes/`.

### Features Kay uses

| Feature | What Kay gets | Change | Tracks it scores |
| --- | --- | --- | --- |
| Schedule and My agenda | Sessions by day, room and track; a saved agenda; a warning when back-to-back talks are in different buildings (10-minute walk) | A | Conferences for Everyone; Dash0 (the agenda slowdown story); Gitar (time-zone rule) |
| Fast capture | Notes, people met, promises; keyboard first with a dictation button; saved on the phone in under 500 ms and synced when online | B | Dash0 (capture SLO); Conferences for Everyone |
| Access kit | Communication cards ("I'm deaf, please type") with show-to-person and text-to-speech; large type, Atkinson Hyperlegible, high contrast, reduced motion; English and Spanish (Portuguese and Arabic at smoke level); a stutter-friendly card; a calm-places list (quiet rooms, prayer room, nursing room, child care); WCAG 2.2 AA | D | Conferences for Everyone |
| Live captions and translation | Near-live captions (browser speech on iPhone; Whisper in about 5 s chunks on desktop Chrome, with browser speech as fallback; works the same in the Home Screen app, with auto-restart if the speech session ends); highlight a line to save it as a note; translation (Chrome on desktop, Claude Haiku on phones) | E | Conferences for Everyone; Dash0 |
| Adaptive captions: "everyone, not you" | Switches to the faster caption engine when chunks run slow, and tells Kay when the slowdown is everyone's, not their phone | E + F | Dash0 (headline) |
| Evening threads | Each evening, notes grouped into threads that build across the week by Claude Haiku, with a rule-based fallback and a cost cap. Every thread ends in next steps: follow-ups and promises to act on | C | Dash0 (every LLM call traced) |
| Status screen | "Saved in N ms", schedule freshness, "is it the Wi-Fi or us?", and a footer "Last release HH:MM, Gitar-reviewed, Radar all-clear" | F | Dash0; Gitar; Radar |
| Access promises | Five promises Kay can read (P1 to P5, e.g. captions within N s, usable at large type, notes work offline). Each shows a live light, and shows "not measured right now" rather than green when there is no data | D (words) + F (lights) | Gitar rules cite them; Dash0 measures them; Radar backs them |
| Under the hood | An in-app screen showing, for every feature, what it does and which sponsor tech it uses, with live data; plus a designed docs/how-it-works page on GitHub Pages for judges | H (new, wave 2); each change adds one registry file | All tracks (presentation) |

### Behind the scenes (what judges see)

| Capability | What it does | Change | Track |
| --- | --- | --- | --- |
| Feed contract and schema-drift break | CI checks the schedule feed; the demo break flips the feed format outside the PR, so Gitar must fix the mapper | G | Gitar |
| Production telemetry writes review rules | A workflow turns Dash0 response times into `.gitar/review/hot-paths.md`; Gitar then reviews PRs on hot routes more strictly | G | Gitar (headline) |
| Inclusion review rules | Gitar rules for Deaf/ESL inclusion, plain language and demo-data privacy | C0 + D | Gitar; Conferences for Everyone |
| Accessibility regression fixed by Gitar | Primary: a staged PR pushes the cluster over its 4 GiB budget and Gitar lowers only the request that PR raised (proven in T8). Second: a staged PR breaks axe and a rule forbids weakening the test | D + G | Gitar |
| Two AI SREs on one incident | Agent0 and Radar investigate the 15:45 slowdown side by side; Radar's all-clear is linked in the Status footer | F | Radar (headline); Dash0 |
| Synthetic Kay | A Playwright run as Kay every 5 minutes, sending browser monitoring as kc-web-kay, plus a Dash0 synthetic check | F + C0 | Dash0 |
| Chaos switch | App-level latency and errors on one route, never cluster-level, for the backup Dash0 demo | F | Dash0 |
| Agent0 explains to Kay | A cached plain-language explanation in Kay's language, asked once per slowdown (Agent0 takes 32 to 42 s, so never live) | F | Dash0 |
| API-to-frontend contract rule | A Gitar rule that checks the frontend still matches the API whenever the API changes (the sponsors' Gitar idea 2) | C0 | Gitar |
| Unstaged Radar investigation | Radar investigates a real event that happens anyway; agents check the cluster with the Radar MCP after every merge | C0 (AGENTS.md) + F | Radar |

### How it fits together

&#91;embedded content: runtime architecture · phone, one service, sponsors around it\]

Kay's phone talks to one Node service on the event cluster. Telemetry goes straight to Dash0, Claude handles threads and phone translation, and Radar watches the cluster.

## Why

Every track is judged partly on "how well it makes conferences easier". The problem: at a conference you have more conversations and ideas per hour than you can remember, and for Deaf, hard-of-hearing and non-native-English attendees the access KubeCon provides stops at the talk-room door. KubeCompanion lets anyone capture a thought or a conversation in seconds, and AI organizes the week into threads you can act on later. It also carries captions, communication cards and translation into the hallway. Every access feature is reviewed for inclusion before it ships, measured live while you use it, and kept healthy on the cluster. The opening hook is the user's own: "I forget every conversation I had an hour ago."

| Attendee problem | What answers it | Track it scores |
| --- | --- | --- |
| Ideas from talks get lost | Fast capture, evening threading | All ("conferences easier") |
| Language, hearing or reading barriers | Captions, translation, text-to-speech, communication cards | Conferences for Everyone |
| The app is slow or broken when everyone opens it after a keynote | OpenTelemetry, browser monitoring, Agent0 finds and fixes the cause live | Dash0 |
| A deploy breaks because an outside system failed | Gitar diagnoses the CI failure and auto-applies a fix | Gitar |
| Something fails in the cluster | Radar's AI investigation | Radar (stretch) |

KubeCon already offers Wordly captions in 60+ languages, quiet rooms and child care. It has no ASL interpretation, sensory guidance or dietary information, so those are open gaps for us to fill.

## Decisions so far

Newest first. Add a row whenever a decision is made, by anyone or any agent.

| Date | Decision | Why |
| --- | --- | --- |
| Nov 9 | Completion ledger, used as a hard gate. For each PR, the agent records what it built, the files it changed and how it checked them in COMPLETION-LEDGER.md. The orchestrator fact-checks each entry against the real commit. It turns on auto-merge only after marking the entry VERIFIED. Agents never run gh pr merge. | The user wants proof that a green flag is real, not just claimed. The orchestrator re-runs the agent's checks itself and compares the claims with the code changes. |
| Nov 9 | Commits start before 10:00. Runbook step 1 is done: cnh-starter@f70c7d6 is on main as a clean copy, main is the default branch and the repo is public. | The user checked with the organizers. An early start gives the build more time. |
| Nov 8 | Captions engine per platform: iPhone uses the browser speech API only (Whisper is never loaded there); desktop Chrome uses Whisper first. The engine-switch part of the adaptive-captions beat is demoed on the presenter laptop; "everyone, not you" works on both. E stays in Core | T4 on the user's iPhone: browser speech worked well, Whisper crashed the Safari tab on transcribe (likely the iOS memory limit) |
| Nov 8 | Build day: build agents append their updates to RUNNING-LOG.md; only the orchestrator writes this doc, syncing from the log. Parallel-plan fixes R1 to R15 applied (markers in shared files, C0 placeholders and up-front dependencies, three C0 agents); 9 changes validate | Up to 8 agents must not collide in one doc; the user still sees everything via the orchestrator |
| Nov 8 | Keep the Agent0 explanation (D3): on a slowdown, Agent0 is asked once, and the Status screen shows its cached plain-language cause as "Agent0, N s ago", translated and labelled AI-generated | The clearest case of Dash0 being part of what Kay sees; T7 showed 32 to 42 s per answer, so it is cached and asynchronous |
| Nov 8 | Proposals updated with the evening decisions; now 9 changes (new H: Under the hood), all validate. Access promises P1 to P5; threads end in next steps; the budget break runs once beforehand as repo evidence and the accessibility regression is the on-stage fix | H is separate so it can run in parallel with E and C; F is already 2 to 3 agents |
| Nov 8 | Problem widened to everyone who loses conversations and ideas (the user's own hook: "I forget every conversation I had an hour ago"), plus Deaf, hard-of-hearing and ESL access beyond the talk room. Access promises added. Coverage gaps closed (API-to-frontend contract rule, stutter card, calm-places list, unstaged Radar investigation). On-stage Gitar fix: the accessibility regression, with the budget break kept as repo evidence. Every feature shows its tech in an in-app "Under the hood" screen plus a designed page in the repo. Reviewer decisions approved: Fastify + Preact + pg, C0 as two agents, translate 15 per minute plus a daily cap, demo seeding only in rehearsal and the demo | User decisions, Nov 8 evening (research/11 and 12) |
| Nov 8 | Innovation set built into the proposals (all 8 still validate). Budget break (G3) is the primary staged Gitar fix, accessibility regression (G5) second. Rules from production put live Dash0 numbers inside each rule sentence. G, E and F now each run as two agents | T8 and T10 passed. Gitar quotes rule sentences, not file headers. The extra scope needs more agents to stay within time |
| Nov 8 | Tomorrow: run as many agents as can SAFELY run in parallel; a parallel-safety plan is written once the proposals are final | User has been burned by parallel agents colliding |
| Nov 8 | Innovation set accepted. Gitar: production telemetry writes review rules (G4). Dash0: captions that adapt to live telemetry, "everyone, not you" (D2). Radar: two AI SREs on one incident, plus the all-clear in the Status footer (R3, R4). Supporting: inclusion review rules (G1); accessibility regression fixed by Gitar (G5, or a budget break G3 if T8 passes); Synthetic Kay (X1). Killed: D1, X2, G2, D4, D5, R1, R5 | Beyond the sponsors' own examples; about 5.75 extra agent-hours. Fable and Claude iteration in research/10 |
| Nov 8 | Cross-review fixed interfaces between the 8 proposals: telemetry names kc.\<domain>.\<op>; one chaos reader (F); G owns the Sessionize baseline and A extends it; one LLM complete() shape; one seeding endpoint (B); G owns deploy.yaml; translate 15 calls per minute | Parallel agents must build against the same files and signatures. .scratch/kubecompanion/proposal-review.md |
| Nov 8 | Wayfinder round 1 (all recommendations accepted): destination = 8 checked OpenSpec proposals + runbook; captions = Whisper in \~5 s chunks with the browser speech API as fallback (final after the iPhone test); one shared speech module owned by E; phone translation via Claude Haiku; UI in EN + ES (PT-BR, AR smoke); no logins, anonymous device ID, Postgres; no speakers in the fixture; Radar minimum = before-screenshot + one all-clear investigation, J only if wave 2 is merged by 15:00; design pick at \~11:05; Sonnet builds, Opus reviews | Narrow the plan today. Details in .scratch/kubecompanion/map.md |
| Nov 8 | OpenSpec initialised in the clone (uncommitted). 8 proposals being written in parallel against one shared brief of interfaces and ownership | A shared brief keeps parallel changes from colliding tomorrow |
| Nov 8 | Target repo cloned to 2026/hackathon/wemakedevs\_hackathon\_2026 tonight. Files may sit in the working copy before kickoff, but nothing is committed until after kickoff | User: what matters is the commit history; agents there inherit 2026/hackathon/CLAUDE.md |
| Nov 8 | Target repo made PUBLIC now (still empty), replacing "private until submission" | T6b: on GitHub Free a private repo enforces no rulesets, protection or merge queue |
| Nov 8 | Target repo stays PRIVATE until submission; Gitar is installed on the rfun-solutions org | User choice. Caveat being tested (T6b): on GitHub Free, private repos may lose rulesets and the merge queue |
| Nov 8 | GitHub org rfun-solutions created. Merging: merge queue (P1) if tonight's org test passes, else PR-only with "up to date" off (P3) | T1 showed the merge queue and bot exemptions only exist for organizations |
| Nov 8 | Deploy bot: a dedicated GitHub App (O2) exempted from branch protection | Cleaner than a personal token; clear audit trail |
| Nov 8 | Kay's style: A2, flat vector | Most consistent across views; reads best at slide size |
| Nov 8 | Dash0 tokens: full-access DASH0\_TOKEN on the server only; DASH0\_INGEST\_ONLY in browser bundles | Browser tokens are public by design |
| Nov 8 | Browser automation allowed for this project; T3 operator test on a local k3d cluster | User approval |
| Nov 8 | Branch protection ON, real-world flow: every change on its own branch, merged to main only by PR with required CI checks and Gitar review | Mirrors real multi-contributor work; worth the extra rebasing time |
| Nov 8 | Target repo is github.com/rfun-solutions/wemakedevs\_hackathon\_2026 (moved from rfun on Nov 8); nothing goes in it before kickoff. Step one tomorrow: bring the plan and research in, then design and build there | Code starts after kickoff; Gitar is already installed on it |
| Nov 8 | LLM: the user's Claude API key, $20 of credits; Haiku 5.5 by default, Sonnet 5.5 where quality needs it | Estimated $0.50–2 on Haiku or $10–15 on Sonnet for dev and demo; keep the LLM out of the load test |
| Nov 8 | Character art: several style options for the user to review before any scenes are made | User wants to pick the look |
| Nov 8 | Scope: Lean + Core bundles from research/07 (C0, A, B, D, G, F, then E, C; about 7 agents). Ambitious items (quiet map, icebreakers, Radar canary) not planned | User choice after the deep plan |
| Nov 8 | Stack: one Node 22 service (API + static PWA) with CloudNativePG Postgres | Fits the 4 GiB event-cluster budget; matches the starter app |
| Nov 8 | Demo: one character (Kay), plus a pre-recorded backup video; 15:45–16:45 kept for staging | Simpler story; safety net if live demos fail |
| Nov 8 | Live tests run in github.com/a throwaway test repo (public); OpenSpec stays on 1.15.0; Claude in Chrome allowed for gemini.google.com to make the character images | User choices; Gemini in the browser needs no API key |
| Nov 8 | Running doc (this one) is mandatory for every agent | The user needs to understand what is happening at every moment, across agents |
| Nov 8 | Methodology: research + wayfinder today, OpenSpec propose today, apply tomorrow | Specs ready before kickoff; code written after kickoff |
| Nov 8 | Specs before kickoff are fine | The user's reading of rule 1: specs are notes and research, not build material |
| Nov 8 | Every integration gets a live test in a throwaway test repo before it goes into the plan | Gitar's handling of external failures and the Dash0 operator's fit are undocumented or unverified |
| Nov 8 | Design with the Impeccable plugin; design options go to the user for review; mobile-first, and CI tests focus on mobile | Avoid generic AI-looking UI; attendees use phones |
| Nov 8 | Runtime: the Radar event cluster | Public URL and Argo CD come with it; the Dash0 operator may not fit (to be tested) |
| Nov 8 | Tracks: Gitar + Dash0 primary, Radar stretch with a ready plan, Conferences for Everyone woven through | Depth over breadth; Radar picked up only if time allows |
| Nov 8 | Build every Conferences for Everyone finding into the app; test transcription options | Accessibility runs through the whole app |
| Nov 8 | Scope is sized by how many agents run in parallel, not one developer's hours | Build is agent-driven; single-dev hour estimates don't apply |
| Nov 8 | Solo, app name KubeCompanion | User decision |

## Tracks

Gitar and Dash0 get the depth. Radar is planned before kickoff but built only if time allows. Conferences for Everyone runs through the whole app.

| Track | Role | What judges must see | Known risk |
| --- | --- | --- | --- |
| Never Merge Broken (Gitar) | Primary | Several Gitar-reviewed PRs across the day, custom rules in `.gitar/review/`, CI diagnosis and auto-apply. Our angle: a CI step that depends on an external system breaks, and Gitar fixes it | Gitar's docs don't say how it handles external or infra failures, so we test it live first |
| Stop Flying Blind (Dash0) | Primary | Traces, logs, metrics and browser monitoring; Agent0 or the MCP finds and fixes a real issue live; bonus dashboard or SLO | Operator likely refused on the event cluster; SLOs are a private beta |
| AI SRE (Radar) | Stretch | Runs on Radar's cluster; Radar UI and MCP used; at least one AI investigation | Starter says don't break things on purpose |
| Conferences for Everyone (Merge Forward) | Woven in | Makes conferences more inclusive and accessible | Browser speech and translation APIs don't work on every phone, so cloud fallbacks are needed |

Runtime is the hackathon's event cluster: Radar itself is not a hosting product, but for this event Skyhook (Radar's maker) gives each team its own vcluster with Radar connected (2 CPU / 4 GiB requests, public URL, Argo CD pre-installed; join code at kickoff; it ends Fri Nov 13). Fallback: a cluster we bring, which still counts for judging.

## Process

Research and specs happen today; code starts at the 10:00 kickoff tomorrow.

1. **Research (done for round 1):** six research files in `2026/hackathon/research/`. Use `/research` for narrow follow-up questions.
2. **Live tests (today):** a throwaway test repo checks Gitar, the Dash0 SDK and operator, and transcription options before anything goes into the plan.
3. **Deep analysis:** the `deep-planner` session gets handoffs and suggests ideas. Round 1 is in research/07-deep-plan.md: three scope bundles (Lean, Core, Ambitious) split into parallel agent changes with a merge order, the cluster architecture and Dash0 fallback paths, the Gitar, Agent0 and Radar demo stories, the cartoon storyline, and today's live-test plan.
4. **Wayfinder (today):** `/wayfinder` maps the open decisions into tickets.
5. **Scope discussion (today):** sized by how many agents can run in parallel.
6. **OpenSpec propose (today):** one `/opsx:propose` per change, checked with `openspec validate --strict`.
7. **Design (tomorrow, after kickoff):** Impeccable produces mobile-first design options for review.
8. **Apply (tomorrow):** `/opsx:apply` by parallel agents, each change through a ledger-verified, Gitar-reviewed PR, deployed by Argo CD on the event cluster.
9. **Demo (17:30 deadline):** the cartoon attendee's story, with one struggle per feature.

Event day timing: 9:00 check-in, 10:00 kickoff and Radar talk, 11:00 to 17:30 build, 17:30 submission and demos, 18:30 winners.

&#91;embedded content: delivery loop · 9 steps, one feedback loop\]

Every change reaches Kay through Gitar review, the merge queue, the deploy bot and Argo CD. The accent loop is the Gitar headline: Dash0 response times are written into review rules.

## Live test results

What the tests today proved, so the plan rests on facts. Details in `research/08-live-tests/`.

| Test | Result | What it means for the build |
| --- | --- | --- |
| T1 Gitar | Fixed schema drift and a 429 in code in about 2.5 min; on an expired certificate it only undid our chaos change | Schema drift is the demo break; any infra break must live outside the PR |
| T1 GitHub | Personal repos have no merge queue and can't exempt bots; Gitar's review doesn't count as an approval | Moved to the rfun-solutions org; approvals 0, CI is the gate |
| T2 Dash0 SDK | Server traces, logs and metrics all arrive; org is us-west-2. Browser-to-server join confirmed in the Dash0 trace view: one trace, root service kc-t2-web, server span nested (60 ms total) | Default telemetry path: the app sends straight to Dash0 |
| T4 transcription (desktop Chrome) | Browser speech API skips whole sentences; in-browser Whisper worked best (117 MB, 6 s download, about 4 s to text for 50 s of audio); Chrome translation works | iPhone Safari and the Home Screen app: browser speech works well (first word about 7.6 s after audio starts; the first mic prompt took about 27 s; one session ended after about 12 s, so captions auto-restart). Whisper crashes the tab. So the captions engine is chosen per platform: browser speech on iPhone, Whisper first on desktop Chrome |
| T3 Dash0 operator | Operator controller installs, but its agent DaemonSet is denied (needs hostPath and hostPorts, no chart switch removes them) and its metrics collector fails quota (no CPU requests). A plain collector Deployment (100m / 256Mi) is admitted and used about 51 MiB for 800 spans + 100 logs; all arrived in Dash0. Browser monitoring from localhost reaches Dash0 with the ingest-only token | The operator is out on the event cluster. Telemetry goes SDK direct, or through a small collector Deployment |
| T6 org setup | In rfun-solutions the merge queue works (3 PRs merged, 50 to 84 s each, about 45 s on top of CI), and a GitHub App is accepted as the ruleset exemption. The Actions bot still can't be exempted (needs GitHub Team) | P1 merge queue confirmed; O2 GitHub App is the deploy-bot path. The real push with the App's key is the last step |
| T6b App push + private repo | The GitHub App's deploy: commit lands on protected main 7 s after a merge; the Actions bot is still rejected. A PRIVATE repo on the Free plan enforces nothing: no rulesets, no protection, no merge queue (403 "upgrade or make public") | Deploy-bot path is fully verified. Keeping the target repo private conflicts with branch protection and the merge queue: user decision needed |
| T8 Gitar and Kubernetes YAML | A PR pushed the memory requests over the 4 GiB budget. Gitar reviewed in 34 s and cut the new collector's request from 1Gi to 512Mi; CI went green at about 68 s | The budget break (G3) is usable, with the accessibility regression (G5) as a second staged fix |
| T10 rules from production | The deploy bot pushed hot-paths.md to protected main in 8 s. On the next PR, Gitar cited "Per the review rule ..." inline in 60 s. It quotes rule sentences, not the file header | The Gitar headline (G4) works end to end. Live Dash0 numbers must go inside each rule sentence |
| T7 Agent0 via MCP | Works with the bearer token; answers were correct but took 32 to 42 s; no credit data in responses | Agent0 explaining to Kay (D3) only as a cached result shown after the fact, never live |
| T9 Dash0 PromQL | Queries answer in 0.3 to 0.4 s. No http\_route label, but span metrics carry dash0\_operation\_name ("GET /api/hello"), and per-route p95 works with it (verified live) | Adaptive captions (D2) and rules from production (G4) are unblocked: F and G query by dash0\_operation\_name; C0 also sets http.route and an app route histogram as a fallback |
| T11 Synthetic Kay | Playwright as an iPhone 15 sent browser monitoring as kc-web-kay into Dash0; 17.5 s per run | Synthetic Kay (X1) works as planned |
| Image pre-pull | node:22-alpine, otel-collector-contrib, CloudNativePG Postgres 18, k6, k3s v1.33.6, Playwright 1.65 pulled | Local fallback ready; Postgres 18 chosen without a starter pin |

## Kickoff runbook (Mon, 10:00 to 11:15)

Step one tomorrow; start here and run it top to bottom. Full detail in research/07 section 9.

1. Bring the cnh-starter into the target repo (clean copy) on main, before protection is on; make main the default branch.
2. Bring the planning in: `docs/planning/` (research, vault, an export of this doc), `openspec/` proposals, `AGENTS.md`, `AI-DISCLOSURE.md`. Strip personal data, tokens and anything from the test repo.
3. Create issues KC-1 to KC-8 in merge order: C0, D, G, A, B, F, E, C.
4. Protection: ruleset on main with PR required, approvals 0, required checks, squash only, no force-push; merge queue on (verified in the org; CI must also trigger on merge\_group).
5. Deploy bot: install the GitHub App, add its two secrets, add it as the ruleset's exemption.
6. Cluster: join code, join.cnh.radarhq.io, kubeconfig from the Radar UI, Secrets (Dash0 token, Anthropic key); make the GHCR package public after the first push; sign in to the Radar and Dash0 MCPs.
7. Gitar check: trial active on the org, `gitar-managed` label exists.
8. First PR is C0 (one agent, 11:00). Meanwhile: Impeccable design directions for review, Radar "Checks" before-screenshot, ask Dash0 about the SLO beta.
9. Prove the loop once (merge, build, bot commit, Argo sync, app live, traces in Dash0), add the required check names, then start the wave 1 agents.

## Presentation plan (draft)

A first draft, refined tomorrow once the organizers say what they want from demos. Basis: how Kelsey Hightower presents (research/11).

1. **Open with the user's own hook:** "I forget every conversation I had an hour ago." Kay appears as a composite in at most 2 panels.
2. **Three beats, not seven.** First, live adaptive captions: a judge speaks, the captions appear, we trigger the lag, and the captions switch engine with "everyone, not you". Second, Gitar quoting a rule written from production data (about 30 s). Third, the fix PR that cites Agent0's and Radar's findings (about 20 s, shown, not run).
3. **Every feature is shown with its tech:** an in-app "Under the hood" screen shows which sponsor tool each feature uses, with live data, and a designed page in the repo lets judges review it afterwards.
4. **Rehearsed live demos, minimal slides, infrastructure invisible, no hype.**
5. **Failure plan:** a fallback tab for every live step. If something breaks, say so in one line and switch to that beat's clip without passing it off as live. Memorize a 2-minute cut.
6. **Close on the outcome** for the user and Kay, plus one honest sentence on what the AI agents did.

## Build-day parallel plan

At most 8 Sonnet builders run at once, plus 1 Opus orchestrator. The limit is CI throughput (GitHub Free allows about 20 concurrent jobs, roughly 10 PRs an hour), not file overlap. Total work is about 23 agent-hours. Full plan: `.scratch/kubecompanion/parallel-plan.md`.

| Time | What starts | Agents | Gate before it |
| --- | --- | --- | --- |
| 11:00 | C0a scaffold base; D0 design directions (you pick by 11:20) | 2 | Kickoff runbook done |
| 11:30 | C0w (workflows) and C0b | 3 | C0-base merged |
| 12:20 | Wave 1a coding: D1, G, A, B, F1 | up to 8 | C0 complete |
| 12:50 | Wave 1 starts merging; E1, D2, C start | 8 | Deploy loop proven once; D's rules PR on main |
| 14:00 to 14:30 | Freed slots: F2, H, E2, then F3 or C2; F1 does the Agent0 explanation from 14:20 | 8 | Lunch go/no-go |
| 15:30 / 15:40 | Last enqueue / code freeze | 0 | Then the 15:45 staging hour |

Lunch go/no-go at 14:00: run the full wave 2 only if the loop is proven, the core PRs are merged, and no PR has been stuck in the queue over 20 minutes. Otherwise drop H and F3.

Top collision risks and fixes:

1. **"Append-only" shared files still conflict in git** (confirmed by a scratch merge test). C0 pre-writes one marker comment per change, and each agent inserts only under its own marker.
2. **Files created twice** (the chaos, notes-queue and speech stubs, A editing G's mapper, split agents sharing an i18n file). C0 ships the stubs, A wraps G's mapper, and each split agent gets its own i18n file.
3. **Queue churn.** Never branch from another agent's unmerged branch. Flip the demo feed variables only while the queue is paused. Check during the loop proof whether deploy-bot pushes reset merge groups.

## Completion ledger

No PR enters the merge queue until the orchestrator has checked the agent's claims against the real commit and marked them VERIFIED. For each PR, the agent writes what it built, the files it changed and how it checked them in `COMPLETION-LEDGER.md`. The orchestrator then:

- compares the changed files with the agent's list
- finds each claim in the code
- re-runs the agent's checks on that exact commit
- looks for fake passes, such as skipped tests or empty assertions

Newest first.

| Time | Issue · PR | What the agent claims | Verdict | Evidence or gaps |
| --- | --- | --- | --- | --- |
| – | – | No entries yet | – | – |

## Your to-do list

Tick items as you go; agents add items here whenever something needs you.

### Today (Sun Nov 8)

- [x] Register on Luma for the hackathon (luma.com/cnh) and House of Kube (luma.com/9p2oc1k5); seats capped at 170–200
- [x] Install the Gitar GitHub App and start the 14-day Pro trial (app.gitar.ai); auto-apply needs Pro
- [x] Dash0 trial (dash0.com/sign-up), pick a US region, then `claude mcp add` for the Dash0 MCP
- [ ] Radar Cloud account (app.radarhq.io), then `claude mcp add` for the Radar MCP
- [x] Say whether I can create a throwaway public GitHub test repo for live tests, and its name
- [x] Image generation: allow Claude in Chrome to drive Gemini in your browser, or provide a Gemini or OpenAI API key
- [x] Approve upgrading OpenSpec 1.15.0 to 1.16.1
- [ ] Pre-pull images on good Wi-Fi (`cnh-starter/scripts/local-cluster.sh --pull`, about 500 MB)
- [ ] Docker running; laptop, charger, power strip packed
- [x] Read research/07-deep-plan.md and pick a scope bundle, stack and demo character (section 6 lists the questions)
- [x] For today's phone transcription test: your iPhone (no Android needed; desktop Chrome covers the Chromium speech path), plus an OpenAI or Deepgram key if you want the cloud paths tested
- [ ] Run the T4 transcription checklist on iPhone + desktop Chrome: https://rfun.github.io/throwaway-test-repo/ (fill the table in research/08-live-tests/T4-transcription.md)
- [x] Dash0: create an ingest-only client token, limited to one dataset, for browser monitoring (Settings > Auth Tokens). The current token in .env has full admin rights (all actions, all datasets), so it must stay server-side only. Your Dash0 org is in us-west-2 (OTLP: ingress.us-west-2.aws.dash0.com)
- [x] Dash0 T2: open http://localhost:3000 after running live-tests/t2-app/run.sh, click the button, then confirm in the Dash0 UI that website events arrive and the browser trace joins the backend trace (I can't drive a browser)
- [x] Approve installing k3d or kind (e.g. brew install k3d) so I can run T3 (Dash0 operator vs event-cluster restrictions); neither is installed, so T3 was skipped. Docker is up with 7.6 GiB
- [x] Review Kay style options (research/09)
- [x] T1 result needs your call: on a personal GitHub repo, merge queue and an Actions-app bypass for the deploy bot are NOT available (a GitHub org is needed). Decide: move the hackathon repo into an org, or use PR-only without a queue plus a deploy branch or a GitHub App for the bot (research/08-live-tests/T1-gitar.md)
- [x] Install Gitar on the rfun-solutions org and check the Pro trial carries over
- [x] Approve: public test repo an org test repo plus registering a test GitHub App (merge queue and bot exemption test)
- [x] Approve: transfer rfun/wemakedevs\_hackathon\_2026 into rfun-solutions
- [x] Approve: download Kay's A2 full-size original from Gemini
- [x] Decide when to make rfun-solutions/wemakedevs\_hackathon\_2026 public: it came over PRIVATE, and a free org's merge queue and the submission both need it public (now while it's empty, or at kickoff)
- [ ] Open app.dash0.com > Website monitoring > kc-t2-web and confirm the browser fetch span shows inside the server trace (the API shows the browser's trace id on the server span, but cannot list the browser spans)
- [ ] Approve generating the private key for test App test-deploy-bot-app (stored only as repo secrets in an org test repo) so the last T6 step can run: a deploy: commit pushed by the App to protected main (research/08-live-tests/T6-org-merge-queue-app.md)
- [ ] Read T6b (research/08-live-tests/T6b-app-push-and-private.md): the deploy-bot push works, but a PRIVATE repo in a free org gets no rulesets or merge queue enforcement, so the real repo must be public for protection (see the make-public to-do above); delete the local key file test-deploy-bot-app after the event
- [x] Check the Radar MCP in your own session with /mcp: it failed with a DNS error from this shell (Dash0 MCP is connected)

### Event day (Mon Nov 9)

- [ ] Arrive by 9:00 (capacity cap)
- [ ] Get the Radar join code at kickoff, create the team cluster at join.cnh.radarhq.io
- [ ] Before the first merge: settle the main ruleset and the deploy-bot path (research/07 section 9, steps 4–5), then prove the loop once (merge → image → bot commit → Argo → public URL → Dash0) before starting wave 1
- [ ] Ask Dash0 at kickoff to enable SLOs for your org (private beta)
- [ ] Ask the organizers about demo length, format and how to submit
- [ ] Review the Impeccable design options before the build starts
- [ ] Approve and merge the Gitar-reviewed PRs through the day
- [ ] Submit the public repo, README and AI-assistant disclosure by 17:30
- [ ] Keep 15:45 to 16:45 free for staging the demo stories (load test, Agent0, Gitar break, Radar all-clear); cut wave 2 features before cutting this hour

## Open questions

- Feature scope, and how many agents run in parallel tomorrow
- How Gitar handles CI failures caused by external systems (live test)
- Whether the Dash0 operator runs on the event cluster, or the app SDK exports straight to Dash0 (live test)
- Which transcription path works on phones: browser speech API, OpenAI, Deepgram or in-browser Whisper (live test)
- Radar's "don't break things on purpose" against the Gitar and Dash0 break-it demos: how to stage a real issue
- Image generation for the cartoon character: Gemini in the browser or an API key
- Demo length, format and submission method (ask at kickoff)
- LLM key for evening threads and translation fallback: the user's Claude API key with added credits is being costed (estimate in chat; the OpenAI credit only arrives after submission)
- Branch protection details after live test T1: on the personal repo there is no merge queue and the Actions app cannot bypass protection, and Gitar's review is neither a status check nor an approval (so approvals 0, CI is the gate). Still to decide: strict "require branches up to date" on or off, and the deploy bot's path to main: a GitHub App acting as admin, a separate deploy branch that Argo tracks, or moving the repo into a GitHub org (which brings the merge queue back; options and costs in research/07 sections 7–8, results in research/08-live-tests/T1-gitar.md)

## Rules for every agent

Planning sessions update this doc directly. On build day, build agents append to RUNNING-LOG.md and only the orchestrator writes this doc. The rule lives in `2026/hackathon/CLAUDE.md`.

1. Read this doc before starting work.
2. When a decision is made, add a row to Decisions so far, newest first, with the reason.
3. When the plan, scope, tracks or architecture change, update those sections in plain language: what we are building and why.
4. When something needs the user, add it to Your to-do list.
5. Update Open questions as they are raised or answered.
6. Edit only the parts that changed; never rewrite someone else's text.
7. Put commands, links and limits in `2026/hackathon/resources-vault.md`, not here.

## Sources

Local files in ``:

- `research/01-event-page-and-ideas.md`: event page, organizers' ideas, rules, schedule
- `research/02-gitar-and-pipeline.md`: Gitar, the deploy pipeline, CI break scenarios
- `research/03-runtime-radar-dash0.md`: hosting, Radar, Dash0
- `research/04-accessibility-and-features.md`: Conferences for Everyone, features, public data
- `research/05-openspec-and-aihero-skills.md`: OpenSpec, wayfinder, research
- `research/06-design-and-presentation.md`: design skills, cartoon character, slides
- `research/07-deep-plan.md`: scope bundles, merge graph, architecture and budget, demo stories, storyline, live-test plan
- `resources-vault.md`: commands, links, limits

Web: [Hackathon page](https://www.wemakedevs.org/hackathons/cnh) · [Rules](https://www.wemakedevs.org/hackathons/cnh/rules) · [Schedule](https://www.wemakedevs.org/hackathons/cnh/schedule) · [cnh-starter](https://github.com/skyhook-io/cnh-starter)
