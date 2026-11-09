import { SpanStatusCode } from '@opentelemetry/api';
import type { FastifyPluginAsync } from 'fastify';
import { closeSharedPool, resolveDb, type CaptureDb } from '../services/capture/db.js';
import {
  parseSavedMs,
  recordCreateMs,
  recordSavedMs,
  tracer,
} from '../services/capture/metrics.js';
import { seedDemo, seedEnabled } from '../services/capture/seed.js';
import { isUuid, validateListQuery, validateNote } from '../services/capture/validate.js';

export interface CaptureRouteOptions {
  db?: CaptureDb;
}

const COLUMNS = 'id, client_id, body, source, session_id, person_ids, created_at';

export const noteRoutes: FastifyPluginAsync<CaptureRouteOptions> = async (app, opts) => {
  const db = resolveDb(opts.db);
  if (!opts.db) app.addHook('onClose', closeSharedPool);
  const unavailable = (reply: { code(n: number): { send(b: unknown): unknown } }) =>
    reply.code(503).send({ error: 'db_unavailable' });

  // Idempotent on (device_id, client_id): a replayed queue item returns 200 with the existing row.
  app.post('/api/notes', async (request, reply) => {
    if (!db) return unavailable(reply);
    const started = performance.now();
    return tracer.startActiveSpan('kc.capture.notes_create', async (span) => {
      try {
        const parsed = validateNote(request.body);
        if (!parsed.ok) {
          span.setAttribute('kc.invalid', true);
          return reply.code(400).send({ error: 'invalid_note', message: parsed.error });
        }
        const n = parsed.value;
        span.setAttribute('kc.source', n.source);
        const deviceId = request.deviceId as string;
        const inserted = await db.query(
          `INSERT INTO notes (device_id, client_id, body, source, session_id, person_ids, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (device_id, client_id) DO NOTHING
           RETURNING id, client_id, created_at`,
          [deviceId, n.client_id, n.body, n.source, n.session_id, n.person_ids, n.created_at],
        );
        let row = inserted.rows[0];
        const replay = row === undefined;
        if (!row) {
          row = (
            await db.query(
              'SELECT id, client_id, created_at FROM notes WHERE device_id = $1 AND client_id = $2',
              [deviceId, n.client_id],
            )
          ).rows[0];
        }
        span.setAttribute('kc.idempotent_replay', replay);
        const savedMs = parseSavedMs(request.headers['x-capture-saved-ms']);
        if (savedMs !== null && !replay) {
          recordSavedMs(savedMs, n.source);
          span.setAttribute('kc.saved_ms', savedMs);
        }
        recordCreateMs(performance.now() - started, n.source, replay);
        return reply.code(replay ? 200 : 201).send({
          id: row?.id,
          client_id: row?.client_id,
          created_at: row?.created_at,
        });
      } catch (e) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: (e as Error).message });
        throw e;
      } finally {
        span.end();
      }
    });
  });

  app.get('/api/notes', async (request, reply) => {
    if (!db) return unavailable(reply);
    const q = validateListQuery(request.query);
    if (!q.ok) return reply.code(400).send({ error: 'invalid_query', message: q.error });
    const { limit, before, session_id } = q.value;
    const res = await db.query(
      `SELECT ${COLUMNS} FROM notes
       WHERE device_id = $1
         AND ($2::timestamptz IS NULL OR created_at < $2)
         AND ($3::text IS NULL OR session_id = $3)
       ORDER BY created_at DESC, id DESC LIMIT $4`,
      [request.deviceId, before, session_id, limit],
    );
    return { notes: res.rows };
  });

  app.delete<{ Params: { id: string } }>('/api/notes/:id', async (request, reply) => {
    if (!db) return unavailable(reply);
    if (!isUuid(request.params.id)) return reply.code(400).send({ error: 'invalid_id' });
    const res = await db.query('DELETE FROM notes WHERE id = $1 AND device_id = $2', [
      request.params.id,
      request.deviceId,
    ]);
    return res.rowCount ? reply.code(204).send() : reply.code(404).send({ error: 'not_found' });
  });

  // Single seeding path for the demo device. 404 unless KC_DEMO_SEED=1 (checked per request).
  // The device header is optional: C's `npm run seed:threads` calls this without one.
  app.post('/api/capture/seed', { config: { deviceId: 'optional' } }, async (_request, reply) => {
    if (!seedEnabled()) return reply.code(404).send({ error: 'not_found' });
    if (!db) return unavailable(reply);
    return reply.code(200).send(await seedDemo(db));
  });
};

export default noteRoutes;
