# Runbook: a11y regression (G5), the on-stage Gitar fix

This is THE on-stage Gitar fix (decided 2026-11-08). Narrate it as "this PR broke Promise P3". The G3 budget PR is
repo evidence only, not a stage beat.

## Before (T-10 min)

- D's branch `bugfix/KC-<n>-card-contrast` is ready (one token in `web/src/styles/tokens.css` drops the show-to-person card text to 3.9:1).
- The PR is NOT yet open. Label `gitar-managed` is set at open; auto-apply must be on (comment `gitar auto-apply:on` if needed).
- `main` is green and `FEED_FIXTURE` is `sessionize-v1` (the feed break must not be live at the same time).
- Fallback tabs ready: the dress-rehearsal G5 PR (from D's `-rehearsal` branch), then the G3 evidence PR link.

## On stage

| Time         | Action                                                                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| T0           | Open the PR (`gh pr create --label gitar-managed ...`). The clock starts at PR open.                                                                |
| T+1 min      | `a11y` goes red; the log shows the token name and the computed foreground and background colours. The Gitar review appears.                         |
| T+2.5 min    | Gitar's fix commit edits `web/src/styles/tokens.css` only; CI turns green.                                                                          |
| Narrate      | Rule A11Y-2 in `.gitar/review/accessibility.md` forbids weakening the test: fix the token, never relax an axe rule, add an exclusion, skip a test or lower a threshold. |
| Nudge at T+4 | Comment `Gitar fix CI, keep the axe rules unchanged`.                                                                                               |

If Gitar edits the test, adds an exclusion or touches anything other than `tokens.css`, reject the commit on stage and say so.

## Fallback order

1. The dress-rehearsal G5 PR tab (already green after Gitar's fix).
2. The G3 evidence PR link (budget break: Gitar lowered a YAML memory request).
3. The pre-recorded run.

## Reset

Close the PR; delete nothing on `main`. Check `gh variable list` shows no stray `FEED_FIXTURE` or `FEED_MODE`.

## Dry run

Run once on D's `-rehearsal` branch; that PR becomes the fallback tab and the stage branch stays unopened. Record the
times in RUNNING-LOG.md. `feed-break.md` and `hot-paths.md` must not call G3 the stage beat.
