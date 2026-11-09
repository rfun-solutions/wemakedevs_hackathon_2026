# T1: Gitar on external-dependency CI failures under branch protection
Run 2026-11-08 (UTC times). Repo: https://github.com/a throwaway test repo (throwaway). Workflow `ci.yml`: jobs `lint-unit` and `schedule-feed-contract` (mock upstream started in the job, driven by `chaos.json`, validates the schema, runs the mapper). Rules in `.gitar/review/` (external-calls, time-zones, accessibility). Actions: checkout v7.0.1, setup-node v7.1.0, `permissions: contents: read`.

## Results per variant (auto-apply on via comment `gitar auto-apply:on` AND label `gitar-managed`, set 21:58:21-25)
| | PR | Opened | First Gitar review | Diagnosis+fix commit | CI green after fix | What Gitar did |
|---|---|---|---|---|---|---|
| (a) schema drift (v2 fixture) | [#1](https://github.com/a throwaway test repo/pull/1) | 21:57:50 | 21:58:52 (about 1 min) | 22:00:27 (about 2.5 min after open) | 22:00:33 | CODE fix: `src/schema.mjs`, `src/mapper.mjs`, new v2 tests. Kept `chaos.json` as is. Correct. |
| (b) HTTP 429 x2 | [#2](https://github.com/a throwaway test repo/pull/2) | 21:57:54 | 21:58:54 | 22:00:16 | 22:00:23 | CODE fix: retry with backoff, honours `Retry-After`, timeout, new `test/fetchFeed.test.mjs` (83 lines). Second follow-up commit 22:01:55 ("cap retries, cancel bodies") after its own review findings. Kept `chaos.json`. |
| (c) expired TLS (`CERT_HAS_EXPIRED`) | [#3](https://github.com/a throwaway test repo/pull/3) | 21:57:59 | 21:59:11 | 22:00:14 | 22:00:20 | NO code fix: it REVERTED `chaos.json` to `mode: ok` ("restore healthy contract fixture mode"). PR ends with 0 changed files. Review text: "Keep as test-only branch, don't merge, or set mode back to ok". It treated the chaos config as the bug. |

- Never touched `.github/workflows/*`. No branch hit the 3-commit cap (max 2 Gitar commits).
- Classification: no explicit label (no "flaky/infra" wording). The review comment is a "Code Review" dashboard with a bug finding that moves to "closed"; for (c) it called the failure a bug in the PR's config, not an infrastructure problem. The docs' triage labels were not seen.
- Gitar's fixes passed CI on first rerun in all three cases.
- Review rules: Gitar cited the repo rule text ("The repo rule says every upstream shape we depend on needs a fixture-backed contract test") on PR #1, and the timeout/retry rule on #2. Note the default branch was `gh-pages` (a sibling test, T4) at first; I changed it to `main`. Gitar reads config from the default branch, so rules may only have applied thanks to the PR head. Footer said "Rules: No rules evaluated" (that is `.gitar/rules`, not `.gitar/review`).
- Time to a fix: 2.5 min from PR open on every variant. Gitar posted a review (inline review state COMMENTED) before CI even finished.
- Demo implication: (a) is the reliable demo. (c) shows the honest "Gitar undoes the chaos" outcome; the PR would be merge-safe but the fix is not a real fix. Design chaos variants so the revert is not a valid answer (e.g. the failure comes from an external state not in the PR diff).

## Branch protection
- Classic protection (PR required, 2 required checks, `strict: true`, 0 approvals, enforce_admins off): works. Required checks must exist (job names `lint-unit`, `schedule-feed-contract`; "2 of 2 required status checks are expected" until first reported).
- "Require branches up to date": workable but costly. With strict on, PR #1 showed `BEHIND` the moment main moved; every open PR then needs update-branch/rebase and a CI rerun. With strict off the state is clean.
- Gitar pushes to the PR branch are not blocked (feature branches unprotected). Its commits are co-authored, not force-pushed. After Gitar commits, local branches need `git pull` before pushing.
- Squash merge of #1 produced one main commit with Gitar listed as co-author.

## Extra checks from the coordinator
1. **Merge queue on a free public repo: NO (user-owned repo).** Ruleset create with a `merge_queue` rule fails with 422 "Invalid rule 'merge_queue'" even when it is the only rule; the same ruleset without it is accepted (PR required, required checks, 0 approvals, squash only, non_fast_forward, deletion all fine). GitHub documents merge queue for organization-owned repos; `rfun` is a personal account. Likely works if the hackathon repo lives in an org; `rfun/wemakedevs_hackathon_2026` is also personal, so assume NO there. Fallback profile: P3 (strict off) or P2.
2. **github-actions app as ruleset bypass actor: NO on a user-owned repo.** 422 "Actor GitHub Actions integration must be part of the ruleset source or owner organization" (app id 15368). `RepositoryRole` admin (id 5) is accepted. Consequences: a workflow's `GITHUB_TOKEN` push of a deploy commit to main is rejected both under classic protection and under the ruleset ("GH006 ... Changes must be made through a pull request", "2 of 2 required status checks are expected", workflow run 42527939472 for classic, then again under the ruleset). The human admin can push directly to main (with role bypass, or classic with enforce_admins off): output says "Bypassed rule violations". Options left: O3 (deploy branch, unprotected), O2 (own GitHub App or a PAT of the admin, which then bypasses via admin role), or an unprotected path. Not tested: custom GitHub App as bypass actor (should be possible if the App is owned by the same account and installed on the repo; unverified).
3. **Gitar and required approvals: it is a PR review (state `COMMENTED`), NOT a status check and NOT an approval.** `gitar-bot[bot]` posts reviews with state COMMENTED, plus a dashboard issue comment that says "Approved" in text. No check run or commit status from Gitar exists (only `github-actions` checks). With required approvals set to 1, PR #2 and #3 stayed `REVIEW_REQUIRED`/`BLOCKED` despite Gitar's "Approved" text. So: use approvals 0 and require CI checks; Gitar cannot be a required check here (auto-approve and merge-blocking Pro features were not visible/tested).
4. **Re-review after rebase: no re-review observed.** I moved main (admin push), rebased PR #2's branch and force-pushed (22:02:39). In the next 2.5 minutes there were no new Gitar reviews or comment updates, no new commits. Gitar DID re-review after its own pushes (dashboard edited about 1 min after each of its commits, e.g. 22:02:03 after the 22:01:55 commit). Could not measure budget use (no usage meter seen); merge-queue rebase untestable (see 1).

## Bot commit to main (step 5)
Workflow `bot-commit.yml` (contents: write, commits with `GITHUB_TOKEN`) is rejected by protection (classic and ruleset). Needs a bypass that the Actions app cannot get on a personal repo; see check 2.

## Surprises
- The repo was not empty: it had a `gh-pages` branch and default branch (sibling T4 test). `workflow_dispatch` returned 404 until the default branch was `main`. I switched the default branch to main; Pages source branch `gh-pages` is unaffected.
- Mock + `faketime` generated an already-expired cert; Node reports `CERT_HAS_EXPIRED` cleanly.
- Pushed a broken `package.json` once (first main CI run red); fixed directly on main before protection.
