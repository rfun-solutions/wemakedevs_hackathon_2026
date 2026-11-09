# AI assistance disclosure

KubeCompanion is a solo entry built with heavy, deliberate use of AI agents. This file says what AI did and what the human did. It is updated through the day.

## Tools
- **Claude Code** (Anthropic): one Opus 5.5 orchestrator session plus up to 8 Sonnet 5.5 builder sessions, each working in its own git worktree on one OpenSpec change.
- **OpenSpec**: every feature was proposed as a spec change (`openspec/changes/`) before any code was written; builders implement with `/opsx:apply`.
- **Impeccable**: mobile-first design directions; the human picked one.
- **Gitar**: AI code review on every pull request.
- **Dash0 Agent0** and **Radar AI**: AI investigation of production telemetry and the cluster.
- **Claude Haiku 5.5 / Sonnet 5.5 at runtime**: the app itself calls Claude for evening threads and translation fallback.
- Character art for "Kay" (the demo persona) was AI-generated; Kay is a composite, not a real attendee.

## What AI did
- Research, live-test write-ups and planning documents in `docs/planning/` (Nov 6 to 8, before the event), reviewed and steered by the human.
- The OpenSpec proposals, and the code in this repository, written by builder agents.
- Code review comments (Gitar). Gitar's auto-fix commits were kept only when they stayed inside the PR's own lane (files that change owns); out-of-lane fix commits were reverted.
- **Translations:** Portuguese (PT-BR) and Arabic (AR) strings in `web/src/i18n/pt-BR/` and `web/src/i18n/ar/` are machine-translated by Claude, smoke-level only, and have not been reviewed by a native speaker. Spanish (ES) UI strings and the ES access-promise sentences are Claude-assisted and also not natively reviewed.
- **Persona:** "Kay" is a composite persona, not a real attendee; the Kay character art is AI-generated.
- **Demo video:** the footage is real screen and device recording of the running app; the script, the voiceover (macOS text-to-speech) and the edit were produced with AI.

## What the human did
- Chose the problem, scope, tracks, stack and design direction; made every decision recorded in `docs/planning/running-doc.md` (Decisions table).
- Ran the live tests on real devices (for example the iPhone captions test).
- Gated merges for scaffolding, design and anything touching deploy, workflows or secrets.

## How AI output was checked
- **Completion ledger:** each builder records what it built, the files it changed and how it verified the work. The orchestrator fact-checks every entry against the actual commit (diff, re-run of the checks, CI run for that exact commit, fake-green red flags) before a PR may enter the merge queue.
- **Independent verifiers:** separate verifier agents re-ran each ledger entry's checks in a clean worktree, tried mutations to catch fake-green tests, and wrote a VERIFIED, PARTIAL or REFUTED verdict. REFUTED PRs were never merged; PARTIAL verdicts list the gap that was accepted.
- Required CI checks, Gitar review and the merge queue on `main`.
- Production telemetry in Dash0 after each deploy.
