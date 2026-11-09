// Entry for the Kubernetes CronJob: `node --import ./api/dist/telemetry.js api/dist/services/threads/cronMain.js`.
import { shutdownTelemetry } from '../../telemetry.js';
import { cronRun } from './cronRun.js';

const r = await cronRun(
  process.env.THREADS_BASE_URL ?? 'http://app',
  process.env.THREADS_CRON_TOKEN,
);
console.log(JSON.stringify({ event: 'threads.cron_run', status: r.status, ok: r.ok }));
if (!r.ok) console.error(r.body.slice(0, 300));
await shutdownTelemetry();
process.exit(r.ok ? 0 : 1);
