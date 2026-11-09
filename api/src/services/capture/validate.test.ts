import { describe, expect, it } from 'vitest';
import {
  clampCreatedAt,
  validateListQuery,
  validateNote,
  validatePerson,
  validatePromise,
  validatePromisePatch,
} from './validate.js';

const ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-11-10T12:00:00Z');

describe('validateNote', () => {
  it('accepts a minimal typed note and trims the body', () => {
    const r = validateNote({ client_id: ID, body: '  hi  ', source: 'typed' }, NOW);
    expect(r).toMatchObject({
      ok: true,
      value: { body: 'hi', source: 'typed', session_id: null, person_ids: [] },
    });
  });
  it('accepts caption source and session_id', () => {
    const r = validateNote({ client_id: ID, body: 'x', source: 'caption', session_id: 'abc' }, NOW);
    expect(r).toMatchObject({ ok: true, value: { source: 'caption', session_id: 'abc' } });
  });
  it.each([
    [{ body: 'x', source: 'typed' }],
    [{ client_id: 'nope', body: 'x', source: 'typed' }],
    [{ client_id: ID, body: '   ', source: 'typed' }],
    [{ client_id: ID, body: 'x'.repeat(4001), source: 'typed' }],
    [{ client_id: ID, body: 'x', source: 'voice' }],
    [{ client_id: ID, body: 'x', source: 'typed', person_ids: ['bad'] }],
    [{ client_id: ID, body: 'x', source: 'typed', created_at: 'yesterday-ish' }],
    ['string'],
    [null],
  ])('rejects %j', (raw) => {
    expect(validateNote(raw, NOW).ok).toBe(false);
  });
  it('accepts exactly 4000 characters', () => {
    expect(validateNote({ client_id: ID, body: 'x'.repeat(4000), source: 'typed' }, NOW).ok).toBe(
      true,
    );
  });
  it('clamps a future client time to server now', () => {
    const r = validateNote(
      { client_id: ID, body: 'x', source: 'typed', created_at: '2030-01-01T00:00:00Z' },
      NOW,
    );
    expect(r.ok && r.value.created_at.getTime()).toBe(NOW.getTime());
  });
  it('keeps a past client time', () => {
    const d = clampCreatedAt('2026-11-10T08:00:00Z', NOW);
    expect(d.ok && d.value.toISOString()).toBe('2026-11-10T08:00:00.000Z');
  });
});

describe('validatePerson / validatePromise', () => {
  it('person needs name', () => {
    expect(validatePerson({ client_id: ID }).ok).toBe(false);
    expect(validatePerson({ client_id: ID, name: 'Ana', context: 'mesh talk' }).ok).toBe(true);
  });
  it('promise defaults done=false and validates due', () => {
    expect(validatePromise({ client_id: ID, text: 'send repo' })).toMatchObject({
      ok: true,
      value: { done: false },
    });
    expect(validatePromise({ client_id: ID, text: 'x', due: '2026-13-45' }).ok).toBe(false);
    expect(validatePromise({ client_id: ID, text: 'x', due: '2026-02-30' }).ok).toBe(false);
    expect(validatePromise({ client_id: ID, text: 'x', due: '2026-11-12' }).ok).toBe(true);
    expect(validatePromise({ client_id: ID, text: '' }).ok).toBe(false);
  });
  it('patch requires boolean done', () => {
    expect(validatePromisePatch({ done: true }).ok).toBe(true);
    expect(validatePromisePatch({ done: 'yes' }).ok).toBe(false);
  });
});

describe('validateListQuery', () => {
  it('defaults', () => {
    expect(validateListQuery({})).toMatchObject({
      ok: true,
      value: { limit: 50, before: null, session_id: null },
    });
  });
  it('passes session_id filter', () => {
    expect(validateListQuery({ session_id: 'keynote-1' })).toMatchObject({
      ok: true,
      value: { session_id: 'keynote-1' },
    });
  });
  it('treats empty session_id as unfiltered', () => {
    expect(validateListQuery({ session_id: '' })).toMatchObject({
      ok: true,
      value: { session_id: null },
    });
  });
  it('rejects bad limit and before', () => {
    expect(validateListQuery({ limit: '0' }).ok).toBe(false);
    expect(validateListQuery({ limit: '201' }).ok).toBe(false);
    expect(validateListQuery({ before: 'x' }).ok).toBe(false);
  });
});
