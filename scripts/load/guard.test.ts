import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS module shared with k6
import { guardPath, guardPaths } from './guard.js';

describe('load guard', () => {
  it('allows agenda and sessions', () => {
    expect(guardPaths(['/api/agenda', '/api/sessions', '/api/sessions?day=1'])).toHaveLength(3);
  });
  it.each(['/api/translate', '/api/llm/x', '/api/threads/1', '/api/agenda/Translate', '/api/notes', '/healthz'])(
    'refuses %s', (p) => expect(() => guardPath(p)).toThrow(/load guard/),
  );
});
