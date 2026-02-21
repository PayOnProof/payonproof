export type Currency = "USD" | "CRC" | "MXN" | "COP"

export interface Anchor {
  id: string
  origin: Currency
  destination: Currency
  spreadPercentOnRamp: number
  spreadPercentOffRamp: number
  onRampFeePercent: number
  offRampFeePercent: number
  fixedFeeUSD: number
  avgMinutes: number
}

export interface RouteBreakdown {
  inputAmount: number
  onRampFee: number
  offRampFee: number
  fixedFeeUSD: number
  networkFeeUSD: number
  totalFeeUSD: number
  amountReceived: number
}

export interface RouteResult {
  routeId: string
  breakdown: RouteBreakdown
  estimatedMinutes: number
  score?: number
}