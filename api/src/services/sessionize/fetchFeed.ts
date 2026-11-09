// Sessionize baseline owned by change g-pipeline-feed-contract.
// A (schedule) wraps this in schedule/ingest.ts and never edits this file.
// Deliberately v1-only: a timeout and NO retry (the 429 demo fix adds bounded retry).

export class FeedHttpError extends Error {
  readonly status: number;
  constructor(status: number, url: string) {
    super(`Feed request to ${url} failed with HTTP ${status}`);
    this.name = 'FeedHttpError';
    this.status = status;
  }
}

export interface FetchFeedOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export async function fetchFeed(url: string, opts: FetchFeedOptions = {}): Promise<unknown> {
  const { timeoutMs = 10_000, fetchImpl = fetch } = opts;
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new FeedHttpError(res.status, url);
  return res.json();
}
