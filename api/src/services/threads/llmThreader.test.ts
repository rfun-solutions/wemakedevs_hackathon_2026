import { describe, expect, it } from 'vitest';
import { LlmUnavailableError, RateLimitedError } from '../llm/client.js';
import { buildUserMessage, llmGroup, parseGrouping, ThreadingFallback } from './llmThreader.js';
import { fakeLlm } from './testSupport.js';
import type { NoteRow } from './types.js';

const NOTE_A = '11111111-1111-4111-8111-111111111111';
const NOTE_B = '22222222-2222-4222-8222-222222222222';
const PROMISE = '33333333-3333-4333-8333-333333333333';
const THREAD = '44444444-4444-4444-8444-444444444444';

const mkNote = (id: string, body = 'body'): NoteRow => ({
  id,
  body,
  source: 'typed',
  sessionId: null,
  createdAt: new Date('2026-11-10T19:00:00Z'),
});
const input = {
  notes: [mkNote(NOTE_A), mkNote(NOTE_B)],
  openThreads: [{ id: THREAD, title: 'Gateway API', summary: '' }],
  promises: [{ id: PROMISE, text: 'send repo' }],
};
const good = (extra: object = {}) =>
  JSON.stringify({
    threads: [
      {
        threadId: THREAD,
        title: 'Gateway API',
        summary: 's',
        noteIds: [NOTE_A, NOTE_B],
        followUps: ['Read the KEP'],
        promiseIds: [PROMISE],
        ...extra,
      },
    ],
  });

describe('llmGroup', () => {
  it('calls C0 complete() as designed and returns validated threads with usage', async () => {
    const llm = fakeLlm([good()]);
    const r = await llmGroup(input, { deviceId: 'dev', complete: llm.complete });
    expect(llm.calls).toHaveLength(1);
    expect(llm.calls[0]).toMatchObject({
      op: 'threads.group',
      deviceId: 'dev',
      maxTokens: 2048,
      model: 'claude-haiku-5-5',
    });
    expect(llm.calls[0]!.messages[0]!.role).toBe('user');
    expect(r.threads[0]).toMatchObject({
      threadId: THREAD,
      noteIds: [NOTE_A, NOTE_B],
      followUps: ['Read the KEP'],
      promiseIds: [PROMISE],
    });
    expect(r.usage.inputTokens).toBe(1000);
    expect(r.unassignedNoteIds).toEqual([]);
  });

  it('accepts fenced JSON and honours THREADS_MODEL via the model argument', async () => {
    const llm = fakeLlm(['```json\n' + good() + '\n```']);
    await llmGroup(input, { deviceId: 'd', complete: llm.complete, model: 'claude-sonnet-5-5' });
    expect(llm.calls[0]!.model).toBe('claude-sonnet-5-5');
  });

  it('drops unknown promise ids and unknown thread ids, caps follow-ups at 3', async () => {
    const llm = fakeLlm([
      good({
        threadId: '99999999-9999-4999-8999-999999999999',
        promiseIds: [PROMISE, '55555555-5555-4555-8555-555555555555'],
        followUps: ['a', 'b', 'c', 'd'],
      }),
    ]);
    const r = await llmGroup(input, { deviceId: 'd', complete: llm.complete });
    expect(r.threads[0]!.promiseIds).toEqual([PROMISE]);
    expect(r.threads[0]!.threadId).toBeUndefined();
    expect(r.threads[0]!.followUps).toEqual(['a', 'b', 'c']);
  });

  it('reports notes the model left out as unassigned and ignores invented note ids', async () => {
    const llm = fakeLlm([good({ noteIds: [NOTE_A, '66666666-6666-4666-8666-666666666666'] })]);
    const r = await llmGroup(input, { deviceId: 'd', complete: llm.complete });
    expect(r.threads[0]!.noteIds).toEqual([NOTE_A]);
    expect(r.unassignedNoteIds).toEqual([NOTE_B]);
  });

  it('retries once on invalid JSON and sums usage', async () => {
    const llm = fakeLlm(['not json', good()]);
    const r = await llmGroup(input, { deviceId: 'd', complete: llm.complete });
    expect(llm.calls).toHaveLength(2);
    expect(r.usage.inputTokens).toBe(2000);
  });

  it('falls back with reason error after two invalid replies, keeping the spend', async () => {
    const llm = fakeLlm(['nope', '{"threads":"x"}']);
    const err = await llmGroup(input, { deviceId: 'd', complete: llm.complete }).catch((e) => e);
    expect(err).toBeInstanceOf(ThreadingFallback);
    expect(err.reason).toBe('error');
    expect(err.usage.inputTokens).toBe(2000);
    expect(llm.calls).toHaveLength(2);
  });

  it('maps no_key to reason no_key; rate limit and upstream errors to reason error, without retry', async () => {
    for (const [e, reason] of [
      [new LlmUnavailableError('no_key'), 'no_key'],
      [new RateLimitedError(30), 'error'],
      [new LlmUnavailableError('upstream'), 'error'],
      [new Error('boom'), 'error'],
    ] as const) {
      const llm = fakeLlm([e]);
      const err = await llmGroup(input, { deviceId: 'd', complete: llm.complete }).catch((x) => x);
      expect(err).toBeInstanceOf(ThreadingFallback);
      expect(err.reason).toBe(reason);
      expect(llm.calls).toHaveLength(1);
    }
  });
});

describe('buildUserMessage and parseGrouping', () => {
  it('sends at most 40 notes and keeps the note text within about 6000 chars', () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      mkNote(`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, 'x'.repeat(900)),
    );
    const { content, sent } = buildUserMessage({ notes: many, openThreads: [], promises: [] });
    expect(sent).toHaveLength(40);
    const bodies = (JSON.parse(content) as { notes: { body: string }[] }).notes.map(
      (n) => n.body.length,
    );
    expect(bodies.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(6000);
  });

  it('rejects a thread with an empty title', () => {
    const known = {
      noteIds: new Set([NOTE_A]),
      threadIds: new Set<string>(),
      promiseIds: new Set<string>(),
    };
    expect(
      parseGrouping(JSON.stringify({ threads: [{ title: ' ', noteIds: [NOTE_A] }] }), known),
    ).toBeUndefined();
  });
});
