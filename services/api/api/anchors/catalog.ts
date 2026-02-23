import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listActiveAnchors } from "../../lib/repositories/anchors-catalog.ts";

function getQueryParam(url: string | undefined, key: string): string | undefined {
  if (!url) return undefined;
  const parsed = new URL(url, "http://localhost");
  const value = parsed.searchParams.get(key);
  return value?.trim() ? value.trim() : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const countryFilter = getQueryParam(req.url, "country")?.toUpperCase();
    const typeFilter = getQueryParam(req.url, "type");
    const operationalOnly = getQueryParam(req.url, "operationalOnly") === "true";

    const anchors = await listActiveAnchors();
    const filtered = anchors.filter((anchor) => {
      if (countryFilter && anchor.country !== countryFilter) return false;
      if (
        typeFilter &&
        typeFilter !== "on-ramp" &&
        typeFilter !== "off-ramp"
      ) {
        return false;
      }
      if (typeFilter && anchor.type !== typeFilter) return false;
      if (operationalOnly && !anchor.capabilities.operational) return false;
      return true;
    });

    return res.status(200).json({
      anchors: filtered.map((anchor) => ({
        id: anchor.id,
        name: anchor.name,
        domain: anchor.domain,
        country: anchor.country,
        currency: anchor.currency,
        type: anchor.type,
        operational: anchor.capabilities.operational,
        sep: {
          sep24: anchor.capabilities.sep24,
          sep6: anchor.capabilities.sep6,
          sep31: anchor.capabilities.sep31,
          sep10: anchor.capabilities.sep10,
        },
        lastCheckedAt: anchor.capabilities.lastCheckedAt,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
