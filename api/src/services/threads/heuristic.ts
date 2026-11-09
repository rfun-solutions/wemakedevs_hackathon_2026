import {
  MAX_FOLLOW_UPS,
  type GroupedThread,
  type NoteRow,
  type OpenThread,
  type PromiseRow,
} from './types.js';

const STOPWORDS_EN = `a about after all also am an and any are as at be been but by can could did do does for from had has have he her his how i if in into is it its just me my no not of on or our out so than that the their them then there these they this to up us was we were what when which who will with would you your`;
const STOPWORDS_ES = `a al algo ante como con de del el ella ellos en es esa ese esta este esto la las lo los me mi muy no nos o para pero por que se si sin su sus te tu un una uno unos y ya yo`;
export const STOPWORDS = new Set(`${STOPWORDS_EN} ${STOPWORDS_ES}`.split(/\s+/));

/** Fixed EN/ES action verbs; multi-word entries match as a phrase. */
export const ACTION_VERBS = [
  'send',
  'email',
  'follow up',
  'try',
  'read',
  'ask',
  'share',
  'enviar',
  'escribir',
  'probar',
  'leer',
  'preguntar',
  'compartir',
];

const OPEN_THREAD_THRESHOLD = 0.2;
const CLUSTER_THRESHOLD = 0.25;
const PROMISE_THRESHOLD = 0.2;

/** Lowercase, strip accents, split on non-letters, drop stopwords and 1-char tokens. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export const keywordSet = (text: string): Set<string> => new Set(tokenize(text));

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Fraction of `small` found in `big` (used for short promises against a whole thread). */
function overlap(small: Set<string>, big: Set<string>): number {
  if (small.size === 0) return 0;
  let inter = 0;
  for (const x of small) if (big.has(x)) inter++;
  return inter / small.size;
}

/** Top-n keywords by frequency, ties alphabetical. */
function topKeywords(texts: string[], n: number): string[] {
  const freq = new Map<string, number>();
  for (const t of texts) for (const w of tokenize(t)) freq.set(w, (freq.get(w) ?? 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, n)
    .map(([w]) => w);
}

const firstSentence = (s: string): string => {
  const m = s.trim().match(/^[^.!?\n]+[.!?]?/);
  return (m?.[0] ?? s).trim().slice(0, 200);
};

export function hasActionVerb(body: string): boolean {
  const lower = ` ${body.toLowerCase().replace(/[^a-záéíóúñü]+/g, ' ')} `;
  return ACTION_VERBS.some((v) => lower.includes(` ${v} `));
}

interface Cluster {
  threadId?: string;
  keywords: Set<string>;
  notes: NoteRow[];
  existing?: OpenThread;
}

export interface HeuristicInput {
  notes: NoteRow[];
  openThreads: OpenThread[];
  promises: PromiseRow[];
}

/**
 * Deterministic grouping: notes sorted by created_at then id; each joins the best open thread
 * (Jaccard >= 0.2), else the best new cluster (>= 0.25), else starts a cluster. Pure.
 */
export function heuristicGroup(input: HeuristicInput): GroupedThread[] {
  const notes = [...input.notes].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : 1),
  );
  const clusters: Cluster[] = input.openThreads.map((t) => ({
    threadId: t.id,
    keywords: keywordSet(`${t.title} ${t.summary}`),
    notes: [],
    existing: t,
  }));
  const bestFor = (kw: Set<string>, pool: Cluster[], threshold: number): Cluster | undefined => {
    let best: Cluster | undefined;
    let bestScore = 0;
    for (const c of pool) {
      const s = jaccard(kw, c.keywords);
      if (s >= threshold && s > bestScore) {
        best = c;
        bestScore = s;
      }
    }
    return best;
  };

  for (const note of notes) {
    const kw = keywordSet(note.body);
    const open = bestFor(
      kw,
      clusters.filter((c) => c.existing),
      OPEN_THREAD_THRESHOLD,
    );
    const target =
      open ??
      bestFor(
        kw,
        clusters.filter((c) => !c.existing),
        CLUSTER_THRESHOLD,
      );
    if (target) {
      target.notes.push(note);
      for (const w of kw) target.keywords.add(w);
    } else {
      clusters.push({ keywords: new Set(kw), notes: [note] });
    }
  }

  const used = clusters.filter((c) => c.notes.length > 0);
  const out: GroupedThread[] = used.map((c) => {
    const followUps: string[] = [];
    for (const n of c.notes) {
      if (followUps.length >= MAX_FOLLOW_UPS) break;
      if (!hasActionVerb(n.body)) continue;
      const text = firstSentence(n.body);
      if (text && !followUps.includes(text)) followUps.push(text);
    }
    const keywords = topKeywords(
      c.notes.map((n) => n.body),
      3,
    );
    return {
      ...(c.threadId ? { threadId: c.threadId } : {}),
      title: c.existing?.title ?? (keywords.join(' ') || 'Notes'),
      summary: c.existing?.summary ?? '',
      noteIds: c.notes.map((n) => n.id),
      followUps,
      promiseIds: [],
    };
  });

  // A promise joins the thread whose keywords cover most of it (at least 0.2); ties keep the earlier thread.
  const sortedPromises = [...input.promises].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const p of sortedPromises) {
    const pk = keywordSet(p.text);
    let best = -1;
    let bestScore = 0;
    used.forEach((c, i) => {
      const s = overlap(pk, c.keywords);
      if (s >= PROMISE_THRESHOLD && s > bestScore) {
        best = i;
        bestScore = s;
      }
    });
    if (best >= 0) out[best]!.promiseIds.push(p.id);
  }
  return out;
}
