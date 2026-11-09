import { getDeviceId } from './device';

/** fetch wrapper for same-origin API calls: adds `X-Device-Id`. Returns the raw Response. */
export function api(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('X-Device-Id', getDeviceId());
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(path, { ...init, headers });
}
