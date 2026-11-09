import { VENUE_TZ } from './schedule/time.js';

/** Default per-replica daily cap on server translations (cost backstop, not an exact quota). */
export const DEFAULT_DAILY_CAP = 2000;

/** Calendar day in the venue time zone, `YYYY-MM-DD`. The cap resets when this changes (Denver midnight). */
export function denverDay(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: VENUE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

export function dailyCapFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number.parseInt(env.TRANSLATE_DAILY_CAP ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_DAILY_CAP;
}

export interface DailyCounter {
  /** True when today's count has reached the cap. */
  reached(): boolean;
  /** Counts one translation against today. */
  add(): void;
}

/** In-memory per-replica counter that resets at midnight America/Denver. */
export function createDailyCounter(cap: number, now: () => Date = () => new Date()): DailyCounter {
  let day = denverDay(now());
  let count = 0;
  const roll = (): void => {
    const d = denverDay(now());
    if (d !== day) {
      day = d;
      count = 0;
    }
  };
  return {
    reached() {
      roll();
      return count >= cap;
    },
    add() {
      roll();
      count += 1;
    },
  };
}
