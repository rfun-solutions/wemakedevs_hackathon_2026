# Hackathon ideation

_Ideas, sketches and research only. No code before kickoff (rule 1)._

**North star:** make the conference easier. Every track's judging includes "how well it makes conferences easier".

---

## Idea A: Conference companion (Field Notes, rebuilt on the cloud native stack)

**Status:** to explore. **Solo. Target track: Dash0, "Stop Flying Blind".** Decide the rest over the next few days.

**Dash0 judging, which is what we optimise for:**
1. Depth of instrumentation: traces, logs and metrics, plus RUM since there's a frontend
2. Use Agent0 or the Dash0 MCP to **find and fix a real issue during the event**, then show it
3. Observability as part of the product, not bolted on
4. Bonus: a dashboard or SLO (e.g. "capture saved in < 500 ms p95")
5. How well it makes the conference easier

**Pre-work plan, sorted against rule 1** ("main coding and design work must start after the hackathon begins;
earlier ideas, notes, sketches and research are allowed"):
| Pre-work | Status |
|---|---|
| Idea doc, feature list, judging map (this file) | Allowed (ideas/notes) |
| Accounts (Dash0 trial), Docker, kind/k3d cluster, pre-pulled images | Allowed (environment) |
| Learning Dash0 on a **throwaway sandbox**: OTel demo app, Dash0 operator, Agent0/MCP | Allowed (research) |
| Rough UI sketches and wireframes | Probably fine ("sketches") |
| OpenSpec specs / detailed design | **Grey area**: "design work" is named in rule 1 |
| UI development / project code | **Conflicts with rule 1**. Risk of disqualification |

→ Ask the organizers before doing grey or red items (Discord discord.gg/wemakedevs or contact@wemakedevs.org).
Draft question: "Can we write specs and wireframes before Monday, and start code at kickoff?"

**Pitch.** A pocket notebook for attendees. Capture ideas mid-talk, highlight transcript passages, log who you met and
what you promised, and each evening get your notes grouped into threads that build across the week.
We are already using a working prototype at KubeCon itself (the Field Notes artifact). That's real dogfooding we can demo,
but the hackathon build has to be **new code written after kickoff** (rule 1).

**Why it fits the tracks (one project, several tracks):**
| Track | Angle |
|---|---|
| Find the Right Talk (Elasticsearch) | Hybrid search over sessions *and your own notes*: "which talks relate to what I highlighted?" Semantic matching of notes to sessions and threads |
| Stop Flying Blind (Dash0) | OpenTelemetry-instrumented API + frontend RUM; use Agent0 / MCP to find and fix a real issue live; SLO on capture latency |
| AI SRE (Radar) | Deploy on the event cluster with Radar connected; use AI investigation on a real failure |
| Never Merge Broken (Sonar Gitar) | Build through Gitar-reviewed PRs with custom review rules |
| Conferences for Everyone (Merge Forward) | Accessibility: live captions/transcript, large-type mode, screen-reader-first capture |

**Open questions:**
- Solo or team? Which 1–2 tracks to aim at first (avoid spreading thin)
- Scope for a single day: capture + search + nightly threading is probably the max
- Transcription in a browser app we control (unlike the artifact, a normal web app *can* use the mic via Web Speech API)
- Privacy: rule 4 says no personal data in the repo or demo, so demo with sample notes

**Prep allowed before Monday:** sketch the architecture, choose the stack, pre-pull images, set up accounts, write this doc.
