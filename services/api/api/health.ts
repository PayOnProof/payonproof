import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getLatestLedgerSequence, getStellarConfig } from "../lib/stellar.ts";

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Horizon timeout")), timeoutMs)
    ),
  ]);
}

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse
) {
  const { horizonUrl } = getStellarConfig();

  try {
    const ledger = await withTimeout(getLatestLedgerSequence(), 5000);
    return res.status(200).json({
      status: "ok",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
      services: {
        stellar: "ok",
        supabase: "placeholder",
        anchors: "placeholder",
      },
      stellar: {
        horizonUrl,
        latestLedger: ledger,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Horizon error";

    return res.status(503).json({
      status: "degraded",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
      services: {
        stellar: "error",
        supabase: "placeholder",
        anchors: "placeholder",
      },
      stellar: {
        horizonUrl,
        error: message,
      },
    });
  }
}
