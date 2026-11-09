import { SpanStatusCode } from '@opentelemetry/api';
import type { FastifyPluginAsync } from 'fastify';
import { tracer } from '../services/schedule/agendaMetrics.js';
import { closeScheduleDb, resolveScheduleDb, type ScheduleDb } from '../services/schedule/db.js';
import { SESSION_COLUMNS, toSessionDto } from '../services/schedule/serialize.js';
import { VENUE_TZ } from '../services/schedule/time.js';

export interface SessionsRouteOptions {
  db?: ScheduleDb;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Returns undefined when absent, null when present but invalid. */
function optionalText(v: unknown, max = 200): string | undefined | null {
  if (v === undefined || v === '') return undefined;
  return typeof v === 'string' && v.length <= max ? v : null;
}

export const sessionRoutes: FastifyPluginAsync<SessionsRouteOptions> = async (app, opts) => {
  const db = resolveScheduleDb(opts.db);
  if (!opts.db) app.addHook('onClose', closeScheduleDb);

  // Public schedule list. Service sessions (registration, coat check, meals) are hidden.
  app.get('/api/sessions', async (request, reply) => {
    if (!db) return reply.code(503).send({ error: 'db_unavailable' });
    const q = request.query as Record<string, unknown>;
    const day = optionalText(q.day, 10);
    const room = optionalText(q.room);
    const track = optionalText(q.track);
    if (
      day === null ||
      (day !== undefined && !DAY_RE.test(day)) ||
      room === null ||
      track === null
    ) {
      return reply.code(400).send({ error: 'invalid_query' });
    }
    return tracer.startActiveSpan('kc.schedule.sessions_list', async (span) => {
      try {
        const res = await db.query(
          `SELECT ${SESSION_COLUMNS} FROM sessions s
           WHERE NOT s.is_service
             AND ($1::date IS NULL OR (s.starts_at AT TIME ZONE '${VENUE_TZ}')::date = $1::date)
             AND ($2::text IS NULL OR s.room = $2)
             AND ($3::text IS NULL OR s.track = $3)
           ORDER BY s.starts_at, s.id`,
          [day ?? null, room ?? null, track ?? null],
        );
        // Filter choices come from the whole schedule so the UI can offer every option.
        const opts2 = await db.query(
          `SELECT to_char((starts_at AT TIME ZONE '${VENUE_TZ}')::date, 'YYYY-MM-DD') AS day, room, track
           FROM sessions WHERE NOT is_service`,
        );
        const uniq = (k: string) =>
          [...new Set(opts2.rows.map((r) => r[k]).filter((v): v is string => !!v))].sort();
        span.setAttributes({
          'schedule.count': res.rows.length,
          'schedule.filter.day': day ?? '',
          'schedule.filter.track': track ?? '',
        });
        return {
          sessions: res.rows.map(toSessionDto),
          filters: { days: uniq('day'), rooms: uniq('room'), tracks: uniq('track') },
        };
      } catch (e) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: (e as Error).message });
        throw e;
      } finally {
        span.end();
      }
    });
  });
};

export default sessionRoutes;
