import type { FastifyPluginAsync } from 'fastify';
import { resolveDb } from '../services/capture/db.js';
import { validatePerson } from '../services/capture/validate.js';
import type { CaptureRouteOptions } from './notes.js';

export const peopleRoutes: FastifyPluginAsync<CaptureRouteOptions> = async (app, opts) => {
  const db = resolveDb(opts.db);

  app.post('/api/people', async (request, reply) => {
    if (!db) return reply.code(503).send({ error: 'db_unavailable' });
    const parsed = validatePerson(request.body);
    if (!parsed.ok) return reply.code(400).send({ error: 'invalid_person', message: parsed.error });
    const p = parsed.value;
    const deviceId = request.deviceId as string;
    const inserted = await db.query(
      `INSERT INTO people (device_id, client_id, name, context, note_id) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (device_id, client_id) DO NOTHING
       RETURNING id, client_id, name, context, note_id, created_at`,
      [deviceId, p.client_id, p.name, p.context, p.note_id],
    );
    const replay = inserted.rows[0] === undefined;
    const row =
      inserted.rows[0] ??
      (
        await db.query(
          `SELECT id, client_id, name, context, note_id, created_at FROM people
           WHERE device_id = $1 AND client_id = $2`,
          [deviceId, p.client_id],
        )
      ).rows[0];
    return reply.code(replay ? 200 : 201).send(row);
  });

  app.get('/api/people', async (request, reply) => {
    if (!db) return reply.code(503).send({ error: 'db_unavailable' });
    const res = await db.query(
      `SELECT id, client_id, name, context, note_id, created_at FROM people
       WHERE device_id = $1 ORDER BY created_at DESC, id DESC LIMIT 200`,
      [request.deviceId],
    );
    return { people: res.rows };
  });
};

export default peopleRoutes;
