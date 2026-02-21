import { Currency, RouteResult } from "./types"
import { fxRates } from "./fxRates"
import { anchors } from "./anchorRegistry"
import { scoreRoutes } from "./scoringEngine"

export function compareRoutes(
  origin: Currency,
  destination: Currency,
  amount: number
): RouteResult[] {
  const routes = anchors
    .filter(a => a.origin === origin && a.destination === destination)
    .map(anchor => {

      const marketRateOriginUSD = 1 / fxRates[origin]
      const effectiveOnRampRate =
        marketRateOriginUSD * (1 - anchor.spreadPercentOnRamp)

      const usdcAmount = amount * effectiveOnRampRate

      const onRampFee = amount * anchor.onRampFeePercent
      const fixedFeeUSD = anchor.fixedFeeUSD

      const marketRateUSDToDest = fxRates[destination]
      const effectiveOffRampRate =
        marketRateUSDToDest * (1 - anchor.spreadPercentOffRamp)

      const destAmountGross = usdcAmount * effectiveOffRampRate
      const offRampFee = destAmountGross * anchor.offRampFeePercent

      const networkFeeUSD = 0.02

      const totalFeeUSD =
        (onRampFee * marketRateOriginUSD) +
        fixedFeeUSD +
        offRampFee / marketRateUSDToDest +
        networkFeeUSD

      const amountReceived = destAmountGross - offRampFee

      return {
        routeId: anchor.id,
        breakdown: {
          inputAmount: amount,
          onRampFee,
          offRampFee,
          fixedFeeUSD,
          networkFeeUSD,
          totalFeeUSD,
          amountReceived
        },
        estimatedMinutes: anchor.avgMinutes
      }
    })

  return scoreRoutes(routes)
}