import { RouteResult } from "./types"
export function scoreRoutes(routes: RouteResult[]): RouteResult[] {
  const maxFee = Math.max(...routes.map((r: RouteResult) => r.breakdown.totalFeeUSD))
  const maxTime = Math.max(...routes.map((r: RouteResult) => r.estimatedMinutes))

  return routes.map((route: RouteResult) => {
    const normalizedFee =
      1 - (route.breakdown.totalFeeUSD / maxFee)

    const normalizedTime =
      1 - (route.estimatedMinutes / maxTime)

    const score =
      (0.7 * normalizedFee) +
      (0.3 * normalizedTime)

    return {
      ...route,
      score
    }
  }).sort((a: RouteResult, b: RouteResult) => b.score! - a.score!)
}