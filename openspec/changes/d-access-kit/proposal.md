## Why

Kay (they/them) is hard of hearing, reads English as a second language, and is at their first KubeCon. In a loud hallway Kay cannot say "please type" and cannot read small grey text on a bright phone. Every other change in KubeCompanion renders UI, so the access layer has to exist first. This change scores the Conferences for Everyone track (the Deaf/HoH, ESL, low-vision and dyslexia groups) and sets the WCAG 2.2 AA baseline all tracks inherit.

The product's core problem is that a conference brings more conversations per hour than anyone can remember (see `openspec/config.yaml` `context`). For Kay that loss starts earlier: access support stops at the talk-room door. D carries it into the hallway and writes it down as five **Access promises** (P1-P5) in Kay's words, so the guarantee is a file Kay can read, Gitar enforces (every inclusion rule cites a promise id), Dash0 measures (F's lights) and Radar backs (F's all-clear footer).

D merges first in wave 1 so other changes build on its tokens, `t()` and a11y rules instead of restyling later.

D also writes the inclusion review rules Gitar cites on every PR (G1): Deaf and ESL inclusion, plain language and demo-data privacy. The "Can you repeat that?" card almost shipping English-only becomes a Gitar finding on D's own PR. And D stages the accessibility regression Gitar fixes on stage (G5, the on-stage Gitar beat, decided 2026-11-08; G's budget break G3 is a prepared repo-evidence PR): the "I'm deaf, please type" card failing contrast in bright hallway light, which breaks Promise P3.

Judging criteria scored (quoted from research/01 §5):
- Never Merge Broken: "Project-aware setup, with review instructions and repository rules that reflect how your team actually works." (G1)
- Never Merge Broken: "Using CI failure diagnosis and auto-apply to fix real problems." (G5)
- Never Merge Broken: "How well your project makes conferences easier."
- Conferences for Everyone has no listed criteria (research/01 §5); it is the track this change serves most directly.

## What Changes

- Access promises P1-P5: `ACCESS-PROMISES.md` (the content, in Kay's words, with the rule ids and the signal behind each) and `web/src/features/access/promises.ts` (`PROMISES`, ids and i18n keys) with `access.promise.*` strings. F renders the lights; D owns the words.
- Communication cards: preset phrases ("I'm deaf, please type", "Slower please", "Can you repeat that?", and for the Stuttering and Speech Diversity group "I stutter, please give me time to finish") and a free-text card. Each opens a full-screen, high-contrast show-to-person mode, with optional text-to-speech.
- Display modes: large-type slider, Atkinson Hyperlegible font toggle, high contrast, reduced motion. Stored locally, applied before first paint.
- i18n framework: `t('<change>.<key>')`, language switcher, `dir` handling. EN and ES complete; PT-BR and AR (RTL) at smoke-test level. Strings are Claude-assisted and disclosed in the UI.
- Calm places: a static, offline list of quiet rooms 260A (all attendees) and 260B (women and non-binary) at Salt Palace L2, the prayer room at Hyatt Regency L5, the nursing room and child care, from the public KubeCon page (research/04). No crowd data, no telemetry beyond a view event.
- Communication-preference badge: pronouns, "I prefer text", "quiet please", stored only on the device.
- Design tokens (`web/src/styles/tokens.css`) and global CSS, from the Impeccable direction the user picks at about 11:05. A task runs Impeccable and presents 2-3 mobile-first directions before tokens are finalised.
- Inclusion review rule content (G1): D writes the full rules in `.gitar/review/inclusion.md` and `demo-data.md` (files created by C0) and adds the G5 "fix the token, never weaken the test" line to `accessibility.md`, in a tiny rules-only PR 0 that merges before D's first feature PR. Every rule sentence names the promise it protects ("IN-2 (Promise P4) ..."), because Gitar quotes rule sentences (T10).
- Staged accessibility regression (G5, the on-stage Gitar fix): a prepared, unopened branch that drops one card token to 3.9:1, plus contrast-test failure messages that name the token and the computed colours. G's runbook drives it on stage.
- WCAG 2.2 AA baseline: 24 px minimum targets, visible focus not obscured, live-region helper, no `div` buttons, axe-clean, written into a short rules doc other changes inherit.

## Impact

- New capabilities: `communication-cards`, `display-modes`, `i18n`, `design-tokens-a11y`, `access-promises`, `calm-places`.
- Touches `web/` only. No API, database or migration (D has no migration range). Inserts lines under its own markers (`d-access-kit`, `d-access-kit-cards`) in `web/src/routes.ts` and `web/src/nav.ts` and adds its one Under-the-hood entry `web/src/under-the-hood/entries/d-access-kit.json`.
- Depends on C0 (scaffold, registries, CI `a11y` and `e2e-mobile` jobs, telemetry browser SDK).
- Consumed by A, B, C, E, F, G, H: tokens, `t()`, `announce()`, display-mode classes. E reuses show-to-person mode for caption display. F reads `PROMISES` for the lights; G's generator and H may cite promise ids.
- Risk: the token direction is a human decision at 11:05. Tokens ship with a neutral default so the build does not block, and the picked direction is applied in one file.
