# Demo seeding

`POST /api/capture/seed` inserts fictional notes, people and promises for the reserved demo device
`00000000-0000-4000-8000-00000000ca1e` (14 notes over 2026-11-10 to 2026-11-12, 4 people, 3 promises).
It is idempotent (fixed client ids) and exists only while `KC_DEMO_SEED=1`; otherwise it returns 404.
The flag lives in git, in `deploy/deployment.yaml` under the `# >> b-capture` env marker
(`KC_DEMO_SEED`, default `"0"`). Argo CD owns the Deployment with `selfHeal: true`, so
`kubectl set env` is reverted within minutes and must not be used. The orchestrator flips the flag
only during the 15:45 staging hour and the demo window.

## Turn it on

1. Open a one-line PR that changes the value to `"1"`:

   ```yaml
   # >> b-capture
   - name: KC_DEMO_SEED
     value: "1"
   ```

2. Merge it. The deploy bot updates the image tag and Argo CD syncs (about 5 minutes).
3. Check the endpoint and seed:

   ```sh
   curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<public-url>/api/capture/seed   # 200 when on
   curl -s -X POST https://<public-url>/api/capture/seed
   # {"device_id":"00000000-0000-4000-8000-00000000ca1e","notes":14,"people":4,"promises":3}
   npm run seed:threads   # change C: calls the same endpoint, then builds threads
   ```

   Run the seed twice: the counts stay the same (no duplicates).

## Turn it off and check

1. Revert that PR (value back to `"0"`), merge, and wait for the Argo sync.
2. Check the endpoint is gone:

   ```sh
   curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<public-url>/api/capture/seed   # must print 404
   ```

Seeded rows stay in the database and are only reachable with the demo device id.
Never put real attendee names in `api/src/services/capture/seed-data.ts` (Gitar rule DD-2).
