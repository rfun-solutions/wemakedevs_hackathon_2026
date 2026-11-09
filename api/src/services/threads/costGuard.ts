import { estimateCostUsd, PRICES } from '../llm/pricing.js';
import type { Queryable } from './db.js';

export const DEFAULT_DAILY_CAP_USD = 0.05;

export function dailyCapUsd(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.THREADS_DAILY_CAP_USD);
  // 0 is a valid cap (forces the heuristic); only unset/garbage/negative fall back to the default.
  return env.THREADS_DAILY_CAP_USD !== undefined &&
    env.THREADS_DAILY_CAP_USD !== '' &&
    Number.isFinite(n) &&
    n >= 0
    ? n
    : DEFAULT_DAILY_CAP_USD;
}

/** Worst case for one call: ~3 chars per token of prompt, and every max output token used. Unknown models are priced as Sonnet. */
export function worstCaseCostUsd(model: string, promptChars: number, maxTokens: number): number {
  const priced = model in PRICES ? model : 'claude-sonnet-5-5';
  return estimateCostUsd(priced, Math.ceil(promptChars / 3) + 200, maxTokens);
}

/** Serialises threading runs per device until the surrounding transaction ends. */
export async function lockDevice(tx: Queryable, deviceId: string): Promise<void> {
  await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`threads:${deviceId}`]);
}

export async function spentOnDay(tx: Queryable, deviceId: string, day: string): Promise<number> {
  const r = await tx.query(
    `SELECT COALESCE(SUM(cost_usd), 0)::float8 AS s FROM llm_usage WHERE device_id = $1 AND day = $2::date`,
    [deviceId, day],
  );
  return Number(r.rows[0].s);
}

export interface CapDecision {
  allowed: boolean;
  spent: number;
  estimate: number;
  cap: number;
}

/** Pure decision: spent today plus the worst case of this call must stay within the cap. */
export function decideCap(spent: number, estimate: number, cap: number): CapDecision {
  return { allowed: spent + estimate <= cap, spent, estimate, cap };
}
