# T6: Merge queue and a custom GitHub App bypass in the rfun-solutions org
Run 2026-11-08 (UTC). Repo: https://github.com/an org test repo (public, throwaway, org on the **free** plan). Default branch `main`. Node 22 project (`node --test`), workflow `.github/workflows/ci.yml`: top-level `permissions: contents: read`, checkout v7.0.1, setup-node v7.1.0, triggers `pull_request` (main) + `merge_group`, one job `test`.

## 1. Ruleset with merge queue: ACCEPTED in the org
Ruleset `main-protection` (id 26816801), target `~DEFAULT_BRANCH`, active:
- `pull_request`: 0 approvals, `allowed_merge_methods: [squash]`
- `required_status_checks`: `test` (integration 15368 = GitHub Actions), strict **off**
- `non_fast_forward`, `deletion`
- `merge_queue`: SQUASH, ALLGREEN, build 5, merge 1–5, wait 0 min, check timeout 15 min

Created in one POST, no 422 (T1's personal repo rejected `merge_queue`). Repo settings: squash only, auto-merge on, delete branch on merge. Public free-org repo is enough; no Team plan needed for a repo-level ruleset with a queue.

`gh pr merge N --auto --squash` prints "! The merge strategy for main is set by the merge queue" and enqueues (the queue's method wins). Plain `gh pr merge N --auto` is the right call.

## 2. Queue run (3 PRs, each adds one file)
| PR | Opened | PR CI done | Enqueued | merge_group run | Merged | Enqueue → merged |
|---|---|---|---|---|---|---|
| [#1](https://github.com/an org test repo/pull/1) | 22:31:02 | 22:31:18 | 22:31:15 | 22:31:48–22:31:57 | 22:32:07 | 52 s |
| [#2](https://github.com/an org test repo/pull/2) | 22:31:07 | 22:31:24 | 22:31:17 | 22:31:49–22:31:57 | 22:32:07 | 50 s |
| [#3](https://github.com/an org test repo/pull/3) | 22:31:12 | 22:31:24 | 22:31:19 | 22:32:10–22:32:20 | 22:32:43 | 84 s |

- #1 and #2 were built together (#2's group branch is based on #1's) and landed in the same second as two squash commits. #3 was enqueued while its PR CI was still running, so it joined the next group after #1/#2 merged.
- Overhead per group: ~20–30 s from queue entry to `merge_group` run start, ~10 s from green to merge. With real CI (5–8 min) expect roughly CI time + ~45 s per group; groups of up to 5 build in parallel.
- `main` history: one squash commit per PR (`feat: [KC-n] add vn (#n)`). No PR needed an update-branch.
- Branches `gh-readonly-queue/main/pr-N-<sha>` appear briefly; CI must listen to `merge_group`, otherwise the queue waits for the timeout.

## 3. Custom GitHub App `test-deploy-bot-app`
- Registered in the browser under the org (Settings > Developer settings > GitHub Apps > New, pre-filled via URL params). App id **<test-app-id>**, owner `rfun-solutions`, "Only on this account". Permissions: Contents read & write, Metadata read; no webhook, no events. No password, sudo, 2FA or CAPTCHA prompt appeared.
- GitHub shows a banner "you must generate a private key in order to install"; installation still worked without one. Installed on **pipeline-test-repo only** (installation id 179989858, `repository_selection: selected`).
- **Bypass actor: ACCEPTED.** `PUT .../rulesets/26816801` with `{"actor_id":<test-app-id>,"actor_type":"Integration","bypass_mode":"always"}` returned 200 and the ruleset now lists it. All five rules stayed in place.
- Private key **not generated** (needs separate approval).

## 4. GitHub Actions app as bypass actor in the org: NO
- Repo ruleset with bypass actor Integration 15368 (tested on a separate disabled probe ruleset): 422 "Actor GitHub Actions integration must be part of the ruleset source or owner organization", the same as T1 on the personal repo.
- Org-level ruleset: 403 "Upgrade to GitHub Team to enable this feature".
- So O1 (`GITHUB_TOKEN` push bypass) stays unavailable on a free org; O2 (custom App) is the working path, O3 (deploy branch) remains the no-bypass fallback.

## Remaining step (needs approval)
Generate the App's private key, store `KC_BOT_APP_ID` + `KC_BOT_PRIVATE_KEY` as repo secrets, then run a workflow that mints a token with `actions/create-github-app-token` and pushes a `deploy:` commit straight to protected `main`. Expected: push accepted as `test-deploy-bot-app[bot]` ("Bypassed rule violations"). Not yet verified end to end.

## Notes for the real repo
- The hackathon repo must be **public** for the free-org queue (this test repo was public). See the open to-do about making `rfun-solutions/wemakedevs_hackathon_2026` public.
- Required check `test` had not reported before the ruleset was created; that was fine because the first PRs reported it.
- Cleanup after the event: delete repo `pipeline-test-repo` and the App `test-deploy-bot-app`.
