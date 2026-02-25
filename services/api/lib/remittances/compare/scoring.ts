import type { RemittanceRoute } from "./types.ts";

function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return (value - min) / (max - min);
}

export function scoreRoutes(routes: RemittanceRoute[]): RemittanceRoute[] {
  if (routes.length === 0) return [];

  const feeValues = routes.map((r) => r.feeAmount);
  const timeValues = routes.map((r) => r.estimatedMinutes);
  const minFee = Math.min(...feeValues);
  const maxFee = Math.max(...feeValues);
  const minTime = Math.min(...timeValues);
  const maxTime = Math.max(...timeValues);

  const weighted = routes.map((route) => {
    const feeScore = 1 - normalize(route.feeAmount, minFee, maxFee);
    const timeScore = 1 - normalize(route.estimatedMinutes, minTime, maxTime);
    const riskPenalty = route.risks.length > 0 ? 0.2 : 0;
    const score = Number((feeScore * 0.7 + timeScore * 0.3 - riskPenalty).toFixed(4));
    return { ...route, score };
  });

  const sorted = weighted.sort((a, b) => b.score - a.score);
  const firstAvailableId = sorted.find((r) => r.available)?.id;
  return sorted.map((route) => ({
    ...route,
    recommended: Boolean(firstAvailableId && route.id === firstAvailableId),
  }));
}
