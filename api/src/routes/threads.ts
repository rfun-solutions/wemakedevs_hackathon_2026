import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { createPool } from '../db.js';
import type { CompleteFn } from '../services/threads/llmThreader.js';
import type { TxPool } from '../services/threads/db.js';
import { denverToday } from '../services/threads/notesRepo.js';
import { runThreading } from '../services/threads/run.js';
import {
  getThread,
  listOpenActions,
  listRuns,
  listThreads,
  patchFollowUp,
  renameThread,
  unlinkNote,
} from '../services/threads/threadsRepo.js';

export interface ThreadsRouteOptions {
  /** Defaults to a pool from DATABASE_URI (closed with the app). Tests inject one. */
  pool?: TxPool;
  /** Defaults to C0's `complete()`. Tests inject a fake so the real API is never called. */
  complete?: CompleteFn;
  /** Defaults to env THREADS_CRON_TOKEN. */
  cronToken?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function tokenOk(given: unknown, expected: string | undefined): boolean {
  if (typeof given !== 'string' || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function threadsRoutes(
  app: FastifyInstance,
  opts: ThreadsRouteOptions = {},
): Promise<void> {
  let ownPool: ReturnType<typeof createPool>;
  let pool = opts.pool;
  if (!pool) {
    ownPool = createPool();
    pool = ownPool as unknown as TxPool | undefined;
    if (ownPool)
      app.addHook('onClose', async () => void (await ownPool?.end().catch(() => undefined)));
  }

  const bad = (reply: FastifyReply, error: string, message: string) =>
    reply.code(400).send({ error, message });
  const unavailable = (reply: FastifyReply) => reply.code(503).send({ error: 'db_unavailable' });

  app.post('/api/threads/run', { config: { deviceId: 'optional' } }, async (req, reply) => {
    if (!pool) return unavailable(reply);
    const body = (req.body ?? {}) as { date?: unknown; force?: unknown; allDevices?: unknown };
    if (body.date !== undefined && !(typeof body.date === 'string' && DAY.test(body.date))) {
      return bad(reply, 'invalid_date', 'date must be YYYY-MM-DD');
    }
    const date = body.date as string | undefined;
    const deps = {
      pool,
      ...(opts.complete ? { complete: opts.complete } : {}),
      ...(date ? { date } : {}),
    };

    if (req.deviceId) {
      return runThreading({ ...deps, deviceId: req.deviceId });
    }
    // No device id: only the CronJob may call, with its token and allDevices.
    const token = req.headers['x-cron-token'];
    if (!tokenOk(token, opts.cronToken ?? process.env.THREADS_CRON_TOKEN)) {
      return reply
        .code(401)
        .send({ error: 'unauthorized', message: 'X-Device-Id or X-Cron-Token required' });
    }
    if (body.allDevices !== true)
      return bad(reply, 'invalid_body', 'allDevices:true required with a cron token');
    const day = date ?? (await denverToday(pool));
    const devices = await pool.query(
      `SELECT DISTINCT device_id FROM notes WHERE (created_at AT TIME ZONE 'America/Denver')::date = $1::date ORDER BY device_id`,
      [day],
    );
    const results: {
      deviceId: string;
      runId: string;
      mode: string;
      reason?: string;
      notesIn: number;
    }[] = [];
    for (const row of devices.rows) {
      const r = await runThreading({ ...deps, date: day, deviceId: row.device_id as string });
      results.push({
        deviceId: row.device_id as string,
        runId: r.runId,
        mode: r.mode,
        ...(r.reason ? { reason: r.reason } : {}),
        notesIn: r.notesIn,
      });
    }
    return { day, devices: results.length, runs: results };
  });

  app.get('/api/threads', async (req, reply) => {
    if (!pool) return unavailable(reply);
    return { threads: await listThreads(pool, req.deviceId!) };
  });

  app.get('/api/threads/runs', async (req, reply) => {
    if (!pool) return unavailable(reply);
    return { runs: await listRuns(pool, req.deviceId!) };
  });

  app.get('/api/threads/actions', async (req, reply) => {
    if (!pool) return unavailable(reply);
    // The contract is `?open=1`; only open actions are ever listed, so the flag is accepted and implied.
    return { actions: await listOpenActions(pool, req.deviceId!) };
  });

  app.get<{ Params: { id: string } }>('/api/threads/:id', async (req, reply) => {
    if (!pool) return unavailable(reply);
    if (!UUID.test(req.params.id)) return reply.code(404).send({ error: 'not_found' });
    const t = await getThread(pool, req.deviceId!, req.params.id);
    return t ?? reply.code(404).send({ error: 'not_found' });
  });

  app.patch<{ Params: { id: string } }>('/api/threads/:id', async (req, reply) => {
    if (!pool) return unavailable(reply);
    const title = ((req.body ?? {}) as { title?: unknown }).title;
    if (typeof title !== 'string' || !title.trim() || title.length > 80)
      return bad(reply, 'invalid_title', 'title must be 1-80 characters');
    if (
      !UUID.test(req.params.id) ||
      !(await renameThread(pool, req.deviceId!, req.params.id, title.trim()))
    ) {
      return reply.code(404).send({ error: 'not_found' });
    }
    return getThread(pool, req.deviceId!, req.params.id);
  });

  app.delete<{ Params: { id: string; noteId: string } }>(
    '/api/threads/:id/notes/:noteId',
    async (req, reply) => {
      if (!pool) return unavailable(reply);
      const { id, noteId } = req.params;
      if (
        !UUID.test(id) ||
        !UUID.test(noteId) ||
        !(await unlinkNote(pool, req.deviceId!, id, noteId))
      ) {
        return reply.code(404).send({ error: 'not_found' });
      }
      return reply.code(204).send();
    },
  );

  app.patch<{ Params: { id: string; actionId: string } }>(
    '/api/threads/:id/actions/:actionId',
    async (req, reply) => {
      if (!pool) return unavailable(reply);
      const done = ((req.body ?? {}) as { done?: unknown }).done;
      if (typeof done !== 'boolean') return bad(reply, 'invalid_done', 'done must be a boolean');
      const { id, actionId } = req.params;
      if (!UUID.test(id) || !UUID.test(actionId))
        return reply.code(404).send({ error: 'not_found' });
      const r = await patchFollowUp(pool, req.deviceId!, id, actionId, done);
      if (r === 'not_found') return reply.code(404).send({ error: 'not_found' });
      if (r === 'promise')
        return bad(
          reply,
          'promise_action',
          'Promise actions are toggled through PATCH /api/promises/:id',
        );
      return reply.code(204).send();
    },
  );
}
