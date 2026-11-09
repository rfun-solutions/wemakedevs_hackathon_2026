import { describe, expect, it } from 'vitest';
import { accessTags } from './access-tags';

describe('accessTags', () => {
  it('always includes captions-unknown', () => {
    expect(accessTags({ title: 'Plain talk' })).toEqual(['captions-unknown']);
  });
  it('tags novice level as novice-friendly and jargon-light', () => {
    expect(accessTags({ title: 'x', audienceLevel: 'Cloud Native Novice' })).toEqual(['novice-friendly', 'jargon-light', 'captions-unknown']);
    expect(accessTags({ title: 'x', audienceLevel: 'Beginner' })).toContain('novice-friendly');
  });
  it('does not tag advanced level as novice', () => {
    expect(accessTags({ title: 'x', audienceLevel: 'Advanced' })).not.toContain('novice-friendly');
  });
  it('detects demo-heavy from title or description', () => {
    expect(accessTags({ title: 'Hands-on Workshop' })).toContain('demo-heavy');
    expect(accessTags({ title: 'x', description: 'with a live demo' })).toContain('demo-heavy');
  });
  it('detects qa-heavy', () => {
    expect(accessTags({ title: 'Panel: Platform teams' })).toContain('qa-heavy');
    expect(accessTags({ title: 'Fireside chat' })).toContain('qa-heavy');
    expect(accessTags({ title: 'x', description: 'Q&A at the end' })).toContain('qa-heavy');
  });
  it('does not match substrings ("deliver", "alive")', () => {
    expect(accessTags({ title: 'Deliver software', description: 'stay alive' })).toEqual(['captions-unknown']);
  });
});
