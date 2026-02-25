import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readJsonBody } from "../../../lib/http.ts";
import {
  listActiveAnchors,
  setAnchorActive,
  updateAnchorCapabilities,
} from "../../../lib/repositories/anchors-catalog.ts";
import { resolveAnchorCapabilities } from "../../../lib/stellar/capabilities.ts";
import { evaluateAnchorTrust } from "../../../lib/stellar/trust.ts";

const SEP1_404_COUNTER_PREFIX = "sep1_404_count:";

function parseSep1Counter(diagnostics: string[] | undefined): number {
  const marker = (diagnostics ?? []).find((d) => d.startsWith(SEP1_404_COUNTER_PREFIX));
  if (!marker) return 0;
  const value = Number(marker.slice(SEP1_404_COUNTER_PREFIX.length));
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function withoutSep1Counter(diagnostics: string[] | undefined): string[] {
  return (diagnostics ?? []).filter((d) => !d.startsWith(SEP1_404_COUNTER_PREFIX));
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
  const limit =
    typeof body.limit === "number" && Number.isFinite(body.limit)
      ? Math.max(1, Math.min(500, Math.floor(body.limit)))
      : 100;
  const country =
    typeof body.country === "string" ? body.country.trim().toUpperCase() : undefined;
  const sep1DisableThreshold =
    typeof body.sep1DisableThreshold === "number" && Number.isFinite(body.sep1DisableThreshold)
      ? Math.max(1, Math.min(20, Math.floor(body.sep1DisableThreshold)))
      : Math.max(1, Math.min(20, Number(process.env.ANCHOR_SEP1_404_DISABLE_THRESHOLD ?? 3)));
  const requireSep10 =
    String(process.env.ANCHOR_TRUST_REQUIRE_SEP10 ?? "true").toLowerCase() !== "false";
  const requireSigningKey =
    String(process.env.ANCHOR_TRUST_REQUIRE_SIGNING_KEY ?? "true").toLowerCase() !==
    "false";
  const requireSep24OrSep31 =
    String(process.env.ANCHOR_TRUST_REQUIRE_SEP24_OR_SEP31 ?? "true").toLowerCase() !==
    "false";

  try {
    const allAnchors = await listActiveAnchors();
    const candidates = allAnchors
      .filter((anchor) => (country ? anchor.country === country : true))
      .slice(0, limit);

    const results: Array<{
      id: string;
      domain: string;
      status: "ok" | "error";
      error?: string;
      autoDisabled?: boolean;
      sep1_404_count?: number;
    }> = [];

    for (const anchor of candidates) {
      try {
        const resolved = await resolveAnchorCapabilities({
          domain: anchor.domain,
          assetCode: anchor.currency,
        });

        await updateAnchorCapabilities({
          id: anchor.id,
          sep24: resolved.sep.sep24,
          sep6: resolved.sep.sep6,
          sep31: resolved.sep.sep31,
          sep10: resolved.sep.sep10,
          operational: resolved.sep.sep24 || resolved.sep.sep6 || resolved.sep.sep31,
          feeFixed: resolved.fees.fixed,
          feePercent: resolved.fees.percent,
          feeSource: resolved.fees.source,
          transferServerSep24: resolved.endpoints.transferServerSep24,
          transferServerSep6: resolved.endpoints.transferServerSep6,
          webAuthEndpoint: resolved.endpoints.webAuthEndpoint,
          directPaymentServer: resolved.endpoints.directPaymentServer,
          kycServer: resolved.endpoints.kycServer,
          diagnostics: resolved.diagnostics,
          lastCheckedAt: new Date().toISOString(),
        });

        const trust = evaluateAnchorTrust({
          domain: anchor.domain,
          capabilities: resolved,
          requireSep10,
          requireSigningKey,
          requireSep24OrSep31,
        });
        if (!trust.trusted) {
          await updateAnchorCapabilities({
            id: anchor.id,
            sep24: resolved.sep.sep24,
            sep6: resolved.sep.sep6,
            sep31: resolved.sep.sep31,
            sep10: resolved.sep.sep10,
            operational: false,
            feeFixed: resolved.fees.fixed,
            feePercent: resolved.fees.percent,
            feeSource: resolved.fees.source,
            transferServerSep24: resolved.endpoints.transferServerSep24,
            transferServerSep6: resolved.endpoints.transferServerSep6,
            webAuthEndpoint: resolved.endpoints.webAuthEndpoint,
            directPaymentServer: resolved.endpoints.directPaymentServer,
            kycServer: resolved.endpoints.kycServer,
            diagnostics: [
              ...resolved.diagnostics,
              ...trust.reasons.map((r) => `Trust policy: ${r}`),
            ],
            lastCheckedAt: new Date().toISOString(),
          });
          await setAnchorActive({ id: anchor.id, active: false });
          results.push({
            id: anchor.id,
            domain: anchor.domain,
            status: "error",
            error: `Untrusted anchor: ${trust.reasons.join("; ")}`,
            autoDisabled: true,
          });
          continue;
        }

        results.push({ id: anchor.id, domain: anchor.domain, status: "ok" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        const isSep1NotFound = /stellar\.toml/i.test(message) && /\b404\b/i.test(message);
        const prev404Count = parseSep1Counter(anchor.capabilities.diagnostics);
        const next404Count = isSep1NotFound ? prev404Count + 1 : 0;
        let autoDisabled = false;

        try {
          await updateAnchorCapabilities({
            id: anchor.id,
            sep24: false,
            sep6: false,
            sep31: false,
            sep10: false,
            operational: false,
            diagnostics: [
              ...withoutSep1Counter(anchor.capabilities.diagnostics),
              `Capability resolution error: ${message}`,
              `${SEP1_404_COUNTER_PREFIX}${next404Count}`,
            ],
            lastCheckedAt: new Date().toISOString(),
          });

          if (isSep1NotFound && next404Count >= sep1DisableThreshold) {
            await setAnchorActive({ id: anchor.id, active: false });
            autoDisabled = true;
          }
        } catch {
          // best effort only
        }

        results.push({
          id: anchor.id,
          domain: anchor.domain,
          status: "error",
          error: message,
          autoDisabled,
          sep1_404_count: isSep1NotFound ? next404Count : undefined,
        });
      }
    }

    const ok = results.filter((r) => r.status === "ok").length;
    const errors = results.length - ok;

    return res.status(200).json({
      status: "ok",
      refreshed: results.length,
      ok,
      errors,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
