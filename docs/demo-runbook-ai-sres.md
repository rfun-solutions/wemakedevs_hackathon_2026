# Runbook: two AI SREs (Radar and Agent0)

Order matters. Section 1 is NOT staged: it happens when something real happens.

## 1. Unstaged Radar investigation (first real cluster event)
The first real cluster event of the day (likely `exceeded quota` on the first Argo sync, a CNPG readiness flap, or a CrashLoop after a merge) is investigated in Radar as it happens.

1. Start a Radar AI investigation on the affected workload at the moment you notice it (`start_investigation`, or the Radar UI).
2. Act on the finding through a normal Gitar-reviewed PR. Cite the investigation in the PR description.
3. Mark the investigation **Shared** and keep the link.
4. Fill the row below the same day. If nothing real has happened by 15:30, write that here and do not relabel the 15:45 staged slowdown as organic.

| Event | Time | Radar verdict | What we did | PR | Shared link |
|---|---|---|---|---|---|
| (fill in when it happens) | | | | | |

Status of this section at 15:30: _not yet filled_.

### After every merge (routine)
Using the Radar MCP, against the team cluster:
1. GitOps sync status for the app (`fleet_list_gitops` or `manage_gitops` equivalent): Synced and Healthy.
2. Changes since the last deploy (`get_changes`).
3. Warning events and pod restarts in namespace `team-kubecompanion2026`.
4. Anything odd goes in the PR as a note; if it is real, it becomes the investigation above.

## 2. Same incident, two views (15:45 slowdown)
Prerequisite: the backup chaos route in `docs/demo-runbook-dash0.md` is set and the bounded load is running (orchestrator OK first).

1. Within the same minute, start both:
   - Agent0 in Dash0: "Why is /api/agenda slow since 15:45?"
   - Radar AI investigation on Deployment `app`: "Why is the app slow since 15:45?"
2. Record both verdicts:

| | Agent0 (telemetry view) | Radar (cluster view) |
|---|---|---|
| Verdict | | |
| Evidence | | |
| Where they agree | | |
| Where they differ | | |

3. Mark the Radar investigation **Shared**.
4. The fix PR description links both the Agent0 thread and the Shared Radar investigation.
5. After the deploy: run a Radar investigation "Anything wrong after the deploy of `<sha>`?".
6. On all-clear, run `node scripts/release-note.mjs <sha> <radar-shared-url> --apply` (F2 writes the script) so the Status footer shows "Last release HH:MM, Gitar-reviewed, Radar all-clear" with the shared link.
7. At 17:30 show the two Shared links and the table.

Budget: 3 to 4 Radar investigations in total for the day.

## Fallbacks
- Radar slow or unavailable: show Agent0's verdict, say Radar's investigation is still running, and add its result to the table afterwards.
- The two disagree: say so; the table is the point. Prefer the one backed by evidence you can open (spans, events).
- No Gitar review on the PR: the release footer omits the clause; do not claim it.
