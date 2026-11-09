export const SLOW_CHUNK_MS = 4000;
export const SLOW_STREAK = 3;

export type SliAction = 'none' | 'switch' | 'message';

export interface SliMonitor {
  /** Feed one segment lag. Returns what the session should do now. */
  record(lagMs: number): SliAction;
}

/**
 * Local caption SLI. Three slow segments in a row (>= 4000 ms, reset by a fast one) trigger ONE switch per session
 * to the next capable engine. With no alternative, a single "falling behind on this phone" message and no switch.
 */
export function createSliMonitor(hasAlternative: () => boolean): SliMonitor {
  let streak = 0;
  let switched = false;
  let messaged = false;
  return {
    record(lagMs) {
      if (lagMs < SLOW_CHUNK_MS) {
        streak = 0;
        return 'none';
      }
      streak += 1;
      if (streak < SLOW_STREAK) return 'none';
      streak = 0;
      if (switched) return 'none';
      if (hasAlternative()) {
        switched = true;
        return 'switch';
      }
      if (messaged) return 'none';
      messaged = true;
      return 'message';
    },
  };
}
