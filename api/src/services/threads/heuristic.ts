import {
  MAX_FOLLOW_UPS,
  type GroupedThread,
  type NoteRow,
  type OpenThread,
  type PromiseRow,
} from './types.js';

const STOPWORDS_EN = `a about after all also am an and any are as at be been but by can could did do does for from had has have he her his how i if in into is it its just me my no not of on or our out so than that the their them then there these they this to up us was we were what when which who will with would you your`;
const STOPWORDS_ES = `a al algo ante como con de del el ella ellos en es esa ese esta este esto la las lo los me mi muy no nos o para pero por que se si sin su sus te tu un una uno unos y ya yo`;
// Conference-speak that says nothing about the topic.
const STOPWORDS_DOMAIN = `talk talks demo session keynote day notes note said met worth more most use`;
export const STOPWORDS = new Set(
  `${STOPWORDS_EN} ${STOPWORDS_ES} ${STOPWORDS_DOMAIN}`.split(/\s+/),
);

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
  return words(text).map(stem);
}

/** Crude plural/gerund stemmer so "sidecars" matches "sidecar" and "filtering" matches "filter". */
export function stem(w: string): string {
  if (w === 'kubernetes') return w;
  if (w.length > 6 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

/** Normalised, stopword-free words (unstemmed, for display). */
function words(text: string): string[] {
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
  const shown = new Map<string, string>();
  for (const t of texts)
    for (const w of words(t)) {
      const k = stem(w);
      freq.set(k, (freq.get(k) ?? 0) + 1);
      if (!shown.has(k)) shown.set(k, w);
    }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, n)
    .map(([k]) => shown.get(k)!);
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
  // A note joins a cluster when Jaccard reaches the threshold, or when they share two keywords, or one
  // distinctive (4+ letter) keyword: notes are short, so whole-set Jaccard alone almost never fires.
  const bestFor = (kw: Set<string>, pool: Cluster[], threshold: number): Cluster | undefined => {
    let best: Cluster | undefined;
    let bestScore = 0;
    for (const c of pool) {
      let shared = 0;
      let longShared = false;
      for (const w of kw)
        if (c.keywords.has(w)) {
          shared++;
          if (w.length >= 4) longShared = true;
        }
      const j = jaccard(kw, c.keywords);
      if (!(j >= threshold || shared >= 2 || (shared >= 1 && longShared))) continue;
      const score = shared + j;
      if (score > bestScore) {
        best = c;
        bestScore = score;
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
      // Heuristic threads keep their keywords in the summary so later runs can match against more than the title.
      summary:
        c.existing?.summary ??
        topKeywords(
          c.notes.map((n) => n.body),
          8,
        ).join(', '),
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
