// Entry for the Kubernetes CronJob: `node --import ./api/dist/telemetry.js api/dist/jobs/ingest.js`.
import { createPool } from '../db.js';
import { runIngest } from '../services/schedule/ingest.js';
import { shutdownTelemetry } from '../telemetry.js';

const pool = createPool();
if (!pool) {
  console.error('DATABASE_URI is not set');
  process.exit(1);
}
let code = 0;
try {
  const r = await runIngest({ pool });
  console.log(JSON.stringify({ event: 'schedule.ingest', ...r }));
  if (r.status === 'error') code = 1;
} catch (err) {
  console.error('schedule ingest failed', (err as Error).message);
  code = 1;
} finally {
  await pool.end().catch(() => undefined);
  await shutdownTelemetry();
}
process.exit(code);
