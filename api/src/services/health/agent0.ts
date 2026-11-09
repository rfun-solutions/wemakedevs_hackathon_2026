/**
 * D3: Agent0 explains to Kay, cached. Server-side only; never on a user request and never with the token in
 * the browser. A healthy-to-breached transition fires one Dash0 MCP `runTask` (at most once per 10 min),
 * asynchronously with a 60 s timeout, and stores `{ text, at }`. When Agent0 is unreachable nothing is
 * invented: `explain()` returns null and the screen says the explanation is not available.
 */
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { complete } from '../llm/client.js';

export const AGENT0_PROMPT =
  'In one plain sentence for a non-technical attendee: is the KubeCompanion app healthy right now, and if not, what is slow?';
export const AGENT0_ENDPOINT = 'https://api.us-west-2.aws.dash0.com/mcp';
export const DEBOUNCE_MS = 10 * 60_000;
export const TASK_TIMEOUT_MS = 60_000;

export type Agent0Failure = 'no_token' | 'auth_refused' | 'timeout' | 'upstream' | 'empty';

export class Agent0Error extends Error {
  constructor(
    readonly reason: Agent0Failure,
    message?: string,
  ) {
    super(message ?? reason);
    this.name = 'Agent0Error';
  }
}

export interface Agent0Stored {
  text: string;
  at: number;
}

export interface Explanation {
  text: string;
  lang: 'en' | 'es';
  at: number;
}

/** Subscribes `cb` to healthy-to-breached transitions (F2's `onHealthTransition`); returns an unsubscribe. */
export type SubscribeTransitions = (cb: () => void) => (() => void) | void;

/** Translate one sentence; defaults to C0's complete(). Throws on failure. */
export type Translate = (text: string, lang: 'es') => Promise<string>;

export interface Agent0Options {
  subscribe?: SubscribeTransitions;
  fetchFn?: typeof fetch;
  getToken?: () => string | undefined;
  endpoint?: string;
  now?: () => number;
  debounceMs?: number;
  timeoutMs?: number;
  translate?: Translate;
}

/** Pull the final answer out of an MCP `text/event-stream` (or plain JSON) response body. */
export function parseRunTaskReply(body: string): string {
  const payloads: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    if (line.startsWith('data:')) payloads.push(line.slice(5).trim());
  }
  if (payloads.length === 0) payloads.push(body.trim());
  for (const raw of payloads.reverse()) {
    let msg: {
      result?: { isError?: boolean; content?: { type?: string; text?: string }[] };
      error?: { message?: string };
    };
    try {
      msg = JSON.parse(raw);
    } catch {
      continue;
    }
    if (msg.error) throw new Agent0Error('upstream', msg.error.message ?? 'rpc error');
    if (msg.result?.isError) throw new Agent0Error('upstream', 'agent0 reported an error');
    const text = msg.result?.content?.find((c) => c.type === 'text' && c.text)?.text;
    if (text) return cleanAnswer(text);
  }
  throw new Agent0Error('empty');
}

/** Drop the trailing "Open conversation in Dash0" link block and collapse whitespace. */
export function cleanAnswer(text: string): string {
  const cut = text.split(/\n+\s*\[?Open conversation/i)[0] ?? text;
  return cut.replace(/\s+/g, ' ').trim();
}

export async function runAgent0Task(opts: {
  fetchFn: typeof fetch;
  token: string | undefined;
  endpoint: string;
  timeoutMs: number;
}): Promise<string> {
  if (!opts.token) throw new Agent0Error('no_token');
  let res: Response;
  try {
    res = await opts.fetchFn(opts.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'runTask',
          arguments: {
            message: AGENT0_PROMPT,
            dataset: 'default',
            timeoutSeconds: 45,
          },
        },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
  } catch (err) {
    const name = (err as Error).name;
    throw new Agent0Error(
      name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'upstream',
    );
  }
  if (res.status === 401 || res.status === 403) throw new Agent0Error('auth_refused');
  if (!res.ok) throw new Agent0Error('upstream', `status ${res.status}`);
  return parseRunTaskReply(await res.text());
}

async function defaultTranslate(text: string, lang: 'es'): Promise<string> {
  const out = await complete({
    op: 'status.agent0_translate',
    deviceId: 'server',
    system: `Translate the user's sentence into plain ${lang === 'es' ? 'Spanish' : lang}. Output only the translation.`,
    messages: [{ role: 'user', content: text }],
    maxTokens: 200,
    rateLimit: { max: 6, windowMs: 600_000 },
  });
  return out.text.trim();
}

export interface Agent0Service {
  /** Fire one task now unless debounced or already running. Resolves when finished; never rejects. */
  trigger(): Promise<'stored' | 'debounced' | 'running' | Agent0Failure>;
  /** Cached explanation in `lang`, or null when Agent0 has produced nothing. Never calls Agent0. */
  explain(lang: string): Promise<Explanation | null>;
  current(): Agent0Stored | null;
  stop(): void;
}

export function createAgent0Service(opts: Agent0Options = {}): Agent0Service {
  const fetchFn = opts.fetchFn ?? fetch;
  const getToken = opts.getToken ?? (() => process.env.DASH0_TOKEN);
  const endpoint = opts.endpoint ?? AGENT0_ENDPOINT;
  const now = opts.now ?? Date.now;
  const debounceMs = opts.debounceMs ?? DEBOUNCE_MS;
  const timeoutMs = opts.timeoutMs ?? TASK_TIMEOUT_MS;
  const translate = opts.translate ?? defaultTranslate;

  let stored: Agent0Stored | null = null;
  let lastFired = Number.NEGATIVE_INFINITY;
  let running = false;
  let es: { forText: string; text: string } | null = null;
  let esInFlight: { forText: string; p: Promise<string | null> } | null = null;

  const trigger: Agent0Service['trigger'] = async () => {
    if (running) return 'running';
    if (now() - lastFired < debounceMs) return 'debounced';
    running = true;
    lastFired = now();
    return trace
      .getTracer('kubecompanion')
      .startActiveSpan('kc.status.agent0_task', async (span) => {
        try {
          const text = await runAgent0Task({ fetchFn, token: getToken(), endpoint, timeoutMs });
          stored = { text, at: now() };
          es = null; // translation is cached only until the next sentence
          span.setAttribute('kc.status.agent0_ok', true);
          return 'stored' as const;
        } catch (err) {
          const reason: Agent0Failure = err instanceof Agent0Error ? err.reason : 'upstream';
          span.setAttribute('kc.status.agent0_ok', false);
          span.setAttribute('kc.status.agent0_failure', reason);
          span.setStatus({ code: SpanStatusCode.ERROR, message: reason });
          return reason;
        } finally {
          running = false;
          span.end();
        }
      });
  };

  const translated = async (s: Agent0Stored): Promise<string | null> => {
    if (es && es.forText === s.text) return es.text;
    if (!esInFlight || esInFlight.forText !== s.text) {
      const p = translate(s.text, 'es')
        .then((text) => {
          if (!text) return null;
          es = { forText: s.text, text };
          return text;
        })
        .catch(() => null)
        .finally(() => {
          if (esInFlight?.p === p) esInFlight = null;
        });
      esInFlight = { forText: s.text, p };
    }
    return esInFlight.p;
  };

  const unsubscribe = opts.subscribe?.(() => void trigger());

  return {
    trigger,
    current: () => stored,
    async explain(lang) {
      if (!stored) return null;
      if (lang !== 'es') return { text: stored.text, lang: 'en', at: stored.at };
      const text = await translated(stored);
      // Translation failed: serve Agent0's own English sentence, honestly labelled.
      return text
        ? { text, lang: 'es', at: stored.at }
        : { text: stored.text, lang: 'en', at: stored.at };
    },
    stop() {
      if (typeof unsubscribe === 'function') unsubscribe();
    },
  };
}
