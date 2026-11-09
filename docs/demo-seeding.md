# Demo seeding

`POST /api/capture/seed` inserts fictional notes, people and promises for the reserved demo device
`00000000-0000-4000-8000-00000000ca1e` (14 notes over 2026-11-10 to 2026-11-12, 4 people, 3 promises).
It is idempotent (fixed client ids) and exists only while `KC_DEMO_SEED=1`; otherwise it returns 404.
The flag is not stored in git. The orchestrator controls it on the public deployment only during
the 15:45 staging hour and the demo window. Do not toggle it without explicit orchestrator approval.

## Turn it on

Wait for the orchestrator to approve and enable the flag. Do not add `KC_DEMO_SEED` to
`deploy/deployment.yaml` or change it yourself. Once the orchestrator has enabled it, check the
endpoint and seed:

   ```sh
   curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<public-url>/api/capture/seed   # 200 when on
   curl -s -X POST https://<public-url>/api/capture/seed
   # {"device_id":"00000000-0000-4000-8000-00000000ca1e","notes":14,"people":4,"promises":3}
   npm run seed:threads   # change C: calls the same endpoint, then builds threads
   ```

   Run the seed twice: the counts stay the same (no duplicates).

## Turn it off and check

After the demo window, the orchestrator disables the flag on the public deployment. Check the
endpoint is gone:

   ```sh
   curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<public-url>/api/capture/seed   # must print 404
   ```

Seeded rows stay in the database and are only reachable with the demo device id.
Never put real attendee names in `api/src/services/capture/seed-data.ts` (Gitar rule DD-2).
