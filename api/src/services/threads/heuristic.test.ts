import { describe, expect, it } from 'vitest';
import { hasActionVerb, heuristicGroup, jaccard, keywordSet, tokenize } from './heuristic.js';
import type { NoteRow } from './types.js';

const note = (id: string, body: string, minute = 0): NoteRow => ({
  id,
  body,
  source: 'typed',
  sessionId: null,
  createdAt: new Date(Date.UTC(2026, 10, 10, 19, minute)),
});

describe('tokenize', () => {
  it('lowercases, strips EN and ES stopwords and accents', () => {
    expect(tokenize('The Kubernetes operator, para la observabilidad!')).toEqual([
      'kubernetes',
      'operator',
      'observabilidad',
    ]);
    expect(tokenize('Más información')).toEqual(['mas', 'informacion']);
  });
  it('jaccard is 0 for empty sets and 1 for equal sets', () => {
    expect(jaccard(new Set(), new Set(['a']))).toBe(0);
    expect(jaccard(keywordSet('otel traces'), keywordSet('traces otel'))).toBe(1);
  });
});

describe('hasActionVerb', () => {
  it.each([
    ['Need to follow up with Ana', true],
    ['Send the repo link', true],
    ['Enviar el enlace mañana', true],
    ['Great talk about eBPF', false],
    ['The sender was nice', false],
  ])('%s -> %s', (body, expected) => expect(hasActionVerb(body)).toBe(expected));
});

describe('heuristicGroup', () => {
  const notes = [
    note('n1', 'OpenTelemetry collector sampling tips. Try tail sampling next week.', 1),
    note('n2', 'Collector sampling config for OpenTelemetry traces', 2),
    note('n3', 'Gateway API migration from ingress nginx', 3),
    note('n4', 'Ingress nginx retirement and Gateway API', 4),
    note('n5', 'Lunch was great', 5),
  ];

  it('clusters similar notes and keeps unrelated ones apart', () => {
    const out = heuristicGroup({ notes, openThreads: [], promises: [] });
    const sets = out.map((t) => t.noteIds.join(','));
    expect(sets).toContain('n1,n2');
    expect(sets).toContain('n3,n4');
    expect(sets).toContain('n5');
    expect(out.find((t) => t.noteIds.includes('n1'))!.title.split(' ')).toHaveLength(3);
  });

  it('is deterministic regardless of input order', () => {
    const a = heuristicGroup({ notes, openThreads: [], promises: [] });
    const b = heuristicGroup({ notes: [...notes].reverse(), openThreads: [], promises: [] });
    expect(b).toEqual(a);
  });

  it('turns an action-verb note into a follow-up with its first sentence, max 3', () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      note(`m${i}`, `Send sampling report ${i}. More text`, i),
    );
    const out = heuristicGroup({ notes: many, openThreads: [], promises: [] });
    const t = out.find((x) => x.followUps.length > 0)!;
    expect(t.followUps.length).toBeLessThanOrEqual(3);
    expect(t.followUps[0]).toBe('Send sampling report 0.');
  });

  it('attaches notes to an open thread above the 0.2 threshold', () => {
    const out = heuristicGroup({
      notes: [note('x', 'More on Gateway API routes')],
      openThreads: [{ id: 'T1', title: 'gateway api ingress', summary: '' }],
      promises: [],
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.threadId).toBe('T1');
    expect(out[0]!.title).toBe('gateway api ingress');
  });

  it('attaches a promise to the best overlapping thread and drops one with no overlap', () => {
    const out = heuristicGroup({
      notes,
      openThreads: [],
      promises: [
        { id: 'p1', text: 'Send Ana the OpenTelemetry sampling config' },
        { id: 'p2', text: 'Buy conference stickers' },
      ],
    });
    const otel = out.find((t) => t.noteIds.includes('n1'))!;
    expect(otel.promiseIds).toEqual(['p1']);
    expect(out.flatMap((t) => t.promiseIds)).not.toContain('p2');
  });

  it('returns nothing for no notes', () => {
    expect(heuristicGroup({ notes: [], openThreads: [], promises: [] })).toEqual([]);
  });
});
