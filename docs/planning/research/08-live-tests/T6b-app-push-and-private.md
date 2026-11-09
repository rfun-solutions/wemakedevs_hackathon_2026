# T6b: App bypass push end to end, and what a PRIVATE repo in a free org loses
Run 2026-11-08 (UTC), repo https://github.com/an org test repo (throwaway, free org). Follows [T6](T6-org-merge-queue-app.md).

## Part A: deploy-bot push through the GitHub App: WORKS
- Key stored with `gh secret set DEPLOY_BOT_PRIVATE_KEY < key.pem` (key file is chmod 600, gitignored, never printed or copied); variable `DEPLOY_BOT_APP_ID=<test-app-id>`.
- `actions/create-github-app-token` latest release: **v3.3.0** (pinned in the workflow).
- Workflow `deploy-bot.yml` (top-level `permissions: contents: read`; `workflow_dispatch` + `push` to main; job `if` skips commits starting `deploy:`): mint App token, checkout with it, write `deploy/tag.txt`, commit `deploy: <sha>` as `<slug>[bot]` (id looked up via `gh api /users/<slug>[bot]`), `git push origin HEAD:main`.
- Merged via PR [#4](https://github.com/an org test repo/pull/4) with `gh pr merge 4 --auto` (queue merged it ~45 s after open).
- Result on protected main: push accepted. Log of run 42536526155:
  `remote: Bypassed rule violations for refs/heads/main:` then three lines: "Changes must be made through a pull request.", "Required status check "test" is expected.", "Changes must be made through the merge queue".
- Commit: `a813bab deploy: e4ebc37...` author `test-deploy-bot-app[bot]` `354237361+test-deploy-bot-app[bot]@users.noreply.github.com`, committed 23:43:26Z, 7 s after the PR merge commit `e4ebc37` (23:42:26Z merge, push-triggered run began 23:43:19Z). A manual `workflow_dispatch` run (23:43:48Z) also pushed `bca30c1` at 23:43:57Z.
- No loop: the push-triggered runs on `deploy:` commits show `skipped` (1-2 s).
- **Control, plain `git push` with the `github-actions` GITHUB_TOKEN** (`control.yml`, `contents: write`): REJECTED with `remote: error: GH013: Repository rule violations found for refs/heads/main.` + the same three violations; `PUSH_RESULT=rejected`.
- Gotcha: a `workflow_dispatch` run racing a push-triggered run can fail with `! [rejected] HEAD -> main (fetch first)` (non-fast-forward, run 42536961854). Add `git pull --rebase` before push or serialise with `concurrency:`.

## Part B: repo switched to PRIVATE (free org): protection is NOT enforced
`gh repo edit --visibility private --accept-visibility-change-consequences` OK (visibility PRIVATE).

| Check | Evidence | Verdict |
|---|---|---|
| Read ruleset / list rulesets | `GET /repos/.../rulesets` and `/rulesets/26816801`: HTTP 403 "Upgrade to GitHub Pro or make this repository public to enable this feature." | unavailable |
| Branch rules / classic protection | `GET /rules/branches/main` and `/branches/main/protection`: HTTP 403, same message | unavailable |
| Create a 2nd ruleset | `POST /rulesets` : HTTP 403, same message | blocked |
| Direct push to main by repo owner (not a bypass actor) | `7ba1741..0edb301  main -> main` accepted, no GH013 | rules NOT enforced |
| GITHUB_TOKEN push (control) | `PUSH_RESULT=accepted` | rules NOT enforced |
| Merge queue | `gh pr merge 6 --auto` (no method) printed usage error (no queue strategy); `--auto --squash` merged PR #6 at once (state MERGED within 5 s, not queued). GraphQL `mergeQueue` still returns an id/url but nothing is queued. | not applied |
| Actions | CI `pull_request` run success; deploy-bot runs success (private repos use free minutes) | works |
| App bypass push | push by the App accepted (commit `14ca418`), but its log has no "Bypassed rule violations" line: nothing to bypass | works, trivially |

Conclusion: on a private repo in a free org, rulesets (and so required checks, PR-only, merge queue) are silently dormant, not deleted. The API refuses to read or change them, and pushes go straight through.

## Switched back to PUBLIC
`gh repo edit --visibility public ...` OK. Ruleset `main-protection` (26816801, active) came back intact with bypass actor <test-app-id>. Direct push by the owner is REJECTED again: `GH013 ... push declined due to repository rule violations`.

## Implications for the real repo
- Keeping `wemakedevs_hackathon_2026` private until submission means no enforced main protection or merge queue. To enforce: make it public (or upgrade to Team/Pro). Private + discipline (PRs by habit) is the fallback.
- The deploy-bot App path works on public once the ruleset lists the App as bypass actor. Store `DEPLOY_BOT_PRIVATE_KEY` and app id the same way.
- Cleanup after the event: delete repo `pipeline-test-repo`, delete App `test-deploy-bot-app`, delete the local `.pem`. Leftover in the test repo: secret `DEPLOY_BOT_PRIVATE_KEY`, variable `DEPLOY_BOT_APP_ID`, workflows `deploy-bot.yml` and `control.yml` (the latter can push if the ruleset is ever absent).
