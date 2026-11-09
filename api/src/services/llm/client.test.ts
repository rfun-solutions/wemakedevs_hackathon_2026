import { trace } from '@opentelemetry/api';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
} from '@opentelemetry/sdk-trace';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  complete,
  LlmUnavailableError,
  RateLimitedError,
  resetLlmLimiters,
  setLlmClientFactory,
  type MessagesClient,
} from './client.js';

const exporter = new InMemorySpanExporter();
beforeAll(() => {
  trace.setGlobalTracerProvider(
    new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter })] }),
  );
});
afterAll(() => trace.disable());

const create = vi.fn<MessagesClient['messages']['create']>();
let restore: () => void;

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  delete process.env.LLM_MODEL;
  resetLlmLimiters();
  exporter.reset();
  create.mockReset();
  create.mockResolvedValue({
    content: [{ type: 'text', text: 'hola' }],
    usage: { input_tokens: 1000, output_tokens: 200 },
  });
  restore = setLlmClientFactory(() => ({ messages: { create } }));
});
afterEach(() => {
  restore();
  delete process.env.ANTHROPIC_API_KEY;
});

const base = {
  op: 'translate.text',
  deviceId: 'dev-1',
  messages: [{ role: 'user' as const, content: 'SECRET PROMPT hello' }],
  maxTokens: 100,
};

describe('complete()', () => {
  it('returns text, usage, cost and trace id with the default model', async () => {
    const r = await complete(base);
    expect(r.text).toBe('hola');
    expect(r.model).toBe('claude-haiku-5-5');
    expect(r.usage.inputTokens).toBe(1000);
    expect(r.usage.outputTokens).toBe(200);
    expect(r.usage.costUsd).toBeCloseTo((1000 * 0.1 + 200 * 0.5) / 1e6, 12);
    expect(r.usage.latencyMs).toBeGreaterThanOrEqual(0);
    expect(r.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(create.mock.calls[0]?.[0].model).toBe('claude-haiku-5-5');
  });

  it('honours a per-call model override and LLM_MODEL', async () => {
    const r = await complete({ ...base, model: 'claude-sonnet-5-5' });
    expect(r.model).toBe('claude-sonnet-5-5');
    expect(r.usage.costUsd).toBeCloseTo((1000 * 2 + 200 * 10) / 1e6, 12);
    process.env.LLM_MODEL = 'claude-sonnet-5-5';
    expect((await complete({ ...base, deviceId: 'dev-2' })).model).toBe('claude-sonnet-5-5');
  });

  it('throws RateLimitedError past the per-call limit, keyed by device and op', async () => {
    const rateLimit = { max: 2, windowMs: 60_000 };
    await complete({ ...base, rateLimit });
    await complete({ ...base, rateLimit });
    const err = await complete({ ...base, rateLimit }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RateLimitedError);
    expect((err as RateLimitedError).retryAfterS).toBeGreaterThan(0);
    await expect(complete({ ...base, deviceId: 'dev-other', rateLimit })).resolves.toBeDefined();
    await expect(complete({ ...base, op: 'threads.group', rateLimit })).resolves.toBeDefined();
    expect(create).toHaveBeenCalledTimes(4);
  });

  it('defaults to 20 calls per window', async () => {
    for (let i = 0; i < 20; i++) await complete(base);
    await expect(complete(base)).rejects.toBeInstanceOf(RateLimitedError);
  });

  it('throws LlmUnavailableError(no_key) without calling the SDK', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const err = await complete(base).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LlmUnavailableError);
    expect((err as LlmUnavailableError).reason).toBe('no_key');
    expect(create).not.toHaveBeenCalled();
  });

  it('maps SDK failures to LlmUnavailableError(upstream) without leaking the message', async () => {
    create.mockRejectedValue(new Error('upstream said: SECRET PROMPT hello'));
    const err = await complete(base).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LlmUnavailableError);
    expect((err as LlmUnavailableError).reason).toBe('upstream');
    expect((err as Error).message).not.toContain('SECRET');
  });

  it('records a kc.app.llm_complete span with GenAI attributes and no prompt or completion text', async () => {
    await complete({ ...base, system: 'SECRET SYSTEM' });
    const span = exporter.getFinishedSpans().find((s) => s.name === 'kc.app.llm_complete');
    expect(span).toBeDefined();
    const a = span!.attributes;
    expect(a['gen_ai.system']).toBe('anthropic');
    expect(a['gen_ai.request.model']).toBe('claude-haiku-5-5');
    expect(a['gen_ai.usage.input_tokens']).toBe(1000);
    expect(a['gen_ai.usage.output_tokens']).toBe(200);
    expect(a['kc.llm.cost_usd_estimate']).toBeGreaterThan(0);
    expect(a['kc.llm.latency_ms']).toBeGreaterThanOrEqual(0);
    const dump = JSON.stringify([a, span!.events]);
    expect(dump).not.toContain('SECRET');
    expect(dump).not.toContain('hola');
  });
});
