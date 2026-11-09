/**
 * Contract stub owned by change c0-scaffold. Change f-observability-product replaces this file.
 * Exports match F's design exactly: A imports `getChaos` today and keeps compiling after the swap.
 */
export type ChaosFlags = { latencyMs: number; errorRate: number; naive: boolean };

export const DEFAULT_CHAOS: ChaosFlags = { latencyMs: 0, errorRate: 0, naive: false };

/** Missing file, key or bad JSON -> DEFAULT_CHAOS; never throws. The stub always returns the default. */
export function getChaos(key: string): ChaosFlags {
  void key;
  return DEFAULT_CHAOS;
}
