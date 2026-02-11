import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * POST /api/generate-proof
 *
 * Accepts: { transactionId: string }
 * Returns: mock Proof of Payment document
 *
 * TODO: Replace with real Stellar ledger query via lib/stellar.ts
 *       and persist proof in Supabase via lib/supabase.ts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionId } = body;

    if (!transactionId) {
      return NextResponse.json(
        { error: "Missing field: transactionId" },
        { status: 400 }
      );
    }

    const stellarHash = Array.from({ length: 64 }, () =>
      "0123456789abcdef"[Math.floor(Math.random() * 16)]
    ).join("");

    return NextResponse.json({
      proof: {
        id: `POP-PROOF-${Date.now()}`,
        transactionId,
        timestamp: new Date().toISOString(),
        sender: "User Wallet (placeholder)",
        receiver: "Recipient (placeholder)",
        originAmount: 500,
        originCurrency: "USD",
        destinationAmount: 8500,
        destinationCurrency: "MXN",
        exchangeRate: 17.15,
        totalFees: 6.0,
        route: "MoneyGram > Bitso",
        stellarTxHash: stellarHash,
        status: "verified",
        verificationUrl: `https://stellar.expert/explorer/public/tx/${stellarHash}`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
