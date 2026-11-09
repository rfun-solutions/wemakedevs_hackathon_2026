# 01 Event page, ideas, rules, schedule (collected 2026-11-08, no decisions made)

Sources (fetched with curl, text extracted from server-rendered HTML; all verbatim unless noted):
- https://www.wemakedevs.org/hackathons/cnh  (main page)
- /rules, /schedule, /resources, /partners under the same base. /faq is 404 (FAQ is a section on the main page, #faq).

Note on "hover": the idea text is plain server-rendered HTML on the main page (no JS bundle digging needed). Each sponsor card has a description + "Ideas for X" list; the Sonar and Dash0 ideas appear in both card faces (duplicated markup).

## 1. Ideas by track (verbatim)

### Track 1 · AI code review · Never Merge Broken (Sonar / Gitar), $4,000
Card: "Gitar is Sonar's AI code verification agent. It reviews your pull requests against your project's conventions, finds problems, generates fixes and diagnoses CI failures. With auto-apply turned on, it commits fixes and keeps iterating against your pipeline, while you stay in control of what gets applied and what can merge."
Ideas for Sonar:
1. "A schedule builder where every feature lands through a Gitar-reviewed PR, with review instructions that make sure session times always handle time zones properly."
2. "A repository rule that kicks in whenever your API changes and checks your frontend still matches it."
3. "Breaking your CI on purpose and letting auto-apply fix it live during your demo."

### Track 2 · Observability · Stop Flying Blind (Dash0), $4,000
Card: "Dash0 is an observability platform built natively on OpenTelemetry, so everything your applications and infrastructure emit can be explored together instead of across separate tools. Ask Agent0, our AI SRE agent, a question in plain English and get an answer grounded in your live telemetry. Its MCP server lets Claude Code, Cursor and other AI assistants tap into the same data while you build, so they work from facts instead of guesses."
Ideas for Dash0:
1. "Self-diagnosing microservice app. Build a small multi-service app (a storefront, a booking system, a chat app) and instrument it end to end with OpenTelemetry. Add a "chaos" button that injects latency or errors, then show Agent0 finding the cause in your demo."
2. "A live crowd map where check-ins become metrics and a Dash0 dashboard shows which rooms are filling up."
3. "A schedule app instrumented end to end, where your demo shows Agent0 explaining why "My agenda" slowed down when everyone opened it after the keynote."
4. "An AI assistant for attendees traced with OpenLIT, so you can see every LLM call, token and cost in Dash0."

### Track 3 · Kubernetes UI · AI SRE (Radar / Skyhook), $4,000
Card: "Radar is an open-source Kubernetes UI from Skyhook. It shows everything running in your cluster in one place, and its AI SRE finds the root cause when something breaks, either from the Radar UI or from your coding agent (Claude Code, Codex, Cursor and others) through Radar's MCP server."
Ideas for Radar, any of these on Kubernetes:
1. "Talk picker. Reads your GitHub, builds your schedule and reshuffles it when a room fills up."
2. "Hallway track matchmaker. Finds the people in the building working on the same problem as you."
3. "Live crowd map. Shows which rooms are packed and which coffee line is shortest."

### Track 4 · Search and vector database · Find the Right Talk (Elasticsearch), $4,000
Card: "Elasticsearch is the open source search engine and vector database. Store your app's data in it and search it by keyword, by meaning with vector search, or both at once with hybrid search, so it can be the database behind your search, recommendations and the RAG for your AI agents."
Ideas for Elasticsearch:
1. "A talk search where "something on eBPF and security" finds the right session even when those words aren't in the title."
2. "A hallway matchmaker that stores what everyone is working on as vectors and finds the closest matches in the building."
3. "A conference assistant that answers questions about the schedule using RAG over every talk abstract."

### Merge Forward track · iPad · Conferences for Everyone
"For the project that makes conferences more inclusive and accessible." No ideas list. Link: https://ocgroups.dev/cncf/group/merge-forward. Partner blurb (/partners): "A CNCF community group and home to seven diversity groups, supporting underrepresented people in open source."

## 2. Pre-kickoff rule (verbatim, /rules)
"1. The main coding and design work must begin after the hackathon starts. Ideas, notes, sketches and research beforehand are fine."
Page intro: "Read these before you start building. Taking part means agreeing to all of them, along with the WeMakeDevs Code of Conduct, the Terms and the Privacy Policy."
- No separate FAQ entry about pre-kickoff work (FAQ has 8 Qs: in person, who, multiple tracks, team, what to bring, food, keyboard, after-party).
- Ambiguity: "main coding and design work" is not defined. Specs/research/notes are not named explicitly; "ideas, notes, sketches and research" are allowed, so a written plan/spec is plausibly "notes/research", but "design" docs (architecture, UI design) are borderline since "design work" must start after kickoff. A UI mockup is arguably "design work" (not "sketch"). Nothing says whether pre-written scaffolding/boilerplate counts (rule 2 allows templates/libraries, and the Radar track provides a starter repo). Not clarified anywhere; ask organizers at kickoff if needed.

## 3. All 12 rules (verbatim, /rules)
1. The main coding and design work must begin after the hackathon starts. Ideas, notes, sketches and research beforehand are fine.
2. Frameworks, open-source libraries, public APIs, templates, third-party tools and publicly available assets are all allowed. The original work done during the hackathon is what gets judged.
3. Every submission needs a public source-code repository and a README with setup instructions.
4. Use only data, tools and accounts you own or have permission to use. Keep private, personal and login-protected information out of your repository and your demo.
5. AI coding assistants are allowed, but their use must be disclosed.
6. You have to understand the code you submit and be able to explain the project architecture and the technical decisions behind it.
7. Projects generated entirely by AI, without meaningful participant contribution, verification or technical understanding, may be rejected.
8. Each participant or team submits one project. Duplicate, copied or previously finished projects are disqualified.
9. To get the free Keychron mechanical keyboard, you must submit a project. Submitting a valid project that follows these rules is what confirms your participation.
10. Any intellectual property developed during the hackathon belongs to the participant or team that created it. Agree on ownership inside your team before you submit.
11. Treat participants, organisers, sponsors, speakers and judges with respect. Harassment, discrimination, spam, plagiarism or attempts to manipulate judging get you disqualified.
12. WeMakeDevs can disqualify any entry that breaks these rules or the Code of Conduct. Final eligibility and judging decisions rest with WeMakeDevs.

## 4. Schedule (verbatim, /schedule; "Monday, November 9, 2026 · Mountain Time")
- 9:00 AM Check-in and breakfast
- 10:00 AM Kickoff and talks. Talk: "Give your agent Radar: ship and debug on Kubernetes" (Nadav Erell and Roy Libman, 15 minutes): "How to get your team's environment, connect your coding agent to Radar, and ship through it, with a live demo of a release that breaks and Radar's AI SRE finding why."
- 11:00 AM to 2:00 PM Build time
- 2:00 PM Lunch, a panel, and more build time
- 5:30 PM **Project submission deadline**
- 5:30 PM to 6:30 PM Project presentations
- 6:30 PM to 7:00 PM Winners announced
- After 7:00 PM After-party (House of Kube, "Same night", presented by Platform Engineering community)
Build window is therefore effectively ~10:00 (or 11:00) to 17:30. Main-page FAQ says breakfast 10:00 AM, but schedule says check-in+breakfast 9:00 AM (small discrepancy).

## 5. Judging criteria per track (verbatim, main page "What the judges look for")
Never Merge Broken:
- Gitar is part of how you built, with features landing through PRs it reviewed, not one PR at the end.
- Project-aware setup, with review instructions and repository rules that reflect how your team actually works.
- Using CI failure diagnosis and auto-apply to fix real problems.
- How well your project makes conferences easier.

Stop Flying Blind:
- Depth of instrumentation across your app, including traces, logs, metrics and real-user monitoring if you have a frontend.
- Using Agent0 or the MCP server to find and fix something real during the day, and showing it in your demo.
- Observability that's part of the product experience, not bolted on at the end.
- Bonus point if you can create a dashboard or an SLO that shows how healthy your app is.
- How well your project makes conferences easier.

Radar / AI SRE:
- Run your project on Kubernetes with Radar connected, in the cluster and namespace we provide your team, or on your own cluster.
- Use Radar's UI and MCP throughout building and operating your project. Show how Radar helped you ship, troubleshoot, or improve your app.
- Use Radar's AI investigations to investigate a real issue or question about your running app. Show what you learned and what you did with the findings.
- Build something that makes conferences easier.

Find the Right Talk (Elasticsearch):
- Elasticsearch is the core data layer of your app, not a side feature.
- Smart use of search, whether that's keyword, semantic, vector or hybrid.
- How well your project makes conferences easier.

Conferences for Everyone (Merge Forward): no criteria listed beyond the one-line description. No overall best-project criteria listed.
Judges (12): Kelsey Hightower, Wes Novack (SVP Engineering, company not stated), Joseph Sandoval (Adobe), Saiyam Pathak (Kubesimplify), Phil Estes (AWS), Jacquie Capur (Nebius), Tomás Martín Barreiro Iffernet (Cline), Simon Schrottner (Flagsmith), Julia Furst Morgado (Dash0), Justin Garrison (Sidero Labs), Nadav Erell (CEO Skyhook Radar), Kunal Kushwaha (WeMakeDevs).

## 6. Teams, hosting, repo, Radar, resources
- Teams, FAQ: "No. Come on your own or with a team. There's time at kickoff to find people to build with." No size limit stated anywhere.
- Multiple tracks, FAQ: "Yes. Your project enters every sponsor track whose tool it genuinely uses, and the Merge Forward track as well. Every project is in the running for best overall." (Note: Merge Forward entered automatically/"as well".)
- Public repo + README with setup instructions required (rule 3). 
- Hosting/deployment: NOTHING stated as a requirement except Radar track (run on Kubernetes with Radar connected). No required public URL / live deployment mentioned for other tracks; demo format below.
- Demo format/length: NOT published. Only "Project presentations 5:30-6:30 PM" (one hour). Number of teams (up to ~170-200 people) vs. one hour implies short slots, but unstated.
- How to submit (platform/form): NOT stated on any page.
- Radar details (/resources): "Get your team its own environment on our cluster at join.cnh.radarhq.io (join code at the kickoff and the Radar table), or connect your own cluster to a free Radar Cloud org. Copy the starter repo, connect your coding agent, and ship through Radar's MCP: every push deploys through Argo CD. When something breaks or puzzles you, start an AI investigation in Radar Cloud." Cluster optional: "you'll get your own environment on Radar's cluster for the hackathon if you need one." "The Radar track just needs a GitHub account and a coding agent." MCP command: `claude mcp add radar-cloud --scope user --transport http https://api.radarhq.io/mcp`. Features to use: AI investigations; Radar's MCP (ship, sync Argo CD, check each rollout); Issues, the timeline and Checks.
- Gitar: install as GitHub App on hackathon repo, ship each feature as a PR, write conventions in `.gitar/review/`, add repository rules, turn on auto-apply; "free 14-day Gitar Pro trial needs no credit card and includes auto-apply and custom rules." Runs in browser.
- Dash0: "Point OpenTelemetry auto-instrumentation at your app in the first hour... ask Agent0 why... have it open a pull request with the fix. Connect the MCP server to your AI coding assistant". Features: Agent0, Dash0 MCP; bonus Dash0 CLI, dashboards, alerts, synthetic monitoring. Resource list includes Website monitoring with OpenTelemetry and Dash0 (RUM), Dash0 Operator for Kubernetes, OTel demo app, Integrations Hub.
- Elastic: `curl -fsSL https://elastic.co/start-local | sh` (Docker; all features for a month) or free ES cloud trial; load "talks, speakers, attendees, side events".
- Venue: 170-200 max, no entry once full; no travel/accommodation covered. Food: breakfast 10 AM, lunch 2 PM, coffee all day (per FAQ).
- Prizes: $20,000 pool; DGX Spark best overall; $4,000 per sponsor track; iPad Merge Forward; top 10 signed *Kubernetes: Up & Running*; everyone attending in person: Keychron keyboard, $50 OpenAI credits, swag, certificate (keyboard requires submitting a project, rule 9).
- Community partners (/partners): Merge Forward, Kubesimplify, Conference Parties, Forge Utah, Platform Engineering (presents After-Party), Fraiday Labs.
- Other links on main page: Luma https://luma.com/cnh; Google calendar; WhatsApp channel https://whatsapp.com/channel/0029Va4vHhJ5Ejxvi1qEBs1F.

## 7. New vs / corrections to existing README
- **Schedule IS published** at /schedule (README says not published): kickoff 10:00, build 11:00-2:00 + after lunch, **submission deadline 5:30 PM MT**, presentations 5:30-6:30, winners 6:30-7:00, after-party after 7. Check-in/breakfast 9:00 AM.
- README says Radar cluster code "at join.cnh.radarhq.io"; page says join code is given at kickoff and at the Radar table. Radar cluster is optional.
- Rules numbering: README says 12 rules but summarises 1-8 only. Missing: rule 9 (keyboard requires a valid submission), 10 (IP belongs to participant/team; agree ownership), 11 (conduct/disqualify for manipulating judging), 12 (WeMakeDevs final say). Rule 8 also disqualifies "duplicate, copied or previously finished projects" (README omitted).
- README judge list is incomplete: also Wes Novack, Jacquie Capur (Nebius), Tomás Martín Barreiro Iffernet (Cline), Simon Schrottner (Flagsmith).
- Dash0 judging detail new: real-user monitoring if a frontend; "find and fix something real during the day" shown in demo; "Observability part of the product experience". Idea 4 (OpenLIT-traced attendee AI assistant) and idea 3 ("My agenda" slowdown after keynote) are in the official list; README only paraphrased some.
- Gitar judging detail new: features must land through multiple Gitar-reviewed PRs "not one PR at the end"; project-aware review instructions and repo rules.
- Elasticsearch track: page's FAQ says Docker + a Kubernetes cluster for the ES track (phrasing odd; resources page says Docker only for local ES).
- Kickoff talk: Radar "Give your agent Radar" 15 min at kickoff.
- Rule 1 wording is "main coding and design work", ambiguity noted in section 2.
- Elasticsearch ideas list is distinct from Radar's but overlaps (matchmaker, talk search/picker); the Radar track's ideas (talk picker, matchmaker, crowd map) are generic and must run on Kubernetes.

## 8. Could not find
- Demo format / length per team; number of presenters; whether live demo vs video.
- Submission mechanism (form/Devpost/Luma?) beyond the 5:30 PM deadline.
- Overall (best project, DGX Spark) judging criteria; Merge Forward judging criteria; scoring weights.
- Team size limit; any hosting/live-URL requirement outside Radar track.
- Any explicit statement on whether specs/design docs/scaffolding before kickoff are allowed beyond rule 1.
- Any /faq page (404); no other subpages beyond /rules, /schedule, /resources, /partners.
- Organizer example "chaos button" for Radar track: not present (chaos button is Dash0 idea 1).
