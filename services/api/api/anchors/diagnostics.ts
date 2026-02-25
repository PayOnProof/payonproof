import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readJsonBody } from "../../lib/http.ts";
import { discoverAnchorFromDomain } from "../../lib/stellar/sep1.ts";
import { fetchSep24Info } from "../../lib/stellar/sep24.ts";
import { fetchSep6Info } from "../../lib/stellar/sep6.ts";
import { requestSep10Token } from "../../lib/stellar/sep10.ts";
import { resolveAnchorCapabilities } from "../../lib/stellar/capabilities.ts";

type DiagnosticsAction =
  | "sep1_discover"
  | "sep24_info"
  | "sep6_info"
  | "sep10_token"
  | "capabilities_resolve";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseAction(value: unknown): DiagnosticsAction | "" {
  const action = asString(value).toLowerCase();
  switch (action) {
    case "sep1_discover":
    case "sep24_info":
    case "sep6_info":
    case "sep10_token":
    case "capabilities_resolve":
      return action;
    default:
      return "";
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = readJsonBody(req);
  if (!parsed.ok) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const body = parsed.value;
  const action = parseAction(body.action);
  if (!action) {
    return res.status(400).json({
      error:
        "Invalid action. Use: sep1_discover | sep24_info | sep6_info | sep10_token | capabilities_resolve",
    });
  }

  try {
    if (action === "sep1_discover") {
      const domain = asString(body.domain);
      if (!domain) {
        return res.status(400).json({ error: "Missing field: domain" });
      }
      const discovered = await discoverAnchorFromDomain({ domain });
      return res.status(200).json({ status: "ok", action, discovered });
    }

    if (action === "sep24_info") {
      const domain = asString(body.domain) || undefined;
      const transferServerSep24 = asString(body.transferServerSep24) || undefined;
      if (!domain && !transferServerSep24) {
        return res
          .status(400)
          .json({ error: "Provide domain or transferServerSep24" });
      }

      try {
        const result = await fetchSep24Info({ domain, transferServerSep24 });
        return res.status(200).json({
          status: "ok",
          action,
          mode: "sep24",
          ...result,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        const canFallback =
          message.includes("TRANSFER_SERVER_SEP0024 not found in stellar.toml") &&
          Boolean(domain);
        if (!canFallback) {
          return res.status(502).json({ status: "error", action, error: message });
        }

        try {
          const discovered = await discoverAnchorFromDomain({ domain: domain! });
          return res.status(200).json({
            status: "degraded",
            action,
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
            action,
            error: message,
            fallbackError: fallbackMessage,
          });
        }
      }
    }

    if (action === "sep6_info") {
      const domain = asString(body.domain) || undefined;
      const transferServerSep6 = asString(body.transferServerSep6) || undefined;
      if (!domain && !transferServerSep6) {
        return res
          .status(400)
          .json({ error: "Provide domain or transferServerSep6" });
      }
      const result = await fetchSep6Info({ domain, transferServerSep6 });
      return res.status(200).json({
        status: "ok",
        action,
        mode: "sep6",
        ...result,
      });
    }

    if (action === "sep10_token") {
      const domain = asString(body.domain) || undefined;
      const webAuthEndpoint = asString(body.webAuthEndpoint) || undefined;
      const serverSigningKey = asString(body.serverSigningKey) || undefined;
      const accountPublicKey = asString(body.accountPublicKey) || undefined;
      const homeDomain = asString(body.homeDomain) || undefined;
      const clientDomain = asString(body.clientDomain) || undefined;

      if (!domain && !webAuthEndpoint) {
        return res
          .status(400)
          .json({ error: "Provide domain or webAuthEndpoint" });
      }

      const secretKey = process.env.STELLAR_ESCROW_SECRET?.trim();
      if (!secretKey) {
        return res.status(400).json({
          error:
            "Missing STELLAR_ESCROW_SECRET in backend env. Required for SEP-10 signing.",
        });
      }

      const token = await requestSep10Token({
        domain,
        webAuthEndpoint,
        serverSigningKey,
        secretKey,
        accountPublicKey,
        homeDomain,
        clientDomain,
      });
      return res.status(200).json({ status: "ok", action, token });
    }

    const domain = asString(body.domain);
    const assetCode = asString(body.assetCode) || "USD";
    if (!domain) {
      return res.status(400).json({ error: "Missing field: domain" });
    }
    const capabilities = await resolveAnchorCapabilities({ domain, assetCode });
    return res.status(200).json({ status: "ok", action, capabilities });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ status: "error", action, error: message });
  }
}

