import { describe, expect, it } from 'vitest';
import { SEED_NOTES, SEED_PEOPLE, SEED_PROMISES } from './seed-data.js';

const UUID4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('seed data', () => {
  it('meets the volume in the spec', () => {
    expect(SEED_NOTES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(SEED_NOTES.map((n) => n.topic)).size).toBeGreaterThanOrEqual(3);
    expect(SEED_PEOPLE).toHaveLength(4);
    expect(SEED_PROMISES).toHaveLength(3);
  });
  it('spans three Denver days', () => {
    const days = new Set(SEED_NOTES.map((n) => n.created_at.slice(0, 10)));
    expect([...days].sort()).toEqual(['2026-11-10', '2026-11-11', '2026-11-12']);
  });
  it('uses unique valid v4 client ids and resolvable person refs', () => {
    const ids = [...SEED_NOTES, ...SEED_PEOPLE, ...SEED_PROMISES].map((r) => r.client_id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(UUID4));
    const people = new Set(SEED_PEOPLE.map((p) => p.client_id));
    SEED_PROMISES.forEach((p) => expect(people.has(p.person_client_id)).toBe(true));
  });
  it('notes are within body limits', () => {
    SEED_NOTES.forEach((n) => expect(n.body.length).toBeLessThanOrEqual(4000));
  });
});
