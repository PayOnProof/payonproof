import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getLatestLedgerSequence,
  getStellarConfig,
  getStellarNetwork,
} from "../lib/stellar.js";
import { getSupabaseAdmin } from "../lib/supabase.js";

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
  const checks = {
    stellar: "unknown",
    supabase: "unknown",
    anchors: "unknown",
  };
  const errors: Record<string, string> = {};
  let latestLedger: number | undefined;
  let anchorCount: number | null = null;

  try {
    latestLedger = await withTimeout(getLatestLedgerSequence(), 5000);
    checks.stellar = "ok";
  } catch (error) {
    checks.stellar = "error";
    errors.stellar = error instanceof Error ? error.message : "Unknown Horizon error";
  }

  try {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase
      .from("anchors_catalog")
      .select("id", { count: "exact" })
      .eq("network", getStellarNetwork())
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }
    checks.supabase = "ok";
    checks.anchors = "ok";
    anchorCount = count;
  } catch (error) {
    checks.supabase = "error";
    checks.anchors = "error";
    errors.supabase = error instanceof Error ? error.message : "Unknown Supabase error";
  }

  if (checks.stellar === "ok" && checks.supabase === "ok" && checks.anchors === "ok") {
    return res.status(200).json({
      status: "ok",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
      services: checks,
      stellar: {
        horizonUrl,
        network: getStellarNetwork(),
        latestLedger,
      },
      anchors: { count: anchorCount },
    });
  }

  return res.status(503).json({
    status: "degraded",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
    services: checks,
    stellar: {
      horizonUrl,
      network: getStellarNetwork(),
      latestLedger,
    },
    anchors: { count: anchorCount },
    errors,
  });
}
