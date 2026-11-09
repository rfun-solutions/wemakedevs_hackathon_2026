/** USD per million tokens, verified on claude.com/pricing 2026-11-08 (design D3). */
export const PRICES: Record<string, { inPerMTok: number; outPerMTok: number }> = {
  'claude-haiku-5-5': { inPerMTok: 0.1, outPerMTok: 0.5 },
  'claude-sonnet-5-5': { inPerMTok: 2, outPerMTok: 10 },
};

/** Unknown models cost 0 (estimate only, never throws). */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICES[model];
  if (!p) return 0;
  return (inputTokens * p.inPerMTok + outputTokens * p.outPerMTok) / 1_000_000;
}
