// Heuristic access tags (labelled "Estimated" in the UI). Never claims captions exist.
export type AccessTag = 'novice-friendly' | 'jargon-light' | 'demo-heavy' | 'qa-heavy' | 'captions-unknown';

const DEMO_RE = /\b(demo|demos|hands-?on|workshop|live)\b/i;
const QA_RE = /\b(panel|fireside|ama|q&a|q\s*\+\s*a|ask me anything)\b/i;
const NOVICE_RE = /\b(novice|beginner)\b/i;

export function accessTags(input: { title: string; description?: string | null; audienceLevel?: string | null }): AccessTag[] {
  const text = `${input.title} ${input.description ?? ''}`;
  const tags: AccessTag[] = [];
  if (NOVICE_RE.test(input.audienceLevel ?? '')) tags.push('novice-friendly', 'jargon-light');
  if (DEMO_RE.test(text)) tags.push('demo-heavy');
  if (QA_RE.test(text)) tags.push('qa-heavy');
  tags.push('captions-unknown');
  return tags;
}
