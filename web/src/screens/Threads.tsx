import { useEffect, useState } from 'preact/hooks';
import { api } from '../lib/api';
import { t } from '../i18n';
import '../styles/threads.css';

interface Action {
  id: string;
  threadId: string;
  kind: 'follow_up' | 'promise';
  text: string;
  done: boolean;
  promiseId?: string;
}
interface Thread {
  id: string;
  title: string;
  firstDay: string;
  lastDay: string;
  source: 'llm' | 'heuristic';
  noteIds: string[];
  actions: Action[];
}
interface RunResult {
  mode: 'llm' | 'heuristic';
  reason?: 'no_key' | 'cap' | 'error';
  notesIn: number;
  threads: Thread[];
}

type Load = 'loading' | 'ready' | 'error';

export function Threads() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [load, setLoad] = useState<Load>('loading');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  async function refresh(): Promise<void> {
    try {
      const res = await api('/api/threads');
      if (!res.ok) throw new Error(String(res.status));
      setThreads(((await res.json()) as { threads: Thread[] }).threads);
      setLoad('ready');
    } catch {
      setLoad('error');
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function build(): Promise<void> {
    setBusy(true);
    setStatus(t('threads.status.working'));
    try {
      const res = await api('/api/threads/run', { method: 'POST', body: '{}' });
      if (!res.ok) throw new Error(String(res.status));
      const run = (await res.json()) as RunResult;
      await refresh();
      const base =
        run.notesIn === 0
          ? t('threads.status.nothingNew')
          : t('threads.status.done', { n: run.threads.length });
      const why =
        run.notesIn > 0 && run.mode === 'heuristic'
          ? ` ${t('threads.status.basic', { reason: t(`threads.reason.${run.reason ?? 'error'}`) })}`
          : '';
      setStatus(base + why);
    } catch {
      setStatus(t('threads.status.failed'));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(a: Action, done: boolean): Promise<void> {
    const set = (v: boolean) =>
      setThreads((ts) =>
        ts.map((th) => ({
          ...th,
          actions: th.actions.map((x) => (x.id === a.id ? { ...x, done: v } : x)),
        })),
      );
    set(done);
    try {
      const res =
        a.kind === 'promise'
          ? await api(`/api/promises/${a.promiseId}`, {
              method: 'PATCH',
              body: JSON.stringify({ done }),
            })
          : await api(`/api/threads/${a.threadId}/actions/${a.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ done }),
            });
      if (!res.ok) throw new Error(String(res.status));
      setStatus(t(done ? 'threads.status.ticked' : 'threads.status.unticked', { text: a.text }));
    } catch {
      set(!done);
      setStatus(t('threads.status.failed'));
    }
  }

  return (
    <section aria-labelledby="threads-title" class="threads">
      <h2 id="threads-title">{t('threads.title')}</h2>
      <p>{t('threads.intro')}</p>
      <button type="button" class="btn threads-build" disabled={busy} onClick={() => void build()}>
        {t('threads.build')}
      </button>
      <div class="threads-status" role="status" aria-live="polite">
        {status}
      </div>

      {load === 'loading' && <p>{t('threads.loading')}</p>}
      {load === 'error' && (
        <p class="threads-error" role="alert">
          {t('threads.error')}{' '}
          <button type="button" class="btn" onClick={() => void refresh()}>
            {t('threads.retry')}
          </button>
        </p>
      )}
      {load === 'ready' && threads.length === 0 && <p>{t('threads.empty')}</p>}

      <ul class="threads-list">
        {threads.map((th) => (
          <li key={th.id} class="threads-card">
            <h3>{th.title}</h3>
            <p class="threads-meta">
              {t('threads.notes', { n: th.noteIds.length })} ·{' '}
              {th.firstDay === th.lastDay
                ? th.firstDay
                : t('threads.span', { from: th.firstDay, to: th.lastDay })}
              {th.source === 'heuristic' ? ` · ${t('threads.basicBadge')}` : ''}
            </p>
            {th.actions.length > 0 && (
              <fieldset class="threads-steps">
                <legend>{t('threads.nextSteps')}</legend>
                {th.actions.map((a) => (
                  <label key={a.id} class={a.done ? 'threads-step done' : 'threads-step'}>
                    <input
                      type="checkbox"
                      checked={a.done}
                      onChange={(e) =>
                        void toggle(a, (e.currentTarget as HTMLInputElement).checked)
                      }
                    />
                    <span>{a.text}</span>
                  </label>
                ))}
              </fieldset>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
