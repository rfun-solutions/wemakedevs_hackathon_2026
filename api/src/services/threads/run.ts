import { randomUUID } from 'node:crypto';
import { metrics, SpanStatusCode, trace, type Span } from '@opentelemetry/api';
import { dailyCapUsd, decideCap, lockDevice, spentOnDay, worstCaseCostUsd } from './costGuard.js';
import { withTransaction, type Queryable, type TxPool } from './db.js';
import { heuristicGroup } from './heuristic.js';
import {
  buildUserMessage,
  DEFAULT_THREADS_MODEL,
  llmGroup,
  MAX_TOKENS,
  SYSTEM_PROMPT,
  ThreadingFallback,
  type CompleteFn,
  type ThreaderUsage,
} from './llmThreader.js';
import { denverToday, loadOpenThreads, loadUnthreadedNotes } from './notesRepo.js';
import { loadAttachablePromises } from './promisesRepo.js';
import { getThreadsByIds, type ThreadView } from './threadsRepo.js';
import type { FallbackReason, GroupedThread } from './types.js';

export interface RunOptions {
  pool: TxPool;
  deviceId: string;
  /** Denver calendar day, YYYY-MM-DD; defaults to today in Denver. */
  date?: string;
  /** Injected in tests; defaults to C0's `complete()`. */
  complete?: CompleteFn;
  env?: NodeJS.ProcessEnv;
}

export interface RunResult {
  runId: string;
  mode: 'llm' | 'heuristic';
  reason?: FallbackReason;
  notesIn: number;
  threads: ThreadView[];
  usage: { tokensIn: number; tokensOut: number; costUsd: number };
  traceId?: string;
}

const tracer = () => trace.getTracer('kubecompanion');
let ins: ReturnType<typeof makeInstruments> | undefined;
function makeInstruments() {
  const m = metrics.getMeter('kubecompanion');
  return {
    runs: m.createCounter('kc_threads_runs_total', {
      description: 'Threading runs by mode and fallback reason',
    }),
    cost: m.createCounter('kc_threads_llm_cost_usd_total', {
      description: 'LLM spend for threading, USD',
    }),
    tokens: m.createCounter('kc_threads_llm_tokens_total', {
      description: 'LLM tokens for threading by direction',
    }),
    duration: m.createHistogram('kc_threads_run_duration_seconds', {
      description: 'Threading run duration',
      unit: 's',
    }),
  };
}
const instruments = () => (ins ??= makeInstruments());
/** Test seam: recreate instruments against a newly registered meter provider. */
export function resetThreadsInstruments(): void {
  ins = undefined;
}

async function inSpan<T>(name: string, fn: (s: Span) => Promise<T>): Promise<T> {
  return tracer().startActiveSpan(name, async (span) => {
    try {
      return await fn(span);
    } catch (e) {
      span.recordException(e as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (e as Error).name });
      throw e;
    } finally {
      span.end();
    }
  });
}

/**
 * One threading run for one device and day, in a single transaction. Idempotent: only notes not yet in a
 * thread are processed. Never throws for LLM problems; they select the heuristic with a reason.
 */
export async function runThreading(opts: RunOptions): Promise<RunResult> {
  const started = performance.now();
  const runId = randomUUID();
  const env = opts.env ?? process.env;

  return inSpan('kc.threads.run', (runSpan) =>
    withTransaction(opts.pool, async (tx) => {
      await lockDevice(tx, opts.deviceId);
      const day = opts.date ?? (await denverToday(tx));
      const notes = await loadUnthreadedNotes(tx, opts.deviceId, day);
      runSpan.setAttributes({ 'kc.threads.notes_in': notes.length });
      const empty: RunResult = {
        runId,
        mode: 'heuristic',
        notesIn: 0,
        threads: [],
        usage: { tokensIn: 0, tokensOut: 0, costUsd: 0 },
      };
      if (notes.length === 0) {
        runSpan.setAttribute('kc.threads.mode', 'none');
        return empty;
      }

      const openThreads = await loadOpenThreads(tx, opts.deviceId, day);
      const promises = await loadAttachablePromises(tx, opts.deviceId);
      const model = env.THREADS_MODEL || DEFAULT_THREADS_MODEL;

      let mode: 'llm' | 'heuristic' = 'heuristic';
      let reason: FallbackReason | undefined;
      let groups: GroupedThread[] = [];
      let usage: ThreaderUsage | undefined;
      let usedModel = '';
      let traceId: string | undefined;

      // Cost guard first: spend so far today plus the worst case of this call must fit the cap.
      const { content } = buildUserMessage({ notes, openThreads, promises });
      const cap = decideCap(
        await spentOnDay(tx, opts.deviceId, await denverToday(tx)),
        worstCaseCostUsd(model, content.length + SYSTEM_PROMPT.length, MAX_TOKENS),
        dailyCapUsd(env),
      );
      if (!cap.allowed) {
        reason = 'cap';
      } else {
        try {
          const res = await inSpan('kc.threads.llm', async (s) => {
            const r = await llmGroup(
              { notes, openThreads, promises },
              {
                deviceId: opts.deviceId,
                model,
                ...(opts.complete ? { complete: opts.complete } : {}),
              },
            );
            s.setAttributes({
              'gen_ai.operation.name': 'chat',
              'gen_ai.system': 'anthropic',
              'gen_ai.request.model': model,
              'gen_ai.usage.input_tokens': r.usage.inputTokens,
              'gen_ai.usage.output_tokens': r.usage.outputTokens,
              'kc.threads.cost_usd': r.usage.costUsd,
            });
            return r;
          });
          mode = 'llm';
          groups = res.threads;
          usage = res.usage;
          usedModel = res.model;
          traceId = res.traceId;
          if (res.unassignedNoteIds.length > 0) {
            const left = new Set(res.unassignedNoteIds);
            groups = [
              ...groups,
              ...heuristicGroup({
                notes: notes.filter((n) => left.has(n.id)),
                openThreads,
                promises: [],
              }),
            ];
          }
        } catch (e) {
          if (!(e instanceof ThreadingFallback)) throw e;
          reason = e.reason;
          usage = e.usage;
          usedModel = e.model ?? '';
          traceId = e.traceId;
        }
      }
      if (mode === 'heuristic') {
        groups = await inSpan('kc.threads.heuristic', async () =>
          heuristicGroup({ notes, openThreads, promises }),
        );
      }
      const groupSource = mode;

      const touched = await inSpan('kc.threads.persist', async () => {
        const ids = await persist(
          tx,
          opts.deviceId,
          runId,
          day,
          groups,
          groupSource,
          new Set(notes.map((n) => n.id)),
          new Set(promises.map((p) => p.id)),
        );
        await tx.query(
          `INSERT INTO llm_usage (device_id, run_id, day, model, tokens_in, tokens_out, cost_usd, latency_ms, trace_id, mode, reason)
           VALUES ($1, $2, (now() AT TIME ZONE 'America/Denver')::date, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            opts.deviceId,
            runId,
            usedModel,
            usage?.inputTokens ?? 0,
            usage?.outputTokens ?? 0,
            usage?.costUsd ?? 0,
            usage?.latencyMs ?? 0,
            traceId ?? null,
            mode,
            reason ?? null,
          ],
        );
        return ids;
      });

      const threads = await getThreadsByIds(tx, opts.deviceId, touched);
      runSpan.setAttributes({
        'kc.threads.mode': mode,
        ...(reason ? { 'kc.threads.reason': reason } : {}),
      });
      const i = instruments();
      i.runs.add(1, { mode, reason: reason ?? 'none' });
      if (usage) {
        i.cost.add(usage.costUsd);
        i.tokens.add(usage.inputTokens, { direction: 'input' });
        i.tokens.add(usage.outputTokens, { direction: 'output' });
      }
      i.duration.record((performance.now() - started) / 1000, { mode });
      return {
        runId,
        mode,
        ...(reason ? { reason } : {}),
        notesIn: notes.length,
        threads,
        usage: {
          tokensIn: usage?.inputTokens ?? 0,
          tokensOut: usage?.outputTokens ?? 0,
          costUsd: usage?.costUsd ?? 0,
        },
        ...(traceId ? { traceId } : {}),
      };
    }),
  );
}

/** Writes groups, notes and actions; returns the ids of touched threads. Ignores ids not in the input sets. */
async function persist(
  tx: Queryable,
  deviceId: string,
  runId: string,
  day: string,
  groups: GroupedThread[],
  source: 'llm' | 'heuristic',
  noteIds: Set<string>,
  promiseIds: Set<string>,
): Promise<string[]> {
  const touched: string[] = [];
  const linked = new Set<string>();
  const attached = new Set<string>();
  for (const g of groups) {
    const notes = g.noteIds.filter((id) => noteIds.has(id) && !linked.has(id));
    if (notes.length === 0) continue;
    let threadId = g.threadId;
    if (threadId) {
      const r = await tx.query(
        `UPDATE threads SET first_day = LEAST(first_day, $3::date), last_day = GREATEST(last_day, $3::date), updated_at = now()
          WHERE id = $2 AND device_id = $1 RETURNING id`,
        [deviceId, threadId, day],
      );
      if (r.rows.length === 0) threadId = undefined;
    }
    if (!threadId) {
      const r = await tx.query(
        `INSERT INTO threads (device_id, title, summary, first_day, last_day, source) VALUES ($1, $2, $3, $4::date, $4::date, $5) RETURNING id`,
        [deviceId, g.title, g.summary, day, source],
      );
      threadId = r.rows[0].id as string;
    }
    if (!touched.includes(threadId)) touched.push(threadId);
    for (const id of notes) {
      linked.add(id);
      await tx.query(
        `INSERT INTO thread_notes (thread_id, note_id, device_id, assigned_run) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [threadId, id, deviceId, runId],
      );
    }
    for (const text of g.followUps) {
      await tx.query(
        `INSERT INTO thread_actions (thread_id, device_id, kind, text, source)
         SELECT $1, $2, 'follow_up', $3, $4
          WHERE NOT EXISTS (SELECT 1 FROM thread_actions WHERE thread_id = $1 AND kind = 'follow_up' AND text = $3)`,
        [threadId, deviceId, text, source],
      );
    }
    for (const pid of g.promiseIds) {
      if (!promiseIds.has(pid) || attached.has(pid)) continue;
      attached.add(pid);
      await tx.query(
        `INSERT INTO thread_actions (thread_id, device_id, kind, promise_id, source) VALUES ($1, $2, 'promise', $3, $4) ON CONFLICT DO NOTHING`,
        [threadId, deviceId, pid, source],
      );
    }
  }
  return touched;
}
