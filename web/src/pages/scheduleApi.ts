import { api } from '../lib/api';

export interface Session {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  venueTz: string;
  building: string | null;
  level: string | null;
  room: string | null;
  track: string | null;
  audienceLevel: string | null;
  accessTags: string[];
}
export interface BuildingWarning {
  level: 'tight' | 'ok';
  fromSessionId: string;
  toSessionId: string;
  gapMinutes: number;
  walkMinutes: number;
  fromBuilding: string;
  toBuilding: string;
}
export interface SessionsResponse {
  sessions: Session[];
  filters: { days: string[]; rooms: string[]; tracks: string[] };
}
export interface AgendaResponse {
  items: Session[];
  warnings: BuildingWarning[];
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const fetchSessions = async (): Promise<SessionsResponse> =>
  json(await api('/api/sessions'));
export const fetchAgenda = async (): Promise<AgendaResponse> => json(await api('/api/agenda'));

export async function addToAgenda(sessionId: string): Promise<void> {
  const res = await api('/api/agenda', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
export async function removeFromAgenda(sessionId: string): Promise<void> {
  const res = await api(`/api/agenda/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
