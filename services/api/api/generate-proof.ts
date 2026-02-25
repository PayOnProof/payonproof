import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readJsonBody } from "../lib/http.ts";
import { getStellarConfig } from "../lib/stellar.ts";

/**
 * POST /api/generate-proof
 *
 * Accepts: {
 *   transactionId: string,
 *   stellarTxHash: string,
 *   route?: string,
 *   originAmount?: number,
 *   originCurrency?: string,
 *   destinationAmount?: number,
 *   destinationCurrency?: string,
 *   exchangeRate?: number,
 *   totalFees?: number
 * }
 * Verifies the transaction exists in Horizon before issuing proof payload.
 */

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeHash(value: string): string {
  return value.trim();
}

async function verifyTransactionOnHorizon(hash: string): Promise<void> {
  const { horizonUrl } = getStellarConfig();
  const endpoint = `${horizonUrl.replace(/\/+$/, "")}/transactions/${encodeURIComponent(
    hash
  )}`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Transaction not found on Horizon (${response.status}): ${body || response.statusText}`
    );
  }
}

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

  const transactionId = asString(parsed.value.transactionId);
  const stellarTxHash = normalizeHash(asString(parsed.value.stellarTxHash));

  if (!transactionId) {
    return res.status(400).json({ error: "Missing field: transactionId" });
  }
  if (!stellarTxHash) {
    return res.status(400).json({ error: "Missing field: stellarTxHash" });
  }

  try {
    await verifyTransactionOnHorizon(stellarTxHash);

    return res.status(200).json({
      proof: {
        id: `POP-PROOF-${Date.now()}`,
        transactionId,
        timestamp: new Date().toISOString(),
        sender: "Wallet Holder",
        receiver: "Anchor Settlement",
        originAmount: asNumber(parsed.value.originAmount) ?? 0,
        originCurrency: asString(parsed.value.originCurrency) || "USDC",
        destinationAmount: asNumber(parsed.value.destinationAmount) ?? 0,
        destinationCurrency: asString(parsed.value.destinationCurrency) || "USDC",
        exchangeRate: asNumber(parsed.value.exchangeRate) ?? 1,
        totalFees: asNumber(parsed.value.totalFees) ?? 0,
        route: asString(parsed.value.route) || "Anchor route",
        stellarTxHash,
        status: "verified",
        verificationUrl: `https://stellar.expert/explorer/public/tx/${stellarTxHash}`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: message });
  }
}
