import { fileURLToPath } from 'node:url';

/** B's reserved demo device (b-capture design); needs KC_DEMO_SEED=1 on the server. */
export const DEMO_DEVICE_ID = '00000000-0000-4000-8000-00000000ca1e';
/** The three Denver days B seeds notes across. */
export const DEMO_DAYS = ['2026-11-10', '2026-11-11', '2026-11-12'];

interface ThreadLite {
  id: string;
  firstDay: string;
  lastDay: string;
  actions: { kind: string }[];
}

export interface SeedSummary {
  threads: number;
  spanningDays: number;
  withActions: number;
  withPromise: number;
}

export function summarize(threads: ThreadLite[]): SeedSummary {
  return {
    threads: threads.length,
    spanningDays: threads.filter((t) => t.firstDay !== t.lastDay).length,
    withActions: threads.filter((t) => t.actions.length > 0).length,
    withPromise: threads.filter((t) => t.actions.some((a) => a.kind === 'promise')).length,
  };
}

/** Demo expectations: 3+ threads, one across two days, 2+ with next steps, one of them a promise. */
export function meetsDemoShape(s: SeedSummary): boolean {
  return s.threads >= 3 && s.spanningDays >= 1 && s.withActions >= 2 && s.withPromise >= 1;
}

export async function seedThreads(
  baseUrl: string,
  fetchFn: typeof fetch = fetch,
  log: (m: string) => void = console.log,
): Promise<SeedSummary> {
  const headers = { 'content-type': 'application/json', 'x-device-id': DEMO_DEVICE_ID };
  const call = async (path: string, method: string, body?: object) => {
    const res = await fetchFn(new URL(path, baseUrl), {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) throw new Error(`${method} ${path} failed: HTTP ${res.status}`);
    return res;
  };

  await call('/api/capture/seed', 'POST', {});
  log('seeded capture data for the demo device');
  for (const date of DEMO_DAYS) {
    const run = (await (await call('/api/threads/run', 'POST', { date })).json()) as {
      mode: string;
      notesIn: number;
    };
    log(`threaded ${date}: ${run.notesIn} new notes, mode ${run.mode}`);
  }
  const { threads } = (await (await call('/api/threads', 'GET')).json()) as {
    threads: ThreadLite[];
  };
  const summary = summarize(threads);
  log(`result: ${JSON.stringify(summary)}`);
  return summary;
}

const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const base = process.env.SEED_BASE_URL ?? `http://localhost:${process.env.PORT ?? 8080}`;
  seedThreads(base).then(
    (s) => {
      if (!meetsDemoShape(s)) {
        console.error(
          'seed result does not meet the demo shape (3+ threads, one across days, 2+ with actions, a promise)',
        );
        process.exit(1);
      }
    },
    (e: unknown) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    },
  );
}
