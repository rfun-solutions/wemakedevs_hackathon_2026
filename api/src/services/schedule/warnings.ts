// Building-change warnings for a personal agenda.
import { isKnownBuilding } from './rooms.js';

export type AgendaSession = { id: string; startsAt: Date; endsAt: Date; building: string | null };
export type BuildingWarning = {
  level: 'tight' | 'ok';
  fromSessionId: string;
  toSessionId: string;
  gapMinutes: number;
  walkMinutes: number;
  fromBuilding: string;
  toBuilding: string;
};

export function walkMinutesFromEnv(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.WALK_MINUTES);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Denver' });

/** `items` must be sorted by start time. Only consecutive items on the same venue day are compared. */
export function buildingWarnings(
  items: AgendaSession[],
  walkMinutes: number = walkMinutesFromEnv(),
): BuildingWarning[] {
  const out: BuildingWarning[] = [];
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1]!;
    const next = items[i]!;
    if (dayKey(prev.startsAt) !== dayKey(next.startsAt)) continue;
    if (!isKnownBuilding(prev.building) || !isKnownBuilding(next.building)) continue;
    if (prev.building!.trim().toLowerCase() === next.building!.trim().toLowerCase()) continue;
    const gapMinutes = Math.round((next.startsAt.getTime() - prev.endsAt.getTime()) / 60000);
    out.push({
      level: gapMinutes < walkMinutes ? 'tight' : 'ok',
      fromSessionId: prev.id,
      toSessionId: next.id,
      gapMinutes,
      walkMinutes,
      fromBuilding: prev.building!,
      toBuilding: next.building!,
    });
  }
  return out;
}
