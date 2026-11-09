// runIngest(): fetch (G's fetchFeed, no retry) -> derive -> one transaction upsert, recorded in feed_runs.
import { metrics, SpanStatusCode, trace } from '@opentelemetry/api';
import { fetchFeed } from '../sessionize/fetchFeed.js';
import { deriveFeed, type DerivedSession } from './derive.js';

export const DEFAULT_FEED_URL =
  'https://kubecon-cloudnativecon-north-america-2026.sessionize.com/api/schedule';

/** Subset of pg.Pool / pg.PoolClient used here, so tests can inject a fake. */
export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}
export interface PoolLike extends Queryable {
  connect(): Promise<Queryable & { release(): void }>;
}

export interface IngestDeps {
  pool: PoolLike;
  feedUrl?: string;
  fetchFeedImpl?: (url: string) => Promise<unknown>;
  now?: () => Date;
}
export type IngestResult =
  { status: 'ok'; sessionCount: number } | { status: 'error'; error: string };

const tracer = trace.getTracer('kubecompanion');
const meter = metrics.getMeter('kubecompanion');
const runsTotal = meter.createCounter('kc_schedule_ingest_runs_total');
let lastSuccessMs: number | null = null;
meter.createObservableGauge('kc_schedule_feed_age_seconds').addCallback((r) => {
  if (lastSuccessMs !== null) r.observe((Date.now() - lastSuccessMs) / 1000);
});

const UPSERT = `
INSERT INTO sessions (id, title, description, starts_at, ends_at, venue_tz, building, level, room,
  room_raw, track, audience_level, is_service, access_tags, updated_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now())
ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description,
  starts_at=EXCLUDED.starts_at, ends_at=EXCLUDED.ends_at, venue_tz=EXCLUDED.venue_tz,
  building=EXCLUDED.building, level=EXCLUDED.level, room=EXCLUDED.room, room_raw=EXCLUDED.room_raw,
  track=EXCLUDED.track, audience_level=EXCLUDED.audience_level, is_service=EXCLUDED.is_service,
  access_tags=EXCLUDED.access_tags, updated_at=now()`;

const params = (s: DerivedSession) => [
  s.id,
  s.title,
  s.description,
  s.startsAt,
  s.endsAt,
  s.venueTz,
  s.building,
  s.level,
  s.room,
  s.roomRaw,
  s.track,
  s.audienceLevel,
  s.isService,
  s.accessTags,
];

async function upsertAll(pool: PoolLike, sessions: DerivedSession[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const s of sessions) await client.query(UPSERT, params(s));
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function runIngest(deps: IngestDeps): Promise<IngestResult> {
  const { pool } = deps;
  const url = deps.feedUrl ?? process.env.FEED_URL ?? DEFAULT_FEED_URL;
  const doFetch = deps.fetchFeedImpl ?? ((u: string) => fetchFeed(u));
  return tracer.startActiveSpan('kc.schedule.ingest', async (span) => {
    const started = await pool.query(
      `INSERT INTO feed_runs (status, started_at) VALUES ('running', now()) RETURNING id`,
    );
    const runId = started.rows[0]?.id;
    try {
      const sessions = deriveFeed(await doFetch(url));
      await upsertAll(pool, sessions);
      await pool.query(
        `UPDATE feed_runs SET status='ok', finished_at=now(), session_count=$2 WHERE id=$1`,
        [runId, sessions.length],
      );
      lastSuccessMs = Date.now();
      runsTotal.add(1, { status: 'ok' });
      span.setAttributes({ 'feed.sessions': sessions.length, 'feed.status': 'ok' });
      return { status: 'ok' as const, sessionCount: sessions.length };
    } catch (err) {
      // Old rows stay: validation/derive/fetch happen before the transaction, or it rolled back.
      const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      await pool
        .query(`UPDATE feed_runs SET status='error', finished_at=now(), error=$2 WHERE id=$1`, [
          runId,
          message.slice(0, 1000),
        ])
        .catch(() => undefined);
      runsTotal.add(1, { status: 'error' });
      span.setAttributes({ 'feed.status': 'error' });
      span.setStatus({ code: SpanStatusCode.ERROR, message });
      return { status: 'error' as const, error: message };
    } finally {
      span.end();
    }
  });
}
