import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readJsonBody } from "../lib/http";

/**
 * POST /api/execute-transfer
 *
 * Accepts: { routeId: string, amount: number, useEscrow: boolean }
 * Returns: mock transaction object
 *
 * TODO: Replace with real Solana transaction submission
 *       and record in Supabase via lib/supabase.ts
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

  const { routeId, amount, useEscrow } = parsed.value as {
    routeId?: string;
    amount?: number;
    useEscrow?: boolean;
  };

  if (!routeId || !amount || amount <= 0) {
    return res
      .status(400)
      .json({ error: "Missing or invalid fields: routeId, amount" });
  }

  const txId = `POP-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;

  const solanaSig = Array.from({ length: 88 }, () =>
    "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"[
      Math.floor(Math.random() * 58)
    ]
  ).join("");

  return res.status(200).json({
    transaction: {
      id: txId,
      routeId,
      amount,
      useEscrow: useEscrow ?? false,
      status: "completed",
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      solanaSignature: solanaSig,
    },
  });
}
