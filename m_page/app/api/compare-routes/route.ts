import { Asset } from "@stellar/stellar-sdk"
import { publicServer } from "@/lib/stellar"

export async function GET() {
  const XLM = Asset.native()

  const USDC = new Asset(
    "USDC",
    "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"//Su direccion propia de la wallet
  )

  const response = await publicServer
    .strictSendPaths(XLM, "10", [USDC])
    .call()

  const routes = response.records.map((route, index) => {
    const hops = route.path.length
    const rawAmount = parseFloat(route.destination_amount)

    const popFee = rawAmount * 0.005
    const finalAmount = rawAmount - popFee

    const score = rawAmount - hops * 0.0001

    return {
      id: index,
      hops,
      rawAmount,
      popFee,
      finalAmount,
      score,
      path: route.path
    }
  })

  routes.sort((a, b) => b.score - a.score)

  return Response.json({
    recommended: routes[0],
    alternatives: routes.slice(1),
  })
}