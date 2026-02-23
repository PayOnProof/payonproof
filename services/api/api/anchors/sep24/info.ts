import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readJsonBody } from "../../../lib/http.ts";
import { fetchSep24Info } from "../../../lib/stellar/sep24.ts";
import { discoverAnchorFromDomain } from "../../../lib/stellar/sep1.ts";

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

  const domain =
    typeof parsed.value.domain === "string" ? parsed.value.domain : undefined;
  const transferServerSep24 =
    typeof parsed.value.transferServerSep24 === "string"
      ? parsed.value.transferServerSep24
      : undefined;

  if (!domain && !transferServerSep24) {
    return res.status(400).json({
      error: "Provide domain or transferServerSep24",
    });
  }

  try {
    const result = await fetchSep24Info({
      domain,
      transferServerSep24,
    });

    return res.status(200).json({
      status: "ok",
      mode: "sep24",
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    const canFallback =
      message.includes("TRANSFER_SERVER_SEP0024 not found in stellar.toml") &&
      Boolean(domain);

    if (!canFallback) {
      return res.status(502).json({
        status: "error",
        error: message,
      });
    }

    try {
      const discovered = await discoverAnchorFromDomain({ domain: domain! });
      return res.status(200).json({
        status: "degraded",
        mode: "fallback-sep1",
        message:
          "Anchor does not expose SEP-24. Returning SEP-1 capabilities as fallback.",
        capabilities: {
          sep24: Boolean(discovered.transferServerSep24),
          sep6: Boolean(discovered.transferServerSep6),
          sep31: Boolean(discovered.directPaymentServer),
          sep10: Boolean(discovered.webAuthEndpoint),
        },
        discovered: {
          domain: discovered.domain,
          stellarTomlUrl: discovered.stellarTomlUrl,
          webAuthEndpoint: discovered.webAuthEndpoint,
          transferServerSep24: discovered.transferServerSep24,
          transferServerSep6: discovered.transferServerSep6,
          directPaymentServer: discovered.directPaymentServer,
          kycServer: discovered.kycServer,
        },
      });
    } catch (fallbackError) {
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : "Unknown error";
      return res.status(502).json({
        status: "error",
        error: message,
        fallbackError: fallbackMessage,
      });
    }
  }
}
