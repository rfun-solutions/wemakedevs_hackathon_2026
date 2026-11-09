# 05 - OpenSpec and aihero.dev skills (research only, no decisions)

Collected 2026-11-08. Planning/research material only; nothing here starts coding or design.

## 1. OpenSpec (github.com/Fission-AI/OpenSpec)

- What: spec-driven development framework for AI assistants; human and AI agree on specs before code. MIT, ~74k stars, 30+ supported tools incl. Claude Code. Brownfield + greenfield.
- On this machine: `/usr/local/bin/openspec` installed, version **1.15.0**. Latest on npm and GitHub: **1.16.1** (released 2026-11-07; 1.16.0 on 10-30, 1.15.0 on 10-24, i.e. weekly releases). Upgrade: `npm i -g @fission-ai/openspec@latest`, `brew upgrade openspec`, or `openspec install`. Node 22.12+ for npm path.
- Install options: `npm install -g @fission-ai/openspec@latest`, `brew install openspec`, `curl -fsSL https://openspec.dev/cli/install.sh | sh` (standalone, no Node).
- Setup: `cd project && openspec init` (terminal), then `openspec update` to regenerate slash commands/guidance. `openspec init` prints the right command spelling for the chosen tools.
- Layout:
  ```
  openspec/
    config.yaml                      (optional project config)
    specs/<domain>/spec.md           (source of truth, current behavior)
    changes/<change-name>/
      proposal.md  design.md  tasks.md
      specs/<domain>/spec.md         (DELTA: ## ADDED / MODIFIED / REMOVED Requirements)
    changes/archive/YYYY-MM-DD-<change-name>/
  ```
  Requirements use `### Requirement:` + `#### Scenario:` with GIVEN/WHEN/THEN; MUST/SHALL wording.
- Slash commands (type in Claude Code chat, not terminal), canonical `/opsx:<cmd>`:
  - Default `core` profile: `/opsx:explore` (thinking partner, no code), `/opsx:propose <name>` (creates change + proposal/specs/design/tasks in one step), `/opsx:apply` (implement tasks, tick checkboxes), `/opsx:update` (revise planning artifacts), `/opsx:sync` (merge deltas into main specs), `/opsx:archive`.
  - Expanded profile (`openspec config profile` then `openspec update`): `/opsx:new`, `/opsx:continue`, `/opsx:ff` (fast-forward all artifacts), `/opsx:verify` (implementation vs artifacts), `/opsx:bulk-archive`, `/opsx:onboard`.
  - Older docs mention `/openspec:proposal|apply|archive`; current docs use `/opsx:*` (workflow is "actions not phases": can go back and update artifacts any time).
- CLI (terminal) on 1.15.0: `init, update, list [--specs], view (dashboard), change, show, spec, archive [name] [--yes], validate, config, schema (experimental), store, doctor, context, workset, version`.
  - Validation: `openspec validate <item>`, `--all`, `--changes`, `--specs`, `--strict`, `--json`, `--archived`.
- Splitting a project into multiple changes: one folder per change under `openspec/changes/`; each change has its own delta specs per domain; `/opsx:bulk-archive` archives several at once; `list` shows active changes. Docs mention stores (beta) for cross-repo plans. No dedicated "decompose a project" command found; the split is by how many `/opsx:propose <name>` calls are made (not verified in docs/workflows.md beyond the above; read `docs/workflows.md` and `docs/team-workflow.md` for parallel changes guidance).
- Executing with Claude Code: `/opsx:apply` (optionally name the change). README recommends a clean context window before implementation and strong models (Opus 4.7 / Codex 5.5 named).
- Speed tips from docs: skip `/opsx:explore` when scope is known and go straight to `/opsx:propose`; use `/opsx:ff` in expanded profile; keep tasks small; update artifacts via `/opsx:update` rather than restarting. Telemetry can be disabled: `openspec config set telemetry.enabled false`, `OPENSPEC_TELEMETRY=0`, or `DO_NOT_TRACK=1`.
- Hackathon note (information only): `openspec init` and writing proposals/specs is spec/notes work; the rule says coding and design must start after kickoff. Whether spec files count as "design" is a question for the organizers/user, not decided here.

Sources: https://github.com/Fission-AI/OpenSpec (README, docs/getting-started.md, docs/workflows.md, docs/commands.md), `openspec --help` / `openspec validate --help` run locally, `npm view @fission-ai/openspec version`, `gh api repos/Fission-AI/OpenSpec/releases`.

## 2. aihero.dev skills (Matt Pocock) - repo github.com/mattpocock/skills (~318k stars)

The aihero pages do not show install steps or SKILL.md; the repo does (`skills/engineering/<name>/SKILL.md`).
- Install (Claude Code): `claude plugin install mattpocock-skills@claude-plugins-official` (self-updating), or `npx skills@latest add mattpocock/skills -a <agent>` (copies editable files; pick one method, not both). Then run `/setup-matt-pocock-skills` once (configures issue tracker: GitHub/GitLab/Linear/Jira/local markdown, triage labels, domain docs; writes pointer into CLAUDE.md/AGENTS.md). Without a tracker it falls back to local markdown (`.scratch/...`).
- **/wayfinder** (user-invoked only, `disable-model-invocation: true`): for efforts too big for one agent session where destination is clear but route is not. Creates a "map" issue (labelled `wayfinder:map`; sections Destination, Notes, Decisions so far, Not yet specified, Out of scope) plus child decision tickets typed `research` (AFK, uses research skill), `prototype` (HITL), `grilling` (HITL; uses grilling + domain-modeling skills), `task` (manual unblocker). Each ticket sized to ~100K-token session, claimed by assignment, blocking links give the "frontier". Plans, does not build; ends by handing off to `/to-spec`, then `/to-tickets`, `/implement`.
- **/research** (model-invocable): spawns a background agent with fresh context to investigate a narrow question against primary sources (docs, source, specs, first-party APIs) and writes ONE cited Markdown file in the repo's existing notes location; reports path; does not answer in chat. Page advice: broad prompts ("research X") do worse; do not commit the files (they go stale); known issues: may spawn duplicate nested research agent (issue #530), model decides what is "primary", no auto-reuse in later sessions.
- Related skills in the same repo: `grill-with-docs`, `grilling`, `to-spec` (synthesizes conversation into a spec with Problem, Solution, long User Stories list, Implementation Decisions, Testing Decisions, Out of Scope, Further Notes; publishes to tracker, no interview), `to-tickets` (vertical-slice tracer-bullet tickets with blocking edges), `implement` (implements a ticket/spec, calls tdd skill, typecheck, then code-review, commits), `implement-spec`, `prototype`, `handoff`.
- Overlap with OpenSpec: to-spec/to-tickets/implement roughly parallel propose/apply; wayfinder has no OpenSpec equivalent (decision mapping before spec); research has no OpenSpec equivalent (`/opsx:explore` reads the codebase, not external sources). README positions these skills as the alternative to "GSD, BMAD, Spec-Kit"-style process owners, so running both end-to-end means two sources of truth for specs/tasks (to-spec/tickets live in the tracker; OpenSpec lives in `openspec/` files).
- Overlap with local `spec-driven-development` plugin (~/.claude/plugins/cache/cred-claude-skills/spec-driven-development; commands `/spec:new, requirements, design, tasks, approve, implement, stories-create`...): that plugin is gated (marker files `.requirements-approved` etc.), tracks time per phase, ties to Jira via jira-create. Heavy for a one-day solo build; both it and OpenSpec would compete to own the requirements/design/tasks artifacts. (Not reviewed in depth beyond the skill description and file listing.)
- Wayfinder/tracker constraint: needs an issue tracker or local markdown; a GitHub repo would be the natural tracker for the hackathon (not decided).

Sources: https://www.aihero.dev/skills-wayfinder, https://www.aihero.dev/skills-research, https://github.com/mattpocock/skills (README.md, skills/engineering/{wayfinder,research,to-spec,to-tickets,implement}/SKILL.md).

## 3. Other Claude Code skills/plugins (brief, names only; not verified in depth)
- superpowers (obra/superpowers, ~314k stars): brainstorming, writing-plans, executing-plans, TDD, systematic debugging, subagent-driven development, code review.
- Already local: `systematic-debugging`, `root-cause-tracing`, `simplify`, `code-review`, `security-review`, `ui-design`, `cpr`, `git-commit-creator`.
- mattpocock `grill-me`/`grilling`/`handoff` (productivity folder).
- Others commonly cited, unchecked: GitHub Spec Kit, BMAD, GSD.

## 4. Proposed (not decided) chains

A. Light: research (today, notes only) -> kickoff: `openspec init` -> `/opsx:propose` per feature slice (e.g. 3-5 changes) -> `/opsx:apply` each in fresh context -> `openspec validate --all` -> `/opsx:archive`.
B. Pocock-style: `/research` questions today -> `/wayfinder` (decisions) -> `/to-spec` -> `/to-tickets` -> `/implement` per ticket. Needs `/setup-matt-pocock-skills` and a tracker.
C. Hybrid: today use `/research` + `/wayfinder` for decisions and external-fact notes (notes/research fit the hackathon rule); at kickoff turn the resulting decisions into OpenSpec proposals (`/opsx:propose`) and build via `/opsx:apply`. Avoid also using `to-spec`/`to-tickets` and local `/spec:*` to prevent three parallel spec stores.
Open questions for user: is writing OpenSpec specs before kickoff acceptable under rule 1; which tracker (if any); upgrade OpenSpec 1.15.0 -> 1.16.1 first; AI-use disclosure notes (record which skills were used).
