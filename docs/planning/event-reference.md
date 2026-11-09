# Cloud Native Hackathon (WeMakeDevs): Reference

Source: https://www.wemakedevs.org/hackathons/cnh (+ /rules, /resources), fetched 2026-11-06.
Ideation happens in `ideas.md` in this folder.

## Essentials
| | |
|---|---|
| Date | **Monday, Nov 9, 2026** (same day as the KubeCon co-located events) |
| Times | 9:00 check-in, 10:00 kickoff (+ Radar talk), 11:00–17:30 build (lunch 14:00), **17:30 submission**, 17:30–18:30 demos, 18:30 winners |
| Where | **The Shop Workspace, 350 E 400 S, Salt Lake City, UT 84111** (about 15 min walk from the Salt Palace) |
| Format | In person only. Free. Capacity 170–200. **Hard cap: arrive early** |
| Register | https://luma.com/cnh |
| Teams | Solo or team, no stated size limits. Team-finding at kickoff |
| After-party | **House of Kube**, same night after winners (invite-only, free, no KubeCon ticket needed): https://luma.com/9p2oc1k5 |
| Contact | contact@wemakedevs.org · Discord discord.gg/wemakedevs |

## Prizes
- $20k cash pool. **Best overall: NVIDIA DGX Spark.**
- Each sponsor track: **$4,000**. You can enter **multiple tracks** with one project.
- Merge Forward track: iPad.
- Top 10: copy of *Kubernetes: Up & Running* signed by Kelsey Hightower.
- Everyone who submits a valid project gets a Keychron keyboard, $50 in OpenAI credits, swag and a certificate.

## Tracks and judging
All tracks are judged partly on **"how well it makes conferences easier"**. The unofficial theme is tools for conference attendees, which is exactly what we're building in `2026/`.

| Track | Sponsor | Must-haves to score |
|---|---|---|
| **Never Merge Broken** | Sonar (Gitar AI code review) | Gitar installed as a GitHub App; PRs it reviewed; custom rules in `.gitar/review/`; CI diagnosis and auto-apply shown |
| **Stop Flying Blind** | Dash0 (OpenTelemetry) | Deep instrumentation (traces, logs, metrics, RUM); Agent0 or Dash0 MCP used to find and fix a real issue live; bonus for a dashboard or SLO |
| **AI SRE** | Radar / Skyhook | Runs on Kubernetes with Radar connected (event cluster at join.cnh.radarhq.io; code given at kickoff); Radar UI + MCP used; AI investigation of a real issue |
| **Find the Right Talk** | Elasticsearch | ES as the core data layer; keyword, semantic, vector or hybrid search |
| **Conferences for Everyone** | Merge Forward | Makes conferences more inclusive and accessible |

Organizers' example ideas: semantic talk search, hallway-track matchmaker (vectors), RAG conference assistant, live crowd map, talk picker, instrumented schedule app with a chaos button.

Judges include Kelsey Hightower, Phil Estes (AWS), Saiyam Pathak, Justin Garrison, Joseph Sandoval (Adobe), Julia Furst Morgado (Dash0), Nadav Erell (Radar), Kunal Kushwaha.

## Rules that shape prep (12 total)
1. **Coding and design must start after kickoff.** Ideas, notes, sketches and research beforehand are fine. So: prep the *plan* and the *environment*, not the code.
2. Libraries, templates and public APIs are allowed. Judged on original work done during the event.
3. Submit a **public repo + README with setup instructions**.
4. Use only data you're allowed to use. No private or personal data in the repo or demo.
5. AI coding assistants are allowed but **must be disclosed**.
6–7. You must be able to explain the architecture. Fully AI-generated projects without meaningful contribution may be rejected.
8. One project per person or team.
Submission deadline, demo format and length are **not published**. Ask at kickoff.

## Pre-arrival checklist
_Updated 2026-11-08. The live to-do list is in the running doc "KubeCompanion: What & Why"._
- [x] Register on Luma (luma.com/cnh) and House of Kube (luma.com/9p2oc1k5)
- [x] Accounts: Gitar (14-day Pro trial), Dash0 trial, GitHub org `rfun-solutions`
- [x] Accounts: Radar Cloud (app.radarhq.io), and Gitar installed on the `rfun-solutions` org
- [x] Docker running
- [ ] Local cluster ready (k3d being installed for live test T3)
- [x] ~~`curl -fsSL https://elastic.co/start-local | sh` tested~~ Not needed: Elasticsearch track not targeted
- [ ] Radar MCP for Claude Code: `claude mcp add radar-cloud --scope user --transport http https://api.radarhq.io/mcp`
- [ ] Dash0 MCP: `claude mcp add --transport http --scope user dash0 https://api.us-west-2.aws.dash0.com/mcp`
- [x] Clone `github.com/skyhook-io/cnh-starter` and read it (findings in research/03)
- [ ] Pre-pull images on hotel Wi-Fi (`cnh-starter/scripts/local-cluster.sh --pull`, about 500 MB; otel collector)
- [ ] Laptop + charger, power strip
- [x] Decide: hackathon all day vs. co-located sessions → hackathon, solo

## Resource links
- Gitar: https://docs.gitar.ai/quickstart · https://www.sonarsource.com/resources/library/get-started-with-gitar/
- Dash0: https://www.dash0.com/sign-up · https://www.dash0.com/docs/dash0 · MCP https://dash0.com/docs/dash0/ai/mcp · Operator https://www.dash0.com/docs/dash0/monitoring/kubernetes/dash0-operator/overview
- Radar: https://github.com/skyhook-io/radar · https://radarhq.io/docs · MCP https://radarhq.io/docs/features/mcp · Starter https://github.com/skyhook-io/cnh-starter
- Elastic: https://github.com/elastic/start-local · https://www.elastic.co/docs/solutions/search/get-started
- Merge Forward: https://ocgroups.dev/cncf/group/merge-forward
- Venue map: https://www.google.com/maps?q=40.7603608,-111.8810977

## Timetable (Mon 11/9, Mountain Time; from /hackathons/cnh/schedule, fetched 2026-11-08)
| Time | What |
|---|---|
| 9:00 | Check-in + breakfast (arrive early: hard capacity) |
| 10:00 | Kickoff + talks (Radar 15-min talk; team env join code) |
| 11:00–14:00 | Build |
| 14:00 | Lunch + panel + build |
| **17:30** | **Submission deadline** |
| 17:30–18:30 | Presentations |
| 18:30–19:00 | Winners |
| 19:00+ | After-party: House of Kube |

On the calendar as ONE event, 9:00–19:00, in *Kubecon 2026* (matched by the `Hackathon: wemakedevs-cnh-2026` line in its notes).
