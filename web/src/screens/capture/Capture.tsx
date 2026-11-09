import { useEffect, useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { api } from '../../lib/api';
import {
  enqueueItem,
  enqueueNote,
  listQueue,
  onQueueChange,
  onQueueSynced,
  removeItem,
  retryItem,
  type QueueItem,
} from '../../lib/capture/queue';
import { startDictation, type SpeechSession } from '../../lib/speech';
import { t } from '../../i18n';
import './capture.css';

interface ServerNote {
  id: string;
  body: string;
  session_id: string | null;
  created_at: string;
}
interface ServerPromise {
  id: string;
  text: string;
  due: string | null;
  done: boolean;
}
interface ServerPerson {
  id: string;
  name: string;
  context: string | null;
}

async function getJson<T>(path: string, key: string): Promise<T[] | null> {
  try {
    const res = await api(path);
    if (!res.ok) return null;
    return ((await res.json()) as Record<string, T[]>)[key] ?? null;
  } catch {
    return null; // offline: keep whatever is already shown
  }
}

function ItemStatus({ item }: { item: QueueItem }) {
  const attention = item.status === 'needs_attention';
  return (
    <span class="capture-badge" data-state={attention ? 'attention' : 'local'}>
      {attention ? t('capture.status.attention') : t('capture.status.local')}
    </span>
  );
}

function Actions({ item }: { item: QueueItem }) {
  if (item.status !== 'needs_attention') return null;
  return (
    <div class="capture-actions">
      <button type="button" class="btn-secondary" onClick={() => void retryItem(item.client_id)}>
        {t('capture.retry')}
      </button>
      <button type="button" class="btn-secondary" onClick={() => void removeItem(item.client_id)}>
        {t('capture.delete')}
      </button>
    </div>
  );
}

export function Capture() {
  const { query } = useLocation();
  const sessionId = query.session ? String(query.session) : undefined;

  const [body, setBody] = useState('');
  const [status, setStatus] = useState('');
  const [dictating, setDictating] = useState(false);
  const [queued, setQueued] = useState<QueueItem[]>([]);
  const [notes, setNotes] = useState<ServerNote[]>([]);
  const [promises, setPromises] = useState<ServerPromise[]>([]);
  const [people, setPeople] = useState<ServerPerson[]>([]);
  const [onlySession, setOnlySession] = useState(true);
  const [personName, setPersonName] = useState('');
  const [personContext, setPersonContext] = useState('');
  const [promiseText, setPromiseText] = useState('');
  const [promiseDue, setPromiseDue] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  const dictated = useRef(false);
  const speech = useRef<SpeechSession | null>(null);

  const filterBySession = sessionId !== undefined && onlySession;

  const refreshServer = async () => {
    const path = filterBySession
      ? `/api/notes?limit=50&session_id=${encodeURIComponent(sessionId)}`
      : '/api/notes?limit=50';
    const [n, p, pe] = await Promise.all([
      getJson<ServerNote>(path, 'notes'),
      getJson<ServerPromise>('/api/promises', 'promises'),
      getJson<ServerPerson>('/api/people', 'people'),
    ]);
    if (n) setNotes(n);
    if (p) setPromises(p);
    if (pe) setPeople(pe);
  };

  useEffect(() => {
    field.current?.focus();
    const reload = () => void listQueue().then(setQueued);
    reload();
    const offChange = onQueueChange(reload);
    const offSynced = onQueueSynced(() => void refreshServer());
    return () => {
      offChange();
      offSynced();
      speech.current?.stop();
    };
  }, []);

  useEffect(() => {
    void refreshServer();
  }, [filterBySession, sessionId]);

  const saveNote = async (e: Event) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) {
      setStatus(t('capture.empty'));
      field.current?.focus();
      return;
    }
    speech.current?.stop();
    setDictating(false);
    await enqueueNote({
      body: text,
      source: dictated.current ? 'dictated' : 'typed',
      ...(sessionId ? { session_id: sessionId } : {}),
    });
    dictated.current = false;
    setBody('');
    setStatus(t('capture.saved'));
    field.current?.focus();
  };

  const toggleDictation = async () => {
    if (dictating) {
      speech.current?.stop();
      setDictating(false);
      return;
    }
    const session = await startDictation((text) => {
      dictated.current = true;
      setBody((b) => (b ? `${b} ${text}` : text));
    });
    if (!session.supported) {
      setStatus(t('capture.dictation.unsupported'));
      return;
    }
    speech.current = session;
    setDictating(true);
    setStatus(t('capture.dictation.listening'));
  };

  const addPerson = async (e: Event) => {
    e.preventDefault();
    const name = personName.trim();
    if (!name) return;
    const context = personContext.trim();
    await enqueueItem({ kind: 'person', body: name, ...(context ? { extra: { context } } : {}) });
    setPersonName('');
    setPersonContext('');
    setStatus(t('capture.person.saved'));
  };

  const addPromise = async (e: Event) => {
    e.preventDefault();
    const text = promiseText.trim();
    if (!text) return;
    await enqueueItem({
      kind: 'promise',
      body: text,
      ...(promiseDue ? { extra: { due: promiseDue } } : {}),
    });
    setPromiseText('');
    setPromiseDue('');
    setStatus(t('capture.promise.saved'));
  };

  const toggleDone = async (p: ServerPromise) => {
    try {
      const res = await api(`/api/promises/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ done: !p.done }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setPromises((list) => list.map((x) => (x.id === p.id ? { ...x, done: !p.done } : x)));
    } catch {
      setStatus(t('capture.promise.toggleFailed'));
    }
  };

  const queuedNotes = queued.filter((i) => (i.kind ?? 'note') === 'note');
  const queuedPeople = queued.filter((i) => i.kind === 'person');
  const queuedPromises = queued.filter((i) => i.kind === 'promise');
  const visibleQueuedNotes = filterBySession
    ? queuedNotes.filter((i) => i.session_id === sessionId)
    : queuedNotes;

  return (
    <section class="capture" aria-labelledby="capture-title">
      <h2 id="capture-title">{t('capture.title')}</h2>

      <form class="capture-form" onSubmit={saveNote}>
        <label class="capture-field">
          {t('capture.note.label')}
          <textarea
            ref={field}
            value={body}
            rows={4}
            maxLength={4000}
            onInput={(e) => setBody((e.target as HTMLTextAreaElement).value)}
          />
        </label>
        <div class="capture-actions">
          <button type="submit" class="btn btn-primary">
            {t('capture.save')}
          </button>
          <button
            type="button"
            class="btn-secondary"
            aria-pressed={dictating}
            onClick={() => void toggleDictation()}
          >
            {dictating ? t('capture.dictate.stop') : t('capture.dictate')}
          </button>
        </div>
      </form>
      <p class="capture-status" role="status" aria-live="polite">
        {status}
      </p>

      <div>
        <h3>{t('capture.notes.title')}</h3>
        {sessionId !== undefined && (
          <label class="capture-check">
            <input
              type="checkbox"
              checked={onlySession}
              onChange={(e) => setOnlySession((e.target as HTMLInputElement).checked)}
            />
            {t('capture.session.filter')}
          </label>
        )}
        {visibleQueuedNotes.length + notes.length === 0 ? (
          <p>{t('capture.notes.empty')}</p>
        ) : (
          <ul class="capture-list">
            {visibleQueuedNotes.map((i) => (
              <li key={i.client_id} class="capture-item">
                <p>{i.body}</p>
                <div class="capture-meta">
                  <ItemStatus item={i} />
                  {i.session_id && <span>{t('capture.session.label', { id: i.session_id })}</span>}
                </div>
                <Actions item={i} />
              </li>
            ))}
            {notes.map((n) => (
              <li key={n.id} class="capture-item">
                <p>{n.body}</p>
                <div class="capture-meta">
                  <span class="capture-badge" data-state="synced">
                    {t('capture.status.synced')}
                  </span>
                  {n.session_id && <span>{t('capture.session.label', { id: n.session_id })}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form class="capture-form" onSubmit={addPerson}>
        <h3>{t('capture.person.title')}</h3>
        <label class="capture-field">
          {t('capture.person.name')}
          <input
            type="text"
            value={personName}
            autoComplete="off"
            onInput={(e) => setPersonName((e.target as HTMLInputElement).value)}
          />
        </label>
        <label class="capture-field">
          {t('capture.person.context')}
          <input
            type="text"
            value={personContext}
            onInput={(e) => setPersonContext((e.target as HTMLInputElement).value)}
          />
        </label>
        <div class="capture-actions">
          <button type="submit" class="btn-secondary">
            {t('capture.person.add')}
          </button>
        </div>
      </form>
      {(people.length > 0 || queuedPeople.length > 0) && (
        <div>
          <h3>{t('capture.people.title')}</h3>
          <ul class="capture-list">
            {queuedPeople.map((i) => (
              <li key={i.client_id} class="capture-item">
                <p>{i.body}</p>
                <div class="capture-meta">
                  <ItemStatus item={i} />
                </div>
                <Actions item={i} />
              </li>
            ))}
            {people.map((p) => (
              <li key={p.id} class="capture-item">
                <p>{p.name}</p>
                {p.context && <div class="capture-meta">{p.context}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form class="capture-form" onSubmit={addPromise}>
        <h3>{t('capture.promise.title')}</h3>
        <label class="capture-field">
          {t('capture.promise.text')}
          <input
            type="text"
            value={promiseText}
            onInput={(e) => setPromiseText((e.target as HTMLInputElement).value)}
          />
        </label>
        <label class="capture-field">
          {t('capture.promise.due')}
          <input
            type="date"
            value={promiseDue}
            onInput={(e) => setPromiseDue((e.target as HTMLInputElement).value)}
          />
        </label>
        <div class="capture-actions">
          <button type="submit" class="btn-secondary">
            {t('capture.promise.add')}
          </button>
        </div>
      </form>
      {(promises.length > 0 || queuedPromises.length > 0) && (
        <div>
          <h3>{t('capture.promises.title')}</h3>
          <ul class="capture-list">
            {queuedPromises.map((i) => (
              <li key={i.client_id} class="capture-item">
                <p>{i.body}</p>
                <div class="capture-meta">
                  <ItemStatus item={i} />
                </div>
                <Actions item={i} />
              </li>
            ))}
            {promises.map((p) => (
              <li key={p.id} class="capture-item">
                <label class="capture-check">
                  <input type="checkbox" checked={p.done} onChange={() => void toggleDone(p)} />
                  {t('capture.promise.done', { text: p.text })}
                </label>
                {p.due && <div class="capture-meta">{p.due}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
