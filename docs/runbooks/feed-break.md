# Runbook: feed break (G1), backup beat

Demo story: overnight the schedule feed changed shape. The `feed-contract` check fails on a harmless PR, Gitar fixes
the mapper and schema, CI turns green. This is a backup to the a11y beat (`a11y-regression.md`); G3 (budget) is not
the stage beat.

## Before (T-10 min)

- Prepared harmless PR from branch `bugfix/KC-0-docs-typo` (docs typo only), label `gitar-managed`, auto-apply on, NOT yet opened.
- `main` green; `gh variable list` shows `FEED_FIXTURE` unset or `sessionize-v1`.
- Fallback: a rehearsal PR tab, then a pre-recorded run.

## On stage

| Time | Action |
| --- | --- |
| T0 | `gh variable set FEED_FIXTURE --body sessionize-v2`, then open the PR (the clock starts at PR open). |
| T+1 min | `feed-contract` is red at "Validate feed against schema", naming `starts_at`, `ends_at` and the room fields. Gitar review appears. Narrate: "overnight the feed changed shape". |
| T+2.5 min | Gitar fix commit (mapper and schema accept v2); CI turns green. Show the Dash0 trace if CI traces are on. |
| Nudge at T+4 | Comment `Gitar fix CI, keep fixtures unchanged`. |

Backup break: `gh variable set FEED_MODE --body 429`, same flow; the expected fix is bounded retry honouring `Retry-After`.
Reverting the PR is not a fix: a new PR still fails while `FEED_FIXTURE` stays `sessionize-v2`.

## Reset (do not skip)

```bash
gh variable set FEED_FIXTURE --body sessionize-v1
gh variable set FEED_MODE --body ok
```

Close the PR, rerun main CI. Caveat: Gitar's 3-commit cap per PR.

## Dry run

Not yet run end to end; record times in RUNNING-LOG.md after the rehearsal.
