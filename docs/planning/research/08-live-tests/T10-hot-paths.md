# T10: production rules reach Gitar (G4 end to end)
Run 2026-11-09 (UTC, 05:01-05:04), repo https://github.com/an org test repo.

**Verdict: PASS.** The deploy-bot App pushed a generated rule to protected main, and the next PR touching the route got Gitar findings that quote the rule. Keeps G4.

## Step 1: App pushes the rule to protected main
- Workflow `rules-from-prod.yml` (added in PR [#7](https://github.com/an org test repo/pull/7)); `workflow_dispatch` at 05:01:43; same pattern as `deploy-bot.yml` (create-github-app-token v3.3.0, `permissions: contents: read`, push `HEAD:main`).
- Commit `8004c67` `rules: add .gitar/review/hot-paths.md` by `test-deploy-bot-app[bot]`, 05:01:51 (8 s after dispatch). Log: `Bypassed rule violations for refs/heads/main` (PR required, status check "test" expected, merge queue). The deploy-bot's own follow-up `deploy:` commit was skipped as designed (no loop).
- File content: header "Generated from Dash0 at 2026-11-08T12:00Z (FAKE test numbers): /api/agenda p95 2.1 s (budget 500 ms)." plus one rule: changes to `src/api/agenda.mjs` must not call the database inside a loop and must keep exported `AGENDA_P95_BUDGET_MS` at 500 or lower. It also said "Quote this rule's header in the review finding when it applies".

## Step 2: PR touching the route: [#9](https://github.com/an org test repo/pull/9) (closed unmerged)
`src/api/agenda.mjs` with a per-id `await db.query` in a loop and `AGENDA_P95_BUDGET_MS = 2000`. Auto-apply NOT enabled (review only).

| Event | UTC | After open |
|---|---|---|
| Rule on main | 05:01:51 | (1 min 22 s before the PR) |
| PR opened | 05:03:13 | 0 |
| Gitar inline findings + review | 05:04:13-14 | 60 s |
| Gitar dashboard ("Changes requested", 2 findings) | 05:04:15 | 62 s |

## What Gitar did
- Two inline findings on `src/api/agenda.mjs`, each opening with `Per the review rule "..."`: (1) Performance, N+1 query in the loop, quoting "any change to src/api/agenda.mjs must not call the database inside a loop"; (2) Quality, constant 2000 > 500, quoting "must keep the exported constant AGENDA_P95_BUDGET_MS at 500 or lower". Each had a suggested fix with an "Apply fix" checkbox.
- It quoted the **rule sentences**, not the generated header: no "p95 2.1 s" figure or "Generated from Dash0" in the output. For the demo, the production number only appears if the rule text itself contains it (e.g. "p95 2.1 s over budget" inside the rule).
- Footer again "Rules: No rules evaluated", yet the rule was demonstrably applied, so that footer refers to `.gitar/rules`, not `.gitar/review`.
- The rule was read from main after one minute; no extra delay seen between push and use.
