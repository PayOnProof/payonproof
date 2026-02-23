import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readJsonBody } from "../lib/http.ts";

/**
 * POST /api/generate-proof
 *
 * Accepts: { transactionId: string }
 * Returns: mock Proof of Payment document
 *
 * TODO: Replace with real Solana ledger query
 *       and persist proof in Supabase via lib/supabase.ts
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

  const { transactionId } = parsed.value as { transactionId?: string };

  if (!transactionId) {
    return res.status(400).json({ error: "Missing field: transactionId" });
  }

  const solanaSig = Array.from({ length: 88 }, () =>
    "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"[
      Math.floor(Math.random() * 58)
    ]
  ).join("");

  return res.status(200).json({
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
      solanaSignature: solanaSig,
      status: "verified",
      verificationUrl: `https://explorer.solana.com/tx/${solanaSig}`,
    },
  });
}
