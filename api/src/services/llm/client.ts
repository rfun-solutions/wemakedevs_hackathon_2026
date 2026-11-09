import Anthropic from '@anthropic-ai/sdk';
import { metrics, SpanStatusCode, trace, type Counter } from '@opentelemetry/api';
import { createRateLimiter, type RateLimiter } from '../../lib/rateLimit.js';
import { estimateCostUsd } from './pricing.js';

/** The only LLM entry point; E and C call it identically (design D3). */
export interface CompleteRequest {
  op: string; // e.g. 'translate.text' (E), 'threads.group' (C); span attr + limiter bucket
  deviceId: string; // request.deviceId
  system?: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  maxTokens: number;
  model?: string; // default process.env.LLM_MODEL ?? 'claude-haiku-5-5'
  rateLimit?: { max: number; windowMs: number }; // default 20 per 600_000 ms, bucket `${deviceId}:${op}`
}

export interface CompleteResult {
  text: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number; costUsd: number; latencyMs: number };
  traceId: string;
}

export class RateLimitedError extends Error {
  readonly retryAfterS: number;
  constructor(retryAfterS: number) {
    super(`LLM rate limit exceeded; retry in ${retryAfterS}s`);
    this.name = 'RateLimitedError';
    this.retryAfterS = retryAfterS;
  }
}

export class LlmUnavailableError extends Error {
  readonly reason: 'no_key' | 'upstream';
  constructor(reason: 'no_key' | 'upstream', message?: string) {
    super(message ?? (reason === 'no_key' ? 'ANTHROPIC_API_KEY is not set' : 'LLM upstream error'));
    this.name = 'LlmUnavailableError';
    this.reason = reason;
  }
}

export const LLM_TIMEOUT_MS = 20_000;
const DEFAULT_MODEL = 'claude-haiku-5-5';

/** Minimal surface of the SDK that we use; tests inject a fake. */
export interface MessagesClient {
  messages: {
    create(
      body: {
        model: string;
        max_tokens: number;
        system?: string;
        messages: { role: 'user' | 'assistant'; content: string }[];
      },
      options?: { timeout?: number; signal?: AbortSignal },
    ): Promise<{
      content: { type: string; text?: string }[];
      usage: { input_tokens: number; output_tokens: number };
    }>;
  };
}

let clientFactory: (apiKey: string) => MessagesClient = (apiKey) =>
  new Anthropic({ apiKey, timeout: LLM_TIMEOUT_MS, maxRetries: 0 }) as unknown as MessagesClient;

/** Test seam: replace the SDK client factory. Returns a restore function. */
export function setLlmClientFactory(f: (apiKey: string) => MessagesClient): () => void {
  const prev = clientFactory;
  clientFactory = f;
  return () => {
    clientFactory = prev;
  };
}

const limiters = new Map<string, RateLimiter>();
function limiterFor(max: number, windowMs: number): RateLimiter {
  const k = `${max}:${windowMs}`;
  let l = limiters.get(k);
  if (!l) {
    l = createRateLimiter({ max, windowMs });
    limiters.set(k, l);
  }
  return l;
}

/** Test seam: forget all buckets. */
export function resetLlmLimiters(): void {
  limiters.clear();
}

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const meter = () => metrics.getMeter('kubecompanion');
const tracer = () => trace.getTracer('kubecompanion');
// Instruments are created lazily so a provider registered after import is still used.
let instruments: { calls: Counter; tokens: Counter; limited: Counter } | undefined;
function getInstruments() {
  instruments ??= {
    calls: meter().createCounter('kc_app_llm_calls_total', {
      description: 'LLM calls by op, model and outcome',
    }),
    tokens: meter().createCounter('kc_app_llm_tokens_total', {
      description: 'LLM tokens by op, model and direction',
    }),
    limited: meter().createCounter('kc_app_llm_rate_limited_total', {
      description: 'LLM calls rejected by the rate limiter',
    }),
  };
  return instruments;
}
/** Test seam: recreate instruments against a newly registered meter provider. */
export function resetLlmInstruments(): void {
  instruments = undefined;
}

export async function complete(req: CompleteRequest): Promise<CompleteResult> {
  const model = req.model ?? process.env.LLM_MODEL ?? DEFAULT_MODEL;
  const ins = getInstruments();

  return tracer().startActiveSpan('kc.app.llm_complete', async (span) => {
    // Prompt and completion text are never placed on spans.
    span.setAttributes({
      'gen_ai.system': 'anthropic',
      'gen_ai.request.model': model,
      'gen_ai.request.max_tokens': req.maxTokens,
      'kc.llm.op': req.op,
    });
    const traceId = span.spanContext().traceId;
    const fail = (outcome: string, err: Error): never => {
      ins.calls.add(1, { op: req.op, model, outcome });
      span.setAttribute('kc.llm.outcome', outcome);
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.name });
      span.end();
      throw err;
    };

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return fail('no_key', new LlmUnavailableError('no_key'));

    const rl = req.rateLimit ?? {
      max: envInt('LLM_RATE_MAX', 20),
      windowMs: envInt('LLM_RATE_WINDOW_MS', 600_000),
    };
    const taken = limiterFor(rl.max, rl.windowMs).take(`${req.deviceId}:${req.op}`);
    if (!taken.ok) {
      ins.limited.add(1, { op: req.op });
      return fail('rate_limited', new RateLimitedError(taken.retryAfterS));
    }

    const started = performance.now();
    try {
      const res = await clientFactory(apiKey).messages.create(
        {
          model,
          max_tokens: req.maxTokens,
          ...(req.system !== undefined ? { system: req.system } : {}),
          messages: req.messages,
        },
        { timeout: LLM_TIMEOUT_MS, signal: AbortSignal.timeout(LLM_TIMEOUT_MS) },
      );
      const latencyMs = Math.round(performance.now() - started);
      const inputTokens = res.usage.input_tokens;
      const outputTokens = res.usage.output_tokens;
      const costUsd = estimateCostUsd(model, inputTokens, outputTokens);
      const text = res.content.map((b) => (b.type === 'text' ? (b.text ?? '') : '')).join('');
      span.setAttributes({
        'gen_ai.response.model': model,
        'gen_ai.usage.input_tokens': inputTokens,
        'gen_ai.usage.output_tokens': outputTokens,
        'kc.llm.latency_ms': latencyMs,
        'kc.llm.cost_usd_estimate': costUsd,
        'kc.llm.outcome': 'ok',
      });
      ins.calls.add(1, { op: req.op, model, outcome: 'ok' });
      ins.tokens.add(inputTokens, { op: req.op, model, direction: 'input' });
      ins.tokens.add(outputTokens, { op: req.op, model, direction: 'output' });
      span.end();
      return { text, model, usage: { inputTokens, outputTokens, costUsd, latencyMs }, traceId };
    } catch (e) {
      if (e instanceof LlmUnavailableError || e instanceof RateLimitedError) throw e;
      // Deliberately not forwarding the upstream message: it can echo request content.
      return fail(
        'upstream',
        new LlmUnavailableError('upstream', `LLM call failed (${(e as Error)?.name ?? 'error'})`),
      );
    }
  });
}
