import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * POST /api/execute-transfer
 *
 * Accepts: { routeId: string, amount: number, useEscrow: boolean }
 * Returns: mock transaction object
 *
 * TODO: Replace with real Stellar transaction submission via lib/stellar.ts
 *       and record in Supabase via lib/supabase.ts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { routeId, amount, useEscrow } = body;

    if (!routeId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: "Missing or invalid fields: routeId, amount" },
        { status: 400 }
      );
    }

    const txId = `POP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const stellarHash = Array.from({ length: 64 }, () =>
      "0123456789abcdef"[Math.floor(Math.random() * 16)]
    ).join("");

    return NextResponse.json({
      transaction: {
        id: txId,
        routeId,
        amount,
        useEscrow: useEscrow ?? false,
        status: "completed",
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        stellarTxHash: stellarHash,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
