import type { FastifyPluginAsync } from 'fastify';
import { resolveDb } from '../services/capture/db.js';
import { isUuid, validatePromise, validatePromisePatch } from '../services/capture/validate.js';
import type { CaptureRouteOptions } from './notes.js';

const COLUMNS = 'id, client_id, text, person_id, due::text AS due, done, created_at';

export const promiseRoutes: FastifyPluginAsync<CaptureRouteOptions> = async (app, opts) => {
  const db = resolveDb(opts.db);

  app.post('/api/promises', async (request, reply) => {
    if (!db) return reply.code(503).send({ error: 'db_unavailable' });
    const parsed = validatePromise(request.body);
    if (!parsed.ok)
      return reply.code(400).send({ error: 'invalid_promise', message: parsed.error });
    const p = parsed.value;
    const deviceId = request.deviceId as string;
    const inserted = await db.query(
      `INSERT INTO promises (device_id, client_id, text, person_id, due, done) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (device_id, client_id) DO NOTHING
       RETURNING ${COLUMNS}`,
      [deviceId, p.client_id, p.text, p.person_id, p.due, p.done],
    );
    const replay = inserted.rows[0] === undefined;
    const row =
      inserted.rows[0] ??
      (
        await db.query(`SELECT ${COLUMNS} FROM promises WHERE device_id = $1 AND client_id = $2`, [
          deviceId,
          p.client_id,
        ])
      ).rows[0];
    return reply.code(replay ? 200 : 201).send(row);
  });

  app.get('/api/promises', async (request, reply) => {
    if (!db) return reply.code(503).send({ error: 'db_unavailable' });
    const res = await db.query(
      `SELECT ${COLUMNS} FROM promises WHERE device_id = $1 ORDER BY done ASC, created_at DESC, id DESC LIMIT 200`,
      [request.deviceId],
    );
    return { promises: res.rows };
  });

  app.patch<{ Params: { id: string } }>('/api/promises/:id', async (request, reply) => {
    if (!db) return reply.code(503).send({ error: 'db_unavailable' });
    if (!isUuid(request.params.id)) return reply.code(400).send({ error: 'invalid_id' });
    const parsed = validatePromisePatch(request.body);
    if (!parsed.ok)
      return reply.code(400).send({ error: 'invalid_promise', message: parsed.error });
    const res = await db.query(
      `UPDATE promises SET done = $1 WHERE id = $2 AND device_id = $3 RETURNING ${COLUMNS}`,
      [parsed.value.done, request.params.id, request.deviceId],
    );
    return res.rows[0] ?? reply.code(404).send({ error: 'not_found' });
  });
};

export default promiseRoutes;
