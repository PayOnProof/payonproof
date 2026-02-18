import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readJsonBody } from "../lib/http";

/**
 * POST /api/compare-routes
 *
 * Accepts: { origin: string, destination: string, amount: number }
 * Returns: mock route comparison data
 *
 * TODO: Replace with real off-ramp/on-ramp queries and on-chain cost checks.
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = readJsonBody(req);
  if (!parsed.ok) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const { origin, destination, amount } = parsed.value as {
    origin?: string;
    destination?: string;
    amount?: number;
  };

  if (!origin || !destination || !amount || amount <= 0) {
    return res.status(400).json({
      error: "Missing or invalid fields: origin, destination, amount",
    });
  }

  const mockRoutes = [
    {
      id: `route-mock-${Date.now()}`,
      originAnchor: {
        id: "anc-placeholder-1",
        name: "MoneyGram",
        country: origin,
        currency: "USD",
        type: "on-ramp",
        status: "operational",
        available: true,
      },
      destinationAnchor: {
        id: "anc-placeholder-2",
        name: "Bitso",
        country: destination,
        currency: "MXN",
        type: "off-ramp",
        status: "operational",
        available: true,
      },
      originCountry: origin,
      originCurrency: "USD",
      destinationCountry: destination,
      destinationCurrency: "MXN",
      feePercentage: 1.2,
      feeAmount: amount * 0.012,
      feeBreakdown: { onRamp: 0.5, bridge: 0.2, offRamp: 0.5 },
      estimatedTime: "5 min",
      estimatedMinutes: 5,
      exchangeRate: 17.15,
      receivedAmount: (amount - amount * 0.012) * 17.15,
      available: true,
      escrow: true,
      risks: [],
      recommended: true,
    },
  ];

  return res.status(200).json({
    routes: mockRoutes,
    meta: {
      origin,
      destination,
      amount,
      queriedAt: new Date().toISOString(),
    },
  });
}
