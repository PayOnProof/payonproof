import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * POST /api/compare-routes
 *
 * Accepts: { origin: string, destination: string, amount: number }
 * Returns: mock route comparison data
 *
 * TODO: Replace with real Stellar anchor queries via lib/stellar.ts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { origin, destination, amount } = body;

    if (!origin || !destination || !amount || amount <= 0) {
      return NextResponse.json(
        { error: "Missing or invalid fields: origin, destination, amount" },
        { status: 400 }
      );
    }

    // Placeholder response structure matching RemittanceRoute[]
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

    return NextResponse.json({
      routes: mockRoutes,
      meta: {
        origin,
        destination,
        amount,
        queriedAt: new Date().toISOString(),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
