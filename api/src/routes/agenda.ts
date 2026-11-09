import { SpanStatusCode } from '@opentelemetry/api';
import type { FastifyPluginAsync } from 'fastify';
import { getChaos } from '../lib/chaos.js';
import {
  agendaDbQueries,
  agendaItems,
  agendaRequestMs,
  tracer,
} from '../services/schedule/agendaMetrics.js';
import { closeScheduleDb, resolveScheduleDb, type ScheduleDb } from '../services/schedule/db.js';
import { SESSION_COLUMNS, toSessionDto, type SessionDto } from '../services/schedule/serialize.js';
import { buildingWarnings, walkMinutesFromEnv } from '../services/schedule/warnings.js';

export interface AgendaRouteOptions {
  db?: ScheduleDb;
  walkMinutes?: number;
}

const SESSION_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const agendaRoutes: FastifyPluginAsync<AgendaRouteOptions> = async (app, opts) => {
  const db = resolveScheduleDb(opts.db);
  if (!opts.db) app.addHook('onClose', closeScheduleDb);
  const unavailable = (reply: { code(n: number): { send(b: unknown): unknown } }) =>
    reply.code(503).send({ error: 'db_unavailable' });

  app.get('/api/agenda', async (request, reply) => {
    if (!db) return unavailable(reply);
    const started = performance.now();
    const chaos = getChaos('agenda');
    return tracer.startActiveSpan('kc.agenda.get', async (span) => {
      let queries = 0;
      const q = async (sql: string, params: unknown[]) => {
        queries++;
        return db.query(sql, params);
      };
      try {
        if (chaos.latencyMs > 0) await sleep(chaos.latencyMs);
        if (chaos.errorRate > 0 && Math.random() < chaos.errorRate) {
          span.setAttribute('agenda.chaos_error', true);
          return reply.code(500).send({ error: 'injected_error' });
        }
        const deviceId = request.deviceId as string;
        let rows: Record<string, unknown>[];
        if (chaos.naive) {
          // Deliberate N+1 for the Dash0 demo: one query per agenda item.
          const ids = (
            await q(
              'SELECT session_id FROM agenda_items WHERE device_id = $1 ORDER BY added_at, session_id',
              [deviceId],
            )
          ).rows;
          rows = [];
          for (const r of ids) {
            const one = await q(`SELECT ${SESSION_COLUMNS} FROM sessions s WHERE s.id = $1`, [
              r.session_id,
            ]);
            if (one.rows[0]) rows.push(one.rows[0]);
          }
          rows.sort(
            (a, b) =>
              new Date(a.starts_at as string).getTime() -
                new Date(b.starts_at as string).getTime() ||
              String(a.id).localeCompare(String(b.id)),
          );
        } else {
          rows = (
            await q(
              `SELECT ${SESSION_COLUMNS} FROM agenda_items a JOIN sessions s ON s.id = a.session_id
               WHERE a.device_id = $1 ORDER BY s.starts_at, s.id`,
              [deviceId],
            )
          ).rows;
        }
        const items: SessionDto[] = rows.map(toSessionDto);
        const warnings = tracer.startActiveSpan('kc.agenda.warnings', (ws) => {
          try {
            return buildingWarnings(
              items.map((s) => ({
                id: s.id,
                startsAt: new Date(s.startsAt),
                endsAt: new Date(s.endsAt),
                building: s.building,
              })),
              opts.walkMinutes ?? walkMinutesFromEnv(),
            );
          } finally {
            ws.end();
          }
        });
        span.setAttributes({
          'agenda.items': items.length,
          'agenda.naive': chaos.naive,
          'db.queries': queries,
        });
        agendaDbQueries.record(queries);
        return { items, warnings };
      } catch (e) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: (e as Error).message });
        throw e;
      } finally {
        agendaRequestMs.record(performance.now() - started);
        span.end();
      }
    });
  });

  app.post('/api/agenda', async (request, reply) => {
    if (!db) return unavailable(reply);
    const body = request.body as { session_id?: unknown } | null | undefined;
    const sessionId = body?.session_id;
    if (typeof sessionId !== 'string' || !SESSION_ID_RE.test(sessionId)) {
      return reply.code(400).send({ error: 'invalid_session_id' });
    }
    return tracer.startActiveSpan('kc.agenda.add', async (span) => {
      try {
        const exists = await db.query('SELECT 1 FROM sessions WHERE id = $1', [sessionId]);
        if (exists.rows.length === 0) return reply.code(404).send({ error: 'session_not_found' });
        const ins = await db.query(
          `INSERT INTO agenda_items (device_id, session_id) VALUES ($1, $2)
           ON CONFLICT (device_id, session_id) DO NOTHING RETURNING session_id`,
          [request.deviceId, sessionId],
        );
        const created = ins.rows.length > 0;
        if (created) agendaItems.add(1);
        span.setAttribute('agenda.created', created);
        return reply.code(created ? 201 : 200).send({ session_id: sessionId });
      } catch (e) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: (e as Error).message });
        throw e;
      } finally {
        span.end();
      }
    });
  });

  app.delete('/api/agenda/:sessionId', async (request, reply) => {
    if (!db) return unavailable(reply);
    const { sessionId } = request.params as { sessionId: string };
    if (!SESSION_ID_RE.test(sessionId))
      return reply.code(400).send({ error: 'invalid_session_id' });
    const del = await db.query(
      'DELETE FROM agenda_items WHERE device_id = $1 AND session_id = $2 RETURNING session_id',
      [request.deviceId, sessionId],
    );
    if (del.rows.length > 0) agendaItems.add(-1);
    return reply.code(204).send();
  });
};

export default agendaRoutes;
