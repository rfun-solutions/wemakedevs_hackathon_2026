import { buildApp } from './app.js';
import { createPool } from './db.js';
import { loadMigrations, runMigrations } from './migrate.js';
import { shutdownTelemetry } from './telemetry.js';

const port = Number(process.env.PORT ?? 8080);
const pool = createPool();
let migrated = false;

// Shutdown handlers go in before anything slow (KC-1): the app runs as PID 1, which ignores SIGTERM
// without a handler, so a kill during boot used to wait out the 30s grace period and end in SIGKILL (137).
const ref: { app?: Awaited<ReturnType<typeof buildApp>> } = {};
let closing = false;
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    if (closing) return;
    closing = true;
    void (async () => {
      await ref.app?.close().catch(() => undefined);
      await pool?.end().catch(() => undefined);
      await shutdownTelemetry();
      process.exit(0);
    })();
  });
}

const app = await buildApp({
  ...(pool ? { db: pool } : {}),
  isMigrated: () => migrated,
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});
ref.app = app;

async function migrateWithRetry(): Promise<void> {
  if (!pool) {
    app.log.warn('DATABASE_URI is not set; /readyz will report 503');
    return;
  }
  const migrations = await loadMigrations();
  for (let attempt = 1; !migrated; attempt++) {
    try {
      const applied = await runMigrations(pool, migrations);
      migrated = true;
      app.log.info({ applied }, 'migrations complete');
    } catch (err) {
      app.log.error({ err, attempt }, 'migration failed; retrying in 5s');
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

// Listen first so /healthz answers while the database comes up; /readyz gates on migrations.
await app.listen({ port, host: '0.0.0.0' });
void migrateWithRetry();
